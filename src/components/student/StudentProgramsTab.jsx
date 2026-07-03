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
        <div className="animate-fade-in relative">
            {/* Custom Tab Switcher (TDS Segmented 스타일) */}
            <div className="px-0">
                <div className="flex bg-tossGrey100 p-1 rounded-[12px] mb-6 relative">
                    <div
                        className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[10px] shadow-[0px_2px_4px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out"
                        style={{ transform: subTab === 'AVAILABLE' ? 'translateX(0)' : 'translateX(calc(100% + 8px))' }}
                    />
                    <button
                        onClick={() => setSubTab('AVAILABLE')}
                        className={`flex-1 relative z-10 py-2.5 text-sm font-bold transition-colors ${subTab === 'AVAILABLE' ? 'text-tossGrey900' : 'text-tossGrey500'}`}
                    >
                        진행 중인 프로그램
                    </button>
                    <button
                        onClick={() => setSubTab('HISTORY')}
                        className={`flex-1 relative z-10 py-2.5 text-sm font-bold transition-colors ${subTab === 'HISTORY' ? 'text-tossGrey900' : 'text-tossGrey500'}`}
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
                                    <div className="text-center py-20 text-tossGrey400 font-bold">진행 중인 프로그램이 없습니다.</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {filteredPrograms.map(n => (
                                            <ProgramCard
                                                key={n.id}
                                                program={{ ...n, responseStatus: responses[n.id] }}
                                                onClick={openNoticeDetail}
                                                compact={true}
                                            />
                                        ))}
                                    </div>
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
                                    <div className="text-center py-20 text-tossGrey400 font-bold">참여 완료된 내역이 없습니다.</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {historyPrograms.map(n => {
                                            const hasReviewed = userFeedbacks.some(f => f.notice_id === n.id);
                                            
                                            return (
                                                <div key={n.id} className="bg-white text-left shadow-toss-standard rounded-toss-xl p-4 flex flex-col justify-between hover:shadow-toss-elevated active:scale-[0.98] transition-all border border-tossGrey100/50">
                                                    <div className="flex gap-3 mb-3 cursor-pointer" onClick={() => openNoticeDetail(n)}>
                                                        {/* Optional smaller thumbnail */}
                                                        <div className="w-12 h-12 rounded-toss-lg bg-tossGrey50 flex-shrink-0 overflow-hidden border border-tossGrey100">
                                                            {(n.image_url || n.images?.[0]) ? (
                                                                <img src={n.image_url || n.images[0]} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-tossBlueLight" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-bold text-tossGrey900 text-xs mb-0.5 truncate">{n.title}</h3>
                                                            <p className="text-[10px] text-tossGrey500 font-medium line-clamp-1">{n.short_description || '설명 없음'}</p>
                                                            <p className="text-[9px] font-bold text-tossGrey450 mt-1">{new Date(n.program_date || n.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
     
                                                    {/* Action Area */}
                                                    {hasReviewed ? (
                                                        <button
                                                            onClick={() => setSelectedFeedbackProgram(n)}
                                                            className="w-full py-2 rounded-toss-lg text-tossGrey700 text-xs font-bold bg-tossGrey100 hover:bg-tossGrey200 transition-colors"
                                                        >
                                                            리뷰 수정하기
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setSelectedFeedbackProgram(n)}
                                                            className="w-full py-2 rounded-toss-lg text-white text-xs font-bold bg-tossBlue hover:bg-tossBlueHover transition-all flex items-center justify-center gap-1"
                                                        >
                                                            리뷰 작성하고 {n.hyphen_reward && n.hyphen_reward > 0 && n.is_review_required ? `${n.hyphen_reward}H 받기` : '피드백 남기기'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
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
