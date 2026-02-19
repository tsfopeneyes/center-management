const { createClient } = require('@supabase/supabase-js');
const { format, startOfDay, endOfDay, eachDayOfInterval, addDays, getDay, differenceInMinutes } = require('date-fns');

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be Service Role Key
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_SHEETS_WEBHOOK_URL) {
    console.error('Error: Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SHEETS_WEBHOOK_URL)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log(`[${new Date().toISOString()}] Starting Daily Operations...`);

    try {
        // 1. Auto Checkout - Force checkout any students still checked in
        await performAutoCheckout();

        // 2. Data Sync - Aggregate data and send to Google Sheets
        await performDataSync();

        console.log('Daily Operations Completed Successfully.');
    } catch (error) {
        console.error('Critical Error in Daily Operations:', error);
        process.exit(1);
    }
}

async function performAutoCheckout() {
    console.log('--- Step 1: Auto Checkout ---');

    // Find active check-ins (type='CHECKIN' with no matching 'CHECKOUT' for the user on the same day)
    // Actually, a simpler logic for "Currently Checked In" is usually maintaining a status field, 
    // but here we likely rely on logs. 
    // We'll look for CHECKINs from today that don't have a subsequent CHECKOUT.

    const todayStart = startOfDay(new Date()).toISOString();

    // Fetch today's logs
    const { data: logs, error } = await supabase
        .from('school_logs')
        .select('*')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true }); // Oldest first to track flow

    if (error) throw error;

    // Determine current status of each user
    const userStatus = {}; // { userId: { status: 'IN' | 'OUT', lastLog: log } }

    logs.forEach(log => {
        if (!userStatus[log.user_id]) userStatus[log.user_id] = { status: 'OUT' };

        if (log.type === 'CHECKIN') {
            userStatus[log.user_id] = { status: 'IN', lastLog: log };
        } else if (log.type === 'CHECKOUT') {
            userStatus[log.user_id] = { status: 'OUT', lastLog: log };
        }
    });

    const stuckUsers = Object.entries(userStatus)
        .filter(([_, data]) => data.status === 'IN')
        .map(([userId, data]) => ({ userId, lastLog: data.lastLog }));

    console.log(`Found ${stuckUsers.length} users needing auto-checkout.`);

    for (const { userId, lastLog } of stuckUsers) {
        // Calculate duration: from checkin time to 22:00 (End of operation)
        const checkInTime = new Date(lastLog.created_at);
        const autoCheckoutTime = new Date();
        autoCheckoutTime.setHours(22, 0, 0, 0); // 10:00 PM

        // If check-in was after 22:00 (rare but possible), use current time or just 0 duration
        let duration = differenceInMinutes(autoCheckoutTime, checkInTime);
        if (duration < 0) duration = 0;

        const { error: insertError } = await supabase.from('school_logs').insert({
            user_id: userId,
            location_id: lastLog.location_id, // Check out from where they checked in
            type: 'CHECKOUT',
            duration: duration,
            created_at: autoCheckoutTime.toISOString(), // Force time to 22:00
            remarks: '자동 퇴실 처리 (System Auto-Checkout)'
        });

        if (insertError) {
            console.error(`Failed to auto-checkout user ${userId}:`, insertError);
        } else {
            console.log(`Auto-checked out user ${userId} (Duration: ${duration}m)`);
        }
    }
}

async function performDataSync() {
    console.log('--- Step 2: Google Sheets Sync ---');

    // Fetch all necessary data
    const [
        { data: users },
        { data: logs },
        { data: responses },
        { data: notices },
        { data: locations },
        { data: visitNotes }
    ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('school_logs').select('*').order('created_at', { ascending: true }),
        supabase.from('program_responses').select('*'),
        supabase.from('notices').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('visit_notes').select('*')
    ]);

    // Re-use logic similar to integrationUtils.js but suitable for Node.js
    // We need to implement the processing logic here as we can't import the frontend file directly easily (ES modules vs CommonJS, browser deps).

    const adminIds = new Set(users.filter(u =>
        u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
    ).map(u => u.id));

    // 1. 회원정보
    const userLastVisitMap = new Map();
    logs.forEach(l => {
        if (l.type === 'CHECKIN' && !adminIds.has(l.user_id)) {
            const existing = userLastVisitMap.get(l.user_id);
            if (!existing || new Date(l.created_at) > new Date(existing)) {
                userLastVisitMap.set(l.user_id, l.created_at);
            }
        }
    });

    const userRows = users.filter(u => !adminIds.has(u.id)).map(u => ({
        'ID': u.id,
        '이름': u.name,
        '그룹': u.user_group || '-',
        '학교': u.school,
        '연락처': u.phone || '-',
        '생년월일': u.birth || '-',
        '가입일': u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd') : '-',
        '최근방문': userLastVisitMap.has(u.id) ? format(new Date(userLastVisitMap.get(u.id)), 'yyyy-MM-dd HH:mm') : '-'
    }));

    // 2. 회원 통계 (Simplified version of processUserAnalytics)
    // Calculate stats manually here
    const userStats = users.filter(u => !adminIds.has(u.id)).map(user => {
        const userLogs = logs.filter(l => l.user_id === user.id);
        const spaceLogs = userLogs.filter(l => !l.type.startsWith('PRG_'));

        let spaceDuration = 0;
        spaceLogs.forEach(l => { if (l.duration) spaceDuration += l.duration; });

        const uniqueDays = new Set(spaceLogs.map(l => format(new Date(l.created_at), 'yyyy-MM-dd')));

        const programRes = responses.filter(r => r.user_id === user.id);
        const attendedRes = programRes.filter(r => r.is_attended);

        return {
            '그룹': user.user_group,
            '학교': user.school,
            '이름': user.name,
            '누적 이용시간(분)': spaceDuration,
            '공간 방문 횟수': spaceLogs.filter(l => l.type === 'CHECKIN').length,
            '방문 일수': uniqueDays.size,
            '프로그램 신청': programRes.length,
            '실제 참석': attendedRes.length
        };
    }).filter(row => row['공간 방문 횟수'] > 0 || row['프로그램 신청'] > 0);

    // 3. 공간로그
    const logRows = logs.filter(l => !l.type?.startsWith('PRG_') && !adminIds.has(l.user_id)).map(log => {
        const u = users.find(user => user.id === log.user_id);
        const loc = locations.find(l => l.id === log.location_id);
        return {
            '일시': format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            '이름': u ? u.name : '알 수 없음',
            '학교': u ? u.school : '-',
            '장소': loc ? loc.name : '-',
            '유형': log.type === 'CHECKIN' ? '입실' : log.type === 'CHECKOUT' ? '퇴실' : log.type === 'MOVE' ? '이동' : log.type,
            '체류시간(분)': log.duration || 0
        };
    });

    // 4. 프로그램 실적
    // Basic aggregation
    const distinctPrograms = notices.filter(n => n.category === 'PROGRAM');
    const prgPerfRows = distinctPrograms.map(p => {
        const pResponses = responses.filter(r => r.notice_id === p.id);
        const joined = pResponses.length;
        const attended = pResponses.filter(r => r.is_attended).length;
        const rate = joined > 0 ? Math.round((attended / joined) * 100) : 0;

        return {
            '날짜': p.program_date || format(new Date(p.created_at), 'yyyy-MM-dd'),
            '카테고리': p.category,
            '프로그램명': p.title,
            '모집정원': p.max_capacity || '-',
            '신청인원': joined,
            '참석인원': attended,
            '출석률': `${rate}%`
        };
    });

    // 5. 프로그램 로그
    const prgDetailRows = responses.filter(res => !adminIds.has(res.user_id)).map(res => {
        const u = users.find(user => user.id === res.user_id);
        const notice = notices.find(n => n.id === res.notice_id);
        return {
            '프로그램날짜': notice ? notice.program_date : '-',
            '프로그램명': notice ? notice.title : '삭제됨',
            '이름': u ? u.name : '알 수 없음',
            '학교': u ? u.school : '-',
            '신청상태': res.status,
            '출석여부': res.is_attended ? '참석' : '미참석',
            '신청일시': res.created_at ? format(new Date(res.created_at), 'yyyy-MM-dd HH:mm') : '-'
        };
    });

    // 6. 일별 운영지표 (Last 30 days usually, but lets do all time daily aggregation)
    // Group by Date
    const dailyStatsMap = {};
    logs.forEach(log => {
        const dateKey = format(new Date(log.created_at), 'yyyy-MM-dd');
        if (!dailyStatsMap[dateKey]) dailyStatsMap[dateKey] = { visits: 0, duration: 0 };

        if (log.type === 'CHECKIN') dailyStatsMap[dateKey].visits++;
        if (log.duration) dailyStatsMap[dateKey].duration += log.duration;
    });

    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    const dailyRows = Object.entries(dailyStatsMap).sort((a, b) => b[0].localeCompare(a[0])).map(([date, stats]) => ({
        '날짜': date,
        '요일': dayLabels[new Date(date).getDay()],
        '방문 횟수': stats.visits,
        '총 이용시간(분)': Math.round(stats.duration)
    }));

    // 7. 학생방문일지
    // Needs aggregated sessions. Checking in -> Out session pairs.
    const visitRows = [];
    // ... Implementing a simplified version of session aggregation for brevity and robustness in Node script
    // Iterate users, then their logs, pair checkin/checkout
    for (const user of users) {
        if (adminIds.has(user.id)) continue;
        const userLogs = logs.filter(l => l.user_id === user.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let currentSession = null;
        userLogs.forEach(log => {
            if (log.type === 'CHECKIN') {
                currentSession = {
                    checkIn: log,
                    checkOut: null,
                    spaces: [],
                    moves: []
                };
                const loc = locations.find(l => l.id === log.location_id);
                if (loc) currentSession.spaces.push(loc.name);
            } else if (log.type === 'MOVE') {
                if (currentSession) {
                    const loc = locations.find(l => l.id === log.location_id);
                    if (loc) currentSession.spaces.push(loc.name);
                }
            } else if (log.type === 'CHECKOUT') {
                if (currentSession) {
                    currentSession.checkOut = log;
                    // Close session
                    const date = format(new Date(currentSession.checkIn.created_at), 'yyyy-MM-dd');
                    const key = `${user.id}_${date}`;
                    const note = visitNotes.find(n => n.user_id === user.id && n.visit_date === date) || {};

                    const duration = currentSession.checkOut.duration || 0; // The checkout log carries the duration sum usually

                    visitRows.push({
                        '주차': format(new Date(date), 'w') + '주차',
                        '날짜': date,
                        '요일': dayLabels[new Date(date).getDay()],
                        '학교': user.school,
                        '이름': user.name,
                        '시작': format(new Date(currentSession.checkIn.created_at), 'HH:mm'),
                        '종료': format(new Date(currentSession.checkOut.created_at), 'HH:mm'),
                        '공간': [...new Set(currentSession.spaces)].join(', '),
                        '체류시간': `${Math.floor(duration / 60)}시간 ${duration % 60}분`,
                        '방문목적': note.purpose || '',
                        '비고': note.remarks || ''
                    });
                    currentSession = null;
                }
            }
        });
    }


    // Payload Construction
    const payloads = [
        { tabName: '회원정보', rows: userRows, headers: ['ID', '이름', '그룹', '학교', '연락처', '생년월일', '가입일', '최근방문'] },
        { tabName: '회원통계', rows: userStats, headers: ['그룹', '학교', '이름', '누적 이용시간(분)', '공간 방문 횟수', '방문 일수', '프로그램 신청', '실제 참석'] },
        { tabName: '공간로그', rows: logRows, headers: ['일시', '이름', '학교', '장소', '유형', '체류시간(분)'] },
        { tabName: '프로그램실적', rows: prgPerfRows, headers: ['날짜', '카테고리', '프로그램명', '모집정원', '신청인원', '참석인원', '출석률'] },
        { tabName: '프로그램로그', rows: prgDetailRows, headers: ['프로그램날짜', '프로그램명', '이름', '학교', '신청상태', '출석여부', '신청일시'] },
        { tabName: '학생방문일지', rows: visitRows, headers: ['주차', '날짜', '요일', '학교', '이름', '시작', '종료', '공간', '체류시간', '방문목적', '비고'] },
        { tabName: '일별운영지표', rows: dailyRows, headers: ['날짜', '요일', '방문 횟수', '총 이용시간(분)'] }
    ].filter(p => p.rows.length > 0);

    // Send to Google Sheets
    console.log(`Sending ${payloads.length} tabs to Google Sheets...`);

    // Using fetch (Requires Node 18+ or node-fetch)
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ isBulk: true, payloads })
    });

    if (!response.ok) {
        throw new Error(`Google Sheets Webhook failed: ${response.statusText}`);
    }

    const result = await response.text();
    console.log('Google Sheets Output:', result);
}

main();
