import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateAnswers, validateDefinition, comparePrograms, legacyDefinition, programSurveyEndAt, recommendationsFor } from '../src/utils/surveyModel.js';
import { feedbackRating, legacyFeedbackDisplay } from '../src/utils/programFeedbackModel.js';
import { countLegacySurveyResponses, legacySurveyResponsesForSurvey } from '../src/utils/legacySurveyAnalytics.js';

const definition = { title: '공통 만족도', questions: [
    { id: 'rating', title: '얼마나 만족하나요?', type: 'star', metric: 'satisfaction', required: true },
    { id: 'reason', title: '좋았던 활동', type: 'multiple', options: ['대화', '활동'], required: false },
    { id: 'comment', title: '의견', type: 'text', required: false }
] };
assert.equal(validateDefinition(definition), null);
assert.ok(validateAnswers(definition, { rating: 0 }));
assert.ok(validateAnswers(definition, { rating: 4, reason: ['없는 선택지'] }));
assert.ok(validateAnswers(definition, { rating: 4, reason: ['대화','대화'] }));
assert.ok(validateAnswers(definition, { rating: 4, unknown: 'injected' }));
assert.equal(validateAnswers(definition, { rating: 4, reason: [] }), null);
const recommendedDefinition = { title: '추천', questions: [{ id: 'pick', title: '선택', type: 'multiple', options: ['휴식', '대화'], recommendationsEnabled: true, optionDetails: [{ emoji: '🍵', title: '티타임', text: '잠시 쉬어가세요.' }, {}] }] };
assert.deepEqual(recommendationsFor(recommendedDefinition, { pick: ['휴식', '대화'] }), [{ id: 'pick:휴식', option: '휴식', emoji: '🍵', title: '티타임', text: '잠시 쉬어가세요.' }]);
assert.equal(legacyDefinition({ mode:'FEEDBACK_QA',qaQuestion:'소감' },'기존').questions[0].type,'text');
assert.equal(programSurveyEndAt({program_date:'2026-09-10T01:00:00Z',program_duration:'1시간 30분'}),Date.parse('2026-09-10T02:30:00Z'));
assert.equal(feedbackRating({q3_satisfaction:5,q8_additional_comments:'{"q1":"좋아요"}',notices:{guest_properties:{custom_feedback_config:{questions:[{id:'q1',type:'text',title:'소감'}]}}}}),null);
assert.equal(feedbackRating({snapshot:definition,answers:{}}),null);
assert.equal(feedbackRating({snapshot:definition,answers:{rating:3}}),3);
const legacyDisplay=legacyFeedbackDisplay({q8_additional_comments:'{"q_idx_0":"답변"}'},{title:'예전',guest_properties:{custom_feedback_config:{questions:[{title:'질문',type:'text'}]}}});
assert.equal(Object.values(legacyDisplay.answers)[0],'답변');
const changed = structuredClone(definition); changed.questions[0].title='다른 질문';
const comparison = comparePrograms([
    {notice_id:'A',snapshot:definition,answers:{rating:4}},
    {notice_id:'A',snapshot:definition,answers:{rating:2}},
    {notice_id:'A',snapshot:definition,answers:{rating:5},aggregation_excluded:true},
    {notice_id:'B',snapshot:definition,answers:{}},
    {notice_id:'B',snapshot:changed,answers:{rating:5}}
]);
assert.equal(comparison.filter(g=>g.question.type==='star').length,2);
assert.equal(comparison[0].programs.A.sum/comparison[0].programs.A.count,3);
assert.equal(comparison[0].programs.B.count,0);
const legacyCounts = countLegacySurveyResponses({
    surveys: [
        { id: 'legacy-in', survey_type: 'CHECKIN', is_legacy: true },
        { id: 'legacy-out', survey_type: 'CHECKOUT', is_legacy: true },
        { id: 'custom-in', title: '센터에 어떤 것들이 있으면 좋을까요?', survey_type: 'CHECKIN', is_legacy: false, config: { question: '센터에 어떤 것들이 있으면 좋을까요?' } }
    ],
    users: [{ id: 'member', name: '회원' }, { id: 'admin', name: 'admin' }],
    responses: [
        { id: 1, user_id: 'member', survey_id: null, survey_type: 'CHECKIN', created_at: '2026-09-01T01:00:00Z' },
        { id: 2, user_id: 'member', survey_id: null, survey_type: 'CHECKIN', created_at: '2026-09-01T02:00:00Z' },
        { id: 3, user_id: 'member', survey_id: 'custom-in', survey_type: 'CHECKIN', created_at: '2026-09-01T03:00:00Z' },
        { id: 4, user_id: 'member', survey_id: null, survey_type: 'CHECKOUT', created_at: '2026-09-01T04:00:00Z' },
        { id: 5, user_id: 'admin', survey_id: null, survey_type: 'CHECKIN', created_at: '2026-09-02T01:00:00Z' }
        ,{ id: 6, user_id: 'member', survey_id: null, survey_type: 'CHECKIN', survey_snapshot: { question: '센터에서 어떤 것들이 있으면 좋을까요?' }, created_at: '2026-09-02T03:00:00Z' }
    ],
    visitNotes: [
        { user_id: 'member', visit_date: '2026-09-01', purpose: '교제' },
        { user_id: 'member', visit_date: '2026-09-02', purpose: '교제' },
        { user_id: 'member', visit_date: '2026-09-03', purpose: '해당 없음' }
    ],
    notices: [{ category: 'SYSTEM', title: 'CHECKOUT_SURVEY_CONFIG', content: JSON.stringify({ options: [{ label: '교제' }] }) }]
});
assert.deepEqual(legacyCounts, { 'legacy-in': 1, 'legacy-out': 2, 'custom-in': 2 });
const restoredCheckoutRows = legacySurveyResponsesForSurvey({
    survey: { id: 'legacy-out', survey_type: 'CHECKOUT', is_legacy: true },
    responses: [
        { id: 4, user_id: 'member', survey_id: null, survey_type: 'CHECKOUT', created_at: '2026-09-01T04:00:00Z' },
    ],
    visitNotes: [
        { user_id: 'member', visit_date: '2026-09-01', purpose: '교제' },
        { user_id: 'member', visit_date: '2026-09-02', purpose: '교제' },
    ],
    users: [{ id: 'member', name: '회원' }],
    notices: [{ category: 'SYSTEM', title: 'CHECKOUT_SURVEY_CONFIG', content: JSON.stringify({ options: [{ label: '교제' }] }) }],
});
assert.equal(restoredCheckoutRows.length, legacyCounts['legacy-out']);
assert.equal(restoredCheckoutRows.filter(row => row.restored_from_visit_note).length, 1);

const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE account_merge_worker;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.staff',true),''),'false')::boolean $$;
 CREATE FUNCTION public.is_current_profile(id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.uid()=id,false) $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,account_merge_worker;
 CREATE TABLE users(id uuid PRIMARY KEY,name text);
 CREATE TABLE notices(id bigint PRIMARY KEY,title text,guest_properties jsonb DEFAULT '{}',program_date timestamptz,program_end_date date,program_duration text,program_status text,is_review_required boolean,haifn_reward integer);
 CREATE TABLE notice_responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notice_id bigint,user_id uuid,status text,is_attended boolean);
 CREATE TABLE locations(id text PRIMARY KEY,name text);
 CREATE TABLE logs(id bigint PRIMARY KEY,user_id uuid,location_id text,type text,created_at timestamptz DEFAULT now());
 CREATE TABLE haifn_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,amount integer,transaction_type text,source_description text);
 CREATE TABLE checkin_surveys(id bigint PRIMARY KEY,raw text); INSERT INTO checkin_surveys VALUES(1,'입퇴실 원본');
 CREATE TABLE program_feedback(id bigint PRIMARY KEY,notice_id bigint,user_id uuid,raw text); INSERT INTO program_feedback(id,raw) VALUES(1,'프로그램 원본');
`);
await db.exec(await readFile(new URL('../supabase/manual/proposals/20260910_unified_surveys.sql',import.meta.url),'utf8'));
// Later production migrations classify forms before public delivery channels
// are introduced. Keep this focused schema test independent of notice fields.
await db.exec(`ALTER TABLE survey_forms ADD COLUMN kind text NOT NULL DEFAULT 'SURVEY';`);
await db.exec(await readFile(new URL('../supabase/migrations/20260914060000_add_public_survey_channels.sql',import.meta.url),'utf8'));
assert.equal((await db.query('SELECT raw FROM checkin_surveys')).rows[0].raw,'입퇴실 원본');
assert.equal((await db.query('SELECT raw FROM program_feedback')).rows[0].raw,'프로그램 원본');
let checks = 0;
const id = n => [10,11,20,21].includes(n) ? n : `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query = (sql, params=[])=>db.query(sql,params);
const rejects = async (sql,params=[])=>{ await assert.rejects(()=>query(sql,params)); checks++; };
await query(`INSERT INTO users VALUES ($1,'회원'),($2,'다른 회원')`,[id(1),id(2)]);
await query(`INSERT INTO locations VALUES ($1,'하이픈'),($2,'이높플레이스')`,[id(3),id(4)]);
await query(`INSERT INTO notices(id,title,program_date,program_status,is_review_required,haifn_reward) VALUES ($1,'A 프로그램',CURRENT_DATE-1,'COMPLETED',true,10),($2,'B 프로그램',CURRENT_DATE+1,'ACTIVE',true,10)`,[id(10),id(11)]);
await query(`INSERT INTO notice_responses(notice_id,user_id,status,is_attended) VALUES ($1,$2,'JOIN',true),($3,$2,'JOIN',true)`,[id(10),id(1),id(11)]);
await query(`INSERT INTO logs VALUES ($1,$2,$3,'CHECKIN',now()),($4,$2,$3,'CHECKOUT',now())`,[id(20),id(1),id(3),id(21)]);
await db.exec(`SET test.staff='true'; SET ROLE authenticated;`);
await query(`INSERT INTO survey_forms(id,title) VALUES($1,'공통 만족도')`,[id(30)]);
await query(`INSERT INTO survey_versions(id,form_id,definition) VALUES($1,$2,$3)`,[id(31),id(30),JSON.stringify(definition)]);
await query(`INSERT INTO survey_versions(id,form_id,definition) VALUES($1,$2,$3)`,[id(32),id(30),JSON.stringify(changed)]);
await rejects(`UPDATE survey_versions SET definition=$1 WHERE id=$2`,[JSON.stringify(changed),id(31)]);
await query(`INSERT INTO survey_links(id,form_id,version_id,event,notice_id) VALUES($1,$2,$3,'PROGRAM',$4)`,[id(40),id(30),id(31),id(10)]);
await query(`INSERT INTO survey_links(id,form_id,version_id,event,notice_id) VALUES($1,$2,$3,'PROGRAM',$4)`,[id(41),id(30),id(31),id(11)]);
await query(`INSERT INTO survey_links(id,form_id,version_id,event,center_code,frequency) VALUES($1,$2,$3,'CHECKIN','HAIFN','EVERY_VISIT'),($4,$2,$3,'CHECKOUT','HAIFN','ONCE')`,[id(42),id(30),id(31),id(43)]);
await query(`INSERT INTO survey_links(id,form_id,version_id,event,public_token,frequency) VALUES($1,$2,$3,'PUBLIC',$4,'ONCE')`,[id(44),id(30),id(31),id(60)]);
await rejects(`UPDATE survey_links SET notice_id=$1 WHERE id=$2`,[id(11),id(40)]);
await db.exec(`SET test.staff='false'; SET test.uid='${id(1)}';`);
await rejects(`INSERT INTO survey_forms(title) VALUES('권한 없음')`);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{}')`,[id(40),id(1)]);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{"rating":9}')`,[id(40),id(1)]);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{"rating":4}')`,[id(40),id(2)]);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{"rating":4}')`,[id(41),id(1)]);
await query(`INSERT INTO survey_entries(id,link_id,user_id,answers) VALUES($1,$2,$3,'{"rating":4}')`,[id(50),id(40),id(1)]);
await query(`UPDATE survey_entries SET answers='{"rating":3}' WHERE id=$1`,[id(50)]);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{"rating":5}')`,[id(40),id(1)]);
await query(`INSERT INTO survey_entries(id,link_id,user_id,answers) VALUES($1,$2,$3,'{"rating":4}')`,[id(51),id(42),id(1)]);
await query(`INSERT INTO survey_entries(id,link_id,user_id,answers) VALUES($1,$2,$3,'{"rating":5}')`,[id(53),id(44),id(1)]);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{"rating":4}')`,[id(44),id(1)]);
await rejects(`UPDATE survey_entries SET answers='{"rating":2}' WHERE id=$1`,[id(51)]);
await rejects(`UPDATE survey_entries SET aggregation_excluded=true WHERE id=$1`,[id(51)]);
await db.exec(`RESET ROLE;`);
assert.equal((await query('SELECT count(*)::int n FROM haifn_transactions')).rows[0].n,1); checks++;
await db.exec(`SET test.staff='true'; SET ROLE authenticated;`);
await query(`UPDATE survey_links SET version_id=$1 WHERE id=$2`,[id(32),id(40)]);
assert.equal((await query(`SELECT version_id FROM survey_links WHERE id=$1`,[id(41)])).rows[0].version_id,id(31)); checks++;
assert.equal((await query(`SELECT version_id FROM survey_entries WHERE id=$1`,[id(50)])).rows[0].version_id,id(31)); checks++;
await rejects(`INSERT INTO survey_entries(link_id,version_id,user_id,answers) VALUES($1,$2,$3,'{"rating":4}')`,[id(40),id(31),id(1)]);
await db.exec(`SET test.staff='false'; SET test.uid='${id(1)}';`);
await query(`UPDATE survey_entries SET answers='{"rating":2}' WHERE id=$1`,[id(50)]);
assert.equal((await query(`SELECT snapshot->'questions'->0->>'title' title FROM survey_entries WHERE id=$1`,[id(50)])).rows[0].title,definition.questions[0].title); checks++;
await db.exec(`SET test.staff='true';`);
await query(`UPDATE survey_entries SET aggregation_excluded=true WHERE id=$1`,[id(51)]);
await query(`UPDATE survey_links SET enabled=false WHERE id=$1`,[id(40)]);
assert.equal((await query(`SELECT count(*)::int n FROM survey_entries WHERE link_id=$1`,[id(40)])).rows[0].n,1); checks++;
await db.exec(`RESET ROLE; SET test.staff='false'; SET test.uid=''; SET ROLE anon; SET request.headers='{}';`);
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers,visit_id) VALUES($1,$2,'{"rating":4}',$3)`,[id(43),id(1),id(21)]);
await rejects('SELECT * FROM survey_entries');
await db.exec(`SET request.headers='{"x-survey-visit":"${id(21)}"}';`);
await query(`INSERT INTO survey_entries(link_id,user_id,answers,visit_id) VALUES($1,$2,'{"rating":4}',$3)`,[id(43),id(1),id(21)]);
assert.equal((await query(`SELECT count(*)::int n FROM survey_completions WHERE link_id=$1`,[id(43)])).rows[0].n,1); checks++;
await rejects('SELECT answers FROM survey_entries');
await rejects(`INSERT INTO survey_entries(link_id,user_id,answers,visit_id) VALUES($1,$2,'{"rating":4}',$3)`,[id(43),id(2),id(21)]);
await rejects(`DELETE FROM survey_entries WHERE user_id=$1`,[id(1)]);
await db.exec(`RESET ROLE; SET test.staff='true';`);
await query(`INSERT INTO logs VALUES(22,$1,$2,'CHECKOUT',now())`,[id(2),id(3)]);
await query(`INSERT INTO survey_entries(id,link_id,user_id,answers,visit_id) VALUES($1,$2,$3,'{"rating":2}','22')`,[id(52),id(43),id(2)]);
await db.exec(`SET test.staff='false'; SET ROLE account_merge_worker; SET app.merge_source_id='${id(2)}'; SET app.merge_target_id='${id(1)}';`);
await query(`UPDATE survey_entries SET user_id=$1 WHERE id=$2`,[id(1),id(52)]);
const merged=(await query(`SELECT * FROM survey_entries WHERE id=$1`,[id(52)])).rows[0];
assert.equal(merged.response_key,`MERGED:${id(52)}`); assert.equal(merged.aggregation_excluded,true); assert.equal(merged.answers.rating,2); checks++;
await db.exec(`SET app.merge_source_id='${id(1)}'; SET app.merge_target_id='${id(2)}';`);
await rejects(`UPDATE survey_entries SET answers='{"rating":5}' WHERE id=$1`,[id(51)]);
await db.exec('RESET ROLE;');
assert.equal((await query(`SELECT count(*)::int n FROM survey_entries WHERE link_id=$1`,[id(43)])).rows[0].n,2); checks++;
await query(`INSERT INTO program_feedback(id,notice_id,user_id,raw) VALUES(2,$1,$2,'이전 이름으로 제출한 후기')`,[id(11),id(1)]);
await db.exec(`SET test.staff='true'; SET test.uid='${id(1)}';`);
await query(`UPDATE survey_links SET timing='ANYTIME' WHERE id=$1`,[id(41)]);
await query(`INSERT INTO survey_entries(link_id,user_id,answers) VALUES($1,$2,'{"rating":4}')`,[id(41),id(1)]);
assert.equal((await query('SELECT count(*)::int n FROM haifn_transactions')).rows[0].n,1); checks++;
await db.close();
console.log(`Unified surveys: model checks and ${checks} database safety/behavior checks passed.`);
