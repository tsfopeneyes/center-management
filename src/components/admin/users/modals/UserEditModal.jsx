import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, X, Save, School, ShieldAlert, KeyRound } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
import UserAvatar from '../../../common/UserAvatar';

const UserEditModal = ({
    editingUser, setEditingUser,
    handleDeleteUser, handleResetPassword,
    userStats, fetchData, setIsMergeModalOpen, setViewerImage
}) => {
    const [editFormData, setEditFormData] = useState({
        name: '', school: '', phone: '', user_group: '재학생', memo: '',
        status: 'approved', guardian_name: '', guardian_phone: '', guardian_relation: '',
        is_leader: false, is_master: false, terms_agreed: false, is_school_church: false
    });

    useEffect(() => {
        if (editingUser) {
            setEditFormData({
                name: editingUser.name || '',
                school: editingUser.school || '',
                phone: editingUser.phone || editingUser.phone_back4 || '',
                user_group: editingUser.user_group || '재학생',
                memo: editingUser.memo || '',
                status: editingUser.status || 'approved',
                guardian_name: editingUser.guardian_name || '',
                guardian_phone: editingUser.guardian_phone || '',
                guardian_relation: editingUser.guardian_relation || '',
                is_leader: editingUser.is_leader || false,
                is_master: editingUser.is_master || false,
                terms_agreed: editingUser.preferences?.terms_agreed || false,
                is_school_church: editingUser.preferences?.is_school_church || false
            });
        }
    }, [editingUser]);

    const handleSaveUser = async () => {
        if (!editingUser) return;
        try {
            const { error } = await supabase.from('users').update({
                name: editFormData.name,
                school: editFormData.school,
                phone: editFormData.phone,
                user_group: editFormData.user_group,
                memo: editFormData.memo,
                is_leader: editFormData.is_leader,
                is_master: editFormData.is_master,
                preferences: { ...(editingUser.preferences || {}), terms_agreed: editFormData.terms_agreed, is_school_church: editFormData.is_school_church }
            }).eq('id', editingUser.id);
            if (error) throw error;
            alert('회원 정보가 수정되었습니다.');
            setEditingUser(null);
            fetchData();
        } catch (err) { alert('수정 실패'); }
    };

    if (!editingUser) return null;
    const adminUser = JSON.parse(localStorage.getItem('admin_user')) || {};

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <h3 className="font-bold text-gray-800">회원 정보 수정</h3>
                    <div className="flex gap-2">
                        {adminUser.is_master && (
                            <button onClick={() => handleResetPassword(editingUser)} className="p-2 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition" title="비밀번호 초기화">
                                <KeyRound size={20} />
                            </button>
                        )}
                        <button onClick={() => handleDeleteUser(editingUser)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition"><Trash2 size={20} /></button>
                        <button onClick={() => setEditingUser(null)}><X size={20} className="text-gray-400" /></button>
                    </div>
                </div>
                <div className="overflow-y-auto">
                    <div className="p-4 flex flex-col items-center border-b border-gray-50 bg-gray-50/30">
                        {editingUser.profile_image_url ? (
                            <button onClick={() => setViewerImage(editingUser.profile_image_url)} title="프로필 사진 크게 보기" className="active:scale-95 transition-transform focus:outline-none">
                                <UserAvatar user={editingUser} size="w-20 h-20" textSize="text-2xl" />
                            </button>
                        ) : (
                            <UserAvatar user={editingUser} size="w-20 h-20" textSize="text-2xl" />
                        )}
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">이름</label>
                                <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">그룹</label>
                                <select value={editFormData.user_group} onChange={(e) => setEditFormData({ ...editFormData, user_group: e.target.value })} className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white font-bold text-sm">
                                    <option value="청소년">청소년</option><option value="졸업생">졸업생</option><option value="STAFF">STAFF</option><option value="재학생">재학생(구)</option><option value="일반인">일반인(구)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">학교</label>
                                <input type="text" value={editFormData.school} onChange={(e) => setEditFormData({ ...editFormData, school: e.target.value })} className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">연락처</label>
                                <input type="text" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold font-mono text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="terms_agreed"
                                    checked={editFormData.terms_agreed}
                                    onChange={(e) => setEditFormData({ ...editFormData, terms_agreed: e.target.checked })}
                                    className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="terms_agreed" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    가입 약관 동의
                                </label>
                            </div>

                            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="is_school_church"
                                    checked={editFormData.is_school_church}
                                    onChange={(e) => setEditFormData({ ...editFormData, is_school_church: e.target.checked })}
                                    className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                                <label htmlFor="is_school_church" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                                    <School size={14} className="text-emerald-500" />
                                    스쿨처치 참여
                                </label>
                            </div>

                            {(editFormData.user_group === '청소년' || editFormData.user_group === '졸업생' || editFormData.user_group === '재학생') && (
                                <div className="flex items-center gap-2 p-2.5 bg-yellow-50 border border-yellow-100 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="is_leader"
                                        checked={editFormData.is_leader}
                                        onChange={(e) => setEditFormData({ ...editFormData, is_leader: e.target.checked })}
                                        className="w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer"
                                    />
                                    <label htmlFor="is_leader" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                        리더 분배
                                    </label>
                                </div>
                            )}

                            {editFormData.user_group === 'STAFF' && (adminUser?.is_master || adminUser?.name === 'Rok') && (
                                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="is_master"
                                        checked={editFormData.is_master}
                                        onChange={(e) => setEditFormData({ ...editFormData, is_master: e.target.checked })}
                                        className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                                    />
                                    <label htmlFor="is_master" className="text-xs font-bold text-gray-700 cursor-pointer flex items-center gap-1">
                                        <ShieldAlert size={14} className="text-red-500" />
                                        마스터 권한
                                    </label>
                                </div>
                            )}
                        </div>

                        {editFormData.guardian_name && (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">보호자 정보 (만 14세 미만)</p>
                                <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                                    <div><span className="text-blue-400 block text-[9px]">성함</span>{editFormData.guardian_name}</div>
                                    <div><span className="text-blue-400 block text-[9px]">관계</span>{editFormData.guardian_relation}</div>
                                    <div className="col-span-2"><span className="text-blue-400 block text-[9px]">연락처</span>{editFormData.guardian_phone}</div>
                                </div>
                            </div>
                        )}

                        <div><label className="text-[10px] font-bold text-gray-500 block mb-1">메모 (관리자용)</label><textarea value={editFormData.memo} onChange={(e) => setEditFormData({ ...editFormData, memo: e.target.value })} className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none h-14 text-sm" placeholder="특이사항 입력" /></div>

                        {userStats && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Activity Stats</h4>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                    <div className="bg-white p-2 rounded-lg shadow-sm"><span className="text-[10px] text-gray-400 block">주간</span><span className="font-bold text-blue-600 text-sm">{userStats.weekly}h</span></div>
                                    <div className="bg-white p-2 rounded-lg shadow-sm"><span className="text-[10px] text-gray-400 block">월간</span><span className="font-bold text-blue-600 text-sm">{userStats.monthly}h</span></div>
                                    <div className="bg-white p-2 rounded-lg shadow-sm"><span className="text-[10px] text-gray-400 block">전체</span><span className="font-bold text-blue-600 text-sm">{userStats.total}h</span></div>
                                    <div className="bg-white p-2 rounded-lg shadow-sm"><span className="text-[10px] text-gray-400 block">최다</span><span className="font-bold text-gray-800 text-xs truncate block">{userStats.topLocation}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-6 pt-0 space-y-3">
                        {(editingUser.user_group === '게스트' || editingUser.preferences?.is_temporary) && (
                            <button
                                onClick={() => setIsMergeModalOpen(true)}
                                className="w-full py-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl font-bold hover:bg-amber-100 transition flex items-center justify-center gap-2 shadow-sm mb-3"
                            >
                                <RefreshCw size={18} /> 정식 계정으로 데이터 병합
                            </button>
                        )}
                        <button onClick={handleSaveUser} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl">
                            <Save size={20} /> 수정사항 저장
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserEditModal;
