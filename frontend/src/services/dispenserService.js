const simulation = process.env.NODE_ENV === 'development' && process.env.REACT_APP_DISPENSE_MODE === 'simulation';
const endpoint = process.env.REACT_APP_DISPENSER_URL?.trim() || '';
export const isDispenserConfigured = () => simulation || Boolean(endpoint);

// The Pi API owns slot -> Arduino pin/runtime mapping and must deduplicate orderId.
// Without a sensor, accepted means all Arduino commands were acknowledged, NOT sensed delivery.
export const dispenseOrder = async (order) => {
  if (simulation) return { ok: true, simulated: true };
  if (!endpoint) return { ok: false, safeToRestore: true, message: '배출 API가 설정되지 않았습니다.' };
  if (!order.items?.length || order.items.some((item) => !Number.isInteger(item.dispenser_slot))) {
    return { ok: false, safeToRestore: true, message: '상품 배출 슬롯을 설정해주세요.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ orderId: order.order_id, items: order.items.map((item) => ({ slot: item.dispenser_slot, quantity: item.quantity })) }),
    });
    const result = await response.json();
    if (response.ok && result.accepted === true) return { ok: true };
    return { ok: false, safeToRestore: result.notStarted === true, message: result.message || '배출 명령 처리에 실패했습니다.' };
  } catch {
    // A timeout may occur AFTER a motor ran. Never restore stock or re-dispense automatically.
    return { ok: false, safeToRestore: false, message: '배출 결과를 확인할 수 없습니다. 관리자에게 문의해주세요.' };
  } finally { clearTimeout(timeout); }
};
