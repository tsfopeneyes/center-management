import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

export const PROGRAM_SETTINGS_SECTIONS = [
    { id: 'program-audience', label: '유형과 대상' },
    { id: 'program-schedule', label: '일정과 모집' },
    { id: 'program-application', label: '신청 양식' },
    { id: 'program-operation', label: '운영 옵션' },
    { id: 'program-followup', label: '종료 후 옵션' },
];

export const ProgramSettingsNavigation = () => (
    <nav aria-label="프로그램 설정 목차" className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-2 xl:flex-col xl:overflow-visible xl:border-b-0 xl:border-l xl:py-1 xl:pl-3">
            {PROGRAM_SETTINGS_SECTIONS.map(({ id, label }) => (
                <button
                    key={id}
                    type="button"
                    onClick={() => {
                        const section = document.getElementById(id);
                        if (section?.tagName === 'DETAILS') section.open = true;
                        section?.scrollIntoView({ block: 'start' });
                    }}
                    className="shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 xl:w-full"
                >
                    {label}
                </button>
            ))}
        </div>
    </nav>
);

export const ProgramSettingsGroup = ({ id, title, description, children, optional = false, active = false }) => {
    const detailsRef = useRef(null);
    useEffect(() => {
        if (active && detailsRef.current) detailsRef.current.open = true;
    }, [active]);

    if (optional) return (
        <details id={id} ref={detailsRef} aria-labelledby={`${id}-heading`}
            className="group min-w-0 scroll-mt-24 rounded-2xl border border-slate-200 bg-slate-50/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5">
                <span className="min-w-0">
                    <span id={`${id}-heading`} className="block text-sm font-bold text-slate-800">{title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
                </span>
                <ChevronDown size={18} aria-hidden="true"
                    className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-5 border-t border-slate-200 bg-white px-4 py-5 sm:px-5">
                {children}
            </div>
        </details>
    );

    return (
        <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0 scroll-mt-24 space-y-4">
            <div className="border-b border-slate-200 pb-3">
                <h3 id={`${id}-heading`} className="text-base font-black text-slate-800">{title}</h3>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
            </div>
            <div className="space-y-5">{children}</div>
        </section>
    );
};

ProgramSettingsGroup.propTypes = {
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    optional: PropTypes.bool,
    active: PropTypes.bool,
};

export default React.memo(ProgramSettingsNavigation);
