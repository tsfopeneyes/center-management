import { v4 as uuidv4 } from 'uuid';
import { prepareNoticeForEdit } from './noticeHelpers';

// Copy configuration, while giving the new program independent operational data.
export const prepareProgramDuplicate = (notice, survey = null) => {
    const source = JSON.parse(JSON.stringify(notice));
    const formData = prepareNoticeForEdit(source);
    for (const key of Object.keys(formData.guest_properties)) {
        if (key === 'is_ended' || key === 'group_assignments' || key === 'team_shuffle_seed' || key === 'program_button_team_seeds'
            || key.startsWith('community_') || key.startsWith('survey_')
            || /push.*(sent|nonce|delivered)/.test(key)) {
            delete formData.guest_properties[key];
        }
    }
    formData.community_channel_id = '';
    formData._initial_community_channel_id = '';
    formData._saved_recruitment_push_resend_nonce = '';
    formData._had_now_push_plan = false;
    formData.challenge_missions = formData.challenge_missions.map(mission => ({
        ...mission, id: uuidv4(),
    }));
    if (survey?.definition) {
        formData._program_survey_definition = JSON.parse(JSON.stringify(survey.definition));
        formData._program_survey_form_id = null;
        formData._program_survey_template_id = survey.survey_forms?.source_template_id || null;
    }
    return {
        formData,
        images: source.images?.length ? source.images : (source.image_url ? [source.image_url] : []),
    };
};
