import { extractProgramInfo } from '../../../../utils/textUtils';
import { formatToLocalISO } from '../../../../utils/dateUtils';

export const splitDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return { date: '', time: '12:00' };
    if (dateTimeStr.includes('T')) {
        const [date, time] = dateTimeStr.split('T');
        return { date, time: time.substring(0, 5) };
    }
    return { date: dateTimeStr, time: '12:00' };
};

export const joinDateTime = (date, time) => {
    if (!date) return '';
    return `${date}T${time}`;
};

export const generateProgramInfoHtml = ({
    program_date,
    program_duration,
    program_location,
    max_capacity,
    is_leader_only,
    is_recruiting,
    program_start_date,
    program_end_date,
    program_days,
    is_challenge,
    challenge_missions
}) => {
    const leaderWarning = is_leader_only 
        ? '<p style="margin: 0; color: #f59e0b;"><strong>⚠️ 대상:</strong> 학생 리더 전용 프로그램</p>' 
        : '';

    if (is_challenge) {
        return leaderWarning 
            ? `<div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 20px;">${leaderWarning}</div>`
            : '';
    }

    if (!is_recruiting) {
        // 오픈 프로그램 (기간 반복 진행형)
        const start = program_start_date ? new Date(program_start_date).toLocaleDateString('ko-KR') : '미정';
        const end = program_end_date ? new Date(program_end_date).toLocaleDateString('ko-KR') : '미정';
        const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
        const daysText = program_days && program_days.length > 0
            ? program_days.map(d => dayLabels[d]).join(', ')
            : '없음';

        const pTime = program_date ? splitDateTime(program_date).time : '12:00';
        const formattedTime = pTime ? (pTime.split(':')[0] >= 12 ? `오후 ${pTime.split(':')[0] - 12 || 12}:${pTime.split(':')[1]}` : `오전 ${pTime.split(':')[0]}:${pTime.split(':')[1]}`) : '미정';

        return `
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0;"><strong>📅 진행 기간:</strong> ${start} ~ ${end}</p>
    <p style="margin: 0 0 8px 0;"><strong>🗓️ 진행 요일:</strong> ${daysText}</p>
    <p style="margin: 0 0 8px 0;"><strong>⏰ 진행 시간:</strong> ${formattedTime} (${program_duration || '미정'})</p>
    <p style="margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${program_location || '미정'}</p>
    ${leaderWarning}
</div>
`;
    }

    const combinedDate = program_date;
    const formattedDate = combinedDate 
        ? new Date(combinedDate).toLocaleString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
          }) 
        : '미정';

    const capacityText = max_capacity && max_capacity > 0 ? `${max_capacity}명` : '제한 없음';

    return `
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0;"><strong>📅 일정:</strong> ${formattedDate}</p>
    <p style="margin: 0 0 8px 0;"><strong>⏰ 소요시간:</strong> ${program_duration || '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${program_location || '미정'}</p>
    <p style="margin: 0 0 8px 0;"><strong>👥 모집 정원:</strong> ${capacityText}</p>
    ${leaderWarning}
</div>
`;
};

export const prepareNoticeForEdit = (notice) => {
    const { duration, location, cleanContent } = extractProgramInfo(notice.content);

    const localProgramDate = notice.program_date ? formatToLocalISO(notice.program_date) : '';
    const pDateFull = localProgramDate ? localProgramDate.split('T') : ['', '12:00'];
    const pTime = pDateFull[1] ? pDateFull[1].substring(0, 5) : '12:00';

    return {
        title: notice.title,
        short_description: notice.short_description || '',
        content: cleanContent,
        is_recruiting: notice.is_recruiting,
        is_sticky: notice.is_sticky || false,
        send_push: false,
        category: notice.category,
        recruitment_deadline: notice.recruitment_deadline ? formatToLocalISO(notice.recruitment_deadline) : '',
        max_capacity: notice.max_capacity || '',
        program_date: localProgramDate,
        program_time: pTime,
        program_duration: duration || notice.program_duration || '',
        program_location: location || notice.program_location || '',
        program_type: notice.program_type || 'CENTER',
        is_leader_only: notice.is_leader_only || false,
        target_regions: notice.target_regions || [],
        is_poll: notice.is_poll || false,
        allow_multiple_votes: notice.allow_multiple_votes || false,
        poll_deadline: notice.poll_deadline ? formatToLocalISO(notice.poll_deadline) : '',
        poll_options: notice.poll_options || [],
        haifn_reward: notice.haifn_reward || 0,
        is_review_required: notice.is_review_required || false,
        program_start_date: notice.program_start_date ? formatToLocalISO(notice.program_start_date).split('T')[0] : '',
        program_end_date: notice.program_end_date ? formatToLocalISO(notice.program_end_date).split('T')[0] : '',
        program_days: notice.program_days || [],
        host_id: notice.host_id || '',
        host_ids: notice.host_ids || (notice.host_id ? [notice.host_id] : []),
        hosts: notice.hosts || (notice.host_id ? [{ host_id: notice.host_id, one_liner: notice.host_one_liner }] : []),
        host_one_liner: notice.host_one_liner || '',
        is_challenge: notice.is_challenge || false,
        challenge_missions: notice.challenge_missions || [],
        challenge_success_message: notice.challenge_success_message || '',
        challenge_show_hyphen_btn: notice.challenge_show_hyphen_btn || false
    };
};
