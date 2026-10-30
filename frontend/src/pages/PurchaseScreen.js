import React, { useState, useEffect, useMemo, useRef } from 'react';
import '../styles/PurchaseScreen.css';
import { getAllVitamins, getLastFetchError } from '../services/vitaminService';
import { placeOrder } from '../services/orderService';
import DispenseModal from '../components/DispenseModal';
import { getQrProfileRules, assessRecommendedProducts } from '../services/recommendationSafety';

export default function PurchaseScreen({ onBack, recommendedCombo, onOrderComplete, onOrderingChange }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [vitamins, setVitamins] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartPage, setCartPage] = useState(0);
  const cartPageCount = Math.max(1, Math.ceil(cart.length / 2));
  const visibleCartPage = Math.min(cartPage, cartPageCount - 1);
  useEffect(() => { setCartPage(page => Math.min(page, cartPageCount - 1)); }, [cartPageCount]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderMessage, setOrderMessage] = useState(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [dispenseResult, setDispenseResult] = useState(null);
  const ordering = useRef(false);
  const refreshInventory = useRef(() => {});
  const safetyExclusions = useMemo(() => {
    // Direct selection is ordinary vending; health rules apply only to recommendation sessions.
    if (!recommendedCombo) return {};
    const profile = recommendedCombo?.qrProfile;
    const result = assessRecommendedProducts(vitamins, profile, profile ? getQrProfileRules(profile) : null);
    const excluded = Object.fromEntries(result.excluded.map((p) => [p.id, p.reason]));
    for (const product of recommendedCombo?.productExclusions || []) excluded[product.id] = product.reason;
    if (recommendedCombo?.hold) for (const product of vitamins) excluded[product.id] ||= '현재 상황·건강조건에서는 자동 추천·배출을 보류합니다.';
    return excluded;
  }, [vitamins, recommendedCombo]);
  const products = useMemo(() => activeCategory === '추천'
    ? vitamins.filter((product) => (recommendedCombo?.relatedItems || recommendedCombo?.items)?.includes(product.id))
    : vitamins.filter((product) => product.category === activeCategory), [vitamins, activeCategory, recommendedCombo]);

  // 초기 로드: 카테고리 및 제품 조회
  useEffect(() => {
    let cancelled = false, fetching = false, initial = true;
    const refresh = async () => {
      if (cancelled || fetching || ordering.current) return;
      fetching = true;
      try {
      const data = await getAllVitamins();
      if (cancelled || ordering.current) return;
      const error = getLastFetchError();
      if (error) { setFetchError(error); return; }
      const unique = [...new Set(data.map((product) => product.category))];
      const hasRecommendation = Boolean(recommendedCombo);
      setVitamins(data);
      setCategories(hasRecommendation ? ['추천', ...unique] : unique);
      const nextCategories = hasRecommendation ? ['추천', ...unique] : unique;
      setActiveCategory(previous => !initial && nextCategories.includes(previous) ? previous : hasRecommendation ? '추천' : data.find(product=>product.dispenser_slot)?.category || unique[0] || null);
      setCart(previous => previous.flatMap(item => {
        const product=data.find(p=>p.id===item.product.id);
        return product?.dispenser_slot && product.stock>0 ? [{product,qty:Math.min(item.qty,product.stock)}] : [];
      }));
      setFetchError(!data.length ? '표시할 상품이 없습니다.' : null);
      initial = false;
      } catch { if (!cancelled) setFetchError('재고 조회에 실패했습니다. 연결을 확인해주세요.'); }
      finally { fetching=false; if (!cancelled) setLoading(false); }
    };
    refreshInventory.current=refresh;
    refresh();
    const interval=setInterval(refresh,15000);
    const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',onVisible);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',onVisible); };
  }, [recommendedCombo]);

  // Cart helpers
  const addToCart = (product) => {
    if (ordering.current || showPayment || safetyExclusions[product.id] || !product.dispenser_slot) return;
    setCart((prev) => {
      if(prev.reduce((sum,item)=>sum+item.qty,0)>=5)return prev;
      const existing = prev.find((p) => p.product.id === product.id);
      if (existing) {
        if (existing.qty >= Math.min(product.stock ?? 100, 5)) return prev;
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
    if (ordering.current || showPayment) return;
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const changeCartQty = (productId, delta) => {
    if (ordering.current || showPayment) return;
    setCart((prev) =>
      delta>0 && prev.reduce((sum,item)=>sum+item.qty,0)>=5 ? prev : prev
        .map((item) =>
          item.product.id === productId ? { ...item, qty: Math.min(5, item.product.stock ?? 100, Math.max(1, item.qty + delta)) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };


  const openPayment = () => {
    if (ordering.current || showPayment) return;
    if (cart.length === 0) {
      setOrderMessage({ type: 'error', text: '장바구니에 제품을 담아주세요.' });
      return;
    }
    setOrderMessage(null);
    handlePay();
  };

  const handlePay = async () => {
    if (ordering.current) return { ok: false, message: '주문 처리 중입니다.' };
    ordering.current = true;
    setDispenseResult(null);
    setShowPayment(true);
    setIsOrdering(true);
    onOrderingChange(true);
    try {
      const result = await placeOrder(cart, recommendedCombo?.qrProfile?.id || null);
      setDispenseResult(result);
      if (result.ok) {
        setCart([]);
      }
      return result;
    } catch {
      const result = { ok: false, requiresReview:true, message: '배출 결과를 확인하지 못했습니다. 이전 요청 확인이 필요합니다.' };
      setDispenseResult(result);
      return result;
    } finally {
      ordering.current = false; setIsOrdering(false); onOrderingChange(false);
      refreshInventory.current();
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
          <button
            type="button"
            key={category}
            className={`tab ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category === '비타민 B-Complex' ? '비타민 B군' : category === '루테인/제아잔틴' ? '루테인' : category}
          </button>
        ))}
      </div>

      {/* 제품 영역 */}
      <div className="purchase-content">
      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          {activeCategory === '추천' && recommendedCombo && (
            <div className="recommend-info-panel">
              <h3>관련 영양제 · 추천 가능 {(recommendedCombo.items || []).length}개 상품</h3>
              <p className="recommend-brief">{recommendedCombo.guidance || '식사 보완 후보입니다. 이용 전 주의사항을 확인해주세요.'}</p>
              {!recommendedCombo.items?.length && <p role="status">현재 정보로 자동 추천할 상품이 없습니다. 관련 후보는 참고용이며 추천·배출이 제한됩니다.</p>}

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
                {product.stock != null && product.stock <= 10 && (
                  <div className="card-stock">재고 {product.stock}개</div>
                )}
                <button
                  className="card-button"
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0 || Boolean(safetyExclusions[product.id]) || !product.dispenser_slot}
                >
                  {product.stock === 0 ? '품절' : safetyExclusions[product.id] ? '선택 불가' : !product.dispenser_slot ? '준비 중' : '장바구니 담기'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      </div>

      {/* 장바구니 영역 */}
      <div className="bottom-section">
        <div className="cart-list">
          {cart.length === 0 ? (
            <div className="empty-cart">장바구니에 담긴 제품이 없습니다.</div>
          ) : (
            cart.slice(visibleCartPage * 2, visibleCartPage * 2 + 2).map((item) => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.product.name}</div>

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

        {cartPageCount > 1 && (
          <div className="cart-pager" aria-label="장바구니 페이지">
            <button type="button" aria-label="장바구니 이전 상품" disabled={visibleCartPage === 0}
              onClick={() => setCartPage(visibleCartPage - 1)}>▲</button>
            <span aria-live="polite">{visibleCartPage + 1} / {cartPageCount}</span>
            <button type="button" aria-label="장바구니 다음 상품" disabled={visibleCartPage === cartPageCount - 1}
              onClick={() => setCartPage(visibleCartPage + 1)}>▼</button>
          </div>
        )}
        <div className="cart-summary">
          <div className="cart-total-label">선택 수량</div>
          <div className="cart-total-amount">{cart.reduce((sum,item)=>sum+item.qty,0)}개</div>
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
          구매하기
        </button>
      </div>

      <DispenseModal
        open={showPayment}
        onClose={handlePaymentClose}
        result={dispenseResult}
        onComplete={onOrderComplete}
      />
    </div>
  );
}
