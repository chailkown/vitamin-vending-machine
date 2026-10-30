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

test('related products remain visible but a recommendation hold blocks cart across category changes',async()=>{
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],relatedItems:[3],hold:true,guidance:'현재 조건에서는 추천 불가',productExclusions:[{id:3,name:'C 상품',reason:'건강조건 확인 필요'}]}}/>));
  expect(container.querySelector('.card-name').textContent).toBe('C 상품');
  expect(container.querySelector('.card-button').disabled).toBe(true);
  await act(async()=>container.querySelector('.card-button').click());
  expect(container.querySelector('.cart-item')).toBeNull();
  await act(async()=>[...container.querySelectorAll('.tab')].find(el=>el.textContent==='비타민 C').click());
  expect(container.querySelector('.card-button').disabled).toBe(true);
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

test('empty recommendation retains explanation and recommendation tab instead of selecting an unrelated product',async()=>{
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],title:'추천',guidance:'원인 평가가 필요합니다.',warnings:['상담 안내'],sources:[],nutrients:[]}}/>));
  expect(container.querySelector('.tab.active').textContent).toBe('추천');
  expect(container.textContent).toContain('자동 추천할 상품이 없습니다');
  expect(container.textContent).toContain('원인 평가가 필요합니다');
  expect(container.textContent).not.toContain('장바구니 담기');
});

test('known QR restriction remains enforced after switching from recommendation to another category',async()=>{
  const qrProfile={id:'test',name:'테스트',age:25,conditionCodes:[9],allergyCodes:[0],medicationCodes:[0]};
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],qrProfile,nutrients:[]}}/>));
  const category=[...container.querySelectorAll('.tab')].find(el=>el.textContent==='비타민 C');
  await act(async()=>category.click());
  const add=container.querySelector('.card-button');
  expect(add.disabled).toBe(true);
  expect(add.textContent).toBe('선택 불가');
  await act(async()=>add.click());
  expect(container.querySelector('.cart-item')).toBeNull();
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
