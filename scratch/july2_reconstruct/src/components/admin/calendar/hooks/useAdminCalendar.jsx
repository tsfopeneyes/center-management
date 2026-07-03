import React, { useState, useEffect, useMemo } from 'react';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
    isSameDay, isToday, parseISO, addDays, getDay,
    startOfDay, endOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
    Clock, MapPin, Users, Check, Filter, MoreVertical,
    Trash2, Edit2, X, ChevronDown, CheckCircle2, Settings, Palette
} from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import { CATEGORIES } from '../../../../constants/appConstants';
import { motion, AnimatePresence } from 'framer-motion';
import { COLOR_THEMES } from '../calendarConstants';
export const useAdminCalendar = ({ notices, fetchData }) => {
    // State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [adminSchedules, setAdminSchedules] = useState([]);
    const [dynamicCategories, setDynamicCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [visibleCategories, setVisibleCategories] = useState({});

    // Category Management State
    const [editCategory, setEditCategory] = useState(null);
    const [categoryForm, setCategoryForm] = useState({ name: '', color_theme: 'blue' });

    // Mobile Specific State
    const [showDayDetail, setShowDayDetail] = useState(false);

    // Form State for Event
    const [formData, setFormData] = useState({
        type: 'SCHEDULE', // 'SCHEDULE' or 'PROGRAM'
        title: '',
        content: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '12:00',
        end_date: format(new Date(), 'yyyy-MM-dd'),
        end_time: '13:00',
        category_id: '',
        program_location: '',
        max_capacity: 0,
        program_type: 'CENTER',
        closed_spaces: [], // ['HYPHEN', 'ENOF']
        isRecurring: false,
        recurringDays: [], // [0, 1, 2, 3, 4, 5, 6] (Sun-Sat)
        recurringEndDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd')
    });

    // Fetch Admin Schedules & Categories
    const fetchAllData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Categories
            const { data: catData, error: catError } = await supabase
                .from('calendar_categories')
                .select('*')
                .order('name', { ascending: true });

            if (catError) throw catError;
            setDynamicCategories(catData || []);

            // 2. Fetch Schedules
            const { data: schData, error: schError } = await supabase
                .from('admin_schedules')
                .select('*')
                .order('start_date', { ascending: true });

            if (schError) throw schError;
            setAdminSchedules(schData || []);

            // Synchronize visible categories
            setVisibleCategories(prev => {
                const next = { ...prev };
                // Ensure all categories have a value, default to true for new ones
                (catData || []).forEach(cat => {
                    if (next[cat.id] === undefined) next[cat.id] = true;
                });
                if (next['PROGRAM_CENTER'] === undefined) next['PROGRAM_CENTER'] = true;
                if (next['PROGRAM_SCHOOL'] === undefined) next['PROGRAM_SCHOOL'] = true;
                return next;
            });

        } catch (err) {
            console.error('Error fetching calendar data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Combine Notices (Programs) and Admin Schedules
    const allEvents = useMemo(() => {
        const programEvents = notices
            .filter(n => n.category === CATEGORIES.PROGRAM && n.program_date)
            .map(n => {
                const type = n.program_type || 'CENTER';
                return {
                    id: `PRG-${n.id}`,
                    originalId: n.id,
                    title: n.title,
                    content: n.content,
                    start: startOfDay(parseISO(n.program_date)),
                    end: endOfDay(parseISO(n.program_date)),
                    category: type === 'CENTER' ? 'PROGRAM_CENTER' : 'PROGRAM_SCHOOL',
                    isPublic: true,
                    raw: n
                };
            });

        const generalEvents = adminSchedules.map(s => {
            const cat = dynamicCategories.find(c => c.id === s.category_id);
            let closed_spaces = [];
            let displayContent = s.content;

            let groupId = null;

            try {
                const parsed = JSON.parse(s.content);
                if (parsed && typeof parsed === 'object') {
                    // Check if it's our structured content (old or new)
                    if ('text' in parsed || 'closed_spaces' in parsed || 'groupId' in parsed) {
                        displayContent = parsed.text || '';
                        closed_spaces = parsed.closed_spaces || [];
                        groupId = parsed.groupId || null;
                    }
                }
            } catch (e) {
                // Not JSON, use as is
            }

            return {
                id: `SCH-${s.id}`,
                originalId: s.id,
                title: s.title,
                content: displayContent,
                start: startOfDay(parseISO(s.start_date)),
                end: endOfDay(parseISO(s.end_date)),
                category_id: s.category_id,
                color_theme: cat?.color_theme || 'gray',
                isPublic: false,

                raw: { ...s, closed_spaces, groupId }
            };
        });

        return [...programEvents, ...generalEvents].filter(e => {
            if (e.isPublic) return visibleCategories[e.category];
            return visibleCategories[e.category_id];
        });
    }, [notices, adminSchedules, dynamicCategories, visibleCategories]);

    // Helper to check if event spans/includes a specific day
    const isEventOnDay = (event, day) => {
        const d = startOfDay(day);
        return d >= event.start && d <= event.end;
    };

    // Calendar Calculations
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    // Handlers
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const handleDateClick = (date) => {
        setSelectedDate(date);
        if (window.innerWidth < 768) {
            setShowDayDetail(true);
        } else {
            setFormData({
                ...formData,
                start_date: format(date, 'yyyy-MM-dd'),
                end_date: format(date, 'yyyy-MM-dd'),
                type: 'SCHEDULE',
                category_id: dynamicCategories[0]?.id || '',
                isRecurring: false,
                recurringDays: [],
                recurringEndDate: format(addMonths(date, 1), 'yyyy-MM-dd')
            });
            setSelectedEvent(null);
            setShowModal(true);
        }
    };

    const handleEventClick = (e, event) => {
        e.stopPropagation();
        setSelectedEvent(event);
        if (event.isPublic) {
            setFormData({
                type: 'PROGRAM',
                title: event.title,
                content: event.content,
                start_date: format(event.start, 'yyyy-MM-dd'),
                start_time: format(event.start, 'HH:mm'),
                category_id: 'PROGRAM',
                program_location: event.raw.program_location || '',
                max_capacity: event.raw.max_capacity || 0,
                program_type: event.raw.program_type || 'CENTER',
                isRecurring: false,
                recurringDays: [],
                recurringEndDate: format(addMonths(event.start, 1), 'yyyy-MM-dd')
            });
        } else {
            setFormData({
                type: 'SCHEDULE',
                title: event.title,
                content: event.content,
                start_date: format(event.start, 'yyyy-MM-dd'),
                start_time: format(event.start, 'HH:mm'),
                end_date: format(event.end, 'yyyy-MM-dd'),
                end_time: format(event.end, 'HH:mm'),
                category_id: event.category_id,
                closed_spaces: event.raw.closed_spaces || [],
                isRecurring: false,
                recurringDays: [],
                recurringEndDate: format(addMonths(event.start, 1), 'yyyy-MM-dd')
            });
        }
        setShowModal(true);
    };

    const toggleCategory = (catId) => {
        setVisibleCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        try {
            const startStr = `${formData.start_date}T${formData.start_time}:00`;
            const endStr = formData.type === 'PROGRAM'
                ? startStr
                : `${formData.end_date}T${formData.end_time}:00`;

            if (formData.type === 'SCHEDULE') {
                const isClosedDay = dynamicCategories.find(c => c.id === formData.category_id)?.name === '휴관';
                const basePayload = {
                    title: formData.title,
                    category_id: formData.category_id,
                    created_by: (JSON.parse(localStorage.getItem('admin_user')))?.id
                };

                // Helper to generate UUID
                const generateUUID = () => {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                };

                if (formData.isRecurring && formData.recurringDays.length > 0) {

                    // Bulk Insert for Recurring Events
                    const recurringEvents = [];
                    let iterDate = parseISO(formData.start_date);
                    const endDate = parseISO(formData.recurringEndDate);
                    const groupId = generateUUID(); // Generate Group ID

                    // Calculate duration
                    const durationMs = new Date(endStr) - new Date(startStr);

                    while (iterDate <= endDate) {
                        if (formData.recurringDays.includes(getDay(iterDate))) {
                            const newStart = new Date(iterDate);
                            const [sh, sm] = formData.start_time.split(':');
                            newStart.setHours(parseInt(sh), parseInt(sm));

                            const newEnd = new Date(newStart.getTime() + durationMs);

                            recurringEvents.push({
                                ...basePayload,
                                content: JSON.stringify({
                                    text: formData.content,
                                    closed_spaces: isClosedDay ? formData.closed_spaces : [],
                                    groupId: groupId
                                }),
                                start_date: newStart.toISOString(),
                                end_date: newEnd.toISOString()
                            });
                        }
                        iterDate = addDays(iterDate, 1);
                    }

                    if (recurringEvents.length > 0) {
                        const { error } = await supabase.from('admin_schedules').insert(recurringEvents);
                        if (error) throw error;
                    }
                } else {
                    const payload = {
                        ...basePayload,
                        content: isClosedDay || (selectedEvent && selectedEvent.raw.groupId)
                            ? JSON.stringify({
                                text: formData.content,
                                closed_spaces: isClosedDay ? formData.closed_spaces : [],
                                groupId: selectedEvent?.raw?.groupId || null
                            })
                            : formData.content,
                        start_date: new Date(startStr).toISOString(),
                        end_date: new Date(endStr).toISOString(),
                    };

                    if (selectedEvent && !selectedEvent.isPublic) {
                        const { error } = await supabase
                            .from('admin_schedules')
                            .update(payload)
                            .eq('id', selectedEvent.originalId);
                        if (error) throw error;
                    } else {
                        const { error } = await supabase
                            .from('admin_schedules')
                            .insert([payload]);
                        if (error) throw error;
                    }
                }
                fetchAdminSchedules();
            } else {
                // Program logic
                const infoBlock = `
<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0;"><strong>📅 일정:</strong> ${new Date(startStr).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
    <p style="margin: 0 0 8px 0;"><strong>📍 장소:</strong> ${formData.program_location || '미정'}</p>
    <p style="margin: 0;"><strong>👥 모집 정원:</strong> ${formData.max_capacity ? formData.max_capacity + '명' : '제한 없음'}</p>
</div>
`;
                const finalContent = infoBlock + formData.content;

                const programDateStr = new Date(startStr).toISOString();
                const payload = {
                    title: formData.title,
                    content: finalContent,
                    category: CATEGORIES.PROGRAM,
                    program_date: programDateStr,
                    is_recruiting: true,
                    is_sticky: false,
                    recruitment_deadline: programDateStr,
                    max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : null,
                    program_type: formData.program_type,
                    images: selectedEvent?.raw?.images || [],
                    image_url: (selectedEvent?.raw?.images && selectedEvent?.raw?.images.length > 0) ? selectedEvent.raw.images[0] : null
                };

                if (selectedEvent && selectedEvent.isPublic) {
                    const { error } = await supabase.from('notices').update(payload).eq('id', selectedEvent.originalId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('notices').insert([payload]);
                    if (error) throw error;
                }
                fetchData();
            }

            setShowModal(false);
            await fetchAllData();
            alert('저장되었습니다.');
        } catch (err) {
            console.error(err);
            alert(`저장 중 오류가 발생했습니다: ${err.message || 'Unknown error'}`);
        }
    };

    const handleDelete = async () => {
        if (!selectedEvent) return;

        const isRecurringSeries = selectedEvent.raw?.groupId;
        let deleteMode = 'SINGLE'; // SINGLE, SERIES

        if (isRecurringSeries) {
            // Ask user for deletion mode
            // Since we can't easily show a custom modal inside this function without more state,
            // we will use a confirm dialog with specific text or a simple choice.
            // For better UX, we could add a state for "ShowDeleteOptionModal", but for now standard confirm.
            // Let's use a simple confirm for now, or since the user asked for "delete series",
            // maybe we can assume if it's recurring they might want to delete series?
            // A common pattern with native confirm is hard.
            // Let's implement a prompt: "이 일정은 반복 일정입니다.\n[확인]을 누르면 이 전체 반복 일정이 삭제됩니다.\n[취소]를 누르면 이 일정만 삭제됩니다."
            // But 'Cancel' usually means abort.
            // Better: use window.confirm("반복되는 일정입니다. 전체 반복 일정을 삭제하시겠습니까? (취소 시 현재 일정만 삭제됩니다.)")
            // Wait, standard confirm has OK/Cancel.
            // OK -> Delete All. Cancel -> Delete One ?? No, Cancel usually means Stop.

            // Alternative: Two confirms?
            // 1. "정말 삭제하시겠습니까?" -> OK
            // 2. "전체 반복 일정을 삭제하시겠습니까?" -> OK (All), Cancel (One)

            if (!confirm('정말 삭제하시겠습니까?')) return;

            if (confirm('전체 반복 일정을 모두 삭제하시겠습니까?\n\n[확인]: 전체 삭제\n[취소]: 현재 일정만 삭제')) {
                deleteMode = 'SERIES';
            }
        } else {
            if (!confirm('정말 삭제하시겠습니까?')) return;
        }

        try {
            if (selectedEvent.isPublic) {
                const { error } = await supabase.from('notices').delete().eq('id', selectedEvent.originalId);
                if (error) throw error;
                fetchData();
            } else {
                if (deleteMode === 'SERIES' && selectedEvent.raw.groupId) {
                    // Delete all events with this groupId
                    // Note: This relies on filtering by content->>'groupId'.
                    // As content is text, we might need a different approach if database level filtering is hard.
                    // But simpler approach: Fetch all with same category? No.
                    // We must filter by parsing content? That's slow in JS.
                    // Filter in DB: content like '%groupId%'
                    const { error } = await supabase
                        .from('admin_schedules')
                        .delete()
                        .ilike('content', `%${selectedEvent.raw.groupId}%`);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('admin_schedules').delete().eq('id', selectedEvent.originalId);
                    if (error) throw error;
                }
            }
            setShowModal(false);
            await fetchAllData();
            alert('삭제되었습니다.');
        } catch (err) {
            console.error(err);
            alert(`삭제 실패: ${err.message}`);
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (editCategory) {
                response = await supabase.from('calendar_categories').update(categoryForm).eq('id', editCategory.id).select();
            } else {
                response = await supabase.from('calendar_categories').insert([categoryForm]).select();
            }

            if (response.error) throw response.error;

            if (!response.data || response.data.length === 0) {
                alert('변경사항이 저장되지 않았습니다. (DB 정책에 의해 차단되었을 수 있습니다.)');
            } else {
                setEditCategory(null);
                setCategoryForm({ name: '', color_theme: 'blue' });
                await fetchAllData();
                alert('카테고리가 저장되었습니다.');
            }
        } catch (err) {
            console.error(err);
            alert(`카테고리 저장 실패: ${err.message || 'Unknown error'}`);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('이 카테고리를 삭제하시겠습니까? 연결된 일정이 있을 경우 삭제되지 않을 수 있습니다.')) return;
        try {
            const { data, error } = await supabase.from('calendar_categories').delete().eq('id', id).select();
            if (error) throw error;

            if (!data || data.length === 0) {
                alert('삭제되지 않았습니다. (권한이 없거나 이미 삭제된 항목일 수 있습니다.)');
            } else {
                await fetchAllData();
                alert('삭제되었습니다.');
            }
        } catch (err) {
            console.error(err);
            alert(`삭제 실패: ${err.message || '연결된 일정이 있는지 확인해주세요.'}`);
        }
    };

    const fetchAdminSchedules = async () => {
        // Reuse fetchAllData for simplicity
        fetchAllData();
    };
    return {
        currentDate, setCurrentDate,
        adminSchedules, setAdminSchedules,
        dynamicCategories, setDynamicCategories,
        loading, setLoading,
        showModal, setShowModal,
        showCategoryModal, setShowCategoryModal,
        selectedEvent, setSelectedEvent,
        selectedDate, setSelectedDate,
        visibleCategories, setVisibleCategories,
        editCategory, setEditCategory,
        categoryForm, setCategoryForm,
        showDayDetail, setShowDayDetail,
        formData, setFormData,
        fetchAllData, fetchAdminSchedules,
        allEvents, isEventOnDay,
        monthStart, monthEnd, startDate, endDate, calendarDays,
        nextMonth, prevMonth, goToToday,
        handleDateClick, handleEventClick, toggleCategory,
        handleSaveEvent, handleDelete, handleSaveCategory, handleDeleteCategory
    };
};
