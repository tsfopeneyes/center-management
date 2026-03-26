import React from 'react';
import { Cookie, CheckCircle, Save } from 'lucide-react';

const SnackHistoryView = ({ onSaveMetadata, hookData }) => {
    const { editData, setEditData } = hookData;

    return (
                            <div className="animate-fade-in space-y-8">
                                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                        <Cookie size={20} />
                                    </div>
                                    <p className="text-sm font-bold text-amber-800">이 학교에 지원된 간식 내역을 기록합니다. (최대 10회)</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(editData.snack_history?.length === 10 ? editData.snack_history : Array.from({ length: 10 }, (_, i) => editData.snack_history?.[i] || { date: '', type: '' })).map((snack, index) => (
                                        <div key={index} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                                <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{index + 1}회차 지원</span>
                                                {snack.date && <CheckCircle size={14} className="text-amber-400" />}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">날짜</label>
                                                    <input
                                                        type="date"
                                                        value={snack.date}
                                                        onChange={(e) => {
                                                            const newHistory = [...editData.snack_history];
                                                            newHistory[index] = { ...newHistory[index], date: e.target.value };
                                                            setEditData({ ...editData, snack_history: newHistory });
                                                        }}
                                                        className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">간식 종류</label>
                                                    <input
                                                        type="text"
                                                        value={snack.type}
                                                        onChange={(e) => {
                                                            const newHistory = [...editData.snack_history];
                                                            newHistory[index] = { ...newHistory[index], type: e.target.value };
                                                            setEditData({ ...editData, snack_history: newHistory });
                                                        }}
                                                        placeholder="예: 햄버거 20개"
                                                        className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => onSaveMetadata(editData)}
                                    className="w-full py-4 bg-amber-500 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Save size={18} /> 간식 지원 정보 일괄 저장
                                </button>
                            </div>
    );
};
export default SnackHistoryView;