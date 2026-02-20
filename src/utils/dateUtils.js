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

export const calculateAge = (birthDate) => {
    if (!birthDate || birthDate.length !== 6) return '';

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // YYMMDD parsing
    const yy = parseInt(birthDate.substring(0, 2), 10);
    const mm = parseInt(birthDate.substring(2, 4), 10);
    const dd = parseInt(birthDate.substring(4, 6), 10);

    // Dynamic century: if year is 00-30, assume 20xx (2000-2030). Else 19xx.
    // Adjust threshold as needed. 30 seems safe for now.
    const year = (yy <= 30) ? 2000 + yy : 1900 + yy;

    let age = currentYear - year;

    // Year Age (연나이) calculation: simply current year - birth year
    // No month/day adjustment needed as requested by user for grade grouping.

    return age;
};

export const parseTimeRange = (timeRangeStr) => {
    if (!timeRangeStr) return { start: '', end: '', durationStr: '', durationMin: 0 };

    // Format: "HH:mm ~ HH:mm"
    const parts = timeRangeStr.split('~').map(s => s.trim());
    if (parts.length !== 2) return { start: timeRangeStr, end: '', durationStr: '', durationMin: 0 };

    const start = parts[0];
    const end = parts[1];

    const startTime = new Date(`2000-01-01T${start}:00`);
    const endTime = new Date(`2000-01-01T${end}:00`);

    let diffMs = endTime - startTime;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Handle overnight

    const diffMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    const durationStr = `${hours}:${String(mins).padStart(2, '0')}:00`; // As per excel screenshot "2:00:00"

    return { start, end, durationStr, durationMin: diffMin };
};
