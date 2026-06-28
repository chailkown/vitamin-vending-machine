/**
 * 알고리즘 설계 슬라이드 기준 정적 데이터 (DB 폴백)
 */

export const NUTRIENTS = [
  {
    code: 'vitamin_b_complex',
    name: '비타민 B-Complex',
    purpose: '에너지 대사 및 신경 기능 지원',
    help_summary: '만성 피로, 집중력 저하, 신경 피로',
    precautions:
      '다른 B군 보충제·에너지음료와 중복 섭취 시 B6·B3 과다 위험. 장기 고용량 섭취 시 말초신경 이상, 홍조, 감각 이상 보고. 저녁 늦게 섭취 시 불면 유발 가능.',
  },
  {
    code: 'vitamin_c',
    name: '비타민 C',
    purpose: '면역력 강화 및 항산화 작용',
    help_summary: '감기 예방, 회복 지연, 피로',
    precautions:
      '고용량 섭취 시 설사, 복부 팽만, 위장 자극 가능. 위염·위궤양 병력 시 공복 섭취 주의. 신장결석 병력 시 장기 고용량 권장 안 함.',
  },
  {
    code: 'vitamin_d3',
    name: '비타민 D3',
    purpose: '면역 조절 및 근육·뼈 기능 보조',
    help_summary: '면역 저하, 근육 약화, 관절 부담',
    precautions:
      '지용성 비타민으로 체내 축적 가능. 장기 고용량 시 고칼슘혈증, 신장 부담 위험. 신장 질환자나 칼슘 제제 병용 시 전문가 상담 권장.',
  },
  {
    code: 'magnesium',
    name: '마그네슘',
    purpose: '근육 이완 및 신경 안정',
    help_summary: '근육통, 쥐, 스트레스, 수면 문제',
    precautions:
      '과다 섭취 시 설사, 복부 경련 흔함. 신장 기능 저하 환자는 고마그네슘혈증 위험. 일부 항생제와 병용 시 흡수 저해 가능.',
  },
  {
    code: 'omega_3',
    name: '오메가-3',
    purpose: 'EPA·DHA 공급을 통한 염증 완화',
    help_summary: '관절 뻐근함, 눈 건조, 피로',
    precautions:
      '항응고제·아스피린 복용 시 출혈 위험 증가 가능. 수술 예정자는 1~2주 전 중단 권장. 위장 민감자는 트림, 속쓰림 가능.',
  },
  {
    code: 'coq10',
    name: '코엔자임 Q10',
    purpose: '미토콘드리아 에너지 생성 보조',
    help_summary: '기력 저하, 피로, 심한 활동 후 회복',
    precautions:
      '혈압 강하 작용으로 저혈압 환자/약 복용자 주의. 드물게 속쓰림, 위장 불편. 항응고제 효과 약화 가능성 있음.',
  },
  {
    code: 'lutein_zeaxanthin',
    name: '루테인/제아잔틴',
    purpose: '황반 보호 및 눈 피로 완화',
    help_summary: 'PC·스마트폰 사용 후 눈 피로',
    precautions:
      '지용성으로 식사와 함께 섭취 권장. 장기 고용량 시 피부 황변 보고(독성은 낮음). 다른 지용성 비타민과 과도 중복 불필요.',
  },
  {
    code: 'probiotics',
    name: '프로바이오틱스',
    purpose: '장내 균형 및 면역 보조',
    help_summary: '변비, 설사, 장 트러블',
    precautions:
      '면역 저하 환자나 중증 질환자는 균혈증 위험으로 상담 필요. 항생제 복용 시 최소 2시간 간격 권장.',
  },
  {
    code: 'zinc',
    name: '아연',
    purpose: '면역 기능 및 상처 회복 지원',
    help_summary: '감기 잦음, 상처 회복 지연',
    precautions:
      '장기 고용량 시 구리 결핍, 위장 장애 가능. 공복 섭취 시 메스꺼움 발생 가능. 다른 미네랄과 동시 고용량 섭취 주의.',
  },
  {
    code: 'milk_thistle',
    name: '밀크시슬',
    purpose: '간 세포 보호 및 회복 보조',
    help_summary: '음주 후 피로, 간 부담',
    precautions:
      '간 대사 효소(CYP450) 영향으로 특정 약물과 상호작용 가능. 임신·수유부나 호르몬 민감 질환자는 상담 권장.',
  },
  {
    code: 'vitamin_e',
    name: '비타민 E',
    purpose: '항산화 및 세포막 보호',
    help_summary: '산화 스트레스, 간 피로',
    precautions:
      '지용성으로 장기 고용량 시 출혈 위험 증가 가능. 항응고제 복용자 주의. 고용량은 심혈관 이점이 없을 수 있음.',
  },
  {
    code: 'beta_glucan',
    name: '베타글루칸',
    purpose: '면역 세포 활성화 보조',
    help_summary: '면역력 저하, 잦은 감기',
    precautions:
      '면역계 자극으로 자가면역 질환 환자 증상 악화 가능성. 면역억제제 복용 중인 경우 전문의 상담 권장.',
  },
];

/** symptom_code → nutrient codes (슬라이드 추천 매트릭스) */
export const SYMPTOM_NUTRIENT_MAP = {
  'energy-a': ['vitamin_b_complex', 'magnesium'],
  'energy-b': ['vitamin_b_complex', 'coq10', 'magnesium'],
  'energy-c': ['vitamin_b_complex', 'omega_3', 'magnesium'],
  'energy-d': ['vitamin_b_complex', 'magnesium', 'coq10'],
  'imm-a': ['vitamin_c', 'vitamin_d3', 'zinc', 'beta_glucan'],
  'imm-b': ['vitamin_c', 'zinc'],
  'imm-c': ['vitamin_c', 'vitamin_d3', 'probiotics', 'beta_glucan'],
  'eye-a': ['lutein_zeaxanthin', 'omega_3'],
  'eye-b': ['lutein_zeaxanthin', 'vitamin_b_complex'],
  'eye-c': ['lutein_zeaxanthin'],
  'mus-a': ['magnesium', 'vitamin_d3', 'omega_3'],
  'mus-b': ['vitamin_b_complex', 'magnesium'],
  'mus-c': ['magnesium', 'vitamin_b_complex'],
  'jnt-a': ['vitamin_d3', 'omega_3'],
  'jnt-b': ['vitamin_d3'],
  'jnt-c': ['omega_3', 'vitamin_d3'],
  'dig-a': ['probiotics', 'magnesium'],
  'dig-b': ['probiotics'],
  'dig-c': ['probiotics'],
  'liv-a': ['vitamin_b_complex', 'milk_thistle'],
  'liv-b': ['milk_thistle', 'vitamin_e'],
  'liv-c': ['vitamin_b_complex', 'milk_thistle'],
};

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
