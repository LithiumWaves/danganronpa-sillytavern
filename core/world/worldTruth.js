// The truth of the world: the mysteries that run through the whole game, as
// in DR1, DR2 and V3. Who is behind the killing game (the mastermind), what
// they want, what happened outside, and the secrets that come out chapter by
// chapter. Drafted by one hidden AI call, editable behind a spoiler gate, kept
// per save under the story key `worldTruth`. Pure helpers, unit tested.
//
// A secret comes out one way (its `source`):
// - exploration: a secret file in a room, found by examining it in daily life;
// - flashback: a Flashback Light handed out at a chapter's start (optional;
//   with Flashback Lights off these are found by exploring instead);
// - monokuma: Monokuma lets it slip over the monitors when the chapter starts;
// - final: the last truths, told at the final trial (or when the mastermind
//   is stamped in the final chapter).

import { extractJsonObject, matchRoom } from "../case/caseFile.js";

export const SECRET_SOURCES = Object.freeze(["exploration", "flashback", "monokuma", "final"]);
export const DEFAULT_FINAL_CHAPTER = 6;
const MAX_SECRETS = 16;

function text(value, max = 600) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function key(value) {
    return text(value, 120).toLowerCase();
}

function same(a, b) {
    return Boolean(key(a)) && key(a) === key(b);
}

function clampChapter(n, finalChapter) {
    return Math.max(1, Math.min(Number(finalChapter) || DEFAULT_FINAL_CHAPTER, Math.round(Number(n) || 1)));
}

function normalizeSecret(raw, i, finalChapter) {
    const title = text(raw?.title, 120);
    const body = text(raw?.text, 900);
    if (!title && !body) return null;
    const source = SECRET_SOURCES.includes(raw?.source) ? raw.source : "exploration";
    return {
        id: text(raw?.id, 40) || `secret${i + 1}`,
        title: title || "A secret",
        text: body,
        chapter: source === "final" ? Number(finalChapter) : clampChapter(raw?.chapter, finalChapter),
        source,
        // Where an exploration secret (or a flashback one, with Flashback
        // Lights off) is hidden, and the spot it's in once one is picked.
        roomId: text(raw?.roomId, 120),
        roomLabel: text(raw?.roomLabel, 120),
        spotLabel: text(raw?.spotLabel, 60),
        revealed: Boolean(raw?.revealed),
        revealedChapter: Math.max(0, Math.round(Number(raw?.revealedChapter) || 0)),
    };
}

export function normalizeWorldTruth(raw) {
    if (!raw || typeof raw !== "object") return null;
    const finalChapter = Math.max(1, Math.min(9, Math.round(Number(raw.finalChapter) || DEFAULT_FINAL_CHAPTER)));
    const ids = new Set();
    const secrets = [];
    (Array.isArray(raw.secrets) ? raw.secrets : []).forEach((s, i) => {
        const secret = normalizeSecret(s, i, finalChapter);
        if (!secret) return;
        let id = secret.id;
        for (let n = 2; ids.has(id); n += 1) id = `${secret.id}_${n}`;
        ids.add(id);
        secrets.push({ ...secret, id });
    });
    return {
        version: 1,
        mastermind: text(raw.mastermind, 80),
        goal: text(raw.goal, 900),
        outsideWorld: text(raw.outsideWorld, 900),
        finalChapter,
        secrets: secrets.slice(0, MAX_SECRETS),
        // The Flashback Light the player holds (a secret id), if any.
        flashbackPending: text(raw.flashbackPending, 40),
        // "" | "active" | "done"; how it ended: "" | "hope" | "despair".
        finalTrial: ["active", "done"].includes(raw.finalTrial) ? raw.finalTrial : "",
        ending: ["hope", "despair"].includes(raw.ending) ? raw.ending : "",
        verdict: ["correct", "wrong"].includes(raw.verdict) ? raw.verdict : "",
    };
}

// ── Drafting ──

export const DEFAULT_WORLD_TRUTH_TEMPLATE = `Write the hidden truth behind a Danganronpa killing game: the mysteries that run through the whole story, revealed bit by bit over {{chapters}} chapters, like the mastermind and the outside world in DR1, DR2 and V3.

THE PLAYER: {{player}} (never the mastermind).

STUDENTS (the mastermind must be one of these names):
{{cast}}

ROOMS (copy a room's id exactly; "opens in chapter N" means the floor is locked until then):
{{rooms}}

SETTING NOTES (from the lorebook, may be empty):
{{lorebook}}

{{format}}`;

export function buildWorldTruthFormat({ finalChapter = DEFAULT_FINAL_CHAPTER } = {}) {
    return `Reply with one compact JSON object and nothing else: start with { and end with }. Keep texts short.
{
  "mastermind": "the student secretly behind the killing game",
  "goal": "what the mastermind wants and why, 1-2 sentences",
  "outsideWorld": "what has really happened outside the school, 1-2 sentences",
  "secrets": [{ "title": "short title", "text": "the secret, 1-2 sentences", "chapter": 1 to ${finalChapter}, "source": "exploration" or "flashback" or "monokuma" or "final", "room": "room id where a secret file is hidden (for exploration and flashback secrets)" }]
}
Rules:
- 6 to 10 secrets, from small oddities in chapter 1 to the full truth at the end. Each secret is a step toward the final truth, without naming the mastermind before the "final" ones.
- 1 or 2 "final" secrets: the whole truth, told at the final trial. They may name the mastermind.
- Spread exploration secrets over the chapters; put a chapter's exploration secret in a room whose floor opens in that chapter when there is one.
- "flashback" secrets are lost memories the students get back. "monokuma" secrets are things Monokuma lets slip to stir up despair.
- Only use the students and rooms listed above.`;
}

export function buildWorldTruthPrompt({ cast = [], player = "", rooms = [], lorebook = "", finalChapter = DEFAULT_FINAL_CHAPTER, template = "" } = {}) {
    const format = buildWorldTruthFormat({ finalChapter });
    const body = String(template || DEFAULT_WORLD_TRUTH_TEMPLATE)
        .replace(/\{\{chapters\}\}/g, String(finalChapter))
        .replace(/\{\{player\}\}/g, player || "the protagonist")
        .replace(/\{\{cast\}\}/g, cast.map((c) => `- ${c.name}${c.ultimate ? ` (Ultimate ${c.ultimate})` : ""}`).join("\n") || "- (none)")
        .replace(/\{\{rooms\}\}/g, rooms.map((r) => `- ${r.id}: ${r.label}${r.unlockChapter ? ` (opens in chapter ${r.unlockChapter})` : ""}`).join("\n") || "- (none)")
        .replace(/\{\{lorebook\}\}/g, text(lorebook, 4000) || "(none)");
    // The JSON format is always sent, even when an edited prompt leaves it out.
    return body.includes("{{format}}") ? body.replace(/\{\{format\}\}/g, format) : `${body}\n\n${format}`;
}

// Validates a drafted truth against the cast and the map. Returns
// { worldTruth } or { error }.
export function parseWorldTruthResponse(raw, { cast = [], player = "", rooms = [], finalChapter = DEFAULT_FINAL_CHAPTER, rng = Math.random } = {}) {
    const data = typeof raw === "object" && raw !== null ? raw : extractJsonObject(raw);
    if (!data) return { error: "The reply wasn't a JSON object." };
    const names = cast.map((c) => c.name).filter((n) => n && !same(n, player));
    const mastermind = names.find((n) => same(n, data.mastermind))
        || names.find((n) => key(n).split(" ").includes(key(data.mastermind)) || key(data.mastermind).split(" ").includes(key(n).split(" ")[0]));
    if (!mastermind) return { error: `The mastermind "${text(data.mastermind, 60)}" isn't one of the students.` };
    const secrets = (Array.isArray(data.secrets) ? data.secrets : []).map((s, i) => {
        const source = SECRET_SOURCES.includes(s?.source) ? s.source : "exploration";
        const chapter = clampChapter(s?.chapter, finalChapter);
        let room = null;
        if (source === "exploration" || source === "flashback") {
            room = matchRoom(s?.room, rooms);
            if (!room && rooms.length) {
                // A room on a floor that opens that chapter, else any room.
                const opening = rooms.filter((r) => Number(r.unlockChapter) === chapter);
                const pool = opening.length ? opening : rooms.filter((r) => !r.unlockChapter || r.unlockChapter <= chapter);
                const from = pool.length ? pool : rooms;
                room = from[Math.floor(rng() * from.length) % from.length];
            }
        }
        return { id: `secret${i + 1}`, title: s?.title, text: s?.text, chapter, source, roomId: room?.id || "", roomLabel: room?.label || "" };
    });
    const worldTruth = normalizeWorldTruth({ mastermind, goal: data.goal, outsideWorld: data.outsideWorld, finalChapter, secrets });
    if (worldTruth.secrets.length < 3) return { error: "The truth has fewer than 3 secrets." };
    if (!worldTruth.secrets.some((s) => s.source === "final")) {
        // The last secret is the final truth when none was marked.
        worldTruth.secrets[worldTruth.secrets.length - 1] = { ...worldTruth.secrets[worldTruth.secrets.length - 1], source: "final", chapter: finalChapter, roomId: "", roomLabel: "" };
    }
    return { worldTruth };
}

// ── Reveals ──

export function isMastermind(worldTruth, name) {
    return Boolean(worldTruth?.mastermind) && same(worldTruth.mastermind, name);
}

// How a secret is found now: flashback secrets are explored for when
// Flashback Lights are off.
export function revealWay(secret, { flashbackLights = true } = {}) {
    return secret.source === "flashback" && !flashbackLights ? "exploration" : secret.source;
}

// Secrets that can come out by now (their chapter has come), not yet revealed.
export function availableSecrets(worldTruth, { chapter = 1, way = "", flashbackLights = true } = {}) {
    return (worldTruth?.secrets || []).filter((s) => !s.revealed && s.chapter <= Number(chapter)
        && (!way || revealWay(s, { flashbackLights }) === way));
}

export function revealSecret(worldTruth, id, { chapter = 0 } = {}) {
    if (!worldTruth) return worldTruth;
    return normalizeWorldTruth({
        ...worldTruth,
        secrets: worldTruth.secrets.map((s) => (s.id === id && !s.revealed ? { ...s, revealed: true, revealedChapter: Number(chapter) || s.chapter } : s)),
        flashbackPending: worldTruth.flashbackPending === id ? "" : worldTruth.flashbackPending,
    });
}

// Every final truth comes out (the final trial, or the mastermind stamped).
export function revealFinalSecrets(worldTruth, { chapter = 0 } = {}) {
    let wt = worldTruth;
    for (const s of worldTruth?.secrets || []) if (s.source === "final") wt = revealSecret(wt, s.id, { chapter });
    return wt;
}

// The exploration secret hidden in this room, once its chapter has come.
// One with no spot yet takes one of the room's spots (rng), so it's in the
// same place every time after. Returns { worldTruth, secret } (secret: the
// one found at `spotLabel`, or null).
export function findSecretAtSpot(worldTruth, { roomId = "", spotLabel = "", spots = [], chapter = 1, flashbackLights = true, rng = Math.random } = {}) {
    if (!worldTruth || !roomId) return { worldTruth, secret: null };
    let wt = worldTruth;
    let found = null;
    for (const s of availableSecrets(wt, { chapter, way: "exploration", flashbackLights })) {
        if (s.roomId !== roomId) continue;
        let spot = s.spotLabel;
        if (!spot && spots.length) {
            spot = spots[Math.floor(rng() * spots.length) % spots.length];
            wt = normalizeWorldTruth({ ...wt, secrets: wt.secrets.map((x) => (x.id === s.id ? { ...x, spotLabel: spot } : x)) });
        }
        if (!found && (!spot || key(spot) === key(spotLabel))) found = s;
    }
    return { worldTruth: wt, secret: found };
}

// At a chapter's start: the next secret Monokuma lets slip, and the
// Flashback Light handed out (when they're on and none is held yet).
export function chapterStartReveals(worldTruth, { chapter = 1, flashbackLights = true } = {}) {
    const monokuma = availableSecrets(worldTruth, { chapter, way: "monokuma" })[0] || null;
    const flashback = flashbackLights && !worldTruth?.flashbackPending
        ? availableSecrets(worldTruth, { chapter, way: "flashback", flashbackLights })[0] || null
        : null;
    return { monokuma, flashback };
}

// ── What the AI is told ──

// The secrets everyone has learned, for every reply.
export function buildKnownSecretsPrompt(worldTruth) {
    const known = (worldTruth?.secrets || []).filter((s) => s.revealed);
    if (!known.length) return "";
    return `[WHAT EVERYONE NOW KNOWS]\nTruths about this killing game the students have uncovered. Let them shape what people say and fear; build on them, never contradict them.\n${known.map((s) => `- ${s.title}: ${s.text}`).join("\n")}`;
}

// The mastermind's own subtle note, while they're the one replying and the
// truth is still hidden.
export function buildMastermindNote(worldTruth, speakerName) {
    if (!isMastermind(worldTruth, speakerName) || worldTruth.finalTrial === "done") return "";
    return `[SECRET FOR ${String(speakerName).toUpperCase()} ONLY]
You, ${speakerName}, are secretly the mastermind behind this killing game. Your goal: ${worldTruth.goal}
Never reveal it, never hint at it out loud. Act exactly like yourself; at most a rare, tiny slip that only makes sense later.`;
}

// For the final trial's minigames and vote: the whole truth.
export function buildWorldTruthBlock(worldTruth) {
    if (!worldTruth) return "";
    return [
        "THE TRUTH OF THE WORLD (hidden from the players: use it so the final trial is accurate, never reveal it outright before the end)",
        `The mastermind: ${worldTruth.mastermind}. The vote's answer is the mastermind.`,
        worldTruth.goal ? `Their goal: ${worldTruth.goal}` : "",
        worldTruth.outsideWorld ? `The outside world: ${worldTruth.outsideWorld}` : "",
        "Secrets:",
        ...worldTruth.secrets.map((s) => `- ${s.title}: ${s.text}${s.revealed ? " (already known)" : ""}`),
    ].filter(Boolean).join("\n");
}

// Plain-text dump for /world status. Full spoilers.
export function describeWorldTruth(worldTruth) {
    const wt = worldTruth;
    if (!wt) return "No truth of the world yet. /world draft writes one.";
    return [
        `THE TRUTH OF THE WORLD (SPOILERS) — final chapter ${wt.finalChapter}${wt.finalTrial ? ` · final trial ${wt.finalTrial}` : ""}${wt.verdict ? ` · vote ${wt.verdict}` : ""}${wt.ending ? ` · ending: ${wt.ending}` : ""}`,
        `Mastermind: ${wt.mastermind}`,
        `Goal: ${wt.goal}`,
        `Outside: ${wt.outsideWorld}`,
        `Flashback Light held: ${wt.flashbackPending || "none"}`,
        "Secrets:",
        ...wt.secrets.map((s) => `  - [${s.revealed ? `revealed ch${s.revealedChapter}` : "hidden"}] ch${s.chapter} ${s.source}${s.roomId ? ` @ ${s.roomLabel || s.roomId}${s.spotLabel ? ` (${s.spotLabel})` : ""}` : ""} · ${s.id}: ${s.title} — ${s.text}`),
    ].join("\n");
}
