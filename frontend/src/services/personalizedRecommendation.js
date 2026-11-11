import { EVIDENCE } from '../data/recommendationEvidence';
import { isProductEnabled } from '../data/productPolicy';
import healthCatalog from '../data/healthCatalog.json';

// Ranking is an explainable display policy, not a clinical efficacy score or a dose prescription.
// Keep situation membership intact. No field from this module authorizes or blocks a sale.
const C = { b:'비타민 B-Complex', c:'비타민 C', d:'비타민 D3', mg:'마그네슘', o:'오메가-3', q:'코엔자임 Q10', l:'루테인/제아잔틴', p:'프로바이오틱스', z:'아연', beta:'베타글루칸' };
const INFO = {
  [C.b]: ['B군은 정상적인 에너지 대사에 관여합니다. 피로·저림의 원인을 판별하는 제품은 아닙니다.', 'vitamin_b'],
  [C.c]: ['비타민 C는 콜라겐 형성과 항산화 기능에 필요합니다. 감기 치료 효과를 뜻하지 않습니다.', 'vitamin_c'],
  [C.d]: ['비타민 D는 칼슘 흡수와 뼈 건강에 필요합니다. 식사·기존 보충제 섭취량을 함께 확인하세요.', 'vitamin_d'],
  [C.mg]: ['마그네슘은 정상적인 근육·신경 기능에 필요합니다. 통증·불면의 치료 효과를 뜻하지 않습니다.', 'magnesium'],
  [C.o]: ['오메가-3는 EPA·DHA를 공급합니다. 일반 보충제는 처방용 고중성지방혈증 치료제를 대신하지 않습니다.', 'omega'],
  [C.q]: ['CoQ10은 세포의 에너지 생성에 관여합니다. 스타틴 복용이나 피로만으로 추가 섭취가 필요한 것은 아닙니다.', 'coq'],
  [C.l]: ['루테인·제아잔틴은 눈 건강 관련 성분입니다. 단일 상품은 특정 황반변성에 쓰는 AREDS2 복합제를 대신하지 않습니다.', 'eye'],
  [C.p]: ['프로바이오틱스는 균주와 증상에 따라 연구 결과가 다릅니다. 균 수가 많다고 효과가 더 좋은 것은 아닙니다.', 'probiotics'],
  [C.z]: ['아연은 정상적인 면역 기능에 필요합니다. 장기 고용량 섭취는 구리 부족을 일으킬 수 있습니다.', 'zinc'],
  [C.beta]: ['베타글루칸은 원료·구조·제품에 따라 특성이 다릅니다. 현재 상품 정보만으로 면역 개선 효과나 필요한 양을 판단하지 않습니다.', 'general'],
};
const label = (kind, code) => Object.entries(healthCatalog[kind]).find(([, value]) => value === code)?.[0] || '분류 미확인';
const has = (values, ...codes) => codes.some(code => values.includes(code));
const unique = values => [...new Set(values)];

// NIH adult dietary reference amounts include food, not just supplements.
export function bodyContext(profile) {
  if (!profile) return { lines:[], reference:{} };
  const { age, gender, height, weight } = profile;
  const adult = Number.isInteger(age) && age >= 19;
  const validBody = Number.isFinite(height) && height >= 80 && height <= 230 && Number.isFinite(weight) && weight >= 20 && weight <= 200;
  const bmi = validBody ? weight / ((height / 100) ** 2) : null;
  const lines = [`${age}세 · ${gender === 'M' ? '남성' : gender === 'F' ? '여성' : '성별 미확인'}${validBody ? ` · ${height}cm · ${weight}kg` : ''}`];
  if (bmi !== null && age >= 20 && !(profile.conditionCodes || []).includes(16)) {
    lines.push(`BMI ${bmi.toFixed(1)}: ${bmi < 18.5 ? '식사량·최근 체중 감소를 함께 확인하세요.' : bmi >= 30 ? '비타민 D 상태에 영향을 줄 수 있지만 체중만으로 고함량을 선택하지 않습니다.' : '체격만으로 영양소 결핍이나 필요한 보충량을 판단하지 않습니다.'}`);
  } else lines.push('성장기·임신·수유 또는 정보 미확인 상태에는 일반 성인 BMI 기준을 적용하지 않습니다.');
  const reference = {};
  if (adult && ['M','F'].includes(gender) && !(profile.conditionCodes || []).includes(16)) {
    reference[C.c] = { amount:(gender === 'M' ? 90 : 75) + (profile.smoking ? 35 : 0), unit:'mg', source:'vitamin_c' };
    reference[C.mg] = { amount:gender === 'M' ? (age >= 31 ? 420 : 400) : (age >= 31 ? 320 : 310), unit:'mg', source:'magnesium' };
    reference[C.z] = { amount:gender === 'M' ? 11 : 8, unit:'mg', source:'zinc' };
    reference[C.d] = { amount:age > 70 ? 800 : 600, unit:'IU', source:'vitamin_d' };
  }
  return { lines, bmi, reference };
}

// Read only explicit single-nutrient labels. Never infer quantities from brand names or images.
export function labeledAmount(product) {
  const text = String(product.serving_content || '');
  if (![C.c,C.d,C.mg,C.z].includes(product.category)) return null;
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(mcg|μg|µg|mg|IU)\b/gi)];
  if (matches.length !== 1) return null;
  const amount = Number(matches[0][1]), unit = matches[0][2].toLowerCase();
  if (!(amount > 0)) return null;
  if (product.category === C.d) return unit === 'iu' ? amount : ['mcg','μg','µg'].includes(unit) ? amount * 40 : null;
  return unit === 'mg' ? amount : null;
}

export function assessPersonalizedProduct(product, profile, body = bodyContext(profile)) {
  const category = product.category;
  const [reason, source] = INFO[category] || ['제품 전체 성분과 표시사항을 확인하세요.', 'general'];
  const notices = [], priority = [0,0,0];
  const note = (group, message, sourceId, severity = 1) => {
    if (group !== null) priority[group] = Math.max(priority[group], severity);
    notices.push({ message, source:sourceId, group, severity });
  };
  const conditions = profile?.conditionCodes || [], meds = profile?.medicationCodes || [], allergies = profile?.allergyCodes || [];
  const food = allergies.filter(code => code !== 0 && code !== 5 && code !== 12);
  const verified = product.allergen_verified === true && Array.isArray(product.allergen_codes)
    && product.allergen_codes.every(code => Number.isInteger(code) && code >= 1 && code <= 12)
    && /^https:\/\//.test(product.allergen_source_url || '') && Number.isFinite(Date.parse(product.allergen_checked_at));
  if (food.length) {
    if (verified && food.some(code => product.allergen_codes.includes(code) || (code === 1 && product.allergen_codes.includes(10)))) {
      note(0, '선택한 알레르기와 제품 원료·교차접촉 표시가 겹칩니다. 섭취를 피하고 원료를 확인하세요.', 'allergy', 3);
    } else if (!verified || food.includes(99)) {
      note(0, `${food.map(code => label('allergies', code)).join('·')} 알레르기: 전체 원료·교차접촉 라벨 확인이 필요합니다. 안전한 상품으로 확인된 것은 아닙니다.`, 'allergy', 2);
    }
    if (food.includes(6) && category === C.o && !verified) note(0, '오메가-3의 어유 원료 여부를 확인하세요. 영양소 이름만으로 생선 알레르기 안전성을 판단하지 않습니다.', 'allergy', 2);
  }
  if (has(allergies,5,12) && !verified) note(0, '꽃가루·식물 알레르기는 구체적인 식물과 부원료를 확인해야 합니다.', 'allergy');

  if (has(meds,1,2,3,4,5,99)) note(1, `${meds.filter(code => [1,2,3,4,5,99].includes(code)).map(code => label('medications',code)).join('·')}: 정확한 약 성분이 없어 상호작용 확인이 필요합니다.`, 'general');
  if (has(meds,3,6) && category === C.q) note(1, '와파린 등 항응고 치료 중 CoQ10이 약효에 영향을 줄 수 있습니다.', 'coq', 3);
  if (has(meds,3,6,7) && category === C.o) note(1, '항응고제·항혈소판제와 오메가-3 병용 시 출혈 관련 상태와 용량을 확인하세요. 모든 용량에서 위험이 확정된 것은 아닙니다.', 'omega', 2);
  if (meds.includes(8) && category === C.d) note(1, '티아지드계 이뇨제와 비타민 D 병용은 혈중 칼슘 증가에 주의해야 합니다.', 'vitamin_d', 3);
  if (meds.includes(9) && [C.mg,C.z].includes(category)) note(1, '퀴놀론·테트라사이클린계 항생제의 흡수가 줄 수 있습니다. 약사에게 복용 간격을 확인하세요.', category === C.mg ? 'magnesium' : 'zinc', 2);
  if (meds.includes(10) && category === C.mg) note(1, '비스포스포네이트의 흡수에 영향을 줄 수 있어 마그네슘과의 복용 간격 확인이 필요합니다.', 'magnesium', 2);
  if (meds.includes(11) && category === C.p) note(1, '면역억제 치료 중에는 프로바이오틱스 관련 감염 위험을 의료진과 확인하세요.', 'probiotics', 3);
  if (meds.includes(12)) note(1, '항암 치료와 보충제의 병용 여부는 담당 의료진에게 확인하세요.', 'general', 3);
  if (meds.includes(13) && category === C.q) note(1, 'CoQ10은 인슐린과 상호작용할 수 있습니다. 혈당 관리 계획과 함께 확인하세요.', 'coq', 3);
  if (meds.includes(14)) note(1, '레보티록신은 일부 미네랄·부원료에 영향을 받습니다. 전체 성분과 복용 간격을 확인하세요.', 'thyroid');
  if (meds.includes(15) && category === C.b) note(1, '항경련제와 B6의 상호작용 가능성이 있습니다. 약 성분과 B6 함량을 확인하세요.', 'vitamin_b', 2);
  if (meds.includes(16) && category === C.q) note(null, '스타틴 관련 근육 증상에 대한 CoQ10의 효과는 확실하지 않아 스타틴 복용만으로 우선순위를 높이지 않았습니다.', 'coq');
  if (meds.includes(17) && category === C.mg) note(null, 'PPI 장기 복용 시 마그네슘 상태를 확인할 수 있습니다. 검사 없이 결핍으로 판단하지 않습니다.', 'magnesium');
  if (meds.includes(18) && category === C.z) note(1, '아연은 페니실라민 흡수와 작용에 영향을 줄 수 있어 복용 간격 확인이 필요합니다.', 'zinc', 2);
  if (meds.includes(19) && category === C.z) note(1, '철분제와 아연을 동시에 먹으면 아연 흡수가 줄 수 있습니다. 실제 용량·복용 간격을 확인하세요.', 'zinc', 2);

  if (has(conditions,1,5)) note(null, '간질환·지방간을 이유로 간 해독 효과를 가정하지 않았습니다.', 'liver');
  if (conditions.includes(2)) note(null, '당뇨만으로 마그네슘 등 특정 보충제가 필요하다고 판단하지 않았습니다. 혈당 치료를 대신하지 않습니다.', 'diabetes');
  if (conditions.includes(3)) note(2, '빈혈의 원인은 다양합니다. 현재 상품으로 원인에 맞는 빈혈 치료를 대신할 수 없습니다.', 'general');
  if (conditions.includes(4)) note(null, '고혈압 치료와 별도로 식사·약물·보충제 섭취를 확인하세요.', 'magnesium');
  if (conditions.includes(6) && category === C.o) note(null, '고중성지방혈증용 처방 오메가-3와 이 일반 상품의 성분·용량은 다를 수 있습니다.', 'omega');
  if (conditions.includes(7) && [C.c,C.mg].includes(category)) note(2, '위장질환의 종류에 따라 비타민 C·마그네슘이 속 불편이나 설사를 유발할 수 있습니다.', category === C.c ? 'vitamin_c' : 'magnesium', 2);
  if (conditions.includes(8)) note(2, category === C.mg ? '신장기능 저하 시 마그네슘 축적 위험이 커집니다. 섭취 전 의료진 확인이 필요합니다.' : '신장질환에서는 검사 수치와 치료 계획에 따라 보충량을 확인해야 합니다.', 'magnesium', category === C.mg ? 3 : 2);
  if (has(conditions,9,11) && category === C.c) note(2, '신장결석·철 과다증에서는 비타민 C의 보충량을 확인해야 합니다.', 'vitamin_c', 3);
  if (conditions.includes(10) && category === C.d) note(2, '고칼슘혈증에서는 비타민 D 추가 섭취 전에 치료 계획을 확인하세요.', 'vitamin_d', 3);
  if (conditions.includes(12) && category === C.o) note(2, '출혈질환에서는 오메가-3의 용량과 병용약을 확인하세요.', 'omega', 2);
  if (conditions.includes(13) && category === C.o) note(2, '고용량 오메가-3 연구에서 심방세동 위험 증가가 관찰됐습니다. 기존 심방세동과 복용량을 확인하세요.', 'omega', 3);
  if (conditions.includes(14) && category === C.p) note(2, '면역저하 상태에서는 프로바이오틱스 관련 감염 위험을 의료진과 확인하세요.', 'probiotics', 3);
  if (has(conditions,15,16,17,99)) note(2, `${conditions.filter(code => [15,16,17,99].includes(code)).map(code => label('conditions',code)).join('·')}: 일반 성인 기준만으로 적합성을 판단하기 어려워 개별 확인이 필요합니다.`, 'general', 2);
  if (conditions.includes(18) && category === C.d) note(null, '골다공증 치료 계획과 기존 칼슘·비타민 D 섭취를 함께 확인하세요.', 'vitamin_d');
  if (conditions.includes(19)) note(null, '갑상선질환의 종류와 복용약에 따라 성분·섭취 간격을 확인하세요.', 'thyroid');
  if (conditions.includes(20) && category === C.l) note(null, '황반변성의 단계에 따라 AREDS2 대상 여부가 달라집니다. 이 상품만으로 동일한 효과를 기대할 수 없습니다.', 'eye');
  if (profile && profile.age < 19) note(2, '성인용 상품을 성장기 개인의 필요량으로 해석하지 마세요. 연령별 검토가 필요합니다.', 'general', 2);
  if (category === C.b) note(null, 'B6를 장기간 고함량으로 섭취하면 신경 이상이 생길 수 있어 다른 B군 제품과의 중복량을 확인하세요.', 'vitamin_b');
  if (profile?.alcohol > 0) note(null, '음주 정보는 간 해독·숙취 회복 제품을 추가하는 근거로 사용하지 않았습니다.', 'liver');
  const reference = body.reference[category], amount = labeledAmount(product);
  const comparison = reference && amount !== null
    ? `입력 연령·성별${profile.smoking && category === C.c ? '·흡연' : ''}의 NIH 하루 식사 포함 섭취기준은 ${reference.amount}${reference.unit}, 등록된 제품 함량은 ${amount}${reference.unit}입니다. 제품 복용량 지시가 아니며 실제 파우치 표시와 총 섭취량을 확인하세요.` : null;
  return { id:product.id, name:product.name, category, reason, source, notices, priority, comparison,
    referenceRatio:reference && amount !== null ? amount / reference.amount : null, amount };
}

export function personalizeRecommendations(products, situationNutrients, profile) {
  const body = bodyContext(profile);
  const assessments = products.filter(isProductEnabled).map(product => assessPersonalizedProduct(product, profile, body));
  const related = assessments.filter(item => situationNutrients.includes(item.category));
  related.sort((a,b) => {
    for (let i=0;i<3;i++) if (a.priority[i] !== b.priority[i]) return a.priority[i]-b.priority[i];
    // Do not compare mg across nutrients or CFUs across probiotic strains.
    const categoryOrder = situationNutrients.indexOf(a.category)-situationNutrients.indexOf(b.category);
    if (categoryOrder) return categoryOrder;
    if (a.referenceRatio !== null && b.referenceRatio !== null) return a.referenceRatio-b.referenceRatio;
    return 0;
  });
  const concerns = related.flatMap(item => item.notices.filter(notice => notice.message));
  const labels = profile ? [
    ['allergies',profile.allergyCodes],['medications',profile.medicationCodes],['conditions',profile.conditionCodes],
  ].flatMap(([kind,codes]) => (codes || []).filter(code => code !== 0).map(code => label(kind,code))) : [];
  const important = related.flatMap(item => item.notices).filter(notice => notice.group !== null)
    .sort((a,b) => a.group-b.group || b.severity-a.severity)[0];
  const summary = [
    related.length ? unique(related.map(item => item.reason.split('. ')[0])).slice(0,2).join('. ') + '.' : '현재 상품 목록을 확인해주세요.',
    important?.message || (profile ? (labels.length ? `${labels.join('·')} 정보를 우선 검토했어요. 상세 주의사항을 확인하세요.` : '입력한 연령·성별의 섭취기준과 등록된 함량을 비교했어요.') : 'QR 없이 선택한 상황을 기준으로 안내합니다.'),
    profile ? `${body.lines[0]}${body.bmi !== null && profile.age >= 20 && !(profile.conditionCodes || []).includes(16) ? ` · BMI ${body.bmi.toFixed(1)}` : ''}` : '상세 이유와 성분별 주의사항을 펼쳐 확인하세요.',
  ];
  return { summary, body:body.lines, assessments, related,
    warnings:unique(concerns.map(item => item.message)),
    sources:unique([...related.map(item => item.source),...concerns.map(item => item.source),'general',...(profile ? ['body'] : [])]).map(key => EVIDENCE[key]).filter(Boolean),
  };
}
