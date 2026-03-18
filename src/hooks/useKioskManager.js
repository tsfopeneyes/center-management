import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { isConsecutiveWorkingDay } from '../utils/analyticsUtils';
import confetti from 'canvas-confetti';
import { TERMS_VERSION } from '../constants/appConstants';

export const useKioskManager = (navigate) => {
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
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [pendingKioskUser, setPendingKioskUser] = useState(null);
    const [pendingCheckoutUser, setPendingCheckoutUser] = useState(null);
    const [checkoutVisitDate, setCheckoutVisitDate] = useState('');

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

    const processKioskAction = async (user) => {
        if (!selectedLocation) return;

        // Check for terms agreement
        const isGuest = user.user_group === '게스트';
        if (!isGuest && (!user.preferences?.terms_agreed || user.preferences?.terms_version !== TERMS_VERSION)) {
            setPendingKioskUser(user);
            setStatus('REQUIRE_TERMS_AGREEMENT');
            return;
        }

        const { getKSTDateString } = await import('../utils/dateUtils');

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

                    const uniqueDates = [...new Set(recentLogs.map(l => new Date(l.created_at).toDateString()))];

                    for (let i = 1; i < uniqueDates.length; i++) {
                        const prevDateStr = uniqueDates[i];
                        const currDateStr = uniqueDates[i - 1];

                        if (isConsecutiveWorkingDay(prevDateStr, currDateStr)) {
                            currentStreak++;
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

            // D. If guest user checking in, also insert GUEST_ENTRY for statistics
            if (nextType === 'CHECKIN' && user.user_group === '게스트') {
                await supabase.from('logs').insert([{
                    user_id: user.id,
                    location_id: selectedLocation.id,
                    type: 'GUEST_ENTRY'
                }]);
            }

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
                // Intercept Checkout to ask for purpose
                setPendingCheckoutUser(user);
                setCheckoutVisitDate(getKSTDateString(new Date()));
                setStatus('REQUIRE_PURPOSE');
                setPincode('');
                setMatchingUsers([]);
                return; // Wait for purpose selection
            }

            if (nextType === 'CHECKIN') {
                if (isFirstEver) {
                    msg = `첫 방문을 환영합니다! 🎊`;
                    sub = `${user.name}님, SCI CENTER에 오신 것을 환영해요!`;
                    color = 'bg-indigo-600';

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

            setStatus('IDLE');
            setPincode('');
            setMatchingUsers([]);

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
            setStatus('IDLE');
            setPincode('');
            setTimeout(() => setResult(null), 2000);
        }
    };

    const handleKioskTermsAgree = async () => {
        if (!pendingKioskUser) return;

        try {
            const updatedPreferences = {
                ...(pendingKioskUser.preferences || {}),
                terms_agreed: true,
                terms_version: TERMS_VERSION
            };
            const { error } = await supabase
                .from('users')
                .update({ preferences: updatedPreferences })
                .eq('id', pendingKioskUser.id);

            if (error) throw error;

            const userWithTerms = { ...pendingKioskUser, preferences: updatedPreferences };
            setPendingKioskUser(null);
            await processKioskAction(userWithTerms);
        } catch (err) {
            console.error('Kiosk Terms Agree Error:', err);
            setResult({
                type: 'ERROR',
                message: '인증 실패',
                subMessage: err.message || '약관 동의 처리 중 오류가 발생했습니다.',
                color: 'bg-red-500'
            });
            setStatus('IDLE');
            setTimeout(() => setResult(null), 2000);
        }
    };

    const handleCheckoutPurpose = async (purposes) => {
        // Validation check for required data
        if (!pendingCheckoutUser || !checkoutVisitDate) {
            console.error('Missing data for checkout purpose:', { pendingCheckoutUser, checkoutVisitDate });
            setResult({
                type: 'ERROR',
                message: '데이터 유실',
                subMessage: '사용자 정보가 확인되지 않습니다. 처음부터 다시 시도해주세요.',
                color: 'bg-red-500'
            });
            setTimeout(() => resetState(), 2000);
            return;
        }

        try {
            setStatus('LOADING');
            const purposeString = purposes.join(', ');

            // Attempt to save the visit purpose
            const { error } = await supabase.from('visit_notes').upsert({
                user_id: pendingCheckoutUser.id,
                visit_date: checkoutVisitDate,
                purpose: purposeString,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,visit_date' });

            if (error) throw error;

            setResult({
                type: 'SUCCESS',
                message: '오늘도 즐거웠어요✨',
                subMessage: '퇴실 완료 | 방문 목적이 저장되었습니다.',
                color: 'bg-orange-500'
            });

            // Reset all kiosk states
            setPendingCheckoutUser(null);
            setCheckoutVisitDate('');
            setStatus('IDLE');
            setPincode('');
            setMatchingUsers([]);
            setTimeout(() => setResult(null), 1500);

        } catch (err) {
            console.error('Checkout Purpose Error:', err);
            setResult({
                type: 'ERROR',
                message: '내용 저장 실패',
                subMessage: '퇴실 처리에 오류가 발생했습니다. (내용: ' + (err.message || 'Unknown') + ')',
                color: 'bg-red-500'
            });
            // We still reset on error to allow the next person to use it, 
            // but we show the error long enough to be seen.
            setTimeout(() => {
                setResult(null);
                setStatus('IDLE');
            }, 3000);
        }
    };

    const handleVerifyNumeric = useCallback(async (code) => {
        if (code.length !== 4) return;
        const currentBackgroundStatus = status;
        setStatus('LOADING');

        try {

            const { data, error } = await supabase
                .from('users')
                .select('id, name, school, phone_back4, preferences, user_group')
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

            // [Refactor] Block Temporary Students from Kiosk
            const nonTempUsers = data.filter(u => !u.preferences?.is_temporary);
            
            if (nonTempUsers.length === 0) {
                setResult({
                    type: 'ERROR',
                    message: '등록 절차 필요',
                    subMessage: '정식 회원가입 후 이용 가능합니다.',
                    color: 'bg-amber-500'
                });
                setStatus(currentBackgroundStatus);
                setPincode('');
                setTimeout(() => setResult(null), 2500);
                return;
            }

            if (nonTempUsers.length === 1) {
                await processKioskAction(nonTempUsers[0]);
            } else {
                setMatchingUsers(nonTempUsers);
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
    }, [selectedLocation, status, pincode]);

    const handleNumberClick = (num) => {
        if (result || status === 'LOADING') return;
        if (pincode.length < 4) {
            const nextCode = pincode + num;
            setPincode(nextCode);
            if (nextCode.length === 4) {
                handleVerifyNumeric(nextCode);
            }
        }
    };

    const handleIdentifyUser = async (val) => {
        const currentBackgroundStatus = status;
        setStatus('LOADING');
        try {
            const { data: byId } = await supabase.from('users').select('*').eq('id', val).single();
            if (byId) {
                if (byId.preferences?.is_temporary) {
                    setResult({
                        type: 'ERROR',
                        message: '등록 절차 필요',
                        subMessage: '정식 회원가입 후 이용 가능합니다.',
                        color: 'bg-amber-500'
                    });
                    setStatus(currentBackgroundStatus);
                    setTimeout(() => setResult(null), 2500);
                    return;
                }
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

    const resetState = () => {
        setPincode('');
        setStatus('IDLE');
        setMatchingUsers([]);
        setResult(null);
    };

    return {
        // State
        locations, selectedLocation, matchingUsers, currentTime, pincode, status, result,
        showMasterPin, showOptionsMenu, masterPinInput, showSignupForm, showGuestForm, facingMode, lastScan, challenges,
        pendingKioskUser,
        // Setters
        setSelectedLocation, setPincode, setStatus, setResult,
        setShowMasterPin, setShowOptionsMenu, setMasterPinInput, setShowSignupForm, setShowGuestForm, setFacingMode, setLastScan, setAfterPinAction,
        setPendingKioskUser,
        // Handlers
        handleSetLocation, resetLocation, handleMasterPinSubmit, handleResetLocation,
        processKioskAction, handleVerifyNumeric, handleNumberClick, handleQrScan, handleIdentifyUser, resetState,
        handleKioskTermsAgree, handleCheckoutPurpose,
        // Missing states for checkout purpose
        pendingCheckoutUser, checkoutVisitDate
    };
};
