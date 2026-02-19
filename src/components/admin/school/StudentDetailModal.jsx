import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { School, User, FileText, Save, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const StudentDetailModal = ({ student, onClose, onSave }) => {
    const [memo, setMemo] = useState(student.memo || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave({ memo });
        setSaving(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                        <School size={120} />
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors backdrop-blur-sm z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center relative z-10">
                        <div className="w-24 h-24 rounded-full border-4 border-white/30 bg-white shadow-xl flex items-center justify-center overflow-hidden mb-4">
                            {student.profile_image_url ? (
                                <img src={student.profile_image_url} className="w-full h-full object-cover" alt={student.name} />
                            ) : (
                                <User size={40} className="text-gray-300" />
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{student.name}</h2>
                        <div className="flex items-center gap-2 mt-1 opacity-90">
                            <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs font-bold text-white backdrop-blur-sm">
                                {student.school}
                            </span>
                            <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs font-bold text-white backdrop-blur-sm">
                                {student.birth || '생일 미입력'}
                            </span>
                        </div>
                        {student.phone && (
                            <div className="flex items-center gap-1.5 mt-2 bg-white/10 rounded-full px-3 py-1 text-xs font-bold text-white/90">
                                <span className="opacity-70">📞</span> {student.phone}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 bg-white overflow-y-auto custom-scrollbar md:max-h-[50vh]">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-1.5">
                            <FileText size={12} /> 관리자 메모 (특이사항)
                        </label>
                        <textarea
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                            className="w-full h-40 p-5 bg-yellow-50 border border-yellow-100 rounded-[1.5rem] text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-300 resize-none shadow-inner leading-relaxed"
                            placeholder="학생에 대한 특이사항, 기도제목, 상담 내용 등을 자유롭게 기록하세요."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-xs hover:bg-gray-100 transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {saving ? '저장 중...' : <><Save size={16} /> 메모 저장</>}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default StudentDetailModal;
