import React, { useState, useEffect } from 'react';
import ProgramCard from './ProgramCard';
import ProgramFeedbackModal from './modals/ProgramFeedbackModal';
import { motion, AnimatePresence } from 'framer-motion';
import { feedbackApi } from '../../api/feedbackApi';

const StudentProgramsTab = ({
    filteredPrograms,
    allPrograms,
    responses,
    responseDetails,
    openNoticeDetail
}) => {
    const [subTab, setSubTab] = useState('AVAILABLE'); // 'AVAILABLE' | 'HISTORY'
    const [selectedFeedbackProgram, setSelectedFeedbackProgram] = useState(null);
    const [userFeedbacks, setUserFeedbacks] = useState([]);

    useEffect(() => {
        const fetchFeedback = async () => {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                try {
                    const data = await feedbackApi.fetchUserFeedbacks(user.id);
                    setUserFeedbacks(data || []);
                } catch (e) {
                    console.error('Failed to fetch user feedbacks:', e);
                }
            }
        };
        fetchFeedback();
    }, []);

    // History: attended programs
    const historyPrograms = (allPrograms || []).filter(n => {
        const detail = responseDetails?.[n.id];
        return detail && detail.status === 'JOIN' && detail.is_attended;
    });

    return (
        <div className="animate-fade-in pb-32 relative min-h-screen">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-gray-50/95 backdrop-blur-xl z-20 border-b border-gray-100/50 mb-6 shadow-sm">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                        센터 프로그램 <span className="text-2xl">🚀</span>
                    </h2>
                    <p className="text-gray-500 text-xs font-medium">다양한 프로그램에 참여해보세요!</p>
                </div>
            </div>

            {/* Custom Tab Switcher (배달앱 스타일) */}
            <div className="px-5">
                <div className="flex bg-gray-100/80 p-1 rounded-2xl mb-8 relative">
                <div
                    className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-out"
                    style={{ transform: subTab === 'AVAILABLE' ? 'translateX(0)' : 'translateX(calc(100% + 8px))' }}
                />
                <button
                    onClick={() => setSubTab('AVAILABLE')}
                    className={`flex-1 relative z-10 py-3 text-sm font-bold transition-colors ${subTab === 'AVAILABLE' ? 'text-blue-600' : 'text-gray-500'}`}
                >
                    진행 중인 프로그램
                </button>
                <button
                    onClick={() => setSubTab('HISTORY')}
                    className={`flex-1 relative z-10 py-3 text-sm font-bold transition-colors ${subTab === 'HISTORY' ? 'text-blue-600' : 'text-gray-500'}`}
                >
                    나의 참여 내역
                </button>
            </div>

            <div className="space-y-6">
                <AnimatePresence mode="wait">
                    {subTab === 'AVAILABLE' ? (
                        <motion.div
                            key="AVAILABLE"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-6"
                        >
                            {filteredPrograms.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 font-bold">진행 중인 프로그램이 없습니다.</div>
                            ) : (
                                filteredPrograms.map(n => (
                                    <ProgramCard
                                        key={n.id}
                                        program={{ ...n, responseStatus: responses[n.id] }}
                                        onClick={openNoticeDetail}
                                    />
                                ))
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="HISTORY"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-4"
                        >
                            {historyPrograms.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 font-bold">참여 완료된 내역이 없습니다.</div>
                            ) : (
                                historyPrograms.map(n => {
                                    const hasReviewed = userFeedbacks.some(f => f.notice_id === n.id);
                                    
                                    return (
                                        <div key={n.id} className="bg-white border text-left border-gray-100 shadow-sm rounded-[1.5rem] p-5 active:scale-[0.98] transition-transform">
                                            <div className="flex gap-4 mb-4" onClick={() => openNoticeDetail(n)}>
                                                {/* Optional smaller thumbnail */}
                                                <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                                                    {(n.image_url || n.images?.[0]) ? (
                                                        <img src={n.image_url || n.images[0]} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-blue-50" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-extrabold text-gray-800 text-sm mb-1">{n.title}</h3>
                                                    <p className="text-xs text-gray-500 font-medium line-clamp-1">{n.short_description || '설명 없음'}</p>
                                                    <p className="text-[10px] font-black text-gray-400 mt-2">{new Date(n.program_date || n.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>

                                            {/* Action Area */}
                                            {hasReviewed ? (
                                                <button
                                                    onClick={() => setSelectedFeedbackProgram(n)}
                                                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold leading-none bg-gray-50 hover:bg-gray-100 transition-colors"
                                                >
                                                    리뷰 수정하기
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedFeedbackProgram(n)}
                                                    className="w-full py-2.5 rounded-xl text-white text-xs font-bold leading-none bg-gradient-to-r from-blue-500 to-indigo-500 shadow hover:shadow-md hover:-translate-y-0.5 transition-all outline-none flex items-center justify-center gap-1 animate-pulse-slow"
                                                >
                                                    ✏️ 리뷰 작성하고 {n.hyphen_reward && n.hyphen_reward > 0 && n.is_review_required ? `${n.hyphen_reward}H 받기` : '피드백 남기기'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Feedback Modal */}
            <AnimatePresence>
                {selectedFeedbackProgram && (
                    <ProgramFeedbackModal
                        program={selectedFeedbackProgram}
                        existingFeedback={userFeedbacks.find(f => f.notice_id === selectedFeedbackProgram.id)}
                        onClose={() => setSelectedFeedbackProgram(null)}
                        onSuccess={(newFeedback) => {
                            setUserFeedbacks(prev => {
                                const exists = prev.find(f => f.notice_id === newFeedback.notice_id);
                                if (exists) {
                                    return prev.map(f => f.notice_id === newFeedback.notice_id ? newFeedback : f);
                                }
                                return [...prev, newFeedback];
                            });
                            setSelectedFeedbackProgram(null);
                        }}
                    />
                )}
            </AnimatePresence>
            </div>
        </div>
    );
};

export default StudentProgramsTab;
