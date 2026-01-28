import { startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, differenceInMinutes, format, getDaysInMonth, startOfDay, addDays, startOfWeek, endOfWeek, endOfDay, startOfHour, endOfHour, addHours } from 'date-fns';

const getDateRange = (currentDate, periodType) => {
    let startDate, endDate;
    if (periodType === 'MONTHLY') {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
    } else if (periodType === 'WEEKLY') {
        startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (periodType === 'DAILY') {
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
    } else { // YEARLY
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
    }
    return { startDate, endDate };
};

/**
 * Process logs to generate analytics data
 * @param {Array} logs - Raw logs from Supabase
 * @param {Array} locations - List of locations
 * @param {Array} users - List of users
 * @param {Date} currentDate - Currently selected date (for month/year filtering)
 * @param {string} periodType - 'MONTHLY' or 'YEARLY'
 */
export const processAnalyticsData = (logs, locations, users, currentDate, periodType = 'MONTHLY') => {
    // 1. Define Time Range
    const { startDate, endDate } = getDateRange(currentDate, periodType);

    // 2. Filter Logs within Range
    // We need to capture sessions that *overlap* with the range, but for simplicity, 
    // we'll primarily look at logs created within the range or ongoing sessions.
    // A robust way: filtering logs strictly might miss a session that started before the range.
    // However, given the nature of daily usage, checking logs within the range is usually sufficient.
    const relevantLogs = logs.filter(log => {
        const logTime = parseISO(log.created_at);
        return isWithinInterval(logTime, { start: startDate, end: endDate });
    });

    // 3. Reconstruct Sessions to calculate Duration
    // We need to process ALL logs for relevant users to ensure we get correct start times
    // even if the check-in was before the selected period (though unlikely for daily use).
    // For now, let's process the filtered logs + maybe context? 
    // Actually, simple approach: Filter logs by date first. 
    // If a check-in is missing because it was outside the range (e.g. yesterday), it might be an issue.
    // But usually check-in/out happens same day. We will assume daily sessions.

    // Group logs by user
    const userLogs = {};
    relevantLogs.forEach(log => {
        if (!userLogs[log.user_id]) userLogs[log.user_id] = [];
        userLogs[log.user_id].push(log);
    });

    const roomStats = {}; // { [locationId]: { name, duration: 0, count: 0, uniqueUsers: new Set() } }
    const memberStats = {}; // { [userId]: { name, group, duration: 0, visitDays: new Set(), lastVisit: null } }
    const dailyStats = {}; // { [dateString]: { date, totalDuration: 0, activeUsers: Set() } }

    // Initialize room stats
    locations.forEach(loc => {
        roomStats[loc.id] = {
            id: loc.id,
            name: loc.name,
            duration: 0,
            count: 0,
            uniqueUsers: new Set(),
            userDetailedStats: {} // { [userId]: { name, group, duration, visitDays: Set } }
        };
    });

    // Initialize time series stats for the period
    if (periodType === 'DAILY') {
        let iterHour = startOfDay(startDate);
        while (iterHour <= endDate) {
            const hourKey = format(iterHour, 'yyyy-MM-dd HH:00');
            dailyStats[hourKey] = { date: hourKey, totalDuration: 0, visitCount: 0, uniqueUsers: new Set() };
            iterHour = addHours(iterHour, 1);
        }
    } else {
        let iterDate = startOfDay(startDate);
        while (iterDate <= endDate) {
            const dateKey = format(iterDate, 'yyyy-MM-dd');
            dailyStats[dateKey] = { date: dateKey, totalDuration: 0, visitCount: 0, uniqueUsers: new Set() };
            iterDate = addDays(iterDate, 1);
        }
    }

    Object.keys(userLogs).forEach(userId => {
        const uLogs = userLogs[userId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const user = users.find(u => u.id === userId);
        if (!user) return; // Skip unknown users

        if (!memberStats[userId]) {
            memberStats[userId] = {
                id: userId,
                name: user.name,
                group: user.user_group,
                duration: 0,
                visitDays: new Set(),
                lastVisit: null
            };
        }

        let currentSessionStart = null;
        let currentLocationId = null;

        uLogs.forEach((log) => {
            const logTime = parseISO(log.created_at);
            const dateKey = format(logTime, 'yyyy-MM-dd');

            // Helper to ensure userDetailedStats exists for a room
            const ensureUserDetail = (locId) => {
                if (!roomStats[locId]) return;
                if (!roomStats[locId].userDetailedStats[userId]) {
                    roomStats[locId].userDetailedStats[userId] = {
                        name: user.name,
                        group: user.user_group,
                        duration: 0,
                        visitDays: new Set()
                    };
                }
            };

            // Update last visit
            if (!memberStats[userId].lastVisit || logTime > memberStats[userId].lastVisit) {
                memberStats[userId].lastVisit = logTime;
            }

            if (log.type === 'CHECKIN' || log.type === 'MOVE') {
                // If previously checked in, close that segment
                if (currentSessionStart && currentLocationId) {
                    const duration = differenceInMinutes(logTime, currentSessionStart);
                    if (duration > 0 && duration < 1440) { // Sanity check: < 24 hours
                        if (roomStats[currentLocationId]) {
                            roomStats[currentLocationId].duration += duration;
                            ensureUserDetail(currentLocationId);
                            roomStats[currentLocationId].userDetailedStats[userId].duration += duration;
                        }
                        memberStats[userId].duration += duration;

                        // Add to time series stats
                        const timeKey = periodType === 'DAILY' ? format(logTime, 'yyyy-MM-dd HH:00') : dateKey;
                        if (dailyStats[timeKey]) {
                            dailyStats[timeKey].totalDuration += duration;
                        }
                    }
                }

                // Start new segment
                currentSessionStart = logTime;
                currentLocationId = log.location_id;

                // Counts
                if (log.type === 'CHECKIN' || log.type === 'MOVE') {
                    if (roomStats[currentLocationId]) {
                        roomStats[currentLocationId].count += 1;
                        roomStats[currentLocationId].uniqueUsers.add(userId);

                        ensureUserDetail(currentLocationId);
                        roomStats[currentLocationId].userDetailedStats[userId].visitDays.add(dateKey);
                    }
                }

                // If it's a CHECKIN, add to unique visit days
                if (log.type === 'CHECKIN') {
                    memberStats[userId].visitDays.add(dateKey);
                }

                if (periodType === 'DAILY') {
                    const hourKey = format(logTime, 'yyyy-MM-dd HH:00');
                    if (dailyStats[hourKey]) {
                        dailyStats[hourKey].uniqueUsers.add(userId);
                        if (log.type === 'CHECKIN') dailyStats[hourKey].visitCount += 1;
                    }
                } else {
                    if (dailyStats[dateKey]) {
                        dailyStats[dateKey].uniqueUsers.add(userId);
                        if (log.type === 'CHECKIN') dailyStats[dateKey].visitCount += 1;
                    }
                }

            } else if (log.type === 'CHECKOUT') {
                // Close session
                if (currentSessionStart && currentLocationId) {
                    const duration = differenceInMinutes(logTime, currentSessionStart);
                    if (duration > 0 && duration < 1440) {
                        if (roomStats[currentLocationId]) {
                            roomStats[currentLocationId].duration += duration;
                            ensureUserDetail(currentLocationId);
                            roomStats[currentLocationId].userDetailedStats[userId].duration += duration;
                        }
                        memberStats[userId].duration += duration;
                        const timeKey = periodType === 'DAILY' ? format(logTime, 'yyyy-MM-dd HH:00') : dateKey;
                        if (dailyStats[timeKey]) dailyStats[timeKey].totalDuration += duration;
                    }
                }
                currentSessionStart = null;
                currentLocationId = null;
            }
        });
    });

    // Formatting Output
    const roomAnalysis = Object.values(roomStats).map(r => ({
        ...r,
        uniqueUsers: r.uniqueUsers.size,
        userDetails: Object.values(r.userDetailedStats).map(u => ({
            ...u,
            count: u.visitDays.size
        })).sort((a, b) => b.duration - a.duration)
    })).sort((a, b) => b.duration - a.duration);
    const memberRanking = Object.values(memberStats).map(m => ({
        ...m,
        count: m.visitDays.size
    })).sort((a, b) => b.duration - a.duration);
    const timeSeries = Object.values(dailyStats).map(d => ({
        ...d,
        activeUsers: d.uniqueUsers.size
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    return { roomAnalysis, memberRanking, timeSeries };
};

/**
 * Process program stats
 */
export const processProgramAnalytics = (notices, responses, currentDate, periodType) => {
    const { startDate, endDate } = getDateRange(currentDate, periodType);

    const now = new Date();
    const programStats = notices
        .filter(notice => {
            // Only include programs
            if (notice.category !== 'PROGRAM') return false;

            // Use program_date if exists, fallback to created_at
            const targetDate = notice.program_date ? parseISO(notice.program_date) : parseISO(notice.created_at);

            // Filter by selected period
            const withinPeriod = isWithinInterval(targetDate, { start: startDate, end: endDate });
            if (!withinPeriod) return false;

            // Only include programs that have occurred (execution/cancellation stats)
            return targetDate <= now;
        })
        .map(notice => {
            const noticeResponses = responses.filter(r => r.notice_id === notice.id);
            const joinCount = noticeResponses.filter(r => r.status === 'JOIN').length;
            const waitlistCount = noticeResponses.filter(r => r.status === 'WAITLIST').length;
            const declineCount = noticeResponses.filter(r => r.status === 'DECLINE').length;
            const attendedCount = noticeResponses.filter(r => r.is_attended).length;

            const attendanceRate = joinCount > 0 ? (attendedCount / joinCount) * 100 : 0;

            return {
                id: notice.id,
                title: notice.title,
                status: notice.program_status,
                created_at: notice.created_at,
                program_date: notice.program_date,
                joinCount,
                waitlistCount,
                declineCount,
                attendedCount,
                attendanceRate: Math.round(attendanceRate),
                totalResponses: noticeResponses.length
            };
        }).sort((a, b) => {
            const dateA = a.program_date ? new Date(a.program_date) : new Date(a.created_at);
            const dateB = b.program_date ? new Date(b.program_date) : new Date(b.created_at);
            return dateB - dateA;
        });

    return programStats;
};

/**
 * Enhanced User Analytics
 */
export const processUserAnalytics = (users, logs, responses, notices, currentDate, periodType) => {
    const { startDate, endDate } = getDateRange(currentDate, periodType);
    const now = new Date();

    // 1. Space visits & time from logs
    const userStats = {};

    users.forEach(user => {
        userStats[user.id] = {
            id: user.id,
            name: user.name,
            group: user.user_group,
            school: user.school,
            spaceCount: 0,
            spaceDuration: 0, // in minutes
            programCount: 0,
            attendedCount: 0,
            visitDays: new Set()
        };
    });

    // Process Logs for Space Stats within range
    const filteredLogs = logs.filter(log => {
        const logTime = parseISO(log.created_at);
        return isWithinInterval(logTime, { start: startDate, end: endDate });
    });

    const userLogsMap = {};
    filteredLogs.forEach(log => {
        if (!userLogsMap[log.user_id]) userLogsMap[log.user_id] = [];
        userLogsMap[log.user_id].push(log);
    });

    Object.keys(userLogsMap).forEach(userId => {
        if (!userStats[userId]) return;
        const uLogs = userLogsMap[userId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let currentStart = null;
        uLogs.forEach(log => {
            const logTime = parseISO(log.created_at);
            if (log.type === 'CHECKIN' || log.type === 'MOVE') {
                if (currentStart) {
                    const duration = differenceInMinutes(logTime, currentStart);
                    if (duration > 0 && duration < 1440) userStats[userId].spaceDuration += duration;
                }
                currentStart = logTime;
                if (log.type === 'CHECKIN') {
                    userStats[userId].spaceCount += 1;
                    userStats[userId].visitDays.add(format(logTime, 'yyyy-MM-dd'));
                }
            } else if (log.type === 'CHECKOUT') {
                if (currentStart) {
                    const duration = differenceInMinutes(logTime, currentStart);
                    if (duration > 0 && duration < 1440) userStats[userId].spaceDuration += duration;
                }
                currentStart = null;
            }
        });
    });

    // Process Responses for Program Stats (filter by notice program_date)
    responses.forEach(res => {
        if (!userStats[res.user_id]) return;
        const notice = notices.find(n => n.id === res.notice_id);
        if (!notice || notice.category !== 'PROGRAM') return;

        const targetDate = notice.program_date ? parseISO(notice.program_date) : parseISO(notice.created_at);
        if (!isWithinInterval(targetDate, { start: startDate, end: endDate }) || targetDate > now) return;

        if (res.status === 'JOIN') {
            userStats[res.user_id].programCount += 1;
            if (res.is_attended) userStats[res.user_id].attendedCount += 1;
        }
    });

    return Object.values(userStats).map(u => ({
        ...u,
        visitDaysCount: u.visitDays.size
    }));
};
