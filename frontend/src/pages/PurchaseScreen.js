import React, { useState, useEffect } from 'react';
import '../styles/PurchaseScreen.css';
import { getAllVitamins, getVitaminsByCategory, getLastFetchError } from '../services/vitaminService';
import { placeOrder } from '../services/orderService';
import PaymentModal from '../components/PaymentModal';

export default function PurchaseScreen({ onBack, recommendedCombo }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderMessage, setOrderMessage] = useState(null);

  // 초기 로드: 카테고리 및 제품 조회
  useEffect(() => {
    loadVitamins();
  }, []);

  // 선택한 카테고리에 따라 제품 로드
  useEffect(() => {
    if (activeCategory) {
      if (activeCategory === '추천') {
        setProducts(recommendedProducts);
      } else {
        loadProductsByCategory(activeCategory);
      }
    }
  }, [activeCategory]);

  const loadVitamins = async () => {
    setLoading(true);
    const vitamins = await getAllVitamins();
    
    if (vitamins.length > 0) {
      // 카테고리 추출 (고유값만)
      const uniqueCategories = [...new Set(vitamins.map(v => v.category))];
      // 추천/QR 진입 시에만 "추천" 탭을 추가하고 추천 상품을 보여준다.
      if (recommendedCombo && recommendedCombo.items && recommendedCombo.items.length > 0) {
        const recs = vitamins.filter(v => recommendedCombo.items.includes(v.id));
        setRecommendedProducts(recs);
        setCategories(['추천', ...uniqueCategories]);
        setActiveCategory('추천');
        setProducts(recs);
      } else {
        setCategories(uniqueCategories);
        setActiveCategory(uniqueCategories[0]);
      }
    } else {
      setFetchError(getLastFetchError() || '표시할 상품이 없습니다.');
    }
    setFetchError((prev) => getLastFetchError() || prev);
    setLoading(false);
  };

  const loadProductsByCategory = async (category) => {
    setLoading(true);
    const categoryProducts = await getVitaminsByCategory(category);
    setProducts(categoryProducts);
    setLoading(false);
  };

  // Cart helpers
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const changeCartQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, qty: Math.max(1, item.qty + delta) } : item
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
    try {
      const result = await placeOrder(cart, {
        recommendationNote: buildRecommendationNote(),
        paymentMethod,
      });
      if (result.ok) {
        setCart([]);
        await loadVitamins();
        if (activeCategory && activeCategory !== '추천') {
          await loadProductsByCategory(activeCategory);
        }
      }
      return result;
    } catch {
      return { ok: false, message: '구매 처리 중 오류가 발생했습니다.' };
    }
  };

  const handlePaymentClose = () => {
    setShowPayment(false);
  };

  return (
    <div className="purchase-screen">
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
                </div>
              ) : null}
              {recommendedCombo.selectedSub ? (
                <p className="recommend-selected">선택 증상: {recommendedCombo.selectedSub}</p>
              ) : null}
              <div className="recommend-nutrients">
                {(recommendedCombo.nutrients || []).map((nutrient) => (
                  <div key={nutrient} className="recommend-nutrient-item">
                    <strong>{nutrient}</strong>
                    <span>{recommendationReasons[nutrient] || '해당 증상에 맞는 영양소입니다.'}</span>
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
                <div className="card-desc">{product.description || '기초 건강 관리에 도움'}</div>
                {activeCategory === '추천' && product.category ? (
                  <div className="card-reason">추천 영양소: {product.category}</div>
                ) : null}
                {activeCategory === '추천' && product.category ? (
                  <div className="card-reason-desc">
                    {recommendationReasons[product.category] || '해당 증상에 맞는 영양소로 추천되었습니다.'}
                  </div>
                ) : null}
                <div className="card-price">{product.price.toLocaleString()}원</div>
                {product.stock != null && product.stock <= 10 && (
                  <div className="card-stock">재고 {product.stock}개</div>
                )}
                <button
                  className="card-button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                >
                  {product.stock === 0 ? '품절' : '담기'}
                </button>
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
      />
    </div>
  );
}
