import React from 'react';
import { Search, RefreshCw, FileSpreadsheet, Users, BellRing } from 'lucide-react';
import { exportUsersToExcel } from '../../../../utils/exportUtils';

const UserFilters = ({
    users, allLogs,
    searchTerm, setSearchTerm,
    filterGroup, setFilterGroup,
    excludeLeaders, setExcludeLeaders,
    showOnlyNonSchoolChurch, setShowOnlyNonSchoolChurch,
    filteredUsers,
    setNotificationModalOpen,
    fetchData
}) => {
    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 md:gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div className="flex items-center justify-between w-full lg:w-auto">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                            <Users className="text-blue-600" size={24} md:size={32} />
                            이용자 관리
                        </h2>
                        <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">전체 회원 목록 조회 및 정보 수정</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full lg:w-auto items-stretch md:items-center">
                    <div className="relative flex-1 lg:min-w-[400px] flex gap-2 md:gap-3">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} md:size={20} />
                            <input
                                type="text"
                                placeholder="검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 md:pl-14 p-3 md:p-4 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-700 shadow-inner text-sm md:text-base"
                            />
                        </div>
                        <button
                            onClick={() => exportUsersToExcel(users, allLogs)}
                            className="bg-white text-green-600 border border-green-100 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-black hover:bg-green-600 hover:text-white transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap text-xs md:text-base"
                            title="엑셀 다운로드"
                        >
                            <FileSpreadsheet size={18} md:size={20} />
                            <span className="hidden sm:inline">내보내기</span>
                        </button>
                        <button
                            onClick={() => setNotificationModalOpen(true)}
                            className="bg-blue-600 text-white px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-black hover:bg-blue-700 transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap text-xs md:text-base"
                            title="알림 발송"
                        >
                            <BellRing size={18} md:size={20} />
                            <span className="hidden sm:inline">알림 발송</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl gap-4">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 items-center">
                    {['ALL:전체', 'LEADER:리더', '청소년:청소년', '졸업생:졸업생', 'STAFF:STAFF', 'TEMP_GUEST:게스트/임시'].map((g) => {
                        const [val, label] = g.split(':');
                        return (
                            <button key={val} onClick={() => {
                                setFilterGroup(val);
                                if (val !== '청소년') {
                                    setExcludeLeaders(false);
                                    setShowOnlyNonSchoolChurch(false);
                                }
                            }} className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap transition shadow-sm ${filterGroup === val
                                ? (val === 'TEMP_GUEST' ? 'bg-amber-500 text-white border-amber-500' : 'bg-blue-600 text-white border-blue-600')
                                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                {label}
                            </button>
                        )
                    })}

                    {filterGroup === '청소년' && (
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                            <button
                                onClick={() => setExcludeLeaders(!excludeLeaders)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap transition shadow-sm flex items-center gap-1.5 ${excludeLeaders
                                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 shadow-yellow-100'
                                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${excludeLeaders ? 'bg-yellow-500 border-yellow-500' : 'bg-white border-gray-300'
                                    }`}>
                                    {excludeLeaders && <svg viewBox="0 0 14 14" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 7 6 10 11 4"></polyline></svg>}
                                </div>
                                리더 제외
                            </button>
                            <button
                                onClick={() => setShowOnlyNonSchoolChurch(!showOnlyNonSchoolChurch)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap transition shadow-sm flex items-center gap-1.5 ${showOnlyNonSchoolChurch
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-emerald-100'
                                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${showOnlyNonSchoolChurch ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300'
                                    }`}>
                                    {showOnlyNonSchoolChurch && <svg viewBox="0 0 14 14" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 7 6 10 11 4"></polyline></svg>}
                                </div>
                                스처 X
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-black shadow-sm flex items-center gap-1.5">
                        <Users size={14} className="text-blue-500" />
                        {filteredUsers.length}명
                    </div>
                    <button onClick={fetchData} className="p-2 text-gray-400 hover:text-blue-600 bg-white border border-gray-200 rounded-lg shadow-sm" title="새로고침">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFilters;
