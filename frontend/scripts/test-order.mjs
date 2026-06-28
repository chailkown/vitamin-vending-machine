/**
 * place_order RPC 테스트 (실제 주문 1건 생성 + 재고 1 차감)
 * node scripts/test-order.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env');

if (!existsSync(envPath)) {
  console.error('❌ .env 없음');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const sb = createClient(env.REACT_APP_SUPABASE_URL, env.REACT_APP_SUPABASE_ANON_KEY);

const { data: before } = await sb.from('vitamins').select('id, name, stock').eq('id', 1).single();

let { data: orderId, error } = await sb.rpc('place_order', {
  items: [{ vitamin_id: 1, quantity: 1 }],
  p_recommendation_note: 'db:test',
  p_payment_method: 'card',
});

if (error?.message?.includes('Could not find')) {
  ({ data: orderId, error } = await sb.rpc('place_order', {
    items: [{ vitamin_id: 1, quantity: 1 }],
    p_recommendation_note: 'db:test',
  }));
}

if (error) {
  console.error('❌ place_order 실패:', error.message);
  if (error.message.includes('Could not find')) {
    console.error('   → supabase/orders_schema.sql 을 실행하세요.');
  }
  process.exit(1);
}

const { data: after } = await sb.from('vitamins').select('stock').eq('id', 1).single();

console.log('✅ 주문 ID:', orderId);
console.log(`   재고 id=1: ${before?.stock} → ${after?.stock}`);
