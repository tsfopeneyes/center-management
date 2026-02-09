import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, Smartphone, School, Calendar, CheckCircle, AlertCircle, Tablet, X } from 'lucide-react';

const Landing = () => {
    const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
    const navigate = useNavigate();

    const [showKioskPin, setShowKioskPin] = useState(false);
    const [kioskPin, setKioskPin] = useState('');

    // -- Consent & Age Modal --
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [consentType, setConsentType] = useState('mandatory'); // 'mandatory' or 'optional'

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
                        <SignUpForm
                            setActiveTab={setActiveTab}
                            setShowConsentModal={setShowConsentModal}
                            setConsentType={setConsentType}
                        />
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

            {/* Consent Modal */}
            {showConsentModal && (
                <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800 tracking-tight">
                                {consentType === 'mandatory' ? '개인정보 수집 및 이용 동의 (필수)' : '홍보 콘텐츠 활용 동의 (선택)'}
                            </h3>
                            <button onClick={() => setShowConsentModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-sm text-gray-600 leading-relaxed space-y-4">
                            {consentType === 'mandatory' ? (
                                <>
                                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                        <p className="font-bold text-blue-800 mb-2">필수 수집 항목 및 목적</p>
                                        <ul className="list-disc ml-4 space-y-1 text-blue-700/80">
                                            <li>수집 항목: 이름, 성별, 소속(학교), 생년월일, 휴대전화 번호</li>
                                            <li>수집 목적: 회원 식별, 서비스 제공(프로그램, 챌린지), 공지 전달</li>
                                            <li>보유 및 이용 기간: 회원 탈퇴 시까지</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-3">
                                        <p>1. SCI CENTER는 원활한 서비스 제공을 위해 최소한의 개인정보를 수집하고 있습니다.</p>
                                        <p>2. 귀하는 본 동의를 거부할 권리가 있으나, 거부 시 서비스 이용(회원가입)이 제한될 수 있습니다.</p>
                                        <p>3. 수집된 정보는 법령에 따라 보존해야 하는 경우를 제외하고 탈퇴 시 지체 없이 파기됩니다.</p>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4 whitespace-pre-wrap">
                                    <p className="font-bold text-gray-800">1. 홍보 콘텐츠의 제작 및 활용 목적</p>
                                    <p>SCI CENTER를 운영하는 (재)더작은재단은 비영리적 캠페인 및 홍보의 목적에 한하여 SCI CENTER 서비스(이하 ‘본건 서비스’)를 이용하는 이용자의 사진, 동영상, 작업물, 인터뷰, 음성을 이용한 콘텐츠 (이하 ‘홍보 콘텐츠’)를 제작하여 이를 홍보 목적으로 활용하고자 합니다. 본건 홍보 콘텐츠 제작에는 위 이용자들의 성명, 초상 등 개인정보의 수집 및 이용이 수반되는바, 이에 개인정보의 수집 및 이용에 관한 동의를 받고자 합니다.</p>

                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 italic">
                                        ※ (재)더작은재단이 수집한 개인정보 및 초상권은 사적인 이익이나 상업적 용도로 결코 사용되지 않으며, 청소년을 위한 공간 설립∙운영 및 (재)더작은재단의 비영리적 캠페인과 홍보 활동의 목적으로만 사용됩니다.
                                    </div>

                                    <p className="font-bold text-gray-800">2. 홍보 콘텐츠 및 개인정보의 사용 및 관리</p>
                                    <p>(재)더작은재단의 비영리적 캠페인 및 홍보 활동에만 사용됩니다. 홍보 콘텐츠 및 개인 정보는 귀하의 동의 철회 시 또는 비영리적 캠페인의 목적 달성으로 불필요하게 되었을 때 지체 없이 파기합니다. 단, 이미 제작된 온라인/오프라인 인쇄∙출판 제작물 및 보도된 언론자료는 수정이나 삭제가 불가능할 수 있습니다.</p>

                                    <p className="font-bold text-gray-800">3. 홍보 콘텐츠 및 개인정보의 이용 범위</p>
                                    <p>(재)더작은재단이 발행하는 모든 홍보물, 홈페이지 및 뉴스레터의 비영리적 목적의 게시물, (재)더작은재단이 비영리적 목적으로 계정을 개설한 디지털매체(이메일 뉴스레터, 페이스북, 인스타그램, 유튜브, 블로그 등)의 보도, 공개, 게시, 배포, 전달, 홍보 등 비영리 목적의 이용</p>

                                    <p className="font-bold text-gray-800">4. 정보열람, 정정·삭제, 처리정지 등의 권리</p>
                                    <p>개인정보보호법에 따라 귀하는 홍보 콘텐츠 및 개인정보의 열람, 정정·삭제, 처리정지 등을 요청할 수 있으며 (재)더작은재단은 귀하로부터 그런 요청을 받은 경우 개인정보보호법이 정한 예외사유에 해당되지 않는 한 이를 열람, 정정·삭제, 처리정지 할 의무가 있습니다.</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowConsentModal(false)}
                            className="mt-6 w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

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
                .eq('name', name)
                .eq('password', password);

            // 2. Fallback: If no user found, check 'phone_back4' (Legacy Logic)
            // This handles cases where SQL update might have failed or for old accounts causing issues
            if (!error && (!users || users.length === 0)) {
                // Only try this if input is exactly 4 digits (typical for phone_back4)
                if (password.length === 4 && /^\d+$/.test(password)) {
                    const { data: legacyUsers, error: legacyError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('name', name)
                        .eq('phone_back4', password);

                    if (!legacyError && legacyUsers && legacyUsers.length > 0) {
                        users = legacyUsers;
                        // Optional: Auto-migrate them by setting password = phone_back4? 
                        // Let's not auto-write to avoid side effects, but this allows them to login.
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

// -- Sign Up Form Component --
const SignUpForm = ({ setActiveTab, setShowConsentModal, setConsentType }) => {
    const [formData, setFormData] = useState({
        name: '',
        gender: 'M',
        school: '',
        birth: '',
        phone: '',
        user_group: '청소년',
        password: '',
        confirmPassword: ''
    });
    const [agreements, setAgreements] = useState({
        mandatory: false,
        optional: false
    });
    const [loading, setLoading] = useState(false);

    const checkAge = (birth) => {
        if (!birth || birth.length !== 6) return false;
        const yy = parseInt(birth.substring(0, 2));
        const mm = parseInt(birth.substring(2, 4)) - 1;
        const dd = parseInt(birth.substring(4, 6));

        const currentYear = new Date().getFullYear();
        const fullYear = yy <= (currentYear % 100) ? 2000 + yy : 1900 + yy;

        const birthDate = new Date(fullYear, mm, dd);
        const today = new Date();

        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 14;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        let formatted = val;
        if (val.length > 3 && val.length <= 7) {
            formatted = `${val.slice(0, 3)}-${val.slice(3)}`;
        } else if (val.length > 7) {
            formatted = `${val.slice(0, 3)}-${val.slice(3, 7)}-${val.slice(7)}`;
        }
        setFormData(prev => ({ ...prev, phone: formatted }));
    };

    const handleSignUp = async (e) => {
        e.preventDefault();

        // 1. Age Restriction Check
        if (!checkAge(formData.birth)) {
            alert('만 14세 미만은 보호자 동의가 필요하거나 가입이 제한됩니다. (현재 정책상 만 14세 이상만 가입 가능합니다)');
            return;
        }

        // 2. Mandatory Consent Check
        if (!agreements.mandatory) {
            alert('이용 약관 및 개인정보 수집에 동의해 주세요.');
            return;
        }

        if (formData.phone.length < 13) {
            alert('핸드폰 번호를 올바르게 입력해주세요.');
            return;
        }
        if (formData.password.length < 4) {
            alert('비밀번호는 4자리 이상이어야 합니다.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        try {
            // Check for duplicates
            const { data: existing, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('name', formData.name)
                .eq('phone', formData.phone);

            if (checkError) throw checkError;
            if (existing && existing.length > 0) {
                alert('이미 가입된 정보(이름 + 전화번호)입니다.');
                setLoading(false);
                return;
            }

            const phoneParts = formData.phone.split('-');
            const back4 = phoneParts[2];

            // Prepare memo including optional consent status
            const memoText = `[가입일: ${new Date().toLocaleDateString()}] ${agreements.optional ? '[홍보콘텐츠활용동의: O]' : '[홍보콘텐츠활용동의: X]'}`;

            const { error } = await supabase.from('users').insert([{
                name: formData.name,
                gender: formData.gender,
                school: formData.school,
                birth: formData.birth,
                phone: formData.phone,
                phone_back4: back4,
                user_group: formData.user_group,
                password: formData.password,
                role: 'user',
                memo: memoText
            }]);

            if (error) throw error;

            alert('가입이 완료되었습니다! 로그인해주세요.');
            setActiveTab('login');

        } catch (err) {
            console.error(err);
            alert('가입 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSignUp} className="space-y-4">
            {/* Name & Gender */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">이름</label>
                    <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="홍길동"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="w-1/3">
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">성별</label>
                    <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="M">남</option>
                        <option value="F">여</option>
                    </select>
                </div>
            </div>

            {/* Groups */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">소속</label>
                <div className="flex gap-2">
                    {['청소년', '졸업생', 'STAFF'].map(g => (
                        <button
                            key={g}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, user_group: g }))}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold border transition ${formData.user_group === g ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            {/* School */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">학교</label>
                <div className="relative">
                    <School className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="school"
                        required
                        value={formData.school}
                        onChange={handleChange}
                        placeholder="OO중학교 / OO고등학교"
                        className="w-full pl-10 pr-4 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Birth */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">생년월일 (6자리)</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="birth"
                        required
                        maxLength="6"
                        value={formData.birth}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth: e.target.value.replace(/[^0-9]/g, '') }))}
                        inputMode="numeric"
                        placeholder="YYMMDD"
                        className="w-full pl-10 pr-4 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest"
                    />
                </div>
            </div>

            {/* Phone */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">휴대폰 번호</label>
                <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        inputMode="tel"
                        placeholder="010-0000-0000"
                        className="w-full pl-10 pr-4 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest"
                    />
                </div>
            </div>

            {/* Password */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">비밀번호 (4자리 이상)</label>
                <div className="relative">
                    <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="password"
                        name="password"
                        required
                        minLength="4"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="비밀번호 설정"
                        className="w-full pl-10 pr-4 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">비밀번호 확인</label>
                <div className="relative">
                    <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="password"
                        name="confirmPassword"
                        required
                        minLength="4"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="비밀번호 재입력"
                        className={`w-full pl-10 pr-4 p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
                            }`}
                    />
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 ml-1 font-bold">비밀번호가 일치하지 않습니다.</p>
                )}
            </div>

            {/* Agreements */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-start gap-2">
                    <input
                        type="checkbox"
                        id="mandatory-agree"
                        checked={agreements.mandatory}
                        onChange={(e) => setAgreements(prev => ({ ...prev, mandatory: e.target.checked }))}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="mandatory-agree" className="text-sm text-gray-600 leading-snug cursor-pointer">
                        <span className="font-bold text-blue-600">[필수]</span> 본인은 만 14세 이상임을 확인하며, SCI CENTER 이용 약관 및 개인정보 수집에 동의합니다.
                    </label>
                </div>
                <button
                    type="button"
                    onClick={() => { setConsentType('mandatory'); setShowConsentModal(true); }}
                    className="text-xs text-blue-500 font-bold ml-6 underline"
                >
                    개인정보 수집 및 이용 자세히 보기
                </button>

                <hr className="border-gray-200 my-2" />

                <div className="flex items-start gap-2">
                    <input
                        type="checkbox"
                        id="optional-agree"
                        checked={agreements.optional}
                        onChange={(e) => setAgreements(prev => ({ ...prev, optional: e.target.checked }))}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="optional-agree" className="text-sm text-gray-600 leading-snug cursor-pointer">
                        <span className="font-bold text-gray-400">[선택]</span> 홍보 콘텐츠 제작 및 활용을 위한 개인정보 수집 및 이용 동의
                    </label>
                </div>
                <button
                    type="button"
                    onClick={() => { setConsentType('optional'); setShowConsentModal(true); }}
                    className="text-xs text-blue-500 font-bold ml-6 underline"
                >
                    선택 동의항목 자세히 보기
                </button>
            </div>

            <button
                type="submit"
                disabled={loading || !agreements.mandatory}
                className="w-full mt-4 bg-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all shadow-lg active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
            >
                {loading ? '가입 처리 중...' : '가입하기'}
            </button>
        </form>
    );
};

export default Landing;
