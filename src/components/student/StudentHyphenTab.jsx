import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { hyphenApi } from '../../api/hyphenApi';
import { Wallet, Store, ShieldAlert, History, ChevronRight, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import HyphenHistoryModal from './modals/HyphenHistoryModal';
import VerificationWriteModal from './modals/VerificationWriteModal';
import PurchaseReceiptModal from './modals/PurchaseReceiptModal';

const StudentHyphenTab = ({ user, handleDeleteGuestPost, uploadingGuest, 
    notifyParentRefresh, openGuestPostDetail,
    setShowVerificationWrite, setEditVerificationPost, refreshTrigger
}) => {
    const [showHistory, setShowHistory] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [storeItems, setStoreItems] = useState([]);
    const [verificationHistory, setVerificationHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const pullData = async () => {
        setLoading(true);
        try {
            const { data: itemsRes, error: itemsErr } = await supabase
                .from('hyphen_items')
                .select('*')
                .eq('is_active', true)
                .order('item_type', { ascending: false })
                .order('amount', { ascending: true });
            
            // fetch from guest_posts
            const { data: history, error: historyErr } = await supabase
                .from('guest_posts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (itemsErr) throw itemsErr;
            if (historyErr) throw historyErr;

            setStoreItems(itemsRes || []);
            setVerificationHistory(history || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        pullData();
    }, [user.id, refreshTrigger]);

    const handlePurchase = async (item) => {
        if (user.current_hyphen < item.amount) {
            alert(`하이픈이 부족합니다. (필요: ${item.amount}H, 현재: ${user.current_hyphen || 0}H)`);
            return;
        }

        const msg = item.requires_approval
            ? `'${item.name}' 항목을 신청하시겠습니까? (관리자 승인 후 완료됩니다)`
            : `'${item.name}' 항목을 구매하시겠습니까? (${item.amount}H 차감)`;

        if (!window.confirm(msg)) return;

        setIsProcessing(true);
        try {
            await hyphenApi.createOrder(user.id, item.id, item.amount, item.requires_approval, item.name);
            if (notifyParentRefresh) notifyParentRefresh(); // Refresh user data to update current_hyphen
            pullData(); // Refresh history and items
            
            if (!item.requires_approval) {
                // Instantly pop up receipt
                setReceiptData({
                    source_description: `[스토어 교환] ${item.name}`,
                    amount: -Math.abs(item.amount),
                    created_at: new Date().toISOString()
                });
            } else {
                alert('신청이 접수되었습니다. 관리자 승인을 기다려주세요.');
            }
        } catch (err) {
            console.error(err);
            alert('요청 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    const earnItems = storeItems.filter(i => i.item_type === 'EARN');
    const spendItems = storeItems.filter(i => i.item_type === 'SPEND');

    return (
        <div className="animate-fade-in pb-32">
            {receiptData && <PurchaseReceiptModal transaction={receiptData} onClose={() => setReceiptData(null)} />}
            <div className="px-5 pt-4 pb-6 sticky top-0 bg-gray-50/90 backdrop-blur-xl z-20 flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Store size={26} className="text-blue-600" />
                    하이픈 스토어
                </h2>
                <button 
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <History size={14} /> 내역 보기
                </button>
            </div>

            {/* Wallet Card */}
            <div className="px-5 mb-8">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2rem] p-6 shadow-xl relative overflow-hidden text-white">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-400/20 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-8 opacity-90">
                           {/*  Removed MY WALLET text */}
                        </div>
                        <div>
                            <p className="text-blue-200 font-medium text-xs mb-1">현재 사용 가능한 하이픈</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black tracking-tighter">{user.current_hyphen || 0}</span>
                                <span className="text-2xl font-bold text-blue-300">H</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-400 font-bold">스토어 정보를 불러오는 중...</div>
            ) : (
                <div className="px-5 space-y-10">
                    {/* Content Verification Section */}
                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                <span className="w-2 h-6 bg-blue-500 rounded-full inline-block"></span>
                                하이픈 적립
                            </h3>
                        </div>
                        
                        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                            <button 
                                onClick={() => {
                                    setEditVerificationPost(null);
                                    setShowVerificationWrite(true);
                                }}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-base shadow-md shadow-blue-200 flex justify-center items-center gap-2 transition-transform active:scale-95"
                            >
                                <CheckCircle2 size={20} /> 콘텐츠 참여 인증
                            </button>
                            
                            {/* Verification History */}
                            <div className="mt-5 space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider pl-1">
                                    <FileSpreadsheet size={14} /> 나의 인증 내역
                                </h4>
                                {verificationHistory.length > 0 ? (
                                    <div className="space-y-2">
                                        {verificationHistory.map((v, i) => {
                                            const categoryMatch = v.content.match(/^\[(.*?)\]/);
                                            const title = categoryMatch ? `[${categoryMatch[1]}] 콘텐츠 인증` : '콘텐츠 인증';
                                            return (
                                                <div 
                                                    key={i} 
                                                    onClick={() => openGuestPostDetail(v)}
                                                    className="flex justify-between items-center bg-gray-50/80 px-4 py-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden border border-blue-200">
                                                            {v.images?.length > 0 || v.image_url ? (
                                                                <img src={v.images?.[0] || v.image_url} alt="snap" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <CheckCircle2 size={14} className="text-blue-600" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-sm text-gray-700 truncate">{title}</span>
                                                            <span className="text-[10px] text-gray-400 font-bold truncate">{v.content.replace(/^\[.*?\]\s*/, '')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0 ml-2">
                                                        <span className="text-xs font-black text-blue-600">+1H</span>
                                                        <span className="text-[9px] text-gray-400 font-bold mt-0.5">{new Date(v.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <p className="text-sm font-bold text-gray-400">아직 인증 내역이 없습니다!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Spend Items Section */}
                    {spendItems.length > 0 && (
                        <div>
                            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                                <span className="w-2 h-6 bg-orange-400 rounded-full inline-block"></span>
                                사용하기
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {spendItems.map(item => {
                                    const canAfford = user.current_hyphen >= item.amount;
                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => canAfford && !isProcessing && handlePurchase(item)}
                                            className={`bg-white p-4 rounded-[1.5rem] border shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col items-center text-center gap-3 relative overflow-hidden group transition-all ${
                                                canAfford && !isProcessing ? 'cursor-pointer hover:-translate-y-1 hover:border-blue-200' : 'opacity-70 border-gray-50'
                                            }`}
                                        >
                                            {item.requires_approval && (
                                                <div className="absolute top-2 right-2 flex items-center bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100">
                                                    <ShieldAlert size={10} className="text-red-500 mr-1" />
                                                    <span className="text-[9px] font-bold text-red-600 tracking-tight">승인 필요</span>
                                                </div>
                                            )}

                                            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center p-2 shrink-0 border border-gray-100 mt-2">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl shadow-sm" />
                                                ) : (
                                                    <Store size={24} className="text-gray-300" />
                                                )}
                                            </div>
                                            
                                            <div className="w-full flex-1 flex flex-col justify-end">
                                                <h4 className="font-black text-gray-800 text-[13px] leading-tight mb-1 min-h-[2.5rem] flex items-center justify-center">
                                                    <span className="line-clamp-2">{item.name}</span>
                                                </h4>
                                                <p className={`text-xl font-black tracking-tighter ${canAfford ? 'text-blue-600' : 'text-gray-400'}`}>
                                                    {item.amount}<span className="text-xs ml-0.5">H</span>
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showHistory && (
                <HyphenHistoryModal 
                    user={user} 
                    onClose={() => setShowHistory(false)} 
                />
            )}
        </div>
    );
};

export default StudentHyphenTab;
