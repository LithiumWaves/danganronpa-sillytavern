const SD_ID    = "dangan-sd-overlay";
const SD_STYLE = "dangan-sd-style";

// Scroll speed (pixels per second at 1× speed)
const SCROLL_BASE_PPS = 140;
const SPEED_SLOW = 0.38;   // Shift held — concentration / slow motion
const SPEED_FAST = 2.3;    // Ctrl held  — turbo advance

// Concentration gauge (slow-mo resource)
const CONC_DRAIN_PPS    = 22;   // % depleted per second while slow-mo active (~4.5 s to empty)
const CONC_REFILL_PPS   = 13;   // % refilled per second when not active (~7.7 s to full)
const CONC_RECOVER_THRESHOLD = 20; // % needed to re-enable after hitting empty

// Tug-of-war
const TUG_CHANGE_MS  = 3000;  // ms between direction flips
const TUG_STEP       = 6;     // % progress per correct keypress
const TUG_PENALTY    = 2;     // % regression per wrong keypress
const TUG_DECAY_PPS  = 16;    // % drift toward 50 per second
const TUG_DIRS       = ["up", "down", "left", "right"];
const TUG_DIR_GLYPH  = { up: "↑", down: "↓", left: "←", right: "→" };
const TUG_DIR_KEY    = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

export const SCRUM_DEBATE_DEFAULT_SCENARIO = {
    title: "SCRUM DEBATE",
    topic: "Was Byakuya killed by Nagito, or by Teruteru?",
    opposingTheory: "The culprit is Nagito!",
    playerTheory: "The culprit is Teruteru!",
    rounds: [
        {
            opposingClaim: "Knife",
            statement: "Byakuya was stabbed, [[the wound was from a piece of equipment - A knife]]!",
            correctTruthBulletTitle: "Kitchen Equipment",
        },
        {
            opposingClaim: "Bloodstain Under the Table",
            statement: "But Byakuya was killed under the table, [[there were no other gaps to launch an attack]]...",
            correctTruthBulletTitle: "Gaps in Floorboard",
        },
        {
            opposingClaim: "Teruteru's Account",
            statement: "It's impossible for Teruteru to be the culprit, he [[responded clearly to Ibuki and all the doors were open]]..!",
            correctTruthBulletTitle: "Fire Door",
        },
    ],
};

// ── Utilities ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Character helpers ──────────────────────────────────────────────────────

const SD_EXCLUDED_NAMES = new Set(["narrator", "assistant", "monokuma"]);

function buildTeams(isCharacterDead) {
    const ctx  = window.SillyTavern?.getContext?.();
    const allChars = Array.isArray(ctx?.characters) ? ctx.characters : [];
    const rawChars = allChars.filter(c => !SD_EXCLUDED_NAMES.has(String(c?.name || "").trim().toLowerCase()));
    if (!rawChars.length) return { opposing: [], player: [] };

    // Tag each character with dead status (shallow copy — don't mutate original objects)
    const chars = rawChars.map(c => ({
        ...c,
        _sdDead: typeof isCharacterDead === "function" && isCharacterDead(String(c?.name || "")),
    }));

    const alive = chars.filter(c => !c._sdDead);
    const dead  = chars.filter(c =>  c._sdDead);

    const sortedAlive = [...alive].sort(
        (a, b) => (Number(a?.trustLevel) || 5) - (Number(b?.trustLevel) || 5)
    );
    const half = Math.ceil(sortedAlive.length / 2);

    // Dead characters are split evenly and appended after alive characters on each team
    const sortedDead = [...dead].sort(
        (a, b) => (Number(a?.trustLevel) || 5) - (Number(b?.trustLevel) || 5)
    );
    const deadHalf = Math.ceil(sortedDead.length / 2);

    return {
        opposing: [...sortedAlive.slice(0, half),           ...sortedDead.slice(0, deadHalf)],
        player:   [...sortedAlive.slice(half).reverse(),    ...sortedDead.slice(deadHalf).reverse()],
    };
}

function charAvatarUrl(char) {
    if (!char?.avatar) return "";
    return `/thumbnail?type=avatar&file=${encodeURIComponent(char.avatar)}`;
}

// ── Style builder ──────────────────────────────────────────────────────────

function buildStyles(extPath) {
    const monoUrl    = extPath ? `/${extPath}/assets/monokuma/monokuma_idle.png`      : "";
    const lecternUrl = extPath ? `/${extPath}/assets/classtrial/lectern.webp`         : "";
    const scrumBgUrl = extPath ? `/${extPath}/assets/images/minigames/scrum.png`      : "";
    return `
/* ── Overlay root ── */
#${SD_ID} {
    position: fixed; inset: 0; z-index: 2147483645;
    background: #2a2a2a;
    color: #f0f4ff; font-family: "Orbitron", "Arial", sans-serif;
    opacity: 0; transition: opacity 300ms ease;
    pointer-events: none; user-select: none; overflow: hidden;
}
#${SD_ID}.sd-on { opacity: 1; pointer-events: auto; }
#${SD_ID}.sd-on::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(100, 0, 180, 0.28);
    pointer-events: none;
    z-index: 50;
}
#${SD_ID} * { box-sizing: border-box; }

/* Background zoom layer */
.sd-bg {
    position: absolute; inset: -12%; z-index: 0;
    transform-origin: center center;
    transition: transform 700ms ease;
    pointer-events: none;
}

/* Layout */
.sd-root {
    position: absolute; inset: 0; z-index: 1;
    display: flex; flex-direction: column;
}

/* ── Hearts — absolute overlay, top-right, floats over the court ── */
.sd-hearts {
    position: absolute; top: 12px; right: 16px; z-index: 20;
    display: flex; gap: 5px; font-size: clamp(13px, 1.9vh, 19px);
    pointer-events: none;
}
.sd-heart { color: #ff6a7a; text-shadow: 0 0 8px rgba(255,80,110,0.8); transition: opacity 160ms; }
.sd-heart.sd-lost { opacity: 0.16; }

/* ── Left HUD: speaker name + round dots stacked top-left of court ── */
.sd-left-hud {
    position: absolute; top: 0; left: 0; z-index: 15;
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 8px; pointer-events: none;
}

/* Speaker — large NSD-style name display */
.sd-speaker {
    font-family: "Orbitron", monospace;
    font-size: clamp(17px, 3.4vh, 35px); font-weight: 900;
    letter-spacing: 0.1em; color: #4af5f0;
    text-shadow: 0 0 18px rgba(74,245,240,0.5), 0 0 3px rgba(74,245,240,0.88);
    padding: 5px 22px 5px 12px;
    min-width: 80px;
    transition: opacity 220ms ease;
}
.sd-speaker:empty { opacity: 0; }

/* ── Class trial courtroom — grows to fill all space above the arena ── */
.sd-court {
    flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;
    display: flex; align-items: stretch;
}

/* Courtroom wall — scrum background image with red→blue side gradient */
.sd-court-bg {
    position: absolute; inset: 0; z-index: 0;
    background:
        linear-gradient(90deg,
            rgba(190,20,20,0.48)  0%,
            rgba(190,20,20,0.18) 30%,
            transparent          45%,
            transparent          55%,
            rgba(20,55,200,0.18) 70%,
            rgba(20,55,200,0.48) 100%
        ),
        url(${scrumBgUrl}) center / cover no-repeat;
}
.sd-court-bg::before { content: none; }
.sd-court-bg::after  { content: none; }

/* Teams row — fills full court width and height */
.sd-court-teams {
    position: relative; z-index: 2; display: flex;
    width: 100%; height: 100%; align-items: flex-end;
}

/* Each team is a positioning context for absolutely-placed portraits */
.sd-team-opp    { flex: 1; position: relative; height: 100%; overflow: hidden; }
.sd-team-player { flex: 1; position: relative; height: 100%; overflow: hidden; }

/* Monokuma — center back of aisle, small (perspective depth) */
.sd-court-center {
    flex: 0 0 auto; display: flex; flex-direction: column;
    align-items: center; justify-content: flex-end;
    width: clamp(42px, 8vw, 82px); padding-bottom: 2px; z-index: 3;
}
.sd-monokuma-img {
    height: clamp(51px, 10.1vh, 97px); width: auto; object-fit: contain;
    filter: drop-shadow(0 0 4px rgba(255,255,255,0.07)); opacity: 0.85;
    transform: translateY(-425%);
}
.sd-monokuma-placeholder {
    width: 40px; height: 50px; display: flex; align-items: center;
    justify-content: center; font-size: 24px; opacity: 0.5;
}

/* ── Portrait — absolutely positioned, bottom-anchored, depth-scaled by height only ── */
/* --ph (height), --pz (z-index), --pb (bottom offset) are set via inline style */
.sd-portrait {
    position: absolute; bottom: var(--pb, 0px);
    height: var(--ph, 40vh); width: auto;
    z-index: var(--pz, 3);
    transition: height 420ms ease, left 420ms ease, right 420ms ease, bottom 420ms ease;
}

/* Dead characters — greyscale, dimmed, always at the back */
.sd-portrait.sd-portrait-dead {}

/* Passed (de-loaded) characters — fade and sink away, then collapse */
.sd-portrait.sd-portrait-passed {
    opacity: 0;
    transform: scale(0.82) translateY(8px);
    pointer-events: none;
    transition: opacity 400ms ease, transform 400ms ease;
}

/* Image container — sized by the sprite itself, no crop */
.sd-portrait-img-wrap {
    height: 100%; width: auto; display: block;
}

/* Sprite fills portrait height; natural width — never cropped */
.sd-portrait-avatar {
    display: block; height: 100%; width: auto;
}
/* Mirror avatars that have no side-specific sprite (generic scrum/relief facing left) */
.sd-portrait-avatar.sd-mirrored { transform: scaleX(-1); }


/* ── Cylinder wrap containers — RS-style, one per side ── */

/* ── Cylinder wrap containers — RS-style, one per side ── */
.sd-cyl-wrap {
    position: absolute; bottom: -40px; z-index: 10;
    pointer-events: none;
    width: clamp(188px, 25vw, 375px); height: clamp(188px, 25vw, 375px);
}
.sd-cyl-wrap-player { right: 30px; }
.sd-cyl-wrap-opp    { left: 30px;  }

/* Revolver cylinder image fills its wrap */
.sd-cylinder {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain; transform-origin: center; opacity: 0.88;
    pointer-events: none; z-index: 0;
}

/* Opposing side (left) — red */
.sd-cylinder-opp {
    filter:
        sepia(1) hue-rotate(330deg) saturate(8) brightness(1.2)
        drop-shadow(0 0 18px rgba(255, 0, 0, 0.78))
        drop-shadow(0 0 45px rgba(255, 0, 0, 0.45));
}
/* Player side (right) — blue */
.sd-cylinder-player {
    filter:
        sepia(1) hue-rotate(195deg) saturate(6) brightness(1.2)
        drop-shadow(0 0 18px rgba(0, 150, 255, 0.78))
        drop-shadow(0 0 45px rgba(0, 100, 255, 0.45));
}

/* Counter — RS-style large cyan index, centered on player cylinder */
.sd-cyl-index {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-family: "Orbitron", sans-serif;
    font-size: clamp(20px, 3.6vh, 36px); font-weight: 900;
    color: #00ffff;
    text-shadow:
        0 0 12px rgba(0,255,255,0.9),
        0 0 30px rgba(0,200,255,0.6),
        2px 2px 4px rgba(0,0,0,0.9);
    letter-spacing: 0.05em; pointer-events: none; line-height: 1; z-index: 2;
}

/* Bullet cartridge — absolutely positioned over the cylinder wrap */
.sd-bullet-name-box {
    position: absolute; top: calc(50% - 2px); z-index: 1;
    display: flex; align-items: center; justify-content: center;
    width: clamp(280px, 36vw, 460px); height: clamp(64px, 10.5vh, 100px);
    padding: 0 88px 0 76px;
    background-size: 100% 100%; background-repeat: no-repeat;
    border: none; border-radius: 0;
}
/* Player cartridge — supporting-bullet image, extends leftward */
.sd-cyl-wrap-player .sd-bullet-name-box {
    transform: translateY(-50%); right: 40%;
    background-image: url(/${extPath}/assets/images/minigames/supporting-bullet.png);
}
/* Opponent cartridge — opposing-bullet image, extends rightward */
.sd-cyl-wrap-opp .sd-bullet-name-box {
    transform: translateY(-50%); left: 40%;
    background-image: url(/${extPath}/assets/images/minigames/opposing-bullet.png);
}
.sd-bullet-name-box::before { content: none; }
/* Truth bullet name — RS Palatino serif style */
.sd-bullet-name-box .sd-bullet-title {
    color: #fff8f4;
    font-family: 'Palatino Linotype', 'Book Antiqua', 'Palatino', Georgia, serif;
    font-size: clamp(14px, 2.2vh, 22px); font-weight: 400;
    white-space: nowrap;
    text-shadow:
        0 0 18px rgba(0,255,255,0.7),
        2px 2px 6px rgba(0,0,0,0.95),
        -1px -1px 0 rgba(0,0,0,0.7);
    letter-spacing: 0.02em;
}
.sd-cyl-wrap-opp .sd-bullet-name-box .sd-bullet-title {
    text-shadow:
        0 0 18px rgba(255,80,80,0.7),
        2px 2px 6px rgba(0,0,0,0.95),
        -1px -1px 0 rgba(0,0,0,0.7);
}
.sd-bullet-name-box .sd-bullet-desc { display: none; }
.sd-bullet-nav  { font-size: clamp(6px, 0.88vh, 9px); opacity: 0.35; letter-spacing: 0.06em; }

/* Slide-in animations when cycling truth bullets — title (no base transform) */
@keyframes sdBulletFromBottom {
    from { transform: translateY(18px);  opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
}
@keyframes sdBulletFromTop {
    from { transform: translateY(-18px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
}
.sd-bullet-title.sd-slide-right { animation: sdBulletFromBottom 185ms cubic-bezier(0.22,0.61,0.36,1) both; }
.sd-bullet-title.sd-slide-left  { animation: sdBulletFromTop    185ms cubic-bezier(0.22,0.61,0.36,1) both; }

/* Slide-in for name-box itself (base transform is translateY(-50%)) */
@keyframes sdBoxFromBottom {
    from { transform: translateY(calc(-50% + 18px)); opacity: 0; }
    to   { transform: translateY(-50%);               opacity: 1; }
}
@keyframes sdBoxFromTop {
    from { transform: translateY(calc(-50% - 18px)); opacity: 0; }
    to   { transform: translateY(-50%);               opacity: 1; }
}
.sd-bullet-name-box.sd-slide-right { animation: sdBoxFromBottom 185ms cubic-bezier(0.22,0.61,0.36,1) both; }
.sd-bullet-name-box.sd-slide-left  { animation: sdBoxFromTop    185ms cubic-bezier(0.22,0.61,0.36,1) both; }

/* ── Scrolling statement text — floats over the court ── */
.sd-statement {
    position: absolute; bottom: 40%; left: 0;
    z-index: 12; pointer-events: none;
    white-space: nowrap; will-change: transform;
    font-family: "Noto Sans JP", sans-serif;
    font-size: clamp(17px, 3vh, 38px); font-weight: 900; letter-spacing: 0.03em; line-height: 1;
    color: #fff;
    text-shadow: 2px 2px 4px #000, 0 0 14px rgba(255,60,60,0.55);
    padding: 0 24px;
}
/* Weak spot — orange gradient text, matches NSD/MPD style */
.sd-weak {
    padding: 1px 4px; border-radius: 2px;
    color: #ffe44d;
    text-shadow:
        0 0 4px  #fff,
        0 0 10px #ffe44d,
        0 0 22px #ffaa00,
        0 0 44px #ff7700,
        0 0 70px rgba(255,100,0,0.6);
    cursor: crosshair; pointer-events: auto;
}
.sd-weak.sd-revealed {
    color: #62ffcc;
    text-shadow:
        0 0 4px  #fff,
        0 0 12px #62ffcc,
        0 0 28px rgba(75,255,195,0.8);
    text-decoration: line-through; cursor: default; pointer-events: none;
}

/* ── White noise — floating MPD-style exclamations near the statement ── */
.sd-white-noise {
    position: fixed; z-index: 2147483644;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: clamp(14px, 2.4vh, 28px); font-weight: 900;
    background: linear-gradient(to bottom, #FFE8E8, #F808C0);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    filter: drop-shadow(0 0 8px rgba(248,8,192,0.9)) drop-shadow(0 0 18px rgba(200,10,150,0.5));
    white-space: nowrap; user-select: none; pointer-events: none;
    will-change: transform, opacity;
}

/* ── Round indicator dots — single row, inside left HUD ── */
.sd-round-dots {
    padding-left: 14px;
    display: flex; flex-direction: row;
    gap: 8px; align-items: center; pointer-events: none;
}
.sd-round-dot {
    width: clamp(9px, 1.5vh, 14px); height: clamp(9px, 1.5vh, 14px); border-radius: 50%;
    background: rgba(255,255,255,0.14); border: 1.5px solid rgba(255,255,255,0.28);
    transition: background 200ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.sd-round-dot.sd-dot-active {
    background: #ffd54f; border-color: rgba(255,215,80,0.9);
    transform: scale(1.25); box-shadow: 0 0 8px rgba(255,215,80,0.85);
}
.sd-round-dot.sd-dot-debunked {
    background: rgba(72,255,175,0.65); border-color: rgba(72,255,175,0.85);
}

/* Flash overlay */
.sd-flash {
    position: absolute; inset: 0; pointer-events: none; z-index: 30;
    background: transparent; transition: background 65ms;
}
.sd-flash.sd-flash-red   { background: rgba(220,18,18,0.35); }
.sd-flash.sd-flash-green { background: rgba(18,220,100,0.28); }
.sd-flash.sd-flash-blue  { background: rgba(18,80,220,0.28); }

/* ── Concentration gauge (slow-mo resource) — inside left HUD ── */
.sd-conc-row {
    display: flex; flex-direction: column;
    gap: 3px; padding: 2px 14px 4px;
    pointer-events: none;
}
.sd-conc-label {
    font-size: clamp(6px, 0.85vh, 9px); font-weight: 700;
    letter-spacing: 0.15em; color: rgba(255,120,170,0.82);
    white-space: nowrap;
}
.sd-conc-track {
    height: clamp(4px, 0.7vh, 7px); width: clamp(140px, 20vw, 240px);
    background: rgba(0,0,0,0.55); border: 1px solid rgba(255,80,140,0.22);
    border-radius: 2px; overflow: hidden;
}
.sd-conc-fill {
    height: 100%; width: 100%; transform-origin: left center;
    background: linear-gradient(90deg, rgba(220,50,120,0.95), rgba(255,110,160,0.85));
    transition: transform 80ms linear;
}
.sd-conc-fill.sd-conc-empty {
    background: linear-gradient(90deg, rgba(190,30,30,0.9), rgba(255,80,80,0.75));
    animation: sdConcPulse 0.45s ease-in-out infinite alternate;
}
@keyframes sdConcPulse { from { opacity: 0.45; } to { opacity: 1; } }

/* ── Tug-of-war overlay — now transparent; rockets handle the visual ── */
.sd-tug {
    position: absolute; inset: 0; z-index: 20;
    opacity: 0; transition: opacity 420ms; pointer-events: none;
}
.sd-tug.sd-tug-on { opacity: 1; pointer-events: auto; }

/* ── Final Push: rocket progress indicators ── */
/* Same zero-height anchor as the intro rockets */
.sd-tug-rocket-wrap {
    position: fixed; left: 0; right: 0; z-index: 2147483646;
    height: 0; overflow: visible;
    bottom: calc(clamp(188px, 25vw, 375px) / 2 - 40px);
    pointer-events: none; user-select: none;
    opacity: 0; transition: opacity 280ms ease;
}
.sd-tug-rocket-wrap.sd-tug-rockets-on { opacity: 1; }
/* Each rocket: absolutely placed by JS (left = battle point); translateY centers on line */
.sd-tug-rocket-inner {
    position: absolute; top: 0;
    display: inline-block;
}
.sd-tug-rocket-opp  { transform: translateY(-50%) translateX(-100%); }
.sd-tug-rocket-supp { transform: translateY(-50%); }
.sd-tug-rocket-inner img {
    display: block; height: clamp(70px, 11vh, 110px); width: auto;
}
.sd-tug-rocket-opp img {
    filter: drop-shadow(0 0 20px rgba(255,60,60,0.85)) drop-shadow(0 0 48px rgba(200,0,0,0.5));
}
.sd-tug-rocket-supp img {
    filter: drop-shadow(0 0 20px rgba(60,140,255,0.85)) drop-shadow(0 0 48px rgba(0,80,220,0.5));
}
/* ── Final Push: rocket jet flare ── */
.sd-rocket-flare {
    position: absolute;
    /* Explicit vh-based top: avoids percentage resolution against an auto-height
       containing block.  Rocket: clamp(70px,11vh,110px) → centre at clamp(35px,5.5vh,55px)
       Flare half-height: clamp(11px,1.6vh,20px) → top = clamp(24px,3.9vh,35px) */
    top: clamp(24px, 3.9vh, 35px);
    width: clamp(52px, 8.5vw, 100px);
    height: clamp(22px, 3.2vh, 40px);
    pointer-events: none;
    animation: sdFlareFlicker 65ms linear infinite alternate;
}
/* Opposing rocket: nose RIGHT, engine LEFT — flare extends leftward from the engine.
   8px overlap into the rocket body closes any gap at the nozzle seam. */
.sd-tug-rocket-opp .sd-rocket-flare {
    right: calc(100% - 88px);
    transform-origin: right center;
    background: radial-gradient(
        ellipse at 98% 50%,
        rgba(255,255,255,0.95) 0%,
        rgba(255,160,80,0.9)   12%,
        rgba(255,40,10,0.75)   32%,
        rgba(200,0,0,0.45)     57%,
        transparent            80%
    );
}
/* Supporting rocket: nose LEFT, engine RIGHT — flare extends rightward from the engine.
   8px overlap into the rocket body closes any gap at the nozzle seam. */
.sd-tug-rocket-supp .sd-rocket-flare {
    left: calc(100% - 88px);
    transform-origin: left center;
    background: radial-gradient(
        ellipse at 2% 50%,
        rgba(255,255,255,0.95) 0%,
        rgba(160,210,255,0.9)  12%,
        rgba(40,130,255,0.75)  32%,
        rgba(0,70,220,0.45)    57%,
        transparent            80%
    );
}
@keyframes sdFlareFlicker {
    from { transform: scaleX(0.87) scaleY(0.88); opacity: 0.82; filter: brightness(0.88); }
    to   { transform: scaleX(1.14) scaleY(1.10); opacity: 1.00; filter: brightness(1.35); }
}
.sd-tug-rocket-inner .sd-rocket-label {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
    font-size: clamp(12px, 1.8vh, 17px); font-weight: 700;
    white-space: nowrap; text-align: center;
    pointer-events: none;
}
.sd-tug-rocket-opp .sd-rocket-label {
    color: #fff8f4;
    text-shadow: 0 0 12px rgba(255,80,80,0.9), 1px 1px 0 #000, -1px -1px 0 #000,
                 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 5px rgba(0,0,0,0.95);
}
.sd-tug-rocket-supp .sd-rocket-label {
    color: #e8f4ff;
    text-shadow: 0 0 12px rgba(80,160,255,0.9), 1px 1px 0 #000, -1px -1px 0 #000,
                 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 5px rgba(0,0,0,0.95);
}
/* ── Final Push: hide cylinders / hearts / HUD / statement while rockets fight ── */
#${SD_ID}.sd-tug-active .sd-cyl-wrap,
#${SD_ID}.sd-tug-active .sd-hearts,
#${SD_ID}.sd-tug-active .sd-left-hud,
#${SD_ID}.sd-tug-active .sd-statement { opacity: 0; pointer-events: none; }

/* ── Final Push: centered direction indicator ── */
.sd-tug-indicator {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2147483647;
    pointer-events: none; user-select: none;
}
.sd-tug-bounce-host {
    display: flex; flex-direction: column; align-items: center; gap: 5px;
}
.sd-tug-circle {
    width: clamp(90px, 14vh, 160px); height: clamp(90px, 14vh, 160px);
    border-radius: 50%; border: 3px solid rgba(255,255,255,0.55);
    background: rgba(0,0,0,0.72);
    box-shadow: 0 0 36px rgba(0,0,0,0.55), inset 0 0 20px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    transition: border-color 180ms, box-shadow 180ms;
}
.sd-tug-indicator.sd-dir-left  .sd-tug-circle { border-color: rgba(255,107,107,0.75); box-shadow: 0 0 30px rgba(255,75,75,0.35), inset 0 0 20px rgba(0,0,0,0.3); }
.sd-tug-indicator.sd-dir-right .sd-tug-circle { border-color: rgba(107,212,255,0.75); box-shadow: 0 0 30px rgba(75,200,255,0.35), inset 0 0 20px rgba(0,0,0,0.3); }
.sd-tug-indicator.sd-dir-up    .sd-tug-circle { border-color: rgba(102,255,136,0.75); box-shadow: 0 0 30px rgba(50,255,80,0.35), inset 0 0 20px rgba(0,0,0,0.3); }
.sd-tug-indicator.sd-dir-down  .sd-tug-circle { border-color: rgba(255,170,68,0.75);  box-shadow: 0 0 30px rgba(255,140,40,0.35), inset 0 0 20px rgba(0,0,0,0.3); }
.sd-tug-arrow-center {
    font-size: clamp(44px, 7vh, 82px); line-height: 1;
    transition: color 180ms, text-shadow 180ms;
}
.sd-tug-arrow-center.sd-dir-left  { color: #ff6b6b; text-shadow: 0 0 18px rgba(255,75,75,0.9);   }
.sd-tug-arrow-center.sd-dir-right { color: #6bd4ff; text-shadow: 0 0 18px rgba(75,200,255,0.9);  }
.sd-tug-arrow-center.sd-dir-up    { color: #66ff88; text-shadow: 0 0 18px rgba(50,255,80,0.9);   }
.sd-tug-arrow-center.sd-dir-down  { color: #ffaa44; text-shadow: 0 0 18px rgba(255,140,40,0.9);  }
/* Bounce: applied to the host div so the whole thing (arrow + result) jumps together */
@keyframes sdTugBounce {
    0%   { transform: translateY(0); }
    28%  { transform: translateY(-12px); }
    58%  { transform: translateY(-3px); }
    78%  { transform: translateY(-8px); }
    100% { transform: translateY(0); }
}
.sd-tug-bounce-host.sd-tug-bounce { animation: sdTugBounce 310ms cubic-bezier(0.33,1,0.68,1) 1; }
/* Push / miss result image spawned below the circle */
.sd-tug-result {
    height: clamp(22px, 3.5vh, 38px); width: auto;
    opacity: 0;
    animation: sdTugResult 680ms ease-out forwards;
}
@keyframes sdTugResult {
    0%   { opacity: 0; transform: translateY(0); }
    18%  { opacity: 1; transform: translateY(-7px); }
    55%  { opacity: 0.85; transform: translateY(-2px); }
    100% { opacity: 0; transform: translateY(7px); }
}

/* Speed indicator elements are kept in the DOM (hidden) so JS refs stay valid */
.sd-status, .sd-speed-info { display: none; }

/* ── Animations ── */
@keyframes sdShake {
    0%   { transform: translate(0,0); }
    20%  { transform: translate(-9px, 2px); }
    40%  { transform: translate(8px, -2px); }
    60%  { transform: translate(-5px, 1px); }
    80%  { transform: translate(4px, -1px); }
    100% { transform: translate(0,0); }
}
.sd-shake { animation: sdShake 240ms linear 1; }

@keyframes sdBulletPop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.045); }
    100% { transform: scale(1); }
}
.sd-pop { animation: sdBulletPop 165ms ease; }

/* ── Slow-mo: green screen overlay ── */
#sd-bt-vfx {
    position: absolute; inset: 0; pointer-events: none; z-index: 25;
    background: radial-gradient(ellipse at center, rgba(0,160,30,0.12) 0%, rgba(0,90,15,0.28) 100%);
    mix-blend-mode: screen;
    opacity: 0; transition: opacity 180ms ease;
}
#sd-bt-vfx.sd-slowmo-on { opacity: 1; }

/* ── Slow-mo: scrolling ALERT/CONCENTRATING rows ── */
#sd-bt-alert {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 24;
    display: flex; flex-direction: column; justify-content: space-around;
    opacity: 0; transition: opacity 80ms ease;
}
#sd-bt-alert.sd-slowmo-on { opacity: 0.2; }
.sd-alert-row { display: flex; align-items: center; gap: 8px; white-space: nowrap; flex-shrink: 0; }
.sd-alert-row-l { animation: sdAlertL 5s linear infinite; }
.sd-alert-row-r { animation: sdAlertR 5s linear infinite; }
@keyframes sdAlertL { from { transform: translateX(0); }    to { transform: translateX(-50%); } }
@keyframes sdAlertR { from { transform: translateX(-50%); } to { transform: translateX(0); } }
.sd-alert-box {
    display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 3px 10px; border: 1px solid rgba(120,255,68,0.28); border-radius: 2px; flex-shrink: 0; gap: 2px;
    box-shadow: 0 0 10px rgba(120,255,68,0.28), inset 0 0 8px rgba(120,255,68,0.06);
}
.sd-alert-word {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px; font-weight: 900; color: #78ff44;
    letter-spacing: 8px; text-indent: 8px;
    text-shadow: 0 0 12px rgba(120,255,68,0.9); line-height: 1;
}
.sd-alert-conc {
    font-family: "Orbitron", monospace;
    font-size: 6px; font-weight: 700; color: #78ff44;
    letter-spacing: 2.5px; opacity: 0.6; line-height: 1;
}

/* ── Fast-forward: horizontal speed lines ── */
#sd-speedlines {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 23;
    opacity: 0; transition: opacity 0.1s ease;
}
#sd-speedlines.sd-ff-on { opacity: 1; }
.sd-speedline {
    position: absolute; left: 100%;
    height: var(--sl-h, 1px); width: var(--sl-w, 200px); border-radius: 1px;
    background: linear-gradient(to left, rgba(255,255,255,0.85), rgba(255,255,255,0));
    animation: sdSlMove var(--sl-dur, 0.22s) linear var(--sl-delay, 0s) infinite;
}
@keyframes sdSlMove {
    from { transform: translateX(0); }
    to   { transform: translateX(calc(-100vw - 500px)); }
}

/* ── Intro active: hide cylinders and HUD until intro finishes ── */
.sd-cyl-wrap { transition: opacity 450ms ease; }
.sd-hearts   { transition: opacity 450ms ease; }
.sd-left-hud { transition: opacity 450ms ease; }
#${SD_ID}.sd-intro-active .sd-cyl-wrap,
#${SD_ID}.sd-intro-active .sd-hearts,
#${SD_ID}.sd-intro-active .sd-left-hud { opacity: 0; }

/* ── Scrum intro: Truth Rocket banners ── */
/* Zero-height flex line pinned to the same vertical level as the truth-bullet
   cartridges (= center of the revolver cylinders).
   Cylinder wrap: bottom:-40px, height:clamp(188px,25vw,375px)
   → bullet center = clamp(188px,25vw,375px)/2 - 40px above viewport bottom */
.sd-intro-rocket-wrap {
    position: fixed; left: 0; right: 0; z-index: 2147483646;
    height: 0; overflow: visible;
    bottom: calc(clamp(188px, 25vw, 375px) / 2 - 40px);
    display: flex; align-items: center;
    pointer-events: none; user-select: none;
}
.sd-intro-rocket-wrap-opp  { justify-content: flex-start; }
.sd-intro-rocket-wrap-supp { justify-content: flex-end;   }

/* Inner element: carries the slide + fade transition; contains img + overlay text */
.sd-intro-rocket {
    position: relative; display: inline-block;
    opacity: 0;
    transition: transform 520ms cubic-bezier(0.22,0.61,0.36,1), opacity 180ms ease;
}
.sd-intro-rocket-opp  { transform: translateX(-110vw); }
.sd-intro-rocket-supp { transform: translateX(110vw);  }

/* Rocket image */
.sd-intro-rocket img {
    display: block; height: clamp(70px, 11vh, 110px); width: auto;
}
.sd-intro-rocket-opp img {
    filter: drop-shadow(0 0 20px rgba(255,60,60,0.85)) drop-shadow(0 0 48px rgba(200,0,0,0.5));
}
.sd-intro-rocket-supp img {
    filter: drop-shadow(0 0 20px rgba(60,140,255,0.85)) drop-shadow(0 0 48px rgba(0,80,220,0.5));
}

/* Text overlaid on the rocket, vertically centered */
.sd-intro-rocket .sd-rocket-label {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
    font-size: clamp(12px, 1.8vh, 17px); font-weight: 700;
    white-space: nowrap; text-align: center;
    pointer-events: none;
}
.sd-intro-rocket-opp  .sd-rocket-label {
    color: #fff8f4;
    text-shadow: 0 0 12px rgba(255,80,80,0.9), 1px 1px 0 #000, -1px -1px 0 #000,
                 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 5px rgba(0,0,0,0.95);
}
.sd-intro-rocket-supp .sd-rocket-label {
    color: #e8f4ff;
    text-shadow: 0 0 12px rgba(80,160,255,0.9), 1px 1px 0 #000, -1px -1px 0 #000,
                 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 5px rgba(0,0,0,0.95);
}

/* ── Scrum intro: "DEBATE SCRUM START!" title card ── */
.sd-intro-title {
    position: fixed; inset: 0; z-index: 2147483646;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none; user-select: none;
    opacity: 0; transition: opacity 260ms ease;
}
.sd-intro-title-text {
    font-family: "Orbitron", "Arial Black", sans-serif;
    font-size: clamp(28px, 5.5vw, 72px); font-weight: 900;
    letter-spacing: 0.12em; text-align: center;
    color: #ffe566;
    text-shadow:
        0 0 18px rgba(255,220,80,0.9),
        0 0 40px rgba(255,180,0,0.65),
        3px 3px 8px rgba(0,0,0,0.95);
    transform: scale(0.7);
    transition: transform 900ms cubic-bezier(0.22,0.61,0.36,1);
}
.sd-intro-title.sd-title-on .sd-intro-title-text { transform: scale(1); }
`;
}

// ── HTML helpers ───────────────────────────────────────────────────────────

// Compute perspective vars for a portrait based on its position in the line.
// depthIdx 0 = front/outermost (tallest), N-1 = back/innermost (shortest).
// ph is a vh value — resolves against viewport height, no parent-height chain needed.
// The bottom stagger (pb) is also subtracted from ph so each character is exactly
// that many px shorter than their base vh height, matching the GCP depth-scale convention.
function computePortraitVars(depthIdx, total) {
    const t    = total > 1 ? depthIdx / (total - 1) : 0; // 0 = front, 1 = back
    const phVh = (70 - t * 20).toFixed(1);                // height: 70vh → 34vh
    const pbPx = depthIdx * 30;                           // stagger: 0px, 25px, 50px … — steeper floor-rise matches reference X
    const ph   = pbPx > 0 ? `calc(${phVh}vh - ${pbPx}px)` : `${phVh}vh`;
    const pz   = Math.max(1, 10 - depthIdx);
    const pb   = `${pbPx}px`;
    return { ph, pz, pb, phVh, pbPx };
}

// Reference constants for character-height → vh conversion (mirrors GCP formula).
const SD_REF_HEIGHT_CM = 170;
const SD_BASE_VH       = 70;  // vh assigned to a 170 cm character at the front position

function charTrueHeightVh(name, getCharHeightCm) {
    if (!getCharHeightCm || !name) return null;
    const cm = getCharHeightCm(name);
    if (!cm) return null;
    const scale = Math.min(1.45, Math.max(0.55, cm / SD_REF_HEIGHT_CM));
    return (SD_BASE_VH * scale).toFixed(1);
}

// Given a depth-based phVh (number string, e.g. "62.0") and an already-rendered
// portrait element that carries data-ph-true, return a CSS height expression that
// multiplies the depth scale by the character's height-scale ratio.
// data-ph-true = SD_BASE_VH × heightScale, so scale = phTrue / SD_BASE_VH.
// Falls back to the raw depth value if no data-ph-true is present.
function scaledPhFromEl(el, phVh, pbPx) {
    const trueVh = parseFloat(el?.dataset?.phTrue);
    let finalVh = parseFloat(phVh);
    if (trueVh) finalVh = finalVh * (trueVh / SD_BASE_VH);
    const v = finalVh.toFixed(1);
    return pbPx > 0 ? `calc(${v}vh - ${pbPx}px)` : `${v}vh`;
}

function portraitHtml(char, side, depthIdx, total, overrideUrl = null, overrideName = null, forceAlive = false, needsFlip = false, getCharHeightCm = null) {
    const { pz, pb, phVh, pbPx } = computePortraitVars(depthIdx, total);
    const url        = overrideUrl || charAvatarUrl(char);
    const rawName    = overrideName || String(char?.name || "");
    const initial    = escapeHtml(rawName.trim().charAt(0).toUpperCase() || "?");
    const isDeadChar = !forceAlive && !!char?._sdDead;
    const classes    = [
        "sd-portrait",
        `sd-portrait-${side}`,
        depthIdx === 0 ? "sd-portrait-leader" : "",
        isDeadChar     ? "sd-portrait-dead"   : "",
    ].filter(Boolean).join(" ");
    const deadAttr    = isDeadChar ? ' data-dead="true"' : '';
    const mirrorClass = needsFlip  ? ' sd-mirrored'      : '';
    // data-ph-base  — depth-based vh (position scaling), used to restore after debug toggle
    // data-pb-base  — bottom stagger px, used to restore after debug toggle
    // data-ph-true  — character-height-based vh (real-world scale), used in debug flat view
    const trueVh      = charTrueHeightVh(rawName, getCharHeightCm) ?? '';
    // Combine depth scaling with character height ratio for the live --ph value.
    // scaledPhFromEl can't be used here (no element yet), so inline the same maths.
    const heightScale = trueVh ? parseFloat(trueVh) / SD_BASE_VH : 1;
    const scaledVh    = (parseFloat(phVh) * heightScale).toFixed(1);
    const ph          = pbPx > 0 ? `calc(${scaledVh}vh - ${pbPx}px)` : `${scaledVh}vh`;
    return `<div class="${classes}"${deadAttr} data-name="${escapeHtml(rawName)}" data-ph-base="${phVh}" data-pb-base="${pbPx}" data-ph-true="${trueVh}" style="--ph:${ph}; --pz:${pz}; --pb:${pb}">
        <div class="sd-portrait-img-wrap">
            ${url ? `<img src="${url}" alt="${initial}" class="sd-portrait-avatar${mirrorClass}" onerror="this.remove()">` : ""}
        </div>
    </div>`;
}

function stageHtml(teams, extPath, oppSprites, playerSprites, playerSpriteUrl, playerName, monoUrl = "", getCharHeightCm = null) {
    if (!monoUrl && extPath) monoUrl = `/${extPath}/assets/monokuma/monokuma_idle.png`;
    const oppN = teams.opposing.length || 1;
    const oppPortraits = teams.opposing.length
        ? teams.opposing.map((c, i) => portraitHtml(c, "opp", i, oppN, oppSprites?.[i]?.url || null, null, false, oppSprites?.[i]?.needsFlip ?? false, getCharHeightCm)).join("")
        : portraitHtml({ name: "?" }, "opp", 0, 1);
    const playerN = teams.player.length || 1;
    const playerPortraits = teams.player.length
        ? teams.player.map((c, i) => portraitHtml(
              c, "player", i, playerN,
              i === 0 ? (playerSpriteUrl || playerSprites?.[i]?.url || null) : (playerSprites?.[i]?.url || null),
              i === 0 ? (playerName || null) : null,
              i === 0,  // forceAlive: front slot is always the player (Prome), never marked dead
              playerSprites?.[i]?.needsFlip ?? false,
              getCharHeightCm
          )).join("")
        : portraitHtml({ name: playerName || "You" }, "player", 0, 1, playerSpriteUrl || null, playerName || null, true, false);
    const monoEl = monoUrl
        ? `<img src="${monoUrl}" alt="Monokuma" class="sd-monokuma-img">`
        : `<div class="sd-monokuma-placeholder">⚖</div>`;
    return `
<div class="sd-court">
    <div class="sd-court-bg"></div>
    <div class="sd-court-teams">
        <div class="sd-team-opp">${oppPortraits}</div>
        <div class="sd-court-center">${monoEl}</div>
        <div class="sd-team-player">${playerPortraits}</div>
    </div>
    <div class="sd-left-hud">
        <div class="sd-speaker" id="sd-speaker"></div>
        <div class="sd-round-dots" id="sd-round-dots"></div>
        <div class="sd-conc-row" id="sd-conc-row">
            <span class="sd-conc-label">CONCENTRATE</span>
            <div class="sd-conc-track"><div class="sd-conc-fill" id="sd-conc-fill"></div></div>
        </div>
    </div>
</div>`;
}

function renderStatement(text) {
    return String(text || "")
        .replace(/,\s+/g, ',<br>')
        .replace(/\[\[(.+?)\]\]/g, (_f, key) =>
            `<span class="sd-weak" data-key="${escapeHtml(key)}">${escapeHtml(key)}</span>`
        );
}

// ── Controller ─────────────────────────────────────────────────────────────

export function createScrumDebateController({
    extensionFolderPath  = "",
    awardMonocoins       = null,
    deductMonocoins      = null,
    getTruthBullets      = null,
    pauseCurrentBgm      = null,
    resumeCurrentBgm     = null,
    getScrumTracks       = null,
    playBgm              = null,
    getFinalPushTrack    = null,
    onWin                = null,
    getSpriteUrl         = null,
    isCharacterDead      = null,
    getPlayerSpriteUrl   = null,
    getPlayerName        = null,
    getCharacterHeightCm = null,
} = {}) {

    function destroy() {
        document.getElementById(SD_ID)?.remove();
        document.getElementById(SD_STYLE)?.remove();
    }

    function playSfx(relative) {
        if (!extensionFolderPath) return;
        new Audio(`/${extensionFolderPath}/${relative}`).play().catch(() => {});
    }

    function pickBgmTrack() {
        const tracks = typeof getScrumTracks === "function" ? getScrumTracks() : [];
        if (Array.isArray(tracks) && tracks.length)
            return tracks[Math.floor(Math.random() * tracks.length)];
        if (extensionFolderPath)
            return `/${extensionFolderPath}/assets/bgm/Argument -Blade Lock-.mp3`;
        return null;
    }

    async function run({ scenario = SCRUM_DEBATE_DEFAULT_SCENARIO } = {}) {
        destroy();

        const rounds = Array.isArray(scenario?.rounds) ? scenario.rounds : [];
        if (!rounds.length) return false;

        // ── Truth bullets ──────────────────────────────────────────────────
        let bullets = [];
        if (typeof getTruthBullets === "function") {
            try { bullets = getTruthBullets() || []; } catch {}
        }
        if (!bullets.length) {
            // Build a fallback set that always includes the correct bullets
            const correctTitles = new Set(rounds.map(r => r.correctTruthBulletTitle).filter(Boolean));
            const distractors = ["Broken Clock", "Missing Glove", "Witness Statement", "Blood Pattern", "Eraser Dust"];
            const all = [...distractors, ...correctTitles];
            all.forEach(title => {
                if (!bullets.find(b => b.title === title))
                    bullets.push({ id: title.toLowerCase().replace(/\s+/g, "-"), title, description: "" });
            });
        }
        // Shuffle so bullets aren't in a predictable order
        bullets = [...bullets].sort(() => Math.random() - 0.5);

        // ── Character teams ────────────────────────────────────────────────
        const teams = buildTeams(isCharacterDead);

        // ── Resolve character sprites (scrum → relief → thumbnail fallback) ──
        // side = "opp" | "player"
        // Returns { url, needsFlip } — needsFlip true when using a generic (non-side-specific)
        // sprite on the opposing team, which faces left and must be mirrored to face right.
        async function resolveCharSprite(charName, side) {
            if (typeof getSpriteUrl !== "function") return { url: null, needsFlip: side === "opp" };
            // Only use the dead sprite if the character is actually marked dead in the Monopad
            if (typeof isCharacterDead === "function" && isCharacterDead(charName)) {
                const dead = await getSpriteUrl(charName, "dead").catch(() => null);
                if (dead) return { url: dead, needsFlip: side === "opp" };
            }
            // Try side-specific sprite first (scrumright for opposing, scrumleft for player)
            const sideVariant = side === "opp" ? "scrumright" : "scrumleft";
            const sideSprite  = await getSpriteUrl(charName, sideVariant).catch(() => null);
            if (sideSprite) return { url: sideSprite, needsFlip: false };
            // Fall back to generic scrum → relief
            const scrum = await getSpriteUrl(charName, "scrum").catch(() => null);
            if (scrum) return { url: scrum, needsFlip: side === "opp" };
            const relief = await getSpriteUrl(charName, "relief").catch(() => null);
            return { url: relief, needsFlip: side === "opp" };
        }
        const [oppSprites, playerSprites] = await Promise.all([
            Promise.all(teams.opposing.map(c => resolveCharSprite(c.name, "opp"))),
            Promise.all(teams.player.map(c => resolveCharSprite(c.name, "player"))),
        ]);

        // ── Player identity (Prome sprite + persona name) ──────────────────
        let playerSpriteUrl = null;
        let playerName      = typeof getPlayerName === "function" ? getPlayerName() || null : null;
        if (typeof getPlayerSpriteUrl === "function") {
            playerSpriteUrl = await getPlayerSpriteUrl("scrumleft").catch(() => null)
                || await getPlayerSpriteUrl("scrum").catch(() => null)
                || await getPlayerSpriteUrl("relief").catch(() => null);
        }

        // ── Monokuma sprite ────────────────────────────────────────────────
        let monoSpriteUrl = extensionFolderPath ? `/${extensionFolderPath}/assets/monokuma/monokuma_idle.png` : "";
        if (typeof getSpriteUrl === "function") {
            monoSpriteUrl = await getSpriteUrl("Monokuma", "sit").catch(() => null) || monoSpriteUrl;
        }

        // ── DOM setup ─────────────────────────────────────────────────────
        if (!document.querySelector('link[href*="Noto+Sans+JP"]')) {
            const fontLink = document.createElement("link");
            fontLink.rel  = "stylesheet";
            fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap";
            document.head.appendChild(fontLink);
        }
        const styleEl = document.createElement("style");
        styleEl.id = SD_STYLE;
        styleEl.textContent = buildStyles(extensionFolderPath);
        document.head.appendChild(styleEl);

        const overlay = document.createElement("div");
        overlay.id = SD_ID;
        overlay.innerHTML = `
<div class="sd-bg" id="sd-bg"></div>
<div class="sd-root">
    <div class="sd-cyl-wrap sd-cyl-wrap-opp">
        <img class="sd-cylinder sd-cylinder-opp" id="sd-cylinder-opp" src="/${extensionFolderPath}/assets/images/minigames/revolver-cylinder.png" alt=""/>
        <div class="sd-bullet-name-box">
            <div class="sd-bullet-title" id="sd-opp-title">—</div>
            <div class="sd-bullet-desc"  id="sd-opp-desc"></div>
        </div>
    </div>
    <div class="sd-cyl-wrap sd-cyl-wrap-player">
        <img class="sd-cylinder sd-cylinder-player" id="sd-cylinder" src="/${extensionFolderPath}/assets/images/minigames/revolver-cylinder.png" alt=""/>
        <div class="sd-cyl-index" id="sd-bullet-counter">01</div>
        <div class="sd-bullet-name-box">
            <div class="sd-bullet-title" id="sd-player-title">—</div>
            <div class="sd-bullet-desc"  id="sd-player-desc"></div>
        </div>
    </div>
    <div class="sd-hearts" id="sd-hearts"></div>
    ${stageHtml(teams, extensionFolderPath, oppSprites, playerSprites, playerSpriteUrl, playerName, monoSpriteUrl, getCharacterHeightCm)}
    <div class="sd-statement" id="sd-statement" style="transform:translateX(-9999px)"></div>
    <div class="sd-flash" id="sd-flash"></div>
    <div class="sd-tug" id="sd-tug"></div>
    <div class="sd-speed-info" style="display:none">
        <span id="sd-speed-slow"></span><span id="sd-speed-fast"></span>
    </div>
    <div id="sd-status" class="sd-status"></div>
    <div id="sd-bt-vfx"></div>
    <div id="sd-bt-alert"></div>
    <div id="sd-speedlines"></div>
</div>`;
        overlay.classList.add("sd-intro-active");
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("sd-on")));

        // ── BGM ────────────────────────────────────────────────────────────
        pauseCurrentBgm?.();
        const bgmTrack = pickBgmTrack();
        if (bgmTrack) playBgm?.(bgmTrack);

        // ── DOM refs ───────────────────────────────────────────────────────
        const bgEl          = overlay.querySelector("#sd-bg");
        const dotsEl        = overlay.querySelector("#sd-round-dots");
        const speakerEl     = overlay.querySelector("#sd-speaker");
        const concRowEl     = overlay.querySelector("#sd-conc-row");
        const concFillEl    = overlay.querySelector("#sd-conc-fill");
        const oppTeamEl     = overlay.querySelector(".sd-team-opp");
        const playerTeamEl  = overlay.querySelector(".sd-team-player");
        const heartsEl      = overlay.querySelector("#sd-hearts");
        const oppTitleEl    = overlay.querySelector("#sd-opp-title");
        const oppDescEl     = overlay.querySelector("#sd-opp-desc");
        const playerTitleEl   = overlay.querySelector("#sd-player-title");
        const playerDescEl    = overlay.querySelector("#sd-player-desc");
        const playerNameBoxEl = overlay.querySelector(".sd-cyl-wrap-player .sd-bullet-name-box");
        const playerPanel     = overlay.querySelector("#sd-player-panel");
        const cylinderEl    = overlay.querySelector("#sd-cylinder");
        const cylOppEl      = overlay.querySelector("#sd-cylinder-opp");
        const counterEl     = overlay.querySelector("#sd-bullet-counter");
        const arenaEl       = overlay.querySelector(".sd-root");
        const statementEl   = overlay.querySelector("#sd-statement");
        const flashEl       = overlay.querySelector("#sd-flash");
        const statusEl      = overlay.querySelector("#sd-status");
        const speedSlowEl   = overlay.querySelector("#sd-speed-slow");
        const speedFastEl   = overlay.querySelector("#sd-speed-fast");
        const tugEl         = overlay.querySelector("#sd-tug");

        // ── Populate VFX overlays ──────────────────────────────────────────
        // Speedlines (22 randomised streaks for fast-forward)
        const slOverlay = overlay.querySelector("#sd-speedlines");
        if (slOverlay) {
            for (let i = 0; i < 22; i++) {
                const line = document.createElement("div");
                line.className = "sd-speedline";
                line.style.setProperty("--sl-h",     `${1 + Math.round(Math.random() * 2)}px`);
                line.style.setProperty("--sl-w",     `${80 + Math.round(Math.random() * 340)}px`);
                line.style.setProperty("--sl-dur",   `${(0.12 + Math.random() * 0.18).toFixed(2)}s`);
                line.style.setProperty("--sl-delay", `-${(Math.random() * 0.3).toFixed(2)}s`);
                line.style.top = `${Math.round(Math.random() * 100)}%`;
                slOverlay.appendChild(line);
            }
        }
        // ALERT rows (14 alternating scroll-left / scroll-right rows for slow-mo)
        const btAlertEl = overlay.querySelector("#sd-bt-alert");
        if (btAlertEl) {
            const box  = `<div class="sd-alert-box"><div class="sd-alert-word">ALERT</div><div class="sd-alert-conc">CONCENTRATING</div></div>`;
            const row  = box.repeat(36);
            btAlertEl.innerHTML = Array.from({ length: 14 }, (_, i) =>
                `<div class="sd-alert-row sd-alert-row-${i % 2 === 0 ? "l" : "r"}">${row}</div>`
            ).join("");
        }

        return new Promise((resolve) => {
            // ── State ──────────────────────────────────────────────────────
            let resolved    = false;
            let health      = 3;
            let bulletIdx   = 0;
            let phase       = "debate"; // "debate" | "tug"
            let uiReady     = false;   // true once the intro finishes and the debate UI is visible
            let debunkedSet = new Set();
            let roundIdx    = 0;        // index into rounds[] currently displayed
            let statementX  = 9999;     // current X offset of statement
            let stmtW       = null;     // will be measured once loaded
            let arenaW      = 800;
            let advancing   = false;    // true during debunk flash animation
            let teamShift   = 0;        // how many times the front slot has rotated
            let shiftHeld      = false;
            let escHeld        = false;
            let cylinderAngle  = 0;
            let revolverTarget = 0;
            let cylOppAngle    = 0;
            let cylOppTarget   = 0;
            let spinRafId      = null;
            let prevSpeedMod = 1.0;
            let concentration        = 100;  // 0–100
            let concentrationDepleted = false; // true when emptied; blocks slow-mo until threshold
            let slowmoAudio = null;
            let ffAudio     = null;
            let bgZoom      = 1.0;
            let frameId     = null;
            let lastTs      = null;
            // Tug-of-war state
            let tugPos          = 50;
            let tugDir          = "right";
            let tugChangeTimer  = TUG_CHANGE_MS;
            let tugLastTs       = null;
            let tugFrameId      = null;
            // Tug rocket elements (created in startTug, removed in teardown)
            let tugOppRocketEl   = null;
            let tugSuppRocketEl  = null;
            let tugRocketWrapEl  = null;
            // Tug indicator elements
            let tugIndicatorEl   = null;
            let tugBounceHostEl  = null;
            let tugArrowCenterEl = null;

            // ── Speed VFX — visuals + audio matching NSD slow-mo / fast-forward ──
            const btVfxEl = overlay.querySelector("#sd-bt-vfx");
            function applySpeedVfx(mod) {
                if (mod < 1.0) {
                    // Slow-mo: green overlay + ALERT rows + pink bullet panel
                    btVfxEl?.classList.add("sd-slowmo-on");
                    btAlertEl?.classList.add("sd-slowmo-on");
                    slOverlay?.classList.remove("sd-ff-on");
                    if (!slowmoAudio) {
                        slowmoAudio = new Audio(`/${extensionFolderPath}/assets/sfx/minigames/slowmo.wav`);
                        slowmoAudio.loop = true;
                        slowmoAudio.play().catch(() => {});
                    }
                    if (ffAudio) { ffAudio.pause(); ffAudio.src = ""; ffAudio = null; }
                    if (playerPanel) {
                        playerPanel.style.boxShadow = "inset -5px 0 0 rgba(255,0,200,0.8), inset 0 0 36px rgba(255,0,200,0.22)";
                    }
                } else if (mod > 1.0) {
                    // Fast-forward: speed lines + gold bullet panel
                    btVfxEl?.classList.remove("sd-slowmo-on");
                    btAlertEl?.classList.remove("sd-slowmo-on");
                    slOverlay?.classList.add("sd-ff-on");
                    if (!ffAudio) {
                        ffAudio = new Audio(`/${extensionFolderPath}/assets/sfx/trial/fast-forward.mp3`);
                        ffAudio.loop = true;
                        ffAudio.play().catch(() => {});
                    }
                    if (slowmoAudio) { slowmoAudio.pause(); slowmoAudio.src = ""; slowmoAudio = null; }
                    if (playerPanel) {
                        playerPanel.style.boxShadow = "inset -5px 0 0 rgba(255,220,0,0.8), inset 0 0 36px rgba(255,220,0,0.22)";
                    }
                } else {
                    // Normal speed: clear all effects
                    btVfxEl?.classList.remove("sd-slowmo-on");
                    btAlertEl?.classList.remove("sd-slowmo-on");
                    slOverlay?.classList.remove("sd-ff-on");
                    if (slowmoAudio) { slowmoAudio.pause(); slowmoAudio.src = ""; slowmoAudio = null; }
                    if (ffAudio)     { ffAudio.pause();     ffAudio.src     = ""; ffAudio     = null; }
                    if (playerPanel) { playerPanel.style.boxShadow = ""; }
                }
                prevSpeedMod = mod;
            }

            // ── White noise pool (MPD-style floating exclamations) ─────────
            const SD_WHITE_NOISE_TEXTS = [
                "That's not right!", "No way..!", "Stop it!", "I can't listen to this!",
                "Shut up!", "That's a lie!", "You're wrong!", "Impossible!",
                "I don't believe it!", "La la la la la!", "AAAGH!!", "Cut it out!",
                "How would you know?!", "That makes no sense!", "Ugh!!", "No no no!",
            ];
            const wnPool = [];
            let wnRafId  = null;

            function runWnPool(now) {
                let i = wnPool.length;
                while (i--) {
                    const it = wnPool[i];
                    if (!document.body.contains(it.el)) { wnPool.splice(i, 1); continue; }
                    if (resolved) { it.el.remove(); wnPool.splice(i, 1); continue; }
                    const dt = Math.min(now - it.lastNow, 100);
                    it.elapsed += dt;
                    it.lastNow  = now;
                    const p   = Math.min(1, it.elapsed / it.duration);
                    const x   = it.startX + it.driftX * p;
                    const y   = it.startY + it.driftY * p;
                    const rot = it.rotStart + (it.elapsed / 1000) * it.rotSpeed;
                    let opacity = 1;
                    if (p < 0.08)       opacity = p / 0.08;
                    else if (p > 0.88)  opacity = Math.max(0, (1 - p) / 0.12);
                    it.el.style.opacity   = String(opacity);
                    it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg)`;
                    if (p >= 1) { it.el.remove(); wnPool.splice(i, 1); }
                }
                wnRafId = wnPool.length ? requestAnimationFrame(runWnPool) : null;
            }

            function spawnSdWhiteNoise() {
                if (resolved) return;
                const w      = window.innerWidth  || 1200;
                const h      = window.innerHeight || 800;
                const nearY  = Math.round(h * 0.82);  // matches bottom: 18% statement position
                const count  = Math.floor(Math.random() * 3) + 2;  // 2–4 elements
                for (let i = 0; i < count; i++) {
                    const text    = SD_WHITE_NOISE_TEXTS[Math.floor(Math.random() * SD_WHITE_NOISE_TEXTS.length)];
                    const nearX   = Math.round(w * (0.25 + Math.random() * 0.5));
                    const offsetX = Math.round(Math.random() * 280 - 140);
                    const offsetY = Math.round(Math.random() * 80 - 40);
                    const startX  = Math.max(120, Math.min(w - 120, nearX + offsetX));
                    const startY  = Math.max(80,  Math.min(h - 80,  nearY + offsetY));
                    const dir     = Math.random() < 0.5 ? -1 : 1;
                    const el      = document.createElement("div");
                    el.className  = "sd-white-noise";
                    el.textContent = text;
                    el.style.opacity   = "0";
                    el.style.transform = `translate(${startX}px, ${startY}px) translate(-50%, -50%)`;
                    document.body.appendChild(el);
                    wnPool.push({
                        el, startX, startY,
                        driftX: dir * Math.round(w * 0.09),
                        driftY: Math.round(Math.random() * 20 - 10),
                        duration: 7500 + Math.floor(Math.random() * 2000),
                        rotStart: Math.random() * 16 - 8,
                        rotSpeed: Math.random() * 8 - 4,
                        lastNow: performance.now(), elapsed: 0,
                    });
                }
                if (!wnRafId) wnRafId = requestAnimationFrame(runWnPool);
            }

            // ── Teardown ───────────────────────────────────────────────────
            function teardown(result) {
                if (resolved) return;
                resolved = true;
                if (frameId)    cancelAnimationFrame(frameId);
                if (tugFrameId) cancelAnimationFrame(tugFrameId);
                if (spinRafId)  { cancelAnimationFrame(spinRafId); spinRafId = null; }
                if (wnRafId)    { cancelAnimationFrame(wnRafId); wnRafId = null; }
                wnPool.forEach(it => it.el.remove()); wnPool.length = 0;
                document.removeEventListener("keydown", onKeydown);
                document.removeEventListener("keyup",   onKeyup);
                if (slowmoAudio) { slowmoAudio.pause(); slowmoAudio.src = ""; slowmoAudio = null; }
                if (ffAudio)     { ffAudio.pause();     ffAudio.src     = ""; ffAudio     = null; }
                tugRocketWrapEl?.remove(); tugRocketWrapEl = null;
                tugIndicatorEl?.remove();  tugIndicatorEl  = null;
                resumeCurrentBgm?.();
                overlay.classList.remove("sd-on");
                setTimeout(destroy, 310);
                resolve(result);
            }

            // ── UI helpers ─────────────────────────────────────────────────
            function renderHearts() {
                heartsEl.innerHTML = Array.from({ length: 3 }, (_, i) =>
                    `<span class="sd-heart ${i >= health ? "sd-lost" : ""}">❤</span>`
                ).join("");
            }

            function flash(type, ms = 220) {
                flashEl.className = `sd-flash sd-flash-${type}`;
                setTimeout(() => { if (!resolved) flashEl.className = "sd-flash"; }, ms);
            }

            function shakeArena() {
                statementEl.classList.remove("sd-shake");
                void statementEl.offsetWidth;
                statementEl.classList.add("sd-shake");
                setTimeout(() => statementEl.classList.remove("sd-shake"), 260);
            }

            function updateBulletPanel(dir = 0) {
                const b = bullets[bulletIdx % Math.max(1, bullets.length)];
                playerTitleEl.textContent = b?.title       || "—";
                playerDescEl.textContent  = b?.description || "";
                // Counter badge: "01", "02", …
                if (counterEl) counterEl.textContent = String(bulletIdx + 1).padStart(2, "0");
                // Cylinder jump — bump the spin target on cycle
                if (dir !== 0) revolverTarget += dir * 40;
                // Slide animation — title and name-box together
                const slideClass = dir >= 0 ? "sd-slide-right" : "sd-slide-left";
                playerTitleEl.classList.remove("sd-slide-left", "sd-slide-right");
                playerNameBoxEl?.classList.remove("sd-slide-left", "sd-slide-right");
                void playerTitleEl.offsetWidth;
                playerTitleEl.classList.add(slideClass);
                playerNameBoxEl?.classList.add(slideClass);
            }

            function cycleBullet(dir) {
                bulletIdx = ((bulletIdx + dir) + bullets.length) % Math.max(1, bullets.length);
                updateBulletPanel(dir);
                playSfx("assets/sfx/minigames/scrum-truth-load.wav");
            }

            function getActiveRounds() {
                return rounds.map((_, i) => i).filter(i => !debunkedSet.has(i));
            }

            // ── Speaker nameplate — shows the current opposing leader's name ──
            function updateSpeaker() {
                if (!speakerEl) return;
                const leader = oppTeamEl?.querySelector('.sd-portrait-leader:not([data-passed="true"])');
                const fullName = leader?.dataset.name || "";
                speakerEl.textContent = fullName.trim().split(/[\s,_\-]+/)[0].toUpperCase();
            }

            // ── Team rotation — cycles which alive character stands at the front ──
            // Passed characters are permanently removed from the rotation.
            // Dead characters are pinned at the back and never enter the speaking slot.
            // Portraits are absolutely positioned; depth controls height (vh) and offset.
            function updateTeamShift(shift) {
                const applyShift = (teamEl, isPlayer) => {
                    if (!teamEl) return;
                    const portraits = [...teamEl.querySelectorAll('.sd-portrait')]
                        .filter(el => el.dataset.passed !== "true");
                    const alive = portraits.filter(el => el.dataset.dead !== "true");
                    const dead  = portraits.filter(el => el.dataset.dead === "true");
                    const N     = alive.length;
                    const total = portraits.length;
                    if (!total) return;

                    // Step = fraction of team width to offset each depth level.
                    // Use measured width; fall back to a vw estimate.
                    const teamW = teamEl.offsetWidth || (window.innerWidth * 0.45);
                    const step  = Math.round(teamW / (total + 1));
                    const edge  = isPlayer ? 'right' : 'left';
                    const opp   = isPlayer ? 'left'  : 'right';

                    // Alive portraits cycle through depth positions 0 .. N-1
                    alive.forEach((el, i) => {
                        const depth = N > 0 ? (i - (shift % N) + N) % N : 0;
                        const { phVh, pbPx, pz, pb } = computePortraitVars(depth, total);
                        el.style.setProperty('--ph', scaledPhFromEl(el, phVh, pbPx));
                        el.style.setProperty('--pz', pz);
                        el.style.setProperty('--pb', pb);
                        el.style[edge] = `${depth * step}px`;
                        el.style[opp]  = '';
                        el.classList.toggle('sd-portrait-leader', depth === 0);
                    });

                    // Dead portraits pinned after alive — never cycle
                    dead.forEach((el, i) => {
                        const depth = N + i;
                        const { phVh, pbPx, pz, pb } = computePortraitVars(depth, total);
                        el.style.setProperty('--ph', scaledPhFromEl(el, phVh, pbPx));
                        el.style.setProperty('--pz', pz);
                        el.style.setProperty('--pb', pb);
                        el.style[edge] = `${depth * step}px`;
                        el.style[opp]  = '';
                        el.classList.remove('sd-portrait-leader');
                    });
                };
                applyShift(oppTeamEl,    false);
                applyShift(playerTeamEl, true);
                updateSpeaker();
            }

            // ── De-load the current speaking slot on each team ────────────
            // Called whenever a round is passed (debunked or scrolled off).
            // The leaders fade out and are hidden from layout so they never
            // cycle back to the front.
            function passLeaders() {
                [oppTeamEl, playerTeamEl].forEach(teamEl => {
                    if (!teamEl) return;
                    const leader = teamEl.querySelector('.sd-portrait-leader');
                    if (!leader || leader.dataset.passed === "true") return;
                    leader.dataset.passed = "true";
                    leader.classList.add('sd-portrait-passed');
                    // Collapse from layout after the CSS fade completes
                    setTimeout(() => {
                        if (!resolved) leader.style.display = 'none';
                    }, 430);
                });
            }

            // ── Round indicator dots ───────────────────────────────────────
            function renderDots() {
                if (!dotsEl) return;
                dotsEl.innerHTML = rounds.map((_, i) => {
                    const cls = ['sd-round-dot',
                        i === roundIdx     ? 'sd-dot-active'   : '',
                        debunkedSet.has(i) ? 'sd-dot-debunked' : '',
                    ].filter(Boolean).join(' ');
                    return `<div class="${cls}"></div>`;
                }).join('');
            }

            // ── Load round statement ───────────────────────────────────────
            function loadRound(idx) {
                const round = rounds[idx];
                if (!round) return;
                oppTitleEl.textContent = round.opposingClaim || round.statement || "—";
                oppDescEl.textContent  = "";

                statementEl.innerHTML = renderStatement(round.statement || "");
                stmtW = null; // re-measure next frame
                arenaW = arenaEl.offsetWidth || 800;
                statementX = -arenaW - 24;
                statementEl.style.transform = `translateX(${statementX}px)`;
                renderDots();
            }

            // ── Fire / debunk ──────────────────────────────────────────────
            function tryFire() {
                if (phase !== "debate" || advancing) return;
                const round  = rounds[roundIdx];
                const bullet = bullets[bulletIdx % Math.max(1, bullets.length)];
                if (!round || !bullet) return;
                playSfx("assets/sfx/minigames/scrum-truth-fire.wav");
                const correct  = String(round.correctTruthBulletTitle || "").trim().toLowerCase();
                const selected = String(bullet.title || "").trim().toLowerCase();
                if (correct && selected === correct) {
                    debunkRound(roundIdx);
                } else {
                    wrongFire();
                }
            }

            function wrongFire() {
                playSfx("assets/monokuma/incorrect-answer.wav");
                flash("red");
                shakeArena();
                deductMonocoins?.(2, "scrum debate wrong shot");
                health = Math.max(0, health - 1);
                renderHearts();
                if (health <= 0) {
                    statusEl.textContent = "The debate is lost — the opposition's argument holds.";
                    setTimeout(() => teardown(false), 750);
                }
            }

            function debunkRound(idx) {
                playSfx("assets/sfx/trial/weak-spot-hit.wav");
                flash("green", 320);
                awardMonocoins?.(2, "scrum debate weak spot debunked");
                debunkedSet.add(idx);
                bgZoom = Math.min(1.28, bgZoom + 0.05);
                bgEl.style.transform = `scale(${bgZoom})`;
                // Reveal the weak spot text in-place
                statementEl.querySelectorAll(".sd-weak").forEach(el => el.classList.add("sd-revealed"));
                statusEl.textContent = "Weak point exposed!";
                advancing = true;
                setTimeout(() => {
                    advancing = false;
                    passLeaders();
                    const active = getActiveRounds();
                    if (!active.length) {
                        startTug();
                        return;
                    }
                    // Advance to the next active round after current
                    const nextIdx = active.find(i => i > idx) ?? active[0];
                    roundIdx = nextIdx;
                    teamShift++;
                    updateTeamShift(teamShift);
                    loadRound(roundIdx);
                    statusEl.textContent = `${debunkedSet.size} debunked — ${active.length} remaining!`;
                }, 920);
            }

            // ── Concentration gauge ────────────────────────────────────────
            function updateConcBar() {
                if (!concFillEl) return;
                concFillEl.style.transform = `scaleX(${concentration / 100})`;
                concFillEl.classList.toggle('sd-conc-empty', concentrationDepleted);
            }

            // ── Debate rAF loop ────────────────────────────────────────────
            function debateFrame(ts) {
                if (resolved || phase !== "debate") return;
                if (!lastTs) lastTs = ts;
                const dt = Math.min((ts - lastTs) / 1000, 0.09);
                lastTs = ts;

                // Drain / refill concentration gauge
                const canSlowmo = shiftHeld && !concentrationDepleted;
                if (canSlowmo) {
                    concentration = Math.max(0, concentration - CONC_DRAIN_PPS * dt);
                    if (concentration <= 0) concentrationDepleted = true;
                } else {
                    concentration = Math.min(100, concentration + CONC_REFILL_PPS * dt);
                    if (concentrationDepleted && concentration >= CONC_RECOVER_THRESHOLD)
                        concentrationDepleted = false;
                }
                updateConcBar();

                const speedMod = canSlowmo ? SPEED_SLOW : escHeld ? SPEED_FAST : 1.0;
                if (speedMod !== prevSpeedMod) applySpeedVfx(speedMod);

                if (!advancing) {
                    arenaW = arenaEl.offsetWidth || 800;
                    if (stmtW === null) stmtW = statementEl.offsetWidth || 400;
                    statementX += SCROLL_BASE_PPS * speedMod * dt;

                    if (statementX > arenaW + 30) {
                        // Statement has exited right — advance to next active round
                        const active = getActiveRounds();
                        if (active.length) {
                            const pos    = active.indexOf(roundIdx);
                            const isLast = (pos + 1) >= active.length;
                            if (isLast && debunkedSet.size > 0) {
                                // Completed a full loop without solving all — reset progress
                                debunkedSet.clear();
                                flash("red", 400);
                                roundIdx = 0;
                            } else {
                                roundIdx = active[(pos + 1) % active.length];
                            }
                            passLeaders();
                            teamShift++;
                            updateTeamShift(teamShift);
                            loadRound(roundIdx);
                        }
                    } else {
                        const txt       = statementEl.textContent || "";
                        const screaming = txt === txt.toUpperCase() && /[A-Z]/.test(txt);
                        const shX = screaming ? Math.sin(ts / 28) * 2.2 : 0;
                        const shY = screaming ? Math.cos(ts / 24) * 1.6 : 0;
                        statementEl.style.transform = `translateX(${statementX + shX}px) translateY(${shY}px)`;
                    }
                }

                frameId = requestAnimationFrame(debateFrame);
            }

            // ── Tug-of-war ─────────────────────────────────────────────────
            function updateTugVisuals() {
                // Rockets: battle point tracks tugPos
                const battleX = (1 - tugPos / 100) * window.innerWidth;
                if (tugOppRocketEl)  tugOppRocketEl.style.left  = `${battleX}px`;
                if (tugSuppRocketEl) tugSuppRocketEl.style.left = `${battleX}px`;
                // Centered indicator: direction glyph + colour class
                if (tugArrowCenterEl) {
                    tugArrowCenterEl.textContent = TUG_DIR_GLYPH[tugDir] ?? "→";
                    tugArrowCenterEl.className   = `sd-tug-arrow-center sd-dir-${tugDir}`;
                }
                if (tugIndicatorEl) {
                    tugIndicatorEl.className = `sd-tug-indicator sd-dir-${tugDir}`;
                }
            }

            function bounceTugIndicator(correct) {
                if (!tugBounceHostEl) return;
                tugBounceHostEl.classList.remove("sd-tug-bounce");
                void tugBounceHostEl.offsetWidth; // reflow to restart animation
                tugBounceHostEl.classList.add("sd-tug-bounce");

                const img = document.createElement("img");
                img.className = "sd-tug-result";
                img.src = `/${extensionFolderPath}/assets/images/minigames/${correct ? "push" : "miss"}.png`;
                img.alt = "";
                img.addEventListener("animationend", () => img.remove(), { once: true });
                tugBounceHostEl.appendChild(img);
            }

            function handleTugKey(key) {
                const correct = key === TUG_DIR_KEY[tugDir];
                playSfx("assets/sfx/minigames/push-rocket.wav");
                if (correct) {
                    tugPos = clamp(tugPos + TUG_STEP, 0, 100);
                    flash("blue", 65);
                } else {
                    tugPos = clamp(tugPos - TUG_PENALTY, 0, 100);
                    flash("red", 90);
                }
                bounceTugIndicator(correct);
            }

            function tugFrame(ts) {
                if (resolved) return;
                if (!tugLastTs) tugLastTs = ts;
                const dt = Math.min((ts - tugLastTs) / 1000, 0.09);
                tugLastTs = ts;

                // Win check FIRST — before decay can pull it back below 100
                if (tugPos >= 100) {
                    awardMonocoins?.(30, "scrum debate won");
                    playSfx("assets/sfx/minigames/submission.wav");
                    statusEl.textContent = "Debate won — the truth prevails!";
                    onWin?.(scenario.playerTheory ?? "");
                    setTimeout(() => teardown(true), 750);
                    return;
                }

                // Opponent constantly pushes toward loss (0) — player must fight back
                tugPos = Math.max(0, tugPos - TUG_DECAY_PPS * dt);

                // Direction change countdown
                tugChangeTimer -= dt * 1000;
                if (tugChangeTimer <= 0) {
                    const others   = TUG_DIRS.filter(d => d !== tugDir);
                    tugDir         = others[Math.floor(Math.random() * others.length)];
                    tugChangeTimer = TUG_CHANGE_MS;
                    playSfx("assets/sfx/minigames/movement.wav");
                }
                updateTugVisuals();

                if (tugPos <= 0) {
                    deductMonocoins?.(30, "scrum debate lost");
                    playSfx("assets/monokuma/incorrect-answer.wav");
                    statusEl.textContent = "Debate lost — the opposition holds the floor.";
                    setTimeout(() => teardown(false), 750);
                    return;
                }

                tugFrameId = requestAnimationFrame(tugFrame);
            }

            function startTug() {
                applySpeedVfx(1.0);  // clear slow-mo / FF effects before tug
                phase = "tug";
                if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
                playSfx("assets/sfx/minigames/minigame-start.wav");
                statusEl.textContent = "All claims debunked! Press the matching arrow to clinch the debate!";
                tugEl.classList.add("sd-tug-on");
                overlay.classList.add("sd-tug-active"); // hide cylinders/hearts/HUD

                // Switch to Final Push BGM
                const finalPushTrack = getFinalPushTrack?.();
                if (finalPushTrack) playBgm?.(finalPushTrack);

                // Build tug rocket DOM (appended to body, same level as intro rockets)
                tugRocketWrapEl = document.createElement("div");
                tugRocketWrapEl.className = "sd-tug-rocket-wrap";
                tugRocketWrapEl.innerHTML = `
                    <div class="sd-tug-rocket-inner sd-tug-rocket-opp" id="sd-tug-rocket-opp">
                        <div class="sd-rocket-flare"></div>
                        <img src="/${extensionFolderPath}/assets/images/minigames/opposing-rocket.png" alt="">
                        <div class="sd-rocket-label">${escapeHtml(scenario.opposingTheory || "")}</div>
                    </div>
                    <div class="sd-tug-rocket-inner sd-tug-rocket-supp" id="sd-tug-rocket-supp">
                        <div class="sd-rocket-flare"></div>
                        <img src="/${extensionFolderPath}/assets/images/minigames/supporting-rocket.png" alt="">
                        <div class="sd-rocket-label">${escapeHtml(scenario.playerTheory || "")}</div>
                    </div>`;
                document.body.appendChild(tugRocketWrapEl);
                tugOppRocketEl  = document.getElementById("sd-tug-rocket-opp");
                tugSuppRocketEl = document.getElementById("sd-tug-rocket-supp");

                // Build centered direction indicator
                tugIndicatorEl = document.createElement("div");
                tugIndicatorEl.className = "sd-tug-indicator sd-dir-right";
                tugIndicatorEl.innerHTML = `
                    <div class="sd-tug-bounce-host" id="sd-tug-bounce-host">
                        <div class="sd-tug-circle">
                            <div class="sd-tug-arrow-center sd-dir-right" id="sd-tug-arrow-center">→</div>
                        </div>
                    </div>`;
                document.body.appendChild(tugIndicatorEl);
                tugBounceHostEl  = document.getElementById("sd-tug-bounce-host");
                tugArrowCenterEl = document.getElementById("sd-tug-arrow-center");

                tugPos         = 50;
                tugDir         = TUG_DIRS[Math.floor(Math.random() * TUG_DIRS.length)];
                tugChangeTimer = TUG_CHANGE_MS;
                updateTugVisuals(); // set initial positions + direction before fade-in
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    tugRocketWrapEl?.classList.add("sd-tug-rockets-on");
                }));

                tugLastTs  = null;
                tugFrameId = requestAnimationFrame(tugFrame);
            }

            // ── Debug: § toggles depth offsets + perspective off/on ──────────
            // Flat mode: zero pb, pure-vh ph, even horizontal spacing (two rows).
            // Restore: re-runs updateTeamShift so all depth vars are correct again.
            let debugFlatBottom = false;
            function toggleFlatBottomDebug() {
                debugFlatBottom = !debugFlatBottom;

                if (debugFlatBottom) {
                    [
                        { teamEl: oppTeamEl,    edge: 'left',  opp: 'right' },
                        { teamEl: playerTeamEl, edge: 'right', opp: 'left'  },
                    ].forEach(({ teamEl, edge, opp }) => {
                        if (!teamEl) return;
                        const portraits = [...teamEl.querySelectorAll('.sd-portrait')]
                            .filter(el => el.dataset.passed !== "true");
                        if (!portraits.length) return;
                        const teamW = teamEl.offsetWidth || (window.innerWidth * 0.45);
                        const step  = Math.round(teamW / (portraits.length + 1));
                        portraits.forEach((el, i) => {
                            // Prefer the real-world height-based vh; fall back to depth-based vh
                            const phVh = el.dataset.phTrue || el.dataset.phBase || '70';
                            el.style.setProperty('--pb', '0px');
                            el.style.setProperty('--ph', `${phVh}vh`);
                            el.style.setProperty('--pz', '3');
                            el.style[edge] = `${i * step}px`;
                            el.style[opp]  = '';
                        });
                    });
                } else {
                    updateTeamShift(teamShift);
                }
            }

            // ── Input ──────────────────────────────────────────────────────
            function onKeydown(e) {
                if (resolved) return;
                if (e.key === "Shift")  { shiftHeld = true;  return; }
                if (e.key === "Escape") { escHeld   = true;  return; }

                if (e.key === "§") { e.preventDefault(); toggleFlatBottomDebug(); return; }

                if (phase === "debate" && uiReady) {
                    if (e.key === "ArrowUp")                      { e.preventDefault(); cycleBullet(-1); }
                    else if (e.key === "ArrowDown")               { e.preventDefault(); cycleBullet(1);  }
                    else if (e.key === "Enter" || e.key === " ")  { e.preventDefault(); tryFire();       }
                } else if (phase === "tug") {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
                        e.key === "ArrowUp"   || e.key === "ArrowDown") {
                        e.preventDefault();
                        handleTugKey(e.key);
                    }
                }
            }

            function onKeyup(e) {
                if (e.key === "Shift")  shiftHeld = false;
                if (e.key === "Escape") escHeld   = false;
            }

            document.addEventListener("keydown", onKeydown);
            document.addEventListener("keyup",   onKeyup);

            // ── Cylinder spin loop (NSD-style: continuous + lerped jump on cycle) ──
            const SPIN_SPEED_DPF = 20 / 60;  // degrees per frame at 60fps
            const SPIN_LERP      = 0.1;
            function spinTick() {
                revolverTarget += SPIN_SPEED_DPF;
                cylinderAngle  += (revolverTarget - cylinderAngle) * SPIN_LERP;
                cylOppTarget   += SPIN_SPEED_DPF;
                cylOppAngle    += (cylOppTarget   - cylOppAngle)   * SPIN_LERP;
                // Player: mirrored (scaleX(-1)) so skew recedes to bottom-right
                if (cylinderEl) cylinderEl.style.transform = `scaleX(-1) skewX(8deg) skewY(14deg) rotate(${cylinderAngle}deg)`;
                // Opposing: normal orientation, recedes to bottom-left
                if (cylOppEl)   cylOppEl.style.transform   = `skewX(8deg) skewY(14deg) rotate(${cylOppAngle}deg)`;
                spinRafId = requestAnimationFrame(spinTick);
            }

            // ── Intro sequence: rockets → title → start ───────────────────
            async function playIntro() {
                const sleep     = ms => new Promise(r => setTimeout(r, ms));
                const waitFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

                // ── Opposing rocket scrolls in from the left ──────────────
                const oppWrap = document.createElement("div");
                oppWrap.className = "sd-intro-rocket-wrap sd-intro-rocket-wrap-opp";
                oppWrap.innerHTML = `
                    <div class="sd-intro-rocket sd-intro-rocket-opp">
                        <img src="/${extensionFolderPath}/assets/images/minigames/opposing-rocket.png" alt="">
                        <div class="sd-rocket-label">${escapeHtml(scenario.opposingTheory || "")}</div>
                    </div>`;
                document.body.appendChild(oppWrap);
                const oppRocket = oppWrap.querySelector(".sd-intro-rocket");

                playSfx("assets/sfx/minigames/scrum-statement-load.wav");
                await waitFrame();
                oppRocket.style.opacity   = "1";
                oppRocket.style.transform = "translateX(0)";

                await sleep(1500);

                // ── Supporting rocket scrolls in from the right ───────────
                const suppWrap = document.createElement("div");
                suppWrap.className = "sd-intro-rocket-wrap sd-intro-rocket-wrap-supp";
                suppWrap.innerHTML = `
                    <div class="sd-intro-rocket sd-intro-rocket-supp">
                        <img src="/${extensionFolderPath}/assets/images/minigames/supporting-rocket.png" alt="">
                        <div class="sd-rocket-label">${escapeHtml(scenario.playerTheory || "")}</div>
                    </div>`;
                document.body.appendChild(suppWrap);
                const suppRocket = suppWrap.querySelector(".sd-intro-rocket");

                playSfx("assets/sfx/minigames/scrum-statement-load.wav");
                await waitFrame();
                suppRocket.style.opacity   = "1";
                suppRocket.style.transform = "translateX(0)";

                await sleep(1800);

                // ── Fade out both rockets ─────────────────────────────────
                oppRocket.style.opacity  = "0";
                suppRocket.style.opacity = "0";
                await sleep(280);
                oppWrap.remove();
                suppWrap.remove();

                // ── "DEBATE SCRUM START!" title card ─────────────────────
                const titleEl = document.createElement("div");
                titleEl.className = "sd-intro-title";
                titleEl.innerHTML = `<div class="sd-intro-title-text">DEBATE SCRUM START!</div>`;
                document.body.appendChild(titleEl);

                await waitFrame();
                titleEl.style.opacity = "1";
                titleEl.classList.add("sd-title-on");

                await sleep(1400);

                // Fade out title
                titleEl.style.opacity = "0";
                await sleep(280);
                titleEl.remove();

                // ── Reveal UI ─────────────────────────────────────────────
                overlay.classList.remove("sd-intro-active");
            }

            // ── Initialise ─────────────────────────────────────────────────
            renderHearts();
            updateBulletPanel();
            updateTeamShift(0);
            roundIdx = 0;
            loadRound(roundIdx); // also calls renderDots()
            spinRafId = requestAnimationFrame(spinTick);

            // Run the intro, then start the debate loop
            playIntro().then(() => {
                if (resolved) return;
                uiReady = true;
                playSfx("assets/sfx/minigames/minigame-start.wav");
                lastTs  = null;
                frameId = requestAnimationFrame(debateFrame);
            });
        });
    }

    return { run, destroy };
}
