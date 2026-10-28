import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getAllVitamins } from './services/vitaminService';
import { placeOrder } from './services/orderService';

jest.mock('./services/vitaminService', () => ({ getAllVitamins: jest.fn(), getLastFetchError: () => null }));
jest.mock('./services/orderService', () => ({ placeOrder: jest.fn() }));
jest.mock('./pages/RecommendScreen', () => function Recommendation({ onGoToPurchase, onBack }) {
  return <><button onClick={() => onGoToPurchase({ items: [1], title: '추천', qrProfile: {id:'test-a',name:'사용자 A',age:25}, nutrients:[] })}>테스트 QR 입력</button><button onClick={onBack}>처음으로</button></>;
});

let container, root;
const button = (text) => [...container.querySelectorAll('button')].find((el) => el.textContent.includes(text));
const click = async (text) => { await act(async () => { button(text).click(); }); };
const enter = async () => { await click('맞춤형 추천'); await click('테스트 QR 입력'); };

beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  getAllVitamins.mockResolvedValue([{id:1,category:'비타민 C',name:'비타민 C 파우치',price:160,stock:8,dispenser_slot:1}]);
  placeOrder.mockReset();
  container = document.createElement('div'); document.body.appendChild(container);
  root=createRoot(container);
  await act(async()=>root.render(<App />));
});
afterEach(async () => { await act(async()=>root.unmount());container.remove();jest.useRealTimers(); });

test('QR -> cart -> home resets session, keeps permanent data, and remounts empty cart',async()=>{
  localStorage.setItem('inventory','8'); localStorage.setItem('history','saved');
  sessionStorage.setItem('vitamin-kiosk-qr','private');
  await enter(); await click('파우치 담기');
  expect(container.querySelector('.cart-item')).not.toBeNull();
  await click('처음으로');
  expect(container.textContent).not.toContain('사용자 A');
  expect(sessionStorage.getItem('vitamin-kiosk-qr')).toBeNull();
  expect(localStorage.getItem('inventory')).toBe('8'); expect(localStorage.getItem('history')).toBe('saved');
  await click('직접 선택'); expect(container.querySelector('.cart-item')).toBeNull();
});
test('active kiosk resets after 60 seconds and activity postpones idle reset',async()=>{
  await enter();
  await act(async()=>jest.advanceTimersByTime(59_000));
  await act(async()=>window.dispatchEvent(new Event('keydown')));
  await act(async()=>jest.advanceTimersByTime(59_000));
  expect(container.querySelector('.purchase-screen')).not.toBeNull();
  await act(async()=>jest.advanceTimersByTime(1000));
  expect(container.querySelector('.main-screen')).not.toBeNull();
});
test('pending order prevents double-click, closing, home and idle reset; success resets on confirm',async()=>{
  let resolve;
  placeOrder.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  await enter(); await click('파우치 담기'); await click('무료 배출');
  const submit=container.querySelector('.payment-submit');
  await act(async()=>{submit.click();submit.click();});
  expect(placeOrder).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.payment-close').disabled).toBe(true);
  expect(button('처음으로').disabled).toBe(true);
  await act(async()=>jest.advanceTimersByTime(61_000));
  expect(container.querySelector('.purchase-screen')).not.toBeNull();
  await act(async()=>resolve({ok:true,orderId:'x',totalAmount:320,totalQty:2}));
  expect(container.textContent).toContain('배출 명령 완료');
  expect(placeOrder.mock.calls[0][1].qrToken).toBeNull();
  await click('확인'); expect(container.querySelector('.main-screen')).not.toBeNull();
});
test('DB failure displays failure and keeps session/cart for retry',async()=>{
  placeOrder.mockResolvedValue({ok:false,message:'DB 연결 실패'});
  await enter(); await click('파우치 담기'); await click('무료 배출'); await click('배출 시작');
  expect(container.textContent).toContain('DB 연결 실패');
  expect(container.textContent).not.toContain('배출 명령 완료');
  expect(container.querySelector('.cart-item')).not.toBeNull();
});
