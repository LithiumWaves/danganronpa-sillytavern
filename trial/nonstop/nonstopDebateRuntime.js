import { createNonstopEventBus, NSD_EVENTS } from './nonstopEvents.js';
import { createNonstopGenerator } from './nonstopGenerator.js';
import { createNonstopRenderer } from './nonstopRenderer.js';
import { createNonstopCombat } from './nonstopCombat.js';

const INTRO_MS = 2100;
const BREAK_MS = 1250;
const MAX_ROUND_MS = 45000;
const MAX_BUFFERED_TURNS = 2;

function waitMs(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(resolve, ms);
        const abort = () => {
            window.clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        if (signal?.aborted) return abort();
        signal?.addEventListener('abort', abort, { once: true });
    });
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createNonstopDebateRuntime({ getContext, getSpeakers, onTransitionPhase } = {}) {
    const eventBus = createNonstopEventBus();
    let session = null;
    let sectionIndex = 0;

    const renderer = createNonstopRenderer({
        onWeakPointClick: ({ weakPointId, tokenId, debateId }) => resolveTruthBulletShot({ weakPointId, tokenId, debateId }),
    });
    const generator = createNonstopGenerator({ getContext, getSpeakers });
    const combat = createNonstopCombat({ eventBus });

    function buildSession() {
        const debateId = `debate_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        return {
            trialId: `trial_${Date.now()}`,
            debateId,
            phase: 'intro_cutscene',
            targetTurns: randomInt(3, 8),
            turnIndex: 0,
            speakers: getSpeakers?.() || [],
            weakPoint: null,
            hitConfirmed: false,
            jobs: {
                generationController: new AbortController(),
                renderTimers: renderer,
            },
            queue: {
                pendingLines: [],
                visibleLines: [],
            },
            metrics: {
                generatedTurns: 0,
                parseFailures: 0,
                retriesUsed: 0,
                hitLatencyMs: null,
                cancellationReason: null,
            },
            startedAt: Date.now(),
            weakPointVisibleAt: null,
        };
    }

    function cancelSession(reason = 'cancelled') {
        if (!session) return;
        session.phase = 'cancelled';
        session.metrics.cancellationReason = reason;
        session.jobs.generationController.abort(reason);
        renderer.clearTimers();
        renderer.clearTracks();
        renderer.setStage('hidden');
        session.queue.pendingLines = [];
        session.queue.visibleLines = [];
        eventBus.emit(NSD_EVENTS.CANCELLED, { reason, session });
        session = null;
    }

    async function prefetch(signal) {
        if (!session || signal.aborted) return;
        if (session.queue.pendingLines.length >= MAX_BUFFERED_TURNS) return;
        const line = await generator.nextTurn({
            signal,
            speakerHint: session.speakers[Math.floor(Math.random() * Math.max(1, session.speakers.length))],
            metrics: session.metrics,
        });
        session.queue.pendingLines.push(line);
        eventBus.emit(NSD_EVENTS.LINE_READY, { line, debateId: session.debateId });
    }

    async function nextLine(signal) {
        if (session.queue.pendingLines.length) return session.queue.pendingLines.shift();
        return generator.nextTurn({ signal, metrics: session.metrics });
    }

    async function runRoundLoop(localSession) {
        const signal = localSession.jobs.generationController.signal;
        sectionIndex += 1;
        renderer.setStage('intro_cutscene');
        renderer.setStatus('Nonstop Debate opening...');
        renderer.setRoundLabel(sectionIndex, 0, localSession.targetTurns);
        eventBus.emit(NSD_EVENTS.SESSION_STARTED, { session: localSession });
        await waitMs(INTRO_MS, signal);

        localSession.phase = 'active';
        onTransitionPhase?.('nonstop_active', 'nsd_intro_complete');
        eventBus.emit(NSD_EVENTS.STAGE_CHANGED, { phase: 'active', debateId: localSession.debateId });
        renderer.setStage('active');

        while (!signal.aborted && !localSession.hitConfirmed && localSession.turnIndex < localSession.targetTurns) {
            if (Date.now() - localSession.startedAt > MAX_ROUND_MS) {
                cancelSession('max_round_duration');
                onTransitionPhase?.('discussion_post_debate', 'nsd_guard_timeout');
                return;
            }

            if (localSession.queue.pendingLines.length < MAX_BUFFERED_TURNS) {
                prefetch(signal).catch(() => {});
            }

            const line = await nextLine(signal);
            localSession.turnIndex += 1;
            renderer.setRoundLabel(sectionIndex, localSession.turnIndex, localSession.targetTurns);

            const tokenId = `token_${localSession.debateId}_${localSession.turnIndex}`;
            const weakFragment = renderer.buildWeakFragment(line.quote);
            const candidateWeakPoint = {
                ...weakFragment,
                tokenId,
            };

            if (!localSession.weakPoint && localSession.turnIndex >= 2) {
                const attached = combat.attachWeakPoint({
                    token: candidateWeakPoint,
                    quote: line.quote,
                    turnIndex: localSession.turnIndex,
                    debateId: localSession.debateId,
                });
                if (attached) {
                    localSession.weakPoint = attached;
                    localSession.weakPointVisibleAt = Date.now();
                }
            }

            const token = renderer.spawnLine({
                speaker: line.speaker,
                quote: line.quote,
                tokenId,
                debateId: localSession.debateId,
                weakPoint: localSession.weakPoint?.tokenId === tokenId ? { ...weakFragment, id: localSession.weakPoint.id } : null,
            });

            localSession.queue.visibleLines.push(token);
            eventBus.emit(NSD_EVENTS.TOKEN_SPAWNED, { tokenId, debateId: localSession.debateId });
            await token.waitWindow(signal);
            localSession.queue.visibleLines = localSession.queue.visibleLines.filter(item => item?.tokenId !== tokenId);
        }

        if (localSession.hitConfirmed) {
            onTransitionPhase?.('discussion_post_debate', 'nsd_hit_confirmed');
            eventBus.emit(NSD_EVENTS.ROUND_COMPLETED, { result: 'hit', session: localSession });
            cancelSession('resolved');
            return;
        }

        localSession.phase = 'break';
        renderer.setStatus('Section complete. Short break...');
        await waitMs(BREAK_MS, signal);
        eventBus.emit(NSD_EVENTS.ROUND_COMPLETED, { result: 'retry', session: localSession });

        localSession.phase = 'intro_cutscene';
        localSession.turnIndex = 0;
        localSession.targetTurns = randomInt(3, 8);
        localSession.queue.pendingLines = [];
        localSession.queue.visibleLines = [];
        localSession.weakPoint = null;
        localSession.weakPointVisibleAt = null;
        await runRoundLoop(localSession);
    }

    function startFromIntroCutscene() {
        if (session) cancelSession('restart');
        session = buildSession();
        onTransitionPhase?.('nonstop_intro_cutscene', 'nsd_start');
        runRoundLoop(session).catch((err) => {
            if (err?.name !== 'AbortError') {
                console.warn('[Dangan][NSD] Runtime loop failed:', err);
            }
        });
        return { started: true, debateId: session.debateId };
    }

    function resolveTruthBulletShot({ weakPointId, tokenId, debateId, bulletText = '' } = {}) {
        if (!session) return { hit: false, reason: 'no_session' };
        const result = combat.resolveShot({ session, weakPointId, tokenId, debateId, bulletText });
        if (result.hit) {
            session.hitConfirmed = true;
            session.metrics.hitLatencyMs = session.weakPointVisibleAt ? Date.now() - session.weakPointVisibleAt : null;
            session.jobs.generationController.abort('hit_confirmed');
            renderer.setStatus('Truth Bullet HIT! Nonstop Debate ended.');
        }
        return result;
    }

    function sync({ phase } = {}) {
        if (phase === 'nonstop_intro_cutscene' && !session) {
            startFromIntroCutscene();
            return;
        }
        if (phase !== 'nonstop_intro_cutscene' && phase !== 'nonstop_active' && session) {
            cancelSession('phase_changed');
        }
    }

    function stop(reason = 'manual_stop') {
        cancelSession(reason);
    }

    return {
        startFromIntroCutscene,
        resolveTruthBulletShot,
        sync,
        stop,
        on: eventBus.on,
        getSession: () => session,
    };
}
