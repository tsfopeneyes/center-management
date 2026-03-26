import React from 'react';
import { Trash2 } from 'lucide-react';

const ProgramLogTable = ({ hookData }) => {
    const { programSummaries, handleDeleteProgramSummary } = hookData;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                    <tr>
                        <th className="p-4 pl-6 whitespace-nowrap">프로그램 일정</th>
                        <th className="p-4">프로그램명</th>
                        <th className="p-4 text-center">분류</th>
                        <th className="p-4">유형</th>
                        <th className="p-4">참여 현황</th>
                        <th className="p-4">명단</th>
                        <th className="p-4 pr-6 text-center">관리</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {programSummaries.length === 0 ? (
                        <tr><td colSpan="7" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                    ) : (
                        programSummaries.map((summary) => (
                            <tr key={summary.id} className="hover:bg-gray-50 transition group border-l-4 border-l-indigo-400">
                                <td className="p-4 pl-6 text-indigo-600 font-mono text-[10px] md:text-xs whitespace-nowrap font-bold">
                                    {summary.displayTime}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col items-start justify-center gap-0.5">
                                        <span className="font-bold text-gray-700 truncate max-w-[180px] leading-tight">
                                            {summary.prgTitle}
                                        </span>
                                        {summary.prgLocation && (
                                            <span className="text-[10px] text-gray-400 font-bold leading-tight">({summary.prgLocation})</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${summary.prgType === 'CENTER' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                        {summary.prgType === 'CENTER' ? '센터' : '스처'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap text-center min-w-[50px] ${summary.type === 'COMPLETED' ? 'text-indigo-600 bg-indigo-50' : 'text-orange-600 bg-orange-50'}`}>
                                        {summary.type === 'COMPLETED' ? '완료' : '취소'}
                                    </span>
                                </td>
                                <td className="p-4 whitespace-nowrap">
                                    {summary.type === 'COMPLETED' ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-blue-600 font-bold text-xs ring-1 ring-blue-100 bg-blue-50/50 px-2 py-0.5 rounded-md inline-block w-fit">참석: {summary.attendees.length}명</span>
                                            <span className="text-gray-400 text-[10px] pl-1">미참석: {summary.absentees.length}명</span>
                                        </div>
                                    ) : (
                                        <span className="text-orange-600 font-bold text-xs ring-1 ring-orange-100 bg-orange-50/50 px-2 py-1 rounded-md">신청자: {summary.cancelled.length}명</span>
                                    )}
                                </td>
                                <td className="p-4 text-xs text-gray-500 min-w-[250px]">
                                    <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                                        {(summary.type === 'COMPLETED' ? [...summary.attendees, ...summary.absentees] : summary.cancelled).map((person, i) => (
                                            <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${['PRG_ATTENDED', 'PRG_COMPLETED', 'PRG_REGISTERED'].includes(person.type) ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-100/80 border-gray-200 text-gray-500'}`}>
                                                {person.name}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 pr-6 text-center">
                                    <button
                                        onClick={() => handleDeleteProgramSummary(summary.logIds)}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
export default ProgramLogTable;
