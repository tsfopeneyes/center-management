import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

export const useRealtimePresence = () => {
    const [locationGroups, setLocationGroups] = useState([]);
    const [locations, setLocations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [activeUserCountByGroup, setActiveUserCountByGroup] = useState({});

    const fetchRealtimeStatusData = useCallback(async () => {
        try {
            const [usersRes, locRes, groupRes, logsRes] = await Promise.all([
                supabase.from('users').select('id, name, user_group, role'),
                supabase.from('locations').select('id, group_id'),
                supabase.from('location_groups').select('id, name'),
                supabase.from('logs').select('user_id, location_id, type').order('created_at', { ascending: false }).limit(3000)
            ]);

            const fetchedUsers = usersRes.data || [];
            const fetchedLocations = locRes.data || [];
            const fetchedGroups = groupRes.data || [];
            const fetchedLogs = logsRes.data ? [...logsRes.data].reverse() : [];

            setAllUsers(fetchedUsers);
            setLocations(fetchedLocations);
            setLocationGroups(fetchedGroups);

            const adminIdsSet = new Set(fetchedUsers.filter(u =>
                u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
            ).map(u => u.id));

            const userCurrentLocation = {};
            fetchedLogs.forEach(log => {
                if (log.type === 'CHECKIN' || log.type === 'MOVE') userCurrentLocation[log.user_id] = log.location_id;
                else if (log.type === 'CHECKOUT') userCurrentLocation[log.user_id] = null;
            });

            const groupCounts = {};
            fetchedGroups.forEach(g => { groupCounts[g.id] = 0; });
            groupCounts['unassigned'] = 0;

            Object.entries(userCurrentLocation).forEach(([uid, locId]) => {
                if (locId && !adminIdsSet.has(uid)) {
                    const loc = fetchedLocations.find(l => l.id === locId);
                    if (loc && loc.group_id) {
                        if (groupCounts[loc.group_id] !== undefined) {
                            groupCounts[loc.group_id]++;
                        }
                    } else if (loc) {
                        groupCounts['unassigned']++;
                    }
                }
            });

            setActiveUserCountByGroup(groupCounts);
        } catch (err) {
            console.error('Error fetching realtime status:', err);
        }
    }, []);

    useEffect(() => {
        fetchRealtimeStatusData();

        let debounceTimer;
        const debouncedFetchStatus = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchRealtimeStatusData();
            }, 1000);
        };

        const subscription = supabase
            .channel('public:logs_student_dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, debouncedFetchStatus)
            .subscribe();

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(subscription);
        };
    }, [fetchRealtimeStatusData]);

    return {
        locationGroups,
        locations,
        allUsers,
        activeUserCountByGroup,
        fetchRealtimeStatusData
    };
};
