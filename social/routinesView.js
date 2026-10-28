// Character routines (Social tab → ROUTINES): where each classmate usually is
// during the day and at night. The overworld shuffle mostly follows them, and
// the case plan builds its alibis on them. Each change is saved at once.

import { pushSkippable } from "../core/skip/skipRegistry.js";
import { clearRoutine, getRoutine, normalizeRoutines, setRoutine } from "../overworld/routines.js";

const STYLE_ID = "dangan-rtv-style";
const ROOT_ID = "dangan-rtv";

// The look comes from styles/systems/dossier/dossier.css; this is layout only.
const CSS = `
#${ROOT_ID} .rtv-list { display: flex; flex-direction: column; gap: 8px; }
#${ROOT_ID} .rtv-row { display: grid; grid-template-columns: minmax(150px, 0.8fr) 1fr 1fr auto; gap: 12px; align-items: start; }
#${ROOT_ID} .rtv-name { font: 400 15px "Bruno Ace", "Orbitron", sans-serif; letter-spacing: 0.04em; color: #fff; padding-top: 2px; }
#${ROOT_ID} .rtv-ult { display: block; margin-top: 2px; font: 500 13px "Rajdhani", sans-serif; letter-spacing: 0.04em; color: var(--dgn-muted); }
#${ROOT_ID} .rtv-slot-label { margin-bottom: 6px; font: 600 11px "Orbitron", sans-serif; letter-spacing: 0.16em; color: var(--dgn-gold); }
#${ROOT_ID} .rtv-slot-label.is-night { color: #9fb6ff; }
#${ROOT_ID} .rtv-chips { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
#${ROOT_ID} .rtv-chip {
    display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 10px;
    background: rgba(240, 71, 154, 0.2); border: 1px solid var(--dgn-pink-soft);
    font: 500 14px "Rajdhani", sans-serif; clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
}
#${ROOT_ID} .rtv-chip button { padding: 0 8px; border: 0; background: transparent; clip-path: none; font-size: 15px; line-height: 1; color: var(--dgn-muted); }
#${ROOT_ID} .rtv-chip button:hover { background: transparent; color: #fff; }
#${ROOT_ID} .rtv-chips select { width: auto; max-width: 160px; padding: 3px 8px; font-size: 13px; }
#${ROOT_ID} .rtv-status { flex: 1; font-size: 14px; color: var(--dgn-gold); }
#${ROOT_ID} .rtv-status.rtv-error { color: var(--dgn-red); flex: 1; text-align: left; }
@media (max-width: 700px) {
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
    root.className = "dgn-sheet";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Routines");
    root.innerHTML = `<div class="dgn-sheet-stripes"></div><div class="rtv-window dgn-sheet-window">
        <div class="rtv-head dgn-sheet-head"><div class="rtv-title dgn-sheet-title">ROUTINES</div><button type="button" class="rtv-close dgn-sheet-close">CLOSE</button></div>
        <div class="rtv-body dgn-sheet-body">
            <p class="rtv-note dgn-note">Where each classmate usually spends their time. When time passes, people mostly turn up in one of their rooms (dorm rooms never take visitors), and a new murder plan builds its alibis on these. Anyone can still be anywhere.</p>
            <div class="rtv-list"></div>
        </div>
        <div class="rtv-foot dgn-sheet-foot"><span class="rtv-status"></span><button type="button" class="rtv-primary rtv-suggest">SUGGEST FROM CARDS</button></div>
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
        head.className = `rtv-slot-label${which === "night" ? " is-night" : ""}`;
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
            empty.className = "rtv-empty dgn-empty";
            empty.textContent = "No living classmates on the roster.";
            list.appendChild(empty);
            return;
        }
        for (const c of cast) {
            const routine = getRoutine(routines, c.name);
            const row = document.createElement("div");
            row.className = "rtv-row dgn-row";
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
            clear.className = "rtv-danger is-small";
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
