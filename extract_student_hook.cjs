const fs = require('fs');
const backupPath = 'd:/coding/ENTER/src/pages/StudentDashboard.backup.jsx';
const lines = fs.readFileSync(backupPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

let imports = getLines(1, 42);
imports = imports
    .replace("import StudentChat from '../components/student/StudentChat';", '')
    .replace("import UserAvatar from '../components/common/UserAvatar';", '')
    .replace("import LinkPreview from '../components/common/LinkPreview';", '')
    .replace("import NoticeModal from '../components/student/NoticeModal';", '')
    .replace("import ProgramCard from '../components/student/ProgramCard';", '')
    .replace("import StudentHomeTab from '../components/student/StudentHomeTab';", '')
    .replace("import StudentChallengesTab from '../components/student/StudentChallengesTab';", '')
    .replace("import StudentProgramsTab from '../components/student/StudentProgramsTab';", '')
    .replace("import StudentNoticesTab from '../components/student/StudentNoticesTab';", '')
    .replace("import StudentGalleryTab from '../components/student/StudentGalleryTab';", '')
    .replace("import StudentGuestbookTab from '../components/student/StudentGuestbookTab';", '')
    .replace("import StudentCalendarTab from '../components/student/StudentCalendarTab';", '')
    .replace("import CommunityTab from '../components/community/CommunityTab';", '')
    .replace("import { getBadgeProgress, BadgeModal, BadgeItem } from '../components/student/BadgeComponents';", "import { getBadgeProgress } from '../components/student/BadgeComponents';");


const hookBody = getLines(45, 606); // Up to handleSaveProfile

const hookFooter = `
    return {
        // Core State
        loading,
        user, setUser,
        activeTab,
        
        // Modals Traps
        showProfileSettings, setShowProfileSettings,
        showGuestWrite, setShowGuestWrite,
        selectedGuestPost, setSelectedGuestPost,
        showProgramHistory, setShowProgramHistory,
        showEnlargedQr, setShowEnlargedQr,
        showNotificationsModal, setShowNotificationsModal,
        selectedBadge, setSelectedBadge,
        selectedNotice, setSelectedNotice,
        noticeContext, setNoticeContext,
        
        // Modal dependencies & handlers (passed through)
        comments, setComments,
        newComment, setNewComment,
        handlePostComment, handleDeleteComment,
        handleShare,
        handleTabChange,
        openNoticeDetail,
        markNotificationsAsRead,
        
        // Mapped Data For Tabs & Dashboard
        notices, responses, handleResponse,
        filteredNotices, galleryNotices, filteredPrograms,
        homeNotices, homePrograms, homeGallery,
        studentRegion, locationGroups, locations, allUsers, activeUserCountByGroup,
        totalHours, visitCount, programCount,
        attendedProgramsList,
        challengeCategories, dynamicChallenges, specialStats,
        adminSchedules, calendarCategories, dashboardConfig,
        notifications, unreadNotificationCount,
        updateProfile, profileLoadingState,
        
        // Guestbook Hooks
        guestPosts, uploadingGuest, handleCreatePost,
        fetchGuestCommentsData, handleGuestCommentSubmit, handleDeleteGuestPost, handleDeleteGuestComment
    };
};
`;

const fileContent = imports + '\\n' + 'export const useStudentDashboard = () => {' + '\\n' + hookBody + '\\n' + hookFooter;

fs.writeFileSync('d:/coding/ENTER/src/hooks/useStudentDashboard.jsx', fileContent);
console.log('Created useStudentDashboard.jsx');
