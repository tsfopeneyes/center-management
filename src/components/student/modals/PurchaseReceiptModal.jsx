import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';

const PurchaseReceiptModal = ({ transaction, onClose }) => {
    if (!transaction) return null;

    // Remove prefix like "[스토어 교환] " if it exists
    const itemName = transaction.source_description.replace('[스토어 교환] ', '').replace('[관리자 지급] ', '');
    
    // Format the date carefully for a gigantic, easy-to-read timestamp
    const dateObj = new Date(transaction.created_at);
    const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative overflow-hidden animate-slide-up">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/5 text-gray-500 rounded-full hover:bg-black/10 transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Ticket Top */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-500 pt-10 pb-8 px-6 text-center relative">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white">
                        <CheckCircle2 size={32} className="text-white" />
                    </div>
                    <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full mb-3 backdrop-blur-md">
                        스토어 교환권
                    </span>
                    <h3 className="text-3xl font-black text-white tracking-tight break-keep">
                        {itemName}
                    </h3>
                </div>

                {/* Perforated Line */}
                <div className="relative h-4 bg-white overflow-hidden -mt-2">
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-gray-200" />
                        ))}
                    </div>
                </div>

                {/* Ticket Details */}
                <div className="px-6 py-8 bg-white text-center">
                    <p className="text-sm font-bold text-gray-400 mb-1">사용된 하이픈</p>
                    <p className="text-4xl font-black text-blue-600 mb-8">
                        {Math.abs(transaction.amount)}<span className="text-xl">H</span>
                    </p>

                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">교환 일시 (확인용)</p>
                        <p className="text-2xl font-black text-gray-800 tracking-tighter">
                            {dateStr}
                        </p>
                        <p className="text-3xl font-black text-indigo-600 tracking-tight mt-1">
                            {timeStr}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <button 
                        onClick={onClose}
                        className="w-full py-4 text-center font-bold text-gray-600 hover:text-gray-900 transition-colors active:scale-95"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseReceiptModal;
