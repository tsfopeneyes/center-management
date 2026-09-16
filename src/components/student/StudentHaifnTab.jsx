import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { haifnApi } from '../../api/haifnApi';
import { Store, History, CheckCircle2, X } from 'lucide-react';
import HaifnHistoryModal from './modals/HaifnHistoryModal';
import PurchaseReceiptModal from './modals/PurchaseReceiptModal';
import { createPortal } from 'react-dom';
import HaifnPointIcon from './components/HaifnPointIcon';

const StudentHaifnTab = ({ user, notifyParentRefresh, refreshTrigger, tutorialMode = false, tutorialStep = '', previewMode = false, onRegister }) => {
    const [showHistory, setShowHistory] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [storeItems, setStoreItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [exchangeNoticeItem, setExchangeNoticeItem] = useState(null);
    const [tutorialPurchaseItem, setTutorialPurchaseItem] = useState(null);
    const [tutorialPendingItem, setTutorialPendingItem] = useState(null);
    const [tutorialResultItem, setTutorialResultItem] = useState(null);

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

    useEffect(() => {
        if (!selectedItem) return undefined;

        const handleKeyDown = (event) => {
            if (event.key !== 'Escape' || isProcessing) return;
            if (exchangeNoticeItem) setExchangeNoticeItem(null);
            setSelectedItem(null);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, exchangeNoticeItem, isProcessing]);

    const handlePurchase = async (item) => {
        if (previewMode) {
            setSelectedItem(null);
            onRegister?.();
            return;
        }

        const availableHaifn = tutorialMode
            ? Math.max(0, 50 - (tutorialPurchaseItem && !tutorialPurchaseItem.requires_approval ? tutorialPurchaseItem.amount : 0))
            : (user.current_haifn || 0);
        if (availableHaifn < item.amount) {
            alert(`하이픈이 부족합니다. (필요: ${item.amount}H, 현재: ${availableHaifn}H)`);
            return;
        }

        if (tutorialMode) {
            setTutorialPendingItem(item);
            window.dispatchEvent(new CustomEvent('student-onboarding:store-opened', { detail: { item } }));
            return;
        }

        setIsProcessing(true);
        try {
            await haifnApi.createOrder(user.id, item.id, item.amount, item.requires_approval, item.name);
            if (notifyParentRefresh) notifyParentRefresh(); // Refresh user data to update current_haifn
            pullData(); // Refresh history and items
            
            if (!item.requires_approval) {
                setSelectedItem(null);
                // Instantly pop up receipt
                setReceiptData({
                    source_description: `[스토어 교환] ${item.name}`,
                    amount: -Math.abs(item.amount),
                    created_at: new Date().toISOString(),
                    image_url: item.image_url
                });
            } else {
                setExchangeNoticeItem(item);
            }
        } catch (err) {
            console.error(err);
            alert('요청 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    const spendItems = storeItems.filter(i => i.item_type === 'SPEND');

    const confirmTutorialPurchase = () => {
        if (!tutorialPendingItem) return;
        setTutorialPurchaseItem(tutorialPendingItem);
        setTutorialResultItem(tutorialPendingItem);
        setTutorialPendingItem(null);
        window.dispatchEvent(new CustomEvent('student-onboarding:store-purchased', { detail: { item: tutorialPendingItem } }));
    };

    const closeTutorialResult = () => {
        setTutorialResultItem(null);
        window.dispatchEvent(new CustomEvent('student-onboarding:store-result-viewed', { detail: { item: tutorialPurchaseItem } }));
    };

    const displayedHaifn = tutorialMode
        ? Math.max(0, 50 - (tutorialPurchaseItem && !tutorialPurchaseItem.requires_approval ? tutorialPurchaseItem.amount : 0))
        : (user.current_haifn || 0);

    return (
        <div className="animate-fade-in min-h-screen bg-[#F7EFE2] pb-24">
            {receiptData && <PurchaseReceiptModal transaction={receiptData} onClose={() => setReceiptData(null)} />}
            
            <div className="relative mb-5 overflow-hidden rounded-b-[30px] bg-[#CF3A27] px-5 pb-7 pt-6 text-white shadow-[0_8px_24px_rgba(207,58,39,0.18)]">
                <div aria-hidden="true" className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-[#F8DF53]" />
                <div aria-hidden="true" className="absolute -bottom-9 right-16 h-20 w-28 rounded-t-full bg-[#E88AAC]/85" />
                
                <div className="relative z-10">
                    <h2 className="text-[24px] font-black tracking-[-0.04em]">
                        하이픈 스토어
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-white/80">
                        크리스찬 라이프스타일을 경험하는 또 하나의 즐거움
                    </p>
                </div>
                <div className="absolute right-5 top-6 z-10 flex items-center gap-1.5">
                    <div className="flex h-9 items-center gap-1 rounded-full bg-white px-2.5 text-[#191F28] shadow-sm select-none">
                        <HaifnPointIcon size="sm" />
                        <span className="text-[10px] font-bold text-[#71665C]">보유</span>
                        <span className="text-sm font-black text-[#CF3A27]">{displayedHaifn}</span>
                        <span className="text-[10px] font-bold text-[#71665C]">H</span>
                    </div>
                    <button type="button" aria-label="교환 내역 보기" onClick={() => previewMode ? onRegister?.() : setShowHistory(true)} className="flex h-9 items-center justify-center gap-1 rounded-full border border-white bg-white px-2.5 text-[11px] font-bold text-tossGrey700 shadow-sm transition-colors hover:bg-[#FFF8F1]">
                        <History size={14} className="text-tossGrey500" />
                        <span>내역</span>
                    </button>
                </div>
                
            </div>

            {loading ? (
                <div className="py-20 text-center text-tossGrey400 font-bold">스토어 정보를 불러오는 중...</div>
            ) : (
                <div className="px-4 space-y-8">

                    {/* Spend Items Section */}
                    {spendItems.length > 0 && (
                        <div data-tour={tutorialMode ? 'tutorial-store-list' : undefined} className="grid grid-cols-2 gap-3">
                            {spendItems.map((item) => {
                                const canAfford = displayedHaifn >= item.amount;
                                const shortage = Math.max(0, item.amount - displayedHaifn);
                                return (
                                    <div 
                                        key={item.id} 
                                        data-tour={tutorialPurchaseItem?.id === item.id ? 'tutorial-store-result' : undefined}
                                        data-tour-label={item.name}
                                        onClick={() => !isProcessing && setSelectedItem(item)}
                                        className={`bg-white p-3 rounded-[20px] border border-[#E7D8C4] flex min-w-0 flex-col relative transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-toss-elevated ${
                                            !isProcessing ? 'cursor-pointer active:scale-[0.98]' : 'opacity-60'
                                        }`}
                                    >
                                        <div className="aspect-square w-full rounded-[15px] flex items-center justify-center overflow-hidden shrink-0 border border-tossGrey100 relative bg-[#FBF3E7]">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-tossGrey50 flex items-center justify-center">
                                                    <Store size={24} className="text-tossGrey300" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0 flex flex-col justify-center pt-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-extrabold text-tossGrey900 text-[14px] truncate leading-tight">
                                                    {item.name}
                                                </h4>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className={`text-[13px] font-black tracking-tight ${canAfford ? 'text-[#CF3A27]' : 'text-tossGrey400'} leading-none`}>
                                                    {item.amount.toLocaleString()} H
                                                </p>
                                                {!canAfford && <span className="text-[10px] font-bold text-tossGrey500">{shortage.toLocaleString()}H 부족</span>}
                                                {tutorialPurchaseItem?.id === item.id && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-[1px] rounded-toss-sm leading-none flex items-center h-[16px] ${item.requires_approval ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                        {item.requires_approval ? '승인 대기' : '체험 교환 완료'}
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

            {selectedItem && createPortal(
                <div className="fixed inset-0 z-[350] flex items-start justify-center overflow-y-auto bg-black/45 p-5 backdrop-blur-[2px]" onClick={() => !isProcessing && setSelectedItem(null)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="store-item-title" className="relative my-auto w-full max-w-[360px] overflow-hidden rounded-[28px] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button type="button" aria-label="상품 상세 닫기" disabled={isProcessing} onClick={() => setSelectedItem(null)} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 disabled:opacity-50">
                            <X size={18} />
                        </button>
                        <div className="aspect-square w-full shrink-0 bg-[#f7f7f5]">
                            {selectedItem.image_url ? <img src={selectedItem.image_url} alt={selectedItem.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Store size={48} className="text-tossGrey300" /></div>}
                        </div>
                        <div className="px-5 pb-5 pt-5">
                            <div>
                                <div className="border-b border-tossGrey100 pb-4">
                                    <h3 id="store-item-title" className="break-keep text-[21px] font-black leading-[1.35] tracking-[-0.02em] text-tossGrey900">{selectedItem.name}</h3>
                                    <div className="mt-2.5 flex items-center gap-1.5">
                                        <HaifnPointIcon size="lg" />
                                        <span className="text-xl font-black tracking-tight text-[#CF3A27]">{selectedItem.amount.toLocaleString()}</span>
                                        <span className="text-sm font-bold text-tossGrey500">개</span>
                                    </div>
                                </div>
                                <div className="py-4">
                                    <p className="mb-1.5 text-[13px] font-bold text-tossGrey700">상품 설명</p>
                                    <p className="whitespace-pre-wrap break-keep text-sm font-medium leading-[1.65] text-tossGrey600">{selectedItem.description?.trim() || '상품의 세부 설명이 아직 등록되지 않았어요.'}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={isProcessing || (!previewMode && displayedHaifn < selectedItem.amount)}
                                onClick={() => handlePurchase(selectedItem)}
                                className="mt-1 h-[50px] w-full shrink-0 rounded-2xl bg-[#CF3A27] text-[15px] font-black text-white transition-all hover:bg-[#B93223] active:scale-[0.99] disabled:bg-tossGrey200 disabled:text-tossGrey500"
                            >
                                {isProcessing ? '처리 중...' : previewMode ? '등록하고 교환하기' : displayedHaifn < selectedItem.amount ? '하이픈이 부족해요' : selectedItem.requires_approval ? '교환 신청하기' : '교환하기'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {exchangeNoticeItem && createPortal(
                <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="exchange-notice-title" className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F4DDD4] text-2xl">🧾</div>
                        <h3 id="exchange-notice-title" className="mt-4 text-xl font-black text-tossGrey900">교환 신청 완료</h3>
                        <p className="mt-2 break-keep text-sm font-semibold leading-6 text-tossGrey600">2F 인포에 가서 하이픈 교환 내역을 보여주세요!</p>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setExchangeNoticeItem(null);
                                    setSelectedItem(null);
                                    setShowHistory(true);
                                }}
                                className="h-12 rounded-2xl bg-tossGrey100 text-sm font-extrabold text-tossGrey700"
                            >
                                교환 내역
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setExchangeNoticeItem(null);
                                    setSelectedItem(null);
                                }}
                                className="h-12 rounded-2xl bg-[#CF3A27] text-sm font-extrabold text-white"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {tutorialPendingItem && createPortal(
                <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/45 sm:p-5">
                    <div className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] bg-white p-6 shadow-2xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-tossGrey50">
                            {tutorialPendingItem.image_url ? <img src={tutorialPendingItem.image_url} alt="" className="h-full w-full object-cover" /> : <Store size={24} className="text-tossGrey400" />}
                        </div>
                        <h3 className="mt-4 text-center text-xl font-black text-tossGrey900">이 아이템으로 교환할까요?</h3>
                        <p className="mt-2 text-center text-sm font-semibold text-tossGrey600">{tutorialPendingItem.name}</p>
                        <div className="mt-5 flex items-center justify-between rounded-2xl bg-tossGrey50 px-4 py-3">
                            <span className="text-sm font-bold text-tossGrey600">사용할 하이픈</span>
                            <span className="text-base font-black text-[#CF3A27]">{tutorialPendingItem.amount} H</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between rounded-2xl bg-tossGrey50 px-4 py-3">
                            <span className="text-sm font-bold text-tossGrey600">교환 후 예시 잔액</span>
                            <span className="text-base font-black text-tossGrey900">{tutorialPendingItem.requires_approval ? 50 : Math.max(0, 50 - tutorialPendingItem.amount)} H</span>
                        </div>
                        {tutorialPendingItem.requires_approval && (
                            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-bold leading-5 text-amber-700">승인 필요 품목은 관리자 승인 전까지 하이픈이 차감되지 않아요.</p>
                        )}
                        <button
                            type="button"
                            data-tour="tutorial-store-confirm"
                            onClick={confirmTutorialPurchase}
                            className="mt-4 w-full rounded-2xl bg-[#CF3A27] py-4 text-sm font-black text-white"
                        >
                            체험으로 교환하기
                        </button>
                        <p className="mt-3 text-center text-[11px] font-medium text-tossGrey500">실제 하이픈과 재고는 차감되지 않습니다.</p>
                    </div>
                </div>,
                document.body
            )}

            {tutorialResultItem && createPortal(
                <div className="fixed inset-0 z-[420] flex items-end justify-center bg-black/55 sm:items-center sm:p-5">
                    <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 text-center shadow-2xl sm:rounded-[28px]">
                        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${tutorialResultItem.requires_approval ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            <CheckCircle2 size={34} />
                        </div>
                        <h3 className="mt-4 text-xl font-black text-tossGrey900">{tutorialResultItem.requires_approval ? '교환 신청이 완료됐어요' : '교환이 완료됐어요'}</h3>
                        <p className="mt-2 text-sm font-semibold text-tossGrey600">{tutorialResultItem.name}</p>
                        <div className="mt-5 space-y-2 rounded-2xl bg-tossGrey50 p-4 text-sm font-bold">
                            <div className="flex justify-between text-tossGrey600"><span>사용 하이픈</span><span>{tutorialResultItem.requires_approval ? '승인 후 차감' : `${tutorialResultItem.amount} H`}</span></div>
                            <div className="flex justify-between text-tossGrey900"><span>남은 예시 잔액</span><span>{tutorialResultItem.requires_approval ? 50 : Math.max(0, 50 - tutorialResultItem.amount)} H</span></div>
                            <div className="flex justify-between"><span className="text-tossGrey600">상태</span><span className={tutorialResultItem.requires_approval ? 'text-amber-700' : 'text-emerald-700'}>{tutorialResultItem.requires_approval ? '승인 대기' : '교환 완료'}</span></div>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold text-tossGrey500">실제 하이픈과 재고는 변경되지 않았어요.</p>
                        <button type="button" onClick={closeTutorialResult} className="mt-5 w-full rounded-2xl bg-[#CF3A27] py-4 text-sm font-black text-white">목록에서 상태 확인하기</button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default StudentHaifnTab;
