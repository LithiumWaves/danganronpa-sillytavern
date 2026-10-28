// The motive, editable without spoilers: its title, what Monokuma offers,
// the deadline, its kind, the penalty if nobody kills, and the player's own
// motive item. Nothing about who, how or when the murder is planned shows
// here, and nobody else's item or who is afflicted (those are in the gated
// Case File editor). index.js moves the hidden murder day with the deadline.

import { pushSkippable } from "../core/skip/skipRegistry.js";

const STYLE_ID = "dangan-mte-style";
const ROOT_ID = "dangan-mte";

// How many days past today the deadline can be set.
const DEADLINE_RANGE = 7;

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 100041;
    display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
    background: rgba(6, 2, 12, 0.78); font-family: inherit; color: #f1e6f7;
}
#${ROOT_ID} .mte-window {
    width: min(560px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 0%, rgba(46, 12, 58, 0.98), rgba(10, 4, 16, 0.99));
    border: 1px solid rgba(255, 46, 196, 0.5); border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 18px rgba(255, 46, 196, 0.15);
}
#${ROOT_ID} .mte-head { padding: 12px 16px; border-bottom: 1px solid rgba(255, 46, 196, 0.35); font-size: 1.15rem; letter-spacing: 0.12em; color: #ff2ec4; }
#${ROOT_ID} .mte-body { overflow: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
#${ROOT_ID} .mte-note { font-size: 0.8rem; color: #bfa9cc; margin: 0; line-height: 1.45; }
#${ROOT_ID} label { display: flex; flex-direction: column; gap: 3px; font-size: 0.75rem; letter-spacing: 0.06em; color: #d9c4e6; }
#${ROOT_ID} input, #${ROOT_ID} select, #${ROOT_ID} textarea {
    background: rgba(0, 0, 0, 0.45); color: #fff; border: 1px solid rgba(255, 182, 222, 0.35); border-radius: 4px;
    font: inherit; font-size: 0.9rem; padding: 6px 8px; width: 100%; box-sizing: border-box;
}
#${ROOT_ID} textarea { resize: vertical; min-height: 5em; }
#${ROOT_ID} label.mte-check { flex-direction: row; align-items: center; gap: 8px; }
#${ROOT_ID} label.mte-check input { width: auto; }
#${ROOT_ID} .mte-hidden { display: none; }
#${ROOT_ID} .mte-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; justify-content: flex-end; align-items: center; border-top: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} .mte-error { flex: 1; color: #ff8a8a; font-size: 0.82rem; }
#${ROOT_ID} button {
    background: transparent; color: #f1e6f7; border: 1px solid rgba(255, 182, 222, 0.6);
    font: inherit; font-size: 0.8rem; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; border-radius: 4px;
}
#${ROOT_ID} button:hover { background: rgba(255, 46, 196, 0.18); }
#${ROOT_ID} button.mte-primary { border-color: #ff2ec4; color: #fff; background: rgba(255, 46, 196, 0.32); }
@media (max-width: 600px) {
    #${ROOT_ID} { padding: 0; }
    #${ROOT_ID} .mte-window { max-height: 100vh; height: 100vh; border-radius: 0; }
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// api: { getMotive() → { title, description, deadlineDay, kind, penalty, timeLimit, effect },
//        getPlayerItem() → { title, contents } | null, today,
//        save({ title, description, deadlineDay, kind, penalty, timeLimit, effect, playerItem })
//          → Promise<string error | ""> }
export function openMotiveEditor(api) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();
    const motive = api.getMotive();
    const today = Math.max(1, Number(api.today) || 1);

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Edit motive");
    root.innerHTML = `<div class="mte-window">
        <div class="mte-head">EDIT MOTIVE</div>
        <div class="mte-body">
            <p class="mte-note">Only the motive itself is shown here, so nothing about the planned murder is spoiled. Moving the deadline moves the murder with it.</p>
            <label>MOTIVE<input class="mte-title" maxlength="80"></label>
            <label>WHAT MONOKUMA OFFERS OR THREATENS<textarea class="mte-desc" rows="4"></textarea></label>
            <label>DEADLINE<select class="mte-deadline"></select></label>
            <label>KIND<select class="mte-kind">
                <option value="announcement">Announcement (the same for everyone)</option>
                <option value="object">Personal items (DVDs, secrets, motive videos)</option>
                <option value="condition">Condition (an affliction, like Despair Disease)</option>
            </select></label>
            <label class="mte-item-title-row">YOUR ITEM<input class="mte-item-title" maxlength="120" placeholder="e.g. Your DVD"></label>
            <label class="mte-item-row">WHAT YOUR ITEM SHOWS<textarea class="mte-item" rows="3"></textarea></label>
            <label class="mte-effect-row">WHAT THE CONDITION DOES<textarea class="mte-effect" rows="2"></textarea></label>
            <label>IF NOBODY KILLS BY THE DEADLINE (MONOKUMA'S PENALTY)<textarea class="mte-penalty" rows="3"></textarea></label>
            <label class="mte-check"><input type="checkbox" class="mte-timelimit">A time limit: everyone dies if nobody kills (you'll be asked before it plays out)</label>
        </div>
        <div class="mte-foot"><span class="mte-error"></span><button type="button" class="mte-cancel">CANCEL</button><button type="button" class="mte-primary mte-save">SAVE</button></div>
    </div>`;
    document.body.appendChild(root);

    const title = root.querySelector(".mte-title");
    const desc = root.querySelector(".mte-desc");
    const deadline = root.querySelector(".mte-deadline");
    const error = root.querySelector(".mte-error");
    const kind = root.querySelector(".mte-kind");
    const itemTitle = root.querySelector(".mte-item-title");
    const item = root.querySelector(".mte-item");
    const effect = root.querySelector(".mte-effect");
    const penalty = root.querySelector(".mte-penalty");
    const timeLimit = root.querySelector(".mte-timelimit");
    title.value = motive.title || "";
    desc.value = motive.description || "";
    kind.value = motive.kind || "announcement";
    const playerItem = api.getPlayerItem?.() || null;
    itemTitle.value = playerItem?.title || "";
    item.value = playerItem?.contents || "";
    effect.value = motive.effect || "";
    penalty.value = motive.penalty || "";
    timeLimit.checked = Boolean(motive.timeLimit);
    const showKindRows = () => {
        for (const sel of [".mte-item-title-row", ".mte-item-row"]) root.querySelector(sel).classList.toggle("mte-hidden", kind.value !== "object");
        root.querySelector(".mte-effect-row").classList.toggle("mte-hidden", kind.value !== "condition");
    };
    kind.addEventListener("change", showKindRows);
    showKindRows();
    const current = Number(motive.deadlineDay) || today;
    const last = Math.max(current, today + DEADLINE_RANGE - 1);
    for (let day = Math.min(today, current); day <= last; day += 1) {
        const o = document.createElement("option");
        o.value = String(day);
        o.textContent = `Night of Day ${day}${day === today ? " (tonight)" : ""}`;
        o.disabled = day < today;
        if (day === current) o.selected = true;
        deadline.appendChild(o);
    }

    const close = () => {
        release();
        root.remove();
    };
    const release = pushSkippable({ kind: "minigame", skip: () => close() });
    root.querySelector(".mte-cancel").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    const saveBtn = root.querySelector(".mte-save");
    saveBtn.addEventListener("click", async () => {
        if (!title.value.trim()) {
            error.textContent = "The motive needs a name.";
            return;
        }
        saveBtn.disabled = true;
        try {
            const message = await api.save({
                title: title.value,
                description: desc.value,
                deadlineDay: Number(deadline.value),
                kind: kind.value,
                penalty: penalty.value,
                timeLimit: timeLimit.checked,
                effect: effect.value,
                ...(kind.value === "object" ? { playerItem: { title: itemTitle.value, contents: item.value } } : {}),
            });
            if (message) error.textContent = message;
            else close();
        } finally {
            saveBtn.disabled = false;
        }
    });
    title.focus();
    return { close };
}
