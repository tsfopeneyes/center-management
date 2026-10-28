// Standards-based receiver for Firebase-issued web push subscriptions.
// Keeping delivery independent of the Firebase worker runtime preserves
// compatibility with Samsung Internet and installed Samsung web apps.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const receiptEndpoint = 'https://erecqalsxoxrufggvmcc.supabase.co/functions/v1/push-receipts';
const reportReceipt = (receiptToken, receiptEvent) => {
  if (!receiptToken) return Promise.resolve();
  return fetch(receiptEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptToken, event: receiptEvent }),
  }).catch(() => undefined);
};

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || payload.title || 'SCI CENTER';
  const body = notification.body || data.body || payload.body || '새로운 알림이 도착했습니다.';
  const url = data.url || payload.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: notification.icon || '/icon-512.png',
      badge: '/icon-512.png',
      tag: notification.tag || data.tag || undefined,
      data: { ...data, url },
      vibrate: [100, 50, 100],
    }).then(() => reportReceipt(data.receiptToken, 'DISPLAYED'))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || '/', self.location.origin);
  // Also mark notifications delivered before senders included this parameter.
  // Only a notification click adds it; ordinary community navigation is untouched.
  if (target.origin === self.location.origin && /^\/community\/[^/]+\/?$/.test(target.pathname)) {
    target.searchParams.set('from', 'push');
  }
  const targetUrl = target.href;
  const openTarget = async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windowClients.find((client) => 'focus' in client && 'navigate' in client);
    if (existing) {
      try {
        const navigated = await existing.navigate(targetUrl);
        if (navigated) return navigated.focus();
      } catch (_) {
        // A closing or suspended window can reject navigation. Open the target anew.
      }
    }
    return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
  };
  event.waitUntil(Promise.all([
    reportReceipt(event.notification?.data?.receiptToken, 'CLICKED'),
    openTarget(),
  ]));
});
