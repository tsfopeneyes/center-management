// Read-only verification for the legacy program feedback template migration.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const local = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const legacy = dotenv.parse(await fs.readFile('.env', 'utf8'));
const supabase = createClient(
  local.VITE_SUPABASE_URL || legacy.VITE_SUPABASE_URL,
  local.VITE_SUPABASE_ANON_KEY || legacy.VITE_SUPABASE_ANON_KEY,
);

const { data: programs, error: programError } = await supabase
  .from('notices')
  .select('id,title,guest_properties')
  .eq('category', 'PROGRAM');
if (programError) throw programError;

const active = (programs || []).filter(program => program.guest_properties?.enable_feedback);
const { data: links, error: linkError } = await supabase
  .from('survey_links')
  .select('id,form_id,version_id,notice_id,event,enabled,frequency,audience,timing,form:survey_forms(title,kind,owner_notice_id)')
  .eq('event', 'PROGRAM')
  .eq('enabled', true);
if (linkError) throw linkError;
const { data: feedbackRows, error: feedbackError } = await supabase
  .from('program_feedback')
  .select('notice_id')
  .in('notice_id', active.map(program => program.id));
if (feedbackError) throw feedbackError;

const missing = active.filter(program => {
  const hasLegacyQuestions = (program.guest_properties?.custom_feedback_config?.questions || []).length > 0;
  return hasLegacyQuestions && !program.guest_properties?.survey_version_id;
});
const migrated = active.map(program => {
  const link = (links || []).find(item => String(item.notice_id) === String(program.id));
  return {
    id: program.id,
    title: program.title,
    surveyTitle: link?.form?.title || null,
    surveyKind: link?.form?.kind || null,
    ownerNoticeId: link?.form?.owner_notice_id || null,
    separateLink: link?.id || null,
    frequency: link?.frequency || null,
    audience: link?.audience || null,
    timing: link?.timing || null,
    legacyResponses: (feedbackRows || []).filter(row => String(row.notice_id) === String(program.id)).length,
  };
});

console.log(JSON.stringify({ readOnly: true, activeProgramsStillMissingSurvey: missing.length, programs: migrated }, null, 2));
