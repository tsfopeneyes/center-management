// Enable only after the reviewed database migration and PostgREST cache check.
// Until then, keep the existing production application path operational.
export const isProgramApplicationTransitionEnabled = () =>
    import.meta.env.VITE_PROGRAM_APPLICATION_TRANSITION_ENABLED === 'true';
