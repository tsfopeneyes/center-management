export const DAILY_SESSION_MODE = 'SESSION_RSVP';
export const SCHEDULE_MODE_RECURRING = 'RECURRING';
export const APPLICATION_SCOPE_PROGRAM = 'PROGRAM';
export const APPLICATION_SCOPE_SESSION = 'SESSION';
export const MAX_DAILY_SESSION_FIELDS = 5;

export const usesDailySessionRsvp = (notice) => (
    notice?.category === 'PROGRAM'
    && !notice?.is_challenge
    && (
        (notice?.is_recruiting === true
            && notice?.guest_properties?.schedule_mode === SCHEDULE_MODE_RECURRING
            && notice?.guest_properties?.application_scope === APPLICATION_SCOPE_SESSION)
        // Read old open-program sessions until every existing record has been edited.
        || (notice?.is_recruiting === false
            && notice?.guest_properties?.open_participation_mode === DAILY_SESSION_MODE)
    )
);

// Session-based programs exposed this count before the setting existed. Keep
// that legacy behaviour while requiring an explicit opt-in for older programs.
export const shouldShowApplicationCount = notice => (
    notice?.guest_properties?.show_application_count
    ?? usesDailySessionRsvp(notice)
);

export const isRecurringProgram = notice => (
    notice?.guest_properties?.schedule_mode === SCHEDULE_MODE_RECURRING
    || Boolean(notice?.program_start_date && notice?.program_end_date && notice?.program_days?.length)
);

const toKstDay = value => {
    if (!value) return null;
    const key = String(value).slice(0, 10);
    const date = new Date(`${key}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const isProgramOccurrenceDate = (notice, value) => {
    if (!isRecurringProgram(notice)) return String(notice?.program_date || '').slice(0, 10) === String(value || '').slice(0, 10);
    const target = toKstDay(value);
    const start = toKstDay(notice?.program_start_date);
    const end = toKstDay(notice?.program_end_date);
    const days = (notice?.program_days || []).map(Number);
    return Boolean(target && start && end && target >= start && target <= end && days.includes(target.getDay()));
};

export const getNextProgramOccurrence = (notice, from = new Date()) => {
    if (!isRecurringProgram(notice)) return String(notice?.program_date || '').slice(0, 10) || null;
    const start = toKstDay(notice?.program_start_date);
    const end = toKstDay(notice?.program_end_date);
    if (!start || !end) return null;
    const cursor = toKstDay(getKstDateString(from));
    if (!cursor) return null;
    if (cursor < start) cursor.setTime(start.getTime());
    while (cursor <= end) {
        if (isProgramOccurrenceDate(notice, getKstDateString(cursor))) return getKstDateString(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
    return null;
};

export const countProgramOccurrences = notice => {
    if (!isRecurringProgram(notice)) return notice?.program_date ? 1 : 0;
    const start = toKstDay(notice?.program_start_date);
    const end = toKstDay(notice?.program_end_date);
    if (!start || !end) return 0;
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        if (isProgramOccurrenceDate(notice, getKstDateString(cursor))) count += 1;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
};

export const listProgramOccurrences = (notice, from = new Date(), limit = 100) => {
    if (!isRecurringProgram(notice)) {
        const date = String(notice?.program_date || '').slice(0, 10);
        return date ? [date] : [];
    }
    const start = toKstDay(notice?.program_start_date);
    const end = toKstDay(notice?.program_end_date);
    const fromDay = toKstDay(getKstDateString(from));
    if (!start || !end || !fromDay) return [];
    const cursor = new Date(fromDay > start ? fromDay : start);
    const dates = [];
    while (cursor <= end && dates.length < limit) {
        const key = getKstDateString(cursor);
        if (isProgramOccurrenceDate(notice, key)) dates.push(key);
        cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
};

export const getKstDateString = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);

const cleanField = (field, index) => ({
    id: String(field?.id || `field-${index + 1}`),
    label: String(field?.label || '').trim(),
    required: field?.required !== false,
});

export const createDailySessionField = (index = 0) => ({
    id: `field-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    required: true,
});

export const getDailySessionFields = (noticeOrSettings) => {
    const settings = noticeOrSettings?.guest_properties || noticeOrSettings || {};
    if (Array.isArray(settings.daily_session_fields)) {
        return settings.daily_session_fields
            .slice(0, MAX_DAILY_SESSION_FIELDS)
            .map(cleanField)
            .filter(field => field.label);
    }
    return [{ id: 'field-1', label: '오늘의 안내', required: true }];
};

export const getDailySessionValues = (notice, session) => {
    if (Array.isArray(session?.session_fields) && session.session_fields.length) {
        return session.session_fields
            .map((field, index) => ({
                ...cleanField(field, index),
                value: String(field?.value || '').trim(),
            }))
            .filter(field => field.label && field.value);
    }
    return [];
};

export const getDailySessionHosts = (session) => {
    const setting = (Array.isArray(session?.session_fields) ? session.session_fields : [])
        .find(field => field?.id === '__session_hosts' && field?.type === 'hosts');
    return Array.isArray(setting?.hosts) ? setting.hosts.filter(host => host?.host_id) : null;
};

export const formatDailySessionSchedule = (session) => {
    if (!session?.starts_at) return '';
    const date = new Date(session.starts_at);
    if (Number.isNaN(date.getTime())) return '';
    const dateParts = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short'
    }).formatToParts(date).map(part => [part.type, part.value]));
    const timeParts = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: true
    }).formatToParts(date).map(part => [part.type, part.value]));
    const minute = Number(timeParts.minute || 0);
    return `${Number(dateParts.month)}/${Number(dateParts.day)}(${dateParts.weekday}) ${timeParts.dayPeriod} ${Number(timeParts.hour)}시${minute ? ` ${minute}분` : ''}`;
};

export const getDailySessionRegistrationBlockReason = (notice, now = Date.now()) => {
    const session = notice?.today_session;
    if (['COMPLETED', 'CANCELLED'].includes(notice?.program_status) || notice?.guest_properties?.is_ended === true)
        return '종료된 프로그램입니다.';
    if (!session || session.voided_at)
        return '신청받는 회차가 없습니다.';
    if (session.status !== 'OPEN' || !Number.isFinite(Date.parse(session.starts_at)) || Number(now) >= Date.parse(session.starts_at))
        return '이번 회차 신청이 마감되었습니다.';
    return null;
};
