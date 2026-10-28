import { validateRequest, StatisticsError } from '../operationStatistics/policy.mjs';
import { createStatisticsBoundary } from '../operationStatistics/boundary.mjs';
import { withCenterTransaction } from './liveStore.mjs';

// Durable immutable outputs; deny all overlapping releases. No raw rows.
export function createPublishedStatistics({ pool, readSources, policy, subject, now = () => new Date() }) {
    return async (input, identity) => {
        try {
            if (policy?.reviewed !== true || !policy.id) throw new StatisticsError('policy_review_required');
            if (identity?.verified !== true || identity.active !== true || identity.subject !== subject || !identity.scopes?.includes('center:statistics:read')) throw new StatisticsError('unauthorized');
            const at = now(), request = validateRequest(input, at);
            const signature = JSON.stringify({ period: input.period, metrics: [...request.metrics].sort(), breakdown: request.breakdown, compare: input.compare || null });
            return await withCenterTransaction(pool, async client => {
                await client.query('SELECT pg_advisory_xact_lock(620061006)');
                const cached = await client.query('SELECT payload FROM center_mcp.published_statistics WHERE signature=$1 AND policy_id=$2', [signature, policy.id]);
                if (cached.rows.length === 1) return cached.rows[0].payload;
                const start = request.windows[0].start, end = request.windows.at(-1).end;
                const overlap = await client.query('SELECT EXISTS(SELECT 1 FROM center_mcp.published_statistics WHERE window_start < $2::timestamptz AND window_end > $1::timestamptz) AS overlap', [start,end]);
                if (overlap.rows[0]?.overlap !== false) throw new StatisticsError('release_review_required');
                const output = await createStatisticsBoundary({ authenticate: async () => identity, authorizedSubject: subject,
                    readSources, publicationPolicy: policy, authorizeRelease: async () => ({ allowed: true }), now: () => at })(input);
                if (output.status !== 'ok') return output;
                const published = { ...output, asOf: at.toISOString(), immutable: true };
                await client.query('INSERT INTO center_mcp.published_statistics(signature,policy_id,window_start,window_end,payload) VALUES($1,$2,$3::timestamptz,$4::timestamptz,$5::jsonb)', [signature,policy.id,start,end,JSON.stringify(published)]);
                return published;
            }, true);
        } catch (error) { return { status: 'unavailable', code: error instanceof StatisticsError ? error.code : 'source_incomplete' }; }
    };
}
