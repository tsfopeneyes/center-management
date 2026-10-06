import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/utils/visitLifecycle.js', import.meta.url), 'utf8');
const now = new Date('2026-10-06T09:00:00Z');
const history = Array.from({ length: 140 }, (_, index) => ({
    id: `old-${index}`, user_id: 'frequent-student', type: index % 2 ? 'CHECKOUT' : 'CHECKIN',
    location_id: 'center', created_at: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(),
}));
const today = { id: 'today-in', user_id: 'frequent-student', type: 'CHECKIN',
    location_id: 'center', created_at: '2026-10-06T07:00:00Z' };
const calls = [];
let records = [...history, today];
const request = async path => {
    calls.push(path);
    const query = new URLSearchParams(path.split('?')[1]);
    const bounds = query.getAll('created_at');
    const lower = bounds.find(value => value.startsWith('gte.'))?.slice(4);
    const upper = bounds.find(value => value.startsWith('lt.'))?.slice(3);
    return records.filter(row => (!lower || row.created_at >= lower) && (!upper || row.created_at < upper))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(Number(query.get('offset') || 0), Number(query.get('offset') || 0) + Number(query.get('limit')));
};
const moduleSource = source.replace(/^import .*;\r?\n/gm, '');
globalThis.__visitHistoryRequest = request;
const visit = await import(`data:text/javascript;base64,${Buffer.from(
    'const requestSupabaseRest = globalThis.__visitHistoryRequest;\n' + moduleSource
).toString('base64')}`);
assert.equal((await visit.getTodayVisitState('frequent-student', now)).status, 'ACTIVE');
assert.ok(calls[0].includes('order=created_at.asc,id.asc'));
records.push({ ...today, id: 'today-out', type: 'CHECKOUT', created_at: '2026-10-06T08:00:00Z' });
assert.equal((await visit.getTodayVisitState('frequent-student', now)).status, 'CHECKED_OUT');
records = Array.from({ length: 1000 }, (_, index) => ({ ...today, id: `today-${index}` }));
records.push({ ...today, id: 'last-out', type: 'CHECKOUT', created_at: '2026-10-06T08:00:00Z' });
calls.length = 0;
assert.equal((await visit.getTodayVisitState('frequent-student', now)).status, 'CHECKED_OUT');
assert.equal(calls.length, 2, 'Read checkout beyond the first page');
records = [{ ...today, created_at: '2026-10-05T14:59:59Z' },
    { ...today, created_at: '2026-10-06T15:00:00Z' }];
assert.equal((await visit.getTodayVisitState('frequent-student', now)).status, 'NOT_CHECKED_IN');
delete globalThis.__visitHistoryRequest;
console.log('Visit history, pagination, and KST day boundary checks passed.');
