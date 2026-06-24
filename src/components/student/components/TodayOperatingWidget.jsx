import React, { useState, useEffect } from 'react';
import { Clock, DoorOpen, DoorClosed } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const TodayOperatingWidget = () => {
    const [operatingHours, setOperatingHours] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHours = async () => {
            try {
                const { data, error } = await supabase
                    .from('notices')
                    .select('content')
                    .eq('category', 'SYSTEM')
                    .eq('title', 'OPERATING_HOURS_CONFIG')
                    .single();

                if (!error && data?.content) {
                    try {
                        const parsed = JSON.parse(data.content);
                        setOperatingHours(parsed);
                    } catch (e) {
                        console.error('Failed to parse operating hours JSON', e);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch operating hours', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHours();
    }, []);

    if (loading) return null;

    const today = new Date();
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeekStr = dayMap[today.getDay()];
    const todayConfig = operatingHours ? operatingHours[dayOfWeekStr] : null;

    // Default configuration if not set
    const isOpen = todayConfig ? todayConfig.isOpen : false;
    const openTime = todayConfig ? todayConfig.open : '10:00';
    const closeTime = todayConfig ? todayConfig.close : '18:00';

    return (
        <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between transition-colors ${isOpen ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-gray-200 text-gray-500'}`}>
                    {isOpen ? <DoorOpen size={20} /> : <DoorClosed size={20} />}
                </div>
                <div className="flex flex-col">
                    <span className={`text-xs font-bold mb-0.5 ${isOpen ? 'text-blue-600' : 'text-gray-500'}`}>
                        {isOpen ? '오늘 센터 오픈 날이에요!' : '오늘은 센터 휴관일이에요'}
                    </span>
                    <div className="flex items-center gap-1.5 text-gray-700 font-black text-sm">
                        {isOpen ? (
                            <>
                                <Clock size={14} className="text-blue-400" />
                                <span>{openTime} ~ {closeTime}</span>
                            </>
                        ) : (
                            <span className="text-gray-400">다음에 다시 만나요</span>
                        )}
                    </div>
                </div>
            </div>
            {isOpen && (
                <div className="bg-white/80 backdrop-blur-sm text-blue-600 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm border border-blue-100">
                    OPEN
                </div>
            )}
        </div>
    );
};

export default TodayOperatingWidget;
