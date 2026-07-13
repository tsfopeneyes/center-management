import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Trash2, Save, Sparkles, Smile } from 'lucide-react';

const CheckinSurveySettings = ({ checkinSurveyConfig, onSave, isSaving }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState([]);

    useEffect(() => {
        if (checkinSurveyConfig) {
            setQuestion(checkinSurveyConfig.question || '');
            setOptions(checkinSurveyConfig.options || []);
        }
    }, [checkinSurveyConfig]);

    const handleOptionChange = (index, field, value) => {
        const updated = [...options];
        updated[index] = { ...updated[index], [field]: value };
        setOptions(updated);
    };

    const handleAddOption = () => {
        const nextId = String(options.length > 0 ? Math.max(...options.map(o => parseInt(o.id) || 0)) + 1 : 1);
        setOptions([
            ...options,
            { id: nextId, emoji: '😊', label: '새 행동 옵션', recommendTitle: '추천 콘텐츠 제목', recommendText: '여기에 매칭 콘텐츠나 이용 안내 팁을 상세히 적어주세요.' }
        ]);
    };

    const handleDeleteOption = (index) => {
        if (options.length <= 1) {
            alert('최소한 1개 이상의 설문 항목이 존재해야 합니다.');
            return;
        }
        setOptions(options.filter((_, idx) => idx !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!question.trim()) {
            alert('설문 질문을 입력해 주세요.');
            return;
        }
        onSave({ question, options });
    };

    return (
        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 md:p-8 shadow-sm flex flex-col gap-6 col-span-1 lg:col-span-2">
            <div className="flex items-start gap-4 border-b border-gray-50 pb-5">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <HelpCircle size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-gray-800">체크인 입실 설문 설정</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        학생들이 키오스크 체크인을 완료할 때 띄우는 질문과 활동 요구 옵션을 관리합니다. 선택된 목적에 맞춘 콘텐츠 추천 카드가 노출됩니다.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                        체크인 질문 문구
                    </label>
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="예: 오늘 하이픈에서 무엇을 하고 싶나요?"
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 text-sm"
                        required
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center ml-1">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                            선택지 및 맞춤 콘텐츠 매칭 리스트
                        </label>
                        <button
                            type="button"
                            onClick={handleAddOption}
                            className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1.5 active:scale-95 transition-transform"
                        >
                            <Plus size={14} /> 새 선택지 추가
                        </button>
                    </div>

                    <div className="space-y-3">
                        {options.map((option, idx) => (
                            <div key={option.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleDeleteOption(idx)}
                                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition duration-150 shadow-sm z-10"
                                    title="선택지 삭제"
                                >
                                    <Trash2 size={12} />
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-6">
                                    {/* Left: Button Config */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest ml-0.5">
                                            <Smile size={11} />
                                            <span>선택 버튼 설정</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-12 shrink-0">
                                                <input
                                                    type="text"
                                                    value={option.emoji}
                                                    onChange={(e) => handleOptionChange(idx, 'emoji', e.target.value)}
                                                    className="w-full p-2 bg-white border border-gray-200 rounded-xl text-center font-bold text-sm outline-none focus:border-blue-500"
                                                    maxLength={2}
                                                    placeholder="😊"
                                                    title="이모지"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={option.label}
                                                    onChange={(e) => handleOptionChange(idx, 'label', e.target.value)}
                                                    placeholder="버튼 라벨 (예: 밥 먹고 쉬고 싶어요)"
                                                    className="w-full p-2 bg-white border border-gray-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Recommendation Config */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase tracking-widest ml-0.5">
                                            <Sparkles size={11} />
                                            <span>추천 콘텐츠 매칭</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <input
                                                type="text"
                                                value={option.recommendTitle}
                                                onChange={(e) => handleOptionChange(idx, 'recommendTitle', e.target.value)}
                                                placeholder="추천 제목 (예: 🍽️ 스낵존 안내)"
                                                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg font-bold text-[11px] outline-none focus:border-blue-500"
                                                required
                                            />
                                            <textarea
                                                value={option.recommendText}
                                                onChange={(e) => handleOptionChange(idx, 'recommendText', e.target.value)}
                                                placeholder="학생 추천 공간 안내문 및 설명 팁"
                                                className="w-full px-2.5 py-1.5 h-11 bg-white border border-gray-200 rounded-lg text-[10px] leading-normal font-semibold outline-none focus:border-blue-500 resize-none"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-50">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition duration-150 flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50 text-sm active:scale-95"
                    >
                        <Save size={16} />
                        {isSaving ? '저장 중...' : '설문 설정 저장'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CheckinSurveySettings;
