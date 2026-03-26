import React from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, Users, MapPin, Trash2, X } from 'lucide-react';
import { CATEGORIES } from '../../../../constants/appConstants';

const EventEditModal = ({ 
    formData, setFormData, 
    selectedEvent, setSelectedEvent, 
    dynamicCategories, 
    handleSaveEvent, handleDelete, 
    setShowModal 
}) => {
    return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-md rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] overflow-hidden relative z-10 border border-gray-100">
                            <div className="p-5 pb-2 flex justify-between items-start">
                                <div>
                                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-1 inline-block shadow-sm">
                                        {selectedEvent ? '일정 수정' : '새 일정 등록'}
                                    </span>
                                    <h3 className="text-xl font-black text-gray-800 tracking-tighter">{formData.title || '제목 없음'}</h3>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-xl transition-all"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSaveEvent} className="p-5 pt-2 space-y-4">
                                <div className="space-y-4">
                                    <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        {[{ id: 'SCHEDULE', label: '일반 일정', icon: <CalendarIcon size={12} /> }, { id: 'PROGRAM', label: '프로그램', icon: <Users size={12} /> }].map(opt => (
                                            <button key={opt.id} type="button" onClick={() => setFormData(prev => ({ ...prev, type: opt.id }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-black transition-all ${formData.type === opt.id ? 'bg-white text-blue-600 shadow-sm border border-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>{opt.icon}{opt.label}</button>
                                        ))}
                                    </div>
                                    <input type="text" placeholder="일정 제목을 입력하세요" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-bold transition shadow-inner text-sm" required />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">시작 날짜</label>
                                            <div className="relative">
                                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                                                <input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-xs font-bold shadow-inner" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">시간</label>
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                                                <input
                                                    type="time"
                                                    step="300"
                                                    value={formData.start_time}
                                                    onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                                    className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-xs font-bold shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {formData.type === 'PROGRAM' && (
                                        <div className="flex gap-3 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, program_type: 'CENTER' }))} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${formData.program_type === 'CENTER' ? 'bg-white text-pink-600 shadow-sm border border-pink-50' : 'text-gray-400'}`}>센터 프로그램</button>
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, program_type: 'SCHOOL_CHURCH' }))} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${formData.program_type === 'SCHOOL_CHURCH' ? 'bg-white text-purple-600 shadow-sm border border-purple-50' : 'text-gray-400'}`}>스처 프로그램</button>
                                        </div>
                                    )}

                                    {formData.type === 'SCHEDULE' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">종료 날짜</label>
                                                    <div className="relative">
                                                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                                                        <input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-xs font-bold shadow-inner" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">시간</label>
                                                    <div className="relative">
                                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                                                        <input
                                                            type="time"
                                                            step="300"
                                                            value={formData.end_time}
                                                            onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                                            className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-xs font-bold shadow-inner"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">카테고리</label>
                                                <select
                                                    value={formData.category_id}
                                                    onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                                                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-bold transition shadow-inner appearance-none text-xs"
                                                >
                                                    {dynamicCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* RECURRENCE UI */}
                                            {!selectedEvent && (
                                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-2">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.isRecurring}
                                                            onChange={e => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                                        />
                                                        <span className="text-xs font-black text-blue-600">매주 반복 일정 등록</span>
                                                    </label>

                                                    {formData.isRecurring && (
                                                        <div className="space-y-3 animate-fade-in">
                                                            <div>
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">반복 요일</label>
                                                                <div className="flex justify-between gap-1">
                                                                    {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
                                                                        <button
                                                                            key={d}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const current = formData.recurringDays;
                                                                                const next = current.includes(idx)
                                                                                    ? current.filter(day => day !== idx)
                                                                                    : [...current, idx];
                                                                                setFormData(prev => ({ ...prev, recurringDays: next }));
                                                                            }}
                                                                            className={`w-7 h-7 rounded-full text-[10px] font-black transition-all ${formData.recurringDays.includes(idx)
                                                                                ? 'bg-blue-600 text-white shadow-md scale-110'
                                                                                : 'bg-white text-gray-400 border border-gray-100'
                                                                                }`}
                                                                        >
                                                                            {d}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">반복 종료일</label>
                                                                <input
                                                                    type="date"
                                                                    value={formData.recurringEndDate}
                                                                    onChange={e => setFormData(prev => ({ ...prev, recurringEndDate: e.target.value }))}
                                                                    className="w-full p-2.5 bg-white border border-blue-100 rounded-lg outline-none text-xs font-bold"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Closed Day Space Selection */}
                                            {dynamicCategories.find(c => c.id === formData.category_id)?.name === '휴관' && (
                                                <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100/50 space-y-3">
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
                                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all border ${formData.closed_spaces?.includes(space.id)
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
                                        <div className="p-3 bg-pink-50/50 rounded-xl border border-pink-100/50 space-y-3">
                                            <div className="flex items-center gap-2 text-pink-600"><Users size={14} strokeWidth={3} /><span className="text-[10px] font-black uppercase tracking-wider">Program Details</span></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5"><label className="text-[10px] font-black text-pink-400 uppercase tracking-widest ml-1">장소</label><input type="text" placeholder="장소" value={formData.program_location} onChange={e => setFormData(prev => ({ ...prev, program_location: e.target.value }))} className="w-full p-2.5 bg-white border border-pink-100 rounded-xl outline-none text-xs font-bold" /></div>
                                                <div className="space-y-1.5"><label className="text-[10px] font-black text-pink-400 uppercase tracking-widest ml-1">모집 인원</label><input type="number" placeholder="0" value={formData.max_capacity} onChange={e => setFormData(prev => ({ ...prev, max_capacity: e.target.value }))} className="w-full p-2.5 bg-white border border-pink-100 rounded-xl outline-none text-xs font-bold" /></div>
                                            </div>
                                        </div>
                                    )}
                                    <textarea placeholder="메모를 입력하세요..." rows={3} value={formData.content} onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-xs font-bold transition shadow-inner resize-none" />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    {selectedEvent && <button type="button" onClick={handleDelete} className="p-3 bg-gray-50 text-red-400 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm"><Trash2 size={18} strokeWidth={3} /></button>}
                                    <button type="submit" className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-black shadow-xl shadow-gray-200 hover:bg-gray-800 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest">저장하기</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                
    );
};
export default EventEditModal;
