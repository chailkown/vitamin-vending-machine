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
