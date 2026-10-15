import React, { useState, useEffect, useMemo, useRef } from 'react';
import '../styles/PurchaseScreen.css';
import { getAllVitamins, getLastFetchError } from '../services/vitaminService';
import { placeOrder } from '../services/orderService';
import PaymentModal from '../components/PaymentModal';
import { getQrProfileRules, assessRecommendedProducts } from '../services/recommendationSafety';

export default function PurchaseScreen({ onBack, recommendedCombo, onOrderComplete, onOrderingChange }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [vitamins, setVitamins] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderMessage, setOrderMessage] = useState(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const ordering = useRef(false);
  const safetyExclusions = useMemo(() => {
    const profile = recommendedCombo?.qrProfile;
    if (!profile) return {};
    const result = assessRecommendedProducts(vitamins, profile, getQrProfileRules(profile));
    return Object.fromEntries(result.excluded.map((p) => [p.id, p.reason]));
  }, [vitamins, recommendedCombo]);
  const products = useMemo(() => activeCategory === '추천'
    ? vitamins.filter((product) => recommendedCombo?.items?.includes(product.id))
    : vitamins.filter((product) => product.category === activeCategory), [vitamins, activeCategory, recommendedCombo]);

  // 초기 로드: 카테고리 및 제품 조회
  useEffect(() => {
    let cancelled = false;
    getAllVitamins().then((data) => {
      if (cancelled) return;
      const unique = [...new Set(data.map((product) => product.category))];
      const hasRecommendation = Boolean(recommendedCombo);
      setVitamins(data);
      setCategories(hasRecommendation ? ['추천', ...unique] : unique);
      setActiveCategory(hasRecommendation ? '추천' : unique[0] || null);
      setFetchError(getLastFetchError() || (!data.length ? '표시할 상품이 없습니다.' : null));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [recommendedCombo]);

  // Cart helpers
  const addToCart = (product) => {
    if (ordering.current || showPayment || safetyExclusions[product.id]) return;
    setCart((prev) => {
      const existing = prev.find((p) => p.product.id === product.id);
      if (existing) {
        if (existing.qty >= Math.min(product.stock ?? 100, 100)) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return product.stock === 0 ? prev : [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const changeCartQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, qty: Math.min(item.product.stock ?? 100, Math.max(1, item.qty + delta)) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const cartTotal = () => cart.reduce((s, it) => s + it.product.price * it.qty, 0);
  const recommendationReasons = recommendedCombo?.nutrientExplanations || {};
  const qrRules = recommendedCombo?.qrRules || null;

  const buildRecommendationNote = () => {
    if (!recommendedCombo) return null;
    const parts = [recommendedCombo.title, recommendedCombo.selectedSub].filter(Boolean);
    return parts.join(' · ') || null;
  };

  const openPayment = () => {
    if (cart.length === 0) {
      setOrderMessage({ type: 'error', text: '장바구니에 제품을 담아주세요.' });
      return;
    }
    setOrderMessage(null);
    setShowPayment(true);
  };

  const handlePay = async (paymentMethod) => {
    if (ordering.current) return { ok: false, message: '주문 처리 중입니다.' };
    ordering.current = true;
    setIsOrdering(true);
    onOrderingChange(true);
    try {
      const result = await placeOrder(cart, {
        recommendationNote: buildRecommendationNote(),
        paymentMethod,
        userId: recommendedCombo?.qrProfile?.id || null,
      });
      if (result.ok) {
        setCart([]);
      }
      return result;
    } catch {
      return { ok: false, message: '구매 처리 중 오류가 발생했습니다.' };
    } finally {
      ordering.current = false; setIsOrdering(false); onOrderingChange(false);
    }
  };

  const handlePaymentClose = () => {
    if (ordering.current) return;
    setShowPayment(false);
  };

  return (
    <div className="purchase-screen" aria-busy={isOrdering}>
      {fetchError && <div className="db-status db-status--warn" role="status">상품 DB 조회 실패: {fetchError} · 샘플 상품은 조회용이며 DB 없이는 주문할 수 없습니다.</div>}
      {/* 상단 탭 */}
      <div className="tabs">
        {categories.map((category) => (
          <div
            key={category}
            className={`tab ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </div>
        ))}
      </div>

      {/* 제품 영역 */}
      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          {activeCategory === '추천' && recommendedCombo && (
            <div className="recommend-info-panel">
              <h3>맞춤형 추천 안내</h3>
              <p>{recommendedCombo.guidance}</p>
              {(recommendedCombo.warnings || []).map((warning) => <p key={warning}>{warning}</p>)}
              {!recommendedCombo.items?.length && <p role="status">현재 정보로 자동 추천할 상품이 없습니다. 제외 사유를 확인하고 필요한 경우 의사·약사에게 상담해주세요.</p>}
              {(recommendedCombo.productExclusions || []).map((product) => <p key={product.id}>{product.name}: {product.reason}</p>)}
              <div>{(recommendedCombo.sources || []).map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></p>)}</div>
              {recommendedCombo.qrProfile ? (
                <p className="recommend-selected">
                  QR 기준: {recommendedCombo.qrProfile.name} / {recommendedCombo.qrProfile.age}세 / {recommendedCombo.qrProfile.gender}
                  {' '}({recommendedCombo.qrProfile.height}cm, {recommendedCombo.qrProfile.weight}kg, 흡연: {recommendedCombo.qrProfile.smoking ? '예' : '아니요'}, 음주 단계: {recommendedCombo.qrProfile.alcohol})
                </p>
              ) : null}
              {qrRules ? (
                <div className="recommend-qr-rules">
                  <div>기저질환: {qrRules.labels.condition}</div>
                  <div>알러지: {qrRules.labels.allergy}</div>
                  <div>복용약물: {qrRules.labels.medication}</div>
                  {qrRules.addedNutrients.length > 0 && (
                    <div>QR 추가: {qrRules.addedNutrients.join(', ')}</div>
                  )}
                  {qrRules.excludedNutrients.length > 0 && (
                    <div className="recommend-excluded">QR 제외: {qrRules.excludedNutrients.join(', ')}</div>
                  )}
                  {(qrRules.warnings || []).map((warning) => <div className="recommend-excluded" key={warning}>{warning}</div>)}
                </div>
              ) : null}
              {recommendedCombo.selectedSub ? (
                <p className="recommend-selected">선택 증상: {recommendedCombo.selectedSub}</p>
              ) : null}
              <div className="recommend-nutrients">
                {(recommendedCombo.nutrients || []).map((nutrient) => (
                  <div key={nutrient} className="recommend-nutrient-item">
                    <strong>{nutrient}</strong>
                    <span>{recommendationReasons[nutrient] || '제품 성분과 개인별 섭취 필요성을 확인해주세요.'}</span>
                    {recommendedCombo.nutrientPrecautions?.[nutrient] ? (
                      <div className="recommend-precaution">
                        주의: {recommendedCombo.nutrientPrecautions[nutrient]}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="products">
            {products.map((product) => (
              <div key={product.id} className="card">
                <div className="card-image">
                  <img
                    src={product.image_url || 'https://via.placeholder.com/120'}
                    alt={product.name}
                  />
                </div>
                <div className="card-name">{product.name}</div>
                <div className="card-desc">{product.description || '제품 성분과 함량을 확인해주세요.'}</div>
                {activeCategory === '추천' && product.category ? (
                  <div className="card-reason">검토 후보: {product.category}</div>
                ) : null}
                {activeCategory === '추천' && product.category ? (
                  <div className="card-reason-desc">
                    {recommendationReasons[product.category] || '개인별 섭취 필요성을 확인해주세요.'}
                  </div>
                ) : null}
                <div className="card-price">{product.price.toLocaleString()}원 / 파우치</div>
                {product.stock != null && product.stock <= 10 && (
                  <div className="card-stock">재고 {product.stock}개</div>
                )}
                <button
                  className="card-button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0 || Boolean(safetyExclusions[product.id])}
                >
                  {product.stock === 0 ? '품절' : safetyExclusions[product.id] ? '상담·성분 확인 필요' : '파우치 담기'}
                </button>
                {safetyExclusions[product.id] && <p className="recommend-excluded">{safetyExclusions[product.id]}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 장바구니 영역 */}
      <div className="bottom-section">
        <div className="cart-list">
          {cart.length === 0 ? (
            <div className="empty-cart">장바구니에 담긴 제품이 없습니다.</div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.product.name}</div>
                  <div className="cart-item-price">{(item.product.price * item.qty).toLocaleString()}원</div>
                </div>
                <div className="cart-item-controls">
                  <button className="qty-btn small" onClick={() => changeCartQty(item.product.id, -1)}>−</button>
                  <span className="qty-display small">{item.qty}</span>
                  <button className="qty-btn small" onClick={() => changeCartQty(item.product.id, 1)}>+</button>
                  <button className="remove-btn" onClick={() => removeFromCart(item.product.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-summary">
          <div className="cart-total-label">합계</div>
          <div className="cart-total-amount">{cartTotal().toLocaleString()}원</div>
        </div>

        {orderMessage && (
          <div className={`order-toast order-toast--${orderMessage.type}`} role="status">
            {orderMessage.text}
          </div>
        )}
      </div>

      {/* 하단 네비 */}
      <div className="nav">
        <button className="nav-btn home-btn" onClick={onBack} disabled={showPayment}>
          처음으로
        </button>
        <button
          className="nav-btn purchase-btn"
          onClick={openPayment}
          disabled={showPayment || cart.length === 0}
        >
          결제하기
        </button>
      </div>

      <PaymentModal
        open={showPayment}
        onClose={handlePaymentClose}
        cart={cart}
        totalAmount={cartTotal()}
        totalQty={cart.reduce((s, it) => s + it.qty, 0)}
        onPay={handlePay}
        onComplete={onOrderComplete}
      />
    </div>
  );
}
