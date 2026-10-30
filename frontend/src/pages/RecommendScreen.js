import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/RecommendScreen.css';
import { resolveQrPayload } from '../services/qrResolver';
import {
  getRecommendationCatalog,
  getRecommendationResult,
} from '../services/recommendationService';

export default function RecommendScreen({ onBack, onGoToPurchase }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeLarge, setActiveLarge] = useState(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSub, setPendingSub] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [qrError, setQrError] = useState('');

  const mounted = useRef(true);
  const submitting = useRef(false);
  const scanBuffer = useRef('');
  const attempt = useRef(0);
  const deadline = useRef(0);
  const cancelScan = () => {
    attempt.current += 1; submitting.current = false;
    scanBuffer.current = ''; setWaiting(false); setScanning(false);
    setQrError(''); setShowConfirm(true);
  };
  const startScan = () => {
    attempt.current += 1; submitting.current = false; scanBuffer.current = '';
    deadline.current = Date.now() + 30000;
    setSecondsLeft(30); setQrError(''); setShowConfirm(false); setWaiting(true);
  };
  useEffect(() => {
    if (!waiting) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current-Date.now())/1000));
      setSecondsLeft(left);
      if (!left) {
        attempt.current += 1; submitting.current=false; scanBuffer.current='';
        setWaiting(false); setShowConfirm(true);
        setQrError('스캔 대기시간이 끝났습니다. 다시 선택해주세요.');
      }
    };
    const timer=setInterval(tick,200);
    return () => clearInterval(timer);
  }, [waiting]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; attempt.current += 1; };
  }, []);

  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      const data = await getRecommendationCatalog();
      if (mounted.current) { setCatalog(data); setCatalogLoading(false); }
    })();
  }, []);

  const findSymptomInCatalog = useCallback(
    (symptomCode) => {
      for (const cat of catalog) {
        const sym = cat.symptoms.find((s) => s.code === symptomCode);
        if (sym) return { cat, sym };
      }
      return { cat: null, sym: null };
    },
    [catalog]
  );

  const buildCombo = async (symptomCode, qrProfile = null) => {
    const { cat, sym } = findSymptomInCatalog(symptomCode);
    const meta = await getRecommendationResult(symptomCode, qrProfile);

    return {
      ...meta,
      title: qrProfile && cat ? `${cat.title} + QR 맞춤 추천` : cat?.title || '추천 조합',
      selectedSub: qrProfile
        ? `${sym?.label || ''} + QR(${qrProfile.name}) 프로필`
        : sym?.label || '',
      nutrientPrecautions: meta.precautions,
    };
  };

  const submitQrRecommendation = async (raw) => {
    if (submitting.current || Date.now() >= deadline.current) return;
    submitting.current = true;
    const current=attempt.current;
    const valid=()=>mounted.current && current===attempt.current;
    try {
      const parsed=await resolveQrPayload(raw);
      if (!valid()) return;
      if (!parsed.ok) { setQrError('QR을 인식하지 못했습니다. 다시 스캔해주세요.'); return; }
      setWaiting(false); setScanning(true); setScanMessage('추천을 불러오는 중...');
      const combo={...await buildCombo(pendingSub,parsed.profile),qrData:parsed.raw};
      if (valid()) onGoToPurchase?.(combo);
    } catch {
      if (valid()) { setWaiting(false); setShowConfirm(true); setQrError('추천을 불러오지 못했습니다. 다시 시도해주세요.'); }
    } finally {
      if(valid()) {submitting.current=false;setScanning(false);}
    }
  };

  // USB HID scanner sends characters followed by Enter; there is no editable field.
  useEffect(() => {
    const onKey = event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length!==1 && event.key!=='Enter' && event.key!=='Backspace') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!waiting || submitting.current || Date.now()>=deadline.current) return;
      if(event.key==='Enter') {
        const raw=scanBuffer.current;scanBuffer.current='';
        if(raw)submitQrRecommendation(raw);
      } else if(event.key==='Backspace') scanBuffer.current=scanBuffer.current.slice(0,-1);
      else {
        if(event.key==='{')scanBuffer.current='';
        if(scanBuffer.current.length<1800)scanBuffer.current+=event.key;
      }
    };
    window.addEventListener('keydown',onKey,true);
    return ()=>window.removeEventListener('keydown',onKey,true);
  });

  const continueWithoutQr = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setShowConfirm(false);
    setScanning(true);
    setScanMessage('추천을 불러오는 중...');
    try {
      const combo = await buildCombo(pendingSub);
      if (mounted.current && typeof onGoToPurchase === 'function') onGoToPurchase(combo);
    } catch {
      if (mounted.current) { setShowConfirm(true); setQrError('추천 데이터를 불러오지 못했습니다.'); }
    } finally { submitting.current = false; if (mounted.current) setScanning(false); }
  };

  if (catalogLoading) {
    return (
      <div className="recommend-screen">
        <div className="rec-header">
          <button className="back-btn" onClick={onBack}>처음으로</button>
          <h2 className="rec-title">맞춤형 추천</h2>
        </div>
        <div className="sub-empty" style={{ padding: 40 }}>추천 데이터 불러오는 중...</div>
      </div>
    );
  }

  const selectedCategory = catalog.find((category) => category.code === activeLarge);
  return (
    <div className="recommend-screen">
      <div className="rec-header">
        <button className="back-btn" onClick={onBack}>처음으로</button>
        <h2 className="rec-title">맞춤형 추천</h2>
      </div>
      <div className="rec-content">
        <p className="rec-hint">관심 있는 항목을 선택해주세요.</p>
        <div className="large-cats">
          {catalog.map((category) => (
            <button type="button" key={category.code}
              className={`large-card ${activeLarge === category.code ? 'active' : ''}`}
              aria-expanded={activeLarge === category.code} aria-controls="sub-selection"
              onClick={() => setActiveLarge(category.code)}>
              <span className="rec-emoji" aria-hidden="true">{category.emoji}</span>
              <span className="large-card-title">{category.title}</span>
            </button>
          ))}
        </div>
        {selectedCategory && (
          <section id="sub-selection" className="sub-selection" aria-label="세부 상황">
            <h3>{selectedCategory.title}</h3>
            <p className="rec-hint">세부 상황을 누르면 다음 단계로 이동합니다.</p>
            <div className="sub-list">
              {selectedCategory.symptoms.map((symptom) => (
                <button type="button" key={symptom.code} className="sub-btn" onClick={() => {
                  setPendingSub(symptom.code); scanBuffer.current=''; setQrError(''); setShowConfirm(true);
                }}>{symptom.label}</button>
              ))}
            </div>
          </section>
        )}
      </div>

      {showConfirm && (
        <div className="overlay">
          <div className="confirm-modal qr-input-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
            <div className="confirm-body">
              <h3 id="qr-title">건강정보 QR을 사용하시겠습니까?</h3>
              <p className="qr-input-help">QR을 사용하면 건강정보를 함께 반영합니다. 아니요를 누르면 선택한 상황으로 추천합니다.</p>
              {qrError && <p className="qr-input-error" role="alert">{qrError}</p>}
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-yes"
                onClick={startScan}
              >
                예
              </button>
              <button
                type="button"
                className="confirm-no"
                onClick={continueWithoutQr}
              >
                아니요
              </button>
            </div>
            <button className="confirm-back" onClick={() => setShowConfirm(false)}>다시 선택</button>
          </div>
        </div>
      )}

      {waiting && (
        <div className="overlay">
          <div className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title">
            <h3 id="scan-title" className="scanner-title">휴대폰 QR을 스캐너에 보여주세요</h3>
            <p className="scan-countdown">{secondsLeft}초</p>
            {qrError && <p className="qr-input-error" role="alert">{qrError}</p>}
            <button className="confirm-back" onClick={cancelScan}>취소</button>
          </div>
        </div>
      )}

      {scanning && (
        <div className="overlay">
          <div className="scanner-modal">
            <div className="scanner-body">
              <div className="scanner-title">{scanMessage}</div>
              <div className="scanner-spinner">
                <div className="dot dot1" />
                <div className="dot dot2" />
                <div className="dot dot3" />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
