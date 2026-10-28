import React, {useState,useRef} from 'react';
import '../styles/PaymentModal.css';
export default function DispenseModal({open,onClose,totalQty,onDispense,onComplete}) {
  const [step,setStep]=useState('confirm');const [message,setMessage]=useState('');const busy=useRef(false);
  const [review,setReview]=useState(false);
  if(!open)return null;
  const run=async()=>{
    if(busy.current)return;busy.current=true;setStep('running');
    try {const result=await onDispense();setMessage(result.message||'배출 결과를 확인해주세요.');setReview(Boolean(result.requiresReview));setStep(result.ok?'done':'error');}
    catch {setMessage('결과 확인이 필요합니다. 다시 배출하지 말고 관리자에게 문의해주세요.');setReview(true);setStep('error');}
    finally {busy.current=false;}
  };
  const close=()=>{if(busy.current)return;if(step==='done'){onComplete();return;}setStep('confirm');setMessage('');setReview(false);onClose();};
  return <div className="payment-overlay" role="dialog" aria-modal="true"><div className="payment-modal">
    <button className="payment-close" onClick={close} disabled={step==='running'} aria-label="닫기">✕</button>
    <h2>{step==='confirm'?'무료 배출 확인':step==='running'?'배출 중...':step==='done'?'배출 명령 완료':'배출 확인 필요'}</h2>
    {step==='confirm'&&<><p>선택한 영양제 {totalQty}개를 배출합니다.</p><p>수령구를 확인해주세요.</p><button className="payment-submit" onClick={run}>배출 시작</button></>}
    {step==='running'&&<p>화면을 닫지 말고 잠시 기다려주세요.</p>}
    {(step==='done'||step==='error')&&<><p>{message}</p><button className="payment-submit" onClick={close}>{review?'관리자에게 문의':'확인'}</button></>}
  </div></div>;
}
