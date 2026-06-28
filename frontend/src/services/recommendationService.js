import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  SYMPTOM_CATEGORIES,
  SYMPTOM_NUTRIENT_MAP,
  getNutrientByCode,
  getNutrientNamesForSymptom,
  getNutrientExplanationsForSymptom,
} from '../data/algorithmData';
import { getAllVitamins } from './vitaminService';

let lastRecommendSource = 'unknown';

export const getLastRecommendSource = () => lastRecommendSource;

const CONDITION_RULES = {
  1: { label: '간질환', add: ['밀크시슬', '비타민 E'] },
  2: { label: '당뇨', add: ['마그네슘', '오메가-3'] },
  3: { label: '빈혈', add: ['비타민 B-Complex'] },
  4: { label: '고혈압', add: ['마그네슘', '오메가-3'] },
  5: { label: '지방간', add: ['밀크시슬', '비타민 E'] },
  6: { label: '고중성지방혈증', add: ['오메가-3'] },
  7: { label: '위장질환', add: ['프로바이오틱스'] },
};

const ALLERGY_RULES = {
  1: { label: '견과류' },
  2: { label: '유제품', exclude: ['프로바이오틱스'] },
  3: { label: '갑각류', exclude: ['오메가-3'] },
  4: { label: '복숭아' },
  5: { label: '꽃가루' },
};

const MEDICATION_RULES = {
  1: { label: '혈압약', exclude: ['코엔자임 Q10'] },
  2: { label: '당뇨약' },
  3: { label: '항응고제', exclude: ['오메가-3', '비타민 E'] },
  4: { label: '위장약', exclude: ['비타민 C'] },
  5: { label: '진통제', exclude: ['밀크시슬'] },
};

const ALCOHOL_ADD = {
  1: ['비타민 B-Complex'],
  2: ['비타민 B-Complex', '밀크시슬'],
  3: ['비타민 B-Complex', '밀크시슬', '비타민 E'],
};

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeQrProfile = (payload) => ({
  id: String(payload?.id || 'unknown'),
  name: String(payload?.n || '사용자'),
  age: toInt(payload?.a),
  gender: payload?.g === 'F' ? 'F' : 'M',
  height: toInt(payload?.h),
  weight: toInt(payload?.w),
  smoking: toInt(payload?.s) === 1,
  alcohol: toInt(payload?.al),
  condition: toInt(payload?.c),
  allergy: toInt(payload?.ag),
  medication: toInt(payload?.m),
});

export const DEFAULT_QR_PAYLOAD = {
  id: 'ssdd',
  n: '차일권',
  a: 25,
  g: 'M',
  h: 167,
  w: 68,
  s: 1,
  al: 0,
  c: 0,
  ag: 0,
  m: 0,
};

export const parseQrPayload = (raw) => {
  try {
    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ok: true, profile: normalizeQrProfile(payload), raw: payload };
  } catch (error) {
    return { ok: false, message: 'QR 데이터 형식이 올바르지 않습니다.' };
  }
};

export const getQrProfileRules = (profile) => {
  const addedNutrients = [];
  const excludedNutrients = [];
  const reasons = {};
  const exclusions = {};

  const addNutrient = (nutrient, reason) => {
    if (!nutrient) return;
    addedNutrients.push(nutrient);
    reasons[nutrient] = reason;
  };

  const excludeNutrient = (nutrient, reason) => {
    if (!nutrient) return;
    excludedNutrients.push(nutrient);
    exclusions[nutrient] = reason;
  };

  if (profile.smoking) {
    addNutrient('비타민 C', 'QR 건강정보: 흡연자는 항산화·면역 보조가 필요해 추가 추천되었습니다.');
  }

  (ALCOHOL_ADD[profile.alcohol] || []).forEach((nutrient) => {
    addNutrient(nutrient, 'QR 건강정보: 음주 수준을 반영해 간 피로·에너지 대사 보조 영양소를 추가했습니다.');
  });

  const conditionRule = CONDITION_RULES[profile.condition];
  (conditionRule?.add || []).forEach((nutrient) => {
    addNutrient(nutrient, `QR 건강정보: ${conditionRule.label} 정보를 반영해 추가 추천되었습니다.`);
  });

  const allergyRule = ALLERGY_RULES[profile.allergy];
  (allergyRule?.exclude || []).forEach((nutrient) => {
    excludeNutrient(nutrient, `QR 건강정보: ${allergyRule.label} 알레르기 가능성을 고려해 제외했습니다.`);
  });

  const medicationRule = MEDICATION_RULES[profile.medication];
  (medicationRule?.exclude || []).forEach((nutrient) => {
    excludeNutrient(nutrient, `QR 건강정보: ${medicationRule.label} 복용 정보를 고려해 제외했습니다.`);
  });

  const bmi = profile.height > 0 ? profile.weight / ((profile.height / 100) ** 2) : 0;
  if (bmi >= 25) {
    addNutrient('오메가-3', 'QR 건강정보: 체중/키 기준 관리가 필요해 대사·염증 보조 영양소를 추가했습니다.');
  }

  return {
    addedNutrients: [...new Set(addedNutrients)],
    excludedNutrients: [...new Set(excludedNutrients)],
    reasons,
    exclusions,
    labels: {
      condition: conditionRule?.label || '해당 없음',
      allergy: allergyRule?.label || '해당 없음',
      medication: medicationRule?.label || '해당 없음',
    },
  };
};

const mapStaticCategories = () =>
  SYMPTOM_CATEGORIES.map((cat) => ({
    id: cat.code,
    code: cat.code,
    title: cat.title,
    emoji: cat.emoji,
    symptoms: cat.symptoms.map((s) => ({
      id: s.code,
      code: s.code,
      label: s.label,
      nutrients: (SYMPTOM_NUTRIENT_MAP[s.code] || []).map((nc) => {
        const n = getNutrientByCode(nc);
        return n
          ? { code: n.code, name: n.name, purpose: n.purpose, precautions: n.precautions }
          : null;
      }).filter(Boolean),
    })),
  }));

/**
 * 증상 카테고리 + 세부 증상 + 추천 영양소 (DB 우선)
 */
export const getRecommendationCatalog = async () => {
  if (!isSupabaseConfigured || !supabase) {
    lastRecommendSource = 'sample';
    return mapStaticCategories();
  }

  try {
    const { data, error } = await supabase
      .from('symptom_categories')
      .select(
        `
        id, code, title, emoji, sort_order,
        symptoms (
          id, code, label, sort_order,
          symptom_nutrients (
            sort_order,
            nutrients ( id, code, name, purpose, precautions )
          )
        )
      `
      )
      .order('sort_order', { ascending: true });

    if (error || !data?.length) {
      lastRecommendSource = 'sample';
      return mapStaticCategories();
    }

    lastRecommendSource = 'supabase';
    return data.map((cat) => ({
      id: cat.code,
      code: cat.code,
      title: cat.title,
      emoji: cat.emoji || '',
      symptoms: (cat.symptoms || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((sym) => ({
          id: sym.code,
          code: sym.code,
          label: sym.label,
          nutrients: (sym.symptom_nutrients || [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((sn) => sn.nutrients)
            .filter(Boolean),
        })),
    }));
  } catch {
    lastRecommendSource = 'sample';
    return mapStaticCategories();
  }
};

/**
 * 증상 코드로 추천 영양소 이름·설명
 */
export const getRecommendationForSymptom = async (symptomCode) => {
  const catalog = await getRecommendationCatalog();
  for (const cat of catalog) {
    const sym = cat.symptoms.find((s) => s.code === symptomCode);
    if (sym) {
      const nutrients = sym.nutrients.map((n) => n.name);
      const nutrientExplanations = {};
      const precautions = {};
      sym.nutrients.forEach((n) => {
        nutrientExplanations[n.name] = n.purpose;
        precautions[n.name] = n.precautions;
      });
      return { nutrients, nutrientExplanations, precautions, categoryTitle: cat.title };
    }
  }

  return {
    nutrients: getNutrientNamesForSymptom(symptomCode),
    nutrientExplanations: getNutrientExplanationsForSymptom(symptomCode),
    precautions: {},
    categoryTitle: '',
  };
};

/**
 * 증상에 맞는 판매 제품 ID (영양소별 대표 제품 최대 2개)
 */
export const getProductIdsForSymptom = async (symptomCode) => {
  const { nutrients } = await getRecommendationForSymptom(symptomCode);
  const all = await getAllVitamins();
  const ids = [];

  for (const nutrientName of nutrients) {
    const matched = all.filter((p) => p.category === nutrientName);
    ids.push(...matched.slice(0, 2).map((p) => p.id));
  }

  return [...new Set(ids)];
};

export const getProductIdsForNutrients = async (nutrients, excludedNutrients = []) => {
  const all = await getAllVitamins();
  const exclude = new Set(excludedNutrients);
  const ids = [];

  for (const nutrientName of nutrients) {
    if (exclude.has(nutrientName)) continue;
    const matched = all.filter((p) => p.category === nutrientName);
    ids.push(...matched.slice(0, 2).map((p) => p.id));
  }

  return [...new Set(ids)];
};
