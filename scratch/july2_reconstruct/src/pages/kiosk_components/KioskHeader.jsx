import React from 'react';
import { MapPin, Settings } from 'lucide-react';

const KioskHeader = ({ selectedLocation, currentTime, resetLocation }) => {
    return (
        <header className="p-4 sm:p-8 flex justify-between items-center shrink-0 z-10 w-full">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-3 sm:p-5 bg-blue-600 rounded-2xl sm:rounded-[2rem] text-white shadow-xl shadow-blue-200/50 shrink-0">
                    <MapPin size={24} className="sm:w-8 sm:h-8" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-3xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase truncate">SCI CENTER</h1>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate">{selectedLocation.name} KIOSK</p>
                </div>
            </div>
            <div className="flex items-center gap-8">
                <div className="text-right hidden sm:block border-r border-slate-200 pr-8 mr-2">
                    <p className="text-4xl font-black text-slate-800 leading-none">
                        {currentTime.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest opacity-60">
                        {currentTime.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <button onClick={resetLocation} className="p-4 bg-white rounded-2xl text-slate-300 hover:text-blue-600 transition shadow-sm border border-slate-100 active:scale-90">
                    <Settings size={24} />
                </button>
            </div>
        </header>
    );
};

export default KioskHeader;
