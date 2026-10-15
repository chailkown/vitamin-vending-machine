export const IDLE_TIMEOUT_MS = 60_000;
const SESSION_KEYS = ['vitamin-kiosk-qr', 'vitamin-kiosk-user', 'vitamin-kiosk-cart', 'vitamin-kiosk-recommendation'];
export const clearKioskSession = (storage) => { SESSION_KEYS.forEach((key) => storage.removeItem(key)); };
export const watchKioskIdle = (target, onIdle, timeout = IDLE_TIMEOUT_MS, clock = globalThis) => {
  let timer;
  const activity = () => { clock.clearTimeout(timer); timer = clock.setTimeout(onIdle, timeout); };
  const events = ['click', 'touchstart', 'keydown', 'input'];
  events.forEach((event) => target.addEventListener(event, activity));
  activity();
  return () => { clock.clearTimeout(timer); events.forEach((event) => target.removeEventListener(event, activity)); };
};
