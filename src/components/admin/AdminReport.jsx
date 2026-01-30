import React, { useState } from 'react';
import { analyticsUtils } from '../../utils/analyticsUtils';
import { FileText, Download, Calendar, Mail, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminReport = () => {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [period, setPeriod] = useState('WEEK'); // WEEK, MONTH

    const generateReport = async () => {
        setLoading(true);
        try {
            const end = new Date();
            const start = new Date();
            if (period === 'WEEK') start.setDate(start.getDate() - 7);
            else start.setMonth(start.getMonth() - 1);

            const summary = await analyticsUtils.getUsageSummary(start, end);
            const text = analyticsUtils.generateWeeklyReportText(summary);
            setReport({ summary, text });
        } catch (err) {
            console.error(err);
            alert('리포트 생성 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-6 rounded-3xl gap-4 border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">운영 데이터 리포트</h2>
                    <p className="text-gray-500 text-sm font-bold">센터 이용 및 프로그램 참여 통계를 리포트 형식으로 추출합니다.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="bg-white border border-gray-200 px-4 py-2 rounded-xl font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="WEEK">최근 1주일</option>
                        <option value="MONTH">최근 1개월</option>
                    </select>
                    <button
                        onClick={generateReport}
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        <FileText size={18} />
                        {loading ? '생성 중...' : '리포트 생성'}
                    </button>
                </div>
            </div>

            {report ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Insights Card */}
                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <TrendingUp className="text-blue-600" size={20} />
                            핵심 인사이트
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">총 이용 건수</p>
                                <p className="text-2xl font-black text-gray-800">{report.summary.totalLogs}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">인기 프로그램</p>
                                <p className="text-2xl font-black text-gray-800">{report.summary.programStats.length}개</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm font-bold text-gray-400">장소별 이용률</p>
                            {Object.entries(report.summary.locationStats).map(([name, count]) => (
                                <div key={name} className="flex items-center gap-3">
                                    <div className="text-sm font-bold text-gray-600 w-24 truncate">{name}</div>
                                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(count / report.summary.totalLogs) * 100}%` }}
                                            className="h-full bg-blue-500"
                                        />
                                    </div>
                                    <div className="text-sm font-black text-gray-400">{count}회</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Raw Text Report */}
                    <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white font-mono text-sm relative">
                        <div className="absolute top-6 right-6 flex gap-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(report.text);
                                    alert('복사되었습니다!');
                                }}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                                title="텍스트 복사"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed opacity-90 pt-8">
                            {report.text}
                        </pre>
                    </div>
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
