import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

export const ProgramSettingsGroup = ({ id, title, description, children, optional = false, active = false }) => {
    const detailsRef = useRef(null);
    useEffect(() => {
        if (active && detailsRef.current) detailsRef.current.open = true;
    }, [active]);

    if (optional) return (
        <details id={id} ref={detailsRef} aria-labelledby={`${id}-heading`}
            className={`group min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border bg-white ${active ? 'border-blue-200' : 'border-slate-200'}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-slate-50/70 px-4 py-4 marker:hidden hover:bg-slate-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:px-5">
                <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                        <span id={`${id}-heading`} className="text-sm font-bold text-slate-800">{title}</span>
                        {active && <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">설정 중</span>}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">{description}</span>
                </span>
                <ChevronDown size={18} aria-hidden="true"
                    className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-5 border-t border-slate-200 px-4 py-5 sm:px-5">
                {children}
            </div>
        </details>
    );

    return (
        <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0 scroll-mt-24 space-y-5 border-t border-slate-200 pt-7">
            <div className="border-l-[3px] border-blue-600 pl-4">
                <h3 id={`${id}-heading`} className="text-base font-black text-slate-800">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
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
