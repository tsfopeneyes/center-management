import { useState } from 'react';
import { isAdminOrStaff } from '../../../../utils/userUtils';

export const useAdminStatus = ({ users, locations, locationGroups = [], zoneStats, currentLocations, dailyVisitStats, allLogs = [] }) => {
    const [locationTab, setLocationTab] = useState('ALL');
    const [zoneDetailModal, setZoneDetailModal] = useState({ isOpen: false, locationId: null, locationName: '', activeUsers: [] });

    const isPast10PM = new Date().getHours() >= 22;
    const adminIdsSet = new Set(users.filter(isAdminOrStaff).map(u => u.id));
    
    // Only count locations that are active and belong to an active group
    const activeLocations = locations.filter(loc => {
        if (loc.is_active === false) return false;
        const group = locationGroups.find(g => g.id === loc.group_id);
        if (group && group.is_active === false) return false;
        return true;
    });
    
    // Calculate total non-staff active members
    const activeUserCount = Object.keys(currentLocations).filter(uid => {
        const locId = currentLocations[uid]?.locId;
        if (!locId || adminIdsSet.has(uid)) return false;
        return activeLocations.some(l => l.id === locId);
    }).length;

    // Filter Locations
    const getFilteredLocations = () => {
        if (locationTab === 'ALL') return activeLocations;

        const hyphenGroup = locationGroups.find(g => g && g.name && (g.name.includes('하이픈') || g.name.includes('HYPHEN')));
        const enofGroup = locationGroups.find(g => g && g.name && (g.name.includes('이높플레이스') || g.name.includes('ENOF') || g.name.includes('이높')));

        if (locationTab === 'HYPHEN') {
            return activeLocations.filter(loc => {
                const matchesGroup = hyphenGroup && loc.group_id === hyphenGroup.id;
                const matchesFallbackName = 
                    loc.name.includes('라운지') ||
                    loc.name.includes('워크숍') ||
                    loc.name.includes('회의실') ||
                    loc.name.includes('멤버십') ||
                    loc.name.includes('맴버십') ||
                    loc.name.includes('고백') ||
                    loc.name.includes('하이픈');
                return matchesGroup || matchesFallbackName;
            });
        }
        if (locationTab === 'ENOF') {
            return activeLocations.filter(loc => {
                const matchesGroup = enofGroup && loc.group_id === enofGroup.id;
                const matchesFallbackName = loc.name.includes('이높');
                return matchesGroup || matchesFallbackName;
            });
        }
        return activeLocations;
    };
    const filteredLocations = getFilteredLocations();

    const totalActive = filteredLocations.reduce((sum, loc) => sum + (zoneStats[loc.id] || 0), 0);

    const activeUsersList = users.filter(u => {
        if (isAdminOrStaff(u)) return false;
        const locId = currentLocations[u.id]?.locId;
        if (!locId) return false;
        return filteredLocations.some(l => l.id === locId);
    }).map(u => ({
        ...u,
        currentLocationName: locations.find(l => l.id === currentLocations[u.id]?.locId)?.name || 'Unknown',
        checkInTime: currentLocations[u.id]?.checkInTime
    })).sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));

    const handleZoneClick = (location) => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayLocationLogs = allLogs.filter(log => {
            const isToday = new Date(log.created_at) >= todayStart;
            const isTargetLocation = log.location_id === location.id;
            const isNotAdmin = !adminIdsSet.has(log.user_id);
            return isToday && isTargetLocation && isNotAdmin;
        });

        const visitedUserIds = Array.from(new Set(
            todayLocationLogs
                .filter(log => log.type === 'CHECKIN' || log.type === 'MOVE')
                .map(log => log.user_id)
        ));

        const activeUserIds = Object.keys(currentLocations).filter(uid =>
            currentLocations[uid]?.locId === location.id && !adminIdsSet.has(uid)
        );

        const combinedUserIds = Array.from(new Set([...activeUserIds, ...visitedUserIds]));

        const mappedUsers = combinedUserIds.map(uid => {
            const user = users.find(u => u.id === uid);
            if (!user) return null;

            const isActive = currentLocations[uid]?.locId === location.id;
            const firstLogAtLoc = todayLocationLogs
                .filter(log => log.user_id === uid && (log.type === 'CHECKIN' || log.type === 'MOVE'))
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

            const checkInTime = firstLogAtLoc ? firstLogAtLoc.created_at : (currentLocations[uid]?.checkInTime || null);

            return {
                ...user,
                isActive,
                checkInTime
            };
        }).filter(Boolean)
        .sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return new Date(b.checkInTime) - new Date(a.checkInTime);
        });

        setZoneDetailModal({
            isOpen: true,
            locationId: location.id,
            locationName: location.name,
            activeUsers: mappedUsers
        });
    };

    return {
        locationTab, setLocationTab,
        zoneDetailModal, setZoneDetailModal,
        isPast10PM,
        adminIdsSet,
        activeUserCount,
        filteredLocations,
        totalActive,
        activeUsersList,
        handleZoneClick
    };
};
