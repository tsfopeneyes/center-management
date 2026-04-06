import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { extractUrls } from '../../utils/textUtils';

const StudentGuestbookTab = ({
    guestPosts,
    openGuestPostDetail,
    setShowGuestWrite
}) => {
    return (
        <div className="animate-fade-in pb-32 relative min-h-screen">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-gray-50/95 backdrop-blur-xl z-20 border-b border-gray-100/50 mb-6 shadow-sm">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                        방명록 <span className="text-2xl">👋</span>
                    </h2>
                    <p className="text-gray-500 text-xs font-medium">자유롭게 글과 사진을 남겨주세요</p>
                </div>
            </div>

            <div className="px-5 space-y-6">
                {guestPosts.map(post => (
                    <div key={post.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100" onClick={() => openGuestPostDetail(post)}>
                        <div className="flex items-center gap-3 mb-3">
                            <UserAvatar user={post.users} />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800">{post.users?.name}</p>
                                <p className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap line-clamp-3">
                            {post.content}
                            {extractUrls(post.content).map((url, i) => (
                                <LinkPreview key={i} url={url} size="small" />
                            ))}
                        </p>
                        {/* Image Display */}
                        {(post.images?.length > 0 || post.image_url) && (
                            <div className={`mb-3 rounded-2xl overflow-hidden border border-gray-50 shadow-sm ${(post.images?.length > 1) ? 'grid grid-cols-2 gap-0.5 aspect-square' : 'bg-gray-50'
                                }`}>
                                {post.images?.length > 1 ? (
                                    post.images.slice(0, 4).map((img, idx) => (
                                        <div key={idx} className="relative aspect-square">
                                            <img src={img} alt="post" className="w-full h-full object-cover" />
                                            {idx === 3 && post.images.length > 4 && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold">
                                                    +{post.images.length - 4}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <img
                                        src={post.images?.[0] || post.image_url}
                                        alt="post"
                                        className="w-full h-auto max-h-[400px] object-contain mx-auto"
                                    />
                                )}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 text-gray-400 text-xs font-bold">
                            <button className="flex items-center gap-1 hover:text-green-600 transition">
                                <MessageSquare size={14} /> 댓글 달기
                            </button>
                        </div>
                    </div>
                ))}
                {guestPosts.length === 0 && <div className="text-center py-20 text-gray-400">첫 방명록의 주인공이 되어보세요!</div>}
            </div>

            <button
                onClick={() => setShowGuestWrite(true)}
                className="fixed bottom-24 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg shadow-green-300 flex items-center justify-center hover:scale-105 active:scale-95 transition z-40"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>
        </div>
    );
};

export default StudentGuestbookTab;
