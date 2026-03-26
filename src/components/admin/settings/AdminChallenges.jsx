import React from 'react';
import { Plus, Trash2, Edit2, ChevronRight, Trophy } from 'lucide-react';
import { useAdminChallenges } from './hooks/useAdminChallenges';
import ChallengeItem from './components/ChallengeItem';
import ChallengeModals from './components/ChallengeModals';

const AdminChallenges = () => {
    const {
        categories, challenges, loading,
        expandedCategory, setExpandedCategory,
        showCategoryForm, setShowCategoryForm,
        showChallengeForm, setShowChallengeForm,
        editingCategory, setEditingCategory,
        editingChallenge, setEditingChallenge,
        uploading,
        handleSaveCategory, handleDeleteCategory,
        handleSaveChallenge, handleDeleteChallenge,
        handleImageUpload, openCategoryModal, openChallengeModal
    } = useAdminChallenges();

    if (loading && categories.length === 0) {
        return <div className="p-8 text-center text-gray-500 font-bold">로딩 중...</div>;
    }

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-10 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 gap-4 md:gap-6 bg-gradient-to-r from-white to-blue-50/20">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 flex items-center gap-2 md:gap-3">
                            챌린지 관리 <Trophy className="text-blue-600" size={24} md:size={32} />
                        </h2>
                        <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">학생들의 성취감을 높이는 챌린지와 뱃지를 관리하세요.</p>
                    </div>

                    <button
                        onClick={() => openCategoryModal()}
                        className="md:hidden p-2.5 bg-blue-600 text-white rounded-xl shadow-md"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <button
                    onClick={() => openCategoryModal()}
                    className="hidden md:flex bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition items-center gap-2 shadow-lg shadow-blue-100"
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
                                <button onClick={(e) => { e.stopPropagation(); openCategoryModal(cat); }} className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"><Edit2 size={14} /></button>
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
                                onClick={() => openChallengeModal({ name: '', description: '', category_id: expandedCategory, type: 'VISIT', threshold: 0, image_url: '' })}
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
                                        onEdit={() => openChallengeModal(ch)}
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

            <ChallengeModals
                showCategoryForm={showCategoryForm}
                setShowCategoryForm={setShowCategoryForm}
                showChallengeForm={showChallengeForm}
                setShowChallengeForm={setShowChallengeForm}
                editingCategory={editingCategory}
                setEditingCategory={setEditingCategory}
                editingChallenge={editingChallenge}
                setEditingChallenge={setEditingChallenge}
                handleSaveCategory={handleSaveCategory}
                handleSaveChallenge={handleSaveChallenge}
                handleImageUpload={handleImageUpload}
                uploading={uploading}
            />
        </div>
    );
};

export default AdminChallenges;
