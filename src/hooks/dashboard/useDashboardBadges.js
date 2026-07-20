import { useState, useCallback } from 'react';
import { badgesApi } from '../../api/badgesApi';

export const useDashboardBadges = () => {
    const [badgeCategories, setBadgeCategories] = useState([]);
    const [dynamicBadges, setDynamicBadges] = useState([]);
    const [badgesLoading, setBadgesLoading] = useState(false);

    const fetchBadgeData = useCallback(async () => {
        setBadgesLoading(true);
        try {
            const [cats, chs] = await Promise.all([
                badgesApi.fetchCategories(),
                badgesApi.fetchBadges()
            ]);
            setBadgeCategories(cats);
            setDynamicBadges(chs);
        } catch (error) {
            console.error('Badge fetch error:', error);
        } finally {
            setBadgesLoading(false);
        }
    }, []);

    return {
        badgeCategories,
        dynamicBadges,
        badgesLoading,
        fetchBadgeData
    };
};
