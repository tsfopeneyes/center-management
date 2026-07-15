import React from 'react';
import { Clock, Save } from 'lucide-react';

const OperatingHoursSettings = ({
    operatingHours,
    handleUpdateOperatingHours,
    handleSaveOperatingHours,
    hoursLoading
}) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
        <div className="w-full bg-white rounded-[24px] border border-[#f2f4f6] p-6 shadow-sm flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h3 className="text-lg font-bold text-[#191f28] flex items-center gap-2 tracking-tight">
                        <Clock className="text-[#3182f6]" size={20} />
                        기본 운영 시간 설정
                    </h3>
                    <p className="text-xs md:text-sm text-[#8b95a1] mt-1 font-medium leading-relaxed">
                        센터의 요일별 기본 운영 시간을 설정합니다. 이 운영 시간은 학생 캘린더와 대시보드 위젯에 연동되어 표시됩니다.
                    </p>
                </div>
                <button
                    onClick={handleSaveOperatingHours}
                    disabled={hoursLoading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm shrink-0 text-xs
                    ${hoursLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:-translate-y-0.5 hover:shadow-md'}`}
                >
                    <Save size={18} />
                    {hoursLoading ? '저장 중...' : '운영 시간 저장'}
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {days.map(day => {
                    const data = operatingHours[day];
                    return (
                        <div key={day} className={`p-4 rounded-2xl border transition-colors ${data.isOpen ? 'bg-indigo-50/30 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-black text-gray-700">{data.label}</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.isOpen}
                                        onChange={(e) => handleUpdateOperatingHours(day, 'isOpen', e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3182f6]"></div>
                                </label>
                            </div>
                            
                            <div className={`flex items-center gap-1.5 ${!data.isOpen && 'opacity-40 pointer-events-none'}`}>
                                <input
                                    type="time"
                                    value={data.open}
                                    onChange={(e) => handleUpdateOperatingHours(day, 'open', e.target.value)}
                                    className="w-full min-w-[70px] px-2 py-2 bg-[#f2f4f6] border border-transparent rounded-xl outline-none focus:bg-white focus:border-[#3182f6] transition-all font-bold text-[#191f28] text-xs md:text-sm text-center"
                                />
                                <span className="text-gray-400 font-bold text-xs">-</span>
                                <input
                                    type="time"
                                    value={data.close}
                                    onChange={(e) => handleUpdateOperatingHours(day, 'close', e.target.value)}
                                    className="w-full min-w-[70px] px-2 py-2 bg-[#f2f4f6] border border-transparent rounded-xl outline-none focus:bg-white focus:border-[#3182f6] transition-all font-bold text-[#191f28] text-xs md:text-sm text-center"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OperatingHoursSettings;
