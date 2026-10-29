import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/services/adminService.js',import.meta.url),'utf8').replace(/export /g,'').replace(/import\.meta\.env/g,'({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"public-key"})');
test('admin password stays in login request only; failed login and logout cannot authorize inventory',async()=>{
 let accept=false;const calls=[];
 const ctx=vm.createContext({setTimeout,clearTimeout,AbortController,fetch:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  return {ok:true,json:async()=>url.endsWith('mobile_admin_login')?(accept?{token:'a'.repeat(64)}:{error:'인증 실패'}):{ok:true}};
 }});
 vm.runInContext(source,ctx);
 await assert.rejects(vm.runInContext("adminAction('list')",ctx),/로그인/);
 await assert.rejects(vm.runInContext("loginAdmin('admin','wrong')",ctx),/인증 실패/);
 await assert.rejects(vm.runInContext("adminAction('list')",ctx),/로그인/);
 accept=true;await vm.runInContext("loginAdmin('admin','test-password')",ctx);
 await vm.runInContext("adminAction('list')",ctx);
 assert.equal(calls.at(-1).body.p_token,'a'.repeat(64));assert.equal(calls.at(-1).body.p_password,undefined);
 await vm.runInContext('logoutAdmin()',ctx);
 await assert.rejects(vm.runInContext("adminAction('list')",ctx),/로그인/);
});
