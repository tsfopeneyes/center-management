import React from 'react';
import { BarChart } from 'lucide-react';
import AnalyticsTab from '../../AnalyticsTab';
import AdminPageHeader from '../common/AdminPageHeader';

const AdminStatistics = ({ logs, schoolLogs, locations, locationGroups, users, notices, responses, feedbacks, visitNotes, isLoading, fetchData }) => {
    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <AdminPageHeader
                title="통계 분석"
                subtitle="센터 및 프로그램 이용 관련 상세 지표 및 리뷰 분석"
                icon={<BarChart />}
            />
            <AnalyticsTab logs={logs} schoolLogs={schoolLogs} locations={locations} locationGroups={locationGroups} users={users} notices={notices} responses={responses} feedbacks={feedbacks} visitNotes={visitNotes} isLoading={isLoading} fetchData={fetchData} />
        </div>
    );
};

export default AdminStatistics;
