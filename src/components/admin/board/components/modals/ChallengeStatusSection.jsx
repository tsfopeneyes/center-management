import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Award, CheckCircle, Clock, Image, ExternalLink, RefreshCw } from 'lucide-react';

const ChallengeStatusSection = ({ notice, participantList }) => {
    const [previewImage, setPreviewImage] = useState(null);
    const challengers = participantList.JOIN || [];
    const missions = notice.challenge_missions || [];

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        <Award className="text-blue-500" size={20} />
                        뱃지 도전 현황
                    </h3>
                    <p className="text-xs text-gray-400 font-bold mt-1">
                        전체 도전자 {challengers.length}명 / 등록된 미션 {missions.length}개
                    </p>
                </div>
            </div>

            {challengers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl p-8 text-gray-400">
                    <p className="font-bold text-sm">아직 본 뱃지에 도전한 학생이 없습니다.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                <th className="pb-3 pl-3">학생 정보</th>
                                <th className="pb-3 text-center">미션 달성도</th>
                                <th className="pb-3 pl-6">미션별 인증 세부</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {challengers.map((student) => {
                                const statuses = student.challenge_mission_statuses || {};
                                const completedCount = missions.filter(m => statuses[m.id]?.completed).length;
                                const isAllCompleted = completedCount === missions.length && missions.length > 0;

                                return (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 pl-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                                                    {student.name}
                                                    {student.is_leader && (
                                                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[9px] font-bold">리더</span>
                                                    )}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold mt-0.5">
                                                    {student.school} • 번호 {student.phone_back4 || '----'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-black leading-none ${
                                                    isAllCompleted 
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                }`}>
                                                    {completedCount} / {missions.length} 완료
                                                </span>
                                                {isAllCompleted && (
                                                    <span className="text-[9px] text-emerald-500 font-black mt-1 uppercase tracking-wider">SUCCESS!</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 pl-6">
                                            <div className="flex flex-wrap gap-2.5">
                                                {missions.map((mission) => {
                                                    const mStatus = statuses[mission.id] || {};
                                                    const isDone = mStatus.completed;

                                                    return (
                                                        <div key={mission.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold ${
                                                            isDone 
                                                                ? 'bg-slate-50 border-gray-100 text-gray-700' 
                                                                : 'bg-gray-50/30 border-dashed border-gray-200 text-gray-400'
                                                        }`}>
                                                            {isDone ? (
                                                                <CheckCircle size={12} className="text-emerald-500" />
                                                            ) : (
                                                                <Clock size={12} className="text-gray-300" />
                                                            )}
                                                            <span>{mission.title}</span>
                                                            {isDone && mStatus.auth_image && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewImage({
                                                                        url: mStatus.auth_image,
                                                                        title: `${student.name} - ${mission.title}`,
                                                                        date: mStatus.completed_at
                                                                    })}
                                                                    className="p-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors ml-1"
                                                                    title="인증샷 확인"
                                                                >
                                                                    <Image size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 인증사진 팝업 모달 */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <div 
                        className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl relative flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h4 className="font-black text-gray-800 text-sm">{previewImage.title}</h4>
                                {previewImage.date && (
                                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                        인증 일시: {new Date(previewImage.date).toLocaleString('ko-KR')}
                                    </p>
                                )}
                            </div>
                            <button 
                                onClick={() => setPreviewImage(null)}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg text-xs font-bold transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                        <div className="p-3 bg-black flex items-center justify-center min-h-[300px] max-h-[500px]">
                            <img 
                                src={previewImage.url} 
                                alt="미션 인증샷" 
                                className="max-w-full max-h-[400px] object-contain rounded-xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

ChallengeStatusSection.propTypes = {
    notice: PropTypes.object.isRequired,
    participantList: PropTypes.object.isRequired
};

export default ChallengeStatusSection;
