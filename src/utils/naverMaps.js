let pending;

export function loadNaverMaps(key) {
    if (window.naver?.maps?.Service && window.naver?.maps?.visualization) return Promise.resolve(window.naver.maps);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
        let finished = false;
        const script = document.createElement('script');
        const previousFailure = window.navermap_authFailure;
        const finish = (error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (error) window.navermap_authFailure = previousFailure;
            delete window.__schoolMapReady;
            if (error) { script.remove(); pending = undefined; reject(error); }
            else resolve(window.naver.maps);
        };
        const timer = setTimeout(() => finish(new Error('지도 연결 시간이 초과되었습니다. 네트워크와 API 설정을 확인해 주세요.')), 20000);
        window.navermap_authFailure = () => {
            window.dispatchEvent(new Event('school-map-auth-failure'));
            finish(new Error('지도 인증에 실패했습니다. Client ID와 Web 서비스 URL 등록을 확인해 주세요.'));
        };
        window.__schoolMapReady = () => finish();
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder,visualization&callback=__schoolMapReady`;
        script.async = true;
        script.onerror = () => finish(new Error('지도를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'));
        document.head.appendChild(script);
    });
    return pending;
}

export function schoolCoordinates(metadata) {
    if (metadata?.map_latitude == null || metadata?.map_longitude == null) return null;
    const lat = Number(metadata.map_latitude), lng = Number(metadata.map_longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        ? { lat, lng } : null;
}

export function searchMapAddress(maps, query) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('주소 검색 시간이 초과되었습니다. 다시 검색해 주세요.')), 15000);
        maps.Service.geocode({ query }, (status, response) => {
            clearTimeout(timer);
            if (status !== maps.Service.Status.OK) return reject(new Error('주소 검색에 실패했습니다. Geocoding API 이용 설정을 확인해 주세요.'));
            resolve(response?.v2?.addresses || []);
        });
    });
}
