import { useState, useCallback } from 'react';
import { CATEGORIES, PROGRAM_TYPES } from '../utils/constants';
import { fromKstInput, validateRecruitmentForm } from '../../../../utils/programRecruitment';

const INITIAL_NOTICE_STATE = {
    title: '',
    short_description: '',
    content: '',
    is_recruiting: false,
    is_sticky: false,
    send_push: false,
    recruitment_push_enabled: false,
    recruitment_push_audience: 'TARGET_REGIONS',
    recruitment_push_timing: 'OFF',
    recruitment_push_scheduled_at: '',
    recruitment_push_plans: [],
    _had_now_push_plan: false,
    _saved_recruitment_push_resend_nonce: '',
    category: CATEGORIES.NOTICE,
    is_private: false,
    is_challenge: false,
    challenge_has_time: false,
    challenge_format: 'OFFLINE',
    challenge_missions: [],
    challenge_success_message: '',
    challenge_show_haifn_btn: false,
    community_enabled: false,
    community_channel_id: '',
    recruitment_deadline: '',
    recruitment_start_at: '',
    max_capacity: '',
    program_date: '',
    program_time: '12:00',
    program_duration: '',
    program_location: '',
    program_type: PROGRAM_TYPES.CENTER,
    is_leader_only: false,
    target_regions: [],
    is_poll: false,
    allow_multiple_votes: false,
    poll_deadline: '',
    poll_options: [],
    haifn_reward: 0,
    program_start_date: '',
    program_end_date: '',
    program_days: [],
    schedule_mode: 'SINGLE',
    application_scope: 'PROGRAM',
    host_id: '',
    host_ids: [],
    hosts: [],
    enable_hosts: false,
    host_one_liner: '',
    guest_properties: { allow_guest: false, require_school: true, require_phone: true },
    open_participation_mode: 'NONE',
    daily_session_fields: [{ id: 'field-1', label: '오늘의 안내', required: true }],
    enable_post_program_button: false,
    post_program_button_trigger: 'start_time',
    post_program_button_offset_minutes: 0,
    post_program_button_name: '',
    post_program_button_content: '',
    post_program_button_link: '',
    enable_group_assignment: false,
    group_count: 4,
    group_assignments: {},
    enable_random_questions: false,
    random_questions: [
        '오늘 가장 기분 좋았던 일은 무엇인가요?',
        '가장 좋아하는 음식과 그 이유는?',
        '오늘 함께하는 조원들에게 바라는 점은?'
    ],
    enable_feedback: false,
    is_review_required: false,
    custom_feedback_config: { questions: [] },
    _program_survey_definition: null,
    _program_survey_original_definition: null,
    _program_survey_form_id: null,
    _program_survey_template_id: null,
    _program_survey_original_template_id: null
};

const useNoticeForm = (mode = CATEGORIES.NOTICE) => {
    const [formData, setFormData] = useState({
        ...INITIAL_NOTICE_STATE,
        category: mode,
        is_recruiting: mode === CATEGORIES.PROGRAM,
        max_capacity: mode === CATEGORIES.PROGRAM ? 0 : '',
        haifn_reward: 0
    });

    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const resetForm = useCallback((targetMode = CATEGORIES.NOTICE) => {
        setFormData({
            ...INITIAL_NOTICE_STATE,
            category: targetMode,
            is_recruiting: targetMode === CATEGORIES.PROGRAM,
            max_capacity: targetMode === CATEGORIES.PROGRAM ? 0 : '',
            haifn_reward: 0
        });
    }, []);

    const validateForm = useCallback(() => {
        if (!formData.title?.trim()) {
            return { isValid: false, message: '제목을 입력해주세요.' };
        }
        
        if (mode === CATEGORIES.PROGRAM) {
            const recruitmentError = validateRecruitmentForm(formData);
            if (recruitmentError) return { isValid: false, message: recruitmentError };
            if (formData.enable_feedback && !formData._program_survey_definition && !formData.guest_properties?.survey_version_id) {
                return { isValid: false, message: '프로그램 설문을 만들거나 템플릿을 불러와주세요.' };
            }
            const customPushPlans = (formData.recruitment_push_plans || []).filter(plan => plan.timing === 'CUSTOM');
            for (const plan of customPushPlans) {
                if (!plan.scheduled_at) {
                    return { isValid: false, message: '푸시 발송 시간을 선택해주세요.' };
                }
                const pushAt = new Date(fromKstInput(plan.scheduled_at)).getTime();
                if (pushAt <= Date.now()) return { isValid: false, message: '푸시 발송 시간은 현재 이후로 선택해주세요.' };
            }
            const scheduled = formData.is_recruiting && new Date(fromKstInput(formData.recruitment_start_at)).getTime() > Date.now();
            if (formData.is_challenge) {
                // 챌린지 프로그램은 모집 여부와 관계없이 시작일/종료일을 사용합니다.
                const startDate = formData.program_start_date || formData.program_date;
                const endDate = formData.program_end_date;

                if (!startDate) {
                    return { isValid: false, message: '챌린지 시작일을 선택해주세요.' };
                }
                if (!endDate) {
                    return { isValid: false, message: '챌린지 종료일을 선택해주세요.' };
                }
                if (formData.challenge_has_time) {
                    if (!formData.program_date) {
                        return { isValid: false, message: '챌린지 시작 시간을 선택해주세요.' };
                    }
                    if (!scheduled && !formData.program_duration?.trim()) {
                        return { isValid: false, message: '챌린지 소요 시간을 입력해주세요.' };
                    }
                }
            } else if (formData.schedule_mode !== 'RECURRING') {
                // 한 번 진행하는 신청/오픈 프로그램
                if (!formData.program_date) {
                    return { isValid: false, message: '프로그램 날짜를 선택해주세요.' };
                }
            } else {
                const startDate = formData.program_start_date || formData.program_date;
                const endDate = formData.program_end_date;
                const days = formData.program_days || [];

                if (!startDate) {
                    return { isValid: false, message: '진행 시작일을 선택해주세요.' };
                }
                if (!endDate) {
                    return { isValid: false, message: '진행 종료일을 선택해주세요.' };
                }
                if (!days || days.length === 0) {
                    return { isValid: false, message: '진행 요일을 최소 1개 이상 선택해주세요.' };
                }
            }

            if (!scheduled && !formData.is_challenge && !formData.program_duration?.trim()) {
                return { isValid: false, message: '소요 시간을 입력해주세요.' };
            }
            if (!scheduled && !(formData.is_challenge && formData.challenge_format === 'ONLINE') && !formData.program_location?.trim()) {
                return { isValid: false, message: '장소를 입력해주세요.' };
            }
        }

        if (formData.is_poll && (!formData.poll_options || formData.poll_options.length === 0)) {
            return { isValid: false, message: '투표 항목을 최소 1개 이상 추가해주세요.' };
        }

        return { isValid: true, message: '' };
    }, [formData, mode]);

    return {
        formData,
        setFormData,
        updateField,
        resetForm,
        validateForm
    };
};

export default useNoticeForm;
