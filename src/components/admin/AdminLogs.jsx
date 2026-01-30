import React, { useState, useMemo } from 'react';
import { RefreshCw, FileSpreadsheet, MapPin, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { exportLogsToExcel } from '../../utils/exportUtils';

const AdminLogs = ({ allLogs, users, locations, notices, fetchData }) => {
    const [logCategory, setLogCategory] = useState('SPACE'); // SPACE, PROGRAM

    const parseLocationId = (locId) => {
        if (!locId) return { id: '', title: '', date: '', time: '', location: '' };
        if (locId.includes('|')) {
            const [id, title, date, time, location] = locId.split('|');
            return { id, title, date, time, location: location || '' };
        }
        // Legacy support for colon
        if (locId.includes(':')) {
            const [id, ...rest] = locId.split(':');
            return { id: locId, title: '', date: '', time: '', location: '' };
        }
        return { id: locId, title: '', date: '', time: '', location: '' };
    };

    const extractProgramInfo = (content) => {
        const info = { date: '', duration: '', location: '', cleanContent: content };
        if (!content) return info;
        const infoBlockRegex = /<div style="background-color: #f8fafc;[\s\S]*?<\/div>/;
        const match = content.match(infoBlockRegex);
        if (match) {
            const block = match[0];
            const locationMatch = block.match(/📍 장소:<\/strong>\s*([^<]+)/);
            if (locationMatch) info.location = locationMatch[1].trim() === '미정' ? '' : locationMatch[1].trim();
        }
        return info;
    };

    const formatShortTime = (rawDate, rawTime, fallbackTime) => {
        // rawDate can be 'YYYY-MM-DD' or ISO 'YYYY-MM-DDTHH:mm:ss.sssZ'
        // Prioritize ISO if available
        let dateObj;
        if (rawDate && rawDate.includes('T')) {
            dateObj = new Date(rawDate);
        } else if (rawDate && rawTime) {
            dateObj = new Date(`${rawDate}T${rawTime}`);
        } else if (rawDate) {
            dateObj = new Date(rawDate);
        } else {
            dateObj = new Date(fallbackTime);
        }

        if (isNaN(dateObj.getTime())) dateObj = new Date(fallbackTime);

        const y = String(dateObj.getFullYear()).slice(2);
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const hour = dateObj.getHours();
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        const ampm = hour >= 12 ? 'pm' : 'am';
        const displayHour = hour % 12 || 12;

        return `${y}.${m}.${d} ${ampm} ${displayHour}:${min}`;
    };

    const programSummaries = useMemo(() => {
        const prgLogs = allLogs.filter(log => log.type.startsWith('PRG_'));
        const groups = {};

        prgLogs.forEach(log => {
            const { id: prgId, title: prgTitle, date, time, location } = parseLocationId(log.location_id);
            // Group by ID + Minute to catch logs from same batch
            const timeKey = new Date(log.created_at).toISOString().slice(0, 16);
            const groupKey = `${prgId}_${timeKey}`;

            if (!groups[groupKey]) {
                const notice = notices?.find(n => n.id === prgId);
                const actualDate = date || notice?.program_date;
                const actualTime = time || ''; // Time might be inside actualDate if it's ISO

                // Construct sortable timestamp
                let sortTime;
                if (actualDate) {
                    sortTime = new Date(actualDate).getTime();
                    // If actualDate was just YYYY-MM-DD and we have actualTime
                    if (actualDate.length <= 10 && actualTime) {
                        sortTime = new Date(`${actualDate}T${actualTime}`).getTime();
                    }
                } else {
                    sortTime = new Date(log.created_at).getTime();
                }

                const info = notice ? extractProgramInfo(notice.content) : null;
                groups[groupKey] = {
                    id: groupKey,
                    prgId,
                    prgTitle: prgTitle || notice?.title || '삭제된 프로그램',
                    prgLocation: location || info?.location || '',
                    displayTime: formatShortTime(actualDate, actualTime, log.created_at),
                    sortTime,
                    type: (log.type === 'PRG_CANCELLED' || log.type === 'PRG_CANCEL_SYSTEM') ? 'CANCELLED' : 'COMPLETED',
                    attendees: [],
                    absentees: [],
                    cancelled: [],
                    logIds: []
                };
            }

            groups[groupKey].logIds.push(log.id);

            const user = users.find(u => u.id === log.user_id);
            if (user) {
                const participantInfo = { name: user.name, type: log.type };
                if (log.type === 'PRG_ATTENDED') groups[groupKey].attendees.push(participantInfo);
                else if (log.type === 'PRG_ABSENT') groups[groupKey].absentees.push(participantInfo);
                else if (log.type === 'PRG_CANCELLED') groups[groupKey].cancelled.push(participantInfo);
            }
        });

        return Object.values(groups).sort((a, b) => b.sortTime - a.sortTime);
    }, [allLogs, notices, users]);

    const handleDeleteLog = async (id) => {
        if (!confirm('해당 로그를 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('logs').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('삭제 실패: ' + err.message); }
    };

    const handleDeleteProgramSummary = async (ids) => {
        if (!confirm('이 프로그램의 모든 참여 기록을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('logs').delete().in('id', ids);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('삭제 실패: ' + err.message); }
    };

    const filteredLogs = useMemo(() => {
        if (logCategory === 'SPACE') {
            return allLogs.filter(log => ['CHECKIN', 'CHECKOUT', 'MOVE'].includes(log.type));
        }
        return [];
    }, [allLogs, logCategory]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-4 rounded-2xl gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">로그 기록</h2>
                    <p className="text-gray-500 text-xs md:text-sm">시스템 전체 이용 및 아카이빙 로그</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => exportLogsToExcel(allLogs, users, locations, notices)} className="flex-1 md:flex-none bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition font-bold shadow-sm">
                        <FileSpreadsheet size={18} /> 엑셀 저장
                    </button>
                    <button onClick={fetchData} className="flex-1 md:flex-none bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition font-bold shadow-sm">
                        <RefreshCw size={18} /> 새로고침
                    </button>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex bg-gray-100/50 p-1.5 rounded-2xl w-full md:w-fit border border-gray-100 shadow-inner">
                <button
                    onClick={() => setLogCategory('SPACE')}
                    className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'SPACE' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <MapPin size={16} /> 공간 이용
                </button>
                <button
                    onClick={() => setLogCategory('PROGRAM')}
                    className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'PROGRAM' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Calendar size={16} /> 프로그램 참여
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {logCategory === 'PROGRAM' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="p-4 pl-6 whitespace-nowrap">프로그램 일정</th>
                                    <th className="p-4">프로그램명</th>
                                    <th className="p-4">유형</th>
                                    <th className="p-4">참여 현황</th>
                                    <th className="p-4">명단</th>
                                    <th className="p-4 pr-6 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {programSummaries.length === 0 ? (
                                    <tr><td colSpan="6" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
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
                                                        <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${person.type === 'PRG_ATTENDED' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-100/80 border-gray-200 text-gray-500'}`}>
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
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                    <tr>
                                        <th className="p-4 pl-6">시간</th>
                                        <th className="p-4">이름</th>
                                        <th className="p-4">종류</th>
                                        <th className="p-4 pr-6">위치 / 프로그램 상세</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {(filteredLogs && filteredLogs.length === 0) ? (
                                        <tr><td colSpan="4" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
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

                        <div className="md:hidden divide-y divide-gray-100">
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
                )}
            </div>
        </div>
    );
};

export default AdminLogs;
