import { AnalysisError } from './contracts.mjs';

export const SITE_CODES = Object.freeze(['ALL', 'HAIFN', 'ENOUGH_PLACE']);
export const SITE_DEFINITIONS = Object.freeze([
    { code: 'ALL', label: '전체 공간' },
    { code: 'HAIFN', label: '하이픈' },
    { code: 'ENOUGH_PLACE', label: '이높플레이스' },
]);

export function normalizeSite(value) {
    if (value === undefined) return 'ALL';
    if (!SITE_CODES.includes(value)) throw new AnalysisError('invalid_input');
    return value;
}

// Preserve the complete event chain. Only valid target locations are narrowed;
// deleting other-site MOVE/CHECKOUT rows would inflate target-site duration.
export function scopeSnapshotToSite(snapshot, site = 'ALL') {
    if (site === 'ALL') return snapshot;
    const datasets = { ...snapshot.datasets };
    const excluded = {};
    for (const name of ['locations', 'notices', 'rentalBookings', 'checkinSurveys']) {
        if (!Array.isArray(datasets[name])) continue;
        if (datasets[name].some(row => !Object.hasOwn(row, 'site'))) throw new AnalysisError('source_incomplete');
        excluded[name] = datasets[name].filter(row => row.site == null).length;
        datasets[name] = datasets[name].filter(row => row.site === site);
    }
    // Orders have no resource/site attribution in the current schema. Do not
    // pass global totals off as a selected center's count (including zero).
    if (Array.isArray(datasets.storeOrders)) datasets.storeOrders = undefined;
    const refs = new Set((datasets.notices || []).map(row => String(row.id)));
    if (Array.isArray(datasets.satisfactionResponses)) {
        datasets.satisfactionResponses = datasets.satisfactionResponses.filter(row => refs.has(String(row.program_ref)));
    }
    return { ...snapshot, datasets, site_scope: { site, unclassified_source_rows: excluded } };
}

export const siteScopeMetadata = (snapshot, site = 'ALL') => ({
    site,
    ...(site !== 'ALL' ? {
        unclassified_source_rows: snapshot?.site_scope?.unclassified_source_rows || {},
        attribution: {
            visits: 'recorded_location', programs: 'recorded_program_location',
            rentals: 'rental_resource_owner_region', surveys: 'recorded_location',
            store: 'unavailable',
        },
    } : {}),
});

export function siteScopeWarnings(snapshot, site = 'ALL') {
    if (site === 'ALL') return [];
    return [
        { code: 'site_scope', message: '선택한 센터에서 확인되는 기록만 집계했습니다. 장소가 불명확한 기록은 제외하며, 대여는 대여 공간에 연결된 소속 지역을 기준으로 분류합니다. 여러 센터를 방문한 사람은 각 센터에 포함될 수 있어 센터별 순방문자를 더하면 전체 순방문자와 다를 수 있습니다.' },
        ...(Object.values(snapshot?.site_scope?.unclassified_source_rows || {}).some(count => count > 0)
            ? [{ code: 'site_attribution_incomplete', message: '센터를 확인할 수 없는 원천 기록이 있습니다. 제외된 기록 수는 scope.unclassified_source_rows에 표시했습니다. 프로그램 출석 없는 날의 방문 역시 장소 미분류 프로그램의 영향을 받을 수 있습니다.' }] : []),
    ];
}
