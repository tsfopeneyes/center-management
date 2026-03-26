import React from 'react';
import UserAvatar from '../../../common/UserAvatar';

const RealtimeActiveUsers = ({
    activeUsersList,
    handleForceCheckout
}) => {
    return (
        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/20">
                <h3 className="font-black text-xl text-gray-800 tracking-tight">실시간 입실 현황</h3>
                <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full shadow-sm uppercase tracking-widest border border-blue-100">Total {activeUsersList.length}</span>
            </div>

            {activeUsersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 text-gray-300 font-bold">
                    <p>현재 입실 중인 이용자가 없습니다.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-widest font-black border-b border-gray-50">
                                <tr>
                                    <th className="p-6 pl-10">이름</th>
                                    <th className="p-6">현재 위치</th>
                                    <th className="p-6">학교</th>
                                    <th className="p-6">그룹</th>
                                    <th className="p-6 pr-10 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {activeUsersList.map(user => (
                                    <tr key={user.id} className="hover:bg-blue-50/20 transition-all duration-300 group">
                                        <td className="p-6 pl-10 font-bold text-gray-700 flex items-center gap-3">
                                            <UserAvatar user={user} size="w-10 h-10" textSize="text-sm" />
                                            {user.name}
                                            {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                        </td>
                                        <td className="p-6 text-blue-600 font-black">{user.currentLocationName}</td>
                                        <td className="p-6 text-gray-500 font-medium">{user.school || '-'}</td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${user.user_group === '졸업생' ? 'bg-gray-100 text-gray-600' :
                                                user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {user.user_group || '재학생'}
                                            </span>
                                        </td>
                                        <td className="p-6 pr-10 text-right">
                                            <button
                                                onClick={() => handleForceCheckout(user.id)}
                                                className="px-4 py-2 bg-white border border-red-100 text-red-500 text-[11px] font-black rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-300 shadow-sm"
                                            >
                                                강제 퇴실
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {activeUsersList.map(user => (
                            <div key={user.id} className="p-4 active:bg-gray-50 transition flex items-center justify-between gap-4">
                                <UserAvatar user={user} size="w-10 h-10" textSize="text-xs" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-800 text-base truncate flex items-center gap-1">
                                            {user.name}
                                            {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${user.user_group === '졸업생' ? 'bg-gray-100 text-gray-500' :
                                            user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                'bg-blue-50 text-blue-500'
                                            }`}>
                                            {user.user_group || '재학생'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded">{user.currentLocationName}</span>
                                        <span className="truncate">{user.school}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleForceCheckout(user.id)}
                                    className="bg-red-50 text-red-500 border border-red-100 px-3 py-2 rounded-xl transition font-bold text-xs flex-shrink-0 active:bg-red-500 active:text-white active:border-red-500 shadow-sm"
                                >
                                    퇴실
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
};

export default RealtimeActiveUsers;
