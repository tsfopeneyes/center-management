import { mkdir, writeFile } from 'node:fs/promises';

// Public download endpoints used by DATA.GO.KR's own JSON download button.
const source = 'https://www.data.go.kr/data/15021148/standard.do';
const base = 'https://www.data.go.kr/download/';
async function getJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Public school source returned ${response.status}`);
    return response.json();
}
const header = await getJson(`${base}columList.json?pk=15021148&ext=JSON`);
if (!Array.isArray(header.tableVO?.colNmList) || !Number.isInteger(header.totalCount) || header.totalCount < 10000 || header.totalCount > 30000) throw new Error('Unexpected public school schema or count');
const rows = [];
for (let page = 1; page <= Math.ceil(header.totalCount / 10000); page++) {
    const params = new URLSearchParams({ publicDataPk: '15021148', totalCount: String(header.totalCount), svcTableNm: header.tableVO.svcTableNm, perPage: '10000', page: String(page) });
    header.tableVO.colNmList.forEach(column => params.append('colNmList', column));
    const batch = await getJson(`${base}standard.json?${params}`);
    if (!Array.isArray(batch)) throw new Error('Unexpected public school response');
    rows.push(...batch);
}
if (rows.length !== header.totalCount) throw new Error('Incomplete public school download');
const ids = new Set();
const schools = rows.filter(row => row.OPER_STTUS === '운영').map(row => {
    const lat = Number(row.LATITUDE), lng = Number(row.LONGITUDE);
    if (!row.SCHOOL_ID || !row.SCHOOL_NM || !['초등학교','중학교','고등학교'].includes(row.SCHOOL_SE)
        || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) throw new Error('Invalid public school record');
    if (ids.has(row.SCHOOL_ID)) throw new Error('Duplicate public school ID');
    ids.add(row.SCHOOL_ID);
    return [row.SCHOOL_ID, row.SCHOOL_NM, row.SCHOOL_SE, row.RDNMADR || row.LNMADR || '', lat, lng];
}).sort((a,b) => a[0].localeCompare(b[0]));
const dates = [...new Set(rows.map(row => row.REFERENCE_DATE))].sort();
if (schools.length < 10000 || schools.length > 15000 || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('Unexpected public school coverage or date');
await mkdir('public/data', { recursive: true });
const payload = { source, provider: '한국교육시설안전원', referenceDate: dates[0], fields: ['id','name','type','address','lat','lng'], schools };
await writeFile('public/data/public-school-locations.json', JSON.stringify(payload));
console.log(JSON.stringify({ source, downloaded: rows.length, operatingSchools: schools.length, referenceDate: dates[0] }));
