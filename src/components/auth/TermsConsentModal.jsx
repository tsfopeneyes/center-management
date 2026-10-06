import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle } from 'lucide-react';
import TermsArticleBody from './TermsArticleBody';
import useModalClose from '../../hooks/useModalClose';

const TermsConsentModal = ({ isOpen, onClose, onAgree, isKiosk = false, required = false, saving = false, error = '' }) => {
    useModalClose(isOpen, onClose);
    const [agreements, setAgreements] = useState({
        art1: false,
        art2: false,
        art3: false,
        art4: false
    });

    const isAllAgreed = agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4;

    useEffect(() => {
        if (isOpen) setAgreements({ art1: false, art2: false, art3: false, art4: false });
    }, [isOpen]);

    const handleAllAgree = () => {
        setAgreements({ art1: true, art2: true, art3: true, art4: true });
    };

    const toggleAgreement = (art) => {
        setAgreements(prev => ({ ...prev, [art]: !prev[art] }));
    };

    const handleComplete = () => {
        if (isAllAgreed) {
            onAgree(agreements);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={`bg-white w-full max-w-2xl rounded-3xl p-5 md:p-7 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${isKiosk ? 'sm:p-8 sm:rounded-[2.5rem] max-w-3xl' : ''}`}
            >
                <div className="flex justify-between items-center mb-4 shrink-0 border-b border-gray-100 pb-3">
                    <h3 className={`text-xl font-black text-gray-800 tracking-tight ${isKiosk ? 'sm:text-2xl' : ''}`}>이용 약관 및 개인정보 수집 동의</h3>
                    {!required && <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <X size={22} />
                    </button>}
                </div>

                {/* All Agree Button at Top */}
                <button
                    type="button"
                    onClick={handleAllAgree}
                    className={`mb-4 w-full py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all shrink-0 ${isAllAgreed
                        ? 'bg-[#CF3A27] text-white shadow-lg hover:bg-[#B93223]'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        } font-black text-base md:text-lg`}
                >
                    <CheckCircle size={22} />
                    [전체 동의] 모든 항목에 동의합니다
                </button>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-sm text-gray-600 leading-relaxed space-y-6 min-h-0">
                    {/* Article 1 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-gray-900 border-l-4 border-[#CF3A27] pl-3">제1조 회원 가입 약관</h4>
                        <TermsArticleBody article="art1" />
                        <button
                            type="button"
                            onClick={() => toggleAgreement('art1')}
                            className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art1 ? 'bg-[#CF3A27]/10 border-[#CF3A27]/30 text-[#CF3A27]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                            {agreements.art1 ? '✓ 제1조 동의함' : '제1조 동의합니다'}
                        </button>
                    </div>

                    {/* Article 2 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-gray-900 border-l-4 border-[#CF3A27] pl-3">제2조 개인정보 처리 방침</h4>
                        <TermsArticleBody article="art2" />
                        <button
                            type="button"
                            onClick={() => toggleAgreement('art2')}
                            className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art2 ? 'bg-[#CF3A27]/10 border-[#CF3A27]/30 text-[#CF3A27]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                            {agreements.art2 ? '✓ 제2조 동의함' : '제2조 동의합니다'}
                        </button>
                    </div>

                    {/* Article 3 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-gray-900 border-l-4 border-[#CF3A27] pl-3">제3조 개인정보 수집 및 이용 동의</h4>
                        <TermsArticleBody article="art3" />
                        <button
                            type="button"
                            onClick={() => toggleAgreement('art3')}
                            className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art3 ? 'bg-[#CF3A27]/10 border-[#CF3A27]/30 text-[#CF3A27]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                            {agreements.art3 ? '✓ 제3조 동의함' : '제3조 동의합니다'}
                        </button>
                    </div>

                    {/* Article 4 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-gray-900 border-l-4 border-[#CF3A27] pl-3">제4조 초상권 및 활동 기록 이용 동의</h4>
                        <TermsArticleBody article="art4" />
                        <button
                            type="button"
                            onClick={() => toggleAgreement('art4')}
                            className={`w-full py-3 rounded-xl font-bold border transition ${agreements.art4 ? 'bg-[#CF3A27]/10 border-[#CF3A27]/30 text-[#CF3A27]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                            {agreements.art4 ? '✓ 제4조 동의함' : '제4조 동의합니다'}
                        </button>
                    </div>
                </div>

                <div className="pt-3 mt-3 border-t border-gray-100 shrink-0 flex gap-3">
                    {error && <p role="alert" className="self-center text-xs font-bold text-red-600">{error}</p>}
                    <button
                        type="button"
                        onClick={handleComplete}
                        disabled={!isAllAgreed || saving}
                        className={`flex-1 py-3.5 rounded-2xl font-black text-base md:text-lg transition-all ${isAllAgreed
                            ? 'bg-[#CF3A27] text-white shadow-xl hover:bg-[#B93223]'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {saving ? '저장 중...' : required ? '동의하고 계속하기' : '동의 완료 및 창 닫기'}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
};

export default TermsConsentModal;
