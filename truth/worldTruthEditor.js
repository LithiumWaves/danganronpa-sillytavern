// Truth tab → WORLD: the secrets of the world uncovered so far (no spoilers),
// and, behind a spoiler gate like the Case File, the whole truth: the
// mastermind, their goal, the outside world and every secret, editable.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { SECRET_SOURCES } from "../core/world/worldTruth.js";

const STYLE_ID = "dangan-wte-style";
const ROOT_ID = "dangan-wte";

const SOURCE_LABELS = { exploration: "Exploration (a secret file in a room)", flashback: "Flashback Light", monokuma: "Monokuma lets it slip", final: "The final truth" };

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 100040;
    display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
    background: rgba(6, 2, 12, 0.78); font-family: inherit; color: #f1e6f7;
}
#${ROOT_ID} .wte-window {
    width: min(900px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 0%, rgba(46, 12, 58, 0.98), rgba(10, 4, 16, 0.99));
    border: 1px solid rgba(255, 46, 196, 0.5); border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 18px rgba(255, 46, 196, 0.15);
}
#${ROOT_ID} .wte-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} .wte-title { font-size: 1.15rem; letter-spacing: 0.12em; color: #ff2ec4; flex: 1; }
#${ROOT_ID} .wte-status { font-size: 0.78rem; letter-spacing: 0.08em; color: #ffd23f; }
#${ROOT_ID} .wte-body { overflow: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
#${ROOT_ID} .wte-note { font-size: 0.82rem; color: #bfa9cc; margin: 0; line-height: 1.5; }
#${ROOT_ID} .wte-secret { padding: 10px 12px; background: rgba(255, 255, 255, 0.04); border-left: 3px solid #ff2ec4; border-radius: 4px; }
#${ROOT_ID} .wte-secret-title { font-weight: 700; }
#${ROOT_ID} .wte-secret-meta { font-size: 0.72rem; color: #ffd23f; letter-spacing: 0.08em; margin-top: 2px; }
#${ROOT_ID} .wte-secret-text { font-size: 0.88rem; margin-top: 4px; line-height: 1.45; }
#${ROOT_ID} .wte-empty { text-align: center; padding: 18px; color: #bfa9cc; }
#${ROOT_ID} .wte-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; justify-content: flex-end; align-items: center; border-top: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} .wte-error { flex: 1; color: #ff8a8a; font-size: 0.82rem; }
#${ROOT_ID} fieldset { border: 1px solid rgba(255, 182, 222, 0.25); border-radius: 6px; margin: 0; padding: 10px 12px; }
#${ROOT_ID} legend { color: #ff7ad9; letter-spacing: 0.12em; font-size: 0.78rem; padding: 0 6px; }
#${ROOT_ID} label { display: flex; flex-direction: column; gap: 3px; font-size: 0.75rem; letter-spacing: 0.06em; color: #d9c4e6; }
#${ROOT_ID} .wte-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
#${ROOT_ID} .wte-wide { grid-column: 1 / -1; }
#${ROOT_ID} .wte-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 10px; padding: 8px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.03); border-radius: 4px; }
#${ROOT_ID} label.wte-check { flex-direction: row; align-items: center; gap: 6px; }
#${ROOT_ID} label.wte-check input { width: auto; }
#${ROOT_ID} input, #${ROOT_ID} select, #${ROOT_ID} textarea {
    background: rgba(0, 0, 0, 0.45); color: #fff; border: 1px solid rgba(255, 182, 222, 0.35); border-radius: 4px;
    font: inherit; font-size: 0.88rem; padding: 6px 8px; width: 100%; box-sizing: border-box;
}
#${ROOT_ID} textarea { resize: vertical; min-height: 3.5em; }
#${ROOT_ID} button {
    background: transparent; color: #f1e6f7; border: 1px solid rgba(255, 182, 222, 0.6);
    font: inherit; font-size: 0.8rem; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; border-radius: 4px;
}
#${ROOT_ID} button:hover { background: rgba(255, 46, 196, 0.18); }
#${ROOT_ID} button:disabled { opacity: 0.5; cursor: wait; }
#${ROOT_ID} button.wte-primary { border-color: #ff2ec4; color: #fff; background: rgba(255, 46, 196, 0.32); }
#${ROOT_ID} button.wte-danger { border-color: rgba(255, 80, 80, 0.7); color: #ff8a8a; }
@media (max-width: 700px) {
    #${ROOT_ID} { padding: 0; }
    #${ROOT_ID} .wte-window { max-height: 100vh; height: 100vh; border-radius: 0; }
    #${ROOT_ID} .wte-grid, #${ROOT_ID} .wte-row { grid-template-columns: 1fr; }
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
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Secrets of the World");
    root.innerHTML = `<div class="wte-window">
        <div class="wte-head"><div class="wte-title">SECRETS OF THE WORLD</div><span class="wte-status"></span><button type="button" class="wte-close">CLOSE</button></div>
        <div class="wte-body"></div>
        <div class="wte-foot"></div>
    </div>`;
    document.body.appendChild(root);
    const body = root.querySelector(".wte-body");
    const foot = root.querySelector(".wte-foot");
    const status = root.querySelector(".wte-status");
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
        status.textContent = wt ? `${known.length} OF ${total} UNCOVERED` : "";
        body.innerHTML = `<p class="wte-note">The truth behind this killing game comes out bit by bit: secret files hidden in rooms (examine them in daily life), Flashback Lights, and things Monokuma lets slip. Everything uncovered here is known to everyone.</p>`;
        if (!wt) body.insertAdjacentHTML("beforeend", `<div class="wte-empty">No truth of the world yet. It's written when a NEW GAME starts, or reveal the editor below to draft one.</div>`);
        else if (!known.length) body.insertAdjacentHTML("beforeend", `<div class="wte-empty">Nothing uncovered yet.</div>`);
        for (const s of known) {
            body.insertAdjacentHTML("beforeend", `<div class="wte-secret"><div class="wte-secret-title">${esc(s.title)}</div><div class="wte-secret-meta">CHAPTER ${s.revealedChapter || s.chapter} · ${esc({ exploration: "SECRET FILE", flashback: "FLASHBACK LIGHT", monokuma: "MONOKUMA", final: "THE TRUTH" }[s.source] || "")}</div><div class="wte-secret-text">${esc(s.text)}</div></div>`);
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
            body.innerHTML = `<p class="wte-note">Nothing written yet. Draft one from the cast, the map and your lorebook.</p>`;
            foot.replaceChildren(err, hide, draftBtn);
            return;
        }
        status.textContent = `MASTERMIND: ${wt.mastermind.toUpperCase()}`;
        const cast = api.getCast().map((c) => ({ value: c.name, label: c.name }));
        if (wt.mastermind && !cast.some((c) => c.value === wt.mastermind)) cast.push({ value: wt.mastermind, label: wt.mastermind });
        const rooms = api.getRooms().map((r) => ({ value: r.id, label: r.label }));
        const chapterOpts = Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `Chapter ${i + 1}` }));
        const sourceOpts = SECRET_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }));
        const row = (s = {}) => `<div class="wte-row" data-row="secret" data-id="${esc(s.id || "")}" data-spot="${esc(s.spotLabel || "")}" data-revealed-chapter="${Number(s.revealedChapter) || 0}">
            <label>Title<input data-f="title" value="${esc(s.title)}"></label>
            <label>How it comes out<select data-f="source">${options(sourceOpts, s.source || "exploration", { blank: null })}</select></label>
            <label>Chapter<select data-f="chapter">${options(chapterOpts, String(s.chapter || 1), { blank: null })}</select></label>
            <label class="wte-wide" style="grid-column: 1 / 3">The secret<textarea data-f="text" rows="2">${esc(s.text)}</textarea></label>
            <label>Room (secret file)<select data-f="roomId">${options(rooms, s.roomId || "", { blank: "— none —" })}</select></label>
            <label class="wte-check"><input type="checkbox" data-f="revealed"${s.revealed ? " checked" : ""}> Uncovered</label>
            <div></div><button type="button" class="wte-danger" data-remove>REMOVE</button>
        </div>`;
        body.innerHTML = `
            <fieldset><legend>THE MASTERMIND</legend><div class="wte-grid">
                <label>Mastermind<select data-k="mastermind">${options(cast, wt.mastermind, { blank: "— pick —" })}</select></label>
                <label>Final chapter (the final trial can start from here)<select data-k="finalChapter">${options(chapterOpts, String(wt.finalChapter), { blank: null })}</select></label>
                <label class="wte-wide">Their goal<textarea data-k="goal" rows="2">${esc(wt.goal)}</textarea></label>
                <label class="wte-wide">The outside world<textarea data-k="outsideWorld" rows="2">${esc(wt.outsideWorld)}</textarea></label>
            </div></fieldset>
            <fieldset><legend>SECRETS</legend>
                <p class="wte-note">Exploration secrets are secret files in their room, found by examining it in daily life once their chapter comes. With Flashback Lights off, Flashback secrets are found that way too.</p>
                <div data-list>${wt.secrets.map(row).join("")}</div>
                <button type="button" data-add>+ SECRET</button>
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
