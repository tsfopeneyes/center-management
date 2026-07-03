import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const KioskWelcomeSection = ({ setShowSignupForm, setShowGuestForm }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 lg:gap-10 w-full lg:order-first pb-20 lg:pb-0"
        >
            <div className="glass-card p-6 sm:p-10 rounded-[3rem] sm:rounded-[4rem] border-white/60 shadow-2xl relative overflow-hidden group bg-white/40 backdrop-blur-md">
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
                    <QRCodeSVG value="https://app.schoolchurchimpact.org" size={96} level="H" />
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
    );
};

export default KioskWelcomeSection;
