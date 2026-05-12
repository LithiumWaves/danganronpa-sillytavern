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

export function createMindMineController({
    extensionFolderPath = '',
    onWin              = null,   // (sentenceText: string) => void
    pauseCurrentBgm    = null,
    resumeCurrentBgm   = null,
    playBgm            = null,   // () => void — starts the minigame BGM track
    onStart            = null,   // () => void — called when minigame begins
    onEnd              = null,   // () => void — called when minigame ends/cleans up
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
       Coverage = cells whose centres fall beneath the text's approximate footprint. */
    function buildSentenceLayouts(count, block, gridW, gridH) {
        const cellW   = block + GAP;
        const padX    = block * 2;
        const padY    = block * 1.5;
        const layouts = [];
        for (let s = 0; s < count; s++) {
            const x     = padX + Math.random() * (gridW - padX * 2);
            const y     = padY + Math.random() * (gridH - padY * 2);
            const angle = (Math.random() - 0.5) * 40; // −20° … +20°
            // Axis-aligned bounding box of the rotated text block (accounts for wrapping)
            const maxTextW = Math.round(gridW / 2);
            const rawTextW = Math.max(60, (sentences[s]?.length ?? 20) * 6.5);
            const textW    = Math.min(maxTextW, rawTextW);
            const lines    = Math.ceil(rawTextW / maxTextW);
            const textH    = Math.max(14, lines * 16);
            const rad     = Math.abs(angle) * Math.PI / 180;
            const halfAABBW = (textW / 2) * Math.cos(rad) + (textH / 2) * Math.sin(rad);
            const halfAABBH = (textW / 2) * Math.sin(rad) + (textH / 2) * Math.cos(rad);
            const colMin  = Math.max(0,        Math.floor((x - halfAABBW) / cellW));
            const colMax  = Math.min(COLS - 1, Math.floor((x + halfAABBW) / cellW));
            const rowMin  = Math.max(0,        Math.floor((y - halfAABBH) / cellW));
            const rowMax  = Math.min(ROWS - 1, Math.floor((y + halfAABBH) / cellW));
            const coverage = [];
            for (let r = rowMin; r <= rowMax; r++)
                for (let c = colMin; c <= colMax; c++)
                    coverage.push(flatIdx(r, c));
            layouts.push({ x, y, angle, coverage });
        }
        return layouts;
    }

    /* ── mutable state ───────────────────────────────────────────────── */
    let grid          = [];
    let cellEls       = [];
    let overlay       = null;
    let styleEl       = null;
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
        if (group.size === 1) {
            applyDamage(i);
            if (!isRunning) return; // time hit zero
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
            document.body.appendChild(label);
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

    function showGotIt() {
        const el = document.createElement('div');
        el.className = 'mm-gotit';
        el.textContent = 'GOT IT!';
        overlay.appendChild(el);
        // Two rAF so the initial opacity:0 state is committed first.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            el.classList.add('mm-gotit-visible');
            setTimeout(() => {
                el.classList.remove('mm-gotit-visible');
                setTimeout(() => el.remove(), 550);
            }, 1600);
        }));
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
        timerEl.classList.toggle('mm-timer-low', timeRemaining <= 30000);
    }

    /* ── end game / cleanup ──────────────────────────────────────────── */
    function endGame(win) {
        if (!isRunning) return;
        isRunning = false;
        cancelAnimationFrame(timerInterval);
        timerInterval = null;
        setTimeout(cleanup, win ? 2000 : 600);
    }

    function cleanup() {
        cancelAnimationFrame(timerInterval);
        document.querySelector('.mm-grid-wrapper')?._mmCleanup?.();
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

/* ── footer ── */
.mm-footer {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    width: ${panelW}px; margin-top: 10px;
}
.mm-timer {
    font-family: "Orbitron", "Impact", monospace;
    font-size: clamp(28px, 4vh, 46px); font-weight: 900; letter-spacing: 3px;
    color: #ffaa00;
    text-shadow: 0 0 12px rgba(255,140,0,0.7), 0 0 3px rgba(255,200,0,0.9);
    text-align: center;
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
.mm-block::after {
    content: '◆'; font-size: 13px; opacity: 0.5; pointer-events: none;
}

/* empty cell */
.mm-block.mm-empty {
    cursor: default;
    pointer-events: none;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}
.mm-block.mm-empty::after { display: none; }

/* silver */
.mm-block[data-color="0"] {
    background: linear-gradient(145deg, #dde6f4 0%, #8898b4 55%, #c2cedd 100%);
    border: 2px solid #4a5870;
    box-shadow:
        inset 2px 2px 5px rgba(255,255,255,0.55),
        inset -2px -2px 5px rgba(0,10,40,0.45),
        0 2px 6px rgba(0,0,0,0.55);
}
.mm-block[data-color="0"]::after { color: rgba(20,40,90,0.55); }

/* gold */
.mm-block[data-color="1"] {
    background: linear-gradient(145deg, #f8d460 0%, #a46800 55%, #dea030 100%);
    border: 2px solid #6a3800;
    box-shadow:
        inset 2px 2px 5px rgba(255,230,110,0.6),
        inset -2px -2px 5px rgba(70,25,0,0.5),
        0 2px 6px rgba(0,0,0,0.55);
}
.mm-block[data-color="1"]::after { color: rgba(80,30,0,0.55); }

/* pink */
.mm-block[data-color="2"] {
    background: linear-gradient(145deg, #f090cc 0%, #920855 55%, #d04094 100%);
    border: 2px solid #5a0038;
    box-shadow:
        inset 2px 2px 5px rgba(255,160,215,0.5),
        inset -2px -2px 5px rgba(65,0,35,0.5),
        0 2px 6px rgba(0,0,0,0.55);
}
.mm-block[data-color="2"]::after { color: rgba(65,0,35,0.55); }

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

/* ── Got It! banner ── */
.mm-gotit {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.55);
    opacity: 0; pointer-events: none; z-index: 200;
    font-size: clamp(38px, 7vw, 74px);
    font-weight: 900; letter-spacing: 6px; white-space: nowrap;
    color: #fff;
    text-shadow:
        0 0 18px rgba(80,255,80,1),
        0 0 36px rgba(40,200,40,0.85),
        0 0 60px rgba(0,140,0,0.65);
    transition: opacity 0.28s ease, transform 0.28s ease;
}
.mm-gotit.mm-gotit-visible {
    opacity: 1; transform: translate(-50%, -50%) scale(1);
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
    color: #ff1a6e;
    letter-spacing: 2px;
    white-space: nowrap;
    text-shadow:
        -2px -2px 0 #fff,
         2px -2px 0 #fff,
        -2px  2px 0 #fff,
         2px  2px 0 #fff,
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

        wrapperEl.addEventListener('mousemove', e => {
            if (!wrapperRect) wrapperRect = wrapperEl.getBoundingClientRect();
            const col = Math.floor((e.clientX - wrapperRect.left) / cellSize);
            const row = Math.floor((e.clientY - wrapperRect.top)  / cellSize);
            let newIdx = -1;
            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
                const i = flatIdx(row, col);
                if (grid[i] !== EMPTY) newIdx = i;
            }
            if (newIdx === hoveredCellIdx) return;
            if (hoveredCellIdx >= 0) cellEls[hoveredCellIdx]?.classList.remove('mm-hover');
            hoveredCellIdx = newIdx;
            if (hoveredCellIdx >= 0) cellEls[hoveredCellIdx]?.classList.add('mm-hover');
        });
        wrapperEl.addEventListener('mouseleave', () => {
            if (hoveredCellIdx >= 0) cellEls[hoveredCellIdx]?.classList.remove('mm-hover');
            hoveredCellIdx = -1;
        });

        panelEl.appendChild(wrapperEl);
        overlay.appendChild(panelEl);

        const footer = document.createElement('div');
        footer.className = 'mm-footer';
        footer.appendChild(timerEl);
        overlay.appendChild(footer);

        document.body.appendChild(overlay);
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
        startTimer();
        isRunning = true;
    }

    return { run };
}
