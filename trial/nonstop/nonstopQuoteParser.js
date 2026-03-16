const SMART_QUOTE_REGEX = /“([^”\n\r]+)”/;
const ASCII_QUOTE_REGEX = /"([^"\n\r]+)"/;

export function normalizeQuoteText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseNonstopLine(rawLine) {
    const raw = String(rawLine || '').trim();
    if (!raw) return { ok: false, reason: 'empty' };

    const speakerMatch = raw.match(/^\s*([^:\n\r]{1,40})\s*:/);
    const speaker = String(speakerMatch?.[1] || 'UNKNOWN').trim() || 'UNKNOWN';

    const quoteMatch = raw.match(ASCII_QUOTE_REGEX) || raw.match(SMART_QUOTE_REGEX);
    const quote = String(quoteMatch?.[1] || '').trim();
    if (!quote) return { ok: false, reason: 'missing_quote' };

    return {
        ok: true,
        value: {
            speaker,
            raw,
            quote,
            normalizedQuote: normalizeQuoteText(quote),
        },
    };
}
