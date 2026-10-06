import React from 'react';
import PropTypes from 'prop-types';
import { fromKstInput } from '../../../../../utils/programRecruitment';
import { useCurrentTime } from '../../../../../hooks/useCurrentTime';
import ProgramAudienceSettings from '../../../../../features/programs/settings/ProgramAudienceSettings';
import ProgramVisibilitySettings from '../../../../../features/programs/settings/ProgramVisibilitySettings';
import ProgramParticipationSettings from '../../../../../features/programs/settings/ProgramParticipationSettings';
import GuestIdentitySettings from '../../../../../features/programs/settings/GuestIdentitySettings';
import ApplicationQuestionSettings from '../../../../../features/programs/settings/ApplicationQuestionSettings';
import ProgramScheduleSettings from '../../../../../features/programs/settings/ProgramScheduleSettings';
import LocationRecruitmentSettings from '../../../../../features/programs/settings/LocationRecruitmentSettings';
import HostSettings from '../../../../../features/programs/settings/HostSettings';
import RewardFeedbackSettings from '../../../../../features/programs/settings/RewardFeedbackSettings';
import ChallengeSettings from '../../../../../features/programs/settings/ChallengeSettings';
import ApplicantExperienceSettings from '../../../../../features/programs/settings/ApplicantExperienceSettings';
import { ProgramSettingsGroup } from '../../../../../features/programs/settings/ProgramSettingsLayout';

const ProgramInfoSection = ({ formData, updateField, flat = false, publishingSettings }) => {
    const recruitmentNow = useCurrentTime();
    const isScheduledRegistration = formData.is_recruiting && new Date(fromKstInput(formData.recruitment_start_at)).getTime() > recruitmentNow;
    const hasRewardOptions = Number(formData.haifn_reward) > 0 || formData.enable_feedback === true;
    const hasFollowupOptions = formData.enable_post_program_button === true;
    const hasPublishingOptions = formData.is_sticky === true || formData.is_poll === true
        || (formData.recruitment_push_plans || []).length > 0;
    return (
        <div className="min-w-0 space-y-10">
            <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-black text-slate-900">기본 설정</h2>
                <p className="mt-1 text-sm text-slate-500">참여에 필요한 항목을 위에서부터 설정합니다.</p>
            </div>
            <div className="space-y-10">
                <ProgramSettingsGroup id="program-audience" title="참여 대상과 공개 범위" description="프로그램 유형, 대상과 목록 공개 여부를 정합니다.">
                    <ProgramAudienceSettings formData={formData} updateField={updateField} flat={flat} />
                    <ProgramParticipationSettings formData={formData} updateField={updateField} section="mode" />
                    <ProgramVisibilitySettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-schedule" title="일정과 모집" description="참여 날짜와 장소, 모집 기간을 정합니다.">
                    <ProgramParticipationSettings formData={formData} updateField={updateField} section="schedule" />
                    <ProgramScheduleSettings formData={formData} updateField={updateField} isScheduledRegistration={isScheduledRegistration} />
                    <LocationRecruitmentSettings formData={formData} updateField={updateField} isScheduledRegistration={isScheduledRegistration} />
                </ProgramSettingsGroup>
                {formData.is_recruiting && (
                    <ProgramSettingsGroup id="program-application" title="신청 양식" description="회원과 비회원에게 받을 정보를 정합니다.">
                        <GuestIdentitySettings formData={formData} updateField={updateField} />
                        <ApplicationQuestionSettings formData={formData} updateField={updateField} />
                    </ProgramSettingsGroup>
                )}
                {formData.is_challenge && (
                    <ProgramSettingsGroup id="program-challenge" title="챌린지 미션" description="참여에 필요한 미션과 성공 기준을 설정합니다.">
                        <ChallengeSettings formData={formData} updateField={updateField} />
                    </ProgramSettingsGroup>
                )}
            </div>
            <div className="space-y-4 border-t border-slate-200 pt-8">
                <div>
                    <h2 className="text-lg font-black text-slate-900">고급 설정</h2>
                    <p className="mt-1 text-sm text-slate-500">필요한 기능만 펼쳐서 설정하세요. 사용 중인 기능은 자동으로 펼쳐집니다.</p>
                </div>
                <ProgramSettingsGroup id="program-hosts" title="호스트(진행자)" description="센터와 스처 프로그램의 진행자를 지정합니다."
                    optional active={formData.enable_hosts === true}>
                    <HostSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-reward" title="보상과 설문" description="참여 보상과 프로그램 설문을 설정합니다."
                    optional active={hasRewardOptions}>
                    <RewardFeedbackSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-followup" title="참가자 추가 화면" description="시작 전 또는 종료 후에 보일 안내, 팀과 질문을 설정합니다."
                    optional active={hasFollowupOptions}>
                    <ApplicantExperienceSettings formData={formData} updateField={updateField} />
                </ProgramSettingsGroup>
                <ProgramSettingsGroup id="program-publishing" title="알림과 게시 옵션" description="푸시 발송, 고정 게시와 투표를 설정합니다."
                    optional active={hasPublishingOptions}>
                    {publishingSettings}
                </ProgramSettingsGroup>
            </div>
        </div>
    );
};

ProgramInfoSection.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    flat: PropTypes.bool,
    publishingSettings: PropTypes.node.isRequired,
};

export default React.memo(ProgramInfoSection);
