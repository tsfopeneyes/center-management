import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Delete, Scan, X, CheckCircle, AlertCircle,
    Calendar, Clock, LogIn, LogOut, ChevronRight,
    MapPin, Camera, SwitchCamera, Settings, UserPlus, Smartphone, User,
    School, Check, BookOpen, Coffee, Heart, Edit3, Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QRCodeSVG } from 'qrcode.react';
import SignUpForm from '../components/auth/SignUpForm';
import GuestEntryForm from '../components/kiosk/GuestEntryForm';
import TermsConsentModal from '../components/auth/TermsConsentModal';
import { useKioskManager } from '../hooks/useKioskManager';

const Kiosk = () => {
    const navigate = useNavigate();

    const {
        // State
        locations, selectedLocation, matchingUsers, currentTime, pincode, status, result,
        showMasterPin, showOptionsMenu, masterPinInput, showSignupForm, showGuestForm, facingMode,
        pendingKioskUser, pendingCheckoutUser, checkoutVisitDate,
        // Setters
        setSelectedLocation, setPincode, setStatus, setResult,
        setShowMasterPin, setShowOptionsMenu, setMasterPinInput, setShowSignupForm, setShowGuestForm, setFacingMode, setAfterPinAction,
        // Handlers
        handleSetLocation, resetLocation, handleMasterPinSubmit, handleResetLocation,
        processKioskAction, handleIdentifyUser, handleVerifyNumeric, handleNumberClick, handleQrScan, resetState,
        handleKioskTermsAgree, handleCheckoutPurpose
    } = useKioskManager(navigate);

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
                    showGuestForm={showGuestForm}
                    setShowGuestForm={setShowGuestForm}
                    processKioskAction={processKioskAction}
                    status={status}
                    pendingKioskUser={pendingKioskUser}
                    handleKioskTermsAgree={handleKioskTermsAgree}
                    resetState={resetState}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col font-sans overflow-hidden select-none h-[100dvh]">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[40px] md:blur-[100px] gpu-accelerated"
                />
                <motion.div
                    animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, 50, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-100/30 rounded-full blur-[40px] md:blur-[100px] gpu-accelerated"
                />
                <motion.div
                    animate={{ scale: [1.2, 1.3, 1.2], x: [30, 0, 30] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[40%] left-[20%] w-[20%] h-[20%] bg-blue-200/15 rounded-full blur-[30px] md:blur-[80px] gpu-accelerated"
                />
                <motion.div
                    animate={{ scale: [1.2, 1, 1.2], rotate: 360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-pink-100/20 rounded-full blur-[40px] md:blur-[120px] gpu-accelerated"
                />
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

                            {status === 'REQUIRE_TERMS_AGREEMENT' && (
                                <motion.div key="terms" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6">
                                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                        <CheckCircle size={40} />
                                    </div>
                                    <p className="text-slate-800 font-black text-2xl text-center">약관 동의가 필요합니다</p>
                                    <p className="text-slate-400 font-bold text-center">서비스 이용을 위해 새로운 약관에 동의해 주세요.</p>
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
                                <button
                                    onClick={() => setShowGuestForm(true)}
                                    className="flex-1 py-5 sm:py-6 bg-indigo-50 text-indigo-600 border-2 border-indigo-100 rounded-3xl font-black text-lg sm:text-xl flex items-center justify-center gap-3 hover:bg-indigo-100/80 hover:border-indigo-200 active:scale-95 transition-all shadow-lg shadow-indigo-100/20"
                                >
                                    <UserPlus size={24} />
                                    게스트 입장
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
                showGuestForm={showGuestForm}
                setShowGuestForm={setShowGuestForm}
                processKioskAction={processKioskAction}
                status={status}
                matchingUsers={matchingUsers}
                pendingKioskUser={pendingKioskUser}
                handleKioskTermsAgree={handleKioskTermsAgree}
                pendingCheckoutUser={pendingCheckoutUser}
                handleCheckoutPurpose={handleCheckoutPurpose}
                resetState={resetState}
            />

            <style>{`
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
    setShowSignupForm,
    showGuestForm,
    setShowGuestForm,
    processKioskAction,
    pendingKioskUser,
    handleKioskTermsAgree,
    pendingCheckoutUser,
    handleCheckoutPurpose,
    status,
    resetState
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

            {/* Guest Entry Form Modal */}
            {showGuestForm && (
                <div className="fixed inset-0 bg-slate-900/40 z-[120] flex items-center justify-center p-4 sm:p-6 backdrop-blur-lg animate-fade-in overflow-y-auto">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="bg-white/95 w-full max-w-2xl rounded-[3rem] p-8 sm:p-12 shadow-2xl relative my-auto border border-white/50 backdrop-blur-xl"
                    >
                        <button
                            onClick={() => setShowGuestForm(false)}
                            className="absolute top-8 right-8 p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all active:scale-90"
                        >
                            <X size={24} />
                        </button>

                        <div className="mb-10">
                            <h3 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2 tracking-tight">게스트 입장</h3>
                            <p className="text-slate-400 font-bold">센터 패스를 한 번만 이용할 거라면 간편하게 입장하세요!</p>
                        </div>

                        <GuestEntryForm
                            onSuccess={(newUser) => {
                                setShowGuestForm(false);
                                processKioskAction(newUser);
                            }}
                            onCancel={() => setShowGuestForm(false)}
                        />
                    </motion.div>
                </div>
            )}

            {/* Consent Modals are now handled inside SignUpForm */}
            <TermsConsentModal
                isOpen={status === 'REQUIRE_TERMS_AGREEMENT'}
                onClose={resetState}
                onAgree={handleKioskTermsAgree}
                isKiosk={true}
            />

            <PurposeSelectionModal
                isOpen={status === 'REQUIRE_PURPOSE'}
                user={pendingCheckoutUser}
                onComplete={handleCheckoutPurpose}
            />
        </>
    );
};

const PurposeSelectionModal = ({ isOpen, user, onComplete }) => {
    const [selected, setSelected] = React.useState([]);

    // Reset selection every time the modal opens
    React.useEffect(() => {
        if (isOpen) setSelected([]);
    }, [isOpen]);

    const categories = [
        { id: '개인 할 일', label: '개인 할 일', icon: Edit3, color: 'bg-blue-50 text-blue-600', active: 'bg-blue-600 text-white shadow-blue-200' },
        { id: '프로그램 참여', label: '프로그램 참여', icon: BookOpen, color: 'bg-indigo-50 text-indigo-600', active: 'bg-indigo-600 text-white shadow-indigo-200' },
        { id: '교제 및 휴식', label: '교제 및 휴식', icon: Coffee, color: 'bg-orange-50 text-orange-600', active: 'bg-orange-600 text-white shadow-orange-200' },
        { id: '스처쌤 만남', label: '스처쌤 만남', icon: Heart, color: 'bg-rose-50 text-rose-600', active: 'bg-rose-600 text-white shadow-rose-200' }
    ];

    const toggle = (id) => {
        setSelected(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white w-full max-w-xl rounded-[3.5rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden"
            >
                {/* Decorative background gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -mr-32 -mt-32 blur-3xl -z-10" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50/50 rounded-full -ml-32 -mb-32 blur-3xl -z-10" />

                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-3xl mb-6 shadow-sm border border-blue-100/50">
                        <Smile className="text-blue-600" size={40} />
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 tracking-tight">오늘 센터에서<br />어떤 활동을 했나요?</h3>
                    <p className="text-slate-400 font-bold text-lg">중복 선택이 가능해요! ✨</p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-12">
                    {categories.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = selected.includes(cat.id);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => toggle(cat.id)}
                                className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-[2.5rem] transition-all duration-300 border-2 group active:scale-95 ${isActive
                                    ? `${cat.active} border-transparent shadow-xl scale-[1.02]`
                                    : `${cat.color} border-transparent opacity-70 hover:opacity-100 hover:scale-[1.01]`
                                    }`}
                            >
                                <Icon size={32} className={`mb-3 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className={`text-base sm:text-lg font-black tracking-tight whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
                                    {cat.label}
                                </span>
                                {isActive && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4 bg-white/20 p-1 rounded-full">
                                        <Check size={14} className="text-white" strokeWidth={4} />
                                    </motion.div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <button
                    disabled={selected.length === 0}
                    onClick={() => onComplete(selected)}
                    className={`w-full py-6 rounded-3xl font-black text-xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${selected.length > 0
                        ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-slate-200'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                        }`}
                >
                    체크아웃 완료 <ChevronRight size={24} />
                </button>
            </motion.div>
        </div>
    );
};

export default Kiosk;
