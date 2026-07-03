import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const DutyReportForm = ({ data, currentAdmin, logManagerName, onSave }) => {
    const [formData, setFormData] = useState({
        floor_6_note: '',
        floor_3_note: '',
        floor_2_note: '',
        inconvenience_note: '',
        special_note: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (data) {
            setFormData({
                floor_6_note: data.floor_6_note || '',
                floor_3_note: data.floor_3_note || '',
                floor_2_note: data.floor_2_note || '',
                inconvenience_note: data.inconvenience_note || '',
                special_note: data.special_note || ''
            });
        }
    }, [data]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
        alert('저장되었습니다.');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                    <h3 className="text-lg font-black text-gray-800">업무 보고서 작성</h3>
                    <div className="text-sm font-bold text-gray-400">작성자: <span className="text-gray-800">{logManagerName || currentAdmin?.name || '관리자'}</span></div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">6층 상황</label>
                        <textarea
                            name="floor_6_note"
                            value={formData.floor_6_note}
                            onChange={handleChange}
                            rows={2}
                            placeholder="6층 특이사항 입력"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">3층 상황</label>
                        <textarea
                            name="floor_3_note"
                            value={formData.floor_3_note}
                            onChange={handleChange}
                            rows={2}
                            placeholder="3층 특이사항 입력"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">2층 상황</label>
                        <textarea
                            name="floor_2_note"
                            value={formData.floor_2_note}
                            onChange={handleChange}
                            rows={2}
                            placeholder="2층 특이사항 입력"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-orange-600 mb-2">공간 불편 사항</label>
                        <textarea
                            name="inconvenience_note"
                            value={formData.inconvenience_note}
                            onChange={handleChange}
                            rows={3}
                            placeholder="이용자들이 겪은 불편사항이나 시설 수리가 필요한 부분을 입력해주세요."
                            className="w-full p-3 bg-orange-50 border border-orange-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-red-600 mb-2">당일 특이 사항</label>
                        <textarea
                            name="special_note"
                            value={formData.special_note}
                            onChange={handleChange}
                            rows={3}
                            placeholder="사고, 민원, 혹은 기타 중요한 특이사항을 입력해주세요."
                            className="w-full p-3 bg-red-50 border border-red-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                        />
                    </div>
                </div>
            </div>

            <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
            >
                <Save size={24} />
                {isSaving ? '저장 중...' : '보고서 저장하기'}
            </button>
        </form>
    );
};

export default DutyReportForm;
