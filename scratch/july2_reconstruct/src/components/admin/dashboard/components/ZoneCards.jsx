import React from 'react';
import { Settings, Users } from 'lucide-react';

const ZoneCards = ({
    locationTab,
    setLocationTab,
    setActiveMenu,
    totalActive,
    filteredLocations,
    zoneStats,
    dailyVisitStats,
    handleZoneClick
}) => {
    return (
        <section>
            <div className="flex justify-between items-center mb-6 overflow-x-auto no-scrollbar py-1">
                <div className="flex gap-2 mr-4">
                    {['ALL:전체 보기', 'HYPHEN:하이픈', 'ENOF:이높플레이스'].map(tab => {
                        const [id, label] = tab.split(':');
                        return (
                            <button
                                key={id}
                                onClick={() => setLocationTab(id)}
                                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition flex-shrink-0 ${locationTab === id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                {label}
                            </button>
                        )
                    })}
                </div>
                <button onClick={() => setActiveMenu('SETTINGS')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1 font-bold whitespace-nowrap flex-shrink-0 shadow-sm border border-gray-100">
                    <Settings size={14} /> 공간 관리
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                {/* Total Count Card */}
                <div className="bg-primary-gradient p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-500/20 text-white flex flex-col justify-center relative overflow-hidden min-h-[140px] md:min-h-[180px] btn-tactile">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl animate-float opacity-50" />
                    <h3 className="text-blue-100 text-[10px] md:text-sm font-black mb-1 uppercase tracking-widest opacity-90">Total Active</h3>
                    <p className="text-4xl md:text-6xl font-black tracking-tighter tabular-nums">{totalActive}<span className="text-base md:text-xl text-blue-200 ml-1 md:ml-2 font-black uppercase">명</span></p>
                    <div className="mt-2 md:mt-4 flex items-center gap-2 bg-white/20 w-fit px-3 py-1.5 md:px-4 md:py-2 rounded-2xl backdrop-blur-md border border-white/10">
                        <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-200 animate-pulse" />
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Live Status</span>
                    </div>
                </div>

                {/* Zone Cards */}
                {filteredLocations.map(loc => (
                    <div
                        key={loc.id}
                        onClick={() => handleZoneClick(loc)}
                        className="glass-card p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] text-left cursor-pointer hover:border-blue-500 transition-all duration-500 btn-tactile group flex flex-col justify-between min-h-[140px] md:min-h-[180px]"
                    >
                        <div className="flex justify-between items-start mb-4 md:mb-6">
                            <h3 className="text-gray-400 text-[10px] md:text-sm font-black group-hover:text-blue-600 break-keep leading-tight transition-colors uppercase tracking-widest">{loc.name}</h3>
                            <div className="text-gray-300 group-hover:text-blue-500 bg-gray-50/50 group-hover:bg-blue-50 p-2 md:p-3 rounded-2xl transition-all duration-300 shrink-0 shadow-inner">
                                <Users size={16} className="md:w-[22px] md:h-[22px]" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-4xl md:text-5xl font-black text-gray-800 group-hover:text-blue-600 transition-colors tracking-tighter tabular-nums">{zoneStats[loc.id] || 0}<span className="text-xs md:text-sm font-bold text-gray-400 ml-1 md:ml-2">명</span></p>
                            <div className="flex items-center gap-1.5 mt-2 md:mt-4 bg-gray-50 group-hover:bg-blue-50 w-fit px-3 py-1 md:px-4 md:py-1.5 rounded-2xl transition-colors border border-transparent group-hover:border-blue-100 shadow-sm">
                                <p className="text-[9px] md:text-[11px] font-black text-gray-400 group-hover:text-blue-500 transition-colors uppercase tracking-widest">Today {dailyVisitStats[loc.id] || 0}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ZoneCards;
