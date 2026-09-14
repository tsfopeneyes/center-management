import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateCurrentLocations, countActiveUsersByGroup, mergeRealtimeVisitLog } from '../../utils/liveOccupancyUtils';
import { isAdminOrStaff } from '../../utils/userUtils';
import { userApi } from '../../api/userApi';

export const useRealtimePresence = () => {
    const [locationGroups, setLocationGroups] = useState([]);
    const [locations, setLocations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [activeUserCountByGroup, setActiveUserCountByGroup] = useState({});
    const usersRef = useRef([]);
    const locationsRef = useRef([]);
    const groupsRef = useRef([]);
    const logsRef = useRef([]);
    const requestRef = useRef(null);

    const updateCounts = useCallback((logs = logsRef.current) => {
        setActiveUserCountByGroup(countActiveUsersByGroup({
            currentLocations: calculateCurrentLocations(logs),
            users: usersRef.current,
            locations: locationsRef.current,
            groups: groupsRef.current,
            isStaff: isAdminOrStaff,
        }));
    }, []);

    const fetchRealtimeStatusData = useCallback(async () => {
        if (requestRef.current) return requestRef.current;
        requestRef.current = (async () => {
          try {
            const [usersRes, locRes, groupRes, logsRes] = await Promise.all([
                supabase.from('users').select('id, name, user_group, role'),
                supabase.from('locations').select('id, group_id, name, is_active'),
                supabase.from('location_groups').select('id, name'),
                supabase.from('logs').select('id, user_id, location_id, type, created_at').order('created_at', { ascending: false }).limit(3000)
            ]);

            const fetchedUsers = await userApi.attachAccountRoles(usersRes.data || []);
            const fetchedLocations = (locRes.data || []).filter(l => l.is_active !== false);
            const fetchedGroups = groupRes.data || [];
            const fetchedLogs = logsRes.data || [];

            const activeGroups = fetchedGroups.filter(g =>
                fetchedLocations.some(l => l.group_id === g.id)
            );

            setAllUsers(fetchedUsers);
            setLocations(fetchedLocations);
            setLocationGroups(activeGroups);
            usersRef.current = fetchedUsers;
            locationsRef.current = fetchedLocations;
            groupsRef.current = fetchedGroups;
            logsRef.current = fetchedLogs;
            updateCounts(fetchedLogs);
          } catch (err) {
            console.error('Error fetching realtime status:', err);
          } finally {
            requestRef.current = null;
          }
        })();
        return requestRef.current;
    }, [updateCounts]);

    useEffect(() => {
        fetchRealtimeStatusData();

        let hasSubscribed = false;

        const subscription = supabase
            .channel('public:logs_student_dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, payload => {
                const merged = mergeRealtimeVisitLog(logsRef.current, payload);
                if (!merged) {
                    fetchRealtimeStatusData();
                    return;
                }
                logsRef.current = merged;
                updateCounts(merged);
            })
            .subscribe(status => {
                if (status !== 'SUBSCRIBED') return;
                if (hasSubscribed) fetchRealtimeStatusData();
                hasSubscribed = true;
            });

        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') fetchRealtimeStatusData();
        };
        window.addEventListener('online', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.removeEventListener('online', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            supabase.removeChannel(subscription);
        };
    }, [fetchRealtimeStatusData, updateCounts]);

    return {
        locationGroups,
        locations,
        allUsers,
        activeUserCountByGroup,
        fetchRealtimeStatusData
    };
};
