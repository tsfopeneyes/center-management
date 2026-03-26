import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Home, Calendar, BookOpen, Award } from 'lucide-react';
import { TAB_NAMES } from '../constants/appConstants';
import { useStudentDashboard } from '../hooks/useStudentDashboard';

// Tabs
import StudentHomeTab from '../components/student/StudentHomeTab';
import StudentChallengesTab from '../components/student/StudentChallengesTab';
import StudentProgramsTab from '../components/student/StudentProgramsTab';
import StudentNoticesTab from '../components/student/StudentNoticesTab';
import StudentGuestbookTab from '../components/student/StudentGuestbookTab';
import StudentCalendarTab from '../components/student/StudentCalendarTab';
import CommunityTab from '../components/community/CommunityTab';
import StudentChat from '../components/student/StudentChat';

// Extracted Modals
import NoticeModal from '../components/student/NoticeModal';
import { BadgeModal } from '../components/student/BadgeComponents';
import ProfileSettingsModal from '../components/student/modals/ProfileSettingsModal';
import GuestbookWriteModal from '../components/student/modals/GuestbookWriteModal';
import GuestbookDetailModal from '../components/student/modals/GuestbookDetailModal';
import NotificationsModal from '../components/student/modals/NotificationsModal';
import ProgramHistoryModal from '../components/student/modals/ProgramHistoryModal';
import QRModal from '../components/student/modals/QRModal';

const StudentDashboard = () => {
    const hookData = useStudentDashboard();
    
    // Destructure everything used in the JSX
    const {
        loading, user, activeTab, setActiveTab,
        showProfileSettings, setShowProfileSettings,
        showGuestWrite, setShowGuestWrite,
        selectedGuestPost, setSelectedGuestPost,
        showProgramHistory, setShowProgramHistory,
        showEnlargedQr, setShowEnlargedQr,
        showNotificationsModal, setShowNotificationsModal,
        selectedBadge, setSelectedBadge,
        selectedNotice, setSelectedNotice, noticeContext, setNoticeContext,
        comments, newComment, setNewComment, handlePostComment, handleDeleteComment,
        handleShare, handleTabChange, openNoticeDetail, markNotificationsAsRead,
        notices, responses, handleResponse, filteredNotices, filteredPrograms,
        homeNotices, homePrograms, studentRegion, locationGroups, activeUserCountByGroup,
        totalHours, visitCount, programCount, attendedProgramsList,
        challengeCategories, dynamicChallenges, specialStats,
        adminSchedules, calendarCategories, dashboardConfig,
        notifications, unreadNotificationCount, updateProfile, profileLoadingState,
        guestPosts, uploadingGuest, handleCreatePost, fetchGuestCommentsData, handleGuestCommentSubmit, handleDeleteGuestPost, handleDeleteGuestComment
    } = hookData;

    const navigate = useNavigate();

    if (loading || !user) {
        return (
            <div className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold animate-pulse">정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 pb-20 font-sans">
            <div className="p-4 pt-4"></div>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {selectedNotice && (
                    <NoticeModal
                        key={selectedNotice.id}
                        notice={selectedNotice}
                        context={noticeContext}
                        onClose={() => { setSelectedNotice(null); setNoticeContext(null); }}
                        user={user}
                        responses={responses}
                        onResponse={handleResponse}
                        comments={comments}
                        newComment={newComment}
                        setNewComment={setNewComment}
                        onPostComment={handlePostComment}
                        onDeleteComment={handleDeleteComment}
                    />
                )}

                {selectedBadge && (
                    <BadgeModal
                        badge={selectedBadge}
                        stats={{ visitCount, programCount, specialStats }}
                        onClose={() => setSelectedBadge(null)}
                    />
                )}

                {showProfileSettings && (
                    <ProfileSettingsModal 
                        user={user}
                        setShowProfileSettings={setShowProfileSettings}
                        updateProfile={updateProfile}
                        profileLoadingState={profileLoadingState}
                    />
                )}

                {showGuestWrite && (
                    <GuestbookWriteModal 
                        setShowGuestWrite={setShowGuestWrite}
                        handleCreatePost={handleCreatePost}
                        uploadingGuest={uploadingGuest}
                    />
                )}

                {selectedGuestPost && (
                    <GuestbookDetailModal 
                        selectedGuestPost={selectedGuestPost}
                        guestComments={hookData.guestComments || []}
                        fetchGuestCommentsData={fetchGuestCommentsData}
                        user={user}
                        onDeleteGuestPost={handleDeleteGuestPost}
                        onDeleteGuestComment={handleDeleteGuestComment}
                        handleGuestCommentSubmit={handleGuestCommentSubmit}
                        setGuestComments={() => {}} 
                        setSelectedGuestPost={setSelectedGuestPost}
                    />
                )}

                {showEnlargedQr && (
                    <QRModal 
                        user={user} 
                        setShowEnlargedQr={setShowEnlargedQr} 
                    />
                )}

                {showNotificationsModal && (
                    <NotificationsModal 
                        notifications={notifications}
                        setShowNotificationsModal={setShowNotificationsModal}
                        markNotificationsAsRead={markNotificationsAsRead}
                    />
                )}

                {showProgramHistory && (
                    <ProgramHistoryModal 
                        attendedProgramsList={attendedProgramsList}
                        setShowProgramHistory={setShowProgramHistory}
                    />
                )}
            </AnimatePresence>

            {activeTab === TAB_NAMES.HOME && (
                <StudentHomeTab
                    user={user}
                    unreadNotificationCount={unreadNotificationCount}
                    setShowProfileSettings={setShowProfileSettings}
                    setShowNotificationsModal={setShowNotificationsModal}
                    handleShare={handleShare}
                    setShowEnlargedQr={setShowEnlargedQr}
                    navigate={navigate}
                    adminSchedules={adminSchedules}
                    calendarCategories={calendarCategories}
                    dashboardConfig={dashboardConfig}
                    totalHours={totalHours}
                    visitCount={visitCount}
                    programCount={programCount}
                    setShowProgramHistory={setShowProgramHistory}
                    handleTabChange={handleTabChange}
                    homePrograms={homePrograms}
                    responses={responses}
                    openNoticeDetail={openNoticeDetail}
                    homeNotices={homeNotices}
                    locationGroups={locationGroups}
                    activeUserCountByGroup={activeUserCountByGroup}
                />
            )}

            {activeTab === TAB_NAMES.CHALLENGES && (
                <StudentChallengesTab
                    dynamicChallenges={dynamicChallenges}
                    challengeCategories={challengeCategories}
                    visitCount={visitCount}
                    programCount={programCount}
                    specialStats={specialStats}
                    setSelectedBadge={setSelectedBadge}
                />
            )}

            {activeTab === TAB_NAMES.PROGRAMS && (
                <StudentProgramsTab
                    filteredPrograms={filteredPrograms}
                    responses={responses}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.NOTICES && (
                <StudentNoticesTab
                    filteredNotices={filteredNotices}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.MESSAGES && (
                <StudentChat currentUser={user} onRefreshUnread={() => { }} />
            )}

            {activeTab === TAB_NAMES.GUESTBOOK && (
                <StudentGuestbookTab
                    guestPosts={guestPosts}
                    openGuestPostDetail={openGuestPostDetail}
                    setShowGuestWrite={setShowGuestWrite}
                />
            )}

            {activeTab === TAB_NAMES.CALENDAR && (
                <StudentCalendarTab
                    adminSchedules={adminSchedules}
                    notices={notices}
                    calendarCategories={calendarCategories}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.COMMUNITY && (
                <CommunityTab user={user} />
            )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white/95 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-4 py-3 z-[120] safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-[2.5rem]">
                {[
                    { id: TAB_NAMES.HOME, icon: Home, label: '홈' },
                    { id: TAB_NAMES.CALENDAR, icon: Calendar, label: '캘린더' },
                    { id: TAB_NAMES.PROGRAMS, icon: BookOpen, label: '프로그램', activeColor: 'text-blue-600' },
                    { id: TAB_NAMES.CHALLENGES, icon: Award, label: '챌린지' },
                ].map((tab) => (
                    <motion.button
                        key={tab.id}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleTabChange(tab.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 flex-1 relative btn-tactile ${activeTab === tab.id ? (tab.activeColor || 'text-gray-900') : 'text-gray-300'}`}
                    >
                        <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        <span className={`text-[10px] font-black tracking-tight ${activeTab === tab.id ? (tab.activeColor || 'text-gray-900') : 'text-gray-400'}`}>
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabPill"
                                className={`absolute -top-1 w-1.5 h-1.5 rounded-full ${tab.activeColor ? 'bg-blue-600' : 'bg-gray-900'}`}
                            />
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

export default StudentDashboard;
