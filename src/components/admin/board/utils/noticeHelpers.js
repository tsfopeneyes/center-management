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
    is_leader_only
}) => {
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
    const leaderWarning = is_leader_only 
        ? '<p style="margin: 0; color: #f59e0b;"><strong>⚠️ 대상:</strong> 학생 리더 전용 프로그램</p>' 
        : '';

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
    // We retain the full string (e.g., 'YYYY-MM-DDTHH:mm') for program_date 
    // because splitDateTime in downstream components expects the full string to extract the time properly.
    const pDateFull = localProgramDate ? localProgramDate.split('T') : ['', '12:00'];
    const pTime = pDateFull[1] ? pDateFull[1].substring(0, 5) : '12:00';

    return {
        title: notice.title,
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
        program_location: location,
        program_type: notice.program_type || 'CENTER',
        is_leader_only: notice.is_leader_only || false,
        target_regions: notice.target_regions || [],
        is_poll: notice.is_poll || false,
        allow_multiple_votes: notice.allow_multiple_votes || false,
        poll_deadline: notice.poll_deadline ? formatToLocalISO(notice.poll_deadline) : '',
        poll_options: notice.poll_options || [],
        hyphen_reward: notice.hyphen_reward || 0
    };
};
