import React from 'react';
import { useAdminStatus } from './hooks/useAdminStatus';

// Sub Components
import AdminStatusHeader from './components/AdminStatusHeader';
import ZoneCards from './components/ZoneCards';
import RealtimeActiveUsers from './components/RealtimeActiveUsers';
import ZoneDetailModal from './components/ZoneDetailModal';

const AdminStatus = ({
    users,
    locations,
    zoneStats,
    currentLocations,
    handleForceCheckout,
    handleBatchCheckout,
    fetchData,
    setActiveMenu,
    allLogs = [],
    dailyVisitStats = {}
}) => {
    const {
        locationTab, setLocationTab,
        zoneDetailModal, setZoneDetailModal,
        isPast10PM,
        adminIdsSet,
        activeUserCount,
        filteredLocations,
        totalActive,
        activeUsersList,
        handleZoneClick
    } = useAdminStatus({ users, locations, zoneStats, currentLocations, dailyVisitStats });

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <AdminStatusHeader
                activeUserCount={activeUserCount}
                isPast10PM={isPast10PM}
                currentLocations={currentLocations}
                adminIdsSet={adminIdsSet}
                handleBatchCheckout={handleBatchCheckout}
                fetchData={fetchData}
            />

            <ZoneCards
                locationTab={locationTab}
                setLocationTab={setLocationTab}
                setActiveMenu={setActiveMenu}
                totalActive={totalActive}
                filteredLocations={filteredLocations}
                zoneStats={zoneStats}
                dailyVisitStats={dailyVisitStats}
                handleZoneClick={handleZoneClick}
            />

            <RealtimeActiveUsers
                activeUsersList={activeUsersList}
                handleForceCheckout={handleForceCheckout}
            />

            <ZoneDetailModal
                zoneDetailModal={zoneDetailModal}
                setZoneDetailModal={setZoneDetailModal}
                handleForceCheckout={handleForceCheckout}
            />
        </div>
    );
};

export default AdminStatus;
