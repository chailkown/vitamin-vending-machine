import { SYMPTOM_CATEGORIES, getNutrientByCode } from '../data/algorithmData';
import { EVIDENCE } from '../data/recommendationEvidence';
import { SYMPTOM_REVIEW, NUTRITION_CATEGORY } from '../data/recommendationPolicy';
import { getAllVitamins } from './vitaminService';
import { getQrProfileRules, assessRecommendedProducts } from './recommendationSafety';
export { parseQrPayload } from './qrPayload';
export { getQrProfileRules } from './recommendationSafety';

export const getLastRecommendSource = () => 'reviewed-policy-2026-10';

// The reviewed local policy is authoritative. Old DB symptom mappings cannot bypass it.
export const getRecommendationCatalog = async () => [NUTRITION_CATEGORY, ...SYMPTOM_CATEGORIES].map((cat) => ({
  ...cat, id: cat.code,
  symptoms: cat.symptoms.map((sym) => ({ ...sym, id: sym.code, nutrients: [] })),
}));

export const getRecommendationForSymptom = async (symptomCode) => {
  const catalog = await getRecommendationCatalog();
  const category = catalog.find((cat) => cat.symptoms.some((sym) => sym.code === symptomCode));
  const review = SYMPTOM_REVIEW[symptomCode];
  const nutrientData = (review?.nutrients || []).map(getNutrientByCode).filter(Boolean);
  return {
    nutrients: nutrientData.map((n) => n.name),
    nutrientExplanations: Object.fromEntries(nutrientData.map((n) => [n.name, review.message])),
    precautions: Object.fromEntries(nutrientData.map((n) => [n.name, n.precautions])),
    categoryTitle: category?.title || '',
    guidance: review?.message || '이 증상만으로 영양소 결핍을 판단할 수 없습니다. 지속되거나 심해지면 진료를 받아주세요.',
    sources: (review?.sources || ['general']).map((id) => EVIDENCE[id]),
    hold: !review?.nutrients?.length || Boolean(review.informationOnly),
  };
};

export const getRecommendationResult = async (symptomCode, qrProfile = null) => {
  const meta = await getRecommendationForSymptom(symptomCode);
  const all = await getAllVitamins();
  const qrRules = qrProfile ? getQrProfileRules(qrProfile) : null;
  const candidates = all.filter((p) => meta.nutrients.includes(p.category));
  const result = assessRecommendedProducts(candidates, qrProfile, qrRules);
  const accepted = meta.hold ? [] : result.accepted;
  const exclusions = candidates.map((product) => {
    const restriction = result.excluded.find((item) => item.id === product.id);
    return restriction || (meta.hold ? {id:product.id,name:product.name,reason:meta.guidance} : null);
  }).filter(Boolean);
  const sources = [...meta.sources, ...(qrRules?.sources || [])];
  return {
    ...meta, items: accepted.map((p) => p.id), products: accepted,
    nutrients: [...new Set(accepted.map((p) => p.category))],
    relatedItems: candidates.map((p) => p.id),
    relatedNutrients: meta.nutrients,
    qrProfile, qrRules, productExclusions: exclusions,
    sources: sources.filter((source, i) => sources.findIndex((s) => s.url === source.url) === i),
    hold: meta.hold || Boolean(qrRules?.hold),
    warnings: [
      '식사 보완 후보 안내입니다. 질병 치료·개인별 복용량을 결정하지 않으며, 다른 보충제와 총 섭취량을 확인해야 합니다.',
      ...(!qrProfile ? ['QR 건강정보가 없어 질환·약물·알레르기 검토를 하지 못했습니다.'] : []),
      ...(qrRules?.warnings || []),
    ],
  };
};

export const getProductIdsForSymptom = async (code) => (await getRecommendationResult(code)).items;
export const getProductIdsForNutrients = async (nutrients, excludedNutrients = []) => {
  const all = await getAllVitamins();
  return assessRecommendedProducts(all.filter((p) => nutrients.includes(p.category) && !excludedNutrients.includes(p.category)), null, null).accepted.map((p) => p.id);
};
