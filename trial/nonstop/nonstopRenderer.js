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

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function createNonstopRenderer({ onWeakPointClick } = {}) {
    const renderTimers = new Set();

    function ensureOverlay() {
        let overlay = document.getElementById('dangan-nsd-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('section');
        overlay.id = 'dangan-nsd-overlay';
        overlay.className = 'dangan-nsd-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="dangan-nsd-cutscene" id="dangan-nsd-cutscene">
                <div class="dangan-nsd-ring"></div>
                <div class="dangan-nsd-banner">NONSTOP DEBATE</div>
            </div>
            <div class="dangan-nsd-active" id="dangan-nsd-active">
                <div class="dangan-nsd-round-label" id="dangan-nsd-round-label">Section 1 · Replies: 0/0</div>
                <div class="dangan-nsd-floating-layer" id="dangan-nsd-floating-layer"></div>
                <div class="dangan-nsd-controls">
                    <div class="dangan-nsd-status" id="dangan-nsd-status" aria-live="polite">Ready.</div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    function setStatus(text) {
        const el = ensureOverlay().querySelector('#dangan-nsd-status');
        if (el) el.textContent = String(text || '');
    }

    function setRoundLabel(sectionIndex, turnIndex, targetTurns) {
        const el = ensureOverlay().querySelector('#dangan-nsd-round-label');
        if (el) el.textContent = `Section ${sectionIndex} · Replies: ${turnIndex}/${targetTurns}`;
    }

    function setStage(stage) {
        const overlay = ensureOverlay();
        overlay.classList.toggle('active', stage !== 'hidden');
        overlay.classList.toggle('phase-cutscene', stage === 'intro_cutscene');
        overlay.classList.toggle('phase-active', stage === 'active');
        overlay.setAttribute('aria-hidden', stage === 'hidden' ? 'true' : 'false');
    }

    function clearTracks() {
        const layer = ensureOverlay().querySelector('#dangan-nsd-floating-layer');
        if (layer) layer.innerHTML = '';
    }

    function clearTimers() {
        for (const timer of renderTimers) window.clearTimeout(timer);
        renderTimers.clear();
    }

    function buildWeakFragment(quote) {
        const text = String(quote || '').trim();
        if (!text) return { fragment: '', start: 0, end: 0 };
        const len = text.length;
        const fragmentLen = clamp(Math.floor(len * 0.35), 12, 42);
        const maxStart = Math.max(0, len - fragmentLen);
        const start = Math.floor(Math.random() * (maxStart + 1));
        return {
            fragment: text.slice(start, start + fragmentLen).trim(),
            start,
            end: start + fragmentLen,
        };
    }

    function spawnLine({ speaker, quote, tokenId, debateId, weakPoint }) {
        const overlay = ensureOverlay();
        const layer = overlay.querySelector('#dangan-nsd-floating-layer');
        if (!layer) return null;

        const phrase = document.createElement('div');
        phrase.className = 'dangan-nsd-floating-line';
        phrase.dataset.tokenId = tokenId;
        phrase.dataset.debateId = debateId;

        const speakerEl = document.createElement('span');
        speakerEl.className = 'dangan-nsd-floating-speaker';
        speakerEl.textContent = `${speaker}: `;

        const quoteEl = document.createElement('span');
        quoteEl.className = 'dangan-nsd-floating-quote';

        if (weakPoint?.fragment) {
            const before = quote.slice(0, weakPoint.start);
            const hitText = quote.slice(weakPoint.start, weakPoint.end);
            const after = quote.slice(weakPoint.end);
            quoteEl.append(`"${before}`);
            const weak = document.createElement('span');
            weak.className = 'dangan-nsd-weak-point';
            weak.dataset.weakPointId = weakPoint.id;
            weak.dataset.tokenId = tokenId;
            weak.dataset.debateId = debateId;
            weak.textContent = hitText;
            weak.addEventListener('click', () => onWeakPointClick?.({ weakPointId: weakPoint.id, tokenId, debateId }));
            quoteEl.appendChild(weak);
            quoteEl.append(`${after}"`);
        } else {
            quoteEl.textContent = `"${quote}"`;
        }

        phrase.appendChild(speakerEl);
        phrase.appendChild(quoteEl);
        layer.appendChild(phrase);

        const tracks = Array.from(layer.querySelectorAll('.dangan-nsd-floating-line'));
        while (tracks.length > 4) {
            const oldest = tracks.shift();
            oldest?.remove();
        }

        const timer = window.setTimeout(() => {
            phrase.remove();
            renderTimers.delete(timer);
        }, 4500);
        renderTimers.add(timer);

        return {
            tokenId,
            debateId,
            weakPoint,
            expiresAt: Date.now() + 4500,
            element: phrase,
            waitWindow: (signal) => waitMs(4500, signal),
        };
    }

    return {
        ensureOverlay,
        setStage,
        setStatus,
        setRoundLabel,
        clearTracks,
        clearTimers,
        buildWeakFragment,
        spawnLine,
    };
}
