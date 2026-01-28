import React, { useState, useEffect, useRef } from 'react';

const IntuitiveTimePicker = ({ value, onChange }) => {
    // value format: "HH:mm" (24h)
    const [period, setPeriod] = useState('오전');
    const [hour, setHour] = useState(1);
    const [minute, setMinute] = useState(0);

    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':').map(Number);
            if (h >= 12) {
                setPeriod('오후');
                setHour(h === 12 ? 12 : h - 12);
            } else {
                setPeriod('오전');
                setHour(h === 0 ? 12 : h);
            }
            setMinute(m);
        }
    }, [value]);

    const updateValue = (newPeriod, newHour, newMinute) => {
        let h = parseInt(newHour);
        if (newPeriod === '오후' && h !== 12) h += 12;
        if (newPeriod === '오전' && h === 12) h = 0;

        const m = newMinute.toString().padStart(2, '0');
        const hStr = h.toString().padStart(2, '0');
        onChange(`${hStr}:${m}`);
    };

    const handlePeriodChange = (p) => {
        setPeriod(p);
        updateValue(p, hour, minute);
    };

    const handleHourChange = (h) => {
        setHour(h);
        updateValue(period, h, minute);
    };

    const handleMinuteChange = (m) => {
        setMinute(m);
        updateValue(period, hour, m);
    };

    return (
        <div className="flex bg-gray-50 rounded-2xl p-2 border border-gray-100 items-center justify-center gap-1 shadow-inner">
            {/* Period */}
            <div className="flex flex-col gap-1">
                {['오전', '오후'].map(p => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => handlePeriodChange(p)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${period === p ? 'bg-blue-600 text-white shadow-md scale-105' : 'text-gray-400 hover:bg-gray-200'}`}
                    >
                        {p}
                    </button>
                ))}
            </div>

            <div className="w-[1px] h-10 bg-gray-200 mx-1"></div>

            {/* Hour */}
            <div className="flex items-center gap-1">
                <select
                    value={hour}
                    onChange={(e) => handleHourChange(e.target.value)}
                    className="bg-transparent text-lg font-bold text-gray-800 outline-none scrollbar-hide appearance-none px-2 py-1 rounded-lg hover:bg-gray-200"
                >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h}>{h}</option>
                    ))}
                </select>
                <span className="text-gray-400 font-bold">시</span>
            </div>

            <div className="text-gray-300 font-bold">:</div>

            {/* Minute */}
            <div className="flex items-center gap-1">
                <select
                    value={minute}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                    className="bg-transparent text-lg font-bold text-gray-800 outline-none scrollbar-hide appearance-none px-2 py-1 rounded-lg hover:bg-gray-200 text-right"
                >
                    {Array.from({ length: 60 }, (_, i) => i).map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                    ))}
                </select>
                <span className="text-gray-400 font-bold">분</span>
            </div>
        </div>
    );
};

export default IntuitiveTimePicker;
