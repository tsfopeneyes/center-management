import React from 'react';
import { Users, Clock, MapPin, Award, Calendar } from 'lucide-react';

const AnalyticsKPICards = ({ hookData, users }) => {
    const { 
        viewMode, spaceData, programFilter, rawProgramData, programData, rawUserData, setShowGuestModal 
    } = hookData;

    if (!hookData) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {viewMode === 'SPACE' ? (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">총 이용 시간</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                            {(spaceData.roomAnalysis.reduce((acc, curr) => acc + curr.duration, 0) / 60).toFixed(1)} <span className="text-sm font-normal text-gray-400">시간</span>
                        </p>
                        <div className="mt-2 flex gap-2 text-[10px] font-bold">
                            <span className="text-blue-500">재학생 {(spaceData.totalDurationSplit.student / 60).toFixed(1)}h</span>
                            <span className="text-gray-300">|</span>
                            {spaceData.totalDurationSplit.guest > 0 && (
                                <>
                                    <span className="text-indigo-500">게스트 {(spaceData.totalDurationSplit.guest / 60).toFixed(1)}h</span>
                                    <span className="text-gray-300">|</span>
                                </>
                            )}
                            <span className="text-orange-500">졸업생 {(spaceData.totalDurationSplit.graduate / 60).toFixed(1)}h</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><MapPin size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">회원 방문 횟수</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{spaceData.totalVisits} <span className="text-sm font-normal text-gray-400">회</span></p>
                        <div className="mt-2 flex gap-2 text-[10px] font-bold">
                            <span className="text-green-600">재학생 {spaceData.totalVisitsSplit.student}회</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-orange-500">졸업생 {spaceData.totalVisitsSplit.graduate}회</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">회원 방문자 수</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{spaceData.uniqueUsers} <span className="text-sm font-normal text-gray-400">명</span></p>
                        <div className="mt-2 flex gap-2 text-[10px] font-bold">
                            <span className="text-purple-600">재학생 {spaceData.uniqueUsersSplit.student}명</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-orange-500">졸업생 {spaceData.uniqueUsersSplit.graduate}명</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowGuestModal(true)}
                        className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 bg-indigo-50/10 text-left hover:shadow-md transition group"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition"><Users size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">게스트 방문</h3>
                        </div>
                        <p className="text-2xl font-bold text-indigo-600">{spaceData.totalGuests} <span className="text-sm font-normal text-gray-400">건</span></p>
                    </button>
                </>
            ) : viewMode === 'PROGRAM' ? (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">
                                {programFilter === 'ALL' ? '전체 프로그램' : programFilter === 'CENTER' ? '센터 프로그램' : '스처 프로그램'}
                            </h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{programData.length} <span className="text-sm font-normal text-gray-400">개</span></p>
                        <div className="mt-2 flex gap-2 text-[10px] font-bold">
                            {programFilter === 'ALL' ? (
                                <>
                                    <span className="text-blue-500">센터 {rawProgramData.filter(p => (p.program_type || 'CENTER') === 'CENTER').length}</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-purple-500">스처 {rawProgramData.filter(p => p.program_type === 'SCHOOL_CHURCH').length}</span>
                                </>
                            ) : (
                                <span className="text-gray-400">해당 유형 분석 진행 중</span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Award size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">누적 참여 인원</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{programData.reduce((acc, curr) => acc + curr.joinCount, 0)} <span className="text-sm font-normal text-gray-400">명</span></p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">평균 출석률</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                            {programData.filter(p => p.attendanceRate !== null).length > 0
                                ? Math.round(programData.reduce((acc, curr) => acc + (curr.attendanceRate || 0), 0) / programData.filter(p => p.attendanceRate !== null).length)
                                : 0}
                            <span className="text-sm font-normal text-gray-400">%</span>
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">이용 회원 수</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                            {rawUserData.filter(u => u.spaceCount > 0 || u.programCount > 0).length}
                            <span className="text-sm font-normal text-gray-400 ml-1">/ {users.length} 명</span>
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Clock size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">실 이용자 평균 체류</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                            {rawUserData.filter(u => u.spaceCount > 0).length > 0
                                ? (rawUserData.reduce((acc, curr) => acc + curr.spaceDuration, 0) / rawUserData.filter(u => u.spaceCount > 0).length / 60).toFixed(1)
                                : 0}
                            <span className="text-sm font-normal text-gray-400">시간</span>
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Award size={20} /></div>
                            <h3 className="text-gray-500 text-sm font-bold">실 참여자 평균 프로그램</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                            {rawUserData.filter(u => u.programCount > 0).length > 0
                                ? (rawUserData.reduce((acc, curr) => acc + curr.programCount, 0) / rawUserData.filter(u => u.programCount > 0).length).toFixed(1)
                                : 0}
                            <span className="text-sm font-normal text-gray-400">회</span>
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default AnalyticsKPICards;
