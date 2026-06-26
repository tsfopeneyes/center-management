import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Search, UserPlus, History, Award, CheckCircle2, X } from 'lucide-react';

const AMOUNTS = [1, 3, 5, 10, 15, 20, 30];

// Category point configuration
const CATEGORY_MAP = {
    '참여': {
        points: 1,
        items: ['오늘의 질문', '플레이리스트']
    },
    '연결': {
        points: 5,
        items: ['프로그램 참여']
    },
    '역할': {
        points: 10,
        items: ['스탭 참여', '친구 초대']
    },
    '확장': {
        points: 30,
        items: ['스쿨처치 개설', '차기 리더 세움']
    },
    '기타': {
        points: null,
        items: []
    }
};

const StoreManualPoints = ({ users: propUsers }) => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [amount, setAmount] = useState(5);
    
    // Categorized Reason States
    const [activeCategory, setActiveCategory] = useState('참여');
    const [selectedSubItem, setSelectedSubItem] = useState('');
    const [customReason, setCustomReason] = useState('');
    
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch active students
            const { data: userData } = await supabase
                .from('users')
                .select('id, name, school, user_group, phone_back4')
                .neq('user_group', '게스트')
                .neq('user_group', '미가입')
                .order('name');
            setUsers(userData || []);

            // Fetch recent manual transactions
            const { data: historyData } = await supabase
                .from('hyphen_transactions')
                .select('*, users(name, school)')
                .eq('transaction_type', 'MANUAL')
                .order('created_at', { ascending: false })
                .limit(10);
            setHistory(historyData || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (propUsers && propUsers.length > 0) {
            const filtered = propUsers.filter(u => 
                u.name !== 'admin' && 
                u.user_group !== '게스트' && 
                u.user_group !== '미가입' &&
                u.preferences?.is_temporary !== true
            );
            setUsers(filtered);
            
            // Also fetch history
            const fetchHistoryOnly = async () => {
                try {
                    const { data: historyData } = await supabase
                        .from('hyphen_transactions')
                        .select('*, users(name, school)')
                        .eq('transaction_type', 'MANUAL')
                        .order('created_at', { ascending: false })
                        .limit(10);
                    setHistory(historyData || []);
                } catch (err) {
                    console.error(err);
                }
            };
            fetchHistoryOnly();
        } else {
            fetchData();
        }
    }, [propUsers]);

    const filteredUsers = users.filter(u => 
        (u.name?.includes(searchTerm) || 
        u.school?.includes(searchTerm) || 
        (u.phone_back4 && u.phone_back4.includes(searchTerm))) &&
        !selectedUsers.some(selected => selected.id === u.id)
    );

    const handleSelectUser = (user) => {
        if (!selectedUsers.some(u => u.id === user.id)) {
            setSelectedUsers(prev => [...prev, user]);
        }
        setSearchTerm('');
    };

    const handleRemoveUser = (userId) => {
        setSelectedUsers(prev => prev.filter(u => u.id !== userId));
    };

    const handleCategoryClick = (cat) => {
        setActiveCategory(cat);
        setSelectedSubItem('');
        setCustomReason('');
        
        // If Category has fixed points, pre-select it
        if (CATEGORY_MAP[cat].points !== null) {
            setAmount(CATEGORY_MAP[cat].points);
        }
    };

    const handleSubItemClick = (subItem) => {
        setSelectedSubItem(subItem);
        const catConfig = CATEGORY_MAP[activeCategory];
        if (catConfig && catConfig.points !== null) {
            setAmount(catConfig.points);
        }
    };

    const handleSubmit = async () => {
        if (selectedUsers.length === 0) {
            alert('지급 대상 학생을 한 명 이상 선택해주세요.');
            return;
        }
        if (!amount || amount <= 0) {
            alert('지급할 포인트를 확인해주세요.');
            return;
        }
        
        let finalReason = '';
        if (activeCategory === '기타') {
            finalReason = customReason.trim();
        } else {
            if (!selectedSubItem) {
                alert('세부 항목을 선택해주세요.');
                return;
            }
            finalReason = `[${activeCategory}] ${selectedSubItem}`;
        }

        if (!finalReason) {
            alert('지급 사유를 확인해주세요.');
            return;
        }

        const confirmMsg = `${selectedUsers.map(u => u.name).join(', ')} 총 ${selectedUsers.length}명의 학생에게 [${finalReason}] 사유로 각각 ${amount}H를 지급하시겠습니까?`;
        if (!confirm(confirmMsg)) return;

        setSubmitLoading(true);
        try {
            const adminUser = JSON.parse(localStorage.getItem('user'));
            
            // Insert transactions for all selected users
            const insertPromises = selectedUsers.map(user => {
                return supabase
                    .from('hyphen_transactions')
                    .insert([{
                        user_id: user.id,
                        amount: amount,
                        transaction_type: 'MANUAL',
                        source_description: `[관리자 지급] ${finalReason}`,
                        admin_id: adminUser?.id
                    }]);
            });

            const results = await Promise.all(insertPromises);
            
            // Check for errors
            for (const res of results) {
                if (res.error) throw res.error;
            }
            
            alert('포인트가 모두 지급되었습니다!');
            
            // Reset form
            setSelectedUsers([]);
            setSearchTerm('');
            setSelectedSubItem('');
            setCustomReason('');
            
            // Refresh history
            fetchData();
        } catch (error) {
            console.error('포인트 지급 오류:', error);
            alert('오류가 발생했습니다.');
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8 bg-gray-50/30">
            {/* Left Column: Form */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                
                {/* 1. 지급 대상 학생 선택 */}
                <div>
                    <h3 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block"></span>
                        지급 대상 학생 선택
                    </h3>
                    
                    {/* Selected Chips */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3 bg-blue-50/30 p-3 rounded-2xl border border-blue-100/50">
                            {selectedUsers.map(user => (
                                <span 
                                    key={user.id}
                                    className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1 rounded-xl text-xs font-bold shadow-sm"
                                >
                                    {user.name} ({user.school})
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveUser(user.id)}
                                        className="hover:text-red-600 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="학생 이름, 학교, 혹은 번호 뒷 4자리 검색"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-medium"
                            autoComplete="off"
                            name="student-search-manual-points"
                        />
                        
                        {searchTerm.length > 0 && (
                            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white max-h-60 overflow-y-auto shadow-lg absolute z-30 left-0 right-0 top-full mt-1.5 w-full">
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map(u => (
                                        <div 
                                            key={u.id}
                                            onClick={() => handleSelectUser(u)}
                                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center justify-between"
                                        >
                                            <div>
                                                <span className="font-bold text-gray-900">{u.name}</span>
                                                <span className="text-xs text-blue-600 font-bold ml-2">{u.user_group}</span>
                                            </div>
                                            <span className="text-sm text-gray-400 font-medium">{u.school}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-gray-400 text-sm font-medium">검색 결과가 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. 지급 사유 (지급할 하이픈보다 위에 오도록 스왑) */}
                <div>
                    <h3 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-pink-500 rounded-full inline-block"></span>
                        지급 사유
                    </h3>
                    
                    {/* Big Categories */}
                    <div className="grid grid-cols-5 gap-1.5 mb-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                        {Object.keys(CATEGORY_MAP).map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => handleCategoryClick(cat)}
                                className={`py-2 rounded-xl font-bold text-xs transition-all border ${
                                    activeCategory === cat 
                                        ? 'bg-pink-600 text-white border-pink-600 shadow-md shadow-pink-200' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Sub categories */}
                    {activeCategory !== '기타' && (
                        <div className="flex flex-wrap gap-2 mb-3 bg-pink-50/20 p-3 rounded-2xl border border-pink-100/50">
                            {CATEGORY_MAP[activeCategory].items.map(subItem => (
                                <button
                                    key={subItem}
                                    type="button"
                                    onClick={() => handleSubItemClick(subItem)}
                                    className={`px-4 py-2 rounded-xl font-black text-xs transition-all border ${
                                        selectedSubItem === subItem
                                            ? 'bg-pink-100 text-pink-700 border-pink-300 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {subItem} ({CATEGORY_MAP[activeCategory].points}H)
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Custom text input for 기타 */}
                    {activeCategory === '기타' && (
                        <input 
                            type="text"
                            placeholder="직접 사유를 입력해주세요"
                            value={customReason}
                            onChange={e => setCustomReason(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-pink-400 focus:bg-white transition-all text-sm font-medium animate-fade-in"
                        />
                    )}
                </div>

                {/* 3. 지급할 하이픈 */}
                <div>
                    <h3 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-indigo-500 rounded-full inline-block"></span>
                        지급할 하이픈
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {AMOUNTS.map(amt => (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => setAmount(amt)}
                                className={`px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                    amount === amt 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 translate-y-[-2px]' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                +{amt} H
                            </button>
                        ))}
                        <input 
                            type="number" 
                            className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-center outline-none focus:border-indigo-400 font-bold text-sm"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            placeholder="직접입력"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={handleSubmit}
                        disabled={submitLoading || selectedUsers.length === 0}
                        className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 ${
                            submitLoading || selectedUsers.length === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-200 hover:-translate-y-0.5'
                        }`}
                    >
                        {submitLoading ? '처리중...' : (
                            <>
                                <Award size={22} /> 포인트 지급 완료하기 ({selectedUsers.length}명)
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Right Column: History */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col h-[600px]">
                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 shrink-0">
                    <History size={20} className="text-gray-400" />
                    최근 수동 지급 내역
                </h3>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400 font-bold">로딩 중...</div>
                    ) : history.length > 0 ? (
                        history.map(item => (
                            <div key={item.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between hover:bg-gray-100 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-900">{item.users?.name}</span>
                                        <span className="text-xs text-gray-500 font-medium">{item.users?.school}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 font-bold flex items-center gap-1.5">
                                        <CheckCircle2 size={14} className="text-green-500" />
                                        {item.source_description.replace('[관리자 지급] ', '')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-blue-600">+{item.amount}H</span>
                                    <p className="text-[10px] text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl">
                            <History size={32} className="text-gray-300 mb-3" />
                            <p className="text-sm font-bold text-gray-400">아직 수동으로 지급한 내역이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StoreManualPoints;
