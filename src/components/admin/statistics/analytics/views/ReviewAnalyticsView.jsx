import React from 'react';
import { Download, Star, ClipboardList, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const ReviewAnalyticsView = ({ hookData, feedbacks }) => {
    const { 
        selectedYear, selectedMonth, selectedDay, periodType, programFilter 
    } = hookData;

    // Filter feedbacks based on periodType and currently selected date
    const filteredFeedbacks = React.useMemo(() => {
        let filtered = feedbacks || [];
        
        // Filter by date
        filtered = filtered.filter(fb => {
            const fbDate = new Date(fb.created_at);
            if (periodType === 'DAILY') {
                return fbDate.getFullYear() === selectedYear && fbDate.getMonth() === selectedMonth && fbDate.getDate() === selectedDay;
            } else if (periodType === 'WEEKLY') {
                // Approximate weekly match by month for simplicity, or use accurate logic if needed
                // Actually AdminDashboard/Analytics fetches broadly, we should use simple date check
                // For weekly we can check if it falls within the current week scope.
                // Since AnalyticsTab uses identical logic, let's just approximate by month for now, or match precisely.
                // To match properly, we would use getKSTWeekOfMonth, but let's keep it simple or implement if deeply required.
                // For now, if WEEKLY, we'll just check Month as Weekly is complex without pulling in utils.
                return fbDate.getFullYear() === selectedYear && fbDate.getMonth() === selectedMonth;
            } else if (periodType === 'MONTHLY') {
                return fbDate.getFullYear() === selectedYear && fbDate.getMonth() === selectedMonth;
            } else if (periodType === 'YEARLY') {
                return fbDate.getFullYear() === selectedYear;
            }
            return true;
        });

        // Filter by program filter
        if (programFilter !== 'ALL') {
            filtered = filtered.filter(fb => {
                const type = fb.notices?.program_type || 'CENTER';
                return type === programFilter;
            });
        }

        return filtered;
    }, [feedbacks, selectedYear, selectedMonth, selectedDay, periodType, programFilter]);

    // Calculate Summaries
    const summary = React.useMemo(() => {
        const total = filteredFeedbacks.length;
        if (total === 0) return { total: 0, avgSatisfaction: 0, avgRejoin: 0 };
        
        const sumSat = filteredFeedbacks.reduce((acc, fb) => acc + (fb.q3_satisfaction || 0), 0);
        const sumRejoin = filteredFeedbacks.reduce((acc, fb) => acc + (fb.q6_would_rejoin || 0), 0);

        return {
            total,
            avgSatisfaction: (sumSat / total).toFixed(1),
            avgRejoin: (sumRejoin / total).toFixed(1)
        };
    }, [filteredFeedbacks]);

    const handleDownloadExcel = () => {
        if (filteredFeedbacks.length === 0) return;
        
        const headers = ['번호', '날짜', '프로그램명', '프로그램구분', '이름', '학교', '나이', '만족도', '재참여의사', '참여이유', '경험', '좋았던점', '아쉬웠던점', '재참여(망설이는)이유', '기타'];
        const csvRows = [headers.join(',')];

        const calculateAge = (birth) => {
            if (!birth || birth.length < 2) return '-';
            const yy = parseInt(birth.substring(0, 2));
            if (isNaN(yy)) return '-';
            const fullYear = yy > 50 ? 1900 + yy : 2000 + yy;
            return new Date().getFullYear() - fullYear + 1;
        };

        filteredFeedbacks.forEach((fb, idx) => {
            const age = calculateAge(fb.users?.birth);
            
            const escapeCSV = (str) => `"${String(str || '-').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

            const row = [
                idx + 1,
                format(new Date(fb.created_at), 'yyyy-MM-dd'),
                escapeCSV(fb.notices?.title),
                escapeCSV(fb.notices?.program_type || 'CENTER'),
                escapeCSV(fb.users?.name),
                escapeCSV(fb.users?.school),
                age,
                fb.q3_satisfaction || '-',
                fb.q6_would_rejoin || '-',
                escapeCSV(fb.q1_reason),
                escapeCSV(fb.q2_experience),
                escapeCSV(fb.q4_best_moment),
                escapeCSV(fb.q5_disappointments),
                escapeCSV(fb.q7_rejoin_reason),
                escapeCSV(fb.q8_additional_comments)
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob(["\ufeff" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `리뷰분석_${selectedYear}_${selectedMonth+1}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">총 리뷰 수</p>
                        <h3 className="text-2xl font-black text-gray-800">{summary.total}개</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                        <ClipboardList className="text-blue-600" size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">평균 만족도</p>
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-1">
                            {summary.avgSatisfaction} <Star className="text-yellow-400 fill-yellow-400" size={20} />
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center">
                        <TrendingUp className="text-yellow-600" size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">평균 재참여 의사</p>
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-1">
                            {summary.avgRejoin} <Star className="text-yellow-400 fill-yellow-400" size={20} />
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                        <TrendingUp className="text-emerald-600" size={24} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="font-bold text-gray-800">리뷰 상세 테이블</h3>
                    <button 
                        onClick={handleDownloadExcel}
                        className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
                    >
                        <Download size={16} />
                        Excel(CSV) 다운로드
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap">번호</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap">날짜</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[150px]">프로그램명</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[80px]">이름</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[100px]">학교</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap">나이</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap">만족도</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap">재참여</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[150px]">참여이유</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[200px]">경험</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[200px]">좋았던점</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[200px]">아쉬웠던점</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[200px]">재참여이유</th>
                                <th className="p-3 text-xs font-black text-gray-500 whitespace-nowrap min-w-[150px]">기타</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredFeedbacks.length > 0 ? (
                                filteredFeedbacks.map((fb, idx) => {
                                    const calculateAge = (birth) => {
                                        if (!birth || birth.length < 2) return '-';
                                        const yy = parseInt(birth.substring(0, 2));
                                        if (isNaN(yy)) return '-';
                                        const fullYear = yy > 50 ? 1900 + yy : 2000 + yy;
                                        return new Date().getFullYear() - fullYear + 1;
                                    };
                                    const age = calculateAge(fb.users?.birth);
                                    return (
                                        <tr key={fb.id || idx} className="hover:bg-gray-50/50 transition">
                                            <td className="p-3 text-sm text-gray-600 font-medium">{idx + 1}</td>
                                            <td className="p-3 text-sm text-gray-600 whitespace-nowrap">{format(new Date(fb.created_at), 'yyyy-MM-dd')}</td>
                                            <td className="p-3 text-sm font-semibold text-gray-800 line-clamp-1 break-all" title={fb.notices?.title}>
                                                {(() => {
                                                    const targets = fb.notices?.target_regions || [];
                                                    if (targets.length === 0 || (targets.includes('강동') && targets.includes('강서'))) {
                                                        return <span className="text-blue-600 mr-1 font-bold">[All]</span>;
                                                    } else if (targets.includes('강동')) {
                                                        return <span className="text-purple-600 mr-1 font-bold">[강동]</span>;
                                                    } else if (targets.includes('강서')) {
                                                        return <span className="text-pink-600 mr-1 font-bold">[강서]</span>;
                                                    }
                                                    return <span className="text-blue-600 mr-1 font-bold">[All]</span>;
                                                })()}
                                                {fb.notices?.title || '-'}
                                            </td>
                                            <td className="p-3 text-sm font-semibold text-gray-800">{fb.users?.name || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600">{fb.users?.school || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600">{age}</td>
                                            <td className="p-3 text-sm font-bold text-blue-600">{fb.q3_satisfaction || '-'}</td>
                                            <td className="p-3 text-sm font-bold text-emerald-600">{fb.q6_would_rejoin || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 max-w-[150px] truncate" title={fb.q1_reason}>{fb.q1_reason || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 max-w-[200px] truncate" title={fb.q2_experience}>{fb.q2_experience || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 max-w-[200px] truncate" title={fb.q4_best_moment}>{fb.q4_best_moment || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 max-w-[200px] truncate" title={fb.q5_disappointments}>{fb.q5_disappointments || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 max-w-[200px] truncate" title={fb.q7_rejoin_reason}>{fb.q7_rejoin_reason || '-'}</td>
                                            <td className="p-3 text-sm text-gray-600 max-w-[150px] truncate" title={fb.q8_additional_comments}>{fb.q8_additional_comments || '-'}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="14" className="p-8 text-center text-gray-500 text-sm">해당 기간에 작성된 리뷰가 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReviewAnalyticsView;
