import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const QRModal = ({ user, setShowEnlargedQr }) => {
    return (
                    <motion.div
                        key="enlarged-qr"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowEnlargedQr(false)}
                        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-10"
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.5, y: 50 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6"
                        >
                            <div className="p-4 bg-white rounded-2xl border border-gray-100">
                                <QRCodeSVG value={user?.id || '0000'} size={250} level="H" />
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-mono font-black text-gray-800 tracking-[0.3em] mb-2">{user?.phone_back4}</p>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Scan at Kiosk</p>
                            </div>
                            <button
                                onClick={() => setShowEnlargedQr(false)}
                                className="mt-4 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition"
                            >
                                <X size={32} className="text-gray-600" />
                            </button>
                        </motion.div>
                    </motion.div>
    );
};
export default QRModal;
