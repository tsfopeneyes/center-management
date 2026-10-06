import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Search, PlusCircle, UserPlus, X, Check, CheckSquare } from 'lucide-react';

const WalkInSection = ({ 
    searchQuery, 
    handleUserSearch, 
    searchResults, 
    addWalkIn,
    addMultipleWalkIns,
    lastAddedUser,
    activeUsersCount,
    setShowEntranceList,
    activeSpaceUsers,
    alreadyJoinedUserIds
}) => {
    const [selectedUsers, setSelectedUsers] = useState(new Set());

    const toggleUserSelect = (userId) => {
        setSelectedUsers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleBulkSubmit = () => {
        if (!selectedUsers.size) return;
        const usersToAdd = activeSpaceUsers.filter(u => selectedUsers.has(u.id));
        addMultipleWalkIns(usersToAdd);
        setSelectedUsers(new Set()); // Reset after adding
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-white p-4 md:p-6">
            <button 
                onClick={() => setShowEntranceList(false)}
                className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="현장 추가 패널 닫기"
            >
                <X size={16} />
            </button>
            <div className="mr-10 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <UserPlus size={18} /> 현장 접수 (비신청자)
                </h3>
                <span className="text-sm font-medium text-slate-500">
                    현재 입실 인원: {activeUsersCount || 0}명
                </span>
            </div>
            
            {lastAddedUser && (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">
                    <Check size={17} /> {lastAddedUser.name} 학생이 출석 처리 되었습니다.
                </div>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={16} />
                </div>
                <input 
                    type="text" 
                    placeholder="학생 이름 또는 전화번호 뒷자리 검색..." 
                    value={searchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-blue-100"
                    autoFocus
                />
                
                {searchQuery !== '' && searchResults.length > 0 && (
                    <div className="relative z-10 mt-2 max-h-60 w-full shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                        {searchResults.map(user => {
                            const isJoined = alreadyJoinedUserIds?.has(user.id);
                            return (
                                <button 
                                    key={user.id} 
                                    onClick={() => {
                                        if (!isJoined) addWalkIn(user);
                                    }}
                                    disabled={isJoined}
                                    className={`w-full p-4 text-left flex justify-between items-center transition border-b border-gray-50 last:border-0 group ${
                                        isJoined ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex gap-3 items-center">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border-2 border-white shadow-sm overflow-hidden">
                                            {user.profile_image_url ? (
                                                <img src={user.profile_image_url} alt="profile" className="w-full h-full object-cover" />
                                            ) : (
                                                user.name?.charAt(0) || '?'
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-bold text-sm flex items-center gap-1 ${isJoined ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                {user.name}
                                                {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                            </span>
                                            <span className="text-xs text-slate-500">{user.school} · {user.phone_back4}</span>
                                        </div>
                                    </div>
                                    {isJoined ? (
                                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">추가됨</span>
                                    ) : (
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-[#3182f6] group-hover:text-white">
                                            <PlusCircle size={18} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
                {searchQuery !== '' && searchResults.length === 0 && (
                    <div className="relative z-10 mt-2 w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-500">
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {searchQuery === '' && (
                <div className="mt-2 border-t border-slate-100 pt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-700">
                            현재 공간 입실 인원 ({activeSpaceUsers?.length || 0}명)
                        </h4>
                        {selectedUsers.size > 0 && (
                            <button 
                                onClick={handleBulkSubmit}
                                className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[#3182f6] px-3 text-sm font-semibold text-white hover:bg-[#1b64da]"
                            >
                                <CheckSquare size={14} />
                                선택 인원 참석 처리 ({selectedUsers.size}명)
                            </button>
                        )}
                    </div>
                    
                    {activeSpaceUsers && activeSpaceUsers.length > 0 ? (
                        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                            {activeSpaceUsers.map(user => {
                                const isJoined = alreadyJoinedUserIds?.has(user.id);
                                const isSelected = selectedUsers.has(user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => {
                                            if (!isJoined) toggleUserSelect(user.id);
                                        }}
                                        disabled={isJoined}
                                        className={`group flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                                            isJoined
                                                ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                                                : isSelected 
                                                    ? 'border-[#3182f6] bg-blue-50'
                                                    : 'border-slate-200 bg-white hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                                                {user.profile_image_url ? (
                                                    <img src={user.profile_image_url} alt="profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    user.name?.charAt(0) || '?'
                                                )}
                                            </div>
                                            {isSelected && !isJoined && (
                                                <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#3182f6] text-white">
                                                    <Check size={10} strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className={`flex items-center gap-1 truncate text-sm font-semibold ${isJoined ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                                {user.name}
                                                {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                            </span>
                                            <span className="truncate text-xs text-slate-500">{user.school}</span>
                                        </div>
                                        {isJoined && (
                                            <span className="ml-auto shrink-0 self-start whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                                                추가됨
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-6 text-center">
                            <p className="text-sm text-slate-500">현재 입실 중인 학생이 없습니다.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

WalkInSection.propTypes = {
    searchQuery: PropTypes.string.isRequired,
    handleUserSearch: PropTypes.func.isRequired,
    searchResults: PropTypes.array.isRequired,
    addWalkIn: PropTypes.func.isRequired,
    addMultipleWalkIns: PropTypes.func,
    lastAddedUser: PropTypes.object,
    activeUsersCount: PropTypes.number,
    setShowEntranceList: PropTypes.func.isRequired,
    activeSpaceUsers: PropTypes.array,
    alreadyJoinedUserIds: PropTypes.instanceOf(Set)
};

export default React.memo(WalkInSection);
