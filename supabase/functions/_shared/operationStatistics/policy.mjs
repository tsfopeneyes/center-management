// Resource limits are not disclosure thresholds. No population/month-only rule.
export const POLICY = Object.freeze({ version: 'center-statistics-v2', maxSourceRows: 100_000, pageSize: 500 });
export const FAMILIES = Object.freeze(['visits', 'programs', 'duration']);
export class StatisticsError extends Error {
    constructor(code) { super(code); this.name = 'StatisticsError'; this.code = code; }
}
export const dayKst = value => {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) throw new StatisticsError('source_incomplete');
    return new Date(time + 9 * 3_600_000).toISOString().slice(0, 10);
};
export const validDay = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const shift = (day, days) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
export function periodWindow(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(k => !['kind', 'date'].includes(k)) || !validDay(input.date) ||
        !['day', 'week', 'month'].includes(input.kind)) throw new StatisticsError('invalid_request');
    let startDay = input.date, endDay;
    if (input.kind === 'day') endDay = shift(startDay, 1);
    if (input.kind === 'week') {
        const weekday = new Date(startDay + 'T00:00:00Z').getUTCDay();
        startDay = shift(startDay, weekday === 0 ? -6 : 1 - weekday); endDay = shift(startDay, 7);
    }
    if (input.kind === 'month') {
        startDay = startDay.slice(0, 7) + '-01';
        const date = new Date(startDay + 'T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + 1);
        endDay = date.toISOString().slice(0, 10);
    }
    return Object.freeze({ kind: input.kind, startDay, endDay, key: `${input.kind}:${startDay}`,
        start: new Date(startDay + 'T00:00:00+09:00').toISOString(),
        end: new Date(endDay + 'T00:00:00+09:00').toISOString() });
}
function previous(window) {
    const date = window.kind === 'month' ? shift(window.startDay, -1)
        : shift(window.startDay, window.kind === 'week' ? -7 : -1);
    return periodWindow({ kind: window.kind, date });
}
export function validateRequest(input, now = new Date()) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(k => !['period', 'metrics', 'compare', 'breakdown'].includes(k))) throw new StatisticsError('invalid_request');
    const window = periodWindow(input.period);
    if (window.startDay > dayKst(now.toISOString())) throw new StatisticsError('invalid_request');
    if (input.compare != null && input.compare !== 'previous') throw new StatisticsError('invalid_request');
    const metrics = input.metrics ?? [...FAMILIES], breakdown = input.breakdown ?? 'none';
    if (!Array.isArray(metrics) || !metrics.length || metrics.length > FAMILIES.length ||
        metrics.some(k => !FAMILIES.includes(k)) || new Set(metrics).size !== metrics.length ||
        !['none', 'program', 'session'].includes(breakdown)) throw new StatisticsError('invalid_request');
    return { windows: input.compare ? [previous(window), window] : [window],
        metrics: FAMILIES.filter(k => metrics.includes(k)), breakdown };
}
