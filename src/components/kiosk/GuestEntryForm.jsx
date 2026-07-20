import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { User, Smartphone, School, Calendar, X } from 'lucide-react';
import { motion } from 'framer-motion';

const GuestEntryForm = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        school: '',
        birth: '',
        phone: ''
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);
        try {
            // Generate a unique dummy phone number to satisfy constraints
            let uniquePhone = '';
            let isUnique = false;
            let retries = 0;
            
            while (!isUnique && retries < 10) {
                const random8Digits = Math.floor(10000000 + Math.random() * 90000000).toString();
                const testPhone = `010-${random8Digits.slice(0, 4)}-${random8Digits.slice(4)}`;
                const { data: existing } = await supabase
                    .from('users')
                    .select('id')
                    .eq('phone', testPhone)
                    .maybeSingle();
                if (!existing) {
                    uniquePhone = testPhone;
                    isUnique = true;
                }
                retries++;
            }

            if (!uniquePhone) {
                throw new Error("임시 전화번호 생성 실패. 다시 시도해 주세요.");
            }

            const phoneParts = uniquePhone.split('-');
            const back4 = phoneParts[2];
            const memoText = `[가입일: ${new Date().toLocaleDateString()}] [게스트 입장 완료]`;

            // Append (guest) to name and set user_group
            const { data: newUser, error } = await supabase.from('users').insert([{
                name: `${formData.name.trim()}(guest)`,
                gender: 'M', // default filler
                school: formData.school.trim(),
                birth: '000000',
                phone: uniquePhone,
                phone_back4: back4,
                user_group: '게스트',
                password: '0000', // default filler
                role: 'student',
                status: 'approved',
                memo: memoText
            }]).select().single();

            if (error) throw error;

            // Trigger the kiosk action immediately with the new user object
            if (onSuccess) onSuccess(newUser);

        } catch (err) {
            console.error('Guest Entry Error:', err);
            alert(`입장 처리 중 오류가 발생했습니다.\n${err.message || '다시 시도해 주세요.'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
                <label className="block text-xs font-black text-slate-400 mb-1 ml-1 uppercase">이름</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="이름을 입력하세요"
                        className="w-full pl-10 pr-4 py-3 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none font-bold"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-black text-slate-400 mb-1 ml-1 uppercase">학교 / 소속</label>
                <div className="relative">
                    <School className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                        type="text"
                        name="school"
                        required
                        value={formData.school}
                        onChange={handleChange}
                        placeholder="소속 학교 입력 (예: OO고)"
                        className="w-full pl-10 pr-4 py-3 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none font-bold"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading || !formData.name.trim() || !formData.school.trim()}
                className="w-full mt-6 py-4 sm:py-5 bg-indigo-600 text-white rounded-2xl font-black transition-all shadow-lg active:scale-95 disabled:bg-slate-300 disabled:shadow-none hover:bg-indigo-700 text-lg sm:text-xl"
            >
                {loading ? '입장 처리 중...' : '게스트로 바로 입장하기'}
            </button>
        </form>
    );
};

export default GuestEntryForm;
