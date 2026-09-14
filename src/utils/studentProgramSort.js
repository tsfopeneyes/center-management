const DAY_MS = 24 * 60 * 60 * 1000;

const toDayTimestamp = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date.getTime();
};

const distanceFromToday = (program, todayTimestamp) => {
    const single = toDayTimestamp(program.program_date);
    const start = toDayTimestamp(program.program_start_date) ?? single;
    const end = toDayTimestamp(program.program_end_date) ?? single ?? start;

    if (start === null && end === null) return Number.POSITIVE_INFINITY;
    if (todayTimestamp < start) return Math.round((start - todayTimestamp) / DAY_MS);
    if (todayTimestamp > end) return Math.round((todayTimestamp - end) / DAY_MS);
    return 0;
};

export const sortStudentPrograms = (programs, today = new Date()) => {
    const todayTimestamp = toDayTimestamp(today);

    return [...(programs || [])].sort((a, b) => {
        if (Boolean(a.is_sticky) !== Boolean(b.is_sticky)) return a.is_sticky ? -1 : 1;

        const distanceDifference = distanceFromToday(a, todayTimestamp) - distanceFromToday(b, todayTimestamp);
        if (distanceDifference !== 0) return distanceDifference;

        const dateA = toDayTimestamp(a.program_start_date || a.program_date || a.program_end_date);
        const dateB = toDayTimestamp(b.program_start_date || b.program_date || b.program_end_date);
        if (dateA !== dateB) return (dateA ?? Number.POSITIVE_INFINITY) - (dateB ?? Number.POSITIVE_INFINITY);

        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
};
