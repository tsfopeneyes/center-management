import { useState, useCallback } from 'react';
import { badgesApi } from '../../api/badgesApi';

export const useDashboardChallenges = () => {
    const [challengeCategories, setChallengeCategories] = useState([]);
    const [dynamicChallenges, setDynamicChallenges] = useState([]);
    const [challengesLoading, setChallengesLoading] = useState(false);

    const fetchChallengeData = useCallback(async () => {
        setChallengesLoading(true);
        try {
            const [cats, chs] = await Promise.all([
                badgesApi.fetchCategories(),
                badgesApi.fetchChallenges()
            ]);
            setChallengeCategories(cats);
            setDynamicChallenges(chs);
        } catch (error) {
            console.error('Challenge fetch error:', error);
        } finally {
            setChallengesLoading(false);
        }
    }, []);

    return {
        challengeCategories,
        dynamicChallenges,
        challengesLoading,
        fetchChallengeData
    };
};
