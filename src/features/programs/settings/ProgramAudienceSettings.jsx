import React from 'react';
import PropTypes from 'prop-types';
import { PROGRAM_TYPES } from '../../../components/admin/board/utils/constants';

const ProgramAudienceSettings = ({ formData, updateField, flat = false }) => (
    <>
        <div className={flat
            ? "flex flex-col gap-4 bg-slate-100/50 rounded-2xl border border-slate-200/80 p-4"
            : "flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100/50 rounded-2xl border border-slate-200/80 p-4"
        }>
            {/* Left: Program Type Segmented Control */}
            <div className={flat
                ? "flex w-full bg-slate-200/80 p-1 rounded-xl"
                : "flex items-center bg-slate-200/80 p-1 rounded-xl self-start"
            }>
                <button
                    type="button"
                    onClick={() => updateField('program_type', PROGRAM_TYPES.CENTER)}
                    className={flat
                        ? `flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                            (!formData.program_type || formData.program_type === PROGRAM_TYPES.CENTER)
                                ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                : 'text-slate-600 hover:text-slate-900'
                          }`
                        : `px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                            (!formData.program_type || formData.program_type === PROGRAM_TYPES.CENTER)
                                ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                : 'text-slate-600 hover:text-slate-900'
                          }`
                    }
                >
                    센터 프로그램
                </button>
                <button
                    type="button"
                    onClick={() => updateField('program_type', PROGRAM_TYPES.SCHOOL_CHURCH)}
                    className={flat
                        ? `flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                            formData.program_type === PROGRAM_TYPES.SCHOOL_CHURCH
                                ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                : 'text-slate-600 hover:text-slate-900'
                          }`
                        : `px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                            formData.program_type === PROGRAM_TYPES.SCHOOL_CHURCH
                                ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                                : 'text-slate-600 hover:text-slate-900'
                          }`
                    }
                >
                    스처 프로그램
                </button>
            </div>

            {/* Right: Target Region and Leader only Chips */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-bold mr-1">대상 지역</span>
                    {['강동', '강서'].map(region => {
                        const isSelected = formData.target_regions?.includes(region);
                        return (
                            <button
                                type="button"
                                key={region}
                                onClick={() => {
                                    const current = formData.target_regions || [];
                                    const nextRegions = isSelected
                                        ? current.filter(r => r !== region)
                                        : [...current, region];
                                    updateField('target_regions', nextRegions);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                                    isSelected
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {region}
                            </button>
                        );
                    })}
                </div>

                <div className="w-px h-4 bg-slate-300 mx-1" />

                <button
                    type="button"
                    onClick={() => updateField('is_leader_only', !formData.is_leader_only)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                        formData.is_leader_only
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-100'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    리더 전용
                </button>
            </div>
        </div>
    </>
);

ProgramAudienceSettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
    flat: PropTypes.bool
};

export default React.memo(ProgramAudienceSettings);
