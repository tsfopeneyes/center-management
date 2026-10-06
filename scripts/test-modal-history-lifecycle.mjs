import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const listeners = new Map();
const entries = [{}];
const traversals = [];
const microtasks = [];
let index = 0;
let cleanup;
const window = {
    location: { pathname: '/admin' },
    history: {
        get state() { return entries[index]; },
        pushState(state) { entries.splice(index + 1); entries.push(state); index++; },
        back() { traversals.push(() => { index--; dispatch('popstate', { state: entries[index] }); }); },
    },
    addEventListener(type, callback, capture) {
        const list = listeners.get(type) || [];
        list.push({ callback, capture }); listeners.set(type, list);
    },
    removeEventListener(type, callback) {
        listeners.set(type, (listeners.get(type) || []).filter(item => item.callback !== callback));
    },
};
const dispatch = (type, properties) => {
    let stopped = false;
    const event = { ...properties, stopImmediatePropagation() { stopped = true; }, preventDefault() {} };
    const ordered = [...(listeners.get(type) || [])].sort((a, b) => Number(Boolean(b.capture)) - Number(Boolean(a.capture)));
    for (const { callback } of ordered) { callback(event); if (stopped) break; }
};
const settle = () => { while (microtasks.length || traversals.length) { while(microtasks.length) microtasks.shift()(); if(traversals.length) traversals.shift()(); } };
const source = readFileSync(new URL('../src/hooks/useModalClose.js', import.meta.url), 'utf8')
    .replace(/import .*?;\s*/, '').replaceAll('export const ', 'const ').replace('export default useModalClose;', 'globalThis.mount = useModalClose; globalThis.lockBody = useBodyScrollLock;');
const document = { body: { style: { overflow: '' } } };
const context = vm.createContext({ document, window, queueMicrotask: fn => microtasks.push(fn), useRef: value => ({ current: value }), useEffect: fn => { cleanup = fn(); } });
vm.runInContext(source, context);
const mount = (onClose, priority = 100) => { context.mount(true, onClose, { priority }); return cleanup; };

// Closing one screen and opening another before asynchronous popstate arrives.
let closed = 0;
let firstCleanup = mount(() => { closed++; firstCleanup(); });
settle();
dispatch('keydown', { key: 'Escape' });
assert.equal(closed, 1);
let nextCleanup = mount(() => { closed++; nextCleanup(); });
settle();
assert.equal(closed, 1, 'cleanup traversal must not dismiss the next roster');
dispatch('keydown', { key: 'Escape' }); settle();
assert.equal(closed, 2, 'next roster must remain responsive to Escape');

// Repeated rapid opens/closes cannot leave an inert top layer.
for (let i = 0; i < 20; i++) {
    const release = mount(() => {});
    settle();
    release();
    const another = mount(() => {});
    another();
    settle();
}
let parentClosed = 0, childClosed = 0;
let parentCleanup = mount(() => { parentClosed++; parentCleanup(); });
let childCleanup = mount(() => { childClosed++; childCleanup(); });
dispatch('keydown', { key: 'Escape' }); settle();
assert.equal(childClosed, 1);
assert.equal(parentClosed, 0, 'Escape must dismiss only the card above the roster');
dispatch('keydown', { key: 'Escape' }); settle();
assert.equal(parentClosed, 1);

// Real browser back closes the layer without scheduling another back.
let backClosed = 0;
let backCleanup = mount(() => { backClosed++; backCleanup(); });
settle(); window.history.back(); settle();
assert.equal(backClosed, 1);
assert.equal(traversals.length, 0);
console.log('Modal cleanup races, 20 rapid cycles, nested Escape and browser back passed');

// React effect order must not reverse the visually topmost overlay.
let previewClosed = 0, rosterClosed = 0, cardClosed = 0;
let cardCleanup = mount(() => { cardClosed++; cardCleanup(); }, 250);
let rosterCleanup = mount(() => { rosterClosed++; rosterCleanup(); }, 150);
let previewCleanup = mount(() => { previewClosed++; previewCleanup(); }, 10);
settle();
for (const expected of [[1,0,0],[1,1,0],[1,1,1]]) {
    dispatch('keydown', { key: 'Escape' }); settle();
    assert.deepEqual([cardClosed, rosterClosed, previewClosed], expected);
}
const reloadContext = vm.createContext({ document, window, queueMicrotask: fn => microtasks.push(fn), useRef: value => ({ current: value }), useEffect: fn => { cleanup = fn(); } });
vm.runInContext(source, reloadContext);
assert.equal(listeners.get('keydown').length, 1, 'hot reload must replace the Escape dispatcher');
assert.equal(listeners.get('popstate').length, 1, 'hot reload must replace the history dispatcher');
console.log('Child-first effect order and hot reload dispatcher replacement passed');

// Sheets and history layers can close in either order without restoring a stale lock.
for (const closeSheetFirst of [true, false]) {
    const releaseModal = mount(() => {});
    context.lockBody(true); const releaseSheet = cleanup;
    assert.equal(document.body.style.overflow, 'hidden');
    (closeSheetFirst ? releaseSheet : releaseModal)();
    assert.equal(document.body.style.overflow, 'hidden');
    (closeSheetFirst ? releaseModal : releaseSheet)(); settle();
    assert.equal(document.body.style.overflow, '', 'all owners gone restores page scrolling');
}
context.mount(true, () => {}, { lockScroll: false }); const releaseInline = cleanup;
assert.equal(document.body.style.overflow, '', 'inline navigation must not lock page scroll');
releaseInline(); settle();
console.log('Scroll ownership, both close orders and inline navigation passed');
