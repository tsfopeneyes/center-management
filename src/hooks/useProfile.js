import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { userApi } from '../api/userApi';
import { compressImage } from '../utils/imageUtils';

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

            // Helper to get local YYYY-MM-DD
            const getLocalDateKey = (dateStr) => {
                const d = new Date(dateStr);
                const offset = d.getTimezoneOffset() * 60000;
                const local = new Date(d.getTime() - offset);
                return local.toISOString().split('T')[0];
            };

            // 1. Visit Count (Unique Days)
            const uniqueDaysSet = new Set(
                logs
                    ?.filter(l => l.type === 'CHECKIN' || l.type === 'MOVE')
                    .map(l => getLocalDateKey(l.created_at)) || []
            );
            const sortedDates = Array.from(uniqueDaysSet).sort();
            setVisitCount(uniqueDaysSet.size);

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

            // 4. Special Stats (Birthday, Locations, Streak)
            let isBirthdayVisited = false;
            let visitedLocations = new Set();
            let maxConsecutiveDays = 0;

            // Fetch total locations for dynamic threshold
            const { count: totalLocationsCount } = await supabase
                .from('locations')
                .select('*', { count: 'exact', head: true });

            if (uniqueDaysSet.size > 0) {
                // Birthday check
                if (user?.birth) {
                    const birthMMDD = user.birth.substring(2, 6); // YYMMDD -> MMDD
                    isBirthdayVisited = sortedDates.some(d => {
                        const [year, month, day] = d.split('-');
                        return (month + day) === birthMMDD;
                    });
                }

                // Unique Locations (include MOVE and CHECKIN)
                logs?.filter(l => l.type === 'CHECKIN' || l.type === 'MOVE').forEach(l => {
                    if (l.location_id) visitedLocations.add(l.location_id);
                });

                // Streak (Consecutive Days)
                if (sortedDates.length > 0) {
                    let currentStreak = 1;
                    for (let i = 1; i < sortedDates.length; i++) {
                        const prev = new Date(sortedDates[i - 1]);
                        const curr = new Date(sortedDates[i]);
                        const diffTime = Math.abs(curr - prev);
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays === 1) {
                            currentStreak++;
                        } else {
                            maxConsecutiveDays = Math.max(maxConsecutiveDays, currentStreak);
                            currentStreak = 1;
                        }
                    }
                    maxConsecutiveDays = Math.max(maxConsecutiveDays, currentStreak);
                }
            }

            return {
                attendedPrograms: responses?.map(r => r.notices?.title).filter(Boolean) || [],
                specialStats: {
                    isBirthdayVisited,
                    uniqueLocationsCount: visitedLocations.size,
                    totalLocationsCount: totalLocationsCount || 0,
                    maxConsecutiveDays
                }
            };

        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

    const updateProfile = async (updates, profileImage) => {
        setLoading(true);
        try {
            let imageUrl = user.profile_image_url;

            if (profileImage) {
                // Apply automatic compression before upload
                const compressedFile = await compressImage(profileImage);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `profile_${user.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('notice-images')
                    .upload(fileName, compressedFile);

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
