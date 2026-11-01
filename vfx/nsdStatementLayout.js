// V3-style Non-Stop Debate statement layout.
//
// Turns one debate line (with optional [[weak point]] / ((agreement)) markup)
// into a mixed-size, multi-line layout: function words shrink, a few key words
// grow, weak/agree spans are always the biggest, and the whole block is shown
// flat, tilted, or vertical. Pure — no DOM — so it can be unit-tested; the
// trial manager turns the result into HTML with renderStatementHtml().

const STOPWORDS = new Set([
    "a", "an", "the", "and", "or", "but", "so", "if", "of", "to", "in", "on", "at", "by", "for", "with",
    "from", "into", "onto", "about", "as", "than", "then", "that", "this", "these", "those", "there",
    "is", "was", "were", "are", "am", "be", "been", "being", "it", "its", "it's", "he", "she", "they",
    "we", "you", "i", "me", "him", "her", "them", "us", "my", "your", "his", "their", "our",
    "do", "did", "does", "has", "had", "have", "just", "even", "all", "any", "some", "no", "not",
    "can", "could", "would", "should", "will", "what", "who", "how", "why", "when", "where", "which",
    "up", "out", "off", "over", "only", "very", "too", "also", "cuz", "'cause", "because", "right",
]);

// Size tiers, as multiples of the statement's base font size.
export const TIER_SCALE = [0.62, 1, 1.55];

const MARKUP_RE = /\[\[\s*([^\]]+?)\s*\]\]|\(\(\s*([^)]+?)\s*\)\)/g;

function bareWord(text) {
    return String(text).toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
}

// Splits a raw line into tokens. A [[weak]] or ((agree)) span stays one token
// (even when it has spaces) so it renders as a single hit-testable element.
// If both kinds appear, agreement wins and weak brackets are dropped — the
// same rule showStatementChunk has always applied.
export function tokenizeStatement(raw) {
    let text = String(raw ?? "");
    if (/\(\([^)]+\)\)/.test(text)) text = text.replace(/\[\[\s*([^\]]+?)\s*\]\]/g, "$1");
    const tokens = [];
    const pushPlain = (chunk) => {
        for (const w of chunk.split(/\s+/)) if (w) tokens.push({ text: w, kind: "plain" });
    };
    let last = 0;
    let m;
    MARKUP_RE.lastIndex = 0;
    while ((m = MARKUP_RE.exec(text)) !== null) {
        const before = text.slice(last, m.index);
        // Punctuation glued to the span ("[[library]].") attaches to the span's
        // neighbours rather than becoming its own word.
        pushPlain(before);
        if (m[1] !== undefined) tokens.push({ text: m[1].trim(), kind: "weak" });
        else tokens.push({ text: m[2].trim(), kind: "agree" });
        last = m.index + m[0].length;
    }
    pushPlain(text.slice(last));
    // Re-attach stray punctuation tokens to the previous token.
    const merged = [];
    for (const t of tokens) {
        if (t.kind === "plain" && /^[^A-Za-z0-9]+$/.test(t.text) && merged.length) {
            const prev = merged[merged.length - 1];
            if (prev.kind === "plain") prev.text += t.text;
            else merged.push({ ...t, tail: true });
        } else {
            merged.push(t);
        }
    }
    return merged;
}

function emphasisScore(token, index) {
    const w = bareWord(token.text);
    if (!w) return -1;
    let score = w.length;
    if (STOPWORDS.has(w)) score -= 10;
    // Capitalised mid-sentence → probably a name or key noun.
    if (index > 0 && /^[A-Z]/.test(token.text.replace(/^[^A-Za-z]+/, ""))) score += 4;
    if (/[!?]$/.test(token.text)) score += 2;
    return score;
}

// Assigns a size tier to each token. Markup spans are tier 2; stopwords are
// tier 0; the top 1–3 remaining words (fewer when a markup span is present)
// are tier 2; the rest tier 1.
export function assignTiers(tokens) {
    const hasMarkup = tokens.some(t => t.kind !== "plain");
    const plainCount = tokens.filter(t => t.kind === "plain").length;
    const maxEmph = hasMarkup
        ? Math.min(1, Math.floor(plainCount / 5))
        : Math.max(1, Math.min(3, Math.ceil(plainCount / 4)));
    const ranked = tokens
        .map((t, i) => ({ i, t, s: t.kind === "plain" ? emphasisScore(t, i) : -Infinity }))
        .filter(x => x.t.kind === "plain" && x.s > 3)
        .sort((a, b) => b.s - a.s)
        .slice(0, maxEmph)
        .map(x => x.i);
    const emph = new Set(ranked);
    return tokens.map((t, i) => {
        if (t.kind !== "plain") return { ...t, tier: 2 };
        if (emph.has(i)) return { ...t, tier: 2 };
        const w = bareWord(t.text);
        return { ...t, tier: STOPWORDS.has(w) || w.length <= 2 ? 0 : 1 };
    });
}

function tokenWeight(t) {
    return (t.text.length + 1) * TIER_SCALE[t.tier];
}

// Greedy balanced split of tokens into `count` lines by weighted width.
export function breakLines(tokens, count) {
    if (count <= 1 || tokens.length <= 1) return [tokens.slice()];
    const total = tokens.reduce((s, t) => s + tokenWeight(t), 0);
    const target = total / count;
    const lines = [];
    let cur = [];
    let acc = 0;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const w = tokenWeight(t);
        const remainingTokens = tokens.length - i;
        const remainingLines = count - lines.length;
        // Break before this token when the current line is full enough, but
        // never leave fewer tokens than lines still to fill.
        if (cur.length && lines.length < count - 1 && acc + w / 2 > target && remainingTokens >= remainingLines - 1) {
            lines.push(cur);
            cur = [];
            acc = 0;
        }
        cur.push(t);
        acc += w;
    }
    if (cur.length) lines.push(cur);
    return lines;
}

function lineCountFor(tokens) {
    const chars = tokens.reduce((s, t) => s + t.text.length + 1, 0);
    if (tokens.length <= 3 || chars < 22) return 1;
    if (chars < 58) return 2;
    return 3;
}

export const VERTICAL_MAX_TOKENS = 6;

// Full layout for one line of debate text.
//   { layout: 'flat'|'tilt'|'vertical', tilt: deg, lines: [{ offset, tokens: [{ text, kind, tier }] }] }
export function layoutStatement(raw, { rng = Math.random } = {}) {
    const tokens = assignTiers(tokenizeStatement(raw));
    const longest = tokens.reduce((m, t) => Math.max(m, t.text.length), 0);
    const canVertical = tokens.length > 0 && tokens.length <= VERTICAL_MAX_TOKENS && longest <= 18;

    const roll = rng();
    let layout = "flat";
    if (canVertical && roll < 0.2) layout = "vertical";
    else if (roll < 0.45) layout = "tilt";

    const lineCount = layout === "vertical" ? Math.min(2, lineCountFor(tokens)) : lineCountFor(tokens);
    const rawLines = breakLines(tokens, lineCount);
    // V3 staggers stacked lines: alternate left/right offsets in em.
    const lines = rawLines.map((lineTokens, i) => ({
        offset: rawLines.length === 1 ? 0 : (i % 2 === 0 ? -1 : 1) * (0.4 + rng() * 0.9),
        tokens: lineTokens,
    }));

    const sign = rng() < 0.5 ? -1 : 1;
    const tilt = layout === "tilt" ? sign * (8 + rng() * 6) : layout === "vertical" ? -90 : 0;
    return { layout, tilt, lines };
}

// Turns a layout into the statement's inner HTML. Weak/agree tokens keep the
// .dangan-weak-point / .dangan-agree-text classes the hit-testing relies on.
export function renderStatementHtml(layout, escapeHtml) {
    const lines = layout.lines.map(line => {
        // Punctuation that trailed a markup span hugs it (no space before).
        const words = line.tokens.map((t, i) => {
            const cls = [`nsd-w`, `nsd-w-t${t.tier}`];
            if (t.kind === "weak") cls.push("dangan-weak-point");
            else if (t.kind === "agree") cls.push("dangan-agree-text");
            const sep = i === 0 || t.tail ? "" : " ";
            return `${sep}<span class="${cls.join(" ")}">${escapeHtml(t.text)}</span>`;
        }).join("");
        const style = line.offset ? ` style="transform:translateX(${line.offset.toFixed(2)}em)"` : "";
        return `<div class="nsd-line"${style}>${words}</div>`;
    }).join("");
    return `<div class="nsd-stmt-inner nsd-layout-${layout.layout}" style="transform:rotate(${layout.tilt.toFixed(1)}deg)">${lines}</div>`;
}
