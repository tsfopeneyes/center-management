import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

const KioskFeedbackOverlay = ({ result }) => {
    return (
        <AnimatePresence>
            {result && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.2, y: -50 }}
                    className={`absolute z-50 p-8 sm:p-16 rounded-[2.5rem] sm:rounded-[4rem] shadow-2xl flex flex-col items-center text-center text-white ${result.color} min-w-[300px] sm:min-w-[400px] max-w-[90vw]`}
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
                            result.type === 'SUCCESS' ? <CheckCircle size={64} className="sm:w-24 sm:h-24" strokeWidth={2.5} /> : <AlertCircle size={64} className="sm:w-24 sm:h-24" strokeWidth={2.5} />
                        )}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black mb-1 sm:mb-2 tracking-tighter">{result.message}</h2>
                    <p className="text-sm sm:text-xl font-black opacity-80">{result.subMessage}</p>
                    <div className="w-full h-1 sm:h-1.5 bg-white/30 mt-6 sm:mt-10 rounded-full overflow-hidden">
                        <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: result.type === 'SUCCESS' ? 0.5 : 1.5, ease: "linear" }} className="h-full bg-white" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default KioskFeedbackOverlay;
