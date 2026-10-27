// Character routines (Social tab → ROUTINES): where each classmate usually is
// during the day and at night. The overworld shuffle mostly follows them, and
// the case plan builds its alibis on them. Each change is saved at once.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { clearRoutine, getRoutine, normalizeRoutines, setRoutine } from "../overworld/routines.js";

const STYLE_ID = "dangan-rtv-style";
const ROOT_ID = "dangan-rtv";

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 100040;
    display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
    background: rgba(6, 2, 12, 0.78); font-family: inherit; color: #f1e6f7;
}
#${ROOT_ID} .rtv-window {
    width: min(900px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column;
    background: radial-gradient(ellipse at 50% 0%, rgba(46, 12, 58, 0.98), rgba(10, 4, 16, 0.99));
    border: 1px solid rgba(255, 46, 196, 0.5); border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 18px rgba(255, 46, 196, 0.15);
}
#${ROOT_ID} .rtv-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} .rtv-title { font-size: 1.15rem; letter-spacing: 0.12em; color: #ff2ec4; flex: 1; }
#${ROOT_ID} .rtv-body { overflow: auto; padding: 14px 16px; }
#${ROOT_ID} .rtv-note { font-size: 0.8rem; color: #bfa9cc; margin: 0 0 10px; line-height: 1.45; }
#${ROOT_ID} .rtv-row {
    display: grid; grid-template-columns: minmax(140px, 0.8fr) 1fr 1fr auto; gap: 10px; align-items: start;
    padding: 8px; margin-bottom: 6px; background: rgba(255, 255, 255, 0.03); border-radius: 4px;
}
#${ROOT_ID} .rtv-name { font-weight: 700; padding-top: 4px; }
#${ROOT_ID} .rtv-ult { display: block; font-size: 0.72rem; color: #bfa9cc; font-weight: 400; }
#${ROOT_ID} .rtv-slot-label { font-size: 0.68rem; letter-spacing: 0.1em; color: #ffd23f; margin-bottom: 4px; }
#${ROOT_ID} .rtv-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
#${ROOT_ID} .rtv-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 8px; font-size: 0.78rem;
    border: 1px solid rgba(255, 46, 196, 0.6); border-radius: 999px; background: rgba(255, 46, 196, 0.16);
}
#${ROOT_ID} .rtv-chip button { border: 0; padding: 0 4px; font-size: 0.85rem; line-height: 1; }
#${ROOT_ID} select {
    background: rgba(0, 0, 0, 0.45); color: #fff; border: 1px solid rgba(255, 182, 222, 0.35); border-radius: 999px;
    font: inherit; font-size: 0.76rem; padding: 2px 6px; max-width: 150px;
}
#${ROOT_ID} .rtv-empty { text-align: center; padding: 18px; color: #bfa9cc; }
#${ROOT_ID} .rtv-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; justify-content: flex-end; align-items: center; border-top: 1px solid rgba(255, 46, 196, 0.35); }
#${ROOT_ID} .rtv-status { flex: 1; font-size: 0.8rem; color: #ffd23f; }
#${ROOT_ID} .rtv-status.rtv-error { color: #ff8a8a; }
#${ROOT_ID} button {
    background: transparent; color: #f1e6f7; border: 1px solid rgba(255, 182, 222, 0.6);
    font: inherit; font-size: 0.8rem; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; border-radius: 4px;
}
#${ROOT_ID} button:hover { background: rgba(255, 46, 196, 0.18); }
#${ROOT_ID} button:disabled { opacity: 0.5; cursor: wait; }
#${ROOT_ID} button.rtv-primary { border-color: #ff2ec4; color: #fff; background: rgba(255, 46, 196, 0.32); }
#${ROOT_ID} button.rtv-danger { border-color: rgba(255, 80, 80, 0.7); color: #ff8a8a; }
@media (max-width: 700px) {
    #${ROOT_ID} { padding: 0; }
    #${ROOT_ID} .rtv-window { max-height: 100vh; height: 100vh; border-radius: 0; }
    #${ROOT_ID} .rtv-row { grid-template-columns: 1fr; }
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// api: { getCast() → [{ name, ultimate }], getRooms() → [{ id, label }],
//        getRoutines(), setRoutines(routines),
//        suggest() → Promise<{ added: number, error?: string }> }
export function openRoutinesView(api) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Routines");
    root.innerHTML = `<div class="rtv-window">
        <div class="rtv-head"><div class="rtv-title">ROUTINES</div><button type="button" class="rtv-close">CLOSE</button></div>
        <div class="rtv-body">
            <p class="rtv-note">Where each classmate usually spends their time. When time passes, people mostly turn up in one of their rooms (dorm rooms never take visitors), and a new murder plan builds its alibis on these. Anyone can still be anywhere.</p>
            <div class="rtv-list"></div>
        </div>
        <div class="rtv-foot"><span class="rtv-status"></span><button type="button" class="rtv-primary rtv-suggest">SUGGEST FROM CARDS</button></div>
    </div>`;
    document.body.appendChild(root);

    const list = root.querySelector(".rtv-list");
    const status = root.querySelector(".rtv-status");
    const close = () => {
        release();
        root.remove();
    };
    const release = pushSkippable({ kind: "minigame", skip: () => close() });

    const update = (fn) => {
        api.setRoutines(normalizeRoutines(fn(api.getRoutines())));
        render();
    };

    function slot(name, which, label, rooms, routine) {
        const wrap = document.createElement("div");
        const head = document.createElement("div");
        head.className = "rtv-slot-label";
        head.textContent = label;
        const chips = document.createElement("div");
        chips.className = "rtv-chips";
        const labelOf = new Map(rooms.map((r) => [r.id, r.label]));
        for (const id of routine[which]) {
            const chip = document.createElement("span");
            chip.className = "rtv-chip";
            chip.textContent = labelOf.get(id) || `${id} (missing)`;
            const x = document.createElement("button");
            x.type = "button";
            x.textContent = "×";
            x.setAttribute("aria-label", "Remove");
            x.addEventListener("click", () => update((r) => setRoutine(r, name, { [which]: getRoutine(r, name)[which].filter((v) => v !== id) })));
            chip.appendChild(x);
            chips.appendChild(chip);
        }
        const free = rooms.filter((r) => !routine[which].includes(r.id));
        if (free.length) {
            const pick = document.createElement("select");
            pick.innerHTML = `<option value="">+ room</option>`;
            for (const r of free) {
                const o = document.createElement("option");
                o.value = r.id;
                o.textContent = r.label;
                pick.appendChild(o);
            }
            pick.addEventListener("change", () => {
                if (pick.value) update((r) => setRoutine(r, name, { [which]: [...getRoutine(r, name)[which], pick.value] }));
            });
            chips.appendChild(pick);
        }
        wrap.append(head, chips);
        return wrap;
    }

    function render() {
        const cast = api.getCast();
        const rooms = api.getRooms();
        const routines = api.getRoutines();
        list.replaceChildren();
        if (!cast.length) {
            const empty = document.createElement("div");
            empty.className = "rtv-empty";
            empty.textContent = "No living classmates on the roster.";
            list.appendChild(empty);
            return;
        }
        for (const c of cast) {
            const routine = getRoutine(routines, c.name);
            const row = document.createElement("div");
            row.className = "rtv-row";
            const name = document.createElement("div");
            name.className = "rtv-name";
            name.textContent = c.name;
            if (c.ultimate) {
                const ult = document.createElement("span");
                ult.className = "rtv-ult";
                ult.textContent = `Ultimate ${c.ultimate}`;
                name.appendChild(ult);
            }
            const clear = document.createElement("button");
            clear.type = "button";
            clear.className = "rtv-danger";
            clear.textContent = "CLEAR";
            clear.disabled = !routine.day.length && !routine.night.length;
            clear.addEventListener("click", () => update((r) => clearRoutine(r, c.name)));
            row.append(name, slot(c.name, "day", "DAYTIME", rooms, routine), slot(c.name, "night", "NIGHTTIME", rooms, routine), clear);
            list.appendChild(row);
        }
    }

    const suggestBtn = root.querySelector(".rtv-suggest");
    suggestBtn.addEventListener("click", async () => {
        suggestBtn.disabled = true;
        status.classList.remove("rtv-error");
        status.textContent = "Asking the AI…";
        try {
            const { added = 0, error = "" } = (await api.suggest()) || {};
            status.classList.toggle("rtv-error", Boolean(error));
            status.textContent = error || (added ? `Filled ${added} routine${added === 1 ? "" : "s"}. Hand-set ones were kept.` : "Everyone already has a routine.");
        } catch (e) {
            status.classList.add("rtv-error");
            status.textContent = `Couldn't suggest routines: ${e?.message || e}`;
        } finally {
            suggestBtn.disabled = false;
            if (root.isConnected) render();
        }
    });
    root.querySelector(".rtv-close").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });

    render();
    return { close, refresh: render };
}
