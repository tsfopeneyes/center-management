import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { isPullRefresh, refreshVisibleData, subscribeDataRefresh } from '../src/utils/dataRefresh.js';

const gesture = { startX: 0, startY: 0, endX: 5, endY: 100, scrollTop: 0 };
assert.equal(isPullRefresh(gesture), true, 'pull down from the top, including zero coordinates');
assert.equal(isPullRefresh({ ...gesture, scrollTop: 200 }), false, 'ordinary scrolling must not refresh');
assert.equal(isPullRefresh({ ...gesture, endX: 120 }), false, 'horizontal tab swipe must not refresh');
assert.equal(isPullRefresh({ ...gesture, endY: 50 }), false, 'small movements must not refresh');
assert.equal(isPullRefresh({ ...gesture, endY: -100 }), false, 'upward scroll must not refresh');

const browser = new EventTarget();
let finish;
let complete = false;
const stop = subscribeDataRefresh(() => new Promise(resolve => { finish = resolve; }), browser);
const refresh = refreshVisibleData(browser).then(() => { complete = true; });
await Promise.resolve();
assert.equal(complete, false, 'refresh must wait for content reads');
finish();
await refresh;
assert.equal(complete, true);
stop();
const stopFailed = subscribeDataRefresh(() => { throw new Error('offline'); }, browser);
await assert.rejects(refreshVisibleData(browser), /offline/, 'failed reads reach the refresh feedback');
stopFailed();
await refreshVisibleData(browser);

// Exercise the actual page handler with isolated touch and read fixtures.
const source = readFileSync(new URL('../src/pages/StudentDashboard.jsx', import.meta.url), 'utf8');
let handler;
const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'onTouchEnd') handler = node.init;
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
    }
};
walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
assert.ok(handler);
let calls = 0, finishRead, busy = false, failure = '';
const start = { current: { startX: 0, startY: 0, scrollTop: 0 } };
const inFlight = { current: false };
const noop = () => {};
const onTouchEnd = new Function('pullStart', 'pullRefreshInFlight', 'isPullRefresh', 'refreshVisibleData',
    'setPullRefreshing', 'setPullRefreshError', 'setTouchStartX', 'setTouchStartY', 'setTouchEndX', 'setTouchEndY',
    `const touchStartX=null,touchStartY=null,touchEndX=null,touchEndY=null; return (${source.slice(handler.start, handler.end)});`
)(start, inFlight, isPullRefresh, () => { calls++; return new Promise(resolve => { finishRead = resolve; }); },
    value => { busy = value; }, value => { failure = value; }, noop, noop, noop, noop);
const touch = { changedTouches: [{ clientX: 0, clientY: 100 }] };
onTouchEnd(touch);
assert.equal(calls, 1);
assert.equal(busy, true);
start.current = { startX: 0, startY: 0, scrollTop: 0 };
onTouchEnd(touch);
assert.equal(calls, 1, 'duplicate pulls share the pending refresh');
finishRead();
await new Promise(resolve => setImmediate(resolve));
assert.equal(busy, false);
assert.equal(inFlight.current, false);
assert.equal(failure, '');
console.log('PASS pull gestures, scroll/swipe exclusion, read completion, errors and listener cleanup');
