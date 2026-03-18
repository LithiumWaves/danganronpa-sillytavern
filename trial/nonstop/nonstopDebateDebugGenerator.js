const NSD_NEXT_REPLY_PROMPT_KEY = 'dangan_nsd_next_reply';

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

function waitForTimeout(ms = 20000) {
    return new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(`generation_timeout_${ms}`)), ms);
    });
}

function sleep(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function getSetExtensionPrompt(ctx) {
    return ctx?.setExtensionPrompt || window.SillyTavern?.getContext?.()?.setExtensionPrompt || window.setExtensionPrompt || null;
}

function setNextReplyPrompt(ctx, text) {
    const setPrompt = getSetExtensionPrompt(ctx);
    if (typeof setPrompt !== 'function') return false;
    setPrompt(NSD_NEXT_REPLY_PROMPT_KEY, String(text || ''), 0, 0, false, 'system');
    return true;
}

function clearNextReplyPrompt(ctx) {
    const setPrompt = getSetExtensionPrompt(ctx);
    if (typeof setPrompt !== 'function') return false;
    setPrompt(NSD_NEXT_REPLY_PROMPT_KEY, '', 0, 0, false, 'system');
    return true;
}

function getChatMessages(ctx) {
    return Array.isArray(ctx?.chat) ? ctx.chat : [];
}

function getMessageSignature(msg, index = -1) {
    if (!msg) return `missing:${index}`;
    return [
        index,
        msg.mes ?? msg.message ?? msg.content ?? '',
        msg.name ?? msg.ch_name ?? '',
        msg.swipe_id ?? '',
        msg.send_date ?? msg.gen_id ?? msg.id ?? '',
    ].map(part => String(part || '')).join('||');
}

function getLastCharacterMessage(ctx) {
    const chat = getChatMessages(ctx);
    for (let i = chat.length - 1; i >= 0; i -= 1) {
        const msg = chat[i];
        if (!msg) continue;
        if (msg.is_user || msg.isUser || msg.is_system || msg.isSystem || msg.is_system_message) continue;
        return { msg, index: i, signature: getMessageSignature(msg, i) };
    }
    return null;
}

function parseChatReply(entry, speakerHint = 'UNKNOWN') {
    const msg = entry?.msg || {};
    const quote = toPlainText(msg.mes ?? msg.message ?? msg.content ?? '') || "I won't back down until the truth comes out.";
    return {
        speaker: String(msg.ch_name ?? msg.name ?? speakerHint).trim() || speakerHint,
        quote,
        source: 'regular_generation',
    };
}

async function waitForGeneratedReply({ getContext, beforeSignature, signal, timeoutMs = 20000 } = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const ctx = getContext?.() || {};
        const last = getLastCharacterMessage(ctx);
        if (last && last.signature !== beforeSignature) {
            return last;
        }
        await Promise.race([sleep(120), waitForAbort(signal)]).catch(err => {
            if (err?.name === 'AbortError') throw err;
        });
    }

    throw new Error(`generation_timeout_${timeoutMs}`);
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

export function createNonstopDebateDebugGenerator({ getContext, triggerRegularGeneration } = {}) {
    async function generateTurn({ speakerHint, turnIndex = 0, priorLines = [], signal } = {}) {
        const ctx = getContext?.() || {};
        const recentChat = getChatMessages(ctx)
            .filter(msg => msg && !(msg.is_user || msg.isUser || msg.is_system || msg.isSystem || msg.is_system_message))
            .slice(-8)
            .map(msg => `${String(msg.ch_name || msg.name || 'UNKNOWN').trim()}: ${toPlainText(msg.mes || msg.message || '')}`)
            .filter(Boolean)
            .join('\n');

        const usedQuotes = priorLines
            .slice(-4)
            .map(line => `- ${line.speaker}: "${line.quote}"`)
            .join('\n');

        const steeringPrompt = [
            '[NONSTOP DEBATE NEXT REPLY]',
            `For the next assistant reply only, speak as ${speakerHint}.`,
            'Write this as a normal in-character reply using the active main preset and current chat settings.',
            'Keep it brief and suitable for a Class Trial exchange.',
            'Prefer direct spoken dialogue and avoid narration or stage directions.',
            usedQuotes ? `Avoid repeating these recent NSD lines:\n${usedQuotes}` : '',
            recentChat ? `Recent chat context:\n${recentChat}` : '',
        ].filter(Boolean).join('\n\n');

        const beforeSignature = getLastCharacterMessage(ctx)?.signature || `chat_len:${getChatMessages(ctx).length}`;

        try {
            setNextReplyPrompt(ctx, steeringPrompt);

            const triggerResult = await Promise.resolve(triggerRegularGeneration?.());
            if (triggerResult === false) {
                throw new Error('regular_generation_trigger_unavailable');
            }

            const generatedEntry = await Promise.race([
                waitForGeneratedReply({ getContext, beforeSignature, signal, timeoutMs: 20000 }),
                waitForAbort(signal),
                waitForTimeout(20000),
            ]);

            return parseChatReply(generatedEntry, speakerHint);
        } catch {
            return buildFallbackLine(speakerHint, turnIndex);
        } finally {
            clearNextReplyPrompt(getContext?.() || ctx);
        }
    }

    return {
        generateTurn,
    };
}
