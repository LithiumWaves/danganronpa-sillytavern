// The Case File editor: everything about the hidden case, for players who'd
// rather run the mystery than solve it. Behind a spoiler gate that's
// remembered per save. index.js supplies the data and does the saving.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { CASE_SHAPES, MOTIVE_KINDS } from "../core/case/caseFile.js";

const STYLE_ID = "dangan-cfe-style";
const ROOT_ID = "dangan-cfe";

// The look comes from styles/systems/dossier/dossier.css; this is layout only.
const CSS = `
#${ROOT_ID} .cfe-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px 14px; }
#${ROOT_ID} .cfe-wide { grid-column: 1 / -1; }
#${ROOT_ID} fieldset { display: flex; flex-direction: column; gap: 10px; }
#${ROOT_ID} fieldset > button[data-add] { align-self: flex-start; }
#${ROOT_ID} [data-list] { display: flex; flex-direction: column; gap: 8px; }
#${ROOT_ID} [data-list]:empty { display: none; }
#${ROOT_ID} .cfe-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; }
#${ROOT_ID} .cfe-row-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px 12px; }
#${ROOT_ID} .cfe-public-only[hidden], #${ROOT_ID} [data-shapes][hidden], #${ROOT_ID} [data-hide-shapes][hidden], #${ROOT_ID} [data-motive-kinds][hidden] { display: none; }
#${ROOT_ID} .cfe-blackened { align-self: end; padding-bottom: 9px; font: 600 13px "Rajdhani", sans-serif; letter-spacing: 0.16em; color: var(--dgn-gold); }
#${ROOT_ID} .cfe-blackened:not(:empty)::before { content: "▶ "; color: var(--dgn-pink); }
@media (max-width: 600px) {
    #${ROOT_ID} .cfe-row { grid-template-columns: 1fr; }
}
`;

const FILE_FIELD_LABELS = { timeOfDeath: "Time of death", cause: "Cause of death", injuries: "Injuries" };

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function options(list, selected, { blank = "" } = {}) {
    const items = blank !== null ? [`<option value="">${esc(blank)}</option>`] : [];
    for (const { value, label } of list) {
        items.push(`<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`);
    }
    // Keep a value that's no longer in the list (a room or student that's gone)
    // visible, so saving reports it instead of silently dropping it.
    if (selected && !list.some((o) => o.value === selected)) {
        items.push(`<option value="${esc(selected)}" selected>${esc(selected)} (missing)</option>`);
    }
    return items.join("");
}

function statusLine(cf) {
    if (!cf) return "NO CASE";
    if (cf.status === "closed") return "CLOSED";
    if (cf.status === "averted") return "AVERTED · NOBODY KILLED BY THE DEADLINE";
    if (cf.discovered) return "BODY FOUND · INVESTIGATION";
    if (cf.status === "committed") return `MURDER DONE (${cf.committedAt?.time || "?"} OF DAY ${cf.committedAt?.day || "?"}) · BODY NOT FOUND`;
    return `PLANNED · MURDER ON THE ${cf.murderTime.toUpperCase()} OF DAY ${cf.murderDay}`;
}

// api: { getCaseFile, isRevealed, setRevealed, getCast, getRooms, confirm,
//        save(caseFile) → Promise<string error|"">, regenerate, announce,
//        clear, commit, discover, createBlank, hasCase }
export function openCaseFileEditor(api) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "dgn-sheet";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Case File");
    root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="cfe-window dgn-sheet-window">
        <div class="cfe-head dgn-sheet-head"><div class="cfe-title dgn-sheet-title">CASE FILE</div><div class="cfe-status dgn-sheet-tag"></div><button type="button" class="cfe-close dgn-sheet-close" aria-label="Close">CLOSE</button></div>
        <div class="cfe-body dgn-sheet-body"></div>
        <div class="cfe-foot dgn-sheet-foot"></div>
    </div>`;
    document.body.appendChild(root);

    const body = root.querySelector(".cfe-body");
    const foot = root.querySelector(".cfe-foot");
    const statusEl = root.querySelector(".cfe-status");
    // The header tag, coloured by where the case is.
    const setStatus = (text, cf = null) => {
        statusEl.textContent = text;
        const kind = !cf ? "" : cf.status === "closed" ? "is-closed" : cf.status === "averted" ? "is-averted" : cf.discovered || cf.status === "committed" ? "is-found" : "is-planned";
        statusEl.className = `cfe-status dgn-sheet-tag ${kind}`.trim();
    };
    let draft = null; // the case being edited (a copy)
    let dirty = false;
    let busy = false;

    const close = () => {
        release();
        root.remove();
    };
    const confirmLeave = async () => !dirty || api.confirm({
        title: "DISCARD CHANGES?",
        message: "Your edits to the Case File haven't been saved.",
        confirmLabel: "DISCARD",
    });
    const release = pushSkippable({ kind: "minigame", confirm: confirmLeave, skip: () => close() });
    root.querySelector(".cfe-close").addEventListener("click", async () => {
        if (await confirmLeave()) close();
    });

    const button = (label, cls, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        if (cls) b.className = cls;
        b.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            try { await fn(); } finally { busy = false; }
        });
        return b;
    };

    function renderGate() {
        setStatus("CLASSIFIED");
        body.innerHTML = `<div class="cfe-gate dgn-dossier">
            <div class="dgn-dossier-label">HOPE'S PEAK · CONFIDENTIAL</div>
            <div class="dgn-dossier-title">CASE FILE</div>
            <span class="dgn-stamp">TOP SECRET</span>
            <p><strong>Spoilers ahead.</strong> The Case File holds the whole truth of this chapter's murder: who, how, when, and every planted clue.</p>
            <p>Reveal it only if you'd rather run the mystery than solve it. You can hide it again later.</p>
        </div>`;
        const reveal = button("REVEAL CASE DETAILS", "cfe-primary", async () => {
            const ok = await api.confirm({ title: "REVEAL THE CASE?", message: "This spoils the mystery for this save.", confirmLabel: "REVEAL" });
            if (!ok) return;
            api.setRevealed(true);
            render();
        });
        // The motive and its deadline can be changed without seeing the plan.
        const motive = api.canEditMotive?.()
            ? button("EDIT MOTIVE (NO SPOILERS)", "", async () => { close(); api.editMotive(); })
            : null;
        foot.replaceChildren(...[motive, reveal].filter(Boolean));
    }

    function renderEmpty() {
        setStatus("NO CASE");
        body.innerHTML = `<div class="cfe-gate dgn-dossier">
            <div class="dgn-dossier-label">HOPE'S PEAK · CONFIDENTIAL</div>
            <div class="dgn-dossier-title">NO CASE YET</div>
            <p>Monokuma plans one when he announces a motive, or you can write one yourself.</p>
        </div>`;
        foot.replaceChildren(
            button("HIDE AGAIN", "", async () => { api.setRevealed(false); render(); }),
            button("ANNOUNCE MOTIVE", "", async () => { close(); await api.announceNew(); }),
            button("WRITE BY HAND", "cfe-primary", async () => {
                draft = api.createBlank();
                dirty = true;
                renderForm({ isNew: true });
            }),
        );
    }

    function render() {
        dirty = false;
        if (!api.isRevealed()) return renderGate();
        const cf = api.getCaseFile();
        if (!cf) return renderEmpty();
        draft = JSON.parse(JSON.stringify(cf));
        renderForm({ isNew: false });
    }

    function renderForm({ isNew }) {
        const cf = draft;
        const cast = api.getCast().map((c) => ({ value: c.name, label: c.ultimate ? `${c.name} (${c.ultimate})` : c.name }));
        const rooms = api.getRooms().map((r) => ({ value: r.id, label: r.label }));
        setStatus(isNew ? "NEW CASE" : statusLine(cf), isNew ? null : cf);

        const clueRow = (c = {}) => `<div class="cfe-row dgn-row" data-row="clue" data-id="${esc(c.id || "")}">
            <div class="cfe-row-fields">
                <label class="cfe-wide">Clue<textarea data-f="text" rows="2">${esc(c.text)}</textarea></label>
                <label>Room<select data-f="roomId">${options(rooms, c.roomId || "", { blank: "— none —" })}</select></label>
                <label>Witness<select data-f="witness">${options(cast, c.witness || "", { blank: "— none —" })}</select></label>
            </div><button type="button" class="cfe-danger is-small" data-remove>REMOVE</button></div>`;
        const beatRow = (b = {}) => `<div class="cfe-row dgn-row" data-row="beat" data-id="${esc(b.id || "")}" data-attempts="${Number(b.attempts) || 0}">
            <div class="cfe-row-fields">
                <label class="cfe-wide">Moment<textarea data-f="text" rows="2">${esc(b.text)}</textarea></label>
                <label>Characters (comma-separated)<input data-f="characters" value="${esc((b.characters || []).join(", "))}"></label>
                <label class="cfe-check"><input type="checkbox" data-f="used"${b.used ? " checked" : ""}> Used</label>
                <label class="cfe-check"><input type="checkbox" data-f="skipped"${b.skipped ? " checked" : ""}> Set aside (offered ${Number(b.attempts) || 0}x)</label>
            </div><button type="button" class="cfe-danger is-small" data-remove>REMOVE</button></div>`;
        const witnessRow = (w = {}) => `<div class="cfe-row dgn-row" data-row="witness">
            <div class="cfe-row-fields">
                <label>Witness${w.told ? " ✓ told" : ""}<select data-f="name">${options(cast, w.name || "", { blank: "— pick —" })}</select></label>
                <label class="cfe-wide">What they saw or heard<textarea data-f="account" rows="2">${esc(w.account)}</textarea></label>
            </div><button type="button" class="cfe-danger is-small" data-remove>REMOVE</button></div>`;
        const concealedRow = (c = {}) => `<div class="cfe-row dgn-row" data-row="concealed">
            <div class="cfe-row-fields">
                <label>Hidden field<select data-f="field">${options(Object.entries(FILE_FIELD_LABELS).map(([value, label]) => ({ value, label })), c.field || "timeOfDeath", { blank: null })}</select></label>
                <label class="cfe-wide">The truth the file can't state<textarea data-f="truth" rows="2">${esc(c.truth)}</textarea></label>
            </div><button type="button" class="cfe-danger is-small" data-remove>REMOVE</button></div>`;
        const emergentRow = (c) => `<div class="cfe-row dgn-row" data-row="emergent" data-id="${esc(c.id)}" data-json="${esc(JSON.stringify(c))}">
            <div class="cfe-note dgn-note"><strong>${esc(c.title)}</strong>${c.roomId ? ` · ${esc(c.roomId)}` : ""}<br>${esc(c.text)}</div>
            <button type="button" class="cfe-danger is-small" data-remove>REMOVE</button></div>`;

        body.innerHTML = `
        <fieldset><legend>MOTIVE</legend><div class="cfe-grid">
            <label>Title<input data-k="motive.title" value="${esc(cf.motive.title)}"></label>
            <label>Deadline (night of day)<input type="number" min="1" data-k="motive.deadlineDay" value="${cf.motive.deadlineDay}"></label>
            <label class="cfe-wide">Description<textarea data-k="motive.description" rows="2">${esc(cf.motive.description)}</textarea></label>
            <label class="cfe-wide">Monokuma's announcement<textarea data-k="motive.announcement" rows="2">${esc(cf.motive.announcement)}</textarea></label>
            <label>Kind<select data-k="motive.kind">${options(Object.entries(MOTIVE_KINDS).map(([value, k]) => ({ value, label: k.label })), cf.motive.kind || "announcement", { blank: null })}</select></label>
            <label class="cfe-check"><input type="checkbox" data-motive-timelimit${cf.motive.timeLimit ? " checked" : ""}> Time limit (everyone dies if nobody kills)</label>
            <label class="cfe-wide">Penalty if nobody kills by the deadline<textarea data-k="motive.penalty" rows="2">${esc(cf.motive.penalty)}</textarea></label>
            <label class="cfe-wide" data-motive-kinds="object">Personal items (one per line: Owner | Item | What it shows | evidence)<textarea data-motive-items rows="4">${esc(Object.entries(cf.motive.items || {}).map(([owner, it]) => [owner, it.title, it.contents, it.evidence ? "evidence" : ""].filter(Boolean).join(" | ")).join("\n"))}</textarea></label>
            <div class="cfe-wide" data-motive-kinds="condition"><label>Afflicted</label><div class="cfe-chips dgn-pills">${cast.map((c) => `<label class="cfe-check"><input type="checkbox" data-afflicted value="${esc(c.value)}"${(cf.motive.afflicted || []).includes(c.value) ? " checked" : ""}> ${esc(c.value)}</label>`).join("")}</div></div>
            <label class="cfe-wide" data-motive-kinds="condition">What the condition does<textarea data-k="motive.effect" rows="2">${esc(cf.motive.effect)}</textarea></label>
            ${cf.attempts ? `<p class="cfe-note dgn-note cfe-wide" style="margin:0">Foiled attempts so far: ${cf.attempts}.</p>` : ""}
        </div></fieldset>

        <fieldset><legend>THE MURDER</legend><div class="cfe-grid">
            <label class="cfe-wide">Case shape<select data-k="shape">${options(Object.entries(CASE_SHAPES).map(([value, sh]) => ({ value, label: sh.label })), cf.shape || "standard", { blank: null })}</select></label>
            <p class="cfe-note dgn-note cfe-wide cfe-shape-line" style="margin:0"></p>
            <label data-hide-shapes="suicide">Killer<select data-k="killer">${options(cast, cf.killer, { blank: "— pick —" })}</select></label>
            <label>Victim<select data-k="victim">${options(cast, cf.victim, { blank: "— pick —" })}</select></label>
            <div class="cfe-blackened"></div>
            <label data-shapes="wrong_victim">Meant to kill<select data-k="intendedVictim">${options(cast, cf.intendedVictim || "", { blank: "— pick —" })}</select></label>
            <label data-shapes="decoy">Decoy (believes they did it)<select data-k="decoy">${options(cast, cf.decoy || "", { blank: "— pick —" })}</select></label>
            <div class="cfe-wide" data-shapes="accomplice"><label>Accomplices (not the blackened)</label><div class="cfe-chips dgn-pills">${cast.map((c) => `<label class="cfe-check"><input type="checkbox" data-accomplice value="${esc(c.value)}"${(cf.accomplices || []).includes(c.value) ? " checked" : ""}> ${esc(c.value)}</label>`).join("")}</div></div>
            <label>Day<input type="number" min="1" data-k="murderDay" value="${cf.murderDay}"></label>
            <label>Time<select data-k="murderTime">${options([{ value: "day", label: "Daytime" }, { value: "night", label: "Nighttime" }], cf.murderTime, { blank: null })}</select></label>
            <label>Style<select data-k="murderStyle">${options([{ value: "hidden", label: "Hidden (found later)" }, { value: "public", label: "Public (during a gathering)" }], cf.murderStyle, { blank: null })}</select></label>
            <label class="cfe-public-only">Gathering room<select data-k="gathering.roomId">${options(rooms, cf.gathering?.roomId || "", { blank: "— pick —" })}</select></label>
            <label class="cfe-wide cfe-public-only">Gathering<textarea data-k="gathering.description" rows="2">${esc(cf.gathering?.description)}</textarea></label>
            <label class="cfe-wide">Why the killer does it<textarea data-k="motiveLink" rows="2">${esc(cf.motiveLink)}</textarea></label>
            <label class="cfe-wide">Method<textarea data-k="method" rows="3">${esc(cf.method)}</textarea></label>
            <label>Weapon<input data-k="weapon" value="${esc(cf.weapon)}"></label>
            <label class="cfe-wide">Timeline (one event per line)<textarea data-k="timeline" rows="4">${esc(cf.timeline.join("\n"))}</textarea></label>
        </div></fieldset>

        <fieldset><legend>THE BODY &amp; MONOKUMA FILE</legend>
            <p class="cfe-note dgn-note">The file shows what Monokuma reports. If the killer's trick hides something, report "Unknown" or what it appears to be, and put the truth under Hidden truths: only the killer's character is ever told.</p>
            <div class="cfe-grid">
            <label>Body found in<select data-k="body.roomId">${options(rooms, cf.body.roomId, { blank: "— pick —" })}</select></label>
            <label class="cfe-wide">The scene<textarea data-k="body.state" rows="2">${esc(cf.body.state)}</textarea></label>
            <label>Time of death<input data-k="monokumaFile.timeOfDeath" value="${esc(cf.monokumaFile.timeOfDeath)}"></label>
            <label>Cause of death<input data-k="monokumaFile.cause" value="${esc(cf.monokumaFile.cause)}"></label>
            <label class="cfe-wide">Injuries and other details<input data-k="monokumaFile.injuries" value="${esc(cf.monokumaFile.injuries)}"></label>
        </div>
            <div data-list="concealed">${cf.monokumaFile.concealed.map(concealedRow).join("")}</div>
            <button type="button" data-add="concealed">+ HIDDEN TRUTH</button>
        </fieldset>

        <fieldset data-shapes="double"><legend>THE SECOND BODY</legend>
            <p class="cfe-note dgn-note">Found during the investigation of the first, with its own Monokuma File. The Class Trial is about the first victim.${cf.secondVictim?.discovered ? " Already found." : ""}</p>
            <div class="cfe-grid">
            <label>Second victim<select data-k="secondVictim.name">${options(cast, cf.secondVictim?.name || "", { blank: "— pick —" })}</select></label>
            <label>Killed by<select data-k="secondVictim.killer">${options(cast, cf.secondVictim?.killer || "", { blank: "— pick —" })}</select></label>
            <label>Body found in<select data-k="secondVictim.body.roomId">${options(rooms, cf.secondVictim?.body?.roomId || "", { blank: "— pick —" })}</select></label>
            <label class="cfe-wide">The scene<textarea data-k="secondVictim.body.state" rows="2">${esc(cf.secondVictim?.body?.state)}</textarea></label>
            <label>Time of death<input data-k="secondVictim.monokumaFile.timeOfDeath" value="${esc(cf.secondVictim?.monokumaFile?.timeOfDeath)}"></label>
            <label>Cause of death<input data-k="secondVictim.monokumaFile.cause" value="${esc(cf.secondVictim?.monokumaFile?.cause)}"></label>
            <label class="cfe-wide">Injuries and other details<input data-k="secondVictim.monokumaFile.injuries" value="${esc(cf.secondVictim?.monokumaFile?.injuries)}"></label>
            </div>
        </fieldset>

        <fieldset><legend>CLUES (ANCHORS)</legend>
            <p class="cfe-note dgn-note">Facts the story must make findable. More can turn up through the roleplay.</p>
            <div data-list="clue">${cf.clues.map(clueRow).join("")}</div>
            <button type="button" data-add="clue">+ CLUE</button>
        </fieldset>

        <fieldset><legend>FORESHADOWING</legend>
            <div data-list="beat">${cf.foreshadowing.map(beatRow).join("")}</div>
            <button type="button" data-add="beat">+ MOMENT</button>
        </fieldset>

        <fieldset><legend>WITNESSES</legend>
            <div data-list="witness">${cf.witnesses.map(witnessRow).join("")}</div>
            <button type="button" data-add="witness">+ WITNESS</button>
        </fieldset>

        ${cf.emergentClues.length ? `<fieldset><legend>FOUND DURING THE INVESTIGATION</legend>
            <div data-list="emergent">${cf.emergentClues.map(emergentRow).join("")}</div>
        </fieldset>` : ""}`;

        const rowMakers = { clue: clueRow, beat: beatRow, witness: witnessRow, concealed: concealedRow };
        body.querySelectorAll("[data-add]").forEach((btn) => btn.addEventListener("click", () => {
            const list = body.querySelector(`[data-list="${btn.dataset.add}"]`);
            list.insertAdjacentHTML("beforeend", rowMakers[btn.dataset.add]());
            dirty = true;
        }));
        body.addEventListener("click", (e) => {
            const remove = e.target.closest("[data-remove]");
            if (!remove) return;
            remove.closest(".cfe-row")?.remove();
            dirty = true;
        });
        body.addEventListener("input", () => { dirty = true; });
        const styleSelect = body.querySelector('[data-k="murderStyle"]');
        const syncStyle = () => body.querySelectorAll(".cfe-public-only").forEach((el) => { el.hidden = styleSelect.value !== "public"; });
        styleSelect.addEventListener("change", syncStyle);
        syncStyle();
        const kindSelect = body.querySelector('[data-k="motive.kind"]');
        const syncKind = () => body.querySelectorAll("[data-motive-kinds]").forEach((el) => { el.hidden = el.dataset.motiveKinds !== kindSelect.value; });
        kindSelect.addEventListener("change", syncKind);
        syncKind();
        // Each twist shows only the fields it uses.
        const shapeSelect = body.querySelector('[data-k="shape"]');
        const killerSelect = body.querySelector('[data-k="killer"]');
        const victimSelect = body.querySelector('[data-k="victim"]');
        const syncShape = () => {
            const shape = shapeSelect.value;
            body.querySelectorAll("[data-shapes]").forEach((el) => { el.hidden = !el.dataset.shapes.split(" ").includes(shape); });
            body.querySelectorAll("[data-hide-shapes]").forEach((el) => { el.hidden = el.dataset.hideShapes.split(" ").includes(shape); });
            body.querySelector(".cfe-shape-line").textContent = CASE_SHAPES[shape]?.about || "";
            const blackened = shape === "suicide" ? victimSelect.value : killerSelect.value;
            body.querySelector(".cfe-blackened").textContent = blackened ? `THE VOTE'S ANSWER: ${blackened.toUpperCase()}` : "";
            // The sections are numbered like the New Game steps, skipping hidden ones.
            [...body.querySelectorAll("fieldset")].filter((f) => !f.hidden).forEach((f, i) => {
                f.querySelector(":scope > legend")?.setAttribute("data-n", String(i + 1).padStart(2, "0"));
            });
        };
        [shapeSelect, killerSelect, victimSelect].forEach((el) => el.addEventListener("change", syncShape));
        syncShape();

        const errorEl = document.createElement("div");
        errorEl.className = "cfe-error";
        const planned = cf.status === "planned";
        const buttons = [errorEl];
        if (!isNew) {
            buttons.push(button("HIDE AGAIN", "", async () => {
                if (!(await confirmLeave())) return;
                api.setRevealed(false);
                render();
            }));
            buttons.push(button("CLEAR", "cfe-danger", async () => {
                const ok = await api.confirm({ title: "CLEAR THE CASE?", message: "The plan is thrown away. A missing victim comes back.", confirmLabel: "CLEAR" });
                if (!ok) return;
                await api.clear();
                render();
            }));
            if (planned) {
                buttons.push(button("REGENERATE", "", async () => {
                    const ok = await api.confirm({ title: "REGENERATE?", message: "Monokuma rethinks the murder: a new plan replaces this one, and the motive stays the same. Your edits are lost.", confirmLabel: "REGENERATE" });
                    if (!ok) return;
                    errorEl.textContent = "Generating…";
                    const err = await api.regenerate();
                    errorEl.textContent = err || "";
                    if (!err) render();
                }));
                buttons.push(button("COMMIT MURDER", "cfe-debug", async () => {
                    if (dirty && !(await confirmLeave())) return;
                    await api.commit();
                    render();
                }));
            }
            if (cf.status === "committed" && !cf.discovered) {
                buttons.push(button("FIND BODY", "cfe-debug", async () => {
                    if (dirty && !(await confirmLeave())) return;
                    close();
                    await api.discover();
                }));
            }
        }
        buttons.push(button("SAVE", "cfe-primary", async () => {
            const next = readForm();
            const err = await api.save(next, { isNew });
            errorEl.textContent = err || "";
            if (err) return;
            dirty = false;
            if (isNew) {
                const announce = await api.confirm({ title: "ANNOUNCE THE MOTIVE?", message: "Have Monokuma announce this motive now? Otherwise the case waits quietly.", confirmLabel: "ANNOUNCE", cancelLabel: "LATER" });
                if (announce) {
                    close();
                    await api.announce();
                    return;
                }
            }
            render();
        }));
        foot.replaceChildren(...buttons);
    }

    function readForm() {
        const next = JSON.parse(JSON.stringify(draft));
        body.querySelectorAll("[data-k]").forEach((el) => {
            const path = el.dataset.k.split(".");
            let node = next;
            for (const part of path.slice(0, -1)) node = node[part] ||= {};
            const key = path[path.length - 1];
            let value = el.value;
            if (el.type === "number") value = Number(value) || 0;
            if (el.dataset.k === "timeline") value = value.split("\n").map((l) => l.trim()).filter(Boolean);
            node[key] = value;
        });
        if (next.murderStyle !== "public") next.gathering = null;
        if (next.shape === "suicide") next.killer = next.victim;
        next.accomplices = [...body.querySelectorAll("[data-accomplice]:checked")].map((el) => el.value);
        next.motive.timeLimit = Boolean(body.querySelector("[data-motive-timelimit]")?.checked);
        next.motive.afflicted = [...body.querySelectorAll("[data-afflicted]:checked")].map((el) => el.value);
        next.motive.items = {};
        for (const line of (body.querySelector("[data-motive-items]")?.value || "").split("\n")) {
            const [owner, title, contents, flag] = line.split("|").map((p) => p.trim());
            if (owner && contents) next.motive.items[owner] = { title: title || "Motive", contents, evidence: /^evidence$/i.test(flag || "") };
        }
        const rows = (kind) => [...body.querySelectorAll(`[data-row="${kind}"]`)];
        const field = (row, f) => row.querySelector(`[data-f="${f}"]`);
        const foundIds = new Set(draft.clues.filter((c) => c.found).map((c) => c.id));
        next.clues = rows("clue").map((r) => ({ id: r.dataset.id || undefined, text: field(r, "text").value, roomId: field(r, "roomId").value, witness: field(r, "witness").value, found: foundIds.has(r.dataset.id) }));
        next.foreshadowing = rows("beat").map((r) => ({
            id: r.dataset.id || undefined,
            text: field(r, "text").value,
            characters: field(r, "characters").value.split(",").map((n) => n.trim()).filter(Boolean),
            used: field(r, "used").checked,
            skipped: field(r, "skipped").checked,
            attempts: Number(r.dataset.attempts) || 0,
        }));
        const toldNames = new Set(draft.witnesses.filter((w) => w.told).map((w) => w.name));
        next.witnesses = rows("witness").map((r) => ({ name: field(r, "name").value, account: field(r, "account").value, told: toldNames.has(field(r, "name").value) }));
        next.monokumaFile.concealed = rows("concealed").map((r) => ({ field: field(r, "field").value, truth: field(r, "truth").value }));
        next.emergentClues = rows("emergent").map((r) => JSON.parse(r.dataset.json));
        return next;
    }

    render();
    return { close };
}
