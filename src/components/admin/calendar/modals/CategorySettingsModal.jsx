import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, X } from 'lucide-react';
import { COLOR_THEMES } from '../calendarConstants';

const CategorySettingsModal = ({
    showCategoryModal, setShowCategoryModal,
    dynamicCategories,
    categoryForm, setCategoryForm,
    editCategory, setEditCategory,
    handleSaveCategory, handleDeleteCategory
}) => {
    return (
                
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryModal(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] overflow-hidden relative z-10 border border-gray-100 flex flex-col max-h-[90vh]">
                            <div className="p-8 pb-4 flex justify-between items-start">
                                <div><span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block shadow-sm">Category Settings</span><h3 className="text-2xl font-black text-gray-800 tracking-tighter">필터 및 카테고리 관리</h3></div>
                                <button onClick={() => setShowCategoryModal(false)} className="p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"><X size={24} /></button>
                            </div>
                            <div className="px-8 flex-1 overflow-y-auto custom-scrollbar pb-8">
                                <form onSubmit={handleSaveCategory} className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                                    <h4 className="text-sm font-black text-gray-800">{editCategory ? '카테고리 수정' : '새 카테고리 추가'}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input type="text" placeholder="카테고리 이름 (예: 외부 미팅)" value={categoryForm.name} onChange={e => setCategoryForm(prev => ({ ...prev, name: e.target.value }))} className="p-3.5 bg-white border border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm shadow-inner" required />
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                            {Object.keys(COLOR_THEMES).map(theme => (
                                                <button
                                                    key={theme}
                                                    type="button"
                                                    onClick={() => setCategoryForm(prev => ({ ...prev, color_theme: theme }))}
                                                    className={`w-8 h-8 rounded-full border-4 transition-all ${COLOR_THEMES[theme].dot} ${categoryForm.color_theme === theme ? 'border-white ring-2 ring-blue-500 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">{editCategory ? '수정 완료' : '추가하기'}</button>
                                        {editCategory && <button type="button" onClick={() => { setEditCategory(null); setCategoryForm({ name: '', color_theme: 'blue' }) }} className="px-4 py-3 bg-gray-200 text-gray-500 rounded-xl font-black text-xs">취소</button>}
                                    </div>
                                </form>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">Existing Categories</h4>
                                    {dynamicCategories.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-gray-50 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${COLOR_THEMES[cat.color_theme]?.dot || 'bg-gray-500'}`} />
                                                <span className="font-bold text-gray-700">{cat.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setEditCategory(cat); setCategoryForm({ name: cat.name, color_theme: cat.color_theme }) }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                                {!cat.is_system && <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                
    );
};
export default CategorySettingsModal;
