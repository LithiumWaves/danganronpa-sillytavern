/**
 * Voting Screen — two-phase voting UI for the Class Trial.
 *
 * Phase 1 (Selection): Character grid + 30-second timer; player clicks a tile then "Vote".
 * Phase 2 (Tally):     Per-character vote counts animate in as red pills.
 *
 * run() resolves to { guess } — the name of the character with the most votes.
 */

const VT_ID    = 'vt-overlay';
const VT_STYLE = 'vt-style';

function esc(t) {
    return String(t ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function createTitleSide(side) {
    const wrap = document.createElement('div');
    wrap.className = `vt-title-sides vt-title-sides-${side}`;
    for (const colorClass of ['vtt-y', 'vtt-p', 'vtt-y']) {
        const strip = document.createElement('div');
        strip.className = `vt-title-vstrip ${colorClass}`;
        for (let i = 0; i < 5; i++) {
            const dot = document.createElement('span');
            dot.className = 'vt-title-vdot';
            strip.appendChild(dot);
        }
        wrap.appendChild(strip);
    }
    return wrap;
}

function createDotStrip(side, count, startIdx = 0) {
    const strip = document.createElement('div');
    strip.className = `vt-strip vt-strip-${side}`;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        dot.className = (startIdx + i) % 2 === 0 ? 'vt-dot vt-dot-y' : 'vt-dot vt-dot-p';
        strip.appendChild(dot);
    }
    return strip;
}

function buildTimerDots(timerBox, topCount = 22) {
    timerBox.querySelectorAll('.vt-strip').forEach(s => s.remove());
    const rect = timerBox.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dotSize     = 6;
    const cornerInset = 4;   // matches .vt-strip-top/.bottom left/right
    const sideInset   = 18;  // matches .vt-strip-left/.right top/bottom

    const topLen  = Math.max(0, rect.width  - 2 * cornerInset);
    const sideLen = Math.max(0, rect.height - 2 * sideInset);

    // Distance between dot centers along the top edge.
    const stride    = (topLen - dotSize) / Math.max(1, topCount - 1);
    const sideCount = Math.max(2, Math.round((sideLen - dotSize) / stride) + 1);

    let idx = 0;
    timerBox.appendChild(createDotStrip('top',    topCount,  idx)); idx += topCount;
    timerBox.appendChild(createDotStrip('right',  sideCount, idx)); idx += sideCount;
    timerBox.appendChild(createDotStrip('bottom', topCount,  idx)); idx += topCount;
    timerBox.appendChild(createDotStrip('left',   sideCount, idx));
}

function createBandsLayer(count = 6) {
    const layer = document.createElement('div');
    layer.className = 'vt-bands';
    for (let i = 0; i < count; i++) {
        const band = document.createElement('div');
        band.className = 'vt-band';
        const heightVh   = 8 + Math.random() * 18;   // 8–26vh tall
        const durationS  = 6 + Math.random() * 10;   // 6–16s
        const delayS     = -Math.random() * durationS;
        band.style.height = `${heightVh}vh`;
        band.style.top = '0';
        band.style.animationDuration = `${durationS.toFixed(2)}s`;
        band.style.animationDelay = `${delayS.toFixed(2)}s`;
        band.style.opacity = (0.55 + Math.random() * 0.45).toFixed(2);
        layer.appendChild(band);
    }
    return layer;
}

function buildCSS(extPath = '') {
    const voteBtnImg = extPath ? `/${extPath}/assets/classtrial/voting-button.png` : '';
    return `
    #${VT_ID} {
        position: fixed; inset: 0; z-index: 2147483646;
        background: #0a0a0a;
        display: flex; align-items: stretch;
        opacity: 0; transition: opacity 350ms ease;
        pointer-events: none; user-select: none;
        font-family: "Orbitron","Arial Black",sans-serif;
        overflow: hidden;
    }
    #${VT_ID}.vt-on { opacity: 1; pointer-events: auto; }

    /* Red banner line through the vote button's center */
    .vt-redline {
        position: absolute; left: 0; right: 0;
    height: 36px;
    bottom: calc(12px + clamp(96px, 12vw, 160px) / 2 - 53px);
        background: #c20000;
        box-shadow: 0 0 14px rgba(255,40,40,0.55), 0 0 2px rgba(255,80,80,0.7);
        pointer-events: none; z-index: 2;
    }

    /* CRT scroll bands */
    .vt-bands {
        position: absolute; inset: 0; overflow: hidden;
        pointer-events: none; z-index: 0;
    }
    .vt-band {
        position: absolute; left: 0; right: 0;
        background: linear-gradient(to bottom,
            transparent 0%,
            rgba(220,220,220,0.16) 25%,
            rgba(240,240,240,0.28) 50%,
            rgba(220,220,220,0.16) 75%,
            transparent 100%);
        mix-blend-mode: screen;
        will-change: transform;
        animation-name: vtBandScroll;
        animation-iteration-count: infinite;
        animation-timing-function: linear;
    }
    @keyframes vtBandScroll {
        from { transform: translateY(120vh); }
        to   { transform: translateY(-120vh); }
    }

    .vt-left {
        flex: 0 0 56%;
        position: relative;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 72px 18px 84px;
        overflow: hidden;
    }
    .vt-right {
        flex: 1; position: relative;
    }
    .vt-portrait {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        max-width: 92%; max-height: 92%;
        width: auto; height: auto;
        object-fit: contain;
        display: block; opacity: 0; transition: opacity 220ms ease;
        filter: drop-shadow(0 0 1px #ff0a0a) drop-shadow(0 0 1px #ff2222) drop-shadow(8px 0 1px #ff4444)
    }
    .vt-portrait.shown { opacity: 1; }
    .vt-portrait-grad {
        position: absolute; inset: 0;
        background: transparent;
        pointer-events: none;
    }
    .vt-name-banner {
        position: absolute; bottom: 22%; left: 0; right: 0;
        background: linear-gradient(90deg,transparent 0%,rgba(160,0,0,0) 3%,#bb0000 20%,#cc1100 100%);
        padding: 11px 24px 11px 52px;
        clip-path: polygon(34px 0,100% 0,100% 100%,0 100%);
        pointer-events: none; z-index: 3;
    }
    .vt-name-text {
        font-size: clamp(15px,1.9vw,32px); font-weight: 900;
        color: #fff; text-transform: uppercase;
        letter-spacing: 3px; font-style: italic;
        text-shadow: 2px 2px 0 rgba(0,0,0,0.45);
        display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* Title marquee banner */
    .vt-title {
        position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
        background: #000;
        border: 4px solid #c89000;
        padding: 22px 56px;
        box-shadow: 0 0 16px rgba(200,144,0,0.45), inset 0 0 8px rgba(0,0,0,0.5);
        white-space: nowrap; z-index: 6;
    }
    .vt-title-dots, .vt-title-dots-b {
        position: absolute; left: 50px; right: 50px; height: 6px;
        display: flex; justify-content: space-between; align-items: center;
        pointer-events: none; z-index: 2;
    }
    .vt-title-dots   { top: 6px; }
    .vt-title-dots-b { bottom: 6px; }
    .vt-title-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #ffe000;
        box-shadow: 0 0 3px rgba(255,220,0,0.8);
    }
    .vt-title-sides {
        position: absolute; top: 6px; bottom: 6px;
        display: flex; gap: 6px; align-items: stretch;
        pointer-events: none; z-index: 1;
    }
    .vt-title-sides-left  { left: 12px; }
    .vt-title-sides-right { right: 12px; }
    .vt-title-vstrip {
        display: flex; flex-direction: column; justify-content: space-between;
        align-items: center; width: 6px;
    }
    .vt-title-vdot {
        width: 6px; height: 6px; border-radius: 50%;
    }
    @keyframes vttColorSwap {
        0%, 49.99% { background: #ffe000; box-shadow: 0 0 4px rgba(255,220,0,0.9); }
        50%, 100%  { background: #ff3d8c; box-shadow: 0 0 4px rgba(255,60,140,0.9); }
    }
    .vtt-y .vt-title-vdot { animation: vttColorSwap 3s steps(1, end) infinite; }
    .vtt-p .vt-title-vdot { animation: vttColorSwap 3s steps(1, end) -1.5s infinite; }
    .vt-title-text {
        font-size: clamp(13px,1.7vw,26px); font-weight: 900;
        color: #00dce8; text-transform: uppercase; letter-spacing: 4px;
        text-shadow: 0 0 10px #00aaff, 0 0 22px #0055aa;
        display: block; text-align: center;
    }

    /* Character grid */
    .vt-grid {
        display: grid; grid-template-columns: repeat(4,1fr);
        gap: 22px; width: 100%; max-width: calc(100vh - 320px);
        transform: perspective(900px) rotateY(12deg) rotateX(4deg);
        transform-style: preserve-3d;
    }
    .vt-tile {
        position: relative; aspect-ratio: 1;
        border: 4px solid #b00000;
        background: #fff; cursor: pointer; overflow: hidden;
        box-shadow:
            inset 0 0 14px rgba(0,0,0,0.35),
            inset 0 0 4px rgba(0,0,0,0.25),
            0 0 0 3px #fff,
            0 8px 14px rgba(0,0,0,0.55),
            0 2px 4px rgba(0,0,0,0.4);
        transition: border-color 80ms ease, box-shadow 120ms ease;
    }
    .vt-tile:not(.vt-dead):not(.vt-missing):not(.vt-selected):hover {
        box-shadow:
            inset 0 0 14px rgba(0,0,0,0.35),
            inset 0 0 4px rgba(0,0,0,0.25),
            0 0 0 3px #fff,
            0 0 12px rgba(255,80,80,0.5),
            0 8px 14px rgba(0,0,0,0.55);
    }
    .vt-tile.vt-selected {
        border-color: #ee2222;
        box-shadow:
            inset 0 0 14px rgba(0,0,0,0.35),
            inset 0 0 4px rgba(0,0,0,0.25),
            0 0 0 6px #ee2222,
            0 0 20px 4px rgba(240,40,40,0.95),
            0 0 36px 10px rgba(240,40,40,0.55),
            0 8px 14px rgba(0,0,0,0.55);
    }
    .vt-tile.vt-dead { cursor: default; opacity: 0.55; filter: grayscale(0.65); }
    .vt-tile.vt-missing { cursor: default; opacity: 0.42; filter: grayscale(0.75); }
    .vt-tile img {
        width: 100%; height: 100%; object-fit: cover;
        object-position: top center; display: block; pointer-events: none;
    }
    .vt-tile-init {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.3em; font-weight: 900; color: #777; pointer-events: none;
    }
    .vt-tile-x { position: absolute; inset: 0; pointer-events: none; filter: saturate(10); }
    .vt-tile-x::before, .vt-tile-x::after {
        content: ''; position: absolute;
        top: 50%; left: 8%; width: 84%; height: 7%;
        background: #ff3d8c; border-radius: 3px;
        box-shadow: 0 0 8px rgba(255,50,140,0.7), 0 0 2px rgba(255,200,220,0.6);
    }
    .vt-tile-x::before { transform: translateY(-50%) rotate(45deg); }
    .vt-tile-x::after  { transform: translateY(-50%) rotate(-45deg); }

    /* Timer */
    .vt-timer-wrap {
        position: fixed; bottom: 16px; left: 0; right: 0;
        display: flex; justify-content: center; align-items: center;
        padding: 0 18px; z-index: 6; pointer-events: none;
    }
    .vt-timer-box {
        background: #000; border: 4px solid #c89000;
        box-shadow: 0 0 16px rgba(200,144,0,0.45), inset 0 0 8px rgba(0,0,0,0.5);
        padding: 14px 32px; position: relative; pointer-events: auto;
        display: inline-flex; align-items: center; justify-content: flex-start;
        text-align: left;
    }
    .vt-strip {
        position: absolute; display: flex; pointer-events: none;
    }
    .vt-strip-top    { top: 4px;    left: 4px; right: 4px;  height: 6px;  flex-direction: row;            justify-content: space-between; align-items: center; }
    .vt-strip-right  { right: 4px;  top: 18px; bottom: 18px; width: 6px; flex-direction: column;         justify-content: space-between; align-items: center; }
    .vt-strip-bottom { bottom: 4px; left: 4px; right: 4px;  height: 6px;  flex-direction: row-reverse;    justify-content: space-between; align-items: center; }
    .vt-strip-left   { left: 4px;   top: 18px; bottom: 18px; width: 6px; flex-direction: column-reverse; justify-content: space-between; align-items: center; }
    .vt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .vt-dot-y { background: #ffe000; box-shadow: 0 0 3px rgba(255,220,0,0.85); }
    .vt-dot-p { background: #ff3d8c; box-shadow: 0 0 3px rgba(255,60,140,0.85); }
    .vt-timer-val {
        font-size: clamp(20px,2.6vw,42px); font-weight: 900;
        color: #ffe000; font-variant-numeric: tabular-nums;
        font-feature-settings: "tnum" 1, "lnum" 1;
        text-shadow: 0 0 10px rgba(255,200,0,0.65);
        transition: color 200ms, text-shadow 200ms;
        display: inline-flex; text-align: left;
    }
    .vt-timer-val .vt-ch {
        display: inline-block; width: 0.7em; text-align: center;
        margin-right: 4px;
    }
    .vt-timer-val .vt-ch.vt-sep { width: 0.35em; }
    .vt-timer-val .vt-ch:last-child { margin-right: 0; }
    .vt-timer-val.vt-urgent {
        color: #ff3333; text-shadow: 0 0 12px rgba(255,0,0,0.85);
        animation: vtUrgent 0.45s ease-in-out infinite;
    }
    @keyframes vtUrgent { 0%,100%{opacity:1;}50%{opacity:0.55;} }

    /* Vote button */
    .vt-vote-btn {
        position: absolute; bottom: 10px; right: 18px;
        width: clamp(316px, 12vw, 260px); height: clamp(96px, 12vw, 160px);
        border: 0; padding: 0; background: transparent;
        background-image: url("${voteBtnImg}");
        background-size: contain; background-position: center; background-repeat: no-repeat;
        cursor: pointer;
        font-size: 0; color: transparent;
        transition: transform 80ms ease, filter 80ms ease, opacity 150ms ease;
        z-index: 5;
        filter: drop-shadow(0 0 10px rgba(255, 55, 0, 0.45));
    }
    .vt-vote-btn:not(:disabled):hover {
        transform: scale(1.07);
        filter: drop-shadow(0 0 18px rgba(255,55,0,0.85));
    }
    .vt-vote-btn:not(:disabled):active { transform: scale(0.93); }
    .vt-vote-btn:disabled { opacity: 0.32; cursor: not-allowed; }

    /* Tally grid */
    .vt-tally {
        border: 2px solid #969696;
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 10px;
        row-gap: 5px;
        width: 100%;
        background: black;
        padding: 2em;
        border-radius: 0.5em;
        transform: perspective(900px) rotateY(12deg) rotateX(4deg);
        transform-style: preserve-3d;
    }
    .vt-trow {
        display: flex; align-items: center; gap: 6px;
        padding: 2px 4px; border-radius: 2px;
    }
    .vt-tthumb {
        flex-shrink: 0;
        width: clamp(38px,4.5vw,56px); height: clamp(38px,4.5vw,56px);
        border: 2px solid rgba(255,255,255,0.22); background: #111; overflow: hidden;
        transition: border-color 200ms, box-shadow 200ms;
    }
    .vt-trow.vt-winner .vt-tthumb {
        border-color: #ffe000; box-shadow: 0 0 8px rgba(255,200,0,0.5);
    }
    .vt-tthumb img {
        width: 100%; height: 100%;
        object-fit: cover; object-position: top center; display: block;
    }
    .vt-tthumb-init {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.75em; font-weight: 900; color: #666;
    }
    .vt-tinfo { flex: 1; min-width: 0; }
    .vt-tname {
        font-size: clamp(5.5px,0.72vw,10px); font-weight: 700;
        color: #b08020; text-transform: uppercase; letter-spacing: 0.8px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin-bottom: 3px;
    }
    .vt-trow.vt-winner .vt-tname { color: #ffe000; }
    .vt-tpills { display: flex; flex-wrap: wrap; gap: 3px; min-height: 16px; }
    .vt-pill {
        width: 11px; height: 18px;
        background: linear-gradient(180deg,#ff5533,#bb1100);
        border-radius: 5px;
        box-shadow: 0 0 4px rgba(255,40,20,0.5), inset 0 1px 2px rgba(255,160,130,0.3);
        opacity: 0; transform: scaleY(0); transform-origin: bottom;
        transition: opacity 150ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .vt-pill.shown { opacity: 1; transform: scaleY(1); }

    /* Dismiss hint */
    .vt-hint {
        position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
        font-size: clamp(8px,0.8vw,11px); letter-spacing: 2px;
        color: rgba(255,255,255,0.35); white-space: nowrap;
        animation: vtHint 1.8s ease-in-out infinite;
        font-family: "Orbitron",sans-serif; z-index: 5;
    }
    @keyframes vtHint { 0%,100%{opacity:.35;}50%{opacity:.75;} }

    /* Vote-tallying loading screen */
    #vt-loading {
        position: fixed; inset: 0; z-index: 2147483645;
        background: #080505;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 22px;
        font-family: "Orbitron","Arial Black",sans-serif;
        opacity: 0; transition: opacity 220ms ease;
    }
    .vt-load-title {
        color: #ffe000; font-size: clamp(16px,2.2vw,34px); font-weight: 900;
        letter-spacing: 5px; text-transform: uppercase;
        text-shadow: 0 0 18px rgba(255,200,0,0.65), 0 0 40px rgba(255,130,0,0.3);
    }
    .vt-load-dots { display: flex; gap: 12px; }
    .vt-load-dot {
        width: 11px; height: 11px; border-radius: 50%; background: #cc1100;
        animation: vtLoadDot 1.1s ease-in-out infinite;
    }
    .vt-load-dot:nth-child(2) { animation-delay: 0.18s; }
    .vt-load-dot:nth-child(3) { animation-delay: 0.36s; }
    .vt-load-dot:nth-child(4) { animation-delay: 0.54s; }
    @keyframes vtLoadDot {
        0%,100% { transform: scale(1);   opacity: 0.35; background: #cc1100; }
        50%      { transform: scale(1.6); opacity: 1;    background: #ff4444; box-shadow: 0 0 8px #ff2200; }
    }
    .vt-load-sub {
        color: rgba(255,255,255,0.32); font-size: clamp(8px,0.9vw,12px);
        letter-spacing: 3px; text-transform: uppercase;
    }
    .vt-load-error-title {
        color: #ff4444;
        text-shadow: 0 0 18px rgba(255,50,50,0.65), 0 0 40px rgba(200,0,0,0.3);
    }
    `;
}

export function createVotingScreenController({
    extensionFolderPath = '',
    getCharacters       = null,
    getSpriteUrl        = null,
    getUserAvatarUrl    = null,
    getPlayerName       = null,
    generateVotes       = null,
} = {}) {
    const TIMER_MS = 30_000;

    function destroy() {
        document.getElementById(VT_ID)?.remove();
        document.getElementById(VT_STYLE)?.remove();
    }

    async function run() {
        const allRaw   = [...(getCharacters?.() ?? [])];
        const allChars = allRaw; // include missing characters in the grid
        if (allChars.length === 0) return { guess: null };

        const living = allChars.filter(c => !c.dead && !c.missing);

        // Pre-load sprites — tile uses 'neutral', portrait uses 'argumentarmament'
        const imageUrls = await Promise.all(allChars.map(async c => {
            try {
                const tilePromise     = getSpriteUrl?.(c.name, 'neutral').catch(() => null) ?? Promise.resolve(null);
                const portraitPromise = getSpriteUrl?.(c.name, 'argumentarmament').catch(() => null) ?? Promise.resolve(null);
                let [tile, portrait] = await Promise.all([tilePromise, portraitPromise]);
                if (c.isPlayer) {
                    const userAvatar = getUserAvatarUrl?.() ?? null;
                    tile     = tile     || userAvatar;
                    portrait = portrait || userAvatar;
                }
                return { tile, portrait };
            } catch { return { tile: null, portrait: null }; }
        }));

        const chars = allChars.map((c, i) => ({ ...c, imgUrl: imageUrls[i].tile, portraitUrl: imageUrls[i].portrait }));

        // Begin NPC vote generation concurrently while player is in the selection screen
        // Only living, present characters are valid vote targets
        const livingNames  = chars.filter(c => !c.dead && !c.missing).map(c => c.name);
        const playerName   = getPlayerName?.() ?? null;
        let npcVoteResolved = false;
        const npcVotePromise = (generateVotes && livingNames.length > 0)
            ? generateVotes(livingNames, playerName).catch(() => ({})).then(r => { npcVoteResolved = true; return r; })
            : Promise.resolve({}).then(r => { npcVoteResolved = true; return r; });

        destroy();

        const styleEl = document.createElement('style');
        styleEl.id = VT_STYLE;
        styleEl.textContent = buildCSS(extensionFolderPath);
        document.head.appendChild(styleEl);

        // ── Phase 1: player selects ────────────────────────────────────────────
        const playerVote = await runSelectionPhase(chars);

        // ── Loading screen while NPC votes come in ─────────────────────────────
        let loadingEl = null;
        if (!npcVoteResolved) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'vt-loading';
            loadingEl.innerHTML = `
                <div class="vt-load-title">Tallying Votes</div>
                <div class="vt-load-dots">
                    <div class="vt-load-dot"></div>
                    <div class="vt-load-dot"></div>
                    <div class="vt-load-dot"></div>
                    <div class="vt-load-dot"></div>
                </div>
                <div class="vt-load-sub">Waiting for other students…</div>`;
            document.body.appendChild(loadingEl);
            requestAnimationFrame(() => requestAnimationFrame(() => loadingEl.style.opacity = '1'));
        }

        // ── Combine votes ──────────────────────────────────────────────────────
        const npcVotes = await npcVotePromise;

        if (loadingEl) {
            loadingEl.style.opacity = '0';
            await new Promise(r => setTimeout(r, 230));
            loadingEl.remove();
        }
        const votes    = Object.assign({}, npcVotes);
        if (playerVote) votes[playerVote] = (votes[playerVote] || 0) + 1;

        const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
        if (totalVotes <= 1) {
            await showVoteErrorScreen();
            destroy();
            return { guess: null, votes: {}, error: true };
        }

        // Winner = most votes; fallback to first living, present char
        let guess    = chars.find(c => !c.dead && !c.missing)?.name ?? null;
        let maxCount = 0;
        for (const [name, cnt] of Object.entries(votes)) {
            if (cnt > maxCount) { maxCount = cnt; guess = name; }
        }

        // ── Phase 2: tally reveal ──────────────────────────────────────────────
        await runTallyPhase(chars, votes, guess);

        return { guess, votes };
    }

    function showVoteErrorScreen() {
        return new Promise(resolve => {
            const el = document.createElement('div');
            el.id = 'vt-loading';
            el.style.cursor = 'pointer';
            el.innerHTML = `
                <div class="vt-load-title vt-load-error-title">Vote Generation Failed</div>
                <div class="vt-load-dots">
                    <div class="vt-load-dot"></div>
                    <div class="vt-load-dot"></div>
                    <div class="vt-load-dot"></div>
                    <div class="vt-load-dot"></div>
                </div>
                <div class="vt-load-sub">Not enough votes were received — please try again.</div>
                <div class="vt-load-sub" style="margin-top:8px;opacity:0.55">Click anywhere to dismiss</div>`;
            document.body.appendChild(el);
            requestAnimationFrame(() => requestAnimationFrame(() => el.style.opacity = '1'));
            el.addEventListener('click', () => {
                el.style.opacity = '0';
                setTimeout(() => { el.remove(); resolve(); }, 230);
            }, { once: true });
        });
    }

    // ── Selection phase ──────────────────────────────────────────────────────────

    function runSelectionPhase(chars) {
        return new Promise(resolve => {
            const living  = chars.filter(c => !c.dead && !c.missing);
            let selected  = living[0]?.name ?? null;
            let settled   = false;
            let rafId     = null;
            let remaining = TIMER_MS;
            let lastTs    = null;

            const overlay = document.createElement('div');
            overlay.id = VT_ID;
            overlay.appendChild(createBandsLayer(6));
            const redLine = document.createElement('div');
            redLine.className = 'vt-redline';
            overlay.appendChild(redLine);

            // ── Left panel ──────────────────────────────────────────────────────
            const leftEl = document.createElement('div');
            leftEl.className = 'vt-left';

            const NDOTS   = 20;
            const dotsHtml = Array.from({ length: NDOTS }, () => '<span class="vt-title-dot"></span>').join('');
            const titleEl = document.createElement('div');
            titleEl.className = 'vt-title';
            titleEl.innerHTML = `
                <div class="vt-title-dots">${dotsHtml}</div>
                <span class="vt-title-text">Voting Time</span>
                <div class="vt-title-dots-b">${dotsHtml}</div>`;
            titleEl.appendChild(createTitleSide('left'));
            titleEl.appendChild(createTitleSide('right'));
            leftEl.appendChild(titleEl);

            const gridEl = document.createElement('div');
            gridEl.className = 'vt-grid';

            chars.forEach(char => {
                const tile = document.createElement('div');
                tile.className = 'vt-tile' + (char.dead ? ' vt-dead' : '') + (char.missing ? ' vt-missing' : '');
                tile.dataset.name = char.name;
                if (char.name === selected) tile.classList.add('vt-selected');

                if (char.imgUrl) {
                    const img = document.createElement('img');
                    img.src = char.imgUrl; img.alt = char.name;
                    tile.appendChild(img);
                } else {
                    const init = document.createElement('div');
                    init.className = 'vt-tile-init';
                    init.textContent = char.name.slice(0, 2).toUpperCase();
                    tile.appendChild(init);
                }

                if (char.dead) {
                    const xEl = document.createElement('div');
                    xEl.className = 'vt-tile-x';
                    tile.appendChild(xEl);
                } else if (!char.missing) {
                    tile.addEventListener('click', () => {
                        gridEl.querySelector('.vt-selected')?.classList.remove('vt-selected');
                        tile.classList.add('vt-selected');
                        selected = char.name;
                        updateRight(char);
                        voteBtnEl.disabled = false;
                    });
                }

                gridEl.appendChild(tile);
            });
            leftEl.appendChild(gridEl);

            // Timer
            const timerWrap = document.createElement('div');
            timerWrap.className = 'vt-timer-wrap';
            const timerBox = document.createElement('div');
            timerBox.className = 'vt-timer-box';
            const timerVal = document.createElement('span');
            timerVal.className = 'vt-timer-val';
            timerVal.textContent = '00:30';
            timerBox.appendChild(timerVal);
            timerWrap.appendChild(timerBox);
            leftEl.appendChild(timerWrap);

            overlay.appendChild(leftEl);

            // ── Right panel ──────────────────────────────────────────────────────
            const rightEl  = document.createElement('div');
            rightEl.className = 'vt-right';

            const portEl = document.createElement('img');
            portEl.className = 'vt-portrait'; portEl.alt = '';
            rightEl.appendChild(portEl);

            rightEl.appendChild(Object.assign(document.createElement('div'), { className: 'vt-portrait-grad' }));

            const bannerEl = document.createElement('div');
            bannerEl.className = 'vt-name-banner';
            bannerEl.innerHTML = '<span class="vt-name-text"></span>';
            rightEl.appendChild(bannerEl);
            const nameTextEl = bannerEl.querySelector('.vt-name-text');

            // Vote button lives in the right panel
            const voteBtnEl = document.createElement('button');
            voteBtnEl.className = 'vt-vote-btn';
            voteBtnEl.disabled = !selected;
            voteBtnEl.textContent = 'VOTE';
            rightEl.appendChild(voteBtnEl);

            overlay.appendChild(rightEl);

            // ── Helpers ─────────────────────────────────────────────────────────
            function updateRight(char) {
                if (!char) return;
                nameTextEl.textContent = char.name.toUpperCase();
                const portSrc = char.portraitUrl || char.imgUrl;
                if (portSrc) {
                    portEl.style.transition = 'none';
                    portEl.style.opacity    = '0';
                    portEl.src = portSrc;
                    requestAnimationFrame(() => {
                        portEl.style.transition = 'opacity 200ms ease';
                        portEl.style.opacity    = '1';
                        portEl.classList.add('shown');
                    });
                } else {
                    portEl.classList.remove('shown');
                }
            }

            const defaultChar = chars.find(c => c.name === selected);
            if (defaultChar) updateRight(defaultChar);

            function settle(choice) {
                if (settled) return;
                settled = true;
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
                overlay.style.transition = 'opacity 250ms ease';
                overlay.style.opacity    = '0';
                setTimeout(() => { overlay.remove(); resolve(choice); }, 260);
            }

            function timerTick(ts) {
                if (settled) return;
                const dt = lastTs != null ? Math.min(ts - lastTs, 100) : 0;
                lastTs   = ts;
                remaining -= dt;
                if (remaining <= 0) {
                    updateTimerDisplay(0);
                    settle(selected || (living[0]?.name ?? null));
                    return;
                }
                updateTimerDisplay(remaining);
                rafId = requestAnimationFrame(timerTick);
            }

            function updateTimerDisplay(ms) {
                const total = Math.max(0, ms);
                const mins  = Math.min(99, Math.floor(total / 60000));
                const secs  = Math.floor((total % 60000) / 1000);
                const msec  = Math.floor(total % 1000);
                const str = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}:${String(msec).padStart(3,'0')}`;
                const spans = timerVal.children;
                if (spans.length !== str.length) {
                    timerVal.textContent = '';
                    for (const ch of str) {
                        const s = document.createElement('span');
                        s.className = ch === ':' ? 'vt-ch vt-sep' : 'vt-ch';
                        s.textContent = ch;
                        timerVal.appendChild(s);
                    }
                } else {
                    for (let i = 0; i < str.length; i++) {
                        if (spans[i].textContent !== str[i]) spans[i].textContent = str[i];
                    }
                }
                timerVal.classList.toggle('vt-urgent', total < 10_000);
            }

            voteBtnEl.addEventListener('click', () => settle(selected));

            document.body.appendChild(overlay);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                overlay.classList.add('vt-on');
                buildTimerDots(timerBox, 22);
            }));
            rafId = requestAnimationFrame(timerTick);
        });
    }

    // ── Tally phase ──────────────────────────────────────────────────────────────

    function runTallyPhase(chars, votes, guess) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.id = VT_ID;
            overlay.appendChild(createBandsLayer(6));
            const redLine = document.createElement('div');
            redLine.className = 'vt-redline';
            overlay.appendChild(redLine);

            // ── Left panel (tally) ───────────────────────────────────────────────
            const leftEl = document.createElement('div');
            leftEl.className = 'vt-left';

            const NDOTS   = 20;
            const dotsHtml = Array.from({ length: NDOTS }, () => '<span class="vt-title-dot"></span>').join('');
            const titleEl = document.createElement('div');
            titleEl.className = 'vt-title';
            titleEl.innerHTML = `
                <div class="vt-title-dots">${dotsHtml}</div>
                <span class="vt-title-text">Voting Time</span>
                <div class="vt-title-dots-b">${dotsHtml}</div>`;
            titleEl.appendChild(createTitleSide('left'));
            titleEl.appendChild(createTitleSide('right'));
            leftEl.appendChild(titleEl);

            const tallyEl = document.createElement('div');
            tallyEl.className = 'vt-tally';

            const rowMap = new Map(); // name → pillsEl
            chars.forEach(char => {
                const rowEl = document.createElement('div');
                rowEl.className = 'vt-trow' + (char.name === guess ? ' vt-winner' : '');

                const thumbEl = document.createElement('div');
                thumbEl.className = 'vt-tthumb';
                if (char.imgUrl) {
                    const img = document.createElement('img');
                    img.src = char.imgUrl; img.alt = char.name;
                    thumbEl.appendChild(img);
                } else {
                    const init = document.createElement('div');
                    init.className = 'vt-tthumb-init';
                    init.textContent = char.name.slice(0, 2).toUpperCase();
                    thumbEl.appendChild(init);
                }
                rowEl.appendChild(thumbEl);

                const infoEl  = document.createElement('div');
                infoEl.className = 'vt-tinfo';
                const nameEl  = document.createElement('div');
                nameEl.className = 'vt-tname';
                nameEl.textContent = char.name.toUpperCase();
                const pillsEl = document.createElement('div');
                pillsEl.className = 'vt-tpills';
                infoEl.appendChild(nameEl);
                infoEl.appendChild(pillsEl);
                rowEl.appendChild(infoEl);

                tallyEl.appendChild(rowEl);
                rowMap.set(char.name, pillsEl);
            });

            leftEl.appendChild(tallyEl);
            overlay.appendChild(leftEl);

            // ── Right panel (winner portrait) ───────────────────────────────────
            const rightEl = document.createElement('div');
            rightEl.className = 'vt-right';

            const winnerChar = chars.find(c => c.name === guess);

            const portEl = document.createElement('img');
            portEl.className = 'vt-portrait'; portEl.alt = '';
            const winnerPort = winnerChar?.portraitUrl || winnerChar?.imgUrl;
            if (winnerPort) { portEl.src = winnerPort; portEl.classList.add('shown'); }
            rightEl.appendChild(portEl);

            rightEl.appendChild(Object.assign(document.createElement('div'), { className: 'vt-portrait-grad' }));

            const bannerEl = document.createElement('div');
            bannerEl.className = 'vt-name-banner';
            bannerEl.innerHTML = `<span class="vt-name-text">${esc(winnerChar?.name?.toUpperCase() ?? '')}</span>`;
            rightEl.appendChild(bannerEl);

            overlay.appendChild(rightEl);
            document.body.appendChild(overlay);
            requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('vt-on')));

            // ── Animate pills ────────────────────────────────────────────────────
            let delay = 600;
            chars.forEach(char => {
                const count = votes[char.name] || 0;
                if (count <= 0) return;
                const pillsEl = rowMap.get(char.name);
                if (!pillsEl) return;
                for (let i = 0; i < count; i++) {
                    const pill = document.createElement('div');
                    pill.className = 'vt-pill';
                    pillsEl.appendChild(pill);
                    const d = delay + i * 160;
                    setTimeout(() => pill.classList.add('shown'), d);
                }
                delay += count * 160 + 220;
            });

            // Show dismiss hint + enable click after animation finishes
            setTimeout(() => {
                const hintEl = document.createElement('div');
                hintEl.className = 'vt-hint';
                hintEl.textContent = 'CLICK ANYWHERE TO CONTINUE';
                overlay.appendChild(hintEl);
                overlay.style.cursor = 'pointer';
                overlay.addEventListener('click', () => {
                    overlay.style.transition = 'opacity 300ms ease';
                    overlay.style.opacity    = '0';
                    setTimeout(() => { overlay.remove(); resolve(); }, 310);
                }, { once: true });
            }, delay + 400);
        });
    }

    return { run, destroy };
}
