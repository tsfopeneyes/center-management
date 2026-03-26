import React from 'react';
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react';

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
            
            {isAdmin && fromAdmin && (
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="text-gray-500 text-sm font-medium px-2 py-1">취소</button>
                            <button onClick={handleSave} className="text-blue-600 font-bold text-sm px-3 py-1 bg-blue-50 rounded-lg">저장</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(noticeId)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default NoticeHeader;
