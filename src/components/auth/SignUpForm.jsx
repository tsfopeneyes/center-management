import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { User, Smartphone, School, Calendar, CheckCircle, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SignUpForm = ({ onSuccess, onCancel, isKiosk = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        gender: 'M',
        school: '',
        birth: '',
        phone: '',
        user_group: '청소년',
        password: '',
        confirmPassword: '',
        guardianName: '',
        guardianPhone: '',
        guardianRelation: ''
    });
    const [agreements, setAgreements] = useState({
        art1: false,
        art2: false,
        art3: false,
        art4: false
    });
    const [loading, setLoading] = useState(false);

    // Consent Modal State
    const [showConsentModal, setShowConsentModal] = useState(false);

    const isUnder14 = (birth) => {
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
        return age < 14;
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

    const handleGuardianPhoneChange = (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        let formatted = val;
        if (val.length > 3 && val.length <= 7) {
            formatted = `${val.slice(0, 3)}-${val.slice(3)}`;
        } else if (val.length > 7) {
            formatted = `${val.slice(0, 3)}-${val.slice(3, 7)}-${val.slice(7)}`;
        }
        setFormData(prev => ({ ...prev, guardianPhone: formatted }));
    };

    const handleSignUp = async (e) => {
        e.preventDefault();

        const under14 = isUnder14(formData.birth);

        if (!agreements.art1 || !agreements.art2 || !agreements.art3 || !agreements.art4) {
            alert('모든 이용 약관 및 개인정보 수집에 동의해 주세요.');
            return;
        }

        if (formData.phone.replace(/[^0-9]/g, '').length < 11) {
            alert('핸드폰 번호 11자리를 올바르게 입력해주세요.');
            return;
        }

        if (under14) {
            if (!formData.guardianName || !formData.guardianPhone || !formData.guardianRelation) {
                alert('만 14세 미만은 보호자 정보를 모두 입력해야 합니다.');
                return;
            }
            if (formData.guardianPhone.replace(/[^0-9]/g, '').length < 11) {
                alert('보호자 핸드폰 번호 11자리를 올바르게 입력해주세요.');
                return;
            }
        }

        setLoading(true);
        try {
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
            const memoText = `[가입일: ${new Date().toLocaleDateString()}] [운영규정, 개인정보, 초상권 등 전체동의 완료]`;

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
                status: under14 ? 'pending' : 'approved',
                guardian_name: under14 ? formData.guardianName : null,
                guardian_phone: under14 ? formData.guardianPhone : null,
                guardian_relation: under14 ? formData.guardianRelation : null,
                memo: memoText
            }]);

            if (error) throw error;

            if (under14) {
                alert('만 14세 미만 회원은 임시 가입되었습니다. 관리자가 보호자 동의 확인 후 정식 회원으로 승인됩니다.');
            } else {
                alert('가입이 완료되었습니다! 로그인해 주세요.');
            }
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error(err);
            alert('가입 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSignUp} className="space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>이름</label>
                        <div className="relative">
                            <User className={`absolute left-3 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 20 : 18} />
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="홍길동"
                                className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                            />
                        </div>
                    </div>
                    <div className="w-1/3">
                        <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>성별</label>
                        <div className={`flex gap-1 ${isKiosk ? 'h-[50px] sm:h-[58px] gap-3' : 'h-[46px]'}`}>
                            {[
                                { label: isKiosk ? '남자' : '남', value: 'M' },
                                { label: isKiosk ? '여자' : '여', value: 'F' }
                            ].map(g => (
                                <button
                                    key={g.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, gender: g.value }))}
                                    className={`flex-1 rounded-xl text-sm font-bold border transition ${formData.gender === g.value
                                        ? (isKiosk ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-blue-600 text-white border-blue-600 shadow-sm')
                                        : (isKiosk ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100')
                                        } ${isKiosk ? 'sm:rounded-2xl font-black' : ''}`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>소속 구분</label>
                    <div className="flex gap-2">
                        {['청소년', '졸업생'].map(g => (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, user_group: g }))}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold border transition ${formData.user_group === g
                                    ? (isKiosk ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-blue-600 text-white border-blue-600 shadow-md')
                                    : (isKiosk ? 'bg-white text-slate-400 border-slate-100' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50')
                                    } ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-black' : ''}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>학교</label>
                    <div className="relative">
                        <School className={`absolute left-3 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 20 : 18} />
                        <input
                            type="text"
                            name="school"
                            required
                            value={formData.school}
                            onChange={handleChange}
                            placeholder="OO중학교 / OO고등학교"
                            className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                        />
                    </div>
                </div>

                <div className={isKiosk ? 'grid grid-cols-1 sm:grid-cols-2 gap-6' : ''}>
                    <div>
                        <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>생년월일 (6자리)</label>
                        <div className="relative text-start">
                            <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 20 : 18} />
                            <input
                                type="text"
                                name="birth"
                                required
                                maxLength="6"
                                value={formData.birth}
                                onChange={(e) => setFormData(prev => ({ ...prev, birth: e.target.value.replace(/[^0-9]/g, '') }))}
                                inputMode="numeric"
                                placeholder="YYMMDD"
                                className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                            />
                        </div>
                    </div>

                    {!isKiosk && (
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
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {isKiosk && (
                    <div>
                        <label className="block text-xs font-black text-slate-400 mb-2 ml-1 uppercase tracking-widest">휴대폰 번호</label>
                        <div className="relative">
                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                            <input
                                type="text"
                                name="phone"
                                required
                                inputMode="tel"
                                value={formData.phone}
                                onChange={handlePhoneChange}
                                placeholder="010-0000-0000"
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all font-bold tracking-widest"
                            />
                        </div>
                    </div>
                )}

                {/* Guardian Information for Under 14 */}
                <AnimatePresence>
                    {isUnder14(formData.birth) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`space-y-4 overflow-hidden ${isKiosk ? 'bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100/50' : 'bg-blue-50/30 p-4 rounded-2xl border border-blue-100/30'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <h4 className={`text-xs font-black text-blue-600 uppercase tracking-widest ${isKiosk ? 'text-sm' : ''}`}>보호자 정보 입력 (만 14세 미만 필수)</h4>
                            </div>

                            <div className={`grid grid-cols-1 ${isKiosk ? 'sm:grid-cols-2 gap-6' : 'gap-4'}`}>
                                <div>
                                    <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>보호자 이름</label>
                                    <input
                                        type="text"
                                        name="guardianName"
                                        required
                                        value={formData.guardianName}
                                        onChange={handleChange}
                                        placeholder="보호자 성함"
                                        className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>보호자 관계</label>
                                    <input
                                        type="text"
                                        name="guardianRelation"
                                        required
                                        value={formData.guardianRelation}
                                        onChange={handleChange}
                                        placeholder="부, 모, 조부, 조모 등"
                                        className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>보호자 휴대폰 번호</label>
                                <input
                                    type="text"
                                    name="guardianPhone"
                                    required
                                    inputMode="tel"
                                    value={formData.guardianPhone}
                                    onChange={handleGuardianPhoneChange}
                                    placeholder="010-0000-0000"
                                    className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={`grid grid-cols-1 ${isKiosk ? 'sm:grid-cols-2 gap-6' : 'gap-4'}`}>
                    <div>
                        <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>비밀번호 (4자리 이상)</label>
                        <div className="relative">
                            <AlertCircle className={`absolute left-3 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 20 : 18} />
                            <input
                                type="password"
                                name="password"
                                required
                                minLength="4"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={isKiosk ? "••••" : "비밀번호 설정"}
                                className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-xs font-bold ${isKiosk ? 'text-slate-400 font-black' : 'text-gray-500'} mb-1 ml-1 uppercase`}>비밀번호 확인</label>
                        <div className="relative">
                            <CheckCircle className={`absolute left-3 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 20 : 18} />
                            <input
                                type="password"
                                name="confirmPassword"
                                required
                                minLength="4"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder={isKiosk ? "••••" : "비밀번호 재입력"}
                                className={`w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'} ${isKiosk ? 'sm:py-4 sm:rounded-2xl font-bold' : ''}`}
                            />
                        </div>
                    </div>
                </div>

                <div className={`space-y-3 ${isKiosk ? 'bg-slate-50 p-6 rounded-[2rem] border border-slate-100' : 'bg-gray-50 p-4 rounded-2xl border border-gray-100'}`}>
                    <div className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            id="total-agree"
                            checked={agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4}
                            onChange={() => {
                                if (agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4) {
                                    setAgreements({ art1: false, art2: false, art3: false, art4: false });
                                } else {
                                    setShowConsentModal(true);
                                }
                            }}
                            className={`mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 ${isKiosk ? 'w-6 h-6 border-slate-200' : ''}`}
                        />
                        <label htmlFor="total-agree" className={`text-sm leading-snug cursor-pointer ${isKiosk ? 'text-slate-600 font-bold' : 'text-gray-600'}`}>
                            <span className="font-bold text-blue-600">[전체동의]</span> SCI CENTER 이용 약관 및 개인정보 수집에 동의합니다.
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowConsentModal(true)}
                        className={`text-xs text-blue-500 font-bold ml-6 underline ${isKiosk ? 'sm:text-sm font-black underline-offset-4' : ''}`}
                    >
                        개인정보 수집 및 이용 자세히 보기
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={
                        loading ||
                        !(agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4) ||
                        formData.birth.length < 6 ||
                        formData.phone.replace(/[^0-9]/g, '').length < 11
                    }
                    className={`w-full mt-4 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:bg-gray-300 disabled:shadow-none disabled:opacity-50 ${isKiosk ? 'bg-blue-600 text-white sm:py-6 sm:rounded-[2rem] sm:text-xl hover:bg-blue-700' : 'bg-gray-800 text-white hover:bg-gray-900'}`}
                >
                    {loading ? (isKiosk ? '가입 처리 중...' : '가입 처리 중...') : (isKiosk ? '회원가입 완료' : '가입하기')}
                </button>
            </form>

            {/* Shared Consent Modal */}
            <AnimatePresence>
                {showConsentModal && (
                    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className={`bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] flex flex-col ${isKiosk ? 'sm:p-10 sm:rounded-[3rem] max-w-3xl' : ''}`}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`text-xl font-black text-gray-800 tracking-tight ${isKiosk ? 'sm:text-3xl' : ''}`}>이용 약관 및 개인정보 수집 동의</h3>
                                <button onClick={() => setShowConsentModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* All Agree Button at Top */}
                            <button
                                type="button"
                                onClick={() => setAgreements({ art1: true, art2: true, art3: true, art4: true })}
                                className={`mb-6 w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                    } font-black text-lg`}
                            >
                                <CheckCircle size={22} />
                                [전체 동의] 모든 항목에 동의합니다
                            </button>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-sm text-gray-600 leading-relaxed space-y-8">
                                {/* Article 1 */}
                                <div className="space-y-4">
                                    <h4 className="text-lg font-black text-gray-900 border-l-4 border-blue-500 pl-3">제1조 회원 가입 약관</h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                        <p className="font-bold">제1장 총칙 및 이용 계약의 성립</p>
                                        <p>회원 가입 약관은 (재)더작은재단과 SCI CENTER 앱 이용자 간의 권리 의무 관계를 규정한다. 본 약관은 청소년들이 주체적으로 서비스를 이용할 수 있도록 명확하고 평이한 용어를 사용한다.</p>
                                        <table className="w-full text-xs border-collapse border border-gray-200 bg-white">
                                            <tbody>
                                                <tr className="border-b border-gray-200">
                                                    <th className="p-2 bg-gray-50 text-left w-20">목적</th>
                                                    <td className="p-2">SCI CENTER 앱 서비스의 이용 조건 및 절차 규정</td>
                                                </tr>
                                                <tr className="border-b border-gray-200">
                                                    <th className="p-2 bg-gray-50 text-left w-20">회원 상태</th>
                                                    <td className="p-2">정식회원(동의 완료), 임시회원(동의 대기)</td>
                                                </tr>
                                                <tr>
                                                    <th className="p-2 bg-gray-50 text-left w-20">가입 승낙</th>
                                                    <td className="p-2">실명확인 및 연령에 따른 적법한 동의 후 승낙 (만 14세 미만 보호자 동의 필수)</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <p>이용자는 가입 시 본인이 제공하는 정보가 정확함을 보증해야 하며, 특히 학교 동아리 활동 지원을 위해 소속 학교 정보를 정확히 기재해야 한다.</p>
                                        <p className="font-bold mt-4">제2장 만 14세 미만 이용자의 가입 특례</p>
                                        <p>1. 임시회원 등록: 법정대리인 동의가 확인되기 전까지는 '임시회원' 상태로 유지된다.</p>
                                        <p>2. 정식회원 전환: 법정대리인 동의서 제출 및 재단 최종 확인 시점부터 '정식회원'의 자격을 부여한다.</p>
                                        <p>3. 가입 무효: 일정 기간(30일) 내에 동의서가 제출되지 않을 경우 계정을 삭제할 수 있다.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAgreements(prev => ({ ...prev, art1: !prev.art1 }))}
                                        className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art1 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        {agreements.art1 ? '✓ 제1조 동의함' : '제1조 동의합니다'}
                                    </button>
                                </div>

                                {/* Article 2 */}
                                <div className="space-y-4">
                                    <h4 className="text-lg font-black text-gray-900 border-l-4 border-blue-500 pl-3">제2조 개인정보처리방침</h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                        <p className="font-bold">1. 개인정보 수집 목적 및 항목</p>
                                        <p>(재)더작은재단은 청소년 대상의 SCI 활동 지원을 위해 필요한 최소한의 정보(성명, 생년월일, 휴대전화번호, 학교 등)만을 수집한다. 수집된 정보는 이용자 식별, 동아리 물품 지원, 고충 처리 등을 위한 자료로 활용된다.</p>
                                        <p className="font-bold mt-4">2. 개인정보의 보유 및 파기 원칙</p>
                                        <p>재단은 수집된 개인정보를 회원 탈퇴 시까지 보유하며, 목적 달성 후에는 지체 없이 파기한다.</p>
                                        <ul className="list-disc ml-4 space-y-1">
                                            <li>정식회원 정보: 회원 탈퇴 시 즉시 파기</li>
                                            <li>임시회원 정보: 전환 실패 시 또는 일정 기간 경과 후 즉시 파기</li>
                                            <li>상담 이력: 상담 종료 후 서비스 개선을 위해 3년간 보관</li>
                                        </ul>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAgreements(prev => ({ ...prev, art2: !prev.art2 }))}
                                        className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art2 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        {agreements.art2 ? '✓ 제2조 동의함' : '제2조 동의합니다'}
                                    </button>
                                </div>

                                {/* Article 3 */}
                                <div className="space-y-4">
                                    <h4 className="text-lg font-black text-gray-900 border-l-4 border-blue-500 pl-3">제3조 개인정보 수집 및 이용 동의</h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                        <p>1. 수집 항목: 성명, 생년월일, 휴대전화번호, 소속 학교 및 학년.</p>
                                        <p>2. 이용 목적: 이용자 식별, 학교 동아리(SCI) 활동 지원 및 공지 전달.</p>
                                        <p>3. 보유 기간: 회원 탈퇴 시까지 (만 14세 미만은 정식회원 전환 시점부터).</p>
                                        <p className="text-xs text-gray-400 font-medium">※ 본 동의를 거부할 수 있으나, 거부 시 서비스 이용이 제한될 수 있습니다.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAgreements(prev => ({ ...prev, art3: !prev.art3 }))}
                                        className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art3 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        {agreements.art3 ? '✓ 제3조 동의함' : '제3조 동의합니다'}
                                    </button>
                                </div>

                                {/* Article 4 */}
                                <div className="space-y-4">
                                    <h4 className="text-lg font-black text-gray-900 border-l-4 border-blue-500 pl-3">제4조 초상권 및 저작물 이용 동의</h4>
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                        <p>(재)더작은재단은 청소년들이 활동을 통해 자신을 표현하는 과정을 기록하고 이를 공익적 목적으로 공유한다.</p>
                                        <p>1. 초상 및 저작물 범위: 활동 중 촬영된 사진·영상 내의 얼굴/음성 및 창작물(글, 그림 등).</p>
                                        <p>2. 이용 목적: 재단 활동 보고, 청소년 교육 사례 전파, SCI 서비스 홍보.</p>
                                        <p>3. 활용 매체: 재단 공식 홈페이지, SNS(유튜브, 인스타그램 등), 활동 보고서.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAgreements(prev => ({ ...prev, art4: !prev.art4 }))}
                                        className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art4 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        {agreements.art4 ? '✓ 제4조 동의함' : '제4조 동의합니다'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConsentModal(false)}
                                    className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4
                                        ? 'bg-blue-600 text-white shadow-xl hover:bg-blue-700'
                                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    동의 완료 및 창 닫기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SignUpForm;
