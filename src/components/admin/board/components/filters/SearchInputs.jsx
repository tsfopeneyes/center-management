import React from 'react';
import PropTypes from 'prop-types';
import { Search, MapPin } from 'lucide-react';
import { CATEGORIES } from '../../utils/constants';

const SearchInputs = ({ mode, filters, onFilterChange }) => {
    return (
        <>
            <div className="relative flex-1 md:min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none text-gray-400">
                    <Search size={16} className="md:w-5 md:h-5" />
                </div>
                <input
                    type="text"
                    placeholder="제목으로 검색..."
                    value={filters.title}
                    onChange={(e) => onFilterChange('title', e.target.value)}
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition shadow-sm text-sm"
                />
            </div>
            
            {mode === CATEGORIES.PROGRAM && (
                <div className="relative flex-1 md:min-w-[200px]">
                    <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none text-gray-400">
                        <MapPin size={16} className="md:w-5 md:h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="장소로 검색... (예: 멀티룸)"
                        value={filters.location}
                        onChange={(e) => onFilterChange('location', e.target.value)}
                        className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition shadow-sm text-sm"
                    />
                </div>
            )}
        </>
    );
};

SearchInputs.propTypes = {
    mode: PropTypes.string.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired
};

export default React.memo(SearchInputs);
