import { schoolCoordinates } from './naverMaps.js';

// Match the school's youth membership definition; graduates are a separate group.
export const schoolStudentCount = group => (group.students || []).filter(user => user.user_group === '청소년').length;

export function schoolStudentHeatPoints(groups) {
    const points = new Map();
    groups.forEach(group => {
        const coordinates = schoolCoordinates(group.metadata);
        const students = schoolStudentCount(group);
        if (!coordinates || !students) return;
        const key = `${coordinates.lat},${coordinates.lng}`;
        const point = points.get(key) || { ...coordinates, students: 0 };
        point.students += students;
        points.set(key, point);
    });
    return [...points.values()];
}
