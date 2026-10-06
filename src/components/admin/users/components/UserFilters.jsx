import React from 'react';
import { Search, RefreshCw, FileSpreadsheet, Users, BellRing } from 'lucide-react';
import { exportUsersToExcel } from '../../../../utils/exportUtils';
import AdminPageHeader from '../../common/AdminPageHeader';

const UserFilters = ({
    users, allLogs,
    searchTerm, setSearchTerm,
    filterGroup, setFilterGroup,
    filterRegion, setFilterRegion,
    excludeLeaders, setExcludeLeaders,
    showOnlyNonSchoolChurch, setShowOnlyNonSchoolChurch,
    showOnlyNew3Months, setShowOnlyNew3Months,
    filteredUsers,
    setNotificationModalOpen,
    fetchData,
    title = '이용자 관리',
    subtitle = '전체 회원 목록 조회 및 정보 수정',
    showActions = true,
    showSearch = true,
    compact = false
}) => {
    const actions = (showSearch || showActions) ? (
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full lg:w-auto items-stretch md:items-center">
            <div className="relative flex-1 lg:min-w-[400px] flex gap-2 md:gap-3">
                {showSearch && <div className="relative flex-1 group">
                    <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} md:size={20} />
                    <input
                        type="text"
                        placeholder="이름, 학교, 연락처 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 md:pl-14 p-3 md:p-3.5 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-gray-700 shadow-inner text-sm"
                    />
                </div>}
                {showActions && <button
                    onClick={() => exportUsersToExcel(users, allLogs)}
                    className="bg-white text-green-600 border border-green-100 px-4 py-2.5 rounded-xl md:rounded-2xl font-black hover:bg-green-600 hover:text-white transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap text-xs md:text-sm"
                    title="엑셀 다운로드"
                >
                    <FileSpreadsheet size={16} />
                    <span className="hidden sm:inline">내보내기</span>
                </button>}
                {showActions && <button
                    onClick={() => setNotificationModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2.5 rounded-xl md:rounded-2xl font-black hover:bg-blue-700 transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap text-xs md:text-sm"
                    title="알림 발송"
                >
                    <BellRing size={16} />
                    <span className="hidden sm:inline">알림 발송</span>
                </button>}
            </div>
        </div>
    ) : null;

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <AdminPageHeader
                title={title}
                subtitle={subtitle}
                icon={<Users />}
                actions={actions}
                compact={compact}
            />

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <span className="w-20 shrink-0 text-[13px] font-black text-gray-600">학교 지역</span>
                    <div className="flex min-w-0 gap-1.5 overflow-x-auto no-scrollbar py-1">
                        {[
                            ['ALL', '전체'],
                            ['강동', '강동'],
                            ['강서', '강서'],
                            ['미지정', '미지정']
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setFilterRegion(value)}
                                aria-pressed={filterRegion === value}
                                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition md:text-[13px] ${filterRegion === value
                                    ? value === '강서'
                                        ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                                        : value === '미지정'
                                            ? 'border-gray-600 bg-gray-600 text-white shadow-sm'
                                            : 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="w-20 shrink-0 text-[13px] font-black text-gray-600">이용자 유형</span>
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 items-center">
                    {['ALL:전체', 'NEW_3M:신규 (3개월)', 'LEADER:리더', '청소년:청소년', '졸업생:졸업생', 'STAFF:STAFF', 'TEMP_GUEST:게스트'].map((g) => {
                        const [val, label] = g.split(':');
                        return (
                            <button key={val} onClick={() => {
                                setFilterGroup(val);
                                if (val !== '청소년') {
                                    setExcludeLeaders(false);
                                    setShowOnlyNonSchoolChurch(false);
                                }
                            }} className={`px-3 py-1.5 rounded-lg text-xs md:text-[13px] font-bold whitespace-nowrap transition shadow-sm ${filterGroup === val
                                ? (val === 'TEMP_GUEST' ? 'bg-amber-500 text-white border-amber-500' : val === 'NEW_3M' ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold' : 'bg-blue-600 text-white border-blue-600')
                                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                {label}
                            </button>
                        )
                    })}

                    {filterGroup !== 'NEW_3M' && (
                        <button
                            onClick={() => setShowOnlyNew3Months(!showOnlyNew3Months)}
                            className={`px-3 py-1.5 rounded-lg text-xs md:text-[13px] font-bold whitespace-nowrap transition shadow-sm flex items-center gap-1.5 ml-1 ${showOnlyNew3Months
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-emerald-100'
                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            title="최근 3개월 이내 가입한 회원만 보기"
                        >
                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${showOnlyNew3Months ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300'
                                }`}>
                                {showOnlyNew3Months && <svg viewBox="0 0 14 14" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 7 6 10 11 4"></polyline></svg>}
                            </div>
                            최근 3개월 가입
                        </button>
                    )}

                    {filterGroup === '청소년' && (
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                            
                            <button
                                onClick={() => setShowOnlyNonSchoolChurch(!showOnlyNonSchoolChurch)}
                                className={`px-3 py-1.5 rounded-lg text-xs md:text-[13px] font-bold whitespace-nowrap transition shadow-sm flex items-center gap-1.5 ${showOnlyNonSchoolChurch
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
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[13px] font-black shadow-sm flex items-center gap-1.5">
                        <Users size={14} className="text-blue-500" />
                        {filteredUsers.length}명
                    </div>
                    <button onClick={fetchData} className="p-2 text-gray-400 hover:text-blue-600 bg-white border border-gray-200 rounded-lg shadow-sm" title="새로고침">
                        <RefreshCw size={16} />
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserFilters;
