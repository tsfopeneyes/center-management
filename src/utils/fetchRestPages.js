// Advance by the actual response size: PostgREST may cap a requested page.
// Callers must provide a stable order, including a unique tie breaker.
export async function fetchRestPages(request, path, pageSize = 500) {
    const [table, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    params.delete('limit');
    params.delete('offset');
    const rows = [];
    for (;;) {
        params.set('limit', String(pageSize));
        params.set('offset', String(rows.length));
        const page = await request(`${table}?${params}`);
        if (!Array.isArray(page)) throw new Error('기록 조회 응답이 올바르지 않습니다.');
        if (page.length === 0) return rows;
        rows.push(...page);
    }
}
