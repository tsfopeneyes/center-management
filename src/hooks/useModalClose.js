import { useEffect, useRef } from 'react';

const HISTORY_LAYER_KEY = '__sciHistoryLayer';
// Preserve live overlays and replace dispatchers across Vite hot updates.
const state = window.__sciModalHistory ??= { layers: [], pendingBack: false, flushQueued: false };
state.scrollOwners ??= new Set();
const topLayer = () => state.layers[state.layers.length - 1];
const syncScrollLock = () => {
    if (typeof document === 'undefined') return;
    if ((state.layers.some(layer => layer.lockScroll) || state.scrollOwners.size) && state.bodyOverflow === undefined) {
        state.bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    } else if (!state.layers.some(layer => layer.lockScroll) && !state.scrollOwners.size && state.bodyOverflow !== undefined) {
        document.body.style.overflow = state.bodyOverflow;
        state.bodyOverflow = undefined;
    }
};
const flushHistoryLayers = () => {
    state.flushQueued = false;
    if (state.pendingBack) return;
    state.layers.forEach(layer => {
        if (layer.registered) return;
        window.history.pushState({ ...window.history.state, [HISTORY_LAYER_KEY]: layer.token }, '');
        layer.registered = true;
    });
};
const queueHistoryFlush = () => {
    if (state.flushQueued) return;
    state.flushQueued = true;
    queueMicrotask(flushHistoryLayers);
};
const handlePopState = event => {
    if (state.pendingBack) {
        state.pendingBack = false;
        event.stopImmediatePropagation();
        flushHistoryLayers();
        return;
    }
    const layer = topLayer();
    if (!layer || layer.token === event.state?.[HISTORY_LAYER_KEY]) return;
    state.layers.pop();
    syncScrollLock();
    event.stopImmediatePropagation();
    layer.onBack();
};
const handleKeyDown = event => {
    if (event.key !== 'Escape') return;
    const layer = topLayer();
    if (!layer || !layer.handleEscape) return;
    // One dispatcher consumes Escape for the visually topmost surface.
    event.stopImmediatePropagation();
    event.preventDefault();
    layer.onBack();
};
if (state.popHandler) window.removeEventListener('popstate', state.popHandler, true);
if (state.keyHandler) window.removeEventListener('keydown', state.keyHandler, true);
state.popHandler = handlePopState;
state.keyHandler = handleKeyDown;
window.addEventListener('popstate', handlePopState, true);
window.addEventListener('keydown', handleKeyDown, true);

const registerHistoryLayer = (onBack, priority, handleEscape, lockScroll) => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.layers.push({ token, onBack, priority, handleEscape, lockScroll, pathname: window.location.pathname, registered: false });
    // React mounts child effects before parent effects: paint order must win.
    state.layers.sort((a, b) => a.priority - b.priority);
    syncScrollLock();
    queueHistoryFlush();
    return token;
};
const unregisterHistoryLayer = token => {
    const index = state.layers.findIndex(layer => layer.token === token);
    if (index === -1) return;
    const [entry] = state.layers.splice(index, 1);
    syncScrollLock();
    if (!entry.registered || window.history.state?.[HISTORY_LAYER_KEY] !== token
        || window.location.pathname !== entry.pathname) return;
    state.pendingBack = true;
    window.history.back();
};

export const useModalClose = (isOpen = true, onClose, { handleEscape = true, priority = 100, lockScroll = true } = {}) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
        if (!isOpen || typeof onCloseRef.current !== 'function') return;
        const token = registerHistoryLayer(() => onCloseRef.current?.(), priority, handleEscape, lockScroll);
        return () => unregisterHistoryLayer(token);
    }, [isOpen, handleEscape, priority, lockScroll]);
};
// Independent sheets share the same ownership rules as history overlays.
export const useBodyScrollLock = (isOpen) => {
    useEffect(() => {
        if (!isOpen) return;
        const owner = {};
        state.scrollOwners.add(owner);
        syncScrollLock();
        return () => { state.scrollOwners.delete(owner); syncScrollLock(); };
    }, [isOpen]);
};
export default useModalClose;
