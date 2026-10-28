// Group events (Social tab → EVENTS): get-togethers classmates proposed in the
// roleplay, ones the morning brought, and ones the player planned. ATTEND
// asks to be taken there when it starts; CANCEL calls it off. PLAN EVENT
// (also in the Phase HUD menu) opens the small planner below.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { EVENT_STATUS, describeWhen, slotRank } from "../core/events/groupEvents.js";

const STYLE_ID = "dangan-evv-style";
const ROOT_ID = "dangan-evv";
const PLAN_ID = "dangan-evp";

// The look comes from styles/systems/dossier/dossier.css; this is layout only.
const CSS = `
#${PLAN_ID} { z-index: 100042; }
.evv-list { display: flex; flex-direction: column; gap: 8px; }
.evv-section { display: flex; align-items: center; gap: 10px; margin-top: 6px; font: 600 12px "Orbitron", sans-serif; letter-spacing: 0.18em; color: #fff; }
.evv-section::after { content: ""; flex: 1; height: 1px; background: var(--dgn-line); }
.evv-row { display: grid; grid-template-columns: 92px 1fr auto; gap: 12px; align-items: center; }
.evv-when {
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 4px;
    background: var(--dgn-ink); clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    font: 600 11px "Rajdhani", sans-serif; letter-spacing: 0.16em; color: var(--dgn-muted);
}
.evv-when b { font: 400 22px/1.1 "Bruno Ace", sans-serif; letter-spacing: 0.04em; color: var(--dgn-pink); }
.evv-when.is-night b { color: #9fb6ff; }
.evv-name { font: 400 16px "Bruno Ace", "Orbitron", sans-serif; letter-spacing: 0.05em; color: #fff; }
.evv-meta { display: block; margin-top: 3px; color: var(--dgn-muted); font-size: 14px; }
.evv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.evv-tags:empty { display: none; }
.evv-actions { display: flex; flex-direction: column; gap: 6px; }
.evv-past .dgn-stamp { justify-self: end; }
#${PLAN_ID} .evv-chips[hidden] { display: none; }
#${PLAN_ID} .evp-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
@media (max-width: 600px) {
    .evv-row { grid-template-columns: 74px 1fr; }
    .evv-actions, .evv-past .dgn-stamp { grid-column: 1 / -1; flex-direction: row; justify-self: start; }
    #${PLAN_ID} .evp-pair { grid-template-columns: 1fr; }
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// api: { getEvents() → events, getNow() → { day, time },
//        setAttending(id, going), cancel(id), plan() }
export function openEventsView(api) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();

    const root = el("div");
    root.id = ROOT_ID;
    root.className = "dgn-sheet";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Events");
    root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="evv-window dgn-sheet-window is-medium">
        <div class="evv-head dgn-sheet-head"><div class="evv-title dgn-sheet-title">EVENTS</div><span class="evv-count dgn-sheet-tag"></span><button type="button" class="evv-close dgn-sheet-close">CLOSE</button></div>
        <div class="evv-body dgn-sheet-body">
            <p class="evv-note dgn-note">Get-togethers your classmates planned in the story, or that you planned. When one starts, everyone invited gathers in its room; if you're attending, you're offered a way there.</p>
            <div class="evv-list"></div>
        </div>
        <div class="evv-foot dgn-sheet-foot"><button type="button" class="evv-primary evv-plan">PLAN EVENT</button></div>
    </div>`;
    document.body.appendChild(root);

    const list = root.querySelector(".evv-list");
    const close = () => {
        release();
        root.remove();
    };
    const release = pushSkippable({ kind: "minigame", skip: () => close() });

    function row(ev, { past }) {
        const item = el("div", `evv-row dgn-row${past ? " evv-past is-dim" : ""}`);
        // The day and time as a block on the left.
        const when = el("div", `evv-when${ev.time === "night" ? " is-night" : ""}`);
        when.append(el("span", "", "DAY"), el("b", "", String(ev.day)), el("span", "", ev.time === "night" ? "NIGHT" : "DAYTIME"));
        const info = el("div", "evv-info");
        info.appendChild(el("div", "evv-name", ev.title));
        info.appendChild(el("span", "evv-meta", `${ev.roomLabel}${ev.host ? ` · hosted by ${ev.host}` : ""}`));
        const tags = el("div", "evv-tags");
        tags.appendChild(el("span", "dgn-chip is-muted", ev.attendees.length ? `INVITED: ${ev.attendees.join(", ")}` : "EVERYONE INVITED"));
        if (!past && ev.playerAttending) tags.appendChild(el("span", "dgn-chip is-green", "✔ YOU'RE GOING"));
        info.appendChild(tags);
        item.append(when, info);
        if (past) {
            item.appendChild(el("span", "dgn-stamp is-small", ev.status === EVENT_STATUS.CANCELLED ? "CANCELLED" : "OVER"));
        } else {
            const actions = el("div", "evv-actions");
            const attend = el("button", ev.playerAttending ? "is-small" : "evv-primary is-small", ev.playerAttending ? "NOT GOING" : "ATTEND");
            attend.type = "button";
            attend.addEventListener("click", () => { api.setAttending(ev.id, !ev.playerAttending); render(); });
            const cancel = el("button", "evv-danger is-small", "CANCEL");
            cancel.type = "button";
            cancel.addEventListener("click", () => { api.cancel(ev.id); render(); });
            actions.append(attend, cancel);
            item.appendChild(actions);
        }
        return item;
    }

    function render() {
        const { day, time } = api.getNow();
        const now = slotRank(day, time);
        const events = api.getEvents();
        const upcoming = events.filter((e) => e.status === EVENT_STATUS.PLANNED && slotRank(e.day, e.time) >= now)
            .sort((a, b) => slotRank(a.day, a.time) - slotRank(b.day, b.time));
        const past = events.filter((e) => !upcoming.includes(e)).slice(-10).reverse();
        list.replaceChildren();
        root.querySelector(".evv-count").textContent = upcoming.length ? `${upcoming.length} COMING UP` : "";
        list.appendChild(el("div", "evv-section", "COMING UP"));
        if (!upcoming.length) list.appendChild(el("div", "evv-empty dgn-empty", "Nothing planned."));
        upcoming.forEach((ev) => list.appendChild(row(ev, { past: false })));
        if (past.length) {
            list.appendChild(el("div", "evv-section", "EARLIER"));
            past.forEach((ev) => list.appendChild(row(ev, { past: true })));
        }
    }

    root.querySelector(".evv-close").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    root.querySelector(".evv-plan").addEventListener("click", async () => {
        await api.plan();
        if (root.isConnected) render();
    });
    render();
    return { close, render };
}

// The small planner. api: { getRooms() → [{ id, label }], getCast() → [names],
//   getNow() → { day, time }, host, save(values) → Promise<string error | ""> }
// Resolves once it's closed (true when an event was saved).
export function openPlanEventDialog(api) {
    ensureStyle();
    document.getElementById(PLAN_ID)?.remove();
    return new Promise((resolve) => {
        const root = el("div");
        root.id = PLAN_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Plan event");
        root.className = "dgn-sheet";
        root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="evv-window dgn-sheet-window is-narrow">
            <div class="evv-head dgn-sheet-head"><div class="evv-title dgn-sheet-title">PLAN EVENT</div></div>
            <div class="evv-body dgn-sheet-body">
                <p class="evv-note dgn-note">Invite your classmates to a get-together. They'll gather in the room when its time comes, and the story will know about it.</p>
                <label>WHAT<input class="evp-title" maxlength="120" placeholder="e.g. Movie night"></label>
                <div class="evp-pair">
                    <label>WHERE<select class="evp-room"></select></label>
                    <label>WHEN<select class="evp-when"></select></label>
                </div>
                <label class="evv-check"><input type="checkbox" class="evp-everyone" checked> Invite everyone</label>
                <div class="evv-chips evp-people dgn-pills"></div>
            </div>
            <div class="evv-foot dgn-sheet-foot"><span class="evv-error"></span><button type="button" class="evp-cancel">CANCEL</button><button type="button" class="evv-primary evp-save">PLAN</button></div>
        </div>`;
        document.body.appendChild(root);

        const title = root.querySelector(".evp-title");
        const room = root.querySelector(".evp-room");
        const when = root.querySelector(".evp-when");
        const everyone = root.querySelector(".evp-everyone");
        const people = root.querySelector(".evp-people");
        const error = root.querySelector(".evv-error");
        for (const r of api.getRooms()) {
            const o = el("option", "", r.label);
            o.value = r.id;
            room.appendChild(o);
        }
        const { day, time } = api.getNow();
        for (let rank = time === "night" ? 1 : 0, n = 0; n < 6; rank += 1, n += 1) {
            const d = day + Math.floor(rank / 2);
            const t = rank % 2 ? "night" : "day";
            const o = el("option", "", `Day ${d} ${t === "night" ? "night" : "daytime"}${n === 0 ? " (now)" : ""}`);
            o.value = `${d}|${t}`;
            when.appendChild(o);
        }
        for (const name of api.getCast()) {
            const label = el("label", "evv-check");
            const box = el("input");
            box.type = "checkbox";
            box.value = name;
            label.append(box, document.createTextNode(` ${name}`));
            people.appendChild(label);
        }
        const syncPeople = () => { people.hidden = everyone.checked; };
        everyone.addEventListener("change", syncPeople);
        syncPeople();

        const close = (saved) => {
            release();
            root.remove();
            resolve(saved);
        };
        const release = pushSkippable({ kind: "minigame", skip: () => close(false) });
        root.querySelector(".evp-cancel").addEventListener("click", () => close(false));
        root.addEventListener("click", (e) => { if (e.target === root) close(false); });
        const saveBtn = root.querySelector(".evp-save");
        saveBtn.addEventListener("click", async () => {
            if (!title.value.trim()) { error.textContent = "Give the event a name."; return; }
            if (!room.value) { error.textContent = "Pick a room."; return; }
            const invited = everyone.checked ? [] : [...people.querySelectorAll("input:checked")].map((b) => b.value);
            if (!everyone.checked && !invited.length) { error.textContent = "Invite someone."; return; }
            const [d, t] = when.value.split("|");
            saveBtn.disabled = true;
            try {
                const message = await api.save({ title: title.value.trim(), roomId: room.value, day: Number(d), time: t, attendees: invited, host: api.host || "" });
                if (message) error.textContent = message;
                else close(true);
            } finally {
                saveBtn.disabled = false;
            }
        });
        title.focus();
    });
}
