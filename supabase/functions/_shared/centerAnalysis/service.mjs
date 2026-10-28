import { scopeSnapshotToSite, siteScopeMetadata, siteScopeWarnings, SITE_DEFINITIONS } from './site.mjs';
import {
    AnalysisError,
    availableMetric,
    deltaMetric,
    kstNowDay,
    limitedMetric,
    makeAnalysisResult,
    makeErrorResult,
    makeQuality,
    parseOperationInput,
    previousPeriod,
    ratioMetric,
    relativeChangeMetric,
    resultStatusFromMetrics,
    suppressedMetric,
    shiftDay,
    unavailableMetric,
} from './contracts.mjs';
import { definitionsFor, METRIC_DEFINITIONS, operationCapabilities } from './definitions.mjs';
import { discloseContribution, discloseProgramBreakdown, DEFAULT_DISCLOSURE_POLICY, suppressCohortMetrics } from './disclosure.mjs';
import { analyzeProgramVisitChange, analyzeRevisits, programTransitions } from './engagement.mjs';
import { coverageFor } from './normalize.mjs';
import { summarizeOperations } from './operations.mjs';
import { satisfactionContext } from './operatingContext.mjs';
import { buildProgramFacts, summarizePrograms } from './programs.mjs';
import { buildVisitFacts, summarizeVisits } from './visits.mjs';

const ANALYTICS_CAPABILITY = 'analytics.read';
const PROGRAMS_CAPABILITY = 'programs.read';
const source = Object.freeze([{ label: '센터 운영 기록' }]);

const randomRequestId = () => globalThis.crypto?.randomUUID?.()
    || `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const date = value => {
    const result = new Date(value);
    if (!Number.isFinite(result.getTime())) throw new AnalysisError('temporarily_unavailable', { retryable: true });
    return result;
};

const metricCount = (value, unit = 'count') => availableMetric(value, unit);
const nullableMetric = (value, unit, denominator = undefined) => availableMetric(value, unit,
    value === null ? { ...(denominator === undefined ? {} : { denominator }), reason: 'no_observations' } : denominator === undefined ? {} : { denominator });

function requireCapability(actor, capability) {
    if (!actor || actor.active !== true || !Array.isArray(actor.capabilities)) throw new AnalysisError('unauthenticated');
    if (!actor.capabilities.includes(capability)) throw new AnalysisError('forbidden');
}

function requiredCapability(operation) {
    return operation === 'get_program_catalog' ? PROGRAMS_CAPABILITY : ANALYTICS_CAPABILITY;
}

function metricStatus(metrics) {
    return resultStatusFromMetrics(metrics);
}

function summaryQuality(snapshot, { limited = [], incomplete = [] } = {}) {
    const reasons = [...new Set([...limited, ...incomplete])];
    return makeQuality({
        status: incomplete.length ? 'incomplete' : limited.length ? 'limited' : 'complete',
        observationStart: null,
        observationEndExclusive: null,
        reasons,
    });
}

function contextFor(snapshot) {
    let visits;
    let visitsError;
    let programs;
    let programsError;
    const getVisits = () => {
        if (visits || visitsError) {
            if (visitsError) throw visitsError;
            return visits;
        }
        try { visits = buildVisitFacts(snapshot); return visits; }
        catch (error) { visitsError = error instanceof AnalysisError ? error : new AnalysisError('source_incomplete'); throw visitsError; }
    };
    const getPrograms = () => {
        if (programs || programsError) {
            if (programsError) throw programsError;
            return programs;
        }
        try { programs = buildProgramFacts(snapshot); return programs; }
        catch (error) { programsError = error instanceof AnalysisError ? error : new AnalysisError('source_incomplete'); throw programsError; }
    };
    return Object.freeze({ snapshot, getVisits, getPrograms });
}

function unavailableSummaryMetrics(domain) {
    if (domain === 'visits') return { visit_sessions: unavailableMetric('sessions', 'source_incomplete'), unique_visitors: unavailableMetric('people', 'source_incomplete'), visitor_days: unavailableMetric('days', 'source_incomplete') };
    if (domain === 'duration') return { recorded_minutes: unavailableMetric('minutes', 'source_incomplete'), complete_duration_mean: unavailableMetric('minutes', 'source_incomplete'), complete_duration_median: unavailableMetric('minutes', 'source_incomplete'), missing_checkout_sessions: unavailableMetric('sessions', 'source_incomplete') };
    if (domain === 'programs') return { applications: unavailableMetric('count', 'source_incomplete'), joined_applications: unavailableMetric('count', 'source_incomplete'), waitlisted_applications: unavailableMetric('count', 'source_incomplete'), cancelled_applications: unavailableMetric('count', 'source_incomplete'), recorded_attendance: unavailableMetric('count', 'source_incomplete') };
    if (domain === 'feedback') return { satisfaction_mean: unavailableMetric('rating', 'source_incomplete'), satisfaction_response_count: unavailableMetric('count', 'source_incomplete') };
    if (domain === 'rentals') return { rental_bookings: unavailableMetric('count', 'source_incomplete') };
    if (domain === 'store') return { store_orders: unavailableMetric('count', 'source_incomplete') };
    return { survey_submissions: unavailableMetric('count', 'source_incomplete') };
}

function visitMetrics(summary, domain) {
    if (domain === 'visits') return {
        visit_sessions: metricCount(summary.visit_sessions, 'sessions'),
        unique_visitors: metricCount(summary.unique_visitors, 'people'),
        visitor_days: metricCount(summary.visitor_days, 'days'),
    };
    return {
        recorded_minutes: metricCount(summary.recorded_minutes, 'minutes'),
        complete_duration_mean: nullableMetric(summary.complete_duration_mean, 'minutes', summary.complete_duration_sessions),
        complete_duration_median: nullableMetric(summary.complete_duration_median, 'minutes', summary.complete_duration_sessions),
        missing_checkout_sessions: metricCount(summary.missing_checkout_sessions, 'sessions'),
    };
}

function programMetrics(summary, includeFeedback) {
    const metrics = {
        applications: metricCount(summary.applications),
        joined_applications: metricCount(summary.joined_applications),
        waitlisted_applications: metricCount(summary.waitlisted_applications),
        cancelled_applications: metricCount(summary.cancelled_applications),
        recorded_attendance: metricCount(summary.recorded_attendance),
    };
    if (includeFeedback) {
        if (summary.satisfaction_response_count === null) {
            metrics.satisfaction_mean = unavailableMetric('rating', 'satisfaction_source_unavailable');
            metrics.satisfaction_response_count = unavailableMetric('count', 'satisfaction_source_unavailable');
        } else {
            metrics.satisfaction_mean = nullableMetric(summary.satisfaction_mean, 'rating', summary.satisfaction_response_count);
            metrics.satisfaction_response_count = metricCount(summary.satisfaction_response_count);
        }
    }
    return metrics;
}

function operationMetrics(summary) {
    return {
        ...(summary.rentals === null ? unavailableSummaryMetrics('rentals') : { rental_bookings: metricCount(summary.rentals.rental_bookings) }),
        ...(summary.store === null ? unavailableSummaryMetrics('store') : { store_orders: metricCount(summary.store.store_orders) }),
        ...(summary.surveys === null ? unavailableSummaryMetrics('surveys') : { survey_submissions: metricCount(summary.surveys.survey_submissions) }),
    };
}

function summaryForPeriod(context, domains, period) {
    const metrics = {};
    const warnings = [];
    let visitSummary;
    let programSummary;
    if (domains.includes('visits') || domains.includes('duration')) {
        try {
            visitSummary = summarizeVisits(context.getVisits(), period);
            if (domains.includes('visits')) Object.assign(metrics, visitMetrics(visitSummary, 'visits'));
            if (domains.includes('duration')) Object.assign(metrics, visitMetrics(visitSummary, 'duration'));
        } catch {
            if (domains.includes('visits')) Object.assign(metrics, unavailableSummaryMetrics('visits'));
            if (domains.includes('duration')) Object.assign(metrics, unavailableSummaryMetrics('duration'));
            warnings.push('visit_source_incomplete');
        }
    }
    if (domains.includes('programs') || domains.includes('feedback')) {
        try {
            programSummary = summarizePrograms(context.getPrograms(), period);
            if (domains.includes('programs')) Object.assign(metrics, programMetrics(programSummary.total, false));
            if (domains.includes('feedback')) {
                const feedback = programMetrics(programSummary.total, true);
                metrics.satisfaction_mean = feedback.satisfaction_mean;
                metrics.satisfaction_response_count = feedback.satisfaction_response_count;
            }
            if (programSummary.quality.missing_program_dates) warnings.push('missing_program_date');
        } catch {
            if (domains.includes('programs')) Object.assign(metrics, unavailableSummaryMetrics('programs'));
            if (domains.includes('feedback')) Object.assign(metrics, unavailableSummaryMetrics('feedback'));
            warnings.push('program_source_incomplete');
        }
    }
    const requestedOperations = domains.filter(domain => ['rentals', 'store', 'surveys'].includes(domain));
    if (requestedOperations.length) {
        try {
            const operations = operationMetrics(summarizeOperations(context.snapshot, period));
            for (const domain of requestedOperations) {
                const key = domain === 'rentals' ? 'rental_bookings' : domain === 'store' ? 'store_orders' : 'survey_submissions';
                metrics[key] = operations[key];
                if (domain === 'store' && context.snapshot.site_scope) {
                    metrics[key] = unavailableMetric('count', 'site_attribution_unavailable');
                    warnings.push('site_attribution_unavailable');
                }
            }
        } catch {
            for (const domain of requestedOperations) Object.assign(metrics, unavailableSummaryMetrics(domain));
            warnings.push('operation_source_incomplete');
        }
    }
    return Object.freeze({ period, metrics: Object.freeze(metrics), warnings: Object.freeze(warnings), visitSummary, programSummary });
}

function comparisonRows(current, previous) {
    if (!previous) return [];
    return Object.keys(current.metrics).sort().map(metric_id => Object.freeze({
        metric_id,
        absolute_change: deltaMetric(current.metrics[metric_id], previous.metrics[metric_id]),
        relative_change: relativeChangeMetric(current.metrics[metric_id], previous.metrics[metric_id]),
    }));
}

function programRowMetrics(row, measures, satisfactionAvailable) {
    const metrics = {};
    if (measures.includes('applications')) {
        metrics.applications = metricCount(row.applications);
        metrics.joined_applications = metricCount(row.joined_applications);
        metrics.waitlisted_applications = metricCount(row.waitlisted_applications);
        metrics.cancelled_applications = metricCount(row.cancelled_applications);
    }
    if (measures.includes('recorded_attendance')) metrics.recorded_attendance = metricCount(row.recorded_attendance);
    if (measures.includes('satisfaction')) {
        if (!satisfactionAvailable) {
            metrics.satisfaction_mean = unavailableMetric('rating', 'satisfaction_source_unavailable');
            metrics.satisfaction_response_count = unavailableMetric('count', 'satisfaction_source_unavailable');
        } else {
            metrics.satisfaction_mean = nullableMetric(row.satisfaction_mean, 'rating', row.satisfaction_response_count);
            metrics.satisfaction_response_count = metricCount(row.satisfaction_response_count);
        }
    }
    return Object.freeze(metrics);
}

function engagementPeriod(context, request, period, disclosurePolicy) {
    const facts = context.getPrograms();
    const summary = summarizePrograms(facts, period, { programRefs: request.program_refs });
    const satisfactionAvailable = facts.satisfaction !== null;
    const totals = programRowMetrics(summary.total, request.measures, satisfactionAvailable);
    let programRows = request.breakdown === 'program'
        ? summary.programs.map(row => Object.freeze({ program_ref: row.program_ref, metrics: programRowMetrics(row, request.measures, satisfactionAvailable), subjects: row.subjects }))
        : [];
    if (Array.isArray(context.snapshot.approved_programs)) {
        const titles = new Map(context.snapshot.approved_programs.map(row => [row.program_ref, row.title]));
        programRows = programRows.filter(row => titles.has(row.program_ref)).map(row => ({ ...row, title: titles.get(row.program_ref) }));
    }
    const disclosure = discloseProgramBreakdown(programRows, disclosurePolicy);
    const warnings = [];
    if (disclosure.suppressed) {
        programRows = [];
        warnings.push('privacy_suppressed');
    } else {
        programRows = disclosure.rows.map(({ subjects, ...row }) => row);
    }
    let participation = [];
    if (request.measures.includes('participation_distribution')) {
        const counts = summary.participation_distribution;
        const lowCell = Object.values(counts).some(value => value > 0 && value < disclosurePolicy.minimum_subjects);
        if (lowCell) warnings.push('privacy_suppressed');
        else participation = Object.freeze([
            Object.freeze({ bucket: '1', people: metricCount(counts['1'], 'people') }),
            Object.freeze({ bucket: '2', people: metricCount(counts['2'], 'people') }),
            Object.freeze({ bucket: '3_plus', people: metricCount(counts['3_plus'], 'people') }),
        ]);
    }
    let transitions = [];
    if (request.measures.includes('transitions')) {
        const transitionData = programTransitions(facts, period, request.program_refs);
        const lowCell = transitionData.edges.some(edge => edge.people > 0 && edge.people < disclosurePolicy.minimum_subjects);
        if (lowCell) warnings.push('privacy_suppressed');
        else transitions = transitionData.edges.map(edge => Object.freeze({
            from_program_ref: edge.from_program_ref,
            to_program_ref: edge.to_program_ref,
            people: metricCount(edge.people, 'people'),
        }));
        if (transitionData.same_day_ambiguous_people) warnings.push('same_day_transition_excluded');
    }
    return Object.freeze({
        period,
        totals,
        programs: Object.freeze(programRows),
        participation_distribution: participation,
        transitions: Object.freeze(transitions),
        warnings: Object.freeze([...new Set(warnings)]),
        quality: summary.quality,
    });
}

function revisitMetrics(analysis, policy) {
    const initiative = suppressCohortMetrics({
        initiative_respondents: metricCount(analysis.initiative_respondents, 'people'),
        self_reported_unprompted_revisited_people: analysis.initiative_respondents ? metricCount(analysis.self_reported_unprompted_revisited_people, 'people') : unavailableMetric('people', 'initiative_not_observed'),
    }, analysis.initiative_respondents, policy);
    return Object.freeze({
        cohort_size: metricCount(analysis.cohort_size, 'people'),
        observation_complete: analysis.observation_complete === null ? unavailableMetric('people', analysis.quality_reason || 'observation_incomplete') : metricCount(analysis.observation_complete, 'people'),
        observation_pending: metricCount(analysis.observation_pending, 'people'),
        coverage_excluded_people: metricCount(analysis.excluded_observations, 'people'),
        matured_cohort: metricCount(analysis.matured_cohort, 'people'),
        recorded_revisited_people: analysis.matured_cohort || !analysis.cohort_size ? metricCount(analysis.recorded_revisited_people, 'people') : unavailableMetric('people', 'observation_pending'),
        recorded_revisit_rate: analysis.recorded_revisit_rate === null ? unavailableMetric('ratio', 'zero_denominator') : ratioMetric(analysis.recorded_revisited_people, analysis.matured_cohort),
        recorded_non_program_revisited_people: analysis.matured_cohort || !analysis.cohort_size ? metricCount(analysis.recorded_non_program_revisited_people, 'people') : unavailableMetric('people', 'observation_pending'),
        ...initiative.metrics,
        revisited_people: analysis.revisited_people === null ? unavailableMetric('people', analysis.quality_reason || 'observation_incomplete') : metricCount(analysis.revisited_people, 'people'),
        revisit_rate: analysis.revisit_rate === null ? unavailableMetric('ratio', analysis.quality_reason || 'zero_denominator')
            : ratioMetric(analysis.revisited_people, analysis.observation_complete),
    });
}

const measureDefinition = Object.freeze({ visitor_days: ['days', 'before_after_visit_days'], visit_sessions: ['sessions', 'before_after_visit_sessions'], measured_duration: ['minutes', 'before_after_measured_duration'] });

function beforeAfterChanges(analysis, policy) {
    return analysis.changes.map(change => {
        const [unit] = measureDefinition[change.measure];
        const base = {
            paired_people: metricCount(change.paired_people, 'people'),
            excluded_people: metricCount(change.excluded_people, 'people'),
            before_mean: nullableMetric(change.before_mean, unit, change.paired_people),
            after_mean: nullableMetric(change.after_mean, unit, change.paired_people),
            mean_change: nullableMetric(change.mean_change, unit, change.paired_people),
        };
        const disclosed = suppressCohortMetrics(base, change.paired_people, policy);
        const recorded = suppressCohortMetrics({
            recorded_paired_people: metricCount(change.recorded_paired_people, 'people'),
            recorded_before_mean: nullableMetric(change.recorded_before_mean, unit, change.recorded_paired_people),
            recorded_after_mean: nullableMetric(change.recorded_after_mean, unit, change.recorded_paired_people),
            recorded_mean_change: nullableMetric(change.recorded_mean_change, unit, change.recorded_paired_people),
            missing_duration_people: metricCount(change.missing_duration_people, 'people'),
        }, change.recorded_paired_people, policy);
        return Object.freeze({ measure: change.measure, ...disclosed.metrics, ...recorded.metrics });
    });
}

function sanitizedCatalog(rows) {
    if (!Array.isArray(rows)) throw new AnalysisError('source_incomplete');
    return Object.freeze(rows.map(raw => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !['program_ref', 'title', 'scheduled_date', 'recruitment_status', 'public_description'].includes(key))
            || typeof raw.program_ref !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(raw.program_ref)
            || typeof raw.title !== 'string' || raw.title.length > 200
            || raw.scheduled_date !== null && (typeof raw.scheduled_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.scheduled_date))
            || !['open', 'closed', 'unknown'].includes(raw.recruitment_status)
            || raw.public_description !== null && (typeof raw.public_description !== 'string' || raw.public_description.length > 2000)) {
            throw new AnalysisError('source_incomplete');
        }
        return Object.freeze({
            program_ref: raw.program_ref,
            title: raw.title,
            scheduled_date: raw.scheduled_date,
            recruitment_status: raw.recruitment_status,
            public_description: raw.public_description,
        });
    }));
}

function capabilityCoverage(snapshot) {
    return ['logs', 'programs', 'feedback', 'rentals', 'store', 'surveys'].map(domain => {
        const coverage = coverageFor(snapshot, domain);
        return Object.freeze({ domain, start: coverage.start, end_exclusive: coverage.end_exclusive, status: coverage.status, reason: coverage.reason });
    });
}

export function createCenterAnalysisService({ repository, now = () => new Date(), requestId = randomRequestId, disclosurePolicy = DEFAULT_DISCLOSURE_POLICY } = {}) {
    const currentTime = () => date(typeof now === 'function' ? now() : now);
    const readSnapshot = async (operation, request) => {
        if (!repository || typeof repository.readSnapshot !== 'function') throw new AnalysisError('not_configured');
        const snapshot = await repository.readSnapshot({ operation, request });
        if (!snapshot || snapshot.complete !== true || !snapshot.datasets || typeof snapshot.as_of !== 'string') throw new AnalysisError('source_incomplete');
        return scopeSnapshotToSite(snapshot, request.site);
    };
    return Object.freeze({
        async run({ operation, input, actor }) {
            const id = requestId();
            const invocationTime = currentTime();
            let request;
            let snapshot;
            const result = options => {
                const scopeWarnings = request?.site ? siteScopeWarnings(snapshot, request.site) : [];
                const incomplete = scopeWarnings.some(row => row.code === 'site_attribution_incomplete');
                return makeAnalysisResult({
                    ...options,
                    ...(incomplete ? { quality: { ...options.quality, status: options.quality?.status === 'incomplete' ? 'incomplete' : 'limited', reasons: [...new Set([...(options.quality?.reasons || []), 'site_attribution_incomplete'])] } } : {}),
                    ...(request?.site ? { data: { ...options.data, scope: siteScopeMetadata(snapshot, request.site) }, warnings: [...(options.warnings || []), ...scopeWarnings] } : {}),
                });
            };
            try {
                requireCapability(actor, requiredCapability(operation));
                request = parseOperationInput(operation, input, { now: invocationTime });
                if (operation === 'get_metric_definitions') {
                    const data = { definitions: definitionsFor(request.metric_ids) };
                    return result({ requestId: id, status: 'ok', asOf: invocationTime.toISOString(), data, quality: makeQuality(), sources: [] });
                }
                if (operation === 'get_program_catalog') {
                    if (!repository || typeof repository.listProgramCatalog !== 'function') throw new AnalysisError('not_configured');
                    const catalog = sanitizedCatalog(await repository.listProgramCatalog(request));
                    return result({ requestId: id, status: 'ok', asOf: invocationTime.toISOString(), data: { programs: catalog.slice(0, request.limit), has_more: catalog.length > request.limit }, quality: makeQuality(), sources: source });
                }
                snapshot = await readSnapshot(operation, request);
                const asOf = snapshot.as_of;
                const context = contextFor(snapshot);
                if (Array.isArray(snapshot.approved_programs) && request.program_refs?.some(ref => !snapshot.approved_programs.some(row => row.program_ref === ref))) {
                    throw new AnalysisError('forbidden');
                }
                if (operation === 'get_analysis_capabilities') {
                    const data = {
                        operations: operationCapabilities(),
                        supported_sites: SITE_DEFINITIONS,
                        site_filter: { parameter: 'site', default: 'ALL', unavailable_domains: ['store'], max_quarter_days: 92 },
                        available_metric_ids: Object.keys(METRIC_DEFINITIONS).sort(),
                        coverage: capabilityCoverage(snapshot),
                        limitations: ['결과는 현재 기록 상태를 기준으로 계산합니다.', '개인별 행과 자유서술 응답은 제공하지 않습니다.'],
                    };
                    return result({ requestId: id, status: 'ok', asOf, data, quality: makeQuality({ status: 'limited', reasons: ['recorded_current_state'] }), sources: source });
                }
                if (operation === 'get_operation_summary') {
                    const prior = previousPeriod(request.period, request.comparison);
                    const current = summaryForPeriod(context, request.domains, request.period);
                    const previous = prior ? summaryForPeriod(context, request.domains, prior) : null;
                    const flatMetrics = { ...current.metrics, ...(previous?.metrics || {}) };
                    const warnings = [...new Set([...current.warnings, ...(previous?.warnings || [])])].map(code => ({ code, message: code === 'missing_program_date' ? '일부 프로그램의 날짜가 없어 해당 기록을 계산에서 제외했습니다.' : code === 'site_attribution_unavailable' ? '스토어 주문에는 센터를 확인할 수 있는 연결값이 없어 센터별 주문 건수를 제공하지 않습니다.' : '일부 원천 기록을 사용할 수 없어 해당 지표를 제공하지 못했습니다.' }));
                    return result({
                        requestId: id,
                        status: metricStatus(flatMetrics),
                        asOf,
                        period: request.period,
                        data: { periods: [current, ...(previous ? [previous] : [])].map(row => ({ period: row.period, metrics: row.metrics, ...(request.domains.includes('feedback') ? { operating_context: satisfactionContext(snapshot, row.period, row.metrics) } : {}) })), comparisons: comparisonRows(current, previous) },
                        quality: summaryQuality(snapshot, { limited: ['recorded_current_state'], incomplete: warnings.some(warning => warning.code.includes('incomplete')) ? ['source_incomplete'] : [] }),
                        warnings,
                        sources: source,
                    });
                }
                if (operation === 'analyze_program_engagement') {
                    const prior = previousPeriod(request.period, request.comparison);
                    const current = engagementPeriod(context, request, request.period, disclosurePolicy);
                    const previous = prior ? engagementPeriod(context, request, prior, disclosurePolicy) : null;
                    const flat = { ...current.totals, ...(previous?.totals || {}) };
                    const warningCodes = [...new Set([...current.warnings, ...(previous?.warnings || [])])];
                    return result({
                        requestId: id,
                        status: metricStatus(flat),
                        asOf,
                        period: request.period,
                        data: { periods: [current, ...(previous ? [previous] : [])].map(row => ({ period: row.period, totals: row.totals, programs: row.programs, participation_distribution: row.participation_distribution, transitions: row.transitions, ...(request.measures.includes('satisfaction') ? { operating_context: satisfactionContext(snapshot, row.period, row.totals) } : {}) })) },
                        quality: summaryQuality(snapshot, { limited: ['recorded_current_state'], incomplete: current.quality.missing_program_dates ? ['missing_program_date'] : [] }),
                        warnings: warningCodes.map(code => ({ code, message: code === 'privacy_suppressed' ? '작은 집단을 보호하기 위해 세부 결과를 숨겼습니다.' : code === 'same_day_transition_excluded' ? '같은 날 순서가 불명확한 참여자는 이동 분석에서 제외했습니다.' : '일부 원천 기록이 제한되었습니다.' })),
                        sources: source,
                    });
                }
                if (operation === 'analyze_revisits') {
                    const analysis = analyzeRevisits({ snapshot, visitFacts: context.getVisits(), programFacts: context.getPrograms(), ...request });
                    const disclosed = suppressCohortMetrics(revisitMetrics(analysis, disclosurePolicy), analysis.cohort_size, disclosurePolicy);
                    const warnings = [];
                    warnings.push({ code: 'initiative_not_observed', message: '프로그램 출석 기록이 없는 날의 재방문은 참고 지표입니다. 기존 기록에는 교사 연락 여부가 없어 연락 없는 자발적 방문으로 확정할 수 없습니다.' });
                    if (analysis.quality_reason) warnings.push({ code: 'recorded_visits_only', message: 'recorded 지표는 저장된 방문 기록에서 확인한 값입니다. 기록이 없는 것을 미방문으로 확정하거나 전체 재방문율로 해석하지 마세요.' });
                    if (analysis.observation_pending) warnings.push({ code: 'observation_pending', message: `추적 기간이 끝나지 않은 ${analysis.observation_pending}명은 재방문율 분모에서 제외했습니다.` });
                    if (analysis.quality_reason) warnings.push({ code: analysis.quality_reason, message: '관찰 범위를 확인할 수 없어 확정 재방문율을 제공하지 못했습니다.' });
                    if (disclosed.suppressed) warnings.push({ code: 'privacy_suppressed', message: '작은 집단을 보호하기 위해 결과를 숨겼습니다.' });
                    return result({
                        requestId: id,
                        status: metricStatus(disclosed.metrics),
                        asOf,
                        period: request.period,
                        data: { ...disclosed.metrics, ...(analysis.observation_pending ? { suggested_mature_period: { start: shiftDay(request.period.start, -request.followup_days), end_exclusive: shiftDay(request.period.end_exclusive, -request.followup_days) } } : {}) },
                        quality: summaryQuality(snapshot, { limited: warnings.length ? ['revisit_observation_limited'] : [] }),
                        warnings,
                        sources: source,
                    });
                }
                if (operation === 'analyze_program_visit_change') {
                    const analysis = analyzeProgramVisitChange({ snapshot, visitFacts: context.getVisits(), programFacts: context.getPrograms(), ...request });
                    const changes = beforeAfterChanges(analysis, disclosurePolicy);
                    const cohort = analysis.cohort_size > 0 && analysis.cohort_size < disclosurePolicy.minimum_subjects
                        ? suppressedMetric('people') : metricCount(analysis.cohort_size, 'people');
                    const metrics = Object.fromEntries(changes.flatMap(change => Object.entries(change).filter(([key]) => key !== 'measure').map(([key, value]) => [`${change.measure}:${key}`, value])));
                    return result({
                        requestId: id,
                        status: metricStatus({ cohort_size: cohort, ...metrics }),
                        asOf,
                        period: request.period,
                        data: { cohort_size: cohort, observation_pending: cohort.status === 'suppressed' ? suppressedMetric('people') : metricCount(analysis.observation_pending, 'people'), coverage_excluded_people: cohort.status === 'suppressed' ? suppressedMetric('people') : metricCount(analysis.coverage_excluded_people, 'people'), changes, ...(analysis.observation_pending ? { suggested_mature_period: { start: shiftDay(request.period.start, -request.window_days), end_exclusive: shiftDay(request.period.end_exclusive, -request.window_days) } } : {}) },
                        quality: summaryQuality(snapshot, { limited: analysis.quality_reason ? [analysis.quality_reason] : [] }),
                        warnings: [
                            ...(analysis.observation_pending ? [{ code: 'observation_pending', message: '참석 후 추적 기간이 끝나지 않은 참여자는 전후 비교에서 제외했습니다.' }] : []),
                            ...(analysis.quality_reason ? [{ code: analysis.quality_reason, message: '확정 전후 비교는 관찰 범위가 확인된 사람만 포함합니다. recorded 전후 비교는 저장된 기록 기준이며 기록 누락을 0회 방문으로 확정하지 않습니다.' }] : []),
                        ],
                        sources: source,
                    });
                }
                throw new AnalysisError('invalid_input');
            } catch (error) {
                return makeErrorResult({ requestId: id, asOf: snapshot?.as_of || invocationTime.toISOString(), period: request?.period, error });
            }
        },
    });
}
