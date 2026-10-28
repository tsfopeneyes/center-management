const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const metadataCache = new Map();

export function getYouTubeVideo(value) {
    try {
        const input = value.replace(/[.,!?;:，。！？、…\])}]+$/u, '');
        const url = new URL(/^www\./i.test(input) ? `https://${input}` : input);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        let id;
        if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
        else if (YOUTUBE_HOSTS.has(url.hostname)) {
            if (url.pathname === '/watch') id = url.searchParams.get('v');
            else if (/^\/(shorts|embed|live)\//.test(url.pathname)) id = url.pathname.split('/')[2];
        }
        return VIDEO_ID.test(id || '') ? { id, url: url.href } : null;
    } catch {
        return null;
    }
}

export function extractYouTubeVideos(content) {
    const videos = new Map();
    for (const link of String(content || '').match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi) || []) {
        const video = getYouTubeVideo(link);
        if (video && !videos.has(video.id)) videos.set(video.id, video);
        if (videos.size === 3) break;
    }
    return [...videos.values()];
}

export function getYouTubeEmbedUrl(video) {
    if (!VIDEO_ID.test(video.id)) return null;
    const source = new URL(video.url);
    const rawStart = source.searchParams.get('start') || source.searchParams.get('t') || new URLSearchParams(source.hash.slice(1)).get('t') || '';
    let start = 0;
    if (/^\d+$/.test(rawStart)) start = Number(rawStart);
    else {
        const time = rawStart.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
        if (time) start = Number(time[1] || 0) * 3600 + Number(time[2] || 0) * 60 + Number(time[3] || 0);
    }
    const params = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0' });
    if (Number.isSafeInteger(start) && start > 0) params.set('start', String(start));
    return `https://www.youtube.com/embed/${video.id}?${params}`;
}

export function loadYouTubeMetadata(id) {
    if (!VIDEO_ID.test(id)) return Promise.resolve(null);
    const cached = metadataCache.get(id);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const entry = { expires: Date.now() + 30 * 60 * 1000 };
    entry.promise = Promise.resolve().then(async () => {
        const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Video metadata unavailable');
        const data = await response.json();
        if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('Missing video title');
        return { title: data.title.trim().slice(0, 300), author: typeof data.author_name === 'string' ? data.author_name.trim().slice(0, 120) : '' };
    }).catch(() => {
        entry.expires = Date.now() + 60 * 1000;
        return null;
    }).finally(() => clearTimeout(timeout));
    if (metadataCache.size >= 100) metadataCache.delete(metadataCache.keys().next().value);
    metadataCache.set(id, entry);
    return entry.promise;
}
