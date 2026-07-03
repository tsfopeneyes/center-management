import React from 'react';
import useAdminUsers from './hooks/useAdminUsers';

// Components
import UserFilters from './components/UserFilters';
import UserTable from './components/UserTable';
import BulkActionsOverlay from './components/BulkActionsOverlay';

// Modals
import UserEditModal from './modals/UserEditModal';
import UserMergeModal from './modals/UserMergeModal';
import NotificationModal from './modals/NotificationModal';
import ImageOverlayModal from './modals/ImageOverlayModal';

const AdminUsers = ({ users, allLogs, locations, fetchData }) => {
    const hookData = useAdminUsers({ users, allLogs, locations, fetchData });
    
    const {
        searchTerm, setSearchTerm,
        filterGroup, setFilterGroup,
        excludeLeaders, setExcludeLeaders,
        showOnlyNonSchoolChurch, setShowOnlyNonSchoolChurch,
        selectedUserIds, setSelectedUserIds,
        bulkTargetGroup, setBulkTargetGroup,
        sendingBulk,
        editingUser, setEditingUser,
        isMergeModalOpen, setIsMergeModalOpen,
        notificationModalOpen, setNotificationModalOpen,
        viewerImage, setViewerImage,
        filteredUsers,
        getUserStats,
        toggleSelectAll,
        toggleSelectUser,
        handleBulkUpdateGroup,
        handleDeleteUser,
        handleResetPassword,
        handleApproveUser,
        handleToggleAdminRole
    } = hookData;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <UserFilters
                users={users} allLogs={allLogs}
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                filterGroup={filterGroup} setFilterGroup={setFilterGroup}
                excludeLeaders={excludeLeaders} setExcludeLeaders={setExcludeLeaders}
                showOnlyNonSchoolChurch={showOnlyNonSchoolChurch} setShowOnlyNonSchoolChurch={setShowOnlyNonSchoolChurch}
                filteredUsers={filteredUsers}
                setNotificationModalOpen={setNotificationModalOpen}
                fetchData={fetchData}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <UserTable
                    filteredUsers={filteredUsers}
                    selectedUserIds={selectedUserIds}
                    toggleSelectAll={toggleSelectAll}
                    toggleSelectUser={toggleSelectUser}
                    handleApproveUser={handleApproveUser}
                    setEditingUser={setEditingUser}
                />
            </div>

            <BulkActionsOverlay
                selectedUserIds={selectedUserIds}
                setSelectedUserIds={setSelectedUserIds}
                bulkTargetGroup={bulkTargetGroup}
                setBulkTargetGroup={setBulkTargetGroup}
                handleBulkUpdateGroup={handleBulkUpdateGroup}
                sendingBulk={sendingBulk}
            />

            {/* Modals */}
            <UserEditModal
                editingUser={editingUser}
                setEditingUser={setEditingUser}
                handleDeleteUser={handleDeleteUser}
                handleResetPassword={handleResetPassword}
                handleToggleAdminRole={handleToggleAdminRole}
                userStats={editingUser ? getUserStats(editingUser.id) : null}
                fetchData={fetchData}
                setIsMergeModalOpen={setIsMergeModalOpen}
                setViewerImage={setViewerImage}
            />

            <UserMergeModal
                isMergeModalOpen={isMergeModalOpen}
                setIsMergeModalOpen={setIsMergeModalOpen}
                editingUser={editingUser}
                setEditingUser={setEditingUser}
                users={users}
                fetchData={fetchData}
            />

            <NotificationModal
                notificationModalOpen={notificationModalOpen}
                setNotificationModalOpen={setNotificationModalOpen}
            />

            <ImageOverlayModal
                viewerImage={viewerImage}
                setViewerImage={setViewerImage}
            />
        </div>
    );
};

export default AdminUsers;
