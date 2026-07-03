import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { hyphenApi } from '../../../../api/hyphenApi';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import UserAvatar from '../../../common/UserAvatar';

const StoreApprovals = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const data = await hyphenApi.getPendingOrders();
            setOrders(data || []);
        } catch (err) {
            console.error('Failed to fetch pending orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleProcess = async (order, isApproved) => {
        const action = isApproved ? '승인' : '반려';
        if (!window.confirm(`${order.users?.name} 학생의 [${order.hyphen_items?.name}] 신청을 ${action}하시겠습니까?`)) return;

        try {
            const admin = JSON.parse(localStorage.getItem('admin_user'));
            const adminId = admin?.id || 'admin';
            
            await hyphenApi.processOrder(order.id, order.user_id, order.amount, isApproved, adminId, order.hyphen_items?.name);
            
            // Optionally send notification to user
            try {
                const message = isApproved 
                    ? `🎉 [스토어] 신청하신 '${order.hyphen_items?.name}'이(가) 승인되었습니다! (-${order.amount}H)` 
                    : `😢 [스토어] 신청하신 '${order.hyphen_items?.name}'이(가) 관리자에 의해 반려되었습니다. 포인트가 차감되지 않습니다.`;

                await supabase.from('messages').insert([{
                    sender_id: adminId,
                    receiver_id: order.user_id,
                    content: message
                }]);
            } catch (e) { console.error('Message send failed', e); }

            alert(`정상적으로 ${action} 처리되었습니다.`);
            fetchOrders();
        } catch (err) {
            console.error(err);
            alert(`${action} 처리 실패: ` + err.message);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400 font-bold">승인 대기열 정보를 불러오는 중입니다...</div>;

    if (orders.length === 0) {
        return (
            <div className="p-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} className="text-gray-300" />
                </div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight">모든 요청이 처리되었습니다</h3>
                <p className="text-sm text-gray-500 font-medium mt-1">승인 대기 중인 주문이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                승인 대기 중인 요청
                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-black">{orders.length}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl"></div>
                        
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <UserAvatar user={order.users} size="w-10 h-10" />
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">{order.users?.name}</h4>
                                    <p className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                                        {order.users?.school || '학교 미상'}
                                    </p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                                <Clock size={12} /> {new Date(order.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
                            <p className="text-xs font-bold text-gray-500 mb-1">신청 항목</p>
                            <div className="flex justify-between items-end">
                                <p className="font-black text-gray-800">{order.hyphen_items?.name}</p>
                                <p className="text-sm font-black text-blue-600">{order.amount} H</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleProcess(order, false)}
                                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-sm"
                            >
                                <XCircle size={16} /> 반려
                            </button>
                            <button 
                                onClick={() => handleProcess(order, true)}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-blue-500 transition-colors text-sm shadow-md"
                            >
                                <CheckCircle size={16} /> 승인
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StoreApprovals;
