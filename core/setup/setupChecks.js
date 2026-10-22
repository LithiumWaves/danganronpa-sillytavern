// Setup checklist. index.js gathers plain facts about the install (cards,
// sprites, lorebook, extensions, music, AI instructions, persona, save) and
// evaluateSetup turns them into rows for the title screen's SETUP panel.
//
// Status: "ok" — ready; "warn" — works, but something is missing or degraded;
// "missing" — a requirement the game can't run without; "skip" — doesn't
// apply to the current play style.

export const SETUP_STATUS = Object.freeze({ OK: "ok", WARN: "warn", MISSING: "missing", SKIP: "skip" });

export const PRESENCE_URL = "https://github.com/leandrojofre/SillyTavern-Presence";

function plural(n, one, many = `${one}s`) {
    return `${n} ${n === 1 ? one : many}`;
}

function listNames(names, max = 4) {
    const shown = names.slice(0, max).join(", ");
    return names.length > max ? `${shown} and ${names.length - max} more` : shown;
}

export function evaluateSetup(facts = {}) {
    const rows = [];
    const { OK, WARN, MISSING, SKIP } = SETUP_STATUS;

    const cards = Number(facts.cards || 0);
    rows.push({
        id: "cards",
        label: "Character cards",
        status: cards > 0 ? OK : MISSING,
        detail: cards > 0
            ? `${plural(cards, "card")} imported.`
            : "No character cards yet. Import the cards in /sample-character-cards, or your own.",
        fix: "characters",
        fixLabel: "OPEN CHARACTERS",
    });

    const withSprites = facts.sprites?.with || [];
    const withoutSprites = facts.sprites?.without || [];
    const spriteTotal = withSprites.length + withoutSprites.length;
    rows.push({
        id: "sprites",
        label: "Sprites",
        status: spriteTotal === 0 ? SKIP
            : withoutSprites.length === 0 ? OK
            : withSprites.length === 0 ? MISSING
            : WARN,
        detail: spriteTotal === 0 ? "Import character cards first."
            : withoutSprites.length === 0 ? `Everyone checked has sprites (${spriteTotal}).`
            : `No sprites for ${listNames(withoutSprites)}.`,
        fix: "sprites",
        fixLabel: "OPEN SPRITES",
    });

    const ultimatesKnown = Number(facts.ultimates?.known || 0);
    const ultimatesTotal = Number(facts.ultimates?.total || 0);
    rows.push({
        id: "lorebook",
        label: "Lorebook (Ultimates)",
        status: ultimatesTotal === 0 ? SKIP : ultimatesKnown === ultimatesTotal ? OK : WARN,
        detail: ultimatesTotal === 0 ? "Pick your classmates first."
            : ultimatesKnown === ultimatesTotal ? `Every classmate has an Ultimate (${ultimatesTotal}).`
            : `${ultimatesKnown} of ${ultimatesTotal} classmates have an Ultimate. Attach a lorebook that lists them (see /sample-lorebooks), or set them in the Social tab.`,
        fix: "worldInfo",
        fixLabel: "OPEN WORLD INFO",
    });

    rows.push({
        id: "presence",
        label: "Presence extension",
        status: !facts.singleChat ? SKIP : facts.presence ? OK : WARN,
        detail: !facts.singleChat ? "Only needed for One Main Chat."
            : facts.presence ? "Installed. Characters outside the room forget what they didn't hear."
            : `Not found. Without it, muted characters still read the whole chat. Install it from ${PRESENCE_URL}.`,
        fix: "extensions",
        fixLabel: "OPEN EXTENSIONS",
    });

    const bgmFiles = Number(facts.bgm?.files || 0);
    const emptyLists = facts.bgm?.emptyLists || [];
    rows.push({
        id: "bgm",
        label: "Music",
        status: bgmFiles === 0 || emptyLists.length ? WARN : OK,
        detail: bgmFiles === 0 ? "No BGM files found. Put audio files in SillyTavern's data/default-user/assets/bgm folder."
            : emptyLists.length ? `No tracks picked for ${listNames(emptyLists)}.`
            : "Tracks picked for every phase.",
        fix: "bgm",
        fixLabel: "OPEN BGM",
    });

    rows.push({
        id: "ai",
        label: "AI instructions",
        status: facts.markerPrompts || facts.presetHasMarkers ? OK : WARN,
        detail: facts.markerPrompts ? "The extension tells the AI how to write Truth Bullets, trust and announcements."
            : facts.presetHasMarkers ? "Your preset has the V3C marker rules."
            : "The AI isn't told how to write Truth Bullets, trust or announcements. Turn on AI INSTRUCTIONS.",
        fix: "aiInstructions",
        fixLabel: "OPEN GAMEPLAY",
    });

    rows.push({
        id: "persona",
        label: "Persona",
        status: facts.persona ? OK : WARN,
        detail: facts.persona ? `Playing as ${facts.persona}.` : "No persona picked. Your character will be called \"User\".",
        fix: "persona",
        fixLabel: "OPEN PERSONAS",
    });

    const save = facts.save || {};
    rows.push({
        id: "save",
        label: "Save",
        status: !save.exists ? MISSING : save.mode === "single" && !save.groupOk ? WARN : OK,
        detail: !save.exists ? "No save yet. Start a NEW GAME."
            : save.mode === "single" && !save.groupOk ? `"${save.name}" is One Main Chat, but its story chat is gone. Load another save or start a NEW GAME.`
            : `"${save.name}", ${save.mode === "single" ? "One Main Chat" : "Several Chats"}.`,
        fix: save.exists ? "saves" : "newGame",
        fixLabel: save.exists ? "OPEN SAVES" : "NEW GAME",
    });

    return rows;
}

export function countSetupProblems(rows) {
    return (Array.isArray(rows) ? rows : []).filter((r) => r.status === SETUP_STATUS.MISSING).length;
}
