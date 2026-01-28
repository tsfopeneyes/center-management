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
            '휴대폰번호': user.phone || '-',
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
export const exportLogsToExcel = (logs, users, locations) => {
    // Prepare data
    const exportData = [...logs].reverse().map(log => {
        const user = users.find(u => u.id === log.user_id);
        const location = locations.find(l => l.id === log.location_id);

        let typeLabel = '';
        switch (log.type) {
            case 'CHECKIN': typeLabel = '입실'; break;
            case 'CHECKOUT': typeLabel = '퇴실'; break;
            case 'MOVE': typeLabel = '이동'; break;
            default: typeLabel = log.type;
        }

        return {
            '시간': format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '이름': user ? user.name : '알 수 없음',
            '소속': user ? user.user_group : '-',
            '구분': typeLabel,
            '위치': location ? location.name : '-'
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
