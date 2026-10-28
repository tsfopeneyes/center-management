import assert from 'node:assert/strict';
import { fetchRestPages } from '../src/utils/fetchRestPages.js';

// Newest 1,000 rows are after July; the older rows must still reach analytics.
const source = Array.from({ length: 1207 }, (_, id) => ({ id, created_at: id < 1000 ? '2026-07-01' : '2026-06-01' }));
for (const cap of [1000, 200, 500]) {
    const calls = [];
    const rows = await fetchRestPages(async path => {
        const params = new URLSearchParams(path.split('?')[1]);
        calls.push(params);
        const offset = Number(params.get('offset'));
        return source.slice(offset, offset + Math.min(cap, Number(params.get('limit'))));
    }, 'logs?select=*&order=created_at.desc,id.asc&limit=10000');
    assert.deepEqual(rows, source);
    assert.equal(rows.filter(row => row.created_at < '2026-07-01').length, 207);
    assert.ok(calls.every(params => params.get('order') === 'created_at.desc,id.asc'));
}
await assert.rejects(fetchRestPages(async path => {
    if (new URLSearchParams(path.split('?')[1]).get('offset') === '0') return source.slice(0, 500);
    throw new Error('network failure');
}, 'logs?order=id.asc'), /network failure/);
console.log('Statistics history pagination passed, including server caps and partial failures.');
