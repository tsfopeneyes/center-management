export const formatToLocalISO = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().substring(0, 16);
};

export const getWeekIdentifier = (date) => {
    const d = new Date(date);
    const year = String(d.getFullYear()).slice(2);
    const month = String(d.getMonth() + 1).padStart(2, '0');

    // Calculate week of month (1st week is 1-7, 2nd 8-14, etc - or more standard: 1st full week?)
    // User example 2025-11-03 is 2511_W1. Nov 3rd 2025 is Monday.
    // Let's use a simple week of month based on groups of 7 days starting from 1st
    const dayOfMonth = d.getDate();
    const weekNum = Math.ceil(dayOfMonth / 7);

    return `${year}${month}_W${weekNum}`;
};
