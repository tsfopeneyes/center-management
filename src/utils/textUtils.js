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
