import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MessageCircle, Users } from 'lucide-react';

const ProgramFeedbackDetailModal = ({ program, feedbacks, onClose }) => {
    const customConfig = program?.guest_properties?.custom_feedback_config || program?.custom_feedback_config;
    const customQuestions = Array.isArray(customConfig?.questions) ? customConfig.questions : [];
    const hasCustomQuestions = customQuestions.length > 0;

    const stats = useMemo(() => {
        if (!feedbacks || feedbacks.length === 0) return null;

        const total = feedbacks.length;
        
        // Find star questions
        const starQuestions = hasCustomQuestions 
            ? customQuestions.filter(q => q.type === 'star')
            : [];

        let starStats = [];
        if (hasCustomQuestions) {
            starStats = starQuestions.map(q => {
                let sum = 0;
                let cnt = 0;
                feedbacks.forEach(f => {
                    if (f.q8_additional_comments) {
                        try {
                            const parsed = JSON.parse(f.q8_additional_comments);
                            const val = parsed[q.id];
                            if (typeof val === 'number' && val > 0) {
                                sum += val;
                                cnt++;
                            }
                        } catch (e) {}
                    }
                });
                return {
                    title: q.title,
                    avg: cnt > 0 ? (sum / cnt).toFixed(1) : '-'
                };
            });
        } else {
            const sumSatisfaction = feedbacks.reduce((acc, f) => acc + (f.q3_satisfaction || 0), 0);
            const sumRejoin = feedbacks.reduce((acc, f) => acc + (f.q6_would_rejoin || 0), 0);
            starStats = [
                { title: '평균 만족도', avg: (sumSatisfaction / total).toFixed(1) },
                { title: '재참여 의사', avg: (sumRejoin / total).toFixed(1) }
            ];
        }

        // Question 1 distribution
        const firstQ = hasCustomQuestions ? customQuestions[0] : null;
        const distributionTitle = firstQ ? `1. ${firstQ.title}` : '참여 이유 분포 (Q1)';
        const reasonCounts = {};
        feedbacks.forEach(f => {
            let r = f.q1_reason || '미응답';
            if (hasCustomQuestions && f.q8_additional_comments) {
                try {
                    const parsed = JSON.parse(f.q8_additional_comments);
                    const val = parsed[firstQ?.id] || parsed['q1'];
                    if (val !== undefined && val !== null && val !== '') r = String(val);
                } catch (e) {}
            }
            reasonCounts[r] = (reasonCounts[r] || 0) + 1;
        });

        const topReasons = Object.entries(reasonCounts)
            .map(([reason, count]) => ({ reason, count, percentage: Math.round((count / total) * 100) }))
            .sort((a, b) => b.count - a.count);

        return {
            total,
            starStats,
            distributionTitle,
            topReasons
        };
    }, [feedbacks, hasCustomQuestions, customQuestions]);

    const renderStars = (score) => {
        if (!score) return null;
        return (
            <div className="flex items-center gap-1 text-yellow-400">
                <Star size={16} className="fill-current" />
                <span className="text-gray-800 font-bold">{score}</span>
            </div>
        );
    };

    const getAnswerForQuestion = (f, q, qIdx) => {
        let parsed = null;
        if (f.q8_additional_comments) {
            try { parsed = JSON.parse(f.q8_additional_comments); } catch (e) {}
        }

        if (parsed && typeof parsed === 'object') {
            const val = parsed[q.id] ?? parsed[`q${qIdx + 1}`];
            if (val !== undefined && val !== null && val !== '') return val;
        }

        if (qIdx === 0) return f.q1_reason;
        if (qIdx === 1) return f.q2_experience;
        if (qIdx === 2) return f.q3_satisfaction;
        if (qIdx === 3) return f.q4_best_moment;
        if (qIdx === 4) return f.q5_disappointments;
        return null;
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                        <div>
                            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                <MessageCircle className="text-blue-600" />
                                피드백 상세 분석
                            </h2>
                            <p className="text-sm font-bold text-gray-500 mt-1">{program.title}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
                        {!stats ? (
                            <div className="text-center py-20 text-gray-400 font-bold">등록된 리뷰가 없습니다.</div>
                        ) : (
                            <>
                                {/* Dynamic KPI Cards */}
                                <div className={`grid gap-4 ${stats.starStats.length > 1 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-500">리뷰 참여자</p>
                                            <p className="text-2xl font-black text-gray-800">{stats.total}명</p>
                                        </div>
                                    </div>

                                    {stats.starStats.map((st, i) => (
                                        <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                                            <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-xl flex items-center justify-center shrink-0">
                                                <Star size={24} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-500 truncate" title={st.title}>{st.title}</p>
                                                <p className="text-2xl font-black text-gray-800 flex items-baseline gap-1">
                                                    {st.avg} <span className="text-sm text-gray-400 font-bold">/ 5.0</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Dynamic Question 1 Distribution */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-800 mb-4">{stats.distributionTitle}</h3>
                                    <div className="space-y-3">
                                        {stats.topReasons.map((r, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-xs font-bold mb-1">
                                                    <span className="text-gray-700">{r.reason}</span>
                                                    <span className="text-gray-500">{r.percentage}% ({r.count}명)</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${r.percentage}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Individual Feedbacks List */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-800 ml-1">상세 리뷰 내역</h3>
                                    {feedbacks.map((f, idx) => (
                                        <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                        {f.users?.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-800 mr-2">{f.users?.name || '익명'}</span>
                                                        <span className="text-xs text-gray-400">{f.users?.school || '알 수 없음'}</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Header Ratings */}
                                                {!hasCustomQuestions ? (
                                                    <div className="flex gap-3">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] text-gray-400 font-bold">만족도</span>
                                                            {renderStars(f.q3_satisfaction)}
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] text-gray-400 font-bold">재참여의사</span>
                                                            {renderStars(f.q6_would_rejoin)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2 justify-end">
                                                        {customQuestions.filter(q => q.type === 'star').map((sq, sqIdx) => {
                                                            const val = getAnswerForQuestion(f, sq, customQuestions.indexOf(sq));
                                                            if (typeof val !== 'number') return null;
                                                            return (
                                                                <div key={sq.id || sqIdx} className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                                                                    <span className="text-[11px] font-bold text-amber-800 truncate max-w-[90px]">{sq.title}:</span>
                                                                    <Star size={13} className="fill-amber-400 text-amber-400 shrink-0" />
                                                                    <span className="text-xs font-black text-amber-700">{val}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Dynamic Questions & Answers Display */}
                                            {hasCustomQuestions ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    {customQuestions.map((q, qIdx) => {
                                                        const ans = getAnswerForQuestion(f, q, qIdx);
                                                        return (
                                                            <div key={q.id || qIdx} className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                                                <p className="text-xs font-bold text-gray-500 mb-1">
                                                                    Q{qIdx + 1}. {q.title}
                                                                </p>
                                                                <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                                                                    {typeof ans === 'number' ? `${ans}점` : (ans ? String(ans) : '(미응답)')}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                /* Fallback Standard Display */
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-500 mb-1">어떤 것을 경험했나요? (Q2)</p>
                                                            <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">{f.q2_experience}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-500 mb-1">가장 좋았던 순간 (Q4)</p>
                                                            <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">{f.q4_best_moment}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-500 mb-1">아쉬웠던 점 (Q5)</p>
                                                            <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">{f.q5_disappointments}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-500 mb-1">재참여 이유/망설임 (Q7)</p>
                                                            <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">{f.q7_rejoin_reason}</p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ProgramFeedbackDetailModal;
