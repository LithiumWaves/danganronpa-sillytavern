import { escapeHtml, isTypingTarget } from "./titleUtils.js";
import {
    BUILT_IN_MAP_CHOICES,
    CUSTOM_MAP_CHOICE,
    DEFAULT_ROOM_ICON,
    ROOM_ICON_CHOICES,
    buildMapPayload,
    emptyCustomMap,
    toMapPoint,
    validateCustomMapDetails,
    validateCustomMapRooms,
} from "./titleMapSetup.js";

export const DEFAULT_STORY_CHAT_NAME = "Hope's Peak - Killing Game";
export const DEFAULT_MAP_CHOICE = "hopes_peak";
const STEP_ORDER = Object.freeze(["style", "group", "roster", "map", "rooms", "summary"]);
const STEP_TITLES = Object.freeze({
    style: "HOW DO YOU WANT TO PLAY?",
    group: "CREATE THE STORY CHAT",
    roster: "CLASS ROSTER",
    map: "CHOOSE THE MAP",
    rooms: "PLACE YOUR ROOMS",
    summary: "READY?",
});

// The "WHAT DOES THIS MEAN?" panel under each step: the detail behind the
// one-line note, in short pieces.
const STEP_HELP = Object.freeze({
    style: [
        "<strong>A chat</strong> is a SillyTavern conversation. The play style decides how many of them the game uses.",
        "<strong>One Main Chat:</strong> the whole story happens in one group chat with your classmates in it. When you walk into a room, the characters standing there are unmuted and can talk. Everyone else is muted until you meet them. Use <em>Call Student</em> on the Monopad to bring someone to you.",
        "<strong>Several Chats:</strong> Talk to the Room, Grab Group and clicking a sprite each open their own chat (a 1-on-1, a room thread, a trial chat). Use this if you like separate conversations for every scene.",
        "Class trials, Truth Bullets, trust and the map work the same in both styles. You can switch later in <em>Options</em>.",
    ],
    group: [
        "This step creates a new <strong>SillyTavern group chat</strong>. That chat is where the story happens.",
        "Tick everyone who should take part in the story. Usually that's the whole class. Two members is the minimum for a group chat.",
        "The name is only a label, so you can find the chat in SillyTavern's chat list later. It doesn't change the story.",
        "You can add or remove members later from SillyTavern's group settings.",
    ],
    roster: [
        "<strong>The class roster</strong> is who the game treats as a student. Roster characters get sprites in rooms, trust levels, Social tab entries, and places in trials and votes.",
        "Everyone in the story chat is already ticked. You can add more classmates or untick some.",
        "<strong>Ultimate:</strong> each student's talent, like \"Ultimate Lucky Student\". It's shown on their profile and in trials. Leave it blank and it shows \"???\" until a lorebook entry or the Social tab fills it in.",
        "<strong>You are:</strong> your SillyTavern persona, the character you play as. Your persona never appears as a sprite next to you.",
    ],
    map: [
        "<strong>The map</strong> is the place the killing game happens in. You'll see it in the Monopad's MAP tab, and the overworld uses it to work out where everyone is.",
        "It's built from <strong>areas</strong> (a whole place, like the academy), <strong>floors</strong> (one picture each, like \"Floor 1\"), and <strong>rooms</strong> (pins on a floor, like \"Classroom 1-A\").",
        "<strong>Rooms are what make exploring work.</strong> Characters are placed in rooms, <em>Move To</em> walks you between them, and the AI is told which room you're in.",
        "<strong>This save only uses the map you pick here.</strong> Other maps stay installed but are hidden for this save. You can bring them back later with <em>SHOW ALL MAPS</em> in the MAP tab.",
        "<strong>Upload your own:</strong> use one picture per floor, as PNG, JPG or WebP. Wide pictures fit best (16:9, about 480×272 pixels or bigger). On the next step you'll click on each picture to place its rooms.",
    ],
    rooms: [
        "<strong>Click anywhere on the floor picture</strong> to put a room there. A numbered marker appears, and the room shows up in the list so you can name it.",
        "<strong>Name each room</strong> the way you'd say it in the story, like \"Dining Hall\" or \"Kaede's Bedroom\". That name is what the AI is told when you're in the room.",
        "The <strong>icon</strong> is only how the pin looks on the map. Drag a marker to move it. Use ✕ to remove a room.",
        "<strong>Starting room:</strong> where you are when the game begins. Classmates will be spread across your rooms.",
        "This step covers what you need to start. Later, open the Monopad MAP tab and use <em>Edit Pins</em> to link rooms with doors, set a background or music for each room, or add more.",
    ],
    summary: [
        "Pressing <strong>BEGIN</strong> sets everything up: it creates or picks the save, sets up the class roster, switches your persona, saves the map, and creates the story chat (One Main Chat only).",
        "Nothing is created until you press BEGIN. Use BACK to change anything first.",
    ],
});

function helpBlock(step) {
    const items = STEP_HELP[step];
    if (!items?.length) return "";
    return `
        <details class="dgn-title-explain">
            <summary>WHAT DOES THIS MEAN?</summary>
            <ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>
        </details>`;
}

// Takes the wizard state (or, for older callers, just the play style).
export function stepsFor(stateOrMode) {
    const s = typeof stateOrMode === "object" && stateOrMode ? stateOrMode : { mode: stateOrMode };
    return STEP_ORDER.filter((step) => {
        if (step === "group") return s.mode === "single";
        if (step === "rooms") return s.mapChoice === CUSTOM_MAP_CHOICE;
        return true;
    });
}

export function nextStep(state) {
    const steps = stepsFor(state);
    const idx = steps.indexOf(state?.step);
    return idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
}

export function prevStep(state) {
    const steps = stepsFor(state);
    const idx = steps.indexOf(state?.step);
    return idx > 0 ? steps[idx - 1] : null;
}

// Returns an error message for the current step, or "" when it can advance.
export function validateStep(state) {
    switch (state?.step) {
        case "style":
            return state.mode === "single" || state.mode === "multi" ? "" : "Pick a play style.";
        case "group":
            if (!String(state.groupName || "").trim()) return "Give the story chat a name.";
            if ((state.groupMembers?.size ?? 0) < 2) return "Pick at least two members for the story chat.";
            return "";
        case "roster":
            return (state.roster?.size ?? 0) >= 1 ? "" : "Pick at least one classmate.";
        case "map":
            if (state.mapChoice === CUSTOM_MAP_CHOICE) return validateCustomMapDetails(state.customMap);
            return BUILT_IN_MAP_CHOICES[state.mapChoice] ? "" : "Pick a map.";
        case "rooms":
            return validateCustomMapRooms(state.customMap);
        default:
            return "";
    }
}

export function buildFinishPayload(state) {
    return {
        fresh: !!state.fresh,
        mode: state.mode,
        groupName: state.mode === "single" ? String(state.groupName || "").trim() : "",
        groupMembers: state.mode === "single" ? [...state.groupMembers] : [],
        roster: [...state.roster.entries()].map(([name, ultimate]) => ({ name, ultimate: String(ultimate || "").trim() })),
        persona: state.persona || "",
        map: buildMapPayload(state.mapChoice ?? DEFAULT_MAP_CHOICE, state.customMap),
    };
}

function renderCardGrid(candidates, selected, { withUltimate = false, ultimates = null } = {}) {
    if (!candidates.length) {
        return `<div class="dgn-title-empty">NO CHARACTER CARDS FOUND. Import some characters into SillyTavern first.</div>`;
    }
    return candidates.map((c) => {
        const on = selected.has(c.name);
        return `
            <div class="dgn-title-card${on ? " is-on" : ""}" data-name="${escapeHtml(c.name)}">
                <button type="button" class="dgn-title-card-pick" aria-pressed="${on}">
                    <span class="dgn-title-card-img">${c.avatarUrl ? `<img src="${escapeHtml(c.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}</span>
                    <span class="dgn-title-card-name">${escapeHtml(c.name)}</span>
                    <span class="dgn-title-card-check" aria-hidden="true"></span>
                </button>
                ${withUltimate && on ? `
                    <input type="text" class="dgn-title-input dgn-title-card-ultimate" placeholder="Ultimate ???"
                        aria-label="${escapeHtml(c.name)}'s Ultimate" value="${escapeHtml(ultimates?.get(c.name) ?? "")}">
                ` : ""}
            </div>`;
    }).join("");
}

export function mountNewGamePanel(container, api) {
    const { services, sfx, confirm, close, back } = api;
    const candidates = (() => {
        try { return services.getCandidates?.() || []; } catch { return []; }
    })();
    const personas = (() => {
        try { return services.getPersonas?.() || { list: [], current: "" }; } catch { return { list: [], current: "" }; }
    })();

    const state = {
        step: "style",
        fresh: false,
        // One Main Chat is the recommended way to play, so it starts selected.
        mode: "single",
        groupName: DEFAULT_STORY_CHAT_NAME,
        groupMembers: new Set(),
        roster: new Map(),
        rosterSeeded: false,
        persona: personas.current || "",
        mapChoice: DEFAULT_MAP_CHOICE,
        customMap: emptyCustomMap(),
        placeFloor: 0,
        query: "",
        busy: false,
        error: "",
    };
    const ultimateOf = (name) => candidates.find((c) => c.name === name)?.ultimate || "";
    const assetUrl = (rel) => {
        try { return services.assetUrl?.(rel) || ""; } catch { return ""; }
    };

    let disposed = false;
    let ready = false;

    container.innerHTML = `
        <div class="dgn-title-wizard">
            <ol class="dgn-title-steps" aria-label="Progress"></ol>
            <div class="dgn-title-wizard-body"></div>
            <div class="dgn-title-wizard-foot">
                <span class="dgn-title-error" role="alert"></span>
                <button type="button" class="dgn-title-btn" data-nav="prev">BACK</button>
                <button type="button" class="dgn-title-btn is-primary" data-nav="next">NEXT</button>
            </div>
        </div>
    `;
    const stepsEl = container.querySelector(".dgn-title-steps");
    const bodyEl = container.querySelector(".dgn-title-wizard-body");
    const errorEl = container.querySelector(".dgn-title-error");
    const prevBtn = container.querySelector('[data-nav="prev"]');
    const nextBtn = container.querySelector('[data-nav="next"]');

    const seedRoster = () => {
        if (state.rosterSeeded) return;
        state.rosterSeeded = true;
        const names = state.mode === "single"
            ? [...state.groupMembers]
            : (state.fresh ? [] : candidates.filter((c) => c.inRoster).map((c) => c.name));
        names.forEach((name) => state.roster.set(name, ultimateOf(name)));
    };

    const visibleCandidates = () => {
        const q = state.query.trim().toLowerCase();
        return q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;
    };

    const renderGridOnly = () => {
        const grid = bodyEl.querySelector(".dgn-title-grid");
        if (!grid) return;
        const selected = state.step === "group" ? state.groupMembers : new Set(state.roster.keys());
        grid.innerHTML = renderCardGrid(visibleCandidates(), selected, {
            withUltimate: state.step === "roster",
            ultimates: state.roster,
        });
        const count = bodyEl.querySelector(".dgn-title-count");
        if (count) count.textContent = `${selected.size} SELECTED`;
    };

    const gridToolbar = () => `
        <div class="dgn-title-toolbar">
            <input type="search" class="dgn-title-input dgn-title-grid-search" placeholder="Search characters…" aria-label="Search characters" value="${escapeHtml(state.query)}">
            <button type="button" class="dgn-title-btn is-small" data-select="all">ALL</button>
            <button type="button" class="dgn-title-btn is-small" data-select="none">NONE</button>
            <span class="dgn-title-count"></span>
        </div>
        <div class="dgn-title-grid"></div>
    `;

    const renderMapStep = () => {
        const cards = Object.entries(BUILT_IN_MAP_CHOICES).map(([key, c]) => {
            const on = state.mapChoice === key;
            const preview = assetUrl(c.preview);
            return `
                <button type="button" class="dgn-title-mode dgn-title-mapcard${on ? " is-on" : ""}" data-map="${escapeHtml(key)}" aria-pressed="${on}">
                    ${preview ? `<span class="dgn-title-mapcard-preview"><img src="${escapeHtml(preview)}" alt="" loading="lazy" draggable="false"></span>` : ""}
                    <span class="dgn-title-mode-name">${escapeHtml(c.name)}</span>
                    <span class="dgn-title-mode-tag">${escapeHtml(c.tag)}</span>
                    <span class="dgn-title-mode-text">${escapeHtml(c.text)}</span>
                </button>`;
        }).join("");
        const custom = state.mapChoice === CUSTOM_MAP_CHOICE;
        const m = state.customMap;
        const floorRows = m.floors.map((f, i) => `
            <li class="dgn-title-floor" data-floor="${i}">
                <span class="dgn-title-floor-num">${i + 1}</span>
                <input type="text" class="dgn-title-input dgn-title-floor-name" maxlength="60" placeholder="Floor name, e.g. Floor 1" aria-label="Floor ${i + 1} name" value="${escapeHtml(f.label)}">
                <label class="dgn-title-btn is-small dgn-title-floor-upload">
                    ${f.image ? "CHANGE PICTURE" : "UPLOAD PICTURE"}
                    <input type="file" class="dgn-title-floor-file" accept="image/*" hidden>
                </label>
                ${f.image ? `<img class="dgn-title-floor-thumb" src="${escapeHtml(f.image)}" alt="" draggable="false">` : `<span class="dgn-title-floor-missing">No picture yet</span>`}
                ${m.floors.length > 1 ? `<button type="button" class="dgn-title-btn is-small" data-floor-remove="${i}" aria-label="Remove floor ${i + 1}">✕</button>` : ""}
            </li>`).join("");
        bodyEl.innerHTML = `
            <p class="dgn-title-note">Pick where the killing game takes place. The built-in maps are ready to play. To use your own floor plan, choose Upload Your Own.</p>
            <div class="dgn-title-modes dgn-title-mapcards">
                ${cards}
                <button type="button" class="dgn-title-mode dgn-title-mapcard${custom ? " is-on" : ""}" data-map="${CUSTOM_MAP_CHOICE}" aria-pressed="${custom}">
                    <span class="dgn-title-mode-name">UPLOAD YOUR OWN</span>
                    <span class="dgn-title-mode-tag">CUSTOM</span>
                    <span class="dgn-title-mode-text">Use your own floor plan pictures. You'll name the map, add a picture for each floor, then click on the pictures to place rooms.</span>
                </button>
            </div>
            ${custom ? `
                <div class="dgn-title-mapsetup">
                    <label class="dgn-title-field">
                        <span>MAP NAME</span>
                        <input type="text" class="dgn-title-input dgn-title-map-name" maxlength="60" placeholder="e.g. Ultimate Academy" value="${escapeHtml(m.name)}">
                    </label>
                    <div class="dgn-title-field">
                        <span>FLOORS: ONE PICTURE EACH</span>
                        <ol class="dgn-title-floors">${floorRows}</ol>
                        <button type="button" class="dgn-title-btn is-small dgn-title-floor-add" data-floor-add>+ ADD FLOOR</button>
                    </div>
                </div>` : ""}
            ${helpBlock("map")}
        `;
    };

    const renderRoomsStep = () => {
        const m = state.customMap;
        const floors = m.floors;
        state.placeFloor = Math.max(0, Math.min(floors.length - 1, state.placeFloor));
        const floor = floors[state.placeFloor];
        const roomsHere = m.rooms.map((r, i) => ({ r, i })).filter(({ r }) => r.floorIdx === state.placeFloor);
        const markers = roomsHere.map(({ r, i }) => `
            <button type="button" class="dgn-title-marker${m.startIdx === i ? " is-start" : ""}" data-room-marker="${i}"
                style="left:${(r.x / 480) * 100}%;top:${(r.y / 272) * 100}%" title="${escapeHtml(r.label || `Room ${i + 1}`)}">${i + 1}</button>`).join("");
        const iconOptions = (sel) => ROOM_ICON_CHOICES.map(([file, label]) =>
            `<option value="${escapeHtml(file)}"${file === sel ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
        const roomRows = m.rooms.map((r, i) => `
            <li class="dgn-title-room${r.floorIdx === state.placeFloor ? "" : " is-other-floor"}" data-room="${i}">
                <span class="dgn-title-room-num">${i + 1}</span>
                <img class="dgn-title-room-icon" src="${escapeHtml(assetUrl(`rooms/${r.icon || DEFAULT_ROOM_ICON}`))}" alt="" draggable="false">
                <input type="text" class="dgn-title-input dgn-title-room-name" maxlength="60" placeholder="Room name" aria-label="Room ${i + 1} name" value="${escapeHtml(r.label)}">
                <select class="dgn-title-input dgn-title-room-icon-select" aria-label="Room ${i + 1} icon">${iconOptions(r.icon || DEFAULT_ROOM_ICON)}</select>
                <label class="dgn-title-room-start" title="Start the game in this room">
                    <input type="radio" name="dgn-start-room" class="dgn-title-room-start-radio" ${m.startIdx === i ? "checked" : ""}> START
                </label>
                <small class="dgn-title-room-floor">${escapeHtml(floors[r.floorIdx]?.label || "")}</small>
                <button type="button" class="dgn-title-btn is-small" data-room-remove="${i}" aria-label="Remove room ${i + 1}">✕</button>
            </li>`).join("");
        bodyEl.innerHTML = `
            <p class="dgn-title-note">Click on the floor picture to add a room, then name it in the list. Every map needs at least one room, because that's where you and your classmates stand.</p>
            ${floors.length > 1 ? `
                <div class="dgn-title-tabs dgn-title-floor-tabs" role="tablist">
                    ${floors.map((f, i) => `<button type="button" class="dgn-title-tab${i === state.placeFloor ? " is-active" : ""}" role="tab" aria-selected="${i === state.placeFloor}" data-place-floor="${i}">${escapeHtml(f.label || `Floor ${i + 1}`)} <small>(${m.rooms.filter((r) => r.floorIdx === i).length})</small></button>`).join("")}
                </div>` : ""}
            <div class="dgn-title-place">
                <div class="dgn-title-place-box">
                    <img class="dgn-title-place-img" src="${escapeHtml(floor?.image || "")}" alt="${escapeHtml(floor?.label || "Floor")} picture" draggable="false">
                    <div class="dgn-title-place-markers">${markers}</div>
                </div>
                <div class="dgn-title-place-side">
                    <div class="dgn-title-count">${m.rooms.length} ROOM${m.rooms.length === 1 ? "" : "S"}</div>
                    ${m.rooms.length
                        ? `<ol class="dgn-title-rooms">${roomRows}</ol>`
                        : `<div class="dgn-title-empty dgn-title-rooms-empty">No rooms yet. Click on the picture to place your first one.</div>`}
                </div>
            </div>
            ${helpBlock("rooms")}
        `;
    };

    const renderStep = () => {
        const steps = stepsFor(state);
        const current = steps.indexOf(state.step);
        stepsEl.innerHTML = steps.map((s, i) => `
            <li class="${i === current ? "is-current" : ""}${i < current ? " is-done" : ""}">
                <span>${i + 1}</span>${escapeHtml(STEP_TITLES[s])}
            </li>`).join("");
        errorEl.textContent = state.error;
        prevBtn.textContent = current === 0 ? "MENU" : "BACK";
        nextBtn.textContent = state.step === "summary" ? (state.busy ? "STARTING…" : "BEGIN") : "NEXT";
        nextBtn.disabled = state.busy;
        prevBtn.disabled = state.busy;

        if (state.step === "style") {
            bodyEl.innerHTML = `
                <div class="dgn-title-modes">
                    <button type="button" class="dgn-title-mode${state.mode === "single" ? " is-on" : ""}" data-mode="single" aria-pressed="${state.mode === "single"}">
                        <span class="dgn-title-mode-name">ONE MAIN CHAT</span>
                        <span class="dgn-title-mode-tag">RECOMMENDED · SINGLE-CHAT OVERWORLD</span>
                        <span class="dgn-title-mode-text">The main way to play. One group chat is the whole story. Exploring stays in it: whoever is in the room is unmuted, everyone else is muted. Call Student brings people to you. You'll create that chat next.</span>
                    </button>
                    <button type="button" class="dgn-title-mode${state.mode === "multi" ? " is-on" : ""}" data-mode="multi" aria-pressed="${state.mode === "multi"}">
                        <span class="dgn-title-mode-name">SEVERAL CHATS</span>
                        <span class="dgn-title-mode-tag">ALTERNATIVE</span>
                        <span class="dgn-title-mode-text">Talk to the Room, Grab Group, and sprite clicks each open or switch to their own chat. Good for separate 1-on-1s, room threads and trial chats.</span>
                    </button>
                </div>
                <p class="dgn-title-note">You can switch later in Options. Class trials work in both styles.${state.fresh ? " This game gets a new save. Your previous save is kept." : ""}</p>
                ${helpBlock("style")}
            `;
        } else if (state.step === "group") {
            bodyEl.innerHTML = `
                <label class="dgn-title-field">
                    <span>CHAT NAME</span>
                    <input type="text" class="dgn-title-input dgn-title-group-name" maxlength="80" value="${escapeHtml(state.groupName)}">
                </label>
                <p class="dgn-title-note">Pick who is in the story chat. They'll be ticked on the class roster next.</p>
                ${helpBlock("group")}
                ${gridToolbar()}
            `;
            renderGridOnly();
        } else if (state.step === "roster") {
            const personaOptions = personas.list.map((p) => `
                <button type="button" class="dgn-title-persona${p.key === state.persona ? " is-on" : ""}" data-persona="${escapeHtml(p.key)}" aria-pressed="${p.key === state.persona}">
                    ${p.avatarUrl ? `<img src="${escapeHtml(p.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}
                    <span>${escapeHtml(p.name)}</span>
                </button>`).join("");
            bodyEl.innerHTML = `
                ${personas.list.length ? `
                    <div class="dgn-title-field">
                        <span>YOU ARE</span>
                        <div class="dgn-title-personas">${personaOptions}</div>
                    </div>` : ""}
                <p class="dgn-title-note">Tick your classmates and set each one's Ultimate. Blank Ultimates stay "???" until the lorebook or Social tab fills them in.</p>
                ${helpBlock("roster")}
                ${gridToolbar()}
            `;
            renderGridOnly();
        } else if (state.step === "map") {
            renderMapStep();
        } else if (state.step === "rooms") {
            renderRoomsStep();
        } else if (state.step === "summary") {
            const payload = buildFinishPayload(state);
            const removed = state.fresh
                ? []
                : candidates.filter((c) => c.inRoster && !state.roster.has(c.name)).map((c) => c.name);
            const personaName = personas.list.find((p) => p.key === state.persona)?.name || "";
            const mapText = state.mapChoice === CUSTOM_MAP_CHOICE
                ? `${escapeHtml(state.customMap.name.trim())} <small>(your own · ${state.customMap.floors.length} floor${state.customMap.floors.length === 1 ? "" : "s"} · ${state.customMap.rooms.length} room${state.customMap.rooms.length === 1 ? "" : "s"} · start: ${escapeHtml(state.customMap.rooms[state.customMap.startIdx]?.label || "")})</small>`
                : `${escapeHtml(BUILT_IN_MAP_CHOICES[state.mapChoice]?.name || "")} <small>(built-in)</small>`;
            bodyEl.innerHTML = `
                <dl class="dgn-title-summary">
                    <dt>SAVE</dt><dd>${state.fresh ? "New save (your previous save is kept)" : "Current save"}</dd>
                    <dt>PLAY STYLE</dt><dd>${state.mode === "single" ? "One main chat" : "Several chats"}</dd>
                    ${state.mode === "single" ? `<dt>STORY CHAT</dt><dd>${escapeHtml(payload.groupName)} <small>(${payload.groupMembers.length} members)</small></dd>` : ""}
                    ${personaName ? `<dt>YOU</dt><dd>${escapeHtml(personaName)}</dd>` : ""}
                    <dt>MAP</dt><dd>${mapText}</dd>
                    <dt>CLASS (${payload.roster.length})</dt>
                    <dd><ul class="dgn-title-summary-roster">${payload.roster.map((r) => `<li><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.ultimate ? `Ultimate ${r.ultimate}` : "Ultimate ???")}</span></li>`).join("")}</ul></dd>
                    ${removed.length ? `<dt>LEAVING</dt><dd>${removed.map(escapeHtml).join(", ")} <small>(removed from the roster)</small></dd>` : ""}
                </dl>
                ${helpBlock("summary")}
            `;
        }
    };

    const go = (step) => {
        state.step = step;
        state.error = "";
        state.query = "";
        if (step === "roster") seedRoster();
        renderStep();
        requestAnimationFrame(() => {
            const first = bodyEl.querySelector(".dgn-title-map-name, .dgn-title-mode.is-on, .dgn-title-mode, .dgn-title-group-name, .dgn-title-card-pick") || nextBtn;
            first?.focus({ preventScroll: true });
        });
    };

    const finish = async () => {
        if (state.busy) return;
        state.busy = true;
        state.error = "";
        renderStep();
        try {
            const result = await services.finishNewGame?.(buildFinishPayload(state));
            if (disposed) return;
            close(() => result?.afterClose?.());
        } catch (e) {
            console.warn("[Dangan][Title] New game failed:", e);
            if (disposed) return;
            state.busy = false;
            state.error = `Couldn't start: ${e?.message || e}`;
            renderStep();
        }
    };

    const advance = () => {
        if (!ready || state.busy) return;
        const error = validateStep(state);
        if (error) {
            state.error = error;
            errorEl.textContent = error;
            sfx("close");
            return;
        }
        sfx("click");
        if (state.step === "summary") {
            finish();
            return;
        }
        const next = nextStep(state);
        if (next) go(next);
    };

    const retreat = () => {
        if (state.busy) return true;
        const prev = prevStep(state);
        if (!prev) return false;
        sfx("close");
        go(prev);
        return true;
    };

    const toggleName = (name) => {
        if (state.step === "group") {
            if (state.groupMembers.has(name)) state.groupMembers.delete(name);
            else state.groupMembers.add(name);
            // Newly added story-chat members join the class too.
            if (state.rosterSeeded && state.groupMembers.has(name) && !state.roster.has(name)) {
                state.roster.set(name, ultimateOf(name));
            }
        } else if (state.step === "roster") {
            if (state.roster.has(name)) state.roster.delete(name);
            else state.roster.set(name, ultimateOf(name));
        }
        sfx("hover");
        renderGridOnly();
        bodyEl.querySelector(`.dgn-title-card[data-name="${CSS.escape(name)}"] .dgn-title-card-pick`)?.focus({ preventScroll: true });
    };

    const selectAll = (on) => {
        const names = visibleCandidates().map((c) => c.name);
        names.forEach((name) => {
            if (state.step === "group") {
                if (on) state.groupMembers.add(name); else state.groupMembers.delete(name);
            } else if (on) {
                if (!state.roster.has(name)) state.roster.set(name, ultimateOf(name));
            } else {
                state.roster.delete(name);
            }
        });
        sfx("click");
        renderGridOnly();
    };

    const focusRoomName = (idx) => {
        bodyEl.querySelector(`.dgn-title-room[data-room="${idx}"] .dgn-title-room-name`)?.focus({ preventScroll: false });
    };

    const removeFloor = (idx) => {
        const m = state.customMap;
        if (m.floors.length <= 1) return;
        const startRoom = m.rooms[m.startIdx];
        m.floors.splice(idx, 1);
        m.rooms = m.rooms
            .filter((r) => r.floorIdx !== idx)
            .map((r) => (r.floorIdx > idx ? { ...r, floorIdx: r.floorIdx - 1 } : r));
        const kept = startRoom && startRoom.floorIdx !== idx
            ? m.rooms.findIndex((r) => r.label === startRoom.label && r.x === startRoom.x && r.y === startRoom.y)
            : -1;
        m.startIdx = Math.max(0, kept);
    };

    const removeRoom = (idx) => {
        const m = state.customMap;
        m.rooms.splice(idx, 1);
        if (m.startIdx === idx) m.startIdx = 0;
        else if (m.startIdx > idx) m.startIdx -= 1;
    };

    // Dragging a room marker on the Place Rooms picture. A drag swallows the
    // click that follows it.
    let drag = null;
    let suppressMarkerClick = false;
    const markerPoint = (ev) => {
        const img = bodyEl.querySelector(".dgn-title-place-img");
        const rect = img?.getBoundingClientRect();
        return rect ? toMapPoint(ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height) : null;
    };
    container.addEventListener("pointerdown", (ev) => {
        const marker = ev.target.closest?.("[data-room-marker]");
        if (!marker || ev.button !== 0) return;
        drag = { idx: Number(marker.dataset.roomMarker), el: marker, moved: false, x0: ev.clientX, y0: ev.clientY };
        marker.setPointerCapture?.(ev.pointerId);
    });
    container.addEventListener("pointermove", (ev) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 4) return;
        drag.moved = true;
        const pt = markerPoint(ev);
        const room = state.customMap.rooms[drag.idx];
        if (!pt || !room) return;
        room.x = pt.x;
        room.y = pt.y;
        drag.el.style.left = `${(pt.x / 480) * 100}%`;
        drag.el.style.top = `${(pt.y / 272) * 100}%`;
    });
    const endDrag = () => {
        if (drag?.moved) suppressMarkerClick = true;
        drag = null;
    };
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        const nav = t.closest?.("[data-nav]");
        if (nav) {
            if (nav.dataset.nav === "next") advance();
            else if (!retreat()) back();
            return;
        }
        const mapCard = t.closest?.("[data-map]");
        if (mapCard) {
            state.mapChoice = mapCard.dataset.map;
            state.error = "";
            sfx("click");
            renderStep();
            if (state.mapChoice === CUSTOM_MAP_CHOICE) {
                requestAnimationFrame(() => bodyEl.querySelector(".dgn-title-map-name")?.focus({ preventScroll: false }));
            } else {
                advance();
            }
            return;
        }
        if (t.closest?.("[data-floor-add]")) {
            const n = state.customMap.floors.length + 1;
            state.customMap.floors.push({ label: `FLOOR ${n}`, image: "", fileName: "" });
            sfx("click");
            renderStep();
            return;
        }
        const floorRemove = t.closest?.("[data-floor-remove]");
        if (floorRemove) {
            removeFloor(Number(floorRemove.dataset.floorRemove));
            sfx("close");
            renderStep();
            return;
        }
        const placeTab = t.closest?.("[data-place-floor]");
        if (placeTab) {
            state.placeFloor = Number(placeTab.dataset.placeFloor);
            sfx("click");
            renderStep();
            return;
        }
        const roomRemove = t.closest?.("[data-room-remove]");
        if (roomRemove) {
            removeRoom(Number(roomRemove.dataset.roomRemove));
            sfx("close");
            renderStep();
            return;
        }
        const marker = t.closest?.("[data-room-marker]");
        if (marker) {
            if (suppressMarkerClick) { suppressMarkerClick = false; return; }
            const idx = Number(marker.dataset.roomMarker);
            sfx("hover");
            focusRoomName(idx);
            return;
        }
        if (t.classList?.contains("dgn-title-place-img")) {
            const pt = markerPoint(ev);
            if (!pt) return;
            const m = state.customMap;
            m.rooms.push({ label: "", icon: DEFAULT_ROOM_ICON, floorIdx: state.placeFloor, x: pt.x, y: pt.y });
            state.error = "";
            sfx("click");
            renderStep();
            focusRoomName(m.rooms.length - 1);
            return;
        }
        const mode = t.closest?.("[data-mode]");
        if (mode) {
            if (state.mode !== mode.dataset.mode) {
                state.mode = mode.dataset.mode;
                state.rosterSeeded = false;
                state.roster.clear();
            }
            sfx("click");
            renderStep();
            advance();
            return;
        }
        const pick = t.closest?.(".dgn-title-card-pick");
        if (pick) {
            toggleName(pick.closest(".dgn-title-card").dataset.name);
            return;
        }
        const sel = t.closest?.("[data-select]");
        if (sel) {
            selectAll(sel.dataset.select === "all");
            return;
        }
        const persona = t.closest?.("[data-persona]");
        if (persona) {
            state.persona = persona.dataset.persona;
            bodyEl.querySelectorAll(".dgn-title-persona").forEach((el) => {
                const on = el.dataset.persona === state.persona;
                el.classList.toggle("is-on", on);
                el.setAttribute("aria-pressed", String(on));
            });
            sfx("click");
        }
    });

    container.addEventListener("input", (ev) => {
        const t = ev.target;
        if (t.classList.contains("dgn-title-group-name")) {
            state.groupName = t.value;
        } else if (t.classList.contains("dgn-title-grid-search")) {
            state.query = t.value;
            renderGridOnly();
        } else if (t.classList.contains("dgn-title-card-ultimate")) {
            const name = t.closest(".dgn-title-card")?.dataset.name;
            if (name && state.roster.has(name)) state.roster.set(name, t.value);
        } else if (t.classList.contains("dgn-title-map-name")) {
            state.customMap.name = t.value;
        } else if (t.classList.contains("dgn-title-floor-name")) {
            const floor = state.customMap.floors[Number(t.closest(".dgn-title-floor")?.dataset.floor)];
            if (floor) floor.label = t.value;
        } else if (t.classList.contains("dgn-title-room-name")) {
            const idx = Number(t.closest(".dgn-title-room")?.dataset.room);
            const room = state.customMap.rooms[idx];
            if (room) room.label = t.value;
            const marker = bodyEl.querySelector(`[data-room-marker="${idx}"]`);
            if (marker) marker.title = t.value || `Room ${idx + 1}`;
        }
    });

    container.addEventListener("change", (ev) => {
        const t = ev.target;
        if (t.classList.contains("dgn-title-floor-file")) {
            const idx = Number(t.closest(".dgn-title-floor")?.dataset.floor);
            const file = t.files?.[0];
            if (!file || !state.customMap.floors[idx]) return;
            if (!String(file.type || "").startsWith("image/")) {
                state.error = `"${file.name}" isn't a picture. Use a PNG, JPG or WebP file.`;
                errorEl.textContent = state.error;
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                if (disposed) return;
                const floor = state.customMap.floors[idx];
                if (!floor) return;
                floor.image = String(e.target?.result || "");
                floor.fileName = file.name;
                state.error = "";
                sfx("click");
                if (state.step === "map") renderStep();
            };
            reader.onerror = () => {
                state.error = `Couldn't read "${file.name}". Try another picture.`;
                errorEl.textContent = state.error;
            };
            reader.readAsDataURL(file);
        } else if (t.classList.contains("dgn-title-room-icon-select")) {
            const row = t.closest(".dgn-title-room");
            const room = state.customMap.rooms[Number(row?.dataset.room)];
            if (!room) return;
            room.icon = t.value;
            const img = row.querySelector(".dgn-title-room-icon");
            if (img) img.src = assetUrl(`rooms/${room.icon}`);
        } else if (t.classList.contains("dgn-title-room-start-radio")) {
            const idx = Number(t.closest(".dgn-title-room")?.dataset.room);
            if (!Number.isInteger(idx)) return;
            state.customMap.startIdx = idx;
            bodyEl.querySelectorAll("[data-room-marker]").forEach((el) => {
                el.classList.toggle("is-start", Number(el.dataset.roomMarker) === idx);
            });
            sfx("click");
        }
    });

    const moveCardFocus = (ev) => {
        const cards = Array.from(bodyEl.querySelectorAll(".dgn-title-card-pick"));
        const idx = cards.indexOf(ev.target);
        if (idx < 0) return false;
        const top = cards[0].getBoundingClientRect().top;
        const cols = Math.max(1, cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4).length);
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[ev.key];
        if (!delta) return false;
        const next = cards[Math.max(0, Math.min(cards.length - 1, idx + delta))];
        if (next !== ev.target) sfx("hover");
        next?.focus({ preventScroll: false });
        return true;
    };

    const start = async () => {
        let fresh = false;
        try {
            if (services.hasProgress?.()) {
                fresh = await confirm({
                    title: "NEW SAVE?",
                    message: "NEW SAVE starts this game in a save of its own when you press BEGIN. Your current progress stays in its save, and CONTINUE can load it again. KEEP CURRENT SAVE sets up chats and the roster in the save you have loaded now.",
                    confirmLabel: "NEW SAVE",
                    cancelLabel: "KEEP CURRENT SAVE",
                });
            }
        } catch { /* keep progress */ }
        if (disposed) return;
        state.fresh = !!fresh;
        ready = true;
        go("style");
    };

    renderStep();
    start();

    return {
        unmount() { disposed = true; },
        onBack: retreat,
        onKey(ev) {
            if (isTypingTarget(ev.target)) {
                if (ev.key === "Enter" && !ev.target.matches(".dgn-title-card-ultimate, .dgn-title-room-name, .dgn-title-floor-name, select")) {
                    advance();
                    return true;
                }
                return false;
            }
            if (ev.key.startsWith("Arrow")) {
                if (moveCardFocus(ev)) return true;
                const modes = Array.from(bodyEl.querySelectorAll(".dgn-title-mode"));
                const mi = modes.indexOf(ev.target);
                if (mi >= 0) {
                    const next = modes[(mi + 1) % modes.length];
                    sfx("hover");
                    next.focus({ preventScroll: true });
                    return true;
                }
            }
            if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
                advance();
                return true;
            }
            return false;
        },
    };
}
