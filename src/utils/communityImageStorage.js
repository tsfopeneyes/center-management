export function communityImagePath(url, profileId, challengeId, supabaseUrl) {
    try {
        const image = new URL(url);
        const base = new URL(supabaseUrl);
        const prefix = '/storage/v1/object/public/notice-images/';
        if (image.origin !== base.origin || !image.pathname.startsWith(prefix)
            || image.search || image.hash) return null;
        const segments = image.pathname.slice(prefix.length).split('/').map(decodeURIComponent);
        if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('/'))) return null;
        const mission = segments.length === 3 && segments[0] === 'mission' && segments[1] === profileId;
        const legacy = segments.length === 4 && segments[0] === 'challenge-community'
            && segments[1] === String(challengeId) && segments[2] === profileId;
        return mission || legacy ? segments.join('/') : null;
    } catch {
        return null;
    }
}
