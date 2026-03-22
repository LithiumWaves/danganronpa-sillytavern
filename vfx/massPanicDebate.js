// vfx/massPanicDebate.js — Mass Panic Debate scenario data and parser

/**
 * Parse raw scenario objects, detecting which column holds the weak spot
 * from [[...]] markup. If no column has one, assign one at random.
 */
export function parseScenarios(rawScenarios) {
    return rawScenarios.map(s => {
        let weakSpotColumn = -1;
        const texts = (s.texts || []).map((t, col) => {
            const hasWeak = /\[\[.*?\]\]/.test(String(t.text || ''));
            if (hasWeak && weakSpotColumn === -1) weakSpotColumn = col;
            return { text: String(t.text || ''), speaker: String(t.speaker || ''), whiteNoise: t.whiteNoise || null, isWeakPoint: hasWeak };
        });
        if (weakSpotColumn === -1 && texts.length) {
            weakSpotColumn = Math.floor(Math.random() * texts.length);
            texts[weakSpotColumn] = { ...texts[weakSpotColumn], isWeakPoint: true };
        }
        return { texts, weakSpotColumn };
    });
}

// ── Test scenario pool ────────────────────────────────────────────────────────

export const MPD_TEST_SCENARIOS = [
    {
        texts: [
            { text: "There's no way anyone could have entered without a key!", speaker: "" },
            { text: "[[The security footage was tampered with before we arrived.]]", speaker: "", whiteNoise: "SIGNAL LOST" },
            { text: "I was with someone the entire time — ask them!", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "That testimony completely contradicts what we heard earlier!", speaker: "" },
            { text: "None of you were even near the scene when it happened...", speaker: "" },
            { text: "[[The weapon was never found, which changes everything!]]", speaker: "", whiteNoise: "DATA CORRUPTED" },
        ],
    },
    {
        texts: [
            { text: "[[The time of death puts your whole argument in question.]]", speaker: "", whiteNoise: "ERROR — WHITE NOISE" },
            { text: "I never touched the door handle — check for fingerprints!", speaker: "" },
            { text: "There were two sets of footprints leading away from the scene.", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "Why would anyone risk exposure like that so carelessly?", speaker: "" },
            { text: "[[Someone must have planned this murder well in advance!]]", speaker: "", whiteNoise: "╳ ╳ ╳  interference  ╳ ╳ ╳" },
            { text: "The motive doesn't make sense for any of us here!", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "I heard a loud noise coming from the hallway around that time!", speaker: "" },
            { text: "The body wasn't discovered until after the morning announcement.", speaker: "" },
            { text: "[[It's impossible for one person to have done all of this alone.]]", speaker: "", whiteNoise: "Static interference..." },
        ],
    },
    {
        texts: [
            { text: "[[Someone in this room is lying to protect themselves right now!]]", speaker: "", whiteNoise: "SIGNAL LOST — SIGNAL LOST" },
            { text: "None of the windows were broken — so how did they escape?", speaker: "" },
            { text: "The real killer is trying to frame an innocent person here!", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "That's a complete lie and everyone in this room knows it!", speaker: "" },
            { text: "There's a witness — someone saw the whole thing and stayed quiet.", speaker: "" },
            { text: "[[The evidence you're pointing to doesn't prove anything at all!]]", speaker: "", whiteNoise: "White Noise — do not trust this" },
        ],
    },
    {
        texts: [
            { text: "[[That argument only holds if you ignore everything before noon!]]", speaker: "", whiteNoise: "ERROR — DATA CORRUPTED" },
            { text: "The victim had no enemies — or so everyone was told.", speaker: "" },
            { text: "I saw someone near the storage room just before the body was found.", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "There's no logical reason for anyone here to do this!", speaker: "" },
            { text: "[[The locked room proves the killer must still be inside!]]", speaker: "", whiteNoise: "WARNING — WARNING" },
            { text: "Everything that happened that morning was planned to the minute.", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "Someone had access to the restricted area that night.", speaker: "" },
            { text: "The alibi falls apart the moment you check the timestamps.", speaker: "" },
            { text: "[[Only one person here could have known about the passageway.]]", speaker: "", whiteNoise: "╳ ╳ ╳  NOISE  ╳ ╳ ╳" },
        ],
    },
    {
        texts: [
            { text: "[[That contradiction is the key to everything — don't let it go!]]", speaker: "", whiteNoise: "SIGNAL LOST" },
            { text: "I refuse to believe anyone here is capable of something like this.", speaker: "" },
            { text: "All the evidence was moved before we had the chance to examine it.", speaker: "" },
        ],
    },
    {
        texts: [
            { text: "The noise I heard was too precise to have been an accident.", speaker: "" },
            { text: "[[Someone staged this entire scene to look like a different crime.]]", speaker: "", whiteNoise: "Static interference detected..." },
            { text: "There's only one explanation that fits all the evidence we have!", speaker: "" },
        ],
    },
];
