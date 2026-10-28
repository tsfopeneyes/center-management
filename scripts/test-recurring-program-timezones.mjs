import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const moduleUrl = new URL('../src/utils/dailyProgramSessions.js',import.meta.url).href;
const modelTest = fileURLToPath(new URL('./test-recurring-program-model.mjs',import.meta.url));
for (const zone of ['Asia/Seoul','UTC','America/Los_Angeles','America/New_York']) {
    const env = {...process.env,TZ:zone};
    const result=spawnSync(process.execPath,[modelTest],{env,encoding:'utf8'});
    assert.equal(result.status,0,`${zone}: ${result.stderr}`);
    const boundary=spawnSync(process.execPath,['--input-type=module','-e',`
        import assert from 'node:assert/strict';
        import {countProgramOccurrences,listProgramOccurrences} from ${JSON.stringify(moduleUrl)};
        for(const [start,end,expected] of [
            ['2026-10-30','2026-11-03',['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03']],
            ['2026-03-06','2026-03-10',['2026-03-06','2026-03-07','2026-03-08','2026-03-09','2026-03-10']],
        ]) {
            const notice={program_start_date:start,program_end_date:end,program_days:[0,1,2,3,4,5,6]};
            assert.equal(countProgramOccurrences(notice),5);
            assert.deepEqual(listProgramOccurrences(notice,new Date(start+'T00:00:00+09:00')),expected);
        }
    `],{env,encoding:'utf8'});
    assert.equal(boundary.status,0,`${zone} DST boundary: ${boundary.stderr}`);
}
console.log('PASS recurring programs: same Korean weekdays and daily occurrences in KST, UTC, and both US DST boundaries.');
