import { createNonstopSpeakerPool } from './nonstopSpeakerPool.js';

export function createNonstopDebateDebugRuntime({ getContext } = {}) {
    const speakerPool = createNonstopSpeakerPool({ getContext });

    function buildStartSnapshot() {
        const eligibleSpeakers = speakerPool.getEligibleSpeakers();
        return {
            startedAt: Date.now(),
            eligibleSpeakers,
        };
    }

    return {
        buildStartSnapshot,
    };
}
