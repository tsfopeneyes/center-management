import { useState } from 'react';
import { analyticsUtils } from '../../../../utils/analyticsUtils';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

export const useAdminReport = (allLogs, users, locations) => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedDay, setSelectedDay] = useState(new Date().getDate());
    const [periodType, setPeriodType] = useState('MONTHLY'); // 'MONTHLY', 'YEARLY', 'WEEKLY', 'DAILY'
    const [targetGroup, setTargetGroup] = useState('YOUTH'); // 'ALL', 'YOUTH'

    const [selectedGuestSpace, setSelectedGuestSpace] = useState(null);

    const generateReport = async () => {
        setLoading(true);
        try {
            const currentDate = new Date(selectedYear, selectedMonth, selectedDay);
            let start, end;

            if (periodType === 'DAILY') {
                start = startOfDay(currentDate);
                end = endOfDay(currentDate);
            } else if (periodType === 'WEEKLY') {
                start = startOfWeek(currentDate, { weekStartsOn: 1 });
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else if (periodType === 'MONTHLY') {
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
            } else {
                start = new Date(selectedYear, 0, 1);
                end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
            }

            const result = analyticsUtils.processOperationReport(allLogs, users, locations, start, end, targetGroup);
            setReport(result);
        } catch (err) {
            console.error(err);
            alert('리포트 생성 실패');
        } finally {
            setLoading(false);
        }
    };

    return {
        loading, report,
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        selectedDay, setSelectedDay,
        periodType, setPeriodType,
        targetGroup, setTargetGroup,
        selectedGuestSpace, setSelectedGuestSpace,
        generateReport
    };
};
