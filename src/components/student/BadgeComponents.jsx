import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, X, Share2 } from 'lucide-react';

export const getBadgeProgress = (badge, stats) => {
    const { visitCount, programCount, specialStats } = stats;
    let earned = false;
    let current = 0;
    let target = badge.threshold || 1;

    if (badge.type === 'VISIT') {
        current = visitCount;
        earned = visitCount >= target;
    } else if (badge.type === 'PROGRAM') {
        current = programCount;
        earned = programCount >= target;
    } else if (badge.type === 'SPECIAL') {
        const name = badge.name || '';
        if (name.includes('벌스데이') || name.includes('생일')) {
            earned = specialStats.isBirthdayVisited;
            current = earned ? 1 : 0;
            target = 1;
        } else if (name.includes('올 클리어') || name.includes('공간 정복')) {
            current = specialStats.uniqueLocationsCount;
            target = specialStats.totalLocationsCount || 1;
            earned = current >= target && target > 0;
        } else if (name.includes('하이파이브') || name.includes('연속')) {
            current = specialStats.maxConsecutiveDays;
            earned = current >= target;
        }
    }

    const percentage = Math.min(100, Math.floor((current / target) * 100));
    return { earned, current, target, percentage };
};

export const BadgeModal = ({ badge, stats, onClose }) => {
    const { earned, current, target, percentage } = getBadgeProgress(badge, stats);
    const [imgError, setImgError] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Decoration */}
                <div className={`h-32 w-full absolute top-0 left-0 -z-10 bg-gradient-to-br ${earned ? 'from-blue-600 to-indigo-500' : 'from-gray-200 to-gray-100'}`} />

                <div className="p-8 pt-12 flex flex-col items-center">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                        <X size={20} />
                    </button>

                    {/* Badge Icon */}
                    <div className={`w-32 h-32 rounded-full border-8 border-white shadow-2xl flex items-center justify-center bg-white mb-6 relative ${earned ? 'animate-bounce-slow' : 'grayscale opacity-60'}`}>
                        {badge.image_url && !imgError ? (
                            <img src={badge.image_url} alt={badge.name} onError={() => setImgError(true)} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <span className="text-5xl">🎖️</span>
                        )}
                        {earned && (
                            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-white p-2 rounded-full shadow-lg">
                                <CheckCircle size={20} strokeWidth={3} />
                            </div>
                        )}
                    </div>

                    <h3 className="text-2xl font-black text-gray-800 mb-2">{badge.name}</h3>
                    <p className="text-gray-500 font-bold text-center text-sm mb-6 leading-relaxed">
                        {badge.description || '이 챌린지를 달성하고 멋진 뱃지를 획득하세요!'}
                    </p>

                    {/* Progress Card */}
                    <div className="w-full bg-gray-50 rounded-3xl p-6 border border-gray-100 mb-8">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-xs font-black text-gray-400 tracking-wider uppercase">현재 달성도</span>
                            <span className={`text-sm font-black ${earned ? 'text-blue-600' : 'text-gray-600'}`}>
                                {earned ? '달성 완료!' : `${current} / ${target}`}
                            </span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full rounded-full ${earned ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-blue-400'}`}
                            />
                        </div>
                        {!earned && (
                            <p className="text-[10px] text-gray-400 font-bold mt-3 text-center">
                                조금만 더 힘내세요! 목표까지 {target - current}번 남았습니다.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => {
                                if (navigator.share) {
                                    navigator.share({
                                        title: `SCI CENTER ${badge.name} 뱃지`,
                                        text: earned ? `제가 '${badge.name}' 뱃지를 획득했어요!` : `'${badge.name}' 뱃지 획득에 도전 중입니다!`,
                                        url: window.location.href,
                                    });
                                } else {
                                    alert('공유하기 지원하지 않는 브라우저입니다.');
                                }
                            }}
                            className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition flex items-center justify-center gap-2"
                        >
                            <Share2 size={18} /> 공유
                        </button>
                        {earned && (
                            <button className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition">
                                뱃지 자랑하기
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export const BadgeItem = ({ badge, visitCount, programCount, specialStats, onClick }) => {
    const { earned, percentage } = getBadgeProgress(badge, { visitCount, programCount, specialStats });
    const [imgError, setImgError] = useState(false);

    return (
        <motion.div
            key={badge.id}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onClick(badge)}
            className="flex flex-col items-center gap-3 group cursor-pointer"
        >
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm border-4 ${earned ? 'border-white bg-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] ring-4 ring-blue-50' : 'bg-gray-100/50 border-gray-100/50 grayscale opacity-40'}`}>
                {badge.image_url && !imgError ? (
                    <img
                        src={badge.image_url}
                        alt={badge.name}
                        onError={() => setImgError(true)}
                        className={`w-full h-full object-cover rounded-full transition-all duration-500 ${earned ? 'opacity-100' : 'opacity-50 brightness-50'}`}
                    />
                ) : (
                    <span className={`text-3xl ${earned ? '' : 'opacity-50'}`}>🎖️</span>
                )}

                {!earned && (
                    <>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/20 rounded-full backdrop-blur-sm flex items-center justify-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                    {badge.type === 'VISIT' ? `${badge.threshold}V` : (badge.type === 'PROGRAM' ? `${badge.threshold}P` : 'GOAL')}
                                </span>
                            </div>
                        </div>
                        {/* Semi-circular progress indicator */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="#e2e8f0"
                                strokeWidth="4"
                                strokeDasharray="100 100"
                            />
                            <motion.circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="4"
                                strokeDasharray={`${percentage} 100`}
                                initial={{ strokeDasharray: "0 100" }}
                                animate={{ strokeDasharray: `${percentage} 100` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </svg>
                    </>
                )}

                {/* Glow Effect for earned badges */}
                {earned && !imgError && (
                    <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
            <div className="text-center">
                <p className={`text-xs font-black leading-tight ${earned ? 'text-gray-800' : 'text-gray-700'}`}>
                    {badge.name}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                    <p className={`text-[10px] font-bold ${earned ? 'text-blue-500' : 'text-gray-400'}`}>
                        {badge.criteria_label || (badge.type === 'VISIT' ? `${badge.threshold}회 방문` : (badge.type === 'PROGRAM' ? `${badge.threshold}회 참석` : '특별 조건'))}
                    </p>
                    {!earned && percentage > 0 && (
                        <span className="text-[9px] font-black text-blue-400 bg-blue-50 px-1 rounded-sm">{percentage}%</span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
