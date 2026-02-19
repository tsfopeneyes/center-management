import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Calendar, Clock, Users, Search, MapPin as LocationIcon, FileText, Save } from 'lucide-react';
import { MINISTRY_LOG_TEMPLATE } from '../../../constants/appConstants';

const LogFormModal = ({ school, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '18:30',
        location: '',
        participant_ids: [],
        content: MINISTRY_LOG_TEMPLATE
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);

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
        s.name.includes(searchTerm) || (s.phone && s.phone.includes(searchTerm))
    );

    const toggleParticipant = (id) => {
        setFormData(prev => ({
            ...prev,
            participant_ids: prev.participant_ids.includes(id)
                ? prev.participant_ids.filter(pid => pid !== id)
                : [...prev.participant_ids, id]
        }));
    };

    const handleSubmit = async () => {
        setSaving(true);
        await onSave({
            date: formData.date,
            time_range: `${formData.start_time}~${formData.end_time}`,
            location: formData.location,
            participant_ids: formData.participant_ids,
            content: formData.content
        });
        setSaving(false);
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
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Calendar size={12} /> 날짜
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Clock size={12} /> 시작 시간
                            </label>
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <Clock size={12} /> 종료 시간
                            </label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Participants (Multi-select with search) */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <Users size={12} /> 참여자 선택 ({formData.participant_ids.length}명 선택됨)
                        </label>
                        <div className="relative mb-3">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                            <input
                                type="text"
                                placeholder="학생 이름 검색..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto no-scrollbar p-1">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleParticipant(student.id)}
                                    className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-black transition-all border ${formData.participant_ids.includes(student.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate">{student.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <LocationIcon size={12} /> 활동 장소
                        </label>
                        <input
                            type="text"
                            placeholder="예: 학교 매점, 정문 앞, 센터 프로그램실 등"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                        />
                    </div>

                    {/* Notepad Content Editor */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <FileText size={12} /> 사역 내용 (메모장 스타일)
                        </label>
                        <textarea
                            value={formData.content}
                            onKeyDown={handleKeyDown}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                            className="w-full h-[400px] p-6 bg-gray-50 border border-gray-100 rounded-[2rem] font-bold text-gray-700 outline-none focus:bg-white focus:border-indigo-400 transition-all shadow-inner resize-none text-[13px] leading-relaxed"
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
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {saving ? '저장 중...' : <><Save size={18} /> 사역일지 저장</>}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default LogFormModal;
