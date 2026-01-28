import { supabase } from '../supabaseClient';

// Key should ideally be in env, but for local testing we use a placeholder or provided public key.
// To use real web-push, we need VAPID keys.
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';

export const subscribeToPush = async (userId) => {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;

        // Request Permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return;
        }

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Subscribe - we need a real public key here for this to work in production
            // For now, this is the structural implementation
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // Save to Supabase
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                subscription_data: subscription,
                updated_at: new Date()
            }, { onConflict: 'user_id' });

        if (error) throw error;
        console.log('Push subscription saved successfully');

    } catch (err) {
        console.error('Push Subscription Error:', err);
    }
};

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
