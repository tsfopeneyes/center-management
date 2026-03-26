import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, RefreshCw, TrendingUp } from 'lucide-react';

const ReportMetrics = ({ report, setSelectedGuestSpace }) => {
    return (
        <div className="space-y-6">
            {/* Monthly KPI Logic */}
            {report.monthlyMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle size={20} className="text-white/80" />
                                <span className="text-sm font-bold uppercase tracking-wider text-white/70">활성 이용자 비율</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-6xl font-black">{report.monthlyMetrics.activeUserRatio}%</span>
                            </div>
                            <p className="mt-4 text-sm text-indigo-100 leading-relaxed font-bold">
                                최근 4주 내 주 평균 2회 이상 방문하거나<br />
                                2주 이상 꾸준히 참여한 학생들의 비율입니다.
                            </p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <RefreshCw size={20} className="text-white/80" />
                                <span className="text-sm font-bold uppercase tracking-wider text-white/70">재방문율</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-6xl font-black">{report.monthlyMetrics.retentionRate}%</span>
                            </div>
                            <p className="mt-4 text-sm text-emerald-50 text-emerald-50/80 leading-relaxed font-bold">
                                기간 내 1회 이상 방문한 학생 중<br />
                                2회 이상 다시 찾아온 학생의 비율입니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Space-by-Space Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {report.spaceResults.map((space, idx) => (
                    <motion.div
                        key={space.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-black text-gray-800">{space.name}</h3>
                            <div className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold text-gray-500">
                                {space.uniqueVisitors}명 이용 중
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div className="space-y-1 border-l-4 border-blue-500 pl-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase">순 방문자</p>
                                <p className="text-xl font-black text-gray-800">{space.uniqueVisitors}명</p>
                            </div>
                            <div className="space-y-1 border-l-4 border-indigo-500 pl-4 font-bold">
                                <p className="text-[10px] font-black text-gray-400 uppercase">방문 수</p>
                                <p className="text-xl font-black text-gray-800">{space.visitCount}회</p>
                                <p className="text-[10px] text-gray-400">인당 평균 {space.avgVisitCount}회</p>
                            </div>
                            <div className="space-y-1 border-l-4 border-emerald-500 pl-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase">체류 시간</p>
                                <p className="text-xl font-black text-gray-800">
                                    {Math.floor(space.totalDuration / 60)}h {space.totalDuration % 60}m
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold">평균 {space.avgDuration}분</p>
                            </div>
                            {space.activeUserRatio !== undefined && space.activeUserRatio !== null && (
                                <>
                                    <div className="space-y-1 border-l-4 border-blue-600 pl-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">활성 이용자 비율</p>
                                        <p className="text-xl font-black text-gray-800">{space.activeUserRatio}%</p>
                                    </div>
                                    <div className="space-y-1 border-l-4 border-teal-500 pl-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">재방문율</p>
                                        <p className="text-xl font-black text-gray-800">{space.retentionRate}%</p>
                                    </div>
                                </>
                            )}
                            <div className="space-y-1 border-l-4 border-orange-500 pl-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase">최다 방문 요일</p>
                                <p className="text-xl font-black text-gray-800">{space.mostVisitedDay}요일</p>
                            </div>
                            <div className="space-y-1 border-l-4 border-purple-500 pl-4 col-span-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase">주요 체류 시간대</p>
                                <p className="text-xl font-black text-gray-800">{space.peakHour}</p>
                                <p className="text-[10px] text-gray-400 font-bold">가장 높은 동시 체류 인원</p>
                            </div>

                            {report.guestResults && report.guestResults[space.id] && report.guestResults[space.id].visitCount > 0 && (
                                <div
                                    onClick={() => setSelectedGuestSpace({ name: space.name, ...report.guestResults[space.id] })}
                                    className="space-y-1 border-l-4 border-indigo-600 pl-4 bg-indigo-50/50 p-3 rounded-r-xl cursor-pointer hover:bg-indigo-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">게스트 방문 (클릭시 명단)</p>
                                        <TrendingUp size={10} className="text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </div>
                                    <p className="text-xl font-black text-indigo-700">{report.guestResults[space.id].visitCount}회</p>
                                    <p className="text-[10px] text-indigo-400 font-bold">총 {Math.floor(report.guestResults[space.id].totalDuration / 60)}h {report.guestResults[space.id].totalDuration % 60}m</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default ReportMetrics;
