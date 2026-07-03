export const getFaviconUrl = (url, size = 64) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`;
    } catch (e) {
        return null;
    }
};

export const getDomainName = (url) => {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch (e) {
        return url;
    }
};

export const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
};

export const extractUrls = (content) => {
    if (!content) return [];

    // If we're in a browser and it might be HTML, use DOMParser for better accuracy
    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined' && (content.includes('<') || content.includes('>'))) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            const urls = new Set();

            // 1. Get hrefs from anchor tags
            doc.querySelectorAll('a').forEach(a => {
                if (a.href && (a.href.startsWith('http') || a.href.startsWith('https'))) {
                    urls.add(a.href);
                }
            });

            // 2. Get plain text URLs from text content
            const textContent = doc.body.textContent || "";
            const urlRegex = /(https?:\/\/[^\s<"']+)/g;
            const matches = textContent.match(urlRegex);
            if (matches) matches.forEach(url => urls.add(url));

            return [...urls];
        } catch (e) {
            // Fallback to regex
        }
    }

    // Default regex approach for plain text or fallback
    const urlRegex = /(https?:\/\/[^\s<"']+)/g;
    const matches = content.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
};
