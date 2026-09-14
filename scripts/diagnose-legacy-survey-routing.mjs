// Read-only report for assigning historical survey rows by their saved question snapshot.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { legacySurveyResponsesForSurvey } from '../src/utils/legacySurveyAnalytics.js';

const local = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const legacy = dotenv.parse(await fs.readFile('.env', 'utf8'));
const supabase = createClient(local.VITE_SUPABASE_URL || legacy.VITE_SUPABASE_URL, local.VITE_SUPABASE_ANON_KEY || legacy.VITE_SUPABASE_ANON_KEY);
const [{ data: surveys, error: surveyError }, { data: responses, error: responseError }, { data: users, error: userError }, { data: notes, error: noteError }, { data: notices, error: noticeError }] = await Promise.all([
  supabase.from('surveys').select('id,title,survey_type,is_legacy,config'),
  supabase.from('checkin_surveys').select('id,survey_id,survey_type,survey_snapshot,aggregation_excluded,user_id,created_at'),
  supabase.from('users').select('*'),
  supabase.from('visit_notes').select('id,user_id,visit_date,purpose'),
  supabase.from('notices').select('category,title,content').eq('category', 'SYSTEM'),
]);
if (surveyError) throw surveyError;
if (responseError) throw responseError;
if (userError) throw userError;
if (noteError) throw noteError;
if (noticeError) throw noticeError;
const titleOf = snapshot => snapshot?.question || snapshot?.qaQuestion || snapshot?.title || snapshot?.questions?.[0]?.title || '(스냅샷 없음)';
const snapshotCounts = (responses || []).reduce((counts, row) => {
  const key = `${row.survey_type || 'CHECKIN'} · ${titleOf(row.survey_snapshot)}`;
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const routed = (surveys || []).map(survey => {
  const rows = legacySurveyResponsesForSurvey({ survey, responses, visitNotes: notes, users, notices });
  return {
    survey: survey.title,
    count: rows.length,
    savedQuestionCounts: rows.reduce((counts, row) => { const key = titleOf(row.survey_snapshot || survey.config); counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
  };
});
console.log(JSON.stringify({ readOnly: true, routed, unassignedResponseSnapshots: snapshotCounts }, null, 2));
