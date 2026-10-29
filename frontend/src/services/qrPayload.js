import healthCatalog from '../data/healthCatalog.json';
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v)=>typeof v==='string'&&v.trim().length>0&&v.length<=100;
const label=(code,kind)=>Object.entries(healthCatalog[kind]).find(([,value])=>value===code)?.[0]||'직접 입력/분류 미확인';
export const parseQrPayload=(raw)=>{
 try{
  if(typeof raw==='string'&&new TextEncoder().encode(raw).length>1800)throw new Error();
  const p=typeof raw==='string'?JSON.parse(raw):raw;
  if(!p||typeof p!=='object'||Array.isArray(p)||!text(p.id)||!text(p.n)||!integer(p.a,1,120)||!['M','F'].includes(p.g)||!integer(p.h,80,230)||!integer(p.w,20,200)||!integer(p.s,0,1)||!integer(p.al,0,3))throw new Error();
  if(!['c','ag','m'].every((key,index)=>Number.isInteger(p[key])&&(p[key]===99||Object.values(healthCatalog[['conditions','allergies','medications'][index]]).includes(p[key]))))throw new Error();
  const normalized = Object.fromEntries(['id','n','a','g','h','w','s','al','c','ag','m'].map(key=>[key,p[key]]));
  return {ok:true,raw:normalized,profile:{id:p.id,name:p.n,age:p.a,gender:p.g,height:p.h,weight:p.w,smoking:p.s===1,alcohol:p.al,
   conditionCodes:[p.c],allergyCodes:[p.ag],medicationCodes:[p.m],conditions:[label(p.c,'conditions')],allergies:[label(p.ag,'allergies')],medications:[label(p.m,'medications')]}};
 }catch{return {ok:false,code:'INVALID_QR',message:'QR의 11개 항목과 숫자 코드를 확인해주세요.'};}
};
