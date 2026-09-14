import { requestSupabaseFunction } from './supabaseRest';

// Retained for non-notification legacy integrations while their server-side
// rollout is completed. Domain notifications always use notify-event below.
export const serverIntegrationsEnabled = () =>
    import.meta.env.VITE_SERVER_INTEGRATIONS_ENABLED === 'true';

// Local verification must never notify a real LINE group or Slack channel.
// Production can also be muted explicitly while a release is being verified.
export const areExternalNotificationsMuted = () => {
    if (import.meta.env.DEV) return true;
    return typeof window !== 'undefined' && localStorage.getItem('notifications_muted_for_testing') === 'true';
};

/**
 * Sends a domain event to the single server-side notification router.
 * The browser supplies only source identifiers and optional display details;
 * the server reloads the source rows and chooses every destination.
 */
export const dispatchNotificationEvent = async (event) => {
    if (areExternalNotificationsMuted()) return { handled: false, muted: true };
    // Notification delivery is idempotent by source event ID on the server, so
    // retry the same request when a mobile browser or route transition aborts
    // the first response after the visit has already been committed.
    const data = await requestSupabaseFunction(
        'dispatch-notification',
        { action: 'notify-event', ...event },
        3,
        10000
    );
    return { handled: true, data };
};
