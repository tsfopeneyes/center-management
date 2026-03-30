import { useEffect } from 'react';
import { requestFirebaseToken, onMessageListener } from '../firebase';

export const useFCM = (user) => {
    useEffect(() => {
        if (!user) return;

        // 푸쉬 알림 권한을 요청하고, 토큰을 발급받아 Supabase에 저장합니다.
        const setupFCM = async () => {
            await requestFirebaseToken(user.id);
        };

        setupFCM();

        // 포그라운드(앱 켜져있을 때) 알림 수신 리스너
        const handleForegroundMessage = async () => {
            try {
                const payload = await onMessageListener();
                console.log("Foreground push notification received:", payload);
                
                // 간단한 브라우저 자체 알림 표시 또는 토스트 UI 사용 가능
                const title = payload.notification?.title || "새 알림";
                const body = payload.notification?.body || "";
                
                // 모바일 환경에서도 보이게 자체 브라우저 alert나 커스텀 토스트로 띄울 수 있음. 
                // 원하신다면 react-hot-toast 등으로 추후 교체 가능합니다.
                if (window.Notification && Notification.permission === "granted") {
                    new Notification(title, { body, icon: '/vite.svg' });
                } else {
                    alert(`${title}\n${body}`);
                }
                
                // 수신 대기 루프 재시작
                handleForegroundMessage();
            } catch (err) {
                console.log('failed to receive message', err);
            }
        };

        handleForegroundMessage();
    }, [user]);
};
