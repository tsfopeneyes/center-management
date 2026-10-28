import { AnalysisError, kstDay, shiftDay, validDay } from './contracts.mjs';
import { coverageFor, coverageIncludes, inPeriod, rangesForComparison, stablePersonKey } from './normalize.mjs';
import { personVisitSummary } from './visits.mjs';

const firstByPerson = rows => {
    const first = new Map();
    for (const row of rows) {
        if (!first.has(row.person) || first.get(row.person).date > row.date) first.set(row.person, row);
    }
    return first;
};

const withinRevisitWindow = (day, indexDay, followupDays) => day > indexDay && day < shiftDay(indexDay, followupDays + 1);

const numericMean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function coverageReason(coverage) {
    if (coverage?.reason) return coverage.reason;
    return coverage?.status === 'unknown' ? 'coverage_unknown' : 'coverage_incomplete';
}

// Exact revisit rates require known log coverage.  A fully read query range is
// not enough proof that the system collected visits during the whole window.
export function analyzeRevisits({ snapshot, visitFacts, programFacts, period, cohort, program_refs: programRefs, followup_days: followupDays }) {
    if (!validDay(period?.start) || !validDay(period?.end_exclusive)) throw new AnalysisError('source_incomplete');
    const cohortRows = cohort === 'visitors'
        ? visitFacts.sessions.filter(session => inPeriod(session.day, period)).map(session => ({ person: session.person, date: session.day }))
        : programFacts.attendance.filter(row => inPeriod(row.date, period) && programRefs.includes(row.program_ref));
    const first = firstByPerson(cohortRows);
    const asOfDay = kstDay(snapshot.as_of);
    const coverage = coverageFor(snapshot, 'logs');
    let complete = 0;
    let pending = 0;
    let unavailable = 0;
    let revisited = 0;
    let matured = 0;
    let recordedRevisited = 0;
    let recordedNonProgram = 0;
    let initiativeRespondents = 0;
    let selfReportedUnprompted = 0;
    const initiative = new Map();
    for (const row of snapshot.datasets?.visitInitiative || []) {
        if (!row || typeof row.user_id !== 'string' || !Number.isFinite(Date.parse(row.visited_at))
            || !['free_use','program','other','unknown'].includes(row.purpose) || !['yes','no','unknown'].includes(row.teacher_contact)) throw new AnalysisError('source_incomplete');
        const key = `${stablePersonKey(row.user_id)}:${kstDay(row.visited_at)}`;
        const previous = initiative.get(key);
        // Multiple visits/answers on one day must agree before attribution.
        initiative.set(key, previous && (previous.purpose !== row.purpose || previous.teacher_contact !== row.teacher_contact)
            ? { purpose: 'unknown', teacher_contact: 'unknown' } : row);
    }
    const attendanceDays = new Set(programFacts.attendance.map(row => `${row.person}:${row.date}`));
    for (const index of first.values()) {
        const observationEnd = shiftDay(index.date, followupDays + 1);
        if (asOfDay < observationEnd) {
            pending += 1;
            continue;
        }
        matured += 1;
        const visits = visitFacts.by_person.get(index.person) || [];
        const returns = visits.filter(visit => withinRevisitWindow(visit.day, index.date, followupDays));
        if (returns.length) recordedRevisited += 1;
        if (returns.some(visit => !attendanceDays.has(`${index.person}:${visit.day}`))) recordedNonProgram += 1;
        const context = returns.map(visit => initiative.get(`${index.person}:${visit.day}`)).filter(Boolean);
        if (context.some(row => row.teacher_contact !== 'unknown' && row.purpose !== 'unknown')) initiativeRespondents += 1;
        if (context.some(row => row.teacher_contact === 'no' && row.purpose === 'free_use')) selfReportedUnprompted += 1;
        if (!coverageIncludes(coverage, shiftDay(index.date, 1), observationEnd)) {
            unavailable += 1;
            continue;
        }
        complete += 1;
        if (returns.length) revisited += 1;
    }
    const observationComplete = unavailable
        ? null
        : complete;
    const qualityReason = unavailable ? coverageReason(coverage) : null;
    return Object.freeze({
        cohort_size: first.size,
        observation_complete: observationComplete,
        observation_pending: pending,
        excluded_observations: unavailable,
        revisited_people: unavailable ? null : revisited,
        revisit_rate: unavailable || complete === 0 ? null : revisited / complete,
        quality_reason: qualityReason,
        matured_cohort: matured,
        recorded_revisited_people: recordedRevisited,
        recorded_revisit_rate: matured ? recordedRevisited / matured : null,
        recorded_non_program_revisited_people: recordedNonProgram,
        initiative_respondents: initiativeRespondents,
        self_reported_unprompted_revisited_people: selfReportedUnprompted,
    });
}

function firstTargetAttendance(programFacts, period, refs) {
    const filtered = programFacts.attendance.filter(row => inPeriod(row.date, period) && refs.includes(row.program_ref));
    return firstByPerson(filtered);
}

function measurePerson(visitFacts, person, range, measure) {
    const row = personVisitSummary(visitFacts, person, range);
    if (measure === 'visitor_days') return { value: row.visitor_days, valid: true };
    if (measure === 'visit_sessions') return { value: row.visit_sessions, valid: true };
    if (measure === 'measured_duration') return { value: row.measured_duration, valid: row.measured_sessions > 0 };
    throw new AnalysisError('invalid_input');
}

export function analyzeProgramVisitChange({ snapshot, visitFacts, programFacts, period, program_refs: programRefs, window_days: windowDays, measures }) {
    const cohort = firstTargetAttendance(programFacts, period, programRefs);
    const coverage = coverageFor(snapshot, 'logs');
    const values = new Map(measures.map(measure => [measure, { before: [], after: [], excluded: 0, recordedBefore: [], recordedAfter: [], missingDuration: 0 }]));
    let pending = 0;
    let unavailable = 0;
    const asOfDay = kstDay(snapshot.as_of);
    for (const index of cohort.values()) {
        const { before, after } = rangesForComparison(index.date, windowDays);
        if (after.end_exclusive > asOfDay) {
            pending += 1;
            for (const value of values.values()) value.excluded += 1;
            continue;
        }
        const covered = coverageIncludes(coverage, before.start, after.end_exclusive);
        if (!covered) unavailable += 1;
        for (const measure of measures) {
            const beforeValue = measurePerson(visitFacts, index.person, before, measure);
            const afterValue = measurePerson(visitFacts, index.person, after, measure);
            const value = values.get(measure);
            if (!beforeValue.valid || !afterValue.valid) {
                value.excluded += 1;
                value.missingDuration += 1;
                continue;
            }
            value.recordedBefore.push(beforeValue.value);
            value.recordedAfter.push(afterValue.value);
            if (!covered) { value.excluded += 1; continue; }
            value.before.push(beforeValue.value);
            value.after.push(afterValue.value);
        }
    }
    return Object.freeze({
        cohort_size: cohort.size,
        observation_pending: pending,
        coverage_excluded_people: unavailable,
        coverage_complete: coverage.status === 'complete',
        quality_reason: unavailable ? coverageReason(coverage) : null,
        changes: Object.freeze(measures.map(measure => {
            const value = values.get(measure);
            const beforeMean = numericMean(value.before);
            const afterMean = numericMean(value.after);
            return Object.freeze({
                measure,
                paired_people: value.before.length,
                excluded_people: value.excluded,
                before_mean: beforeMean,
                after_mean: afterMean,
                mean_change: beforeMean === null || afterMean === null ? null : afterMean - beforeMean,
                recorded_paired_people: value.recordedBefore.length,
                missing_duration_people: value.missingDuration,
                recorded_before_mean: numericMean(value.recordedBefore),
                recorded_after_mean: numericMean(value.recordedAfter),
                recorded_mean_change: value.recordedBefore.length ? numericMean(value.recordedAfter) - numericMean(value.recordedBefore) : null,
            });
        })),
    });
}

// Build the true complete sequence first, then retain only requested edges.  A
// selected A/C pair must not be fabricated merely because unselected B was
// removed from the sequence.
export function programTransitions(programFacts, period, selectedRefs = null) {
    const byPerson = new Map();
    for (const row of programFacts.attendance) {
        if (!inPeriod(row.date, period)) continue;
        if (!byPerson.has(row.person)) byPerson.set(row.person, []);
        byPerson.get(row.person).push(row);
    }
    const edgePeople = new Map();
    let sameDayAmbiguousPeople = 0;
    for (const rows of byPerson.values()) {
        rows.sort((left, right) => left.date.localeCompare(right.date) || left.program_ref.localeCompare(right.program_ref));
        const dates = new Map();
        for (const row of rows) {
            if (!dates.has(row.date)) dates.set(row.date, new Set());
            dates.get(row.date).add(row.program_ref);
        }
        if ([...dates.values()].some(refs => refs.size > 1)) {
            sameDayAmbiguousPeople += 1;
            continue;
        }
        const sequence = [];
        for (const row of rows) if (sequence.at(-1) !== row.program_ref) sequence.push(row.program_ref);
        const perPerson = new Set();
        for (let index = 1; index < sequence.length; index += 1) {
            const from = sequence[index - 1], to = sequence[index];
            if (from === to || selectedRefs && (!selectedRefs.includes(from) || !selectedRefs.includes(to))) continue;
            perPerson.add(`${from}\u0000${to}`);
        }
        for (const edge of perPerson) {
            if (!edgePeople.has(edge)) edgePeople.set(edge, 0);
            edgePeople.set(edge, edgePeople.get(edge) + 1);
        }
    }
    return Object.freeze({
        edges: Object.freeze([...edgePeople.entries()].map(([edge, people]) => {
            const [from_program_ref, to_program_ref] = edge.split('\u0000');
            return Object.freeze({ from_program_ref, to_program_ref, people });
        }).sort((left, right) => left.from_program_ref.localeCompare(right.from_program_ref) || left.to_program_ref.localeCompare(right.to_program_ref))),
        same_day_ambiguous_people: sameDayAmbiguousPeople,
    });
}
