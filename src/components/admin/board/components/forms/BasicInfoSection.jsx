import React from 'react';
import PropTypes from 'prop-types';
import ModernEditor from '../../../../common/ModernEditor';
import TemplateManager from '../../../messages/TemplateManager';

const BasicInfoSection = ({ mode, title, content, onTitleChange, onContentChange }) => {
    return (
        <div className="space-y-4">
            <input 
                type="text" 
                placeholder="제목을 입력하세요" 
                className="w-full p-3 md:p-4 border border-gray-100 bg-gray-50 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-base md:text-lg font-bold transition" 
                value={title} 
                onChange={e => onTitleChange(e.target.value)} 
                required 
            />

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
    content: PropTypes.string.isRequired,
    onTitleChange: PropTypes.func.isRequired,
    onContentChange: PropTypes.func.isRequired
};

export default React.memo(BasicInfoSection);
