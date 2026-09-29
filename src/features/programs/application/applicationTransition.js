// The checked application boundary is the default after the program cutover.
// An explicit false remains available for an isolated pre-migration environment.
export const isProgramApplicationTransitionEnabled = () =>
    import.meta.env.VITE_PROGRAM_APPLICATION_TRANSITION_ENABLED !== 'false';
