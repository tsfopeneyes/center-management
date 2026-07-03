import React from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

const SearchInputs = ({ mode, filters, onFilterChange }) => {
    return (
        <div className="relative shrink-0 flex-1 min-w-[120px] max-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <Search size={14} />
            </div>
            <input
                type="text"
                placeholder={mode === CATEGORIES.PROGRAM ? "제목/장소 겁색" : "제목 검색"}
                value={filters.title}
                onChange={(e) => onFilterChange('title', e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition shadow-sm text-[11px] font-medium placeholder-gray-400"
            />
        </div>
    );
};

SearchInputs.propTypes = {
    mode: PropTypes.string.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired
};

export default React.memo(SearchInputs);
