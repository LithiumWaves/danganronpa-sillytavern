export const NSD_EVENTS = Object.freeze({
    SESSION_STARTED: 'NSD_SESSION_STARTED',
    STAGE_CHANGED: 'NSD_STAGE_CHANGED',
    LINE_READY: 'NSD_LINE_READY',
    TOKEN_SPAWNED: 'NSD_TOKEN_SPAWNED',
    HIT_CONFIRMED: 'NSD_HIT_CONFIRMED',
    HIT_REJECTED: 'NSD_HIT_REJECTED',
    CANCELLED: 'NSD_CANCELLED',
    ROUND_COMPLETED: 'NSD_ROUND_COMPLETED',
});

export function createNonstopEventBus() {
    const listeners = new Map();

    function on(eventName, handler) {
        if (!eventName || typeof handler !== 'function') return () => {};
        const bucket = listeners.get(eventName) || new Set();
        bucket.add(handler);
        listeners.set(eventName, bucket);
        return () => bucket.delete(handler);
    }

    function emit(eventName, payload) {
        const bucket = listeners.get(eventName);
        if (!bucket?.size) return;
        for (const handler of bucket) {
            try {
                handler(payload);
            } catch (err) {
                console.warn('[Dangan][NSD] Event handler failed:', err);
            }
        }
    }

    return { on, emit };
}
