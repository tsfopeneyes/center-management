import { StatisticsError } from './policy.mjs';

const visitFields = ['visit_sessions', 'unique_visitors', 'member_space_visits', 'guest_space_visits', 'member_unique_visitors', 'guest_unique_visitors', 'visitor_days'];
const durationFields = ['recorded_minutes', 'complete_minutes', 'valid_sessions', 'mean_complete_minutes', 'median_complete_minutes', 'partial_recorded_minutes', 'estimated_missing_checkout_minutes', 'missing_checkout_sessions'];
const programFields = ['joined', 'waitlisted', 'cancelled', 'attended', 'application_records', 'unique_applicants'];
const pick = (row, fields) => Object.fromEntries(fields.map(field => {
    const value = row[field];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new StatisticsError('source_incomplete');
    return [field, value];
}));

// Catalog is explicitly reviewed server configuration, never request text or a
// notices row. Regex rejection is additional defense, NOT anonymization.
export function approvedMetadata(entry) {
    if (entry?.approved !== true || entry?.published !== true || typeof entry.alias !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(entry.alias)) return null;
    const output = { program: entry.alias };
    for (const field of ['title', 'description', 'audience', 'schedule', 'location', 'recruitment_status']) {
        const value = entry[field];
        if (value == null) continue;
        if (typeof value !== 'string' || value.length > (field === 'description' ? 2000 : 200) || /[\u0000-\u001f<>]|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:01[016789][- ]?\d{3,4}[- ]?\d{4})/i.test(value)) return null;
        output[field] = value;
    }
    if (entry.capacity != null) {
        if (!Number.isSafeInteger(entry.capacity) || entry.capacity < 0) return null;
        output.capacity = entry.capacity;
    }
    return output;
}

export function publishStatistics(result, request, policy) {
    if (policy?.reviewed !== true || !policy.id || !Array.isArray(policy.metrics) || !Array.isArray(policy.periodKinds)) throw new StatisticsError('policy_review_required');
    const output = { period: { kind: result.window.kind, start: result.window.startDay, end_exclusive: result.window.endDay }, metrics: {} };
    for (const metric of request.metrics) {
        if (!policy.metrics.includes(metric) || !policy.periodKinds.includes(result.window.kind)) {
            output.metrics[metric] = { status: 'review_required' }; continue;
        }
        // Reviewer decides on subject/cell/dominance limits per family. Absence
        // is not treated as authorization; explicit exact-count permission needed.
        const rule = policy.rules?.[metric];
        const population = metric === 'programs' ? result.programs.risk.subjects : metric === 'duration' ? result.risk.duration_subjects : result.risk.visitor_subjects;
        if (!rule || rule.allowExact !== true || !Number.isSafeInteger(rule.minimumSubjects) || rule.minimumSubjects < 0 ||
            (population > 0 && population < rule.minimumSubjects) ||
            (metric === 'duration' && (!Number.isFinite(rule.maximumContributorShare) || rule.maximumContributorShare < 0 || rule.maximumContributorShare > 1 || result.risk.largest_duration_share > rule.maximumContributorShare))) {
            output.metrics[metric] = { status: 'review_required' }; continue;
        }
        const values = metric === 'programs' ? pick(result.programs.summary, programFields) : pick(result[metric], metric === 'visits' ? visitFields : durationFields);
        // Protect summary subgroups too: an overall population threshold does
        // not protect a one-person guest/member or cancellation count.
        if (rule.summaryMinimumCell != null) {
            const countFields = metric === 'visits' ? visitFields : metric === 'programs' ? programFields
                : ['valid_sessions', 'missing_checkout_sessions'];
            if (!Number.isSafeInteger(rule.summaryMinimumCell) || rule.summaryMinimumCell < 0
                || countFields.some(field => values[field] > 0 && values[field] < rule.summaryMinimumCell)) {
                output.metrics[metric] = { status: 'review_required' }; continue;
            }
        }
        output.metrics[metric] = { status: 'available', values };
        if (metric === 'programs' && request.breakdown !== 'none') {
            if (!policy.breakdowns?.includes(request.breakdown) || !Number.isSafeInteger(rule.minimumCell) || rule.minimumCell < 0) {
                output.metrics[metric].breakdown = { status: 'review_required' }; continue;
            }
            const rows = request.breakdown === 'session' ? result.programs.occurrences : result.programs.details;
            // Whole breakdown is withheld rather than expose complementary cells.
            const prepared = rows.map(row => {
                const metadata = approvedMetadata(policy.catalog?.[row.program_ref]);
                if (!metadata || row.subjects > 0 && row.subjects < rule.minimumSubjects || programFields.some(field => row[field] > 0 && row[field] < rule.minimumCell)) return null;
                if (request.breakdown === 'session' && !/^[a-z0-9_-]{1,64}$/.test(policy.catalog?.[row.program_ref]?.sessions?.[row.occurrence_ref] || '')) return null;
                return { ...metadata, ...(request.breakdown === 'session' ? { session: policy.catalog[row.program_ref].sessions[row.occurrence_ref], date: row.date } : {}), ...pick(row, programFields) };
            });
            output.metrics[metric].breakdown = prepared.some(row => !row) ? { status: 'review_required' } : { status: 'available', rows: prepared };
        }
    }
    return output;
}
