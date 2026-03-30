import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, Edit2, Download, Copy, ExternalLink, Calendar, MapPin, CheckCircle, RefreshCw, Eye, MessageCircle, FileText, X, School, Flame, LayoutGrid, LayoutList, CheckCircle2, User, Users, ChevronRight, ChevronLeft, Grid, List, Star, Heart, Columns, Settings, ClipboardList, Save, Clock, Cookie } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import TemplateManager from '../../messages/TemplateManager';

const LogFormModal = ({ school, onClose, onSave, staffList }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '18:30',
        location: '',
        participant_ids: [],
        facilitator_ids: [],
        content: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [facilitatorSearchTerm, setFacilitatorSearchTerm] = useState('');

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = e.target;
            const newValue = value.substring(0, selectionStart) + '\n* ' + value.substring(selectionEnd);

            setFormData(prev => ({
                ...prev,
                content: newValue
            }));

            // Cursor positioning after state update (using timeout to ensure DOM update)
            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
            }, 0);
        }
    };

    const filteredStudents = school.students.filter(s =>
        s.name.includes(searchTerm) || s.phone?.includes(searchTerm)
    );

    const toggleParticipant = (id) => {
        setFormData(prev => ({
            ...prev,
            participant_ids: prev.participant_ids.includes(id)
                ? prev.participant_ids.filter(pid => pid !== id)
                : [...prev.participant_ids, id]
        }));
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-0 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Plus size={20} />
                        </div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tighter">새 사역일지 작성</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 space-y-6 md:space-y-8">
                    {/* Date & Time */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4">
                        <div className="col-span-2 sm:col-span-1 space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">
                                <Calendar size={12} /> 날짜
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-2.5 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">
                                <Clock size={12} /> 시작
                            </label>
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                className="w-full p-2.5 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">
                                <Clock size={12} /> 종료
                            </label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full p-2.5 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base"
                            />
                        </div>
                    </div>

                    {/* Participants (Multi-select with search) */}
                    <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Users size={12} /> 참여자 선택 ({formData.participant_ids.length})
                            </label>
                            <div className="relative w-1/2 max-w-[160px]">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                <input
                                    type="text"
                                    placeholder="학생 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-6 pr-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-base md:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-2 max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar p-1">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleParticipant(student.id)}
                                    className={`flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 rounded-xl text-[10px] font-black transition-all border ${formData.participant_ids.includes(student.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate">{student.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Facilitators (Multi-select) */}
                    <div className="space-y-4 md:space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-indigo-500 uppercase ml-1 flex items-center gap-2">
                                    <User size={12} /> 스태프 지정
                                </label>
                                <div className="relative w-1/2 max-w-[160px]">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                    <input
                                        type="text"
                                        placeholder="이름 검색..."
                                        value={facilitatorSearchTerm}
                                        onChange={e => setFacilitatorSearchTerm(e.target.value)}
                                        className="w-full pl-6 pr-2 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-base md:text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 relative">
                                {staffList?.filter(s => school.metadata?.manager_ids?.includes(s.id)).map(staff => (
                                    <button
                                        key={staff.id}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                facilitator_ids: prev.facilitator_ids?.includes(staff.id)
                                                    ? prev.facilitator_ids.filter(id => id !== staff.id)
                                                    : [...(prev.facilitator_ids || []), staff.id]
                                            }));
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${formData.facilitator_ids?.includes(staff.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-indigo-100 hover:bg-indigo-50'}`}
                                    >
                                        <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                                            {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={12} />}
                                        </div>
                                        <span>{staff.name}</span>
                                    </button>
                                ))}
                                {(!staffList?.some(s => school.metadata?.manager_ids?.includes(s.id))) && (
                                    <div className="text-xs text-gray-300 font-bold px-2 py-1 flex-1">지정된 매니저 없음</div>
                                )}
                                {/* Search Results Dropdown */}
                                {facilitatorSearchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 p-2 max-h-[160px] overflow-y-auto no-scrollbar">
                                        {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && s.name.toLowerCase().includes(facilitatorSearchTerm.toLowerCase())).map(staff => (
                                            <button
                                                key={staff.id}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        facilitator_ids: prev.facilitator_ids?.includes(staff.id)
                                                            ? prev.facilitator_ids // Already selected
                                                            : [...(prev.facilitator_ids || []), staff.id]
                                                    }));
                                                    setFacilitatorSearchTerm(''); // Clear search after selection
                                                }}
                                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-left group"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                                    {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={12} className="text-gray-400 group-hover:text-indigo-500 py-0.5" />}
                                                </div>
                                                <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-600">{staff.name}</span>
                                                {formData.facilitator_ids?.includes(staff.id) && <span className="ml-auto text-[10px] text-indigo-500 font-bold">선택됨</span>}
                                            </button>
                                        ))}
                                        {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && s.name.toLowerCase().includes(facilitatorSearchTerm.toLowerCase())).length === 0 && (
                                            <div className="text-center py-2 text-xs text-gray-400">검색 결과가 없습니다.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selected Other Staff Display */}
                            {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && formData.facilitator_ids?.includes(s.id)).length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {staffList?.filter(s => !school.metadata?.manager_ids?.includes(s.id) && formData.facilitator_ids?.includes(s.id)).map(staff => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    facilitator_ids: prev.facilitator_ids.filter(id => id !== staff.id)
                                                }));
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border bg-indigo-600 text-white border-indigo-600 shadow-md hover:bg-indigo-700"
                                        >
                                            <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                                                {staff.profile_image_url ? <img src={staff.profile_image_url} className="w-full h-full object-cover" /> : <User size={12} />}
                                            </div>
                                            <span>{staff.name}</span>
                                            <X size={12} className="ml-1 opacity-60 hover:opacity-100" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <MapPin size={12} /> 활동 장소
                        </label>
                        <input
                            type="text"
                            placeholder="예: 매점, 학교 정문 등"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full p-3 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-base md:text-sm"
                        />
                    </div>

                    <TemplateManager
                        type="MINISTRY_LOG"
                        currentContent={formData.content}
                        onSelect={(content) => setFormData(prev => ({ ...prev, content }))}
                        currentAdmin={JSON.parse(localStorage.getItem('admin_user'))}
                    />

                    {/* Notepad Content Editor */}
                    <div className="space-y-2 md:space-y-3 pb-20 md:pb-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <FileText size={12} /> 사역 내용 (메모장 스타일)
                        </label>
                        <textarea
                            value={formData.content}
                            onKeyDown={handleKeyDown}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                            className="w-full h-[300px] md:h-[400px] p-5 md:p-6 bg-gray-50 border border-gray-100 rounded-[1.5rem] md:rounded-[2rem] font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner resize-none text-base md:text-[13px] leading-relaxed"
                            placeholder={`여기에 내용을 입력하세요...\n* 엔터 입력 시 불렛 자동 생성\n* 쉬프트+엔터로 일반 줄바꿈`}
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 md:p-8 bg-gray-50/50 border-t border-gray-100 flex gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all active:scale-95"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => {
                            onSave({
                                date: formData.date,
                                time_range: `${formData.start_time}~${formData.end_time}`,
                                location: formData.location,
                                participant_ids: formData.participant_ids,
                                facilitator_ids: formData.facilitator_ids,
                                content: formData.content
                            });
                        }}
                        className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save size={18} /> 사역일지 저장
                    </button>
                </div>
            </motion.div>
        </motion.div >
    );
};
export default LogFormModal;
