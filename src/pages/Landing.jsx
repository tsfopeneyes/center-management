import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, Smartphone, School, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

const Landing = () => {
    const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
    const navigate = useNavigate();

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
                    {activeTab === 'login' ? <LoginForm navigate={navigate} /> : <SignUpForm setActiveTab={setActiveTab} />}
                </div>
            </div>
            <p className="mt-8 text-gray-400 text-sm footer-text">© 2024 SCI CENTER</p>
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
const SignUpForm = ({ setActiveTab }) => {
    const [formData, setFormData] = useState({
        name: '',
        gender: 'M',
        school: '',
        birth: '',
        phone: '',

        user_group: '청소년', // Default
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);

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
        if (formData.phone.length < 13) {
            alert('핸드폰 번호를 올바르게 입력해주세요.');
            return;
        }
        if (formData.password.length < 4) {
            alert('비밀번호는 4자리 이상이어야 합니다.');
            alert('비밀번호는 4자리 이상이어야 합니다.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        try {
            // 1. Check for duplicates (Name + Phone)
            const { data: existing, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('name', formData.name)
                .eq('phone', formData.phone);

            if (checkError) throw checkError;
            if (existing && existing.length > 0) {
                alert('이미 가입된 정보(이름 + 전화번호)입니다.');
                return;
            }

            // Extract back 4 digits for legacy support / reference
            const phoneParts = formData.phone.split('-');
            const back4 = phoneParts[2];

            const { error } = await supabase.from('users').insert([{
                name: formData.name,
                gender: formData.gender,
                school: formData.school,
                birth: formData.birth,
                phone: formData.phone,
                phone_back4: back4,
                user_group: formData.user_group,
                password: formData.password, // Save custom password
                role: 'user'
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
                        placeholder="010-0000-0000"
                        className="w-full pl-10 pr-4 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest"
                    />
                </div>
            </div>

            {/* Password - NEW */}
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
            <div>
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
                        placeholder="비밀번호 재입력" // Updated placeholder
                        className={`w-full pl-10 pr-4 p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
                            }`}
                    />
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 ml-1 font-bold">비밀번호가 일치하지 않습니다.</p>
                )}
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all shadow-lg active:scale-95 disabled:bg-gray-400"
            >
                {loading ? '가입 처리 중...' : '가입하기'}
            </button>
        </form>
    );
};

export default Landing;
