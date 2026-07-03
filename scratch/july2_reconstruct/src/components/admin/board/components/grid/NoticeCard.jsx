import React from 'react';
import PropTypes from 'prop-types';
import { parseISO } from 'date-fns';
import { RefreshCw, CheckCircle2, Eye, Edit2, Trash2, ImageIcon } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

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
    // Card styles
    let cardClass = "bg-white border border-gray-100 transition-all duration-300 flex group shadow-sm hover:shadow-xl hover:shadow-blue-500/5 ";
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
            return <span className="px-2 py-0.5 bg-red-500 text-white rounded-lg text-[9px] font-black animate-pulse">마감직전</span>;
        }
        return null;
    };

    return (
        <div className={cardClass}>
            <div className={contentClass}>
                {/* Thumbnail */}
                {viewMode !== 'list' && hasThumbnail && (
                    <div onClick={() => onViewDetails(notice)} className={thumbClass}>
                        <img src={thumbnailSrc} alt="thumb" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                    {viewMode !== 'list' && (
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            {notice.is_sticky && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-lg text-[9px] font-black uppercase tracking-tight">📌 공지</span>}
                            {notice.is_recruiting && isActive && (
                                <>
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-tight">Active</span>
                                    {getDeadlineWarning()}
                                </>
                            )}
                            {isCompleted && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-tight">Completed</span>}
                            {isCancelled && <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-tight">Cancelled</span>}
                            {hasThumbnail && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-lg border border-gray-100">
                                    <ImageIcon size={10} className="opacity-50" /> {notice.images?.length || 1}
                                </div>
                            )}
                        </div>
                    )}

                    <h3 onClick={() => onViewDetails(notice)} className={`${titleClass} ${!isActive ? 'text-gray-400' : 'text-gray-800'}`}>
                        {viewMode === 'list' && notice.is_sticky && <span className="mr-2 text-orange-500 shrink-0">📌</span>}
                        {(() => {
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
                    
                    {mode === CATEGORIES.PROGRAM && notice.program_date ? (
                        <div className="mt-1 flex flex-col">
                            <span className="text-xs md:text-sm font-black text-blue-600 flex items-center gap-1">
                                📅 {new Date(notice.program_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[9px] font-bold text-gray-300 mt-0.5">작성일: {new Date(notice.created_at).toLocaleDateString()}</span>
                        </div>
                    ) : (
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mt-1">{new Date(notice.created_at).toLocaleDateString()}</p>
                    )}
                </div>
            </div>

            {/* Actions & Stats */}
            <div className={viewMode === 'list' ? "flex items-center gap-4 shrink-0" : "mt-auto space-y-2 md:space-y-3"}>
                {(notice.is_recruiting || notice.is_poll) && noticeStats[notice.id] && (
                    <div className={`p-2 lg:p-3 rounded-xl flex justify-between items-center transition-all shadow-sm ${isActive ? 'bg-blue-50/50 group-hover:bg-blue-600 group-hover:text-white' : 'bg-gray-100/50 opacity-60'} ${viewMode === 'list' ? 'shrink-0 min-w-[130px] md:min-w-[150px]' : ''}`}>
                        <div className={`flex gap-3 font-black ${viewMode === 'smaller' ? 'text-[9px]' : 'text-[10px] md:text-[11px]'}`}>
                            {notice.is_poll ? (
                                <span className={isActive ? "text-purple-600 group-hover:text-white" : ""}>
                                    투표 {noticeStats[notice.id].pollTotal || 0}
                                </span>
                            ) : (
                                <>
                                    <span className={isActive ? "text-blue-600 group-hover:text-white" : ""}>신청 {noticeStats[notice.id].JOIN || 0}</span>
                                    {viewMode !== 'smaller' && <span className={isActive ? "text-orange-500 group-hover:text-orange-200" : ""}>대기 {noticeStats[notice.id].WAITLIST || 0}</span>}
                                </>
                            )}
                        </div>
                        <button onClick={() => onOpenParticipants(notice)} className={`text-[9px] md:text-[10px] px-2 py-1 rounded-md font-black transition-all shadow-sm ${isActive ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-gray-200 text-gray-500'}`}>
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
