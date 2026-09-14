// All live-space screens must derive occupancy from the same event state machine.
// A CHECKOUT event is final for its visit, including when events share a timestamp.
const VISIT_EVENT_ORDER = {
    CHECKIN: 0,
    GUEST_ENTRY: 0,
    MOVE: 1,
    CHECKOUT: 2,
};

export const sortVisitLogsChronologically = (logs = []) => [...logs].sort((a, b) => {
    const timeDifference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDifference !== 0) return timeDifference;

    return (VISIT_EVENT_ORDER[a.type] ?? 0) - (VISIT_EVENT_ORDER[b.type] ?? 0);
});

export const calculateCurrentLocations = (logs = [], now = new Date()) => {
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const nowKstHour = Number.parseInt(
        now.toLocaleTimeString('en-US', { timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit' }),
        10
    );
    const isPast22 = nowKstHour >= 22;
    const currentLocations = {};

    sortVisitLogsChronologically(logs).forEach((log) => {
        if (!['CHECKIN', 'MOVE', 'CHECKOUT'].includes(log.type)) return;

        // Every normal check-in, checkout, and QR guest session has a user id.
        // Keep an isolated fallback key for legacy anonymous records so they
        // cannot accidentally clear another visitor's state.
        const key = log.user_id || `guest_${log.id}`;
        const logDateStr = new Date(log.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const isToday = logDateStr === todayStr;

        if (log.type === 'CHECKOUT') {
            currentLocations[key] = null;
            return;
        }

        if (!isToday || isPast22) {
            currentLocations[key] = null;
            return;
        }

        if (log.type === 'CHECKIN') {
            currentLocations[key] = {
                locId: log.location_id,
                checkInTime: log.created_at,
                isGuest: !log.user_id,
            };
            return;
        }

        currentLocations[key] = {
            locId: log.location_id,
            checkInTime: currentLocations[key]?.checkInTime || log.created_at,
            isGuest: !log.user_id,
        };
    });

    return currentLocations;
};

// Realtime delivers one changed row at a time. Keep the same newest-first,
// bounded snapshot used by the initial REST query without downloading the
// whole log history again after every event.
export const mergeRealtimeVisitLog = (logs = [], payload = {}, limit = 3000) => {
    const nextRow = payload.new;
    const previousRow = payload.old;
    const rowId = nextRow?.id || previousRow?.id;

    if (!rowId) return null;

    const remaining = logs.filter(log => log.id !== rowId);
    if (payload.eventType !== 'DELETE' && nextRow) remaining.push(nextRow);

    return remaining
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
};

export const countActiveUsersByGroup = ({ currentLocations = {}, users = [], locations = [], groups = [], isStaff }) => {
    const staffIds = new Set(users.filter(user => isStaff?.(user)).map(user => user.id));
    const locationById = new Map(locations.map(location => [location.id, location]));
    const counts = Object.fromEntries(groups.map(group => [group.id, 0]));
    counts.unassigned = 0;

    Object.entries(currentLocations).forEach(([userId, details]) => {
        if (!details?.locId || (!details.isGuest && staffIds.has(userId))) return;
        const location = locationById.get(details.locId);
        if (!location) return;
        if (location.group_id && Object.prototype.hasOwnProperty.call(counts, location.group_id)) counts[location.group_id] += 1;
        else counts.unassigned += 1;
    });

    return counts;
};
