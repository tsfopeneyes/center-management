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
        <div className="p-4 md:p-6 bg-blue-50/50 border-b border-blue-100 flex flex-col gap-4 animate-fade-in relative">
            <button 
                onClick={() => setShowEntranceList(false)}
                className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full text-blue-400 hover:text-blue-600 transition shadow-sm"
                title="현장 추가 패널 닫기"
            >
                <X size={16} />
            </button>
            <div className="flex justify-between items-center mr-10">
                <h3 className="font-bold text-blue-800 flex items-center gap-2">
                    <UserPlus size={18} /> 현장 접수 (비신청자)
                </h3>
                <span className="text-[10px] font-bold text-blue-500 bg-white px-2 py-1 rounded-full shadow-sm">
                    현재 입실 인원: {activeUsersCount || 0}명
                </span>
            </div>
            
            {lastAddedUser && (
                <div className="bg-green-100 text-green-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                    <span className="text-lg">✅</span> {lastAddedUser.name} 학생이 출석 처리 되었습니다.
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
                    className="w-full pl-10 pr-4 py-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm shadow-sm"
                    autoFocus
                />
                
                {searchQuery !== '' && searchResults.length > 0 && (
                    <div className="w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-sm max-h-60 overflow-y-auto shrink-0 relative z-10">
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
                                        isJoined ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'hover:bg-blue-50'
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
                                            <span className="text-[10px] text-gray-500">{user.school} | {user.phone_back4}</span>
                                        </div>
                                    </div>
                                    {isJoined ? (
                                        <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-1 rounded-lg">추가됨</span>
                                    ) : (
                                        <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 group-hover:bg-green-500 group-hover:text-white text-gray-400 transition-all">
                                            <PlusCircle size={18} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
                {searchQuery !== '' && searchResults.length === 0 && (
                    <div className="w-full mt-2 p-4 text-center bg-white border border-gray-100 rounded-xl shadow-sm text-gray-500 font-bold text-sm shrink-0 relative z-10">
                        검색 결과가 없습니다.
                    </div>
                )}
                {searchQuery === '' && (
                    <div className="mt-6 animate-fade-in group/bulk">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-gray-500 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                현재 공간 입실 인원 ({activeSpaceUsers?.length || 0}명)
                            </h4>
                            {selectedUsers.size > 0 && (
                                <button 
                                    onClick={handleBulkSubmit}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-95"
                                >
                                    <CheckSquare size={14} />
                                    선택 인원 참석 처리 ({selectedUsers.size}명)
                                </button>
                            )}
                        </div>
                        
                        {activeSpaceUsers && activeSpaceUsers.length > 0 ? (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
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
                                            className={`flex items-center gap-2 p-2 rounded-xl transition-all text-left group border ${
                                                isJoined
                                                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed shadow-none'
                                                    : isSelected 
                                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' 
                                                        : 'bg-white border-gray-100 hover:border-blue-300 shadow-sm'
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
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white">
                                                        <Check size={10} strokeWidth={4} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className={`font-bold text-xs truncate flex items-center gap-1 ${isJoined ? 'text-gray-500 line-through' : isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                                                    {user.name}
                                                    {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                                </span>
                                                <span className="text-[9px] text-gray-500 truncate">{user.school}</span>
                                            </div>
                                            {isJoined && (
                                                <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-md self-start ml-auto whitespace-nowrap shrink-0">
                                                    추가됨
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-white/50 rounded-xl border border-gray-100 border-dashed">
                                <p className="text-xs text-gray-400 font-bold">현재 입실 중인 학생이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
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
