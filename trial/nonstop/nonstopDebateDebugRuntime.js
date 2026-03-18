import { createNonstopSpeakerPool } from './nonstopSpeakerPool.js';
import { createNonstopDebateDebugGenerator } from './nonstopDebateDebugGenerator.js';

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function createNonstopDebateDebugRuntime({ getContext } = {}) {
    const speakerPool = createNonstopSpeakerPool({ getContext });
    const generator = createNonstopDebateDebugGenerator({ getContext });
    let session = null;

    function startSession() {
        const eligibleSpeakers = speakerPool.getEligibleSpeakers();
        if (!eligibleSpeakers.length) {
            return { started: false, reason: 'no_eligible_speakers' };
        }

        session = {
            startedAt: Date.now(),
            targetTurns: randomInt(3, 8),
            eligibleSpeakers,
            generatedLines: [],
            replayIndex: 0,
            replayCycle: 0,
            generationController: new AbortController(),
        };

        return {
            started: true,
            targetTurns: session.targetTurns,
            eligibleSpeakers: [...eligibleSpeakers],
        };
    }

    async function advance() {
        if (!session) return { advanced: false, reason: 'no_session' };

        if (session.generatedLines.length < session.targetTurns) {
            const speaker = pickRandom(session.eligibleSpeakers);
            const line = await generator.generateTurn({
                speakerHint: speaker,
                turnIndex: session.generatedLines.length,
                priorLines: session.generatedLines,
                signal: session.generationController.signal,
            });

            session.generatedLines.push(line);
            return {
                advanced: true,
                mode: 'generated',
                line,
                targetTurns: session.targetTurns,
                progress: session.generatedLines.length,
                isSectionComplete: session.generatedLines.length >= session.targetTurns,
            };
        }

        const line = session.generatedLines[session.replayIndex];
        const replayCycle = session.replayCycle;
        session.replayIndex += 1;
        if (session.replayIndex >= session.generatedLines.length) {
            session.replayIndex = 0;
            session.replayCycle += 1;
        }

        return {
            advanced: true,
            mode: 'loop',
            line,
            replayIndex: session.replayIndex,
            replayCycle,
            targetTurns: session.targetTurns,
            progress: session.generatedLines.length,
            isSectionComplete: true,
        };
    }

    function stopSession(reason = 'manual_stop') {
        if (!session) return { stopped: false, reason: 'no_session' };
        session.generationController.abort(reason);
        session = null;
        return { stopped: true, reason };
    }

    function getSession() {
        return session
            ? {
                startedAt: session.startedAt,
                targetTurns: session.targetTurns,
                eligibleSpeakers: [...session.eligibleSpeakers],
                generatedLines: session.generatedLines.map(line => ({ ...line })),
                replayIndex: session.replayIndex,
                replayCycle: session.replayCycle,
            }
            : null;
    }

    return {
        startSession,
        advance,
        stopSession,
        getSession,
    };
}
