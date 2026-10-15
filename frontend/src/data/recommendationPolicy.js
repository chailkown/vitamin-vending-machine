// Diet-related candidates, not diagnoses or treatment recommendations.
export const NUTRITION_CATEGORY = {
  code: 'nutrition', title: '식사 보완 검토', emoji: '🥗', symptoms: [
    { code: 'diet-c', label: '과일·채소 섭취가 적어 비타민 C 정보를 보고 싶음' },
    { code: 'diet-d', label: '비타민 D 식품 섭취가 적어 보완 정보를 보고 싶음' },
    { code: 'diet-mg', label: '통곡물·콩·견과류 섭취가 적어 마그네슘 정보를 보고 싶음' },
    { code: 'diet-omega', label: '생선 섭취가 적어 EPA·DHA 정보를 보고 싶음' },
    { code: 'diet-zinc', label: '육류·해산물·콩 섭취가 적어 아연 정보를 보고 싶음' },
  ],
};
export const SYMPTOM_REVIEW = {
  'diet-c': { nutrients:['vitamin_c'], sources:['vitamin_c'], message:'비타민 C는 정상적인 콜라겐 형성과 항산화 기능에 필요합니다. 식품으로 우선 보충하고, 제품 함량이 개인 필요량과 같은 것은 아님을 확인해주세요. 감기 치료용 추천이 아닙니다.' },
  'diet-d': { nutrients:['vitamin_d3'], sources:['vitamin_d'], message:'비타민 D는 칼슘 흡수와 뼈 건강에 필요합니다. 식사·기존 보충제·필요 시 검사 결과를 함께 확인해야 하며 피로나 통증만으로 결핍을 진단하지 않습니다.' },
  'diet-mg': { nutrients:['magnesium'], sources:['magnesium'], message:'마그네슘은 정상적인 근육·신경 기능에 필요합니다. 식사 부족 여부를 확인하는 후보이며 근육통·불면증 치료를 보장하지 않습니다. 신장기능과 약물 복용 간격을 확인해주세요.' },
  'diet-omega': { nutrients:['omega_3'], sources:['omega'], message:'생선은 EPA·DHA 공급원입니다. 일반 보충제를 고중성지방혈증 치료제 대신 사용하지 마세요. EPA·DHA 함량과 기존 섭취량을 확인해주세요.' },
  'diet-zinc': { nutrients:['zinc'], sources:['zinc'], message:'아연은 정상적인 면역 기능 등에 필요합니다. 감기 예방을 보장하지 않으며 장기 고용량은 구리 결핍을 일으킬 수 있어 식사와 보충제 총량을 확인해야 합니다.' },
  'mus-b': { nutrients:[], sources:['vitamin_b'], message:'저림·감각 이상은 원인 평가가 필요합니다. 고함량 B6가 오히려 말초신경 손상과 관련될 수 있어 B군을 자동 추천하지 않습니다.' },
  'eye-a': { nutrients:[], sources:['eye'], message:'화면 사용 후 눈 피로만으로 루테인 결핍이나 AREDS2 대상 여부를 판단할 수 없습니다. 휴식 후에도 증상이 지속되면 안과에서 확인해주세요.' },
  'eye-b': { nutrients:[], sources:['eye'], message:'초점 변화는 안과 평가가 필요할 수 있습니다. 단일 루테인 상품을 AREDS2 복합제나 치료 대신 추천하지 않습니다.' },
  'eye-c': { nutrients:[], sources:['eye','omega'], message:'눈 건조·충혈만으로 오메가-3나 루테인을 선택하지 않습니다. 통증·시력 저하가 동반되면 신속히 진료를 받아주세요.' },
  'liv-a': { nutrients:[], sources:['liver'], message:'음주 후 피로에 간 해독용 보충제를 자동 추천하지 않습니다. 음주를 줄이고 지속되는 증상은 진료를 받아주세요.' },
  'liv-b': { nutrients:[], sources:['liver'], message:'간 해독·회복을 보장하는 보충제 조합은 제시하지 않습니다. 간질환이 의심되면 검사와 의료진 상담이 먼저입니다.' },
  'liv-c': { nutrients:[], sources:['liver','general'], message:'처방약을 임의로 중단하거나 간 보호 보충제를 추가하지 마세요. 복용 중인 약과 간기능을 처방 의료진에게 확인해주세요.' },
  'dig-a': { nutrients:[], sources:['probiotics','magnesium'], message:'변비와 설사는 원인·대처가 다릅니다. 마그네슘은 설사를 악화시킬 수 있으며 프로바이오틱스 효과는 균주·질환별로 달라 자동 추천하지 않습니다.' },
  'dig-b': { nutrients:[], sources:['probiotics'], message:'더부룩함만으로 특정 프로바이오틱스의 효과를 예측할 수 없습니다. 지속되면 원인을 확인해주세요.' },
  'dig-c': { nutrients:[], sources:['probiotics'], message:'기름진 음식 후 소화 불편의 원인은 다양합니다. 특정 균주·용량의 근거 없이 유산균을 추천하지 않습니다.' },
};
