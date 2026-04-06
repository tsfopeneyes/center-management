import React from 'react';
import PropTypes from 'prop-types';
import { Calendar, RefreshCw } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

const DateRangeFilter = ({ mode, filters, onFilterChange, onReset }) => {
    const hasActiveFilters = filters.title || filters.location || filters.startDate || filters.endDate || (mode === CATEGORIES.PROGRAM && filters.programType !== 'ALL');

    return (
        <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg border border-gray-100 h-[30px]">
                <Calendar size={12} className="text-gray-400 ml-1 hidden sm:block" />
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => onFilterChange('startDate', e.target.value)}
                    className="w-[90px] sm:w-[100px] p-0.5 bg-transparent border-none outline-none text-[11px] text-gray-600 focus:text-blue-600 cursor-pointer"
                />
                <span className="text-gray-400 text-[10px] font-bold">~</span>
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => onFilterChange('endDate', e.target.value)}
                    className="w-[90px] sm:w-[100px] p-0.5 bg-transparent border-none outline-none text-[11px] text-gray-600 focus:text-blue-600 cursor-pointer"
                />
            </div>

            {hasActiveFilters && (
                <button
                    onClick={onReset}
                    className="h-[30px] px-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center transition border border-gray-100 shrink-0"
                    title="초기화"
                >
                    <RefreshCw size={12} />
                </button>
            )}
        </div>
    );
};

DateRangeFilter.propTypes = {
    mode: PropTypes.string.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired
};

export default React.memo(DateRangeFilter);
