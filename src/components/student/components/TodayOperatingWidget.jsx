import React, { useState, useEffect } from 'react';
import { Clock, DoorOpen, DoorClosed } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import UserAvatar from '../../common/UserAvatar';

const TodayOperatingWidget = ({ studentRegion }) => {
    const [operatingHours, setOperatingHours] = useState(null);
    const [staffConfig, setStaffConfig] = useState({ "하이픈": [], "이높플레이스": [] });
    const [presenceStatus, setPresenceStatus] = useState({});
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHoursAndStaffConfig = async () => {
        try {
            // Fetch system configs from notices
            const { data: configs, error: configError } = await supabase
                .from('notices')
                .select('title, content')
                .eq('category', 'SYSTEM')
                .in('title', ['OPERATING_HOURS_CONFIG', 'STAFF_PRESENCE_CONFIG', 'STAFF_PRESENCE_STATUS']);

            if (!configError && configs) {
                const hoursNotice = configs.find(c => c.title === 'OPERATING_HOURS_CONFIG');
                const presenceConfigNotice = configs.find(c => c.title === 'STAFF_PRESENCE_CONFIG');
                const presenceStatusNotice = configs.find(c => c.title === 'STAFF_PRESENCE_STATUS');

                if (hoursNotice?.content) {
                    try {
                        const parsed = JSON.parse(hoursNotice.content);
                        setOperatingHours(parsed);
                    } catch (e) { console.error('Failed to parse operating hours', e); }
                }

                if (presenceConfigNotice?.content) {
                    try {
                        const parsedConfig = JSON.parse(presenceConfigNotice.content);
                        if (parsedConfig && typeof parsedConfig === 'object' && !Array.isArray(parsedConfig)) {
                            setStaffConfig(parsedConfig);
                        } else if (Array.isArray(parsedConfig)) {
                            // Legacy fallback
                            setStaffConfig({
                                "하이픈": parsedConfig,
                                "이높플레이스": parsedConfig
                            });
                        }
                    } catch (e) { console.error('Failed to parse staff config', e); }
                }

                if (presenceStatusNotice?.content) {
                    try {
                        const parsedStatus = JSON.parse(presenceStatusNotice.content);
                        setPresenceStatus(parsedStatus || {});
                    } catch (e) { console.error('Failed to parse staff status config', e); }
                }
            }
        } catch (err) {
            console.error('Failed to fetch operating hours or staff config', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHoursAndStaffConfig();

        // Realtime subscription to notice updates for config & status
        const subscription = supabase
            .channel('realtime-student-operating')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notices', filter: 'category=eq.SYSTEM' },
                async (payload) => {
                    const { title, content } = payload.new || {};
                    if (title === 'STAFF_PRESENCE_STATUS') {
                        try {
                            const parsedStatus = JSON.parse(content);
                            setPresenceStatus(parsedStatus || {});
                        } catch (e) { console.error(e); }
                    } else if (title === 'STAFF_PRESENCE_CONFIG' || title === 'OPERATING_HOURS_CONFIG') {
                        fetchHoursAndStaffConfig();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    useEffect(() => {
        const fetchStaffDetails = async () => {
            let filteredIds = [];
            if (studentRegion === '강동') {
                filteredIds = staffConfig["하이픈"] || [];
            } else if (studentRegion === '강서') {
                filteredIds = staffConfig["이높플레이스"] || [];
            } else {
                // Fallback: union of all spaces if no region is set (e.g. guest or legacy)
                filteredIds = Array.from(new Set([
                    ...(staffConfig["하이픈"] || []),
                    ...(staffConfig["이높플레이스"] || [])
                ]));
            }

            if (filteredIds.length > 0) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, name, profile_image_url, role, user_group')
                    .in('id', filteredIds);
                
                if (!userError && userData) {
                    const orderedStaff = filteredIds
                        .map(id => userData.find(u => u.id === id))
                        .filter(Boolean);
                    setStaffList(orderedStaff);
                } else {
                    setStaffList([]);
                }
            } else {
                setStaffList([]);
            }
        };

        fetchStaffDetails();
    }, [staffConfig, studentRegion]);

    if (loading) return null;

    const today = new Date();
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeekStr = dayMap[today.getDay()];
    const todayConfig = operatingHours ? operatingHours[dayOfWeekStr] : null;

    // Default configuration if not set
    const isOpen = todayConfig ? todayConfig.isOpen : false;
    const openTime = todayConfig ? todayConfig.open : '10:00';
    const closeTime = todayConfig ? todayConfig.close : '18:00';

    // Filter present staff members
    const presentStaff = staffList.filter(u => !!presenceStatus[u.id]);

    return (
        <div className={`p-5 rounded-[24px] border shadow-[0_4px_16px_rgba(0,0,0,0.02)] flex flex-col transition-all duration-300 ${isOpen ? 'bg-blue-50/50 border-blue-100/50' : 'bg-gray-50/50 border-gray-100/50'}`}>
            <div className="flex items-center justify-between w-full">
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

            {/* Present Staff Section */}
            {isOpen && presentStaff.length > 0 && (
                <div className="w-full flex flex-col gap-2.5 mt-3.5 pt-3.5 border-t border-blue-100/60 animate-fade-in">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase ml-1">센터에서 만나요!</span>
                    <div className="flex flex-wrap gap-4 items-center pl-1">
                        {presentStaff.map(member => (
                            <div key={member.id} className="flex flex-col items-center justify-center text-center gap-1 min-w-[50px] animate-scale-in">
                                <UserAvatar user={member} size="w-8 h-8" />
                                <span className="text-[10px] font-bold text-slate-600 leading-tight">{member.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodayOperatingWidget;
