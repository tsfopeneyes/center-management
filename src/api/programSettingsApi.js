import { supabase } from '../supabaseClient';
import { normalizeMission } from './challengeMissionsApi';
import { validateDefinition } from '../utils/surveyModel';

const missingRpc = error => error?.code === 'PGRST202' || error?.code === '42883';

// Both paths invoke the same database transaction. A program, its survey
// publication, and its missions must either all save or all roll back.
export const programSettingsApi = {
    async save({ noticeId = null, notice, expectedFormRevision = null,
        survey = null, missions = null }) {
        if (notice?.category !== 'PROGRAM') throw new Error('프로그램 설정을 확인해 주세요.');
        if (noticeId != null && !Number.isInteger(expectedFormRevision)) {
            throw new Error('프로그램 설정을 다시 불러온 뒤 저장해 주세요.');
        }
        if (survey) {
            const issue = validateDefinition(survey.definition);
            if (issue) throw new Error(issue);
        }
        const cleanNotice = { ...notice };
        delete cleanNotice.send_push;
        const normalizedMissions = missions == null ? null
            : missions.map((mission, index) => normalizeMission(
                mission, index, cleanNotice.challenge_format || 'OFFLINE'
            ));
        const { data, error } = await supabase.rpc('save_program_settings_atomic', {
            p_notice_id: noticeId,
            p_notice: cleanNotice,
            p_expected_form_revision: expectedFormRevision,
            p_survey: survey,
            p_missions: normalizedMissions,
        });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        const { data: fallback, error: fallbackError } = await supabase
            .from('program_settings_save_requests')
            .insert({ notice_id: noticeId, notice: cleanNotice,
                expected_form_revision: expectedFormRevision,
                survey, missions: normalizedMissions })
            .select('saved_notice_id,application_form_revision,saved_survey')
            .single();
        if (fallbackError) throw fallbackError;
        return { id: fallback.saved_notice_id,
            application_form_revision: fallback.application_form_revision,
            survey: fallback.saved_survey };
    },
};
