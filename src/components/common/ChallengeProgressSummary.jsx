import React from 'react';
import { getChallengeProgress } from '../../utils/challengeProgress';

export default function ChallengeProgressSummary({ notice, submissions, onViewMessage }) {
    const progress = getChallengeProgress(notice, submissions);
    if (!progress.total) return null;
    return progress.isSuccess ? <div className="mt-5 flex flex-col items-center rounded-2xl border border-[#E7D8C4] bg-[#FBF3E7] p-5 text-center">
        <h4 className="text-sm font-bold text-slate-900">챌린지 성공!</h4>
        <p className="mt-1 text-sm text-slate-700">{progress.completed}/{progress.total} 달성 · 성공 기준 {progress.threshold}회</p>
        <p className="mt-1 text-xs text-slate-600">성공 후에도 계속 도전할 수 있어요.</p>
        {Number(notice.haifn_reward) > 0 && <p className="mt-1 text-xs text-slate-600">하이픈은 프로그램 종료 시 한 번 지급됩니다.</p>}
        <button type="button" onClick={onViewMessage} className="mt-3 rounded-xl bg-[#CF3A27] px-4 py-2 text-xs font-bold text-white hover:bg-[#B93223] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CF3A27]">축하 메시지 다시보기</button>
    </div> : <p className="mt-5 text-sm font-semibold text-slate-600">{progress.completed}/{progress.total} 진행 · 성공 기준 {progress.threshold}회 · 성공까지 {progress.remaining}회</p>;
}
