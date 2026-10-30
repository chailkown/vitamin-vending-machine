import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import RecommendScreen from './RecommendScreen';
import {getRecommendationResult} from '../services/recommendationService';
import {resolveQrPayload} from '../services/qrResolver';
jest.mock('../services/recommendationService',()=>({
 getRecommendationCatalog:async()=>[{code:'food',title:'식사',symptoms:[{code:'food-a',label:'상황 선택'}]}],
 getRecommendationResult:jest.fn(async()=>({items:[3]})),
}));
jest.mock('../services/qrResolver',()=>({resolveQrPayload:jest.fn(async()=>({ok:true,profile:{id:'test',name:'테스트'},raw:{id:'test'}}))}));
let root,container,go;
const click=async text=>act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.trim()===text).click());
const scan=async()=>act(async()=>{for(const key of ['{','}','Enter'])window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));});
beforeEach(async()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;jest.useFakeTimers();jest.clearAllMocks();go=jest.fn();
 getRecommendationResult.mockResolvedValue({items:[3]});
 resolveQrPayload.mockResolvedValue({ok:true,profile:{id:'test',name:'테스트'},raw:{id:'test'}});
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 await act(async()=>root.render(<RecommendScreen onBack={()=>{}} onGoToPurchase={go}/>));
 await click('식사');await click('상황 선택');
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();jest.useRealTimers();});
test('no editable QR field; no uses the situation only',async()=>{
 expect(container.querySelector('textarea,input')).toBeNull();
 await scan();expect(resolveQrPayload).not.toHaveBeenCalled();
 await click('아니요');expect(getRecommendationResult).toHaveBeenCalledWith('food-a',null);expect(go).toHaveBeenCalledTimes(1);
});
test('yes accepts scanner input only within the waiting screen',async()=>{
 await click('예');expect(container.textContent).toContain('30초');
 await scan();expect(resolveQrPayload).toHaveBeenCalledWith('{}');expect(go).toHaveBeenCalledTimes(1);
});
test('cancel clears scanning and allows situation-only recommendation',async()=>{
 await click('예');await click('취소');await scan();expect(resolveQrPayload).not.toHaveBeenCalled();
 await click('아니요');expect(getRecommendationResult).toHaveBeenCalledWith('food-a',null);
});
test('30 second timeout returns to choice and ignores subsequent scans',async()=>{
 await click('예');await act(async()=>jest.advanceTimersByTime(30000));
 expect(container.textContent).toContain('대기시간이 끝났습니다');await scan();expect(go).not.toHaveBeenCalled();
 await click('예');expect(container.textContent).toContain('30초');
});
