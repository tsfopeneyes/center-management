import React, { useState, useRef, useEffect } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    isAfter,
    isBefore,
    eachDayOfInterval,
    startOfDay,
    endOfDay,
    isWithinInterval
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RangeDatePicker = ({ startDate, endDate, onRangeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [hoverDate, setHoverDate] = useState(null);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const handleDateClick = (day) => {
        const clickedDate = startOfDay(day);

        if (!startDate || (startDate && endDate)) {
            // Start new selection
            onRangeChange(format(clickedDate, 'yyyy-MM-dd'), null);
        } else if (startDate && !endDate) {
            const startStr = startDate;
            const startObj = parseLocalDate(startStr);

            if (isBefore(clickedDate, startObj)) {
                // Clicked date is before start, reset start to this date
                onRangeChange(format(clickedDate, 'yyyy-MM-dd'), null);
            } else {
                // Set end date (includes same day selection)
                onRangeChange(startStr, format(clickedDate, 'yyyy-MM-dd'));
                setIsOpen(false); // Close on selection complete
            }
        }
    };

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="font-black text-gray-700">
                    {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                </span>
                <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const dateFormat = "eee";
        const days = [];
        let startDateOfWeek = startOfWeek(currentMonth, { locale: ko });

        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-[10px] font-bold text-gray-400 uppercase py-2">
                    {format(addDays(startDateOfWeek, i), dateFormat, { locale: ko })}
                </div>
            );
        }

        return <div className="grid grid-cols-7 border-b border-gray-50">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDateOfCalendar = startOfWeek(monthStart, { locale: ko });
        const endDateOfCalendar = endOfWeek(monthEnd, { locale: ko });

        const rows = [];
        let days = [];
        let day = startDateOfCalendar;

        const startObj = startDate ? startOfDay(parseLocalDate(startDate)) : null;
        const endObj = endDate ? startOfDay(parseLocalDate(endDate)) : null;

        while (day <= endDateOfCalendar) {
            for (let i = 0; i < 7; i++) {
                const cloneDay = day;
                const isCurrentMonth = isSameMonth(cloneDay, monthStart);
                const isSelectedStart = startObj && isSameDay(cloneDay, startObj);
                const isSelectedEnd = endObj && isSameDay(cloneDay, endObj);
                const isToday = isSameDay(cloneDay, new Date());

                let isInRange = false;
                if (startObj && endObj) {
                    isInRange = isWithinInterval(cloneDay, { start: startObj, end: endObj });
                } else if (startObj && hoverDate && !endObj) {
                    if (isAfter(hoverDate, startObj)) {
                        isInRange = isWithinInterval(cloneDay, { start: startObj, end: hoverDate });
                    }
                }

                const isRangeEdge = isSelectedStart || isSelectedEnd;

                days.push(
                    <div
                        key={day}
                        className={`relative h-10 flex items-center justify-center cursor-pointer group ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : ''}`}
                        onClick={() => handleDateClick(cloneDay)}
                        onMouseEnter={() => setHoverDate(cloneDay)}
                    >
                        {/* Range Background */}
                        {isInRange && (
                            <div className={`absolute inset-0 bg-blue-50/50 ${isSelectedStart ? 'rounded-l-xl' : ''} ${isSelectedEnd ? 'rounded-r-xl' : ''}`} />
                        )}

                        {/* Circle highlight for edges and hover */}
                        <div className={`
                            w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all z-10
                            ${isRangeEdge ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' :
                                isToday ? 'border border-blue-200 text-blue-600 bg-blue-50/30' :
                                    'text-gray-600 group-hover:bg-gray-100'}
                            ${isInRange && !isRangeEdge ? 'text-blue-600 font-black' : ''}
                        `}>
                            {format(cloneDay, "d")}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="p-2">{rows}</div>;
    };

    const displayText = startDate
        ? (endDate ? `${startDate.replace(/-/g, '.')} ~ ${endDate.replace(/-/g, '.')}` : `${startDate.replace(/-/g, '.')} ~ 선택 중...`)
        : "날짜 선택 (전체)";

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all duration-300 shadow-sm
                    ${isOpen ? 'border-blue-500 bg-blue-50/20 ring-4 ring-blue-500/5' : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'}
                `}
            >
                <CalendarIcon size={16} className={startDate ? 'text-blue-500' : 'text-gray-400'} />
                <span className={`text-xs font-black tracking-tight ${startDate ? 'text-blue-600' : 'text-gray-500'}`}>
                    {displayText}
                </span>
                {(startDate || endDate) && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onRangeChange('', ''); }}
                        className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-400 hover:text-red-500"
                    >
                        <X size={14} />
                    </div>
                )}
            </button>

            {/* Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-12 left-0 z-[100] bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden w-[300px]"
                        onMouseLeave={() => setHoverDate(null)}
                    >
                        {renderHeader()}
                        {renderDays()}
                        {renderCells()}

                        {/* Quick Presets */}
                        <div className="bg-gray-50/50 p-4 flex gap-2 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    const today = format(new Date(), 'yyyy-MM-dd');
                                    onRangeChange(today, today);
                                    setIsOpen(false);
                                }}
                                className="flex-1 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                            >
                                오늘
                            </button>
                            <button
                                onClick={() => {
                                    const start = format(startOfWeek(new Date(), { locale: ko }), 'yyyy-MM-dd');
                                    const end = format(endOfWeek(new Date(), { locale: ko }), 'yyyy-MM-dd');
                                    onRangeChange(start, end);
                                    setIsOpen(false);
                                }}
                                className="flex-1 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                            >
                                이번 주
                            </button>
                            <button
                                onClick={() => {
                                    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
                                    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
                                    onRangeChange(start, end);
                                    setIsOpen(false);
                                }}
                                className="flex-1 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                            >
                                이번 달
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RangeDatePicker;
