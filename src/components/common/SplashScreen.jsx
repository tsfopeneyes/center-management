import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ finishLoading }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(finishLoading, 500); // Give time for exit animation
        }, 1500); // Show for 1.5 seconds

        return () => clearTimeout(timer);
    }, [finishLoading]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] bg-[#4338ca] flex flex-col items-center justify-center text-white"
                >
                    {/* Simplified Decorative Background */}
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.1, 0.15, 0.1]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-80 h-80 bg-white rounded-full opacity-10 gpu-accelerated"
                        style={{ filter: 'blur(80px)' }}
                    />

                    <div className="relative z-10 flex flex-col items-center">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="bg-white/10 p-6 rounded-[2.5rem] mb-8"
                        >
                            <img src="/logo.jpg" alt="Logo" className="w-24 h-24 rounded-3xl object-cover" />
                        </motion.div>

                        <motion.h1
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="text-4xl font-black tracking-tighter mb-2"
                        >
                            SCI CENTER
                        </motion.h1>

                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.8, delay: 0.5, ease: "circOut" }}
                            className="h-1 w-12 bg-white/40 rounded-full mb-4"
                        />

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.8 }}
                            transition={{ duration: 0.6, delay: 0.7 }}
                            className="text-blue-100 font-bold tracking-widest uppercase text-sm"
                        >
                            우리가 교회다 ⛪
                        </motion.p>
                    </div>

                    {/* Loading indicator at bottom */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.9 }}
                        className="absolute bottom-12 flex flex-col items-center gap-2"
                    >
                        <div className="flex gap-1.5">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [0.3, 1, 0.3]
                                    }}
                                    transition={{
                                        duration: 0.8,
                                        repeat: Infinity,
                                        delay: i * 0.15
                                    }}
                                    className="w-1.5 h-1.5 bg-white rounded-full"
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
