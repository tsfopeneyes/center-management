export function satisfactionContext(snapshot, period, metrics) {
    const count = metrics?.satisfaction_response_count;
    const reports = (snapshot.operating_context || []).filter(row => row.domain === 'feedback'
        && row.start <= period.start && row.end_exclusive >= period.end_exclusive);
    const states = new Set(reports.map(row => row.activity_status));
    const observed = count?.status === 'available' && count.value > 0;
    const reportedNotConducted = states.has('not_conducted');
    const conflict = states.size > 1 || observed && reportedNotConducted;
    const status = conflict ? 'conflicting_evidence' : observed ? 'responses_recorded'
        : states.size === 1 ? [...states][0] : 'unknown';
    return {
        domain: 'feedback', activity_status: status,
        evidence: conflict ? ['operator_report', ...(observed ? ['response_records'] : [])]
            : observed ? ['response_records'] : states.size ? ['operator_report'] : [],
        interpretation: conflict ? '운영자 설명과 기록이 충돌해 실시 여부를 재확인해야 합니다.'
            : status === 'not_conducted' ? '운영자 확인: 이 기간 만족도 조사 미실시. 응답 0건을 수집 장애나 만족도 저하로 해석하지 마세요.'
                : status === 'conducted' ? '운영자 확인: 조사 실시. 응답 부재의 원인은 확인되지 않았습니다.'
                    : observed ? '만족도 응답 기록이 존재합니다. 전체 이용자의 만족도를 대표한다고 단정하지 마세요.'
                        : '조사 실시 여부 확인 불가. 응답 부재만으로 조사 미실시·수집 중단·운영 실패를 단정하지 마세요.',
        survey_metric_distinction: 'survey_submissions는 체크인 설문이며 만족도 조사와 별개입니다.',
    };
}
