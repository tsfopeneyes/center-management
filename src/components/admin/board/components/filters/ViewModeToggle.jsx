import React from 'react';
import PropTypes from 'prop-types';
import { LayoutGrid, Grid, Columns, List } from 'lucide-react';
import { VIEW_MODES } from '../../utils/constants';

const ViewModeToggle = ({ viewMode, onViewModeChange }) => {
    return (
        <div className="flex bg-gray-100 p-1 md:p-1.5 rounded-xl border border-gray-200/50 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0">
            {/* Desktop Views */}
            <div className="hidden md:flex gap-1 border-r border-gray-300 pr-2 mr-1">
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.LARGE)}
                    className={`min-w-[80px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-bold ${viewMode === VIEW_MODES.LARGE ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="크게 보기"
                >
                    <LayoutGrid size={14} /> L
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALL)}
                    className={`min-w-[80px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-bold ${viewMode === VIEW_MODES.SMALL ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="기본 보기"
                >
                    <Grid size={14} /> M
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALLER)}
                    className={`min-w-[80px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-bold ${viewMode === VIEW_MODES.SMALLER ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="작게 보기"
                >
                    <Columns size={14} /> S
                </button>
            </div>
            
            {/* Mobile View Toggle */}
            <div className="flex md:hidden flex-1 gap-1">
                <button
                    onClick={() => {
                        const nextMobileMode = viewMode === VIEW_MODES.LARGE ? VIEW_MODES.LIST : VIEW_MODES.LARGE;
                        onViewModeChange(nextMobileMode);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 bg-white shadow-sm text-blue-600 text-sm font-bold"
                >
                    {viewMode === VIEW_MODES.LIST ? <><LayoutGrid size={16} /> 갤러리로 보기</> : <><List size={16} /> 리스트로 보기</>}
                </button>
            </div>

            {/* List View Toggle (Desktop Only) */}
            <button
                onClick={() => onViewModeChange(VIEW_MODES.LIST)}
                className={`hidden md:flex min-w-[80px] px-3 py-1.5 rounded-lg items-center justify-center gap-1.5 transition-all text-xs font-bold ${viewMode === VIEW_MODES.LIST ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                title="리스트 보기"
            >
                <List size={14} /> List
            </button>
        </div>
    );
};

ViewModeToggle.propTypes = {
    viewMode: PropTypes.string.isRequired,
    onViewModeChange: PropTypes.func.isRequired
};

export default React.memo(ViewModeToggle);
