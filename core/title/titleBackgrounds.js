import { escapeHtml, isTypingTarget, stepFocus } from "./titleUtils.js";

// SETUP → BACKGROUNDS. Gives each room on the active save's map a SillyTavern
// background; walking into the room switches the chat to it.
export function mountBackgroundsPanel(container, api) {
    const { services, sfx } = api;
    let rooms = [];
    let backgrounds = [];
    let picking = null; // the room whose background is being chosen
    let query = "";

    const thumbFor = (bgfile) => backgrounds.find((b) => b.bgfile === bgfile)?.thumb || "";

    // Thumbnails are CSS url("…") strings, so they're set after rendering
    // rather than inside a quoted style attribute.
    const applyThumbs = () => {
        container.querySelectorAll("[data-thumb]").forEach((el) => {
            const thumb = el.dataset.thumb === "room"
                ? thumbFor(rooms[Number(el.closest("[data-room]")?.dataset.room)]?.bg)
                : backgrounds[Number(el.dataset.thumb)]?.thumb;
            if (thumb && thumb !== "none") el.style.backgroundImage = thumb;
        });
    };

    const renderRooms = () => {
        api.setTitle("ROOM BACKGROUNDS");
        if (!rooms.length) {
            container.innerHTML = `
                <div class="dgn-title-empty">
                    <p>NO ROOMS YET.</p>
                    <p class="dgn-title-note">Rooms come from your save's map. Start a NEW GAME to pick one.</p>
                    <button type="button" class="dgn-title-btn is-primary" data-new-game>NEW GAME</button>
                </div>`;
            return;
        }
        const set = rooms.filter((r) => r.bg).length;
        const groups = [];
        rooms.forEach((room, i) => {
            const name = [room.area, room.floor].filter(Boolean).join(" · ") || "MAP";
            let group = groups.find((g) => g.name === name);
            if (!group) groups.push(group = { name, items: [] });
            group.items.push({ room, i });
        });
        container.innerHTML = `
            <p class="dgn-title-note">Pick the background each room shows when you walk in. ${set} of ${rooms.length} rooms have one. Changes save immediately.</p>
            ${groups.map((group) => `
                <h4 class="dgn-title-split-group">${escapeHtml(group.name)}</h4>
                <div class="dgn-title-bg-grid">
                    ${group.items.map(({ room, i }) => `
                        <button type="button" class="dgn-title-bg-tile${room.bg ? " is-on" : ""}" data-room="${i}">
                            <span class="dgn-title-bg-thumb" ${room.bg ? `data-thumb="room"` : ""}>${room.bg ? "" : "NONE"}</span>
                            <span class="dgn-title-bg-name">${escapeHtml(room.label)}</span>
                            <span class="dgn-title-bg-file">${escapeHtml(room.bg ? (backgrounds.find((b) => b.bgfile === room.bg)?.label || room.bg) : "No background")}</span>
                        </button>
                    `).join("")}
                </div>
            `).join("")}
        `;
        applyThumbs();
    };

    const renderPickerGrid = () => {
        const q = query.trim().toLowerCase();
        const visible = backgrounds
            .map((b, i) => ({ b, i }))
            .filter(({ b }) => !q || b.label.toLowerCase().includes(q) || b.bgfile.toLowerCase().includes(q));
        return `
            ${q ? "" : `
                <button type="button" class="dgn-title-bg-tile${picking.bg ? "" : " is-on"}" data-pick="">
                    <span class="dgn-title-bg-thumb">NONE</span>
                    <span class="dgn-title-bg-name">No background</span>
                </button>`}
            ${visible.map(({ b, i }) => `
                <button type="button" class="dgn-title-bg-tile${b.bgfile === picking.bg ? " is-on" : ""}" data-pick="${escapeHtml(b.bgfile)}">
                    <span class="dgn-title-bg-thumb" data-thumb="${i}"></span>
                    <span class="dgn-title-bg-name">${escapeHtml(b.label)}</span>
                </button>
            `).join("")}
            ${visible.length || !q ? "" : `<div class="dgn-title-empty">NO BACKGROUNDS MATCH.</div>`}
        `;
    };

    const renderPicker = () => {
        api.setTitle(picking.label.toUpperCase());
        container.innerHTML = `
            <div class="dgn-title-toolbar">
                <input type="search" class="dgn-title-input" placeholder="Search backgrounds…" value="${escapeHtml(query)}" aria-label="Search backgrounds">
                <span class="dgn-title-count">${backgrounds.length} BACKGROUNDS</span>
            </div>
            ${backgrounds.length ? "" : `<p class="dgn-title-note">SillyTavern has no backgrounds yet. Add some from its Backgrounds menu (the picture icon in the top bar).</p>`}
            <div class="dgn-title-bg-grid is-picker">${renderPickerGrid()}</div>
        `;
        applyThumbs();
    };

    const load = () => {
        try {
            rooms = services.listRoomPins?.() || [];
            backgrounds = services.listBackgrounds?.() || [];
        } catch (e) {
            console.warn("[Dangan][Title] backgrounds panel failed:", e);
            rooms = [];
            backgrounds = [];
        }
    };

    const backToRooms = () => {
        const index = rooms.indexOf(picking);
        picking = null;
        query = "";
        renderRooms();
        container.querySelector(`[data-room="${index}"]`)?.focus({ preventScroll: false });
    };

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest?.("[data-new-game]")) {
            sfx("click");
            api.openPanel("newGame");
            return;
        }
        const tile = t.closest?.("[data-room]");
        if (tile && !picking) {
            sfx("click");
            picking = rooms[Number(tile.dataset.room)] || null;
            if (picking) renderPicker();
            return;
        }
        const pick = t.closest?.("[data-pick]");
        if (pick && picking) {
            const bgfile = pick.dataset.pick;
            let ok = false;
            try { ok = services.setRoomBackground?.(picking.id, bgfile) !== false; } catch (e) { console.warn("[Dangan][Title] setting room background failed:", e); }
            if (ok) picking.bg = bgfile;
            sfx("click");
            backToRooms();
        }
    });

    container.addEventListener("input", (ev) => {
        if (ev.target.type !== "search" || !picking) return;
        query = ev.target.value;
        container.querySelector(".dgn-title-bg-grid").innerHTML = renderPickerGrid();
        applyThumbs();
    });

    load();
    renderRooms();

    return {
        onBack() {
            if (picking) {
                sfx("close");
                backToRooms();
                return true;
            }
            api.openPanel("setup");
            return true;
        },
        onKey(ev) {
            if (isTypingTarget(ev.target)) return false;
            const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
            if (!dir) return false;
            return stepFocus(container, ".dgn-title-bg-tile, [data-new-game]", dir, sfx);
        },
    };
}
