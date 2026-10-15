import React, { useState, useRef } from 'react';
import '../styles/PaymentModal.css';

const PAYMENT_OPTIONS = [
  { id: 'card', label: '신용·체크카드', icon: '💳', desc: '카드 리더기에 태그하세요' },
  { id: 'mobile', label: '모바일 결제', icon: '📱', desc: 'QR 또는 NFC 결제' },
  { id: 'cash', label: '현금', icon: '💵', desc: '투입구에 현금을 넣어주세요' },
];

const PAYMENT_LABEL = {
  card: '신용·체크카드',
  mobile: '모바일 결제',
  cash: '현금',
};

export default function PaymentModal({
  open,
  onClose,
  cart,
  totalAmount,
  totalQty,
  onPay,
  onComplete,
}) {
  const [method, setMethod] = useState('card');
  const [step, setStep] = useState('select');
  const [errorText, setErrorText] = useState('');
  const [receipt, setReceipt] = useState(null);
  const paying = useRef(false);
  const [requiresReview, setRequiresReview] = useState(false);

  if (!open) return null;

  const resetAndClose = () => {
    if (paying.current) return;
    if (step === 'success') { onComplete(); return; }
    setStep('select');
    setMethod('card');
    setErrorText('');
    setReceipt(null);
    onClose();
  };

  const handlePay = async () => {
    if (paying.current) return;
    paying.current = true;
    setStep('processing');
    setErrorText('');
    try {
      const result = await onPay(method);
      if (result?.ok) { setReceipt(result); setStep('success'); }
      else { setErrorText(result?.message || '주문에 실패했습니다.'); setRequiresReview(Boolean(result?.requiresReview)); setStep('error'); }
    } catch { setErrorText('주문 결과 확인이 필요합니다. 관리자에게 문의해주세요.'); setRequiresReview(true); setStep('error'); }
    finally { paying.current = false; }
  };

  return (
    <div className="payment-overlay" role="dialog" aria-modal="true">
      <div className="payment-modal">
        <button type="button" className="payment-close" onClick={resetAndClose} aria-label="닫기" disabled={step === 'processing'}>
          ✕
        </button>

        {step === 'select' && (
          <>
            <h2 className="payment-title">결제 수단 선택</h2>
            <p className="payment-summary">
              총 <strong>{totalQty}개</strong> · <strong>{totalAmount.toLocaleString()}원</strong>
            </p>
            <ul className="payment-cart-preview">
              {cart.map((item) => (
                <li key={item.product.id}>
                  {item.product.name} × {item.qty}
                </li>
              ))}
            </ul>
            <div className="payment-options">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`payment-option ${method === opt.id ? 'selected' : ''}`}
                  onClick={() => setMethod(opt.id)}
                >
                  <span className="payment-option-icon">{opt.icon}</span>
                  <span className="payment-option-text">
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className="payment-submit" onClick={handlePay}>
              {totalAmount.toLocaleString()}원 결제하기
            </button>
          </>
        )}

        {step === 'processing' && (
          <div className="payment-processing">
            <div className="payment-spinner" />
            <p>결제 처리 중...</p>
            <p className="payment-processing-sub">{PAYMENT_LABEL[method]} 결제 진행</p>
          </div>
        )}

        {step === 'success' && receipt && (
          <div className="payment-success">
            <div className="payment-success-icon">✓</div>
            <h2>주문 완료</h2>
            <p className="payment-receipt-line">
              {receipt.totalQty}개 · {receipt.totalAmount.toLocaleString()}원
            </p>
            <p className="payment-receipt-line">결제: {PAYMENT_LABEL[method]}</p>
            {receipt.orderId && (
              <p className="payment-order-id">주문 #{String(receipt.orderId).slice(0, 8)}</p>
            )}
            <p className="payment-hint">{receipt.simulated ? '개발 모드: 배출 시뮬레이션 완료' : '파우치 배출 명령을 전달했습니다. 감사합니다.'}</p>
            <button type="button" className="payment-submit" onClick={resetAndClose}>
              확인
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="payment-error">
            <h2>결제 실패</h2>
            <p>{errorText}</p>
            <button type="button" className="payment-submit" disabled={requiresReview} onClick={() => setStep('select')}>
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { PAYMENT_LABEL };
