import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { User, Smartphone, School, Calendar, CheckCircle, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TermsConsentModal from './TermsConsentModal';
import { TERMS_VERSION } from '../../constants/appConstants';
import { hashPassword } from '../../utils/hashUtils';

const SignUpForm = ({ onSuccess, onCancel, isKiosk = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        school: '',
        birth: '',
        phone: '',
        user_group: '청소년',
        password: '',
        confirmPassword: '',
        guardianName: '',
        guardianPhone: '',
        guardianRelation: '',
        isSchoolChurch: true
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

        if (!formData.gender) {
            alert('성별을 선택해 주세요.');
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
            // 1. Check for valid phone number format again (Backend barrier)
            if (formData.phone.replace(/[^0-9]/g, '').length < 11) {
                alert('핸드폰 번호 형식이 올바르지 않습니다.');
                setLoading(false);
                return;
            }

            // 2. Check for duplicate phone number
            const { data: existing, error: checkError } = await supabase
                .from('users')
                .select('id, name, school, user_group, preferences')
                .eq('phone', formData.phone)
                .maybeSingle();

            if (checkError) throw checkError;

            let targetUserId = null;
            let isAutoMerge = false;

            if (existing) {
                const isTemporary = existing.user_group === '게스트' || existing.preferences?.is_temporary === true;
                const isMatch = existing.name.includes(formData.name) && existing.school === formData.school;

                if (isTemporary && isMatch) {
                    // Auto-merge possible: use existing record
                    targetUserId = existing.id;
                    isAutoMerge = true;
                } else {
                    alert(`이미 가입된 휴대폰 번호입니다.\n(${existing.name}님으로 가입되어 있습니다.)\n로그인 혹은 관리자에게 문의해주세요.`);
                    setLoading(false);
                    return;
                }
            }

            const phoneParts = formData.phone.split('-');
            const back4 = phoneParts[2];

            // Hash the password
            const hashedPassword = await hashPassword(formData.password);

            const userData = {
                name: formData.name,
                gender: formData.gender,
                school: formData.school,
                birth: formData.birth,
                phone: formData.phone,
                phone_back4: back4,
                user_group: formData.user_group,
                password: hashedPassword,
                role: 'user',
                status: under14 ? 'pending' : 'approved',
                guardian_name: under14 ? formData.guardianName : null,
                guardian_phone: under14 ? formData.guardianPhone : null,
                guardian_relation: under14 ? formData.guardianRelation : null,
                memo: isAutoMerge ? (existing.memo ? `${existing.memo}\n[자동병합: ${new Date().toLocaleDateString()}]` : `[자동병합: ${new Date().toLocaleDateString()}]`) : null,
                preferences: {
                    terms_agreed: true,
                    terms_version: TERMS_VERSION,
                    is_school_church: formData.isSchoolChurch
                }
            };

            if (isAutoMerge) {
                // UPDATE existing temporary/guest record
                const { error: updateError } = await supabase
                    .from('users')
                    .update(userData)
                    .eq('id', targetUserId);
                if (updateError) throw updateError;
            } else {
                // INSERT new record
                const { error: insertError } = await supabase
                    .from('users')
                    .insert([userData]);
                if (insertError) throw insertError;
            }

            if (under14) {
                alert('만 14세 미만 회원은 임시 가입되었습니다. 관리자가 보호자 동의 확인 후 정식 회원으로 승인됩니다.');
            } else {
                alert('가입이 완료되었습니다! 로그인해 주세요.');
            }
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error('Sign Up Error Details:', err);
            alert(`가입 중 오류가 발생했습니다.\n내용: ${err.message || err.error_description || JSON.stringify(err)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSignUp} className="space-y-4">
                {/* Group 1: Profile & Contact Info */}
                <div className={`mt-2 border ${isKiosk ? 'border-slate-200 rounded-2xl bg-white' : 'border-gray-300 rounded-xl bg-white'} overflow-hidden focus-within:border-blue-500 transition-colors`}>

                    {/* Row 1: Name and Gender */}
                    <div className="flex border-b border-gray-200">
                        <div className="relative flex-1 border-r border-gray-200">
                            <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="이름"
                                className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                            />
                        </div>
                        <div className="flex w-1/3 sm:w-1/4">
                            {[
                                { label: isKiosk ? '남자' : '남', value: 'M' },
                                { label: isKiosk ? '여자' : '여', value: 'F' }
                            ].map((g, idx) => (
                                <button
                                    key={g.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, gender: g.value }))}
                                    className={`flex-1 py-3 text-sm font-bold transition ${formData.gender === g.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-transparent text-gray-500 hover:bg-gray-50'
                                        } ${idx === 0 ? 'border-r border-gray-200' : ''} ${isKiosk ? 'sm:py-4 font-black' : ''}`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Row 2: User Group */}
                    <div className="flex border-b border-gray-200">
                        {['청소년', '졸업생'].map((g, idx) => (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, user_group: g }))}
                                className={`flex-1 py-3 text-sm font-bold transition ${formData.user_group === g
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-transparent text-gray-500 hover:bg-gray-50'
                                    } ${idx === 0 ? 'border-r border-gray-200' : ''} ${isKiosk ? 'sm:py-4 font-black' : ''}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>

                    {/* School */}
                    <div className="relative border-b border-gray-200">
                        <School className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                        <input
                            type="text"
                            name="school"
                            required
                            value={formData.school}
                            onChange={handleChange}
                            placeholder="학교 (00고등학교)"
                            className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                        />
                    </div>

                    {/* Birth Date */}
                    <div className={`relative ${isKiosk ? 'border-b border-gray-200' : 'border-b border-gray-200'}`}>
                        <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                        <input
                            type="tel"
                            pattern="[0-9]*"
                            name="birth"
                            required
                            maxLength="6"
                            value={formData.birth}
                            onChange={(e) => setFormData(prev => ({ ...prev, birth: e.target.value.replace(/[^0-9]/g, '') }))}
                            inputMode="numeric"
                            placeholder="생년월일 6자리 (YYMMDD)"
                            className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none tracking-widest ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                        />
                    </div>

                    {/* Phone Number */}
                    <div className="relative">
                        <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                        <input
                            type="tel"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            inputMode="numeric"
                            placeholder="휴대폰 번호 (010-0000-0000)"
                            className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none tracking-widest ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                        />
                    </div>
                </div>



                {/* Guardian Information for Under 14 */}
                <AnimatePresence>
                    {isUnder14(formData.birth) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`overflow-hidden transition-all`}
                        >
                            <div className="flex items-center gap-2 mb-2 mt-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <h4 className={`text-xs font-bold text-blue-600 uppercase tracking-widest ${isKiosk ? 'text-sm' : ''}`}>보호자 정보 (만 14세 미만 필수)</h4>
                            </div>

                            <div className={`border ${isKiosk ? 'border-blue-200 rounded-2xl bg-blue-50/30' : 'border-blue-200 rounded-xl bg-blue-50/50'} overflow-hidden focus-within:border-blue-500 transition-colors`}>
                                <div className="flex border-b border-blue-100">
                                    <input
                                        type="text"
                                        name="guardianName"
                                        required
                                        value={formData.guardianName}
                                        onChange={handleChange}
                                        placeholder="보호자 이름"
                                        className={`w-1/2 px-4 py-3 bg-transparent border-r border-blue-100 outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                                    />
                                    <input
                                        type="text"
                                        name="guardianRelation"
                                        required
                                        value={formData.guardianRelation}
                                        onChange={handleChange}
                                        placeholder="보호자 관계 (부, 모 등)"
                                        className={`w-1/2 px-4 py-3 bg-transparent outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="guardianPhone"
                                        required
                                        inputMode="tel"
                                        value={formData.guardianPhone}
                                        onChange={handleGuardianPhoneChange}
                                        placeholder="보호자 휴대폰 번호 (010-0000-0000)"
                                        className={`w-full px-4 py-3 bg-transparent outline-none tracking-widest ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Group 2: Password */}
                <div className={`border ${isKiosk ? 'border-slate-200 rounded-2xl bg-white' : 'border-gray-300 rounded-xl bg-white'} overflow-hidden focus-within:border-blue-500 transition-colors`}>
                    <div className="relative border-b border-gray-200">
                        <AlertCircle className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                        <input
                            type="password"
                            name="password"
                            required
                            minLength="4"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="비밀번호 설정 (4자리 이상)"
                            className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                        />
                    </div>
                    <div className="relative">
                        <CheckCircle className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                        <input
                            type="password"
                            name="confirmPassword"
                            required
                            minLength="4"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="비밀번호 재입력"
                            className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'bg-red-50 text-red-600' : ''} ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                        />
                    </div>
                </div>

                {/* Group 3: School Church Preference */}
                <div className={`border ${isKiosk ? 'border-blue-200 rounded-2xl bg-blue-50/10' : 'border-blue-200 rounded-xl bg-blue-50/30'} flex justify-between items-center p-4 transition-colors`}>
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold ${isKiosk ? 'text-slate-600' : 'text-gray-700'}`}>학교에서 스쿨처치를 하고 있나요?</span>
                        <span className="text-xs text-gray-500 mt-1">참여하고 계신다면 체크해 주세요.</span>
                    </div>
                    <div className="flex bg-white rounded-lg border border-blue-100 overflow-hidden shadow-sm">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, isSchoolChurch: true }))}
                            className={`px-4 py-2 text-sm font-bold transition-colors ${formData.isSchoolChurch ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            네
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, isSchoolChurch: false }))}
                            className={`px-4 py-2 text-sm font-bold transition-colors border-l border-blue-100 ${!formData.isSchoolChurch ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            아니요
                        </button>
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
            <TermsConsentModal
                isOpen={showConsentModal}
                onClose={() => setShowConsentModal(false)}
                onAgree={(agreedStates) => {
                    setAgreements(agreedStates);
                    setShowConsentModal(false);
                }}
                isKiosk={isKiosk}
            />
        </div>
    );
};

export default SignUpForm;
