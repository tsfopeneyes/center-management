import { supabase } from '../supabaseClient';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, parseISO, differenceInMinutes, eachHourOfInterval, eachMonthOfInterval } from 'date-fns';

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
    const filteredLogs = logs.filter(l => {
        const d = new Date(l.created_at);
        return d >= start && d <= end;
    });

    // 1. Room Analysis
    const roomAnalysis = locations.map(loc => {
        const locLogs = filteredLogs.filter(l => l.location_id === loc.id);
        const uniqueUserIds = new Set(locLogs.map(l => l.user_id));

        let totalDuration = 0;
        const userDetailsMap = {};

        uniqueUserIds.forEach(uid => {
            const user = users.find(u => u.id === uid);
            const userLogs = locLogs.filter(l => l.user_id === uid).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            let userDuration = 0;
            let checkInTime = null;

            userLogs.forEach(l => {
                if (l.type === 'CHECKIN' || l.type === 'MOVE') {
                    checkInTime = new Date(l.created_at);
                } else if (l.type === 'CHECKOUT' && checkInTime) {
                    userDuration += differenceInMinutes(new Date(l.created_at), checkInTime);
                    checkInTime = null;
                }
            });

            // If still checked in at the end of logs or now
            if (checkInTime) {
                const endTime = (end < new Date()) ? end : new Date();
                userDuration += Math.max(0, differenceInMinutes(endTime, checkInTime));
            }

            totalDuration += userDuration;
            userDetailsMap[uid] = {
                name: user ? user.name : '알 수 없음',
                group: user ? user.user_group : '-',
                count: userLogs.filter(l => l.type === 'CHECKIN' || l.type === 'MOVE').length,
                duration: userDuration
            };
        });

        return {
            name: loc.name,
            duration: totalDuration,
            uniqueUsers: uniqueUserIds.size,
            userDetails: Object.values(userDetailsMap).sort((a, b) => b.duration - a.duration)
        };
    });

    // 2. Member Ranking
    const memberRanking = users.map(u => {
        const userLogs = filteredLogs.filter(l => l.user_id === u.id);
        const checkins = userLogs.filter(l => l.type === 'CHECKIN' || l.type === 'MOVE');
        return {
            id: u.id,
            name: u.name,
            count: checkins.length,
            duration: 0 // Simplification: can use same duration logic as above if needed
        };
    }).sort((a, b) => b.count - a.count);

    // 3. Time Series
    let interval;
    if (type === 'DAILY') interval = eachHourOfInterval({ start, end });
    else if (type === 'YEARLY') interval = eachMonthOfInterval({ start, end });
    else interval = eachDayOfInterval({ start, end });

    const timeSeries = interval.map(point => {
        const pStart = point;
        const pEnd = type === 'DAILY' ? new Date(point.getTime() + 3600000) :
            type === 'YEARLY' ? endOfMonth(point) : endOfDay(point);

        const pLogs = filteredLogs.filter(l => {
            const d = new Date(l.created_at);
            return d >= pStart && d <= pEnd;
        });

        return {
            date: point.toISOString(),
            visitCount: pLogs.filter(l => l.type === 'CHECKIN').length,
            totalDuration: pLogs.reduce((acc, l) => acc + (l.duration || 0), 0) // Assume log has duration or calculate
        };
    });

    // 4. Summaries
    const totalVisits = filteredLogs.filter(l => l.type === 'CHECKIN').length;
    const uniqueUsersSet = new Set(filteredLogs.map(l => l.user_id));
    const allDurations = roomAnalysis.map(r => r.duration);
    const totalDuration = allDurations.reduce((acc, d) => acc + d, 0);
    const avgDuration = uniqueUsersSet.size > 0 ? totalDuration / uniqueUsersSet.size : 0;

    return {
        roomAnalysis,
        memberRanking,
        timeSeries,
        totalVisits,
        uniqueUsers: uniqueUsersSet.size,
        avgDuration
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

    return users.map(u => {
        const uLogs = logs.filter(l => l.user_id === u.id && new Date(l.created_at) >= start && new Date(l.created_at) <= end);
        const uRes = responses.filter(r => r.user_id === u.id);

        const visitDays = new Set(uLogs.filter(l => l.type === 'CHECKIN').map(l => format(new Date(l.created_at), 'yyyy-MM-dd')));

        return {
            id: u.id,
            name: u.name,
            group: u.user_group,
            school: u.school,
            spaceDuration: uLogs.reduce((acc, l) => acc + (l.duration || 0), 0),
            visitDaysCount: visitDays.size,
            spaceCount: uLogs.filter(l => l.type === 'CHECKIN').length,
            programCount: uRes.filter(r => r.status === 'JOIN').length,
            attendedCount: uRes.filter(r => r.is_attended).length
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
    }
};
