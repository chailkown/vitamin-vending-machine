/**
 * Supabase 연결 테스트: node scripts/test-db.mjs
 * frontend/.env 의 REACT_APP_* 변수를 읽습니다.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) {
    console.error('❌ frontend/.env 파일이 없습니다. .env.example 을 복사하세요.');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.REACT_APP_SUPABASE_URL;
const key = env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY 를 .env 에 설정하세요.');
  process.exit(1);
}

console.log('URL:', url);
const sb = createClient(url, key);

const { count, error } = await sb
  .from('vitamins')
  .select('id', { count: 'exact', head: true })
  .eq('is_active', true);

if (error) {
  console.error('❌ 조회 실패:', error.message);
  if (error.hint) console.error('   hint:', error.hint);
  process.exit(1);
}

console.log(`✅ 활성 상품 ${count ?? 0}건`);

const { count: nutrientCount } = await sb.from('nutrients').select('id', { count: 'exact', head: true });
const { count: symptomCount } = await sb.from('symptoms').select('id', { count: 'exact', head: true });
console.log(`✅ 영양소 ${nutrientCount ?? 0}종, 증상 ${symptomCount ?? 0}개 (기대: 12 / 22)`);

const { data: sample } = await sb
  .from('vitamins')
  .select('id, name, category, price, serving_content, form')
  .eq('is_active', true)
  .order('id')
  .limit(2);

if (sample?.length) {
  console.log('제품 샘플:', sample);
}

if ((count ?? 0) < 20 || (nutrientCount ?? 0) < 12) {
  console.warn('⚠ seed.sql 실행이 필요할 수 있습니다.');
}
