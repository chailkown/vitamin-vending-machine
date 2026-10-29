-- Test-only rows and stock changes are always rolled back. No motors are called.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); device uuid:=gen_random_uuid(); req uuid:=gen_random_uuid();
 token text:=encode(extensions.gen_random_bytes(32),'hex'); receipt jsonb; product bigint; before_stock integer; result jsonb;
begin
 insert into auth.users(id) values(a),(b);
 insert into private.kiosk_devices(id,token_hash,enabled,slots) values(device,encode(sha256(convert_to(token,'UTF8')),'hex'),true,array(select generate_series(1,20)));
 select id,stock into product,before_stock from public.vitamins where is_active and stock>1 and dispenser_slot is not null order by id limit 1;
 if product is null then raise exception '시험 가능한 재고 없음'; end if;
 receipt:=public.reserve_free_order_with_history(device,token,req,jsonb_build_array(jsonb_build_object('vitamin_id',product,'quantity',1)),a);
 perform set_config('request.jwt.claim.sub',a::text,true);
 if jsonb_array_length(public.member_purchase_history())<>0 then raise exception '미완료 기록 노출'; end if;
 perform public.finish_free_order(device,token,(receipt->>'order_id')::uuid,req,'completed');
 result:=public.member_purchase_history();
 if jsonb_array_length(result)<>1 or result->0->>'id'<>receipt->>'order_id' then raise exception '본인 내역 누락'; end if;
 if (select member_user_id from public.orders where id=(receipt->>'order_id')::uuid) is not null then raise exception '재고 회원 분리 실패'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if jsonb_array_length(public.member_purchase_history())<>0 then raise exception '다른 회원 기록 노출'; end if;
 if (select stock from public.vitamins where id=product)<>before_stock-1 then raise exception '재고 오류'; end if;
 perform public.reserve_free_order_with_history(device,token,req,jsonb_build_array(jsonb_build_object('vitamin_id',product,'quantity',1)),a);
 if (select stock from public.vitamins where id=product)<>before_stock-1 then raise exception '중복 차감'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.member_purchase_history(); raise exception 'anonymous access allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'history integration passed; temporary rows and stock changes rolled back' result;
