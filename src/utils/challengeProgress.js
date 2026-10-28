// Mission posts remain unlimited. Daily progress counts calendar days rather
// than posts so several posts today cannot complete tomorrow's requirement.
export const countMissionCompletions = (mission, submissions = []) => {
    const valid = submissions.filter(item => item.mission_id === mission.id && item.is_valid !== false);
    return mission.schedule_type === 'DAILY'
        ? new Set(valid.filter(item => item.completion_date).map(item => item.completion_date instanceof Date
            ? item.completion_date.toISOString().slice(0, 10) : String(item.completion_date).slice(0, 10))).size
        : valid.length;
};

export const canWriteMissionPost = (mission, { canSubmitMission, hasJoined, today }) =>
    Boolean(canSubmitMission && hasJoined
        && (mission.schedule_type !== 'FIXED_DATE' || mission.fixed_date === today));

export const requiredForChallengeMission = (notice, mission) => {
    if (notice.challenge_format !== 'ONLINE') return 1;
    if (mission.schedule_type === 'DAILY') {
        const days = Math.round((Date.parse(String(notice.program_end_date).slice(0, 10)) - Date.parse(String(notice.program_start_date).slice(0, 10))) / 86400000) + 1;
        return Number.isFinite(days) ? Math.max(1, days) : 1;
    }
    return mission.schedule_type === 'FLEXIBLE' ? Math.max(1, Math.trunc(Number(mission.target_count) || 1)) : 1;
};

export const getChallengeProgress = (notice, submissions = []) => {
    const missions = (notice.challenge_missions || []).filter(mission => mission.is_active !== false);
    const online = notice.challenge_format === 'ONLINE';
    const valid = submissions.filter(item => online ? item.is_valid !== false : item.status === 'COMPLETED');
    const total = missions.reduce((sum, mission) => sum + requiredForChallengeMission(notice, mission), 0);
    const completed = missions.reduce((sum, mission) => sum + Math.min(requiredForChallengeMission(notice, mission), countMissionCompletions(mission, valid)), 0);
    const settings = notice.guest_properties || notice;
    const criterion = settings.challenge_reward_criterion || 'ALL';
    const count = /^[0-9]{1,9}$/.test(String(settings.challenge_reward_count ?? '')) ? Math.max(1, Number(settings.challenge_reward_count)) : 1;
    const percent = /^[0-9]{1,3}$/.test(String(settings.challenge_reward_percent ?? '')) ? Math.min(100, Math.max(1, Number(settings.challenge_reward_percent))) : 100;
    // Do not silently lower a saved count if the mission total is later reduced.
    const threshold = criterion === 'FIRST_MISSION' ? 1 : criterion === 'COUNT' ? count
        : criterion === 'PERCENT' ? Math.ceil(total * percent / 100) : total;
    return { total, completed, threshold, isSuccess: total > 0 && completed >= threshold,
        remaining: Math.max(0, threshold - completed),
        description: total > 0 ? `총 ${total}회 중 ${threshold}회 달성하면 성공합니다.` : '미션을 추가하면 성공 기준을 확인할 수 있습니다.' };
};
