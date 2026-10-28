import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build, transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const compiled = await build({
    entryPoints: ['src/components/common/CommunityMention.jsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
});
const componentModule = { exports: {} };
vm.runInNewContext(compiled.outputFiles[0].text, { module: componentModule, exports: componentModule.exports, require, URL });
const render = (text, candidates = []) => renderToStaticMarkup(React.createElement(componentModule.exports.CommunityMentionText, { candidates }, text));
const video = 'https://youtu.be/sU97JT_RUCU?si=o05WlaldszXOLN8_';
assert.ok(render(video).includes(`href="${video}"`), 'YouTube URL and query survive unchanged');
assert.ok(render(video).includes('target="_blank" rel="noopener noreferrer"'));
assert.ok(render('www.example.com').includes('href="https://www.example.com"'));
assert.ok(render('(https://example.com/a_(b)).').includes('href="https://example.com/a_(b)"'));
assert.equal((render('https://a.com\nhttps://b.com').match(/<a /g) || []).length, 2);
const mentions = render('@예서 https://example.com/@예서', [{ name: '예서' }]);
assert.equal((mentions.match(/<span /g) || []).length, 1, 'URL path does not become a mention');
assert.ok(mentions.includes('href="https://example.com/@예서"'));
assert.ok(!render('javascript:alert(1) https:// <script>alert(1)</script>').includes('<a '));
assert.ok(render('<script>alert(1)</script>').includes('&lt;script&gt;'));
assert.equal(render('일반 댓글\n둘째 줄'), '<p class="">일반 댓글\n둘째 줄</p>');

const hookSource = await transform(await readFile('src/hooks/useCommentReactionLongPress.js', 'utf8'), { format: 'cjs' });
let timer, request, mobile = true;
const hookModule = { exports: {} };
vm.runInNewContext(hookSource.code, {
    module: hookModule, exports: hookModule.exports,
    require: () => ({ useEffect() {}, useRef: () => ({ current: null }), useState: () => [null, value => { request = value; }] }),
    window: { matchMedia: () => ({ matches: mobile }) }, navigator: { vibrate() {} },
    setTimeout: callback => { timer = callback; return 1; }, clearTimeout: () => { timer = null; }, Date,
});
const { bindLongPress } = hookModule.exports.default();
const handlers = bindLongPress('comment-1');
const event = (interactive = false, touches = 1) => ({ target: { closest: () => interactive ? {} : null }, touches: Array(touches).fill({}) });
handlers.onTouchStart(event(true));
assert.ok(!timer, 'Link/control long press must not start reaction timer');
let prevented = false;
handlers.onContextMenu({ ...event(true), preventDefault: () => { prevented = true; } });
assert.equal(prevented, false, 'Preserve native link menu');
handlers.onTouchStart(event());
assert.equal(typeof timer, 'function');
timer(); timer = null;
assert.equal(request.commentId, 'comment-1', 'Ordinary comment long press still opens reactions');
for (const cancel of ['onTouchEnd', 'onTouchMove', 'onTouchCancel']) {
    handlers.onTouchStart(event()); handlers[cancel]();
    assert.equal(timer, null, `${cancel} cancels reaction timer`);
}
handlers.onTouchStart(event(false, 2)); assert.equal(timer, null, 'Ignore multitouch');
mobile = false;
handlers.onTouchStart(event()); assert.equal(timer, null, 'No long press timer on desktop');
console.log('Comment links passed: URL rendering, punctuation, mentions, escaping, native link menu, reaction long press, scroll/cancel and multitouch.');
