import React, { useState, useMemo } from 'react';
import { Award, MapPin, Users } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

const RoomMemberDetailModal = ({ room, year, month, day, periodType, onClose }) => {
    const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'YOUTH', 'GRADUATE'

    const filteredUsers = useMemo(() => {
        if (filterType === 'ALL') return room.userDetails;
        if (filterType === 'GRADUATE') return room.userDetails.filter(u => u.group === '졸업생');
        if (filterType === 'YOUTH') return room.userDetails.filter(u => u.group !== '졸업생' && u.group !== '일반인'); // Includes '게스트', '재학생' etc.
        return room.userDetails;
    }, [room.userDetails, filterType]);

    const totalFilteredDuration = filteredUsers.reduce((acc, curr) => acc + curr.duration, 0);
    const totalFilteredCount = filteredUsers.length;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex flex-col gap-4 bg-gray-50/50">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">{room.name} <span className="text-sm font-normal text-gray-400">이용 상세</span></h3>
                            <p className="text-xs text-gray-500 font-bold">
                                {year}년 {
                                    periodType === 'DAILY' ? `${month}월 ${day}일` :
                                        periodType === 'WEEKLY' ? `${month}월 ${Math.ceil(day / 7)}주차` :
                                            periodType === 'MONTHLY' ? `${month}월` :
                                                '전체'
                                }
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-gray-400 hover:text-gray-600">
                            <MapPin size={24} />
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => setFilterType('YOUTH')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'YOUTH' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            청소년
                        </button>
                        <button
                            onClick={() => setFilterType('GRADUATE')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'GRADUATE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            졸업생
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0">
                            <tr>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">이름</th>
                                <th className="p-4">그룹</th>
                                <th className="p-4 text-center">방문 횟수</th>
                                <th className="p-4 text-center">총 이용 시간</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {!filteredUsers || filteredUsers.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                            ) : (
                                filteredUsers.map((user, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition">
                                        <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-4 font-bold text-gray-700">{user.name}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.group === '졸업생' ? 'bg-gray-100 text-gray-600' :
                                                user.group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {user.group || '재학생'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-gray-600 font-bold">{user.count}회</td>
                                        <td className="p-4 text-center text-blue-600 font-bold">{(user.duration / 60).toFixed(1)}시간</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden divide-y divide-gray-50">
                        {!filteredUsers || filteredUsers.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 text-sm">데이터가 없습니다.</div>
                        ) : (
                            filteredUsers.map((user, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center transition active:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-300 font-bold italic w-4">{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{user.name}</p>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${user.group === '졸업생' ? 'bg-gray-100 text-gray-600' :
                                                user.group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {user.group || '재학생'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-600 text-xs">{(user.duration / 60).toFixed(1)}시간</p>
                                        <p className="text-[10px] text-gray-400">{user.count}회 방문</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/30 flex flex-col md:flex-row gap-4 justify-between items-center text-xs text-gray-400">
                    <div className="flex gap-4 font-bold">
                        <span>
                            {filterType === 'ALL' ? '총 이용자' : filterType === 'YOUTH' ? '청소년 이용자' : '졸업생 이용자'}: {' '}
                            <span className="text-gray-800">{totalFilteredCount}명</span>
                        </span>
                        <span>
                            {filterType === 'ALL' ? '총 시간' : filterType === 'YOUTH' ? '청소년 시간' : '졸업생 시간'}: {' '}
                            <span className="text-gray-800">{(totalFilteredDuration / 60).toFixed(1)}시간</span>
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoomMemberDetailModal;
