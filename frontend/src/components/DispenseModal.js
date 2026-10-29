import React from 'react';
import '../styles/PaymentModal.css';
export default function DispenseModal({open,onClose,result,onComplete}) {
  if(!open)return null;
  const running = result === null;
  const close=()=>{if(running)return;if(result.ok){onComplete();return;}onClose();};
  return <div className="payment-overlay" role="dialog" aria-modal="true"><div className="payment-modal">
    <button className="payment-close" onClick={close} disabled={running} aria-label="닫기">✕</button>
    <h2>{running?'구매 접수 완료 · 배출 중':result.ok?'구매 완료':'배출 확인 필요'}</h2>
    {running ? <p role="status">결제 없이 바로 배출을 진행합니다. 화면을 닫지 말고 수령구에서 기다려주세요.</p>
      : <><p role="status">{result.message || '배출 명령을 완료했습니다. 수령구를 확인해주세요.'}</p><button className="payment-submit" onClick={close}>{result.requiresReview?'닫기 · 이전 요청 확인':'확인'}</button></>}
  </div></div>;
}
