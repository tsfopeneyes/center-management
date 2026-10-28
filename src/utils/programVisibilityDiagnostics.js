import { usesDailySessionRsvp } from './dailyProgramSessions';

export function programVisibilityDiagnostics({ notices = [], responses = {}, allPrograms = [], filteredPrograms = [], homePrograms = [], regionState, readState, school, dashboardConfig = [] }) {
    const allowed = new Set(allPrograms.map(n => String(n.id)));
    const current = new Set(filteredPrograms.map(n => String(n.id)));
    const home = new Set(homePrograms.map(n => String(n.id)));
    const config = dashboardConfig.find(item => item.id === 'programs');
    const limit = config?.count || 10;
    const shown = new Set([
        ...homePrograms.filter(n => responses[n.id] === 'JOIN'),
        ...homePrograms.filter(n => !n.is_recruiting && responses[n.id] !== 'JOIN').slice(0, limit),
        ...homePrograms.filter(n => n.is_recruiting && responses[n.id] !== 'JOIN').slice(0, limit),
    ].map(n => String(n.id)));
    const programs = notices.filter(n => n.category === 'PROGRAM'
        && (!n.is_private || ['JOIN', 'WAITLIST'].includes(responses[n.id]))
        && (n.program_status === 'ACTIVE' || current.has(String(n.id)) || home.has(String(n.id)))).map(n => {
        const id = String(n.id);
        let reason;
        if (readState?.failed) reason = '목록 갱신에 실패해 이전 정보를 표시 중이에요';
        else if (usesDailySessionRsvp(n) && n.today_session?.status !== 'OPEN') reason = '오늘 신청할 회차가 열리지 않았어요';
        else if (!allowed.has(id)) reason = regionState?.region ? '프로그램 공개 지역과 학교 지역이 달라요' : '학교 지역을 확인하지 못해 표시를 보류 중이에요';
        else if (n.program_status === 'CANCELLED') reason = '취소된 프로그램이에요';
        else if (!current.has(id) && !home.has(id)) reason = '표시할 진행 기간이 지났어요';
        else if (config?.isVisible === false) reason = '홈 프로그램 영역이 꺼져 있어요';
        else if (!shown.has(id)) reason = '홈 표시 개수 밖에 있어요. 전체 보기에서 확인해 주세요';
        else reason = responses[n.id] === 'JOIN' ? '홈의 내가 신청한 프로그램에 표시 중이에요' : '홈의 신청·참여 프로그램에 표시 중이에요';
        return { id, title: n.title, application: responses[n.id] || 'NONE', reason };
    });
    return {
        school: school || '학교 정보 없음',
        region: regionState?.region || null,
        regionStatus: regionState?.status || 'idle',
        regionCheckedAt: regionState?.checkedAt || null,
        attempts: regionState?.attempts || 0,
        listCheckedAt: readState?.checkedAt || null,
        listFailed: Boolean(readState?.failed),
        receivedPrograms: programs.length,
        programs,
    };
}

export function visibilityDiagnosticText(info) {
    return JSON.stringify({
        capturedAt: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        appBuild: typeof document === 'undefined' ? null : document.querySelector('script[type="module"][src]')?.getAttribute('src')?.split('/').pop() || null,
        ...info,
    }, null, 2);
}
