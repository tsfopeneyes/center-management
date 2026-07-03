import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CheckboxFilter = ({ label, options, selectedValues, onToggle, onSelectAll, onClear }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Reset search when opening
    useEffect(() => {
        if (isOpen) setSearchTerm('');
    }, [isOpen]);

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

    const filteredOptions = options.filter(opt =>
        String(opt).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isActive = selectedValues && selectedValues.length > 0;

    return (
        <div className="relative inline-block w-full" ref={containerRef}>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-semibold">{label}</span>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-all w-full
                        ${isActive ? 'border-blue-400 bg-blue-50 text-blue-600 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                    `}
                >
                    <span className="truncate">
                        {isActive ? `${selectedValues.length}개 선택됨` : '전체'}
                    </span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute top-full left-0 z-[110] mt-1 bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden w-[220px]"
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-50 bg-gray-50/30">
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    autoFocus
                                    className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-blue-400"
                                    placeholder="검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="max-h-[200px] min-h-[140px] overflow-y-auto p-1 custom-scrollbar flex flex-col">
                            {filteredOptions.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-4 text-center text-[11px] text-gray-400 italic">결과 없음</div>
                            ) : (
                                filteredOptions.map((opt) => {
                                    const isSelected = selectedValues.includes(opt);
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => onToggle(opt)}
                                            className={`
                                                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors
                                                ${isSelected ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}
                                            `}
                                        >
                                            <div className={`
                                                w-3.5 h-3.5 rounded border flex items-center justify-center transition-all
                                                ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}
                                            `}>
                                                {isSelected && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="truncate">{opt}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-2 border-t border-gray-50 bg-gray-50/50 flex gap-1">
                            <button
                                onClick={onSelectAll}
                                className="flex-1 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-500 hover:text-blue-600 hover:border-blue-400 transition-all"
                            >
                                전체선택
                            </button>
                            <button
                                onClick={onClear}
                                className="flex-1 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-500 hover:text-red-500 hover:border-red-400 transition-all"
                            >
                                해제
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CheckboxFilter;
