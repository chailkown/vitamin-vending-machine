const PENDING_KEY = 'vitamin-kiosk-pending-order';
let inFlight = false;

// Only the optional account ID links receipts; health information stays on the kiosk.
export const placeOrder = async (cart, historyUserId = null) => {
  if (inFlight) return {ok:false, code:'ORDER_BUSY', message:'이미 배출 중입니다.'};
  if (!Array.isArray(cart) || !cart.length || cart.some((item) => !Number.isSafeInteger(item?.product?.id) || item.product.id < 1 || !Number.isInteger(item.qty) || item.qty < 1) || cart.reduce((n,it)=>n+it.qty,0)>5) {
    return {ok:false, code:'INVALID_CART', message:'한 번에 1~5개를 선택해주세요.'};
  }
  const token = document.querySelector('meta[name="kiosk-token"]')?.content;
  if (!token) return {ok:false, code:'GATEWAY_UNAVAILABLE', message:'라즈베리파이 배출 서버로 키오스크를 열어주세요.'};
  inFlight = true;
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 90000);
  const post = async (path, body) => {
    const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json','X-Kiosk-Token':token}, signal:controller.signal, body:JSON.stringify(body)});
    if (!response.ok) throw new Error('Gateway HTTP error');
    return response.json();
  };
  try {
    const storage = window.localStorage;
    const pending = storage.getItem(PENDING_KEY);
    if (pending) {
      const reference = JSON.parse(pending);
      const status = await post('/api/reconcile', {requestId:reference.requestId});
      if (status.known === true && status.requiresReview === false) {
        storage.removeItem(PENDING_KEY);
        return {ok:false, code:'RECOVERED', message:'이전 요청 확인을 마쳤습니다. 현재 선택을 확인한 뒤 다시 구매해주세요.'};
      }
      return {ok:false, code:'RECOVERY_REQUIRED', requiresReview:true, message:'이전 배출 결과를 관리자가 확인해야 합니다.'};
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes); bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    const requestId=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
    storage.setItem(PENDING_KEY, JSON.stringify({requestId}));
    const body = {requestId, items:cart.map(({product,qty})=>({vitamin_id:product.id,quantity:qty}))};
    if (typeof historyUserId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(historyUserId)) body.historyUserId=historyUserId;
    const result = await post('/api/order', body);
    if (typeof result?.ok !== 'boolean' || typeof result.requiresReview !== 'boolean') throw new Error('Invalid gateway result');
    if (!result.requiresReview) storage.removeItem(PENDING_KEY);
    return result;
  } catch {
    return {ok:false, code:'RECOVERY_REQUIRED', requiresReview:true, message:'배출 결과를 확인하지 못했습니다. 다시 구매를 누르면 이전 요청부터 확인하며 자동 재배출하지 않습니다.'};
  } finally { inFlight=false; clearTimeout(timeout); }
};
