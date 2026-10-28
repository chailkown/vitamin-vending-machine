import healthCatalog from './healthCatalog.json' with { type: 'json' };
const code = (value,kind) => {
  const values=(Array.isArray(value)?value:String(value||'해당 없음').split(',')).map(v=>String(v).trim()).filter(Boolean);
  if(values.length!==1)throw new Error('기저질환·알레르기·복용 약물은 각각 하나만 선택해주세요.');
  const raw=values[0],canonical=healthCatalog.aliases[kind][raw.toLowerCase()]||raw;
  return Object.hasOwn(healthCatalog[kind],canonical)?healthCatalog[kind][canonical]:99;
};
export const toKioskProfile=(profile,userId)=>({
 id:userId||'',n:profile.name,a:Number(profile.age),g:profile.gender==='남성'?'M':'F',h:Number(profile.height),w:Number(profile.weight),
 s:profile.smoking==='흡연 중'?1:0,al:{'안 함':0,'월 1~2회':1,'주 1~2회':2,'주 3회 이상':3}[profile.alcohol]??0,
 c:code(profile.conditions,'conditions'),ag:code(profile.allergies,'allergies'),m:code(profile.medications,'medications')
});
export const validateQrProfile=(p)=>{
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(typeof p.id!=='string'||!p.id.trim()||p.id.length>100||typeof p.n!=='string'||!p.n.trim()||p.n.length>100
 ||!integer(p.a,1,120)||!['M','F'].includes(p.g)||!integer(p.h,80,230)||!integer(p.w,20,200)||!integer(p.s,0,1)||!integer(p.al,0,3)
 ||!['c','ag','m'].every((key,index)=>Number.isInteger(p[key])&&(p[key]===99||Object.values(healthCatalog[['conditions','allergies','medications'][index]]).includes(p[key]))))throw new Error('QR 건강정보 형식을 확인해주세요.');
};
export const serializeQrProfile=(profile)=>{
 validateQrProfile(profile);
 // JSON Unicode escapes preserve the same name while allowing HID keyboard scanners.
 return JSON.stringify(profile).replace(/[^\x20-\x7e]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
};
