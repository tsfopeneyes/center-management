import React, { useState, useEffect } from 'react';
import { Clock, DoorOpen, DoorClosed } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import UserAvatar from '../../common/UserAvatar';

const TodayOperatingWidget = ({ studentRegion }) => {
    const [operatingHours, setOperatingHours] = useState(null);
    const [staffConfig, setStaffConfig] = useState({ "하이픈": [], "이높플레이스": [] });
    const [presenceStatus, setPresenceStatus] = useState({});
    const [dutyStaff, setDutyStaff] = useState({ "하이픈": "", "이높플레이스": "" });
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHoursAndStaffConfig = async () => {
        try {
            // Fetch system configs from notices
            const { data: configs, error: configError } = await supabase
                .from('notices')
                .select('id, title, content')
                .eq('category', 'SYSTEM')
                .in('title', ['OPERATING_HOURS_CONFIG', 'STAFF_PRESENCE_CONFIG', 'STAFF_PRESENCE_STATUS', 'DAILY_DUTY_STAFF']);

            if (!configError && configs) {
                const hoursNotice = configs.find(c => c.title === 'OPERATING_HOURS_CONFIG');
                const presenceConfigNotice = configs.find(c => c.title === 'STAFF_PRESENCE_CONFIG');
                const presenceStatusNotice = configs.find(c => c.title === 'STAFF_PRESENCE_STATUS');
                const dutyNotice = configs.find(c => c.title === 'DAILY_DUTY_STAFF');

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
                        let parsedStatus = JSON.parse(presenceStatusNotice.content) || {};
                        
                        const now = new Date();
                        const todayStr = now.toLocaleDateString('sv');
                        const currentHour = now.getHours();
                        const isAfter6PM = currentHour >= 18;
                        
                        let needsReset = false;
                        
                        if (parsedStatus.date && parsedStatus.date !== todayStr) {
                            needsReset = true;
                        }
                        
                        const hasActive = Object.keys(parsedStatus).some(k => k !== 'date' && parsedStatus[k] === true);
                        if (isAfter6PM && hasActive) {
                            needsReset = true;
                        }
                        
                        if (needsReset) {
                            parsedStatus = { date: todayStr };
                            const payload = {
                                title: 'STAFF_PRESENCE_STATUS',
                                content: JSON.stringify(parsedStatus),
                                category: 'SYSTEM',
                                is_sticky: false,
                                is_recruiting: false
                            };
                            if (presenceStatusNotice.id) {
                                await supabase.from('notices').update(payload).eq('id', presenceStatusNotice.id);
                            } else {
                                await supabase.from('notices').insert([payload]);
                            }
                        }
                        
                        setPresenceStatus(parsedStatus);
                    } catch (e) { console.error('Failed to parse staff status config', e); }
                } else {
                    const now = new Date();
                    const todayStr = now.toLocaleDateString('sv');
                    setPresenceStatus({ date: todayStr });
                }

                if (dutyNotice?.content) {
                    try {
                        const parsedDuty = JSON.parse(dutyNotice.content);
                        setDutyStaff(parsedDuty || { "하이픈": "", "이높플레이스": "" });
                    } catch (e) { console.error('Failed to parse duty config', e); }
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
                    } else if (title === 'DAILY_DUTY_STAFF') {
                        try {
                            const parsedDuty = JSON.parse(content);
                            setDutyStaff(parsedDuty || { "하이픈": "", "이높플레이스": "" });
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
        // Periodic check every 30 seconds for 6 PM reset and day change
        const interval = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            
            // Check if day changed or it's after 6 PM with active presence
            const todayStr = now.toLocaleDateString('sv');
            const hasActive = Object.keys(presenceStatus).some(k => k !== 'date' && presenceStatus[k] === true);
            const differentDay = presenceStatus.date && presenceStatus.date !== todayStr;
            
            if (differentDay || (currentHour >= 18 && hasActive)) {
                fetchHoursAndStaffConfig();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [presenceStatus]);

    useEffect(() => {
        const fetchStaffDetails = async () => {
            let filteredIds = [];
            if (studentRegion === '강동') {
                filteredIds = staffConfig["하이픈"] || [];
            } else if (studentRegion === '강서') {
                filteredIds = staffConfig["이높플레이스"] || [];
            } else {
                filteredIds = Array.from(new Set([
                    ...(staffConfig["하이픈"] || []),
                    ...(staffConfig["이높플레이스"] || [])
                ]));
            }

            const currentSpaceKey = studentRegion === '강서' ? '이높플레이스' : '하이픈';
            const currentDutyId = dutyStaff[currentSpaceKey];
            
            let fetchIds = [...filteredIds];
            if (currentDutyId && !fetchIds.includes(currentDutyId)) {
                fetchIds.push(currentDutyId);
            }

            if (fetchIds.length > 0) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, name, profile_image_url, role, user_group')
                    .in('id', fetchIds);
                
                if (!userError && userData) {
                    const orderedStaff = fetchIds
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
    }, [staffConfig, studentRegion, dutyStaff]);

    if (loading) return null;

    const today = new Date();
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeekStr = dayMap[today.getDay()];
    const todayConfig = operatingHours ? operatingHours[dayOfWeekStr] : null;

    const isOpen = todayConfig ? todayConfig.isOpen : false;
    const openTime = todayConfig ? todayConfig.open : '10:00';
    const closeTime = todayConfig ? todayConfig.close : '18:00';

    const now = new Date();
    const currentHour = now.getHours();
    const isAfter6PM = currentHour >= 18;
    const isDutyTime = currentHour >= 14 && currentHour < 22; // 오후 2시 ~ 오후 10시

    const currentSpaceKey = studentRegion === '강서' ? '이높플레이스' : '하이픈';
    const dutyStaffId = dutyStaff[currentSpaceKey];

    // Duty staff member:
    // - If toggled present (근무 중): show immediately (before 6 PM)
    // - If NOT toggled present: show only during duty hours (2 PM ~ 10 PM)
    const dutyMember = (() => {
        if (!dutyStaffId) return null;
        const member = staffList.find(u => u.id === dutyStaffId);
        if (!member) return null;
        const isToggledPresent = !isAfter6PM && !!presenceStatus[dutyStaffId];
        if (isToggledPresent || isDutyTime) return member;
        return null;
    })();

    // Present (non-duty) staff: after 6 PM all are absent
    const presentStaff = isAfter6PM 
        ? [] 
        : staffList.filter(u => !!presenceStatus[u.id] && u.id !== dutyStaffId);

    const hasDuty = !!dutyMember;
    const hasPresent = presentStaff.length > 0;
    const hasAnyone = hasDuty || hasPresent;

    return (
        <div className="bg-white p-5 rounded-toss-xl shadow-toss-standard flex flex-col transition-all duration-300">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isOpen ? 'bg-tossBlue text-white' : 'bg-tossGrey400 text-white'}`}>
                        {isOpen ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
                    </div>
                    <div className="flex flex-col">
                        <span className={`font-bold text-[14px] ${isOpen ? 'text-tossBlue' : 'text-tossGrey500'} tracking-tight`}>
                            {isOpen ? '오늘은 센터 오픈 날이에요!' : '오늘은 센터 쉬는 날이에요!'}
                        </span>
                        <div className="flex items-center gap-1.5 text-tossGrey900 font-bold text-[14px] mt-0.5">
                            {isOpen ? (
                                <>
                                    <Clock size={14} className="text-tossBlue shrink-0" />
                                    <span>{openTime} ~ {closeTime}</span>
                                </>
                            ) : (
                                <span className="text-tossGrey400 text-xs font-semibold">오늘은 휴관일입니다</span>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    {isOpen ? (
                        <span className="px-3 py-1 bg-white border border-tossBlue text-tossBlue rounded-full text-[11px] font-bold select-none">
                            OPEN
                        </span>
                    ) : (
                        <span className="px-3 py-1 bg-white border border-tossGrey300 text-tossGrey400 rounded-full text-[11px] font-bold select-none">
                            CLOSED
                        </span>
                    )}
                </div>
            </div>

            {/* Present/Duty Staff Section */}
            {hasAnyone && (
                <div className="w-full flex flex-col gap-3 mt-6 pt-5 border-t border-tossGrey100 animate-fade-in">
                    <span className="text-[10px] font-bold text-tossGrey500 tracking-wider uppercase">지금 센터에서 만나요!</span>
                    <div className="flex items-center gap-3 pl-0.5">
                        {/* Duty Staff — always first */}
                        {hasDuty && (
                            <div className="flex flex-col items-center justify-center text-center gap-1.5 min-w-[40px] animate-scale-in">
                                <div className="relative shrink-0 shadow-toss-subtle rounded-full ring-2 ring-tossBlue/30">
                                    <UserAvatar user={dutyMember} size="w-9 h-9" />
                                    <span className="absolute -top-1 -right-1 bg-tossBlue text-[8px] text-white px-1 py-0.5 rounded-full font-bold leading-none scale-90 border border-white whitespace-nowrap select-none">
                                        당직
                                     </span>
                                </div>
                                <span className="text-[10.5px] font-bold leading-tight text-tossBlue">
                                    {dutyMember.name}
                                </span>
                            </div>
                        )}

                        {/* Vertical Gray Divider */}
                        {hasDuty && hasPresent && (
                            <div className="w-px h-10 bg-tossGrey200 shrink-0" />
                        )}

                        {/* Present Staff */}
                        {hasPresent && (
                            <div className="flex flex-wrap gap-2 items-center">
                                {presentStaff.map(member => (
                                    <div key={member.id} className="flex flex-col items-center justify-center text-center gap-1.5 min-w-[40px] animate-scale-in">
                                        <div className="relative shrink-0 shadow-toss-subtle rounded-full ring-1 ring-tossGrey200/50">
                                            <UserAvatar user={member} size="w-8 h-8" />
                                        </div>
                                        <span className="text-[10.5px] font-bold leading-tight text-tossGrey600">
                                            {member.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodayOperatingWidget;

