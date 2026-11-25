import { supabase } from '../supabaseClient';
import { resolveSurveyCenterCode } from './surveyAssignments';

const table = 'visit_program_prompts';
const fields = 'center_code,title,description,url,show_at,enabled,program_id,show_to_applicants';
const activeApplicationStatuses = ['JOIN', 'WAITLIST'];

export function normalizeProgramPromptUrl(value) {
    const input = String(value || '').trim();
    if (input.length > 2000 || !/^https?:\/\/[^/]/i.test(input) || /[\s\\\u0000-\u001f\u007f]/u.test(input)) return null;
    try {
        const url = new URL(input);
        return url.username || url.password || url.href.length > 2000 ? null : url.href;
    } catch {
        return null;
    }
}

export function programIdFromPublicLink(url) {
    const normalized = normalizeProgramPromptUrl(url);
    if (!normalized) return null;
    const parsed = new URL(normalized);
    if (parsed.origin !== 'https://app.schoolchurchimpact.org' && parsed.origin !== globalThis.location?.origin) return null;
    return parsed.pathname.match(/^\/p\/(\d+)\/?$/)?.[1] ?? null;
}

export async function listVisitProgramPrompts() {
    const { data, error } = await supabase.from(table).select(fields);
    if (error) throw error;
    return data;
}

export async function saveVisitProgramPrompt(prompt) {
    const url = normalizeProgramPromptUrl(prompt.url);
    if (!url) throw new Error('http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요.');
    if (prompt.enabled && prompt.show_to_applicants === false) {
        if (!prompt.program_id) throw new Error('신청 여부를 확인할 프로그램을 선택해 주세요.');
        const linkedId = programIdFromPublicLink(url);
        if (linkedId && linkedId !== String(prompt.program_id)) {
            throw new Error('프로그램 링크와 신청 여부를 확인할 프로그램을 일치시켜 주세요.');
        }
    }
    const { error } = await supabase.from(table).upsert({
        ...prompt, url, title: prompt.title.trim(), description: prompt.description.trim()
    }, { onConflict: 'center_code' });
    if (error) throw error;
}

async function hasActiveApplication(programId, userId, signal) {
    const [program, sessions] = await Promise.all([
        supabase.from('notice_responses').select('notice_id')
            .eq('notice_id', programId).eq('user_id', userId)
            .in('status', activeApplicationStatuses).limit(1).abortSignal(signal),
        supabase.from('daily_program_session_responses').select('session_id,daily_program_sessions!inner(notice_id,session_date)')
            .eq('daily_program_sessions.notice_id', programId).gte('daily_program_sessions.session_date', seoulDay.format(new Date()))
            .eq('user_id', userId).in('status', activeApplicationStatuses).limit(1).abortSignal(signal)
    ]);
    if (program.error || sessions.error) throw program.error || sessions.error;
    return Boolean(program.data?.length || sessions.data?.length);
}

export async function loadVisitProgramPrompt({ event, locationName, userId, verifiedProfileId, signal }) {
    const centerCode = resolveSurveyCenterCode(locationName);
    if (!centerCode || !userId) return null;
    const { data, error } = await supabase.from(table).select(fields)
        .eq('center_code', centerCode).eq('enabled', true).in('show_at', [event, 'BOTH'])
        .abortSignal(signal).maybeSingle();
    if (error) throw error;
    const url = normalizeProgramPromptUrl(data?.url);
    if (!data || !url) return null;
    if (data.show_to_applicants === false) {
        if (!data.program_id || verifiedProfileId !== userId) return null;
        if (await hasActiveApplication(data.program_id, userId, signal)) return null;
    }
    return { ...data, url };
}

const memory = new Map();
const seoulDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function claimDailyVisitProgramPrompt(prompt, userId) {
    const day = seoulDay.format(new Date());
    const key = 'visit-program-prompt:' + day;
    const entry = JSON.stringify([userId, prompt.center_code]);
    if (memory.get(entry) === day) return false;
    try {
        const lastDayKey = localStorage.getItem('visit-program-prompt:latest-day');
        const entries = JSON.parse(localStorage.getItem(key) || '[]');
        if (entries.includes(entry)) return false;
        localStorage.setItem(key, JSON.stringify([...entries, entry]));
        if (lastDayKey && lastDayKey !== key) localStorage.removeItem(lastDayKey);
        localStorage.setItem('visit-program-prompt:latest-day', key);
    } catch {
        // Restricted browsers can still suppress repeats for the current page.
    }
    memory.set(entry, day);
    return true;
}
