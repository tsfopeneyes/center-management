import React from 'react';
import { Trash2 } from 'lucide-react';

const SpaceLogTable = ({ hookData, users, locations, notices }) => {
    const { filteredLogs, parseLocationId, handleDeleteLog } = hookData;

    return (
            
                <>
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="p-4 pl-6">시간</th>
                                    <th className="p-4">이름</th>
                                    <th className="p-4">종류</th>
                                    <th className="p-4 pr-6">위치 / 프로그램 상세</th>
                                    <th className="p-4 pr-6 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {(filteredLogs && filteredLogs.length === 0) ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                                ) : (
                                    [...filteredLogs].reverse().slice(0, 100).map((log) => {
                                        const user = users.find(u => u.id === log.user_id);
                                        const location = locations.find(l => l.id === log.location_id);
                                        const { title: prgTitle } = parseLocationId(log.location_id);
                                        const notice = notices?.find(n => n.id === parseLocationId(log.location_id).id);

                                        let typeLabel = '';
                                        let typeColor = '';

                                        switch (log.type) {
                                            case 'CHECKIN': typeLabel = '입실'; typeColor = 'text-green-600 bg-green-50'; break;
                                            case 'CHECKOUT': typeLabel = '퇴실'; typeColor = 'text-red-500 bg-red-50'; break;
                                            case 'MOVE': typeLabel = '이동'; typeColor = 'text-blue-600 bg-blue-50'; break;
                                            case 'PRG_COMPLETED': typeLabel = '완료'; typeColor = 'text-indigo-600 bg-indigo-50'; break;
                                            case 'PRG_CANCELLED': typeLabel = '취소'; typeColor = 'text-orange-600 bg-orange-50'; break;
                                            default: typeLabel = log.type; typeColor = 'text-gray-600 bg-gray-100';
                                        }

                                        const isProgramType = log.type.startsWith('PRG_');

                                        return (
                                            <tr key={log.id} className={`hover:bg-gray-50 transition group ${isProgramType ? 'border-l-4 border-l-indigo-400' : ''}`}>
                                                <td className="p-4 pl-6 text-gray-500 font-mono text-xs">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="p-4 font-bold text-gray-700 whitespace-nowrap">
                                                    {user ? user.name : '알 수 없음'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap text-center min-w-[50px] ${typeColor}`}>
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-600 font-bold max-w-[200px] truncate">
                                                    {isProgramType ? (prgTitle || (notice ? notice.title : '삭제된 프로그램')) : (location ? location.name : '-')}
                                                </td>
                                                <td className="p-4 pr-6 text-center">
                                                    <button
                                                        onClick={() => handleDeleteLog(log.id)}
                                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                        {(filteredLogs && filteredLogs.length === 0) ? (
                            <div className="p-10 text-center text-gray-400 text-sm font-bold italic">기록이 없습니다.</div>
                        ) : (
                            [...filteredLogs].reverse().slice(0, 50).map((log) => {
                                const user = users.find(u => u.id === log.user_id);
                                const location = locations.find(l => l.id === log.location_id);
                                const { title: prgTitle } = parseLocationId(log.location_id);
                                const notice = notices?.find(n => n.id === parseLocationId(log.location_id).id);

                                let typeLabel = '';
                                let typeColor = '';

                                switch (log.type) {
                                    case 'CHECKIN': typeLabel = '입실'; typeColor = 'text-green-600 bg-green-50'; break;
                                    case 'CHECKOUT': typeLabel = '퇴실'; typeColor = 'text-red-500 bg-red-50'; break;
                                    case 'MOVE': typeLabel = '이동'; typeColor = 'text-blue-600 bg-blue-50'; break;
                                    case 'PRG_COMPLETED': typeLabel = '완료'; typeColor = 'text-indigo-600 bg-indigo-50'; break;
                                    case 'PRG_CANCELLED': typeLabel = '취소'; typeColor = 'text-orange-600 bg-orange-50'; break;
                                    default: typeLabel = log.type; typeColor = 'text-gray-600 bg-gray-100';
                                }

                                const isProgramType = log.type.startsWith('PRG_');

                                return (
                                    <div key={log.id} className={`p-4 space-y-2 relative ${isProgramType ? 'bg-indigo-50/20 border-l-4 border-l-indigo-400' : ''}`}>
                                        <button
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="flex justify-between items-center pr-8">
                                            <span className="font-bold text-gray-800">{user ? user.name : '알 수 없음'}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${typeColor}`}>
                                                {typeLabel}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-400">{new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className={`text-gray-800 font-bold truncate max-w-[150px] ${isProgramType ? 'text-indigo-600' : ''}`}>
                                                {isProgramType ? (prgTitle || (notice ? notice.title : '삭제된 프로그램')) : (location ? location.name : '-')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>

    );
};
export default SpaceLogTable;
