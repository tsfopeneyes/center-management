import React, { useState, useMemo } from 'react';
import { Search, RefreshCw, Edit2, Trash2, UserPlus, Save, X, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { exportUsersToExcel } from '../../utils/exportUtils';

const AdminUsers = ({ users, allLogs, locations, fetchData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroup, setFilterGroup] = useState('ALL');
    const [editingUser, setEditingUser] = useState(null);
    const [editFormData, setEditFormData] = useState({
        name: '', school: '', phone: '', user_group: '재학생', memo: '',
        status: 'approved', guardian_name: '', guardian_phone: '', guardian_relation: ''
    });

    // Messaging State (Deprecated/Hidden for now as per user request)
    // const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    // const [messageModalOpen, setMessageModalOpen] = useState(false);
    // const [messageContent, setMessageContent] = useState('');
    // const [sending, setSending] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [sending, setSending] = useState(false);
    const [bulkTargetGroup, setBulkTargetGroup] = useState('졸업생');

    // Selection Logic
    const toggleSelectAll = () => {
        if (selectedUserIds.size === filteredUsers.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
        }
    };

    const toggleSelectUser = (id) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedUserIds(newSet);
    };

    /* handleSendMessage is suppressed as per user request */

    // Bulk Group Update Logic
    const handleBulkUpdateGroup = async (newGroup) => {
        if (selectedUserIds.size === 0) return;
        if (!confirm(`선택한 ${selectedUserIds.size}명의 그룹을 '${newGroup}'(으)로 변경하시겠습니까?`)) return;

        setSending(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ user_group: newGroup })
                .in('id', Array.from(selectedUserIds));

            if (error) throw error;

            alert('일괄 변경이 완료되었습니다.');
            setSelectedUserIds(new Set());
            fetchData();
        } catch (err) {
            console.error(err);
            alert('일괄 변경 실패: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    // Filter Logic
    const filteredUsers = users.filter(user => {
        // Calculate Age from YYMMDD
        let age = '';
        if (user.birth && user.birth.length === 6) {
            const yy = parseInt(user.birth.substring(0, 2));
            const currentYear = new Date().getFullYear();
            // Assuming 00-40 is 2000s, 41-99 is 1900s for a youth center
            const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
            age = (currentYear - fullYear).toString(); // 'Man-age' (Year based difference)
        }

        const matchesSearch =
            user.name.includes(searchTerm) ||
            (user.phone_back4 && user.phone_back4.includes(searchTerm)) ||
            (user.school && user.school.includes(searchTerm)) ||
            (age && age === searchTerm); // Exact match for age (e.g. '17') or partial? '1' matches 17, 10-19? Let's do exact if 2 digits, or partial.
        // Actually, if I type '17', I expect 17 year olds. If I type '7', I might find 7, 17, 70.
        // Let's stick to simple include for string match, covers most cases. 
        // If user types '17', it matches '17'.

        // Also allow searching by '17세' or '17살'
        const cleanSearch = searchTerm.replace(/세|살/g, '');
        const matchesAge = age && age.includes(cleanSearch);

        const matchesGroup = filterGroup === 'ALL' || user.user_group === filterGroup;
        const isInternalAdmin = user.name === 'admin';
        return !isInternalAdmin && (matchesSearch || matchesAge) && matchesGroup;
    });

    // Handlers
    const openUserEditModal = (user) => {
        setEditingUser(user);
        setEditFormData({
            name: user.name || '',
            school: user.school || '',
            phone: user.phone || user.phone_back4 || '',
            user_group: user.user_group || '재학생',
            memo: user.memo || '',
            status: user.status || 'approved',
            guardian_name: user.guardian_name || '',
            guardian_phone: user.guardian_phone || '',
            guardian_relation: user.guardian_relation || ''
        });
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        try {
            const { error } = await supabase.from('users').update({
                name: editFormData.name,
                school: editFormData.school,
                phone: editFormData.phone,
                user_group: editFormData.user_group,
                memo: editFormData.memo
            }).eq('id', editingUser.id);
            if (error) throw error;
            alert('회원 정보가 수정되었습니다.');
            setEditingUser(null);
            fetchData();
        } catch (err) { alert('수정 실패'); }
    };

    const handleDeleteUser = async () => {
        if (!editingUser) return;

        // Prevent self-deletion if current user is the one being edited
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentUser.id === editingUser.id) {
            alert('본인 계정은 삭제할 수 없습니다.');
            return;
        }

        if (!confirm(`정말 '${editingUser.name}' 회원을 삭제하시겠습니까?\n연관된 모든 데이터(로그, 메시지 등)가 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`)) return;
        try {
            const { error } = await supabase.from('users').delete().eq('id', editingUser.id);
            if (error) {
                if (error.code === '23503') {
                    throw new Error('이 사용자와 연결된 데이터가 있어 삭제할 수 없습니다. 제공된 SQL 스크립트를 먼저 실행해 주세요.');
                }
                throw error;
            }
            alert('회원이 삭제되었습니다.');
            setEditingUser(null);
            fetchData();
        } catch (err) { console.error(err); alert('삭제 실패: ' + err.message); }
    };

    const handleToggleAdminRole = async (user) => {
        if (user.user_group !== 'STAFF') { alert('STAFF 그룹만 관리자 권한을 가질 수 있습니다.'); return; }
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        const action = newRole === 'admin' ? '부여' : '해제';
        if (!confirm(`${user.name}님에게 관리자 권한을 ${action}하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('users').update({ role: newRole }).eq('id', user.id);
            if (error) throw error;
            alert(`관리자 권한이 ${action}되었습니다.`);
            fetchData();
        } catch (err) { alert('권한 변경 실패'); }
    };

    const handleApproveUser = async (user) => {
        if (!confirm(`'${user.name}' 회원을 정식 회원으로 승인하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('users').update({ status: 'approved' }).eq('id', user.id);
            if (error) throw error;
            alert('회원 승인이 완료되었습니다.');
            fetchData();
        } catch (err) { alert('승인 실패'); }
    };

    // Stats Calculation
    const userStats = useMemo(() => {
        if (!editingUser || !allLogs) return null;
        const userLogs = allLogs.filter(log => log.user_id === editingUser.id);
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        let weeklyHours = 0, monthlyHours = 0, totalHours = 0;
        const locationCounts = {};
        const sortedLogs = [...userLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        let lastCheckIn = null;

        sortedLogs.forEach(log => {
            if (log.type === 'CHECKIN') {
                lastCheckIn = new Date(log.created_at);
                if (log.location_id) locationCounts[log.location_id] = (locationCounts[log.location_id] || 0) + 1;
            } else if (log.type === 'CHECKOUT' && lastCheckIn) {
                const checkOut = new Date(log.created_at);
                const duration = (checkOut - lastCheckIn) / (1000 * 60 * 60);
                if (duration > 0 && duration < 24) {
                    totalHours += duration;
                    if (checkOut >= oneWeekAgo) weeklyHours += duration;
                    if (checkOut >= oneMonthAgo) monthlyHours += duration;
                }
                lastCheckIn = null;
            } else if (log.type === 'MOVE') {
                if (log.location_id) locationCounts[log.location_id] = (locationCounts[log.location_id] || 0) + 1;
            }
        });

        const topLocId = Object.keys(locationCounts).reduce((a, b) => locationCounts[a] > locationCounts[b] ? a : b, null);
        const topLocation = locations.find(l => l.id === topLocId)?.name || '-';

        return { weekly: Math.round(weeklyHours), monthly: Math.round(monthlyHours), total: Math.round(totalHours), topLocation };
    }, [editingUser, allLogs, locations]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="p-6 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-gray-50/30">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter">이용자 관리</h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">전체 회원 목록 조회 및 정보 수정</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto items-stretch md:items-center">
                    <div className="relative flex-1 lg:min-w-[400px] flex gap-3">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="이름, 학교 또는 뒷번호 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-14 p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-700 shadow-inner"
                            />
                        </div>
                        <button
                            onClick={() => exportUsersToExcel(users, allLogs)}
                            className="bg-white text-green-600 border border-green-100 px-6 py-4 rounded-2xl font-black hover:bg-green-600 hover:text-white transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap"
                            title="전체 명단 엑셀 다운로드"
                        >
                            <FileSpreadsheet size={20} />
                            <span className="hidden xl:inline">명단 내보내기</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 gap-4">
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                        {['ALL:전체', '청소년:청소년', '졸업생:졸업생', 'STAFF:STAFF'].map((g) => {
                            const [val, label] = g.split(':');
                            return (
                                <button key={val} onClick={() => setFilterGroup(val)} className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap transition shadow-sm ${filterGroup === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                    <button onClick={fetchData} className="p-2 text-gray-400 hover:text-blue-600 bg-white border border-gray-200 rounded-lg shadow-sm flex-shrink-0"><RefreshCw size={16} /></button>
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="p-4 pl-6">
                                    <input
                                        type="checkbox"
                                        checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="p-4">이름</th>
                                <th className="p-4">그룹</th>
                                <th className="p-4">학교</th>
                                <th className="p-4">연락처</th>
                                <th className="p-4 pr-6 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredUsers.length === 0 ? <tr><td colSpan="5" className="p-10 text-center text-gray-400">검색 결과가 없습니다.</td></tr> :
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className={`hover:bg-blue-50/10 transition group ${selectedUserIds.has(user.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="p-4 pl-6">
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.has(user.id)}
                                                onChange={() => toggleSelectUser(user.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-gray-700 flex items-center gap-2 text-sm md:text-base">
                                            {user.name}
                                            {(() => {
                                                if (user.birth && user.birth.length === 6) {
                                                    const yy = parseInt(user.birth.substring(0, 2));
                                                    const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
                                                    const age = new Date().getFullYear() - fullYear;
                                                    return <span className="text-xs text-gray-400 font-normal ml-1">({age}세)</span>;
                                                }
                                                return null;
                                            })()}
                                            {user.memo && <div className="w-2 h-2 rounded-full bg-yellow-400" title="메모 있음" />}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.user_group === '졸업생' ? 'bg-gray-200 text-gray-600' : user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {user.user_group || '재학생'}
                                                </span>
                                                {user.status === 'pending' && (
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black">승인 대기</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-500">{user.school}</td>
                                        <td className="p-4 font-mono text-gray-500 text-xs md:text-sm">{user.phone}</td>
                                        <td className="p-4 pr-6 text-right flex items-center justify-end gap-2">
                                            {user.status === 'pending' && (
                                                <button onClick={() => handleApproveUser(user)} className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 transition shadow-md whitespace-nowrap">승인</button>
                                            )}
                                            {user.user_group === 'STAFF' && (
                                                <button onClick={() => handleToggleAdminRole(user)} className={`p-2 rounded-lg transition ${user.role === 'admin' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-gray-100 text-gray-400 hover:text-indigo-600'}`} title={user.role === 'admin' ? "관리자 권한 해제" : "관리자 권한 부여"}><UserPlus size={16} /></button>
                                            )}
                                            <button onClick={() => openUserEditModal(user)} className="p-2 bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm"><Edit2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Card List */}
                <div className="md:hidden divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>
                    ) : (
                        filteredUsers.map((user) => (
                            <div
                                key={user.id}
                                className={`p-4 active:bg-gray-50 transition relative flex gap-4 items-center ${selectedUserIds.has(user.id) ? 'bg-blue-50/30' : ''}`}
                                onClick={() => toggleSelectUser(user.id)}
                            >
                                <div className="p-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.has(user.id)}
                                        onChange={() => toggleSelectUser(user.id)}
                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
                                        <span className="font-bold text-gray-800 text-base truncate">{user.name}</span>
                                        {(() => {
                                            if (user.birth && user.birth.length === 6) {
                                                const yy = parseInt(user.birth.substring(0, 2));
                                                const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
                                                const age = new Date().getFullYear() - fullYear;
                                                return <span className="text-[10px] text-gray-400 flex-shrink-0">{age}세</span>;
                                            }
                                            return null;
                                        })()}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${user.user_group === '졸업생' ? 'bg-gray-100 text-gray-500' : user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                                            {user.user_group || '재학생'}
                                        </span>
                                        {user.status === 'pending' && <span className="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">대기</span>}
                                        {user.memo && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" title="메모 있음" />}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                                        <span className="truncate max-w-[120px]">{user.school}</span>
                                        <span className="font-mono">{user.phone}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {user.status === 'pending' && (
                                        <button onClick={() => handleApproveUser(user)} className="px-3 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black hover:bg-red-700 transition shadow-md active:scale-95">승인</button>
                                    )}
                                    <button onClick={() => openUserEditModal(user)} className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 border border-gray-100 transition shadow-sm active:scale-95"><Edit2 size={16} /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>



            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">회원 정보 수정</h3>
                            <div className="flex gap-2">
                                <button onClick={handleDeleteUser} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition"><Trash2 size={20} /></button>
                                <button onClick={() => setEditingUser(null)}><X size={20} className="text-gray-400" /></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">이름</label><input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold" /></div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">그룹</label>
                                <select value={editFormData.user_group} onChange={(e) => setEditFormData({ ...editFormData, user_group: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white font-bold">
                                    <option value="청소년">청소년</option><option value="졸업생">졸업생</option><option value="STAFF">STAFF</option><option value="재학생">재학생(구)</option><option value="일반인">일반인(구)</option>
                                </select>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">학교</label><input type="text" value={editFormData.school} onChange={(e) => setEditFormData({ ...editFormData, school: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold" /></div>
                            <div><label className="text-xs font-bold text-gray-500 block mb-1">연락처 (전체)</label><input type="text" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold font-mono" /></div>

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

                            <div><label className="text-xs font-bold text-gray-500 block mb-1">메모 (관리자용)</label><textarea value={editFormData.memo} onChange={(e) => setEditFormData({ ...editFormData, memo: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none h-24 text-sm" placeholder="특이사항 입력" /></div>

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
                        <div className="p-6 pt-0"><button onClick={handleSaveUser} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"><Save size={20} /> 수정사항 저장</button></div>
                    </div>
                </div>
            )}
            {/* Bulk Action Bar */}
            {selectedUserIds.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] w-[95%] max-w-2xl bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-5 sm:p-6 shadow-[0_30px_60px_rgba(0,0,0,0.4)] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-10 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-xl font-black shadow-lg shadow-blue-500/20">
                            {selectedUserIds.size}
                        </div>
                        <div>
                            <p className="text-white font-black text-base tracking-tight leading-none mb-1">명이 선택되었습니다</p>
                            <button
                                onClick={() => setSelectedUserIds(new Set())}
                                className="text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors"
                            >
                                선택 모두 해제
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-white/40 text-xs font-bold uppercase tracking-widest hidden sm:block">변경할 그룹:</span>
                        <div className="relative flex-1 sm:flex-none">
                            <select
                                value={bulkTargetGroup}
                                onChange={(e) => setBulkTargetGroup(e.target.value)}
                                className="w-full sm:w-32 py-4 pl-4 pr-10 bg-white/10 hover:bg-white/15 text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                            >
                                <option value="청소년" className="text-gray-800">청소년</option>
                                <option value="졸업생" className="text-gray-800">졸업생</option>
                                <option value="STAFF" className="text-gray-800">STAFF</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                                <Search size={14} className="rotate-90" />
                            </div>
                        </div>

                        <button
                            onClick={() => handleBulkUpdateGroup(bulkTargetGroup)}
                            disabled={sending}
                            className="flex-1 sm:flex-none px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:bg-gray-700 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Save size={18} className={sending ? 'animate-pulse' : ''} />
                            변경 적용
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
