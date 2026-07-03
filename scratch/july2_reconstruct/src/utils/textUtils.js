export const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

export const extractUrls = (text) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return text.match(urlRegex) || [];
};

export const extractProgramInfo = (content) => {
    const info = { date: '', duration: '', location: '', cleanContent: content };
    if (!content) return info;

    // Matches the info block div and its contents
    const infoBlockRegex = /<div style="background-color: #f8fafc;[\s\S]*?<\/div>/;
    const match = content.match(infoBlockRegex);

    if (match) {
        const block = match[0];
        info.cleanContent = content.replace(infoBlockRegex, '').trim();

        // Extract Date (tries to parse the locale string back to ISO-ish)
        const dateMatch = block.match(/📅 일정:<\/strong>\s*([^<]+)/);
        if (dateMatch) {
            const dateStr = dateMatch[1].trim();
            if (dateStr !== '미정') {
                const parts = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
                if (parts) {
                    let [_, year, month, day, ampm, hour, minute] = parts;
                    hour = parseInt(hour);
                    if (ampm === '오후' && hour < 12) hour += 12;
                    if (ampm === '오전' && hour === 12) hour = 0;
                    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    const isoTime = `${hour.toString().padStart(2, '0')}:${minute}`;
                    info.date = `${isoDate}T${isoTime}`;
                }
            }
        }

        // Extract Duration
        const durationMatch = block.match(/⏰ 소요시간:<\/strong>\s*([^<]+)/);
        if (durationMatch) info.duration = durationMatch[1].trim() === '미정' ? '' : durationMatch[1].trim();

        // Extract Location
        const locationMatch = block.match(/📍 장소:<\/strong>\s*([^<]+)/);
        if (locationMatch) info.location = locationMatch[1].trim() === '미정' ? '' : locationMatch[1].trim();
    }

    return info;
};
