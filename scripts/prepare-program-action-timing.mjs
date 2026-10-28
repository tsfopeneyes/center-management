import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const baseline = JSON.parse(await readFile('artifacts/program-action-timing/baseline.json', 'utf8'));
const replace = (source, before, after) => {
    assert.equal(source.split(before).length, 2, 'Expected exactly one reviewed replacement');
    return source.replace(before, after);
};
let transition = baseline.find(f => f.proname === 'program_application_transition').definition;
transition = replace(transition,
    `IF v_program.recruitment_deadline IS NOT NULL\n        AND clock_timestamp() >= v_program.recruitment_deadline THEN`,
    `IF v_program.recruitment_deadline IS NOT NULL\n        AND clock_timestamp() >= v_program.recruitment_deadline\n        AND NOT (p_action = 'CANCEL' AND v_program.is_challenge IS DISTINCT FROM true\n            AND coalesce(v_program.guest_properties->>'schedule_mode', '') <> 'RECURRING'\n            AND v_program.program_date IS NOT NULL AND clock_timestamp() < v_program.program_date) THEN`);
let guard = baseline.find(f => f.proname === 'guard_survey_entry').definition;
guard = replace(guard,
    `IF public.survey_program_end_at(to_jsonb(program)) IS NULL OR now() < public.survey_program_end_at(to_jsonb(program)) THEN RAISE EXCEPTION 'Survey opens after the program ends'; END IF;`,
    `IF program.is_recruiting IS TRUE AND program.is_challenge IS DISTINCT FROM true\n+       AND coalesce(program.guest_properties->>'schedule_mode', '') <> 'RECURRING' THEN\n+       IF program.program_date IS NULL OR now() < program.program_date THEN RAISE EXCEPTION 'Survey opens after the program starts'; END IF;\n+     ELSE\n+       IF public.survey_program_end_at(to_jsonb(program)) IS NULL OR now() < public.survey_program_end_at(to_jsonb(program)) THEN RAISE EXCEPTION 'Survey opens after the program ends'; END IF;\n+     END IF;`.replaceAll('\n+', '\n'));
await writeFile('supabase/migrations/20261023010000_program_participant_action_timing.sql',
    '-- Ordinary signup programs: cancellation until start, feedback from start.\n-- Preserve recruitment, participation, attendance, reward and answer validation. No row updates.\nBEGIN;\n'
    + transition + ';\n' + guard + ";\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n");
