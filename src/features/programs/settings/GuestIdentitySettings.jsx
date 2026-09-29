import React from 'react';
import { Calendar, CheckSquare, School, Smartphone, User } from 'lucide-react';

const REQUIRED_DETAILS = [
    { icon: User, label: '이름' },
    { icon: School, label: '학교 / 소속' },
    { icon: Smartphone, label: '연락처' },
    { icon: Calendar, label: '생년월일' },
    { icon: CheckSquare, label: '개인정보 동의' },
];

function GuestIdentitySettings({ formData, updateField }) {
    if (!formData.is_recruiting) return null;
    const isAllowed = formData.guest_properties?.allow_guest !== false;
    const changeAllowed = event => updateField('guest_properties', {
        ...(formData.guest_properties || {}),
        allow_guest: event.target.checked,
        require_school: true,
        require_phone: true,
    });

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <label className="flex items-start justify-between gap-4">
                <span>
                    <span className="block text-sm font-bold text-slate-800">비회원 신청 허용</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                        로그인 없이 신청할 수 있습니다. 추가 질문은 아래에서 대상별로 설정합니다.
                    </span>
                </span>
                <input type="checkbox" role="switch" aria-label="비회원 신청 허용"
                    checked={isAllowed} onChange={changeAllowed}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" />
            </label>
            {isAllowed && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-bold text-slate-700">비회원 기본 수집 정보 (필수)</p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                        {REQUIRED_DETAILS.map(({ icon: Icon, label }) => (
                            <li key={label} className="flex items-center gap-1.5 text-xs text-slate-700">
                                <Icon size={14} aria-hidden="true" />{label}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-600">중복 신청 방지와 신청 기록 연결에 필요한 정보입니다.</p>
                </div>
            )}
        </div>
    );
}

export default React.memo(GuestIdentitySettings);
