import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';

const PostCreateModal = ({ user, category, onClose, onSubmit }) => {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        // Auto-focus and resize
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    const handleInput = (e) => {
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
        setContent(e.target.value);
    };

    const handleSubmit = async () => {
        if (!content.trim()) return;
        setIsSubmitting(true);
        await onSubmit(content);
        setIsSubmitting(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[150] bg-white flex flex-col sm:rounded-t-3xl sm:top-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                <button onClick={onClose} className="text-gray-900 font-bold px-2 py-1">취소</button>
                <h3 className="font-black text-gray-900">{category}</h3>
                <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || isSubmitting}
                    className="text-blue-600 font-black px-4 py-1.5 bg-blue-50 rounded-full disabled:opacity-40 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                >
                    {isSubmitting ? '게시 중...' : '게시'}
                </button>
            </div>

            {/* Writer Area */}
            <div className="flex-1 overflow-y-auto p-4 flex gap-3 pb-20">
                <div className="flex flex-col items-center">
                    <UserAvatar user={user} size="w-10 h-10" />
                    <div className="w-0.5 flex-1 bg-gray-100 mt-2 mb-2"></div>
                </div>

                <div className="flex-1 flex flex-col pt-1">
                    <span className="font-bold text-gray-900 text-[15px] mb-1">{user?.name}</span>
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onInput={handleInput}
                        placeholder="새로운 스레드를 시작하세요..."
                        className="w-full text-[15px] leading-relaxed text-gray-900 outline-none resize-none overflow-hidden placeholder:text-gray-400 bg-transparent min-h-[100px]"
                        disabled={isSubmitting}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default PostCreateModal;
