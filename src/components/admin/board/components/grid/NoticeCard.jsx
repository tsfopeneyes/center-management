import React from 'react';
import PropTypes from 'prop-types';
import { parseISO } from 'date-fns';
import { RefreshCw, CheckCircle2, Eye, Edit2, Trash2, ImageIcon, Calendar, Clock } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';
import { parseDurationToMinutes, formatKoreanTimeRange } from '../../../../../utils/dateUtils';

const NoticeCard = ({ 
    notice, 
    viewMode, 
    mode, 
    noticeStats, 
    onViewDetails, 
    onOpenParticipants, 
    onStatusChange, 
    onEdit, 
    onDelete 
}) => {
    const formatProgramDays = (daysArray) => {
        if (!daysArray || daysArray.length === 0) return '요일 미지정';
        const labels = ['일', '월', '화', '수', '목', '금', '토'];
        const sortedDays = [...daysArray].sort((a, b) => a - b);
        return sortedDays.map(d => labels[d]).join(', ');
    };



    // Card styles
    let cardClass = "bg-white border border-gray-100/80 flex group shadow-sm hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-300 ";
    let contentClass = "flex ";
    let thumbClass = "bg-gray-50 overflow-hidden flex-shrink-0 cursor-pointer border border-gray-100 shadow-inner group-hover:border-blue-200 transition-colors ";
    let titleClass = "font-black cursor-pointer group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug tracking-tight ";

    if (viewMode === 'large') {
        cardClass += "p-5 md:p-6 lg:p-8 rounded-[1.5rem] md:rounded-[2rem] flex-col";
        contentClass += "gap-4 md:gap-6 mb-4 md:mb-6";
        thumbClass += "w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-2xl";
        titleClass += "text-base md:text-lg lg:text-xl mb-1";
    } else if (viewMode === 'small') {
        cardClass += "p-4 rounded-2xl flex-col";
        contentClass += "gap-3 mb-3";
        thumbClass += "w-12 h-12 md:w-16 md:h-16 rounded-xl";
        titleClass += "text-sm md:text-base mb-0.5";
    } else if (viewMode === 'smaller') {
        cardClass += "p-3 rounded-xl flex-col";
        contentClass += "gap-2 mb-2 flex-col"; // Stack image and text
        thumbClass += "w-full aspect-video rounded-lg";
        titleClass += "text-xs md:text-sm mb-0.5";
    } else if (viewMode === 'list') {
        cardClass += "p-3 rounded-xl flex-row items-center justify-between";
        contentClass += "gap-4 items-center flex-1 min-w-0";
        thumbClass += "w-10 h-10 rounded-lg";
        titleClass += "text-sm md:text-base mb-0.5 truncate";
    }

    const hasThumbnail = (notice.images?.length > 0 || notice.image_url);
    const thumbnailSrc = notice.images?.length > 0 ? notice.images[0] : notice.image_url;

    const isActive = notice.program_status === 'ACTIVE' || !notice.program_status;
    const isCompleted = notice.program_status === 'COMPLETED';
    const isCancelled = notice.program_status === 'CANCELLED';

    const getDeadlineWarning = () => {
        if (!notice.recruitment_deadline) return null;
        const diff = parseISO(notice.recruitment_deadline) - new Date();
        if (diff > 0 && diff < 86400000) {
            return <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100/50 rounded-md text-[9px] font-black animate-pulse uppercase tracking-tight">마감직전</span>;
        }
        return null;
    };

    const getTargetBadge = () => {
        if (mode !== CATEGORIES.PROGRAM) return null;
        const targets = notice.target_regions || [];
        if (targets.length === 0 || (targets.includes('강동') && targets.includes('강서'))) {
            return <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded-md text-[9px] font-black tracking-tight uppercase">All</span>;
        } else if (targets.includes('강동')) {
            return <span className="px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-100/50 rounded-md text-[9px] font-black tracking-tight uppercase">강동</span>;
        } else if (targets.includes('강서')) {
            return <span className="px-2 py-0.5 bg-pink-50 text-pink-600 border border-pink-100/50 rounded-md text-[9px] font-black tracking-tight uppercase">강서</span>;
        }
        return null;
    };

    return (
        <div className={cardClass}>
            <div className={contentClass}>
                {viewMode !== 'list' && (
                    <div onClick={() => onViewDetails(notice)} className={thumbClass}>
                        {hasThumbnail ? (
                            <img src={thumbnailSrc} alt="thumb" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-slate-100 flex flex-col items-center justify-center text-gray-400 gap-1 select-none">
                                <Calendar size={20} className="text-gray-300" />
                                {notice.is_recruiting === false ? (
                                    <span className="text-[9px] font-black tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase">오픈</span>
                                ) : (
                                    <span className="text-[9px] font-black tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase">신청</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                    {viewMode !== 'list' && (
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                            {getTargetBadge()}
                            {notice.is_sticky && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-100/50 rounded-md text-[9px] font-black tracking-tight">📌 공지</span>}
                            {notice.is_recruiting && isActive && (
                                <>
                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100/50 rounded-md text-[9px] font-black tracking-tight uppercase">Active</span>
                                    {getDeadlineWarning()}
                                </>
                            )}
                            {isCompleted && <span className="px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-200/50 rounded-md text-[9px] font-black tracking-tight uppercase">Completed</span>}
                            {isCancelled && <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100/50 rounded-md text-[9px] font-black tracking-tight uppercase">Cancelled</span>}
                            {hasThumbnail && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-gray-50/50 px-1.5 py-0.5 rounded-md border border-gray-100/80">
                                    <ImageIcon size={10} className="opacity-50" /> {notice.images?.length || 1}
                                </div>
                            )}
                        </div>
                    )}

                    <h3 onClick={() => onViewDetails(notice)} className={`${titleClass} ${!isActive ? 'text-gray-400' : 'text-gray-800'}`}>
                        {viewMode === 'list' && notice.is_sticky && <span className="mr-2 text-orange-500 shrink-0">📌</span>}
                        {viewMode === 'list' && (() => {
                            if (mode === CATEGORIES.PROGRAM) {
                                const targets = notice.target_regions || [];
                                if (targets.length === 0 || (targets.includes('강동') && targets.includes('강서'))) {
                                    return <span className="text-blue-600 mr-1 font-bold">[All]</span>;
                                } else if (targets.includes('강동')) {
                                    return <span className="text-purple-600 mr-1 font-bold">[강동]</span>;
                                } else if (targets.includes('강서')) {
                                    return <span className="text-pink-600 mr-1 font-bold">[강서]</span>;
                                }
                            }
                            return null;
                        })()}
                        {notice.title}
                    </h3>
                    
                    {mode === CATEGORIES.PROGRAM ? (
                        <div className="mt-1.5 space-y-0.5 flex flex-col">
                            {notice.is_recruiting === false ? (
                                <>
                                    <span className="text-xs md:text-sm font-black text-blue-600 flex items-center gap-1.5">
                                        <Calendar size={13} className="text-blue-500 shrink-0" />
                                        매주 {formatProgramDays(notice.program_days)}
                                    </span>
                                    <span className="text-xs md:text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                        <Clock size={13} className="text-gray-400 shrink-0" />
                                        {formatKoreanTimeRange(notice.program_date || notice.program_start_date, notice.program_duration)}
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs md:text-sm font-black text-blue-600 flex items-center gap-1.5">
                                    <Calendar size={13} className="text-blue-500 shrink-0" />
                                    {new Date(notice.program_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            <span className="text-[9px] font-bold text-gray-300 mt-0.5">작성일: {new Date(notice.created_at).toLocaleDateString()}</span>
                        </div>
                    ) : (
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mt-1">{new Date(notice.created_at).toLocaleDateString()}</p>
                    )}
                </div>
            </div>

            {/* Actions & Stats */}
            <div className={viewMode === 'list' ? "flex items-center gap-4 shrink-0" : "mt-auto space-y-2 md:space-y-3"}>
                {(mode === CATEGORIES.PROGRAM || notice.is_poll) && (
                    <div className={`p-2.5 rounded-2xl flex justify-between items-center transition-all border ${
                        isActive 
                            ? 'bg-slate-50 border-slate-100' 
                            : 'bg-gray-50 border-gray-100 opacity-60'
                    } ${viewMode === 'list' ? 'shrink-0 min-w-[130px] md:min-w-[150px]' : ''}`}>
                        <div className={`flex gap-3 font-extrabold items-center ${viewMode === 'smaller' ? 'text-[9px]' : 'text-[10px] md:text-[11px]'}`}>
                            {notice.is_poll ? (
                                <span className={isActive ? "text-purple-600" : "text-gray-400"}>
                                    투표 {noticeStats[notice.id]?.pollTotal || 0}
                                </span>
                            ) : notice.is_recruiting ? (
                                <>
                                    <span className={isActive ? "text-blue-600" : "text-gray-400"}>신청 {noticeStats[notice.id]?.JOIN || 0}</span>
                                    {viewMode !== 'smaller' && <span className={isActive ? "text-slate-500" : "text-gray-400"}>대기 {noticeStats[notice.id]?.WAITLIST || 0}</span>}
                                </>
                            ) : (
                                <span className={isActive ? "text-emerald-600" : "text-gray-400"}>오픈 프로그램</span>
                            )}
                        </div>
                        <button 
                            onClick={() => onOpenParticipants(notice)} 
                            className={`text-[9px] md:text-[10px] px-2.5 py-1.5 rounded-lg font-black transition-all ${
                                isActive 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]' 
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                            disabled={!isActive}
                        >
                            {notice.is_poll ? '결과' : '명단'}
                        </button>
                    </div>
                )}

                <div className={`flex items-center justify-between lg:gap-2 ${viewMode === 'list' ? 'gap-1' : 'pt-2 md:pt-3 border-t border-gray-50'}`}>
                    <div className="flex items-center gap-1 shrink-0">
                        {mode === CATEGORIES.PROGRAM && (
                            <>
                                {isActive ? (
                                    <button onClick={() => onStatusChange(notice.id, 'COMPLETED')} className="p-1.5 md:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="완료 처리">
                                        <CheckCircle2 size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 16} />
                                    </button>
                                ) : (
                                    <button onClick={() => onStatusChange(notice.id, 'ACTIVE')} className="p-1.5 md:p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="되돌리기">
                                        <RefreshCw size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 16} />
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={() => onViewDetails(notice)} className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="미리보기">
                            <Eye size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 16} />
                        </button>
                        <button onClick={() => onEdit(notice)} className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="수정">
                            <Edit2 size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 14} />
                        </button>
                        <button onClick={() => onDelete(notice.id)} className="p-1.5 md:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="삭제">
                            <Trash2 size={viewMode === 'list' ? 18 : viewMode === 'smaller' ? 14 : 14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

NoticeCard.propTypes = {
    notice: PropTypes.object.isRequired,
    viewMode: PropTypes.string.isRequired,
    mode: PropTypes.string.isRequired,
    noticeStats: PropTypes.object.isRequired,
    onViewDetails: PropTypes.func.isRequired,
    onOpenParticipants: PropTypes.func.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
};

export default React.memo(NoticeCard);
