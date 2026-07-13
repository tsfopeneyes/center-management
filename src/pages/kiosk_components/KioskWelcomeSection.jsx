import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Smartphone, Sparkles, LogIn } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../supabaseClient';

const KioskWelcomeSection = ({ setShowSignupForm, setShowGuestForm, selectedLocation }) => {
    const [branchName, setBranchName] = useState('센터');

    useEffect(() => {
        const fetchBranchName = async () => {
            if (selectedLocation?.group_id) {
                try {
                    const { data: grp } = await supabase
                        .from('location_groups')
                        .select('name')
                        .eq('id', selectedLocation.group_id)
                        .maybeSingle();
                    if (grp?.name) {
                        if (grp.name.includes('하이픈') || grp.name.includes('HYPHEN') || grp.name.includes('강동')) {
                            setBranchName('하이픈');
                        } else if (grp.name.includes('이높플레이스') || grp.name.includes('ENOF') || grp.name.includes('이높') || grp.name.includes('강서')) {
                            setBranchName('이높플레이스');
                        } else {
                            setBranchName(grp.name);
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch branch name:", err);
                }
            }
        };
        fetchBranchName();
    }, [selectedLocation]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 lg:gap-10 w-full lg:order-first pb-20 lg:pb-0"
        >
            <div className="glass-card p-8 sm:p-12 rounded-[3.5rem] sm:rounded-[4.5rem] border-white/70 shadow-2xl relative overflow-hidden group bg-white/50 backdrop-blur-xl">
                {/* Visual Glow Decorators */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/0 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000 ease-out" />
                <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />

                <h2 className="text-3xl sm:text-4.5xl font-black text-slate-800 tracking-tight leading-[1.25] mb-6 text-balance">
                    <span className="text-blue-600 block mb-1 font-extrabold">{branchName}에 오신 여러분을</span>
                    진심으로 환영합니다 ✨
                </h2>
                <p className="text-slate-400 font-bold text-base sm:text-[17px] mb-10 leading-relaxed tracking-wide">
                    전화번호 뒤 4자리를 입력해서 <br className="hidden sm:block" />
                    공간에 체크인 해주세요!
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <button
                        onClick={() => setShowSignupForm(true)}
                        className="flex-1 py-5 sm:py-5.5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-[2rem] font-black text-base sm:text-lg flex items-center justify-center gap-2.5 hover:from-slate-800 hover:to-slate-900 active:scale-98 transition-all shadow-xl shadow-slate-200 border border-slate-700/30"
                    >
                        <UserPlus size={20} className="text-blue-400" />
                        회원가입
                    </button>
                    <button
                        onClick={() => setShowGuestForm(true)}
                        className="flex-1 py-5 sm:py-5.5 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-indigo-50/30 text-indigo-600 border border-indigo-100/80 rounded-[2rem] font-black text-base sm:text-lg flex items-center justify-center gap-2.5 hover:from-indigo-100/60 hover:to-blue-50 active:scale-98 transition-all shadow-lg shadow-indigo-100/10"
                    >
                        <LogIn size={20} />
                        게스트 입장
                    </button>
                </div>
            </div>

            {/* App Install Section */}
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-white/50 backdrop-blur-xl p-6 sm:p-8 rounded-[3rem] border border-white/70 shadow-lg mb-20 lg:mb-0">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 shrink-0">
                    <QRCodeSVG value="https://app.schoolchurchimpact.org" size={90} level="H" />
                </div>
                <div className="text-center sm:text-left">
                    <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1 flex items-center justify-center sm:justify-start gap-2">
                        <Smartphone className="text-blue-500" size={16} />
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
