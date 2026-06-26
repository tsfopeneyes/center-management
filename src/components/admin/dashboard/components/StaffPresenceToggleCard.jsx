import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../../../supabaseClient';
import UserAvatar from '../../../common/UserAvatar';
import { Loader2, Settings, X } from 'lucide-react';
import StaffPresenceSettings from '../../settings/components/StaffPresenceSettings';

const StaffPresenceToggleCard = ({ users }) => {
    const [staffConfig, setStaffConfig] = useState({ "하이픈": [], "이높플레이스": [] });
    const [presenceStatus, setPresenceStatus] = useState({});
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    
    // Settings modal state
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const fetchConfigAndStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('notices')
                .select('title, content')
                .eq('category', 'SYSTEM')
                .in('title', ['STAFF_PRESENCE_CONFIG', 'STAFF_PRESENCE_STATUS']);

            if (!error && data) {
                const configNotice = data.find(n => n.title === 'STAFF_PRESENCE_CONFIG');
                const statusNotice = data.find(n => n.title === 'STAFF_PRESENCE_STATUS');

                if (configNotice?.content) {
                    try {
                        const parsed = JSON.parse(configNotice.content);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            setStaffConfig(parsed);
                        } else if (Array.isArray(parsed)) {
                            setStaffConfig({
                                "하이픈": parsed,
                                "이높플레이스": parsed
                            });
                        }
                    } catch (e) { console.error('Failed to parse staff config', e); }
                }

                if (statusNotice?.content) {
                    try {
                        const parsedStatus = JSON.parse(statusNotice.content);
                        setPresenceStatus(parsedStatus || {});
                    } catch (e) { console.error('Failed to parse staff status config', e); }
                }
            }
        } catch (err) {
            console.error('Error fetching staff presence config', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigAndStatus();

        // Subscribe to changes in notices table for configs
        const subscription = supabase
            .channel('realtime-staff-presence')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notices', filter: 'category=eq.SYSTEM' },
                (payload) => {
                    const { title, content } = payload.new || {};
                    if (title === 'STAFF_PRESENCE_CONFIG') {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                setStaffConfig(parsed);
                            } else if (Array.isArray(parsed)) {
                                setStaffConfig({
                                    "하이픈": parsed,
                                    "이높플레이스": parsed
                                });
                            }
                        } catch (e) { console.error(e); }
                    } else if (title === 'STAFF_PRESENCE_STATUS') {
                        try {
                            const parsedStatus = JSON.parse(content);
                            setPresenceStatus(parsedStatus || {});
                        } catch (e) { console.error(e); }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const handleTogglePresence = async (userId) => {
        setUpdatingId(userId);
        const currentPresent = !!presenceStatus[userId];
        const nextStatus = {
            ...presenceStatus,
            [userId]: !currentPresent
        };

        try {
            // Find existing record
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', 'SYSTEM')
                .eq('title', 'STAFF_PRESENCE_STATUS')
                .maybeSingle();

            const payload = {
                title: 'STAFF_PRESENCE_STATUS',
                content: JSON.stringify(nextStatus),
                category: 'SYSTEM',
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            setPresenceStatus(nextStatus);
        } catch (err) {
            console.error('Failed to update staff status', err);
            alert('상태 업데이트 실패');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleSaveSettingsConfig = async (newConfig) => {
        setIsSavingSettings(true);
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', 'SYSTEM')
                .eq('title', 'STAFF_PRESENCE_CONFIG')
                .maybeSingle();

            const payload = {
                title: 'STAFF_PRESENCE_CONFIG',
                content: JSON.stringify(newConfig),
                category: 'SYSTEM',
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            setStaffConfig(newConfig);
            alert('스탭 설정이 저장되었습니다.');
            setShowSettingsModal(false);
        } catch (err) {
            console.error('Failed to save staff config', err);
            alert('설정 저장 실패');
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Filter candidate details from the full users prop
    const allStaffIds = Array.from(new Set([
        ...(staffConfig["하이픈"] || []),
        ...(staffConfig["이높플레이스"] || [])
    ]));

    const staffMembers = allStaffIds
        .map(id => users.find(u => u.id === id))
        .filter(Boolean);

    const hyphenStaff = staffMembers.filter(member => staffConfig["하이픈"]?.includes(member.id));
    const inopeStaff = staffMembers.filter(member => staffConfig["이높플레이스"]?.includes(member.id));

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-blue-500 mr-2" size={20} />
                <span className="text-sm font-semibold text-slate-500">스탭 현황 로드 중...</span>
            </div>
        );
    }

    const renderStaffCard = (member) => {
        const isPresent = !!presenceStatus[member.id];
        const isUpdating = updatingId === member.id;

        return (
            <button
                type="button"
                key={member.id}
                disabled={isUpdating}
                onClick={() => handleTogglePresence(member.id)}
                className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 text-left w-full focus:outline-none ${
                    isPresent
                        ? 'bg-emerald-50/20 border-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.01)]'
                        : 'bg-slate-50/30 border-slate-200/60 hover:bg-slate-50'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar user={member} size="w-9 h-9" />
                    <div className="min-w-0 flex flex-col items-start">
                        <span className="text-xs font-bold text-slate-800 truncate leading-tight">{member.name}</span>
                        <span className={`text-[10px] font-black mt-0.5 leading-none ${
                            isUpdating ? 'text-slate-400' : (isPresent ? 'text-emerald-600' : 'text-slate-400')
                        }`}>
                            {isUpdating ? '변경 중...' : (isPresent ? '근무 중' : '외출 중')}
                        </span>
                    </div>
                </div>

                {/* iOS/Toss-style Toggle Switch */}
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center shadow-inner shrink-0 ${
                    isUpdating ? 'bg-slate-200' : (isPresent ? 'bg-emerald-500' : 'bg-red-500')
                }`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                        isPresent ? 'translate-x-4' : 'translate-x-0'
                    }`}>
                        {isUpdating && (
                            <Loader2 className="animate-spin text-slate-400" size={8} />
                        )}
                    </div>
                </div>
            </button>
        );
    };

    return (
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded-full shrink-0"></span>
                    <h3 className="text-sm font-bold text-slate-800">
                        실시간 스탭 근무 현황 설정
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 hidden sm:inline-block">클릭하여 상태를 변경하세요</span>
                </div>
                
                <button
                    type="button"
                    onClick={() => setShowSettingsModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-xs font-bold transition-all shadow-sm focus:outline-none shrink-0"
                >
                    <Settings size={14} className="text-slate-500" />
                    스탭 설정
                </button>
            </div>

            <div className="space-y-6">
                {/* Hyphen space staff */}
                {hyphenStaff.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-black text-blue-600 flex items-center gap-1.5 px-1">
                            <span className="w-1.5 h-3.5 bg-blue-500 rounded-full"></span>
                            하이픈 공간 스탭 ({hyphenStaff.length}명)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {hyphenStaff.map(member => renderStaffCard(member))}
                        </div>
                    </div>
                )}

                {/* Inopeplace space staff */}
                {inopeStaff.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-black text-purple-600 flex items-center gap-1.5 px-1">
                            <span className="w-1.5 h-3.5 bg-purple-500 rounded-full"></span>
                            이높플레이스 공간 스탭 ({inopeStaff.length}명)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {inopeStaff.map(member => renderStaffCard(member))}
                        </div>
                    </div>
                )}
            </div>

            {/* Config Settings Modal Popover */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-50 w-full max-w-2xl rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                                <h3 className="font-bold text-slate-800 text-sm">스탭 설정 관리</h3>
                            </div>
                            <button 
                                onClick={() => setShowSettingsModal(false)}
                                className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} className="text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 flex-1">
                            <StaffPresenceSettings
                                users={users}
                                selectedStaffConfig={staffConfig}
                                onSave={handleSaveSettingsConfig}
                                isSaving={isSavingSettings}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

StaffPresenceToggleCard.propTypes = {
    users: PropTypes.array.isRequired
};

export default StaffPresenceToggleCard;
