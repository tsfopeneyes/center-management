// Removing the previous iframe stops playback, including duplicate video cards.
let activePreview = null;
const listeners = new Set();
export const subscribeYouTubePlayback = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
export const getActiveYouTubePreview = () => activePreview;
export const getServerYouTubePreview = () => null;
export function activateYouTubePreview(token) {
    if (activePreview === token) return;
    activePreview = token;
    listeners.forEach(listener => listener());
}
export function stopYouTubePreview(token) {
    if (activePreview === token) activateYouTubePreview(null);
}
