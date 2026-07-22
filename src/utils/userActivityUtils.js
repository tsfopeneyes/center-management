import { supabase } from '../supabaseClient';

export const trackUserWebActivity = async (user) => {
    if (!user || !user.id) return user;
    try {
        const nowIso = new Date().toISOString();
        const lastTracked = user.preferences?.last_web_login_at;

        // Update DB if lastTracked is missing or older than 3 minutes
        if (!lastTracked || (new Date() - new Date(lastTracked)) > 3 * 60 * 1000) {
            const updatedPreferences = { ...(user.preferences || {}), last_web_login_at: nowIso };
            await supabase.from('users').update({ preferences: updatedPreferences }).eq('id', user.id);

            const updatedUser = { ...user, preferences: updatedPreferences };
            
            try {
                const localUser = localStorage.getItem('user');
                if (localUser) {
                    const parsed = JSON.parse(localUser);
                    if (parsed.id === user.id) {
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                    }
                }
                const localAdmin = localStorage.getItem('admin_user');
                if (localAdmin) {
                    const parsedAdmin = JSON.parse(localAdmin);
                    if (parsedAdmin.id === user.id) {
                        localStorage.setItem('admin_user', JSON.stringify(updatedUser));
                    }
                }
            } catch (storageErr) {}

            return updatedUser;
        }
    } catch (e) {
        console.error('Failed to track user web activity:', e);
    }
    return user;
};
