import { useState, useCallback } from 'react';
import { challengesApi } from '../../api/challengesApi';

export const useDashboardChallenges = () => {
    const [challengeCategories, setChallengeCategories] = useState([]);
    const [dynamicChallenges, setDynamicChallenges] = useState([]);
    const [challengesLoading, setChallengesLoading] = useState(false);

    const fetchChallengeData = useCallback(async () => {
        setChallengesLoading(true);
        try {
            const [cats, chs] = await Promise.all([
                challengesApi.fetchCategories(),
                challengesApi.fetchChallenges()
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
