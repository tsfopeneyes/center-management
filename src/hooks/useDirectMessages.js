import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { dmApi } from '../api/dmApi';

export const useDirectMessages = userId => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(false);

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

    return {
        conversations,
        unreadCount: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
        loading,
        refresh,
    };
};
