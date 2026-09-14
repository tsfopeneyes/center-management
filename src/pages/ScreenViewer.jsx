import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { DEFAULT_SCREEN_CONFIG, getActiveScreenConfig, loadScreenConfig, SCREEN_CONFIG_TITLE } from '../utils/screenConfig';

const CACHE_KEY = 'screen_display_config_v1';

export default function ScreenViewer() {
    const [config, setConfig] = useState(() => {
        try { return getActiveScreenConfig(JSON.parse(localStorage.getItem(CACHE_KEY)) || DEFAULT_SCREEN_CONFIG); }
        catch { return getActiveScreenConfig(DEFAULT_SCREEN_CONFIG); }
    });
    const [index, setIndex] = useState(0);

    const refresh = useCallback(async () => {
        try {
            const stored = await loadScreenConfig();
            const next = getActiveScreenConfig(stored);
            setConfig(next);
            localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
        } catch (error) {
            console.warn('전자칠판 설정을 불러오지 못했습니다.', error);
        }
    }, []);

    useEffect(() => {
        refresh();
        let hasSubscribed = false;
        const channel = supabase.channel('screen-display-config')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notices', filter: `title=eq.${SCREEN_CONFIG_TITLE}` }, refresh)
            .subscribe(status => {
                if (status !== 'SUBSCRIBED') return;
                if (hasSubscribed) refresh();
                hasSubscribed = true;
            });
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') refresh();
        }, 60000);
        const reconnect = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        window.addEventListener('online', reconnect);
        document.addEventListener('visibilitychange', reconnect);
        return () => { clearInterval(timer); window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', reconnect); supabase.removeChannel(channel); };
    }, [refresh]);

    useEffect(() => { setIndex(current => config.images.length ? current % config.images.length : 0); }, [config.images.length]);
    useEffect(() => {
        if (config.images.length < 2) return undefined;
        const timer = setInterval(() => setIndex(current => (current + 1) % config.images.length), config.intervalSeconds * 1000);
        return () => clearInterval(timer);
    }, [config.images.length, config.intervalSeconds]);

    useEffect(() => {
        config.images.forEach(item => { const image = new Image(); image.src = item.url; });
    }, [config.images]);

    return (
        <main className="fixed inset-0 overflow-hidden bg-black">
            {config.images.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white/30">SCI CENTER</div>
            ) : config.images.map((item, itemIndex) => (
                <img key={item.id} src={item.url} alt="" draggable="false"
                    className={`absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-700 ${itemIndex === index ? 'opacity-100' : 'opacity-0'}`} />
            ))}
        </main>
    );
}
