import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { toKioskProfile, serializeQrProfile } from '../src/services/qrProfile.js';
import { createQrDataUrl } from '../src/services/qrImage.js';
import { loadUserProfile, saveUserProfile } from '../src/services/profileStorage.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => fs.readFileSync(root + path, 'utf8');
const healthCatalog = JSON.parse(read('frontend/src/data/healthCatalog.json'));
const loadPure = (path) => import('data:text/javascript;base64,' + Buffer.from(read(path).replace("import healthCatalog from '../data/healthCatalog.json';", `const healthCatalog = ${JSON.stringify(healthCatalog)};`)).toString('base64'));
const { parseQrPayload } = await loadPure('frontend/src/services/qrPayload.js');
const { clearKioskSession, watchKioskIdle } = await loadPure('frontend/src/services/kioskSession.js');
const profile = { name: '테스트 사용자', age: '25', gender: '남성', height: '170', weight: '65', smoking: '비흡연', alcohol: '안 함', conditions: ['간질환'], allergies: '해당 없음', medications: '직접입력약' };
const now = Date.now();
const payload = toKioskProfile(profile, 'test-a', now);
const memory = () => {
  const values = new Map();
  return { getItem: (k) => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: (k) => values.delete(k) };
};
const strip = (s) => s.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm,'').replace(/^export \{[^}]*\} from [^;]*;\s*/gm,'').replace(/export /g,'');

test('A/B profiles survive reload, never auto-save empty fallback', () => {
  const store = memory();
  saveUserProfile(store,'A',profile);
  saveUserProfile(store,'B',{...profile,name:'다른 사용자'});
  assert.equal(loadUserProfile(store,'A',{}).name, profile.name);
  assert.equal(loadUserProfile(store,'B',{}).name,'다른 사용자');
  assert.equal(loadUserProfile(store,'A',{}).name, profile.name);
  assert.deepEqual(loadUserProfile(store,'missing',{}),{});
  assert.equal(store.getItem('health-app-profile-v1-missing'),null);
});
test('QR contains exactly the agreed 11 fields and scalar codes', () => {
  assert.deepEqual(Object.keys(payload),['id','n','a','g','h','w','s','al','c','ag','m']);
  assert.equal(payload.c,1);assert.equal(payload.ag,0);assert.equal(payload.m,99);
  assert.equal(parseQrPayload(JSON.stringify(payload)).ok,true);
  assert.throws(()=>toKioskProfile({...profile,conditions:['간질환','당뇨']},'test-a'),/하나만/);
});

test('invalid, malformed, missing and wrong type QR rejected', () => {
  for (const raw of [null,{},[],42,'null','{}','[]','42','{bad',JSON.stringify({...payload,a:'25'}),JSON.stringify({...payload,id:''}),JSON.stringify({...payload,c:null}),JSON.stringify({...payload,h:0})]) {
    assert.equal(parseQrPayload(raw,now).ok,false,raw);
  }
  for (const field of Object.keys(payload)) {
    const incomplete = {...payload}; delete incomplete[field];
    assert.equal(parseQrPayload(incomplete).ok, false, `missing ${field}`);
  }
});

test('same QR remains valid over time; legacy timestamps do not restrict use', () => {
  assert.equal(Object.hasOwn(payload,'expiresAt'),false);
  assert.equal(Object.hasOwn(payload,'issuedAt'),false);
  const ctx = vm.createContext({ TextEncoder, Date, healthCatalog });
  vm.runInContext(strip(read('frontend/src/services/qrPayload.js')), ctx);
  ctx.raw = JSON.stringify(payload);
  for (const elapsed of [0, 60_000, 86_400_000, 365 * 86_400_000]) {
    ctx.Date = class extends Date { static now() { return now + elapsed; } };
    assert.equal(vm.runInContext('parseQrPayload(raw).ok',ctx),true);
  }
  for (const timestamps of [
    {issuedAt:'2000-01-01T00:00:00.000Z',expiresAt:'2000-01-01T00:00:30.000Z'},
    {issuedAt:'2099-01-01T00:00:00.000Z'},
    {issuedAt:'bad',expiresAt:'bad'},
  ]) assert.equal(parseQrPayload({...payload,...timestamps}).ok,true);
});

test('unchanged health data produces identical QR; edits regenerate current health data', () => {
  assert.deepEqual(toKioskProfile({...profile},'test-a'),payload);
  const updated = toKioskProfile({...profile, weight:'70',conditions:['고혈압'],medications:'당뇨약'},'test-a');
  assert.notDeepEqual(updated,payload);
  const parsed = parseQrPayload(JSON.stringify(updated));
  assert.equal(parsed.ok,true);
  assert.equal(parsed.profile.weight,70);
  assert.deepEqual(parsed.profile.conditionCodes,[4]);
  assert.deepEqual(parsed.profile.medicationCodes,[2]);
});
test('Korean QR PNG round-trips through independent jsQR decoder', async () => {
  const text = JSON.stringify(payload);
  const url = await createQrDataUrl(text);
  const png = PNG.sync.read(Buffer.from(url.split(',')[1],'base64'));
  const result = jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
  assert.equal(result?.data,text);
  await assert.rejects(createQrDataUrl('한'.repeat(1000)),/너무 큽니다/);
});
const recommendationFiles = ['frontend/src/data/productPolicy.js','frontend/src/data/nutrientInformation.js','frontend/src/data/recommendationEvidence.js','frontend/src/data/recommendationPolicy.js','frontend/src/data/algorithmData.js','frontend/src/data/sampleVitamins.js','frontend/src/services/vitaminService.js','frontend/src/services/recommendationSafety.js','frontend/src/services/recommendationService.js'];
const recommendationContext = (extras={}) => {
  const ctx = vm.createContext({process:{env:{}},supabase:null,isSupabaseConfigured:false,...extras});
  for (const path of recommendationFiles) vm.runInContext(strip(read(path)),ctx);
  return ctx;
};
test('20 active fallback products; category isolation and conservative multi-condition rules', async () => {
  const ctx = recommendationContext();
  assert.equal((await vm.runInContext('getAllVitamins()',ctx)).length,20);
  for (const category of vm.runInContext('[...new Set(SAMPLE_VITAMINS.map(v=>v.category))]',ctx)) {
    const rows = await vm.runInContext(`getVitaminsByCategory(${JSON.stringify(category)})`,ctx);
    assert.equal(rows.length,['밀크시슬','비타민 E'].includes(category) ? 0 : 2);
    assert.ok(rows.every(row=>row.category === category));
  }
  ctx.parsed = parseQrPayload(payload,now).profile;
  const rules = vm.runInContext('getQrProfileRules(parsed)',ctx);
  assert.equal(rules.addedNutrients.length,0);
  assert.ok(rules.excludedNutrients.includes('밀크시슬'));
  assert.equal(rules.hold,true);
  assert.ok(rules.warnings.some((text)=>text.includes('직접 입력')));
});
test('idle activity resets the 60s deadline and cleanup removes all listeners', () => {
  const listeners = new Map(), timers = new Map();
  let next=0, reset=0;
  const clock={setTimeout:(fn,ms)=>{assert.equal(ms,60_000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
  const target={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const cleanup=watchKioskIdle(target,()=>reset++,60_000,clock);
  listeners.get('input')();
  assert.equal(timers.size,1);
  [...timers.values()][0]();
  assert.equal(reset,1);
  cleanup();
  assert.equal(listeners.size,0); assert.equal(timers.size,0);
});

test('mobile and kiosk health catalogs agree; every new option round-trips without expiry', () => {
  assert.deepEqual(JSON.parse(read('health-app-web/src/services/healthCatalog.json')),healthCatalog);
  for (const kind of ['conditions','allergies','medications']) {
    for (const [name,code] of Object.entries(healthCatalog[kind])) {
      const next = toKioskProfile({...profile,[kind]:[name]},'test-a');
      assert.equal(parseQrPayload(JSON.stringify(next)).ok,true,`${kind}: ${name}`);
      assert.equal(next[{conditions:'c',allergies:'ag',medications:'m'}[kind]],code);
    }
  }
  assert.equal(parseQrPayload({...payload,c:[0]}).ok,false);
  assert.equal(parseQrPayload({...payload,conditions:['해당 없음','당뇨'],c:[0,2]}).ok,false);
  assert.equal(parseQrPayload({...payload,m:[50]}).ok,false);
});

const healthyProfile = {age:25,conditionCodes:[0],medicationCodes:[0],allergyCodes:[0],conditions:['해당 없음'],allergies:['해당 없음'],medications:['해당 없음'],height:170,weight:65};
test('specific medication restrictions combine without disease, alcohol or BMI additions', () => {
  const ctx = recommendationContext({parsed:{...healthyProfile,medicationCodes:[6,8,9,10,13,15,18,19],conditionCodes:[2,4,6],smoking:true,alcohol:3,weight:120}});
  const rules = vm.runInContext('getQrProfileRules(parsed)',ctx);
  assert.equal(rules.addedNutrients.length,0);
  for (const nutrient of ['비타민 E','오메가-3','코엔자임 Q10','비타민 D3','마그네슘','아연','비타민 B-Complex']) assert.ok(rules.excludedNutrients.includes(nutrient),nutrient);
  assert.ok(rules.exclusions['마그네슘'].includes('항생제'));
  assert.ok(rules.exclusions['마그네슘'].includes('비스포스포네이트'));
  assert.ok(rules.sources.every((source)=>source.url.startsWith('https://')));
});
test('high-risk and unspecified profiles hold, rather than falling through to default recommendations', async () => {
  const ctx = recommendationContext();
  for (const patch of [{age:17},{conditionCodes:[8]},{conditionCodes:[14]},{conditionCodes:[15]},{conditionCodes:[16]},{conditionCodes:[17]},{medicationCodes:[11]},{medicationCodes:[12]},{medicationCodes:[14]},{medicationCodes:[1]},{medicationCodes:[99]},{conditionCodes:[99]},{allergyCodes:[99]}]) {
    ctx.parsed={...healthyProfile,...patch};
    const result=await vm.runInContext("getRecommendationResult('diet-c',parsed)",ctx);
    assert.equal(result.hold,true,JSON.stringify(patch));
    assert.equal(result.items.length,0);
    assert.ok(result.warnings.length>1);
  }
});
test('renal stones, iron overload, hypercalcemia and atrial fibrillation remove corresponding candidates', async () => {
  const ctx=recommendationContext();
  for(const [code,symptom] of [[9,'diet-c'],[11,'diet-c'],[10,'diet-d'],[13,'diet-omega']]) {
    ctx.parsed={...healthyProfile,conditionCodes:[code]};ctx.symptom=symptom;
    assert.equal((await vm.runInContext('getRecommendationResult(symptom,parsed)',ctx)).items.length,0);
  }
});
test('food allergies require verified product labels; allergens and malformed metadata cannot pass', () => {
  const ctx=recommendationContext({parsed:{...healthyProfile,allergyCodes:[2,6]}});
  const product={id:3,name:'fixture',category:'비타민 C',allergen_verified:true,allergen_codes:[],allergen_source_url:'https://example.com/label',allergen_checked_at:'2026-01-01'};
  for(const patch of [{allergen_verified:false},{allergen_codes:[2]},{allergen_codes:[6]},{allergen_codes:['6']},{allergen_source_url:null},{allergen_checked_at:'bad'}]) {
    ctx.products=[{...product,...patch}];
    assert.equal(vm.runInContext('assessRecommendedProducts(products,parsed,getQrProfileRules(parsed)).accepted.length',ctx),0);
  }
  ctx.products=[product];
  assert.equal(vm.runInContext('assessRecommendedProducts(products,parsed,getQrProfileRules(parsed)).accepted.length',ctx),1);
  ctx.parsed={...healthyProfile,allergyCodes:[3]};ctx.products=[{...product,allergen_codes:[6]}];
  // Shellfish is not automatically fish allergy; actual label controls this decision.
  assert.equal(vm.runInContext('assessRecommendedProducts(products,parsed,getQrProfileRules(parsed)).accepted.length',ctx),1);
});
test('symptom-only, liver, tingling and eye complaints do not imply a treatable deficiency', async () => {
  const ctx=recommendationContext({parsed:healthyProfile});
  for(const symptom of ['liv-a','liv-b','liv-c','mus-b','eye-a','eye-b','eye-c','dig-a','energy-a','unknown']) {
    ctx.symptom=symptom;
    const result=await vm.runInContext('getRecommendationResult(symptom,parsed)',ctx);
    assert.equal(result.items.length,0,symptom);assert.ok(result.guidance);
  }
  const normal=await vm.runInContext("getRecommendationResult('diet-c',parsed)",ctx);
  assert.deepEqual(Array.from(normal.items),[3,4]);
  const noQr=await vm.runInContext("getRecommendationResult('diet-c')",ctx);
  assert.ok(noQr.warnings.some((text)=>text.includes('QR 건강정보가 없어')));
});
test('disabled products stay absent from search and id lookup; authoritative empty DB does not resurrect samples', async () => {
  const ctx=recommendationContext();
  for(const id of [18,20,21,22]) {ctx.id=id;assert.equal(await vm.runInContext('getVitaminById(id)',ctx),null);}
  assert.equal((await vm.runInContext("searchVitamins('Milk Thistle')",ctx)).length,0);
  const chain={select:()=>chain,eq:()=>chain,order:async()=>({data:[],error:null})};
  const empty=recommendationContext({isSupabaseConfigured:true,supabase:{from:()=>chain}});
  assert.equal((await vm.runInContext('getAllVitamins()',empty)).length,0);
  assert.equal((await vm.runInContext("getVitaminsByCategory('비타민 C')",empty)).length,0);
});
test('kiosk reset clears only transient kiosk keys, preserving inventory/history/recovery', () => {
  const storage=memory();
  for (const key of ['vitamin-kiosk-user','vitamin-kiosk-qr','inventory','history','vitamin-kiosk-pending-order']) storage.setItem(key,'keep');
  clearKioskSession(storage);
  assert.equal(storage.getItem('vitamin-kiosk-user'),null);
  for (const key of ['inventory','history','vitamin-kiosk-pending-order']) assert.equal(storage.getItem(key),'keep');
});

test('mobile history uses authenticated JWT and excludes other users/failures', async () => {
  let sent;
  const ctx = vm.createContext({ AbortController,setTimeout,clearTimeout, requireAuthClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'member-jwt'}}})}}), fetch: async (url, options) => {
    sent = {url,headers:options.headers};
    return {ok:true,text:async()=>JSON.stringify([{member_user_id:'A',status:'completed'},{member_user_id:'B',status:'completed'},{member_user_id:'A',status:'failed'}])};
  } });
  vm.runInContext(strip(read('health-app-web/src/services/healthDb.js')).replace(/import\.meta\.env/g,'({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"demo"})'),ctx);
  const result=await vm.runInContext('getPurchaseHistory("A","a-pass")',ctx);
  assert.equal(result.length,1); assert.equal(result[0].member_user_id,'A');
  assert.ok(sent.url.includes('/orders?member_user_id=eq.A&status=eq.completed'));
  assert.equal(sent.headers.Authorization,'Bearer member-jwt');
  assert.ok(!sent.url.includes('a-pass'));
});
test('hardware service handles acknowledged, not-started and unknown results; production disallows simulation', async () => {
  const source = strip(read('frontend/src/services/dispenserService.js'));
  const ctx=vm.createContext({ process:{env:{NODE_ENV:'production',REACT_APP_DISPENSE_MODE:'simulation'}},setTimeout,clearTimeout,AbortController });
  vm.runInContext(source,ctx);
  assert.equal(vm.runInContext('isDispenserConfigured()',ctx),false);
  for (const [result,ok,restore] of [[{accepted:true},true,undefined],[{notStarted:true},false,true],[{},false,false]]) {
    const hardware=vm.createContext({process:{env:{NODE_ENV:'production',REACT_APP_DISPENSER_URL:'http://localhost:9000/dispense'}},
      setTimeout,clearTimeout,AbortController,fetch:async()=>({ok:true,json:async()=>result})});
    vm.runInContext(source,hardware);
    const outcome=await vm.runInContext('dispenseOrder({order_id:"id",items:[{dispenser_slot:1,quantity:2}]})',hardware);
    assert.equal(outcome.ok,ok); assert.equal(outcome.safeToRestore,restore);
  }
});

const cart=[{product:{id:3},qty:1}];
const freeContext=(fetcher,hasGateway=true)=>{
 const storage=memory();const ctx=vm.createContext({window:{localStorage:storage},document:{querySelector:()=>hasGateway?{content:'csrf-test'}:null},
  crypto:{getRandomValues:(bytes)=>{bytes.fill(7);return bytes;}},Uint8Array,setTimeout,clearTimeout,AbortController,fetch:fetcher});
 vm.runInContext(strip(read('frontend/src/services/orderService.js')),ctx);ctx.cart=cart;
 return {ctx,storage,call:()=>vm.runInContext('placeOrder(cart,{qrProfile:{id:"member"}})',ctx)};
};
test('free dispensing never calls cloud privileges from browser; gateway is required',async()=>{
 const h=freeContext(()=>{throw new Error('must not run');},false);
 assert.equal((await h.call()).code,'GATEWAY_UNAVAILABLE');
});
test('free request forwards the agreed QR JSON without adding a separate identity field or price',async()=>{
 let sent;
 const h=freeContext(async(url,options)=>{sent={url,body:JSON.parse(options.body),headers:options.headers};return {json:async()=>({ok:true,requiresReview:false})};});
 assert.equal((await h.call()).ok,true);assert.equal(sent.url,'/api/order');assert.equal(sent.body.qrProfile.id,'member');
 assert.equal(sent.body.userId,undefined);assert.equal(sent.body.price,undefined);assert.equal(sent.headers['X-Kiosk-Token'],'csrf-test');
 assert.equal(h.storage.getItem('vitamin-kiosk-pending-order'),null);
});
test('free double-click is blocked and unknown output keeps durable recovery reference',async()=>{
 let reject;const h=freeContext(()=>new Promise((resolve,r)=>{reject=r;}));
 const first=h.call();assert.equal((await h.call()).code,'ORDER_BUSY');reject(new Error('lost'));
 assert.equal((await first).requiresReview,true);assert.ok(h.storage.getItem('vitamin-kiosk-pending-order'));
});

test('actual PostgreSQL schemas: stock, idempotency, failed orders and user history', async () => {
  const db=new PGlite();
  await db.exec('create role anon; create role authenticated;');
  for (const path of ['frontend/supabase/schema.sql','frontend/supabase/seed.sql','frontend/supabase/orders_schema.sql','frontend/supabase/payment_schema.sql','health-app-web/supabase/app_schema.sql','frontend/supabase/kiosk_purchase_history.sql']) await db.exec(read(path));
  // The new migration is repeatable and preserves data.
  await db.exec(read('frontend/supabase/kiosk_purchase_history.sql'));
  await db.exec(read('frontend/supabase/catalog_safety_update.sql'));
  await db.exec(read('frontend/supabase/catalog_safety_update.sql'));
  assert.equal((await db.query('select count(*)::int as count from vitamins where is_active=true')).rows[0].count,20);
  assert.equal((await db.query('select count(*)::int as count from nutrients')).rows[0].count,12);
  await assert.rejects(db.query('select place_kiosk_order($1::jsonb,$2::uuid) as result',[JSON.stringify([{vitamin_id:18,quantity:1}]),'99999999-9999-4999-8999-999999999999']),/상품을 찾을 수 없습니다/);
  await db.exec("insert into app_users(user_id,password,name) values ('A','a-pass','에이'),('B','b-pass','비'); update vitamins set stock=10 where id=1;");
  // Exercise the configured service path against real SQL, not just static fallback rows.
  const service=vm.createContext({process:{env:{REACT_APP_USE_SAMPLE_FALLBACK:'false'}},isSupabaseConfigured:true,supabase:{from:()=>{
    let category;
    const builder={select:()=>builder,eq:(key,value)=>{if(key==='category')category=value;return builder;},
      order:async()=>({data:(await db.query('select * from vitamins where is_active=true and category=$1 order by id',[category])).rows})};
    return builder;
  }}});
  for (const path of recommendationFiles.slice(0,7)) vm.runInContext(strip(read(path)),service);
  const dbProducts=await vm.runInContext("getVitaminsByCategory('비타민 C')",service);
  assert.equal(dbProducts.length,2);assert.ok(dbProducts.every(p=>p.category==='비타민 C'));
  const reserve=async(request,user='A',qty=2)=> (await db.query('select place_kiosk_order($1::jsonb,$2::uuid,$3::text) as result',[JSON.stringify([{vitamin_id:1,quantity:qty}]),request,user])).rows[0].result;
  const finish=async(order,request,result)=> (await db.query('select finish_kiosk_order($1::uuid,$2::uuid,$3::text) as result',[order,request,result])).rows[0].result;
  const stock=async()=> (await db.query('select stock from vitamins where id=1')).rows[0].stock;
  const request='11111111-1111-4111-8111-111111111111';
  const order=await reserve(request);
  assert.equal(order.total_amount,320); assert.equal(await stock(),8);
  assert.equal((await reserve(request)).order_id,order.order_id); assert.equal(await stock(),8);
  await finish(order.order_id,request,'completed');
  clearKioskSession(memory()); assert.equal(await stock(),8);
  const history=async(user,password)=>(await db.query('select get_app_purchase_history($1,$2) as result',[user,password])).rows[0].result;
  assert.equal((await history('A','a-pass')).length,1); assert.equal((await history('B','b-pass')).length,0);
  await assert.rejects(history('A','b-pass'),/로그인/);
  await db.exec('set role anon;');
  await assert.rejects(db.query('select * from orders'),/permission denied/);
  await db.exec('reset role;');
  const failedId='22222222-2222-4222-8222-222222222222';
  const failed=await reserve(failedId);
  await finish(failed.order_id,failedId,'failed'); await finish(failed.order_id,failedId,'failed');
  assert.equal(await stock(),8); assert.equal((await history('A','a-pass')).length,1);
  const reviewId='33333333-3333-4333-8333-333333333333';
  const review=await reserve(reviewId);
  await finish(review.order_id,reviewId,'review_required');
  assert.equal(await stock(),6); assert.equal((await history('A','a-pass')).length,1);
  await assert.rejects(reserve('44444444-4444-4444-8444-444444444444','A',99),/재고/);
  assert.equal(await stock(),6);
  await assert.rejects(db.query('select place_kiosk_order($1::jsonb,$2::uuid,$3::text) as result',[JSON.stringify([{vitamin_id:1,quantity:4},{vitamin_id:1,quantity:4}]),'55555555-5555-4555-8555-555555555555','A']),/재고/);
  assert.equal(await stock(),6);
  await db.close();
});


test('member profile save carries the JWT and reports DB failure without success', async () => {
  let sent, fail=false;
  const ctx=vm.createContext({AbortController,setTimeout,clearTimeout,requireAuthClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'member-jwt'}}})}}),
    fetch:async(url,options)=>{sent={url,options};return {ok:!fail,text:async()=>JSON.stringify(fail?{message:'denied'}:[{user_id:'A'}])};}});
  vm.runInContext(strip(read('health-app-web/src/services/healthDb.js')).replace(/import\.meta\.env/g,'({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"demo"})'),ctx);
  ctx.profile=profile;ctx.payload=payload;
  await vm.runInContext('saveHealthProfile({userId:"A",profile,kioskPayload:payload})',ctx);
  assert.ok(sent.url.includes('/member_health_profiles?on_conflict=user_id'));
  assert.equal(sent.options.headers.Authorization,'Bearer member-jwt');
  assert.equal(JSON.parse(sent.options.body)[0].user_id,'A');
  fail=true;
  await assert.rejects(vm.runInContext('saveHealthProfile({userId:"A",profile,kioskPayload:payload})',ctx),/denied/);
});


test('real authentication API is used and rejected credentials never become a local login', async () => {
  let called, reject=false;
  const ctx=vm.createContext({createClient:()=>({auth:{
    signUp:async(body)=>{called={kind:'signup',body};return {data:{user:{id:'uuid'},session:null},error:null};},
    signInWithPassword:async(body)=>{called={kind:'login',body};return reject?{error:new Error('invalid credentials')}:{data:{user:{id:'uuid'},session:{access_token:'jwt'}}};}
  }})});
  vm.runInContext(strip(read('health-app-web/src/services/authClient.js')).replace(/import\.meta\.env/g,'({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"demo"})'),ctx);
  const signup=await vm.runInContext('authenticateMember({mode:"signup",email:"sample@example.com",password:"eight-chars",name:"테스트"})',ctx);
  assert.equal(signup.session,null);assert.equal(called.kind,'signup');assert.equal(called.body.options.data.name,'테스트');
  const login=await vm.runInContext('authenticateMember({mode:"login",email:"sample@example.com",password:"eight-chars"})',ctx);
  assert.equal(login.session.access_token,'jwt');assert.equal(called.kind,'login');
  reject=true;
  await assert.rejects(vm.runInContext('authenticateMember({mode:"login",email:"sample@example.com",password:"bad"})',ctx),/invalid credentials/);
});


test('phone QR is ASCII-only for HID scanners and decodes to the exact Korean profile', async () => {
  const raw=serializeQrProfile(toKioskProfile(profile,'11111111-1111-4111-8111-111111111111'));
  assert.match(raw,/^[\x20-\x7e]+$/);
  assert.deepEqual(JSON.parse(raw),toKioskProfile(profile,'11111111-1111-4111-8111-111111111111'));
  assert.equal(parseQrPayload(raw).ok,true);
  const png=PNG.sync.read(Buffer.from((await createQrDataUrl(raw)).split(',')[1],'base64'));
  const scanned=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
  assert.ok(scanned);assert.equal(scanned.data,raw);
  assert.equal(parseQrPayload(scanned.data).profile.name,profile.name);
});

test('phone requires scalar, valid code values', () => {
  const valid=toKioskProfile(profile,'test-a');
  assert.throws(()=>serializeQrProfile({...valid,c:[0]}),/형식/);
  assert.throws(()=>serializeQrProfile({...valid,n:''}),/형식/);
});

test('kiosk calculates from the compact QR without a server request',async()=>{
 const ctx=vm.createContext({healthCatalog,TextEncoder});
 vm.runInContext(strip(read('frontend/src/services/qrPayload.js')),ctx);vm.runInContext(strip(read('frontend/src/services/qrResolver.js')),ctx);
 ctx.raw=JSON.stringify({id:'ssdd',n:'차일권',a:25,g:'M',h:167,w:68,s:1,al:0,c:0,ag:0,m:0});
 const result=await vm.runInContext('resolveQrPayload(raw)',ctx);
 assert.equal(result.ok,true);assert.equal(result.profile.id,'ssdd');assert.deepEqual(Array.from(result.profile.conditionCodes),[0]);
 assert.equal(result.credential,undefined);
});

test('verification link parser rejects another project before invoking auth',async()=>{
 const ctx=vm.createContext({URL,createClient:()=>({auth:{verifyOtp:()=>{throw new Error('should not run');}}})});
 vm.runInContext(strip(read('health-app-web/src/services/authClient.js')).replace(/import\.meta\.env/g,'({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"demo"})'),ctx);
 await assert.rejects(vm.runInContext('verifySignupLink("https://other.example/auth/v1/verify?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&type=signup")',ctx),/프로젝트/);
});


test('user example QR survives PNG decode without extra fields or expiry',async()=>{
 const value={id:'ssdd',n:'차일권',a:25,g:'M',h:167,w:68,s:1,al:0,c:0,ag:0,m:0};
 const png=PNG.sync.read(Buffer.from((await createQrDataUrl(serializeQrProfile(value))).split(',')[1],'base64'));
 const result=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.ok(result);assert.deepEqual(JSON.parse(result.data),value);assert.equal(parseQrPayload(result.data).ok,true);
});
