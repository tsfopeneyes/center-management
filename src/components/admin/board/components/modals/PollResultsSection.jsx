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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        투표 결과
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1">
                        총 {totalVoters}명 참여
                    </p>
                </div>
            </div>
            
            <div className="space-y-4">
                {(notice.poll_options || []).map((opt) => {
                    const respondents = pollModalResults[opt.id] || [];
                    const count = respondents.length;
                    const isWinner = totalVoters > 0 && Math.max(...(notice.poll_options || []).map(o => (pollModalResults[o.id] || []).length)) === count;
                    const percent = totalVoters === 0 ? 0 : Math.round((count / totalVoters) * 100);

                    return (
                        <div key={opt.id} className={`bg-white rounded-xl shadow-sm border p-4 ${isWinner && count > 0 ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-100'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`font-bold text-sm ${isWinner && count > 0 ? 'text-purple-700' : 'text-gray-800'}`}>{opt.title}</span>
                                <span className={`text-xs font-black ${isWinner && count > 0 ? 'text-purple-600' : 'text-gray-500'}`}>
                                    {count}명 ({percent}%)
                                </span>
                            </div>
                            
                            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3 overflow-hidden">
                                <div 
                                    className={`h-2.5 rounded-full transition-all duration-1000 ${isWinner && count > 0 ? 'bg-purple-500' : 'bg-gray-400'}`} 
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                            
                            {count > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-50">
                                    <div className="flex flex-wrap gap-1">
                                        {respondents.map((user, i) => (
                                            <span key={i} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-1 rounded-md">
                                                {user.name} ({user.school || '소속없음'})
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
