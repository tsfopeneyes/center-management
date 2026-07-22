import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, School, ArrowRight, CheckCircle2, ChevronRight, X, LogOut, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../supabaseClient';
import { normalizeSchoolName } from '../utils/userUtils';
import SignUpForm from '../components/auth/SignUpForm';

const VISIT_REASON_OPTIONS = [
    { id: '1', emoji: '👥', label: '친구 / 지인 추천' },
    { id: '2', emoji: '🏫', label: '학교 / 선생님 추천' },
    { id: '3', emoji: '📱', label: 'SNS / 포스터 / 홍보물' },
    { id: '4', emoji: '🚶', label: '지나가다가 궁금해서' }
];

const GuestMobileWelcome = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('HOME'); // 'HOME' | 'FORM' | 'SUCCESS' | 'ACTIVE_CHECKIN' | 'CHECKOUT_SUCCESS'
    const [name, setName] = useState('');
    const [school, setSchool] = useState('');
    const [selectedReasons, setSelectedReasons] = useState(['친구 / 지인 추천']);
    const [customReason, setCustomReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [activeSession, setActiveSession] = useState(null);

    const toggleReason = (label) => {
        setSelectedReasons(prev =>
            prev.includes(label)
                ? prev.filter(r => r !== label)
                : [...prev, label]
        );
    };

    // Check for active guest checkin session on mount
    useEffect(() => {
        const saved = localStorage.getItem('guest_active_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const todayKst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                if (parsed.date === todayKst && parsed.userId) {
                    setActiveSession(parsed);
                    setStep('ACTIVE_CHECKIN');
                } else {
                    localStorage.removeItem('guest_active_session');
                }
            } catch (e) {
                console.error('Failed to parse guest active session', e);
            }
        }
    }, []);

    // Trigger confetti on success
    useEffect(() => {
        if (step === 'SUCCESS') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }, [step]);

    const handleGuestCheckinSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !school.trim()) {
            alert('이름과 학교명을 모두 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const cleanName = name.trim();
            const cleanSchool = normalizeSchoolName(school.trim());
            const reasonBase = selectedReasons.length > 0 ? selectedReasons.join(', ') : '기타';
            const finalVisitReason = customReason.trim()
                ? `${reasonBase} (${customReason.trim()})`
                : reasonBase;

            // 1. Fetch Location Info (Default to Haifn or first location)
            const { data: locations } = await supabase.from('locations').select('*');
            const haifnLoc = (locations || []).find(l => l.name.includes('하이픈')) || locations?.[0] || { id: null, name: '하이픈' };

            // 2. Find or create guest user in users table with unique phone number
            let guestUserId = null;
            try {
                const targetName = cleanName.includes('(guest)') ? cleanName : `${cleanName}(guest)`;
                const { data: existingGuest } = await supabase
                    .from('users')
                    .select('id')
                    .or(`name.eq.${cleanName},name.eq.${targetName}`)
                    .eq('school', cleanSchool)
                    .eq('user_group', '게스트')
                    .maybeSingle();

                if (existingGuest?.id) {
                    guestUserId = existingGuest.id;
                } else {
                    let uniquePhone = '';
                    let back4 = '';
                    let isUnique = false;
                    let retries = 0;
                    while (!isUnique && retries < 20) {
                        const candidate4 = Math.floor(1000 + Math.random() * 9000).toString();
                        const testPhone = `010-0000-${candidate4}`;
                        const { data: existing } = await supabase
                            .from('users')
                            .select('id')
                            .eq('phone', testPhone)
                            .maybeSingle();
                        if (!existing) {
                            uniquePhone = testPhone;
                            back4 = candidate4;
                            isUnique = true;
                        }
                        retries++;
                    }
                    if (!uniquePhone) {
                        back4 = Date.now().toString().slice(-4);
                        uniquePhone = `010-0000-${back4}`;
                    }

                    const { data: newGuest, error: createErr } = await supabase.from('users').insert([{
                        name: `${cleanName}(guest)`,
                        school: cleanSchool,
                        user_group: '게스트',
                        role: 'student',
                        status: 'approved',
                        password: '0000',
                        gender: 'M',
                        birth: '000000',
                        phone: uniquePhone,
                        phone_back4: back4,
                        memo: `[모바일 게스트 체크인: ${new Date().toLocaleDateString()}]`
                    }]).select('id').single();

                    if (createErr) {
                        console.error('Failed to insert new guest user:', createErr);
                    } else if (newGuest?.id) {
                        guestUserId = newGuest.id;
                    }
                }
            } catch (gErr) {
                console.error('Failed to create/lookup guest user:', gErr);
            }

            // 3. Insert CHECKIN log into logs table
            const { error: logErr } = await supabase.from('logs').insert([{
                user_id: guestUserId,
                location_id: haifnLoc.id,
                type: 'CHECKIN'
            }]);

            if (logErr) throw logErr;

            // 4. Save visit reason to visit_notes and checkin_surveys table
            const todayKst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            if (guestUserId) {
                try {
                    await supabase.from('visit_notes').upsert({
                        user_id: guestUserId,
                        visit_date: todayKst,
                        purpose: finalVisitReason,
                        remarks: '게스트 체크인'
                    }, { onConflict: 'user_id,visit_date' });

                    if (finalVisitReason) {
                        await supabase.from('checkin_surveys').insert([{
                            user_id: guestUserId,
                            selections: [finalVisitReason],
                            created_at: new Date().toISOString()
                        }]);
                    }
                } catch (vErr) {
                    console.error('Failed to save guest visit note/survey:', vErr);
                }
            }

            // Save active session locally
            const sessionData = {
                userId: guestUserId,
                name: cleanName,
                school: cleanSchool,
                checkInTime: new Date().toISOString(),
                locationId: haifnLoc.id,
                locationName: haifnLoc.name,
                date: todayKst
            };
            localStorage.setItem('guest_active_session', JSON.stringify(sessionData));
            setActiveSession(sessionData);

            // 5. Trigger Realtime LINE / Discord Notification
            const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const reasonListText = selectedReasons.length > 0
                ? selectedReasons.map(r => `▪ ${r}`).join('\n')
                : '▪ 기타';
            const customDetailText = customReason.trim()
                ? `\n📋 상세 내용\n▪ ${customReason.trim()}`
                : '';

            const alertMessage = `[GUEST CHECK-IN]\n💌 ${cleanName}(${cleanSchool})님이 게스트로 ${haifnLoc.name}에 방문했어요 (${timeStr})\n🧭 방문 경로\n${reasonListText}${customDetailText}`;

            try {
                const { data: settings } = await supabase.from('global_settings').select('*');
                let lineToken = '', lineGroupId = '', gsWebhookUrl = '', discordWebhookUrl = '';

                if (settings) {
                    settings.forEach(s => {
                        if (s.key === 'line_channel_access_token') lineToken = s.value;
                        if (s.key === 'line_group_id') lineGroupId = s.value;
                        if (s.key === 'gs_webhook_url') gsWebhookUrl = s.value;
                        if (s.key === 'discord_webhook_url') discordWebhookUrl = s.value;
                    });
                }

                // LINE via Google Apps Script Webhook
                if (lineToken && lineGroupId && gsWebhookUrl) {
                    fetch(gsWebhookUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({
                            action: 'LINE_NOTIFY',
                            token: lineToken,
                            to: lineGroupId,
                            message: alertMessage
                        })
                    }).catch(e => console.error('LINE Notify error:', e));
                }

                // Discord Webhook
                if (discordWebhookUrl) {
                    fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: alertMessage })
                    }).catch(e => console.error('Discord Notify error:', e));
                }
            } catch (notifyErr) {
                console.error('Notification dispatch error:', notifyErr);
            }

            setStep('SUCCESS');
        } catch (err) {
            console.error('Mobile Guest Checkin Error:', err);
            alert('체크인 처리 중 오류가 발생했습니다: ' + (err.message || '다시 시도해주세요.'));
        } finally {
            setLoading(false);
        }
    };

    const handleGuestCheckoutSubmit = async () => {
        if (!activeSession) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('logs').insert([{
                user_id: activeSession.userId,
                location_id: activeSession.locationId,
                type: 'CHECKOUT'
            }]);

            if (error) throw error;

            // LINE / Discord Checkout Alert
            const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const alertMessage = `[GUEST CHECK-OUT]\n👋 ${activeSession.name}(${activeSession.school}) 게스트님이 ${activeSession.locationName} 공간에서 퇴실하셨어요 (${timeStr})`;

            try {
                const { data: settings } = await supabase.from('global_settings').select('*');
                let lineToken = '', lineGroupId = '', gsWebhookUrl = '', discordWebhookUrl = '';

                if (settings) {
                    settings.forEach(s => {
                        if (s.key === 'line_channel_access_token') lineToken = s.value;
                        if (s.key === 'line_group_id') lineGroupId = s.value;
                        if (s.key === 'gs_webhook_url') gsWebhookUrl = s.value;
                        if (s.key === 'discord_webhook_url') discordWebhookUrl = s.value;
                    });
                }

                if (lineToken && lineGroupId && gsWebhookUrl) {
                    fetch(gsWebhookUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({
                            action: 'LINE_NOTIFY',
                            token: lineToken,
                            to: lineGroupId,
                            message: alertMessage
                        })
                    }).catch(e => console.error('LINE Notify error:', e));
                }

                if (discordWebhookUrl) {
                    fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: alertMessage })
                    }).catch(e => console.error('Discord Notify error:', e));
                }
            } catch (notifyErr) {
                console.error('Notification dispatch error:', notifyErr);
            }

            localStorage.removeItem('guest_active_session');
            setActiveSession(null);
            setStep('CHECKOUT_SUCCESS');
        } catch (err) {
            console.error('Mobile Guest Checkout Error:', err);
            alert('퇴실 처리 중 오류가 발생했습니다: ' + (err.message || '다시 시도해주세요.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-[#F8F9FA] text-[#191F28] flex flex-col justify-between relative overflow-hidden select-none font-sans bg-[radial-gradient(rgba(148,163,184,0.12)_1.5px,transparent_0)] bg-[size:32px_32px]">
            {/* Subtle Background Glow Accents */}
            <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
                <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-32 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-gradient-to-b from-[#E63946]/10 to-orange-500/5 rounded-full blur-[100px]" />
                <motion.div animate={{ scale: [1.1, 1, 1.1], x: [0, -30, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[90px]" />
            </div>

            {/* Repeated Background Branding Typography Pattern (Kiosk Watermark Style) */}
            <div className="absolute inset-0 overflow-hidden opacity-[0.035] z-0 select-none pointer-events-none flex flex-col justify-around rotate-[-12deg] scale-150 origin-center">
                {Array.from({ length: 8 }).map((_, rIdx) => (
                    <div 
                        key={rIdx} 
                        className={`text-[8vw] font-black uppercase tracking-[0.2em] whitespace-nowrap leading-none flex gap-12 ${rIdx % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                        style={{ WebkitTextStroke: '2px #191F28' }}
                    >
                        {Array.from({ length: 6 }).map((_, cIdx) => (
                            <span key={cIdx}>HAIFN</span>
                        ))}
                    </div>
                ))}
            </div>

            {/* Header Brand */}
            <header className="px-6 pt-3 pb-0 relative z-10 flex items-center justify-between max-w-md mx-auto w-full shrink-0">
                <span className="font-black tracking-tight text-xl text-[#191F28]">
                    HAIFN
                </span>
            </header>

            {/* Main Content Areas */}
            <main className="flex-1 px-6 py-0 flex flex-col justify-center relative z-10 max-w-md mx-auto w-full overflow-hidden">
                <AnimatePresence mode="wait">
                    {step === 'HOME' && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-8 my-auto"
                        >
                            {/* Welcome Typography Header */}
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E63946]/10 text-[#E63946] text-[12px] font-bold">
                                    <Sparkles size={13} className="animate-pulse" />
                                    <span>Welcome to HAIFN</span>
                                </div>

                                <h1 className="text-[30px] sm:text-[34px] font-black text-[#191F28] leading-[1.25] tracking-tight">
                                    하이픈에 오신 걸<br />
                                    <span className="text-[#E63946]">
                                        환영합니다!
                                    </span>
                                </h1>

                                {/* Mission Text */}
                                <p className="text-[#4E5968] text-[14px] leading-[1.6] font-medium">
                                    SCI 센터는 일상 속 그리스도인을 꿈꾸는 모든 청소년을 위한 공간으로, 하나님과 이웃, 그리고 세상과의 연결을 지향합니다.
                                </p>

                                <p className="text-[#191F28] text-[15px] font-bold tracking-tight pt-1">
                                    가볍게 둘러보고 싶다면 <span className="text-[#E63946] font-extrabold">게스트 체크인</span>을 진행해 주세요!
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3 pt-2">
                                <button
                                    onClick={() => setStep('FORM')}
                                    className="w-full h-14 px-6 bg-[#E63946] hover:bg-[#D62839] text-white font-bold rounded-2xl border-0 outline-none shadow-[0_8px_20px_-4px_rgba(230,57,70,0.35)] active:scale-[0.98] transition-all flex items-center justify-between group text-[16px] tracking-tight"
                                >
                                    <span>게스트 체크인</span>
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                                        <ArrowRight size={18} className="text-white" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => setShowSignupModal(true)}
                                    className="w-full h-14 px-6 bg-[#EAECEF] hover:bg-[#DFE2E6] text-[#191F28] font-bold rounded-2xl border-0 outline-none active:scale-[0.98] transition-all flex items-center justify-between group text-[16px] tracking-tight"
                                >
                                    <span>하이픈 등록</span>
                                    <ChevronRight size={20} className="text-[#8B95A1] group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ACTIVE CHECKIN VIEW (Re-visiting page while currently checked in) */}
                    {step === 'ACTIVE_CHECKIN' && activeSession && (
                        <motion.div
                            key="active_checkin"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white border border-[#E5E8EB] rounded-3xl p-6 shadow-xl space-y-6 my-auto text-center"
                        >
                            <div className="w-16 h-16 bg-[#E63946]/10 border border-[#E63946]/20 rounded-full flex items-center justify-center mx-auto text-[#E63946]">
                                <Sparkles size={32} />
                            </div>

                            <div className="space-y-2">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">
                                    <Clock size={13} />
                                    <span>현재 이용 중 ({new Date(activeSession.checkInTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 입실)</span>
                                </span>
                                <h2 className="text-2xl font-extrabold text-[#191F28]">
                                    <span className="text-[#E63946]">{activeSession.name}</span>님, 반갑습니다!
                                </h2>
                                <p className="text-[#4E5968] text-sm leading-relaxed font-medium">
                                    현재 <strong className="text-[#191F28] font-bold">{activeSession.locationName}</strong>을 이용하고 계십니다.<br />
                                    공간 이용을 모두 마치셨다면 퇴실하기 버튼을 눌러주세요.
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <button
                                    onClick={handleGuestCheckoutSubmit}
                                    disabled={loading}
                                    className="w-full h-14 bg-[#E63946] hover:bg-[#D62839] text-white font-bold rounded-2xl transition shadow-md shadow-[#E63946]/25 active:scale-[0.98] disabled:opacity-50 text-[16px] tracking-tight flex items-center justify-between px-6"
                                >
                                    <span>{loading ? '퇴실 처리 중...' : '퇴실하기 (Check-Out)'}</span>
                                    <LogOut size={20} />
                                </button>

                                <button
                                    onClick={() => setShowSignupModal(true)}
                                    className="w-full h-14 bg-[#EAECEF] hover:bg-[#DFE2E6] text-[#191F28] font-bold rounded-2xl border-0 outline-none active:scale-[0.98] transition-all flex items-center justify-between px-6 group text-[16px] tracking-tight"
                                >
                                    <span>하이픈 등록</span>
                                    <ChevronRight size={20} className="text-[#8B95A1] group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'FORM' && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white border border-[#E5E8EB] rounded-3xl p-5 shadow-xl space-y-4 my-auto"
                        >
                            <div className="flex justify-between items-center border-b border-[#F2F4F6] pb-3">
                                <div>
                                    <h2 className="text-lg font-extrabold text-[#191F28]">
                                        게스트 체크인
                                    </h2>
                                    <p className="text-[12px] text-[#8B95A1] mt-0.5 font-medium">방문 정보를 간단히 입력해 주세요</p>
                                </div>
                                <button onClick={() => setStep('HOME')} className="p-2 text-[#8B95A1] hover:text-[#191F28] rounded-full bg-[#F2F4F6]">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleGuestCheckinSubmit} className="space-y-3.5">
                                <div>
                                    <label className="block text-[12px] font-bold text-[#4E5968] mb-1 ml-1">이름</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B95A1]" size={16} />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="이름 입력 (예: 김연결)"
                                            className="w-full pl-9 pr-3 py-2.5 bg-[#F9FAFB] border border-[#E5E8EB] rounded-xl text-[#191F28] placeholder-[#B0B8C1] outline-none focus:bg-white focus:border-[#E63946] font-bold text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[12px] font-bold text-[#4E5968] mb-1 ml-1">학교</label>
                                    <div className="relative">
                                        <School className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B95A1]" size={16} />
                                        <input
                                            type="text"
                                            required
                                            value={school}
                                            onChange={(e) => setSchool(e.target.value)}
                                            placeholder="학교 이름 (예: 하이픈고등학교)"
                                            className="w-full pl-9 pr-3 py-2.5 bg-[#F9FAFB] border border-[#E5E8EB] rounded-xl text-[#191F28] placeholder-[#B0B8C1] outline-none focus:bg-white focus:border-[#E63946] font-bold text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[12px] font-bold text-[#4E5968] mb-1 ml-1">
                                        하이픈에는 어떻게 방문하게 됐나요?
                                        <span className="block text-[11px] font-normal text-[#8B95A1] mt-0.5">
                                            (추천인, 방문하게 된 계기 등)
                                        </span>
                                    </label>
                                    <div className="space-y-2 mt-1.5">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {VISIT_REASON_OPTIONS.map(opt => {
                                                const isSelected = selectedReasons.includes(opt.label);
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => toggleReason(opt.label)}
                                                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${isSelected ? 'bg-[#E63946]/10 border-[#E63946] text-[#E63946] font-bold' : 'bg-[#F9FAFB] border-[#E5E8EB] text-[#4E5968] hover:bg-white'}`}
                                                    >
                                                        <span className="text-base shrink-0">{opt.emoji}</span>
                                                        <span className="text-[11.5px] leading-snug font-medium line-clamp-1">{opt.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <input
                                            type="text"
                                            value={customReason}
                                            onChange={(e) => setCustomReason(e.target.value)}
                                            placeholder="상세 내용을 직접 적어주세요 (예: 2학년 김00 추천)"
                                            className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#E5E8EB] rounded-xl text-[#191F28] placeholder-[#B0B8C1] outline-none focus:bg-white focus:border-[#E63946] font-bold text-xs"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-14 bg-[#E63946] hover:bg-[#D62839] text-white font-bold rounded-2xl transition shadow-md shadow-[#E63946]/25 active:scale-[0.98] disabled:opacity-50 mt-3 text-[16px] tracking-tight flex items-center justify-center"
                                >
                                    {loading ? '체크인 처리 중...' : '체크인 완료'}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {step === 'SUCCESS' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white border border-[#E5E8EB] rounded-3xl p-8 shadow-xl text-center space-y-6 my-auto"
                        >
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                                <CheckCircle2 size={36} />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-extrabold text-[#191F28]">체크인 완료!</h2>
                                <p className="text-[#4E5968] text-sm leading-relaxed font-medium">
                                    <strong className="text-[#E63946] font-bold">{name}</strong>님, 환영합니다!<br />
                                    하이픈에서 즐거운 연결을 누려보세요
                                </p>
                            </div>

                            <div className="p-4 bg-[#F9FAFB] border border-[#E5E8EB] rounded-2xl text-xs text-[#4E5968] space-y-1 text-left">
                                <div className="font-bold text-[#191F28]">📌 이용 안내</div>
                                <div>• 보드게임과 간식, 다양한 프로그램이 준비되어 있어요</div>
                                <div>• 궁금한 점은 언제든 스처쌤에게 편하게 말해주세요!</div>
                            </div>

                            <button
                                onClick={() => setStep('ACTIVE_CHECKIN')}
                                className="w-full py-3.5 bg-[#EAECEF] hover:bg-[#DFE2E6] text-[#191F28] font-bold rounded-xl transition text-sm"
                            >
                                확인
                            </button>
                        </motion.div>
                    )}

                    {step === 'CHECKOUT_SUCCESS' && (
                        <motion.div
                            key="checkout_success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white border border-[#E5E8EB] rounded-3xl p-8 shadow-xl text-center space-y-6 my-auto"
                        >
                            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                <CheckCircle2 size={36} />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-extrabold text-[#191F28]">퇴실 완료!</h2>
                                <p className="text-[#4E5968] text-sm leading-relaxed font-medium">
                                    하이픈에서의 경험은 어떠했나요?<br />
                                    우리가 다시 연결될 날을 기대합니다
                                </p>
                            </div>

                            <button
                                onClick={() => setStep('HOME')}
                                className="w-full py-3.5 bg-[#EAECEF] hover:bg-[#DFE2E6] text-[#191F28] font-bold rounded-xl transition text-sm"
                            >
                                처음 화면으로
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* In-Page Direct Signup Modal Overlay */}
            {showSignupModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#E5E8EB] space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-[#F2F4F6] pb-3">
                            <div>
                                <h2 className="text-lg font-extrabold text-[#191F28]">
                                    하이픈 정식 등록
                                </h2>
                                <p className="text-[12px] text-[#8B95A1] mt-0.5 font-medium">회원가입 정보를 입력해 주세요</p>
                            </div>
                            <button onClick={() => setShowSignupModal(false)} className="p-2 text-[#8B95A1] hover:text-[#191F28] rounded-full bg-[#F2F4F6]">
                                <X size={18} />
                            </button>
                        </div>

                        <SignUpForm
                            prefilledData={{
                                name: activeSession?.name || name || '',
                                school: activeSession?.school || school || ''
                            }}
                            guestUserId={activeSession?.userId}
                            onSuccess={() => {
                                setShowSignupModal(false);
                                alert('회원가입이 성공적으로 완료되었습니다!');
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="py-4 text-center text-xs text-[#8B95A1] relative z-10 font-medium shrink-0">
                © SCI CENTER • HAIFN Youth Space
            </footer>
        </div>
    );
};

export default GuestMobileWelcome;
