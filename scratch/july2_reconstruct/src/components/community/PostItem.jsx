import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Repeat, Send } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import { formatDateRelative } from '../../utils/dateUtils';

const PostItem = ({ post, currentUser, onLike, onClickComment, onEdit, onDelete }) => {
    const isAuthor = currentUser?.id === post.author_id;
    // For optimistic UI or given from props
    const isLiked = post.isLikedByMe;

    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEditStart = () => {
        setIsEditing(true);
        setEditContent(post.content);
        setShowMenu(false);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setEditContent('');
    };

    const handleEditSubmit = async () => {
        if (!editContent.trim()) return;
        setIsSubmitting(true);
        const success = await onEdit(post.id, editContent);
        if (success) {
            setIsEditing(false);
        }
        setIsSubmitting(false);
    };

    const handleDeleteClick = () => {
        setShowMenu(false);
        onDelete(post.id);
    };

    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="pt-3 pb-3 px-4 flex gap-3">
                {/* Left Column: Avatar */}
                <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                    <UserAvatar user={post.author} size="w-9 h-9" />
                </div>

                {/* Right Column: Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-gray-900 text-[15px] hover:underline cursor-pointer truncate">
                                {post.author?.name || '알 수 없음'}
                            </span>
                            <span className="text-gray-400 text-[14px] whitespace-nowrap">
                                {formatDateRelative(post.created_at)}
                            </span>
                            {post.updated_at && post.updated_at !== post.created_at && (
                                <span className="text-gray-400 text-[13px] whitespace-nowrap">(수정됨)</span>
                            )}
                        </div>
                        <div className="flex items-center relative" ref={menuRef}>
                            {isAuthor && !isEditing && (
                                <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 p-1 hover:text-gray-700 hover:bg-gray-50 rounded-full transition-colors flex-shrink-0 mr-1">
                                    <MoreHorizontal size={18} />
                                </button>
                            )}
                            {/* Dropdown Menu */}
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-1 w-24 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
                                    <button
                                        onClick={handleEditStart}
                                        className="w-full text-left px-4 py-2 text-[14px] text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={handleDeleteClick}
                                        className="w-full text-left px-4 py-2 text-[14px] text-red-500 hover:bg-red-50 font-medium transition-colors"
                                    >
                                        삭제
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Body Text */}
                    {isEditing ? (
                        <div className="mt-1 flex flex-col gap-2">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-[15px] outline-none focus:border-gray-900 focus:bg-white transition-all resize-none min-h-[80px]"
                                rows={Math.max(3, editContent.split('\n').length)}
                                disabled={isSubmitting}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 pt-1 border-gray-100 border-t mt-1">
                                <button
                                    onClick={handleEditCancel}
                                    disabled={isSubmitting}
                                    className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleEditSubmit}
                                    disabled={!editContent.trim() || editContent === post.content || isSubmitting}
                                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[13px] font-bold shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400"
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-900 text-[15px] leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                            {post.content}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-2.5 text-gray-800">
                        <button
                            onClick={() => onLike(post.id, isLiked)}
                            className="flex items-center gap-1.5 group transition-colors"
                        >
                            <Heart size={19} strokeWidth={isLiked ? 0 : 2} className={isLiked ? 'fill-red-500 text-red-500' : 'group-hover:text-gray-500'} />
                            <span className={`text-[13px] font-medium ${isLiked ? 'text-red-500' : 'text-gray-500'}`}>
                                {(post.likes_count || 0).toLocaleString()}
                            </span>
                        </button>

                        <button
                            onClick={() => onClickComment(post)}
                            className="flex items-center gap-1.5 group transition-colors hover:text-gray-500"
                        >
                            <MessageCircle size={19} strokeWidth={2} className="group-hover:text-gray-500" />
                            <span className="text-[13px] font-medium text-gray-500">
                                {(post.comments_count || 0).toLocaleString()}
                            </span>
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostItem;
