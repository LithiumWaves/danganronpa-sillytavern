import { createNonstopDebateDebugRuntime } from './nonstopDebateDebugRuntime.js';
import { createNonstopDebateDebugStage } from './nonstopDebateDebugStage.js';

export function createNonstopDebateDebugStarter({ setVnEnabled, getContext, triggerRegularGeneration } = {}) {
    let active = false;
    let advancing = false;
    const runtime = createNonstopDebateDebugRuntime({ getContext, triggerRegularGeneration });
    const stage = createNonstopDebateDebugStage();

    function applyUiState() {
        document.body.classList.add('dangan-nsd-debug-active');
        stage.show();
        setVnEnabled?.(false);
    }

    function clearUiState() {
        document.body.classList.remove('dangan-nsd-debug-active');
        stage.clear();
        stage.hide();
    }

    async function next({ source = 'manual_advance' } = {}) {
        if (!active) return { advanced: false, reason: 'not_active', source };
        if (advancing) return { advanced: false, reason: 'advance_in_progress', source };

        advancing = true;
        try {
            const result = await runtime.advance();
            if (result?.advanced && result?.line) {
                stage.spawnLine({
                    speaker: result.line.speaker,
                    quote: result.line.quote,
                    turnIndex: result.progress || 0,
                    loopCycle: result.replayCycle || 0,
                });
            }
            return { ...result, source };
        } finally {
            advancing = false;
        }
    }

    function start({ source = 'debug_button' } = {}) {
        if (active) {
            return { started: false, reason: 'already_active', source, session: runtime.getSession() };
        }

        const result = runtime.startSession();
        if (!result.started) return { ...result, source };

        active = true;
        applyUiState();

        window.danganNsdDebug = {
            next: () => next({ source: 'window_api' }),
            stop: () => stop({ reason: 'window_api' }),
            getState: () => runtime.getSession(),
        };

        console.info('[Dangan][NSD] Started simplified NSD debug session.', {
            targetTurns: result.targetTurns,
            eligibleSpeakers: result.eligibleSpeakers,
            controls: {
                advanceKeys: ['Space', 'Enter', 'N'],
                stopKey: 'Escape',
                windowApi: 'window.danganNsdDebug.next() / stop() / getState()',
            },
        });

        return { ...result, source };
    }

    function stop({ reason = 'manual_stop' } = {}) {
        if (!active) return { stopped: false, reason: 'not_active' };
        active = false;
        runtime.stopSession(reason);
        clearUiState();
        delete window.danganNsdDebug;
        return { stopped: true, reason };
    }

    function bindEvents() {
        document.addEventListener('keydown', event => {
            if (!active) return;
            const target = event.target;
            const isTypingTarget = target instanceof HTMLElement && (
                target.tagName === 'INPUT'
                || target.tagName === 'TEXTAREA'
                || target.isContentEditable
            );
            if (isTypingTarget) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                stop({ reason: 'escape_key' });
                return;
            }

            if (event.key === ' ' || event.key === 'Enter' || event.key.toLowerCase() === 'n') {
                event.preventDefault();
                next({ source: 'keyboard' }).catch(err => {
                    console.warn('[Dangan][NSD] Failed to advance simplified NSD session.', err);
                });
            }
        });
    }

    bindEvents();

    return {
        start,
        stop,
        next,
        isActive: () => active,
        getState: () => runtime.getSession(),
    };
}
