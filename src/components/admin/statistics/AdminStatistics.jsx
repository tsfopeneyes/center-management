import React from 'react';
import { BarChart } from 'lucide-react';
import AnalyticsTab from '../../AnalyticsTab';

const AdminStatistics = ({ logs, schoolLogs, locations, locationGroups, users, notices, responses, isLoading, fetchData }) => {
    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div>
                    <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                        <BarChart className="text-blue-600" size={24} md:size={32} />
                        통계 분석
                    </h2>
                    <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">센터 및 프로그램 이용 관련 상세 통계 지표</p>
                </div>
            </div>
            <AnalyticsTab logs={logs} schoolLogs={schoolLogs} locations={locations} locationGroups={locationGroups} users={users} notices={notices} responses={responses} isLoading={isLoading} fetchData={fetchData} />
        </div>
    );
};

export default AdminStatistics;
