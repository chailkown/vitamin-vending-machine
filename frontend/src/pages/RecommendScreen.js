import React, { useState, useEffect, useCallback } from 'react';
import '../styles/RecommendScreen.css';
import { getAllVitamins } from '../services/vitaminService';
import {
  getRecommendationCatalog,
  getRecommendationForSymptom,
  getProductIdsForSymptom,
  getProductIdsForNutrients,
  parseQrPayload,
  getQrProfileRules,
  DEFAULT_QR_PAYLOAD,
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
  const [qrInput, setQrInput] = useState(JSON.stringify(DEFAULT_QR_PAYLOAD));
  const [qrError, setQrError] = useState('');

  const [recommendedItems, setRecommendedItems] = useState([]);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [productDetail, setProductDetail] = useState(null);

  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      const data = await getRecommendationCatalog();
      setCatalog(data);
      setCatalogLoading(false);
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
    const loadRecommended = async () => {
      if (!activeSub) {
        setRecommendedItems([]);
        setRecMeta(null);
        return;
      }
      const meta = await getRecommendationForSymptom(activeSub);
      setRecMeta(meta);
      const all = await getAllVitamins();
      const items = all.filter((p) => meta.nutrients.includes(p.category));
      setRecommendedItems(items);
    };
    loadRecommended();
  }, [activeSub]);

  const buildCombo = async (symptomCode, qrProfile = null) => {
    const { cat, sym } = findSymptomInCatalog(symptomCode);
    const meta = await getRecommendationForSymptom(symptomCode);
    let productIds = await getProductIdsForSymptom(symptomCode);
    let nutrients = [...meta.nutrients];
    let nutrientExplanations = { ...meta.nutrientExplanations };
    const nutrientPrecautions = { ...meta.precautions };
    let qrRules = null;

    if (qrProfile) {
      qrRules = getQrProfileRules(qrProfile);
      nutrients = [...new Set([...nutrients, ...qrRules.addedNutrients])]
        .filter((nutrient) => !qrRules.excludedNutrients.includes(nutrient));
      productIds = await getProductIdsForNutrients(nutrients, qrRules.excludedNutrients);
      nutrientExplanations = {
        ...nutrientExplanations,
        ...qrRules.reasons,
      };
    }

    return {
      title: qrProfile && cat ? `${cat.title} + QR 맞춤 추천` : cat?.title || '추천 조합',
      selectedSub: qrProfile
        ? `${sym?.label || ''} + QR(${qrProfile.name}) 프로필`
        : sym?.label || '',
      items: productIds,
      nutrients,
      nutrientExplanations,
      nutrientPrecautions,
      qrProfile,
      qrRules,
    };
  };

  const submitQrRecommendation = async () => {
    const parsed = parseQrPayload(qrInput);
    if (!parsed.ok) {
      setQrError(parsed.message);
      return;
    }

    setQrError('');
    setShowConfirm(false);
    setScanning(true);
    setScanMessage('QR 데이터 분석 중...');
    setTimeout(async () => {
      setScanning(false);
      const combo = await buildCombo(pendingSub, parsed.profile);
      if (typeof onGoToPurchase === 'function') onGoToPurchase(combo);
      setActiveSub(null);
      setPendingSub(null);
      setScanMessage('스캔 완료');
      setTimeout(() => setScanMessage(''), 1400);
    }, 900);
  };

  const continueWithoutQr = async () => {
    setShowConfirm(false);
    const combo = await buildCombo(pendingSub);
    setPendingSub(null);
    setQrError('');
    if (typeof onGoToPurchase === 'function') onGoToPurchase(combo);
    else onBack();
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
            <div className="sub-empty">세부 항목을 선택하면 슬라이드 알고리즘에 따른 추천이 표시됩니다.</div>
          ) : (
            <div className="detail-box">
              <div className="detail">
                <h3>선택한 항목</h3>
                <p>{findSymptomInCatalog(activeSub).sym?.label}</p>
                <p className="note">QR 스캔 시 개인 건강 프로필이 추천에 반영됩니다.</p>
              </div>

              {nutrients.length > 0 && (
                <>
                  <div className="rec-nutrients">
                    <strong>권장 영양소:</strong>
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
                  구매하기
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
              <p className="qr-input-help">예를 누르면 앱 QR 데이터를 반영하고, 아니요를 누르면 선택한 상황만으로 추천합니다.</p>
              <textarea
                className="qr-input"
                value={qrInput}
                onChange={(event) => setQrInput(event.target.value)}
                aria-label="QR 데이터"
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
