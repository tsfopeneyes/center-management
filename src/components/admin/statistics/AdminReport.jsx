import React from 'react';
import { Calendar } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

import { useAdminReport } from './hooks/useAdminReport';
import ReportHeader from './components/ReportHeader';
import ReportMetrics from './components/ReportMetrics';
import GuestListModal from './components/GuestListModal';

const AdminReport = ({ allLogs, users, locations, notices }) => {
    const {
        loading, report,
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        selectedDay, setSelectedDay,
        periodType, setPeriodType,
        targetGroup, setTargetGroup,
        selectedGuestSpace, setSelectedGuestSpace,
        generateReport
    } = useAdminReport(allLogs, users, locations);

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <ReportHeader
                targetGroup={targetGroup}
                setTargetGroup={setTargetGroup}
                periodType={periodType}
                setPeriodType={setPeriodType}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                generateReport={generateReport}
                loading={loading}
            />

            {report ? (
                <div className="space-y-6">
                    <ReportMetrics report={report} setSelectedGuestSpace={setSelectedGuestSpace} />

                    <AnimatePresence>
                        {selectedGuestSpace && (
                            <GuestListModal
                                isOpen={true}
                                onClose={() => setSelectedGuestSpace(null)}
                                spaceName={selectedGuestSpace.name}
                                guests={selectedGuestSpace.guests}
                            />
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 text-gray-300">
                    <Calendar size={48} strokeWidth={1} className="mb-4" />
                    <p className="font-bold">리포트를 생성하면 여기에 상세 통계가 표시됩니다.</p>
                </div>
            )}
        </div>
    );
};

export default AdminReport;
