const missingChunkPattern = /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically imported module/i;
const retryKey = 'center-missing-chunk-reloaded-at';

export const isMissingChunkError = error => missingChunkPattern.test(String(error?.message || error || ''));

export function installChunkRecovery(browser = window) {
    const reloadOnce = () => {
        let lastAttempt = 0;
        try { lastAttempt = Number(browser.sessionStorage.getItem(retryKey)) || 0; } catch { /* Storage may be unavailable. */ }
        if (Date.now() - lastAttempt < 60_000) return false;
        try { browser.sessionStorage.setItem(retryKey, String(Date.now())); } catch { /* Reload still works. */ }
        browser.location.reload();
        return true;
    };
    browser.addEventListener('vite:preloadError', event => {
        if (reloadOnce()) event.preventDefault();
    });
    browser.addEventListener('unhandledrejection', event => {
        if (isMissingChunkError(event.reason) && reloadOnce()) event.preventDefault();
    });
}
