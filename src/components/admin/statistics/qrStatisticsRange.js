import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export function getQrStatisticsRange(year, month, day, period) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const date = new Date(year, month, Math.min(Math.max(day, 1), lastDay));
    switch (period) {
        case 'DAILY': return { start: date, end: date };
        case 'WEEKLY': return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
        case 'YEARLY': return { start: startOfYear(date), end: endOfYear(date) };
        default: return { start: startOfMonth(date), end: endOfMonth(date) };
    }
}
