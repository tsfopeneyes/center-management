import { AnalysisError } from '../centerAnalysis/contracts.mjs';

const slackId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

// Slack HTTP signature verification and event parsing deliberately stay at the
// edge of the Slack worker. This adapter accepts only that verified event,
// resolves it to a private external identity, then calls the same analysis
// service used by MCP and the website. It never turns a chat message into a
// query language or accepts a public/group-channel request.
export function createSlackAnalysisAdapter({ verifySlackRequest, resolveSlackActor, analysisService } = {}) {
    if (typeof verifySlackRequest !== 'function' || typeof resolveSlackActor !== 'function'
        || !analysisService || typeof analysisService.run !== 'function') {
        throw new AnalysisError('not_configured');
    }
    return Object.freeze({
        async run(request) {
            const event = await verifySlackRequest(request);
            if (!event || event.verified !== true || event.is_direct_message !== true
                || !slackId(event.team_id) || !slackId(event.user_id)) {
                throw new AnalysisError('forbidden');
            }
            const actor = await resolveSlackActor({ teamId: event.team_id, userId: event.user_id });
            if (!actor || actor.active !== true || actor.channel !== 'slack') throw new AnalysisError('forbidden');
            // operation and input are still parsed by the common core. No Slack
            // text, channel id, or identity value becomes a database predicate.
            return analysisService.run({ operation: event.operation, input: event.input, actor });
        },
    });
}
