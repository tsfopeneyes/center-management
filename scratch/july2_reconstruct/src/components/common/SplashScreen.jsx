import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ finishLoading }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Total duration is 2.5 seconds to give time for all animations to play nicely
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(finishLoading, 800); // 0.8s for smooth exit dissolve
        }, 2200);

        return () => clearTimeout(timer);
    }, [finishLoading]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }} // Slower, smoother exit
                    className="fixed inset-0 z-[9999] bg-[#4338ca] flex flex-col items-center justify-center text-white overflow-hidden"
                >
                    {/* Atmospheric background glow (A subtle, premium touch) */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-96 h-96 bg-indigo-400 rounded-full blur-[100px] pointer-events-none"
                    />

                    <div className="relative z-10 flex flex-col items-center">
                        {/* Logo Container */}
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.9 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} // Spring-like ease out
                            className="bg-white p-1 rounded-[2.5rem] shadow-2xl mb-8"
                        >
                            <img src="/logo.jpg" alt="SCI CENTER Logo" className="w-24 h-24 rounded-[2rem] object-cover" />
                        </motion.div>

                        {/* App Title */}
                        <motion.h1
                            initial={{ y: 15, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                            className="text-4xl font-extrabold tracking-tight mb-2"
                        >
                            SCI CENTER
                        </motion.h1>

                        {/* Elegant Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, letterSpacing: "0px" }}
                            animate={{ opacity: 0.8, letterSpacing: "4px" }}
                            transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                            className="text-indigo-100 font-medium uppercase text-xs sm:text-sm pl-1" // pl-1 helps center tracking
                        >
                            우리가 교회다
                        </motion.p>
                    </div>

                    {/* Progress Line (Sleek indicator instead of blinking dots) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                        className="absolute bottom-16 w-32 h-1 bg-indigo-900/50 rounded-full overflow-hidden"
                    >
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="w-1/2 h-full bg-indigo-300 rounded-full"
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
