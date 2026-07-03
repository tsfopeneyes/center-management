import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Award, CheckSquare, Square } from 'lucide-react';

const BadgeAwardModal = ({
    isOpen,
    onClose,
    challenge,
    studentUsers,
    initialAwardedUserIds,
    onSave
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [groupFilter, setGroupFilter] = useState('ALL');
    const [schoolFilter, setSchoolFilter] = useState('ALL');
    const [selectedIds, setSelectedIds] = useState([]);

    // Sync selectedIds when modal opens or initialAwardedUserIds changes
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(initialAwardedUserIds || []);
            setSearchTerm('');
            setGroupFilter('ALL');
            setSchoolFilter('ALL');
        }
    }, [isOpen, initialAwardedUserIds]);

    if (!isOpen || !challenge) return null;

    // Get unique groups and schools for filter options
    const uniqueGroups = Array.from(new Set(studentUsers.map(u => u.user_group).filter(Boolean)));
    const uniqueSchools = Array.from(new Set(studentUsers.map(u => u.school).filter(Boolean)));

    // Filter students
    const filteredStudents = studentUsers.filter(student => {
        const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = groupFilter === 'ALL' || student.user_group === groupFilter;
        const matchesSchool = schoolFilter === 'ALL' || student.school === schoolFilter;
        return matchesSearch && matchesGroup && matchesSchool;
    });

    const handleToggleUser = (userId) => {
        setSelectedIds(prev => 
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSelectFilteredAll = () => {
        const filteredIds = filteredStudents.map(s => s.id);
        setSelectedIds(prev => {
            const newSelection = new Set([...prev]);
            filteredIds.forEach(id => newSelection.add(id));
            return Array.from(newSelection);
        });
    };

    const handleDeselectFilteredAll = () => {
        const filteredIds = filteredStudents.map(s => s.id);
        setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    };

    const handleSave = () => {
        onSave(selectedIds);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-white w-full max-w-xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4 mb-4 flex-shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {challenge.image_url ? (
                                <img src={challenge.image_url} alt={challenge.name} className="w-full h-full object-cover" />
                            ) : (
                                <Award className="text-blue-500" size={32} />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-xl font-black text-gray-800 leading-tight">뱃지 지급: {challenge.name}</h3>
                            <p className="text-xs text-gray-400 font-bold truncate mt-1">{challenge.description || '학생들에게 이 뱃지를 수동으로 지급합니다.'}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-50 rounded-full transition-colors self-start"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search & Filters */}
                    <div className="space-y-3 mb-4 flex-shrink-0">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="이름으로 학생 검색..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold text-sm text-gray-700"
                            />
                        </div>

                        {/* Filter Selects */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1">소속 분류</label>
                                <select
                                    value={groupFilter}
                                    onChange={e => setGroupFilter(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition font-bold text-xs text-gray-600"
                                >
                                    <option value="ALL">전체 그룹</option>
                                    {uniqueGroups.map(group => (
                                        <option key={group} value={group}>{group}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 ml-1">소속 학교</label>
                                <select
                                    value={schoolFilter}
                                    onChange={e => setSchoolFilter(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition font-bold text-xs text-gray-600"
                                >
                                    <option value="ALL">전체 학교</option>
                                    {uniqueSchools.map(school => (
                                        <option key={school} value={school}>{school}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons for filtering results */}
                    <div className="flex justify-between items-center px-1 mb-2 flex-shrink-0 text-xs">
                        <span className="font-bold text-gray-400">
                            검색 결과: <strong className="text-gray-700 font-black">{filteredStudents.length}명</strong>
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSelectFilteredAll}
                                className="text-blue-600 font-black hover:underline"
                            >
                                필터 전체 선택
                            </button>
                            <span className="text-gray-200">|</span>
                            <button
                                type="button"
                                onClick={handleDeselectFilteredAll}
                                className="text-red-500 font-black hover:underline"
                            >
                                필터 전체 해제
                            </button>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="flex-1 overflow-y-auto border border-gray-100 rounded-3xl min-h-[200px] max-h-[320px] bg-gray-50/50 p-2 divide-y divide-gray-50">
                        {filteredStudents.map(student => {
                            const isChecked = selectedIds.includes(student.id);
                            return (
                                <div
                                    key={student.id}
                                    onClick={() => handleToggleUser(student.id)}
                                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${isChecked ? 'bg-blue-50/70 border border-blue-100' : 'bg-transparent border border-transparent hover:bg-gray-100/50'}`}
                                >
                                    <div className="min-w-0">
                                        <p className="font-black text-gray-800 text-sm">{student.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                            {student.user_group || '소속없음'} • {student.school || '학교정보없음'}
                                        </p>
                                    </div>
                                    <div className="text-blue-600">
                                        {isChecked ? (
                                            <CheckSquare size={20} strokeWidth={2.5} />
                                        ) : (
                                            <Square className="text-gray-300" size={20} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredStudents.length === 0 && (
                            <div className="h-full flex items-center justify-center text-gray-400 font-bold p-8 text-center text-sm">
                                검색 조건과 일치하는<br />학생이 없습니다.
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 pt-4 mt-4 flex items-center justify-between flex-shrink-0">
                        <div className="text-xs font-bold text-gray-500">
                            선택된 인원: <span className="text-blue-600 font-black text-sm">{selectedIds.length}명</span>
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BadgeAwardModal;
