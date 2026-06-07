/**
 * Mind Mine — block-clearing puzzle minigame.
 *
 * A grid of Silver / Gold / Pink blocks.  Clicking a block flood-fills its
 * connected same-colour group, breaks every block in that group, then
 * converts all adjacent (N/S/E/W) non-group blocks to the next colour tier
 * (Silver → Gold → Pink → Silver).  Clicking a completely isolated block
 * (one block, no neighbours at all) penalises the player with −10 s.
 *
 * Beneath the grid sit sentence panels.  Each panel is covered by a band of
 * grid cells; when every cell in that band has been broken the sentence is
 * revealed and becomes clickable.  Clicking it shows a "GOT IT!" banner and
 * calls onWin(sentence).
 */

import { attachCursorSway } from "./cursorSway.js";

export function createMindMineController({
    extensionFolderPath = '',
    onWin              = null,   // (sentenceText: string) => void
    pauseCurrentBgm    = null,
    resumeCurrentBgm   = null,
    playBgm            = null,   // () => void — starts the minigame BGM track
    onStart            = null,   // () => void — called when minigame begins
    onEnd              = null,   // () => void — called when minigame ends/cleans up
    getPlayerSpriteUrl = null,   // (expression: string) => Promise<string> — for Got It banner sprite
} = {}) {

    /* ── grid constants ──────────────────────────────────────────────── */
    const COLS    = 18;
    const ROWS    = 11;
    const EMPTY   = -1;
    const NCOLORS = 3;   // 0 = silver   1 = gold   2 = pink
    const GAP     = 3;   // px between blocks

    // Block size is computed dynamically from the viewport at run() time.
    // HEADER_H: header element + its bottom margin.
    // PANEL_CHROME: panel 2×10px padding + 2×2px border.
    const HEADER_H    = 62;
    const PANEL_CHROME = 24;

    function computeLayout() {
        const targetW = window.innerWidth  * 0.85;
        const targetH = window.innerHeight * 0.85;
        const availW  = targetW - PANEL_CHROME;
        const availH  = targetH - HEADER_H - PANEL_CHROME;
        const bFromW  = (availW - (COLS - 1) * GAP) / COLS;
        const bFromH  = (availH - (ROWS - 1) * GAP) / ROWS;
        const block   = Math.max(18, Math.floor(Math.min(bFromW, bFromH)));
        const gridW   = COLS * block + (COLS - 1) * GAP;
        const gridH   = ROWS * block + (ROWS - 1) * GAP;
        const panelW  = gridW + PANEL_CHROME;
        return { block, gridW, gridH, panelW };
    }

    /* Scatter sentences at random positions/angles within the grid area.
       Each layout's AABB is rejection-sampled against previously placed
       layouts so the three sentences don't visually overlap.  If no fully
       non-overlapping placement is found after MAX_TRIES, we keep the
       candidate that minimised total overlap area (so we never deadlock).
       Coverage = cells whose centres fall beneath the text's footprint. */
    function buildSentenceLayouts(count, block, gridW, gridH) {
        const cellW    = block + GAP;
        const margin   = block; // visual breathing room between layouts
        const MAX_TRIES = 120;
        const layouts  = [];

        const maxTextW = Math.round(gridW / 2);

        const aabbOverlap = (a, b) => {
            const dx = Math.abs(a.x - b.x) - (a.halfW + b.halfW + margin);
            const dy = Math.abs(a.y - b.y) - (a.halfH + b.halfH + margin);
            if (dx >= 0 || dy >= 0) return 0;
            return (-dx) * (-dy);
        };

        const edgePad = 6;

        for (let s = 0; s < count; s++) {
            const rawTextW = Math.max(60, (sentences[s]?.length ?? 20) * 6.5);
            const textW    = Math.min(maxTextW, rawTextW);
            const lines    = Math.ceil(rawTextW / maxTextW);
            const textH    = Math.max(14, lines * 16);

            let best = null;
            let bestOverlap = Infinity;
            for (let t = 0; t < MAX_TRIES; t++) {
                // Pick angle first so the rotated AABB half-extents are known
                // before constraining the centre — without this the centre
                // gets clamped only to a constant block-multiple margin, and
                // the (often much wider) rotated text can spill past the grid.
                const angle  = (Math.random() - 0.5) * 40; // −20° … +20°
                const rad    = Math.abs(angle) * Math.PI / 180;
                const halfW  = (textW / 2) * Math.cos(rad) + (textH / 2) * Math.sin(rad);
                const halfH  = (textW / 2) * Math.sin(rad) + (textH / 2) * Math.cos(rad);
                const minX   = halfW + edgePad;
                const maxX   = gridW - halfW - edgePad;
                const minY   = halfH + edgePad;
                const maxY   = gridH - halfH - edgePad;
                const x = minX <= maxX ? minX + Math.random() * (maxX - minX) : gridW / 2;
                const y = minY <= maxY ? minY + Math.random() * (maxY - minY) : gridH / 2;
                const cand   = { x, y, angle, halfW, halfH };
                let overlap = 0;
                for (const prev of layouts) {
                    overlap += aabbOverlap(cand, prev);
                    if (overlap >= bestOverlap) break;
                }
                if (overlap < bestOverlap) {
                    best = cand;
                    bestOverlap = overlap;
                    if (overlap === 0) break;
                }
            }

            const { x, y, angle, halfW, halfH } = best;
            const colMin  = Math.max(0,        Math.floor((x - halfW) / cellW));
            const colMax  = Math.min(COLS - 1, Math.floor((x + halfW) / cellW));
            const rowMin  = Math.max(0,        Math.floor((y - halfH) / cellW));
            const rowMax  = Math.min(ROWS - 1, Math.floor((y + halfH) / cellW));
            // Coverage: every grid cell whose square hitbox actually
            // overlaps the rotated text rectangle (SAT test). A
            // centre-only test missed cells that the text clipped a
            // corner of, letting sentences register as revealed while
            // blocks still sat on top of them.
            const rad  = angle * Math.PI / 180;
            const cosA = Math.cos(rad);
            const sinA = Math.sin(rad);
            const halfTW = textW / 2;
            const halfTH = textH / 2;
            const textCorners = [
                [-halfTW, -halfTH], [halfTW, -halfTH],
                [ halfTW,  halfTH], [-halfTW,  halfTH],
            ].map(([lx, ly]) => [
                x + lx * cosA - ly * sinA,
                y + lx * sinA + ly * cosA,
            ]);
            const axes = [[1, 0], [0, 1], [cosA, sinA], [-sinA, cosA]];
            const projectRange = (corners, ax, ay) => {
                let min = Infinity, max = -Infinity;
                for (const [px, py] of corners) {
                    const p = px * ax + py * ay;
                    if (p < min) min = p;
                    if (p > max) max = p;
                }
                return [min, max];
            };
            const overlapsText = (cellCorners) => {
                for (const [ax, ay] of axes) {
                    const [cMin, cMax] = projectRange(cellCorners, ax, ay);
                    const [tMin, tMax] = projectRange(textCorners, ax, ay);
                    if (cMax < tMin || tMax < cMin) return false;
                }
                return true;
            };
            const coverage = [];
            for (let r = rowMin; r <= rowMax; r++) {
                for (let c = colMin; c <= colMax; c++) {
                    const cx = c * cellW + block / 2;
                    const cy = r * cellW + block / 2;
                    const h  = block / 2;
                    const cellCorners = [
                        [cx - h, cy - h], [cx + h, cy - h],
                        [cx + h, cy + h], [cx - h, cy + h],
                    ];
                    if (overlapsText(cellCorners)) coverage.push(flatIdx(r, c));
                }
            }
            layouts.push({ x, y, angle, halfW, halfH, coverage });
        }
        return layouts;
    }

    /* ── mutable state ───────────────────────────────────────────────── */
    let grid          = [];
    let cellEls       = [];
    let overlay       = null;
    let styleEl       = null;
    let swayDetach    = null;
    let timerEl       = null;
    let timerInterval  = null;
    let timerLastWall  = null;
    let timeRemaining  = 120000;
    let sentences     = [];
    let sentenceState   = [];   // 'hidden' | 'revealed' | 'collected'
    let sentenceEls     = [];
    let sentenceLayouts = [];   // [{ x, y, angle, coverage: number[] }]
    let isRunning     = false;

    /* ── grid utilities ──────────────────────────────────────────────── */
    const flatIdx    = (r, c) => r * COLS + c;
    const toCoords   = i      => [Math.floor(i / COLS), i % COLS];
    const nextColor  = col    => (col + 1) % NCOLORS;

    function getNeighbors(i) {
        const [r, c] = toCoords(i);
        const ns = [];
        if (r > 0)        ns.push(flatIdx(r - 1, c));
        if (r < ROWS - 1) ns.push(flatIdx(r + 1, c));
        if (c > 0)        ns.push(flatIdx(r, c - 1));
        if (c < COLS - 1) ns.push(flatIdx(r, c + 1));
        return ns;
    }

    function floodFill(startI) {
        const color   = grid[startI];
        const visited = new Set([startI]);
        const queue   = [startI];
        while (queue.length) {
            const cur = queue.shift();
            for (const nb of getNeighbors(cur)) {
                if (!visited.has(nb) && grid[nb] === color) {
                    visited.add(nb);
                    queue.push(nb);
                }
            }
        }
        return visited;
    }

    /* ── grid initialisation ─────────────────────────────────────────── */
    function initGrid() {
        grid = Array.from({ length: ROWS * COLS }, () =>
            Math.floor(Math.random() * NCOLORS));
    }

    /* ── click handler ───────────────────────────────────────────────── */
    function handleCellClick(i) {
        if (!isRunning || grid[i] === EMPTY) return;

        const color = grid[i];
        const group = floodFill(i);

        // Collect all adjacent non-group non-empty cells.
        const toConvert = new Set();
        for (const g of group) {
            for (const nb of getNeighbors(g)) {
                if (!group.has(nb) && grid[nb] !== EMPTY)
                    toConvert.add(nb);
            }
        }

        // Single block with no same-colour neighbours: penalty, but still breaks.
        const isPenalty = group.size === 1;
        if (isPenalty) {
            applyDamage(i);
            if (!isRunning) return; // time hit zero
        }

        // One SFX per click event regardless of how many blocks are in the
        // chain — penalty cue wins when it's the lone-block case.
        if (extensionFolderPath) {
            const sfxFile = isPenalty ? 'mindmine-block-penalty.wav' : 'mindmine-block-break.wav';
            new Audio(`/${extensionFolderPath}/assets/sfx/minigames/${sfxFile}`)
                .play().catch(() => {});
        }

        // Break the group.
        for (const g of group) {
            grid[g] = EMPTY;
            animBreak(g);
        }

        // Convert neighbours to next tier.
        const nc = nextColor(color);
        for (const c of toConvert) {
            grid[c] = nc;
            animConvert(c);
        }

        renderGrid();
        checkSentences();
    }

    /* ── damage ──────────────────────────────────────────────────────── */
    function applyDamage(cellI) {
        timeRemaining = Math.max(0, timeRemaining - 10000);
        updateTimerEl();
        overlay?.classList.add('mm-damage');
        setTimeout(() => overlay?.classList.remove('mm-damage'), 500);
        const el = cellEls[cellI];
        if (el) {
            el.classList.add('mm-shake');
            setTimeout(() => el?.classList.remove('mm-shake'), 420);

            const rect = el.getBoundingClientRect();
            const label = document.createElement('div');
            label.className = 'mm-penalty-label';
            label.textContent = '-10 sec!';
            label.style.left = `${rect.left + rect.width / 2}px`;
            label.style.top  = `${rect.top}px`;
            overlay.appendChild(label);
            setTimeout(() => label.remove(), 1000);
        }
        if (timeRemaining <= 0) endGame(false);
    }

    /* ── animations ──────────────────────────────────────────────────── */
    function animBreak(i) {
        const el = cellEls[i];
        if (!el) return;
        el.classList.add('mm-anim-break');
        setTimeout(() => el?.classList.remove('mm-anim-break'), 320);
    }

    function animConvert(i) {
        const el = cellEls[i];
        if (!el) return;
        el.classList.add('mm-anim-convert');
        setTimeout(() => el?.classList.remove('mm-anim-convert'), 420);
    }

    /* ── render ──────────────────────────────────────────────────────── */
    function renderGrid() {
        for (let i = 0; i < grid.length; i++) {
            const el = cellEls[i];
            if (!el) continue;
            if (grid[i] === EMPTY) {
                el.dataset.color = 'empty';
                el.classList.add('mm-empty');
            } else {
                el.dataset.color = String(grid[i]);
                el.classList.remove('mm-empty');
            }
        }
    }

    /* ── sentence reveal / collect ───────────────────────────────────── */
    function checkSentences() {
        for (let s = 0; s < sentences.length; s++) {
            if (sentenceState[s] !== 'hidden') continue;
            const cov = sentenceLayouts[s]?.coverage ?? [];
            if (cov.length > 0 && cov.every(ci => grid[ci] === EMPTY)) {
                sentenceState[s] = 'revealed';
                revealSentence(s);
            }
        }
        if (sentences.length && sentenceState.every(st => st === 'collected'))
            endGame(true);
    }

    function revealSentence(s) {
        const el = sentenceEls[s];
        if (!el) return;
        el.classList.remove('mm-sentence-locked');
        el.classList.add('mm-sentence-revealed');
        el.style.pointerEvents = 'auto';
        el.addEventListener('click', () => collectSentence(s), { once: true });
    }

    function collectSentence(s) {
        if (sentenceState[s] !== 'revealed') return;
        sentenceState[s] = 'collected';
        sentenceEls[s]?.classList.add('mm-sentence-collected');
        sentenceEls[s]?.classList.remove('mm-sentence-revealed');
        showGotIt();
        onWin?.(sentences[s]);
        endGame(true);
    }

    async function showGotIt() {
        const imgUrl = extensionFolderPath
            ? `/${extensionFolderPath}/assets/images/minigames/got-it-banner.png`
            : 'assets/images/minigames/got-it-banner.png';

        // Same "Got It!" cue Question Time uses on a correct answer.
        if (extensionFolderPath) {
            new Audio(`/${extensionFolderPath}/assets/monokuma/question-answered-correctly.wav`)
                .play().catch(() => {});
        }

        // Mounted on <body> (not the overlay) so it persists past cleanup.
        const prefill = document.createElement('div');
        prefill.className = 'mm-banner-prefill';
        document.body.appendChild(prefill);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        prefill.style.transform = 'scaleX(1)';
        await new Promise(r => setTimeout(r, 55));

        const banner = document.createElement('div');
        banner.className = 'mm-banner';
        banner.innerHTML = `<div class="mm-banner-inner"><img class="mm-banner-img" src="${imgUrl}" alt="Got It"/></div>`;
        document.body.appendChild(banner);
        const inner = banner.querySelector('.mm-banner-inner');

        // Player approval sprite overlay (matches Question Time placement).
        if (typeof getPlayerSpriteUrl === 'function') {
            const spriteUrl = await getPlayerSpriteUrl('approval');
            if (spriteUrl) {
                const spriteEl = document.createElement('img');
                spriteEl.src = spriteUrl;
                spriteEl.alt = '';
                spriteEl.style.cssText = 'position:absolute;bottom:-1475px;left:70%;transform:translateX(-50%);height:650%;width:auto;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(rgb(255,255,255) 0px 0px 50px);';
                inner.appendChild(spriteEl);
            }
        }

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        inner.style.left = '0%';

        await new Promise(r => setTimeout(r, 350 + 1400)); // slide-in + linger
        banner.style.opacity = '0';
        prefill.style.opacity = '0';
        setTimeout(() => { banner.remove(); prefill.remove(); }, 520);
    }

    /* ── timer ───────────────────────────────────────────────────────── */
    function startTimer() {
        timerLastWall = null;
        updateTimerEl();
        function tick(now) {
            if (!isRunning) return;
            if (timerLastWall !== null) {
                timeRemaining = Math.max(0, timeRemaining - (now - timerLastWall));
            }
            timerLastWall = now;
            updateTimerEl();
            if (timeRemaining <= 0) {
                endGame(false);
                return;
            }
            timerInterval = requestAnimationFrame(tick);
        }
        timerInterval = requestAnimationFrame(tick);
    }

    function updateTimerEl() {
        if (!timerEl) return;
        const ms      = Math.max(0, timeRemaining);
        const mins    = Math.floor(ms / 60000);
        const secs    = Math.floor((ms % 60000) / 1000);
        const millis  = Math.floor(ms % 1000);
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
        timerEl.classList.toggle('mm-timer-low', timeRemaining <= 10000);
    }

    /* ── end game / cleanup ──────────────────────────────────────────── */
    function endGame(win) {
        if (!isRunning) return;
        isRunning = false;
        cancelAnimationFrame(timerInterval);
        timerInterval = null;
        if (!win) playTimeUpDamage();
        setTimeout(cleanup, win ? 2000 : 600);
    }

    /* Red full-screen flash + body shake + Monokuma "incorrect" cue — same
     * pattern Question Time uses when the player loses a heart. Fired when
     * the Mind Mine countdown hits zero. */
    function playTimeUpDamage() {
        if (extensionFolderPath) {
            new Audio(`/${extensionFolderPath}/assets/monokuma/incorrect-answer.wav`)
                .play().catch(() => {});
        }
        const flashEl = document.createElement('div');
        flashEl.id = 'mm-damage-flash';
        document.body.appendChild(flashEl);
        document.body.classList.add('mm-shaking');
        setTimeout(() => flashEl.remove(), 220);
        setTimeout(() => document.body.classList.remove('mm-shaking'), 360);
    }

    function cleanup() {
        cancelAnimationFrame(timerInterval);
        document.querySelector('.mm-grid-wrapper')?._mmCleanup?.();
        if (swayDetach) { try { swayDetach(); } catch {} swayDetach = null; }
        overlay?.remove();  overlay  = null;
        styleEl?.remove();  styleEl  = null;
        cellEls         = [];
        sentenceEls     = [];
        sentenceLayouts = [];
        resumeCurrentBgm?.();
        onEnd?.();
    }

    /* ── CSS ─────────────────────────────────────────────────────────── */
    function buildStyles({ block, gridW, gridH, panelW }) {
        const imgBase   = extensionFolderPath ? `/${extensionFolderPath}/assets/images/minigames` : 'assets/images/minigames';
        const cursorUrl = extensionFolderPath ? `/${extensionFolderPath}/assets/classtrial/trialcursor.png` : '';
        return `
/* ── Mind Mine overlay ─────────────────────────────────────────────────── */
.mm-overlay {
    position: fixed; inset: 0; z-index: 2147483646;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 50% 40%, #0d1830 0%, #060b18 100%);
    font-family: 'Courier New', monospace;
    overflow: hidden;
}
.mm-overlay, .mm-overlay * { cursor: none !important; }
.mm-sway-reticle {
    position: fixed; left: 0; top: 0;
    width: 96px; height: 96px;
    background-image: url("${cursorUrl}");
    background-size: contain; background-repeat: no-repeat; background-position: center;
    transform: translate(-50%, -50%);
    pointer-events: none; z-index: 2147483647;
    will-change: transform;
    opacity: 0.92;
}
.mm-sway-reticle::after {
    content: '+';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-family: "Orbitron", "Impact", monospace;
    font-size: 24px; font-weight: 900; line-height: 1;
    color: #f0bf70;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.65), 0 0 8px rgba(240, 191, 112, 0.6);
    pointer-events: none;
}
.mm-overlay::before {
    content: '';
    position: absolute; inset: 0; pointer-events: none;
    background-image:
        linear-gradient(rgba(40,100,220,0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(40,100,220,0.07) 1px, transparent 1px);
    background-size: 22px 22px;
}
@keyframes mmDamageFlash {
    0%,100% { background-color: transparent; }
    25%      { background-color: rgba(200,30,30,0.32); }
}
.mm-overlay.mm-damage { animation: mmDamageFlash 0.5s ease; }

/* Intro lock — applied while the start SFX is playing. Cursor is
 * hidden and clicks are absorbed so the player can't break blocks
 * before the round actually begins. */
.mm-overlay.mm-intro-locked,
.mm-overlay.mm-intro-locked * {
    cursor: none !important;
}
.mm-overlay.mm-intro-locked .mm-block { pointer-events: none !important; }

/* ── Time-up: full-screen red flash + body shake (ported from QT) ── */
#mm-damage-flash {
    position: fixed; inset: 0;
    z-index: 2147483640;
    pointer-events: none;
    background: rgba(220, 0, 0, 0.55);
    animation: mmTimeUpFlash 0.2s ease-out forwards;
}
@keyframes mmTimeUpFlash {
    0%   { opacity: 0; }
    20%  { opacity: 1; }
    100% { opacity: 0; }
}
@keyframes mmScreenShake {
    0%   { translate:  0px  0px; }
    10%  { translate: -6px  3px; }
    20%  { translate:  5px -4px; }
    30%  { translate: -4px  2px; }
    40%  { translate:  6px -3px; }
    50%  { translate: -5px  4px; }
    60%  { translate:  4px -2px; }
    70%  { translate: -6px  3px; }
    80%  { translate:  5px -4px; }
    90%  { translate: -4px  2px; }
    100% { translate:  0px  0px; }
}
body.mm-shaking { animation: mmScreenShake 80ms steps(2, end) infinite; }

/* ── footer ── */
.mm-footer {
    position: relative; z-index: 1;
    display: flex; align-items: flex-start; justify-content: flex-start;
    width: ${panelW}px; margin-top: 0;
}
/* Trapezoid frame around the timer — wider at the top, narrower at
 * the bottom. The SVG inside scales with the frame; the polygon's
 * border keeps a constant pixel width via vector-effect:
 * non-scaling-stroke, so the outline stays crisp even though the
 * SVG itself is stretched to fill. overflow:visible lets the top
 * edge of the stroke spill 1px above the frame so it overlaps and
 * visually merges with the panel's bottom border. */
.mm-timer-frame {
    position: relative;
    display: inline-flex;
    align-items: center; justify-content: flex-start;
    padding: 8px 56px 10px 44px;
    margin-left: 24px;
}
.mm-timer-frame-bg {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    overflow: visible;
}
.mm-timer {
    position: relative;
    z-index: 1;
    font-family: "Orbitron", "Impact", monospace;
    font-size: clamp(28px, 4vh, 46px); font-weight: 900; letter-spacing: 3px;
    color: #ffaa00;
    text-shadow: 0 0 12px rgba(255,140,0,0.7), 0 0 3px rgba(255,200,0,0.9);
    text-align: left;
    font-variant-numeric: tabular-nums;
}
@keyframes mmTimerBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.mm-timer.mm-timer-low {
    color: #ff2222;
    text-shadow: 0 0 16px rgba(255,0,0,1), 0 0 4px rgba(255,100,100,0.9);
    animation: mmTimerBlink 0.45s ease-in-out infinite;
}

/* ── panel: single container for grid + sentence zone ── */
.mm-panel {
    position: relative; z-index: 1;
    background: rgba(6,14,36,0.85);
    border: 2px solid rgba(50,110,220,0.38);
    border-radius: 6px;
    box-shadow: 0 0 40px rgba(30,90,200,0.28), inset 0 0 20px rgba(0,0,0,0.5);
    padding: 10px;
}

/* ── grid wrapper: positions grid (z:1) over sentence zone (z:0) ── */
.mm-grid-wrapper {
    position: relative;
    width: ${gridW}px;
    height: ${gridH}px;
}

/* ── grid (absolute so sentence zone sits behind it) ── */
.mm-grid {
    position: absolute;
    top: 0; left: 0;
    z-index: 1;
    pointer-events: none; /* pass through to sentences; non-empty blocks re-enable below */
    display: grid;
    grid-template-columns: repeat(${COLS}, ${block}px);
    grid-template-rows: repeat(${ROWS}, ${block}px);
    gap: ${GAP}px;
}
.mm-block:not(.mm-empty) { pointer-events: auto; }

/* ── blocks ── */
.mm-block {
    width: ${block}px; height: ${block}px;
    border-radius: 4px; cursor: pointer;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    user-select: none;
    /* Pre-promote each block to its own GPU layer so the .mm-hover
     * scale change is texture-stretching only — without this, the
     * browser cold-creates a layer on every hover change and re-paints
     * the gradient + box-shadow stack, which is the per-move stall. */
    will-change: transform;
}
.mm-block::before {
    content: ''; position: absolute; inset: 0; border-radius: 3px;
    background: transparent; pointer-events: none;
}
.mm-block.mm-hover:not(.mm-anim-break) {
    transform: scale(1.09); z-index: 2;
}
.mm-block.mm-hover:not(.mm-anim-break)::before {
    background: rgba(255,255,255,0.28);
}
/* empty cell */
.mm-block.mm-empty {
    cursor: default;
    pointer-events: none;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

/* silver / gold / pink blocks — each rendered as the corresponding PNG */
.mm-block[data-color="0"],
.mm-block[data-color="1"],
.mm-block[data-color="2"] {
    background-color: transparent;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    border: none;
    box-shadow: none;
}
.mm-block[data-color="0"] { background-image: url("${imgBase}/mindmine-silver.png"); }
.mm-block[data-color="1"] { background-image: url("${imgBase}/mindmine-gold.png"); }
.mm-block[data-color="2"] { background-image: url("${imgBase}/mindmine-pink.png"); }

/* break */
@keyframes mmBreak {
    0%   { transform: scale(1);   opacity: 1; }
    40%  { transform: scale(1.22); opacity: 0.8; }
    100% { transform: scale(0);   opacity: 0; }
}
.mm-block.mm-anim-break { animation: mmBreak 0.32s ease forwards; pointer-events: none; }

/* convert */
@keyframes mmConvert {
    0%,100% { filter: brightness(1); }
    50%      { filter: brightness(2.8) saturate(1.6); }
}
.mm-block.mm-anim-convert { animation: mmConvert 0.42s ease; }

/* shake (penalty) */
@keyframes mmShake {
    0%,100% { transform: translateX(0); }
    18%  { transform: translateX(-5px); }
    36%  { transform: translateX(5px); }
    54%  { transform: translateX(-3px); }
    72%  { transform: translateX(3px); }
}
.mm-block.mm-shake { animation: mmShake 0.42s ease; }

/* ── sentences (scattered at random positions/angles, physically behind grid blocks) ── */
.mm-sentence {
    position: absolute;
    z-index: 0;
    transform-origin: center center;
    pointer-events: none;
    text-align: center;
    max-width: ${Math.round(gridW / 2)}px;
    cursor: default;
    user-select: none;
}
.mm-sentence-text {
    font-size: 11px; line-height: 1.4;
    color: rgba(80,140,230,0.6);
    text-shadow: 0 0 6px rgba(40,100,200,0.55);
    transition: color 0.5s ease, text-shadow 0.5s ease;
}

/* revealed: hover-only glow + cursor */
@keyframes mmTextGlow {
    0%,100% { text-shadow: 0 0 8px rgba(60,220,60,0.7); }
    50%      { text-shadow: 0 0 18px rgba(60,220,60,1), 0 0 32px rgba(0,160,0,0.6); }
}
.mm-sentence-revealed {
    pointer-events: auto;
    cursor: pointer;
}
.mm-sentence-revealed:hover {
    animation: mmTextGlow 1.8s ease-in-out infinite;
}
.mm-sentence-revealed:hover .mm-sentence-text { color: #a8ffa8; }

/* collected */
.mm-sentence-collected { pointer-events: none; cursor: default; animation: none; }
.mm-sentence-collected .mm-sentence-text {
    color: rgba(120,160,240,0.4);
    text-decoration: line-through;
    text-decoration-color: rgba(80,180,80,0.5);
    text-shadow: none;
}

/* ── Got It! banner (image-based, ported from Question Time) ── */
.mm-banner-prefill {
    position: fixed;
    top: 33.33%; left: 0; right: 0; height: 33.34%;
    z-index: 2147483646;
    background: #000;
    pointer-events: none;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.045s ease-out;
}
.mm-banner {
    position: fixed;
    top: 33.33%; left: 0; right: 0; height: 33.34%;
    z-index: 2147483647;
    pointer-events: none;
    overflow: visible;
    opacity: 1;
    transition: opacity 0.5s ease;
    border-top: 6px solid #000;
    border-bottom: 6px solid #000;
    animation: mmBannerShadowPulse 1.2s ease-in-out infinite;
}
@keyframes mmBannerShadowPulse {
    0%, 100% {
        box-shadow:
            0 -12px 32px rgba(0,0,0,0.95),
            0 -4px  10px rgba(0,0,0,1),
            0  12px 32px rgba(0,0,0,0.95),
            0  4px  10px rgba(0,0,0,1);
    }
    50% {
        box-shadow:
            0 -24px 60px rgba(0,0,0,1),
            0 -8px  20px rgba(0,0,0,1),
            0  24px 60px rgba(0,0,0,1),
            0  8px  20px rgba(0,0,0,1);
    }
}
.mm-banner-inner {
    position: absolute;
    top: 0; bottom: 0;
    left: 100%;
    width: 100%;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    transition: left 0.325s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.mm-banner-img {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
}

/* ── penalty float label ── */
@keyframes mmPenalty {
    0%   { opacity: 1; transform: translate(-50%, 0)     scale(1.1); }
    15%  { opacity: 1; transform: translate(-50%, -12px) scale(1.2); }
    100% { opacity: 0; transform: translate(-50%, -60px) scale(0.9); }
}
.mm-penalty-label {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    font-family: 'Orbitron', 'Courier New', monospace;
    font-size: 26px;
    font-weight: 900;
    font-style: italic;
    color: #fff;
    letter-spacing: 2px;
    white-space: nowrap;
    text-shadow:
        -2px -2px 0 #ff0000,
         2px -2px 0 #ff0000,
        -2px  2px 0 #ff0000,
         2px  2px 0 #ff0000,
         0 0 18px rgba(255, 30, 110, 0.95),
         0 0 36px rgba(255, 0,  80,  0.6);
    animation: mmPenalty 0.95s ease-out forwards;
}

`;
    }

    /* ── DOM builder ─────────────────────────────────────────────────── */
    function buildUI() {
        const layout = computeLayout();
        const { block, gridW, gridH } = layout;
        sentenceLayouts = buildSentenceLayouts(sentences.length, block, gridW, gridH);
        styleEl = document.createElement('style');
        styleEl.textContent = buildStyles(layout);
        document.head.appendChild(styleEl);

        overlay = document.createElement('div');
        overlay.className = 'mm-overlay';

        timerEl = document.createElement('div');
        timerEl.className = 'mm-timer';

        // Panel: wraps grid + sentence zone
        const panelEl = document.createElement('div');
        panelEl.className = 'mm-panel';

        // Grid
        const gridEl = document.createElement('div');
        gridEl.className = 'mm-grid';
        cellEls = [];
        for (let i = 0; i < ROWS * COLS; i++) {
            const cell = document.createElement('div');
            cell.className = 'mm-block';
            cell.dataset.color = String(grid[i]);
            cell.addEventListener('click', () => handleCellClick(i));
            gridEl.appendChild(cell);
            cellEls.push(cell);
        }
        // Grid wrapper: grid (z:1) sits over scattered sentences (z:0)
        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'mm-grid-wrapper';
        wrapperEl.appendChild(gridEl);

        // Sentences scattered at random positions/angles behind the grid
        sentenceEls = [];
        for (let s = 0; s < sentences.length; s++) {
            const { x, y, angle } = sentenceLayouts[s];
            const sentEl = document.createElement('div');
            sentEl.className = 'mm-sentence';
            sentEl.style.left      = `${x}px`;
            sentEl.style.top       = `${y}px`;
            sentEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
            const textSpan = document.createElement('span');
            textSpan.className = 'mm-sentence-text';
            textSpan.textContent = sentences[s];
            sentEl.appendChild(textSpan);
            wrapperEl.appendChild(sentEl);
            sentenceEls.push(sentEl);
        }
        // JS-driven hover: lazy rect (computed after DOM insertion) + single-cell toggle = O(1)
        const cellSize = block + GAP;
        let wrapperRect    = null;   // lazily set on first mousemove, after overlay is in DOM
        let hoveredCellIdx = -1;
        const onResize = () => { wrapperRect = wrapperEl.getBoundingClientRect(); };
        window.addEventListener('resize', onResize);
        wrapperEl._mmCleanup = () => window.removeEventListener('resize', onResize);

        // rAF-batched hover: at high cursor speeds, mousemove fires 4–8×
        // per frame.  Each fire was doing two classList toggles; we only
        // need the final position per frame, so coalesce into one update.
        let pendingMouseX = -1;
        let pendingMouseY = -1;
        let mouseRafScheduled = false;
        const processHover = () => {
            mouseRafScheduled = false;
            if (pendingMouseX < 0) return;
            if (!wrapperRect) wrapperRect = wrapperEl.getBoundingClientRect();
            const col = Math.floor((pendingMouseX - wrapperRect.left) / cellSize);
            const row = Math.floor((pendingMouseY - wrapperRect.top)  / cellSize);
            pendingMouseX = -1;
            pendingMouseY = -1;
            let newIdx = -1;
            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
                const i = flatIdx(row, col);
                if (grid[i] !== EMPTY) newIdx = i;
            }
            if (newIdx === hoveredCellIdx) return;
            if (hoveredCellIdx >= 0) cellEls[hoveredCellIdx]?.classList.remove('mm-hover');
            hoveredCellIdx = newIdx;
            if (hoveredCellIdx >= 0) cellEls[hoveredCellIdx]?.classList.add('mm-hover');
        };
        wrapperEl.addEventListener('mousemove', e => {
            pendingMouseX = e.clientX;
            pendingMouseY = e.clientY;
            if (!mouseRafScheduled) {
                mouseRafScheduled = true;
                requestAnimationFrame(processHover);
            }
        });
        wrapperEl.addEventListener('mouseleave', () => {
            pendingMouseX = -1;
            pendingMouseY = -1;
            if (hoveredCellIdx >= 0) cellEls[hoveredCellIdx]?.classList.remove('mm-hover');
            hoveredCellIdx = -1;
        });

        panelEl.appendChild(wrapperEl);
        overlay.appendChild(panelEl);

        const footer = document.createElement('div');
        footer.className = 'mm-footer';
        const timerFrame = document.createElement('div');
        timerFrame.className = 'mm-timer-frame';
        timerFrame.innerHTML = `
            <svg class="mm-timer-frame-bg" preserveAspectRatio="none" viewBox="0 0 100 30">
                <polygon points="0,0 100,0 88,30 12,30"
                         fill="rgba(6,14,36,0.92)"
                         stroke="rgba(50,110,220,0.85)"
                         stroke-width="2"
                         stroke-linejoin="miter"
                         vector-effect="non-scaling-stroke"/>
            </svg>`;
        timerFrame.appendChild(timerEl);
        footer.appendChild(timerFrame);
        overlay.appendChild(footer);

        document.body.appendChild(overlay);

        const swayReticle = document.createElement('div');
        swayReticle.className = 'mm-sway-reticle';
        overlay.appendChild(swayReticle);
        if (swayDetach) { try { swayDetach(); } catch {} }
        swayDetach = attachCursorSway(swayReticle, overlay);
    }

    /* ── public API ──────────────────────────────────────────────────── */
    function run({ sentences: sArr = [], timeLimit = 120 } = {}) {
        if (isRunning) return;

        sentences = (Array.isArray(sArr) ? sArr : [sArr])
            .map(s => String(s ?? '').trim())
            .filter(Boolean)
            .slice(0, 3);

        if (!sentences.length) {
            sentences = [
                'The suspect was present at the scene of the crime',
                'The time of death contradicts the alibi provided',
                'The murder weapon was hidden in plain sight',
            ];
        }

        sentenceState = sentences.map(() => 'hidden');
        timeRemaining = Math.max(30, timeLimit) * 1000;

        onStart?.();
        pauseCurrentBgm?.();
        playBgm?.();
        initGrid();
        buildUI();
        renderGrid();
        checkSentences(); // reveal any bands that happened to start empty
        isRunning = true;
        // Paint the starting time immediately so the timer is visible while
        // the intro SFX plays — the countdown itself starts only after.
        updateTimerEl();

        // Lock interaction (hidden cursor + no clicks) until the intro
        // SFX finishes; unlocked by startCountdown below.
        overlay?.classList.add('mm-intro-locked');

        // Entry SFX — same start cue used by Argument Armament / Hangman's
        // Gambit. The countdown only begins once it finishes (or fails to
        // play / errors), so the player gets a beat to read the board.
        const startCountdown = () => {
            overlay?.classList.remove('mm-intro-locked');
            if (isRunning && !timerInterval) startTimer();
        };
        if (extensionFolderPath) {
            const introAudio = new Audio(`/${extensionFolderPath}/assets/sfx/minigames/minigame-start.wav`);
            introAudio.addEventListener('ended', startCountdown, { once: true });
            introAudio.addEventListener('error', startCountdown, { once: true });
            introAudio.play().catch(startCountdown);
        } else {
            startCountdown();
        }
    }

    return { run };
}
