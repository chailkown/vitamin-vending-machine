import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import PurchaseScreen from './PurchaseScreen';
import {getAllVitamins} from '../services/vitaminService';

jest.mock('../services/vitaminService',()=>({getAllVitamins:jest.fn(),getLastFetchError:()=>null}));
jest.mock('../services/orderService',()=>({placeOrder:jest.fn()}));

let container, root;
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
  getAllVitamins.mockResolvedValue([{id:3,name:'C 상품',category:'비타민 C',price:150,stock:5,dispenser_slot:1}]);
});

test('related products remain visible but a recommendation hold allows cart across category changes',async()=>{
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],relatedItems:[3],hold:true,guidance:'현재 조건에서는 추천 불가',productExclusions:[{id:3,name:'C 상품',reason:'건강조건 확인 필요'}]}}/>));
  expect(container.querySelector('.card-name').textContent).toBe('C 상품');
  expect(container.querySelector('.card-button').disabled).toBe(false);
  await act(async()=>container.querySelector('.card-button').click());
  expect(container.querySelector('.cart-item')).not.toBeNull();
  await act(async()=>[...container.querySelectorAll('.tab')].find(el=>el.textContent==='비타민 C').click());
  expect(container.querySelector('.card-button').disabled).toBe(false);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});

test('direct selection allows B products while keeping stock and motor availability checks',async()=>{
  getAllVitamins.mockResolvedValue([
    {id:1,name:'B 상품',category:'비타민 B-Complex',stock:5,dispenser_slot:3},
    {id:2,name:'품절 B',category:'비타민 B-Complex',stock:0,dispenser_slot:4},
    {id:3,name:'미연결 B',category:'비타민 B-Complex',stock:5,dispenser_slot:null},
  ]);
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}}/>));
  const buttons=container.querySelectorAll('.card-button');
  expect(buttons[0].disabled).toBe(false);
  expect(buttons[0].textContent).toBe('장바구니 담기');
  expect(buttons[1].disabled).toBe(true);
  expect(buttons[2].disabled).toBe(true);
  await act(async()=>buttons[0].click());
  expect(container.querySelector('.cart-item-name').textContent).toBe('B 상품');
});

test('focus refresh removes an out-of-stock cart item without changing selected category',async()=>{
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}}/>));
  await act(async()=>container.querySelector('.card-button').click());
  expect(container.querySelector('.cart-item')).not.toBeNull();
  getAllVitamins.mockResolvedValue([{id:3,name:'C 상품',category:'비타민 C',stock:0,dispenser_slot:1}]);
  await act(async()=>window.dispatchEvent(new Event('focus')));
  expect(container.querySelector('.cart-item')).toBeNull();
  expect(container.querySelector('.card-button').disabled).toBe(true);
  expect(container.querySelector('.tab.active').textContent).toBe('비타민 C');
});

test('empty recommendation shows the catalog with explanatory text',async()=>{
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],title:'추천',guidance:'원인 평가가 필요합니다.',warnings:['상담 안내'],sources:[],nutrients:[]}}/>));
  expect(container.querySelector('.tab.active').textContent).toBe('추천');
  expect(container.textContent).toContain('전체 영양제를 둘러보고');
  expect(container.textContent).toContain('원인 평가가 필요합니다');
  expect(container.textContent).toContain('장바구니 담기');
});

test('QR shows the member name and allows purchase across categories',async()=>{
  const qrProfile={id:'test',name:'테스트',age:25,conditionCodes:[9],allergyCodes:[0],medicationCodes:[0]};
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],qrProfile,nutrients:[]}}/>));
  expect(container.querySelector('.recommend-info-panel h3').textContent).toBe('테스트님 추천내역입니다');
  const category=[...container.querySelectorAll('.tab')].find(el=>el.textContent==='비타민 C');
  await act(async()=>category.click());
  const add=container.querySelector('.card-button');
  expect(add.disabled).toBe(false);
  expect(add.textContent).toBe('장바구니 담기');
  await act(async()=>add.click());
  expect(container.querySelector('.cart-item')).not.toBeNull();
});

test('cart pages retain five items and clamp after removal', async()=>{
  getAllVitamins.mockResolvedValue(Array.from({length:5},(_,i)=>({id:i+1,name:`상품 ${i+1}`,category:'비타민 C',stock:5,dispenser_slot:i+1})));
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}}/>));
  for(const button of container.querySelectorAll('.card-button')) await act(async()=>button.click());
  expect(container.querySelectorAll('.cart-item')).toHaveLength(2);
  expect(container.querySelector('.cart-total-amount').textContent).toBe('5개');
  const next=()=>container.querySelector('[aria-label="장바구니 다음 상품"]');
  await act(async()=>next().click());
  expect(container.querySelector('.cart-item-name').textContent).toBe('상품 3');
  await act(async()=>next().click());
  expect(container.querySelector('.cart-item-name').textContent).toBe('상품 5');
  expect(next().disabled).toBe(true);
  await act(async()=>container.querySelector('.remove-btn').click());
  expect(container.querySelector('.cart-item-name').textContent).toBe('상품 3');
  expect(container.querySelector('.cart-total-amount').textContent).toBe('4개');
});

test('personalized order and three summary lines survive rendering; details never disable cart',async()=>{
  getAllVitamins.mockResolvedValue([
    {id:3,name:'C 상품',category:'비타민 C',stock:5,dispenser_slot:1},
    {id:8,name:'Mg 상품',category:'마그네슘',stock:5,dispenser_slot:2},
  ]);
  const personalization={summary:['상황별 추천 이유','약물 우선 확인','30세 · 175cm · 70kg'],body:['BMI 정보'],related:[
    {id:8,name:'Mg 상품',reason:'근육·신경 기능',comparison:'식사 포함 섭취기준 비교',notices:[{message:'항생제 복용 간격 확인'}]},
    {id:3,name:'C 상품',reason:'콜라겐 형성',notices:[]},
  ],sources:[]};
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{qrProfile:{name:'테스트'},relatedItems:[8,3],personalization}}/>));
  expect(container.querySelectorAll('.recommend-brief p')).toHaveLength(3);
  expect([...container.querySelectorAll('.card-name')].map(el=>el.textContent)).toEqual(['Mg 상품','C 상품']);
  const details=container.querySelector('details');expect(details.open).toBe(false);
  await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'));});
  expect(details.textContent).toContain('항생제 복용 간격 확인');
  expect(container.querySelector('.card-button').disabled).toBe(false);
  await act(async()=>container.querySelector('.card-button').click());
  expect(container.querySelector('.cart-item-name').textContent).toBe('Mg 상품');
});
