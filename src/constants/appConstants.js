export const CATEGORIES = {
    NOTICE: 'NOTICE',
    PROGRAM: 'PROGRAM',
    GALLERY: 'GALLERY',
    ADMIN_SCHEDULE: 'ADMIN_SCHEDULE',
    SYSTEM: 'SYSTEM'
};

export const PROGRAM_TYPES = {
    CENTER: 'CENTER',
    SCHOOL_CHURCH: 'SCHOOL_CHURCH'
};

export const SCHOOL_REGIONS = ['강동', '강서'];

export const CLUB_TYPES = {
    AUTONOMOUS: '자율동아리',
    REGULAR: '정규동아리',
    UNOFFICIAL: '비공식모임'
};

export const CALENDAR_CATEGORIES = {
    PROGRAM: { label: '프로그램', color: 'bg-pink-100 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
    MEETING: { label: '회의', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    VACATION: { label: '연차/휴가', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
    RENTAL: { label: '대관', color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
    FOUNDATION: { label: '재단 일정', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    OTHERS: { label: '기타', color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-500' }
};

export const USER_GROUPS = {
    STUDENT: 'STUDENT',
    STAFF: 'STAFF',
    ADMIN: 'ADMIN'
};

export const RESPONSE_STATUS = {
    JOIN: 'JOIN',
    DECLINE: 'DECLINE',
    WAITLIST: 'WAITLIST',
    UNDECIDED: 'UNDECIDED'
};

export const TAB_NAMES = {
    HOME: 'home',
    CHALLENGES: 'challenges',
    PROGRAMS: 'programs',
    NOTICES: 'notices',
    GALLERY: 'gallery',
    MESSAGES: 'messages',
    GUESTBOOK: 'guestbook',
    CALENDAR: 'calendar'
};

export const COLOR_THEMES = {
    PRIMARY: 'blue',
    SECONDARY: 'indigo',
    ACCENT: 'pink',
    SUCCESS: 'green',
    WARNING: 'orange',
    DANGER: 'red'
};

export const BADGE_DEFINITIONS = [
    // VISIT BADGES
    { id: 'visit_1', type: 'VISIT', min: 1, label: '첫 만남', icon: '🌱', image: '/badges/visit_1.png', color: 'bg-green-100 text-green-600' },
    { id: 'visit_10', type: 'VISIT', min: 10, label: '단골 손님', icon: '⭐', image: '/badges/visit_10.png', color: 'bg-blue-100 text-blue-600' },
    { id: 'visit_30', type: 'VISIT', min: 30, label: '공간의 주인', icon: '🏠', image: '/badges/visit_30.png', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'visit_50', type: 'VISIT', min: 50, label: '센터의 친구', icon: '🤝', image: '/badges/visit_50.png', color: 'bg-purple-100 text-purple-600' },
    { id: 'visit_80', type: 'VISIT', min: 80, label: '우수 멤버', icon: '🏅', image: '/badges/visit_80.png', color: 'bg-pink-100 text-pink-600' },
    { id: 'visit_100', type: 'VISIT', min: 100, label: '센터의 자랑', icon: '🏆', image: '/badges/visit_100.png', color: 'bg-yellow-100 text-yellow-600' },

    // PROGRAM BADGES
    { id: 'program_1', type: 'PROGRAM', min: 1, label: '첫 참여', icon: '🐣', image: '/badges/program_1.png', color: 'bg-green-100 text-green-600' },
    { id: 'program_5', type: 'PROGRAM', min: 5, label: '성장하는 중', icon: '🚀', image: '/badges/program_5.png', color: 'bg-cyan-100 text-cyan-600' },
    { id: 'program_10', type: 'PROGRAM', min: 10, label: '열정 학생', icon: '🔥', image: '/badges/program_10.png', color: 'bg-orange-100 text-orange-600' },
    { id: 'program_20', type: 'PROGRAM', min: 20, label: '프로그램 매니아', icon: '💎', image: '/badges/program_20.png', color: 'bg-blue-100 text-blue-600' },
    { id: 'program_30', type: 'PROGRAM', min: 30, label: '마스터', icon: '👑', image: '/badges/program_30.png', color: 'bg-yellow-400 text-white' },
];
