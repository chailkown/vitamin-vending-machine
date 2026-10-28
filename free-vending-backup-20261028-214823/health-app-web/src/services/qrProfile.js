import healthCatalog from './healthCatalog.json' with { type: 'json' };
const list = (value) => (Array.isArray(value) ? value : String(value || '해당 없음').split(','))
  .map((item) => String(item).trim()).filter(Boolean);
const codes = (values, kind) => [...new Set(values.map((value) => {
  const aliases = healthCatalog.aliases[kind];
  const canonical = Object.hasOwn(aliases, value.toLowerCase()) ? aliases[value.toLowerCase()] : value;
  return Object.hasOwn(healthCatalog[kind], canonical) ? healthCatalog[kind][canonical] : 99;
}))];
// Health information transport: identical profiles produce reusable, timeless QR data.
export const toKioskProfile = (profile, userId) => {
  const conditions = list(profile.conditions), allergies = list(profile.allergies), medications = list(profile.medications);
  return {
    type: 'vitamin-health', version: 2, id: userId || '', n: profile.name, a: Number(profile.age),
    g: profile.gender === '남성' ? 'M' : 'F', h: Number(profile.height), w: Number(profile.weight),
    s: profile.smoking === '흡연 중' ? 1 : 0,
    al: { '안 함': 0, '월 1~2회': 1, '주 1~2회': 2, '주 3회 이상': 3 }[profile.alcohol] ?? 0,
    c: codes(conditions, 'conditions'), ag: codes(allergies, 'allergies'), m: codes(medications, 'medications'),
    conditions, allergies, medications,
  };
};

// HID scanners type ASCII reliably even when they cannot emit Korean Unicode.
export const serializeQrProfile = (profile) => {
  const textValue = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;
  if (!textValue(profile.id,100) || !textValue(profile.n,100)
      || !Number.isInteger(profile.a) || profile.a < 1 || profile.a > 120
      || !['M','F'].includes(profile.g)
      || !Number.isInteger(profile.h) || profile.h < 80 || profile.h > 230
      || !Number.isInteger(profile.w) || profile.w < 20 || profile.w > 200
      || !['conditions','allergies','medications'].every((key) => Array.isArray(profile[key]) && profile[key].length > 0 && profile[key].length <= 32 && profile[key].every((v)=>textValue(v,200)) && !(profile[key].includes('해당 없음') && profile[key].length > 1))) {
    throw new Error('건강정보 형식을 확인해주세요. 직접 입력한 각 항목은 200자 이내여야 합니다.');
  }
  const text = JSON.stringify(profile).replace(/[^\x20-\x7e]/g, (character) =>
    '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  if (text.length > 1800) throw new Error('QR에 담을 정보가 너무 깁니다. 직접 입력한 약물·알레르기 내용을 줄여주세요.');
  return text;
};
