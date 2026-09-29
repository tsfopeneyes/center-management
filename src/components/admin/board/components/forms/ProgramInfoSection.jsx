import React from 'react';
import PropTypes from 'prop-types';
import { fromKstInput } from '../../../../../utils/programRecruitment';
import { useCurrentTime } from '../../../../../hooks/useCurrentTime';
import ProgramAudienceSettings from '../../../../../features/programs/settings/ProgramAudienceSettings';
import ProgramParticipationSettings from '../../../../../features/programs/settings/ProgramParticipationSettings';
import GuestIdentitySettings from '../../../../../features/programs/settings/GuestIdentitySettings';
import ApplicationQuestionSettings from '../../../../../features/programs/settings/ApplicationQuestionSettings';
import ProgramScheduleSettings from '../../../../../features/programs/settings/ProgramScheduleSettings';
import LocationRecruitmentSettings from '../../../../../features/programs/settings/LocationRecruitmentSettings';
import HostSettings from '../../../../../features/programs/settings/HostSettings';
import RewardFeedbackSettings from '../../../../../features/programs/settings/RewardFeedbackSettings';
import ChallengeSettings from '../../../../../features/programs/settings/ChallengeSettings';
import ApplicantExperienceSettings from '../../../../../features/programs/settings/ApplicantExperienceSettings';
import { ProgramSettingsGroup, ProgramSettingsNavigation } from '../../../../../features/programs/settings/ProgramSettingsLayout';

const ProgramInfoSection = ({ formData, updateField, flat = false }) => {
    const recruitmentNow = useCurrentTime();
    const isScheduledRegistration = formData.is_recruiting && new Date(fromKstInput(formData.recruitment_start_at)).getTime() > recruitmentNow;
    const hasOperationOptions = formData.enable_hosts === true || formData.is_challenge === true;
    const hasFollowupOptions = Number(formData.haifn_reward) > 0
        || formData.enable_feedback === true
        || formData.enable_post_program_button === true
        || formData.enable_group_assignment === true
        || formData.enable_random_questions === true;
    return (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[9.5rem_minmax(0,1fr)] xl:gap-8">
            <ProgramSettingsNavigation />
            <div className="min-w-0 space-y-10">
                <ProgramSettingsGroup id="program-audience" title="유형과 대상" description="프로그램 유형과 참여 대상을 선택합니다.">
                    <ProgramAudienceSettings formData={formData} updateField={updateField} flat={flat} />
                    <ProgramParticipationSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-schedule" title="일정과 모집" description="참여할 날짜와 장소, 모집 기간을 정합니다.">
                    <ProgramScheduleSettings formData={formData} updateField={updateField} isScheduledRegistration={isScheduledRegistration} />
                    <LocationRecruitmentSettings formData={formData} updateField={updateField} isScheduledRegistration={isScheduledRegistration} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-application" title="신청 양식" description="회원과 비회원에게 받을 정보를 한곳에서 정합니다.">
                    <GuestIdentitySettings formData={formData} updateField={updateField} />
                    <ApplicationQuestionSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-operation" title="운영 옵션" description="진행자와 챌린지 미션·커뮤니티를 설정합니다."
                    optional active={hasOperationOptions}>
                    <HostSettings formData={formData} updateField={updateField} />
                    <ChallengeSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-followup" title="종료 후 옵션" description="보상·설문·추가 참여 화면을 설정합니다."
                    optional active={hasFollowupOptions}>
                    <RewardFeedbackSettings formData={formData} updateField={updateField} />
                    <ApplicantExperienceSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
            </div>
        </div>
    );
};

ProgramInfoSection.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    flat: PropTypes.bool
};

export default React.memo(ProgramInfoSection);
