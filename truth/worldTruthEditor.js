// Truth tab → WORLD: the secrets of the world uncovered so far (no spoilers),
// and, behind a spoiler gate like the Case File, the whole truth: the
// mastermind, their goal, the outside world and every secret, editable.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { SECRET_SOURCES } from "../core/world/worldTruth.js";

const STYLE_ID = "dangan-wte-style";
const ROOT_ID = "dangan-wte";

// The file tab on an uncovered secret.
const SOURCE_TABS = { exploration: "SECRET FILE", flashback: "FLASHBACK LIGHT", monokuma: "MONOKUMA", final: "THE TRUTH" };

const SOURCE_LABELS = { exploration: "Exploration (a secret file in a room)", flashback: "Flashback Light", monokuma: "Monokuma lets it slip", final: "The final truth" };

// The look comes from styles/systems/dossier/dossier.css; this is layout only.
const CSS = `
#${ROOT_ID} .wte-files { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
#${ROOT_ID} .wte-secret {
    position: relative; min-height: 120px; padding: 30px 14px 40px;
    background: linear-gradient(160deg, #2a1a33, #160c1d); border: 1px solid rgba(255, 255, 255, 0.12);
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
    box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.35);
}
/* The file's tab, coloured by how it came out. */
#${ROOT_ID} .wte-secret-tab {
    position: absolute; top: 0; left: 0; padding: 3px 14px 3px 10px;
    font: 600 11px "Rajdhani", sans-serif; letter-spacing: 0.16em; color: #fff;
    background: var(--wte-tab, var(--dgn-pink)); clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
}
#${ROOT_ID} .wte-secret[data-source="exploration"] { --wte-tab: #3a8dde; }
#${ROOT_ID} .wte-secret[data-source="flashback"] { --wte-tab: #d9b100; }
#${ROOT_ID} .wte-secret[data-source="monokuma"] { --wte-tab: #c2185b; }
#${ROOT_ID} .wte-secret[data-source="final"] { --wte-tab: #8b1fd6; }
#${ROOT_ID} .wte-secret-title { font: 400 16px "Bruno Ace", "Orbitron", sans-serif; letter-spacing: 0.06em; color: #fff; margin-right: 70px; }
#${ROOT_ID} .wte-secret-text { margin-top: 8px; font-size: 15px; line-height: 1.5; color: var(--dgn-text); }
#${ROOT_ID} .wte-secret-chapter { position: absolute; top: 4px; right: 22px; }
#${ROOT_ID} .wte-secret .dgn-stamp { position: absolute; right: 10px; bottom: 10px; }
#${ROOT_ID} .wte-secret.is-locked { display: grid; place-items: center; text-align: center; opacity: 0.75;
    background: repeating-linear-gradient(-60deg, rgba(255, 255, 255, 0.03) 0 10px, transparent 10px 22px), linear-gradient(160deg, #1d1224, #0f0814); }
#${ROOT_ID} .wte-secret.is-locked .wte-secret-title { margin: 0; color: var(--dgn-muted); font-size: 14px; }
#${ROOT_ID} .wte-secret.is-locked { padding: 14px; }
#${ROOT_ID} .wte-secret.is-locked .wte-lock { font: 400 34px "Bruno Ace", sans-serif; color: var(--dgn-pink); opacity: 0.6; margin-bottom: 4px; }
#${ROOT_ID} fieldset { display: flex; flex-direction: column; gap: 10px; }
#${ROOT_ID} fieldset > button[data-add] { align-self: flex-start; }
#${ROOT_ID} [data-list] { display: flex; flex-direction: column; gap: 8px; }
#${ROOT_ID} .wte-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
#${ROOT_ID} .wte-wide { grid-column: 1 / -1; }
#${ROOT_ID} .wte-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 12px; align-items: end; }
#${ROOT_ID} .wte-row .wte-text { grid-column: 1 / 3; }
#${ROOT_ID} .wte-row-end { display: flex; justify-content: space-between; align-items: center; gap: 8px; grid-column: 1 / -1; }
@media (max-width: 700px) {
    #${ROOT_ID} .wte-grid, #${ROOT_ID} .wte-row { grid-template-columns: 1fr; }
    #${ROOT_ID} .wte-row .wte-text { grid-column: 1; }
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function options(list, selected, { blank = "" } = {}) {
    const rows = blank !== null ? [`<option value="">${esc(blank)}</option>`] : [];
    for (const o of list) rows.push(`<option value="${esc(o.value)}"${o.value === selected ? " selected" : ""}>${esc(o.label)}</option>`);
    return rows.join("");
}

// api: { getWorldTruth(), isRevealed(), setRevealed(on), getCast() → [{ name }],
//   getRooms() → [{ id, label }], confirm(opts), save(draft) → Promise<error|"">,
//   draft() → Promise<error|"">, clear(), useFlashback() (when one is held) }
export function openWorldTruthView(api) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "dgn-sheet";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Secrets of the World");
    root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="wte-window dgn-sheet-window">
        <div class="wte-head dgn-sheet-head"><div class="wte-title dgn-sheet-title">SECRETS OF THE WORLD</div><span class="wte-status dgn-sheet-tag"></span><button type="button" class="wte-close dgn-sheet-close">CLOSE</button></div>
        <div class="dgn-sheet-progress" hidden><span style="width:0%"></span></div>
        <div class="wte-body dgn-sheet-body"></div>
        <div class="wte-foot dgn-sheet-foot"></div>
    </div>`;
    document.body.appendChild(root);
    const body = root.querySelector(".wte-body");
    const foot = root.querySelector(".wte-foot");
    const status = root.querySelector(".wte-status");
    const progress = root.querySelector(".dgn-sheet-progress");
    const setProgress = (done, total) => {
        progress.hidden = !total;
        progress.firstElementChild.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
    };
    let busy = false;

    const close = () => {
        release();
        root.remove();
    };
    const release = pushSkippable({ kind: "minigame", skip: () => close() });
    root.querySelector(".wte-close").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });

    const button = (label, cls, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        if (cls) b.className = cls;
        b.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            b.disabled = true;
            try { await fn(); } finally { busy = false; b.disabled = false; }
        });
        return b;
    };
    const errorEl = () => Object.assign(document.createElement("span"), { className: "wte-error" });

    // What the students have uncovered: no spoilers.
    function renderKnown() {
        const wt = api.getWorldTruth();
        const known = (wt?.secrets || []).filter((s) => s.revealed).sort((a, b) => a.revealedChapter - b.revealedChapter);
        const total = wt?.secrets?.length || 0;
        status.textContent = wt ? `${known.length} / ${total} UNCOVERED` : "";
        setProgress(known.length, total);
        body.innerHTML = `<p class="wte-note dgn-note">The truth behind this killing game comes out bit by bit: secret files hidden in rooms (examine them in daily life), Flashback Lights, and things Monokuma lets slip. Everything uncovered here is known to everyone.</p>`;
        if (!wt) {
            body.insertAdjacentHTML("beforeend", `<div class="wte-empty dgn-empty">No truth of the world yet. It's written when a NEW GAME starts, or reveal the editor below to draft one.</div>`);
        } else {
            // Uncovered secrets as files; the rest stay locked, with no hint
            // of what's in them.
            const files = known.map((s) => `<div class="wte-secret" data-source="${esc(s.source)}">
                <span class="wte-secret-tab">${esc(SOURCE_TABS[s.source] || "SECRET")}</span>
                <span class="wte-secret-chapter dgn-chip is-muted">CHAPTER ${s.revealedChapter || s.chapter}</span>
                <div class="wte-secret-title">${esc(s.title)}</div>
                <div class="wte-secret-text">${esc(s.text)}</div>
                <span class="dgn-stamp is-small is-green">UNCOVERED</span>
            </div>`);
            for (let i = known.length; i < total; i += 1) {
                files.push(`<div class="wte-secret is-locked"><div><div class="wte-lock">?</div><div class="wte-secret-title">FILE ${String(i + 1).padStart(2, "0")} · CLASSIFIED</div></div></div>`);
            }
            body.insertAdjacentHTML("beforeend", `<div class="wte-files">${files.join("")}</div>`);
        }
        const actions = [];
        if (wt?.flashbackPending) actions.push(button("USE FLASHBACK LIGHT", "wte-primary", async () => { close(); await api.useFlashback(); }));
        actions.push(button("REVEAL THE WHOLE TRUTH (SPOILERS)", "", async () => {
            const ok = await api.confirm({ title: "REVEAL THE TRUTH?", message: "This shows who the mastermind is and every secret still hidden. It spoils the whole story for this save.", confirmLabel: "REVEAL" });
            if (!ok) return;
            api.setRevealed(true);
            render();
        }));
        foot.replaceChildren(...actions);
    }

    function renderForm() {
        const wt = api.getWorldTruth();
        const err = errorEl();
        const draftBtn = button(wt ? "REDRAFT WITH AI" : "DRAFT WITH AI", wt ? "" : "wte-primary", async () => {
            if (wt && !(await api.confirm({ title: "REDRAFT?", message: "A new truth replaces this one, and what was uncovered is forgotten.", confirmLabel: "REDRAFT" }))) return;
            err.textContent = "Drafting… (one hidden AI call)";
            const message = await api.draft();
            err.textContent = message || "";
            if (!message) render();
        });
        const hide = button("HIDE AGAIN", "", async () => { api.setRevealed(false); render(); });
        if (!wt) {
            status.textContent = "NO TRUTH YET";
            setProgress(0, 0);
            body.innerHTML = `<div class="dgn-dossier">
                <div class="dgn-dossier-label">THE TRUTH OF THE WORLD</div>
                <div class="dgn-dossier-title">NOTHING WRITTEN</div>
                <p>Draft one from the cast, the map and your lorebook: a mastermind, their goal, and the secrets that come out chapter by chapter.</p>
            </div>`;
            foot.replaceChildren(err, hide, draftBtn);
            return;
        }
        status.textContent = `MASTERMIND: ${wt.mastermind.toUpperCase()}`;
        setProgress(wt.secrets.filter((x) => x.revealed).length, wt.secrets.length);
        const cast = api.getCast().map((c) => ({ value: c.name, label: c.name }));
        if (wt.mastermind && !cast.some((c) => c.value === wt.mastermind)) cast.push({ value: wt.mastermind, label: wt.mastermind });
        const rooms = api.getRooms().map((r) => ({ value: r.id, label: r.label }));
        const chapterOpts = Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `Chapter ${i + 1}` }));
        const sourceOpts = SECRET_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }));
        const row = (s = {}) => `<div class="wte-row dgn-row" data-row="secret" data-id="${esc(s.id || "")}" data-spot="${esc(s.spotLabel || "")}" data-revealed-chapter="${Number(s.revealedChapter) || 0}">
            <label>Title<input data-f="title" value="${esc(s.title)}"></label>
            <label>How it comes out<select data-f="source">${options(sourceOpts, s.source || "exploration", { blank: null })}</select></label>
            <label>Chapter<select data-f="chapter">${options(chapterOpts, String(s.chapter || 1), { blank: null })}</select></label>
            <label class="wte-text">The secret<textarea data-f="text" rows="2">${esc(s.text)}</textarea></label>
            <label>Room (secret file)<select data-f="roomId">${options(rooms, s.roomId || "", { blank: "— none —" })}</select></label>
            <div class="wte-row-end"><label class="wte-check"><input type="checkbox" data-f="revealed"${s.revealed ? " checked" : ""}> Uncovered</label><button type="button" class="wte-danger is-small" data-remove>REMOVE</button></div>
        </div>`;
        body.innerHTML = `
            <fieldset><legend data-n="01">THE MASTERMIND</legend><div class="wte-grid">
                <label>Mastermind<select data-k="mastermind">${options(cast, wt.mastermind, { blank: "— pick —" })}</select></label>
                <label>Final chapter (the final trial can start from here)<select data-k="finalChapter">${options(chapterOpts, String(wt.finalChapter), { blank: null })}</select></label>
                <label class="wte-wide">Their goal<textarea data-k="goal" rows="2">${esc(wt.goal)}</textarea></label>
                <label class="wte-wide">The outside world<textarea data-k="outsideWorld" rows="2">${esc(wt.outsideWorld)}</textarea></label>
            </div></fieldset>
            <fieldset><legend data-n="02">SECRETS</legend>
                <p class="wte-note dgn-note">Exploration secrets are secret files in their room, found by examining it in daily life once their chapter comes. With Flashback Lights off, Flashback secrets are found that way too.</p>
                <div data-list>${wt.secrets.map(row).join("")}</div>
                <button type="button" class="is-small" data-add>+ SECRET</button>
            </fieldset>`;
        body.querySelector("[data-add]").addEventListener("click", () => body.querySelector("[data-list]").insertAdjacentHTML("beforeend", row()));
        body.addEventListener("click", (e) => { const r = e.target.closest("[data-remove]"); if (r) r.closest(".wte-row")?.remove(); });
        const save = button("SAVE", "wte-primary", async () => {
            const next = { ...wt };
            body.querySelectorAll("[data-k]").forEach((el) => { next[el.dataset.k] = el.dataset.k === "finalChapter" ? Number(el.value) : el.value; });
            next.secrets = [...body.querySelectorAll('[data-row="secret"]')].map((r) => {
                const f = (name) => r.querySelector(`[data-f="${name}"]`);
                return {
                    id: r.dataset.id || undefined,
                    title: f("title").value,
                    text: f("text").value,
                    source: f("source").value,
                    chapter: Number(f("chapter").value),
                    roomId: f("roomId").value,
                    roomLabel: rooms.find((o) => o.value === f("roomId").value)?.label || "",
                    spotLabel: f("roomId").value ? r.dataset.spot : "",
                    revealed: f("revealed").checked,
                    revealedChapter: f("revealed").checked ? Number(r.dataset.revealedChapter) || Number(f("chapter").value) : 0,
                };
            });
            const message = await api.save(next);
            err.textContent = message || "Saved.";
        });
        const clear = button("CLEAR", "wte-danger", async () => {
            if (!(await api.confirm({ title: "CLEAR THE TRUTH?", message: "The mastermind and every secret are thrown away.", confirmLabel: "CLEAR" }))) return;
            await api.clear();
            render();
        });
        foot.replaceChildren(err, hide, clear, draftBtn, save);
    }

    function render() {
        if (api.isRevealed()) renderForm();
        else renderKnown();
    }

    render();
    return { close, render };
}
