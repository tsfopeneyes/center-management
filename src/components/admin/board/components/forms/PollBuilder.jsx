import React from 'react';
import PropTypes from 'prop-types';
import { X, UploadCloud, Trash2 } from 'lucide-react';

const PollBuilder = ({ formData, updateField }) => {
    if (!formData.is_poll) return null;

    const handleAddOption = () => {
        const newOptions = [...(formData.poll_options || []), { 
            id: Date.now().toString(), 
            title: '', 
            description: '', 
            image_url: '' 
        }];
        updateField('poll_options', newOptions);
    };

    const handleRemoveOption = (indexToRemove) => {
        const newOptions = formData.poll_options.filter((_, idx) => idx !== indexToRemove);
        updateField('poll_options', newOptions);
    };

    const handleUpdateOption = (index, field, value) => {
        const newOptions = [...formData.poll_options];
        newOptions[index][field] = value;
        updateField('poll_options', newOptions);
    };

    const handleImageChange = (index, file) => {
        if (!file) return;
        const newOptions = [...formData.poll_options];
        newOptions[index].imageFile = file;
        newOptions[index].previewUrl = URL.createObjectURL(file);
        updateField('poll_options', newOptions);
    };

    const handleRemoveImage = (index) => {
        const newOptions = [...formData.poll_options];
        if (newOptions[index].previewUrl) {
            URL.revokeObjectURL(newOptions[index].previewUrl);
        }
        newOptions[index].previewUrl = null;
        newOptions[index].imageFile = null;
        newOptions[index].image_url = '';
        updateField('poll_options', newOptions);
    };

    return (
        <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-purple-600 ml-1">투표 항목 설정</p>
                <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-200"
                >
                    + 항목 추가
                </button>
            </div>
            
            <div className="space-y-3">
                {(formData.poll_options || []).map((opt, idx) => (
                    <div key={opt.id} className="flex gap-3 bg-white p-3 rounded-xl border border-purple-50 shadow-sm relative">
                        <button 
                            type="button" 
                            onClick={() => handleRemoveOption(idx)} 
                            className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 border border-white"
                        >
                            <X size={12} />
                        </button>
                        
                        <div className="flex-1 space-y-2">
                            <input 
                                type="text" 
                                placeholder="항목 제목" 
                                value={opt.title} 
                                onChange={e => handleUpdateOption(idx, 'title', e.target.value)} 
                                className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-500 text-sm font-bold" 
                            />
                            <input 
                                type="text" 
                                placeholder="항목 설명 (선택)" 
                                value={opt.description} 
                                onChange={e => handleUpdateOption(idx, 'description', e.target.value)} 
                                className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-500 text-xs" 
                            />
                            
                            {/* File Upload for Option Image */}
                            <div className="flex items-center gap-2">
                                <label className="cursor-pointer bg-white border border-gray-200 hover:border-purple-400 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                                    <UploadCloud size={14} /> 이미지 첨부
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={e => handleImageChange(idx, e.target.files[0])} 
                                    />
                                </label>
                                {opt.image_url && !opt.imageFile && (
                                    <span className="text-[10px] text-gray-400">기존 이미지가 있습니다</span>
                                )}
                            </div>
                        </div>

                        {(opt.previewUrl || opt.image_url) && (
                            <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0 overflow-hidden border border-gray-200 relative group">
                                <img 
                                    src={opt.previewUrl || opt.image_url} 
                                    alt="preview" 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => { e.target.style.display = 'none'; }} 
                                />
                                <button 
                                    type="button" 
                                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                    onClick={() => handleRemoveImage(idx)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {(!formData.poll_options || formData.poll_options.length === 0) && (
                    <div className="text-center py-6 text-xs text-gray-400 font-bold border-2 border-dashed border-purple-100 rounded-xl">
                        우측 상단의 '+ 항목 추가' 버튼을 눌러보세요.
                    </div>
                )}
            </div>
        </div>
    );
};

PollBuilder.propTypes = {
    formData: PropTypes.object.isRequired,
    updateField: PropTypes.func.isRequired
};

export default React.memo(PollBuilder);
