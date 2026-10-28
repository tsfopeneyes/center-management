import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import { loadNaverMaps, schoolCoordinates, searchMapAddress } from '../../../../utils/naverMaps';
import { schoolStudentCount, schoolStudentHeatPoints } from '../../../../utils/schoolMapStudents';
import { loadPublicSchools, excludeRegisteredSchools, nearbyPublicSchools } from '../../../../utils/publicSchoolMap';
import { mapCenters } from '../../../../utils/mapCenters';

const key = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID?.trim();
const control = 'px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50';
const centerPins = {
    '강동': { color: '#dc2626', label: '강동' },
    '강서': { color: '#2563eb', label: '강서' },
    '미지정': { color: '#64748b', label: '센터 미지정' },
};

const isTeamConnected = group => Array.isArray(group.metadata?.manager_ids) && group.metadata.manager_ids.length > 0;

function centerPin(region, maps, connected) {
    const pin = centerPins[region] || centerPins['미지정'];
    const shape = 'M16 40C13 35 2 23 2 16a14 14 0 1 1 28 0c0 7-11 19-14 24Z';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="${shape}" fill="white" stroke="white" stroke-width="4"/><path d="${shape}" fill="${connected ? pin.color : 'white'}" stroke="${pin.color}" stroke-width="2"/></svg>`;
    return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size: new maps.Size(32, 42), anchor: new maps.Point(16, 40) };
}

function facilityIcon(center, maps) {
    const color = centerPins[center.region].color;
    const content = document.createElement('button');
    content.type = 'button';
    content.dataset.centerMarker = center.id;
    content.setAttribute('aria-label', `${center.name} 센터 위치`);
    content.style.cssText = 'width:120px;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;padding:0;background:transparent;cursor:pointer;color:white';
    content.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><rect x="1.5" y="1.5" width="33" height="33" rx="9" fill="${color}" stroke="white" stroke-width="3"/><path d="M12 27V10h12v17M9 27h18M16 27v-5h4v5M16 14h1m3 0h1m-5 4h1m3 0h1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const label = document.createElement('span');
    label.textContent = center.name;
    label.style.cssText = `padding:3px 9px;border:2px solid white;border-radius:7px;background:${color};font-size:12px;font-weight:700;line-height:16px;white-space:nowrap;box-shadow:0 1px 4px #0003`;
    content.append(label);
    return { content: content.outerHTML, size: new maps.Size(120, 64), anchor: new maps.Point(60, 34) };
}

export default function SchoolMapView({ groups, allRegisteredSchools = [], searchTerm = '', onOpenDetail, onRefresh }) {
    const canvas = useRef(null);
    const mapRef = useRef(null);
    const markers = useRef(new Map());
    const detailCallback = useRef(onOpenDetail);
    const viewInitialized = useRef(false);
    const [maps, setMaps] = useState(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [mapMode, setMapMode] = useState('pins');
    const density = mapMode !== 'pins';
    const [connectionFilter, setConnectionFilter] = useState('ALL');
    const [enabledCenters, setEnabledCenters] = useState(['강동', '강서', '미지정']);
    const [showPublicSchools, setShowPublicSchools] = useState(false);
    const [publicTypes, setPublicTypes] = useState(['중학교', '고등학교']);
    const [publicData, setPublicData] = useState(null);
    const [publicError, setPublicError] = useState('');
    const [publicAttempt, setPublicAttempt] = useState(0);
    const [viewport, setViewport] = useState(null);
    const [editing, setEditing] = useState(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [busy, setBusy] = useState(false);
    const [locationError, setLocationError] = useState('');
    const centerGroups = useMemo(() => groups.filter(group => enabledCenters.includes(
        ['강동','강서'].includes(group.metadata?.region?.trim()) ? group.metadata.region.trim() : '미지정')), [groups, enabledCenters]);
    const connectedCount = useMemo(() => centerGroups.filter(isTeamConnected).length, [centerGroups]);
    const visibleGroups = useMemo(() => centerGroups.filter(group => connectionFilter === 'ALL'
        || (connectionFilter === 'CONNECTED' ? isTeamConnected(group) : !isTeamConnected(group))), [centerGroups, connectionFilter]);
    const located = useMemo(() => visibleGroups.filter(g => schoolCoordinates(g.metadata)), [visibleGroups]);
    const studentTotal = useMemo(() => visibleGroups.reduce((total, group) => total + schoolStudentCount(group), 0), [visibleGroups]);
    const heatPoints = useMemo(() => schoolStudentHeatPoints(visibleGroups), [visibleGroups]);
    const mappedStudents = useMemo(() => heatPoints.reduce((total, point) => total + point.students, 0), [heatPoints]);
    const unregistered = useMemo(() => publicData ? excludeRegisteredSchools(publicData.schools, allRegisteredSchools) : [], [publicData, allRegisteredSchools]);
    const nearby = useMemo(() => showPublicSchools && viewport?.zoom >= 10
        ? nearbyPublicSchools(unregistered, viewport, publicTypes, searchTerm) : [], [unregistered, viewport, publicTypes, searchTerm, showPublicSchools]);

    useEffect(() => { detailCallback.current = onOpenDetail; }, [onOpenDetail]);

    useEffect(() => {
        if (!maps || !mapRef.current) return;
        const map = mapRef.current;
        const info = new maps.InfoWindow({ borderWidth: 0, backgroundColor: '#ffffff', disableAutoPan: true });
        const listeners = [];
        const facilities = mapCenters.filter(center => enabledCenters.includes(center.region)).map(center => {
            const marker = new maps.Marker({ map, position: new maps.LatLng(center.lat, center.lng),
                zIndex: 30, title: `${center.name} · 센터`, icon: facilityIcon(center, maps) });
            listeners.push(maps.Event.addListener(marker, 'click', () => {
                const content = document.createElement('div');
                content.style.cssText = 'padding:14px 16px;max-width:260px;font-size:12px;line-height:1.7;color:#4b5563';
                const heading = document.createElement('div');
                heading.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:4px';
                const title = document.createElement('strong'); title.textContent = center.name;
                title.style.cssText = 'font-size:14px;color:#111827';
                const close = document.createElement('button');
                close.type = 'button'; close.textContent = '닫기';
                close.setAttribute('aria-label', `${center.name} 팝업 닫기`);
                close.style.cssText = 'padding:4px;color:#6b7280;background:transparent;border:0;cursor:pointer';
                close.onclick = () => info.close();
                const address = document.createElement('p'); address.textContent = center.address;
                heading.append(title, close); content.append(heading, address);
                info.setContent(content); info.open(map, marker);
            }));
            return marker;
        });
        return () => { listeners.forEach(listener => maps.Event.removeListener(listener)); facilities.forEach(marker => marker.setMap(null)); info.close(); };
    }, [maps, enabledCenters]);

    useEffect(() => {
        if (!showPublicSchools || publicData) return;
        let active = true;
        setPublicError('');
        loadPublicSchools().then(data => { if (active) setPublicData(data); })
            .catch(error => { if (active) setPublicError(error.message); });
        return () => { active = false; };
    }, [showPublicSchools, publicData, publicAttempt]);

    useEffect(() => {
        if (!maps || !mapRef.current) return;
        const map = mapRef.current;
        const update = () => {
            const bounds = map.getBounds(), sw = bounds.getSW(), ne = bounds.getNE();
            setViewport({ south: sw.lat(), north: ne.lat(), west: sw.lng(), east: ne.lng(), zoom: map.getZoom() });
        };
        const listener = maps.Event.addListener(map, 'idle', update);
        update();
        return () => maps.Event.removeListener(listener);
    }, [maps]);

    useEffect(() => {
        if (!maps || !mapRef.current || !showPublicSchools) return;
        const map = mapRef.current;
        const info = new maps.InfoWindow({ borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff' });
        const listeners = [];
        const dots = nearby.length > 300 ? [] : nearby.map(school => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="#64748b" stroke="white" stroke-width="2"/></svg>';
            const marker = new maps.Marker({ map, position: new maps.LatLng(school.lat, school.lng), zIndex: 1,
                title: `${school.name} · 미등록 ${school.type}`, icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size: new maps.Size(18, 18), anchor: new maps.Point(9, 9) } });
            listeners.push(maps.Event.addListener(marker, 'click', () => {
                const content = document.createElement('div');
                content.style.cssText = 'padding:12px 16px;max-width:260px;font-size:12px;line-height:1.6;color:#4b5563';
                const title = document.createElement('strong'); title.textContent = school.name;
                const status = document.createElement('p'); status.textContent = `미등록 · ${school.type}`;
                const address = document.createElement('p'); address.textContent = school.address;
                content.append(title, status, address);
                info.setContent(content); info.open(map, marker);
            }));
            return marker;
        });
        return () => { listeners.forEach(listener => maps.Event.removeListener(listener)); dots.forEach(dot => dot.setMap(null)); info.close(); };
    }, [maps, nearby, showPublicSchools]);

    useEffect(() => {
        const fail = () => setError('지도 인증에 실패했습니다. Client ID와 Web 서비스 URL 등록을 확인해 주세요.');
        window.addEventListener('school-map-auth-failure', fail);
        return () => window.removeEventListener('school-map-auth-failure', fail);
    }, []);

    useEffect(() => {
        if (!key) return;
        let active = true;
        setError('');
        loadNaverMaps(key).then(api => {
            if (!active) return;
            mapRef.current = new api.Map(canvas.current, {
                center: new api.LatLng(36.4, 127.8), zoom: 7,
                zoomControl: true, zoomControlOptions: { position: api.Position.TOP_RIGHT },
            });
            viewInitialized.current = false;
            setMaps(api);
        }).catch(e => { if (active) setError(e.message); });
        return () => {
            active = false;
            mapRef.current?.destroy();
            mapRef.current = null;
        };
    }, [attempt]);

    useEffect(() => {
        if (!maps || !mapRef.current) return;
        const map = mapRef.current;
        const observer = new ResizeObserver(() => {
            const center = map.getCenter(), zoom = map.getZoom();
            map.autoResize();
            map.setCenter(center); map.setZoom(zoom);
        });
        observer.observe(canvas.current);
        return () => observer.disconnect();
    }, [maps]);

    useEffect(() => {
        if (!maps || !mapRef.current) return;
        const map = mapRef.current;
        const bounds = new maps.LatLngBounds();
        const listeners = [];
        const points = located.map(group => {
            const { lat, lng } = schoolCoordinates(group.metadata);
            const position = new maps.LatLng(lat, lng);
            bounds.extend(position);
            const region = group.metadata?.region?.trim();
            const pin = centerPins[region] || centerPins['미지정'];
            const connected = isTeamConnected(group);
            const marker = new maps.Marker({ map: density ? null : map, position, zIndex: 10, title: `${group.name} · ${pin.label} · ${connected ? '연결' : '미연결'} · 청소년 ${schoolStudentCount(group)}명`, icon: centerPin(region, maps, connected) });
            listeners.push(maps.Event.addListener(marker, 'click', () => detailCallback.current(group)));
            markers.current.set(group.metadata.id, marker);
            return position;
        });
        const heatData = mapMode === 'schools' ? points : heatPoints.map(point => new maps.visualization.WeightedLocation(point.lat, point.lng, point.students));
        const heatmap = density && heatData.length ? new maps.visualization.HeatMap({
            map, data: heatData, radius: 28, opacity: 0.7,
        }) : null;
        if (!viewInitialized.current && points.length) {
            if (points.length === 1) { map.setCenter(points[0]); map.setZoom(15); }
            else map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
            viewInitialized.current = true;
        }
        return () => {
            listeners.forEach(listener => maps.Event.removeListener(listener));
            markers.current.forEach(marker => marker.setMap(null));
            markers.current.clear();
            heatmap?.setMap(null);
        };
    }, [maps, located, heatPoints, density, mapMode]);

    const fitSchools = () => {
        if (!maps || !mapRef.current || !located.length) return;
        const bounds = new maps.LatLngBounds();
        located.forEach(group => { const point = schoolCoordinates(group.metadata); bounds.extend(new maps.LatLng(point.lat, point.lng)); });
        if (located.length === 1) { const point = schoolCoordinates(located[0].metadata); mapRef.current.setCenter(new maps.LatLng(point.lat, point.lng)); mapRef.current.setZoom(15); }
        else mapRef.current.fitBounds(bounds, { top: 48, right: 32, bottom: 48, left: 32 });
    };

    const startEditing = group => {
        setEditing(group); setQuery(group.metadata?.map_address || '');
        setResults([]); setLocationError('');
    };
    const search = async event => {
        event.preventDefault();
        setBusy(true); setLocationError(''); setResults([]);
        try {
            const addresses = await searchMapAddress(maps, query.trim());
            setResults(addresses);
            if (!addresses.length) setLocationError('검색 결과가 없습니다. 학교 이름 대신 정확한 도로명주소를 입력해 주세요.');
        } catch (e) { setLocationError(e.message); }
        finally { setBusy(false); }
    };
    const save = async address => {
        setBusy(true); setLocationError('');
        try {
            const location = { map_address: address.roadAddress || address.jibunAddress, map_latitude: Number(address.y), map_longitude: Number(address.x) };
            if (!schoolCoordinates(location)) throw new Error('검색 결과의 좌표가 올바르지 않습니다. 다른 주소를 검색해 주세요.');
            const { data, error: saveError } = await supabase.from('schools').update(location).eq('id', editing.metadata.id).select('id').single();
            if (saveError || !data) throw new Error('위치를 저장하지 못했습니다. 권한과 지도 데이터 설정을 확인해 주세요.');
            setEditing(null);
            await onRefresh();
        } catch (e) { setLocationError(e.message); }
        finally { setBusy(false); }
    };

    return <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden" aria-label="학교 분포 지도">
        <div className="p-4 md:px-5 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h2 className="font-bold text-gray-900">학교 분포</h2>
                <p className="text-sm text-gray-500 mt-1" aria-live="polite">학교 <span className="font-semibold text-gray-800 tabular-nums">{visibleGroups.length}</span>개교<span className="mx-2 text-gray-300">/</span>청소년 <span className="font-semibold text-gray-800 tabular-nums">{studentTotal}</span>명</p>
            </div>
            <div className="flex gap-1 rounded-xl bg-[#f2f4f6] p-1" aria-label="지도 표시 방식">
                {[['pins','학교 핀'],['schools','학교 히트맵'],['students','학생 히트맵']].map(([value,label]) => <button key={value} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-blue-600 ${mapMode === value ? 'bg-white text-[#3182f6] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`} aria-pressed={mapMode === value} onClick={() => setMapMode(value)}>{label}</button>)}
            </div>
        </div>
        <div className="px-4 md:px-5 pb-4 border-b border-gray-100 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2" aria-label="관리 센터 필터">
                    {Object.entries(centerPins).map(([region,pin]) => <button key={region} aria-pressed={enabledCenters.includes(region)} disabled={busy}
                        onClick={() => { setEnabledCenters(current => current.includes(region) ? current.filter(value => value !== region) : [...current,region]); setEditing(null); }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-blue-600 disabled:opacity-50 ${enabledCenters.includes(region) ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <span className="h-2 w-2 rounded-full" style={{backgroundColor:enabledCenters.includes(region)?pin.color:'#d1d5db'}} aria-hidden="true"/>{pin.label}
                    </button>)}
                </div>
                <button className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-50" disabled={busy} onClick={() => { setEnabledCenters(['강동','강서','미지정']); setConnectionFilter('ALL'); setShowPublicSchools(false); setPublicTypes(['중학교','고등학교']); setEditing(null); }}>필터 초기화</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2" aria-label="학교 연결 필터">
                {[['ALL', '전체', centerGroups.length], ['CONNECTED', '연결', connectedCount], ['UNCONNECTED', '미연결', centerGroups.length - connectedCount]].map(([value, label, count]) => (
                    <button key={value} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-blue-600 disabled:opacity-50 ${connectionFilter === value ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`} aria-pressed={connectionFilter === value} disabled={busy}
                        onClick={() => { setConnectionFilter(value); setEditing(null); setResults([]); setLocationError(''); }}>{label} {count}개교</button>
                ))}
            </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-gray-700"><input type="checkbox" checked={showPublicSchools} onChange={event => setShowPublicSchools(event.target.checked)} className="h-4 w-4 rounded accent-blue-600"/>미등록 학교 표시</label>
                {showPublicSchools && <>
                    <div className="flex gap-3" aria-label="미등록 학교급 필터">{['초등학교','중학교','고등학교'].map(type => <label key={type} className="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={publicTypes.includes(type)} onChange={() => setPublicTypes(current => current.includes(type) ? current.filter(value => value !== type) : [...current,type])} className="h-3.5 w-3.5 accent-blue-600"/>{type.replace('학교','')}</label>)}</div>
                    <span>회색 원 · 현재 지도 안{publicData && viewport?.zoom >= 10 && nearby.length <= 300 ? ` ${nearby.length}개교` : ''}</span>
                </>}
            </div>
            {showPublicSchools && <div className="text-xs text-gray-500" role="status">
                {publicError ? <><span className="text-red-700">{publicError}</span><button className="ml-2 text-blue-600 underline" onClick={() => setPublicAttempt(value => value + 1)}>다시 시도</button></>
                    : !publicData ? '주변 학교 자료를 불러오는 중입니다.'
                    : !publicTypes.length ? '표시할 학교급을 선택해 주세요.'
                    : !viewport || viewport.zoom < 10 || nearby.length > 300 ? '지도를 확대하면 주변 미등록 학교를 표시합니다.'
                    : '원을 누르면 학교명과 주소를 확인할 수 있습니다. 미등록 학교에는 관리 센터가 배정되지 않습니다.'}
            </div>}
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative min-w-0 bg-gray-50">
                <div ref={canvas} className="h-[380px] md:h-[480px] lg:h-[600px] w-full" aria-label="네이버 학교 지도" />
                {maps && !error && <button className="absolute left-3 top-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-blue-600" disabled={!located.length} onClick={fitSchools}>전체 학교 보기</button>}
                {(!key || error || !maps) && <div className="absolute inset-0 flex items-center justify-center p-6 bg-gray-50">
                    <div className="max-w-md space-y-3 text-sm text-gray-600">
                        <MapPin size={30} className="text-blue-500" aria-hidden="true" />
                        <h3 className="text-lg font-bold text-gray-900">{!key ? '네이버 지도 연결이 필요합니다' : error ? '지도를 열지 못했습니다' : '지도를 불러오는 중입니다'}</h3>
                        {!key ? <>
                            <p>네이버 클라우드에서 Web Dynamic Map과 Geocoding을 선택하고, Web 서비스 URL에 이 웹앱의 주소를 등록해 주세요.</p>
                            <p>발급받은 Client ID를 .env.local의 <code className="break-all">VITE_NAVER_MAPS_CLIENT_ID</code>에 입력한 뒤 개발 서버를 다시 시작하면 지도가 열립니다.</p>
                            <a href="https://console.ncloud.com/" target="_blank" rel="noreferrer" className="text-blue-700 underline inline-flex items-center gap-1">네이버 클라우드 콘솔 열기 <ExternalLink size={14} /></a>
                        </> : error ? <><p role="alert">{error}</p><button className={control} onClick={() => { setMaps(null); setAttempt(a => a + 1); }}><RefreshCw size={14} className="inline mr-1" />다시 시도</button></> : <p role="status">잠시만 기다려 주세요.</p>}
                    </div>
                </div>}
                {maps && !error && !located.length && !showPublicSchools && <p className="absolute bottom-5 left-4 right-4 p-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-700" role="status">{visibleGroups.length ? '아직 연결된 위치가 없습니다. 학교 목록에서 주소를 연결해 주세요.' : '현재 조건에 맞는 학교가 없습니다.'}</p>}
                {maps && !error && mapMode === 'students' && located.length > 0 && !mappedStudents && <p className="absolute bottom-5 left-4 right-4 p-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-700" role="status">위치가 연결된 학교에 집계할 청소년이 없습니다. 졸업생은 히트맵에서 제외됩니다.</p>}
            </div>
            <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 min-w-0 flex flex-col lg:h-[600px]" aria-label="지도 학교 목록">
                {editing ? <div className="space-y-3 p-4 overflow-y-auto">
                    <h3 className="font-bold break-words">{editing.name} 위치 연결</h3>
                    <p className="text-xs text-gray-600">정확한 주소를 검색한 뒤 확인해 저장하세요. 저장한 위치는 모든 담당자에게 공유됩니다.</p>
                    <form onSubmit={search} className="space-y-2">
                        <label htmlFor="school-map-address" className="text-sm font-semibold">학교 도로명주소</label>
                        <input id="school-map-address" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus-visible:outline-blue-600" value={query} onChange={e => { setQuery(e.target.value); setResults([]); }} placeholder="예: 서울특별시 …로 123" disabled={busy} />
                        <button className={control} disabled={busy || !query.trim() || !maps}>{busy ? '처리 중…' : '주소 검색'}</button>
                    </form>
                    {locationError && <p role="alert" className="text-sm text-red-700">{locationError}</p>}
                    <ul className="space-y-3 max-h-64 overflow-y-auto">{results.map(address => <li key={`${address.x},${address.y}`} className="text-sm space-y-2 border-b pb-3">
                        <p>{address.roadAddress || address.jibunAddress}</p>
                        <button className={control} disabled={busy} onClick={() => save(address)}>이 주소로 저장</button>
                    </li>)}</ul>
                    <button className={control} disabled={busy} onClick={() => setEditing(null)}>목록으로</button>
                </div> : <>
                    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-800">학교 목록</h3><span className="text-xs tabular-nums text-gray-400">{visibleGroups.length}개교</span></div>
                    {!visibleGroups.length && <p className="py-8 text-sm text-gray-500">조건에 맞는 학교가 없습니다.</p>}
                    <ul className="min-h-0 max-h-[440px] lg:max-h-none lg:flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100">
                        {visibleGroups.map(group => { const point = schoolCoordinates(group.metadata); const center = centerPins[group.metadata?.region?.trim()] || centerPins['미지정']; const address = group.metadata?.map_address || ''; const shortAddress = address.endsWith(group.name.trim()) ? address.slice(0, -group.name.trim().length).trim() : address; return <li key={group.metadata?.id || group.name} className="px-4 py-4 space-y-2.5 hover:bg-gray-50/70 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                                <button className="text-left font-bold text-sm leading-5 text-gray-800 hover:text-blue-700 focus-visible:outline-blue-600" onClick={() => { if (point && mapRef.current) { mapRef.current.setCenter(new maps.LatLng(point.lat, point.lng)); mapRef.current.setZoom(16); } else onOpenDetail(group); }}>{group.name}</button>
                                <span className="shrink-0 text-xs text-gray-500 tabular-nums"><span className="font-bold text-gray-800">{schoolStudentCount(group)}</span>명</span>
                            </div>
                            <p className="text-xs leading-5 text-gray-500">{point ? shortAddress || '위치 연결됨' : '위치 미연결'}</p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px]">
                                <span className="inline-flex items-center gap-1 text-gray-500"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: center.color }} aria-hidden="true" />{center.label}</span>
                                <span className={isTeamConnected(group) ? 'font-semibold text-green-700' : 'text-gray-400'}>{isTeamConnected(group) ? '연결' : '미연결'}</span>
                                <div className="ml-auto flex items-center gap-2.5">
                                <button className="text-blue-600 hover:underline focus-visible:outline-blue-600" onClick={() => onOpenDetail(group)}>학교 상세</button>
                                <button className="text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-40 focus-visible:outline-blue-600" disabled={!maps || !!error || !group.metadata?.id} onClick={() => startEditing(group)}>{point ? '주소 수정' : '위치 연결'}</button>
                                </div>
                            </div>
                        </li>; })}
                    </ul>
                </>}
            </aside>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 px-4 md:px-5 py-3 text-xs text-gray-500">
            <p>위치 연결 {located.length}개교{mapMode === 'students' ? ` / 청소년 ${mappedStudents}명 반영` : mapMode === 'schools' ? ' / 학교당 1곳 기준' : ' / 채운 핀은 연결 학교'}{visibleGroups.length > located.length ? ` / 위치 미연결 ${visibleGroups.length - located.length}개교` : ''}</p>
            <details className="group max-w-full">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-800 focus-visible:outline-blue-600">집계 기준</summary>
                <p className="max-w-xl mt-2 leading-5">학교 히트맵은 등록 학교당 1곳, 학생 히트맵은 졸업생을 제외한 청소년 회원 수를 기준으로 합니다. 위치가 없는 {studentTotal - mappedStudents}명은 학생 히트맵에서 제외됩니다. 가까운 학교의 영향은 합쳐져 보입니다. 담당자가 지정된 학교는 연결로 표시합니다. 미등록 학교는 회색 원으로만 표시하며 두 히트맵에서 제외합니다.</p>
                {showPublicSchools && publicData && <p className="mt-2 text-xs"><a href={publicData.source} target="_blank" rel="noreferrer" className="underline">공공데이터포털 전국초중등학교위치표준데이터</a> · {publicData.referenceDate} 기준</p>}
            </details>
        </div>
    </section>;
}
