import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Search, RefreshCw, ChevronRight, X } from 'lucide-react';
import { mergeUserStats } from '../../../../api/userMergeApi';
import UserAvatar from '../../../common/UserAvatar';
import useModalClose from '../../../../hooks/useModalClose';

const UserMergeModal = ({ 
    isMergeModalOpen, setIsMergeModalOpen, 
    editingUser, setEditingUser,
    users = [], fetchData
}) => {
    const [mergeSearchTerm, setMergeSearchTerm] = useState('');
    const [merging, setMerging] = useState(false);
    const [mergeError, setMergeError] = useState('');
    const closeModal = () => { if (!merging) setIsMergeModalOpen(false); };
    useModalClose(isMergeModalOpen, closeModal, { priority: 270 });

    useEffect(() => {
        if (isMergeModalOpen) {
            setMergeSearchTerm('');
            setMergeError('');
        }
    }, [isMergeModalOpen, editingUser?.id]);

    const handleMergeAction = async (primaryUser) => {
        if (!editingUser || !primaryUser || merging) return;
        if (!confirm(`'${editingUser.name}'(임시)의 모든 활동 기록을 '${primaryUser.name}'(정식) 계정으로 병합하시겠습니까?\n병합 후 '${editingUser.name}' 계정은 삭제됩니다.`)) return;

        setMerging(true);
        setMergeError('');
        try {
            const result = await mergeUserStats(editingUser.id, primaryUser.id);
            if (result.success) {
                alert('데이터 병합이 완료되었습니다.');
                setIsMergeModalOpen(false);
                setEditingUser(null);
                fetchData();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            console.error(err);
            setMergeError('병합 실패: ' + (err?.message || '잠시 후 다시 시도해주세요.'));
        } finally {
            setMerging(false);
        }
    };

    const mergeCandidates = useMemo(() => {
        const recommendedId=editingUser?.linkReview?.newProfileId;
        const eligible = users.filter(user => user.id !== editingUser?.id && !user.preferences?.is_temporary && user.user_group !== '게스트');
        const recommended=recommendedId?eligible.find(user=>user.id===recommendedId):null;
        if (!mergeSearchTerm.trim()) return recommended ? [recommended] : [];
        const query = mergeSearchTerm.replace(/\s+/g, '').toLowerCase();
        const phoneQuery = query.replace(/\D/g, '');
        const matches=eligible.filter(u =>
            String(u.name || '').replace(/\s+/g, '').toLowerCase().includes(query) ||
            (phoneQuery && String(u.phone || '').replace(/\D/g, '').includes(phoneQuery))
        );
        return [...(recommended?[recommended]:[]),...matches.filter(user=>user.id!==recommendedId)].slice(0,5);
    }, [users, mergeSearchTerm, editingUser]);

    if (!isMergeModalOpen || !editingUser) return null;

    return createPortal(
        <div data-testid="user-merge-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }} className="fixed inset-0 z-[270] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
                role="dialog" aria-modal="true" aria-label="계정 연결 확인"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative"
            >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-black text-gray-800 flex items-center gap-2">
                            <RefreshCw size={20} className="text-amber-500" />
                            데이터 병합
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">임시 데이터를 옮길 정식 계정을 선택하세요</p>
                    </div>
                    <button type="button" aria-label="계정 연결 확인 닫기" disabled={merging} onClick={closeModal} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20} className="text-gray-400" /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="merge-account-search" className="text-xs font-bold text-gray-600 ml-1">정식 계정 검색 (이름 또는 번호)</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                id="merge-account-search" autoFocus disabled={merging}
                                type="text" 
                                placeholder="검색 후 아래에서 선택..."
                                value={mergeSearchTerm}
                                onChange={(e) => setMergeSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-amber-500 transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {mergeError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{mergeError}</p>}

                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase ml-1">계정 목록</p>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto no-scrollbar">
                            {mergeCandidates.length > 0 ? mergeCandidates.map(u => (
                                <button 
                                    type="button"
                                    key={u.id}
                                    onClick={() => handleMergeAction(u)}
                                    disabled={merging}
                                    className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <UserAvatar user={u} size="w-10 h-10" />
                                        <div>
                                            <p className="font-black text-gray-800 text-sm group-hover:text-amber-700">{u.name}</p>
                                            <p className="text-[10px] font-bold text-gray-400">{u.school || '학교 미지정'} | {u.phone || '번호 없음'}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-300 group-hover:text-amber-500" />
                                </button>
                            )) : mergeSearchTerm ? (
                                <p className="text-center py-6 text-gray-400 font-bold text-sm italic">검색 결과가 없습니다.</p>
                            ) : (
                                <div className="py-10 flex flex-col items-center justify-center text-gray-300 gap-3">
                                    <Search size={40} className="opacity-20" />
                                    <p className="text-[11px] font-black uppercase tracking-wider">이름이나 번호를 입력하여 계정을 찾으세요</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {merging && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                        <div className="w-12 h-12 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin mb-4"></div>
                        <p className="font-black text-gray-800">데이터 병합 중...</p>
                        <p className="text-xs text-gray-400 mt-1 italic">잠시만 기다려 주세요.</p>
                    </div>
                )}
            </motion.div>
        </div>, document.body
    );
};

export default UserMergeModal;
