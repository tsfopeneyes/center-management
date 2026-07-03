import React from 'react';
import PropTypes from 'prop-types';
import { VIEW_MODES } from '../../utils/constants';

const ViewModeToggle = ({ viewMode, onViewModeChange }) => {
    return (
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50 shadow-inner shrink-0 justify-center h-[30px] items-center">
            <div className="flex items-center">
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.LARGE)}
                    className={`min-w-[28px] px-1.5 py-1 rounded-[6px] flex items-center justify-center transition-all text-[10px] font-black tracking-wider ${viewMode === VIEW_MODES.LARGE ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="크게 보기"
                >
                    L
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALL)}
                    className={`min-w-[28px] px-1.5 py-1 rounded-[6px] flex items-center justify-center transition-all text-[10px] font-black tracking-wider ${viewMode === VIEW_MODES.SMALL ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="기본 보기"
                >
                    M
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALLER)}
                    className={`min-w-[28px] px-1.5 py-1 rounded-[6px] flex items-center justify-center transition-all text-[10px] font-black tracking-wider ${viewMode === VIEW_MODES.SMALLER ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="작게 보기"
                >
                    S
                </button>
                
                <div className="w-[1px] h-3 bg-gray-300 mx-0.5"></div>

                <button
                    onClick={() => onViewModeChange(VIEW_MODES.LIST)}
                    className={`min-w-[36px] px-1.5 py-1 rounded-[6px] flex items-center justify-center transition-all text-[10px] font-black tracking-wider ${viewMode === VIEW_MODES.LIST ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
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
