// Read-only verification of the surveys currently assigned to center visits.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { validateDefinition } from '../src/utils/surveyModel.js';

const local = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const legacy = dotenv.parse(await fs.readFile('.env', 'utf8'));
const supabase = createClient(
  local.VITE_SUPABASE_URL || legacy.VITE_SUPABASE_URL,
  local.VITE_SUPABASE_ANON_KEY || legacy.VITE_SUPABASE_ANON_KEY,
);

const { data, error } = await supabase
  .from('survey_links')
  .select('id,event,center_code,enabled,frequency,is_default,version:survey_versions!survey_links_version_id_form_id_fkey(id,definition)')
  .in('event', ['CHECKIN', 'CHECKOUT'])
  .eq('enabled', true)
  .order('center_code')
  .order('event');
if (error) throw error;
const [{ data: legacySurveys, error: legacyError }, { data: legacyAssignments, error: assignmentError }] = await Promise.all([
  supabase.from('surveys').select('id,title,survey_type,status,config').eq('status', 'ACTIVE'),
  supabase.from('survey_assignments').select('survey_id,center_code,survey_type,enabled').eq('enabled', true),
]);
if (legacyError) throw legacyError;
if (assignmentError) throw assignmentError;

const assignments = (data || []).map(link => ({
  center: link.center_code,
  event: link.event,
  frequency: link.frequency,
  mode: link.is_default ? 'DEFAULT' : 'PRIMARY',
  title: link.version?.definition?.title || null,
  questionCount: link.version?.definition?.questions?.length || 0,
  valid: !validateDefinition(link.version?.definition),
}));
if (assignments.some(item => !item.valid)) throw new Error('An active visit survey has an invalid definition.');
for (const center of new Set(assignments.map(item => item.center))) for (const event of ['CHECKIN', 'CHECKOUT']) {
  const target = assignments.filter(item => item.center === center && item.event === event);
  if (target.filter(item => item.mode === 'PRIMARY').length > 1 || target.filter(item => item.mode === 'DEFAULT').length > 1) {
    throw new Error(`Conflicting visit survey slots: ${center} ${event}`);
  }
}

const legacyFallbacks = (legacySurveys || []).flatMap(survey => {
  const configuredCenters = survey.config?.exposure?.enabled === false ? [] : (survey.config?.exposure?.centers || []);
  const assignedCenters = (legacyAssignments || [])
    .filter(item => item.survey_id === survey.id && item.survey_type === survey.survey_type)
    .map(item => item.center_code);
  return [...new Set([...configuredCenters, ...assignedCenters])].map(center => ({
    center,
    event: survey.survey_type,
    title: survey.config?.question || survey.config?.qaQuestion || survey.title,
    source: 'legacy fallback',
  }));
});

console.log(JSON.stringify({ readOnly: true, assignments, legacyFallbacks }, null, 2));
