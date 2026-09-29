import React from 'react';
import PropTypes from 'prop-types';

export const PROGRAM_SETTINGS_SECTIONS = [
    { id: 'program-audience', label: '프로그램 구분' },
    { id: 'program-schedule', label: '일정과 모집' },
    { id: 'program-application', label: '신청 정보' },
    { id: 'program-operation', label: '진행 설정' },
    { id: 'program-followup', label: '종료 후' },
];

export const ProgramSettingsNavigation = () => (
    <nav aria-label="프로그램 설정 목차" className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-2 xl:flex-col xl:overflow-visible xl:border-b-0 xl:border-l xl:py-1 xl:pl-3">
            {PROGRAM_SETTINGS_SECTIONS.map(({ id, label }) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => document.getElementById(id)?.scrollIntoView({ block: 'start' })}
                    className="shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 xl:w-full"
                >
                    {label}
                </button>
            ))}
        </div>
    </nav>
);

export const ProgramSettingsGroup = ({ id, title, description, children }) => (
    <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0 scroll-mt-24 space-y-4">
        <div className="border-b border-slate-200 pb-3">
            <h3 id={`${id}-heading`} className="text-base font-black text-slate-800">{title}</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
        </div>
        <div className="space-y-5">{children}</div>
    </section>
);

ProgramSettingsGroup.propTypes = {
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

export default React.memo(ProgramSettingsNavigation);
