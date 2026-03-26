import React from 'react';
import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';
import AnalyticsFilter from './admin/statistics/analytics/components/AnalyticsFilter';
import AnalyticsKPICards from './admin/statistics/analytics/components/AnalyticsKPICards';
import SpaceAnalyticsView from './admin/statistics/analytics/views/SpaceAnalyticsView';
import ProgramAnalyticsView from './admin/statistics/analytics/views/ProgramAnalyticsView';
import UserAnalyticsView from './admin/statistics/analytics/views/UserAnalyticsView';
import MemberActivityModal from './admin/statistics/analytics/modals/MemberActivityModal';
import RoomMemberDetailModal from './admin/statistics/analytics/modals/RoomMemberDetailModal';
import GuestVisitDetailModal from './admin/statistics/analytics/modals/GuestVisitDetailModal';
import SeucheoTimeAnalytics from './admin/statistics/analytics/SeucheoTimeAnalytics';
import ManagerAssignmentModal from './admin/statistics/analytics/ManagerAssignmentModal';

const Skeleton = () => (
    <div className="space-y-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-pulse">
            <div className="flex gap-2">
                <div className="h-8 w-16 bg-gray-100 rounded-md"></div>
                <div className="h-8 w-16 bg-gray-100 rounded-md"></div>
                <div className="h-8 w-16 bg-gray-100 rounded-md"></div>
            </div>
            <div className="flex gap-2">
                <div className="h-10 w-24 bg-gray-100 rounded-lg"></div>
                <div className="h-10 w-24 bg-gray-100 rounded-lg"></div>
                <div className="h-10 w-32 bg-gray-100 rounded-lg"></div>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg"></div>
                        <div className="h-4 w-20 bg-gray-100 rounded"></div>
                    </div>
                    <div className="h-8 w-16 bg-gray-100 rounded mb-2"></div>
                    <div className="h-3 w-24 bg-gray-50 rounded"></div>
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col justify-between">
                <div className="h-6 w-40 bg-gray-100 rounded mb-8"></div>
                <div className="flex gap-4 items-end h-full">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 bg-gray-50 rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }}></div>)}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col justify-between">
                <div className="h-6 w-40 bg-gray-100 rounded mb-8"></div>
                <div className="flex gap-4 items-end h-full">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 bg-gray-50 rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }}></div>)}
                </div>
            </div>
        </div>
    </div>
);

const AnalyticsTab = ({ logs, schoolLogs, locations, locationGroups = [], users, notices, responses, isLoading, fetchData }) => {
    const hookData = useAnalytics({ logs, schoolLogs, locations, locationGroups, users, notices, responses });
    const { 
        selectedYear, selectedMonth, selectedDay, periodType, viewMode, 
        showGuestModal, setShowGuestModal, seucheoRegion, isManagerModalOpen, setIsManagerModalOpen, 
        selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails 
    } = hookData;

    if (isLoading) return <Skeleton />;

    return (
        <div className="space-y-6">
            <AnalyticsFilter hookData={hookData} />
            
            {viewMode !== 'SEUCHEO' && <AnalyticsKPICards hookData={hookData} users={users} />}

            {viewMode === 'SPACE' && <SpaceAnalyticsView hookData={hookData} />}
            {viewMode === 'PROGRAM' && <ProgramAnalyticsView hookData={hookData} />}
            {viewMode === 'SEUCHEO' && (
                <SeucheoTimeAnalytics
                    schoolLogs={schoolLogs}
                    users={users}
                    periodType={periodType}
                    selectedDate={new Date(selectedYear, selectedMonth, selectedDay)}
                    regionFilter={seucheoRegion}
                />
            )}
            {viewMode === 'USER' && <UserAnalyticsView hookData={hookData} />}

            {selectedMemberForCalendar && (
                <MemberActivityModal
                    member={selectedMemberForCalendar}
                    logs={logs}
                    year={selectedYear}
                    month={selectedMonth}
                    onClose={() => setSelectedMemberForCalendar(null)}
                />
            )}

            {selectedRoomDetails && (
                <RoomMemberDetailModal
                    room={selectedRoomDetails}
                    year={selectedYear}
                    month={selectedMonth + 1}
                    day={selectedDay}
                    periodType={periodType}
                    onClose={() => setSelectedRoomDetails(null)}
                />
            )}

            {showGuestModal && (
                <GuestVisitDetailModal
                    spaceData={hookData.spaceData}
                    year={selectedYear}
                    month={selectedMonth + 1}
                    day={selectedDay}
                    periodType={periodType}
                    onClose={() => setShowGuestModal(false)}
                />
            )}

            <ManagerAssignmentModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                selectedRegion={seucheoRegion !== 'ALL' ? seucheoRegion : null}
                users={users}
                onSave={() => {
                    if (fetchData) fetchData(true);
                }}
            />
        </div>
    );
};

export default AnalyticsTab;