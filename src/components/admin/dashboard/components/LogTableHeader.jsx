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
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
            <tr className="border-b border-gray-100">
                <th className="p-3 pl-6 w-10">
                    <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onChange={handleSelectAll}
                        checked={filteredVisitSummaries.length > 0 && selectedRows.size === filteredVisitSummaries.length}
                    />
                </th>
                <th className="p-3">
                    <CheckboxFilter
                        label="주차구분"
                        options={filterOptions.weekIds}
                        selectedValues={visitFilters.weekIds}
                        onToggle={(val) => toggleFilter('weekIds', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, weekIds: filterOptions.weekIds }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, weekIds: [] }))}
                    />
                </th>
                <th className="p-3">
                    <CheckboxFilter
                        label="날짜"
                        options={filterOptions.dates}
                        selectedValues={visitFilters.dates}
                        onToggle={(val) => toggleFilter('dates', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, dates: filterOptions.dates }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, dates: [] }))}
                    />
                </th>
                <th className="p-3">
                    <CheckboxFilter
                        label="요일"
                        options={filterOptions.days}
                        selectedValues={visitFilters.days}
                        onToggle={(val) => toggleFilter('days', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, days: filterOptions.days }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, days: [] }))}
                    />
                </th>
                <th className="p-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <span>학교</span>
                            {visitFilters.school && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.school ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                            placeholder="검색..."
                            value={visitFilters.school}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, school: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <span>나이</span>
                            {visitFilters.age && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.age ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                            placeholder="검색..."
                            value={visitFilters.age}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, age: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <span>이름</span>
                            {visitFilters.name && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.name ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                            placeholder="검색..."
                            value={visitFilters.name}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-3">시작시간</th>
                <th className="p-3">끝시간</th>
                <th className="p-3">
                    <CheckboxFilter
                        label="사용공간"
                        options={filterOptions.spaces}
                        selectedValues={visitFilters.space}
                        onToggle={(val) => toggleFilter('space', val)}
                        onSelectAll={() => setVisitFilters(prev => ({ ...prev, space: filterOptions.spaces }))}
                        onClear={() => setVisitFilters(prev => ({ ...prev, space: [] }))}
                    />
                </th>
                <th className="p-3">센터타임</th>
                <th className="p-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <span>센터타임(분)</span>
                            {visitFilters.duration && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.duration ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                            placeholder="검색..."
                            value={visitFilters.duration}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, duration: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <span>방문목적</span>
                            {visitFilters.purpose && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.purpose ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                            placeholder="검색..."
                            value={visitFilters.purpose}
                            onChange={(e) => setVisitFilters(prev => ({ ...prev, purpose: e.target.value }))}
                        />
                    </div>
                </th>
                <th className="p-3 pr-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <span>비고</span>
                            {visitFilters.remarks && <Filter size={10} className="text-blue-500" />}
                        </div>
                        <input
                            className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.remarks ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                            placeholder="검색..."
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
