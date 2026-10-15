import { supabase, isSupabaseConfigured } from '../config/supabase';
import { dispenseOrder, isDispenserConfigured } from './dispenserService';
import { isProductEnabled } from '../data/productPolicy';

const PENDING_KEY = 'vitamin-kiosk-pending-order';
let inFlight = false;
const pendingStorage = () => typeof window === 'undefined' ? null : window.sessionStorage;
const fail = (message, code, requiresReview = false) => ({ ok: false, message, code, requiresReview });

// One DB transaction reserves stock. Only an acknowledged dispense can finalize completion.
// Never fall back to the legacy RPC: it marks an order completed before dispensing.
export const placeOrder = async (cart, options = {}) => {
  if (inFlight) return fail('이미 주문을 처리하고 있습니다.', 'ORDER_BUSY');
  if (!Array.isArray(cart) || !cart.length || cart.some(({ product, qty }) => !Number.isSafeInteger(product?.id) || product.id < 1 || !Number.isInteger(qty) || qty < 1 || qty > 100)) {
    return fail('장바구니 상품과 수량을 확인해주세요.', 'INVALID_CART');
  }
  if (!isSupabaseConfigured || !supabase) return fail('DB 연결이 없어 주문할 수 없습니다.', 'DB_UNAVAILABLE');
  if (cart.some(({product}) => !isProductEnabled(product))) return fail('판매 중지된 상품이 포함되어 있습니다.', 'PRODUCT_DISABLED');
  if (!isDispenserConfigured()) return fail('배출 장치 연결이 설정되지 않았습니다.', 'DISPENSER_UNAVAILABLE');
  if (pendingStorage()?.getItem(PENDING_KEY)) return fail('이전 주문의 결과 확인이 필요합니다. 관리자에게 문의해주세요.', 'RECOVERY_REQUIRED', true);
  const requestId = options.requestId || crypto.randomUUID();
  inFlight = true;
  try {
    // Persist only the opaque recovery reference, never user health data or history.
    pendingStorage()?.setItem(PENDING_KEY, JSON.stringify({ requestId }));
    const { data: order, error } = await supabase.rpc('place_kiosk_order', {
      items: cart.map(({ product, qty }) => ({ vitamin_id: product.id, quantity: qty })),
      p_request_id: requestId, p_user_id: options.userId || null,
      p_recommendation_note: options.recommendationNote || null, p_payment_method: options.paymentMethod || 'card',
    });
    if (error) {
      // HTTP transport errors cannot prove that a server transaction did not commit.
      const uncertain = !error.code || /fetch|network|timeout/i.test(error.message || '');
      if (!uncertain) pendingStorage()?.removeItem(PENDING_KEY);
      return fail(error.code === 'PGRST202' ? '주문 SQL 업데이트가 필요합니다.' : error.message || '주문 저장 실패', 'DB_ERROR', uncertain);
    }
    if (!order?.order_id || !Array.isArray(order.items)) return fail('주문 응답을 확인할 수 없습니다. 관리자에게 문의해주세요.', 'RECOVERY_REQUIRED', true);
    if (order.status !== 'dispensing') return fail('이미 처리된 주문입니다. 관리자에게 문의해주세요.', 'RECOVERY_REQUIRED', true);
    const dispense = await dispenseOrder(order);
    const outcome = dispense.ok ? 'completed' : dispense.safeToRestore ? 'failed' : 'review_required';
    const { data: receipt, error: finalizeError } = await supabase.rpc('finish_kiosk_order', {
      p_order_id: order.order_id, p_request_id: requestId, p_result: outcome, p_simulated: Boolean(dispense.simulated),
    });
    if (finalizeError || receipt?.status !== outcome) return fail('주문 결과 저장에 실패했습니다. 재주문하지 말고 관리자에게 문의해주세요.', 'RECOVERY_REQUIRED', true);
    if (outcome !== 'review_required') pendingStorage()?.removeItem(PENDING_KEY);
    if (!dispense.ok) return fail(dispense.message, 'DISPENSE_FAILED', !dispense.safeToRestore);
    return { ok: true, orderId: receipt.order_id, totalAmount: receipt.total_amount, totalQty: receipt.total_qty,
      paymentMethod: receipt.payment_method, simulated: Boolean(dispense.simulated), message: '주문이 완료되었습니다.' };
  } catch {
    return fail('주문 결과를 확인할 수 없습니다. 재주문하지 말고 관리자에게 문의해주세요.', 'RECOVERY_REQUIRED', true);
  } finally { inFlight = false; }
};
