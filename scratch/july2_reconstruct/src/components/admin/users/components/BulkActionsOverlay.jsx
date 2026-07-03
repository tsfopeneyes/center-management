import React from 'react';
import { Search, Save } from 'lucide-react';

const BulkActionsOverlay = ({
    selectedUserIds,
    setSelectedUserIds,
    bulkTargetGroup,
    setBulkTargetGroup,
    handleBulkUpdateGroup,
    sendingBulk
}) => {
    if (selectedUserIds.size === 0) return null;

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] w-[95%] max-w-2xl bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-5 sm:p-6 shadow-[0_30px_60px_rgba(0,0,0,0.4)] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-xl font-black shadow-lg shadow-blue-500/20">
                    {selectedUserIds.size}
                </div>
                <div>
                    <p className="text-white font-black text-base tracking-tight leading-none mb-1">명이 선택되었습니다</p>
                    <button
                        onClick={() => setSelectedUserIds(new Set())}
                        className="text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors"
                    >
                        선택 모두 해제
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest hidden sm:block">변경할 그룹:</span>
                <div className="relative flex-1 sm:flex-none">
                    <select
                        value={bulkTargetGroup}
                        onChange={(e) => setBulkTargetGroup(e.target.value)}
                        className="w-full sm:w-32 py-4 pl-4 pr-10 bg-white/10 hover:bg-white/15 text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                    >
                        <option value="청소년" className="text-gray-800">청소년</option>
                        <option value="졸업생" className="text-gray-800">졸업생</option>
                        <option value="STAFF" className="text-gray-800">STAFF</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                        <Search size={14} className="rotate-90" />
                    </div>
                </div>

                <button
                    onClick={() => handleBulkUpdateGroup(bulkTargetGroup)}
                    disabled={sendingBulk}
                    className="flex-1 sm:flex-none px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:bg-gray-700 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <Save size={18} className={sendingBulk ? 'animate-pulse' : ''} />
                    변경 적용
                </button>
            </div>
        </div>
    );
};

export default BulkActionsOverlay;
