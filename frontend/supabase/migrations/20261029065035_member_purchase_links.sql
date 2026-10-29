begin;
-- Optional receipt ownership is separate from inventory and health profiles.
create table private.member_purchase_links (
 order_id uuid primary key references public.orders(id) on delete cascade,
 member_id uuid not null references auth.users(id) on delete cascade
);
create index member_purchase_links_member_idx on private.member_purchase_links(member_id);
alter table private.member_purchase_links enable row level security;
revoke all on private.member_purchase_links from public,anon,authenticated;

create function private.reserve_free_order_with_history(p_device_id uuid,p_device_token text,p_request_id uuid,items jsonb,p_history_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb; owner_id uuid;
begin
 -- The existing reservation authenticates the device and locks the request.
 receipt:=private.reserve_free_order(p_device_id,p_device_token,p_request_id,items,null);
 if coalesce((receipt->>'replayed')::boolean,false) then
   select member_id into owner_id from private.member_purchase_links where order_id=(receipt->>'order_id')::uuid;
   if owner_id is distinct from p_history_user_id and exists(select 1 from auth.users where id=p_history_user_id) then
     raise exception '동일 요청의 기록 대상이 변경되었습니다.';
   end if;
 else
   -- Deleted/unknown users do not block inventory dispensing.
   insert into private.member_purchase_links(order_id,member_id)
     select (receipt->>'order_id')::uuid,id from auth.users where id=p_history_user_id;
 end if;
 return receipt;
end $$;
create function public.reserve_free_order_with_history(p_device_id uuid,p_device_token text,p_request_id uuid,items jsonb,p_history_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.reserve_free_order_with_history(p_device_id,p_device_token,p_request_id,items,p_history_user_id)
$$;
revoke all on function public.reserve_free_order_with_history(uuid,text,uuid,jsonb,uuid),private.reserve_free_order_with_history(uuid,text,uuid,jsonb,uuid) from public;
grant execute on function public.reserve_free_order_with_history(uuid,text,uuid,jsonb,uuid),private.reserve_free_order_with_history(uuid,text,uuid,jsonb,uuid) to anon,authenticated;

create function private.member_purchase_history() returns jsonb language plpgsql security definer set search_path='' as $$
declare member uuid:=auth.uid(); result jsonb;
begin
 if member is null then raise exception '다시 로그인해주세요.'; end if;
 select coalesce(jsonb_agg(record order by completed_at desc),'[]'::jsonb) into result from (
   select o.completed_at,jsonb_build_object('id',o.id,'member_user_id',member,'status',o.status,
     'created_at',o.created_at,'completed_at',o.completed_at,'total_qty',o.total_qty,
     'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,'quantity',i.quantity) order by i.id)
         from public.order_items i where i.order_id=o.id),'[]'::jsonb)) record
   from public.orders o where o.status='completed' and
     (o.member_user_id=member or exists(select 1 from private.member_purchase_links l where l.order_id=o.id and l.member_id=member))
 ) own_orders;
 return result;
end $$;
create function public.member_purchase_history() returns jsonb language sql security invoker set search_path='' as $$
 select private.member_purchase_history()
$$;
revoke all on function public.member_purchase_history(),private.member_purchase_history() from public,anon;
grant execute on function public.member_purchase_history(),private.member_purchase_history() to authenticated;
commit;
