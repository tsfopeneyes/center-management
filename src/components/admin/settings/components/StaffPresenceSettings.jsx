import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Users, Search, Check, Save, X } from 'lucide-react';
import UserAvatar from '../../../common/UserAvatar';

const StaffPresenceSettings = ({ users, selectedStaffConfig = { "하이픈": [], "이높플레이스": [] }, onSave, isSaving }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [localConfig, setLocalConfig] = useState(selectedStaffConfig);

    // Sync prop changes to local state
    useEffect(() => {
        if (selectedStaffConfig) {
            setLocalConfig(selectedStaffConfig);
        }
    }, [selectedStaffConfig]);

    // Filter staff candidates from all users:
    // users who are admin role, STAFF/관리자 group, or name is 'admin'
    const candidates = users.filter(u => 
        u.role === 'admin' || 
        u.user_group === 'STAFF' || 
        u.user_group === '관리자' || 
        u.name === 'admin'
    );

    // Filter by search term
    const filteredCandidates = candidates.filter(u => 
        u.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter candidates for each space (Mutual exclusion)
    const hyphenCandidates = filteredCandidates.filter(u => 
        !(localConfig["이높플레이스"]?.includes(u.id))
    );

    const inopeCandidates = filteredCandidates.filter(u => 
        !(localConfig["하이픈"]?.includes(u.id))
    );

    // Get selected staff details for top list
    const selectedHyphenStaff = (localConfig["하이픈"] || [])
        .map(id => users.find(u => u.id === id))
        .filter(Boolean);

    const selectedInopeStaff = (localConfig["이높플레이스"] || [])
        .map(id => users.find(u => u.id === id))
        .filter(Boolean);

    const handleToggleSelect = (userId, space) => {
        setLocalConfig(prev => {
            const currentList = prev[space] || [];
            const isSelecting = !currentList.includes(userId);
            const newList = isSelecting
                ? [...currentList, userId]
                : currentList.filter(id => id !== userId);
            
            // Mutual exclusion: if selecting for 'space', make sure it is deselected in the other space
            const otherSpace = space === "하이픈" ? "이높플레이스" : "하이픈";
            const otherList = prev[otherSpace] || [];
            const newOtherList = otherList.filter(id => id !== userId);

            return {
                ...prev,
                [space]: newList,
                [otherSpace]: newOtherList
            };
        });
    };

    const handleSave = () => {
        onSave(localConfig);
    };

    return (
        <div className="p-6 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-800 tracking-tight">스탭 현황 노출 설정</h3>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">각 공간(하이픈, 이높플레이스)별로 근무할 스탭을 지정합니다.</p>
                    </div>
                </div>
            </div>

            {/* Search Box */}
            <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-600 focus-within:bg-white transition-all">
                <Search className="absolute left-3.5 text-gray-400 shrink-0" size={16} />
                <input
                    type="text"
                    placeholder="스탭 이름으로 검색..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-transparent outline-none font-semibold text-gray-700 text-sm"
                />
            </div>

            {/* Categorized Spaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hyphen Space */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-sm font-black text-blue-600 flex items-center gap-1.5 px-1 pb-1 border-b border-blue-50">
                        <span className="w-1.5 h-3.5 bg-blue-500 rounded-full"></span>
                        하이픈 공간 스탭
                    </h4>
                    
                    {/* Selected Staff tags */}
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] items-center p-2 bg-slate-50/50 rounded-xl border border-slate-100/80">
                        {selectedHyphenStaff.length > 0 ? (
                            selectedHyphenStaff.map(u => (
                                <span
                                    key={`tag-hyphen-${u.id}`}
                                    onClick={() => handleToggleSelect(u.id, "하이픈")}
                                    className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 transition-all shadow-sm"
                                >
                                    <UserAvatar user={u} size="w-4 h-4" />
                                    <span>{u.name}</span>
                                    <X size={10} className="text-slate-400 hover:text-red-500 shrink-0 ml-0.5" />
                                </span>
                            ))
                        ) : (
                            <span className="text-[11px] font-bold text-slate-400 pl-1">선택된 스탭이 없습니다.</span>
                        )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {hyphenCandidates.length > 0 ? (
                            hyphenCandidates.map(u => {
                                const isSelected = localConfig["하이픈"]?.includes(u.id) || false;
                                return (
                                    <button
                                        type="button"
                                        key={`hyphen-${u.id}`}
                                        onClick={() => handleToggleSelect(u.id, "하이픈")}
                                        className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 text-left ${
                                            isSelected
                                                ? 'border-blue-300 bg-blue-50/20 shadow-sm'
                                                : 'border-slate-100 bg-white hover:border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <UserAvatar user={u} size="w-8 h-8" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-slate-800 truncate">{u.name}</span>
                                                    <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1 py-0.2 rounded shrink-0">
                                                        {u.user_group || u.role}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center border rounded-md transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-blue-600 bg-blue-600 text-white' 
                                                : 'border-slate-300 bg-white'
                                        }`}>
                                            {isSelected && <Check size={10} strokeWidth={3.5} />}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-xs font-medium text-slate-400">
                                스탭이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* Inopeplace Space */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-sm font-black text-purple-600 flex items-center gap-1.5 px-1 pb-1 border-b border-purple-50">
                        <span className="w-1.5 h-3.5 bg-purple-500 rounded-full"></span>
                        이높플레이스 공간 스탭
                    </h4>

                    {/* Selected Staff tags */}
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] items-center p-2 bg-slate-50/50 rounded-xl border border-slate-100/80">
                        {selectedInopeStaff.length > 0 ? (
                            selectedInopeStaff.map(u => (
                                <span
                                    key={`tag-inope-${u.id}`}
                                    onClick={() => handleToggleSelect(u.id, "이높플레이스")}
                                    className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 transition-all shadow-sm"
                                >
                                    <UserAvatar user={u} size="w-4 h-4" />
                                    <span>{u.name}</span>
                                    <X size={10} className="text-slate-400 hover:text-red-500 shrink-0 ml-0.5" />
                                </span>
                            ))
                        ) : (
                            <span className="text-[11px] font-bold text-slate-400 pl-1">선택된 스탭이 없습니다.</span>
                        )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {inopeCandidates.length > 0 ? (
                            inopeCandidates.map(u => {
                                const isSelected = localConfig["이높플레이스"]?.includes(u.id) || false;
                                return (
                                    <button
                                        type="button"
                                        key={`inope-${u.id}`}
                                        onClick={() => handleToggleSelect(u.id, "이높플레이스")}
                                        className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 text-left ${
                                            isSelected
                                                ? 'border-purple-300 bg-purple-50/20 shadow-sm'
                                                : 'border-slate-100 bg-white hover:border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <UserAvatar user={u} size="w-8 h-8" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-slate-800 truncate">{u.name}</span>
                                                    <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1 py-0.2 rounded shrink-0">
                                                        {u.user_group || u.role}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center border rounded-md transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-purple-600 bg-purple-600 text-white' 
                                                : 'border-slate-300 bg-white'
                                        }`}>
                                            {isSelected && <Check size={10} strokeWidth={3.5} />}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-xs font-medium text-slate-400">
                                스탭이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-50 mt-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`px-5 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg flex items-center gap-2 text-sm ${
                        isSaving ? 'bg-blue-300 cursor-not-allowed' : ''
                    }`}
                >
                    <Save size={16} />
                    {isSaving ? '저장 중...' : '설정 저장하기'}
                </button>
            </div>
        </div>
    );
};

StaffPresenceSettings.propTypes = {
    users: PropTypes.array.isRequired,
    selectedStaffConfig: PropTypes.object,
    onSave: PropTypes.func.isRequired,
    isSaving: PropTypes.bool.isRequired
};

export default StaffPresenceSettings;
