import React from 'react';
import { Edit2 } from 'lucide-react';
import UserAvatar from '../../../common/UserAvatar';

const UserTable = ({
    filteredUsers,
    selectedUserIds,
    toggleSelectAll,
    toggleSelectUser,
    handleApproveUser,
    setEditingUser
}) => {
    return (
        <React.Fragment>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse bg-white">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-y border-gray-100">
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
                        {filteredUsers.length === 0 ? <tr><td colSpan="6" className="p-10 text-center text-gray-400">검색 결과가 없습니다.</td></tr> :
                            filteredUsers.map((user) => (
                                <tr key={user.id} className={`hover:bg-blue-50/10 transition group ${selectedUserIds.has(user.id) ? 'bg-blue-50/30' : ''}`}>
                                    <td className="p-4 pl-6 align-middle">
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.has(user.id)}
                                            onChange={() => toggleSelectUser(user.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 block"
                                        />
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="flex items-center gap-2 text-sm md:text-base">
                                            <UserAvatar user={user} size="w-8 h-8" textSize="text-[10px]" />
                                            <span className="font-bold text-gray-700 whitespace-nowrap">{user.name}</span>
                                            {user.preferences?.is_temporary && <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-md text-[9px] font-black leading-none flex items-center shrink-0">미가입</span>}
                                            {user.is_leader && <span title="리더" className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></span>}
                                            {(() => {
                                                if (user.birth && user.birth.length === 6) {
                                                    const yy = parseInt(user.birth.substring(0, 2));
                                                    const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
                                                    const age = new Date().getFullYear() - fullYear;
                                                    return <span className="text-xs text-gray-400 font-normal ml-0.5">({age}세)</span>;
                                                }
                                                return null;
                                            })()}
                                            {user.memo && <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" title="메모 있음" />}
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <div className="flex items-center">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block leading-none ${user.user_group === '졸업생' ? 'bg-gray-200 text-gray-600' : user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {user.user_group || '재학생'}
                                            </span>
                                            {user.status === 'pending' && (
                                                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black leading-none">승인 대기</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-500 align-middle">{user.school}</td>
                                    <td className="p-4 font-mono text-gray-500 text-xs md:text-sm align-middle">{user.phone}</td>
                                    <td className="p-4 pr-6 align-middle">
                                        <div className="flex items-center justify-end gap-2">
                                            {user.status === 'pending' && (
                                                <button onClick={() => handleApproveUser(user)} className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 transition shadow-md whitespace-nowrap">승인</button>
                                            )}
                                            <button onClick={() => setEditingUser(user)} className="p-2 bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm"><Edit2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {/* Mobile Table View */}
            <div className="md:hidden divide-y divide-gray-100 bg-white">
                {filteredUsers.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>
                ) : (
                    filteredUsers.map((user) => (
                        <div
                            key={user.id}
                            className={`p-3 active:bg-gray-50 transition relative flex gap-3 items-center ${selectedUserIds.has(user.id) ? 'bg-blue-50/30' : ''}`}
                            onClick={() => toggleSelectUser(user.id)}
                        >
                            <UserAvatar user={user} size="w-10 h-10" textSize="text-xs" />
                            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={selectedUserIds.has(user.id)}
                                    onChange={() => toggleSelectUser(user.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 overflow-hidden">
                                    <span className="font-bold text-gray-800 text-sm truncate">{user.name}</span>
                                    {user.preferences?.is_temporary && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-md text-[9px] font-black shrink-0">미가입</span>}
                                    {user.is_leader && <span title="리더"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></span>}
                                    {(() => {
                                        if (user.birth && user.birth.length === 6) {
                                            const yy = parseInt(user.birth.substring(0, 2));
                                            const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
                                            const age = new Date().getFullYear() - fullYear;
                                            return <span className="text-[9px] text-gray-400 flex-shrink-0">({age}세)</span>;
                                        }
                                        return null;
                                    })()}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${user.user_group === '졸업생' ? 'bg-gray-100 text-gray-500' : user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                                        {user.user_group || '재학생'}
                                    </span>
                                    {user.status === 'pending' && <span className="bg-red-100 text-red-600 text-[8px] font-black px-1 py-0.5 rounded-full">대기</span>}
                                    {user.memo && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" title="메모 있음" />}
                                </div>
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
                                    <span className="truncate max-w-[100px]">{user.school}</span>
                                    <span className="font-mono">{user.phone}</span>
                                </div>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {user.status === 'pending' && (
                                    <button onClick={() => handleApproveUser(user)} className="px-2 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black hover:bg-red-700 transition shadow-md active:scale-95">승인</button>
                                )}
                                <button onClick={() => setEditingUser(user)} className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 border border-gray-100 transition shadow-sm active:scale-95"><Edit2 size={14} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </React.Fragment>
    );
};

export default UserTable;
