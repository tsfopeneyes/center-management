export const NOTIFICATION_ROUTE_DEFAULTS = {
    HAIFN: {
        line: { visit: true, program: true, coffee_chat: true, rental: false },
        slack: { visit: true, program: true, coffee_chat: true, rental: true },
    },
    ENOUGH_PLACE: {
        line: { visit: true, program: true, coffee_chat: true, rental: false },
        slack: { visit: false, program: false, coffee_chat: false, rental: false },
    },
};

export const normalizeNotificationRouteConfig = (value) => {
    let parsed = value;
    if (typeof value === 'string') {
        try { parsed = JSON.parse(value); } catch { parsed = {}; }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    return Object.fromEntries(Object.entries(NOTIFICATION_ROUTE_DEFAULTS).map(([centerCode, channels]) => [
        centerCode,
        Object.fromEntries(Object.entries(channels).map(([channel, categories]) => [
            channel,
            Object.fromEntries(Object.entries(categories).map(([category, fallback]) => [
                category,
                typeof parsed?.[centerCode]?.[channel]?.[category] === 'boolean'
                    ? parsed[centerCode][channel][category]
                    : fallback,
            ])),
        ])),
    ]));
};
