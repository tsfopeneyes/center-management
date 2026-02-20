import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
    Delete, Scan, X, CheckCircle, AlertCircle,
    Calendar, Clock, LogIn, LogOut, ChevronRight,
    MapPin, Camera, SwitchCamera, Settings, UserPlus, Smartphone, User,
    School
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
// import { BADGE_DEFINITIONS } from '../constants/appConstants';
import SignUpForm from '../components/auth/SignUpForm';

const Kiosk = () => {
    const navigate = useNavigate();
    // Logic States
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [matchingUsers, setMatchingUsers] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // UI States
    const [pincode, setPincode] = useState('');
    const [status, setStatus] = useState('IDLE'); // IDLE, SCANNING, SELECTING, LOADING
    const [result, setResult] = useState(null); // { type, message, subMessage, color }
    const [showMasterPin, setShowMasterPin] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [masterPinInput, setMasterPinInput] = useState('');
    const [afterPinAction, setAfterPinAction] = useState(null); // 'SETTINGS' or 'EXIT'
    const [showSignupForm, setShowSignupForm] = useState(false);

    // Scanner Settings
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
    const [lastScan, setLastScan] = useState({ code: '', time: 0 });
    const [challenges, setChallenges] = useState([]);

    // 1. Initial Data Fetch
    useEffect(() => {
        const fetchLocs = async () => {
            const { data } = await supabase.from('locations').select('*').order('name');
            if (data) setLocations(data);
        };
        fetchLocs();

        const savedLoc = localStorage.getItem('kiosk_location');
        if (savedLoc) {
            try {
                setSelectedLocation(JSON.parse(savedLoc));
            } catch (e) {
                console.error("Failed to parse saved location", e);
            }
        }

        const fetchChallenges = async () => {
            const { data } = await supabase.from('challenges').select('*');
            if (data) setChallenges(data);
        };
        fetchChallenges();

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSetLocation = (loc) => {
        setSelectedLocation(loc);
        localStorage.setItem('kiosk_location', JSON.stringify(loc));
    };

    const resetLocation = () => {
        const master = localStorage.getItem('kiosk_master_pin') || '1801';
        setAfterPinAction('SETTINGS');
        setShowMasterPin(true);
    };

    const handleMasterPinSubmit = (pin) => {
        const master = localStorage.getItem('kiosk_master_pin') || '1801';
        if (pin === master) {
            if (afterPinAction === 'SETTINGS') {
                setShowOptionsMenu(true);
            } else if (afterPinAction === 'EXIT') {
                navigate('/');
            }
            setShowMasterPin(false);
            setMasterPinInput('');
        } else {
            alert('핀 번호가 일치하지 않습니다.');
            setMasterPinInput('');
        }
    };

    const handleResetLocation = () => {
        localStorage.removeItem('kiosk_location');
        setSelectedLocation(null);
        setShowOptionsMenu(false);
        resetState();
    };

    // 2. Core Processing Logic (In/Move/Out)
    const processKioskAction = async (user) => {
        if (!selectedLocation) return;
        const currentBackgroundStatus = status;
        setStatus('LOADING');

        try {
            // A. Determine next log type (In/Move/Out)
            const { data: lastLogs } = await supabase
                .from('logs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            let nextType = 'CHECKIN';
            if (lastLogs && lastLogs.length > 0) {
                const lastLog = lastLogs[0];
                if (lastLog.type === 'CHECKOUT') {
                    nextType = 'CHECKIN';
                } else {
                    if (lastLog.location_id === selectedLocation.id) {
                        nextType = 'CHECKOUT';
                    } else {
                        nextType = 'MOVE';
                    }
                }
            }

            // B. Stats Calculation (only on CHECKIN)
            let streakCount = 0;
            let isFirstToday = false;
            let activeProgram = null;
            let activeBadge = null;
            let totalVisitCount = 0;

            if (nextType === 'CHECKIN') {
                // 1. Streak Calculation (Consecutive days including today)
                const { data: recentLogs } = await supabase
                    .from('logs')
                    .select('created_at')
                    .eq('user_id', user.id)
                    .eq('type', 'CHECKIN')
                    .order('created_at', { ascending: false });

                if (recentLogs && recentLogs.length > 0) {
                    let currentStreak = 1;
                    let lastDate = new Date();
                    lastDate.setHours(0, 0, 0, 0);

                    // Check if they already checked in today (just for calculation stability)
                    const uniqueDates = [...new Set(recentLogs.map(l => new Date(l.created_at).toDateString()))];

                    for (let i = 1; i < uniqueDates.length; i++) {
                        const prevDate = new Date(uniqueDates[i]);
                        const expectedDate = new Date(lastDate);
                        expectedDate.setDate(expectedDate.getDate() - 1);

                        if (prevDate.toDateString() === expectedDate.toDateString()) {
                            currentStreak++;
                            lastDate = prevDate;
                        } else {
                            break;
                        }
                    }
                    streakCount = currentStreak;
                }

                // 2. First-in Recognition (Today, this location)
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const { count: todayLogsCount } = await supabase
                    .from('logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('location_id', selectedLocation.id)
                    .eq('type', 'CHECKIN')
                    .gte('created_at', todayStart.toISOString());

                if (todayLogsCount === 0) isFirstToday = true;

                // 3. Smart Check-in (RSVP Integration)
                const now = new Date();
                const programCheckStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                const programCheckEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

                const { data: todayPrograms } = await supabase
                    .from('notices')
                    .select('id, title, program_date')
                    .gte('program_date', programCheckStart)
                    .lte('program_date', programCheckEnd);

                if (todayPrograms && todayPrograms.length > 0) {
                    const programIds = todayPrograms.map(p => p.id);
                    const { data: myRsvps } = await supabase
                        .from('notice_responses')
                        .select('notice_id')
                        .eq('user_id', user.id)
                        .in('notice_id', programIds)
                        .eq('status', 'JOIN');

                    if (myRsvps && myRsvps.length > 0) {
                        activeProgram = todayPrograms.find(p => p.id === myRsvps[0].notice_id);
                        // Auto-log attendance
                        await supabase
                            .from('notice_responses')
                            .update({ is_attended: true })
                            .eq('notice_id', activeProgram.id)
                            .eq('user_id', user.id);
                    }
                }

                // 4. Milestone Check (Total History)
                const { count: fetchedTotalVisitCount } = await supabase
                    .from('logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('type', 'CHECKIN');

                totalVisitCount = fetchedTotalVisitCount || 0;

                const { count: totalPrgCount } = await supabase
                    .from('notice_responses')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_attended', true);

                const currentVisitCount = totalVisitCount + 1;
                const currentPrgCount = totalPrgCount || 0;

                // Threshold Check: Only trigger if we JUST REACHED the threshold
                const visitBadge = (nextType === 'CHECKIN')
                    ? challenges.find(b => b.type === 'VISIT' && b.threshold === currentVisitCount)
                    : null;

                const prgBadge = (activeProgram)
                    ? challenges.find(b => b.type === 'PROGRAM' && b.threshold === currentPrgCount)
                    : null;

                if (visitBadge || prgBadge) {
                    activeBadge = visitBadge || prgBadge;
                }
            }

            // C. Insert Log
            const { error: insertError } = await supabase.from('logs').insert([{
                user_id: user.id,
                location_id: selectedLocation.id,
                type: nextType
            }]);

            if (insertError) throw insertError;

            // D. Set Feedback Content
            let msg = `${user.name}님 반가워요 👋`;
            let sub = '입실 완료';
            let color = 'bg-green-500';
            let isFirstEver = (totalVisitCount || 0) === 0;

            if (nextType === 'MOVE') {
                msg = `${selectedLocation.name} 장소로 이동🚀`;
                sub = '이동 완료';
                color = 'bg-blue-600';
            } else if (nextType === 'CHECKOUT') {
                msg = '오늘도 즐거웠어요✨';
                sub = '퇴실 완료';
                color = 'bg-orange-500';
            }

            // Enhanced messages for CHECKIN
            if (nextType === 'CHECKIN') {
                if (isFirstEver) {
                    msg = `첫 방문을 환영합니다! 🎊`;
                    sub = `${user.name}님, SCI CENTER에 오신 것을 환영해요!`;
                    color = 'bg-indigo-600';

                    // Trigger confetti for the absolute first visit
                    try {
                        confetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#2563eb', '#4f46e5', '#f59e0b', '#10b981', '#ef4444']
                        });
                    } catch (cErr) {
                        console.error('Confetti error:', cErr);
                    }
                } else if (activeProgram) {
                    sub = `잠시 후 [${activeProgram.title}] 시작! 📅`;
                } else if (streakCount > 1) {
                    sub = `${streakCount}일 연속 출석 중! 🔥`;
                }
            }

            setResult({
                type: 'SUCCESS',
                message: activeBadge ? `축하해요! [${activeBadge.name}] 획득!` : msg,
                subMessage: activeBadge ? '새로운 뱃지를 획득하셨습니다✨' : sub,
                color: activeBadge ? 'bg-yellow-500' : color,
                streak: streakCount > 1 ? streakCount : null,
                isFirst: isFirstEver,
                program: activeProgram,
                badge: activeBadge
            });

            // Always reset to IDLE on success to prevent getting stuck in SELECTING
            setStatus('IDLE');
            setPincode('');
            setMatchingUsers([]);

            // Auto-reset feedback (longer if milestone/badge)
            const delay = (isFirstToday || activeProgram || streakCount > 1 || activeBadge) ? 3000 : 800;
            setTimeout(() => {
                setResult(null);
            }, delay);

        } catch (err) {
            console.error('Kiosk Action Error:', err);
            setResult({
                type: 'ERROR',
                message: '처리 오류',
                subMessage: err.message || '다시 시도해 주세요.',
                color: 'bg-red-500'
            });
            // Reset to IDLE on error too so they can try again
            setStatus('IDLE');
            setPincode('');
            setTimeout(() => setResult(null), 2000);
        }
    };

    // 3. Input Handlers
    const handleVerifyNumeric = useCallback(async (code) => {
        if (code.length !== 4) return;
        const currentBackgroundStatus = status;
        setStatus('LOADING');

        try {
            // Handle Guest Entry (0000)
            if (code === '0000') {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const { count } = await supabase
                    .from('logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('type', 'GUEST_ENTRY')
                    .gte('created_at', todayStart.toISOString());

                const guestNum = (count || 0) + 1;

                const { error: guestError } = await supabase.from('logs').insert([{
                    user_id: null,
                    location_id: selectedLocation.id,
                    type: 'GUEST_ENTRY'
                }]);

                if (guestError) throw guestError;

                setResult({
                    type: 'SUCCESS',
                    message: '반가운 손님! ✨',
                    subMessage: '진심으로 환영하고 축복해🖐️',
                    color: 'bg-indigo-600'
                });

                setStatus(currentBackgroundStatus);
                setPincode('');
                setTimeout(() => setResult(null), 2500);
                return;
            }

            const { data, error } = await supabase
                .from('users')
                .select('id, name, school, phone_back4')
                .eq('phone_back4', code);

            if (error) throw error;

            if (!data || data.length === 0) {
                setResult({
                    type: 'ERROR',
                    message: '등록되지 않은 번호',
                    subMessage: '번호를 다시 확인해 주세요.',
                    color: 'bg-red-500'
                });
                setStatus(currentBackgroundStatus);
                setPincode('');
                setTimeout(() => setResult(null), 1500);
                return;
            }

            if (data.length === 1) {
                await processKioskAction(data[0]);
            } else {
                setMatchingUsers(data);
                setStatus('SELECTING');
            }
        } catch (err) {
            console.error('Verify Numeric Error:', err);
            setResult({
                type: 'ERROR',
                message: '조회 실패',
                subMessage: err.message || '네트워크 상태를 확인해 주세요.',
                color: 'bg-red-500'
            });
            setStatus(currentBackgroundStatus);
            setTimeout(() => setResult(null), 1500);
        }
    }, [selectedLocation, status]);

    const handleNumberClick = (num) => {
        if (result || status === 'LOADING') return; // Disable during active feedback
        if (pincode.length < 4) {
            const nextCode = pincode + num;
            setPincode(nextCode);
            if (nextCode.length === 4) {
                handleVerifyNumeric(nextCode);
            }
        }
    };

    const handleQrScan = (resultScan) => {
        if (result || status === 'LOADING') return;
        if (resultScan && resultScan[0]?.rawValue) {
            const val = resultScan[0].rawValue;
            const now = Date.now();
            if (val === lastScan.code && (now - lastScan.time < 5000)) return;
            setLastScan({ code: val, time: now });
            handleIdentifyUser(val);
        }
    };

    const handleIdentifyUser = async (val) => {
        const currentBackgroundStatus = status;
        setStatus('LOADING');
        try {
            const { data: byId } = await supabase.from('users').select('*').eq('id', val).single();
            if (byId) {
                await processKioskAction(byId);
            } else if (val.length === 4) {
                await handleVerifyNumeric(val);
            } else {
                throw new Error('인식 불가');
            }
        } catch (err) {
            console.error('Identify User Error:', err);
            setResult({
                type: 'ERROR',
                message: '인식 실패',
                subMessage: '올바른 QR 코드가 아닙니다.',
                color: 'bg-red-500'
            });
            setStatus(currentBackgroundStatus);
            setTimeout(() => setResult(null), 1500);
        }
    };

    const resetState = () => {
        setPincode('');
        setStatus('IDLE');
        setMatchingUsers([]);
        setResult(null);
    };

    if (!selectedLocation) {
        return (
            <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6 select-none font-sans">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl p-12 text-center">
                    <MapPin className="mx-auto text-blue-600 mb-6" size={64} />
                    <h1 className="text-3xl font-black text-slate-800 mb-2">키오스크 위치 설정</h1>
                    <p className="text-slate-400 mb-10 font-bold">현재 기기가 배치된 장소를 선택해 주세요.</p>
                    <div className="grid grid-cols-2 gap-4">
                        {locations.map(loc => (
                            <button key={loc.id} onClick={() => handleSetLocation(loc)} className="p-8 bg-slate-50 rounded-3xl text-xl font-black text-slate-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100">
                                {loc.name}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            setAfterPinAction('EXIT');
                            setShowMasterPin(true);
                        }}
                        className="mt-12 text-slate-400 font-black tracking-widest uppercase text-xs hover:text-slate-800 transition"
                    >
                        로그인 화면으로 돌아가기
                    </button>
                </motion.div>

                <KioskModals
                    showMasterPin={showMasterPin}
                    setShowMasterPin={setShowMasterPin}
                    masterPinInput={masterPinInput}
                    setMasterPinInput={setMasterPinInput}
                    handleMasterPinSubmit={handleMasterPinSubmit}
                    showOptionsMenu={showOptionsMenu}
                    setShowOptionsMenu={setShowOptionsMenu}
                    handleResetLocation={handleResetLocation}
                    navigate={navigate}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col font-sans overflow-hidden select-none h-[100dvh]">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
                <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[100px]" />
                <motion.div animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, 50, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-100/40 rounded-full blur-[100px]" />
                <motion.div animate={{ scale: [1.2, 1.3, 1.2], x: [30, 0, 30] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute top-[40%] left-[20%] w-[20%] h-[20%] bg-blue-200/20 rounded-full blur-[80px]" />
                <motion.div animate={{ scale: [1.2, 1, 1.2], rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-pink-100/30 rounded-full blur-[120px]" />
            </div>

            {/* Header */}
            <header className="p-4 sm:p-8 flex justify-between items-center shrink-0 z-10">
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

            <main className="flex-1 relative flex flex-col items-center lg:justify-center p-4 sm:p-6 lg:p-12 z-10 w-full max-w-[1600px] mx-auto overflow-y-auto overflow-x-hidden">
                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10 lg:gap-16 w-full items-center">

                    {/* Right Side (TOP ON MOBILE): Input Pad / Scanner */}
                    <div className="w-full flex justify-center order-first lg:order-last">
                        <AnimatePresence mode="wait">
                            {status === 'IDLE' && (
                                <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full max-w-xl bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-gray-100 p-6 sm:p-10 flex flex-col items-center">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-4 sm:mb-8">휴대폰 뒤 4자리 입력</h2>
                                    <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-10">
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className={`w-12 h-16 sm:w-16 sm:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-5xl font-black transition-all ${pincode[i] ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-200 border-2 border-dashed border-slate-200'}`}>
                                                {pincode[i] || ''}
                                                {!pincode[i] && i === pincode.length && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-8 sm:w-1.5 sm:h-12 bg-blue-300 rounded-full" />}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                            <button key={num} onClick={() => handleNumberClick(num.toString())} className="h-16 sm:h-24 bg-slate-50 rounded-2xl sm:rounded-[2rem] text-2xl sm:text-4xl font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-sm border border-slate-100">{num}</button>
                                        ))}
                                        <button onClick={() => setStatus('SCANNING')} className="h-16 sm:h-24 bg-indigo-50 text-indigo-500 rounded-2xl sm:rounded-[2rem] flex flex-col items-center justify-center gap-1 hover:bg-indigo-100 active:scale-95 transition-all border border-indigo-100">
                                            <Scan size={20} className="sm:w-6 sm:h-6" />
                                            <span className="text-[8px] sm:text-[10px] font-black tracking-widest uppercase">QR SCAN</span>
                                        </button>
                                        <button onClick={() => handleNumberClick('0')} className="h-16 sm:h-24 bg-slate-50 rounded-2xl sm:rounded-[2rem] text-2xl sm:text-4xl font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-sm border border-slate-100">0</button>
                                        <button onClick={() => setPincode(prev => prev.slice(0, -1))} className="h-16 sm:h-24 bg-slate-50 text-slate-300 rounded-2xl sm:rounded-[2rem] flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all border border-slate-100"><Delete size={24} className="sm:w-8 sm:h-8" /></button>
                                    </div>
                                </motion.div>
                            )}

                            {status === 'SCANNING' && (
                                <motion.div key="scanning" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-slate-900 rounded-[2.5rem] sm:rounded-[4rem] overflow-hidden shadow-2xl relative border-4 sm:border-8 border-white">
                                    <div className="aspect-square relative">
                                        <Scanner onScan={handleQrScan} onError={(err) => console.error(err)} constraints={{ facingMode }} styles={{ container: { width: '100%', height: '100%' } }} />
                                        <div className="absolute inset-0 z-10 flex flex-col justify-between p-10">
                                            <div className="flex justify-between items-start">
                                                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20"><p className="text-white text-xs font-black tracking-widest uppercase">Continuous Scan</p></div>
                                                <button onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')} className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/20 hover:bg-white/20 transition"><SwitchCamera size={24} /></button>
                                            </div>
                                            <div className="text-center">
                                                <div className="w-64 h-64 border-2 border-dashed border-white/40 rounded-[3rem] mx-auto relative overflow-hidden">
                                                </div>
                                                <p className="text-white font-black mt-8 text-lg">QR 코드를 가이드박스에 비춰주세요</p>
                                            </div>
                                            <button onClick={resetState} className="w-full py-5 bg-white text-slate-900 rounded-[2rem] font-black shadow-xl active:scale-95 transition">키패드 입력으로 전환</button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {status === 'SELECTING' && (
                                <motion.div key="selecting" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl bg-white rounded-[2rem] sm:rounded-[4rem] shadow-2xl p-6 sm:p-12 flex flex-col items-center">
                                    <h2 className="text-xl sm:text-3xl font-black text-slate-800 mb-2">학교를 선택해 주세요</h2>
                                    <p className="text-xs sm:text-base text-slate-400 font-bold mb-6 sm:mb-10">동일한 번호의 학생이 여러 명 있습니다.</p>
                                    <div className="w-full space-y-3 sm:space-y-4 mb-6 sm:mb-10 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {matchingUsers.map(u => (
                                            <button key={u.id} onClick={() => processKioskAction(u)} className="w-full p-6 sm:p-8 bg-slate-50 rounded-2xl sm:rounded-3xl flex items-center justify-between hover:bg-blue-600 hover:text-white transition-all group active:scale-95 shadow-sm border border-slate-100">
                                                <div>
                                                    <p className="text-xl sm:text-2xl font-black flex items-center gap-2">
                                                        {u.name}
                                                        {u.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                                    </p>
                                                    <p className="text-xs sm:text-sm opacity-60 font-bold">{u.school} | {u.phone_back4}</p>
                                                </div>
                                                <ChevronRight size={24} className="sm:w-8 sm:h-8 opacity-20 group-hover:opacity-100 transition" />
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={resetState} className="p-4 text-slate-400 font-black tracking-widest uppercase text-[10px] sm:text-xs hover:text-slate-800 transition">처음으로 돌아가기</button>
                                </motion.div>
                            )}

                            {status === 'LOADING' && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-20 h-20 border-8 border-slate-200 border-t-blue-600 rounded-full" />
                                    <p className="text-slate-400 font-black tracking-widest uppercase">Processing...</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Left Side (BOTTOM ON MOBILE): Welcome & Install QR */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-6 lg:gap-10 w-full lg:order-first pb-20 lg:pb-0"
                    >
                        <div className="glass-card p-6 sm:p-10 rounded-[3rem] sm:rounded-[4rem] border-white/60 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />

                            <h2 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tighter leading-tight mb-4 text-balance">
                                환영합니다! <br />
                                <span className="text-blue-600">오늘도 빛나요 ✨</span>
                            </h2>
                            <p className="text-slate-400 font-bold text-base sm:text-lg mb-8 leading-relaxed">
                                번호 뒤 4자리를 입력하시거나 <br />
                                발급받은 QR을 스캔해 주세요.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => setShowSignupForm(true)}
                                    className="flex-1 py-5 sm:py-6 bg-slate-900 text-white rounded-3xl font-black text-lg sm:text-xl flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200"
                                >
                                    <UserPlus size={24} />
                                    회원가입
                                </button>
                            </div>
                        </div>

                        {/* App Install Section */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-white/40 backdrop-blur-md p-6 sm:p-8 rounded-[3rem] border border-white/60 shadow-lg mb-20 lg:mb-0">
                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 shrink-0">
                                <QRCodeSVG value="https://centerpass.netlify.app/" size={96} level="H" />
                            </div>
                            <div className="text-center sm:text-left">
                                <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-1 flex items-center justify-center sm:justify-start gap-2">
                                    <Smartphone className="text-blue-500" size={18} />
                                    모바일 앱 설치
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-400 font-bold leading-relaxed mb-3 opacity-80">
                                    QR을 스캔하여 앱을 설치하고 <br className="hidden sm:block" />
                                    더 편리하게 이용해 보세요!
                                </p>
                                <div className="inline-flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100/50">
                                    Scan to start
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Non-blocking Overlay Feedback */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.2, y: -50 }}
                            className={`absolute z-50 p-8 sm:p-16 rounded-[2.5rem] sm:rounded-[4rem] shadow-2xl flex flex-col items-center text-center text-white ${result.color} min-w-[300px] sm:min-w-[400px] max-w-[90vw]`}
                        >
                            <div className="mb-4 sm:mb-6">
                                {result.badge && result.badge.image_url ? (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full p-2 shadow-xl border-4 border-yellow-300 overflow-hidden"
                                    >
                                        <img src={result.badge.image_url} alt="badge" className="w-full h-full object-cover" />
                                    </motion.div>
                                ) : (
                                    result.type === 'SUCCESS' ? <CheckCircle size={64} className="sm:w-24 sm:h-24" strokeWidth={2.5} /> : <AlertCircle size={64} className="sm:w-24 sm:h-24" strokeWidth={2.5} />
                                )}
                            </div>
                            <h2 className="text-2xl sm:text-4xl font-black mb-1 sm:mb-2 tracking-tighter">{result.message}</h2>
                            <p className="text-sm sm:text-xl font-black opacity-80">{result.subMessage}</p>
                            <div className="w-full h-1 sm:h-1.5 bg-white/30 mt-6 sm:mt-10 rounded-full overflow-hidden">
                                <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: result.type === 'SUCCESS' ? 0.5 : 1.5, ease: "linear" }} className="h-full bg-white" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <footer className="p-6 sm:p-10 text-center shrink-0 pb-safe">
            </footer>

            <KioskModals
                showMasterPin={showMasterPin}
                setShowMasterPin={setShowMasterPin}
                masterPinInput={masterPinInput}
                setMasterPinInput={setMasterPinInput}
                handleMasterPinSubmit={handleMasterPinSubmit}
                showOptionsMenu={showOptionsMenu}
                setShowOptionsMenu={setShowOptionsMenu}
                handleResetLocation={handleResetLocation}
                navigate={navigate}
                showSignupForm={showSignupForm}
                setShowSignupForm={setShowSignupForm}
            />

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};

// Sub-component for modals to avoid duplication and fix selective rendering bug
const KioskModals = ({
    showMasterPin,
    setShowMasterPin,
    masterPinInput,
    setMasterPinInput,
    handleMasterPinSubmit,
    showOptionsMenu,
    setShowOptionsMenu,
    handleResetLocation,
    navigate,
    showSignupForm,
    setShowSignupForm
}) => {
    // Shared Signup Component handles data and consent now

    // Unified SignUp logic handles this now

    return (
        <>
            {/* Master Pin Modal */}
            {showMasterPin && (
                <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight text-center">관리자 확인</h3>
                        <p className="text-slate-400 mb-8 text-sm font-bold text-center">마스터 핀 번호를 입력해 주세요.</p>

                        <div className="flex justify-center gap-3 mb-8">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-12 h-16 rounded-2xl flex items-center justify-center text-3xl font-black transition-all ${masterPinInput[i] ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-200 border-2 border-dashed border-slate-100'}`}>
                                    {masterPinInput[i] ? '●' : ''}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button
                                    key={num}
                                    onClick={() => {
                                        if (masterPinInput.length < 4) {
                                            const next = masterPinInput + num;
                                            setMasterPinInput(next);
                                            if (next.length === 4) handleMasterPinSubmit(next);
                                        }
                                    }}
                                    className="h-16 bg-slate-50 rounded-2xl text-2xl font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                                >
                                    {num}
                                </button>
                            ))}
                            <button onClick={() => { setShowMasterPin(false); setMasterPinInput(''); }} className="h-16 bg-red-50 text-red-500 rounded-2xl font-black text-xs hover:bg-red-100 transition-all uppercase tracking-widest">Cancel</button>
                            <button
                                onClick={() => {
                                    if (masterPinInput.length < 4) {
                                        const next = masterPinInput + '0';
                                        setMasterPinInput(next);
                                        if (next.length === 4) handleMasterPinSubmit(next);
                                    }
                                }}
                                className="h-16 bg-slate-50 rounded-2xl text-2xl font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                            >
                                0
                            </button>
                            <button onClick={() => setMasterPinInput(prev => prev.slice(0, -1))} className="h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all"><Delete size={24} /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Options Menu Modal */}
            {showOptionsMenu && (
                <div className="fixed inset-0 bg-slate-900/80 z-[101] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl flex flex-col gap-4">
                        <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tight text-center">키오스크 설정</h3>

                        <button
                            onClick={handleResetLocation}
                            className="w-full py-6 bg-slate-50 text-slate-700 rounded-3xl font-black text-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                        >
                            장소 다시 선택
                        </button>

                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-6 bg-slate-50 text-red-500 rounded-3xl font-black text-lg hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                        >
                            키오스크 종료
                        </button>

                        <button
                            onClick={() => setShowOptionsMenu(false)}
                            className="mt-4 w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-slate-800 transition-all"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {/* Direct Signup Form Modal */}
            {showSignupForm && (
                <div className="fixed inset-0 bg-slate-900/40 z-[120] flex items-center justify-center p-4 sm:p-6 backdrop-blur-lg animate-fade-in overflow-y-auto">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="bg-white/95 w-full max-w-2xl rounded-[3rem] p-8 sm:p-12 shadow-2xl relative my-auto border border-white/50 backdrop-blur-xl"
                    >
                        <button
                            onClick={() => setShowSignupForm(false)}
                            className="absolute top-8 right-8 p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all active:scale-90"
                        >
                            <X size={24} />
                        </button>

                        <div className="mb-10">
                            <h3 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2 tracking-tight">회원가입</h3>
                            <p className="text-slate-400 font-bold">센터 패스 이용을 위한 정보를 입력해 주세요.</p>
                        </div>

                        <SignUpForm
                            isKiosk={true}
                            onSuccess={() => setShowSignupForm(false)}
                            onCancel={() => setShowSignupForm(false)}
                        />
                    </motion.div>
                </div >
            )}

            {/* Consent Modals are now handled inside SignUpForm */}
        </>
    );
};

export default Kiosk;
