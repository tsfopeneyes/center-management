import React from 'react';
import { X } from 'lucide-react';

const ZoneDetailModal = ({
    zoneDetailModal,
    setZoneDetailModal,
    handleForceCheckout
}) => {
    if (!zoneDetailModal.isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-blue-50">
                    <div>
                        <h3 className="font-bold text-blue-800 text-lg">{zoneDetailModal.locationName}</h3>
                        <p className="text-xs text-blue-500">현재 이용자 명단 ({zoneDetailModal.activeUsers.length}명)</p>
                    </div>
                    <button onClick={() => setZoneDetailModal({ ...zoneDetailModal, isOpen: false })}>
                        <X size={20} className="text-blue-300 hover:text-blue-500" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {zoneDetailModal.activeUsers.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">현재 이용자가 없습니다.</div>
                    ) : (
                        zoneDetailModal.activeUsers.map(u => (
                            <div key={u.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <div>
                                        <span className="font-bold text-gray-700 flex items-center gap-1">
                                            {u.name}
                                            {u.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-1">({u.school})</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.user_group === '졸업생' ? 'bg-gray-200 text-gray-600' :
                                        u.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                            'bg-white border border-gray-100 text-blue-500'
                                        }`}>
                                        {u.user_group || '재학생'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleForceCheckout(u.id)}
                                    className="text-[10px] bg-white text-red-500 border border-red-100 px-2 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition whitespace-nowrap font-bold"
                                >
                                    퇴실
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZoneDetailModal;
