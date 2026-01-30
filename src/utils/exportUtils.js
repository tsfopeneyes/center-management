import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Export user data to Excel
 * @param {Array} users - User list
 * @param {Array} logs - All logs (to calculate visit counts or status)
 */
export const exportUsersToExcel = (users, logs) => {
    // Prepare data
    const exportData = users.map(user => {
        // Simple visit count calculation
        const visitCount = logs.filter(l => l.user_id === user.id && l.type === 'CHECKIN').length;

        return {
            '이름': user.name,
            '휴대폰번호': user.phone || user.phone_back4 || '-',
            '소속/그룹': user.user_group || '-',
            '가입일': user.created_at ? format(new Date(user.created_at), 'yyyy-MM-dd') : '-',
            '총 방문 횟수': visitCount
        };
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "회원목록");

    // Download
    const fileName = `회원명단_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};

/**
 * Export logs data to Excel
 * @param {Array} logs - Raw logs
 * @param {Array} users - User list for mapping
 * @param {Array} locations - Location list for mapping
 */
export const exportLogsToExcel = (logs, users, locations, notices) => {
    // Prepare data
    const exportData = [...logs].reverse().map(log => {
        const user = users.find(u => u.id === log.user_id);
        const location = locations.find(l => l.id === log.location_id);

        // Handle new ID:Title format
        let prgTitleResolved = '';
        if (log.location_id?.includes(':')) {
            prgTitleResolved = log.location_id.split(':').slice(1).join(':');
        } else {
            const notice = notices?.find(n => n.id === log.location_id);
            prgTitleResolved = notice ? notice.title : '삭제된 프로그램';
        }

        let typeLabel = '';
        switch (log.type) {
            case 'CHECKIN': typeLabel = '입실'; break;
            case 'CHECKOUT': typeLabel = '퇴실'; break;
            case 'MOVE': typeLabel = '이동'; break;
            case 'PRG_ATTENDED': typeLabel = '프로그램 완료(참석)'; break;
            case 'PRG_ABSENT': typeLabel = '프로그램 완료(미참석)'; break;
            case 'PRG_CANCELLED': typeLabel = '프로그램 취소'; break;
            default: typeLabel = log.type;
        }

        const isProgramType = log.type.startsWith('PRG_');

        return {
            '시간': format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '이름': user ? user.name : '알 수 없음',
            '소속': user ? user.user_group : '-',
            '종류': typeLabel,
            '위치/프로그램': isProgramType ? prgTitleResolved : (location ? location.name : '-')
        };
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "로그기록");

    // Download
    const fileName = `시스템로그_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};

/**
 * Export program participants to Excel
 * @param {Object} notice - The notice/program object
 * @param {Object} list - Participant list { JOIN: [], ... }
 */
export const exportParticipantsToExcel = (notice, list) => {
    if (!list.JOIN || list.JOIN.length === 0) {
        alert('참여 신청 인원이 없습니다.');
        return;
    }

    const exportData = list.JOIN.map((user, idx) => ({
        '순번': idx + 1,
        '이름': user.name,
        '소속': user.school || '-',
        '전화번호(뒤4자리)': user.phone_back4 || '-',
        '출석여부': user.is_attended ? '참석' : '미참석'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "참여자명단");

    // Add info row at the top or adjust Column widths
    const fileName = `[명단]_${notice.title}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};
