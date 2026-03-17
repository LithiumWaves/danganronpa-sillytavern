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

export function createNonstopDebateDebugStarter({ setVnEnabled } = {}) {
    let active = false;

    function applyUiState() {
        const overlay = ensureOverlay();
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');

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
        active = true;
        applyUiState();
        return { started: true, source };
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
