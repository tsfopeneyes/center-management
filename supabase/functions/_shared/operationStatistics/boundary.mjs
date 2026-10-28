import { StatisticsError, validateRequest } from './policy.mjs';
import { calculateStatistics } from './aggregate.mjs';
import { publishStatistics } from './publication.mjs';

// No listener, key, OAuth configuration or database adapter is created here.
// Authentication and release authorization are trusted SERVER dependencies.
export function createStatisticsBoundary({ authenticate, authorizedSubject, readSources, publicationPolicy, authorizeRelease, now = () => new Date() } = {}) {
    return async (input, credential) => {
        try {
            if (typeof authenticate !== 'function' || !authorizedSubject) throw new StatisticsError('not_configured');
            let identity;
            try { identity = await authenticate(credential); } catch { throw new StatisticsError('unauthorized'); }
            if (!identity || identity.verified !== true || identity.subject !== authorizedSubject || identity.active !== true || !Array.isArray(identity.scopes) || !identity.scopes.includes('center:statistics:read')) throw new StatisticsError('unauthorized');
            const at = now(), request = validateRequest(input, at);
            if (publicationPolicy?.reviewed !== true || typeof authorizeRelease !== 'function') throw new StatisticsError('policy_review_required');
            // The guard must cover overlap, differences, refreshes and concurrency
            // across all authorized requests; a per-process map cannot prove this.
            const release = await authorizeRelease({ subject: identity.subject, request, policyId: publicationPolicy.id, asOf: at.toISOString() });
            if (release?.allowed !== true) throw new StatisticsError('release_review_required');
            if (typeof readSources !== 'function') throw new StatisticsError('not_configured');
            const first = request.windows[0], last = request.windows.at(-1);
            const source = await readSources({ ...last, start: first.start, startDay: first.startDay, asOf: at.toISOString() });
            const periods = request.windows.map(window => publishStatistics(calculateStatistics(source, window, at), request, publicationPolicy));
            const comparison = periods.length === 2 ? Object.fromEntries(request.metrics.map(metric => {
                const prior = periods[0].metrics[metric], current = periods[1].metrics[metric];
                if (prior.status !== 'available' || current.status !== 'available') return [metric, { status: 'review_required' }];
                return [metric, { status: 'available', delta: Object.fromEntries(Object.keys(current.values).map(field => [field,
                    current.values[field] === null || prior.values[field] === null ? null : current.values[field] - prior.values[field]])) }];
            })) : undefined;
            return { status: 'ok', periods, ...(comparison ? { comparison } : {}) };
        } catch (error) {
            return { status: 'unavailable', code: error instanceof StatisticsError ? error.code : 'source_incomplete' };
        }
    };
}
