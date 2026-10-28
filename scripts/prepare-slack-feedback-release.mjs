import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const recovery = 'artifacts/slack-feedback-fix/recovery';
const release = 'artifacts/slack-feedback-fix/release';
await fs.cp(`${recovery}/supabase`, `${release}/supabase`, { recursive: true });
const before = await fs.readFile(`${recovery}/supabase/functions/slack-tsf/index.ts`, 'utf8');
let source = await fs.readFile('supabase/functions/slack-tsf/index.ts', 'utf8');
// Keep the separate, previously uncommitted statistics work local. Release only
// the feedback fix against the downloaded production function and its helpers.
source = source.replace(/^import .*operationStatistics\/slack.mjs.*\r?\n/m, '');
const visitStart = 'export async function getVisitMetrics';
const programStart = 'export async function getProgramMetrics';
source = source.slice(0, source.indexOf(visitStart))
    + before.slice(before.indexOf(visitStart), before.indexOf(programStart))
    + source.slice(source.indexOf(programStart));
const statisticsStart = source.indexOf('  const statisticsNotices =', source.indexOf(programStart));
assert.ok(statisticsStart > 0);
const returnStart = source.indexOf('  return {', statisticsStart);
source = source.slice(0, statisticsStart) + source.slice(returnStart);
source = source.replace(/    statistics_v2: statistics,\r?\n    statistics_v2_definition: [^\n]+\r?\n/, '');
assert.ok(!source.includes('statistics_v2'));
assert.ok(source.includes('supabaseSelectAll("survey_entries"'));
await fs.writeFile(`${release}/supabase/functions/slack-tsf/index.ts`, source);
console.log(`Prepared feedback-only release in ${release}`);
