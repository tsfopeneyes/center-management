import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { haifnApi } from '../../api/haifnApi';
import { Wallet, Store, ShieldAlert, History, ChevronRight, CheckCircle2, FileSpreadsheet, Search } from 'lucide-react';
import HaifnHistoryModal from './modals/HaifnHistoryModal';
import PurchaseReceiptModal from './modals/PurchaseReceiptModal';

const StudentHaifnTab = ({ user, notifyParentRefresh, refreshTrigger }) => {
    const [showHistory, setShowHistory] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [storeItems, setStoreItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const categories = ['전체', '음료', '간식', '사용', '대관', '기타'];

    const pullData = async () => {
        setLoading(true);
        try {
            const { data: itemsRes, error: itemsErr } = await supabase
                .from('haifn_items')
                .select('*')
                .eq('is_active', true)
                .order('item_type', { ascending: false })
                .order('amount', { ascending: true });
            
            if (itemsErr) throw itemsErr;

            setStoreItems(itemsRes || []);
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
        if (user.current_haifn < item.amount) {
            alert(`하이픈이 부족합니다. (필요: ${item.amount}H, 현재: ${user.current_haifn || 0}H)`);
            return;
        }

        const msg = item.requires_approval
            ? `'${item.name}' 교환을 신청하시겠습니까?\n(관리자 승인 후 차감됩니다)`
            : `'${item.name}' 항목을 교환하시겠습니까?\n(${item.amount}H 차감)`;

        if (!window.confirm(msg)) return;

        setIsProcessing(true);
        try {
            await haifnApi.createOrder(user.id, item.id, item.amount, item.requires_approval, item.name);
            if (notifyParentRefresh) notifyParentRefresh(); // Refresh user data to update current_haifn
            pullData(); // Refresh history and items
            
            if (!item.requires_approval) {
                // Instantly pop up receipt
                setReceiptData({
                    source_description: `[스토어 교환] ${item.name}`,
                    amount: -Math.abs(item.amount),
                    created_at: new Date().toISOString(),
                    image_url: item.image_url
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

    const filteredItems = storeItems.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const spendItems = filteredItems.filter(i => {
        if (i.item_type !== 'SPEND') return false;
        if (selectedCategory !== '전체') return i.category === selectedCategory;
        return true;
    });

    return (
        <div className="animate-fade-in pb-32">
            {receiptData && <PurchaseReceiptModal transaction={receiptData} onClose={() => setReceiptData(null)} />}
            
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-tossGrey50/95 backdrop-blur-xl z-20 border-b border-tossGrey200/50 mb-6">
                
                {/* Title & Points Row */}
                <div className="flex flex-wrap sm:flex-nowrap items-end justify-between gap-2 mb-4">
                    <h2 className="text-2xl font-bold text-tossGrey900 tracking-tight">
                        하이픈 스토어
                    </h2>
                    
                    <div className="flex items-center gap-1 pb-0.5 select-none">
                        <div className="w-5 h-5 rounded-full bg-tossBlue flex items-center justify-center shadow-toss-subtle border border-tossBlue/20">
                            <span className="font-bold text-white text-[11px] italic pr-[1.5px]">H</span>
                        </div>
                        <span className="text-[13px] font-medium text-tossGrey600 tracking-tight ml-0.5">포인트</span>
                        <span className="text-lg font-bold text-tossBlue ml-1">{user.current_haifn || 0}</span>
                        <span className="text-[13px] font-medium text-tossGrey600">개</span>
                    </div>
                </div>
                
                {/* Search Bar & History Row */}
                <div className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tossGrey400" />
                        <input 
                            type="text" 
                            placeholder="스토어 아이템 검색..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-tossGrey200 rounded-toss-xl py-2 pl-10 pr-4 text-sm font-medium text-tossGrey800 placeholder-tossGrey400 focus:outline-none focus:border-tossBlue focus:ring-1 focus:ring-tossBlue shadow-toss-subtle transition-shadow"
                        />
                    </div>

                    {/* History */}
                    <button 
                        onClick={() => setShowHistory(true)}
                        className="flex shrink-0 items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-tossGrey200 rounded-toss-xl text-[13px] font-bold text-tossGrey700 hover:bg-tossGrey50 transition-colors shadow-toss-subtle"
                    >
                        <History size={15} className="text-tossGrey500" /> 
                        <span>구매내역</span>
                    </button>
                </div>
                
                {/* Categories Row (TDS Segmented Tab Switcher Style) */}
                <div className="flex bg-tossGrey100 p-1 rounded-[12px] mt-4 overflow-x-auto scrollbar-hide gap-1">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`shrink-0 px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all ${
                                selectedCategory === cat 
                                ? 'bg-white text-tossGrey900 shadow-toss-subtle' 
                                : 'text-tossGrey500 hover:text-tossGrey800'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-tossGrey400 font-bold">스토어 정보를 불러오는 중...</div>
            ) : (
                <div className="px-5 space-y-10">

                    {/* Spend Items Section */}
                    {spendItems.length > 0 && (
                        <div className="flex flex-col gap-2.5">
                            {spendItems.map(item => {
                                const canAfford = user.current_haifn >= item.amount;
                                return (
                                    <div 
                                        key={item.id} 
                                        onClick={() => canAfford && !isProcessing && handlePurchase(item)}
                                        className={`bg-white px-4 py-3.5 rounded-toss-xl flex items-center gap-3.5 relative transition-all shadow-toss-standard hover:shadow-toss-elevated border-none ${
                                            canAfford && !isProcessing ? 'cursor-pointer active:scale-[0.98]' : 'opacity-60 grayscale-[0.3]'
                                        }`}
                                    >
                                        <div className="w-14 h-14 rounded-toss-lg flex items-center justify-center overflow-hidden shrink-0 border border-tossGrey100 relative">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover scale-[1.05]" />
                                            ) : (
                                                <div className="w-full h-full bg-tossGrey50 flex items-center justify-center">
                                                    <Store size={24} className="text-tossGrey300" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-center gap-2 pl-1 mb-1">
                                                <h4 className="font-bold text-tossGrey900 text-[15px] truncate leading-tight">
                                                    {item.name}
                                                </h4>
                                                {item.requires_approval && (
                                                    <span className="text-[9px] font-bold text-tossError bg-tossError/10 px-1.5 py-[2px] rounded-toss-sm shrink-0">
                                                        승인필요
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 pl-1">
                                                <p className={`text-[13px] font-bold tracking-tight ${canAfford ? 'text-tossGrey500' : 'text-tossGrey400'} leading-none`}>
                                                    {item.amount.toLocaleString()} H
                                                </p>
                                                {!canAfford && (
                                                    <span className="text-[10px] font-bold text-tossError bg-tossError/10 px-1.5 py-[1px] rounded-toss-sm leading-none flex items-center h-[16px]">
                                                        포인트 부족
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {showHistory && (
                <HaifnHistoryModal 
                    user={user} 
                    onClose={() => setShowHistory(false)} 
                    storeItems={storeItems}
                />
            )}
        </div>
    );
};

export default StudentHaifnTab;
