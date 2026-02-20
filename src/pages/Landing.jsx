import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, Smartphone, School, Calendar, CheckCircle, AlertCircle, Tablet, X } from 'lucide-react';
import SignUpForm from '../components/auth/SignUpForm';

// -- Login Form Component --
const LoginForm = ({ navigate }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [duplicates, setDuplicates] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Try checking 'password' column (New Logic)
            let { data: users, error } = await supabase
                .from('users')
                .select('*')
                .ilike('name', name) // Case-insensitive login
                .eq('password', password);

            // 2. Fallback: If no user found, check 'phone_back4' (Legacy Logic)
            // This handles cases where SQL update might have failed or for old accounts causing issues
            if (!error && (!users || users.length === 0)) {
                // Only try this if input is exactly 4 digits (typical for phone_back4)
                if (password.length === 4 && /^\d+$/.test(password)) {
                    const { data: legacyUsers, error: legacyError } = await supabase
                        .from('users')
                        .select('*')
                        .ilike('name', name) // Case-insensitive login
                        .eq('phone_back4', password);

                    if (!legacyError && legacyUsers && legacyUsers.length > 0) {
                        // CRITICAL SECURITY FIX:
                        // Only allow phone_back4 login if the user DOES NOT have a password set.
                        // If they have a password, they must use it.
                        const validLegacyUsers = legacyUsers.filter(u => !u.password);

                        if (validLegacyUsers.length > 0) {
                            users = validLegacyUsers;
                        } else {
                            // User exists but has a password set, and the input didn't match that password (Query 1 failed).
                            // So we explicitly deny this attempt to prevent using phone_back4 as a backdoor.
                            alert('비밀번호가 설정된 계정입니다. 설정한 비밀번호로 로그인해주세요.');
                            setLoading(false);
                            return;
                        }
                    }
                }
            }

            if (error) throw error;

            if (!users || users.length === 0) {
                alert('일치하는 회원 정보가 없습니다. 비밀번호를 확인해주세요.');
            } else if (users.length === 1) {
                proceedLogin(users[0]);
            } else {
                setDuplicates(users);
                setShowModal(true);
            }
        } catch (err) {
            console.error(err);
            alert('로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const proceedLogin = (user) => {
        if (user.status === 'pending') {
            alert('관리자의 승인이 필요한 계정입니다. (임시 회원)\n보호자 동의 확인 후 정식 회원으로 승인됩니다.');
            return;
        }

        localStorage.setItem('user', JSON.stringify(user));
        if (user.role === 'admin') {
            localStorage.setItem('admin_user', JSON.stringify(user)); // Prepare for admin check
            navigate('/admin');
        } else {
            navigate('/student');
        }
    };

    return (
        <>
            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1 ml-1">이름</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                            placeholder="이름 입력"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1 ml-1">비밀번호</label>
                    <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all tracking-widest font-mono"
                            placeholder="비밀번호 입력"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none disabled:translate-y-0"
                >
                    {loading ? '확인 중...' : '입장하기'}
                </button>
            </form>

            {/* Duplicate Resolution Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">학교 선택</h3>
                        <p className="text-gray-500 mb-4 text-sm">동명이인이 있습니다. 본인의 정보를 선택해주세요.</p>
                        <div className="space-y-2">
                            {duplicates.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => proceedLogin(u)}
                                    className="w-full text-left p-4 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-semibold transition"
                                >
                                    {u.school} ({u.birth})
                                    {u.is_leader && <span className="ml-2 inline-flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg></span>}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowModal(false)}
                            className="mt-4 w-full py-3 text-gray-400 hover:text-gray-600"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

const Landing = () => {
    const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
    const navigate = useNavigate();

    const [showKioskPin, setShowKioskPin] = useState(false);
    const [kioskPin, setKioskPin] = useState('');

    // -- Persistence Check --
    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.role === 'admin') {
                    // Sync admin_user for AdminDashboard check
                    localStorage.setItem('admin_user', JSON.stringify(user));
                    navigate('/admin');
                } else {
                    navigate('/student');
                }
            } catch (err) {
                console.error("Auth persistence error:", err);
                localStorage.removeItem('user');
                localStorage.removeItem('admin_user');
            }
        }
    }, [navigate]);

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header Section */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight drop-shadow-sm">SCI CENTER</h1>
                    <p className="text-blue-100 text-lg md:text-xl font-medium flex items-center justify-center gap-2 opacity-90">
                        우리가 교회다 <span className="text-3xl filter drop-shadow-md">⛪</span>
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('login')}
                        className={`flex-1 py-4 font-bold text-center transition-colors duration-200 ${activeTab === 'login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        로그인
                    </button>
                    <button
                        onClick={() => setActiveTab('signup')}
                        className={`flex-1 py-4 font-bold text-center transition-colors duration-200 ${activeTab === 'signup' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        회원가입
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-8">
                    {activeTab === 'login' ? (
                        <LoginForm navigate={navigate} />
                    ) : (
                        <SignUpForm onSuccess={() => setActiveTab('login')} />
                    )}
                </div>
            </div>

            {/* Kiosk Mode Entry (Discreet) */}
            <div className="mt-8 flex flex-col items-center gap-4">
                <button
                    onClick={() => setShowKioskPin(true)}
                    className="text-gray-300 hover:text-blue-500 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                    <Tablet size={14} /> Kiosk Mode
                </button>
            </div>

            {/* Kiosk Pin Modal */}
            {showKioskPin && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800 tracking-tight">키오스크 모드 진입</h3>
                            <button onClick={() => { setShowKioskPin(false); setKioskPin(''); }} className="text-gray-400 hover:text-gray-600">
                                <AlertCircle size={20} />
                            </button>
                        </div>
                        <p className="text-gray-500 mb-8 text-sm font-medium">관리자 마스터 핀 번호를 입력해 주세요.</p>

                        <div className="flex justify-center gap-3 mb-8">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-12 h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${kioskPin[i] ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300 border-2 border-dashed border-gray-200'}`}>
                                    {kioskPin[i] ? '●' : ''}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
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
                                            // Auto-submit if 4 digits
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
                                    className={`h-14 rounded-2xl font-bold flex items-center justify-center transition-all active:scale-95 ${typeof btn === 'number' ? 'bg-gray-50 text-gray-700 hover:bg-gray-100' :
                                        btn === 'Enter' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-red-50 text-red-500 hover:bg-red-100 text-xs'
                                        }`}
                                >
                                    {btn}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Consent Modals are now handled inside SignUpForm */}
        </div>
    );
};

// SignUpForm Component has been moved to a separate file (src/components/auth/SignUpForm.jsx)

export default Landing;
