function chunkQuote(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return ['...'];

    const chunks = [];
    for (let i = 0; i < words.length;) {
        const size = Math.min(words.length - i, chunks.length === 0 ? 3 : (Math.random() > 0.55 ? 3 : 2));
        chunks.push(words.slice(i, i + size).join(' '));
        i += size;
    }

    return chunks;
}

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

export function createNonstopDebateDebugStage() {
    let timerIds = new Set();

    function ensureStage() {
        let stage = document.getElementById('dangan-nsd-debug-stage');
        if (stage) return stage;

        stage = document.createElement('section');
        stage.id = 'dangan-nsd-debug-stage';
        stage.className = 'dangan-nsd-debug-stage';
        stage.setAttribute('aria-hidden', 'true');
        document.body.appendChild(stage);
        return stage;
    }

    function show() {
        const stage = ensureStage();
        stage.classList.add('active');
        stage.setAttribute('aria-hidden', 'false');
    }

    function hide() {
        const stage = document.getElementById('dangan-nsd-debug-stage');
        stage?.classList.remove('active');
        stage?.setAttribute('aria-hidden', 'true');
    }

    function clear() {
        const stage = ensureStage();
        stage.innerHTML = '';
        for (const timerId of timerIds) window.clearTimeout(timerId);
        timerIds = new Set();
    }

    function spawnLine({ speaker, quote, turnIndex = 0, loopCycle = 0 } = {}) {
        const stage = ensureStage();
        const chunks = chunkQuote(quote);
        const speakerLabel = String(speaker || 'UNKNOWN').trim().toUpperCase();

        chunks.forEach((chunk, index) => {
            const token = document.createElement('div');
            token.className = 'dangan-nsd-debug-chunk';
            token.dataset.turnIndex = String(turnIndex);
            token.dataset.loopCycle = String(loopCycle);
            token.style.setProperty('--nsd-top', `${randomBetween(12, 74)}vh`);
            token.style.setProperty('--nsd-duration', `${randomBetween(5.4, 8.1)}s`);
            token.style.setProperty('--nsd-delay', `${index * 120}ms`);
            token.style.setProperty('--nsd-scale', `${randomBetween(0.92, 1.14)}`);
            token.textContent = index === 0 ? `${speakerLabel}: “${chunk}` : chunk;
            if (index === chunks.length - 1) token.textContent = `${token.textContent}”`;
            stage.appendChild(token);

            const timerId = window.setTimeout(() => {
                token.remove();
                timerIds.delete(timerId);
            }, 9000 + index * 120);
            timerIds.add(timerId);
        });
    }

    return {
        show,
        hide,
        clear,
        spawnLine,
    };
}
