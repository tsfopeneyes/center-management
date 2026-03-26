import { useState } from 'react';
import { isAdminOrStaff } from '../../../../utils/userUtils';

export const useAdminStatus = ({ users, locations, zoneStats, currentLocations, dailyVisitStats }) => {
    const [locationTab, setLocationTab] = useState('ALL');
    const [zoneDetailModal, setZoneDetailModal] = useState({ isOpen: false, locationId: null, locationName: '', activeUsers: [] });

    const isPast10PM = new Date().getHours() >= 22;
    const adminIdsSet = new Set(users.filter(isAdminOrStaff).map(u => u.id));
    
    // Calculate total non-staff active members
    const activeUserCount = Object.keys(currentLocations).filter(uid =>
        currentLocations[uid] && !adminIdsSet.has(uid)
    ).length;

    // Filter Locations
    const getFilteredLocations = () => {
        if (locationTab === 'ALL') return locations;
        if (locationTab === 'HYPHEN') {
            return locations.filter(loc =>
                loc.name.includes('라운지') ||
                loc.name.includes('워크숍') ||
                loc.name.includes('회의실') ||
                loc.name.includes('멤버십') ||
                loc.name.includes('맴버십') ||
                loc.name.includes('고백')
            );
        }
        if (locationTab === 'ENOF') {
            return locations.filter(loc => loc.name.includes('이높'));
        }
        return locations;
    };
    const filteredLocations = getFilteredLocations();

    const totalActive = filteredLocations.reduce((sum, loc) => sum + (zoneStats[loc.id] || 0), 0);

    const activeUsersList = users.filter(u => {
        if (isAdminOrStaff(u)) return false;
        const locId = currentLocations[u.id];
        if (!locId) return false;
        return filteredLocations.some(l => l.id === locId);
    }).map(u => ({
        ...u,
        currentLocationName: locations.find(l => l.id === currentLocations[u.id])?.name || 'Unknown'
    }));

    const handleZoneClick = (location) => {
        const activeUserIds = Object.keys(currentLocations).filter(uid =>
            currentLocations[uid] === location.id && !adminIdsSet.has(uid)
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
