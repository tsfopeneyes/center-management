import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from './supabaseClient';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app;
let messaging;

// Ensure this only runs in the browser
if (typeof window !== 'undefined') {
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Firebase initialization error", error);
  }
}

export const requestFirebaseToken = async (userId) => {
    if (!messaging) return null;
    try {
        const currentPermission = Notification.permission;
        if (currentPermission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;
        }

        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error("VITE_FIREBASE_VAPID_KEY is missing in .env");
            return null;
        }

        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
            console.log("FCM Token retrieved.");
            // Store or update the token in the database
            const { error } = await supabase.from('users').update({ fcm_token: token }).eq('id', userId);
            if (error) {
                console.error("Failed to save FCM token to Supabase:", error);
            }
            return token;
        } else {
            console.warn("No registration token available. Request permission to generate one.");
            return null;
        }
    } catch (error) {
        console.error("An error occurred while retrieving token. ", error);
        return null;
    }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (messaging) {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    }
  });

export { app, messaging };
