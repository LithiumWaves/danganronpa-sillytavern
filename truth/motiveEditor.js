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

// The look comes from styles/systems/dossier/dossier.css; this is layout only.
const CSS = `
#${ROOT_ID} { z-index: 100041; }
#${ROOT_ID} .mte-kind { display: none; }
#${ROOT_ID} .mte-kinds { display: flex; flex-wrap: wrap; }
#${ROOT_ID} .mte-kind-about { margin-top: 6px; font: 500 14px "Rajdhani", sans-serif; letter-spacing: 0.02em; text-transform: none; color: var(--dgn-muted); }
#${ROOT_ID} .mte-hidden { display: none; }
#${ROOT_ID} .mte-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
#${ROOT_ID} .mte-penalty-box { padding: 12px; background: rgba(179, 0, 63, 0.12); border-left: 3px solid #b3003f; display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 600px) {
    #${ROOT_ID} .mte-pair { grid-template-columns: 1fr; }
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
    root.className = "dgn-sheet";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Edit motive");
    root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="mte-window dgn-sheet-window is-narrow">
        <div class="mte-head dgn-sheet-head"><div class="dgn-sheet-title">EDIT MOTIVE</div><span class="dgn-sheet-tag">NO SPOILERS</span></div>
        <div class="mte-body dgn-sheet-body">
            <p class="mte-note dgn-note">Only the motive itself is shown here, so nothing about the planned murder is spoiled. Moving the deadline moves the murder with it.</p>
            <div class="mte-pair">
                <label>MOTIVE<input class="mte-title" maxlength="80"></label>
                <label>DEADLINE<select class="mte-deadline"></select></label>
            </div>
            <label>WHAT MONOKUMA OFFERS OR THREATENS<textarea class="mte-desc" rows="3"></textarea></label>
            <div class="dgn-field"><span class="dgn-label">KIND</span><div class="mte-kinds dgn-switch"></div><span class="mte-kind-about"></span><select class="mte-kind">
                <option value="announcement">Announcement (the same for everyone)</option>
                <option value="object">Personal items (DVDs, secrets, motive videos)</option>
                <option value="condition">Condition (an affliction, like Despair Disease)</option>
            </select></div>
            <label class="mte-item-title-row">YOUR ITEM<input class="mte-item-title" maxlength="120" placeholder="e.g. Your DVD"></label>
            <label class="mte-item-row">WHAT YOUR ITEM SHOWS<textarea class="mte-item" rows="3"></textarea></label>
            <label class="mte-effect-row">WHAT THE CONDITION DOES<textarea class="mte-effect" rows="2"></textarea></label>
            <div class="mte-penalty-box">
                <label>IF NOBODY KILLS BY THE DEADLINE (MONOKUMA'S PENALTY)<textarea class="mte-penalty" rows="2"></textarea></label>
                <label class="mte-check"><input type="checkbox" class="mte-timelimit">A time limit: everyone dies if nobody kills (you'll be asked before it plays out)</label>
            </div>
        </div>
        <div class="mte-foot dgn-sheet-foot"><span class="mte-error"></span><button type="button" class="mte-cancel">CANCEL</button><button type="button" class="mte-primary mte-save">SAVE</button></div>
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
    // KIND as three slanted tabs over the (hidden) select.
    const KIND_TABS = { announcement: ["ANNOUNCEMENT", "The same offer or threat for everyone."], object: ["PERSONAL ITEMS", "Everyone gets their own item with hidden contents: DVDs, secrets, motive videos."], condition: ["CONDITION", "Some students are afflicted until the case closes, like the Despair Disease."] };
    const tabs = root.querySelector(".mte-kinds");
    const about = root.querySelector(".mte-kind-about");
    const syncTabs = () => {
        tabs.querySelectorAll("button").forEach((b) => {
            const on = b.dataset.kind === kind.value;
            b.classList.toggle("is-on", on);
            b.setAttribute("aria-pressed", String(on));
        });
        about.textContent = KIND_TABS[kind.value]?.[1] || "";
    };
    for (const [value, [label]] of Object.entries(KIND_TABS)) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.kind = value;
        b.textContent = label;
        b.addEventListener("click", () => {
            kind.value = value;
            kind.dispatchEvent(new Event("change"));
            syncTabs();
        });
        tabs.appendChild(b);
    }
    syncTabs();
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
