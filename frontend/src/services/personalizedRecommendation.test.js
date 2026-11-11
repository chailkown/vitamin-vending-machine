import { bodyContext, labeledAmount, assessPersonalizedProduct, personalizeRecommendations } from './personalizedRecommendation';
import { SAMPLE_VITAMINS } from '../data/sampleVitamins';
import { isProductEnabled } from '../data/productPolicy';
import healthCatalog from '../data/healthCatalog.json';

const profile = {age:30,gender:'M',height:175,weight:70,smoking:false,alcohol:0,conditionCodes:[0],medicationCodes:[0],allergyCodes:[0]};
const products = SAMPLE_VITAMINS.filter(isProductEnabled).map(p=>({...p,stock:5,dispenser_slot:p.id}));
const product = category => products.find(p=>p.category===category);

test('all 20 active products have explanations; every selectable health code is evaluated without removing candidates',()=>{
  expect(products).toHaveLength(20);
  for (const [kind, field] of [['conditions','conditionCodes'],['medications','medicationCodes'],['allergies','allergyCodes']]) {
    for (const code of [...Object.values(healthCatalog[kind]),99]) {
      const result=personalizeRecommendations(products,[...new Set(products.map(p=>p.category))],{...profile,[field]:[code]});
      expect(result.related).toHaveLength(20);
      expect(result.related.every(item=>item.reason && item.source)).toBe(true);
      expect(result.summary).toHaveLength(3);
      expect(result.related.every(item=>!Object.hasOwn(item,'disabled'))).toBe(true);
    }
  }
});

test('verified allergen conflict takes precedence over drug and disease ranking; unverified is not safe',()=>{
  const rows=[
    {...product('비타민 C'),id:101,allergen_verified:true,allergen_codes:[2],allergen_source_url:'https://example.org/label',allergen_checked_at:'2026-11-11'},
    {...product('마그네슘'),id:102,allergen_verified:true,allergen_codes:[],allergen_source_url:'https://example.org/label',allergen_checked_at:'2026-11-11'},
  ];
  const result=personalizeRecommendations(rows,['비타민 C','마그네슘'],{...profile,allergyCodes:[2],medicationCodes:[9]});
  expect(result.related.map(p=>p.id)).toEqual([102,101]);
  expect(result.related[1].notices.some(n=>n.message.includes('섭취를 피하고'))).toBe(true);
  expect(assessPersonalizedProduct(product('비타민 C'),{...profile,allergyCodes:[2]}).priority[0]).toBe(2);
});

test.each([
  ['medicationCodes',6,'코엔자임 Q10','와파린'],
  ['medicationCodes',8,'비타민 D3','티아지드'],
  ['medicationCodes',9,'마그네슘','항생제'],
  ['medicationCodes',9,'아연','항생제'],
  ['medicationCodes',10,'마그네슘','비스포스포네이트'],
  ['medicationCodes',11,'프로바이오틱스','면역억제'],
  ['medicationCodes',13,'코엔자임 Q10','인슐린'],
  ['medicationCodes',15,'비타민 B-Complex','항경련제'],
  ['medicationCodes',18,'아연','페니실라민'],
  ['conditionCodes',8,'마그네슘','축적'],
  ['conditionCodes',10,'비타민 D3','고칼슘혈증'],
  ['conditionCodes',13,'오메가-3','심방세동'],
  ['conditionCodes',14,'프로바이오틱스','면역저하'],
])('%s %s adds a targeted notice for %s',(field,code,category,word)=>{
  const assessed=assessPersonalizedProduct(product(category),{...profile,[field]:[code]});
  expect(assessed.notices.some(n=>n.message.includes(word))).toBe(true);
  expect(assessed.priority.some(value=>value>0)).toBe(true);
});

test('combined risks accumulate and medication warning changes situation order without dropping products',()=>{
  const related=['마그네슘','비타민 C'];
  const ordinary=personalizeRecommendations(products,related,profile);
  const takingAntibiotics=personalizeRecommendations(products,related,{...profile,medicationCodes:[9],conditionCodes:[8]});
  expect(ordinary.related[0].category).toBe('마그네슘');
  expect(takingAntibiotics.related[0].category).toBe('비타민 C');
  expect(takingAntibiotics.related.map(p=>p.id).sort()).toEqual(ordinary.related.map(p=>p.id).sort());
  const magnesium=takingAntibiotics.related.find(p=>p.category==='마그네슘');
  expect(magnesium.priority[1]).toBe(2);expect(magnesium.priority[2]).toBe(3);
});

test('age, sex, smoking change dietary comparison; BMI never determines a supplement dose',()=>{
  expect(bodyContext(profile).reference['마그네슘'].amount).toBe(400);
  expect(bodyContext({...profile,age:31}).reference['마그네슘'].amount).toBe(420);
  expect(bodyContext({...profile,gender:'F'}).reference['마그네슘'].amount).toBe(310);
  expect(bodyContext({...profile,age:71}).reference['비타민 D3'].amount).toBe(800);
  expect(bodyContext({...profile,smoking:true}).reference['비타민 C'].amount).toBe(125);
  const lighter=bodyContext({...profile,weight:45}), heavier=bodyContext({...profile,weight:120});
  expect(lighter.bmi).not.toBe(heavier.bmi);
  expect(lighter.reference).toEqual(heavier.reference);
  expect(lighter.lines.join(' ')).toContain('식사량');
  expect(bodyContext({...profile,age:16}).reference).toEqual({});
  expect(bodyContext({...profile,conditionCodes:[16]}).reference).toEqual({});
  expect(bodyContext({...profile,height:0}).bmi).toBeNull();
});

test('unknown labels, mixed compounds and probiotic CFUs are not invented dose comparisons',()=>{
  expect(labeledAmount({category:'비타민 C',serving_content:'함량 미확인'})).toBeNull();
  expect(labeledAmount({category:'비타민 D3',serving_content:'25 mcg'})).toBe(1000);
  expect(labeledAmount({category:'비타민 C',serving_content:'C 500mg / 아연 10mg'})).toBeNull();
  expect(labeledAmount(product('프로바이오틱스'))).toBeNull();
  const result=personalizeRecommendations(products,['프로바이오틱스'],profile);
  expect(result.related.every(p=>p.referenceRatio===null)).toBe(true);
});

test('no QR and disabled categories keep original situation membership',()=>{
  const result=personalizeRecommendations(SAMPLE_VITAMINS,['비타민 C'],null);
  expect(result.related.map(p=>p.id)).toEqual([3,4]);
  expect(result.summary.join(' ')).toContain('QR 없이');
  expect(result.assessments).toHaveLength(20);
});
