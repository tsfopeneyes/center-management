import { useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

export const useDashboardNotifications = (user) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);

    const fetchNotifications = useCallback(async (currentUser) => {
        if (!currentUser) return;
        try {
            const groups = ['전체', currentUser.user_group, `USER_${currentUser.id}`];
            if (currentUser.role === 'admin' || currentUser.user_group === 'STAFF') groups.push('STAFF');

            const { data: notifs, error: notifErr } = await supabase
                .from('app_notifications')
                .select('*')
                .in('target_group', groups)
                .order('created_at', { ascending: false });

            if (notifErr) throw notifErr;

            const { data: reads, error: readErr } = await supabase
                .from('user_notification_reads')
                .select('notification_id')
                .eq('user_id', currentUser.id);

            if (readErr) throw readErr;

            const readNotifIds = new Set(reads.map(r => r.notification_id));
            const unreadCount = (notifs || []).filter(n => !readNotifIds.has(n.id)).length;

            setNotifications(notifs || []);
            setUnreadNotificationCount(unreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, []);

    const markNotificationsAsRead = useCallback(async () => {
        if (!user || unreadNotificationCount === 0) return;
        try {
            const { data: reads } = await supabase
                .from('user_notification_reads')
                .select('notification_id')
                .eq('user_id', user.id);
            const readNotifIds = new Set((reads || []).map(r => r.notification_id));

            const unreadNotifs = notifications.filter(n => !readNotifIds.has(n.id));
            if (unreadNotifs.length === 0) return;

            const inserts = unreadNotifs.map(n => ({
                user_id: user.id,
                notification_id: n.id
            }));

            await supabase.from('user_notification_reads').insert(inserts);
            setUnreadNotificationCount(0);
        } catch (err) {
            console.error('Error marking notifications read:', err);
        }
    }, [user, unreadNotificationCount, notifications]);

    return {
        notifications,
        unreadNotificationCount,
        showNotificationsModal,
        setShowNotificationsModal,
        fetchNotifications,
        markNotificationsAsRead
    };
};
