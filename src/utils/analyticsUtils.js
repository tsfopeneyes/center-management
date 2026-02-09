import { supabase } from '../supabaseClient';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, parseISO, differenceInMinutes, eachHourOfInterval, eachMonthOfInterval } from 'date-fns';
import { aggregateVisitSessions } from './visitUtils';

/**
 * Common period filtering logic
 */
const getPeriodRange = (date, type) => {
    switch (type) {
        case 'DAILY': return { start: startOfDay(date), end: endOfDay(date) };
        case 'WEEKLY': return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
        case 'MONTHLY': return { start: startOfMonth(date), end: endOfMonth(date) };
        case 'YEARLY': return { start: startOfYear(date), end: endOfYear(date) };
        default: return { start: startOfMonth(date), end: endOfMonth(date) };
    }
};

/**
 * Process Raw Logs for Space Analytics
 */
export const processAnalyticsData = (logs, locations, users, date, type) => {
    const { start, end } = getPeriodRange(date, type);

    // Filter out Admin users from the start
    const adminIds = new Set(users.filter(u =>
        u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
    ).map(u => u.id));

    const filteredLogs = logs.filter(l => {
        if (adminIds.has(l.user_id)) return false;
        const d = new Date(l.created_at);
        return d >= start && d <= end;
    });

    // Pre-index users and locations for O(1) lookup
    const userMap = new Map(users.map(u => [u.id, u]));
    const locationMap = new Map(locations.map(loc => [loc.id, { ...loc, studentDurations: new Map(), guestCount: 0, studentLogs: new Map() }]));

    // 1. Single Pass Log Processing & Last Known Location Tracking
    const userCurrentLoc = new Map(); // {userId: lastLocId}
    const userStartTime = new Map(); // {userId: startTime}

    // To accurately count unique users and visits for the period, 
    // we need to consider users who were already checked in before the period started.
    // We'll look at the most recent log BEFORE the start date.
    const prePeriodLogs = logs.filter(l => new Date(l.created_at) < start);
    const prePeriodState = new Map(); // {userId: {locId, time}}
    prePeriodLogs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(log => {
        if (log.type === 'CHECKIN' || log.type === 'MOVE') prePeriodState.set(log.user_id, { locId: log.location_id, time: new Date(log.created_at) });
        else if (log.type === 'CHECKOUT') prePeriodState.delete(log.user_id);
    });

    // Initialize state with users already present
    prePeriodState.forEach((state, userId) => {
        userCurrentLoc.set(userId, state.locId);
        userStartTime.set(userId, start); // Count duration FROM the start of the period

        const loc = locationMap.get(state.locId);
        if (loc) {
            if (!loc.studentDurations.has(userId)) loc.studentDurations.set(userId, { duration: 0, count: 1 }); // Already present counts as 1 visit for this period
        }
    });

    filteredLogs.forEach(log => {
        const userId = log.user_id;
        const currentLocId = log.location_id;
        const logTime = new Date(log.created_at);

        if (log.type === 'GUEST_ENTRY') {
            const loc = locationMap.get(currentLocId);
            if (loc) loc.guestCount++;
            return;
        }

        // Before updating to new state, handle the previous state
        const lastLocId = userCurrentLoc.get(userId);
        const startTime = userStartTime.get(userId);

        if (lastLocId && startTime) {
            const duration = differenceInMinutes(logTime, startTime);
            if (duration > 0) {
                const prevLoc = locationMap.get(lastLocId);
                if (prevLoc) {
                    if (!prevLoc.studentDurations.has(userId)) prevLoc.studentDurations.set(userId, { duration: 0, count: 0 });
                    const stats = prevLoc.studentDurations.get(userId);
                    stats.duration += duration;
                }
            }
        }

        // Update state based on current log
        if (log.type === 'CHECKIN' || log.type === 'MOVE') {
            userCurrentLoc.set(userId, currentLocId);
            userStartTime.set(userId, logTime);

            const loc = locationMap.get(currentLocId);
            if (loc) {
                if (!loc.studentDurations.has(userId)) loc.studentDurations.set(userId, { duration: 0, count: 0 });
                loc.studentDurations.get(userId).count++;
            }
        } else if (log.type === 'CHECKOUT') {
            userCurrentLoc.delete(userId);
            userStartTime.delete(userId);
        }
    });

    // Handle users still checked in at the end of the period
    const periodEndTime = (end < new Date()) ? end : new Date();
    userCurrentLoc.forEach((locId, userId) => {
        const startTime = userStartTime.get(userId);
        if (startTime) {
            const duration = differenceInMinutes(periodEndTime, startTime);
            if (duration > 0) {
                const loc = locationMap.get(locId);
                if (loc) {
                    if (!loc.studentDurations.has(userId)) loc.studentDurations.set(userId, { duration: 0, count: 0 });
                    loc.studentDurations.get(userId).duration += duration;
                }
            }
        }
    });

    // 2. Room Analysis calculation
    const roomAnalysis = Array.from(locationMap.values()).map(loc => {
        let totalDuration = 0;
        let visitCount = 0;
        const userDetailsList = [];

        loc.studentDurations.forEach((stats, uid) => {
            const user = userMap.get(uid);
            totalDuration += stats.duration;
            visitCount += stats.count;
            userDetailsList.push({
                name: user ? user.name : '알 수 없음',
                group: user ? user.user_group : '-',
                count: stats.count,
                duration: stats.duration
            });
        });

        return {
            name: loc.name,
            duration: totalDuration,
            visitCount,
            uniqueUsers: loc.studentDurations.size + loc.guestCount,
            memberCount: loc.studentDurations.size,
            guestCount: loc.guestCount,
            userDetails: userDetailsList.sort((a, b) => b.duration - a.duration)
        };
    });

    // 3. Member Ranking (Simplified O(N) approach)
    const userCheckinCounts = new Map();
    filteredLogs.forEach(l => {
        if (l.type === 'CHECKIN' || l.type === 'MOVE') {
            userCheckinCounts.set(l.user_id, (userCheckinCounts.get(l.user_id) || 0) + 1);
        }
    });

    const memberRanking = users.map(u => ({
        id: u.id,
        name: u.name,
        count: userCheckinCounts.get(u.id) || 0,
        duration: 0
    })).sort((a, b) => b.count - a.count);

    // 4. Time Series
    let interval;
    if (type === 'DAILY') interval = eachHourOfInterval({ start, end });
    else if (type === 'YEARLY') interval = eachMonthOfInterval({ start, end });
    else interval = eachDayOfInterval({ start, end });

    // Pre-group logs by time bucket to avoid O(I*N)
    const logBuckets = new Map();
    filteredLogs.forEach(log => {
        const d = new Date(log.created_at);
        let bucketKey;
        if (type === 'DAILY') bucketKey = startOfDay(d).getTime() + d.getHours() * 3600000;
        else if (type === 'YEARLY') bucketKey = startOfMonth(d).getTime();
        else bucketKey = startOfDay(d).getTime();

        if (!logBuckets.has(bucketKey)) logBuckets.set(bucketKey, []);
        logBuckets.get(bucketKey).push(log);
    });

    const timeSeries = interval.map(point => {
        const bucketKey = point.getTime();
        const pLogs = logBuckets.get(bucketKey) || [];

        return {
            date: point.toISOString(),
            visitCount: pLogs.filter(l => l.type === 'CHECKIN').length,
            totalDuration: pLogs.reduce((acc, l) => acc + (l.duration || 0), 0)
        };
    });

    // 5. Summaries
    const totalVisits = roomAnalysis.reduce((acc, curr) => acc + curr.visitCount, 0);
    const totalGuests = filteredLogs.filter(l => l.type === 'GUEST_ENTRY').length;
    const uniqueUsersSet = new Set();
    roomAnalysis.forEach(r => {
        r.userDetails.forEach(u => uniqueUsersSet.add(u.name)); // Note: name-based uniqueness as a proxy if user IDs aren't available in userDetails
    });
    // Better: use the studentDurations keys across all locations
    const actualUniqueUsers = new Set();
    const totalDurationSplit = { student: 0, graduate: 0 };
    const totalVisitsSplit = { student: 0, graduate: 0 };
    const studentsSet = new Set();
    const graduatesSet = new Set();

    locationMap.forEach(loc => {
        loc.studentDurations.forEach((stats, uid) => {
            actualUniqueUsers.add(uid);
            const user = userMap.get(uid);
            const isGraduate = user?.user_group === '졸업생';
            if (isGraduate) {
                totalDurationSplit.graduate += stats.duration;
                totalVisitsSplit.graduate += stats.count;
                graduatesSet.add(uid);
            } else {
                totalDurationSplit.student += stats.duration;
                totalVisitsSplit.student += stats.count;
                studentsSet.add(uid);
            }
        });
    });

    return {
        roomAnalysis,
        memberRanking,
        timeSeries,
        totalVisits,
        totalGuests,
        uniqueUsers: actualUniqueUsers.size,
        totalDurationSplit,
        totalVisitsSplit,
        uniqueUsersSplit: { student: studentsSet.size, graduate: graduatesSet.size },
        avgDuration: actualUniqueUsers.size > 0 ? (roomAnalysis.reduce((acc, r) => acc + r.duration, 0) / actualUniqueUsers.size) : 0
    };
};

/**
 * Process Program Analytics
 */
export const processProgramAnalytics = (notices, responses, date, type) => {
    const { start, end } = getPeriodRange(date, type);
    const filteredNotices = notices.filter(n => {
        // Only include posts from the 'PROGRAM' category
        if (n.category !== 'PROGRAM') return false;

        const d = n.program_date ? new Date(n.program_date) : new Date(n.created_at);
        return d >= start && d <= end;
    });

    return filteredNotices.map(n => {
        const res = responses.filter(r => r.notice_id === n.id);
        const joinCount = res.filter(r => r.status === 'JOIN').length;
        const attendedCount = res.filter(r => r.is_attended).length;
        return {
            ...n,
            joinCount,
            waitlistCount: 0, // Simplified
            attendedCount,
            attendanceRate: joinCount > 0 ? Math.round((attendedCount / joinCount) * 100) : 0
        };
    });
};

/**
 * Process User Analytics
 */
export const processUserAnalytics = (users, logs, responses, notices, date, type) => {
    const { start, end } = getPeriodRange(date, type);

    // 1. Filter Notices for the period to calculate Program Stats
    const filteredNotices = notices.filter(n => {
        if (n.category !== 'PROGRAM') return false;
        const d = n.program_date ? new Date(n.program_date) : new Date(n.created_at);
        return d >= start && d <= end;
    });
    const noticeIdsInPeriod = new Set(filteredNotices.map(n => n.id));

    // Filter out Admin users
    const adminIds = new Set(users.filter(u =>
        u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
    ).map(u => u.id));
    const nonAdminUsers = users.filter(u => !adminIds.has(u.id));

    // 2. Prepare User Stats Map
    const userStats = new Map(nonAdminUsers.map(u => [u.id, {
        spaceDuration: 0,
        spaceCount: 0,
        visitDays: new Set(),
        programCount: 0,
        attendedCount: 0
    }]));

    // 3. Space Stats Calculation (Session Logic)
    // Handle initial state: users who were already checked in before the period started
    const prePeriodLogs = logs.filter(l => new Date(l.created_at) < start);
    const prePeriodState = new Map(); // {userId: {locId, time}}
    prePeriodLogs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(log => {
        if (log.type === 'CHECKIN' || log.type === 'MOVE') {
            prePeriodState.set(log.user_id, { locId: log.location_id, time: new Date(log.created_at) });
        } else if (log.type === 'CHECKOUT') {
            prePeriodState.delete(log.user_id);
        }
    });

    const userCurrentStartTime = new Map(); // {userId: startTime}
    prePeriodState.forEach((state, userId) => {
        userCurrentStartTime.set(userId, start); // Start counting duration from period start
        const stats = userStats.get(userId);
        if (stats) {
            stats.spaceCount++; // Already present counts as a visit
            stats.visitDays.add(format(start, 'yyyy-MM-dd'));
        }
    });

    const filteredLogs = logs.filter(l => {
        const d = new Date(l.created_at);
        return d >= start && d <= end;
    });

    filteredLogs.forEach(log => {
        const userId = log.user_id;
        const logTime = new Date(log.created_at);
        const stats = userStats.get(userId);
        if (!stats) return;

        // Before updating to new state, add duration for the previous session
        const startTime = userCurrentStartTime.get(userId);
        if (startTime) {
            const duration = differenceInMinutes(logTime, startTime);
            if (duration > 0) stats.spaceDuration += duration;
        }

        // Update state
        if (log.type === 'CHECKIN' || log.type === 'MOVE') {
            userCurrentStartTime.set(userId, logTime);
            stats.spaceCount++;
            stats.visitDays.add(format(logTime, 'yyyy-MM-dd'));
        } else if (log.type === 'CHECKOUT') {
            userCurrentStartTime.delete(userId);
        }
    });

    // Handle users still checked in at the end of the period
    const periodEndTime = (end < new Date()) ? end : new Date();
    userCurrentStartTime.forEach((startTime, userId) => {
        const stats = userStats.get(userId);
        if (stats) {
            const duration = differenceInMinutes(periodEndTime, startTime);
            if (duration > 0) stats.spaceDuration += duration;
        }
    });

    // 4. Calculate Program Participation for responses within the filtered notice period
    responses.forEach(r => {
        if (noticeIdsInPeriod.has(r.notice_id)) {
            const stats = userStats.get(r.user_id);
            if (stats && r.status === 'JOIN') {
                stats.programCount++;
                if (r.is_attended) stats.attendedCount++;
            }
        }
    });

    return nonAdminUsers.map(u => {
        const stats = userStats.get(u.id);
        return {
            id: u.id,
            name: u.name,
            group: u.user_group,
            school: u.school,
            spaceDuration: stats?.spaceDuration || 0,
            visitDaysCount: stats?.visitDays.size || 0,
            spaceCount: stats?.spaceCount || 0,
            programCount: stats?.programCount || 0,
            attendedCount: stats?.attendedCount || 0
        };
    });
};

export const analyticsUtils = {
    async getUsageSummary(startDate, endDate) {
        const { data: logs, error: logsError } = await supabase
            .from('logs')
            .select(`
                *,
                locations (name),
                users (name, school)
            `)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        if (logsError) throw logsError;

        const { data: notices, error: noticesError } = await supabase
            .from('notices')
            .select('*')
            .gte('program_date', startDate.toISOString().split('T')[0])
            .lte('program_date', endDate.toISOString().split('T')[0]);

        if (noticesError) throw noticesError;

        const locationStats = {};
        logs.forEach(log => {
            const locName = log.locations?.name || 'Unknown';
            if (!locationStats[locName]) locationStats[locName] = 0;
            if (log.type === 'CHECKIN' || log.type === 'MOVE') {
                locationStats[locName]++;
            }
        });

        const peakHours = Array(24).fill(0);
        logs.forEach(log => {
            if (log.type === 'CHECKIN') {
                const hour = new Date(log.created_at).getHours();
                peakHours[hour]++;
            }
        });

        const programStats = notices.map(n => ({
            title: n.title,
            date: n.program_date,
            capacity: n.max_capacity
        }));

        return {
            totalLogs: logs.length,
            locationStats,
            peakHours,
            programStats,
            period: { start: startDate, end: endDate }
        };
    },

    generateWeeklyReportText(summary) {
        const sortedLocs = Object.entries(summary.locationStats)
            .sort((a, b) => b[1] - a[1]);

        const topLoc = sortedLocs[0] ? `${sortedLocs[0][0]} (${sortedLocs[0][1]}회)` : '없음';
        const maxHour = summary.peakHours.indexOf(Math.max(...summary.peakHours));

        return `
📊 [주간 운영 리포트] ${summary.period.start.toLocaleDateString()} ~ ${summary.period.end.toLocaleDateString()}

✅ 총 이용 횟수: ${summary.totalLogs}건
🏢 가장 활발한 장소: ${topLoc}
⏰ 가장 붐비는 시간대: ${maxHour}시 ~ ${maxHour + 1}시

📅 진행된 프로그램: ${summary.programStats.length}개
${summary.programStats.map(p => `- ${p.title} (${p.date})`).join('\n')}

---
SCI CENTER DASHBOARD
        `.trim();
    },

    processOperationReport(logs, users, locations, startDate, endDate) {
        const start = startOfDay(startDate);
        const end = endOfDay(endDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        const adminIds = new Set(users.filter(u =>
            u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
        ).map(u => u.id));

        const filteredLogs = logs.filter(l => {
            if (adminIds.has(l.user_id)) return false;
            const d = new Date(l.created_at);
            return d >= start && d <= end;
        });

        const userMap = new Map(users.map(u => [u.id, u]));
        const locMap = new Map(locations.map(loc => [loc.id, { ...loc, logs: [] }]));

        // Group logs by location and handle durations
        const userDateVisit = new Set(); // To count "Visits" (max 1 per user per day per location)
        const spaceMetrics = {};

        locations.forEach(loc => {
            spaceMetrics[loc.id] = {
                id: loc.id,
                name: loc.name,
                uniqueUsers: new Set(),
                visitCount: 0,
                totalDuration: 0,
                dayCounts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
                hourlyOccupancy: Array(24).fill(0).map(() => ({ total: 0, samples: 0 }))
            };
        });

        // 1. Calculate Core Space Metrics
        const sessions = aggregateVisitSessions(logs, users, locations, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));

        sessions.forEach(s => {
            // Find primary location for the session (simplification: use the first one mentioned in usedSpaces or rawLogs)
            // But since a user can move, we should ideally treat each segment.
            // For simplicity and matching user request "by space", we use raw logs to be precise.
        });

        // Improved precise calculation per space using segments
        const segments = []; // {userId, locId, start, end, duration}
        const userCurrent = new Map();

        filteredLogs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(log => {
            const userId = log.user_id;
            const logTime = new Date(log.created_at);
            const current = userCurrent.get(userId);

            if (current) {
                const duration = differenceInMinutes(logTime, current.time);
                if (duration > 0 && current.locId) {
                    segments.push({ userId, locId: current.locId, start: current.time, end: logTime, duration });

                    const m = spaceMetrics[current.locId];
                    if (m) {
                        m.totalDuration += duration;
                        m.uniqueUsers.add(userId);

                        const dateKey = `${userId}_${current.locId}_${format(current.time, 'yyyy-MM-dd')}`;
                        if (!userDateVisit.has(dateKey)) {
                            userDateVisit.add(dateKey);
                            m.visitCount++;
                            m.dayCounts[current.time.getDay()]++;
                        }
                    }
                }
            }

            if (log.type === 'CHECKIN' || log.type === 'MOVE') {
                userCurrent.set(userId, { locId: log.location_id, time: logTime });
            } else if (log.type === 'CHECKOUT') {
                userCurrent.delete(userId);
            }
        });

        // 2. Calculate Peak Hour (Simplified Avg Concurrent Users)
        const hours = eachHourOfInterval({ start, end: (end < new Date() ? end : new Date()) });
        hours.forEach(hour => {
            const hStart = hour;
            const hEnd = new Date(hour.getTime() + 3600000);

            locations.forEach(loc => {
                const concurrentCount = segments.filter(seg =>
                    seg.locId === loc.id && seg.start < hEnd && seg.end > hStart
                ).length;

                const m = spaceMetrics[loc.id];
                if (m) {
                    m.hourlyOccupancy[hour.getHours()].total += concurrentCount;
                    m.hourlyOccupancy[hour.getHours()].samples++;
                }
            });
        });

        const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

        const spaceResults = Object.values(spaceMetrics).map(m => {
            const maxSamples = Math.max(...m.hourlyOccupancy.map(h => h.samples), 1);
            const peakHourIdx = m.hourlyOccupancy.reduce((maxIdx, curr, idx, arr) =>
                (curr.total / maxSamples) > (arr[maxIdx].total / maxSamples) ? idx : maxIdx, 0);

            const mostVisitedDayIdx = Object.entries(m.dayCounts).reduce((max, curr) =>
                curr[1] > max[1] ? curr : max, ['0', 0])[0];

            return {
                name: m.name,
                uniqueVisitors: m.uniqueUsers.size,
                visitCount: m.visitCount,
                avgVisitCount: m.uniqueUsers.size > 0 ? (m.visitCount / m.uniqueUsers.size).toFixed(1) : 0,
                totalDuration: m.totalDuration,
                avgDuration: m.visitCount > 0 ? Math.round(m.totalDuration / m.visitCount) : 0,
                mostVisitedDay: dayLabels[mostVisitedDayIdx],
                peakHour: `${peakHourIdx}:00 ~ ${peakHourIdx + 1}:00`
            };
        });

        // 3. Overall Monthly Metrics (for the whole center)
        let monthlyMetrics = null;
        if (diffDays >= 20) {
            const userVisitDates = new Map(); // {userId: Set of dates}
            const userVisitWeeks = new Map(); // {userId: Set of week numbers}

            userDateVisit.forEach(key => {
                const [userId, , dateStr] = key.split('_');
                if (!userVisitDates.has(userId)) userVisitDates.set(userId, new Set());
                userVisitDates.get(userId).add(dateStr);

                const weekNum = format(parseISO(dateStr), 'I'); // ISO week
                if (!userVisitWeeks.has(userId)) userVisitWeeks.set(userId, new Set());
                userVisitWeeks.get(userId).add(weekNum);
            });

            const totalUniqueVisitors = userVisitDates.size;
            let activeUsers = 0;
            let retainUsers = 0;

            userVisitDates.forEach((dates, userId) => {
                const visitCount = dates.size;
                const weekCount = userVisitWeeks.get(userId).size;

                if (visitCount >= 2) retainUsers++;

                // Active: Recently (within 4 weeks) avg 2+/week AND visited 2+ weeks total
                // Since our period IS the report period, we simplify: avg visit/week >= 2 AND weeks visited >= 2
                const avgVisitsPerWeek = visitCount / (diffDays / 7);
                if (avgVisitsPerWeek >= 2 && weekCount >= 2) activeUsers++;
            });

            monthlyMetrics = {
                activeUserRatio: totalUniqueVisitors > 0 ? ((activeUsers / totalUniqueVisitors) * 100).toFixed(1) : 0,
                retentionRate: totalUniqueVisitors > 0 ? ((retainUsers / totalUniqueVisitors) * 100).toFixed(1) : 0
            };
        }

        return {
            spaceResults,
            monthlyMetrics,
            totalUnique: new Set(Array.from(userDateVisit).map(k => k.split('_')[0])).size
        };
    }
};
