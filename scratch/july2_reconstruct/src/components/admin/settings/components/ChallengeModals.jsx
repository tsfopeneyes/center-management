import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Upload } from 'lucide-react';

const ChallengeModals = ({
    showCategoryForm, setShowCategoryForm,
    showChallengeForm, setShowChallengeForm,
    editingCategory, setEditingCategory,
    editingChallenge, setEditingChallenge,
    handleSaveCategory, handleSaveChallenge,
    handleImageUpload, uploading
}) => {
    return (
        <>
            {/* Category Form Modal */}
            <AnimatePresence>
                {showCategoryForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryForm(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
                            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                                카테고리 {editingCategory.id ? '수정' : '추가'}
                                <X className="ml-auto cursor-pointer text-gray-400 hover:text-gray-800" onClick={() => setShowCategoryForm(false)} />
                            </h3>
                            <form onSubmit={handleSaveCategory} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 mb-2 ml-1">카테고리명</label>
                                    <input
                                        type="text"
                                        value={editingCategory.name}
                                        onChange={e => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold"
                                        placeholder="예: 센터 방문 도전"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 mb-2 ml-1">설명</label>
                                    <textarea
                                        value={editingCategory.description || ''}
                                        onChange={e => setEditingCategory(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold min-h-[100px]"
                                        placeholder="이 카테고리에 대한 설명을 간단히 입력하세요."
                                    />
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition transform active:scale-95">
                                    <Save size={20} className="inline mr-2" /> 저장하기
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Challenge Form Modal */}
            <AnimatePresence>
                {showChallengeForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChallengeForm(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                                챌린지 {editingChallenge.id ? '수정' : '추가'}
                                <X className="ml-auto cursor-pointer text-gray-400 hover:text-gray-800" onClick={() => setShowChallengeForm(false)} />
                            </h3>
                            <form onSubmit={handleSaveChallenge} className="space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative group cursor-pointer" onClick={() => document.getElementById('challengeImage').click()}>
                                        <div className="w-32 h-32 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-100 overflow-hidden flex items-center justify-center group-hover:border-blue-500 transition-colors">
                                            {editingChallenge.image_url ? (
                                                <img src={editingChallenge.image_url} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <Upload className="mx-auto text-gray-300 mb-2" size={32} />
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">이미지 선택</p>
                                                </div>
                                            )}
                                        </div>
                                        {uploading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-3xl"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}
                                    </div>
                                    <input type="file" id="challengeImage" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    <p className="text-[10px] text-gray-400 font-bold">권장 사이즈: 512x512px (PNG, 배경투명)</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-gray-400 mb-2 ml-1">챌린지 이름</label>
                                        <input
                                            type="text"
                                            value={editingChallenge.name}
                                            onChange={e => setEditingChallenge(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold"
                                            placeholder="예: 센터 홍보 대사"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-gray-400 mb-2 ml-1">챌린지 설명</label>
                                        <textarea
                                            value={editingChallenge.description || ''}
                                            onChange={e => setEditingChallenge(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold min-h-[80px]"
                                            placeholder="학생들에게 보여줄 설명을 입력하세요."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-2 ml-1">분류 기준</label>
                                        <select
                                            value={editingChallenge.type}
                                            onChange={e => setEditingChallenge(prev => ({ ...prev, type: e.target.value }))}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold"
                                        >
                                            <option value="VISIT">센터 방문 횟수</option>
                                            <option value="PROGRAM">프로그램 참여 횟수</option>
                                            <option value="SPECIAL">특별 조건/이벤트</option>
                                        </select>
                                    </div>
                                    <div className="col-span-1 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 mb-2 ml-1">달성 기준치</label>
                                            <input
                                                type="number"
                                                value={editingChallenge.threshold}
                                                onChange={e => setEditingChallenge(prev => ({ ...prev, threshold: parseInt(e.target.value) || 0 }))}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold"
                                                placeholder="예: 50"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 mb-2 ml-1">달성 조건 문구 (수기 입력)</label>
                                            <input
                                                type="text"
                                                value={editingChallenge.criteria_label || ''}
                                                onChange={e => setEditingChallenge(prev => ({ ...prev, criteria_label: e.target.value }))}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-blue-500 transition font-bold"
                                                placeholder="예: 1회 방문, 5번 참석 등 직접 입력"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={uploading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition transform active:scale-95 disabled:bg-gray-300">
                                    <Save size={20} className="inline mr-2" /> 챌린지 저장
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChallengeModals;
