import React, { useState, useMemo } from 'react';
import { Award, MapPin, Users } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

const GuestVisitDetailModal = ({ spaceData, year, month, day, periodType, onClose }) => {
    const guests = useMemo(() => {
        const guestMap = new Map();
        spaceData.roomAnalysis.forEach(room => {
            room.userDetails.forEach(user => {
                if (user.group === '게스트') {
                    if (guestMap.has(user.name)) {
                        const existing = guestMap.get(user.name);
                        existing.count += user.count;
                        existing.duration += user.duration;
                    } else {
                        guestMap.set(user.name, { ...user });
                    }
                }
            });
        });
        return Array.from(guestMap.values()).sort((a, b) => b.duration - a.duration);
    }, [spaceData]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex flex-col gap-4 bg-indigo-50/30">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-indigo-800">게스트 방문 <span className="text-sm font-normal text-indigo-400">이용 상세</span></h3>
                            <p className="text-xs text-indigo-500 font-bold">
                                {year}년 {
                                    periodType === 'DAILY' ? `${month}월 ${day}일` :
                                        periodType === 'WEEKLY' ? `${month}월 ${Math.ceil(day / 7)}주차` :
                                            periodType === 'MONTHLY' ? `${month}월` :
                                                '전체'
                                }
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition text-indigo-400 hover:text-indigo-600">
                            <Users size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
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
                            {guests.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">방문한 게스트가 없습니다.</td></tr>
                            ) : (
                                guests.map((guest, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition">
                                        <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-4 font-bold text-gray-700">{guest.name}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600">
                                                게스트
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-gray-600 font-bold">{guest.count}회</td>
                                        <td className="p-4 text-center text-indigo-600 font-bold">{(guest.duration / 60).toFixed(1)}시간</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="md:hidden divide-y divide-gray-50">
                        {guests.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 text-sm">방문한 게스트가 없습니다.</div>
                        ) : (
                            guests.map((guest, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center transition active:bg-indigo-50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-300 font-bold italic w-4">{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{guest.name}</p>
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-indigo-100 text-indigo-600">
                                                게스트
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-indigo-600 text-xs">{(guest.duration / 60).toFixed(1)}시간</p>
                                        <p className="text-[10px] text-gray-400">{guest.count}회 방문</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-xs text-gray-400">
                    <div className="flex gap-4 font-bold">
                        <span>총 게스트 수: <span className="text-gray-800">{guests.length}명</span></span>
                        <span>총 이용 건수: <span className="text-indigo-600">{guests.reduce((acc, g) => acc + g.count, 0)}건</span></span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuestVisitDetailModal;
