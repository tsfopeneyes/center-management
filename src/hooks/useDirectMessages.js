import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { dmApi } from '../api/dmApi';
import { haifnManagementApi } from '../api/haifnManagementApi';

export const useDirectMessages = userId => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [haifnPendingCount, setHaifnPendingCount] = useState(0);

    const refresh = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try { setConversations(await dmApi.fetchConversations(userId)); }
        catch (error) {
            if (!['42P01', 'PGRST205'].includes(error?.code)) console.error('DM 목록을 불러오지 못했습니다.', error);
            setConversations([]);
        } finally { setLoading(false); }
    }, [userId]);

    useEffect(() => {
        if (!userId) return undefined;
        refresh();
        const channel = supabase.channel(`dm-inbox:${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_participant_memberships' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_conversations' }, refresh)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, refresh]);

    useEffect(() => {
        if (!userId) { setHaifnPendingCount(0); return undefined; }
        let active = true;
        let timer;
        const start = async () => {
            try {
                if (!await haifnManagementApi.isOperator(userId) || !active) return;
                const poll = async () => {
                    try {
                        const count = await haifnManagementApi.pendingCount(userId);
                        if (active) setHaifnPendingCount(count);
                    } catch { if (active) setHaifnPendingCount(0); }
                };
                await poll();
                timer = window.setInterval(poll, 15000);
            } catch { if (active) setHaifnPendingCount(0); }
        };
        void start();
        return () => { active = false; window.clearInterval(timer); };
    }, [userId]);

    return {
        conversations,
        unreadCount: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0) + haifnPendingCount,
        haifnPendingCount,
        loading,
        refresh,
    };
};
