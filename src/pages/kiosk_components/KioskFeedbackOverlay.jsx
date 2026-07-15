import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

const KioskFeedbackOverlay = ({ result }) => {
    const isSuccess = result?.type === 'SUCCESS';

    return (
        <AnimatePresence>
            {result && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.2, y: -50 }}
                    className={`absolute z-50 p-8 sm:p-12 rounded-[2.5rem] flex flex-col items-center text-center min-w-[340px] sm:min-w-[440px] max-w-[95vw] transition-all duration-300 ${
                        isSuccess 
                            ? 'bg-white border border-slate-100 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)]' 
                            : `${result.color} text-white shadow-2xl`
                    }`}
                >
                    <div className="mb-4 sm:mb-6">
                        {result.badge && result.badge.image_url ? (
                            <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full p-2 shadow-xl border-4 border-yellow-300 overflow-hidden"
                            >
                                <img src={result.badge.image_url} alt="badge" className="w-full h-full object-cover" />
                            </motion.div>
                        ) : (
                            isSuccess 
                                ? <CheckCircle size={64} className="text-blue-500" strokeWidth={2.5} />
                                : <AlertCircle size={64} className="sm:w-20 sm:h-20 text-white" strokeWidth={2.5} />
                        )}
                    </div>
                    <h2 className={`text-xl sm:text-2xl font-bold tracking-tight mb-4 ${isSuccess ? 'text-slate-800' : 'text-white'}`}>
                        {result.message}
                    </h2>
                    
                    {isSuccess && result.todayEarned !== undefined ? (
                        <>
                            {/* Receipt Style summary Card */}
                            <div className="bg-[#f8fafc] border border-slate-100/80 rounded-2xl p-4.5 my-1.5 w-full max-w-[360px] text-left text-xs flex flex-col gap-3.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold">오늘 적립</span>
                                    <span className="text-blue-600 font-black text-sm">+{result.todayEarned}H</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold">누적 잔액</span>
                                    <span className="text-slate-800 font-black text-sm">{result.balance}H</span>
                                </div>
                                
                                <div className="border-t border-dashed border-slate-200/80 my-0.5" />
                                
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold">이번 주 운영일</span>
                                    <span className="text-slate-600 font-extrabold">{result.openDaysText}</span>
                                </div>
                            </div>
                            
                            {/* Footer warm message */}
                            {result.footerMsg && (
                                <p className="text-[11px] sm:text-xs font-bold text-slate-400 mt-4 tracking-tight">
                                    {result.footerMsg}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className={`text-sm sm:text-base font-bold whitespace-pre-line leading-relaxed max-w-sm ${isSuccess ? 'text-slate-500' : 'opacity-90'}`}>
                                {result.subMessage}
                            </p>
                            <div className="w-full h-1 sm:h-1.5 mt-6 sm:mt-8 rounded-full overflow-hidden bg-white/30">
                                <motion.div 
                                    initial={{ x: '-100%' }} 
                                    animate={{ x: '0%' }} 
                                    transition={{ duration: 1.5, ease: "linear" }} 
                                    className="h-full bg-white" 
                                />
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default KioskFeedbackOverlay;
