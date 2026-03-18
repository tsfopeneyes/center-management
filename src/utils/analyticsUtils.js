import { supabase } from '../supabaseClient';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, parseISO, differenceInMinutes, eachHourOfInterval, eachMonthOfInterval } from 'date-fns';
import { aggregateVisitSessions } from './visitUtils';
import { isAdminOrStaff } from './userUtils';

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
 * Check if a date is a center working day (Closed on Tue, Sat, Sun)
 */
export const isWorkingDay = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    return day !== 0 && day !== 2 && day !== 6;
};

/**
 * Check if two dates are "consecutive" in terms of working days.
 * Returns true if there are no working days between prev and curr.
 */
export const isConsecutiveWorkingDay = (prevDate, currDate) => {
    const prev = new Date(prevDate);
    const curr = new Date(currDate);

    // Normalize both to start of day for comparison
    const p = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
    const c = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate());

    // If they are the same day (shouldn't happen with unique dates but for safety)
    if (p.getTime() === c.getTime()) return true;

    // Check every day between prev and curr
    let temp = new Date(p);
    temp.setDate(temp.getDate() + 1);

    while (temp < c) {
        if (isWorkingDay(temp)) {
            // Found a working day between them that was missed
            return false;
        }
        temp.setDate(temp.getDate() + 1);
    }

    return true;
};

/**
 * Process Raw Logs for Space Analytics
 */
export const processAnalyticsData = (logs, locations, users, date, type) => {
    const { start, end } = getPeriodRange(date, type);

    const adminIds = new Set(users.filter(isAdminOrStaff).map(u => u.id));

    const filteredLogs = logs.filter(l => {
        if (adminIds.has(l.user_id)) return false;
        const d = new Date(l.created_at);
        return d >= start && d <= end;
    });

    const userMap = new Map(users.map(u => [u.id, u]));
    const locationMap = new Map(locations.map(loc => [loc.id, { ...loc, studentDurations: new Map(), guestCount: 0 }]));

    // Calculate Core Space Metrics Using Unified Sessions
    const sessions = aggregateVisitSessions(logs, users, locations, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));

    // Reconstruct studentDurations map using the generated sessions
    sessions.forEach(session => {
        const userId = session.userId;
        const durationLogs = session.rawLogs;

        let currentLocId = session.rawLogs[0]?.location_id;
        let segmentStart = new Date(session.rawLogs[0].created_at);

        // Count visit for the initial location immediately
        if (currentLocId && locationMap.has(currentLocId)) {
            const loc = locationMap.get(currentLocId);
            if (!loc.studentDurations.has(userId)) loc.studentDurations.set(userId, { duration: 0, count: 0 });
            loc.studentDurations.get(userId).count++;
        }

        durationLogs.forEach((log) => {
            if (log.type === 'MOVE') {
                const logTime = new Date(log.created_at);
                const duration = differenceInMinutes(logTime, segmentStart);

                if (duration > 0 && currentLocId && locationMap.has(currentLocId)) {
                    locationMap.get(currentLocId).studentDurations.get(userId).duration += duration;
                }

                currentLocId = log.location_id;
                segmentStart = logTime;

                // Count visit for the new location immediately
                if (currentLocId && locationMap.has(currentLocId)) {
                    const loc = locationMap.get(currentLocId);
                    if (!loc.studentDurations.has(userId)) loc.studentDurations.set(userId, { duration: 0, count: 0 });
                    loc.studentDurations.get(userId).count++;
                }
            }
        });

        // Handle the final segment of the session (up to checkout)
        const lastLog = durationLogs[durationLogs.length - 1];
        const lastLogTime = new Date(lastLog.created_at);
        // If the session has a checkout, calculate remaining time for the final segment
        if (lastLog.type === 'CHECKOUT') {
            const duration = differenceInMinutes(lastLogTime, segmentStart);
            if (duration > 0 && currentLocId && locationMap.has(currentLocId)) {
                locationMap.get(currentLocId).studentDurations.get(userId).duration += duration;
            }
        }
    });



    const roomAnalysis = Array.from(locationMap.values()).map(loc => {
        let totalDuration = 0;
        let visitCount = 0;
        const userDetailsList = [];
        let memberCount = 0;
        let localGuestCount = loc.guestCount; // Start with legacy count

        loc.studentDurations.forEach((stats, uid) => {
            const user = userMap.get(uid);
            const isGuest = user?.user_group === '게스트';
            
            totalDuration += stats.duration;
            visitCount += stats.count;
            
            if (isGuest) {
                localGuestCount++;
            } else {
                memberCount++;
            }

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
            uniqueUsers: memberCount + localGuestCount,
            memberCount,
            guestCount: localGuestCount, // Total guest sessions in this room
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
            visitCount: pLogs.filter(l => l.type === 'CHECKIN' || l.type === 'GUEST_ENTRY').length,
            totalDuration: pLogs.reduce((acc, l) => acc + (l.duration || 0), 0)
        };
    });

    // 5. Summaries
    const actualUniqueUsers = new Set();
    const totalDurationSplit = { student: 0, graduate: 0, guest: 0 };
    const totalVisitsSplit = { student: 0, graduate: 0 };
    const studentsSet = new Set();
    const graduatesSet = new Set();
    let guestSessionsCount = 0;

    locationMap.forEach(loc => {
        loc.studentDurations.forEach((stats, uid) => {
            const user = userMap.get(uid);
            const isGuest = user?.user_group === '게스트';
            const isGraduate = user?.user_group === '졸업생';

            if (isGuest) {
                totalDurationSplit.guest += stats.duration;
                guestSessionsCount += stats.count;
            } else if (isGraduate) {
                actualUniqueUsers.add(uid);
                totalDurationSplit.graduate += stats.duration;
                totalVisitsSplit.graduate += stats.count;
                graduatesSet.add(uid);
            } else {
                actualUniqueUsers.add(uid);
                totalDurationSplit.student += stats.duration;
                totalVisitsSplit.student += stats.count;
                studentsSet.add(uid);
            }
        });
    });

    const totalMemberVisits = totalVisitsSplit.student + totalVisitsSplit.graduate;
    
    // Count total guest visits (sessions) across all locations
    let totalGuestVisits = 0;
    locationMap.forEach(loc => {
        loc.studentDurations.forEach((stats, uid) => {
            if (userMap.get(uid)?.user_group === '게스트') {
                totalGuestVisits += stats.count;
            }
        });
    });
    
    const totalGuests = totalGuestVisits;

    // 4.5 Heatmap Data (Day of Week vs Hour of Day)
    // 0: Sunday, 1: Monday, ..., 6: Saturday
    // Hours: 0 to 23
    const heatmapData = Array.from({ length: 7 }, () => Array(24).fill(0));
    let maxHeatmapValue = 0;

    filteredLogs.forEach(log => {
        if (log.type === 'CHECKIN' || log.type === 'GUEST_ENTRY') {
            const d = new Date(log.created_at);
            const day = d.getDay();
            const hour = d.getHours();
            heatmapData[day][hour]++;
            if (heatmapData[day][hour] > maxHeatmapValue) {
                maxHeatmapValue = heatmapData[day][hour];
            }
        }
    });

    return {
        roomAnalysis,
        memberRanking,
        timeSeries,
        totalVisits: totalMemberVisits,
        totalGuests,
        uniqueUsers: actualUniqueUsers.size,
        totalDurationSplit,
        totalVisitsSplit,
        uniqueUsersSplit: { student: studentsSet.size, graduate: graduatesSet.size },
        avgDuration: actualUniqueUsers.size > 0 ? (roomAnalysis.reduce((acc, r) => acc + r.duration, 0) / actualUniqueUsers.size) : 0,
        heatmapData,
        maxHeatmapValue
    };
};

export const processProgramAnalytics = (notices, responses, date, type) => {
    const { start, end } = getPeriodRange(date, type);
    const filteredNotices = notices.filter(n => {
        // Only include posts from the 'PROGRAM' category
        if (n.category !== 'PROGRAM') return false;

        // Only include completed programs in statistics
        if (n.program_status !== 'COMPLETED') return false;

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

        // Only include completed programs in user statistics
        if (n.program_status !== 'COMPLETED') return false;

        const d = n.program_date ? new Date(n.program_date) : new Date(n.created_at);
        return d >= start && d <= end;
    });
    const noticeIdsInPeriod = new Set(filteredNotices.map(n => n.id));

    const adminIds = new Set(users.filter(isAdminOrStaff).map(u => u.id));

    const nonAdminUsers = users.filter(u => !adminIds.has(u.id));

    // 2. Prepare User Stats Map
    const userStats = new Map(nonAdminUsers.map(u => [u.id, {
        spaceDuration: 0,
        spaceCount: 0,
        visitDays: new Set(),
        programCount: 0,
        attendedCount: 0
    }]));

    // 3. Space Stats Calculation Using Unified Sessions
    const sessions = aggregateVisitSessions(logs, users, notices, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));

    sessions.forEach(session => {
        const userId = session.userId;
        const stats = userStats.get(userId);
        if (!stats) return;

        stats.spaceCount++;
        stats.visitDays.add(session.date);

        const durationLogs = session.rawLogs;
        if (durationLogs.length < 2) return;

        let segmentStart = new Date(durationLogs[0].created_at);
        durationLogs.forEach(log => {
            if (log.type === 'MOVE') {
                const logTime = new Date(log.created_at);
                const duration = Math.max(0, differenceInMinutes(logTime, segmentStart));
                if (duration > 0) stats.spaceDuration += duration;
                segmentStart = logTime;
            }
        });

        const lastLog = durationLogs[durationLogs.length - 1];
        if (lastLog.type === 'CHECKOUT') {
            const duration = Math.max(0, differenceInMinutes(new Date(lastLog.created_at), segmentStart));
            if (duration > 0) stats.spaceDuration += duration;
        }
    });

    // 4. Calculate Program Participation

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

export const processSeucheoAnalytics = (schoolLogs, users, periodType, selectedDate, regionFilter = 'ALL') => {
    const periodStart = periodType === 'DAILY' ? startOfDay(selectedDate) :
        periodType === 'WEEKLY' ? startOfWeek(selectedDate, { weekStartsOn: 1 }) :
            periodType === 'MONTHLY' ? startOfMonth(selectedDate) :
                startOfDay(new Date(selectedDate.getFullYear(), 0, 1)); // YEARLY

    const periodEnd = periodType === 'DAILY' ? endOfDay(selectedDate) :
        periodType === 'WEEKLY' ? endOfWeek(selectedDate, { weekStartsOn: 1 }) :
            periodType === 'MONTHLY' ? endOfMonth(selectedDate) :
                endOfDay(new Date(selectedDate.getFullYear(), 11, 31)); // YEARLY

    const filteredLogs = schoolLogs.filter(log => {
        const logDate = new Date(log.date);
        const inPeriod = logDate >= periodStart && logDate <= periodEnd;
        if (!inPeriod) return false;

        if (regionFilter !== 'ALL') {
            const hasMatchingStaff = log.facilitator_ids?.some(staffId => {
                const staffUser = users.find(u => u.id === staffId);
                return staffUser?.preferences?.seucheoRegion === regionFilter;
            });
            return hasMatchingStaff;
        }

        return true;
    });

    const staffStats = {};
    const schoolStats = {};

    filteredLogs.forEach(log => {
        let duration = 0;
        if (log.time_range) {
            const [startStr, endStr] = log.time_range.split('~').map(s => s.trim());
            if (startStr && endStr) {
                const [h1, m1] = startStr.split(':').map(Number);
                const [h2, m2] = endStr.split(':').map(Number);
                duration = (h2 * 60 + m2) - (h1 * 60 + m1);
            }
        }

        const studentCount = log.participant_ids ? log.participant_ids.length : 0;
        const schoolName = log.schools?.name || log.users?.school || 'Unknown';

        // School Stats
        if (!schoolStats[schoolName]) {
            schoolStats[schoolName] = { name: schoolName, totalStudents: 0, totalDuration: 0, meetingCount: 0 };
        }
        schoolStats[schoolName].totalStudents += studentCount;
        schoolStats[schoolName].totalDuration += duration;
        schoolStats[schoolName].meetingCount += 1;

        // Staff Stats
        if (log.facilitator_ids && Array.isArray(log.facilitator_ids)) {
            log.facilitator_ids.forEach(staffId => {
                const staffUser = users.find(u => u.id === staffId);

                if (regionFilter !== 'ALL' && staffUser?.preferences?.seucheoRegion !== regionFilter) {
                    return;
                }

                const name = staffUser ? staffUser.name : 'Unknown';

                if (!staffStats[staffId]) {
                    staffStats[staffId] = {
                        name: name,
                        totalStudents: 0,
                        totalDuration: 0,
                        meetingCount: 0
                    };
                }
                staffStats[staffId].totalStudents += studentCount;
                staffStats[staffId].totalDuration += duration;
                staffStats[staffId].meetingCount += 1;
            });
        }
    });

    // Time Grouping
    const timeGrouping = {};
    filteredLogs.forEach(log => {
        const dateKey = periodType === 'DAILY' ? log.date :
            periodType === 'MONTHLY' ? log.date :
                log.date.substring(0, 7);

        if (!timeGrouping[dateKey]) timeGrouping[dateKey] = {};

        // Calculate Duration again for this scope
        let duration = 0;
        if (log.time_range) {
            const [startStr, endStr] = log.time_range.split('~').map(s => s.trim());
            if (startStr && endStr) {
                const [h1, m1] = startStr.split(':').map(Number);
                const [h2, m2] = endStr.split(':').map(Number);
                duration = (h2 * 60 + m2) - (h1 * 60 + m1);
            }
        }

        if (log.facilitator_ids) {
            log.facilitator_ids.forEach(staffId => {
                const staffUser = users.find(u => u.id === staffId);

                if (regionFilter !== 'ALL' && staffUser?.preferences?.seucheoRegion !== regionFilter) {
                    return;
                }

                const name = staffUser ? staffUser.name : 'Unknown';

                if (!timeGrouping[dateKey][name]) timeGrouping[dateKey][name] = 0;
                timeGrouping[dateKey][name] += duration;
            });
        }
    });

    return {
        staffStats: Object.values(staffStats).sort((a, b) => b.totalDuration - a.totalDuration),
        schoolStats: Object.values(schoolStats).sort((a, b) => b.totalDuration - a.totalDuration),
        timeGrouping,
        totalMeetings: filteredLogs.length,
        totalStudentsMet: Object.values(staffStats).reduce((acc, curr) => acc + curr.totalStudents, 0),
        totalDuration: filteredLogs.reduce((acc, log) => {
            let duration = 0;
            if (log.time_range) {
                const [startStr, endStr] = log.time_range.split('~').map(s => s.trim());
                if (startStr && endStr) {
                    const [h1, m1] = startStr.split(':').map(Number);
                    const [h2, m2] = endStr.split(':').map(Number);
                    duration = (h2 * 60 + m2) - (h1 * 60 + m1);
                }
            }
            return acc + duration;
        }, 0)
    };
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

    processOperationReport(logs, users, locations, startDate, endDate, targetGroup = 'ALL') {
        const start = startOfDay(startDate);
        const end = endOfDay(endDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        const adminIds = new Set(users.filter(isAdminOrStaff).map(u => u.id));


        const targetUsers = [];
        const guestUsers = [];

        users.forEach(u => {
            if (adminIds.has(u.id)) return;

            if (u.user_group === '게스트') {
                guestUsers.push(u);
                return;
            }

            // Filter by targetGroup for regular users
            if (targetGroup === 'YOUTH') {
                if (u.user_group === '졸업생' || u.user_group === '일반인') return;
            }
            targetUsers.push(u);
        });

        const targetUserIds = new Set(targetUsers.map(u => u.id));
        const guestUserIds = new Set(guestUsers.map(u => u.id));

        const filteredLogs = logs.filter(l => {
            if (!targetUserIds.has(l.user_id) && !guestUserIds.has(l.user_id)) return false;
            const d = new Date(l.created_at);
            return d >= start && d <= end;
        });

        const userMap = new Map(users.map(u => [u.id, u]));
        const locMap = new Map(locations.map(loc => [loc.id, { ...loc, logs: [] }]));

        // Group logs by location and handle durations
        const userDateVisit = new Set(); // To count "Visits" (max 1 per user per day per location)
        const spaceMetrics = {};

        const guestMetrics = {};

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
            guestMetrics[loc.id] = {
                visitCount: 0,
                totalDuration: 0,
                guests: new Map() // { userId: { name, school, phone, visits, duration } }
            };
        });

        const sessions = aggregateVisitSessions(logs, users, locations, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));

        const segments = []; // To calculate peak hour occupancy correctly

        // Reconstruct space metrics from sessions to ensure perfect matching with Stats tab
        sessions.forEach(session => {
            const userId = session.userId;
            const u = userMap.get(userId);
            if (!u) return;

            const isGuest = u.user_group === '게스트';

            // Filter by targetGroup for non-guests
            if (!isGuest && targetGroup === 'YOUTH') {
                if (u.user_group === '졸업생' || u.user_group === '일반인') return;
            }

            const durationLogs = session.rawLogs;
            if (durationLogs.length === 0) return;

            let currentLocId = durationLogs[0].location_id;
            let segmentStart = new Date(durationLogs[0].created_at);

            const recordSegment = (locId, startT, endT) => {
                const duration = differenceInMinutes(endT, startT);
                if (duration <= 0 || !locId) return;

                if (!isGuest) {
                    segments.push({ userId, locId, start: startT, end: endT, duration });
                    const m = spaceMetrics[locId];
                    if (m) {
                        m.totalDuration += duration;
                        m.uniqueUsers.add(userId);

                        const dateKey = `${userId}_${locId}_${session.date}`;
                        if (!userDateVisit.has(dateKey)) {
                            userDateVisit.add(dateKey);
                            m.visitCount++;
                            m.dayCounts[new Date(session.date).getDay()]++;
                        }
                    }
                } else {
                    // Record Guest Segment
                    const gm = guestMetrics[locId];
                    if (gm) {
                        gm.totalDuration += duration;
                        if (!gm.guests.has(userId)) {
                            gm.guests.set(userId, {
                                name: u.name,
                                school: u.school,
                                phone: u.phone_back4 || u.phone,
                                visits: 0,
                                duration: 0,
                                visitedDates: new Set()
                            });
                        }
                        const g = gm.guests.get(userId);
                        g.duration += duration;

                        const dateKey = `${userId}_${locId}_${session.date}`;
                        if (!g.visitedDates.has(dateKey)) {
                            g.visitedDates.add(dateKey);
                            g.visits++;
                            gm.visitCount++;
                        }
                    }
                }
            };

            durationLogs.forEach((log) => {
                if (log.type === 'MOVE') {
                    const logTime = new Date(log.created_at);
                    recordSegment(currentLocId, segmentStart, logTime);
                    currentLocId = log.location_id;
                    segmentStart = logTime;
                }
            });

            const lastLog = durationLogs[durationLogs.length - 1];
            if (lastLog.type === 'CHECKOUT') {
                recordSegment(currentLocId, segmentStart, new Date(lastLog.created_at));
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

        // Pre-calculate per-space active/retention metrics if monthly
        const isMonthlyOrMore = diffDays >= 20;

        Object.values(spaceMetrics).forEach(m => {
            if (isMonthlyOrMore) {
                const spaceUserVisitDates = new Map();
                userDateVisit.forEach(key => {
                    const [userId, locId, dateStr] = key.split('_');
                    if (locId === m.id) {
                        if (!spaceUserVisitDates.has(userId)) spaceUserVisitDates.set(userId, new Set());
                        spaceUserVisitDates.get(userId).add(dateStr);
                    }
                });

                const spaceUserWeeklyVisitsStrict = new Map();
                spaceUserVisitDates.forEach((uniqueDates, userId) => {
                    spaceUserWeeklyVisitsStrict.set(userId, {});
                    uniqueDates.forEach(dateStr => {
                        const weekNum = format(parseISO(dateStr), 'I');
                        const weeklyCounts = spaceUserWeeklyVisitsStrict.get(userId);
                        weeklyCounts[weekNum] = (weeklyCounts[weekNum] || 0) + 1;
                    });
                });

                let activeUsers = 0;
                let retainUsers = 0;

                spaceUserVisitDates.forEach((dates, userId) => {
                    if (dates.size >= 2) retainUsers++;
                    const weeklyCounts = spaceUserWeeklyVisitsStrict.get(userId);
                    const activeWeeksCount = Object.values(weeklyCounts).filter(count => count >= 2).length;
                    if (activeWeeksCount >= 2) activeUsers++;
                });

                const totalUnique = spaceUserVisitDates.size;
                m.activeUserRatio = totalUnique > 0 ? ((activeUsers / totalUnique) * 100).toFixed(1) : 0;
                m.retentionRate = totalUnique > 0 ? ((retainUsers / totalUnique) * 100).toFixed(1) : 0;
            } else {
                m.activeUserRatio = null;
                m.retentionRate = null;
            }
        });

        const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

        const spaceResults = Object.values(spaceMetrics).map(m => {
            const maxSamples = Math.max(...m.hourlyOccupancy.map(h => h.samples), 1);
            const peakHourIdx = m.hourlyOccupancy.reduce((maxIdx, curr, idx, arr) =>
                (curr.total / maxSamples) > (arr[maxIdx].total / maxSamples) ? idx : maxIdx, 0);

            const mostVisitedDayIdx = Object.entries(m.dayCounts).reduce((max, curr) =>
                curr[1] > max[1] ? curr : max, ['0', 0])[0];

            return {
                id: m.id,
                name: m.name,
                uniqueVisitors: m.uniqueUsers.size,
                visitCount: m.visitCount,
                avgVisitCount: m.uniqueUsers.size > 0 ? (m.visitCount / m.uniqueUsers.size).toFixed(1) : 0,
                totalDuration: m.totalDuration,
                avgDuration: m.visitCount > 0 ? Math.round(m.totalDuration / m.visitCount) : 0,
                mostVisitedDay: dayLabels[mostVisitedDayIdx],
                peakHour: `${peakHourIdx}:00 ~ ${peakHourIdx + 1}:00`,
                activeUserRatio: m.activeUserRatio,
                retentionRate: m.retentionRate
            };
        });

        // 3. Overall Monthly Metrics (for the whole center)
        let monthlyMetrics = null;
        if (diffDays >= 20) {
            const userVisitDates = new Map(); // {userId: Set of dates}
            const userWeeklyVisits = new Map(); // {userId: { weekNum: visitCount }}

            userDateVisit.forEach(key => {
                const [userId, , dateStr] = key.split('_');

                // Track unique dates per user
                if (!userVisitDates.has(userId)) userVisitDates.set(userId, new Set());
                userVisitDates.get(userId).add(dateStr);

                // Track visits per week per user
                const weekNum = format(parseISO(dateStr), 'I'); // ISO week
                if (!userWeeklyVisits.has(userId)) userWeeklyVisits.set(userId, {});

                const weeklyCounts = userWeeklyVisits.get(userId);
                // We only count unique days per week since userVisitDates tracks unique center visits per day
                // But since userDateVisit already includes unique dates per location, we must ensure
                // we only count 1 per day for the overall center weekly active metric.
                // An easier way: build userVisitDates first, then process from there.
            });

            // Re-calculate weekly visits based strictly on unique visit dates for the whole center
            const userWeeklyVisitsStrict = new Map();
            userVisitDates.forEach((uniqueDates, userId) => {
                userWeeklyVisitsStrict.set(userId, {});
                uniqueDates.forEach(dateStr => {
                    const weekNum = format(parseISO(dateStr), 'I');
                    const weeklyCounts = userWeeklyVisitsStrict.get(userId);
                    weeklyCounts[weekNum] = (weeklyCounts[weekNum] || 0) + 1;
                });
            });

            const totalUniqueVisitors = userVisitDates.size;
            let activeUsers = 0;
            let retainUsers = 0;

            userVisitDates.forEach((dates, userId) => {
                const visitCount = dates.size;
                if (visitCount >= 2) retainUsers++;

                // Active: visited 2+ times a week, for at least 2 weeks
                const weeklyCounts = userWeeklyVisitsStrict.get(userId);
                const activeWeeksCount = Object.values(weeklyCounts).filter(count => count >= 2).length;

                if (activeWeeksCount >= 2) activeUsers++;
            });

            monthlyMetrics = {
                activeUserRatio: totalUniqueVisitors > 0 ? ((activeUsers / totalUniqueVisitors) * 100).toFixed(1) : 0,
                retentionRate: totalUniqueVisitors > 0 ? ((retainUsers / totalUniqueVisitors) * 100).toFixed(1) : 0
            };
        }

        const guestResults = Object.values(guestMetrics).reduce((acc, gm, idx) => {
            const locId = Object.keys(guestMetrics)[idx];
            acc[locId] = {
                visitCount: gm.visitCount,
                totalDuration: gm.totalDuration,
                avgDuration: gm.visitCount > 0 ? Math.round(gm.totalDuration / gm.visitCount) : 0,
                guests: Array.from(gm.guests.values()).sort((a, b) => b.visits - a.visits)
            };
            return acc;
        }, {});

        return {
            spaceResults,
            guestResults,
            monthlyMetrics,
            totalUnique: new Set(Array.from(userDateVisit).map(k => k.split('_')[0])).size,
            reportTarget: targetGroup
        };
    }
};
