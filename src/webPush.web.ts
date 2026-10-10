import { supabase } from './client';
function supported() { return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function isIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function standalone() { return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone; }
function decodeKey(key: string) {
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '='));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function worker() {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Notification setup timed out. Reload and try again.')), 15000))]);
}
async function save(subscription: PushSubscription) {
  if (!supabase) throw new Error('Annan Pro is not configured.');
  const { error } = await supabase.rpc('register_web_push', { p_subscription: subscription.toJSON() });
  if (error) throw error;
  return subscription.endpoint;
}
export async function enableWebPush(): Promise<string> {
  if (isIos() && !standalone()) throw new Error('On iPhone: open this site in Safari, tap Share → Add to Home Screen. Open Annan Pro from that icon, then enable notifications.');
  if (!supported()) throw new Error('Use an updated browser over HTTPS. iPhone requires iOS 16.4 or later and a Home Screen installation.');
  const key = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('The administrator has not configured notifications yet.');
  // Request immediately inside the button gesture, as required by iOS.
  if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked. Allow them in your device settings.');
  const registration = await worker();
  let subscription = await registration.pushManager.getSubscription();
  const serverKey = decodeKey(key);
  const oldKey = subscription?.options.applicationServerKey;
  if (subscription && oldKey && String(new Uint8Array(oldKey)) !== String(serverKey)) { await subscription.unsubscribe(); subscription = null; }
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  return save(subscription);
}
export async function restoreWebPush(): Promise<boolean> {
  if (!supported() || (isIos() && !standalone())) return false;
  const registration = await worker();
  if (Notification.permission !== 'granted') return false;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await save(subscription);
  return true;
}
export async function unregisterWebPush(): Promise<void> {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await supabase!.rpc('unregister_push', { p_token: subscription.endpoint });
  if (error) throw new Error('Could not disconnect notifications. Reconnect and try signing out again.');
  await subscription.unsubscribe();
}
