import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('fan settings require admin/device credentials, isolate machines and validate ranges', async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema private;
   create table public.app_vending_machines(machine_id text primary key);
   create table private.kiosk_devices(id uuid primary key,token_hash text,enabled boolean);
   create table private.mobile_admin_accounts(username text primary key,enabled boolean);
   create table private.mobile_admin_sessions(token_hash text,username text,expires_at timestamptz);
   insert into public.app_vending_machines values ('one'),('two');
   insert into private.kiosk_devices values
   ('11111111-1111-4111-8111-111111111111',encode(sha256(convert_to('device-one','UTF8')),'hex'),true),
   ('22222222-2222-4222-8222-222222222222',encode(sha256(convert_to('device-two','UTF8')),'hex'),true);
   insert into private.mobile_admin_accounts values ('test',true);
   insert into private.mobile_admin_sessions values(encode(sha256(convert_to('admin-test','UTF8')),'hex'),'test',now()+interval '1 hour');`);
  await db.exec(readFileSync(new URL('../../frontend/supabase/migrations/20261111055710_device_fan_settings.sql',import.meta.url),'utf8'));
  await db.exec(`insert into private.device_fan_settings(machine_id,device_id) values
   ('one','11111111-1111-4111-8111-111111111111'),('two','22222222-2222-4222-8222-222222222222'); set role anon;`);
  const save=async(token,machine,settings)=>(await db.query('select public.admin_fan_settings($1,$2,$3::jsonb) value',[token,machine,JSON.stringify(settings)])).rows[0].value;
  const read=async(id,token)=>(await db.query('select public.get_device_fan_settings($1::uuid,$2) value',[id,token])).rows[0].value;
  await assert.rejects(save('bad','one',{temperatureOn:25,humidityOn:60}),/관리자/);
  await assert.rejects(db.query('select * from private.device_fan_settings'),/permission denied/);
  for(const settings of [{},[],{temperatureOn:true,humidityOn:60},{temperatureOn:25.5,humidityOn:60},{temperatureOn:1,humidityOn:60},{temperatureOn:25,humidityOn:101},{temperatureOn:25,humidityOn:60,device_id:'x'}])
   await assert.rejects(save('admin-test','one',settings));
  assert.deepEqual(await save('admin-test','one',{temperatureOn:25,humidityOn:60}),{temperatureOn:25,humidityOn:60});
  assert.deepEqual(await read('11111111-1111-4111-8111-111111111111','device-one'),{temperatureOn:25,humidityOn:60});
  assert.deepEqual(await read('22222222-2222-4222-8222-222222222222','device-two'),{temperatureOn:30,humidityOn:70});
  await assert.rejects(read('22222222-2222-4222-8222-222222222222','device-one'),/인증/);
  await assert.rejects(save('admin-test','missing',{temperatureOn:25,humidityOn:60}),/연결된/);
  await db.exec("reset role; update private.mobile_admin_sessions set expires_at=now()-interval '1 second'; set role anon;");
  await assert.rejects(save('admin-test','one',{temperatureOn:25,humidityOn:60}),/관리자/);
 } finally {await db.close();}
});
