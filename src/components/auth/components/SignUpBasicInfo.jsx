import React from 'react';
import { User, Smartphone, School, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SignUpBasicInfo = ({ formData, setFormData, handleChange, handlePhoneChange, handleGuardianPhoneChange, isUnder14, isKiosk }) => {
    return (
        <div className="w-full">
            {/* Group 1: Profile & Contact Info */}
            <div className={`mt-2 border ${isKiosk ? 'border-slate-200 rounded-2xl bg-white' : 'border-gray-300 rounded-xl bg-white'} overflow-hidden focus-within:border-blue-500 transition-colors`}>
                
                {/* Row 1: Name and Gender */}
                <div className="flex border-b border-gray-200">
                    <div className="relative flex-1 border-r border-gray-200">
                        <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                        <input
                            type="text" name="name" required
                            value={formData.name} onChange={handleChange}
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
                                key={g.value} type="button"
                                onClick={() => setFormData(prev => ({ ...prev, gender: g.value }))}
                                className={`flex-1 py-3 text-sm font-bold transition ${formData.gender === g.value ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500 hover:bg-gray-50'} ${idx === 0 ? 'border-r border-gray-200' : ''} ${isKiosk ? 'sm:py-4 font-black' : ''}`}
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
                            key={g} type="button"
                            onClick={() => setFormData(prev => ({ ...prev, user_group: g }))}
                            className={`flex-1 py-3 text-sm font-bold transition ${formData.user_group === g ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500 hover:bg-gray-50'} ${idx === 0 ? 'border-r border-gray-200' : ''} ${isKiosk ? 'sm:py-4 font-black' : ''}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>

                {/* School */}
                <div className="relative border-b border-gray-200">
                    <School className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                    <input
                        type="text" name="school" required
                        value={formData.school} onChange={handleChange}
                        placeholder="학교 (00고등학교)"
                        className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                    />
                </div>

                {/* Birth Date */}
                <div className="relative border-b border-gray-200">
                    <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                    <input
                        type="tel" pattern="[0-9]*" name="birth" required maxLength="6"
                        value={formData.birth}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth: e.target.value.replace(/[^0-9]/g, '') }))}
                        inputMode="numeric" placeholder="생년월일 6자리 (YYMMDD)"
                        className={`w-full pl-12 pr-4 py-3 bg-transparent outline-none tracking-widest ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                    />
                </div>

                {/* Phone Number */}
                <div className="relative">
                    <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 ${isKiosk ? 'text-slate-300' : 'text-gray-400'}`} size={isKiosk ? 22 : 20} />
                    <input
                        type="tel" name="phone" required
                        value={formData.phone} onChange={handlePhoneChange}
                        inputMode="numeric" placeholder="휴대폰 번호 (010-0000-0000)"
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
                        className="overflow-hidden transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2 mt-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            <h4 className={`text-xs font-bold text-blue-600 uppercase tracking-widest ${isKiosk ? 'text-sm' : ''}`}>보호자 정보 (만 14세 미만 필수)</h4>
                        </div>

                        <div className={`border ${isKiosk ? 'border-blue-200 rounded-2xl bg-blue-50/30' : 'border-blue-200 rounded-xl bg-blue-50/50'} overflow-hidden focus-within:border-blue-500 transition-colors`}>
                            <div className="flex border-b border-blue-100">
                                <input
                                    type="text" name="guardianName" required
                                    value={formData.guardianName} onChange={handleChange}
                                    placeholder="보호자  이름"
                                    className={`w-1/2 px-4 py-3 bg-transparent border-r border-blue-100 outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                                />
                                <input
                                    type="text" name="guardianRelation" required
                                    value={formData.guardianRelation} onChange={handleChange}
                                    placeholder="보호자 관계 (부, 모 등)"
                                    className={`w-1/2 px-4 py-3 bg-transparent outline-none ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                                />
                            </div>
                            <div>
                                <input
                                    type="text" name="guardianPhone" required inputMode="tel"
                                    value={formData.guardianPhone} onChange={handleGuardianPhoneChange}
                                    placeholder="보호자 휴대폰 번호 (010-0000-0000)"
                                    className={`w-full px-4 py-3 bg-transparent outline-none tracking-widest ${isKiosk ? 'sm:py-4 font-bold' : ''}`}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SignUpBasicInfo;
