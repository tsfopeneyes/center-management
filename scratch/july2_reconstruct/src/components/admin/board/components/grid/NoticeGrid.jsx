import React from 'react';
import PropTypes from 'prop-types';
import NoticeCard from './NoticeCard';
import { VIEW_MODES } from '../../utils/constants';

const NoticeGrid = ({ 
    notices, 
    viewMode, 
    mode, 
    noticeStats, 
    onViewDetails, 
    onOpenParticipants, 
    onStatusChange, 
    onEdit, 
    onDelete 
}) => {
    // Grid container styles based on viewMode
    let gridClass = "grid gap-4 md:gap-6 lg:gap-8 ";
    if (viewMode === VIEW_MODES.LARGE) gridClass += "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    else if (viewMode === VIEW_MODES.SMALL) gridClass += "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
    else if (viewMode === VIEW_MODES.SMALLER) gridClass += "grid-cols-3 md:grid-cols-4 xl:grid-cols-5";
    else gridClass = "flex flex-col gap-2"; // list

    return (
        <div className={gridClass}>
            {notices.map(notice => (
                <NoticeCard
                    key={notice.id}
                    notice={notice}
                    viewMode={viewMode}
                    mode={mode}
                    noticeStats={noticeStats}
                    onViewDetails={onViewDetails}
                    onOpenParticipants={onOpenParticipants}
                    onStatusChange={onStatusChange}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

NoticeGrid.propTypes = {
    notices: PropTypes.array.isRequired,
    viewMode: PropTypes.string.isRequired,
    mode: PropTypes.string.isRequired,
    noticeStats: PropTypes.object.isRequired,
    onViewDetails: PropTypes.func.isRequired,
    onOpenParticipants: PropTypes.func.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
};

export default React.memo(NoticeGrid);
