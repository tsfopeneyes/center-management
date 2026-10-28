import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const catalog = JSON.parse(await readFile('artifacts/repeat-mission-posts/schema.json', 'utf8'));
const read = name => {
    const fn = catalog.functions.find(f => f.name === name);
    assert.ok(fn, `Missing ${name}`);
    return fn.definition.replaceAll('\r\n', '\n');
};
const replaceBetween = (source, start, end, replacement) => {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, 'Unrecognized function layout');
    return source.slice(0, first) + replacement + source.slice(last);
};
const prepare = replaceBetween(read('prepare_online_challenge_submission'),
    "    IF v_mission.schedule_type = 'FIXED_DATE' THEN", '    RETURN NEW;',
    `    IF v_mission.schedule_type = 'FIXED_DATE' AND v_today <> v_mission.fixed_date THEN
        RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514';
    END IF;
    -- Every post keeps its own mission link. Goals limit progress, not writing.
    NEW.completion_key := NEW.post_id::text;
`);
const edit = replaceBetween(read('update_online_challenge_post'),
    "            IF v_mission.schedule_type = 'FIXED_DATE' THEN", '\n\n            IF v_submission.id IS NULL THEN',
    `            IF v_mission.schedule_type = 'FIXED_DATE' AND v_today <> v_mission.fixed_date THEN
                RAISE EXCEPTION '오늘 수행할 수 없는 미션입니다.' USING ERRCODE = '23514';
            END IF;
            v_completion_key := p_post_id::text;`);
const admin = replaceBetween(read('admin_set_online_post_mission'),
    "  IF v_mission.schedule_type = 'FIXED_DATE' THEN", '  IF v_submission.id IS NULL THEN',
    `  IF v_mission.schedule_type = 'FIXED_DATE' AND v_mission.fixed_date <> v_day THEN
    RAISE EXCEPTION '글 작성일과 미션 날짜가 다릅니다.' USING ERRCODE = '23514';
  END IF;
  v_key := p_post_id::text;
`);
const oldCount = '(SELECT count(*)::integer FROM public.online_challenge_submissions s';
const oldReward = read('settle_challenge_rewards_on_close');
assert.equal(oldReward.split(oldCount).length, 2);
const reward = oldReward.replace(oldCount, `(SELECT CASE WHEN m.schedule_type='DAILY'
            THEN count(DISTINCT s.completion_date)::integer ELSE count(*)::integer END
            FROM public.online_challenge_submissions s`);
const sql = '-- Preserve every existing post, submission, mission ID and reward.\n'
    + '-- Allow additional mission posts; DAILY progress still counts distinct days,\n'
    + '-- and FLEXIBLE/FIXED_DATE totals remain capped by the existing reward logic.\nBEGIN;\n'
    // Include the current identity-based sync contract so fresh installations
    // also retain the production fix for title-only edits after submissions.
    + [prepare, edit, admin, reward, read('sync_challenge_missions')].join(';\n\n') + ";\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n";
await writeFile('supabase/migrations/20261019030000_allow_repeat_mission_posts.sql', sql);
console.log('Prepared reviewed repeat-mission migration from current function definitions.');
