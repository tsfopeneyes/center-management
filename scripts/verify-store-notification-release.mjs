import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const origin = 'https://sci-center-6f265.web.app';
const request = async path => {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`Release request failed: ${response.status}`);
  return response.text();
};
const html = await request(`/?release_check=${Date.now()}`);
const localHtml = await readFile('dist/index.html', 'utf8');
const scriptAssets = text => [...text.matchAll(/(?:src|href)="(\/assets\/[^"<>]+\.js)"/g)].map(match => match[1]).sort();
assert.deepEqual(scriptAssets(html), scriptAssets(localHtml), 'published HTML must reference current build');
let checked = 0;
for (const filename of await readdir('dist/assets')) {
  if (!filename.endsWith('.js') || filename.includes('-legacy.')) continue;
  const content = await readFile(`dist/assets/${filename}`, 'utf8');
  if (!content.includes('STORE_APPLICATION')) continue;
  const live = await request(`/assets/${filename}`);
  const hash = text => createHash('sha256').update(text).digest('hex');
  assert.equal(hash(live), hash(content), 'published store notification asset must match verified build');
  checked++;
}
assert.ok(checked > 0, 'store event marker must exist in production build');
console.log(JSON.stringify({ origin, result: 'verified', storeAssetsChecked: checked }));
