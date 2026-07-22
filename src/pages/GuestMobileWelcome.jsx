import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, School, ArrowRight, CheckCircle2, ChevronRight, Heart, X, MessageSquare } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../supabaseClient';
import { normalizeSchoolName } from '../utils/userUtils';

const SURVEY_OPTIONS = [
    { id: '1', emoji: '🍽️', label: '밥 먹고 쉬고 싶어요.' },
    { id: '2', emoji: '🎲', label: '친구들과 놀고 싶어요.' },
    { id: '3', emoji: '☕', label: '누군가와 이야기하고 싶어요.' },
    { id: '4', emoji: '🙏', label: '기도하거나 예배하고 싶어요.' },
    { id: '5', emoji: '📚', label: '조용히 있고 싶어요.' },
    { id: '6', emoji: '🤷', label: '아직 잘 모르겠어요.' }
];

const GuestMobileWelcome = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('HOME'); // 'HOME' | 'FORM' | 'SUCCESS'
    const [name, setName] = useState('');
    const [school, setSchool] = useState('');
    const [selectedSurveyId, setSelectedSurveyId] = useState('1');
    const [loading, setLoading] = useState(false);

    // Trigger confetti on success
    useEffect(() => {
        if (step === 'SUCCESS') {
            confetti({
                particleCount: 80,
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
            const surveyObj = SURVEY_OPTIONS.find(o => o.id === selectedSurveyId);
            const surveyLabel = surveyObj ? `${surveyObj.emoji} ${surveyObj.label}` : '';

            // 1. Fetch Location Info (Default to Haifn or first location)
            const { data: locations } = await supabase.from('locations').select('*');
            const haifnLoc = (locations || []).find(l => l.name.includes('하이픈')) || locations?.[0] || { id: null, name: '하이픈' };

            // 2. Insert into logs table directly without creating a dummy user in users table
            const { error: logErr } = await supabase.from('logs').insert([{
                user_id: null,
                location_id: haifnLoc.id,
                type: 'CHECKIN',
                metadata: {
                    is_guest: true,
                    guest_name: cleanName,
                    guest_school: cleanSchool,
                    survey: surveyLabel
                }
            }]);

            if (logErr) throw logErr;

            // 3. Trigger Realtime LINE / Discord Notification
            const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const alertMessage = `[GUEST CHECK-IN]\n💌 ${cleanName}(${cleanSchool}) 게스트님이 ${haifnLoc.name}에 방문했어요 (${timeStr})\n▪ ${surveyLabel}`;

            try {
                const { data: settings } = await supabase.from('global_settings').select('*');
                let lineToken = '';
                let lineGroupId = '';
                let gsWebhookUrl = '';
                let discordWebhookUrl = '';

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

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header Brand */}
            <header className="p-6 relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/30">
                        H
                    </span>
                    <span className="font-extrabold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                        HAIFN
                    </span>
                </div>
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-blue-300 border border-white/10">
                    청소년 아지트
                </span>
            </header>

            {/* Main Content Areas */}
            <main className="flex-1 px-6 pb-10 flex flex-col justify-center relative z-10 max-w-md mx-auto w-full">
                <AnimatePresence mode="wait">
                    {step === 'HOME' && (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-8 my-auto"
                        >
                            {/* Welcome Banner */}
                            <div className="space-y-4">
                                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                                    <Sparkles size={14} className="animate-pulse" />
                                    <span>Welcome to HAIFN</span>
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
                                    하이픈에 오신 걸<br />
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                                        환영합니다! ✨
                                    </span>
                                </h1>
                                <p className="text-slate-300 text-sm md:text-base leading-relaxed font-medium">
                                    가볍게 둘러보고 싶다면 <strong className="text-blue-400 font-bold">게스트로 체크인</strong> 해주세요!
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3.5 pt-4">
                                <button
                                    onClick={() => setStep('FORM')}
                                    className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-between group text-base"
                                >
                                    <span className="flex items-center gap-3">
                                        <span className="text-xl">🎈</span>
                                        <span>게스트로 체크인하기</span>
                                    </span>
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>

                                <button
                                    onClick={() => navigate('/?signup=true')}
                                    className="w-full py-4 px-6 bg-white/5 hover:bg-white/10 text-slate-200 font-bold rounded-2xl border border-white/10 backdrop-blur-md active:scale-[0.98] transition-all duration-200 flex items-center justify-between group text-base"
                                >
                                    <span className="flex items-center gap-3">
                                        <span className="text-xl">📝</span>
                                        <span>하이픈 정식 회원가입</span>
                                    </span>
                                    <ChevronRight size={20} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
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
                            className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6 my-auto"
                        >
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <span>🎈</span> 게스트 체크인
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">방문 정보를 간단히 입력해 주세요</p>
                                </div>
                                <button onClick={() => setStep('HOME')} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleGuestCheckinSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">이름</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="이름 입력 (예: 김지민)"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">학교</label>
                                    <div className="relative">
                                        <School className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={school}
                                            onChange={(e) => setSchool(e.target.value)}
                                            placeholder="학교 이름 (예: 성덕여중)"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">오늘 하이픈에서 무엇을 하고 싶나요?</label>
                                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                                        {SURVEY_OPTIONS.map(opt => {
                                            const isSelected = selectedSurveyId === opt.id;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setSelectedSurveyId(opt.id)}
                                                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${isSelected ? 'bg-blue-600/20 border-blue-500 text-white font-bold' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                                                >
                                                    <span className="text-lg">{opt.emoji}</span>
                                                    <span className="text-xs">{opt.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 mt-2 text-base"
                                >
                                    {loading ? '체크인 처리 중...' : '체크인 완료하기 ✨'}
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
                            className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 shadow-2xl text-center space-y-6 my-auto"
                        >
                            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 size={36} />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-extrabold text-white">체크인 완료! 🎉</h2>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    <strong className="text-blue-400 font-bold">{name}</strong>님, 환영합니다!<br />
                                    하이픈 공간에서 즐겁고 편안한 시간 보내세요.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl text-xs text-slate-400 space-y-1 text-left">
                                <div className="font-bold text-slate-300">📌 이용 안내</div>
                                <div>• 푸드존 간식과 보드게임, 책이 준비되어 있습니다.</div>
                                <div>• 궁금한 점은 언제든 스탭 선생님에게 편하게 말씀해주세요!</div>
                            </div>

                            <button
                                onClick={() => setStep('HOME')}
                                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition text-sm"
                            >
                                확인
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="p-6 text-center text-xs text-slate-500 relative z-10">
                © SCI CENTER • HAIFN Youth Space
            </footer>
        </div>
    );
};

export default GuestMobileWelcome;
