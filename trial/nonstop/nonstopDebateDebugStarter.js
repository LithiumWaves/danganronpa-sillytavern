import { createNonstopDebateDebugRuntime } from './nonstopDebateDebugRuntime.js';

function ensureOverlay() {
    let overlay = document.getElementById('dangan-nsd-debug-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('section');
    overlay.id = 'dangan-nsd-debug-overlay';
    overlay.className = 'dangan-nsd-debug-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="dangan-nsd-debug-card" role="status" aria-live="polite">
            <div class="dangan-nsd-debug-title">NONSTOP DEBATE (DEBUG)</div>
            <div class="dangan-nsd-debug-subtitle">New runtime path is now wired.</div>
            <button id="dangan-nsd-debug-exit" type="button">EXIT NSD DEBUG</button>
        </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
}

export function createNonstopDebateDebugStarter({ setVnEnabled, getContext } = {}) {
    let active = false;
    const runtime = createNonstopDebateDebugRuntime({ getContext });

    function applyUiState(snapshot) {
        const overlay = ensureOverlay();
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');

        const subtitle = overlay.querySelector('.dangan-nsd-debug-subtitle');
        if (subtitle) {
            const names = snapshot.eligibleSpeakers.join(', ');
            subtitle.textContent = names
                ? `Eligible speakers (${snapshot.eligibleSpeakers.length}): ${names}`
                : 'No eligible unmuted speakers in this chat.';
        }

        document.body.classList.add('dangan-nsd-debug-active');

        const chat = document.getElementById('chat');
        chat?.classList.add('dangan-nsd-chat-hidden');

        setVnEnabled?.(false);
    }

    function clearUiState() {
        const overlay = document.getElementById('dangan-nsd-debug-overlay');
        overlay?.classList.remove('active');
        overlay?.setAttribute('aria-hidden', 'true');

        document.body.classList.remove('dangan-nsd-debug-active');
        const chat = document.getElementById('chat');
        chat?.classList.remove('dangan-nsd-chat-hidden');
    }

    function start({ source = 'debug_button' } = {}) {
        const snapshot = runtime.buildStartSnapshot();
        if (!snapshot.eligibleSpeakers.length) {
            return { started: false, reason: 'no_eligible_speakers', source };
        }

        active = true;
        applyUiState(snapshot);
        return { started: true, source, eligibleSpeakers: snapshot.eligibleSpeakers };
    }

    function stop({ reason = 'manual_stop' } = {}) {
        if (!active) return { stopped: false, reason: 'not_active' };
        active = false;
        clearUiState();
        return { stopped: true, reason };
    }

    function bindEvents() {
        document.addEventListener('click', event => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (!target.closest('#dangan-nsd-debug-exit')) return;
            stop({ reason: 'exit_button' });
        });
    }

    bindEvents();

    return {
        start,
        stop,
        isActive: () => active,
    };
}
