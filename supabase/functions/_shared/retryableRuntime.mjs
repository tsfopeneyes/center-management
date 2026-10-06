// Share initialization, but allow a later request to recover after a transient failure.
export function createRetryableRuntime(initialize) {
    let pending;
    return () => pending ??= Promise.resolve().then(initialize).catch(error => {
        pending = undefined;
        throw error;
    });
}
