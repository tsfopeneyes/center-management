import React, { useState, useEffect, useRef } from 'react';
import { Eye, Search, X, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const StudentImpersonateBar = ({ user, impersonatedUser, onSelectStudent, onReset }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef(null);

    // Only allow staff / master users
    const isMasterOrStaff = user?.user_group === 'STAFF' || user?.is_master || user?.role === 'admin' || user?.name === 'Rok' || user?.name === 'admin';

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Live search student users
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, name, school, grade, phone, user_group, role, profile_image_url, current_haifn')
                    .ilike('name', `%${searchTerm.trim()}%`)
                    .limit(10);

                if (error) {
                    console.error('Error searching students:', error);
                } else if (data) {
                    setSearchResults(data);
                    setShowDropdown(true);
                }
            } catch (err) {
                console.error('Error searching students:', err);
            } finally {
                setSearching(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    if (!isMasterOrStaff) return null;

    return (
        <div ref={containerRef} className="w-full mb-3.5 z-[100] relative animate-fade-in">
            {impersonatedUser ? (
                /* 미리보기 모드 활성화 시 컴팩트 상단 띠 */
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-between border border-blue-400/30">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                            <Eye size={16} className="text-white animate-pulse" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-md">
                                미리보기
                            </span>
                            <span className="text-xs font-bold text-white">
                                {impersonatedUser.name} 학생 시점
                            </span>
                            <span className="text-[11px] text-blue-100 font-semibold hidden sm:inline">
                                ({impersonatedUser.school || '학교미지정'} {impersonatedUser.grade ? `${impersonatedUser.grade}학년` : ''})
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onReset}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer backdrop-blur-md border border-white/20 hover:scale-105 active:scale-95 shrink-0"
                    >
                        <X size={14} />
                        <span>복귀</span>
                    </button>
                </div>
            ) : (
                /* 미리보기 선택 바 (컴팩트 1줄 스타일) */
                <div className="bg-slate-900 text-white py-2 px-3.5 rounded-xl shadow-md flex items-center justify-between gap-3 border border-slate-800">
                    <div className="flex items-center gap-2 shrink-0">
                        <Sparkles size={15} className="text-blue-400" />
                        <span className="text-xs font-bold text-white tracking-tight">학생 화면 미리보기</span>
                    </div>

                    <div className="relative flex-1 max-w-[200px] sm:max-w-[240px]">
                        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition">
                            <Search size={13} className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="학생 이름 검색..."
                                className="bg-transparent text-xs font-bold text-white outline-none w-full placeholder:text-slate-500"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white shrink-0">
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* 검색 결과 드롭다운 */}
                        {showDropdown && (
                            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-[160] overflow-hidden">
                                <div className="p-2 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                    <span>검색 결과 ({searchResults.length}건)</span>
                                    {searching && <span className="text-blue-600">조회 중...</span>}
                                </div>

                                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((st) => (
                                            <button
                                                key={st.id}
                                                type="button"
                                                onClick={() => {
                                                    onSelectStudent(st);
                                                    setSearchTerm('');
                                                    setShowDropdown(false);
                                                }}
                                                className="w-full text-left p-2.5 hover:bg-blue-50/70 transition flex items-center justify-between group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                                                        {st.name?.slice(0, 1) || '학'}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                                                            {st.name} <span className="text-[10px] text-slate-400 font-medium">({st.user_group || 'STUDENT'})</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-medium">
                                                            {st.school || '학교 미지정'} {st.grade ? `${st.grade}학년` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={15} className="text-slate-300 group-hover:text-blue-600 transition" />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-3.5 text-center text-xs text-slate-400 font-medium">
                                            해당 이름의 학생을 찾을 수 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentImpersonateBar;
