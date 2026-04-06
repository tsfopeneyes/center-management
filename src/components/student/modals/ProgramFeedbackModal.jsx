import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Star, Send } from 'lucide-react';
import { feedbackApi } from '../../../api/feedbackApi';
import { hyphenApi } from '../../../api/hyphenApi';

const ProgramFeedbackModal = ({ program, existingFeedback, onClose, onSuccess }) => {
    const [submitting, setSubmitting] = useState(false);
    
    // Form State
    const [q1, setQ1] = useState(existingFeedback?.q1_reason || '');
    const [q1Other, setQ1Other] = useState(
        existingFeedback?.q1_reason && !['친구 추천', '기존 센터 경험', '프로그램 흥미'].includes(existingFeedback.q1_reason) 
        ? existingFeedback.q1_reason 
        : ''
    );
    const [isQ1Other, setIsQ1Other] = useState(
        existingFeedback?.q1_reason && !['친구 추천', '기존 센터 경험', '프로그램 흥미'].includes(existingFeedback.q1_reason)
    );

    const [q2, setQ2] = useState(existingFeedback?.q2_experience || '');
    const [q3, setQ3] = useState(existingFeedback?.q3_satisfaction || 0); // 1-5
    const [q4, setQ4] = useState(existingFeedback?.q4_best_moment || '');
    const [q5, setQ5] = useState(existingFeedback?.q5_disappointments || '');
    const [q6, setQ6] = useState(existingFeedback?.q6_would_rejoin || 0); // 1-5
    const [q7, setQ7] = useState(existingFeedback?.q7_rejoin_reason || '');
    const [q8, setQ8] = useState(existingFeedback?.q8_additional_comments || '');

    const handleQ1Select = (val) => {
        if (val === '기타') {
            setIsQ1Other(true);
            setQ1('');
        } else {
            setIsQ1Other(false);
            setQ1(val);
        }
    };

    const handleSubmit = async () => {
        if (!q1 && !q1Other) { alert('참여 이유를 선택해주세요.'); return; }
        if (!q2.trim()) { alert('경험한 것을 적어주세요.'); return; }
        if (q3 === 0) { alert('만족도 별점을 선택해주세요.'); return; }
        if (!q4.trim()) { alert('가장 좋았던 순간을 적어주세요.'); return; }
        if (!q5.trim()) { alert('아쉬웠던 점을 적어주세요.'); return; }
        if (q6 === 0) { alert('재참여 의사 별점을 선택해주세요.'); return; }
        if (!q7.trim()) { alert('재참여 또는 망설여지는 이유를 적어주세요.'); return; }

        setSubmitting(true);
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const finalQ1 = isQ1Other ? q1Other : q1;

            const payload = {
                notice_id: program.id,
                user_id: user.id,
                q1_reason: finalQ1,
                q2_experience: q2,
                q3_satisfaction: q3,
                q4_best_moment: q4,
                q5_disappointments: q5,
                q6_would_rejoin: q6,
                q7_rejoin_reason: q7,
                q8_additional_comments: q8
            };

            const data = await feedbackApi.upsertFeedback(payload);

            // Hyphen Reward Logic (Only on first creation OR if not rewarded yet, but simply checking !existingFeedback is safe)
            if (!existingFeedback && program.is_review_required && program.hyphen_reward > 0) {
                try {
                    await hyphenApi.grantProgramReward(
                        user.id, 
                        program.id, 
                        program.hyphen_reward, 
                        'System', // Granted by system automatically
                        program.title + ' (리뷰 작성 완료)'
                    );
                    alert(`리뷰 작성 완료! ${program.hyphen_reward}H 획득을 축하합니다 🎉`);
                } catch (rErr) {
                    console.error('Reward error:', rErr);
                    alert('리뷰는 저장되었으나 포인트 지급 중 일부 오류가 발생했습니다.');
                }
            } else if (!existingFeedback) {
                alert('리뷰가 소중하게 등록되었습니다! 감사합니다.');
            } else {
                alert('리뷰가 수정되었습니다.');
            }

            onSuccess(data);
        } catch (err) {
            console.error('Feedback Error:', err);
            alert('오류가 발생했습니다: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const StarRating = ({ value, onChange }) => (
        <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(v => (
                <button
                    key={v}
                    onClick={() => onChange(v)}
                    className="focus:outline-none transition-transform active:scale-90"
                >
                    <Star
                        size={32}
                        className={value >= v ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm' : 'text-gray-200 fill-gray-50'}
                    />
                </button>
            ))}
        </div>
    );

    return (
        <div 
            className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[90vh] sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white z-10 sticky top-0 shrink-0 shadow-sm">
                    <div>
                        <h2 className="text-xl font-black text-gray-800 tracking-tight">프로그램 피드백 📝</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1 line-clamp-1">{program.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-800 transition-colors"
                    >
                        <X size={20} className="stroke-[3]" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 touch-pan-y bg-gray-50 space-y-8">
                    {/* Q1 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">1. 이 프로그램에 참여한 이유는 무엇이었나요? <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap gap-2">
                            {['친구 추천', '기존 센터 경험', '프로그램 흥미', '기타'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => handleQ1Select(opt)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                                        (isQ1Other && opt === '기타') || (!isQ1Other && q1 === opt)
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                        : 'bg-white border-gray-200 text-gray-600'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        {isQ1Other && (
                            <input
                                type="text"
                                placeholder="이유를 입력해주세요"
                                value={q1Other}
                                onChange={e => setQ1Other(e.target.value)}
                                className="w-full mt-2 p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                        )}
                    </div>

                    {/* Q2 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">2. 오늘 프로그램을 통해 어떤 것을 경험했나요? <span className="text-red-500">*</span></label>
                        <textarea
                            rows={3}
                            placeholder="자유롭게 적어주세요!"
                            value={q2}
                            onChange={e => setQ2(e.target.value)}
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>

                    {/* Q3 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">3. 오늘 경험은 얼마나 만족스러웠나요? <span className="text-red-500">*</span></label>
                        <StarRating value={q3} onChange={setQ3} />
                    </div>

                    {/* Q4 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">4. 가장 좋았던 순간은 언제였나요? <span className="text-red-500">*</span></label>
                        <textarea
                            rows={2}
                            placeholder="인상 깊었던 점을 적어주세요"
                            value={q4}
                            onChange={e => setQ4(e.target.value)}
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>

                    {/* Q5 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">5. 아쉽거나 불편했던 순간이 있었나요? <span className="text-red-500">*</span></label>
                        <textarea
                            rows={2}
                            placeholder="없으면 '없음'이라고 적어주세요!"
                            value={q5}
                            onChange={e => setQ5(e.target.value)}
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>

                    {/* Q6 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">6. 비슷한 프로그램이 열린다면 다시 함께하고 싶나요? <span className="text-red-500">*</span></label>
                        <StarRating value={q6} onChange={setQ6} />
                    </div>

                    {/* Q7 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">7. 어떤 점 때문에 다시 참여하고 싶거나, 망설여지나요? <span className="text-red-500">*</span></label>
                        <textarea
                            rows={3}
                            placeholder="이유를 알려주세요!"
                            value={q7}
                            onChange={e => setQ7(e.target.value)}
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>

                    {/* Q8 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">8. 마지막으로 하고 싶은 말이 있다면 자유롭게 적어주세요!</label>
                        <textarea
                            rows={3}
                            placeholder="(선택) 더 나누고 싶은 이야기가 있다면 남겨주세요."
                            value={q8}
                            onChange={e => setQ8(e.target.value)}
                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Footer Action */}
                <div className="shrink-0 p-4 bg-white border-t border-gray-100">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-4 bg-blue-600 disabled:bg-gray-400 text-white rounded-2xl font-black text-base transition-all active:scale-[0.98] shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                    >
                        {submitting ? '제출 중...' : '소중한 리뷰 제출하기 🚀'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ProgramFeedbackModal;
