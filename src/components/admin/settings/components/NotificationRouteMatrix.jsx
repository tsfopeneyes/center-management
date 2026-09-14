import React from 'react';

const ROUTE_CATEGORIES = [
    ['visit', '입·출입'],
    ['program', '프로그램'],
    ['coffee_chat', '커피챗'],
    ['rental', '대관'],
];

const ROUTE_CENTERS = [
    ['HAIFN', '하이픈'],
    ['ENOUGH_PLACE', '이높플레이스'],
];

const RouteSwitch = ({ enabled, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={enabled}
        onClick={onChange}
        className={`relative h-8 w-14 min-w-14 shrink-0 overflow-hidden rounded-full transition-colors ${enabled ? 'bg-[#3182F6]' : 'bg-[#D1D6DB]'}`}
    >
        <span
            className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200"
            style={{ left: enabled ? '28px' : '4px' }}
        />
    </button>
);

const NotificationRouteMatrix = ({ value, onChange }) => {
    const toggleRoute = (centerCode, channel, category) => {
        onChange(current => ({
            ...current,
            [centerCode]: {
                ...current[centerCode],
                [channel]: {
                    ...current[centerCode][channel],
                    [category]: !current[centerCode][channel][category],
                },
            },
        }));
    };

    return (
        <div className="space-y-3 rounded-2xl border border-[#E5E8EB] bg-white p-4">
            <div>
                <p className="text-sm font-extrabold text-[#191F28]">지점별 알림 경로</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#6B7684]">모든 신청과 방문 알림은 중앙 서버가 원본 기록의 지점을 확인한 뒤 아래 경로로만 전송합니다.</p>
            </div>
            {ROUTE_CENTERS.map(([centerCode, centerLabel]) => (
                <div key={centerCode} className="overflow-hidden rounded-xl border border-[#E5E8EB]">
                    <div className="bg-[#F2F4F6] px-4 py-2.5 text-sm font-extrabold text-[#333D4B]">{centerLabel}</div>
                    <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2 border-t border-[#E5E8EB] px-4 py-2 text-[11px] font-bold text-[#8B95A1]">
                        <span>알림 항목</span><span className="text-center">LINE</span><span className="text-center">Slack</span>
                    </div>
                    {ROUTE_CATEGORIES.map(([category, label]) => (
                        <div key={category} className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2 border-t border-[#E5E8EB] px-4 py-2.5">
                            <span className="text-xs font-bold text-[#4E5968]">{label}</span>
                            {['line', 'slack'].map(channel => (
                                <div key={channel} className="flex justify-center">
                                    <RouteSwitch
                                        enabled={Boolean(value?.[centerCode]?.[channel]?.[category])}
                                        onChange={() => toggleRoute(centerCode, channel, category)}
                                        label={`${centerLabel} ${channel === 'line' ? 'LINE' : 'Slack'} ${label} 알림`}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default NotificationRouteMatrix;
