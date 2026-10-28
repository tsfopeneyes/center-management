import { AnalysisError, kstStart, previousPeriod, shiftDay, validDay } from './contracts.mjs';

// This adapter is the only analysis path that talks to PostgreSQL.  Every
// relation below is a fixed private fact view from the reviewed integration
// schema; request input only becomes a bound value, never an identifier or SQL
// fragment.  The pool itself connects as the platform service role and then
// drops to center_integration_reader for each read-only transaction.
const READER_ROLE = 'center_integration_reader';
const MAX_SOURCE_ROWS = 100_000;
const PAGE_SIZE = 1_000;
const PROGRAM_REFS = value => Array.isArray(value) && value.length ? value : null;

const assertPool = pool => {
    if (!pool || typeof pool.connect !== 'function') throw new AnalysisError('not_configured');
    return pool;
};

const validIso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

const minDay = ranges => ranges.reduce((current, range) => !current || range.start < current ? range.start : current, null);
const maxDay = ranges => ranges.reduce((current, range) => !current || range.end_exclusive > current ? range.end_exclusive : current, null);

function periodsFor(request) {
    if (!request?.period || !validDay(request.period.start) || !validDay(request.period.end_exclusive)) {
        throw new AnalysisError('source_incomplete');
    }
    const previous = request.comparison ? previousPeriod(request.period, request.comparison) : null;
    return previous ? [request.period, previous] : [request.period];
}

// Each operation has a deliberately small source window.  It is calculated
// from already-normalized server input, so a caller cannot turn this into a
// lifetime raw-data export.
export function sourceScopeFor(operation, request) {
    if (operation === 'get_analysis_capabilities') return Object.freeze({ visits: null, programs: null, satisfaction: null, operations: null, program_refs: null });
    if (operation === 'get_operation_summary') {
        const ranges = periodsFor(request);
        const range = Object.freeze({ start: minDay(ranges), end_exclusive: maxDay(ranges) });
        return Object.freeze({
            visits: request.domains.some(domain => domain === 'visits' || domain === 'duration') ? range : null,
            programs: request.domains.some(domain => domain === 'programs' || domain === 'feedback') ? range : null,
            satisfaction: request.domains.includes('feedback') ? range : null,
            operations: request.domains.some(domain => ['rentals', 'store', 'surveys'].includes(domain)) ? range : null,
            program_refs: null,
        });
    }
    if (operation === 'analyze_program_engagement') {
        const ranges = periodsFor(request);
        const range = Object.freeze({ start: minDay(ranges), end_exclusive: maxDay(ranges) });
        return Object.freeze({ visits: null, programs: range, satisfaction: range, operations: null, program_refs: PROGRAM_REFS(request.program_refs) });
    }
    if (operation === 'analyze_revisits') {
        const visits = Object.freeze({ start: request.period.start, end_exclusive: shiftDay(request.period.end_exclusive, request.followup_days) });
        return Object.freeze({
            visits,
            // Read every program through follow-up, so a return for another
            // program is not labelled as a visit without recorded attendance.
            programs: visits,
            satisfaction: null,
            operations: null,
            program_refs: null,
        });
    }
    if (operation === 'analyze_program_visit_change') {
        return Object.freeze({
            visits: Object.freeze({ start: shiftDay(request.period.start, -request.window_days), end_exclusive: shiftDay(request.period.end_exclusive, request.window_days) }),
            programs: request.period,
            satisfaction: null,
            operations: null,
            program_refs: PROGRAM_REFS(request.program_refs),
        });
    }
    throw new AnalysisError('source_incomplete');
}

function requireRange(range) {
    if (!range || !validDay(range.start) || !validDay(range.end_exclusive) || range.start >= range.end_exclusive) {
        throw new AnalysisError('source_incomplete');
    }
    return range;
}

function budgetFor(limit) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SOURCE_ROWS) throw new AnalysisError('not_configured');
    return { used: 0, limit };
}

function cursorValues(row, order) {
    const values = order.map(item => row[item.key]);
    if (values.some(value => value === null || value === undefined || value === '')) throw new AnalysisError('source_incomplete');
    return values;
}

// `select`, `from`, `where`, and `order` are module-owned constants.  Keeping
// this generic helper still gives every fact stream keyset pagination and one
// shared, hard source-row budget.
async function readPages(query, budget, { select, from, where = 'TRUE', values = [], order, pageSize = PAGE_SIZE }) {
    if (!Array.isArray(order) || !order.length || !Number.isSafeInteger(pageSize) || pageSize < 1) throw new AnalysisError('source_incomplete');
    const rows = [];
    let cursor = null;
    for (;;) {
        const cursorStart = values.length + 1;
        const cursorPredicate = cursor
            ? ` AND (${order.map(item => item.expression).join(', ')}) > (${cursor.map((_, index) => `$${cursorStart + index}`).join(', ')})`
            : '';
        const limitIndex = values.length + (cursor ? cursor.length : 0) + 1;
        const response = await query(
            `SELECT ${select} FROM ${from} WHERE (${where})${cursorPredicate} ORDER BY ${order.map(item => item.expression).join(', ')} LIMIT $${limitIndex}`,
            [...values, ...(cursor || []), Math.min(pageSize, budget.limit - budget.used) + 1],
        );
        if (!response || !Array.isArray(response.rows)) throw new AnalysisError('source_incomplete');
        const pageLimit = Math.min(pageSize, budget.limit - budget.used);
        const page = response.rows.slice(0, pageLimit);
        budget.used += page.length;
        if (budget.used > budget.limit || response.rows.length > pageLimit && pageLimit === 0) throw new AnalysisError('analysis_too_large');
        rows.push(...page);
        if (response.rows.length <= pageLimit) return rows;
        if (!page.length) throw new AnalysisError('analysis_too_large');
        cursor = cursorValues(page[page.length - 1], order);
        if (budget.used >= budget.limit) throw new AnalysisError('analysis_too_large');
    }
}

export function createAnalysisReadTransaction(pool, { statementTimeoutMs = 5_000 } = {}) {
    assertPool(pool);
    if (!Number.isSafeInteger(statementTimeoutMs) || statementTimeoutMs < 100 || statementTimeoutMs > 10_000) throw new AnalysisError('not_configured');
    return async operation => {
        const client = await pool.connect();
        let begun = false;
        let discard = false;
        try {
            await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            begun = true;
            await client.query(`SET LOCAL ROLE "${READER_ROLE}"`);
            await client.query(`SET LOCAL statement_timeout='${statementTimeoutMs}ms'`);
            await client.query("SET LOCAL idle_in_transaction_session_timeout='10000ms'");
            await client.query("SET LOCAL TIME ZONE 'UTC'");
            const identity = await client.query('SELECT current_user AS role');
            if (identity?.rows?.length !== 1 || identity.rows[0].role !== READER_ROLE) throw new AnalysisError('not_configured');
            return await operation((sql, values = []) => client.query(sql, values));
        } catch (error) {
            if (error instanceof AnalysisError) throw error;
            throw new AnalysisError('source_incomplete', { retryable: true });
        } finally {
            if (begun) {
                try { await client.query('ROLLBACK'); } catch { discard = true; }
            }
            client.release(discard);
        }
    };
}

async function readCoverage(query, budget) {
    const rows = await readPages(query, budget, {
        select: 'domain, status, start_day::text AS start, end_exclusive::text AS end_exclusive, reason',
        from: 'center_integration.source_coverage',
        order: [{ expression: 'domain', key: 'domain' }],
    });
    const coverage = {};
    for (const row of rows) {
        if (typeof row.domain !== 'string' || coverage[row.domain]) throw new AnalysisError('source_incomplete');
        coverage[row.domain] = Object.freeze({ status: row.status, start: row.start ?? null, end_exclusive: row.end_exclusive ?? null, reason: row.reason ?? null });
    }
    return Object.freeze(coverage);
}

async function readPeople(query, budget, datasets, { visits, programs }) {
    if (!visits && !programs) return;
    const personIds = new Set();
    if (visits) {
        for (const row of datasets.logs || []) {
            if (typeof row.user_id === 'string' && row.user_id) personIds.add(row.user_id);
        }
    }
    if (programs) {
        for (const collection of [datasets.responses, datasets.sessionResponses, datasets.openAttendance]) {
            for (const row of collection || []) {
                if (typeof row.user_id === 'string' && row.user_id) personIds.add(row.user_id);
            }
        }
    }
    const ids = [...personIds].sort();
    datasets.users = [];
    datasets.staff = [];
    if (ids.length) {
        // Read only people referenced by this bounded snapshot. A global user
        // or staff scan can make a small period query needlessly exceed its
        // source budget and is not needed to decide eligibility for these facts.
        datasets.users = await readPages(query, budget, {
            select: 'u.id::text AS id, u.user_group',
            from: 'center_integration.analysis_users u',
            where: 'u.id::text = ANY($1::text[])',
            values: [ids],
            order: [{ expression: 'u.id::text', key: 'id' }],
        });
        datasets.staff = await readPages(query, budget, {
            select: 's.id::text AS id, s.role',
            from: 'center_integration.analysis_staff s',
            where: 's.id::text = ANY($1::text[])',
            values: [ids],
            order: [{ expression: 's.id::text', key: 'id' }],
        });
    }
    if (visits) {
        const locationIds = [...new Set((datasets.logs || [])
            .map(row => typeof row.location_id === 'string' ? row.location_id : null)
            .filter(Boolean))].sort();
        datasets.locations = [];
        if (!locationIds.length) return;
        datasets.locations = await readPages(query, budget, {
            select: 'l.id::text AS id, l.site',
            from: 'center_integration.analysis_locations l',
            where: 'l.id::text = ANY($1::text[])',
            values: [locationIds],
            order: [{ expression: 'l.id::text', key: 'id' }],
        });
    }
}

async function readVisits(query, budget, datasets, range, asOf) {
    if (!range) return;
    requireRange(range);
    datasets.logs = await readPages(query, budget, {
        select: 'l.id::text AS id, l.user_id::text AS user_id, l.type::text AS type, l.location_id::text AS location_id, l.created_at::text AS created_at',
        from: 'center_integration.analysis_logs l',
        where: 'l.created_at >= $1::timestamptz AND l.created_at < $2::timestamptz AND l.created_at <= $3::timestamptz',
        values: [kstStart(range.start), kstStart(range.end_exclusive), asOf],
        order: [{ expression: 'l.created_at', key: 'created_at' }, { expression: 'l.id::text', key: 'id' }],
    });
}

async function readVisitInitiative(query, budget, datasets, range, asOf) {
    if (!range) return;
    datasets.visitInitiative = await readPages(query, budget, {
        select: 'v.id, v.user_id, v.visited_at::text AS visited_at, v.purpose, v.teacher_contact',
        from: 'center_integration.analysis_visit_initiative v',
        where: 'v.visited_at >= $1::timestamptz AND v.visited_at < $2::timestamptz AND v.visited_at <= $3::timestamptz',
        values: [kstStart(range.start), kstStart(range.end_exclusive), asOf],
        order: [{ expression: 'v.visited_at', key: 'visited_at' }, { expression: 'v.id', key: 'id' }],
    });
}

async function readPrograms(query, budget, datasets, range, programRefs) {
    if (!range) return;
    requireRange(range);
    const refs = programRefs || null;
    const programWhere = `n.category='PROGRAM' AND n.program_status IS DISTINCT FROM 'CANCELLED'
      AND ($3::text[] IS NULL OR n.id::text = ANY($3::text[]))
      AND (
        -- The live notice date field is a timestamptz.
        -- The analysis contract uses KST days, so do not let the connection's
        -- UTC timezone turn a KST early-morning program into the prior period.
        (n.program_date >= $1::timestamptz AND n.program_date < $2::timestamptz)
        OR EXISTS (SELECT 1 FROM center_integration.analysis_program_sessions ps
                   WHERE ps.notice_id=n.id AND ps.session_date >= $4::date AND ps.session_date < $5::date)
        OR EXISTS (SELECT 1 FROM center_integration.analysis_open_program_attendance oa
                   WHERE oa.notice_id=n.id AND oa.attendance_date >= $4::date AND oa.attendance_date < $5::date)
      )`;
    const values = [kstStart(range.start), kstStart(range.end_exclusive), refs, range.start, range.end_exclusive];
    const notices = await readPages(query, budget, {
        select: 'n.id::text AS id, n.category::text AS category, n.program_date::text AS program_date, n.created_at::text AS created_at, n.program_status::text AS program_status, n.is_recruiting, n.site',
        from: 'center_integration.analysis_notices n',
        where: programWhere,
        values,
        order: [{ expression: 'n.id::text', key: 'id' }],
    });
    datasets.notices = notices;
    const noticeIds = notices.map(row => row.id);
    datasets.responses = [];
    datasets.sessions = [];
    datasets.sessionResponses = [];
    datasets.openAttendance = [];
    datasets.migratedProgramRefs = [];
    if (!noticeIds.length) return;

    datasets.migratedProgramRefs = await readPages(query, budget, {
        select: 'DISTINCT ps.notice_id::text AS notice_id',
        from: 'center_integration.analysis_program_sessions ps',
        where: 'ps.notice_id::text = ANY($1::text[])',
        values: [noticeIds],
        order: [{ expression: 'ps.notice_id::text', key: 'notice_id' }],
    });
    datasets.responses = await readPages(query, budget, {
        select: 'r.notice_id::text AS notice_id, r.user_id::text AS user_id, r.status::text AS status, r.is_attended, r.is_staff',
        from: 'center_integration.analysis_notice_responses r',
        where: 'r.notice_id::text = ANY($1::text[])',
        values: [noticeIds],
        order: [{ expression: 'r.notice_id::text', key: 'notice_id' }, { expression: 'r.user_id::text', key: 'user_id' }],
    });
    datasets.sessions = await readPages(query, budget, {
        select: 'ps.id::text AS id, ps.notice_id::text AS notice_id, ps.session_date::text AS session_date, ps.status::text AS status, ps.voided_at::text AS voided_at',
        from: 'center_integration.analysis_program_sessions ps',
        where: 'ps.notice_id::text = ANY($1::text[]) AND ps.session_date >= $2::date AND ps.session_date < $3::date',
        values: [noticeIds, range.start, range.end_exclusive],
        order: [{ expression: 'ps.id::text', key: 'id' }],
    });
    const sessionIds = datasets.sessions.map(row => row.id);
    if (sessionIds.length) {
        datasets.sessionResponses = await readPages(query, budget, {
            select: 'sr.session_id::text AS session_id, sr.user_id::text AS user_id, sr.status::text AS status, sr.is_attended',
            from: 'center_integration.analysis_program_session_responses sr',
            where: 'sr.session_id::text = ANY($1::text[])',
            values: [sessionIds],
            order: [{ expression: 'sr.session_id::text', key: 'session_id' }, { expression: 'sr.user_id::text', key: 'user_id' }],
        });
    }
    datasets.openAttendance = await readPages(query, budget, {
        select: 'oa.notice_id::text AS notice_id, oa.user_id::text AS user_id, oa.attendance_date::text AS attendance_date',
        from: 'center_integration.analysis_open_program_attendance oa',
        where: 'oa.notice_id::text = ANY($1::text[]) AND oa.attendance_date >= $2::date AND oa.attendance_date < $3::date',
        values: [noticeIds, range.start, range.end_exclusive],
        order: [{ expression: 'oa.notice_id::text', key: 'notice_id' }, { expression: 'oa.user_id::text', key: 'user_id' }, { expression: 'oa.attendance_date::text', key: 'attendance_date' }],
    });
}

async function readSatisfaction(query, budget, datasets, range, programRefs) {
    if (!range) return;
    requireRange(range);
    const refs = programRefs || datasets.notices?.map(row => row.id) || [];
    datasets.satisfactionResponses = [];
    if (!refs.length) return;
    datasets.satisfactionResponses = await readPages(query, budget, {
        select: 'sf.id::text AS id, sf.program_ref::text AS program_ref, sf.value::integer AS value, sf.submitted_at::text AS submitted_at',
        from: 'center_integration.analysis_satisfaction_facts sf',
        where: 'sf.program_ref::text = ANY($1::text[]) AND sf.submitted_at >= $2::timestamptz AND sf.submitted_at < $3::timestamptz',
        values: [refs, kstStart(range.start), kstStart(range.end_exclusive)],
        order: [{ expression: 'sf.submitted_at', key: 'submitted_at' }, { expression: 'sf.id::text', key: 'id' }],
    });
}

async function readOperations(query, budget, datasets, range) {
    if (!range) return;
    requireRange(range);
    datasets.rentalBookings = await readPages(query, budget, {
        select: 'rb.id::text AS id, rb.booking_date::text AS booking_date, rb.status::text AS status, rb.site',
        from: 'center_integration.analysis_rental_bookings rb',
        where: 'rb.booking_date >= $1::date AND rb.booking_date < $2::date',
        values: [range.start, range.end_exclusive],
        order: [{ expression: 'rb.id::text', key: 'id' }],
    });
    datasets.storeOrders = await readPages(query, budget, {
        select: 'so.id::text AS id, so.created_at::text AS created_at, so.status::text AS status',
        from: 'center_integration.analysis_store_orders so',
        where: 'so.created_at >= $1::timestamptz AND so.created_at < $2::timestamptz',
        values: [kstStart(range.start), kstStart(range.end_exclusive)],
        order: [{ expression: 'so.created_at', key: 'created_at' }, { expression: 'so.id::text', key: 'id' }],
    });
    datasets.checkinSurveys = await readPages(query, budget, {
        select: 'cs.id::text AS id, cs.created_at::text AS created_at, cs.survey_type::text AS survey_type, cs.site',
        from: 'center_integration.analysis_checkin_surveys cs',
        where: 'cs.created_at >= $1::timestamptz AND cs.created_at < $2::timestamptz',
        values: [kstStart(range.start), kstStart(range.end_exclusive)],
        order: [{ expression: 'cs.created_at', key: 'created_at' }, { expression: 'cs.id::text', key: 'id' }],
    });
}

function isoNowRow(row) {
    if (!row || !validIso(row.as_of)) throw new AnalysisError('source_incomplete');
    return row.as_of;
}

export function createPostgresAnalysisRepository({ pool, sourceRowLimit = MAX_SOURCE_ROWS, statementTimeoutMs = 5_000 } = {}) {
    const transact = createAnalysisReadTransaction(pool, { statementTimeoutMs });
    const sourceLimit = budgetFor(sourceRowLimit).limit;
    return Object.freeze({
        async readSnapshot({ operation, request }) {
            const scope = sourceScopeFor(operation, request);
            return transact(async query => {
                const clock = await query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS as_of`);
                const asOf = isoNowRow(clock?.rows?.[0]);
                const budget = budgetFor(sourceLimit);
                const datasets = {};
                const coverage = await readCoverage(query, budget);
                await readVisits(query, budget, datasets, scope.visits, asOf);
                await readPrograms(query, budget, datasets, scope.programs, scope.program_refs);
                await readPeople(query, budget, datasets, scope);
                await readSatisfaction(query, budget, datasets, scope.satisfaction, scope.program_refs);
                await readOperations(query, budget, datasets, scope.operations);
                const contextRows = await query(`SELECT domain, start_day::text AS start, end_exclusive::text AS end_exclusive,
                    activity_status, evidence FROM center_integration.operating_context
                    ORDER BY domain,start_day,end_exclusive LIMIT $1`, [201]);
                if (!Array.isArray(contextRows.rows) || contextRows.rows.length > 200) throw new AnalysisError('analysis_too_large');
                const approvedPrograms = await query(`SELECT program_ref,title FROM center_integration.program_catalog
                    WHERE published IS TRUE ORDER BY program_ref LIMIT $1`, [201]);
                if (!Array.isArray(approvedPrograms.rows) || approvedPrograms.rows.length > 200) throw new AnalysisError('analysis_too_large');
                return Object.freeze({ complete: true, as_of: asOf, coverage, operating_context: contextRows.rows, approved_programs: approvedPrograms.rows, datasets: Object.freeze(datasets) });
            });
        },

        async listProgramCatalog(request) {
            const limit = request?.limit;
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new AnalysisError('invalid_input');
            return transact(async query => {
                const period = request.period || null;
                if (period) requireRange(period);
                const text = request.query || null;
                const { rows } = await query(`
                    SELECT program_ref, title, scheduled_date::text AS scheduled_date, recruitment_status, public_description
                    FROM center_integration.program_catalog
                    WHERE published IS TRUE
                      AND ($1::date IS NULL OR (scheduled_date >= $1::date AND scheduled_date < $2::date)
                        OR EXISTS (SELECT 1 FROM center_integration.analysis_program_sessions ps
                          WHERE ps.notice_id::text=program_ref AND ps.session_date >= $1::date AND ps.session_date < $2::date
                            AND ps.status IS DISTINCT FROM 'CANCELLED' AND ps.voided_at IS NULL)
                        OR EXISTS (SELECT 1 FROM center_integration.analysis_open_program_attendance pa
                          WHERE pa.notice_id::text=program_ref AND pa.attendance_date >= $1::date AND pa.attendance_date < $2::date))
                      AND ($5::text = 'ALL' OR EXISTS (SELECT 1 FROM center_integration.analysis_notices n WHERE n.id::text=program_ref AND n.site=$5::text))
                      AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%' OR public_description ILIKE '%' || $3 || '%')
                    ORDER BY scheduled_date DESC NULLS LAST, program_ref ASC
                    LIMIT $4`, [period?.start || null, period?.end_exclusive || null, text, limit + 1, request.site || 'ALL']);
                if (!Array.isArray(rows) || rows.length > limit + 1) throw new AnalysisError('source_incomplete');
                return rows.map(row => Object.freeze({
                    program_ref: row.program_ref,
                    title: row.title,
                    scheduled_date: row.scheduled_date ?? null,
                    recruitment_status: row.recruitment_status,
                    public_description: row.public_description ?? null,
                }));
            });
        },
    });
}
