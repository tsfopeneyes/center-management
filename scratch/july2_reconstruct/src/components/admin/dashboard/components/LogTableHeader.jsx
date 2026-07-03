import React from 'react';
import { Filter } from 'lucide-react';
import CheckboxFilter from '../../../common/CheckboxFilter';

const LogTableHeader = ({
    filteredVisitSummaries,
    selectedRows,
    handleSelectAll,
    filterOptions,
    visitFilters,
    setVisitFilters,
    toggleFilter
}) => {
    return (
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
            <tr className="border-b border-gray-100 border-l-4 border-l-transparent">
                <th className="p-4 pl-6 w-10">
                    <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onChange={handleSelectAll}
                        checked={filteredVisitSummaries.length > 0 && selectedRows.size === filteredVisitSummaries.length}
                    />
                </th>
                <th className="p-4 min-w-[100px]">
                    <CheckboxFilter
                        label="주차구분"
                        options={filterOptions.weekIds}
                        selectedValues={visitFilters.weekIds}
                        onToggle={(val) => toggleFilter('weekIds', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, weekIds: filterOptions.weekIds }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, weekIds: [] }))}
                    />
                </th>
                <th className="p-4 min-w-[100px]">
                    <CheckboxFilter
                        label="날짜"
                        options={filterOptions.dates}
                        selectedValues={visitFilters.dates}
                        onToggle={(val) => toggleFilter('dates', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, dates: filterOptions.dates }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, dates: [] }))}
                    />
                </th>
                <th className="p-4 min-w-[90px]">
                    <CheckboxFilter
                        label="요일"
                        options={filterOptions.days}
                        selectedValues={visitFilters.days}
                        onToggle={(val) => toggleFilter('days', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, days: filterOptions.days }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, days: [] }))}
                    />
                </th>
                <th className="p-4 min-w-[120px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                            <span>학교</span>
                            {visitFilters.school && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-bold bg-white border px-3 py-1.5 text-xs w-full rounded-xl outline-none transition-all shadow-sm ${visitFilters.school ? 'border-blue-400 bg-blue-50/10 text-blue-600 focus:bg-white' : 'border-gray-200 hover:border-gray-300 focus:bg-white focus:border-blue-500'}`}
                            placeholder="학교 검색"
                            value={visitFilters.school}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, school: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-4 min-w-[90px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                            <span>나이</span>
                            {visitFilters.age && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-bold bg-white border px-3 py-1.5 text-xs w-full rounded-xl outline-none transition-all shadow-sm ${visitFilters.age ? 'border-blue-400 bg-blue-50/10 text-blue-600 focus:bg-white' : 'border-gray-200 hover:border-gray-300 focus:bg-white focus:border-blue-500'}`}
                            placeholder="나이 검색"
                            value={visitFilters.age}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, age: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-4 min-w-[110px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                            <span>이름</span>
                            {visitFilters.name && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-bold bg-white border px-3 py-1.5 text-xs w-full rounded-xl outline-none transition-all shadow-sm ${visitFilters.name ? 'border-blue-400 bg-blue-50/10 text-blue-600 focus:bg-white' : 'border-gray-200 hover:border-gray-300 focus:bg-white focus:border-blue-500'}`}
                            placeholder="이름 검색"
                            value={visitFilters.name}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-4 font-bold text-gray-400 text-[11px] min-w-[80px] text-center">시작시간</th>
                <th className="p-4 font-bold text-gray-400 text-[11px] min-w-[80px] text-center">끝시간</th>
                <th className="p-4 min-w-[120px]">
                    <CheckboxFilter
                        label="사용공간"
                        options={filterOptions.spaces}
                        selectedValues={visitFilters.space}
                        onToggle={(val) => toggleFilter('space', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, space: filterOptions.spaces }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, space: [] }))}
                    />
                </th>
                <th className="p-4 font-bold text-gray-400 text-[11px] min-w-[90px] text-center">센터타임</th>
                <th className="p-4 min-w-[130px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                            <span>센터타임(분)</span>
                            {visitFilters.duration && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-bold bg-white border px-3 py-1.5 text-xs w-full rounded-xl outline-none transition-all shadow-sm ${visitFilters.duration ? 'border-blue-400 bg-blue-50/10 text-blue-600 focus:bg-white' : 'border-gray-200 hover:border-gray-300 focus:bg-white focus:border-blue-500'}`}
                            placeholder="시간(분) 검색"
                            value={visitFilters.duration}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, duration: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-4 min-w-[200px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                            <span>방문목적</span>
                            {visitFilters.purpose && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-bold bg-white border px-3 py-1.5 text-xs w-full rounded-xl outline-none transition-all shadow-sm ${visitFilters.purpose ? 'border-blue-400 bg-blue-50/10 text-blue-600 focus:bg-white' : 'border-gray-200 hover:border-gray-300 focus:bg-white focus:border-blue-500'}`}
                            placeholder="방문목적 검색"
                            value={visitFilters.purpose}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, purpose: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-4 pr-6 min-w-[180px]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold">
                            <span>비고</span>
                            {visitFilters.remarks && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-bold bg-white border px-3 py-1.5 text-xs w-full rounded-xl outline-none transition-all shadow-sm ${visitFilters.remarks ? 'border-blue-400 bg-blue-50/10 text-blue-600 focus:bg-white' : 'border-gray-200 hover:border-gray-300 focus:bg-white focus:border-blue-500'}`}
                            placeholder="비고 검색"
                            value={visitFilters.remarks}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, remarks: e.target.value }))}
                        />
                    </div>
                </th>
            </tr>
        </thead>
    );
};

export default LogTableHeader;
