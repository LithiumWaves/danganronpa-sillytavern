import { parseNonstopLine } from './nonstopQuoteParser.js';

const FALLBACK_LINES = [
    'Makoto: "That contradiction still doesn\'t explain the locked room."',
    'Kyoko: "Someone moved the evidence after the body was found."',
    'Byakuya: "If your timeline were true, the alarm would have sounded sooner."',
    'Aoi: "No way, I heard footsteps before the lights came back on!"',
    'Toko: "Y-you\'re all ignoring the blood stain near the east door..."',
];

function raceAbort(signal) {
    return new Promise((_, reject) => {
        if (!signal) return;
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
}

function waitTimeout(ms = 6000) {
    return new Promise((_, reject) => {
        window.setTimeout(() => {
            reject(new Error(`generation_timeout_${ms}`));
        }, ms);
    });
}

function pickFallbackLine(speakerHint = 'UNKNOWN') {
    const seeded = String(speakerHint || '').trim();
    if (seeded) {
        return `${seeded}: "I won't accept that claim unless the evidence proves it."`;
    }
    return FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)];
}

export function createNonstopGenerator({ getContext, getSpeakers } = {}) {
    async function requestModelLine({ signal, speakerHint }) {
        const ctx = getContext?.();
        if (!ctx?.generateRaw) {
            return pickFallbackLine(speakerHint);
        }

        const speaker = String(speakerHint || 'UNKNOWN');
        const prompt = `Return exactly one line in this format only:\nSPEAKER: "quoted dialogue"\n\nRules:\n- One quote only\n- No narration\n- No stage directions\n- Keep to <= 24 words\n- Prefer speaker ${speaker}`;

        const generationPromise = ctx.generateRaw({
            prompt,
            max_tokens: 80,
            temperature: 0.8,
            top_p: 0.95,
            stop: ['\n\n', 'USER:', 'ASSISTANT:'],
        });

        const result = await Promise.race([generationPromise, raceAbort(signal), waitTimeout(6000)]);
        return String(result || '').trim();
    }

    async function nextTurn({ signal, speakerHint, maxRetries = 2, metrics }) {
        const speakers = getSpeakers?.() || [];
        let currentHint = speakerHint || speakers[Math.floor(Math.random() * Math.max(1, speakers.length))] || 'UNKNOWN';

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            const raw = await requestModelLine({ signal, speakerHint: currentHint }).catch(() => pickFallbackLine(currentHint));
            const parsed = parseNonstopLine(raw);
            metrics.generatedTurns += 1;
            if (parsed.ok) return parsed.value;
            metrics.parseFailures += 1;
            metrics.retriesUsed += 1;
            currentHint = speakers[Math.floor(Math.random() * Math.max(1, speakers.length))] || 'UNKNOWN';
        }

        const raw = pickFallbackLine(currentHint);
        return parseNonstopLine(raw).value;
    }

    return { nextTurn };
}
