import React from 'react';
import PropTypes from 'prop-types';

const PollResultsSection = ({ 
    notice, 
    pollModalResults 
}) => {
    if (!notice || !pollModalResults) return null;

    let totalVoters = 0;
    const voterSet = new Set();
    Object.values(pollModalResults).forEach(users => {
        users.forEach(u => voterSet.add(u.id));
    });
    totalVoters = voterSet.size;

    return (
        <div className="flex-1 space-y-5 overflow-y-auto bg-white p-4 md:p-6">
            <div className="border-b border-slate-100 pb-5">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">
                        투표 결과
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                        총 {totalVoters}명 참여
                    </p>
                </div>
            </div>
            
            <div className="divide-y divide-slate-100">
                {(notice.poll_options || []).map((opt) => {
                    const respondents = pollModalResults[opt.id] || [];
                    const count = respondents.length;
                    const isWinner = totalVoters > 0 && Math.max(...(notice.poll_options || []).map(o => (pollModalResults[o.id] || []).length)) === count;
                    const percent = totalVoters === 0 ? 0 : Math.round((count / totalVoters) * 100);

                    return (
                        <div key={opt.id} className="py-5 first:pt-0">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold text-slate-900">{opt.title}</span>
                                <span className={`text-sm font-semibold ${isWinner && count > 0 ? 'text-[#3182f6]' : 'text-slate-500'}`}>
                                    {count}명 ({percent}%)
                                </span>
                            </div>
                            
                            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div 
                                    className={`h-1.5 rounded-full ${isWinner && count > 0 ? 'bg-[#3182f6]' : 'bg-slate-300'}`}
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                            
                            {count > 0 && (
                                <div className="mt-3">
                                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                                        {respondents.map((user, i) => (
                                            <span key={i} className="flex w-fit items-center gap-1 text-xs text-slate-600">
                                                {user.name}
                                                {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                                <span>({user.school || '소속없음'})</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

PollResultsSection.propTypes = {
    notice: PropTypes.object.isRequired,
    pollModalResults: PropTypes.object
};

export default React.memo(PollResultsSection);
