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
  getAllVitamins.mockResolvedValue([{id:3,name:'C 상품',category:'비타민 C',price:150,stock:5}]);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});

test('empty recommendation retains explanation and recommendation tab instead of selecting an unrelated product',async()=>{
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],title:'추천',guidance:'원인 평가가 필요합니다.',warnings:['상담 안내'],sources:[],nutrients:[]}}/>));
  expect(container.querySelector('.tab.active').textContent).toBe('추천');
  expect(container.textContent).toContain('자동 추천할 상품이 없습니다');
  expect(container.textContent).toContain('원인 평가가 필요합니다');
  expect(container.textContent).not.toContain('파우치 담기');
});

test('known QR restriction remains enforced after switching from recommendation to another category',async()=>{
  const qrProfile={id:'test',name:'테스트',age:25,conditionCodes:[9],allergyCodes:[0],medicationCodes:[0]};
  await act(async()=>root.render(<PurchaseScreen onBack={()=>{}} onOrderingChange={()=>{}} onOrderComplete={()=>{}} recommendedCombo={{items:[],qrProfile,nutrients:[]}}/>));
  const category=[...container.querySelectorAll('.tab')].find(el=>el.textContent==='비타민 C');
  await act(async()=>category.click());
  const add=container.querySelector('.card-button');
  expect(add.disabled).toBe(true);
  expect(container.textContent).toContain('신장결석');
  await act(async()=>add.click());
  expect(container.querySelector('.cart-item')).toBeNull();
});
