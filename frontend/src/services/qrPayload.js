const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 100) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const codeList = (value, kind) => Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((code) => Number.isInteger(code) && (Object.values(healthCatalog[kind]).includes(code) || code === 99));
const textList = (value) => Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every((item) => text(item, 200));
const matchesCodes = (values, codes, kind) => {
  const expected = [...new Set(values.map((value) => {
    const aliases = healthCatalog.aliases[kind];
    const canonical = Object.hasOwn(aliases, value.toLowerCase()) ? aliases[value.toLowerCase()] : value;
    return Object.hasOwn(healthCatalog[kind], canonical) ? healthCatalog[kind][canonical] : 99;
  }))];
  return !(values.includes('해당 없음') && values.length > 1)
    && expected.length === new Set(codes).size && expected.every((code) => codes.includes(code));
};
// Shape validation is not authentication; signed/server-issued QR is a future step.
export const parseQrPayload = (raw) => {
  try {
    if (typeof raw === 'string' && new TextEncoder().encode(raw).length > 1800) throw new Error();
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!object(p) || p.type !== 'vitamin-health' || p.version !== 2 || !text(p.id) || !text(p.n)
      || !integer(p.a, 1, 120) || !['M', 'F'].includes(p.g) || !integer(p.h, 80, 230) || !integer(p.w, 20, 200)
      || !integer(p.s, 0, 1) || !integer(p.al, 0, 3) || !codeList(p.c, 'conditions') || !codeList(p.ag, 'allergies') || !codeList(p.m, 'medications')
      || !textList(p.conditions) || !textList(p.allergies) || !textList(p.medications)) throw new Error();
    if (!matchesCodes(p.conditions, p.c, 'conditions') || !matchesCodes(p.allergies, p.ag, 'allergies') || !matchesCodes(p.medications, p.m, 'medications')) throw new Error();
    // Legacy timestamps are ignored: QR lifetime and kiosk session lifetime are independent.
    return { ok: true, raw: p, profile: {
      id: p.id, name: p.n, age: p.a, gender: p.g, height: p.h, weight: p.w, smoking: p.s === 1, alcohol: p.al,
      conditionCodes: p.c, allergyCodes: p.ag, medicationCodes: p.m,
      conditions: p.conditions, allergies: p.allergies, medications: p.medications,
    } };
  } catch { return { ok: false, code: 'INVALID_QR', message: '유효하지 않은 QR입니다. 건강정보 앱에서 새 QR을 생성해주세요.' }; }
};
import healthCatalog from '../data/healthCatalog.json';

