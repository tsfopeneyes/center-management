const refreshEvent = 'center-data-refresh';

export function subscribeDataRefresh(read, browser = window) {
    const listener = event => event.detail.waitUntil(Promise.resolve().then(read));
    browser.addEventListener(refreshEvent, listener);
    return () => browser.removeEventListener(refreshEvent, listener);
}

export async function refreshVisibleData(browser = window) {
    const reads = [];
    browser.dispatchEvent(new CustomEvent(refreshEvent, {
        detail: { waitUntil: promise => reads.push(promise) },
    }));
    let timer;
    try {
        await Promise.race([
            Promise.all(reads),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('데이터를 불러오는 데 시간이 걸리고 있어요. 다시 시도해 주세요.')), 15000); }),
        ]);
    } finally { clearTimeout(timer); }
}

export function isPullRefresh({ startX, startY, endX, endY, scrollTop }) {
    return scrollTop <= 0 && endY - startY >= 80
        && endY - startY > Math.abs(endX - startX) * 1.5;
}
