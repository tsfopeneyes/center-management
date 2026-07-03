import React from 'react';
import { getBadgeProgress, BadgeItem } from './BadgeComponents';

const StudentChallengesTab = ({
    dynamicChallenges,
    challengeCategories,
    visitCount,
    programCount,
    specialStats,
    setSelectedBadge
}) => {
    return (
        <div className="animate-fade-in pb-32 relative min-h-screen">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-gray-50/95 backdrop-blur-xl z-20 border-b border-gray-100/50 mb-6 shadow-sm">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                            챌린지 <span className="text-2xl">🏆</span>
                        </h2>
                        <span className="text-[11px] bg-blue-600 text-white px-3 py-1.5 rounded-full font-black shadow-sm">
                            {dynamicChallenges.filter(ch => getBadgeProgress(ch, { visitCount, programCount, specialStats }).earned).length} / {dynamicChallenges.length} 획득
                        </span>
                    </div>
                    <p className="text-gray-500 text-[13px] font-medium mt-1">활동을 통해 멋진 뱃지를 획득해보세요!</p>
                </div>
            </div>

            <div className="px-5 space-y-8">
                {challengeCategories.map(cat => {
                    const catChallenges = dynamicChallenges.filter(ch => ch.category_id === cat.id);
                    if (catChallenges.length === 0) return null;

                    return (
                        <div key={cat.id} className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                            <div className="mb-6 border-b border-gray-200/60 pb-4">
                                <h2 className="text-xl font-black text-gray-800">{cat.name}</h2>
                                {cat.description && <p className="text-[13px] text-gray-500 font-medium mt-1">{cat.description}</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-y-10 gap-x-3">
                                {catChallenges.map(badge => (
                                    <BadgeItem
                                        key={badge.id}
                                        badge={badge}
                                        visitCount={visitCount}
                                        programCount={programCount}
                                        specialStats={specialStats}
                                        onClick={setSelectedBadge}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StudentChallengesTab;
