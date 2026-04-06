import React from 'react';
import PropTypes from 'prop-types';
import { Trash2, UserPlus } from 'lucide-react';

const AttendanceSection = ({ 
    notice, 
    participantList, 
    onAttendanceToggle, 
    onDeleteParticipant, 
    onMarkAllAttended,
    showEntranceList,
    setShowEntranceList 
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        참여자 명단
                        <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md text-[10px]">
                            {participantList.JOIN?.length || 0}명
                        </span>
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1">
                        출석: {participantList.JOIN.filter(u => u.is_attended).length} / 미참석: {participantList.JOIN.filter(u => !u.is_attended).length}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={onMarkAllAttended}
                        className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition shadow-sm"
                    >
                        전체 참석 처리
                    </button>
                    <button 
                        onClick={() => setShowEntranceList(!showEntranceList)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shadow-sm flex items-center gap-1.5 ${showEntranceList ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                    >
                        <UserPlus size={14} /> 현장 추가
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-4 md:grid-cols-5 p-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500">
                    <div className="col-span-1">이름</div>
                    <div className="col-span-2 md:col-span-2">학교/전화번호</div>
                    <div className="col-span-1 flex justify-center">출석</div>
                    <div className="col-span-1 md:block hidden text-center">관리</div>
                </div>
                <div className="divide-y divide-gray-50">
                    {participantList.JOIN?.length > 0 ? (
                        participantList.JOIN.map(user => (
                            <div key={user.id} className="grid grid-cols-4 md:grid-cols-5 p-3 items-center hover:bg-gray-50 transition text-sm">
                                <div className="col-span-1 font-bold text-gray-800 truncate pr-2 flex items-center gap-1">
                                    {user.name}
                                    {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                </div>
                                <div className="col-span-2 md:col-span-2 flex flex-col justify-center">
                                    <span className="text-xs text-gray-600 truncate">{user.school}</span>
                                    <span className="text-[10px] text-gray-400 font-medium tracking-wider">{user.phone_back4}</span>
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={user.is_attended || false}
                                            onChange={() => onAttendanceToggle(user.id, user.is_attended)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                                <div className="col-span-1 md:block hidden flex justify-center">
                                    <button 
                                        onClick={() => onDeleteParticipant(user.id, user.name)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                        title="신청 취소"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-400 text-sm">신청한 참여자가 없습니다.</div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100/50">
                    <h4 className="font-bold text-orange-700 mb-2 flex justify-between text-[10px] uppercase tracking-wider">
                        대기 <span className="bg-white px-2 rounded-full">{participantList.WAITLIST?.length || 0}</span>
                    </h4>
                    <div className="space-y-1">
                        {participantList.WAITLIST?.map((u, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-gray-600 font-bold truncate flex items-center gap-1">
                                    {u.name}
                                    {u.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                </span>
                                <button 
                                    onClick={() => onDeleteParticipant(u.id, u.name)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {(!participantList.WAITLIST || participantList.WAITLIST.length === 0) && (
                            <span className="text-[10px] text-gray-400">-</span>
                        )}
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-500 mb-2 flex justify-between text-[10px] uppercase tracking-wider">
                        미참석 <span className="bg-white px-2 rounded-full">{participantList.JOIN.filter(u => !u.is_attended).length}</span>
                    </h4>
                    <p className="text-[10px] text-gray-400 truncate flex flex-wrap gap-1">
                        {participantList.JOIN.filter(u => !u.is_attended).length > 0 
                            ? participantList.JOIN.filter(u => !u.is_attended).map((u, idx, arr) => (
                                <span key={u.id} className="flex items-center">
                                    {u.name}
                                    {u.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-0.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                    {idx < arr.length - 1 ? ', ' : ''}
                                </span>
                            ))
                            : '-'}
                    </p>
                </div>
            </div>
        </div>
    );
};

AttendanceSection.propTypes = {
    notice: PropTypes.object.isRequired,
    participantList: PropTypes.object.isRequired,
    onAttendanceToggle: PropTypes.func.isRequired,
    onDeleteParticipant: PropTypes.func.isRequired,
    onMarkAllAttended: PropTypes.func.isRequired,
    showEntranceList: PropTypes.bool.isRequired,
    setShowEntranceList: PropTypes.func.isRequired
};

export default React.memo(AttendanceSection);
