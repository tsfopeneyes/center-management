import { DEFINITION_VERSION, DOMAIN_NAMES, OPERATION_NAMES } from './contracts.mjs';

// Metric definitions are a product contract.  Calculators use these IDs, but
// never derive them from database column names or a caller-provided expression.
const definition = (metric_id, label, unit, calculation, inclusions, exclusions, denominator, limitations, domain) => Object.freeze({
    metric_id,
    label,
    unit,
    calculation,
    inclusions: Object.freeze(inclusions),
    exclusions: Object.freeze(exclusions),
    denominator,
    limitations: Object.freeze(limitations),
    version: DEFINITION_VERSION,
    domain,
});

export const METRIC_DEFINITIONS = Object.freeze({
    visit_sessions: definition('visit_sessions', '방문 세션', 'sessions', 'KST 날짜 안에서 CHECKIN으로 시작하고 유효 공간을 이용한 세션 수',
        ['유효 CHECKIN', '유효 공간 이용'], ['직원', '유효하지 않은 공간', '중복 CHECKIN'], null, ['자정을 넘는 세션은 시작 날짜 기준으로 계산'], 'visits'),
    unique_visitors: definition('unique_visitors', '순방문자', 'people', '기간 내 유효 방문 세션을 가진 고유 이용자 수',
        ['유효 방문 세션'], ['직원'], null, ['일별 순방문자를 더하지 않음'], 'visits'),
    visitor_days: definition('visitor_days', '방문일', 'days', '이용자와 KST 방문 날짜의 고유 조합 수',
        ['유효 방문 세션'], ['직원'], null, ['같은 날 재입실은 1일'], 'visits'),
    recorded_minutes: definition('recorded_minutes', '기록 체류 시간', 'minutes', 'MOVE 또는 실제 CHECKOUT으로 끝난 양수 공간 구간의 합',
        ['유효 공간의 양수 구간'], ['열린 마지막 구간', '추정 시간'], null, ['CHECKOUT 누락 세션의 마지막 구간은 포함하지 않음'], 'duration'),
    complete_duration_mean: definition('complete_duration_mean', '평균 실측 체류 시간', 'minutes', '실제 CHECKOUT과 양수 실측 시간이 있는 세션의 평균 분',
        ['완료된 양수 실측 세션'], ['CHECKOUT 누락', '0분 세션'], '완료된 양수 실측 세션 수', ['방문일 변화와 분모가 다를 수 있음'], 'duration'),
    complete_duration_median: definition('complete_duration_median', '중앙 실측 체류 시간', 'minutes', '완료된 양수 실측 세션별 분의 중앙값',
        ['완료된 양수 실측 세션'], ['CHECKOUT 누락', '0분 세션'], '완료된 양수 실측 세션 수', ['방문일 변화와 분모가 다를 수 있음'], 'duration'),
    missing_checkout_sessions: definition('missing_checkout_sessions', '퇴실 누락 세션', 'sessions', '유효 방문 중 실제 CHECKOUT이 기록되지 않은 세션 수',
        ['유효 방문 세션'], [], null, ['누락 시간은 체류 시간에 추정 합산하지 않음'], 'duration'),
    applications: definition('applications', '프로그램 신청 기록', 'count', '현재 신청 상태가 JOIN, WAITLIST 또는 CANCELLED인 기록 수',
        ['JOIN', 'WAITLIST', 'CANCELLED'], ['직원', '취소·무효 회차'], null, ['현재 상태 기준이며 과거 신청 이벤트 누적 수가 아님'], 'programs'),
    joined_applications: definition('joined_applications', '참가 신청', 'count', '현재 상태가 JOIN인 프로그램 신청 기록 수',
        ['JOIN'], ['직원', '취소·무효 회차'], null, ['현재 상태 기준'], 'programs'),
    waitlisted_applications: definition('waitlisted_applications', '대기 신청', 'count', '현재 상태가 WAITLIST인 프로그램 신청 기록 수',
        ['WAITLIST'], ['직원', '취소·무효 회차'], null, ['현재 상태 기준'], 'programs'),
    cancelled_applications: definition('cancelled_applications', '취소 신청', 'count', '현재 상태가 CANCELLED인 프로그램 신청 기록 수',
        ['CANCELLED'], ['직원', '취소·무효 회차'], null, ['현재 상태 기준'], 'programs'),
    recorded_attendance: definition('recorded_attendance', '기록상 출석', 'count', 'JOIN과 is_attended=true, 또는 개방형 프로그램의 날짜별 출석 기록 수',
        ['JOIN + is_attended', '개방형 날짜별 출석'], ['직원', '취소·무효 회차'], null, ['사전신청자 출석률이나 당시 확정 상태를 뜻하지 않음'], 'programs'),
    satisfaction_mean: definition('satisfaction_mean', '평균 만족도', 'rating', '검증된 만족도 숫자 질문의 1~5점 응답 평균',
        ['1~5 유효 숫자 응답'], ['자유서술', '합성 기본값', '집계 제외 응답'], '유효 만족도 응답 수', ['응답자는 참석자 전체를 대표한다고 단정할 수 없음'], 'feedback'),
    satisfaction_response_count: definition('satisfaction_response_count', '만족도 응답 수', 'count', '검증된 1~5점 만족도 응답 수',
        ['1~5 유효 숫자 응답'], ['자유서술', '집계 제외 응답'], null, ['응답자 수가 작으면 세부 분석이 숨겨질 수 있음'], 'feedback'),
    participation_1: definition('participation_1', '프로그램 1개 참여자', 'people', '기간 내 기록상 출석한 서로 다른 프로그램 수가 1개인 사람 수',
        ['기록상 출석'], ['직원'], null, ['같은 프로그램 여러 회차는 1개 프로그램으로 계산'], 'programs'),
    participation_2: definition('participation_2', '프로그램 2개 참여자', 'people', '기간 내 기록상 출석한 서로 다른 프로그램 수가 2개인 사람 수',
        ['기록상 출석'], ['직원'], null, ['같은 프로그램 여러 회차는 1개 프로그램으로 계산'], 'programs'),
    participation_3_plus: definition('participation_3_plus', '프로그램 3개 이상 참여자', 'people', '기간 내 기록상 출석한 서로 다른 프로그램 수가 3개 이상인 사람 수',
        ['기록상 출석'], ['직원'], null, ['같은 프로그램 여러 회차는 1개 프로그램으로 계산'], 'programs'),
    revisit_rate: definition('revisit_rate', '재방문율', 'ratio', 'cohort index 다음 날부터 지정 추적일 안에 다른 날짜에 유효 방문한 비율',
        ['관찰 완료 cohort', '다른 KST 날짜의 유효 방문'], ['직원', '관찰 미완료 cohort', '안정된 연결키 없는 사람'], '관찰 완료 cohort 수', ['기간 내 첫 관측을 index로 사용하며 생애 최초 방문을 뜻하지 않음'], 'visits'),
    before_after_visit_days: definition('before_after_visit_days', '전후 방문일 변화', 'days', '대상 프로그램 첫 기록상 참석일 전후 동일 기간의 사람별 방문일 평균 변화',
        ['양쪽 관찰 가능 사람'], ['관찰 범위가 부족한 사람'], '해당 measure의 paired 사람 수', ['설명적 비교이며 인과효과를 뜻하지 않음'], 'visits'),
    recorded_revisited_people: definition('recorded_revisited_people', '기록에서 확인된 재방문자', 'people', '추적 기간이 끝난 대상자 중 다른 날짜의 방문 기록이 확인된 사람 수', ['유효 방문 기록'], ['추적 기간 미완료'], null, ['수집 완전성이 미검증이면 미방문을 확정하지 못하는 최소 확인치'], 'visits'),
    recorded_revisit_rate: definition('recorded_revisit_rate', '기록 기준 재방문 비율', 'ratio', '기록에서 확인된 재방문자 / 추적 기간이 끝난 대상자', ['저장된 유효 방문'], ['추적 기간 미완료'], 'matured_cohort', ['수집 완전성이 미검증이면 확정 재방문율이 아닌 기록 기준 비율', '교사 연락 여부나 자발성을 뜻하지 않음'], 'visits'),
    recorded_non_program_revisited_people: definition('recorded_non_program_revisited_people', '프로그램 출석 기록 없는 날의 재방문자', 'people', '재방문일 중 어떤 프로그램의 출석 기록도 없는 날이 있는 사람 수', ['대상 프로그램 외 모든 프로그램 출석도 대조'], ['추적 기간 미완료'], null, ['프로그램 출석 누락 가능', '교사 연락 없는 자발적 방문의 증거로 단정 금지'], 'visits'),
    initiative_respondents: definition('initiative_respondents', '재방문 동기 확인 응답자', 'people', '재방문일의 방문 목적과 교사 연락 여부를 선택형으로 모두 답한 사람 수', ['방문 영수증과 연결된 선택형 응답'], ['미응답', '모르겠음', '동일 날짜 상충 응답'], null, ['응답자가 적으면 숨김', '자기보고'], 'visits'),
    self_reported_unprompted_revisited_people: definition('self_reported_unprompted_revisited_people', '자기보고 기준 연락 없는 자유 재방문자', 'people', '재방문일에 자유 이용 및 교사 연락 없음으로 응답한 추적 완료 대상자 수', ['두 선택형 문항 모두 일치'], ['미응답', '모르겠음', '상충 응답', '추적 미완료'], null, ['자기보고이며 실제 연락 이력이나 프로그램의 인과효과를 증명하지 않음', '과거 동기를 소급 추정하지 않음'], 'visits'),
    recorded_before_after_visit_days: definition('recorded_before_after_visit_days', '기록 기준 전후 방문일 변화', 'days', '추적 기간이 끝난 참여자의 저장된 방문일 전후 변화',
        ['추적 기간 완료', '저장된 방문 기록'], ['추적 기간 미완료'], 'recorded_paired_people', ['수집 누락을 0회 방문으로 확정하지 않음', '설명적 비교이며 인과효과를 뜻하지 않음'], 'visits'),
    before_after_visit_sessions: definition('before_after_visit_sessions', '전후 방문 세션 변화', 'sessions', '대상 프로그램 첫 기록상 참석일 전후 동일 기간의 사람별 방문 세션 평균 변화',
        ['양쪽 관찰 가능 사람'], ['관찰 범위가 부족한 사람'], '해당 measure의 paired 사람 수', ['설명적 비교이며 인과효과를 뜻하지 않음'], 'visits'),
    before_after_measured_duration: definition('before_after_measured_duration', '전후 실측 체류 변화', 'minutes', '대상 프로그램 첫 기록상 참석일 전후 양쪽에 실측 체류가 있는 사람의 평균 변화',
        ['양쪽 양수 실측 체류'], ['CHECKOUT 누락 또는 한쪽 실측 부재'], '해당 measure의 paired 사람 수', ['방문일 변화와 분모가 다를 수 있음'], 'duration'),
    rental_bookings: definition('rental_bookings', '대여 예약', 'count', 'booking_date가 기간에 속하는 현재 예약 기록 수',
        ['예약 기록'], [], null, ['실제 이용시간·이용률을 뜻하지 않음'], 'rentals'),
    store_orders: definition('store_orders', '스토어 주문', 'count', '생성 시각이 기간에 속하는 현재 주문 기록 수',
        ['주문 기록'], [], null, ['포인트 순증감이나 매출을 뜻하지 않음'], 'store'),
    survey_submissions: definition('survey_submissions', '설문 제출', 'count', '생성 시각이 기간에 속하는 설문 제출 기록 수',
        ['설문 제출 기록'], [], null, ['설문 답변 원문은 분석 결과에 포함하지 않음'], 'surveys'),
});

export const OPERATION_CAPABILITIES = Object.freeze({
    get_analysis_capabilities: Object.freeze({ max_period_days: 366, allowed_measures: Object.freeze([]) }),
    get_operation_summary: Object.freeze({ max_period_days: 366, allowed_measures: Object.freeze([...DOMAIN_NAMES]) }),
    get_program_catalog: Object.freeze({ max_period_days: 366, allowed_measures: Object.freeze([]) }),
    analyze_program_engagement: Object.freeze({ max_period_days: 366, allowed_measures: Object.freeze(['applications', 'recorded_attendance', 'satisfaction', 'participation_distribution', 'transitions']) }),
    analyze_revisits: Object.freeze({ max_period_days: 92, allowed_measures: Object.freeze(['7', '14', '30']) }),
    analyze_program_visit_change: Object.freeze({ max_period_days: 92, allowed_measures: Object.freeze(['visitor_days', 'visit_sessions', 'measured_duration']) }),
    get_metric_definitions: Object.freeze({ max_period_days: 0, allowed_measures: Object.freeze([]) }),
});

export function metricDefinition(metricId) {
    return METRIC_DEFINITIONS[metricId] || null;
}

export function definitionsFor(metricIds = null) {
    if (metricIds == null) return Object.freeze(Object.values(METRIC_DEFINITIONS));
    return Object.freeze(metricIds.map(metricId => metricDefinition(metricId)).filter(Boolean));
}

export function operationCapabilities() {
    return Object.freeze(OPERATION_NAMES.map(name => Object.freeze({
        name,
        max_period_days: OPERATION_CAPABILITIES[name].max_period_days,
        allowed_measures: [...OPERATION_CAPABILITIES[name].allowed_measures],
    })));
}
