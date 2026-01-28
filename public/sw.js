// Service Worker for SCI CENTER
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: '알림', body: '새로운 메시지가 도착했습니다.' };

    const options = {
        body: data.body,
        icon: '/icon-512.png',
        badge: '/icon-512.png',
        data: {
            url: data.url || '/'
        },
        vibrate: [100, 50, 100]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
