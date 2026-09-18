export const PRESENCE_STARTED_AT_KEY = 'presence_started_at';
const RESET_18_KEY = 'presence_reset_18_date';
const RESET_22_KEY = 'presence_reset_22_date';

const seoulClock = now => ({
    date: new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now),
    hour: Number(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false,
    }).format(now)),
});

const timestampMap = status => {
    const value = status?.[PRESENCE_STARTED_AT_KEY];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export const resetStaffPresence = (date) => ({
    date,
    [PRESENCE_STARTED_AT_KEY]: {},
});

// A cutoff clears presence once. A later manual toggle remains in effect until
// the next cutoff, including when another client reloads during that interval.
export const reconcileStaffPresence = (stored, now = new Date()) => {
    const { date, hour } = seoulClock(now);
    const valid = stored && typeof stored === 'object' && !Array.isArray(stored);
    let status = valid ? stored : {};
    let changed = false;

    if (status.date !== date) {
        status = resetStaffPresence(date);
        changed = true;
    }
    if (hour >= 18 && status[RESET_18_KEY] !== date) {
        status = { ...resetStaffPresence(date), [RESET_18_KEY]: date };
        changed = true;
    }
    if (hour >= 22 && status[RESET_22_KEY] !== date) {
        status = { ...resetStaffPresence(date), [RESET_18_KEY]: date, [RESET_22_KEY]: date };
        changed = true;
    }
    return { status, changed };
};

export const updateStaffPresence = (status, userId, isPresent, changedAt = new Date().toISOString()) => {
    const nextStartedAt = { ...timestampMap(status) };
    if (isPresent) nextStartedAt[userId] = changedAt;
    else delete nextStartedAt[userId];

    return {
        ...status,
        [userId]: isPresent,
        [PRESENCE_STARTED_AT_KEY]: nextStartedAt,
    };
};

export const hasActiveStaff = status => Object.entries(status || {})
    .some(([key, value]) => key !== 'date' && key !== PRESENCE_STARTED_AT_KEY && value === true);

export const sortPresentStaffByStart = (staff, status) => {
    const startedAt = timestampMap(status);
    return [...staff].sort((a, b) => {
        const aTime = Date.parse(startedAt[a.id] || '');
        const bTime = Date.parse(startedAt[b.id] || '');
        const aKnown = Number.isFinite(aTime);
        const bKnown = Number.isFinite(bTime);

        // Existing active records predate timestamp tracking. Keep their
        // stable configuration order ahead of newly toggled records.
        if (aKnown !== bKnown) return aKnown ? 1 : -1;
        if (!aKnown) return 0;
        return aTime - bTime;
    });
};
