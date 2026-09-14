export const PRESENCE_STARTED_AT_KEY = 'presence_started_at';

const timestampMap = status => {
    const value = status?.[PRESENCE_STARTED_AT_KEY];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export const resetStaffPresence = (date) => ({
    date,
    [PRESENCE_STARTED_AT_KEY]: {},
});

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
