import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
    Delete, Scan, X, CheckCircle, AlertCircle,
    Calendar, Clock, LogIn, LogOut, ChevronRight,
    MapPin, Camera, SwitchCamera, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
import { BADGE_DEFINITIONS } from '../constants/appConstants';

const Kiosk = () => {
    // Logic States
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [matchingUsers, setMatchingUsers] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // UI States
    const [pincode, setPincode] = useState('');
    const [status, setStatus] = useState('IDLE'); // IDLE, SCANNING, SELECTING, LOADING
    const [result, setResult] = useState(null); // { type, message, subMessage, color }

    // Scanner Settings
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
    const [lastScan, setLastScan] = useState({ code: '', time: 0 });

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

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSetLocation = (loc) => {
        setSelectedLocation(loc);
        localStorage.setItem('kiosk_location', JSON.stringify(loc));
    };

    const resetLocation = () => {
        localStorage.removeItem('kiosk_location');
        setSelectedLocation(null);
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

            if (nextType === 'CHECKIN') {
                // 1. Streak Calculation (Consecutive days including today)
                // This is a simplified version: count days in the last 30 days and check continuity
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
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: todayPrograms } = await supabase
                    .from('notices')
                    .select('id, title, program_date')
                    .eq('program_date', todayStr);

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
                const { count: totalVisitCount } = await supabase
                    .from('logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('type', 'CHECKIN');

                const { count: totalPrgCount } = await supabase
                    .from('notice_responses')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_attended', true);

                // Check if current counts match any badge definition
                const currentVisitCount = (totalVisitCount || 0) + 1; // Including this one
                const currentPrgCount = totalPrgCount || 0;

                const visitBadge = BADGE_DEFINITIONS.find(b => b.type === 'VISIT' && b.min === currentVisitCount);
                const prgBadge = BADGE_DEFINITIONS.find(b => b.type === 'PROGRAM' && b.min === currentPrgCount);

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
                if (isFirstToday) msg = `오늘의 첫 입실! 🥇 ${user.name}님`;
                if (activeProgram) sub = `잠시 후 [${activeProgram.title}] 시작! 📅`;
                else if (streakCount > 1) sub = `${streakCount}일 연속 출석 중! 🔥`;
            }

            setResult({
                type: 'SUCCESS',
                message: activeBadge ? `축하해요! [${activeBadge.label}] 획득! ${activeBadge.icon}` : msg,
                subMessage: activeBadge ? '새로운 뱃지를 획득하셨습니다✨' : sub,
                color: activeBadge ? 'bg-yellow-500' : color,
                streak: streakCount > 1 ? streakCount : null,
                isFirst: isFirstToday,
                program: activeProgram,
                badge: activeBadge
            });

            setStatus(currentBackgroundStatus === 'LOADING' ? 'IDLE' : currentBackgroundStatus);
            setPincode('');
            setMatchingUsers([]);

            // Auto-reset feedback (longer if milestone/badge)
            const delay = (isFirstToday || activeProgram || streakCount > 1 || activeBadge) ? 3000 : 800;
            setTimeout(() => {
                setResult(null);
            }, delay);

        } catch (err) {
            console.error(err);
            setResult({
                type: 'ERROR',
                message: '처리 오류',
                subMessage: err.message || '다시 시도해 주세요.',
                color: 'bg-red-500'
            });
            setStatus(currentBackgroundStatus === 'LOADING' ? 'IDLE' : currentBackgroundStatus);
            setTimeout(() => setResult(null), 1500);
        }
    };

    // 3. Input Handlers
    const handleVerifyNumeric = useCallback(async (code) => {
        if (code.length !== 4) return;
        const currentBackgroundStatus = status;
        setStatus('LOADING');

        try {
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
                processKioskAction(data[0]);
            } else {
                setMatchingUsers(data);
                setStatus('SELECTING');
            }
        } catch (err) {
            setResult({
                type: 'ERROR',
                message: '조회 실패',
                subMessage: '네트워크 상태를 확인해 주세요.',
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
                processKioskAction(byId);
            } else if (val.length === 4) {
                handleVerifyNumeric(val);
            } else {
                throw new Error('인식 불가');
            }
        } catch (err) {
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
                </motion.div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col font-sans overflow-hidden select-none">
            {/* Header */}
            <header className="p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{selectedLocation.name}</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SCI CENTER DASHBOARD</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-3xl font-black text-slate-800 leading-none">
                            {currentTime.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                            {currentTime.toLocaleDateString('ko-KR', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                    <button onClick={resetLocation} className="p-3 text-slate-300 hover:text-slate-600 transition">
                        <Settings size={20} />
                    </button>
                </div>
            </header>

            <main className="flex-1 relative flex flex-col items-center justify-center p-4">
                <AnimatePresence mode="wait">
                    {status === 'IDLE' && (
                        <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl border border-gray-100 p-10 flex flex-col items-center">
                            <h2 className="text-2xl font-black text-slate-800 mb-8">휴대폰 뒤 4자리 입력</h2>
                            <div className="flex gap-4 mb-10">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className={`w-16 h-24 rounded-3xl flex items-center justify-center text-5xl font-black transition-all ${pincode[i] ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-200 border-2 border-dashed border-slate-200'}`}>
                                        {pincode[i] || ''}
                                        {!pincode[i] && i === pincode.length && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-12 bg-blue-300 rounded-full" />}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-5 w-full">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button key={num} onClick={() => handleNumberClick(num.toString())} className="h-24 bg-slate-50 rounded-[2rem] text-4xl font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-sm border border-slate-100">{num}</button>
                                ))}
                                <button onClick={() => setStatus('SCANNING')} className="h-24 bg-indigo-50 text-indigo-500 rounded-[2rem] flex flex-col items-center justify-center gap-1 hover:bg-indigo-100 active:scale-95 transition-all border border-indigo-100">
                                    <Scan size={24} />
                                    <span className="text-[10px] font-black tracking-widest uppercase">QR SCAN</span>
                                </button>
                                <button onClick={() => handleNumberClick('0')} className="h-24 bg-slate-50 rounded-[2rem] text-4xl font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-sm border border-slate-100">0</button>
                                <button onClick={() => setPincode(prev => prev.slice(0, -1))} className="h-24 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all border border-slate-100"><Delete size={32} /></button>
                            </div>
                        </motion.div>
                    )}

                    {status === 'SCANNING' && (
                        <motion.div key="scanning" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-slate-900 rounded-[4rem] overflow-hidden shadow-2xl relative border-8 border-white">
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
                        <motion.div key="selecting" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl bg-white rounded-[4rem] shadow-2xl p-12 flex flex-col items-center">
                            <h2 className="text-3xl font-black text-slate-800 mb-2">학교를 선택해 주세요</h2>
                            <p className="text-slate-400 font-bold mb-10">동일한 번호의 학생이 여러 명 있습니다.</p>
                            <div className="w-full space-y-4 mb-10 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {matchingUsers.map(u => (
                                    <button key={u.id} onClick={() => processKioskAction(u)} className="w-full p-8 bg-slate-50 rounded-3xl flex items-center justify-between hover:bg-blue-600 hover:text-white transition-all group active:scale-95 shadow-sm border border-slate-100">
                                        <div><p className="text-2xl font-black">{u.name}</p><p className="text-sm opacity-60 font-bold">{u.school} | {u.phone_back4}</p></div>
                                        <ChevronRight size={32} className="opacity-20 group-hover:opacity-100 transition" />
                                    </button>
                                ))}
                            </div>
                            <button onClick={resetState} className="p-4 text-slate-400 font-black tracking-widest uppercase text-xs hover:text-slate-800 transition">처음으로 돌아가기</button>
                        </motion.div>
                    )}

                    {status === 'LOADING' && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-20 h-20 border-8 border-slate-200 border-t-blue-600 rounded-full" />
                            <p className="text-slate-400 font-black tracking-widest uppercase">Processing...</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Non-blocking Overlay Feedback */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.2, y: -50 }}
                            className={`absolute z-50 p-16 rounded-[4rem] shadow-2xl flex flex-col items-center text-center text-white ${result.color} min-w-[400px]`}
                        >
                            <div className="mb-6">
                                {result.badge && result.badge.image ? (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="w-40 h-40 bg-white rounded-full p-2 shadow-xl border-4 border-yellow-300 overflow-hidden"
                                    >
                                        <img src={result.badge.image} alt="badge" className="w-full h-full object-cover" />
                                    </motion.div>
                                ) : (
                                    result.type === 'SUCCESS' ? <CheckCircle size={100} strokeWidth={2.5} /> : <AlertCircle size={100} strokeWidth={2.5} />
                                )}
                            </div>
                            <h2 className="text-4xl font-black mb-2 tracking-tighter">{result.message}</h2>
                            <p className="text-xl font-black opacity-80">{result.subMessage}</p>
                            <div className="w-full h-1.5 bg-white/30 mt-10 rounded-full overflow-hidden">
                                <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: result.type === 'SUCCESS' ? 0.5 : 1.5, ease: "linear" }} className="h-full bg-white" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <footer className="p-10 text-center shrink-0">
                <p className="text-slate-300 font-black text-[10px] tracking-[0.4em] uppercase">Powered by SCI Center Technology</p>
            </footer>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};

export default Kiosk;
