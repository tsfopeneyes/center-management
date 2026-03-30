const fs = require('fs');
const backupPath = 'd:/coding/ENTER/src/pages/StudentDashboard.backup.jsx';
const lines = fs.readFileSync(backupPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

const orchestratorContent = `import React from 'react';
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
import StudentGalleryTab from '../components/student/StudentGalleryTab';
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
        loading, user, activeTab,
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
        notices, responses, handleResponse, filteredNotices, galleryNotices, filteredPrograms,
        homeNotices, homePrograms, homeGallery, studentRegion, locationGroups, activeUserCountByGroup,
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

${getLines(1029, 1141)}
        </div>
    );
};

export default StudentDashboard;
`;

fs.writeFileSync('d:/coding/ENTER/src/pages/StudentDashboard.jsx', orchestratorContent);
console.log('Reassembled StudentDashboard.jsx');
