import { getWeekIdentifier } from './dateUtils';

/**
 * Aggregates raw logs into visit sessions (CHECKIN-CHECKOUT pairs).
 * @param {Array} allLogs - Raw logs from Supabase
 * @param {Array} users - User list
 * @param {Array} locations - Location list
 * @param {string} startDate - Optional YYYY-MM-DD
 * @param {string} endDate - Optional YYYY-MM-DD
 * @returns {Array} List of visit sessions
 */
export const aggregateVisitSessions = (allLogs, users, locations, startDate = '', endDate = '') => {
    const isWithinRange = (dateStr) => {
        if (!dateStr) return true;
        const target = dateStr.includes('T') || dateStr.includes(' ')
            ? new Date(dateStr).toLocaleDateString('en-CA')
            : dateStr;
        if (startDate && target < startDate) return false;
        if (endDate && target > endDate) return false;
        return true;
    };

    const visitLogs = allLogs.filter(log => ['CHECKIN', 'CHECKOUT', 'MOVE'].includes(log.type));
    const userMap = new Map(users.map(u => [u.id, u]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    const userDateGroups = {};

    visitLogs.forEach(log => {
        const date = new Date(log.created_at).toLocaleDateString('en-CA');
        if (!isWithinRange(date)) return;

        const groupKey = `${log.user_id}_${date}`;

        if (!userDateGroups[groupKey]) {
            const user = userMap.get(log.user_id);
            const isAdmin = user && (user.name === 'admin' || user.user_group === '관리자' || user.role === 'admin');
            if (!user || isAdmin) return;

            userDateGroups[groupKey] = {
                id: groupKey,
                userId: log.user_id,
                date,
                weekId: getWeekIdentifier(log.created_at),
                dayOfWeek: new Date(log.created_at).toLocaleDateString('ko-KR', { weekday: 'short' }),
                school: user.school || '-',
                name: user.name,
                age: (() => {
                    if (user.birth && user.birth.length === 6) {
                        const yy = parseInt(user.birth.substring(0, 2));
                        const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
                        return new Date().getFullYear() - fullYear;
                    }
                    return '-';
                })(),
                rawLogs: []
            };
        }
        if (userDateGroups[groupKey]) {
            userDateGroups[groupKey].rawLogs.push(log);
        }
    });

    const aggregated = [];

    Object.values(userDateGroups).forEach(group => {
        const sortedLogs = [...group.rawLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const sessions = [];
        let currentLogs = [];
        let sessionHasCheckout = false;

        sortedLogs.forEach(log => {
            if (log.type === 'CHECKIN' && sessionHasCheckout) {
                sessions.push(currentLogs);
                currentLogs = [];
                sessionHasCheckout = false;
            }
            currentLogs.push(log);
            if (log.type === 'CHECKOUT') sessionHasCheckout = true;
        });
        if (currentLogs.length > 0) sessions.push(currentLogs);

        sessions.forEach(sessionLogs => {
            const firstCheckIn = sessionLogs.find(l => l.type === 'CHECKIN');
            const startAt = firstCheckIn ? new Date(firstCheckIn.created_at) : new Date(sessionLogs[0].created_at);

            const lastCheckOut = [...sessionLogs].reverse().find(l => l.type === 'CHECKOUT');
            const endAt = lastCheckOut ? new Date(lastCheckOut.created_at) : new Date(sessionLogs[sessionLogs.length - 1].created_at);

            const durationMs = endAt - startAt;
            const durationMin = Math.max(0, Math.floor(durationMs / 60000));

            const hours = Math.floor(durationMin / 60);
            const mins = durationMin % 60;
            const durationStr = `${hours}:${String(mins).padStart(2, '0')}:00`;

            const startTimeStr = startAt.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });

            const spaceChain = [];
            sessionLogs.forEach(l => {
                const loc = locationMap.get(l.location_id);
                const locName = loc?.name;
                if (locName && spaceChain[spaceChain.length - 1] !== locName) {
                    spaceChain.push(locName);
                }
            });

            aggregated.push({
                ...group,
                id: `${group.id}_${startAt.getTime()}`,
                rawLogs: sessionLogs, // Only include logs for this specific session
                startTime: startTimeStr,
                endTime: lastCheckOut ? endAt.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '-',
                durationStr,
                durationMin: `${durationMin}분`,
                usedSpaces: spaceChain.join('-'),
                sortTime: startAt.getTime()
            });
        });
    });

    return aggregated;
};
