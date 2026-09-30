// Deliberately limited to isolated tests. Do not add scripts that connect to
// production, modify live data, or require local credentials to this list.
const checks = [
    ['라우팅', 'test-home-entry.mjs'],
    ['계정 경로', 'test-account-auth-routing.mjs'],
    ['계정 권한', 'test-account-authorization.mjs'],
    ['동의', 'test-terms-consent.mjs'],
    ['프로그램 일정', 'test-recurring-program-model.mjs'],
    ['기존 신청 질문 호환성', 'test-legacy-application-fields.mjs'],
    ['공통 신청 질문 모델', 'test-application-form-model.mjs'],
    ['신청 당시 답변 표시', 'test-application-answer-display.mjs'],
    ['취소 신청 통계 제외', 'test-cancelled-program-analytics.mjs'],
    ['신청 질문 스냅샷 확장 초안', 'test-application-form-snapshots.mjs'],
    ['전체 프로그램 신청 전환 초안', 'test-program-application-transition.mjs'],
    ['구형 신청 경로 권한 회수 초안', 'test-program-application-final-cutover.mjs'],
    ['비회원 계정·신청 원자성', 'test-atomic-guest-program-registration.mjs'],
    ['구버전 비회원 부분 저장 차단', 'test-legacy-guest-registration-cutover.mjs'],
    ['공개 비회원 신청 클라이언트 경계', 'test-guest-registration-client-boundary.mjs'],
    ['비회원 신청 성공 화면 이동', 'test-program-guest-success-navigation.mjs'],
    ['신청 양식 버전·챌린지 화면 경계', 'test-program-checked-client-boundary.mjs'],
    ['비회원 신청 대상 선택', 'test-guest-registration-request.mjs'],
    ['비회원 생년월일 KST 경계', 'test-guest-birth-kst.mjs'],
    ['프로그램 설정 렌더링 참조', 'test-program-settings-jsx-bindings.mjs'],
    ['프로그램 설정 원자적 저장', 'test-atomic-program-settings-save.mjs'],
    ['프로그램 설정 저장 클라이언트', 'test-program-settings-save-client.mjs'],
    ['프로그램 공개 범위', 'test-program-privacy.mjs'],
    ['게스트 회차 신청', 'test-guest-daily-applications.mjs'],
    ['회원 회차 신청 안전 경계', 'test-member-session-write-boundary.mjs'],
    ['관리자 현장 추가 안전 경계', 'test-staff-program-walkins.mjs'],
    ['회차 출석', 'test-daily-session-attendance.mjs'],
    ['방문 포인트', 'test-visit-point-rules.mjs'],
    ['설문', 'test-unified-surveys.mjs'],
    ['커뮤니티', 'test-community-announcements.mjs'],
    ['알림 경로', 'test-notification-routing.mjs'],
    ['캘린더 규칙', 'test-calendar-rules.mjs'],
];

const scriptDirectory = new URL('./', import.meta.url);
const failures = [];

for (const [label, filename] of checks) {
    const start = Date.now();
    try {
        await import(new URL(filename, scriptDirectory));
        console.log(`PASS ${label} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    } catch (error) {
        failures.push(label);
        console.error(`FAIL ${label} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        console.error(error);
    }
}

console.log(`${checks.length - failures.length}/${checks.length} baseline checks passed`);
if (failures.length) process.exitCode = 1;
