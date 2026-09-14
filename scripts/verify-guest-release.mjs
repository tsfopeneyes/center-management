import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const localHtml = await readFile('dist/index.html');
for (const origin of ['https://app.schoolchurchimpact.org', 'https://sci-center-6f265.web.app']) {
    const response = await fetch(origin, { cache: 'no-store' });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(hash(html), hash(localHtml));
    const path = html.match(/src="([^"]*assets[^" ]+\.js)"/)?.[1];
    assert.ok(path);
    const asset = await fetch(new URL(path, origin), { cache: 'no-store' });
    assert.equal(asset.status, 200);
    const contents = Buffer.from(await asset.arrayBuffer());
    assert.equal(hash(contents), hash(await readFile('dist' + path)));
    for (const marker of ['apply_guest_program_session', 'guest_program_session_applications', '태어난 연도 4자리']) {
        assert.ok(contents.toString().includes(marker), 'Missing deployed feature: ' + marker);
    }
    console.log(JSON.stringify({ origin, path, matchesBuiltRelease: true, guestDailyAndBirthdayFeatures: true }));
}
