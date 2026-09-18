import { supabase } from '../supabaseClient';
import { fetchAllPages } from '../utils/fetchAllPages';
import { validateAnswers, validateDefinition, legacyDefinition } from '../utils/surveyModel';
import { legacyFeedbackDisplay } from '../utils/programFeedbackModel';
import { requestSupabaseRest } from '../utils/supabaseRest';
import { countLegacySurveyResponses, legacySurveyResponsesForSurvey } from '../utils/legacySurveyAnalytics';

const checked = result => { if (result.error) throw result.error; return result.data; };
// PGRST200 means an embedded relationship is malformed, not that the survey
// schema is unavailable. Keep it visible instead of replacing the whole hub
// with the old-survey fallback.
export const missingSurveySchema = error => ['42P01', 'PGRST205'].includes(error?.code);
// survey_links references a version through the composite (version_id,form_id)
// key, so PostgREST requires the generated composite-constraint name here.
const linkSelect = '*,version:survey_versions!survey_links_version_id_form_id_fkey(*),form:survey_forms!survey_links_form_id_fkey(*)';
const publicSlugPattern = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;
async function receipt(userId, event, visitId, locationId) {
    if (visitId) return String(visitId);
    let query = supabase.from('logs').select('id').eq('user_id', userId).gte('created_at', new Date(Date.now() - 86400000).toISOString()).order('created_at', { ascending: false }).limit(1);
    if (event) query = query.eq('type', event);
    if (locationId) query = query.eq('location_id', locationId);
    return checked(await query)?.[0]?.id || null;
}
async function scopedEntries(path, userId, visitId, options = {}) {
    return requestSupabaseRest(path, { ...options, headers: { 'Content-Type': 'application/json', ...(visitId ? { 'x-survey-visit': String(visitId) } : {}), ...(options.headers || {}) } });
}
export const surveyHubApi = {
    async catalog() {
        return checked(await supabase.from('survey_forms').select('*,survey_versions(*)').order('created_at', { ascending: false }));
    },
    async links() { return checked(await supabase.from('survey_links').select(linkSelect).order('created_at')); },
    async legacyEntryCounts({ responses = [], visitNotes = [], users = [], notices = [] } = {}) {
        const surveys = checked(await supabase.from('surveys').select('id,survey_type,is_legacy'));
        return countLegacySurveyResponses({ surveys, responses, visitNotes, users, notices });
    },
    async create(definition, kind = 'SURVEY', publicSlug = null) {
        const error = validateDefinition(definition); if (error) throw new Error(error);
        const normalizedSlug = publicSlug?.trim().toLowerCase() || null;
        if (kind !== 'TEMPLATE' && !publicSlugPattern.test(normalizedSlug || '')) throw new Error('공유 주소는 영문 소문자, 숫자, 하이픈으로 3~60자 입력해 주세요.');
        if (normalizedSlug) {
            const duplicate = checked(await supabase.from('survey_links').select('id').eq('public_slug', normalizedSlug).maybeSingle());
            if (duplicate) throw new Error('이미 사용 중인 설문 주소입니다. 다른 주소를 입력해 주세요.');
        }
        const form = checked(await supabase.from('survey_forms').insert({ title: definition.title, kind }).select().single());
        const version = await this.publish(form.id, definition);
        if (kind !== 'TEMPLATE') await this.createPublicLink({ ...form, survey_versions: [version] }, normalizedSlug);
        return version;
    },
    async publish(formId, definition) {
        const error = validateDefinition(definition); if (error) throw new Error(error);
        // Immutable versions; publishing never changes a live link.
        return checked(await supabase.from('survey_versions').insert({ form_id: formId, definition }).select().single());
    },
    async updateLink(id, values) { return checked(await supabase.from('survey_links').update(values).eq('id', id).select().single()); },
    async connect(values) { return checked(await supabase.from('survey_links').insert(values).select().single()); },
    async publicLink(token) {
        const normalizedToken = token?.trim().toLowerCase();
        let result = await supabase.from('survey_links').select(linkSelect).eq('event', 'PUBLIC').eq('public_slug', normalizedToken).eq('enabled', true).maybeSingle();
        if (!result.error && !result.data && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token || '')) {
            result = await supabase.from('survey_links').select(linkSelect).eq('event', 'PUBLIC').eq('public_token', token).eq('enabled', true).maybeSingle();
        }
        if (missingSurveySchema(result.error) || result.error?.code === '42703') return undefined;
        return checked(result);
    },
    async createPublicLink(form, publicSlug = null) {
        if (form.kind === 'TEMPLATE') throw new Error('템플릿은 공유할 수 없습니다. 템플릿으로 새 설문을 만들어 주세요.');
        const normalizedSlug = publicSlug?.trim().toLowerCase() || null;
        const existing = checked(await supabase.from('survey_links').select(linkSelect).eq('form_id', form.id).eq('event', 'PUBLIC').order('created_at', { ascending: false }).limit(1).maybeSingle());
        const version = [...(form.survey_versions || [])].sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
        if (!version) throw new Error('공유할 질문이 없습니다.');
        if (existing) return this.updateLink(existing.id, { enabled: true, version_id: version.id, public_slug: normalizedSlug || existing.public_slug, frequency: 'ONCE', opens_at: null, closes_at: null });
        return this.connect({ form_id: form.id, version_id: version.id, event: 'PUBLIC', public_token: normalizedSlug ? null : crypto.randomUUID(), public_slug: normalizedSlug, frequency: 'ONCE', priority: 100, is_default: false });
    },
    async replacePublicLink(form, previousLink, publicSlug, version) {
        const normalizedSlug = publicSlug?.trim().toLowerCase();
        if (!publicSlugPattern.test(normalizedSlug || '')) throw new Error('공유 주소는 영문 소문자, 숫자, 하이픈으로 3~60자 입력해 주세요.');
        const duplicate = checked(await supabase.from('survey_links').select('id').eq('public_slug', normalizedSlug).neq('id', previousLink.id).maybeSingle());
        if (duplicate) throw new Error('이미 사용 중인 설문 주소입니다. 다른 주소를 입력해 주세요.');

        await this.updateLink(previousLink.id, { enabled: false });
        try {
            return await this.connect({
                form_id: form.id,
                version_id: version.id,
                event: 'PUBLIC',
                public_token: null,
                public_slug: normalizedSlug,
                frequency: 'ONCE',
                priority: previousLink.priority ?? 100,
                is_default: false,
            });
        } catch (error) {
            // Keep the previous address usable if creating its replacement fails.
            await this.updateLink(previousLink.id, { enabled: true }).catch(() => undefined);
            throw error;
        }
    },
    async saveProgramSurvey(noticeId, formId, templateId, definition) {
        const validation = validateDefinition(definition); if (validation) throw new Error(validation);
        const rpc = await supabase.rpc('save_program_survey', { p_notice_id: noticeId, p_form_id: formId || null, p_template_id: templateId || null, p_definition: definition });
        if (!rpc.error) return rpc.data;
        if (!['PGRST202', '42883'].includes(rpc.error.code)) throw rpc.error;

        // Direct-table fallback for deployments where the RPC has not reached
        // the API schema cache yet.
        let targetFormId = formId;
        if (!targetFormId) {
            const existing = checked(await supabase.from('survey_forms').select('id').eq('kind', 'PROGRAM').eq('owner_notice_id', noticeId).maybeSingle());
            targetFormId = existing?.id;
        }
        if (!targetFormId) {
            const created = checked(await supabase.from('survey_forms').insert({ title: definition.title, kind: 'PROGRAM', owner_notice_id: noticeId, source_template_id: templateId || null }).select().single());
            targetFormId = created.id;
        } else {
            checked(await supabase.from('survey_forms').update({ title: definition.title, source_template_id: templateId || null }).eq('id', targetFormId));
        }
        const version = await this.publish(targetFormId, definition);
        checked(await supabase.from('survey_links').update({ enabled: false }).eq('notice_id', noticeId).eq('event', 'PROGRAM').eq('enabled', true));
        const existingLink = checked(await supabase.from('survey_links').select('id').eq('notice_id', noticeId).eq('event', 'PROGRAM').eq('form_id', targetFormId).order('created_at', { ascending: false }).limit(1).maybeSingle());
        const link = existingLink
            ? checked(await supabase.from('survey_links').update({ version_id: version.id, enabled: true, frequency: 'ONCE', audience: 'ATTENDED', timing: 'AFTER_END', opens_at: null, closes_at: null }).eq('id', existingLink.id).select().single())
            : await this.connect({ form_id: targetFormId, version_id: version.id, event: 'PROGRAM', center_code: null, notice_id: noticeId, frequency: 'ONCE', audience: 'ATTENDED', timing: 'AFTER_END' });
        return { form_id: targetFormId, version_id: version.id, link_id: link.id };
    },
    async deleteForm(id) {
        const rpc = await supabase.rpc('delete_survey_form', { p_form_id: id });
        if (!rpc.error) return;
        if (!['PGRST202', '42883'].includes(rpc.error.code)) throw rpc.error;

        // Direct-table fallback for deployments where the RPC is not in the API cache yet.
        // Delete children first because these references intentionally do not cascade.
        const oldest = checked(await supabase.from('survey_versions').select('definition').eq('form_id', id).order('created_at').limit(1));
        if (oldest?.[0]?.definition?.legacySource?.table === 'surveys') {
            throw new Error('이전 설문 기록을 함께 삭제하려면 데이터베이스 변경이 먼저 필요합니다.');
        }
        for (const table of ['survey_entries', 'survey_links', 'survey_versions']) {
            checked(await supabase.from(table).delete().eq('form_id', id));
        }
        const removed = checked(await supabase.from('survey_forms').delete().eq('id', id).select('id'));
        if (removed?.length !== 1) throw new Error('설문 삭제를 완료하지 못했습니다. 새로고침 후 다시 확인해 주세요.');
    },
    async entries(formId, legacyContext = null) {
        const entries = await fetchAllPages(() => { let query = supabase.from('survey_entries').select('*,users(name,school)').order('created_at', { ascending: false }).order('id'); return formId ? query.eq('form_id', formId) : query; });
        if (!formId) return entries;
        const formMeta = checked(await supabase.from('survey_forms').select('kind').eq('id', formId).single());
        const versions = checked(await supabase.from('survey_versions').select('definition').eq('form_id',formId).order('created_at',{ascending:true}).limit(1));
        const source = versions?.[0]?.definition?.legacySource;
        let historical = [];
        if (source?.table === 'surveys') {
            const survey = checked(await supabase.from('surveys').select('*').eq('id',source.id).single());
            if (legacyContext) {
                const selected = legacySurveyResponsesForSurvey({ survey, ...legacyContext });
                const userMap = new Map((legacyContext.users || []).map(user => [user.id, user]));
                historical = selected.map(row => ({ ...row, users: userMap.get(row.user_id) || null }));
            } else {
                historical = await fetchAllPages(() => {
                    let query = supabase.from('checkin_surveys').select('*,users(name,school)').order('created_at',{ascending:false}).order('id');
                    return survey.is_legacy ? query.or(`survey_id.eq.${survey.id},and(survey_id.is.null,survey_type.eq.${survey.survey_type})`) : query.eq('survey_id',survey.id);
                });
            }
            historical = historical.map(row => {
                const config = row.survey_snapshot || survey.config;
                const snapshot = legacyDefinition(config,survey.title);
                const main = snapshot.questions[0];
                const selections = (row.selections || []).map(value => (config?.options || []).find(option=>String(option.id)===String(value))?.label || value);
                return {...row,id:`legacy-visit-${row.id}`,legacy:true,link_id:'LEGACY',snapshot,answers:{[main.id]:main.type==='text'?row.text_answer:selections,...(snapshot.questions[1]?{[snapshot.questions[1].id]:row.text_answer}:{})}};
            });
        } else if (source?.table === 'program_feedback') {
            const notice = checked(await supabase.from('notices').select('id,title,guest_properties').eq('id',source.id).single());
            const rows = await fetchAllPages(()=>supabase.from('program_feedback').select('*,users(name,school)').eq('notice_id',source.id).order('created_at',{ascending:false}).order('id'));
            historical = rows.map(row=>({...legacyFeedbackDisplay(row,notice),id:`legacy-program-${row.id}`,legacy:true,link_id:'LEGACY'}));
        }
        const combined = [...entries, ...historical];
        if (formMeta.kind === 'TEMPLATE') {
            const programForms = checked(await supabase.from('survey_forms').select('id').eq('kind', 'PROGRAM').eq('source_template_id', formId));
            const programEntries = await Promise.all(programForms.map(programForm => this.entries(programForm.id, legacyContext)));
            combined.push(...programEntries.flat());
        }
        return combined.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    },
    async resolve({ centerCode, surveyType, noticeId, userId }) {
        let query = supabase.from('survey_links').select(linkSelect);
        query = noticeId ? query.eq('notice_id', noticeId) : query.eq('center_code', centerCode).eq('event', surveyType);
        const result = await query.order('is_default').order('priority').order('created_at');
        if (missingSurveySchema(result.error)) return undefined;
        const links = checked(result) || [];
        // The unified survey schema is available, so an empty link set means
        // this center/event is intentionally unassigned. Only return undefined
        // when the schema itself is unavailable; otherwise the caller could
        // revive an old SYSTEM survey after an admin disconnects it.
        if (!links.length) return null;
        for (const link of links) {
            const now = Date.now();
            if (!link.enabled || link.form?.archived || (link.opens_at && Date.parse(link.opens_at) > now) || (link.closes_at && Date.parse(link.closes_at) < now)) continue;
            if (!noticeId && link.frequency === 'ONCE' && userId) {
                const visitId = await receipt(userId);
                const prior = await scopedEntries(`survey_completions?select=link_id&link_id=eq.${link.id}&user_id=eq.${userId}&limit=1`, userId, visitId);
                if (prior.length) continue;
            }
            return link;
        }
        return null;
    },
    async submit(link, userId, answers, { locationId = null, visitId = null } = {}) {
        const validation = validateAnswers(link.version.definition, answers); if (validation) throw new Error(validation);
        if (!userId) throw new Error('응답자를 확인할 수 없습니다. 다시 로그인해 주세요.');
        if (!['PROGRAM','PUBLIC'].includes(link.event)) visitId = await receipt(userId, link.event, visitId, locationId);
        const payload = { link_id: link.id, version_id: link.version.id, user_id: userId, answers, location_id: locationId, visit_id: visitId == null ? null : String(visitId) };
        if (link.event === 'PROGRAM') {
            const previous = checked(await supabase.from('survey_entries').select('id').eq('link_id', link.id).eq('user_id', userId).eq('response_key','ONCE').maybeSingle());
            if (previous) return checked(await supabase.from('survey_entries').update({ answers }).eq('id', previous.id).select().single());
        }
        if (link.event !== 'PROGRAM') {
            if (link.frequency === 'ONCE') {
                const completed = await scopedEntries(`survey_completions?select=link_id&link_id=eq.${link.id}&user_id=eq.${userId}&limit=1`, userId, visitId);
                if (completed?.length) return { snapshot: link.version.definition, answers: {}, alreadySubmitted: true };
            }
            const key = link.frequency === 'ONCE' ? 'ONCE' : String(visitId);
            const path = `survey_completions?select=link_id&link_id=eq.${link.id}&user_id=eq.${userId}&response_key=eq.${encodeURIComponent(key)}`;
            const prior = await scopedEntries(path, userId, visitId);
            if (prior?.length) return { snapshot: link.version.definition, answers: {}, alreadySubmitted: true };
            const saved = { snapshot: link.version.definition, answers };
            try { await scopedEntries('survey_entries', userId, visitId, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) }); return saved; }
            catch (error) { const reconciled = await scopedEntries(path, userId, visitId); if (reconciled?.length) return saved; throw error; }
        }
        return checked(await supabase.from('survey_entries').insert(payload).select().single());
    }
};
