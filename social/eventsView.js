// Group events (Social tab → EVENTS): get-togethers classmates proposed in the
// roleplay, ones the morning brought, and ones the player planned. ATTEND
// asks to be taken there when it starts; CANCEL calls it off. PLAN EVENT
// (also in the Phase HUD menu) opens the small planner below.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { EVENT_STATUS, describeWhen, slotRank } from "../core/events/groupEvents.js";

const STYLE_ID = "dangan-evv-style";
const ROOT_ID = "dangan-evv";
const PLAN_ID = "dangan-evp";

const CSS = `
#${ROOT_ID}, #${PLAN_ID} {
    position: fixed; inset: 0; z-index: 100040;
    display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
    background: rgba(6, 2, 12, 0.78); font-family: inherit; color: #f1e6f7;
}
#${PLAN_ID} { z-index: 100042; }
#${ROOT_ID} .evv-window, #${PLAN_ID} .evv-window {
    width: min(720px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 0%, rgba(46, 12, 58, 0.98), rgba(10, 4, 16, 0.99));
    border: 1px solid rgba(255, 46, 196, 0.5); border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 18px rgba(255, 46, 196, 0.15);
}
#${PLAN_ID} .evv-window { width: min(520px, 100%); }
.evv-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255, 46, 196, 0.35); }
.evv-title { font-size: 1.15rem; letter-spacing: 0.12em; color: #ff2ec4; flex: 1; }
.evv-body { overflow: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.evv-note { font-size: 0.8rem; color: #bfa9cc; margin: 0; line-height: 1.45; }
.evv-section { font-size: 0.7rem; letter-spacing: 0.12em; color: #ffd23f; margin-top: 6px; }
.evv-row {
    display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center;
    padding: 8px 10px; background: rgba(255, 255, 255, 0.03); border-radius: 4px;
}
.evv-row.evv-past { opacity: 0.55; }
.evv-info { flex: 1; min-width: 200px; }
.evv-name { font-weight: 700; }
.evv-meta { display: block; font-size: 0.75rem; color: #bfa9cc; margin-top: 2px; }
.evv-going { color: #7dffb0; }
.evv-empty { text-align: center; padding: 18px; color: #bfa9cc; }
.evv-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; justify-content: flex-end; align-items: center; border-top: 1px solid rgba(255, 46, 196, 0.35); }
.evv-error { flex: 1; color: #ff8a8a; font-size: 0.82rem; }
#${PLAN_ID} label { display: flex; flex-direction: column; gap: 3px; font-size: 0.75rem; letter-spacing: 0.06em; color: #d9c4e6; }
#${PLAN_ID} input, #${PLAN_ID} select {
    background: rgba(0, 0, 0, 0.45); color: #fff; border: 1px solid rgba(255, 182, 222, 0.35); border-radius: 4px;
    font: inherit; font-size: 0.9rem; padding: 6px 8px; width: 100%; box-sizing: border-box;
}
#${PLAN_ID} .evv-chips { display: flex; flex-wrap: wrap; gap: 6px 12px; }
#${PLAN_ID} .evv-chips[hidden] { display: none; }
#${PLAN_ID} label.evv-check { flex-direction: row; align-items: center; gap: 6px; font-size: 0.82rem; letter-spacing: 0; }
#${PLAN_ID} label.evv-check input { width: auto; }
#${ROOT_ID} button, #${PLAN_ID} button {
    background: transparent; color: #f1e6f7; border: 1px solid rgba(255, 182, 222, 0.6);
    font: inherit; font-size: 0.8rem; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; border-radius: 4px;
}
#${ROOT_ID} button:hover, #${PLAN_ID} button:hover { background: rgba(255, 46, 196, 0.18); }
#${ROOT_ID} button.evv-primary, #${PLAN_ID} button.evv-primary { border-color: #ff2ec4; color: #fff; background: rgba(255, 46, 196, 0.32); }
#${ROOT_ID} button.evv-danger { border-color: rgba(255, 80, 80, 0.7); color: #ff8a8a; }
@media (max-width: 700px) {
    #${ROOT_ID}, #${PLAN_ID} { padding: 0; }
    #${ROOT_ID} .evv-window, #${PLAN_ID} .evv-window { max-height: 100vh; height: 100vh; border-radius: 0; }
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
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Events");
    root.innerHTML = `<div class="evv-window">
        <div class="evv-head"><div class="evv-title">EVENTS</div><button type="button" class="evv-close">CLOSE</button></div>
        <div class="evv-body">
            <p class="evv-note">Get-togethers your classmates planned in the story, or that you planned. When one starts, everyone invited gathers in its room; if you're attending, you're offered a way there.</p>
            <div class="evv-list"></div>
        </div>
        <div class="evv-foot"><button type="button" class="evv-primary evv-plan">PLAN EVENT</button></div>
    </div>`;
    document.body.appendChild(root);

    const list = root.querySelector(".evv-list");
    const close = () => {
        release();
        root.remove();
    };
    const release = pushSkippable({ kind: "minigame", skip: () => close() });

    function row(ev, { past }) {
        const item = el("div", `evv-row${past ? " evv-past" : ""}`);
        const info = el("div", "evv-info");
        info.appendChild(el("div", "evv-name", ev.title));
        const meta = el("span", "evv-meta", `${ev.roomLabel} · ${describeWhen(ev)}${ev.host ? ` · hosted by ${ev.host}` : ""} · ${ev.attendees.length ? `invited: ${ev.attendees.join(", ")}` : "everyone invited"}${past ? ` · ${ev.status === EVENT_STATUS.CANCELLED ? "cancelled" : "over"}` : ""}`);
        info.appendChild(meta);
        if (!past && ev.playerAttending) info.appendChild(el("span", "evv-meta evv-going", "You're going."));
        item.appendChild(info);
        if (!past) {
            const attend = el("button", ev.playerAttending ? "" : "evv-primary", ev.playerAttending ? "NOT GOING" : "ATTEND");
            attend.type = "button";
            attend.addEventListener("click", () => { api.setAttending(ev.id, !ev.playerAttending); render(); });
            const cancel = el("button", "evv-danger", "CANCEL");
            cancel.type = "button";
            cancel.addEventListener("click", () => { api.cancel(ev.id); render(); });
            item.append(attend, cancel);
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
        list.appendChild(el("div", "evv-section", "COMING UP"));
        if (!upcoming.length) list.appendChild(el("div", "evv-empty", "Nothing planned."));
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
        root.innerHTML = `<div class="evv-window">
            <div class="evv-head"><div class="evv-title">PLAN EVENT</div></div>
            <div class="evv-body">
                <p class="evv-note">Invite your classmates to a get-together. They'll gather in the room when its time comes, and the story will know about it.</p>
                <label>WHAT<input class="evp-title" maxlength="120" placeholder="e.g. Movie night"></label>
                <label>WHERE<select class="evp-room"></select></label>
                <label>WHEN<select class="evp-when"></select></label>
                <label class="evv-check"><input type="checkbox" class="evp-everyone" checked> Invite everyone</label>
                <div class="evv-chips evp-people"></div>
            </div>
            <div class="evv-foot"><span class="evv-error"></span><button type="button" class="evp-cancel">CANCEL</button><button type="button" class="evv-primary evp-save">PLAN</button></div>
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
