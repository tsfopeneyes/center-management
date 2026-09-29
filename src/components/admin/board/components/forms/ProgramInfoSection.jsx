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
    return (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[9.5rem_minmax(0,1fr)] xl:gap-8">
            <ProgramSettingsNavigation />
            <div className="min-w-0 space-y-10">
                <ProgramSettingsGroup id="program-audience" title="프로그램 구분" description="대상과 운영 방식을 정합니다.">
                    <ProgramAudienceSettings formData={formData} updateField={updateField} flat={flat} />
                    <ProgramParticipationSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-schedule" title="일정과 모집" description="참여할 날짜와 장소, 모집 기간을 정합니다.">
                    <ProgramScheduleSettings formData={formData} updateField={updateField} isScheduledRegistration={isScheduledRegistration} />
                    <LocationRecruitmentSettings formData={formData} updateField={updateField} isScheduledRegistration={isScheduledRegistration} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-application" title="신청 정보" description="신청할 때 받을 정보를 정합니다.">
                    <GuestIdentitySettings formData={formData} updateField={updateField} />
                    <ApplicationQuestionSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-operation" title="진행 설정" description="진행자와 챌린지 운영 내용을 정합니다.">
                    <HostSettings formData={formData} updateField={updateField} />
                    <ChallengeSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-followup" title="종료 후" description="참여 완료 후 제공할 보상과 안내를 정합니다.">
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
