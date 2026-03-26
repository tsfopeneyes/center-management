import { useState, useEffect } from 'react';
import { userApi } from '../../../../api/userApi';
import { VIEW_MODES } from '../utils/constants';

const useViewPreferences = () => {
    const [viewMode, setViewModeState] = useState(VIEW_MODES.LARGE);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPrefs = async () => {
            const adminUser = JSON.parse(localStorage.getItem('admin_user'));
            if (adminUser?.id) {
                try {
                    const prefs = await userApi.fetchUserPreferences(adminUser.id);
                    const localViewMode = localStorage.getItem('adminBoardViewMode') || VIEW_MODES.LARGE;

                    let mergedViewMode = prefs.adminBoardViewMode;

                    // Migrate from localStorage if DB is empty
                    if (!mergedViewMode && localViewMode) {
                        mergedViewMode = localViewMode;
                        await userApi.updateUserPreferences(adminUser.id, { adminBoardViewMode: mergedViewMode });
                    }

                    setViewModeState(mergedViewMode || VIEW_MODES.LARGE);
                } catch (error) {
                    console.error('Failed to load board preferences', error);
                }
            }
            setIsLoading(false);
        };
        loadPrefs();
    }, []);

    const setViewMode = async (mode) => {
        setViewModeState(mode);
        const adminUser = JSON.parse(localStorage.getItem('admin_user'));
        if (adminUser?.id) {
            try {
                await userApi.updateUserPreferences(adminUser.id, { adminBoardViewMode: mode });
            } catch (err) {
                console.error("Failed to sync board view mode to DB", err);
            }
        }
    };

    return { viewMode, setViewMode, isLoading };
};

export default useViewPreferences;
