import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of [
    '../src/pages/PublicProgramDetail.jsx',
    '../src/components/student/NoticeModal.jsx',
]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(source.includes('hostUsers.length > 0'), `${file}: host section missing`);
    assert.ok(!source.includes("program_type === 'CENTER' && hostUsers.length > 0"),
        `${file}: school/church hosts are still hidden by a center-only condition`);
}
console.log('student program host sections are not limited to center programs');
