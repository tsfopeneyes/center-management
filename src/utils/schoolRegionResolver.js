import { normalizeSchoolName } from './schoolUtils';

export function createSchoolRegionResolver({ readSchools, now = Date.now, cacheMs = 60000 }) {
    let cached = null;
    let expiresAt = 0;
    let pending = null;
    return async (schoolName, { forceRefresh = false } = {}) => {
        if (!schoolName) return null;
        let regions = cached;
        if (forceRefresh || !regions || now() >= expiresAt) {
            if (!pending) {
                pending = Promise.resolve().then(readSchools).then(rows => {
                    if (!Array.isArray(rows)) throw new Error('Invalid school response');
                    const next = new Map();
                    rows.forEach(school => {
                        const name = normalizeSchoolName(school.name);
                        if (name && school.region) next.set(name, school.region.trim());
                    });
                    cached = next;
                    expiresAt = now() + cacheMs;
                    return next;
                }).finally(() => { pending = null; });
            }
            regions = await pending;
        }
        return regions.get(normalizeSchoolName(schoolName))
            || (schoolName.includes('강서') ? '강서' : schoolName.includes('강동') ? '강동' : null);
    };
}

export function withSchoolLookupTimeout(read, timeoutMs = 6000) {
    let timer;
    return Promise.race([
        Promise.resolve().then(read),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(Object.assign(new Error('School lookup timed out'), { code: 'TIMEOUT' })), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));
}
