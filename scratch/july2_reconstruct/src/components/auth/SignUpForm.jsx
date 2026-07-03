import React from 'react';
import TermsConsentModal from './TermsConsentModal';
import SignUpBasicInfo from './components/SignUpBasicInfo';
import SignUpSecurityInfo from './components/SignUpSecurityInfo';
import { useSignUp } from './hooks/useSignUp';

const SignUpForm = ({ onSuccess, onCancel, isKiosk = false }) => {
    const {
        formData, setFormData,
        agreements, setAgreements,
        loading, showConsentModal, setShowConsentModal,
        isUnder14, handleChange, handlePhoneChange, handleGuardianPhoneChange, handleSignUp
    } = useSignUp(onSuccess);

    return (
        <div className="w-full">
            <form onSubmit={handleSignUp} className="space-y-4">
                
                <SignUpBasicInfo
                    formData={formData}
                    setFormData={setFormData}
                    handleChange={handleChange}
                    handlePhoneChange={handlePhoneChange}
                    handleGuardianPhoneChange={handleGuardianPhoneChange}
                    isUnder14={isUnder14}
                    isKiosk={isKiosk}
                />

                <SignUpSecurityInfo
                    formData={formData}
                    setFormData={setFormData}
                    handleChange={handleChange}
                    agreements={agreements}
                    setAgreements={setAgreements}
                    setShowConsentModal={setShowConsentModal}
                    isKiosk={isKiosk}
                />

                <button
                    type="submit"
                    disabled={
                        loading ||
                        !(agreements.art1 && agreements.art2 && agreements.art3 && agreements.art4) ||
                        formData.birth.length < 6 ||
                        formData.phone.replace(/[^0-9]/g, '').length < 11
                    }
                    className={`w-full mt-4 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:bg-gray-300 disabled:shadow-none disabled:opacity-50 ${isKiosk ? 'bg-blue-600 text-white sm:py-6 sm:rounded-[2rem] sm:text-xl hover:bg-blue-700' : 'bg-gray-800 text-white hover:bg-gray-900'}`}
                >
                    {loading ? (isKiosk ? '가입 처리 중...' : '가입 처리 중...') : (isKiosk ? '회원가입 완료' : '가입하기')}
                </button>
            </form>

            <TermsConsentModal
                isOpen={showConsentModal}
                onClose={() => setShowConsentModal(false)}
                onAgree={(agreedStates) => {
                    setAgreements(agreedStates);
                    setShowConsentModal(false);
                }}
                isKiosk={isKiosk}
            />
        </div>
    );
};

export default SignUpForm;
