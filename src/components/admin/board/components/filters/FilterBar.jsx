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
        <div className="bg-white rounded-[2rem] p-4 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col gap-4 animate-fade-in-up">
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <SearchInputs 
                        mode={mode} 
                        filters={filters} 
                        onFilterChange={onFilterChange} 
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {mode === CATEGORIES.PROGRAM && (
                        <select 
                            value={filters.programType} 
                            onChange={(e) => onFilterChange('programType', e.target.value)}
                            className="w-full sm:w-auto p-3 md:p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition text-sm font-bold text-gray-700"
                        >
                            <option value={PROGRAM_TYPES.ALL}>전체 프로그램</option>
                            <option value={PROGRAM_TYPES.CENTER}>센터 프로그램 (수/목)</option>
                            <option value={PROGRAM_TYPES.SCHOOL_CHURCH}>스처 프로그램 (금)</option>
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

            <div className="flex justify-between items-center px-2 py-1 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] md:text-xs font-bold text-gray-400">
                    총 <span className="text-blue-500 font-black px-1.5 py-0.5 bg-blue-100 rounded-md mx-1">{resultCount}</span>개의 {mode === CATEGORIES.PROGRAM ? '일정' : '게시글'}
                </p>
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
