import { useState, useCallback } from 'react';
import { CATEGORIES, PROGRAM_TYPES } from '../utils/constants';

const INITIAL_NOTICE_STATE = {
    title: '',
    short_description: '',
    content: '',
    is_recruiting: false,
    is_sticky: false,
    send_push: false,
    category: CATEGORIES.NOTICE,
    recruitment_deadline: '',
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
    hyphen_reward: 0
};

const useNoticeForm = (mode = CATEGORIES.NOTICE) => {
    const [formData, setFormData] = useState({
        ...INITIAL_NOTICE_STATE,
        category: mode,
        is_recruiting: mode === CATEGORIES.PROGRAM,
        max_capacity: mode === CATEGORIES.PROGRAM ? 0 : ''
    });

    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const resetForm = useCallback((targetMode = CATEGORIES.NOTICE) => {
        setFormData({
            ...INITIAL_NOTICE_STATE,
            category: targetMode,
            is_recruiting: targetMode === CATEGORIES.PROGRAM,
            max_capacity: targetMode === CATEGORIES.PROGRAM ? 0 : ''
        });
    }, []);

    const validateForm = useCallback(() => {
        if (!formData.title?.trim()) {
            return { isValid: false, message: '제목을 입력해주세요.' };
        }
        
        if (mode === CATEGORIES.PROGRAM) {
            if (!formData.program_date) {
                return { isValid: false, message: '프로그램 날짜를 선택해주세요.' };
            }
            if (!formData.program_duration?.trim()) {
                return { isValid: false, message: '소요 시간을 입력해주세요.' };
            }
            if (!formData.program_location?.trim()) {
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
