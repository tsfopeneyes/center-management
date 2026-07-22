import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Smartphone, AlertCircle, Tablet, ArrowRight, Sparkles } from 'lucide-react';
import SignUpForm from '../components/auth/SignUpForm';
import TermsConsentModal from '../components/auth/TermsConsentModal';
import { hashPassword } from '../utils/hashUtils';

// -- Login Form Component --
const LoginForm = ({ navigate }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [duplicates, setDuplicates] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [pendingUser, setPendingUser] = useState(null);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const hashedPassword = await hashPassword(password);

            // 1. Call RPC to get matching users without auth
            let { data: candidates, error: rpcError } = await supabase
                .rpc('get_login_candidates', { p_name: name });

            if (rpcError) throw rpcError;

            if (!candidates || candidates.length === 0) {
                // Fallback to checking for guest users with name(guest) pattern
                const { data: guestCandidates, error: guestError } = await supabase
                    .rpc('get_login_candidates', { p_name: `${name}(guest)` });
                
                if (!guestError && guestCandidates && guestCandidates.length > 0) {
                    candidates = guestCandidates;
                } else {
                    alert('가입된 이름이 없습니다. 이름을 다시 확인해주세요.');
                    setLoading(false);
                    return;
                }
            }

            // If there is exactly one matching name, try to login
            if (candidates.length === 1) {
                await attemptSupabaseAuth(candidates[0], hashedPassword, password);
            } else {
                // If there are duplicates, show the modal to let the user select
                setDuplicates(candidates);
                setShowModal(true);
            }
        } catch (err) {
            console.error(err);
            alert('로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const attemptSupabaseAuth = async (userCandidate, hashedPw, rawPassword) => {
        try {
            let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: userCandidate.email,
                password: hashedPw
            });

            if (authError || !authData.user) {
                const { data: dbUser, error: dbError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userCandidate.id)
                    .maybeSingle();

                if (dbUser && (dbUser.password === hashedPw || dbUser.password === rawPassword)) {
                    checkTermsAgreement(dbUser);
                    return true;
                }

                const { data: syncSuccess } = await supabase.rpc('legacy_login_sync', {
                    p_name: userCandidate.name,
                    p_hashed_pw: hashedPw
                });

                if (syncSuccess) {
                    const { data: retryAuth } = await supabase.auth.signInWithPassword({
                        email: userCandidate.email,
                        password: hashedPw
                    });
                    if (retryAuth?.user) {
                        checkTermsAgreement(dbUser || userCandidate);
                        return true;
                    }
                }

                alert('비밀번호가 일치하지 않습니다.');
                return false;
            } else {
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authData.user.id)
                    .maybeSingle();

                checkTermsAgreement(dbUser || userCandidate);
                return true;
            }
        } catch (err) {
            console.error("Supabase auth error:", err);
            alert("로그인 처리 중 오류가 발생했습니다.");
            return false;
        }
    };

    const handleDuplicateSelect = (selectedUser) => {
        setShowModal(false);
        const hashedPw = hashPassword(password);
        attemptSupabaseAuth(selectedUser, hashedPw, password);
    };

    const checkTermsAgreement = (user) => {
        if (!user.terms_agreed) {
            setPendingUser(user);
            setShowTermsModal(true);
        } else {
            proceedLoginSuccess(user);
        }
    };

    const handleTermsAgree = async () => {
        if (!pendingUser) return;
        try {
            await supabase
                .from('users')
                .update({ terms_agreed: true })
                .eq('id', pendingUser.id);
            
            const updatedUser = { ...pendingUser, terms_agreed: true };
            setShowTermsModal(false);
            proceedLoginSuccess(updatedUser);
        } catch (err) {
            console.error("Terms agreement update failed:", err);
            alert("약관 동의 처리 중 오류가 발생했습니다.");
        }
    };

    const proceedLoginSuccess = async (user) => {
        if (user.status === 'pending') {
            alert('관리자의 승인이 필요한 계정입니다. (임시 회원)\n보호자 동의 확인 후 정식 회원으로 승인됩니다.');
            supabase.auth.signOut();
            return;
        }

        const nowIso = new Date().toISOString();
        const updatedPreferences = { ...(user.preferences || {}), last_web_login_at: nowIso };
        const updatedUser = { ...user, preferences: updatedPreferences };

        try {
            await supabase.from('users').update({ preferences: updatedPreferences }).eq('id', user.id);
        } catch (e) {
            console.error('Failed to update last_web_login_at:', e);
        }

        localStorage.setItem('user', JSON.stringify(updatedUser));
        const params = new URLSearchParams(window.location.search);
        const noticeId = params.get('noticeId');
        const suffix = noticeId ? `?noticeId=${noticeId}` : '';

        if (user.role === 'admin') {
            localStorage.setItem('admin_user', JSON.stringify(updatedUser));
            navigate('/admin' + suffix);
        } else {
            navigate('/student' + suffix);
        }
    };

    return (
        <>
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-[12px] font-bold text-[#4E5968] mb-1.5 ml-1">이름</label>
                    <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B95A1]" size={18} />
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-[#F9FAFB] border border-[#E5E8EB] rounded-2xl text-[#191F28] placeholder-[#B0B8C1] font-bold text-sm outline-none focus:bg-white focus:border-[#E63946] transition-all"
                            placeholder="이름 입력"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[12px] font-bold text-[#4E5968] mb-1.5 ml-1">비밀번호</label>
                    <div className="relative">
                        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B95A1]" size={18} />
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 bg-[#F9FAFB] border border-[#E5E8EB] rounded-2xl text-[#191F28] placeholder-[#B0B8C1] font-bold text-sm outline-none focus:bg-white focus:border-[#E63946] transition-all ${password ? 'tracking-widest font-mono' : ''}`}
                            placeholder="비밀번호 입력"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-[#E63946] hover:bg-[#D62839] text-white font-bold rounded-2xl transition shadow-md shadow-[#E63946]/25 active:scale-[0.98] disabled:opacity-50 mt-2 text-[16px] tracking-tight flex items-center justify-center"
                >
                    {loading ? '입장 확인 중...' : '입장하기'}
                </button>
            </form>

            {/* Duplicate Resolution Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 border border-[#E5E8EB]">
                        <div>
                            <h3 className="text-lg font-extrabold text-[#191F28]">학교 선택</h3>
                            <p className="text-xs text-[#8B95A1] mt-0.5 font-medium">동명이인이 있습니다. 본인의 학교를 선택해 주세요.</p>
                        </div>
                        <div className="space-y-2">
                            {duplicates.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => handleDuplicateSelect(u)}
                                    className="w-full text-left p-3.5 bg-[#F9FAFB] hover:bg-[#E63946]/10 hover:border-[#E63946] text-[#191F28] border border-[#E5E8EB] rounded-2xl font-bold transition text-sm flex items-center justify-between"
                                >
                                    <span>{u.school} ({u.birth})</span>
                                    {u.is_leader && <span className="text-amber-500 font-bold text-xs">⭐ 리더</span>}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-full py-3 text-[#8B95A1] hover:text-[#191F28] text-xs font-bold"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Terms Agreement Blocking Overlay */}
            <TermsConsentModal
                isOpen={showTermsModal}
                onClose={() => {
                    setShowTermsModal(false);
                    setPendingUser(null);
                }}
                onAgree={handleTermsAgree}
            />
        </>
    );
};

const Landing = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return (params.get('signup') === 'true' || params.get('tab') === 'signup' || window.location.href.includes('signup=true')) ? 'signup' : 'login';
    });

    const [showKioskPin, setShowKioskPin] = useState(false);
    const [kioskPin, setKioskPin] = useState('');

    // Check query params or location state for initial tab
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('signup') === 'true' || params.get('tab') === 'signup' || location.state?.signup) {
            setActiveTab('signup');
        }
    }, [location.search, location.state]);

    // -- Persistence Check --
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const isSignupQuery = params.get('signup') === 'true' || params.get('tab') === 'signup' || location.state?.signup;

        if (isSignupQuery) return;

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                const noticeId = params.get('noticeId');
                const suffix = noticeId ? `?noticeId=${noticeId}` : '';

                if (user.role === 'admin') {
                    localStorage.setItem('admin_user', JSON.stringify(user));
                    navigate('/admin' + suffix);
                } else {
                    navigate('/student' + suffix);
                }
            } catch (err) {
                console.error("Auth persistence error:", err);
                localStorage.removeItem('user');
                localStorage.removeItem('admin_user');
            }
        }
    }, [navigate, location.search, location.state]);

    return (
        <div className="min-h-screen bg-[#F8F9FA] text-[#191F28] flex flex-col justify-between items-center p-4 relative overflow-hidden select-none font-sans bg-[radial-gradient(rgba(148,163,184,0.12)_1.5px,transparent_0)] bg-[size:32px_32px]">
            {/* Ambient Background Glow Accents */}
            <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-[#E63946]/10 to-orange-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[90px]" />
            </div>

            {/* Background Watermark Typography Pattern (Kiosk Style) */}
            <div className="absolute inset-0 overflow-hidden opacity-[0.035] z-0 select-none pointer-events-none flex flex-col justify-around rotate-[-12deg] scale-150 origin-center">
                {Array.from({ length: 8 }).map((_, rIdx) => (
                    <div 
                        key={rIdx} 
                        className={`text-[8vw] font-black uppercase tracking-[0.2em] whitespace-nowrap leading-none flex gap-12 ${rIdx % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                        style={{ WebkitTextStroke: '2px #191F28' }}
                    >
                        {Array.from({ length: 6 }).map((_, cIdx) => (
                            <span key={cIdx}>SCHOOL CHURCH IMPACT</span>
                        ))}
                    </div>
                ))}
            </div>

            {/* Main Content Card Container */}
            <main className="w-full max-w-md my-auto relative z-10 pt-4">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#E5E8EB]">
                    {/* Top Vermilion Accent Bar */}
                    <div className="h-2.5 bg-gradient-to-r from-[#E63946] via-[#FF5A60] to-[#E63946] w-full" />

                    <div className="p-6 space-y-6">
                        {/* Header Banner */}
                        <div className="text-center space-y-2 pt-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E63946]/10 text-[#E63946] text-[12px] font-bold">
                                <Sparkles size={13} className="animate-pulse" />
                                <span>SCHOOL CHURCH IMPACT</span>
                            </div>
                            <h2 className="text-3xl font-black text-[#191F28] tracking-tight">
                                SCI CENTER
                            </h2>
                            <p className="text-[13px] text-[#4E5968] font-medium leading-[1.6] pt-1">
                                SCI 센터는 일상 속 그리스도인을 꿈꾸는 모든 청소년을 위한 공간으로, 하나님과 이웃, 그리고 세상과의 연결을 지향합니다.
                            </p>
                        </div>

                        {/* Segment Control Tabs (Toss Light Style) */}
                        <div className="bg-[#F2F4F6] p-1.5 rounded-2xl flex gap-1">
                            <button
                                onClick={() => setActiveTab('login')}
                                className={`flex-1 py-3 text-[14.5px] font-bold rounded-xl transition-all duration-200 ${
                                    activeTab === 'login'
                                        ? 'bg-white text-[#191F28] shadow-xs'
                                        : 'text-[#8B95A1] hover:text-[#191F28]'
                                }`}
                            >
                                로그인
                            </button>
                            <button
                                onClick={() => setActiveTab('signup')}
                                className={`flex-1 py-3 text-[14.5px] font-bold rounded-xl transition-all duration-200 ${
                                    activeTab === 'signup'
                                        ? 'bg-white text-[#191F28] shadow-xs'
                                        : 'text-[#8B95A1] hover:text-[#191F28]'
                                }`}
                            >
                                회원가입
                            </button>
                        </div>

                        {/* Content Area */}
                        <div>
                            {activeTab === 'login' ? (
                                <LoginForm navigate={navigate} />
                            ) : (
                                <SignUpForm onSuccess={() => setActiveTab('login')} />
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer & Kiosk Entry */}
            <footer className="py-6 relative z-10 flex flex-col items-center gap-2">
                <button
                    onClick={() => setShowKioskPin(true)}
                    className="text-[#8B95A1] hover:text-[#E63946] transition-colors flex items-center gap-1.5 text-xs font-bold tracking-tight"
                >
                    <Tablet size={14} /> 키오스크 모드 (Kiosk Mode)
                </button>
                <div className="text-[11px] text-[#B0B8C1] font-medium">
                    © SCHOOL CHURCH IMPACT
                </div>
            </footer>

            {/* Kiosk Pin Modal */}
            {showKioskPin && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#E5E8EB] space-y-6">
                        <div className="flex justify-between items-center border-b border-[#F2F4F6] pb-4">
                            <div>
                                <h3 className="text-lg font-extrabold text-[#191F28]">키오스크 모드 진입</h3>
                                <p className="text-xs text-[#8B95A1] mt-0.5 font-medium">관리자 마스터 핀 번호를 입력해 주세요</p>
                            </div>
                            <button onClick={() => { setShowKioskPin(false); setKioskPin(''); }} className="p-2 text-[#8B95A1] hover:text-[#191F28] rounded-full bg-[#F2F4F6]">
                                <AlertCircle size={18} />
                            </button>
                        </div>

                        <div className="flex justify-center gap-3">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-12 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold transition-all ${kioskPin[i] ? 'bg-[#E63946] text-white shadow-sm shadow-[#E63946]/30' : 'bg-[#F9FAFB] text-[#B0B8C1] border border-[#E5E8EB]'}`}>
                                    {kioskPin[i] ? '●' : ''}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'Enter'].map(btn => (
                                <button
                                    key={btn}
                                    onClick={() => {
                                        if (btn === 'Clear') setKioskPin('');
                                        else if (btn === 'Enter') {
                                            const master = localStorage.getItem('kiosk_master_pin') || '1801';
                                            if (kioskPin === master) {
                                                navigate('/kiosk');
                                            } else {
                                                alert('핀 번호가 일치하지 않습니다.');
                                                setKioskPin('');
                                            }
                                        } else if (typeof btn === 'number' && kioskPin.length < 4) {
                                            const next = kioskPin + btn;
                                            setKioskPin(next);
                                            if (next.length === 4) {
                                                const master = localStorage.getItem('kiosk_master_pin') || '1801';
                                                if (next === master) navigate('/kiosk');
                                                else {
                                                    alert('핀 번호가 일치하지 않습니다.');
                                                    setKioskPin('');
                                                }
                                            }
                                        }
                                    }}
                                    className={`h-13 rounded-2xl font-bold flex items-center justify-center transition-all active:scale-95 ${
                                        typeof btn === 'number' ? 'bg-[#F9FAFB] text-[#191F28] hover:bg-[#F2F4F6] border border-[#E5E8EB]' :
                                        btn === 'Enter' ? 'bg-[#E63946] text-white hover:bg-[#D62839]' : 'bg-red-50 text-red-500 hover:bg-red-100 text-xs'
                                    }`}
                                >
                                    {btn}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Landing;
