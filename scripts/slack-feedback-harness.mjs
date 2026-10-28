import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { isStaffProfile } from '../supabase/functions/_shared/staffRoles.mjs';
import { resolveVisitLocationKeyword } from '../supabase/functions/_shared/visitScope.mjs';
import { slackWindow, slackVisitStatistics, slackProgramStatistics } from '../supabase/functions/_shared/operationStatistics/slack.mjs';

// Execute the actual handler locally; never start Slack, OpenAI, or Notion calls.
export async function loadSlackFeedback(read, source = fs.readFileSync(process.env.SLACK_FEEDBACK_SOURCE_PATH || 'supabase/functions/slack-tsf/index.ts', 'utf8')) {
    const code = (await transform(source.replace(/^import .*;\r?$/gm, '').replaceAll('export async function', 'async function'), { loader: 'ts' })).code;
    const context = vm.createContext({ console, Date, URL, URLSearchParams, TextEncoder, TextDecoder,
        setTimeout, clearTimeout, AbortController, crypto: globalThis.crypto,
        isStaffProfile, resolveVisitLocationKeyword, slackWindow, slackVisitStatistics, slackProgramStatistics,
        Deno: { env: { get: () => '' }, serve: () => {} },
        fetch: () => { throw new Error('Unexpected external request'); }, read });
    vm.runInContext(code + '\nsupabaseSelect = read; globalThis.metrics = getProgramMetrics; globalThis.originals = programFeedbackOriginalSection; globalThis.bindProgram = typeof bindProgramFeedback === "function" ? bindProgramFeedback : undefined;', context);
    return context;
}

export function fixtureReader(tables) {
    return async (table, params) => {
        if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
        let rows = tables[table];
        for (const [key, value] of params) {
            if (value.startsWith('in.(')) {
                const ids = value.slice(4, -1).split(',');
                rows = rows.filter(row => ids.includes(String(row[key])));
            }
            if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
        }
        const p = Object.fromEntries(params);
        return rows.slice(Number(p.offset || 0), Number(p.offset || 0) + Number(p.limit || rows.length));
    };
}
