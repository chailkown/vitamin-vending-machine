import { supabase, isSupabaseConfigured } from '../config/supabase';

/**
 * @param {Array<{ product: object, qty: number }>} cart
 * @param {{ recommendationNote?: string, paymentMethod?: string }} options
 */
export const placeOrder = async (cart, options = {}) => {
  if (!cart?.length) {
    return { ok: false, message: '장바구니에 제품을 담아주세요.' };
  }

  const items = cart.map(({ product, qty }) => ({
    vitamin_id: product.id,
    quantity: qty,
  }));

  const totalAmount = cart.reduce((s, it) => s + it.product.price * it.qty, 0);
  const totalQty = cart.reduce((s, it) => s + it.qty, 0);

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: true,
      offline: true,
      orderId: null,
      totalAmount,
      totalQty,
      message: '주문이 완료되었습니다.',
    };
  }

  const rpcArgs = {
    items,
    p_recommendation_note: options.recommendationNote || null,
    p_payment_method: options.paymentMethod || 'card',
  };

  let { data: orderId, error } = await supabase.rpc('place_order', rpcArgs);

  if (error?.message?.includes('Could not find')) {
    ({ data: orderId, error } = await supabase.rpc('place_order', {
      items: rpcArgs.items,
      p_recommendation_note: rpcArgs.p_recommendation_note,
    }));
  }

  if (error) {
    const msg = error.message || '주문 처리에 실패했습니다.';
    if (msg.includes('재고')) {
      return { ok: false, message: msg, code: 'OUT_OF_STOCK' };
    }
    if (msg.includes('place_order') || error.code === 'PGRST202') {
      return {
        ok: false,
        message: '주문 처리에 실패했습니다.',
        code: 'RPC_MISSING',
      };
    }
    return { ok: false, message: msg };
  }

  return {
    ok: true,
    offline: false,
    orderId,
    totalAmount,
    totalQty,
    paymentMethod: options.paymentMethod || 'card',
    message: '주문이 완료되었습니다.',
  };
};
