function toPlainText(value) {
    return String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
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

function parseStructuredLine(raw, speakerHint = 'UNKNOWN') {
    const text = String(raw || '').trim();
    const directMatch = text.match(/^\s*([^:\n]+):\s*["“](.+?)["”]\s*$/s);
    if (directMatch) {
        return {
            speaker: String(directMatch[1] || speakerHint).trim() || speakerHint,
            quote: toPlainText(directMatch[2] || '...') || '...',
            source: 'nsd_structured_generation',
        };
    }

    const quoted = text.match(/["“](.+?)["”]/s);
    return {
        speaker: speakerHint,
        quote: toPlainText(quoted?.[1] || text || '...') || '...',
        source: 'nsd_structured_generation',
    };
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
        source: 'fallback',
    };
}

function buildRecentChatContext(ctx) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    return chat
        .filter(msg => msg && !(msg.is_user || msg.isUser || msg.is_system || msg.isSystem || msg.is_system_message))
        .slice(-10)
        .map(msg => `${String(msg.ch_name || msg.name || 'UNKNOWN').trim()}: ${toPlainText(msg.mes || msg.message || msg.content || '')}`)
        .filter(Boolean)
        .join('\n');
}

function buildPrompt({ speakerHint, priorLines, recentChat }) {
    const recentDebateLines = priorLines
        .slice(-4)
        .map(line => `- ${line.speaker}: "${line.quote}"`)
        .join('\n');

    return [
        'Return exactly one Nonstop Debate statement in this format only:',
        `${speakerHint}: "quoted dialogue"`,
        '',
        'Rules:',
        `- Speaker must be exactly ${speakerHint}`,
        '- Output one single quoted line only',
        '- No narration',
        '- No stage directions',
        '- No actions in asterisks',
        '- Maximum 24 words',
        '- Sound like a Danganronpa-style Class Trial contradiction, rebuttal, suspicion, or observation',
        '- Make it usable as flying debate text',
        recentDebateLines ? `- Do not repeat these recent debate lines:\n${recentDebateLines}` : '- No repeated phrasing',
        recentChat ? `Recent chat context:\n${recentChat}` : 'Recent chat context unavailable',
    ].join('\n');
}

export function createNonstopDebateDebugGenerator({ getContext } = {}) {
    async function generateTurn({ speakerHint, turnIndex = 0, priorLines = [], signal } = {}) {
        const ctx = getContext?.() || {};
        const recentChat = buildRecentChatContext(ctx);

        if (typeof ctx.generateRaw !== 'function') {
            return buildFallbackLine(speakerHint, turnIndex);
        }

        const prompt = buildPrompt({ speakerHint, priorLines, recentChat });

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

            return parseStructuredLine(raw, speakerHint);
        } catch {
            return buildFallbackLine(speakerHint, turnIndex);
        }
    }

    return {
        generateTurn,
    };
}
