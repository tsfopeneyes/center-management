import React from 'react';
import { Cookie, CheckCircle, Save } from 'lucide-react';

const SnackHistoryView = ({ onSaveMetadata, hookData }) => {
    const { editData, setEditData } = hookData;

    return (
                            <div className="animate-fade-in space-y-8">
                                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                            <Cookie size={20} />
                                        </div>
                                        <p className="text-sm font-bold text-amber-800">이 학교에 지원된 간식 내역을 기록합니다. (최대 10회)</p>
                                    </div>
                                    <button
                                        onClick={() => onSaveMetadata(editData)}
                                        className="w-full md:w-auto shrink-0 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-black text-sm shadow-md shadow-amber-200 hover:bg-amber-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Save size={16} /> 저장
                                    </button>
                                </div>

                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left whitespace-nowrap">
                                            <thead className="bg-amber-50/80 text-amber-800 font-black text-[11px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3 w-16 text-center border-b border-amber-100">회차</th>
                                                    <th className="px-4 py-3 w-40 border-b border-amber-100">지원 날짜</th>
                                                    <th className="px-4 py-3 border-b border-amber-100">간식 상세내용</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(editData.snack_history?.length === 10 ? editData.snack_history : Array.from({ length: 10 }, (_, i) => editData.snack_history?.[i] || { date: '', type: '' })).map((snack, index) => (
                                                    <tr key={index} className="hover:bg-amber-50/20 transition-colors group">
                                                        <td className="px-4 py-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <span className="font-black text-amber-500 text-xs w-5">{index + 1}</span>
                                                                {snack.date ? <CheckCircle size={12} className="text-amber-400 shrink-0" /> : <div className="w-3 shrink-0" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2.5">
                                                            <div className="relative w-full">
                                                                <input
                                                                    type="date"
                                                                    value={snack.date}
                                                                    onChange={(e) => {
                                                                        const newHistory = [...editData.snack_history];
                                                                        newHistory[index] = { ...newHistory[index], date: e.target.value };
                                                                        setEditData({ ...editData, snack_history: newHistory });
                                                                    }}
                                                                    className={`w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all ${!snack.date ? 'text-transparent' : 'text-gray-700'}`}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2.5 pr-4">
                                                            <input
                                                                type="text"
                                                                value={snack.type}
                                                                onChange={(e) => {
                                                                    const newHistory = [...editData.snack_history];
                                                                    newHistory[index] = { ...newHistory[index], type: e.target.value };
                                                                    setEditData({ ...editData, snack_history: newHistory });
                                                                }}
                                                                placeholder="항목"
                                                                className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all text-gray-700 placeholder:text-gray-400"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
    );
};
export default SnackHistoryView;