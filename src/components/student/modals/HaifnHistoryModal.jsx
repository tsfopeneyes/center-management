import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { X, RefreshCw, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import useModalClose from '../../../hooks/useModalClose';

const HaifnHistoryModal = ({ user, onClose }) => {
    useModalClose(!!user, onClose);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('store_orders')
                .select('*, haifn_items(name, image_url)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (err) {
            console.error('Failed to fetch haifn history:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchHistory();
    }, [user?.id]);

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 shrink-0">
                    <h3 className="text-lg font-black text-gray-800">나의 교환 내역</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto w-full flex-1 p-5 bg-gray-50/50 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <RefreshCw className="animate-spin text-[#CF3A27]" size={24} />
                            <p className="font-bold text-gray-400 text-sm">기록을 불러오는 중...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                                <ShoppingBag size={32} className="text-gray-300" />
                            </div>
                            <h4 className="font-black text-gray-800">아직 교환 내역이 없어요</h4>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">스토어에서 원하는 상품을 교환하면<br/>이곳에서 확인할 수 있어요.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                        {item.haifn_items?.image_url ? <img src={item.haifn_items.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ShoppingBag size={22} className="text-gray-300" /></div>}
                                    </div>
                                    <div className="flex min-w-0 flex-1 items-center justify-between">
                                        <div className="min-w-0 pr-4">
                                            <p className="font-black text-gray-800 text-sm mb-1 truncate">{item.haifn_items?.name || '교환 상품'}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">{new Date(item.created_at).toLocaleString()}</p>
                                            <p className={`mt-1 text-[11px] font-bold ${item.status === 'APPROVED' ? 'text-emerald-600' : item.status === 'REJECTED' ? 'text-red-500' : 'text-amber-600'}`}>
                                                {item.status === 'APPROVED' ? '교환 완료' : item.status === 'REJECTED' ? '교환 반려' : '교환 신청'}
                                            </p>
                                        </div>
                                        <div className="text-base font-black whitespace-nowrap text-[#CF3A27]">
                                            {Math.abs(item.amount)} H
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
            
        </div>
    );
};

export default HaifnHistoryModal;
