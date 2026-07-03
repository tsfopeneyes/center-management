import { useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

export const useDashboardCalendar = () => {
    const [adminSchedules, setAdminSchedules] = useState([]);
    const [calendarCategories, setCalendarCategories] = useState([]);

    const fetchSchedules = useCallback(async () => {
        try {
            const [catRes, schRes] = await Promise.all([
                supabase.from('calendar_categories').select('*'),
                supabase.from('admin_schedules').select('*')
            ]);
            if (catRes.data) setCalendarCategories(catRes.data);
            if (schRes.data) setAdminSchedules(schRes.data);
        } catch (err) {
            console.error('Error fetching schedules:', err);
        }
    }, []);

    return {
        adminSchedules,
        calendarCategories,
        fetchSchedules
    };
};
