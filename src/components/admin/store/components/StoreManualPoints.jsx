import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Search, UserPlus, History, Award, CheckCircle2 } from 'lucide-react';

const AMOUNTS = [1, 3, 5, 10, 15, 20, 30];
const REASONS = ['친구 초대', '봉사', '스쿨처치 창립', '이벤트 당첨', '기타 (직접 입력)'];

const StoreManualPoints = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [amount, setAmount] = useState(5);
    const [reasonType, setReasonType] = useState('친구 초대');
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
        fetchData();
    }, []);

    const filteredUsers = users.filter(u => 
        u.name?.includes(searchTerm) || 
        u.school?.includes(searchTerm) || 
        (u.phone_back4 && u.phone_back4.includes(searchTerm))
    );

    const handleSubmit = async () => {
        if (!selectedUser) {
            alert('학생을 선택해주세요.');
            return;
        }
        if (!amount || amount <= 0) {
            alert('지급할 포인트를 확인해주세요.');
            return;
        }
        
        const finalReason = reasonType === '기타 (직접 입력)' ? customReason : reasonType;
        if (!finalReason.trim()) {
            alert('지급 사유를 입력해주세요.');
            return;
        }

        if (!confirm(`'${selectedUser.name}' 학생에게 [${finalReason}] 사유로 ${amount}H를 지급하시겠습니까?`)) return;

        setSubmitLoading(true);
        try {
            const adminUser = JSON.parse(localStorage.getItem('user'));
            
            const { error } = await supabase
                .from('hyphen_transactions')
                .insert([{
                    user_id: selectedUser.id,
                    amount: amount,
                    transaction_type: 'MANUAL',
                    source_description: `[관리자 지급] ${finalReason}`,
                    admin_id: adminUser?.id
                }]);

            if (error) throw error;
            
            alert('포인트가 지급되었습니다!');
            
            // Reset form
            setSelectedUser(null);
            setSearchTerm('');
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
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-8">
                <div>
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block"></span>
                        지급 대상 학생 선택
                    </h3>
                    
                    {selectedUser ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-gray-900">{selectedUser.name} <span className="text-xs text-blue-600 font-bold ml-1">{selectedUser.user_group}</span></h4>
                                <p className="text-sm text-gray-500 mt-0.5">{selectedUser.school} • {selectedUser.phone_back4 || '번호없음'}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedUser(null)}
                                className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-100 transition-colors"
                            >
                                창닫기/다시선택
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="학생 이름, 학교, 혹은 번호 뒷 4자리 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-medium"
                                />
                            </div>
                            
                            {searchTerm.length > 0 && (
                                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white max-h-60 overflow-y-auto shadow-lg absolute z-10 w-full md:w-auto left-6 right-6 md:static">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(u => (
                                            <div 
                                                key={u.id}
                                                onClick={() => {
                                                    setSelectedUser(u);
                                                    setSearchTerm('');
                                                }}
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
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
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

                <div>
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-pink-500 rounded-full inline-block"></span>
                        지급 사유
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {REASONS.map(reason => (
                            <button
                                key={reason}
                                type="button"
                                onClick={() => setReasonType(reason)}
                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                                    reasonType === reason 
                                        ? 'bg-pink-600 text-white border-pink-600 shadow-md shadow-pink-200' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    {reasonType === '기타 (직접 입력)' && (
                        <input 
                            type="text"
                            placeholder="사유를 입력해주세요"
                            value={customReason}
                            onChange={e => setCustomReason(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-pink-400 focus:bg-white transition-all text-sm font-medium"
                        />
                    )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={handleSubmit}
                        disabled={submitLoading || !selectedUser}
                        className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 ${
                            submitLoading || !selectedUser 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-200'
                        }`}
                    >
                        {submitLoading ? '처리중...' : (
                            <>
                                <Award size={22} /> 포인트 지급 완료하기
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
