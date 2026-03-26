import React from 'react';
import PropTypes from 'prop-types';
import { Search, PlusCircle, UserPlus, X } from 'lucide-react';

const WalkInSection = ({ 
    searchQuery, 
    handleUserSearch, 
    searchResults, 
    addWalkIn, 
    lastAddedUser,
    activeUsersCount,
    setShowEntranceList 
}) => {
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
                    현재 입실 인원: {activeUsersCount}명
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
                
                {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {searchResults.map(user => (
                            <button 
                                key={user.id} 
                                onClick={() => addWalkIn(user)}
                                className="w-full p-4 text-left hover:bg-blue-50 flex justify-between items-center transition border-b border-gray-50 last:border-0 group"
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
                                        <span className="font-bold text-sm text-gray-800">{user.name}</span>
                                        <span className="text-[10px] text-gray-500">{user.school} | {user.phone_back4}</span>
                                    </div>
                                </div>
                                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 group-hover:bg-green-500 group-hover:text-white text-gray-400 transition-all">
                                    <PlusCircle size={18} />
                                </span>
                            </button>
                        ))}
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
    lastAddedUser: PropTypes.object,
    activeUsersCount: PropTypes.number,
    setShowEntranceList: PropTypes.func.isRequired
};

export default React.memo(WalkInSection);
