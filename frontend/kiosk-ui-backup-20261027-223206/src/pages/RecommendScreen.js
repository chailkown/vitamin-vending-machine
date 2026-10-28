import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/RecommendScreen.css';
import {
  getRecommendationCatalog,
  getRecommendationResult,
  parseQrPayload,
} from '../services/recommendationService';

export default function RecommendScreen({ onBack, onGoToPurchase }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeLarge, setActiveLarge] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [recMeta, setRecMeta] = useState(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSub, setPendingSub] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [qrError, setQrError] = useState('');

  const [recommendedItems, setRecommendedItems] = useState([]);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [productDetail, setProductDetail] = useState(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
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

  useEffect(() => {
    let cancelled = false;
    const loadRecommended = async () => {
      if (!activeSub) {
        setRecommendedItems([]);
        setRecMeta(null);
        return;
      }
      const meta = await getRecommendationResult(activeSub);
      if (!cancelled) { setRecMeta(meta); setRecommendedItems(meta.products); }
    };
    loadRecommended();
    return () => { cancelled = true; };
  }, [activeSub]);

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
    const parsed = parseQrPayload(qrInput);
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
      const combo = await buildCombo(pendingSub, parsed.profile);
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
    try {
      const combo = await buildCombo(pendingSub);
      if (mounted.current && typeof onGoToPurchase === 'function') onGoToPurchase(combo);
    } catch {
      if (mounted.current) { setShowConfirm(true); setQrError('추천 데이터를 불러오지 못했습니다.'); }
    } finally { submitting.current = false; }
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

  const nutrients = recMeta?.nutrients || [];
  const explanations = recMeta?.nutrientExplanations || {};
  const precautions = recMeta?.precautions || {};

  return (
    <div className="recommend-screen">
      <div className="rec-header">
        <button className="back-btn" onClick={onBack}>처음으로</button>
        <h2 className="rec-title">맞춤형 추천</h2>
      </div>

      <div className="rec-content">
        <div className="large-cats">
          {catalog.map((c) => (
            <div key={c.code} className={`large-card ${activeLarge === c.code ? 'active' : ''}`}>
              <div
                className="large-card-body rec-main-btn"
                onClick={() => {
                  setActiveLarge(activeLarge === c.code ? null : c.code);
                  setActiveSub(null);
                }}
              >
                <div className="rec-left">
                  <div className="rec-emoji">{c.emoji}</div>
                </div>
                <div className="rec-right">
                  <div className="large-card-title">{c.title}</div>
                </div>
              </div>

              {activeLarge === c.code && (
                <div className="inline-sub-list">
                  {c.symptoms.map((sub) => (
                    <button
                      key={sub.code}
                      type="button"
                      className={`sub-chip ${activeSub === sub.code ? 'selected' : ''}`}
                      onClick={() => setActiveSub(sub.code)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sub-area">
          {!activeSub ? (
            <div className="sub-empty">식사 보완 또는 증상을 선택해주세요. 근거와 건강정보를 검토하며, 추천할 수 없는 경우에는 상담 안내를 표시합니다.</div>
          ) : (
            <div className="detail-box">
              <div className="detail">
                <h3>선택한 항목</h3>
                <p>{findSymptomInCatalog(activeSub).sym?.label}</p>
                <p className="note">QR 스캔 시 개인 건강 프로필이 추천에 반영됩니다.</p>
                <p role="status">{recMeta?.guidance}</p>
                {(recMeta?.warnings || []).map((warning) => <p key={warning} className="note">{warning}</p>)}
                <div>{(recMeta?.sources || []).map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></p>)}</div>
              </div>

              {nutrients.length > 0 && (
                <>
                  <div className="rec-nutrients">
                    <strong>식사 보완 검토 후보:</strong>
                    {nutrients.map((n) => (
                      <span key={n} className="nutrient-chip">{n}</span>
                    ))}
                  </div>

                  <div className="rec-explanations">
                    {nutrients.map((n) => (
                      <div key={n} className="rec-explain-item">
                        <strong>{n}:</strong> {explanations[n] || '설명 준비 중'}
                      </div>
                    ))}
                  </div>

                  {nutrients.some((n) => precautions[n]) && (
                    <div className="rec-precautions">
                      <strong>주의사항</strong>
                      {nutrients.filter((n) => precautions[n]).map((n) => (
                        <div key={n} className="rec-precaution-item">
                          <strong>{n}:</strong> {precautions[n]}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {recommendedItems.length > 0 && (
                <div className="rec-products">
                  {recommendedItems.map((prod) => (
                    <div key={prod.id} className="rec-card">
                      <div className="rec-card-image">
                        <img src={prod.image_url || 'https://via.placeholder.com/120'} alt={prod.name} />
                      </div>
                      <div className="rec-card-name">{prod.name}</div>
                      <div className="rec-card-meta">{prod.form} · {prod.serving_content}</div>
                      <div className="rec-card-desc">{prod.remarks || prod.description}</div>
                      <div className="rec-card-price">
                        {prod.price ? `${prod.price.toLocaleString()}원` : ''}
                      </div>
                      <div className="rec-card-actions">
                        <button
                          type="button"
                          className="detail-btn"
                          onClick={() => {
                            setProductDetail(prod);
                            setShowProductDetail(true);
                          }}
                        >
                          상세보기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <button
                  type="button"
                  className="confirm-yes"
                  onClick={() => {
                    setPendingSub(activeSub);
                    setShowConfirm(true);
                  }}
                >
                  건강정보 반영·결과 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="overlay">
          <div className="confirm-modal qr-input-modal">
            <div className="confirm-body">
              <h3>QR을 스캔하시겠습니까?</h3>
              <p className="qr-input-help">앱 QR로 질환·약물·알레르기를 검토합니다. QR 없이 진행하면 일반 정보만 제공하며 개인별 안전성을 확인할 수 없습니다.</p>
              <textarea
                className="qr-input"
                value={qrInput}
                onChange={(event) => setQrInput(event.target.value)}
                aria-label="QR 데이터"
                autoFocus
                placeholder="USB QR 스캐너로 입력하거나 앱 QR JSON을 붙여넣으세요"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQrRecommendation(); }
                }}
              />
              {qrError && <p className="qr-input-error">{qrError}</p>}
            </div>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-yes"
                onClick={submitQrRecommendation}
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

      {showProductDetail && productDetail && (
        <div className="overlay">
          <div className="confirm-modal product-detail-modal">
            <div className="product-detail-layout">
              <div className="product-detail-image">
                <img
                  src={productDetail.image_url || 'https://via.placeholder.com/120'}
                  alt={productDetail.name}
                />
              </div>
              <div className="product-detail-body">
                <h3>{productDetail.name}</h3>
                <p className="product-detail-category">{productDetail.category}</p>
                <p><strong>함유량:</strong> {productDetail.serving_content}</p>
                <p><strong>형태:</strong> {productDetail.form}</p>
                <p><strong>비고:</strong> {productDetail.remarks}</p>
                {productDetail.nutrient_precautions && (
                  <p className="product-detail-warning">
                    <strong>주의:</strong> {productDetail.nutrient_precautions}
                  </p>
                )}
                <div className="product-detail-price">
                  {productDetail.price ? `${productDetail.price.toLocaleString()}원` : ''}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, textAlign: 'right' }}>
              <button
                type="button"
                className="confirm-no"
                onClick={() => {
                  setShowProductDetail(false);
                  setProductDetail(null);
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
