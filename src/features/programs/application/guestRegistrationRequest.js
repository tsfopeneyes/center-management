import { normalizeSchoolName } from '../../../utils/userUtils.js';
import { usesDailySessionRsvp } from '../../../utils/dailyProgramSessions.js';

export function buildGuestRegistrationRequest(
    program, selectedSessionId, form, displayedRevision = program?.application_form_revision
) {
    const isSession = usesDailySessionRsvp(program);
    const session = isSession
        ? (selectedSessionId
            ? program.open_sessions?.find(item => item.id === selectedSessionId)
            : program.today_session)
        : null;
    if (isSession && !session?.id) {
        throw new Error('신청할 회차를 다시 선택해 주세요.');
    }
    const noticeId = Number(program?.id);
    if (!Number.isSafeInteger(noticeId) || noticeId <= 0) {
        throw new Error('프로그램 정보를 다시 확인해 주세요.');
    }
    return {
        noticeId: session ? null : noticeId,
        sessionId: session?.id || null,
        expectedRevision: displayedRevision,
        profile: {
            name: form.name.trim(),
            school: normalizeSchoolName(form.school),
            phone: form.phone,
            birth_date: form.birth,
            privacy_consent: form.privacyConsent,
            guardian_name: form.guardianName.trim(),
            guardian_phone: form.guardianPhone.trim(),
            guardian_relation: form.guardianRelation.trim(),
            guardian_consent: form.guardianConsent,
        },
        answers: form.customAnswers || {},
    };
}
