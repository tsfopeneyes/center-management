import React from 'react';
import { ArrowLeft, Edit2, Trash2, Share } from 'lucide-react';

const NoticeHeader = ({
    onClose,
    isAdmin,
    fromAdmin,
    isEditing,
    setIsEditing,
    handleSave,
    handleDelete,
    noticeId
}) => {
    return (
        <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-50 shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={onClose} className="-ml-2 p-2 hover:bg-gray-50 rounded-full transition">
                    <ArrowLeft size={24} className="text-gray-900" />
                </button>
                <div>
                    <div className="font-bold text-sm text-gray-900">{isEditing ? '게시물 수정' : '게시물'}</div>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {!isEditing && noticeId && (
                    <button 
                        onClick={() => {
                            const link = `${window.location.origin}/p/${noticeId}`;
                            navigator.clipboard.writeText(link)
                                .then(() => alert('공유 링크가 클립보드에 복사되었습니다!'))
                                .catch(() => alert('링크 복사에 실패했습니다.'));
                        }} 
                        className="p-2 hover:bg-gray-50 rounded-full transition text-gray-500"
                        title="공유하기"
                    >
                        <Share size={20} />
                    </button>
                )}
                {isAdmin && fromAdmin && isEditing && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditing(false)} className="text-gray-500 text-sm font-medium px-2 py-1">취소</button>
                        <button onClick={handleSave} className="text-blue-600 font-bold text-sm px-3 py-1 bg-blue-50 rounded-lg">저장</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NoticeHeader;
