import { suppressedMetric } from './contracts.mjs';

export const DEFAULT_DISCLOSURE_POLICY = Object.freeze({
    minimum_subjects: 5,
    maximum_contributor_share: 0.5,
});

const positiveSmall = (value, minimum) => Number.isFinite(value) && value > 0 && value < minimum;

export function suppressCohortMetrics(metrics, subjects, policy = DEFAULT_DISCLOSURE_POLICY) {
    if (!positiveSmall(subjects, policy.minimum_subjects)) return Object.freeze({ metrics, suppressed: false });
    const output = Object.fromEntries(Object.entries(metrics).map(([name, metric]) => [name, suppressedMetric(metric.unit)]));
    return Object.freeze({ metrics: Object.freeze(output), suppressed: true });
}

// If any named program cell falls under the threshold, withhold the complete
// breakdown rather than leaving enough totals to reconstruct that cell.
export function discloseProgramBreakdown(rows, policy = DEFAULT_DISCLOSURE_POLICY) {
    if (rows.some(row => positiveSmall(row.subjects, policy.minimum_subjects))) {
        return Object.freeze({ rows: Object.freeze([]), suppressed: true, reason: 'privacy_suppressed' });
    }
    return Object.freeze({ rows: Object.freeze(rows), suppressed: false, reason: null });
}

export function discloseContribution(metric, risk, policy = DEFAULT_DISCLOSURE_POLICY) {
    if (risk?.subjects > 0 && risk.subjects < policy.minimum_subjects) return suppressedMetric(metric.unit);
    if (risk?.largest_duration_share > policy.maximum_contributor_share) return suppressedMetric(metric.unit, 'contribution_dominance');
    return metric;
}
