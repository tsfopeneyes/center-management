import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import * as dates from 'date-fns';
import { isStaffProfile } from '../supabase/functions/_shared/staffRoles.mjs';
import { calculateStatistics, calculateVisitStatistics, calculateProgramStatistics } from '../supabase/functions/_shared/operationStatistics/aggregate.mjs';
import { periodWindow, validateRequest } from '../supabase/functions/_shared/operationStatistics/policy.mjs';
import { sourcePlans, readAllPages, SOURCE_NAMES } from '../supabase/functions/_shared/operationStatistics/source.mjs';
import { approvedMetadata, publishStatistics } from '../supabase/functions/_shared/operationStatistics/publication.mjs';
import { createStatisticsBoundary } from '../supabase/functions/_shared/operationStatistics/boundary.mjs';
import { slackWindow, slackVisitStatistics, slackProgramStatistics } from '../supabase/functions/_shared/operationStatistics/slack.mjs';

const savedFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('network prohibited in statistics tests'); };
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`STAT PASS ${name}`); };
const now = new Date('2026-10-06T20:00:00+09:00');
const window = periodWindow({ kind: 'day', date: '2026-10-06' });
const users = [{ id: 'private-person-a', user_group: '청소년' }, { id: 'private-person-b', user_group: '게스트' }, { id: 'private-person-c', user_group: '미가입' }, { id: 'private-admin', user_group: '청소년' }];
const staff = [{ id: 'private-admin', role: 'admin' }], locations = [{ id: 'room1', name: 'one' }, { id: 'room2', name: 'two' }];
let seq = 0;
const event = (user, type, at, location = 'room1') => ({ id: ++seq, user_id: user, type, location_id: location, created_at: at });
const logs = [event(users[0].id, 'CHECKIN', '2026-10-06T09:00:00+09:00'), event(users[0].id, 'MOVE', '2026-10-06T09:30:00+09:00', 'room2'), event(users[0].id, 'CHECKOUT', '2026-10-06T10:00:00+09:00', 'room2'), event(users[0].id, 'CHECKIN', '2026-10-06T11:00:00+09:00'), event(users[0].id, 'CHECKOUT', '2026-10-06T11:30:00+09:00'), event(users[1].id, 'CHECKIN', '2026-10-06T12:00:00+09:00'), event(users[3].id, 'CHECKIN', '2026-10-06T09:00:00+09:00'), event(users[3].id, 'CHECKOUT', '2026-10-06T10:00:00+09:00')];
const notices = [{ id: 'p1', title: 'private-person-a 010-1234-5678', category: 'PROGRAM', program_date: '2026-10-06', created_at: '2026-10-01T00:00:00Z', program_status: 'OPEN', is_recruiting: true }, { id: 'p2', category: 'PROGRAM', program_date: '2026-10-06', created_at: '2026-10-01T00:00:00Z', program_status: 'OPEN', is_recruiting: true }];
const responses = [{ notice_id: 'p1', user_id: users[0].id, status: 'JOIN', is_attended: true, is_staff: false }];
const sessions = [{ id: 's1', notice_id: 'p1', session_date: '2026-10-06', status: 'OPEN', voided_at: null }];
const sessionResponses = users.map((user, i) => ({ session_id: 's1', user_id: user.id, status: ['JOIN', 'WAITLIST', 'CANCELLED', 'JOIN'][i], is_attended: true }));
const datasets = { logs, users, staff, locations, notices, responses, sessions, sessionResponses, openAttendance: [] };
const source = { complete: true, datasets };
const result = () => calculateStatistics(source, window, now);
const input = { period: { kind: 'day', date: '2026-10-06' }, breakdown: 'session' };
const policy = { id: 'synthetic-reviewed-policy', reviewed: true, metrics: ['visits', 'duration', 'programs'], periodKinds: ['day', 'week', 'month'], breakdowns: ['program', 'session'], rules: { visits: { allowExact: true, minimumSubjects: 0 }, duration: { allowExact: true, minimumSubjects: 0, maximumContributorShare: 1 }, programs: { allowExact: true, minimumSubjects: 0, minimumCell: 0 } }, catalog: { p1: { approved: true, published: true, alias: 'workshop', title: 'Synthetic workshop', description: 'Group activity', capacity: 12, sessions: { s1: 'session-one' } }, p2: { approved: true, published: true, alias: 'other' } } };
const identity = { verified: true, subject: 'synthetic-jin', active: true, scopes: ['center:statistics:read'] };
const config = { authenticate: async credential => credential === 'fixture-token' ? identity : null, authorizedSubject: identity.subject, readSources: async () => source, publicationPolicy: policy, authorizeRelease: async () => ({ allowed: true }), now: () => now };
try {
    await check('KST boundary / canonical periods / previous period', () => {
        assert.equal(periodWindow({ kind: 'week', date: '2026-10-04' }).startDay, '2026-09-28');
        assert.equal(validateRequest({ period: { kind: 'month', date: '2026-10-06' }, compare: 'previous' }, now).windows[0].startDay, '2026-09-01');
        const edge = calculateVisitStatistics({ users, staff, locations, window, now, logs: [event(users[0].id, 'CHECKIN', '2026-10-05T14:59:00Z'), event(users[1].id, 'CHECKIN', '2026-10-05T15:00:00Z')] });
        assert.equal(edge.visits.visit_sessions, 1);
    });
    await check('re-entry / MOVE / employees / missing checkout / actual mean', () => {
        const r = result(); assert.equal(r.visits.visit_sessions, 3); assert.equal(r.visits.unique_visitors, 2);
        assert.equal(r.visits.visitor_days, 2); assert.equal(r.visits.member_space_visits, 3);
        assert.equal(r.duration.complete_minutes, 90); assert.equal(r.duration.valid_sessions, 2); assert.equal(r.duration.mean_complete_minutes, 45);
        assert.equal(r.duration.missing_checkout_sessions, 1); assert.equal(r.duration.estimated_missing_checkout_minutes, 480);
    });
    await check('zero duration / unregistered / future events / orphan checkout', () => {
        const r = calculateVisitStatistics({ users, staff, locations, window, now, logs: [event(users[2].id, 'CHECKIN', '2026-10-06T19:00:00+09:00'), event(users[0].id, 'CHECKOUT', '2026-10-06T18:00:00+09:00'), event(users[1].id, 'CHECKIN', '2026-10-06T21:00:00+09:00')] });
        assert.equal(r.visits.guest_unique_visitors, 1); assert.equal(r.quality.orphan_checkouts, 1); assert.equal(r.duration.mean_complete_minutes, null);
    });
    await check('deduplicate / conflicting duplicates rejected', () => {
        assert.deepEqual(calculateStatistics({ complete: true, datasets: { ...datasets, logs: [...logs, logs[0]], sessions: [...sessions, sessions[0]] } }, window, now), result());
        assert.throws(() => calculateStatistics({ complete: true, datasets: { ...datasets, logs: [...logs, { ...logs[0], type: 'CHECKOUT' }] } }, window, now), /source_incomplete/);
    });
    await check('program session state / migrated legacy / cancellation attendance', () => {
        const r = result().programs; assert.deepEqual(r.summary, { joined: 1, waitlisted: 1, cancelled: 1, attended: 1, application_records: 3, unique_applicants: 3 });
        assert.equal(r.occurrences.length, 2); // p2 has genuine zero, p1 legacy not counted again.
        const future = calculateProgramStatistics({ ...datasets, window: periodWindow({ kind: 'week', date: '2026-10-06' }), sessions: [{ ...sessions[0], session_date: '2026-10-09' }], now });
        assert.equal(future.summary.joined, 1); assert.equal(future.summary.attended, 0);
    });
    await check('voided sessions / open attendance / duplicates', () => {
        const r = calculateProgramStatistics({ ...datasets, notices: [{ ...notices[1], is_recruiting: false }], sessions: [{ ...sessions[0], status: 'VOIDED' }], openAttendance: [{ notice_id: 'p2', user_id: users[0].id, attendance_date: '2026-10-06' }, { notice_id: 'p2', user_id: users[0].id, attendance_date: '2026-10-06' }], window, now });
        assert.equal(r.summary.attended, 1); assert.equal(r.summary.joined, 0);
    });
    await check('1501 rows keyset pagination / projection', async () => {
        const rows = Array.from({ length: 1501 }, (_, id) => ({ id, user_group: '청소년', name: 'never output' }));
        let calls = 0; const plan = sourcePlans(window).find(p => p.name === 'users');
        const all = await readAllPages(async ({ after, limit }) => { calls++; const offset = after ? after[0] + 1 : 0; return { rows: rows.slice(offset, offset + limit), complete: true, hasMore: offset + limit < rows.length }; }, plan);
        assert.equal(all.length, 1501); assert.equal(calls, 4); assert.equal(all[0].name, undefined);
        assert.equal(SOURCE_NAMES.length, 9); assert.ok(sourcePlans(window).every(p => !p.select.includes('*')));
        const noticePlan = sourcePlans(window).find(p => p.name === 'notices');
        const noticeRows = ['2', '10'].map(id => ({ id, category: 'PROGRAM', program_date: null, created_at: null, program_status: null, is_recruiting: null }));
        assert.equal((await readAllPages(async () => ({ complete: true, hasMore: false, rows: noticeRows }), noticePlan)).length, 2);
    });
    await check('pagination failure / no progress / never empty fallback', async () => {
        const plan = sourcePlans(window)[0];
        await assert.rejects(readAllPages(async () => { throw new Error('secret error'); }, plan), /source_incomplete/);
        await assert.rejects(readAllPages(async () => ({ complete: true, hasMore: true, rows: [] }), plan), /source_incomplete/);
    });
    await check('program text metadata approval / PII defense / allowlist', () => {
        assert.equal(approvedMetadata({ approved: false, published: true, alias: 'p', description: 'text' }), null);
        assert.equal(approvedMetadata({ approved: true, published: true, alias: 'p', description: 'a@example.com' }), null);
        assert.equal(approvedMetadata({ approved: true, published: true, alias: 'p', description: '010-1234-5678' }), null);
        const output = publishStatistics(result(), validateRequest({ ...input, breakdown: 'program' }, now), policy), serialized = JSON.stringify(output);
        assert.ok(serialized.includes('Synthetic workshop')); assert.ok(!serialized.includes('private-person')); assert.ok(!serialized.includes('user_id')); assert.ok(!serialized.includes('010-')); assert.ok(!serialized.includes('T09:'));
        assert.equal(publishStatistics(result(), validateRequest(input, now), policy).metrics.programs.breakdown.status, 'review_required'); // unreviewed p2 whole-session alias prevents leak
    });
    await check('reviewed configurable cell / duration dominance guard', () => {
        const guarded = structuredClone(policy); guarded.rules.duration.maximumContributorShare = 0.5; guarded.rules.programs.minimumCell = 2;
        const output = publishStatistics(result(), validateRequest(input, now), guarded);
        assert.equal(output.metrics.duration.status, 'review_required'); assert.equal(output.metrics.visits.status, 'available'); assert.equal(output.metrics.programs.breakdown.status, 'review_required');
    });
    await check('summary subgroups cannot bypass the overall subject threshold', () => {
        const guarded = structuredClone(policy); guarded.rules.visits.summaryMinimumCell = 5;
        const aggregated = result();
        for (const field of Object.keys(aggregated.visits)) aggregated.visits[field] = 10;
        aggregated.visits.guest_unique_visitors = 1;
        const request = validateRequest({ ...input, metrics: ['visits'], breakdown: 'none' }, now);
        assert.equal(publishStatistics(aggregated, request, guarded).metrics.visits.status, 'review_required');
        aggregated.visits.guest_unique_visitors = 0;
        assert.equal(publishStatistics(aggregated, request, guarded).metrics.visits.status, 'available');
    });
    await check('missing authentication / fake claims / wrong user / inactive session', async () => {
        assert.equal((await createStatisticsBoundary()(input, identity)).code, 'not_configured');
        const endpoint = createStatisticsBoundary(config);
        assert.equal((await endpoint(input, identity)).code, 'unauthorized');
        for (const bad of [{ ...identity, subject: 'other' }, { ...identity, active: false }, { ...identity, verified: false }, { ...identity, scopes: [] }]) assert.equal((await createStatisticsBoundary({ ...config, authenticate: async () => bad })(input)).code, 'unauthorized');
    });
    await check('unknown policy / arbitrary SQL or filters / no read before authorization', async () => {
        let reads = 0; const endpoint = createStatisticsBoundary({ ...config, readSources: async () => { reads++; return source; }, publicationPolicy: null });
        assert.equal((await endpoint(input, 'fixture-token')).code, 'policy_review_required'); assert.equal(reads, 0);
        assert.equal((await createStatisticsBoundary(config)({ ...input, user_id: 'anything' }, 'fixture-token')).code, 'invalid_request');
        assert.throws(() => validateRequest({ ...input, sql: 'select *' }, now), /invalid_request/);
    });
    await check('real zero versus source failure / sanitized errors', async () => {
        const empty = { complete: true, datasets: Object.fromEntries(SOURCE_NAMES.map(name => [name, []])) };
        const good = await createStatisticsBoundary({ ...config, readSources: async () => empty })({ ...input, breakdown: 'none' }, 'fixture-token');
        assert.equal(good.periods[0].metrics.visits.values.visit_sessions, 0);
        const bad = await createStatisticsBoundary({ ...config, readSources: async () => { throw new Error('private-secret'); } })(input, 'fixture-token');
        assert.deepEqual(bad, { status: 'unavailable', code: 'source_incomplete' });
    });
    await check('repeated queries / overlap guard invoked every time / comparison', async () => {
        let checks = 0; const endpoint = createStatisticsBoundary({ ...config, authorizeRelease: async () => ({ allowed: ++checks === 1 }) });
        assert.equal((await endpoint(input, 'fixture-token')).status, 'ok'); assert.equal((await endpoint(input, 'fixture-token')).code, 'release_review_required'); assert.equal(checks, 2);
        const comparison = await createStatisticsBoundary(config)({ ...input, compare: 'previous', breakdown: 'none' }, 'fixture-token');
        assert.equal(comparison.comparison.visits.delta.visit_sessions, 3);
    });
    await check('Slack shared adapter exact equality / incomplete', async () => {
        const visit = slackVisitStatistics({ ...datasets, window, now }, true);
        assert.deepEqual(visit.visits, result().visits); assert.deepEqual(visit.duration, result().duration);
        const lookup = { users, staff_directory: staff, daily_program_sessions: sessions, daily_program_session_responses: sessionResponses, open_program_attendance: [] };
        const program = await slackProgramStatistics({ notices, responses, complete: true, window, now, read: async table => ({ rows: lookup[table], truncated: false }) });
        assert.deepEqual(program.summary, result().programs.summary);
        assert.deepEqual(slackVisitStatistics({ ...datasets, window }, false), { status: 'incomplete' });
        assert.equal((await slackProgramStatistics({ notices, responses, complete: true, window, read: async () => { throw new Error('failed'); } })).status, 'incomplete');
    });
    await check('actual Slack functions use adapters and preserve legacy response', async () => {
        const raw = fs.readFileSync('supabase/functions/slack-tsf/index.ts', 'utf8');
        const functions = raw.slice(raw.indexOf('export async function getVisitMetrics'), raw.indexOf('async function notionFetch'));
        const code = (await transform(functions.replaceAll('export async function', 'async function'), { loader: 'ts' })).code;
        const tableRows = { logs, users, staff_directory: staff, notices, notice_responses: responses, program_feedback: [], survey_entries: [], daily_program_sessions: sessions, daily_program_session_responses: sessionResponses, open_program_attendance: [] };
        const context = vm.createContext({ console, Date, Map, Set, slackWindow,
            slackVisitStatistics: (data, complete) => slackVisitStatistics({ ...data, now }, complete),
            slackProgramStatistics: data => slackProgramStatistics({ ...data, now }), isStaffProfile,
            MAX_AGGREGATE_ROWS: 25000, getSecret: () => '', parseToolDateRange: () => ({ start: new Date(window.start), end: new Date(window.end), label: 'fixture' }), parseOptionalToolDateRange: () => ({ start: new Date(window.start), end: new Date(window.end), label: 'fixture' }),
            supabaseSelectAll: async table => ({ rows: tableRows[table], truncated: false }), supabaseSelect: async table => table === 'locations' ? locations : [],
            dateFilters: () => [], kstDateKey: value => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 10), kstToday: () => new Date(window.start), addDays: dates.addDays, visitGroupKey: day => day,
            formatKstIsoDate: value => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 10), programQueryVariants: () => [], customFeedbackQuestions: () => [], formatProgramSchedule: () => '', feedbackAnswers: () => [] });
        vm.runInContext(code + '\nglobalThis.visitFn=getVisitMetrics;globalThis.programFn=getProgramMetrics;', context);
        const visit = await context.visitFn({}); assert.deepEqual(visit.statistics_v2.visits, result().visits); assert.equal(visit.summary.total_visits, 1); // original completed user-day field retained
        const program = await context.programFn({}); assert.equal(program.statistics_v2.status, 'available'); assert.deepEqual(program.statistics_v2.summary, result().programs.summary); assert.ok(program.programs.length === 2);
        tableRows.notices = [{ ...notices[0], program_date: '2026-09-01' }, notices[1]];
        const recurring = await context.programFn({});
        assert.equal(recurring.programs.length, 1); // legacy date filter preserved
        assert.deepEqual(recurring.statistics_v2.summary, result().programs.summary); // selected October session still included
        // Changes leave writes and authentication outside these extracted paths.
        assert.ok(raw.includes('slackVisitStatistics')); assert.ok(raw.includes('slackProgramStatistics'));
    });
    await check('existing web session boundaries agree on re-entry', () => {
        const context = vm.createContext({ ...dates, console });
        for (const file of ['src/utils/userUtils.js', 'src/utils/dateUtils.js', 'src/utils/visitUtils.js']) vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export const ', 'const '), context);
        vm.runInContext('globalThis.sessionsFn = aggregateVisitSessions;', context);
        const eligible = logs.filter(row => row.user_id === users[0].id);
        const sessions = context.sessionsFn(eligible, users, locations, window.startDay, window.startDay);
        assert.equal(sessions.length, calculateVisitStatistics({ logs: eligible, users, staff, locations, window, now }).visits.visit_sessions);
    });
    await check('existing web space visits and measured minutes agree', () => {
        const context = vm.createContext({ ...dates, console, buildOperationProgramStats: () => ({}), supabase: {}, isCurrentProgramAttendee: () => false });
        for (const file of ['src/utils/userUtils.js', 'src/utils/dateUtils.js', 'src/utils/visitUtils.js', 'src/utils/analyticsUtils.js']) vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export const ', 'const '), context);
        vm.runInContext('globalThis.analyticsFn = processAnalyticsData;', context);
        const eligible = logs.filter(row => row.user_id === users[0].id);
        const web = context.analyticsFn(eligible, locations, users, new Date('2026-10-06T12:00:00Z'), 'DAILY');
        const core = calculateVisitStatistics({ logs: eligible, users, staff, locations, window, now });
        assert.equal(web.totalVisits, core.visits.member_space_visits);
        assert.equal(web.totalDurationSplit.student, core.duration.recorded_minutes);
        assert.equal(web.uniqueUsers, core.visits.member_unique_visitors);
    });
    console.log(`${passed} operation statistics checks passed (synthetic data; network disabled)`);
} finally { globalThis.fetch = savedFetch; }
