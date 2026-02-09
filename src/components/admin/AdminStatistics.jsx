import React from 'react';
import AnalyticsTab from '../AnalyticsTab';

const AdminStatistics = ({ logs, locations, users, notices, responses, isLoading }) => {
    return (
        <div className="animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 p-4 bg-gray-50/50 rounded-2xl">통계</h2>
            <AnalyticsTab logs={logs} locations={locations} users={users} notices={notices} responses={responses} isLoading={isLoading} />
        </div>
    );
};

export default AdminStatistics;
