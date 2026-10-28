import { supabase, isSupabaseConfigured } from '../config/supabase';
import { SAMPLE_VITAMINS } from '../data/sampleVitamins';
import { NUTRIENTS } from '../data/algorithmData';

const CATEGORY_BRIEF_DESCRIPTION = {
  '비타민 B-Complex': '에너지 대사 및 신경 기능 지원',
  '비타민 C': '면역력 강화 및 항산화 작용',
  '비타민 D3': '면역 조절 및 근육·뼈 기능 보조',
  '마그네슘': '근육 이완 및 신경 안정',
  '오메가-3': 'EPA·DHA 공급을 통한 염증 완화',
  '코엔자임 Q10': '미토콘드리아 에너지 생성 보조',
  '루테인/제아잔틴': '황반 보호 및 눈 피로 완화',
  '프로바이오틱스': '장내 균형 및 면역 보조',
  '아연': '면역 기능 및 상처 회복 지원',
  '밀크시슬': '간 세포 보호 및 회복 보조',
  '비타민 E': '항산화 및 세포막 보호',
  '베타글루칸': '면역 세포 활성화 보조',
};

const normalizeProductName = (name) => {
  if (name === 'NOW Foods Beta-1,3/1,6-D-Glucan') {
    return 'NOW Foods Beta Glucan 250mg';
  }
  return name;
};

const PRODUCT_IMAGE_BY_NAME = {
  'Qunol Ubiquinol': '/screen/Qunol Ubiquinol.webp',
  'California Gold Nutrition Lutein Plus': '/screen/California Gold Nutrition Lutein Plus.webp',
  "Doctor's Best Lutein with Zeaxanthin": "/screen/Doctor's Best Lutein with Zeaxanthin.webp",
  'Jarrow Dophilus EPS': '/screen/Jarrow Dophilus EPS.webp',
  'Culturelle Daily Probiotic': '/screen/Culturelle Daily Probiotic.webp',
  'Solgar Zinc Picolinate 15mg': '/screen/Solgar Zinc Picolinate 15mg.webp',
  'California Gold Nutrition Milk Thistle 150mg': '/screen/California Gold Nutrition Milk Thistle 150mg.webp',
  'Solgar Zinc Picolinate 22mg': '/screen/Solgar Zinc Picolinate 22mg.webp',
  'California Gold Nutrition Milk Thistle 300mg': '/screen/California Gold Nutrition Milk Thistle 300mg.webp',
  'Swanson Vitamin E': '/screen/Swanson Vitamin E.webp',
  'Solgar Natural Vitamin E': '/screen/Solgar Natural Vitamin E.webp',
  'NOW Foods Beta-Glucan': '/screen/NOW Foods Beta-Glucan.webp',
  'NOW Foods Beta Glucan 250mg': '/screen/NOW Foods Beta Glucan 250mg.webp',
};

const normalizeProductImage = (name, imageUrl) => {
  const normalizedName = normalizeProductName(name);
  if (!imageUrl || imageUrl.includes('via.placeholder.com')) {
    return PRODUCT_IMAGE_BY_NAME[normalizedName] || imageUrl;
  }
  return imageUrl;
};

/** @type {'supabase' | 'sample' | 'unknown'} */
let lastDataSource = 'unknown';
/** @type {string | null} */
let lastFetchError = null;

const allowSampleFallback =
  process.env.REACT_APP_USE_SAMPLE_FALLBACK !== 'false';

export const getLastDataSource = () => lastDataSource;
export const getLastFetchError = () => lastFetchError;

const normalizeVitamin = (vitamin) => {
  const price = Math.max(1, Number(vitamin?.price) || 0);
  const nutrient = vitamin?.nutrients;
  const category = vitamin?.category || nutrient?.name || '';
  const reviewed = NUTRIENTS.find((n) => n.name === category);
  return {
    ...vitamin,
    name: normalizeProductName(vitamin?.name),
    image_url: normalizeProductImage(vitamin?.name, vitamin?.image_url),
    price,
    category,
    nutrient_code: nutrient?.code || null,
    nutrient_purpose: reviewed?.purpose || nutrient?.purpose || null,
    nutrient_precautions: reviewed?.precautions || nutrient?.precautions || null,
    description:
      reviewed?.purpose || (vitamin?.description && String(vitamin.description).trim().length > 0
        ? vitamin.description
        : nutrient?.purpose || CATEGORY_BRIEF_DESCRIPTION[category] || '제품 원료·함량을 확인해주세요.'),
  };
};

const normalizeVitaminList = (items = []) => (items || []).filter(isProductEnabled).map(normalizeVitamin);

const useSample = (reason, items = SAMPLE_VITAMINS) => {
  lastDataSource = 'sample';
  lastFetchError = reason || null;
  if (!allowSampleFallback) {
    return [];
  }
  return normalizeVitaminList(items);
};

const VITAMIN_COLUMNS =
  'id, nutrient_id, name, category, price, serving_content, form, remarks, image_url, description, stock, dispenser_slot, is_active, allergen_verified, allergen_codes, allergen_source_url, allergen_checked_at, nutrients ( code, name, purpose, precautions )';

/**
 * Supabase 연결 및 vitamins 테이블 조회 테스트
 * @returns {Promise<{ ok: boolean, count?: number, message?: string }>}
 */
export const checkSupabaseConnection = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: '환경변수가 설정되지 않았습니다.' };
  }

  const { count, error } = await supabase
    .from('vitamins')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, count: count ?? 0 };
};

const fetchActiveVitamins = async (queryFn) => {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: { message: 'Supabase 미설정' } };
  }

  let query = supabase.from('vitamins').select(VITAMIN_COLUMNS).eq('is_active', true);
  if (typeof queryFn === 'function') {
    query = queryFn(query);
  }

  return query.order('id', { ascending: true });
};

// 모든 영양제 조회
export const getAllVitamins = async () => {
  try {
    const { data, error } = await fetchActiveVitamins();

    if (error) {
      return useSample(error.message);
    }

    // An empty successful response is authoritative; never resurrect disabled DB products.

    lastDataSource = 'supabase';
    lastFetchError = null;
    return normalizeVitaminList(data);
  } catch (error) {
    return useSample(error?.message || String(error));
  }
};

// 특정 ID의 영양제 조회
export const getVitaminById = async (id) => {
  try {
    if (!isSupabaseConfigured || !supabase) {
      if (!allowSampleFallback) return null;
      const sample = SAMPLE_VITAMINS.find((v) => v.id === id);
      return sample && isProductEnabled(sample) ? normalizeVitamin(sample) : null;
    }

    const { data, error } = await supabase
      .from('vitamins')
      .select(VITAMIN_COLUMNS)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    lastDataSource = 'supabase';
    lastFetchError = null;
    return isProductEnabled(data) ? normalizeVitamin(data) : null;
  } catch {
    if (!allowSampleFallback) return null;
    const sample = SAMPLE_VITAMINS.find((v) => v.id === id);
    return sample && isProductEnabled(sample) ? normalizeVitamin(sample) : null;
  }
};

// 카테고리별 영양제 조회
export const getVitaminsByCategory = async (category) => {
  try {
    const { data, error } = await fetchActiveVitamins((q) => q.eq('category', category));

    if (error) {
      const filtered = SAMPLE_VITAMINS.filter((v) => v.category === category);
      if (filtered.length > 0) {
        return useSample(error?.message || '카테고리 결과 없음', filtered);
      }
      return [];
    }

    lastDataSource = 'supabase';
    lastFetchError = null;
    return normalizeVitaminList(data);
  } catch (error) {
    return useSample(error?.message || '카테고리 조회 실패', SAMPLE_VITAMINS.filter((v) => v.category === category));
  }
};

// 검색어로 영양제 조회
export const searchVitamins = async (searchTerm) => {
  const term = searchTerm?.trim();
  if (!term) return [];

  try {
    if (!isSupabaseConfigured || !supabase) {
      if (!allowSampleFallback) return [];
      return normalizeVitaminList(
        SAMPLE_VITAMINS.filter(
          (v) =>
            v.name.toLowerCase().includes(term.toLowerCase()) ||
            v.description.toLowerCase().includes(term.toLowerCase())
        )
      );
    }

    const { data, error } = await fetchActiveVitamins((q) =>
      q.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
    );

    if (error) throw error;

    lastDataSource = 'supabase';
    lastFetchError = null;
    return normalizeVitaminList(data || []);
  } catch {
    if (!allowSampleFallback) return [];
    return normalizeVitaminList(
      SAMPLE_VITAMINS.filter(
        (v) =>
          v.name.toLowerCase().includes(term.toLowerCase()) ||
          v.description.toLowerCase().includes(term.toLowerCase())
      )
    );
  }
};

// 영양제 추가 (관리자용 — RLS에서 insert 허용 시)
export const addVitamin = async (vitaminData) => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('vitamins').insert([vitaminData]).select();
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
};

export const updateVitamin = async (id, vitaminData) => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('vitamins').update(vitaminData).eq('id', id).select();
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
};

export const deleteVitamin = async (id) => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('vitamins').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
};
import { isProductEnabled } from '../data/productPolicy';
