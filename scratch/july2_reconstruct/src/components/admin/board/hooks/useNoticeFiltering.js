import { useState, useMemo } from 'react';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { PROGRAM_TYPES } from '../utils/constants';

const useNoticeFiltering = (notices, categoryMode) => {
    const [filters, setFilters] = useState({
        title: '',
        location: '',
        startDate: '',
        endDate: '',
        programType: PROGRAM_TYPES.ALL
    });

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters({
            title: '',
            location: '',
            startDate: '',
            endDate: '',
            programType: PROGRAM_TYPES.ALL
        });
    };

    const filteredNotices = useMemo(() => {
        return notices.filter(n => {
            // 1. Category Filter
            if (n.category !== categoryMode) return false;

            // 2. Title / Location (Content) Filter
            if (filters.title) {
                const term = filters.title.toLowerCase();
                const matchesTitle = n.title.toLowerCase().includes(term);
                const matchesContentLocation = categoryMode === 'PROGRAM' ? (n.content && n.content.toLowerCase().includes(term)) : false;
                if (!matchesTitle && !matchesContentLocation) return false;
            }

            // 4. Date Range Filter
            if (filters.startDate || filters.endDate) {
                const targetDate = categoryMode === 'PROGRAM' && n.program_date
                    ? parseISO(n.program_date)
                    : parseISO(n.created_at);

                const start = filters.startDate ? startOfDay(parseISO(filters.startDate)) : new Date(0);
                const end = filters.endDate ? endOfDay(parseISO(filters.endDate)) : new Date(8640000000000000);

                if (!isWithinInterval(targetDate, { start, end })) return false;
            }

            // 5. Program Type Filter
            if (categoryMode === 'PROGRAM' && filters.programType !== PROGRAM_TYPES.ALL) {
                const type = n.program_type || PROGRAM_TYPES.CENTER;
                if (type !== filters.programType) return false;
            }

            return true;
        });
    }, [notices, categoryMode, filters]);

    const activePrograms = useMemo(() => 
        categoryMode === 'PROGRAM' 
            ? filteredNotices.filter(n => n.program_status === 'ACTIVE' || !n.program_status) 
            : filteredNotices,
    [filteredNotices, categoryMode]);

    const completedPrograms = useMemo(() => 
        categoryMode === 'PROGRAM' 
            ? filteredNotices.filter(n => n.program_status === 'COMPLETED' || n.program_status === 'CANCELLED') 
            : [],
    [filteredNotices, categoryMode]);

    return {
        filters,
        updateFilter,
        resetFilters,
        filteredNotices,
        activePrograms,
        completedPrograms
    };
};

export default useNoticeFiltering;
