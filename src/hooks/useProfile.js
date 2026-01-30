import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { userApi } from '../api/userApi';

export const useProfile = (initialUser) => {
    const [user, setUser] = useState(initialUser);
    const [totalHours, setTotalHours] = useState(0);
    const [visitCount, setVisitCount] = useState(0);
    const [programCount, setProgramCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchStats = useCallback(async (userId) => {
        if (!userId) return;
        try {
            const logs = await userApi.fetchLogs(userId);

            // 1. Visit Count (Unique Days)
            const checkinDates = logs
                ?.filter(l => l.type === 'CHECKIN')
                .map(l => new Date(l.created_at).toLocaleDateString()) || [];
            const uniqueDays = new Set(checkinDates);
            setVisitCount(uniqueDays.size);

            // 2. Total Hours
            let totalMs = 0;
            let lastCheckInTime = null;
            logs?.forEach(log => {
                const time = new Date(log.created_at).getTime();
                if (log.type === 'CHECKIN') lastCheckInTime = time;
                else if ((log.type === 'CHECKOUT' || log.type === 'MOVE') && lastCheckInTime) {
                    totalMs += (time - lastCheckInTime);
                    lastCheckInTime = log.type === 'MOVE' ? time : null;
                }
            });
            setTotalHours((totalMs / (1000 * 60 * 60)).toFixed(1));

            // 3. Program Count & History
            const { data: responses } = await supabase
                .from('notice_responses')
                .select('notices(title)')
                .eq('user_id', userId)
                .eq('is_attended', true);

            setProgramCount(responses?.length || 0);
            return { attendedPrograms: responses?.map(r => r.notices?.title).filter(Boolean) || [] };

        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

    const updateProfile = async (updates, profileImage) => {
        setLoading(true);
        try {
            let imageUrl = user.profile_image_url;

            if (profileImage) {
                const fileExt = profileImage.name.split('.').pop();
                const fileName = `profile_${user.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('notice-images')
                    .upload(fileName, profileImage);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('notice-images')
                    .getPublicUrl(fileName);

                imageUrl = publicUrl;
            }

            const finalUpdates = { ...updates, profile_image_url: imageUrl };
            await userApi.updateProfile(user.id, finalUpdates);

            const updatedUser = { ...user, ...finalUpdates };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return { success: true, user: updatedUser };
        } catch (err) {
            console.error('Error updating profile:', err);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    return {
        user,
        setUser,
        totalHours,
        visitCount,
        programCount,
        loading,
        fetchStats,
        updateProfile
    };
};
