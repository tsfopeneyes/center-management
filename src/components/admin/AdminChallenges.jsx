import React, { useState, useEffect } from 'react';
import { challengesApi } from '../../api/challengesApi';
import { supabase } from '../../supabaseClient';
import { compressImage } from '../../utils/imageUtils';
import { Plus, Trash2, Edit2, GripVertical, ChevronRight, ChevronDown, Image as ImageIcon, Upload, Save, X, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChallengeItem = ({ ch, onEdit, onDelete }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div className="p-4 md:p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
            <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center relative flex-shrink-0">
                    {ch.image_url && !imgError ? (
                        <img
                            src={ch.image_url}
                            alt={ch.name}
                            onError={() => setImgError(true)}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <ImageIcon className="text-gray-300" size={20} />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-black text-gray-800 text-base md:text-lg truncate">{ch.name}</p>
                    <p className="text-[10px] md:text-xs text-gray-400 font-bold mb-1 truncate max-w-[150px] md:max-w-xs">{ch.description}</p>
                    <div className="flex gap-1.5 md:gap-2 flex-wrap">
                        <span className="text-[9px] md:text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-black uppercase whitespace-nowrap">{ch.type}</span>
                        <span className="text-[9px] md:text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-black uppercase whitespace-nowrap">{ch.criteria_label || `${ch.threshold} 기준`}</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-1 md:gap-2 flex-shrink-0 ml-2">
                <button onClick={onEdit} className="p-2 md:p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg md:rounded-xl transition-all"><Edit2 size={16} /></button>
                <button onClick={onDelete} className="p-2 md:p-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg md:rounded-xl transition-all"><Trash2 size={16} /></button>
            </div>
        </div>
    );
};

const AdminChallenges = () => {
    const [categories, setCategories] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [showChallengeForm, setShowChallengeForm] = useState(false);

    // Form State
    const [editingCategory, setEditingCategory] = useState({ name: '', description: '' });
    const [editingChallenge, setEditingChallenge] = useState({
        name: '',
        description: '',
        category_id: '',
        type: 'VISIT', // VISIT, PROGRAM, SPECIAL
        threshold: 0,
        criteria_label: '',
        image_url: ''
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catData, chData] = await Promise.all([
                challengesApi.fetchCategories(),
                challengesApi.fetchChallenges()
            ]);
            setCategories(catData);
            setChallenges(chData);
            if (catData.length > 0 && !expandedCategory) {
                setExpandedCategory(catData[0].id);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            alert('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            await challengesApi.upsertCategory(editingCategory);
            setShowCategoryForm(false);
            setEditingCategory({ name: '', description: '' });
            fetchData();
            alert('카테고리가 저장되었습니다.');
        } catch (error) {
            alert('카테고리 저장 실패: ' + error.message);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('카테고리를 삭제하면 소속된 모든 챌린지도 삭제됩니다. 계속하시겠습니까?')) return;
        try {
            await challengesApi.deleteCategory(id);
            fetchData();
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    };

    const handleSaveChallenge = async (e) => {
        e.preventDefault();
        try {
            await challengesApi.upsertChallenge(editingChallenge);
            setShowChallengeForm(false);
            setEditingChallenge({ name: '', description: '', category_id: expandedCategory, type: 'VISIT', threshold: 0, criteria_label: '', image_url: '' });
            fetchData();
            alert('챌린지가 저장되었습니다.');
        } catch (error) {
            alert('챌린지 저장 실패: ' + error.message);
        }
    };

    const handleDeleteChallenge = async (id) => {
        if (!confirm('챌린지를 삭제하시겠습니까?')) return;
        try {
            await challengesApi.deleteChallenge(id);
            fetchData();
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Apply automatic compression before upload
            const compressedFile = await compressImage(file, 512, 0.9); // Optimized for badges
            const fileExt = compressedFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('notice-images') // Reuse notice-images bucket or create 'badges'
                .upload(`badges/${fileName}`, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('notice-images')
                .getPublicUrl(`badges/${fileName}`);

            setEditingChallenge(prev => ({ ...prev, image_url: publicUrl }));
        } catch (error) {
            alert('이미지 업로드 실패: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading && categories.length === 0) {
        return <div className="p-8 text-center text-gray-500 font-bold">로딩 중...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        챌린지 관리 <Trophy className="text-blue-600" size={24} />
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">학생들의 성취감을 높이는 챌린지와 뱃지를 관리하세요.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCategory({ name: '', description: '' });
                        setShowCategoryForm(true);
                    }}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-100"
                >
                    <Plus size={20} /> <span className="text-sm">카테고리 추가</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Categories List */}
                <div className="lg:col-span-1 space-y-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mt-2">분야 카테고리</h3>
                    {categories.map(cat => (
                        <div
                            key={cat.id}
                            onClick={() => setExpandedCategory(cat.id)}
                            className={`group p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${expandedCategory === cat.id ? 'bg-blue-50 border-blue-200 shadow-md shadow-blue-50' : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0 ${expandedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    <ChevronRight size={16} className={expandedCategory === cat.id ? 'rotate-90 transition-transform' : ''} />
                                </div>
                                <div className="min-w-0">
                                    <p className={`font-black text-sm md:text-base truncate ${expandedCategory === cat.id ? 'text-blue-600' : 'text-gray-700'}`}>{cat.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold truncate">{challenges.filter(c => c.category_id === cat.id).length}개의 챌린지</p>
                                </div>
                            </div>
                            <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setShowCategoryForm(true); }} className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="p-1.5 md:p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Challenges within selected category */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">챌린지 목록</h3>
                        {expandedCategory && (
                            <button
                                onClick={() => {
                                    setEditingChallenge({ name: '', description: '', category_id: expandedCategory, type: 'VISIT', threshold: 0, image_url: '' });
                                    setShowChallengeForm(true);
                                }}
                                className="text-blue-600 font-black text-xs hover:underline flex items-center gap-1"
                            >
                                <Plus size={14} /> 새 챌린지 추가
                            </button>
                        )}
                    </div>

                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                        {!expandedCategory ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                                <Trophy size={48} className="mb-4 opacity-20" />
                                <p className="font-bold">카테고리를 선택하여<br />챌린지를 관리하세요.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {challenges.filter(c => c.category_id === expandedCategory).map(ch => (
                                    <ChallengeItem
                                        key={ch.id}
                                        ch={ch}
                                        onEdit={() => { setEditingChallenge(ch); setShowChallengeForm(true); }}
                                        onDelete={() => handleDeleteChallenge(ch.id)}
                                    />
                                ))}
                                {challenges.filter(c => c.category_id === expandedCategory).length === 0 && (
                                    <div className="p-20 text-center text-gray-300 font-bold">등록된 챌린지가 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
        </div>
    );
};

export default AdminChallenges;
