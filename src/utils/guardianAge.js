// Use completed years and the Korean calendar date, not Korean counting age.
export function getGuardianAge(birth, now = new Date()) {
    if (!/^\d{6}$/.test(String(birth || ''))) return null;
    const value = String(birth);
    const yy = Number(value.slice(0, 2));
    const year = yy <= 30 ? 2000 + yy : 1900 + yy;
    const month = Number(value.slice(2, 4));
    const day = Number(value.slice(4, 6));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(now);
    const today = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
    const age = today.year - year - (today.month < month || (today.month === month && today.day < day) ? 1 : 0);
    return age >= 0 && age <= 120 ? age : null;
}

export function getGuardianCleanup(birth, now) {
    const age = getGuardianAge(birth, now);
    return age !== null && age >= 14
        ? { guardian_name: null, guardian_phone: null, guardian_relation: null }
        : {};
}
