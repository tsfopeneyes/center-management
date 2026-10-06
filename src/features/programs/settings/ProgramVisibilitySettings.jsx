import React from 'react';
import PropTypes from 'prop-types';

const ProgramVisibilitySettings = ({ formData, updateField }) => (
    <div className="border-t border-slate-200 pt-5">
        <h4 className="text-sm font-bold text-slate-800">공개 범위</h4>
        <p className="mt-1 text-sm text-slate-600">프로그램이 일반 목록에 표시될지 정합니다.</p>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <input type="checkbox" checked={formData.is_private === true}
                onChange={event => updateField('is_private', event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600" />
            <span>
                <span className="block text-sm font-semibold text-slate-800">목록에 공개하지 않기</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">일반 프로그램 목록과 자동 모집 알림 대상에서 제외됩니다.</span>
            </span>
        </label>
    </div>
);

ProgramVisibilitySettings.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired,
};

export default ProgramVisibilitySettings;
