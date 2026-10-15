import { REVIEWED_NUTRIENTS } from './nutrientInformation';
import { SYMPTOM_REVIEW } from './recommendationPolicy';

export const NUTRIENTS = [
  { code: 'vitamin_b_complex', name: '비타민 B-Complex' },
  { code: 'vitamin_c', name: '비타민 C' },
  { code: 'vitamin_d3', name: '비타민 D3' },
  { code: 'magnesium', name: '마그네슘' },
  { code: 'omega_3', name: '오메가-3' },
  { code: 'coq10', name: '코엔자임 Q10' },
  { code: 'lutein_zeaxanthin', name: '루테인/제아잔틴' },
  { code: 'probiotics', name: '프로바이오틱스' },
  { code: 'zinc', name: '아연' },
  { code: 'milk_thistle', name: '밀크시슬' },
  { code: 'vitamin_e', name: '비타민 E' },
  { code: 'beta_glucan', name: '베타글루칸' },
].map((n) => ({ ...n, ...REVIEWED_NUTRIENTS[n.code] }));

export const SYMPTOM_CATEGORIES = [
  {
    code: 'energy',
    title: '피로 / 에너지 부족',
    emoji: '😴',
    symptoms: [
      { code: 'energy-a', label: '아침에 일어나도 피곤하고 무기력함' },
      { code: 'energy-b', label: '오후가 되면 집중력과 기력이 떨어짐' },
      { code: 'energy-c', label: '야근이나 밤샘 후 회복이 느림' },
      { code: 'energy-d', label: '가벼운 활동에도 쉽게 지침' },
    ],
  },
  {
    code: 'immunity',
    title: '감기·면역력 저하',
    emoji: '🛡️',
    symptoms: [
      { code: 'imm-a', label: '계절 변화 시 잦은 감기' },
      { code: 'imm-b', label: '작은 상처나 염증이 느리게 회복됨' },
      { code: 'imm-c', label: '질병에 안걸리게 면역력을 늘리고 싶음' },
    ],
  },
  {
    code: 'eye',
    title: '눈 / 시력 문제',
    emoji: '👀',
    symptoms: [
      { code: 'eye-a', label: 'PC/스마트폰 장시간 사용 후 눈 피로' },
      { code: 'eye-b', label: '책이나 근거리 작업 후 초점이 잘 안 맞음' },
      { code: 'eye-c', label: '눈이 건조하고 충혈됨' },
    ],
  },
  {
    code: 'muscle',
    title: '근육 / 신경 문제',
    emoji: '💪',
    symptoms: [
      { code: 'mus-a', label: '운동 후 근육통이 심하고 회복이 느림' },
      { code: 'mus-b', label: '손·발이 저리거나 감각 이상이 가끔 나타남' },
      { code: 'mus-c', label: '스트레스나 긴장으로 근육이 자주 뭉침' },
    ],
  },
  {
    code: 'joint',
    title: '관절 / 뼈 문제',
    emoji: '🦴',
    symptoms: [
      { code: 'jnt-a', label: '오래 걷거나 계단을 오를 때 무릎·허리가 뻐근' },
      { code: 'jnt-b', label: '가벼운 충격에도 뼈 통증이 느껴짐' },
      { code: 'jnt-c', label: '가벼운 활동에도 관절 통증이 나타남' },
    ],
  },
  {
    code: 'digest',
    title: '소화 / 장 건강 문제',
    emoji: '🍽️',
    symptoms: [
      { code: 'dig-a', label: '변비나 설사가 자주 발생함' },
      { code: 'dig-b', label: '식사 후 더부룩하고 트림이 잦음' },
      { code: 'dig-c', label: '기름진 음식 섭취 후 소화가 잘 안 됨' },
    ],
  },
  {
    code: 'liver',
    title: '간 / 문제',
    emoji: '🫀',
    symptoms: [
      { code: 'liv-a', label: '술이나 기름진 음식 섭취 후 피로가 심함' },
      { code: 'liv-b', label: '간 회복과 해독이 필요하다고 느껴짐' },
      { code: 'liv-c', label: '약물 장기 복용으로 간 부담이 우려됨' },
    ],
  },
];


export const SYMPTOM_NUTRIENT_MAP = Object.fromEntries(Object.entries(SYMPTOM_REVIEW).map(([code, review]) => [code, review.nutrients]));

export const getNutrientByCode = (code) => NUTRIENTS.find((n) => n.code === code);

export const getNutrientNamesForSymptom = (symptomCode) =>
  (SYMPTOM_NUTRIENT_MAP[symptomCode] || []).map((c) => getNutrientByCode(c)?.name).filter(Boolean);

export const getNutrientExplanationsForSymptom = (symptomCode) => {
  const map = {};
  for (const code of SYMPTOM_NUTRIENT_MAP[symptomCode] || []) {
    const n = getNutrientByCode(code);
    if (n) map[n.name] = n.purpose;
  }
  return map;
};
