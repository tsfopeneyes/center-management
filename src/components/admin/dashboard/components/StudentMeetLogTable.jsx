import React from 'react';

const StudentMeetLogTable = ({ hookData, setSelectedLogId }) => {
    const { filteredSchoolLogs } = hookData;

    return (
                
                    <div className="overflow-x-auto custom-scrollbar" style={{ minHeight: '500px' }}>
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <tr className="border-b border-gray-100">
                                    <th className="p-3 pl-6">Week ID</th>
                                    <th className="p-3">날짜</th>
                                    <th className="p-3 text-center">구분</th>
                                    <th className="p-3">학교</th>
                                    <th className="p-3 text-center">인원수</th>
                                    <th className="p-3 text-center">시작시간</th>
                                    <th className="p-3 text-center">끝시간</th>
                                    <th className="p-3 text-center">스쳐타임</th>
                                    <th className="p-3 text-center">스쳐타임(분)</th>
                                    <th className="p-3 pr-6">참여팀원</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredSchoolLogs.length === 0 ? (
                                    <tr><td colSpan="10" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                                ) : (
                                    filteredSchoolLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLogId(log.id)}
                                            className="hover:bg-gray-50 transition border-l-4 border-l-transparent hover:border-l-indigo-400 cursor-pointer"
                                        >
                                            <td className="p-3 pl-6 font-mono text-[11px] text-gray-500">{log.weekId}</td>
                                            <td className="p-3 whitespace-nowrap">{log.date}</td>
                                            <td className="p-3 text-center text-indigo-600 font-bold text-xs">
                                                <span className={`bg-indigo-50/80 px-2 py-1 rounded-md ${log.category === '학생만남' ? 'text-gray-600 bg-gray-100' : ''}`}>{log.category}</span>
                                            </td>
                                            <td className="p-3 font-bold text-gray-800">{log.schoolName}</td>
                                            <td className="p-3 text-center">{log.participantCount}명</td>
                                            <td className="p-3 font-mono text-xs text-center">{log.startTime}</td>
                                            <td className="p-3 font-mono text-xs text-center">{log.endTime}</td>
                                            <td className="p-3 font-mono text-xs text-center bg-gray-50 rounded text-gray-600">{log.durationStr}</td>
                                            <td className="p-3 text-center font-bold text-blue-600">{log.durationMin}분</td>
                                            <td className="p-3 pr-6 text-gray-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={log.facilitatorNames}>{log.facilitatorNames}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

    );
};
export default StudentMeetLogTable;
