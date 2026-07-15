import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Plus, Trash2, Edit2, Check, X, Store, Folder, Coffee, Gamepad2, Search, Sparkles } from 'lucide-react';
import AdminPageHeader from '../common/AdminPageHeader';

const AdminContents = () => {
    const [contents, setContents] = useState([]);
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'HAIFN', 'ENOUGH_PLACE'

    // Form states
    const [name, setName] = useState('');
    const [category, setCategory] = useState('간식'); // '간식', '보드게임' 등
    const [description, setDescription] = useState('');
    const [locationText, setLocationText] = useState('2F SQUARE');
    const [imageUrl, setImageUrl] = useState('');
    const [editingId, setEditingId] = useState(null);

    // Image search states
    const [searchedImages, setSearchedImages] = useState([]);
    const [searchingImages, setSearchingImages] = useState(false);
    const [selectedSearchImg, setSelectedSearchImg] = useState('');

    useEffect(() => {
        fetchSchools();
        fetchContents();
    }, []);

    const fetchSchools = async () => {
        try {
            const { data, error } = await supabase.from('schools').select('*').order('name');
            if (error) throw error;
            setSchools(data || []);
            const defaultSchool = data?.find(s => s.region === '강동' || s.region === '강서');
            if (defaultSchool) {
                setSelectedSchool(defaultSchool.id);
            } else if (data && data.length > 0) {
                setSelectedSchool(data[0].id);
            }
        } catch (error) {
            console.error('Error fetching schools:', error);
        }
    };

    const fetchContents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('contents')
                .select('*, schools(name, region)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setContents(data || []);
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSaving(true);
        try {
            // Save location and description as a single JSON object string in description field
            const descObj = {
                location: locationText.trim(),
                desc: description.trim()
            };

            const payload = {
                school_id: selectedSchool,
                name: name.trim(),
                category,
                description: JSON.stringify(descObj),
                image_url: imageUrl.trim()
            };

            if (editingId) {
                const { error } = await supabase
                    .from('contents')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                alert('콘텐츠가 수정되었습니다.');
            } else {
                const { error } = await supabase
                    .from('contents')
                    .insert([payload]);
                if (error) throw error;
                alert('콘텐츠가 등록되었습니다.');
            }

            resetForm();
            fetchContents();
        } catch (error) {
            console.error('Error saving content:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        setSelectedSchool(item.school_id);
        setName(item.name);
        setCategory(item.category);
        
        // Parse JSON location/desc or fallback gracefully
        try {
            if (item.description && item.description.startsWith('{')) {
                const parsed = JSON.parse(item.description);
                setLocationText(parsed.location || '');
                setDescription(parsed.desc || '');
            } else {
                setLocationText('');
                setDescription(item.description || '');
            }
        } catch (e) {
            setLocationText('');
            setDescription(item.description || '');
        }

        setImageUrl(item.imageUrl || item.image_url || '');
        setSelectedSearchImg(item.imageUrl || item.image_url || '');
        setSearchedImages([]);
    };

    const handleDelete = async (id) => {
        if (!confirm('정말 이 콘텐츠를 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase
                .from('contents')
                .delete()
                .eq('id', id);
            if (error) throw error;
            alert('콘텐츠가 삭제되었습니다.');
            fetchContents();
        } catch (error) {
            console.error('Error deleting content:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setCategory('간식');
        setDescription('');
        
        // Dynamically reset locationText based on the currently selected school
        const currentSchool = schools.find(s => s.id === selectedSchool);
        if (currentSchool?.region === '강서') {
            setLocationText('이높플레이스');
        } else {
            setLocationText('2F SQUARE');
        }

        setImageUrl('');
        setSelectedSearchImg('');
        setSearchedImages([]);
    };

    // Client-side search and rich image parser
    // Fetch real-world Korean search images using Pixabay API (natively supports Korean query and has direct CORS headers)
    const searchImages = async () => {
        if (!name.trim()) {
            alert('먼저 콘텐츠 이름을 입력해주세요.');
            return;
        }
        
        setSearchingImages(true);
        try {
            const query = encodeURIComponent(name.trim());
            // Use Pixabay Public API Key for developer lookup (resolves Korean search terms with zero CORS restrictions)
            const res = await fetch(`https://pixabay.com/api/?key=24245993-9c8646b8cb793b5a1a1f0a1c1&q=${query}&image_type=photo&per_page=6`);
            const data = await res.json();
            
            if (data && data.hits && data.hits.length > 0) {
                const urls = data.hits.map(item => item.webformatURL);
                setSearchedImages(urls);
            } else {
                throw new Error('No images returned for: ' + name);
            }
        } catch (e) {
            console.error('Pixabay search failed, using high-quality fallbacks:', e);
            const query = encodeURIComponent(name.trim());
            setSearchedImages([
                `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&q=${query}&sig=1`,
                `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=500&q=${query}&sig=2`,
                `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&q=${query}&sig=3`,
                `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=${query}&sig=4`,
                `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=500&q=${query}&sig=5`,
                `https://images.weserv.nl/?url=https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&q=${query}&sig=6`
            ]);
        } finally {
            setSearchingImages(false);
        }
    };

    const handleSelectSearchImg = (url) => {
        setSelectedSearchImg(url);
        setImageUrl(url);
    };

    // Filter contents based on the selected menu/tabs
    const filteredContents = contents.filter(item => {
        const region = item.schools?.region || '';
        if (activeFilter === 'HAIFN') {
            return region === '강동';
        }
        if (activeFilter === 'ENOUGH_PLACE') {
            return region === '강서';
        }
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in-up">
            <AdminPageHeader
                title="콘텐츠 관리"
                subtitle="각 센터별로 누릴 수 있는 것들(간식, 보드게임 등)을 등록하고 관리합니다."
                icon={<Store />}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 등록/수정 폼 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-fit space-y-4">
                    <h3 className="text-lg font-black text-gray-800">
                        {editingId ? '콘텐츠 수정' : '신규 콘텐츠 등록'}
                    </h3>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">대상 센터</label>
                            <select
                                value={selectedSchool}
                                onChange={(e) => {
                                    const schId = e.target.value;
                                    setSelectedSchool(schId);
                                    const selectedSchoolObj = schools.find(s => s.id === schId);
                                    if (selectedSchoolObj?.region === '강서') {
                                        setLocationText('이높플레이스');
                                    } else {
                                        setLocationText('2F SQUARE');
                                    }
                                }}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-gray-700"
                                required
                            >
                                {(() => {
                                    const gangdongSchool = schools.find(s => s.region === '강동');
                                    const gangserSchool = schools.find(s => s.region === '강서');
                                    const options = [];
                                    if (gangdongSchool) options.push({ id: gangdongSchool.id, label: '하이픈' });
                                    if (gangserSchool) options.push({ id: gangserSchool.id, label: '이높플레이스' });
                                    return options.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ));
                                })()}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">콘텐츠 카테고리</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-gray-700"
                                required
                            >
                                <option value="간식">간식</option>
                                <option value="보드게임">보드게임</option>
                            </select>
                        </div>

                         <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">콘텐츠 이름</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="예: 초코파이, 루미큐브"
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-gray-700"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">보관 위치</label>
                            {(() => {
                                // Find if selected school maps to Gangseo
                                const selectedSchoolObj = schools.find(s => s.id === selectedSchool);
                                const isGangseo = selectedSchoolObj?.region === '강서';

                                return (
                                    <select
                                        value={locationText}
                                        onChange={(e) => setLocationText(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-gray-700"
                                        required
                                    >
                                        {isGangseo ? (
                                            <option value="이높플레이스">이높플레이스</option>
                                        ) : (
                                            <>
                                                <option value="2F SQUARE">2F SQUARE</option>
                                                <option value="3F ROUND">3F ROUND</option>
                                                <option value="6F LOUNGE">6F LOUNGE</option>
                                            </>
                                        )}
                                    </select>
                                );
                            })()}
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">상세 설명</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="콘텐츠의 특징이나 수량 등을 적어주세요."
                                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-gray-700 h-20 resize-none"
                            />
                        </div>



                        <div className="flex gap-2 pt-2">
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black hover:bg-gray-200 transition-colors"
                                >
                                    취소
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-3 w-full py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                                style={{ flexGrow: 3 }}
                            >
                                {saving ? '저장 중...' : (editingId ? '수정 완료' : '등록하기')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* 목록 조회 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="text-lg font-black text-gray-800">등록된 콘텐츠 목록</h3>
                        
                        {/* Center filter menu */}
                        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                            <button
                                onClick={() => setActiveFilter('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeFilter === 'ALL'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                전체
                            </button>
                            <button
                                onClick={() => setActiveFilter('HAIFN')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeFilter === 'HAIFN'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                하이픈
                            </button>
                            <button
                                onClick={() => setActiveFilter('ENOUGH_PLACE')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeFilter === 'ENOUGH_PLACE'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                이높플레이스
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 font-bold text-gray-400 animate-pulse">불러오는 중...</div>
                    ) : filteredContents.length === 0 ? (
                        <div className="text-center py-10 font-bold text-gray-400">등록된 콘텐츠가 없습니다.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredContents.map((item) => {
                                const isHaifn = item.schools?.region === '강동';
                                let loc = '';
                                let d = '';
                                try {
                                    if (item.description && item.description.startsWith('{')) {
                                        const parsed = JSON.parse(item.description);
                                        loc = parsed.location || '';
                                        d = parsed.desc || '';
                                    } else {
                                        d = item.description || '';
                                    }
                                } catch (e) {
                                    d = item.description || '';
                                }

                                return (
                                    <div 
                                        key={item.id} 
                                        onClick={() => handleEdit(item)}
                                        className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-200 cursor-pointer flex items-center justify-between transition-all shadow-sm relative group"
                                    >
                                        <div className="min-w-0 pr-4 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${
                                                    isHaifn ? 'bg-indigo-600' : 'bg-rose-500'
                                                }`}>
                                                    {isHaifn ? '하이픈' : '이높'}
                                                </span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-800 text-white rounded">
                                                    {item.category}
                                                </span>
                                                {loc && (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                        loc === '2F SQUARE' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                        loc === '3F ROUND' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                        loc === '6F LOUNGE' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                                        'bg-pink-50 text-pink-700 border border-pink-100'
                                                    }`}>
                                                        {loc}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-extrabold text-gray-800 text-sm truncate mt-1">{item.name}</h4>
                                            {d && <p className="text-[11px] text-gray-400 font-semibold line-clamp-1">{d}</p>}
                                        </div>

                                        {/* Action Control Panel */}
                                        <div className="flex items-center gap-1 shrink-0 border-l border-gray-100 pl-3">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent triggering handleEdit again
                                                    handleDelete(item.id);
                                                }} 
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminContents;
