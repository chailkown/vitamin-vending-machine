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
  const [qrInput, setQrInput] = useState('');
  const [qrError, setQrError] = useState('');

  const mounted = useRef(true);
  const submitting = useRef(false);
  const qrInputRef = useRef(null);
  useEffect(() => {
    if (showConfirm) qrInputRef.current?.focus();
  }, [showConfirm]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
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

  const submitQrRecommendation = async () => {
    if (submitting.current) return;
    submitting.current = true;
    let parsed;
    try { parsed = await resolveQrPayload(qrInput); } catch { setQrError('QR 서버에 연결하지 못했습니다.'); submitting.current=false; return; }
    submitting.current = false;
    if (!parsed.ok) {
      setQrError(parsed.message);
      return;
    }

    setQrError('');
    setShowConfirm(false);
    setScanning(true);
    setScanMessage('QR 데이터 분석 중...');
    submitting.current = true;
    try {
      const combo = {...await buildCombo(pendingSub, parsed.profile), qrData:parsed.raw};
      if (mounted.current && typeof onGoToPurchase === 'function') onGoToPurchase(combo);
    } catch {
      if (mounted.current) { setShowConfirm(true); setQrError('추천 데이터를 불러오지 못했습니다. 다시 시도해주세요.'); }
    } finally {
      submitting.current = false;
      if (mounted.current) setScanning(false);
    }
  };

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
                  setPendingSub(symptom.code); setQrInput(''); setQrError(''); setShowConfirm(true);
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
              <p className="qr-input-help">휴대폰 웹사이트의 QR로 질환·약물·알레르기를 검토합니다. QR 없이 진행하면 일반 정보만 제공하며 개인별 안전성을 확인할 수 없습니다.</p>
              <textarea
                ref={qrInputRef}
                className="qr-input"
                value={qrInput}
                onChange={(event) => setQrInput(event.target.value)}
                aria-label="QR 데이터"
                autoFocus
                placeholder="USB QR 스캐너로 입력하거나 건강정보 QR JSON을 붙여넣으세요"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQrRecommendation(); }
                }}
              />
              {qrError && <p className="qr-input-error">{qrError}</p>}
              <button type="button" className="confirm-back" onClick={()=>qrInputRef.current?.focus()}>스캐너 입력 준비</button>
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-yes"
                onClick={submitQrRecommendation}
              >
                QR 반영
              </button>
              <button
                type="button"
                className="confirm-no"
                onClick={continueWithoutQr}
              >
                QR 없이 계속
              </button>
            </div>
            <button className="confirm-back" onClick={() => setShowConfirm(false)}>다시 선택</button>
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
