// Read-only reproductions: no network, real users, remote DB, or motors.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const catalog = JSON.parse(read('frontend/src/data/healthCatalog.json'));
const qrContext = vm.createContext({ healthCatalog: catalog, TextEncoder });
vm.runInContext(read('frontend/src/services/qrPayload.js').replace(/^import .*;\r?\n/m, '').replace(/export /g, ''), qrContext);
qrContext.payload = { id:'audit-example', n:'테스트', a:25, g:'M', h:167, w:68, s:0, al:0, c:0, ag:0, m:0, extra:'unexpected' };
const parsed = vm.runInContext('parseQrPayload(JSON.stringify(payload))', qrContext);
assert.equal(parsed.ok, true);
assert.equal(Object.keys(parsed.raw).length, 11);
console.log('PASS: kiosk parser normalizes extra fields without expiry.');
const values = new Map();
const storage = { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) };
const paths = [];
const context = vm.createContext({
  window:{localStorage:storage}, document:{querySelector:()=>({content:'audit-token'})},
  crypto:{getRandomValues:bytes=>{bytes.fill(7);return bytes;}}, Uint8Array, AbortController, setTimeout, clearTimeout,
  fetch:async(path)=>{ paths.push(path); if(path==='/api/order')throw new Error('connection failed before receipt'); return {ok:true,json:async()=>({known:true,requiresReview:false,state:'cancelled'})}; },
  cart:[{product:{id:3},qty:1}],
});
vm.runInContext(read('frontend/src/services/orderService.js').replace(/export /g,''), context);
assert.equal((await vm.runInContext('placeOrder(cart)',context)).requiresReview,true);
assert.equal((await vm.runInContext('placeOrder(cart)',context)).code,'RECOVERED');
assert.equal(storage.getItem('vitamin-kiosk-pending-order'),null);
assert.equal(paths.filter(path=>path==='/api/order').length,1);
assert.equal(paths[1],'/api/reconcile');
console.log('PASS: missing request cancellation clears the browser reference without automatic re-dispensing.');
