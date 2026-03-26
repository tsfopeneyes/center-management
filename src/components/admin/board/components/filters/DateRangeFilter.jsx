import React from 'react';
import PropTypes from 'prop-types';
import { Calendar, RefreshCw } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

const DateRangeFilter = ({ mode, filters, onFilterChange, onReset }) => {
    const hasActiveFilters = filters.title || filters.location || filters.startDate || filters.endDate || (mode === CATEGORIES.PROGRAM && filters.programType !== 'ALL');

    return (
        <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3 flex-wrap">
            <div className="flex items-center gap-2 w-full sm:w-auto p-1.5 md:p-2 bg-gray-50 rounded-xl border border-gray-100">
                <Calendar size={14} className="text-gray-400 ml-2 hidden sm:block" />
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => onFilterChange('startDate', e.target.value)}
                    className="flex-1 sm:w-[130px] p-2 bg-white border border-gray-200 rounded-lg outline-none text-xs text-gray-600 focus:border-blue-400"
                />
                <span className="text-gray-400 text-xs font-bold">~</span>
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => onFilterChange('endDate', e.target.value)}
                    className="flex-1 sm:w-[130px] p-2 bg-white border border-gray-200 rounded-lg outline-none text-xs text-gray-600 focus:border-blue-400"
                />
            </div>

            {hasActiveFilters && (
                <button
                    onClick={onReset}
                    className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center gap-2 transition text-sm font-bold border border-gray-200 shrink-0"
                >
                    <RefreshCw size={14} /> <span>초기화</span>
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
