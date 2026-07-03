import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Settings, Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown, ClipboardList } from 'lucide-react';

const COMMON_FLOORS = ['6층', '5층', '4층', '3층', '2층', '1층 / 지하', '1층 / 기타'];
const COMMON_CATEGORIES = ['조명', '에어컨', '창문', '보안', '기타'];

const DutyChecklistSettings = ({ isMaster }) => {
    const [activeTab, setActiveTab] = useState('START'); // START or END
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form states for new item
    const [newFloor, setNewFloor] = useState('6층');
    const [customFloor, setCustomFloor] = useState('');
    const [newCategory, setNewCategory] = useState('조명');
    const [customCategory, setCustomCategory] = useState('');
    const [newLabel, setNewLabel] = useState('');

    // Editing states
    const [editingId, setEditingId] = useState(null);
    const [editFloor, setEditFloor] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editLabel, setEditLabel] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('duty_checklist_settings')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });

            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Failed to fetch duty settings:', err);
            alert('설정을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        const floorVal = newFloor === 'custom' ? customFloor.trim() : newFloor;
        const categoryVal = newCategory === 'custom' ? customCategory.trim() : newCategory;
        const labelVal = newLabel.trim();

        if (!floorVal || !categoryVal || !labelVal) {
            alert('층, 카테고리, 항목명을 모두 입력해주세요.');
            return;
        }

        try {
            // Find max sort order for this type and floor to append it
            const floorItems = items.filter(i => i.type === activeTab && i.floor === floorVal);
            const maxSortOrder = floorItems.reduce((max, item) => item.sort_order > max ? item.sort_order : max, 0);

            const { data, error } = await supabase
                .from('duty_checklist_settings')
                .insert([{
                    type: activeTab,
                    floor: floorVal,
                    category: categoryVal,
                    label: labelVal,
                    sort_order: maxSortOrder + 10
                }])
                .select();

            if (error) throw error;

            setNewLabel('');
            if (newFloor === 'custom') setCustomFloor('');
            if (newCategory === 'custom') setCustomCategory('');
            
            fetchSettings();
        } catch (err) {
            console.error('Failed to add checklist item:', err);
            alert('항목 추가에 실패했습니다.');
        }
    };

    const handleStartEdit = (item) => {
        setEditingId(item.id);
        setEditFloor(item.floor);
        setEditCategory(item.category);
        setEditLabel(item.label);
    };

    const handleSaveEdit = async (id) => {
        if (!editFloor.trim() || !editCategory.trim() || !editLabel.trim()) {
            alert('모든 필드를 입력해 주세요.');
            return;
        }

        try {
            const { error } = await supabase
                .from('duty_checklist_settings')
                .update({
                    floor: editFloor.trim(),
                    category: editCategory.trim(),
                    label: editLabel.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            setEditingId(null);
            fetchSettings();
        } catch (err) {
            console.error('Failed to update checklist item:', err);
            alert('수정에 실패했습니다.');
        }
    };

    const handleDeleteItem = async (id) => {
        if (!confirm('이 항목을 정말 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase
                .from('duty_checklist_settings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSettings();
        } catch (err) {
            console.error('Failed to delete checklist item:', err);
            alert('삭제에 실패했습니다.');
        }
    };

    const handleMoveItem = async (index, direction, filteredList) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= filteredList.length) return;

        const currentItem = filteredList[index];
        const swapItem = filteredList[targetIndex];

        try {
            // Swap sort_order
            const tempOrder = currentItem.sort_order;
            
            const { error: err1 } = await supabase
                .from('duty_checklist_settings')
                .update({ sort_order: swapItem.sort_order })
                .eq('id', currentItem.id);

            const { error: err2 } = await supabase
                .from('duty_checklist_settings')
                .update({ sort_order: tempOrder })
                .eq('id', swapItem.id);

            if (err1 || err2) throw (err1 || err2);

            fetchSettings();
        } catch (err) {
            console.error('Failed to swap order:', err);
            alert('순서 변경에 실패했습니다.');
        }
    };

    if (!isMaster) {
        return (
            <div className="bg-white rounded-[24px] border border-[#f2f4f6] p-6 shadow-sm flex flex-col items-center justify-center text-center py-12">
                <Settings size={48} className="text-gray-200 mb-4" />
                <h3 className="font-bold text-gray-400">마스터 권한이 필요한 메뉴입니다</h3>
                <p className="text-xs text-gray-400 mt-2">당직 체크리스트 설정은 마스터 계정만 가능합니다.</p>
            </div>
        );
    }

    // Filter items based on activeTab
    const activeItems = items.filter(item => item.type === activeTab);

    // Group items by floor
    const floorsMap = {};
    activeItems.forEach(item => {
        if (!floorsMap[item.floor]) floorsMap[item.floor] = [];
        floorsMap[item.floor].push(item);
    });

    return (
        <div className="bg-white rounded-[24px] border border-[#f2f4f6] p-6 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-[#191f28] flex items-center gap-2 tracking-tight">
                    <ClipboardList size={20} className="text-blue-600" />
                    당직 체크리스트 관리
                </h3>
                {/* Tabs */}
                <div className="flex bg-[#f2f4f6] p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('START')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'START' ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                    >
                        시작 업무
                    </button>
                    <button
                        onClick={() => setActiveTab('END')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'END' ? 'bg-white text-[#3182f6] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
                    >
                        마감 업무
                    </button>
                </div>
            </div>

            {/* Add Form */}
            <form onSubmit={handleAddItem} className="space-y-3 p-4 bg-[#f8f9fa] rounded-2xl border border-[#f2f4f6]">
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest">체크 항목 추가</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Floor Selection */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500">점검 층</label>
                        <select
                            value={newFloor}
                            onChange={(e) => setNewFloor(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-gray-700 h-[42px]"
                        >
                            {COMMON_FLOORS.map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                            <option value="custom">직접 입력...</option>
                        </select>
                        {newFloor === 'custom' && (
                            <input
                                type="text"
                                value={customFloor}
                                onChange={(e) => setCustomFloor(e.target.value)}
                                placeholder="예: 7층 또는 지상3층"
                                className="w-full mt-1.5 p-2 bg-white border border-gray-200 rounded-xl outline-none text-sm font-medium"
                            />
                        )}
                    </div>

                    {/* Category Selection */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500">카테고리</label>
                        <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-gray-700 h-[42px]"
                        >
                            {COMMON_CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="custom">직접 입력...</option>
                        </select>
                        {newCategory === 'custom' && (
                            <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="예: 가스, 소방"
                                className="w-full mt-1.5 p-2 bg-white border border-gray-200 rounded-xl outline-none text-sm font-medium"
                            />
                        )}
                    </div>

                    {/* Label Input */}
                    <div className="flex flex-col gap-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-gray-500">점검 내용</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="예: 가스 밸브 잠금 확인"
                                className="flex-1 p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold h-[42px]"
                            />
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-4 rounded-xl font-bold hover:bg-blue-700 shadow-sm text-sm h-[42px] flex items-center justify-center transition-all"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* List and Management */}
            {loading ? (
                <div className="text-center py-6 text-sm font-bold text-gray-400">데이터 불러오는 중...</div>
            ) : Object.keys(floorsMap).length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400">
                    등록된 당직 체크 항목이 없습니다.
                </div>
            ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    {Object.keys(floorsMap).map(floor => {
                        const floorItems = floorsMap[floor];
                        return (
                            <div key={floor} className="border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                                {/* Floor Header */}
                                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-150 flex items-center justify-between">
                                    <span className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                                        {floor}
                                        <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{floorItems.length}</span>
                                    </span>
                                </div>

                                {/* Items list */}
                                <div className="bg-white divide-y divide-gray-100">
                                    {floorItems.map((item, idx) => {
                                        const isEditing = editingId === item.id;
                                        return (
                                            <div key={item.id} className="flex items-center justify-between p-3 pl-4 hover:bg-blue-50/10 transition group">
                                                {isEditing ? (
                                                    <div className="flex-1 flex flex-wrap gap-2 mr-3">
                                                        <input
                                                            type="text"
                                                            value={editFloor}
                                                            onChange={(e) => setEditFloor(e.target.value)}
                                                            className="p-1 border border-blue-300 rounded text-xs font-bold w-16"
                                                            placeholder="층"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editCategory}
                                                            onChange={(e) => setEditCategory(e.target.value)}
                                                            className="p-1 border border-blue-300 rounded text-xs font-bold w-16"
                                                            placeholder="카테고리"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editLabel}
                                                            onChange={(e) => setEditLabel(e.target.value)}
                                                            className="flex-1 p-1 border border-blue-300 rounded text-xs font-bold min-w-[120px]"
                                                            placeholder="점검내용"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black tracking-wider uppercase flex-shrink-0">
                                                            {item.category}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-700 truncate">
                                                            {item.label}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveEdit(item.id)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingId(null)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* Sort arrows */}
                                                            <button
                                                                onClick={() => handleMoveItem(idx, -1, floorItems)}
                                                                disabled={idx === 0}
                                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition disabled:opacity-30"
                                                                title="위로 이동"
                                                            >
                                                                <ArrowUp size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleMoveItem(idx, 1, floorItems)}
                                                                disabled={idx === floorItems.length - 1}
                                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition disabled:opacity-30"
                                                                title="아래로 이동"
                                                            >
                                                                <ArrowDown size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleStartEdit(item)}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                                                                title="수정"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                                                                title="삭제"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DutyChecklistSettings;
