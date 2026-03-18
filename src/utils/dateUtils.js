import { startOfWeek, endOfWeek, differenceInDays } from 'date-fns';

export const formatToLocalISO = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().substring(0, 16);
};

export const getKSTDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
};

export const getWeekIdentifier = (date) => {
    const d = new Date(date);
    const year = String(d.getFullYear()).slice(2);
    const month = String(d.getMonth() + 1).padStart(2, '0');

    const weekNum = getKSTWeekOfMonth(d);

    return `${year}${month}_W${weekNum}`;
};

export const calculateAge = (birthDate) => {
    if (!birthDate || birthDate.length !== 6) return '';

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // YYMMDD parsing
    const yy = parseInt(birthDate.substring(0, 2), 10);
    const mm = parseInt(birthDate.substring(2, 4), 10);
    const dd = parseInt(birthDate.substring(4, 6), 10);

    // Dynamic century: if year is 00-30, assume 20xx (2000-2030). Else 19xx.
    // Adjust threshold as needed. 30 seems safe for now.
    const year = (yy <= 30) ? 2000 + yy : 1900 + yy;

    let age = currentYear - year;

    // Year Age (연나이) calculation: simply current year - birth year
    // No month/day adjustment needed as requested by user for grade grouping.

    return age;
};

/**
 * Standard Korean Week of Month calculation.
 * Rule: The first week of the month is the one containing the first Thursday.
 * Weeks start on Monday.
 */
export const getKSTWeekOfMonth = (date) => {
    const d = new Date(date);

    // Find the Thursday of this week
    const day = d.getDay();
    const diffToThursday = (day === 0 ? -3 : 4 - day);
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);

    const month = thursday.getMonth();
    const year = thursday.getFullYear();

    // Find the first Thursday of that month
    const firstOfMonth = new Date(year, month, 1);
    const firstDay = firstOfMonth.getDay();
    const diffToFirstThursday = (firstDay <= 4 ? 4 - firstDay : 11 - firstDay);
    const firstThursday = new Date(year, month, 1 + diffToFirstThursday);

    // Week number = (thursday - firstThursday) / 7 + 1
    const weeks = Math.round((thursday - firstThursday) / (7 * 24 * 60 * 60 * 1000)) + 1;

    return weeks;
};

export const parseTimeRange = (timeRangeStr) => {
    if (!timeRangeStr) return { start: '', end: '', durationStr: '', durationMin: 0 };

    // Format: "HH:mm ~ HH:mm"
    const parts = timeRangeStr.split('~').map(s => s.trim());
    if (parts.length !== 2) return { start: timeRangeStr, end: '', durationStr: '', durationMin: 0 };

    const start = parts[0];
    const end = parts[1];

    const startTime = new Date(`2000-01-01T${start}:00`);
    const endTime = new Date(`2000-01-01T${end}:00`);

    let diffMs = endTime - startTime;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Handle overnight

    const diffMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    const durationStr = `${hours}:${String(mins).padStart(2, '0')}:00`; // As per excel screenshot "2:00:00"

    return { start, end, durationStr, durationMin: diffMin };
};

export const formatDateRelative = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return '방금';
    if (diffMin < 60) return `${diffMin}분`;
    if (diffHour < 24) return `${diffHour}시간`;
    if (diffDay < 7) return `${diffDay}일`;

    // if older than 7 days, just show date
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
};
