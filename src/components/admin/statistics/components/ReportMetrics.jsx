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

            {/* Program By Target Group Analysis */}
            {report.programStats && (report.programStats.totalCount > 0) && (
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm mt-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-black text-gray-800">프로그램 진행 및 참여 내역</h3>
                            <p className="text-xs font-bold text-gray-400 mt-1">선택된 타겟 그룹({report.reportTarget})의 해당 기간 누적 참여자 수입니다.</p>
                        </div>
                        <div className="bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-black text-indigo-700">
                            총 {report.programStats.totalCount}개 진행 / {report.programStats.totalParticipants} 누적 참여
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Center Programs */}
                        <div className="border border-blue-100 bg-blue-50/30 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 md:p-5 border-b border-blue-100 flex justify-between items-center bg-blue-50/50">
                                <h4 className="font-black text-blue-800 flex items-center gap-2">센터 프로그램</h4>
                                <div className="text-xs font-bold text-blue-600 flex gap-3">
                                    <span>진행: {report.programStats.center.count}개</span>
                                    <span>누적 참여: {report.programStats.center.participants}명</span>
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-0 bg-white">
                                {report.programStats.center.details.length === 0 ? (
                                    <p className="text-center text-xs font-bold text-gray-400 py-6">진행된 내역이 없습니다.</p>
                                ) : (
                                    <table className="w-full text-left text-xs text-gray-600">
                                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold sticky top-0">
                                            <tr>
                                                <th className="p-3">프로그램명</th>
                                                <th className="p-3">날짜</th>
                                                <th className="p-3 text-center whitespace-nowrap">참여 / 신청</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {report.programStats.center.details.map((p, i) => {
                                                const targets = p.target_regions || [];
                                                let badge = <span className="text-blue-600 mr-1 font-bold">[All]</span>;
                                                if (targets.length > 0 && targets.includes('강동') && !targets.includes('강서')) badge = <span className="text-purple-600 mr-1 font-bold">[강동]</span>;
                                                if (targets.length > 0 && targets.includes('강서') && !targets.includes('강동')) badge = <span className="text-pink-600 mr-1 font-bold">[강서]</span>;
                                                
                                                return (
                                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="p-3 font-bold text-gray-700 truncate max-w-[150px]" title={p.title}>
                                                        {badge}
                                                        {p.title}
                                                    </td>
                                                    <td className="p-3 whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-center font-black">
                                                        <span className="text-blue-600">{p.targetAttendCount}</span> 
                                                        <span className="text-gray-400 mx-1">/</span> 
                                                        <span className="text-gray-500">{p.targetJoinCount}</span>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* School Church Programs */}
                        <div className="border border-emerald-100 bg-emerald-50/30 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 md:p-5 border-b border-emerald-100 flex justify-between items-center bg-emerald-50/50">
                                <h4 className="font-black text-emerald-800 flex items-center gap-2">스처 프로그램</h4>
                                <div className="text-xs font-bold text-emerald-600 flex gap-3">
                                    <span>진행: {report.programStats.schoolChurch.count}개</span>
                                    <span>누적 참여: {report.programStats.schoolChurch.participants}명</span>
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-0 bg-white">
                                {report.programStats.schoolChurch.details.length === 0 ? (
                                    <p className="text-center text-xs font-bold text-gray-400 py-6">진행된 내역이 없습니다.</p>
                                ) : (
                                    <table className="w-full text-left text-xs text-gray-600">
                                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold sticky top-0">
                                            <tr>
                                                <th className="p-3">프로그램명</th>
                                                <th className="p-3">날짜</th>
                                                <th className="p-3 text-center whitespace-nowrap">참여 / 신청</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {report.programStats.schoolChurch.details.map((p, i) => {
                                                const targets = p.target_regions || [];
                                                let badge = <span className="text-emerald-600 mr-1 font-bold">[All]</span>;
                                                if (targets.length > 0 && targets.includes('강동') && !targets.includes('강서')) badge = <span className="text-purple-600 mr-1 font-bold">[강동]</span>;
                                                if (targets.length > 0 && targets.includes('강서') && !targets.includes('강동')) badge = <span className="text-pink-600 mr-1 font-bold">[강서]</span>;
                                                
                                                return (
                                                <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                                                    <td className="p-3 font-bold text-gray-700 truncate max-w-[150px]" title={p.title}>
                                                        {badge}
                                                        {p.title}
                                                    </td>
                                                    <td className="p-3 whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-center font-black">
                                                        <span className="text-emerald-600">{p.targetAttendCount}</span> 
                                                        <span className="text-gray-400 mx-1">/</span> 
                                                        <span className="text-gray-500">{p.targetJoinCount}</span>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportMetrics;
