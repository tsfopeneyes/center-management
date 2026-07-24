import React from 'react';
import PropTypes from 'prop-types';
import { VIEW_MODES } from '../../utils/constants';

const ViewModeToggle = ({ viewMode, onViewModeChange }) => {
    // If the viewMode is currently set to anything else (like 'small' or 'list'), normalize to LARGE
    const activeMode = (viewMode === VIEW_MODES.LARGE || viewMode === VIEW_MODES.SMALLER) 
        ? viewMode 
        : VIEW_MODES.LARGE;

    return (
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50 shadow-inner shrink-0 justify-center h-[30px] items-center">
            <div className="flex items-center gap-0.5">
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.LARGE)}
                    className={`px-3 py-1 rounded-[6px] flex items-center justify-center transition-all text-[11px] font-black tracking-tight ${activeMode === VIEW_MODES.LARGE ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="큰 카드로 보기"
                >
                    큰 카드
                </button>
                <button
                    onClick={() => onViewModeChange(VIEW_MODES.SMALLER)}
                    className={`px-3 py-1 rounded-[6px] flex items-center justify-center transition-all text-[11px] font-black tracking-tight ${activeMode === VIEW_MODES.SMALLER ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                    title="작은 카드로 보기"
                >
                    작은 카드
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
