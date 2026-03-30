import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { hyphenApi } from '../../../../api/hyphenApi';
import { Plus, Minus, Send } from 'lucide-react';

const UserHyphenTab = ({ user, adminId, fetchData }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [manualAmount, setManualAmount] = useState('');
    const [manualReason, setManualReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState('ADD'); // ADD or SUBTRACT

    useEffect(() => {
        if (user) {
            fetchHistory();
        }
    }, [user]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('hyphen_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (err) {
            console.error('Failed to fetch hyphen history:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleManualAdjustment = async (e) => {
        e.preventDefault();
        const amt = parseInt(manualAmount, 10);
        if (isNaN(amt) || amt <= 0) {
            alert('올바른 금액을 입력하세요.');
            return;
        }
        if (!manualReason.trim()) {
            alert('조정 사유를 입력하세요.');
            return;
        }

        const finalAmount = adjustmentType === 'ADD' ? amt : -amt;

        setIsSubmitting(true);
        try {
            await hyphenApi.manualAdjustment(user.id, finalAmount, manualReason, adminId);
            setManualAmount('');
            setManualReason('');
            await fetchHistory();
            if (fetchData) fetchData(); // Refresh AdminUsers to update current_hyphen
            alert('조정되었습니다.');
        } catch (err) {
            console.error(err);
            alert('조정 실패: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-5 space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-blue-800">현재 잔여 하이픈</h3>
                    <p className="text-[10px] text-blue-500 font-medium">자동으로 계산된 포인트 잔액입니다.</p>
                </div>
                <div className="text-3xl font-black text-blue-600">
                    {user.current_hyphen || 0} <span className="text-lg">H</span>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-hidden">
                <h4 className="text-sm font-bold text-gray-800 mb-3 ml-1">포인트 직접 조정</h4>
                <form onSubmit={handleManualAdjustment} className="space-y-3">
                    <div className="flex gap-2">
                        <select 
                            value={adjustmentType} 
                            onChange={e => setAdjustmentType(e.target.value)}
                            className={`p-2 rounded-xl border text-sm font-bold outline-none flex-shrink-0 transition-colors ${adjustmentType === 'ADD' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-red-50 text-red-600 border-red-200'}`}
                        >
                            <option value="ADD">지급 (+)</option>
                            <option value="SUBTRACT">차감 (-)</option>
                        </select>
                        <input
                            type="number"
                            min="1"
                            placeholder="포인트"
                            value={manualAmount}
                            onChange={e => setManualAmount(e.target.value)}
                            className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-bold text-sm"
                            required
                        />
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="조정 사유 (예: 선행상, 이벤트 당첨)"
                            value={manualReason}
                            onChange={e => setManualReason(e.target.value)}
                            className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-4 flex items-center justify-center rounded-xl font-bold text-white transition-all shadow-sm ${adjustmentType === 'ADD' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-500 hover:bg-red-400'} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? '처리중' : (adjustmentType === 'ADD' ? '지급' : '차감')}
                        </button>
                    </div>
                </form>
            </div>

            <div>
                <h4 className="text-sm font-bold text-gray-800 mb-3 ml-1">하이픈 내역</h4>
                {loading ? (
                    <div className="py-10 text-center text-xs text-gray-400 font-bold">내역을 불러오는 중...</div>
                ) : history.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400 font-bold bg-gray-50 rounded-2xl border border-gray-100">이력이 없습니다.</div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {history.map(item => (
                            <div key={item.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-gray-700 truncate">{item.source_description}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                                </div>
                                <div className={`font-black ml-3 whitespace-nowrap ${item.amount > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                    {item.amount > 0 ? '+' : ''}{item.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserHyphenTab;
