import { normalizeSchoolName } from './schoolUtils.js';
import { schoolCoordinates } from './naverMaps.js';

let pending;
export function loadPublicSchools() {
    if (!pending) pending = fetch(`${import.meta.env.BASE_URL}data/public-school-locations.json`)
        .then(response => {
            if (!response.ok) throw new Error('주변 학교 자료를 불러오지 못했습니다.');
            return response.json();
        }).then(data => {
            if (!Array.isArray(data.schools) || !data.referenceDate) throw new Error('주변 학교 자료 형식이 올바르지 않습니다.');
            return { ...data, schools: data.schools.map(([id,name,type,address,lat,lng]) => ({ id,name,type,address,lat,lng })) };
        }).catch(error => { pending = undefined; throw error; });
    return pending;
}

const aliases = new Map([['부천상동고', '상동고'], ['신릉중', '용인신릉중']]);
const nameKey = name => { const key = normalizeSchoolName(name); return aliases.get(key) || key; };
export function excludeRegisteredSchools(publicSchools, registeredSchools) {
    const byName = new Map();
    const publicNameCount = new Map();
    publicSchools.forEach(school => publicNameCount.set(nameKey(school.name), (publicNameCount.get(nameKey(school.name)) || 0) + 1));
    registeredSchools.forEach(school => {
        const key = nameKey(school.name);
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(school);
    });
    return publicSchools.filter(school => !(byName.get(nameKey(school.name)) || []).some(registered => {
        const point = schoolCoordinates(registered);
        if (!point) return publicNameCount.get(nameKey(school.name)) === 1;
        // Names alone cannot distinguish homonyms in different cities.
        const dy = (school.lat - point.lat) * 111000;
        const dx = (school.lng - point.lng) * 88000;
        return dx * dx + dy * dy < 1500 * 1500;
    }));
}

export function nearbyPublicSchools(schools, { south, north, west, east }, types, search = '') {
    const needle = normalizeSchoolName(search).toLowerCase();
    return schools.filter(school => types.includes(school.type) && school.lat >= south && school.lat <= north
        && school.lng >= west && school.lng <= east && (!needle || normalizeSchoolName(school.name).toLowerCase().includes(needle)));
}
