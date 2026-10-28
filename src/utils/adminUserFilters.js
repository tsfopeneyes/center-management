import { getUserCategory } from './userCategory.js';

export const USER_GROUPS = ['청소년', '졸업생', 'STAFF', '게스트'];
export const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];
export const VISIT_OPTIONS = [['ALL', '전체'], ['7D', '최근 7일'], ['30D', '최근 30일'], ['90D', '최근 90일'], ['OLD_30D', '30일 이상 미방문'], ['NONE', '방문 기록 없음']];
export const defaultUserFilters = () => ({ groups: [], region: 'ALL', leader: 'ALL', schoolChurch: 'ALL', joined: 'ALL', start: '', end: '', visit: 'ALL', grades: [] });
export const schoolChurchState = user => user.preferences?.is_school_church === true ? 'YES' : 'NO';
export const baseUserGroup = user => getUserCategory({ ...user, is_leader: false });
export const koreaDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
};
export function monthsBefore(today, months) {
    const date = new Date(`${today}T00:00:00Z`);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return date.toISOString().slice(0, 10);
}
export function estimatedSchoolGrade(birth, now = new Date()) {
    if (!/^\d{6}$/.test(String(birth || ''))) return null;
    const value = String(birth);
    const yy = Number(value.slice(0, 2));
    const year = yy <= 40 ? 2000 + yy : 1900 + yy;
    const month = Number(value.slice(2, 4));
    const day = Number(value.slice(4, 6));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const today = koreaDate(now);
    const schoolYear = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 3 ? 1 : 0);
    return GRADE_OPTIONS[schoolYear - year - 13] || null;
}
export function buildLastCenterVisits(logs, now = new Date()) {
    const visits = new Map();
    for (const log of logs || []) {
        if (!log.user_id || !['CHECKIN', 'GUEST_ENTRY'].includes(log.type) || !log.created_at) continue;
        const at = new Date(log.created_at).getTime();
        if (!Number.isFinite(at) || at > new Date(now).getTime()) continue;
        const day = koreaDate(log.created_at);
        if (!visits.has(log.user_id) || day > visits.get(log.user_id)) visits.set(log.user_id, day);
    }
    return visits;
}
export function matchesAdminUser(user, filters, search = '', now = new Date(), lastVisits = new Map()) {
    if (user.status === 'withdrawn') return false;
    const group = baseUserGroup(user);
    if (filters.groups.length ? !filters.groups.includes(group) : group === '게스트') return false;
    if (filters.region !== 'ALL' && user.schoolRegion !== filters.region) return false;
    if (filters.leader !== 'ALL' && Boolean(user.is_leader) !== (filters.leader === 'YES')) return false;
    if (filters.schoolChurch !== 'ALL' && schoolChurchState(user) !== filters.schoolChurch) return false;
    const today = koreaDate(now);
    if (filters.grades?.length && !filters.grades.includes(estimatedSchoolGrade(user.birth, now))) return false;
    if (filters.visit && filters.visit !== 'ALL') {
        const last = lastVisits.get(user.id);
        if (filters.visit === 'NONE') {
            if (last) return false;
        } else {
            const days = filters.visit === 'OLD_30D' ? 30 : Number(filters.visit.replace('D', ''));
            const start = new Date(today + 'T00:00:00Z');
            start.setUTCDate(start.getUTCDate() - (days - 1));
            const cutoff = start.toISOString().slice(0, 10);
            if (!last || (filters.visit === 'OLD_30D' ? last >= cutoff : last < cutoff)) return false;
        }
    }
    if (filters.joined !== 'ALL') {
        const joined = user.created_at ? koreaDate(user.created_at) : '';
        const start = filters.joined === 'CUSTOM' ? filters.start : monthsBefore(today, filters.joined === '1M' ? 1 : 3);
        const end = filters.joined === 'CUSTOM' ? filters.end : today;
        if (!joined || (start && joined < start) || (end && joined > end) || (start && end && start > end)) return false;
    }
    const query = search.trim().toLocaleLowerCase('ko-KR');
    if (!query) return true;
    const birth = String(user.birth || '');
    const yy = Number(birth.slice(0, 2));
    const age = /^\d{6}$/.test(birth) ? String(Number(today.slice(0, 4)) - (yy <= 40 ? 2000 + yy : 1900 + yy) + 1) : '';
    return [user.name, user.phone, user.phone_back4, user.schoolDisplayName, user.school, user.church, user.user_group, user.role, getUserCategory(user)]
        .some(value => String(value || '').toLocaleLowerCase('ko-KR').includes(query)) || Boolean(age && age === query.replace(/세|살/g, ''));
}
export function userFilterChips(filters, search) {
    const chips = [];
    if (search.trim()) chips.push({ key: 'search', label: `검색: ${search.trim()}` });
    if (filters.region !== 'ALL') chips.push({ key: 'region', label: `학교 지역: ${filters.region}` });
    filters.groups.forEach(group => chips.push({ key: `group:${group}`, label: group }));
    if (filters.leader !== 'ALL') chips.push({ key: 'leader', label: filters.leader === 'YES' ? '리더' : '리더 아님' });
    if (filters.schoolChurch !== 'ALL') chips.push({ key: 'schoolChurch', label: `스쿨처치 ${filters.schoolChurch === 'YES' ? '참여' : '미참여'}` });
    if (filters.joined !== 'ALL') chips.push({ key: 'joined', label: filters.joined === 'CUSTOM' ? `가입: ${filters.start || '시작일 제한 없음'} ~ ${filters.end || '종료일 제한 없음'}` : `최근 ${filters.joined === '1M' ? 1 : 3}개월 가입` });
    if (filters.visit && filters.visit !== 'ALL') chips.push({ key: 'visit', label: '센터 방문: ' + VISIT_OPTIONS.find(([value]) => value === filters.visit)?.[1] });
    (filters.grades || []).forEach(grade => chips.push({ key: 'grade:' + grade, label: '나이대: ' + grade }));
    return chips;
}
