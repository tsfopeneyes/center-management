import assert from 'node:assert/strict';
import { extractYouTubeVideos, getYouTubeVideo, getYouTubeEmbedUrl, isYouTubeOnlyComment, loadYouTubeMetadata } from '../src/utils/youtubePreview.js';
import { activateYouTubePreview, getActiveYouTubePreview, stopYouTubePreview, subscribeYouTubePlayback } from '../src/utils/youtubePlayback.js';

const id = 'sU97JT_RUCU';
for (const url of [
    `https://youtu.be/${id}?si=abc&t=42`, `https://www.youtube.com/watch?v=${id}&t=42`,
    `https://m.youtube.com/watch?v=${id}`, `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`, `www.youtube.com/embed/${id}`,
]) assert.equal(getYouTubeVideo(url)?.id, id, url);
for (const url of [
    `https://youtube.com.evil.example/watch?v=${id}`, `https://evil.example/${id}`,
    `javascript:alert(1)`, `https://youtube.com/watch?v=bad`, `https://youtube.com/playlist?list=${id}`,
    `https://user:pass@youtube.com/watch?v=${id}`,
]) assert.equal(getYouTubeVideo(url), null, url);
assert.equal(extractYouTubeVideos(`(https://youtu.be/${id}). https://youtube.com/watch?v=${id}`).length, 1, 'Deduplicate same video');
assert.equal(extractYouTubeVideos(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd'].map(v => `https://youtu.be/${v}`).join('\n')).length, 3, 'Limit preview count');
assert.deepEqual(extractYouTubeVideos('일반 댓글'), []);
assert.equal(isYouTubeOnlyComment(`https://youtu.be/${id}`),true,'Replace a link-only comment with its card');
assert.equal(isYouTubeOnlyComment(`같이 봐요 https://youtu.be/${id}`),false,'Preserve text surrounding links');
assert.equal(isYouTubeOnlyComment(['aaaaaaaaaaa','bbbbbbbbbbb','ccccccccccc','ddddddddddd'].map(id=>`https://youtu.be/${id}`).join('\n')),false,'Keep original links when preview limit would hide a video');
assert.ok(getYouTubeVideo(`https://youtu.be/${id}?t=42`).url.endsWith('?t=42'), 'Preserve playback timestamp');
for (const [timestamp, expected] of [['42', '42'], ['1m30s', '90'], ['1h2m3s', '3723']]) {
    const embed = new URL(getYouTubeEmbedUrl({ id, url: `https://youtu.be/${id}?t=${timestamp}` }));
    assert.equal(embed.origin, 'https://www.youtube.com');
    assert.equal(embed.searchParams.get('start'), expected);
    assert.equal(embed.searchParams.get('autoplay'), '1');
    assert.equal(embed.searchParams.get('playsinline'), '1');
}
assert.equal(getYouTubeEmbedUrl({ id: 'bad', url: 'https://youtu.be/bad' }), null);
const firstCard = Symbol('first'), secondCard = Symbol('second');
let changes = 0;
const unsubscribe = subscribeYouTubePlayback(() => { changes++; });
activateYouTubePreview(firstCard);
assert.equal(getActiveYouTubePreview(), firstCard);
activateYouTubePreview(secondCard);
assert.equal(getActiveYouTubePreview(), secondCard, 'Only the latest card remains active');
stopYouTubePreview(firstCard);
assert.equal(getActiveYouTubePreview(), secondCard, 'Unmounting old player cannot stop the new player');
stopYouTubePreview(secondCard);
assert.equal(getActiveYouTubePreview(), null, 'Closing active player stops playback');
assert.equal(changes, 3);
unsubscribe();

const originalFetch = globalThis.fetch;
let calls = 0;
try {
    globalThis.fetch = async (url, options) => {
        calls++;
        assert.ok(url.startsWith('https://www.youtube.com/oembed?'));
        assert.equal(options.credentials, 'omit');
        return { ok: true, json: async () => ({ title: ' 영상 제목 ', author_name: ' 채널 이름 ', html: '<script>ignored</script>' }) };
    };
    const [first, duplicate] = await Promise.all([loadYouTubeMetadata(id), loadYouTubeMetadata(id)]);
    assert.deepEqual(first, { title: '영상 제목', author: '채널 이름' });
    assert.deepEqual(first, duplicate);
    await loadYouTubeMetadata(id);
    assert.equal(calls, 1, 'Cache and deduplicate in-flight metadata requests');
    assert.equal(await loadYouTubeMetadata('bad'), null);
    assert.equal(calls, 1, 'Reject invalid ID without request');
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    assert.equal(await loadYouTubeMetadata('aaaaaaaaaaa'), null, 'Deleted/private video fallback');
    globalThis.fetch = async () => { throw new Error('network failed'); };
    assert.equal(await loadYouTubeMetadata('bbbbbbbbbbb'), null, 'Network failure fallback');
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ title: null }) });
    assert.equal(await loadYouTubeMetadata('ccccccccccc'), null, 'Malformed metadata fallback');
} finally { globalThis.fetch = originalFetch; }
console.log('YouTube comment previews passed: formats, host validation, timestamps, deduplication, limits, metadata caching, and failure fallbacks.');
