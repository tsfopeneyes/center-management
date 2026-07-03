import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle, FileText, ChevronUp, ChevronDown, Loader2, Save } from 'lucide-react';
import { templatesApi } from '../../../api/templatesApi';

/**
 * TemplateManager Component
 * @param {string} type - 'PROGRAM', 'NOTICE', 'GALLERY', 'MINISTRY_LOG'
 * @param {string} currentContent - The text/HTML to save as a template
 * @param {function} onSelect - Callback when a template is selected (receives content)
 * @param {object} currentAdmin - The logged-in admin object
 */
const TemplateManager = ({ type, currentContent, onSelect, currentAdmin }) => {
    const [templates, setTemplates] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isOpen && currentAdmin?.id) {
            fetchTemplates();
        }
    }, [isOpen, currentAdmin]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await templatesApi.getByType(currentAdmin.id, type);
            setTemplates(data);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!newTemplateName || !currentContent || !currentAdmin?.id) return;

        setSaving(true);
        try {
            await templatesApi.create({
                user_id: currentAdmin.id,
                type: type,
                name: newTemplateName,
                content: currentContent
            });
            setNewTemplateName('');
            setSuccessMessage('저장됨!');
            setTimeout(() => setSuccessMessage(''), 2000);
            fetchTemplates();
        } catch (err) {
            alert('템플릿 저장 실패: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm('템플릿을 삭제하시겠습니까?')) return;

        try {
            await templatesApi.delete(id);
            fetchTemplates();
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    };

    return (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-blue-500" />
                    <span className="text-sm font-bold text-gray-700">컨텐츠 템플릿 {templates.length > 0 && `(${templates.length})`}</span>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {isOpen && (
                <div className="p-4 border-t border-gray-100 space-y-4 animate-fade-in">
                    {/* Add New Template Section */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="현재 내용을 템플릿으로 저장..."
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSave(e);
                                }
                            }}
                            className="flex-1 min-w-0 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs outline-none focus:border-blue-500 font-bold shadow-inner"
                        />
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !newTemplateName || !currentContent}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${saving ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-95'
                                }`}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {successMessage || '저장'}
                        </button>
                    </div>

                    {/* Template List Section */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-6 text-gray-300">
                                <Loader2 size={24} className="animate-spin" />
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                저장된 템플릿이 없습니다.
                            </div>
                        ) : (
                            templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="flex items-center justify-between p-3 bg-white border border-gray-50 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all group cursor-pointer"
                                    onClick={() => {
                                        if (confirm(`'${template.name}' 템플릿을 불러오시겠습니까?\n현재 작성 중인 내용은 템플릿 내용으로 대체됩니다.`)) {
                                            onSelect(template.content);
                                            setIsOpen(false);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-black text-gray-800 truncate">{template.name}</span>
                                        <span className="text-[9px] text-gray-300 font-bold uppercase">{new Date(template.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(e, template.id)}
                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateManager;
