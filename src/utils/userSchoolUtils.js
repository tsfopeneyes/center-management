import { normalizeSchoolName } from './schoolUtils.js';

export const buildSchoolLookup = (schools = []) => {
    const byId = new Map();
    const byName = new Map();
    schools.forEach(school => {
        byId.set(String(school.id), school);
        const key = normalizeSchoolName(school.name);
        if (!key) return;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(school);
    });
    return { byId, byName };
};

export const resolveUserSchool = (user, lookup) => {
    const linkedSchool = user?.school_id
        ? lookup.byId.get(String(user.school_id))
        : null;
    const nameMatches = lookup.byName.get(normalizeSchoolName(user?.school)) || [];
    const school = linkedSchool || (nameMatches.length === 1 ? nameMatches[0] : null);
    const region = ['강동', '강서'].includes(school?.region) ? school.region : '미지정';
    return {
        school,
        schoolId: user?.school_id || school?.id || null,
        schoolName: school?.name || user?.school || '',
        region
    };
};
