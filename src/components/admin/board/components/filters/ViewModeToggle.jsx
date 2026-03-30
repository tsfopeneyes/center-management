import React from 'react';
import PropTypes from 'prop-types';
import { VIEW_MODES } from '../../utils/constants';

const ViewModeToggle = ({ viewMode, onViewModeChange }) => {
    return (
        <div className="flex bg-gray-100 p-1 md:p-1.5 rounded-xl border border-gray-200/50 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0 justify-center">
            <div className="flex gap-1 items-center">
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.LARGE)}
                    className={`min-w-[40px] px-3 py-1.5 rounded-lg flex items-center justify-center transition-all text-xs font-black tracking-wider ${viewMode === VIEW_MODES.LARGE ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="크게 보기"
                >
                    L
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALL)}
                    className={`min-w-[40px] px-3 py-1.5 rounded-lg flex items-center justify-center transition-all text-xs font-black tracking-wider ${viewMode === VIEW_MODES.SMALL ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="기본 보기"
                >
                    M
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALLER)}
                    className={`min-w-[40px] px-3 py-1.5 rounded-lg flex items-center justify-center transition-all text-xs font-black tracking-wider ${viewMode === VIEW_MODES.SMALLER ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="작게 보기"
                >
                    S
                </button>
                
                <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

                <button
                    onClick={() => onViewModeChange(VIEW_MODES.LIST)}
                    className={`min-w-[50px] px-3 py-1.5 rounded-lg flex items-center justify-center transition-all text-xs font-black tracking-wider ${viewMode === VIEW_MODES.LIST ? 'bg-white shadow-sm text-blue-600 transform scale-[1.02]' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="리스트 보기"
                >
                    List
                </button>
            </div>
        </div>
    );
};

ViewModeToggle.propTypes = {
    viewMode: PropTypes.string.isRequired,
    onViewModeChange: PropTypes.func.isRequired
};

export default React.memo(ViewModeToggle);
