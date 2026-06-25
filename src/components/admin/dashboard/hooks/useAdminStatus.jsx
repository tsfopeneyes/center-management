import { useState } from 'react';
import { isAdminOrStaff } from '../../../../utils/userUtils';

export const useAdminStatus = ({ users, locations, locationGroups = [], zoneStats, currentLocations, dailyVisitStats }) => {
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
        const activeUserIds = Object.keys(currentLocations).filter(uid =>
            currentLocations[uid]?.locId === location.id && !adminIdsSet.has(uid)
        );
        const activeUsers = users.filter(u => activeUserIds.includes(u.id));

        setZoneDetailModal({
            isOpen: true,
            locationId: location.id,
            locationName: location.name,
            activeUsers: activeUsers
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
