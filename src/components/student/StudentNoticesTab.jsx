import React from 'react';
import { motion } from 'framer-motion';
import { Pin, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { stripHtml } from '../../utils/textUtils';

const StudentNoticesTab = ({
    filteredNotices,
    openNoticeDetail
}) => {
    return (
        <div className="animate-fade-in pb-32">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-gray-50/95 backdrop-blur-xl z-20 border-b border-gray-100/50 mb-6 shadow-sm">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                    공지사항 <span className="text-2xl">📢</span>
                </h2>
            </div>

            <div className="px-5 space-y-4">
                {filteredNotices.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">등록된 공지사항이 없습니다.</div>
                ) : (
                    filteredNotices.map(n => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => openNoticeDetail(n)}
                            className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 btn-tactile cursor-pointer hover:shadow-md"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    {n.is_sticky && (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-black shadow-sm whitespace-nowrap shrink-0 animate-pulse">
                                            <Pin size={12} className="fill-orange-600" /> 공지
                                        </span>
                                    )}
                                    <h3 className={`font-extrabold text-base leading-tight line-clamp-1 ${n.is_sticky ? 'text-orange-700' : 'text-gray-800'}`}>{n.title}</h3>
                                </div>
                                {n.is_recruiting && <span className="px-2.5 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black">모집중</span>}
                            </div>
                            {/* Thumbnail */}
                            {(n.images?.length > 0 || n.image_url) && (
                                <div className="mb-4 rounded-2xl overflow-hidden h-36 bg-gray-50 border border-gray-100 relative shadow-inner">
                                    <img src={n.images?.length > 0 ? n.images[0] : n.image_url} alt="thumbnail" className="w-full h-full object-cover" />
                                    {n.images?.length > 1 && <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10">+{n.images.length - 1}</div>}
                                </div>
                            )}
                            <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed font-medium">{stripHtml(n.content)}</p>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-50 pt-4 font-bold uppercase tracking-wider">
                                <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1.5 text-blue-600">상세보기 <ChevronRight size={12} /></span>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

export default StudentNoticesTab;
