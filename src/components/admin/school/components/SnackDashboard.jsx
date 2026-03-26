import React, { useMemo } from 'react';
import { Cookie, List, ChevronRight } from 'lucide-react';

const SnackDashboard = ({ schools, selectedRegion, onClickSchool }) => {
    const filteredSchools = useMemo(() => {
        return schools.filter(s => {
            if (selectedRegion === 'ALL') return true;
            if (selectedRegion === '미지정') return !s.region;
            return s.region === selectedRegion;
        }).map(s => {
            const history = s.snack_history || [];
            const count = history.filter(h => h.date || h.type).length;
            const lastSnack = history.filter(h => h.date || h.type).reverse()[0];
            return { ...s, count, lastSnack };
        }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [schools, selectedRegion]);

    const stats = useMemo(() => {
        const total = filteredSchools.length;
        const supported = filteredSchools.filter(s => s.count > 0).length;
        const totalCount = filteredSchools.reduce((acc, curr) => acc + curr.count, 0);
        return { total, supported, totalCount };
    }, [filteredSchools]);

    return (
        <div className="space-y-8 pb-10 animate-fade-in">
            {/* Stats Summary */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-1 bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                        <Cookie size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-gray-800">간식 지원</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">학교별 간식 지원 현황</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 xl:col-span-3">
                    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">대상 학교</p>
                        <p className="text-2xl font-black text-gray-800">{stats.total}<span className="text-xs font-bold ml-1 opacity-40">개교</span></p>
                    </div>
                    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">지원 완료 학교</p>
                        <p className="text-2xl font-black text-amber-600">{stats.supported}<span className="text-xs font-bold ml-1 opacity-40">개교</span></p>
                    </div>
                    <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">총 지원 횟수</p>
                        <p className="text-2xl font-black text-orange-600">{stats.totalCount}<span className="text-xs font-bold ml-1 opacity-40">회</span></p>
                    </div>
                </div>
            </div>

            {/* School List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                            <List size={16} />
                        </div>
                        <h3 className="text-xl font-black text-gray-800">학교별 상세 현황</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-black">
                        {filteredSchools.length}개 학교
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <th className="px-6 py-4">학교명 / 지역</th>
                                <th className="px-6 py-4">동아리</th>
                                <th className="px-6 py-4 text-center">지원 횟수 (MAX 10)</th>
                                <th className="px-6 py-4">최근 지원 내역</th>
                                <th className="px-6 py-4 text-right">상세보기</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSchools.map((s) => (
                                <tr key={s.id} className="group hover:bg-amber-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-800 text-sm group-hover:text-amber-700 transition-colors">{s.name}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{s.region || '미지정'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${s.club_name ? 'bg-indigo-50 text-indigo-600' : 'text-gray-300'}`}>
                                            {s.club_name || '동아리 없음'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= s.count ? 'bg-amber-500' : 'bg-gray-100'}`} />
                                                ))}
                                            </div>
                                            <span className="text-[11px] font-black text-amber-600">{s.count} / 10</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {s.lastSnack ? (
                                            <div className="flex flex-col">
                                                <span className="text-xs font-extrabold text-gray-700">{s.lastSnack.type}</span>
                                                <span className="text-[10px] font-bold text-gray-400">{s.lastSnack.date}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] font-bold text-gray-200">지원 내역 없음</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => onClickSchool(s.name)}
                                            className="p-2 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredSchools.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-gray-400 font-bold">
                                        선택된 지역에 학교가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SnackDashboard;