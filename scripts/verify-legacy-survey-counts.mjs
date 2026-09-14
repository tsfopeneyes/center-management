// Read-only comparison of legacy survey list counting rules.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { countLegacySurveyResponses } from '../src/utils/legacySurveyAnalytics.js';

const local = dotenv.parse(await fs.readFile('.env.local', 'utf8'));
const legacy = dotenv.parse(await fs.readFile('.env', 'utf8'));
const supabase = createClient(
  local.VITE_SUPABASE_URL || legacy.VITE_SUPABASE_URL,
  local.VITE_SUPABASE_ANON_KEY || legacy.VITE_SUPABASE_ANON_KEY,
);

const [surveyResult, responseResult, noteResult, userResult, noticeResult] = await Promise.all([
  supabase.from('surveys').select('id,title,survey_type,is_legacy,config'),
  supabase.from('checkin_surveys').select('id,survey_id,survey_type,survey_snapshot,aggregation_excluded,user_id,created_at'),
  supabase.from('visit_notes').select('user_id,visit_date,purpose'),
  supabase.from('users').select('*'),
  supabase.from('notices').select('category,title,content').eq('category', 'SYSTEM'),
]);
for (const result of [surveyResult, responseResult, noteResult, userResult, noticeResult]) {
  if (result.error) throw result.error;
}
const surveys = surveyResult.data || [];
const responses = responseResult.data || [];

const activeResponses = (responses || []).filter(response => !response.aggregation_excluded);
const counts = (surveys || []).map(survey => ({
  id: survey.id,
  title: survey.title,
  type: survey.survey_type,
  isLegacy: survey.is_legacy,
  direct: activeResponses.filter(response => response.survey_id === survey.id).length,
  legacyType: activeResponses.filter(response => !response.survey_id && (response.survey_type || 'CHECKIN') === survey.survey_type).length,
}));
const legacyScreenCounts = countLegacySurveyResponses({
  surveys,
  responses,
  visitNotes: noteResult.data || [],
  users: userResult.data || [],
  notices: noticeResult.data || [],
});

console.log(JSON.stringify({ readOnly: true, legacyScreenCounts, surveys: counts }, null, 2));
