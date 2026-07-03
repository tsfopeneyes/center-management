import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { messagesApi } from '../api/messagesApi';

export const useMessaging = (userId) => {
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchMessages = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await messagesApi.fetchInbox(userId);
            setMessages(data || []);

            const count = data ? data.filter(m => {
                if (m.is_read || !m.sender) return false;
                const lastRead = localStorage.getItem(`last_read_${m.sender.id}`);
                if (lastRead && new Date(m.created_at) <= new Date(lastRead)) {
                    return false;
                }
                return true;
            }).length : 0;

            setUnreadCount(count);
        } catch (err) {
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const markAsRead = async (msgId) => {
        try {
            await messagesApi.markAsRead(msgId);
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true } : m));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking message as read:', err);
        }
    };

    useEffect(() => {
        if (!userId) return;

        fetchMessages();

        const subscription = supabase
            .channel(`user_messages_${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${userId}`
            }, () => {
                fetchMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [userId, fetchMessages]);

    return {
        messages,
        unreadCount,
        loading,
        fetchMessages,
        markAsRead
    };
};
