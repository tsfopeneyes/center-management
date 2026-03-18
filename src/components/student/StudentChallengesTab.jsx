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
        <div className="p-5 pt-6 pb-32 bg-white rounded-t-[30px] shadow-sm mt-2 min-h-[calc(100vh-80px)]">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                        챌린지 🏆
                        <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-black shadow-lg shadow-blue-200">
                            {dynamicChallenges.filter(ch => getBadgeProgress(ch, { visitCount, programCount, specialStats }).earned).length} / {dynamicChallenges.length}
                        </span>
                    </h1>
                    <p className="text-gray-500 text-[15px] mt-2 font-medium">활동을 통해 멋진 뱃지를 획득해보세요!</p>
                </div>
            </div>

            <div className="space-y-8">
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
