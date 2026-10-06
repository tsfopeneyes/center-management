import React from 'react';
import PropTypes from 'prop-types';
import ModernEditor from '../../../../common/ModernEditor';
import TemplateManager from '../../../messages/TemplateManager';

const BasicInfoSection = ({ mode, title, shortDescription, content, onTitleChange, onShortDescChange, onContentChange }) => {
    return (
        <div className="space-y-6">
            {mode === 'PROGRAM' && <div className="border-b border-slate-200 pb-4"><h2 className="text-lg font-black text-slate-900">프로그램 소개</h2><p className="mt-1 text-sm text-slate-600">학생에게 표시할 제목과 내용을 작성합니다.</p></div>}
            <div className="space-y-2">
                {mode === 'PROGRAM' && <label htmlFor="program-title" className="block text-sm font-semibold text-slate-700">제목 (필수)</label>}
                <input
                    id={mode === 'PROGRAM' ? 'program-title' : undefined}
                    type="text"
                    placeholder="제목을 입력하세요"
                    className="h-14 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 text-base font-bold outline-none transition focus:border-blue-500 focus:bg-white md:text-lg"
                    value={title}
                    onChange={e => onTitleChange(e.target.value)}
                    required
                />
            </div>

            {mode === 'PROGRAM' && (
                <div className="space-y-2">
                <label htmlFor="program-summary" className="block text-sm font-semibold text-slate-700">목록에 표시할 한 줄 소개 (선택)</label>
                <input id="program-summary"
                    type="text" 
                    placeholder="리스트에 보여질 한 줄 소개 멘트를 입력하세요 (선택 사항)" 
                    className="h-14 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white md:text-base"
                    value={shortDescription || ''} 
                    onChange={e => onShortDescChange(e.target.value)} 
                    maxLength={100}
                />
                </div>
            )}

            <TemplateManager
                type={mode}
                currentContent={content}
                onSelect={onContentChange}
                currentAdmin={JSON.parse(localStorage.getItem('admin_user'))}
            />

            <div className="min-h-[300px]">
                <ModernEditor
                    content={content}
                    onChange={onContentChange}
                    placeholder="내용을 입력하세요..."
                />
            </div>
        </div>
    );
};

BasicInfoSection.propTypes = {
    mode: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    shortDescription: PropTypes.string,
    content: PropTypes.string.isRequired,
    onTitleChange: PropTypes.func.isRequired,
    onShortDescChange: PropTypes.func,
    onContentChange: PropTypes.func.isRequired
};

export default React.memo(BasicInfoSection);
