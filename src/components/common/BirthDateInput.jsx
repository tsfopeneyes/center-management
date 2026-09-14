import React from 'react';
import { parseGuestBirthDate } from '../../utils/guestBirthUtils';

// Keep a date-only string, including partial input, so editing never loses digits.
export default function BirthDateInput({ label = '생년월일', value = '', onChange, required = false, disabled = false }) {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    const invalid = digits.length === 8 && !parseGuestBirthDate(value);
    return <div>
        <input type="text" inputMode="numeric" autoComplete="bday" aria-label={label}
            placeholder="예: 20080315 (8자리)" value={digits} required={required} disabled={disabled}
            pattern="[0-9]{8}" maxLength={8} aria-invalid={invalid}
            onChange={event => {
                const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                onChange(next.length > 6 ? next.slice(0, 4) + '-' + next.slice(4, 6) + '-' + next.slice(6)
                    : next.length > 4 ? next.slice(0, 4) + '-' + next.slice(4) : next);
            }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-500" />
        <p className={invalid ? 'mt-1 text-xs text-red-600' : 'mt-1 text-xs text-slate-500'}>
            {invalid ? '실제 생년월일을 확인해주세요. 미래 날짜는 입력할 수 없어요.' : '태어난 연도 4자리, 월 2자리, 일 2자리를 입력해주세요.'}
        </p>
    </div>;
}
