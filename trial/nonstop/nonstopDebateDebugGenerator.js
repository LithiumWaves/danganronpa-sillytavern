function parseGeneratedLine(raw, speakerHint = 'UNKNOWN') {
    const text = String(raw || '').trim();
    const match = text.match(/^\s*([^:]+):\s*["“](.+?)["”]\s*$/s);
    if (match) {
        return {
            speaker: String(match[1] || speakerHint).trim() || speakerHint,
            quote: String(match[2] || '').trim() || '...'
        };
    }

    const quoted = text.match(/["“](.+?)["”]/s);
    if (quoted) {
        return {
            speaker: speakerHint,
            quote: String(quoted[1] || '').trim() || '...'
        };
    }

    return {
        speaker: speakerHint,
        quote: text || "I won't back down until the truth comes out.",
    };
}

function waitForAbort(signal) {
    return new Promise((_, reject) => {
        if (!signal) return;
        if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
}

function waitForTimeout(ms = 12000) {
    return new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(`generation_timeout_${ms}`)), ms);
    });
}

function buildFallbackLine(speakerHint, turnIndex) {
    const fallbackQuotes = [
        'That claim leaves a gap in the timeline.',
        'The evidence points somewhere else entirely.',
        'If that were true, the scene would not line up.',
        'You are glossing over a contradiction right there.',
        'There is still one detail that does not make sense.',
    ];

    return {
        speaker: speakerHint,
        quote: fallbackQuotes[turnIndex % fallbackQuotes.length],
    };
}

export function createNonstopDebateDebugGenerator({ getContext } = {}) {
    async function generateTurn({ speakerHint, turnIndex = 0, priorLines = [], signal } = {}) {
        const ctx = getContext?.() || {};
        const recentChat = Array.isArray(ctx.chat)
            ? ctx.chat
                .filter(msg => msg && !(msg.is_user || msg.isUser || msg.is_system || msg.isSystem || msg.is_system_message))
                .slice(-8)
                .map(msg => `${String(msg.ch_name || msg.name || 'UNKNOWN').trim()}: ${String(msg.mes || msg.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
                .filter(Boolean)
                .join('\n')
            : '';

        if (!ctx.generateRaw) {
            return buildFallbackLine(speakerHint, turnIndex);
        }

        const usedQuotes = priorLines
            .slice(-4)
            .map(line => `- ${line.speaker}: "${line.quote}"`)
            .join('\n');

        const prompt = `Return exactly one line in this format:\n${speakerHint}: "quoted dialogue"\n\nRules:\n- Speaker must be exactly ${speakerHint}\n- One quoted sentence only\n- No narration\n- No stage directions\n- Maximum 24 words\n- Make it sound like a Class Trial contradiction or rebuttal\n- Avoid repeating these lines:\n${usedQuotes || '- none yet'}\n\nRecent chat context:\n${recentChat || '(no recent chat context available)'}`;

        try {
            const raw = await Promise.race([
                ctx.generateRaw({
                    prompt,
                    max_tokens: 90,
                    temperature: 0.85,
                    top_p: 0.95,
                    stop: ['\n\n', 'USER:', 'ASSISTANT:'],
                }),
                waitForAbort(signal),
                waitForTimeout(12000),
            ]);

            return parseGeneratedLine(raw, speakerHint);
        } catch {
            return buildFallbackLine(speakerHint, turnIndex);
        }
    }

    return {
        generateTurn,
    };
}
