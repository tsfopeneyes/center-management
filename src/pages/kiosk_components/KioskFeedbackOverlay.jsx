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
                    className={`absolute z-50 p-8 sm:p-14 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl flex flex-col items-center text-center min-w-[320px] sm:min-w-[420px] max-w-[90vw] transition-all duration-300 ${
                        isSuccess 
                            ? 'bg-[#f4f8ff] border border-blue-100 text-slate-800' 
                            : `${result.color} text-white`
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
                                ? <CheckCircle size={64} className="sm:w-20 sm:h-20 text-blue-600" strokeWidth={2.5} />
                                : <AlertCircle size={64} className="sm:w-20 sm:h-20 text-white" strokeWidth={2.5} />
                        )}
                    </div>
                    <h2 className={`text-2xl sm:text-3.5xl font-black mb-2 tracking-tight ${isSuccess ? 'text-slate-900' : 'text-white'}`}>
                        {result.message}
                    </h2>
                    <p className={`text-sm sm:text-base font-bold whitespace-pre-line leading-relaxed max-w-sm ${isSuccess ? 'text-slate-500' : 'opacity-90'}`}>
                        {result.subMessage}
                    </p>
                    <div className={`w-full h-1 sm:h-1.5 mt-6 sm:mt-8 rounded-full overflow-hidden ${isSuccess ? 'bg-blue-100' : 'bg-white/30'}`}>
                        <motion.div 
                            initial={{ x: '-100%' }} 
                            animate={{ x: '0%' }} 
                            transition={{ duration: isSuccess ? 0.5 : 1.5, ease: "linear" }} 
                            className={`h-full ${isSuccess ? 'bg-blue-600' : 'bg-white'}`} 
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default KioskFeedbackOverlay;
