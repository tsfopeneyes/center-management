import { POLICY, StatisticsError } from './policy.mjs';

// Only trusted server code receives these plans; HTTP input never selects tables or columns.
const DEFINITIONS = Object.freeze({
    users: ['users', 'id,user_group', ['id']],
    staff: ['staff_directory', 'id,role', ['id']],
    locations: ['locations', 'id', ['id']],
    logs: ['logs', 'id,user_id,type,location_id,created_at', ['created_at', 'id'], 'created_at'],
    notices: ['notices', 'id,category,program_date,created_at,program_status,is_recruiting', ['id']],
    responses: ['notice_responses', 'notice_id,user_id,status,is_attended,is_staff', ['notice_id', 'user_id']],
    sessions: ['daily_program_sessions', 'id,notice_id,session_date,status,voided_at', ['id']],
    sessionResponses: ['daily_program_session_responses', 'session_id,user_id,status,is_attended', ['session_id', 'user_id']],
    openAttendance: ['open_program_attendance', 'notice_id,user_id,attendance_date', ['notice_id', 'attendance_date', 'user_id'], 'attendance_date'],
});
export const SOURCE_NAMES = Object.freeze(Object.keys(DEFINITIONS));
const allowedFields = select => select.split(',').map(field => field.includes(':') ? field.split(':')[0] : field);
export const rowKey = (row, keys) => JSON.stringify(keys.map(key => {
    const value = row[key];
    if ((typeof value !== 'string' && !Number.isSafeInteger(value)) || value === '') throw new StatisticsError('source_incomplete');
    return value;
}));
function compare(left, right) {
    for (let i = 0; i < left.length; i++) {
        if (typeof left[i] !== typeof right[i]) throw new StatisticsError('source_incomplete');
        // pg returns bigint IDs as decimal strings. Compare their numeric
        // ordering, not lexical "10" < "2", while UUID/date keys stay lexical.
        if (typeof left[i] === 'string' && /^-?(?:0|[1-9]\d*)$/.test(left[i]) && /^-?(?:0|[1-9]\d*)$/.test(right[i])) {
            const a = BigInt(left[i]), b = BigInt(right[i]);
            if (a !== b) return a < b ? -1 : 1;
            continue;
        }
        if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
    }
    return 0;
}
export function sourcePlans(window) {
    return SOURCE_NAMES.map(name => {
        const [table, select, order, date] = DEFINITIONS[name];
        const dateOnly = ['booking_date', 'attendance_date'].includes(date);
        const filters = date ? [[date, 'gte', dateOnly ? window.startDay : window.start],
            [date, 'lt', dateOnly ? window.endDay : window.end]] : [];
        if (name === 'notices') filters.push(['category', 'eq', 'PROGRAM']);
        return { name, table, select, order: [...order], filters };
    });
}
export async function readAllPages(readPage, plan) {
    const rows = [], seen = new Map();
    let after = null;
    for (let pages = 0; pages < Math.ceil(POLICY.maxSourceRows / POLICY.pageSize) + 1; pages++) {
        let page;
        try { page = await readPage({ ...plan, after, limit: POLICY.pageSize }); }
        catch { throw new StatisticsError('source_incomplete'); }
        if (!page || page.complete !== true || !Array.isArray(page.rows) ||
            page.rows.length > POLICY.pageSize || typeof page.hasMore !== 'boolean') throw new StatisticsError('source_incomplete');
        let cursor = after;
        for (const input of page.rows) {
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StatisticsError('source_incomplete');
            const row = Object.fromEntries(allowedFields(plan.select).map(key => [key, input[key]]));
            if (Object.values(row).some(value => value === undefined)) throw new StatisticsError('source_incomplete');
            const tuple = plan.order.map(key => row[key]);
            const key = rowKey(row, plan.order), serialized = JSON.stringify(row);
            if (seen.has(key)) {
                if (seen.get(key) !== serialized) throw new StatisticsError('source_incomplete');
                continue;
            }
            if (cursor && compare(tuple, cursor) <= 0) throw new StatisticsError('source_incomplete');
            seen.set(key, serialized); rows.push(row); cursor = tuple;
            if (rows.length > POLICY.maxSourceRows) throw new StatisticsError('source_incomplete');
        }
        if (!page.hasMore) return rows;
        if (!cursor || (after && compare(cursor, after) <= 0)) throw new StatisticsError('source_incomplete');
        after = cursor;
    }
    throw new StatisticsError('source_incomplete');
}
// Adapter contract: readPage implements READ ONLY keyset queries in one consistent
// server snapshot. It must not use offset, treat errors as empty, or silently cap rows.
// This module intentionally contains no credential, Supabase client, RPC or fetch.
export function createSourceReader({ readPage } = {}) {
    return async window => {
        if (typeof readPage !== 'function') throw new StatisticsError('not_configured');
        const datasets = {};
        for (const plan of sourcePlans(window)) datasets[plan.name] = await readAllPages(readPage, plan);
        return { complete: true, datasets };
    };
}
