// What each chat message did to the story (Truth Bullets, trust, Monocoins,
// XP, gift reactions, investigation), so swiping, deleting or editing the message can take it
// back. Entries are keyed by chat and by the message's identity: who said it,
// which swipe, and a hash of its text. A message being generated doesn't have
// its final text yet, so its entry is keyed by position until it finishes.

const MAX_ENTRIES = 600;

export function hashText(text) {
    let h = 5381;
    const s = String(text ?? "");
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

export function messageIdentity(message) {
    if (!message) return "";
    const who = message.is_user ? "u" : "c";
    return `${who}|${message.name ?? ""}|${Number(message.swipe_id ?? 0)}|${hashText(message.mes)}`;
}

const TB_RE = /V3C\s*[|｜]\s*TB:\s*([^|\n\r]+)/gi;
const SOCIAL_RE = /V3C\s*[|｜]\s*SOCIAL(?:_(UP|DOWN))?:\s*([^\n\r]+)/gi;
const INVESTIGATION_RE = /V3C\s*[|｜]\s*INVESTIGATION\s*[_-]?\s*START/i;

const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// The markers a message carries, in a form that ignores formatting. Two
// versions of a message with the same summary have the same effects.
export function markerSummary(text) {
    const raw = String(text ?? "");
    const parts = [];
    for (const m of raw.matchAll(TB_RE)) parts.push(`tb:${squash(m[1])}`);
    for (const m of raw.matchAll(SOCIAL_RE)) parts.push(`${m[1] ? m[1].toLowerCase() : "up"}:${squash(m[2])}`);
    if (INVESTIGATION_RE.test(raw)) parts.push("inv");
    return parts.sort().join(",");
}

export function emptyEffects() {
    return { truth: [], trust: [], gifts: [], coins: 0, fragments: 0, xp: 0, investigation: false };
}

export function hasEffects(e) {
    return Boolean(e && (e.truth.length || e.trust.length || e.gifts?.length || e.coins || e.fragments || e.xp || e.investigation));
}

function mergeEffects(into, add) {
    into.truth.push(...add.truth);
    into.trust.push(...add.trust);
    (into.gifts ||= []).push(...(add.gifts || []));
    into.coins += add.coins;
    into.fragments += add.fragments;
    into.xp += add.xp;
    into.investigation = into.investigation || add.investigation;
    return into;
}

export function createEffectLedger({ getStore, now = () => Date.now() } = {}) {
    const entries = () => getStore();

    const keyFor = (chatId, identity) => `${chatId}::${identity}`;
    const pendingKey = (chatId, mesId, swipeId) => `${chatId}::pos:${mesId}:${swipeId}`;

    function prune() {
        const store = entries();
        const keys = Object.keys(store);
        if (keys.length <= MAX_ENTRIES) return;
        keys.sort((a, b) => (store[a].at || 0) - (store[b].at || 0))
            .slice(0, keys.length - MAX_ENTRIES)
            .forEach((k) => delete store[k]);
    }

    // Adds what a message just did. `pending` is true while it's still being
    // generated; finalize() gives it a proper identity afterwards.
    function record({ chatId, mesId, message, effects, pending = false }) {
        if (!chatId || !message || !hasEffects(effects)) return null;
        const store = entries();
        const swipeId = Number(message.swipe_id ?? 0);
        const key = pending ? pendingKey(chatId, mesId, swipeId) : keyFor(chatId, messageIdentity(message));
        const entry = store[key] ||= {
            chatId,
            mesId,
            swipeId,
            speaker: `${message.is_user ? "u" : "c"}|${message.name ?? ""}`,
            identity: pending ? "" : messageIdentity(message),
            markers: pending ? "" : markerSummary(message.mes),
            pending,
            at: now(),
            ...emptyEffects(),
        };
        mergeEffects(entry, effects);
        entry.at = now();
        prune();
        return entry;
    }

    // A generation finished: key its entries by the final text. Returns the
    // entries that got an identity.
    function finalize(chatId, chat) {
        const store = entries();
        const done = [];
        for (const [key, entry] of Object.entries(store)) {
            if (entry.chatId !== chatId || !entry.pending) continue;
            const message = chat[entry.mesId];
            delete store[key];
            if (!message) continue;
            entry.pending = false;
            entry.swipeId = Number(message.swipe_id ?? 0);
            entry.identity = messageIdentity(message);
            entry.markers = markerSummary(message.mes);
            const existing = store[keyFor(chatId, entry.identity)];
            store[keyFor(chatId, entry.identity)] = existing ? mergeEffects(existing, entry) : entry;
            done.push(store[keyFor(chatId, entry.identity)]);
        }
        return done;
    }

    // Compares the chat with what was recorded. Returns entries to revert
    // (removed from the ledger), entries whose message moved because messages
    // above it were deleted, and entries re-keyed after an edit that kept
    // their markers.
    function reconcile(chatId, chat) {
        const store = entries();
        const positions = new Map();
        chat.forEach((message, index) => {
            const id = messageIdentity(message);
            if (!positions.has(id)) positions.set(id, index);
        });

        const revert = [];
        const moved = [];
        const rekeyed = [];
        for (const [key, entry] of Object.entries(store)) {
            if (entry.chatId !== chatId || entry.pending) continue;

            const at = positions.get(entry.identity);
            if (at !== undefined) {
                if (at !== entry.mesId) {
                    moved.push({ entry, from: entry.mesId, to: at });
                    entry.mesId = at;
                }
                continue;
            }

            // Same message, edited without touching its markers: keep it.
            const message = chat[entry.mesId];
            if (message
                && `${message.is_user ? "u" : "c"}|${message.name ?? ""}` === entry.speaker
                && Number(message.swipe_id ?? 0) === entry.swipeId
                && markerSummary(message.mes) === entry.markers) {
                delete store[key];
                const oldIdentity = entry.identity;
                entry.identity = messageIdentity(message);
                store[keyFor(chatId, entry.identity)] = entry;
                rekeyed.push({ entry, oldIdentity });
                continue;
            }

            delete store[key];
            revert.push(entry);
        }
        return { revert, moved, rekeyed };
    }

    return { record, finalize, reconcile };
}
