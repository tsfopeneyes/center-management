import React from 'react';
import { RefreshCw, FileSpreadsheet } from 'lucide-react';
import { exportLogsToExcel } from '../../utils/exportUtils';

const AdminLogs = ({ allLogs, users, locations, fetchData }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-4 rounded-2xl gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">로그 기록</h2>
                    <p className="text-gray-500 text-xs md:text-sm">시스템 전체 이용 및 이동 로그 ({allLogs.length}건)</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => exportLogsToExcel(allLogs, users, locations)} className="flex-1 md:flex-none bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition font-bold shadow-sm">
                        <FileSpreadsheet size={18} /> 엑셀 저장
                    </button>
                    <button onClick={fetchData} className="flex-1 md:flex-none bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition font-bold shadow-sm">
                        <RefreshCw size={18} /> 새로고침
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="p-4 pl-6">시간</th>
                                <th className="p-4">이름</th>
                                <th className="p-4">종류</th>
                                <th className="p-4 pr-6">위치 / 상세</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {(allLogs && allLogs.length === 0) ? (
                                <tr><td colSpan="4" className="p-10 text-center text-gray-400">기록이 없습니다.</td></tr>
                            ) : (
                                [...allLogs].reverse().slice(0, 100).map((log) => {
                                    const user = users.find(u => u.id === log.user_id);
                                    const location = locations.find(l => l.id === log.location_id);

                                    let typeLabel = '';
                                    let typeColor = '';

                                    switch (log.type) {
                                        case 'CHECKIN': typeLabel = '입실'; typeColor = 'text-green-600 bg-green-50'; break;
                                        case 'CHECKOUT': typeLabel = '퇴실'; typeColor = 'text-red-500 bg-red-50'; break;
                                        case 'MOVE': typeLabel = '이동'; typeColor = 'text-blue-600 bg-blue-50'; break;
                                        default: typeLabel = log.type; typeColor = 'text-gray-600 bg-gray-100';
                                    }

                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50 transition group">
                                            <td className="p-4 pl-6 text-gray-500 font-mono text-xs">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-bold text-gray-700">
                                                {user ? user.name : '알 수 없음'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${typeColor}`}>
                                                    {typeLabel}
                                                </span>
                                            </td>
                                            <td className="p-4 pr-6 text-gray-600 font-bold">
                                                {location ? location.name : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                    {(allLogs && allLogs.length === 0) ? (
                        <div className="p-10 text-center text-gray-400 text-sm">기록이 없습니다.</div>
                    ) : (
                        [...allLogs].reverse().slice(0, 50).map((log) => {
                            const user = users.find(u => u.id === log.user_id);
                            const location = locations.find(l => l.id === log.location_id);

                            let typeLabel = '';
                            let typeColor = '';

                            switch (log.type) {
                                case 'CHECKIN': typeLabel = '입실'; typeColor = 'text-green-600 bg-green-50'; break;
                                case 'CHECKOUT': typeLabel = '퇴실'; typeColor = 'text-red-500 bg-red-50'; break;
                                case 'MOVE': typeLabel = '이동'; typeColor = 'text-blue-600 bg-blue-50'; break;
                                default: typeLabel = log.type; typeColor = 'text-gray-600 bg-gray-100';
                            }

                            return (
                                <div key={log.id} className="p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-800">{user ? user.name : '알 수 없음'}</span>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${typeColor}`}>
                                            {typeLabel}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">{new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-gray-700 font-bold">{location ? location.name : '-'}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminLogs;
