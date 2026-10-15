import { EVIDENCE } from '../data/recommendationEvidence';
import { isProductEnabled } from '../data/productPolicy';

// No disease/BMI/alcohol -> supplement additions. Apply the union of all restrictions.
export const getQrProfileRules = (profile) => {
  const warnings = [], exclusions = {}, evidence = new Set(['general']);
  let hold = false;
  const note = (message, source = 'general') => { warnings.push(message); evidence.add(source); };
  const stop = (message, source) => { hold = true; note(message, source); };
  const exclude = (names, message, source) => {
    note(message, source);
    for (const name of names) exclusions[name] = [...(exclusions[name] || []), message];
  };
  const conditions = new Set(profile.conditionCodes || []), meds = new Set(profile.medicationCodes || []);
  const allergies = new Set(profile.allergyCodes || []);
  if (!Number.isInteger(profile.age) || profile.age < 19) stop('19세 미만은 성인용 상품을 자동 추천하지 않습니다. 보호자와 의료진에게 확인해주세요.');
  if ([...conditions, ...meds, ...allergies].includes(99)) stop('직접 입력한 항목 중 확인되지 않은 질환·약물·알레르기가 있어 자동 추천을 보류합니다. 정확한 성분명과 제품 라벨을 약사에게 확인해주세요.');
  if (conditions.has(1) || conditions.has(5)) {
    exclude(['밀크시슬', '비타민 E'], '간질환·지방간을 이유로 간 해독용 보충제를 추천하지 않습니다. 진단과 치료 계획을 먼저 확인해주세요.', 'liver');
  }
  if (conditions.has(2)) note('당뇨 치료나 혈당 조절을 위한 보충제를 자동 추가하지 않습니다.', 'diabetes');
  if (conditions.has(3)) stop('빈혈은 원인에 따라 치료가 달라집니다. 검사 없이 B군이나 철분을 선택하지 말고 진료를 받아주세요.');
  if (conditions.has(4)) note('고혈압 치료를 대신할 보충제를 추천하지 않습니다. 복용 중인 약을 구체적으로 확인해주세요.');
  if (conditions.has(6)) note('고중성지방혈증 치료용 처방 오메가-3와 일반 보충제는 다릅니다. 치료 용량은 의료진이 결정해야 합니다.', 'omega');
  if (conditions.has(7)) exclude(['비타민 C', '마그네슘'], '위장질환의 종류·증상이 불명확해 위장 불편·설사를 유발할 수 있는 C·마그네슘의 자동 추천을 보류합니다.', 'magnesium');
  if (conditions.has(8)) stop('신장질환은 영양소 축적과 용량 조정 확인이 필요해 자동 추천을 보류합니다.', 'magnesium');
  if (conditions.has(9) || conditions.has(11)) exclude(['비타민 C'], '신장결석·철 과다증에서는 비타민 C 보충 용량을 의료진에게 먼저 확인해주세요.', 'vitamin_c');
  if (conditions.has(10)) exclude(['비타민 D3'], '고칼슘혈증에서는 비타민 D를 임의로 추가하지 않습니다.', 'vitamin_d');
  if (conditions.has(12)) exclude(['비타민 E', '오메가-3'], '출혈질환의 상태·복용량을 확인할 수 없어 E·오메가-3 자동 추천을 보류합니다. 모든 용량의 절대금기를 의미하지 않습니다.', 'omega');
  if (conditions.has(13)) exclude(['오메가-3'], '고용량 오메가-3 연구에서 심방세동 위험 증가가 관찰됐습니다. 기존 심방세동이 있으면 의료진 확인 전 추천을 보류합니다.', 'omega');
  if (conditions.has(14) || meds.has(11)) stop('면역저하·면역억제 치료 중에는 프로바이오틱스 등의 안전성을 의료진이 검토해야 하므로 자동 추천을 보류합니다.', 'probiotics');
  if (conditions.has(15) || meds.has(12)) stop('암 치료 중에는 치료와 보충제의 상호작용을 담당 의료진에게 확인해야 합니다.', 'vitamin_e');
  if (conditions.has(16) || conditions.has(17)) stop('임신·수유 또는 수술 예정 상태에서는 개별 검토가 필요해 자동 추천을 보류합니다. 처방약을 임의로 중단하지 마세요.');
  if (conditions.has(18)) note('골다공증 치료 계획과 칼슘·비타민 D 총 섭취량을 확인해주세요. 뼈 통증만으로 결핍을 판단하지 않습니다.', 'vitamin_d');
  if (conditions.has(19)) note('갑상선질환 약과 보충제의 복용 간격·성분을 약사에게 확인해주세요.', 'thyroid');
  if (conditions.has(20)) note('AREDS2는 특정 단계의 황반변성에 적용됩니다. 단일 루테인 상품은 AREDS2 복합제를 대신하지 않습니다.', 'eye');
  if ([1,2,3,4,5].some((code) => meds.has(code))) stop('혈압약·당뇨약·항응고제·위장약·진통제 같은 넓은 분류만으로는 상호작용을 판단할 수 없습니다. 구체적인 약 종류를 선택하거나 약사에게 확인해주세요.');
  if (meds.has(3) || meds.has(6)) {
    exclude(['비타민 E', '코엔자임 Q10', '오메가-3'], '항응고 치료 중에는 E·CoQ10의 상호작용과 오메가-3 병용 모니터링을 확인해야 하므로 자동 추천에서 제외합니다.', 'vitamin_e');
    evidence.add('coq'); evidence.add('omega');
  }
  if (meds.has(7)) exclude(['비타민 E', '오메가-3'], '항혈소판제 복용 시 용량·병용 검토 전 자동 추천을 보류합니다. 일반 용량 오메가-3의 출혈 위험이 확정됐다는 뜻은 아닙니다.', 'vitamin_e');
  if (meds.has(8)) exclude(['비타민 D3'], '티아지드계 이뇨제와 비타민 D 병용은 고칼슘혈증 위험을 확인해야 합니다.', 'vitamin_d');
  if (meds.has(9)) exclude(['마그네슘', '아연'], '해당 항생제와 Mg·아연을 함께 먹으면 흡수에 영향을 줄 수 있습니다. 복용 간격을 약사에게 확인하기 전 자동 추천에서 제외합니다.', 'magnesium');
  if (meds.has(9)) evidence.add('zinc');
  if (meds.has(10)) exclude(['마그네슘'], '비스포스포네이트와 마그네슘의 복용 간격 확인이 필요합니다.', 'magnesium');
  if (meds.has(13)) exclude(['코엔자임 Q10'], 'CoQ10은 인슐린과 상호작용할 수 있어 자동 추천에서 제외합니다.', 'coq');
  if (meds.has(14)) stop('레보티록신은 복합제 원료와 복용 간격 검토가 필요합니다. 제품 전체 성분을 약사에게 확인해주세요.', 'thyroid');
  if (meds.has(15)) exclude(['비타민 B-Complex'], '항경련제와 B6의 상호작용 가능성이 있어 B군 자동 추천을 보류합니다.', 'vitamin_b');
  if (meds.has(16)) note('스타틴 복용만을 이유로 CoQ10을 추가하지 않습니다. 근육 증상은 처방 의료진에게 알려주세요.', 'coq');
  if (meds.has(17)) note('PPI 장기 복용은 마그네슘 상태에 영향을 줄 수 있지만 검사 없이 결핍으로 판단하지 않습니다.', 'magnesium');
  if (meds.has(18)) exclude(['아연'], '아연은 페니실라민 흡수에 영향을 줄 수 있어 복용 계획 확인 전 제외합니다.', 'zinc');
  if (meds.has(19)) exclude(['마그네슘', '아연'], '철분제와 다른 미네랄 보충제의 복용 간격을 약사에게 확인해주세요.', 'iron');
  if (allergies.has(5) || allergies.has(12)) exclude(['밀크시슬'], '꽃가루의 종류가 불명확하거나 국화과 알레르기가 있으면 밀크시슬 자동 추천을 제외합니다.', 'liver');
  if ([...allergies].some((code) => code !== 0 && code !== 5 && code !== 12)) note('식품 알레르기는 영양소 이름이 아닌 제품의 전체 원료·교차접촉 표시로 확인합니다. 라벨 검증이 없는 상품은 추천하지 않습니다.', 'allergy');
  if (profile.smoking) note('흡연자의 비타민 C 필요량 증가가 고용량 제품의 필요성을 뜻하지는 않습니다. 식사 섭취량을 먼저 확인해주세요.', 'vitamin_c');
  if (profile.alcohol > 0) note('음주량만으로 간 해독·숙취 회복 영양제를 추가하지 않습니다.', 'liver');
  return {
    addedNutrients: [], excludedNutrients: Object.keys(exclusions), reasons: {},
    exclusions: Object.fromEntries(Object.entries(exclusions).map(([name, reasons]) => [name, reasons.join(' ')])),
    warnings: [...new Set(warnings)], hold,
    labels: { condition: (profile.conditions || []).join(', ') || '해당 없음', allergy: (profile.allergies || []).join(', ') || '해당 없음', medication: (profile.medications || []).join(', ') || '해당 없음' },
    sources: [...evidence].map((id) => EVIDENCE[id]),
  };
};

export const assessRecommendedProducts = (products, profile, rules) => {
  const accepted = [], excluded = [];
  const foodAllergies = (profile?.allergyCodes || []).filter((code) => ![0,5,12].includes(code));
  for (const product of products) {
    let reason = '';
    if (!isProductEnabled(product)) reason = '판매 중지 상품';
    else if (product.stock === 0) reason = '현재 품절 상품';
    else if (rules?.hold) reason = '개인 건강정보 검토가 먼저 필요합니다.';
    else if (rules?.excludedNutrients.includes(product.category)) reason = rules.exclusions[product.category];
    else if (foodAllergies.length) {
      // Verified means a human checked current full ingredients and cross-contact labels.
      if (product.allergen_verified !== true || !Array.isArray(product.allergen_codes)
        || !product.allergen_codes.every((code) => Number.isInteger(code) && code >= 1 && code <= 12)
        || !/^https:\/\//.test(product.allergen_source_url || '') || !Number.isFinite(Date.parse(product.allergen_checked_at))) reason = '제품 전체 원료·교차접촉 라벨이 검증되지 않았습니다.';
      else if (foodAllergies.some((code) => product.allergen_codes.includes(code) || (code === 1 && product.allergen_codes.includes(10)))) reason = '선택한 알레르기와 제품 원료·교차접촉 표시가 겹칩니다.';
    }
    // Current B products have 25/100 mg B6 in sample data; no unreviewed routine high-dose recommendation.
    if (!reason && product.category === '비타민 B-Complex') reason = '현재 B군 상품은 고함량입니다. 실제 파우치 B6 함량과 총 섭취량 확인 전 자동 추천을 보류합니다.';
    if (reason) excluded.push({ id: product.id, name: product.name, reason }); else accepted.push(product);
  }
  return { accepted, excluded };
};
