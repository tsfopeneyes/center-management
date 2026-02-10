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
import { supabase } from '../../supabaseClient';
import { CATEGORIES } from '../../constants/appConstants';
import { motion, AnimatePresence } from 'framer-motion';

// Predefined color themes matching the UI style
const COLOR_THEMES = {
    blue: { label: 'Blue', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    pink: { label: 'Pink', color: 'bg-pink-100 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
    green: { label: 'Green', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
    orange: { label: 'Orange', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    purple: { label: 'Purple', color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
    gray: { label: 'Gray', color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-500' },
    red: { label: 'Red', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
    cyan: { label: 'Cyan', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
};

const AdminCalendar = ({ notices, fetchData }) => {
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
        closed_spaces: [] // ['HYPHEN', 'ENOF']
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

            if (cat?.name === '휴관') {
                try {
                    const parsed = JSON.parse(s.content);
                    if (parsed && typeof parsed === 'object') {
                        closed_spaces = parsed.closed_spaces || [];
                        displayContent = parsed.text || '';
                    }
                } catch (e) {
                    // Not JSON, use as is
                }
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
                raw: { ...s, closed_spaces }
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
                category_id: dynamicCategories[0]?.id || ''
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
                program_type: event.raw.program_type || 'CENTER'
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
                closed_spaces: event.raw.closed_spaces || []
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
                const payload = {
                    title: formData.title,
                    content: isClosedDay
                        ? JSON.stringify({ closed_spaces: formData.closed_spaces, text: formData.content })
                        : formData.content,
                    start_date: new Date(startStr).toISOString(),
                    end_date: new Date(endStr).toISOString(),
                    category_id: formData.category_id,
                    created_by: (JSON.parse(localStorage.getItem('admin_user')))?.id
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
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            if (selectedEvent.isPublic) {
                const { error } = await supabase.from('notices').delete().eq('id', selectedEvent.originalId);
                if (error) throw error;
                fetchData();
            } else {
                const { error } = await supabase.from('admin_schedules').delete().eq('id', selectedEvent.originalId);
                if (error) throw error;
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

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden animate-fade-in">
            {/* Calendar Header */}
            <div className="p-4 md:p-8 flex flex-col md:flex-row justify-between items-center bg-white border-b border-gray-100 gap-4 md:gap-6 sticky top-0 md:relative z-20">
                <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
                    <div className="flex items-center bg-gray-50 rounded-2xl p-1 overflow-hidden border border-gray-100/50">
                        <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-500 active:scale-90">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-500 active:scale-90">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-2">
                            {format(currentDate, 'yyyy', { locale: ko })}
                            <span className="text-blue-600">.</span>
                            {format(currentDate, 'MM', { locale: ko })}
                        </h2>
                        <button onClick={goToToday} className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full hover:bg-blue-100 transition-colors uppercase tracking-widest hidden md:block">Today</button>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-100 text-gray-500 hover:text-blue-600 hover:border-blue-100 rounded-2xl shadow-sm transition-all text-xs font-black"
                    >
                        <Settings size={18} />
                        <span className="md:hidden lg:inline">설정</span>
                    </button>
                    <button
                        onClick={() => {
                            setSelectedEvent(null);
                            setSelectedDate(new Date());
                            setFormData({
                                ...formData,
                                type: 'SCHEDULE',
                                start_date: format(new Date(), 'yyyy-MM-dd'),
                                category_id: dynamicCategories[0]?.id || ''
                            });
                            setShowModal(true);
                        }}
                        className="flex-[2] md:flex-none flex items-center justify-center gap-2.5 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 hover:translate-y-[-2px] active:translate-y-0 transition-all"
                    >
                        <Plus size={18} strokeWidth={3} />
                        일정 추가
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 md:w-72 border-r border-gray-100 p-8 hidden md:block bg-white overflow-y-auto">
                    <div className="space-y-12">
                        <div>
                            <div className="flex items-center justify-between mb-8 px-1">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">나의 캘린더</h3>
                                <Filter size={14} className="text-gray-300" />
                            </div>
                            <div className="space-y-1.5">
                                {/* Program Filters (Pinned) */}
                                <label className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group ${visibleCategories['PROGRAM_CENTER'] ? 'bg-pink-50/50' : 'hover:bg-gray-50'}`}>
                                    <div className={`relative w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${visibleCategories['PROGRAM_CENTER'] ? 'bg-pink-600 border-pink-600 shadow-lg shadow-pink-200' : 'border-gray-200 group-hover:border-pink-300'}`}>
                                        <input type="checkbox" checked={visibleCategories['PROGRAM_CENTER']} onChange={() => toggleCategory('PROGRAM_CENTER')} className="hidden" />
                                        {visibleCategories['PROGRAM_CENTER'] && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className={`text-sm font-black transition-colors ${visibleCategories['PROGRAM_CENTER'] ? 'text-pink-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                        센터 프로그램
                                    </span>
                                </label>

                                <label className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group ${visibleCategories['PROGRAM_SCHOOL'] ? 'bg-purple-50/50' : 'hover:bg-gray-50'}`}>
                                    <div className={`relative w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${visibleCategories['PROGRAM_SCHOOL'] ? 'bg-purple-600 border-purple-600 shadow-lg shadow-purple-200' : 'border-gray-200 group-hover:border-purple-300'}`}>
                                        <input type="checkbox" checked={visibleCategories['PROGRAM_SCHOOL']} onChange={() => toggleCategory('PROGRAM_SCHOOL')} className="hidden" />
                                        {visibleCategories['PROGRAM_SCHOOL'] && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className={`text-sm font-black transition-colors ${visibleCategories['PROGRAM_SCHOOL'] ? 'text-purple-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                        스처 프로그램
                                    </span>
                                </label>

                                {dynamicCategories.map((cat) => {
                                    const theme = COLOR_THEMES[cat.color_theme] || COLOR_THEMES.gray;
                                    const isActive = visibleCategories[cat.id];
                                    return (
                                        <label key={cat.id} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group ${isActive ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                                            <div className={`relative w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${isActive ? theme.dot + ' border-transparent shadow-lg shadow-blue-100' : 'border-gray-200 group-hover:border-gray-300'}`}>
                                                <input type="checkbox" checked={visibleCategories[cat.id]} onChange={() => toggleCategory(cat.id)} className="hidden" />
                                                {isActive && <Check size={12} className="text-white" strokeWidth={4} />}
                                            </div>
                                            <span className={`text-sm font-black transition-colors ${isActive ? 'text-gray-800' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                                {cat.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-50">
                            <button
                                onClick={() => setShowCategoryModal(true)}
                                className="w-full flex items-center justify-center gap-2.5 py-4 bg-gray-50 border border-gray-100 text-gray-500 rounded-2xl text-[11px] font-black uppercase tracking-wider hover:bg-white hover:text-blue-600 hover:border-blue-100 hover:shadow-sm transition-all"
                            >
                                <Palette size={16} />
                                카테고리 관리
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Grid */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="grid grid-cols-7 border-b border-gray-100 bg-white sticky top-0 z-10">
                        {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
                            <div key={d} className={`p-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest ${idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr min-h-0 bg-gray-50/20">
                        {calendarDays.map((day, idx) => {
                            const dayEvents = allEvents.filter(e => isEventOnDay(e, day));
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const dayOfWeek = getDay(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => {
                                        setSelectedDate(day);
                                        handleDateClick(day);
                                    }}
                                    className={`relative border-r border-b border-gray-100 flex flex-col pl-0.5 pr-1 py-1 md:p-2 transition-all group cursor-pointer min-h-[110px] md:min-h-[120px] ${!isCurrentMonth ? 'bg-gray-100/30' : 'bg-white hover:bg-blue-50/30'} ${isSelected ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-[10px] md:text-xs font-black transition-all ${isToday(day) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : ''} ${!isCurrentMonth ? 'text-gray-300' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>

                                    {/* Event Display (Unified for Desktop/Mobile but styled differently) */}
                                    <div className="flex-1 space-y-0.5 md:space-y-1">
                                        {dayEvents
                                            .sort((a, b) => {
                                                // Sort by duration descending, then start date
                                                const durA = (new Date(a.end) - new Date(a.start));
                                                const durB = (new Date(b.end) - new Date(b.start));
                                                if (durB !== durA) return durB - durA;
                                                return new Date(a.start) - new Date(b.start);
                                            })
                                            .slice(0, window.innerWidth < 768 ? 4 : 10).map(event => {
                                                const theme = event.isPublic ? COLOR_THEMES.pink : (COLOR_THEMES[event.color_theme] || COLOR_THEMES.gray);
                                                const isMobile = window.innerWidth < 768;
                                                const mobileTextColor = theme.color.split(' ').find(c => c.startsWith('text-')) || 'text-gray-700';

                                                // Multi-day continuity logic
                                                const isStart = isSameDay(day, parseISO(event.raw.start_date || event.raw.program_date));
                                                const isEnd = isSameDay(day, parseISO(event.raw.end_date || event.raw.program_date));
                                                const isContinuous = !isStart || !isEnd;

                                                return (
                                                    <div
                                                        key={event.id}
                                                        onClick={(e) => {
                                                            if (!isMobile) handleEventClick(e, event);
                                                        }}
                                                        className={`
                                                        ${isMobile ? `
                                                            ${mobileTextColor} border-none leading-none overflow-hidden whitespace-nowrap
                                                            ${isContinuous ? `${theme.color} py-1 px-1 opacity-90` : 'pl-0.5 pr-1 py-0.5'}
                                                        ` : `
                                                            shadow-sm hover:brightness-95 active:scale-95 border ${theme.color} truncate px-2 py-0.5 md:py-1
                                                        `}
                                                        text-[8px] md:text-[10px] font-black transition-all duration-200
                                                        ${isStart && !isEnd ? 'rounded-l-[3px] md:rounded-l-md mr-[-4px] md:mr-[-8px] border-r-0' : ''}
                                                        ${!isStart && isEnd ? 'rounded-r-[3px] md:rounded-r-md ml-[-2px] md:ml-[-8px] border-l-0' : ''}
                                                        ${!isStart && !isEnd ? 'rounded-none ml-[-2px] mr-[-4px] md:mx-[-8px] border-x-0' : ''}
                                                        ${isStart && isEnd ? 'rounded-[3px] md:rounded-md' : ''}
                                                    `}
                                                        title={event.title}
                                                    >
                                                        {(isStart || dayOfWeek === 0 || isSameDay(day, startOfMonth(day))) ? event.title : '\u00A0'}
                                                    </div>
                                                );
                                            })}
                                        {dayEvents.length > (window.innerWidth < 768 ? 4 : 10) && (
                                            <div className="text-[7px] md:text-[8px] font-black text-gray-300 px-1">
                                                + {dayEvents.length - (window.innerWidth < 768 ? 3 : 10)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>

            {/* Event Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] overflow-hidden relative z-10 border border-gray-100">
                            <div className="p-8 pb-4 flex justify-between items-start">
                                <div>
                                    <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block shadow-sm">
                                        {selectedEvent ? '일정 수정' : '새 일정 등록'}
                                    </span>
                                    <h3 className="text-2xl font-black text-gray-800 tracking-tighter">{formData.title || '제목 없음'}</h3>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleSaveEvent} className="p-8 pt-4 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                                        {[{ id: 'SCHEDULE', label: '일반 일정', icon: <CalendarIcon size={14} /> }, { id: 'PROGRAM', label: '프로그램', icon: <Users size={14} /> }].map(opt => (
                                            <button key={opt.id} type="button" onClick={() => setFormData(prev => ({ ...prev, type: opt.id }))} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${formData.type === opt.id ? 'bg-white text-blue-600 shadow-md border border-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>{opt.icon}{opt.label}</button>
                                        ))}
                                    </div>
                                    <input type="text" placeholder="일정 제목을 입력하세요" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 font-bold transition shadow-inner" required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">시작 날짜</label>
                                            <div className="relative">
                                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                <input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 text-sm font-bold shadow-inner" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">시간</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                <input type="time" value={formData.start_time} onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))} className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 text-sm font-bold shadow-inner" />
                                            </div>
                                        </div>
                                    </div>
                                    {formData.type === 'PROGRAM' && (
                                        <div className="flex gap-4 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, program_type: 'CENTER' }))} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${formData.program_type === 'CENTER' ? 'bg-white text-pink-600 shadow-sm border border-pink-50' : 'text-gray-400'}`}>센터 프로그램</button>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, program_type: 'SCHOOL_CHURCH' }))} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${formData.program_type === 'SCHOOL_CHURCH' ? 'bg-white text-purple-600 shadow-sm border border-purple-50' : 'text-gray-400'}`}>스처 프로그램</button>
                                        </div>
                                    )}

                                    {formData.type === 'SCHEDULE' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">종료 날짜</label>
                                                    <div className="relative">
                                                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                        <input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 text-sm font-bold shadow-inner" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">시간</label>
                                                    <div className="relative">
                                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                                        <input type="time" value={formData.end_time} onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))} className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 text-sm font-bold shadow-inner" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">카테고리</label>
                                                <select
                                                    value={formData.category_id}
                                                    onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 font-bold transition shadow-inner appearance-none"
                                                >
                                                    {dynamicCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Closed Day Space Selection */}
                                            {dynamicCategories.find(c => c.id === formData.category_id)?.name === '휴관' && (
                                                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 space-y-4">
                                                    <div className="flex items-center gap-2 text-orange-600">
                                                        <MapPin size={16} strokeWidth={3} />
                                                        <span className="text-[10px] font-black uppercase tracking-wider">휴관 공간 선택</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        {[
                                                            { id: 'HYPHEN', label: '하이픈' },
                                                            { id: 'ENOF', label: '이높플레이스' }
                                                        ].map(space => (
                                                            <button
                                                                key={space.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const current = formData.closed_spaces || [];
                                                                    const next = current.includes(space.id)
                                                                        ? current.filter(s => s !== space.id)
                                                                        : [...current, space.id];
                                                                    setFormData(prev => ({ ...prev, closed_spaces: next }));
                                                                }}
                                                                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all border ${formData.closed_spaces?.includes(space.id)
                                                                    ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                                                                    : 'bg-white text-gray-400 border-gray-100'
                                                                    }`}
                                                            >
                                                                {space.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {formData.type === 'PROGRAM' && (
                                        <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100/50 space-y-4">
                                            <div className="flex items-center gap-2 text-pink-600"><Users size={16} strokeWidth={3} /><span className="text-[10px] font-black uppercase tracking-wider">Program Details</span></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5"><label className="text-[10px] font-black text-pink-400 uppercase tracking-widest ml-1">장소</label><input type="text" placeholder="장소" value={formData.program_location} onChange={e => setFormData(prev => ({ ...prev, program_location: e.target.value }))} className="w-full p-3 bg-white border border-pink-100 rounded-xl outline-none text-sm font-bold" /></div>
                                                <div className="space-y-1.5"><label className="text-[10px] font-black text-pink-400 uppercase tracking-widest ml-1">모집 인원</label><input type="number" placeholder="0" value={formData.max_capacity} onChange={e => setFormData(prev => ({ ...prev, max_capacity: e.target.value }))} className="w-full p-3 bg-white border border-pink-100 rounded-xl outline-none text-sm font-bold" /></div>
                                            </div>
                                        </div>
                                    )}
                                    <textarea placeholder="메모를 입력하세요..." rows={3} value={formData.content} onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 text-sm font-bold transition shadow-inner resize-none" />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    {selectedEvent && <button type="button" onClick={handleDelete} className="p-4 bg-gray-50 text-red-400 hover:text-white hover:bg-red-500 rounded-2xl transition-all shadow-sm"><Trash2 size={20} strokeWidth={3} /></button>}
                                    <button type="submit" className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl shadow-gray-200 hover:bg-gray-800 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest">저장하기</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Category Management Modal */}
            <AnimatePresence>
                {showCategoryModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryModal(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] overflow-hidden relative z-10 border border-gray-100 flex flex-col max-h-[90vh]">
                            <div className="p-8 pb-4 flex justify-between items-start">
                                <div><span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block shadow-sm">Category Settings</span><h3 className="text-2xl font-black text-gray-800 tracking-tighter">필터 및 카테고리 관리</h3></div>
                                <button onClick={() => setShowCategoryModal(false)} className="p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"><X size={24} /></button>
                            </div>
                            <div className="px-8 flex-1 overflow-y-auto custom-scrollbar pb-8">
                                <form onSubmit={handleSaveCategory} className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                                    <h4 className="text-sm font-black text-gray-800">{editCategory ? '카테고리 수정' : '새 카테고리 추가'}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input type="text" placeholder="카테고리 이름 (예: 외부 미팅)" value={categoryForm.name} onChange={e => setCategoryForm(prev => ({ ...prev, name: e.target.value }))} className="p-3.5 bg-white border border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm shadow-inner" required />
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                            {Object.keys(COLOR_THEMES).map(theme => (
                                                <button
                                                    key={theme}
                                                    type="button"
                                                    onClick={() => setCategoryForm(prev => ({ ...prev, color_theme: theme }))}
                                                    className={`w-8 h-8 rounded-full border-4 transition-all ${COLOR_THEMES[theme].dot} ${categoryForm.color_theme === theme ? 'border-white ring-2 ring-blue-500 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">{editCategory ? '수정 완료' : '추가하기'}</button>
                                        {editCategory && <button type="button" onClick={() => { setEditCategory(null); setCategoryForm({ name: '', color_theme: 'blue' }) }} className="px-4 py-3 bg-gray-200 text-gray-500 rounded-xl font-black text-xs">취소</button>}
                                    </div>
                                </form>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">Existing Categories</h4>
                                    {dynamicCategories.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-gray-50 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${COLOR_THEMES[cat.color_theme]?.dot || 'bg-gray-500'}`} />
                                                <span className="font-bold text-gray-700">{cat.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setEditCategory(cat); setCategoryForm({ name: cat.name, color_theme: cat.color_theme }) }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                                {!cat.is_system && <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Mobile Day Detail View Overlay */}
            <AnimatePresence>
                {showDayDetail && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed inset-0 z-[150] bg-white flex flex-col md:hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white pt-SAFE_AREA_INSET_TOP">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setShowDayDetail(false)} className="p-2 -ml-2 text-gray-400 active:scale-90 transition-all">
                                    <ChevronLeft size={28} />
                                </button>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-xl font-black text-gray-900 tracking-tighter">
                                        {format(selectedDate, 'M월')}
                                    </h3>
                                    <ChevronDown size={14} className="text-gray-300" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button className="text-gray-400"><Filter size={20} /></button>
                                <button className="text-gray-400"><MoreVertical size={20} /></button>
                            </div>
                        </div>

                        {/* Selected Date Info (e.g., "9 월요일") */}
                        <div className="px-6 py-6 flex items-center gap-4">
                            <div className={`w-12 h-12 flex flex-col items-center justify-center rounded-full bg-gray-900 text-white shadow-xl shadow-gray-200 ring-4 ring-white`}>
                                <span className="text-lg font-black leading-none">{format(selectedDate, 'd')}</span>
                            </div>
                            <h2 className="text-lg font-bold text-gray-800 tracking-tight">
                                {format(selectedDate, 'EEEE', { locale: ko })}
                            </h2>
                        </div>

                        {/* Event List */}
                        <div className="flex-1 overflow-y-auto px-1">
                            {allEvents.filter(e => isEventOnDay(e, selectedDate)).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-4 opacity-50">
                                    <CalendarIcon size={48} strokeWidth={1} />
                                    <p className="text-sm font-bold tracking-tight">일정이 없습니다.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {allEvents.filter(e => isEventOnDay(e, selectedDate)).map(event => {
                                        const theme = event.isPublic ? COLOR_THEMES.pink : (COLOR_THEMES[event.color_theme] || COLOR_THEMES.gray);
                                        const startTime = event.raw.start_time;
                                        const endTime = event.raw.end_time;

                                        // Refined NOW badge logic
                                        const now = new Date();
                                        const isTodayEvent = isToday(selectedDate);
                                        let showNowBadge = false;
                                        if (isTodayEvent && startTime && endTime) {
                                            try {
                                                const start = parseISO(format(now, 'yyyy-MM-dd') + 'T' + startTime);
                                                const end = parseISO(format(now, 'yyyy-MM-dd') + 'T' + endTime);
                                                showNowBadge = now >= start && now <= end;
                                            } catch (e) { }
                                        }

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={(e) => {
                                                    setShowDayDetail(false);
                                                    handleEventClick(e, event);
                                                }}
                                                className="flex items-start gap-5 p-5 active:bg-gray-50 transition-all group border-b border-gray-50/50 last:border-none"
                                            >
                                                <div className="w-16 pt-0.5">
                                                    {!startTime ? (
                                                        <span className="text-xs font-bold text-gray-400">종일</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex flex-col leading-tight">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-[9px] font-bold text-gray-400">
                                                                        {format(parseISO(`2000-01-01T${startTime}`), 'aaa', { locale: ko })}
                                                                    </span>
                                                                    <span className="text-sm font-black text-gray-800 tracking-tighter">
                                                                        {format(parseISO(`2000-01-01T${startTime}`), 'h:mm')}
                                                                    </span>
                                                                </div>
                                                                {endTime && (
                                                                    <div className="flex items-baseline gap-1 opacity-30 mt-[-2px]">
                                                                        <span className="text-[8px] font-bold text-gray-400">
                                                                            {format(parseISO(`2000-01-01T${endTime}`), 'aaa', { locale: ko })}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-gray-800">
                                                                            {format(parseISO(`2000-01-01T${endTime}`), 'h:mm')}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 flex gap-3.5 min-w-0">
                                                    <div className={`w-[2.5px] rounded-full ${theme.dot} opacity-40 h-10 mt-1`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            {showNowBadge && (
                                                                <span className="px-1.5 py-0.5 rounded border border-red-500 text-red-500 text-[8px] font-black tracking-tighter leading-none bg-white">NOW</span>
                                                            )}
                                                            <h4 className="text-[14px] font-bold text-gray-900 truncate tracking-tight">{event.title}</h4>
                                                        </div>
                                                        <p className="text-[11px] text-gray-400 truncate leading-relaxed opacity-80">{event.content?.replace(/<[^>]*>/g, '') || '-'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Floating Add Button */}
                        <div className="p-8 fixed bottom-0 right-0 z-[160]">
                            <button
                                onClick={() => {
                                    setShowDayDetail(false);
                                    setFormData({
                                        ...formData,
                                        start_date: format(selectedDate, 'yyyy-MM-dd'),
                                        end_date: format(selectedDate, 'yyyy-MM-dd'),
                                        type: 'SCHEDULE',
                                        category_id: dynamicCategories[0]?.id || ''
                                    });
                                    setSelectedEvent(null);
                                    setShowModal(true);
                                }}
                                className="w-16 h-16 flex items-center justify-center bg-[#24C06A] text-white rounded-full shadow-2xl shadow-green-200 active:scale-95 transition-all"
                            >
                                <Edit2 size={30} strokeWidth={2.5} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default AdminCalendar;
