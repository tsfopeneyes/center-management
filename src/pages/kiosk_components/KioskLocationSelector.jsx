import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import KioskModals from './KioskModals';

const KioskLocationSelector = ({
    locations,
    handleSetLocation,
    setAfterPinAction,
    setShowMasterPin,
    // modal props
    showMasterPin,
    masterPinInput,
    setMasterPinInput,
    handleMasterPinSubmit,
    showOptionsMenu,
    setShowOptionsMenu,
    handleResetLocation,
    navigate,
    showGuestForm,
    setShowGuestForm,
    processKioskAction,
    status,
    pendingKioskUser,
    handleKioskTermsAgree,
    resetState
}) => {
    return (
        <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6 select-none font-sans">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl p-12 text-center">
                <MapPin className="mx-auto text-blue-600 mb-6" size={64} />
                <h1 className="text-3xl font-black text-slate-800 mb-2">키오스크 위치 설정</h1>
                <p className="text-slate-400 mb-10 font-bold">현재 기기가 배치된 장소를 선택해 주세요.</p>
                <div className="grid grid-cols-2 gap-4">
                    {locations.map(loc => (
                        <button key={loc.id} onClick={() => handleSetLocation(loc)} className="p-8 bg-slate-50 rounded-3xl text-xl font-black text-slate-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100">
                            {loc.name}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => {
                        setAfterPinAction('EXIT');
                        setShowMasterPin(true);
                    }}
                    className="mt-12 text-slate-400 font-black tracking-widest uppercase text-xs hover:text-slate-800 transition"
                >
                    로그인 화면으로 돌아가기
                </button>
            </motion.div>

            <KioskModals
                showMasterPin={showMasterPin}
                setShowMasterPin={setShowMasterPin}
                masterPinInput={masterPinInput}
                setMasterPinInput={setMasterPinInput}
                handleMasterPinSubmit={handleMasterPinSubmit}
                showOptionsMenu={showOptionsMenu}
                setShowOptionsMenu={setShowOptionsMenu}
                handleResetLocation={handleResetLocation}
                navigate={navigate}
                showGuestForm={showGuestForm}
                setShowGuestForm={setShowGuestForm}
                processKioskAction={processKioskAction}
                status={status}
                pendingKioskUser={pendingKioskUser}
                handleKioskTermsAgree={handleKioskTermsAgree}
                resetState={resetState}
            />
        </div>
    );
};

export default KioskLocationSelector;
