import React from 'react';
import PropTypes from 'prop-types';
import SearchInputs from './SearchInputs';
import DateRangeFilter from './DateRangeFilter';
import ViewModeToggle from './ViewModeToggle';
import { CATEGORIES, PROGRAM_TYPES } from '../../utils/constants';

const FilterBar = ({ 
    mode, 
    filters, 
    onFilterChange, 
    onResetFilters, 
    viewMode, 
    onViewModeChange, 
    resultCount 
}) => {
    return (
        <div className="px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 flex flex-col gap-3 animate-fade-in-up">
            <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full justify-start">
                    <SearchInputs 
                        mode={mode} 
                        filters={filters} 
                        onFilterChange={onFilterChange} 
                    />
                    
                    {mode === CATEGORIES.PROGRAM && (
                        <select 
                            value={filters.programType} 
                            onChange={(e) => onFilterChange('programType', e.target.value)}
                            className="h-[30px] px-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition text-[11px] font-bold text-gray-700 shrink-0 cursor-pointer"
                        >
                            <option value={PROGRAM_TYPES.ALL}>전체</option>
                            <option value={PROGRAM_TYPES.CENTER}>센터</option>
                            <option value={PROGRAM_TYPES.SCHOOL_CHURCH}>스처</option>
                        </select>
                    )}
                    
                    <DateRangeFilter 
                        mode={mode}
                        filters={filters}
                        onFilterChange={onFilterChange}
                        onReset={onResetFilters}
                    />
                    
                    <ViewModeToggle 
                        viewMode={viewMode}
                        onViewModeChange={onViewModeChange}
                    />
                </div>
            </div>
        </div>
    );
};

FilterBar.propTypes = {
    mode: PropTypes.string.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired,
    onResetFilters: PropTypes.func.isRequired,
    viewMode: PropTypes.string.isRequired,
    onViewModeChange: PropTypes.func.isRequired,
    resultCount: PropTypes.number.isRequired
};

export default React.memo(FilterBar);
