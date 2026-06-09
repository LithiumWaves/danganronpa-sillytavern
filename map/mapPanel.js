const MACHINE_ROLL_DURATION_MS = 2000;
const MACHINE_JINGLE_FRAME = 50;
const MACHINE_GIF_TOTAL_FRAMES = 100;
const MACHINE_JINGLE_DELAY_MS = Math.round((MACHINE_JINGLE_FRAME / MACHINE_GIF_TOTAL_FRAMES) * MACHINE_ROLL_DURATION_MS);
const MACHINE_BANNER_DELAY_MS = 500;
const CUSTOM_PINS_STORAGE_KEY = "dangan_map_custom_pins_v1";
const ROOM_VIEW_STORAGE_KEY        = "dangan_map_room_view_mode_v1";
const ROOM_VIEW_CYCLE              = ["on", "simple", "off"];
const SIMPLE_EVIDENCE_STORAGE_KEY  = "dangan_map_simple_evidence_v1";
const SIMPLE_BODY_STORAGE_KEY      = "dangan_map_simple_body_v1";
const CUSTOM_AREAS_STORAGE_KEY     = "dangan_map_custom_areas_v1";
const AREA_OVERRIDES_STORAGE_KEY   = "dangan_map_area_overrides_v1";

const ROOM_SVG_FILES = [
    "art-room.svg", "bar.svg", "bedroom.svg", "biology-room.svg", "cafe.svg",
    "cafeteria.svg", "changing-room.svg", "chemistry-room.svg", "classroom.svg",
    "computer-room.svg", "dojo.svg", "execution-grounds.svg", "football-field.svg",
    "freezer.svg", "furnace.svg", "gallery.svg", "garden.svg", "generator-room.svg",
    "greenhouse.svg", "gym.svg", "headmasters-office.svg", "infirmary.svg",
    "jail.svg", "library.svg", "locked-room.svg", "mens-bathroom.svg",
    "monokuma-eye.svg", "morgue.svg", "music-room.svg", "physics-room.svg",
    "pool.svg", "reactor.svg", "rec-room.svg", "ring.svg", "sauna.svg",
    "shrine.svg", "stairs.svg", "steam-room.svg", "storage.svg", "tennis-court.svg",
    "trash-room.svg", "trophy.svg", "video-room.svg", "washroom.svg", "womens-bathroom.svg",
];

const TYPE_DEFAULT_ICONS = {
    "truth-bullet": "artillery-shell.svg",
    "monomachine":  "monomachine-store.svg",
    "trial":        "trial-room.svg",
    "body":         "chalk-outline-murder.svg",
};
const MAP_POINT_WIDTH = 480;
const MAP_POINT_HEIGHT = 272;

const MAP_AREAS = {
    hopes_peak: {
        label: "HOPE'S PEAK ACADEMY",
        floors: [
            { key: "floor_1", label: "FLOOR 1", image: "images/maps/floor_one.png", description: "Main academy first floor." },
            { key: "floor_2", label: "FLOOR 2", image: "images/maps/floor_two.png", description: "Main academy second floor." },
            { key: "floor_3", label: "FLOOR 3", image: "images/maps/floor_three.png", description: "Main academy third floor." },
            { key: "floor_4", label: "FLOOR 4", image: "images/maps/floor_four.png", description: "Main academy fourth floor." },
            { key: "floor_5", label: "FLOOR 5", image: "images/maps/floor_five.png", description: "Main academy fifth floor." },
        ],
    },
    hotel_despair: {
        label: "HOPE'S PEAK ACADEMY DORMS",
        floors: [
            { key: "floor_1", label: "FLOOR 1", image: "images/maps/hotel_despair.png", description: "Accessible by corridor from academy floor 1." },
            { key: "hidden_floor", label: "HIDDEN FLOOR", image: "images/maps/hidden_floor.png", description: "Secret second floor above Hotel Despair." },
        ],
    },
};

function getFloorByKey(areaKey, floorKey) {
    const area = MAP_AREAS[areaKey];
    if (!area) return null;
    return area.floors.find(floor => floor.key === floorKey) || null;
}

export function createMapPanelController({ extensionFolderPath, getItemsPanelController, playSfx, getSfx, getSetting, onWalkStep, onTrialStartRequest, getTruthBulletByLocationId, navigateToTruth, onMachineOpen, onMachineClose, playShopTrack, stopShopTrack, fetchBgmPaths, playBgmPath }) {
    const state = {
        area: "hopes_peak",
        floor: "floor_1",
        machineCoinsLoaded: 1,
        machineRollCount: 1,
        machineRolling: false,
        machineRollTimeout: null,
        machineJingleTimeout: null,
        machineBannerTimeout: null,
        machineBannerDelayTimeout: null,
        machineTrackStarted: false,
        mapZoom: 1.0,
        mapPanX: 0,
        mapPanY: 0,
        customPins: [],
        pinPlacementMode: false,
        pendingCustomPin: null,
        highlightedPinId: null,
        roomViewMode:         ROOM_VIEW_CYCLE.includes(window.localStorage?.getItem(ROOM_VIEW_STORAGE_KEY))
                                  ? window.localStorage.getItem(ROOM_VIEW_STORAGE_KEY) : "on",
        simpleEvidencePins:   window.localStorage?.getItem(SIMPLE_EVIDENCE_STORAGE_KEY) === "true",
        simpleBodyPins:       window.localStorage?.getItem(SIMPLE_BODY_STORAGE_KEY)     === "true",
        customAreas: [],
        areaOverrides: {},
    };

    const selectors = {
        panel: `.monopad-panel-content[data-panel="map"]`,
        areaButtons: ".map-area-button",
        floorList: ".map-floor-list",
        image: ".map-image",
        title: ".map-location-title",
        subtitle: ".map-location-subtitle",
        machinePin: ".map-machine-pin",
        trialPin: ".map-trial-pin",
        machineOverlay: ".map-machine-overlay",
        machineDisplayCoins: ".map-machine-coins",
        machineDisplayLoad: ".map-machine-load",
        machineDisplayDupe: ".map-machine-dupe",
        machineDisplayRolls: ".map-machine-rolls",
        machineBanner: ".map-machine-banner",
        machineSunburst: ".map-machine-sunburst",
        machineImage: ".map-machine-image",
        machineAdd: ".map-machine-button.add",
        machineAddRoll: ".map-machine-button.add-roll",
        machineRoll: ".map-machine-button.roll",
        machineClose: ".map-machine-close",
        zoomIn: ".map-zoom-in",
        zoomOut: ".map-zoom-out",
        zoomLevel: ".map-zoom-level",
        scrollArea: ".map-scroll-area",
        pinLayer: ".map-pin-layer",
        pinsAdd: ".map-pins-add",
        pinsClearFloor: ".map-pins-clear-floor",
        pinsToggleRoomView:       ".map-pins-toggle-room-view",
        pinsToggleSimpleEvidence: ".map-pins-toggle-simple-evidence",
        pinsToggleSimpleBody:     ".map-pins-toggle-simple-body",
        pinsList: ".map-pins-list",
        pinsCreatePanel: ".map-pins-create-panel",
        pinsIconGrid: ".map-pins-icon-grid",
        pinsTypeBtn: ".map-pins-type-btn",
        pinsLabelInput: ".map-pins-label-input",
        pinsIdInput: ".map-pins-id-input",
        pinsPlaceBtn: ".map-pins-place-btn",
        pinsCancelBtn: ".map-pins-cancel-btn",
        pinsPlaceHint: ".map-pins-place-hint",
        customPin: ".map-custom-pin",
        addAreaBtn: ".map-add-area-button",
    };

    function toAreaSlug(str) {
        return str.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function loadCustomPins() {
        try {
            const raw = window.localStorage?.getItem(CUSTOM_PINS_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveCustomPins() {
        try {
            window.localStorage?.setItem(CUSTOM_PINS_STORAGE_KEY, JSON.stringify(state.customPins || []));
        } catch {
            // no-op
        }
    }

    function loadCustomAreas() {
        try {
            const raw = window.localStorage?.getItem(CUSTOM_AREAS_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveCustomAreas() {
        try {
            window.localStorage?.setItem(CUSTOM_AREAS_STORAGE_KEY, JSON.stringify(state.customAreas || []));
        } catch {
            // no-op
        }
    }

    function loadAreaOverrides() {
        try {
            const raw = window.localStorage?.getItem(AREA_OVERRIDES_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
        } catch { return {}; }
    }

    function saveAreaOverrides() {
        try {
            window.localStorage?.setItem(AREA_OVERRIDES_STORAGE_KEY, JSON.stringify(state.areaOverrides || {}));
        } catch {}
    }

    function isBuiltInArea(areaKey) {
        return areaKey in MAP_AREAS;
    }

    function getAllAreas() {
        const combined = {};
        for (const [key, area] of Object.entries(MAP_AREAS)) {
            const ov = state.areaOverrides[key] || {};
            if (ov.deleted) continue;
            const deletedFloors = new Set(ov.deletedFloors || []);
            const floors = area.floors
                .filter(f => !deletedFloors.has(f.key))
                .map(f => ({
                    ...f,
                    label: ov.floorRenames?.[f.key] ?? f.label,
                    description: ov.floorDescs?.[f.key] ?? f.description,
                    id: ov.floorIds?.[f.key] ?? f.id ?? "",
                }));
            combined[key] = {
                ...area,
                label: ov.label ?? area.label,
                id: ov.id ?? area.id ?? "",
                floors: [...floors, ...(ov.extraFloors || [])],
            };
        }
        for (const ca of state.customAreas) {
            combined[ca.key] = ca;
        }
        return combined;
    }

    function getAreaFloor(areaKey, floorKey) {
        const area = getAllAreas()[areaKey];
        if (!area) return null;
        return area.floors.find(f => f.key === floorKey) || null;
    }

    state.customAreas = loadCustomAreas();
    state.areaOverrides = loadAreaOverrides();
    state.customPins = loadCustomPins();

    // Tracks scroll areas already observed so we don't add duplicate ResizeObservers
    const _observedScrollAreas = new WeakSet();

    // Returns the rendered image rect within the scroll area, accounting for object-fit: contain letterboxing.
    function getLetterbox($panel) {
        const saEl = $panel.find(selectors.scrollArea).get(0);
        const imgEl = $panel.find(selectors.image).get(0);
        if (!saEl || !imgEl) return null;
        const containerW = saEl.clientWidth;
        const containerH = saEl.clientHeight;
        if (!containerW || !containerH) return null;
        const natW = imgEl.naturalWidth || MAP_POINT_WIDTH;
        const natH = imgEl.naturalHeight || MAP_POINT_HEIGHT;
        const containerAspect = containerW / containerH;
        const imageAspect = natW / natH;
        let renderedW, renderedH, offsetX, offsetY;
        if (containerAspect > imageAspect) {
            renderedH = containerH;
            renderedW = containerH * imageAspect;
            offsetX = (containerW - renderedW) / 2;
            offsetY = 0;
        } else {
            renderedW = containerW;
            renderedH = containerW / imageAspect;
            offsetX = 0;
            offsetY = (containerH - renderedH) / 2;
        }
        return { renderedW, renderedH, offsetX, offsetY, containerW, containerH };
    }

    // Converts a browser client position to map coordinates [0–MAP_POINT_WIDTH, 0–MAP_POINT_HEIGHT],
    // accounting for current zoom/pan and letterbox offset.
    function clientToMapCoords(clientX, clientY, $panel) {
        const saEl = $panel.find(selectors.scrollArea).get(0);
        if (!saEl) return { x: 0, y: 0 };
        const rect = saEl.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const unzoomedX = (localX - centerX - state.mapPanX) / state.mapZoom + centerX;
        const unzoomedY = (localY - centerY - state.mapPanY) / state.mapZoom + centerY;
        const lb = getLetterbox($panel);
        if (lb) {
            const imgX = unzoomedX - lb.offsetX;
            const imgY = unzoomedY - lb.offsetY;
            return {
                x: Math.round(Math.max(0, Math.min(imgX / lb.renderedW, 1)) * MAP_POINT_WIDTH),
                y: Math.round(Math.max(0, Math.min(imgY / lb.renderedH, 1)) * MAP_POINT_HEIGHT),
            };
        }
        return {
            x: Math.round(Math.max(0, Math.min(unzoomedX / rect.width,  1)) * MAP_POINT_WIDTH),
            y: Math.round(Math.max(0, Math.min(unzoomedY / rect.height, 1)) * MAP_POINT_HEIGHT),
        };
    }

    // Resolve a usable image URL for a SillyTavern background file. Mirrors the
    // logic used by the CG picker: prefer the <.bg_example> thumbnail, fall back
    // to /backgrounds/<file>. Returns a plain URL (not a `url("…")` CSS string).
    function resolveBgUrl(bgfile) {
        if (!bgfile) return '';
        const el = Array.from(document.querySelectorAll('.bg_example'))
            .find(e => e.getAttribute('bgfile') === bgfile);
        if (el) {
            const imgEl = el.querySelector('.bg_example_img, img');
            if (imgEl?.tagName === 'IMG' && imgEl.src) return imgEl.src;
            if (imgEl) {
                const cs = window.getComputedStyle(imgEl);
                const m = (cs.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);
                if (m?.[1]) return m[1];
            }
            const dataUrl = el.dataset?.url || el.getAttribute('data-url');
            if (dataUrl) {
                const m = dataUrl.match(/url\(["']?([^"')]+)["']?\)/);
                return m?.[1] || dataUrl;
            }
            if (el.getAttribute('custom') === 'true') return bgfile;
        }
        return `backgrounds/${encodeURI(bgfile)}`;
    }

    function renderCustomPins($pinLayer) {
        $pinLayer.find(selectors.customPin).remove();
        const floorPins = state.customPins.filter(
            p => p.areaKey === state.area && p.floorKey === state.floor && !p.hidden
        );
        const lb = getLetterbox($(selectors.panel));
        for (const pin of floorPins) {
            let leftPercent, topPercent;
            if (lb) {
                const pxLeft = lb.offsetX + (pin.x / MAP_POINT_WIDTH)  * lb.renderedW;
                const pxTop  = lb.offsetY + (pin.y / MAP_POINT_HEIGHT) * lb.renderedH;
                leftPercent = (pxLeft / lb.containerW) * 100;
                topPercent  = (pxTop  / lb.containerH) * 100;
            } else {
                leftPercent = (pin.x / MAP_POINT_WIDTH)  * 100;
                topPercent  = (pin.y / MAP_POINT_HEIGHT) * 100;
            }
            const matchedBullet = (pin.type === "truth-bullet" || pin.type === "body")
                ? getTruthBulletByLocationId?.(pin.locationId) : null;
            const ICON_MIGRATIONS = {
                "truth-bullet-location.svg": "artillery-shell.svg",
                "body-discovery-location.svg": "chalk-outline-murder.svg",
            };
            const resolvedIcon = ICON_MIGRATIONS[pin.icon] ?? pin.icon;
            const iconSrc = `${extensionFolderPath}/assets/rooms/${escapeHtml(resolvedIcon)}`;
            const pinBulletOverlayHtml = "";

            const isHighlighted = pin.id === state.highlightedPinId;
            const isRoomHidden  = pin.type === "room"         && state.roomViewMode === "off";
            const isRoomSimple  = pin.type === "room"         && state.roomViewMode === "simple";
            const isSimple      = isRoomSimple
                               || (pin.type === "truth-bullet" && state.simpleEvidencePins)
                               || (pin.type === "body"         && state.simpleBodyPins);
            const showTooltipIcon = pin.type === "room" || pin.type === "monomachine" || pin.type === "trial";
            // Hide the small icon when the room has a BG preview to show — the BG
            // image takes its place as the visual preview, like bullet images do.
            const roomBgUrl = (pin.type === "room" && pin.bg) ? resolveBgUrl(pin.bg) : "";
            const tooltipIconHtml = (showTooltipIcon && !roomBgUrl)
                ? `<img class="map-custom-pin-tooltip-icon" src="${iconSrc}" alt="" />`
                : "";
            const tooltipBulletImageHtml = matchedBullet?.image
                ? `<img class="map-custom-pin-tooltip-bullet-image" src="${matchedBullet.image}" alt="" />`
                : "";
            const tooltipBgImageHtml = roomBgUrl
                ? `<img class="map-custom-pin-tooltip-bg-image" src="${escapeHtml(roomBgUrl)}" alt="" />`
                : "";
            const $pin = $(`
                <button
                    type="button"
                    class="map-custom-pin type-${escapeHtml(pin.type)}${isHighlighted ? " highlighted" : ""}${isRoomHidden ? " room-view-hidden" : ""}${isSimple ? " simple-pin" : ""}"
                    data-custom-pin-id="${escapeHtml(pin.id)}"
                    aria-label="${escapeHtml(pin.label)}"
                    style="left:${leftPercent}%; top:${topPercent}%;"
                >
                    <img class="map-custom-pin-icon" src="${iconSrc}" alt="" />
                    ${pinBulletOverlayHtml}
                    <span class="map-custom-pin-tooltip" aria-hidden="true">
                        ${tooltipIconHtml}
                        ${tooltipBulletImageHtml}
                        ${tooltipBgImageHtml}
                        <span class="map-custom-pin-tooltip-name">${escapeHtml(pin.label)}</span>
                        <span class="map-custom-pin-tooltip-id">${escapeHtml(pin.locationId || '')}</span>
                    </span>
                </button>
            `);

            $pinLayer.append($pin);
        }
    }


    function ensureValidFloorSelection() {
        const allAreas = getAllAreas();
        if (!allAreas[state.area]) {
            const firstKey = Object.keys(allAreas)[0];
            state.area = firstKey || "hopes_peak";
            state.floor = allAreas[state.area]?.floors[0]?.key || "floor_1";
            return;
        }
        const floorExists = allAreas[state.area].floors.some(f => f.key === state.floor);
        if (!floorExists) {
            state.floor = allAreas[state.area].floors[0]?.key || "floor_1";
        }
    }

    function getItemsController() {
        return typeof getItemsPanelController === "function" ? getItemsPanelController() : null;
    }


    function getMachineTrackVolume() {
        if (typeof getSetting !== "function") return 0.4;
        const vol = Number(getSetting("monomonoBgmVolume") ?? 40);
        return Number.isFinite(vol) ? Math.min(1, Math.max(0, vol / 100)) : 0.4;
    }

    function isMachineTrackEnabled() {
        return getMachineTrackVolume() > 0;
    }

    function syncMachineTrack($panel) {
        const shouldPlay = isMachineTrackEnabled() && $(selectors.machineOverlay).hasClass("open");
        if (shouldPlay) {
            if (!state.machineTrackStarted) {
                playShopTrack?.();
                state.machineTrackStarted = true;
            }
            return;
        }

        stopShopTrack?.();
        state.machineTrackStarted = false;
    }

    function openMachineItemList() {
        const items = getItemsController();
        if (!items?.getGiftPoolWithCounts) return;

        const rarityOrder = { SR: 0, R: 1, N: 2 };
        let showCustomNames = false;

        function updateEyeBtn() {
            const icon = showCustomNames ? "icons/eye-open.svg" : "icons/eye-closed.svg";
            const title = showCustomNames ? "Hide custom item names" : "Show custom item names";
            $(".mml-eye-btn").attr("title", title).html(`<img src="${extensionFolderPath}/assets/${icon}" alt="" style="width:14px;height:14px;object-fit:contain;filter:invert(1);opacity:0.8;pointer-events:none"/>`);
        }

        function buildRows() {
            const pool = items.getGiftPoolWithCounts();
            const sorted = pool.slice().sort((a, b) => {
                const rd = (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9);
                return rd !== 0 ? rd : a.name.localeCompare(b.name);
            });
            return sorted.map(item => {
                const revealName = item.owned > 0 || (item.isCustom && showCustomNames);
                return `
                <div class="mml-row" data-rarity="${item.rarity}" data-id="${item.id}" data-custom="${item.isCustom ? "1" : "0"}">
                    <span class="mml-rarity">${item.rarity}</span>
                    <span class="mml-name">${revealName ? item.name.toUpperCase() : "???"}</span>
                    <span class="mml-owned">${item.owned > 0 ? `x${item.owned}` : "—"}</span>
                    ${item.isCustom ? `<button type="button" class="mml-delete-btn" title="Delete item">✕</button>` : `<span></span>`}
                </div>`;
            }).join("");
        }

        $(".map-machine-item-list-modal").remove();
        $(document.body).append(`
            <div class="map-machine-item-list-modal">
                <div class="mml-window">
                    <div class="mml-header">
                        <span class="mml-title">ITEM POOL</span>
                        <div class="mml-header-actions">
                            <button type="button" class="mml-eye-btn" title="Show custom item names"><img src="${extensionFolderPath}/assets/icons/eye-closed.svg" alt="" style="width:14px;height:14px;object-fit:contain;filter:invert(1);opacity:0.8;pointer-events:none"/></button>
                            <button type="button" class="mml-add-btn" title="Add custom item">+</button>
                            <button type="button" class="mml-close">✕</button>
                        </div>
                    </div>
                    <div class="mml-create-panel">
                        <input type="text" class="mml-input mml-name-input" placeholder="ITEM NAME..." autocomplete="off" spellcheck="false" maxlength="60">
                        <textarea class="mml-input mml-desc-input" placeholder="DESCRIPTION..." autocomplete="off" spellcheck="false" maxlength="300" rows="2"></textarea>
                        <select class="mml-input mml-rarity-select">
                            <option value="N">N — COMMON</option>
                            <option value="R">R — RARE</option>
                            <option value="SR">SR — SUPER RARE</option>
                        </select>
                        <label class="mml-image-label">
                            <span class="mml-image-label-text">NO IMAGE SELECTED</span>
                            <input type="file" class="mml-image-input" accept="image/*">
                        </label>
                        <div class="mml-create-actions">
                            <button type="button" class="mml-create-cancel">CANCEL</button>
                            <button type="button" class="mml-create-submit">CREATE</button>
                        </div>
                    </div>
                    <div class="mml-list">${buildRows()}</div>
                </div>
            </div>
        `);

        let pendingImageBase64 = null;

        function resetForm() {
            $(".mml-name-input").val("");
            $(".mml-desc-input").val("");
            $(".mml-rarity-select").val("N");
            $(".mml-image-label-text").text("NO IMAGE SELECTED");
            $(".mml-image-input").val("");
            pendingImageBase64 = null;
            $(".mml-create-panel").removeClass("mml-create-panel--open");
        }

        $(".mml-eye-btn").on("click", function () {
            showCustomNames = !showCustomNames;
            updateEyeBtn();
            $(".mml-list").html(buildRows());
        });

        $(".mml-add-btn").on("click", function () {
            $(".mml-create-panel").toggleClass("mml-create-panel--open");
            if ($(".mml-create-panel").hasClass("mml-create-panel--open")) {
                $(".mml-name-input").focus();
            }
        });

        $(".mml-image-input").on("change", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingImageBase64 = e.target.result;
                $(".mml-image-label-text").text(file.name);
            };
            reader.readAsDataURL(file);
        });

        $(".mml-create-cancel").on("click", () => resetForm());

        $(".mml-create-submit").on("click", function () {
            const name = $(".mml-name-input").val().trim();
            if (!name) { $(".mml-name-input").focus(); return; }
            if (!items.createCustomGift) return;
            const desc = $(".mml-desc-input").val().trim();
            const rarity = $(".mml-rarity-select").val();
            items.createCustomGift(name, rarity, desc, pendingImageBase64);
            $(".mml-list").html(buildRows());
            resetForm();
        });

        $(".mml-list").on("click", ".mml-delete-btn", function () {
            const id = $(this).closest(".mml-row").data("id");
            if (!id || !items.removeCustomGift) return;
            items.removeCustomGift(String(id));
            $(".mml-list").html(buildRows());
        });

        $(".mml-close, .map-machine-item-list-modal").on("click", function (e) {
            if (e.target === this) $(".map-machine-item-list-modal").remove();
        });
    }

    function ensureMachineOverlay($panel) {
        if ($(selectors.machineOverlay).length) return;

        $(document.body).append(`
            <div class="map-machine-overlay" aria-hidden="true">
                <div class="map-machine-window" role="dialog" aria-label="MonoMono Machine">
                    <button type="button" class="map-machine-close" aria-label="Close MonoMono Machine">✕</button>

                    <div class="map-machine-coins-row">
                        <img class="map-machine-coin-icon" src="${extensionFolderPath}/assets/images/ui/monocoin.png" alt="Monocoin" />
                        <div class="map-machine-coins">x 0</div>
                    </div>

                    <div class="map-machine-image-wrap">
                        <div class="map-machine-sunburst" aria-hidden="true"></div>
                        <img class="map-machine-image" src="${extensionFolderPath}/assets/monochine/monochine_idle.png" alt="MonoMono Machine" />
                        <div class="map-machine-banner" aria-live="polite"></div>
                    </div>

                    <div class="map-machine-controls">
                        <button type="button" class="map-machine-button add" title="Add one coin to dupe protection load">+C</button>
                        <button type="button" class="map-machine-button add-roll" title="Add one extra roll">+R</button>
                        <button type="button" class="map-machine-button roll" title="Roll">▶</button>
                        <button type="button" class="map-machine-button map-machine-list-btn" title="View item pool">≡</button>
                    </div>

                    <div class="map-machine-info">
                        <div class="map-machine-load">LOAD: 1 COIN</div>
                        <div class="map-machine-rolls">ROLLS: 1</div>
                        <div class="map-machine-dupe">DUPE CHANCE: 0%</div>
                    </div>

                </div>
            </div>
        `);

        $(selectors.machineClose).off("click").on("click", () => {
            closeMachineOverlay($panel);
        });

        $(".map-machine-list-btn").off("click").on("click", () => {
            playSfx?.(getSfx?.().click);
            openMachineItemList();
        });

        $(selectors.machineOverlay).off("click").on("click", function (event) {
            if (event.target === this) {
                closeMachineOverlay($panel);
            }
        });

        $(selectors.machineAdd).off("click").on("click", () => {
            const items = getItemsController();
            if (!items?.getMonoMonoDupeChance) return;

            const chance = items.getMonoMonoDupeChance(state.machineCoinsLoaded, state.machineRollCount);
            if (!chance.ok) {
                updateMachineOverlay($panel);
                return;
            }

            if (state.machineCoinsLoaded >= chance.affordableLoadMax) {
                updateMachineOverlay($panel);
                return;
            }

            state.machineCoinsLoaded += 1;
            playSfx?.(getSfx?.().monocoin_insert || getSfx?.().click);
            updateMachineOverlay($panel);
        });

        $(selectors.machineAddRoll).off("click").on("click", () => {
            const items = getItemsController();
            if (!items?.getMonoMonoDupeChance) return;

            const chance = items.getMonoMonoDupeChance(state.machineCoinsLoaded, state.machineRollCount);
            if (!chance.ok) {
                updateMachineOverlay($panel);
                return;
            }

            if (state.machineRollCount >= chance.affordableRolls) {
                updateMachineOverlay($panel);
                return;
            }

            state.machineRollCount += 1;
            playSfx?.(getSfx?.().monocoin_insert || getSfx?.().click);
            updateMachineOverlay($panel);
        });

        $(selectors.machineRoll).off("click").on("click", () => {
            if (state.machineRolling) return;

            const items = getItemsController();
            if (!items?.spinMonoMonoMachine) return;

            const run = items.spinMonoMonoMachine(state.machineCoinsLoaded, state.machineRollCount);
            if (!run.ok) {
                updateMachineOverlay($panel);
                return;
            }

            playSfx?.(getSfx?.().monochine_turn || getSfx?.().click);

            state.machineRolling = true;
            $(selectors.machineRoll).prop("disabled", true);
            $(selectors.machineAdd).prop("disabled", true);
            $(selectors.machineAddRoll).prop("disabled", true);

            if (state.machineRollTimeout) {
                clearTimeout(state.machineRollTimeout);
                state.machineRollTimeout = null;
            }
            if (state.machineJingleTimeout) {
                clearTimeout(state.machineJingleTimeout);
                state.machineJingleTimeout = null;
            }

            const $img = $(selectors.machineImage);
            if ($img.length) {
                $img.attr("src", `${extensionFolderPath}/assets/monochine/monochine_roll.gif`);

                const obtainedMessage = run.rollCount > 1
                    ? `You've obtained ${run.rollCount} gifts! ${run.duplicateCount} duplicate${run.duplicateCount === 1 ? "" : "s"}.`
                    : `You've obtained ${run.result.name}!`;
                state.machineJingleTimeout = setTimeout(() => {
                    playSfx?.(getSfx?.().monochine_jingle || getSfx?.().click);
                    if (state.machineBannerDelayTimeout) {
                        clearTimeout(state.machineBannerDelayTimeout);
                        state.machineBannerDelayTimeout = null;
                    }
                    state.machineBannerDelayTimeout = setTimeout(() => {
                        showMachineBanner($panel, obtainedMessage);
                        state.machineBannerDelayTimeout = null;
                    }, MACHINE_BANNER_DELAY_MS);
                }, MACHINE_JINGLE_DELAY_MS);

                state.machineRollTimeout = setTimeout(() => {
                    $img.attr("src", `${extensionFolderPath}/assets/monochine/monochine_idle.png`);
                    state.machineRolling = false;
                    $(selectors.machineRoll).prop("disabled", false);
                    $(selectors.machineAdd).prop("disabled", false);
                    $(selectors.machineAddRoll).prop("disabled", false);
                    state.machineRollTimeout = null;
                    state.machineJingleTimeout = null;
                }, MACHINE_ROLL_DURATION_MS);
            }

            state.machineCoinsLoaded = 1;
            state.machineRollCount = 1;
            updateMachineOverlay($panel);
        });
    }

    function showMachineBanner($panel, text) {
        const $banner = $(selectors.machineBanner);
        if (!$banner.length || !text) return;

        if (state.machineBannerTimeout) {
            clearTimeout(state.machineBannerTimeout);
            state.machineBannerTimeout = null;
        }

        $(selectors.machineSunburst).addClass("show");
        $banner.text(text).addClass("show");
        state.machineBannerTimeout = setTimeout(() => {
            $banner.removeClass("show").text("");
            $(selectors.machineSunburst).removeClass("show");
            state.machineBannerTimeout = null;
        }, 1700);
    }

    function closeMachineOverlay($panel) {
        if (state.machineRollTimeout) {
            clearTimeout(state.machineRollTimeout);
            state.machineRollTimeout = null;
        }
        if (state.machineJingleTimeout) {
            clearTimeout(state.machineJingleTimeout);
            state.machineJingleTimeout = null;
        }
        if (state.machineBannerTimeout) {
            clearTimeout(state.machineBannerTimeout);
            state.machineBannerTimeout = null;
        }
        if (state.machineBannerDelayTimeout) {
            clearTimeout(state.machineBannerDelayTimeout);
            state.machineBannerDelayTimeout = null;
        }

        state.machineRolling = false;
        $(selectors.machineImage).attr("src", `${extensionFolderPath}/assets/monochine/monochine_idle.png`);
        $(selectors.machineRoll).prop("disabled", false);
        $(selectors.machineAdd).prop("disabled", false);
        $(selectors.machineAddRoll).prop("disabled", false);
        $(selectors.machineBanner).removeClass("show").text("");
        $(selectors.machineSunburst).removeClass("show");
        $panel.removeClass("machine-overlay-open");
        $(selectors.machineOverlay).removeClass("open").attr("aria-hidden", "true");
        syncMachineTrack($panel);
        onMachineClose?.();
    }

    function updateMachineOverlay($panel) {
        const items = getItemsController();
        if (!items?.getMonoMonoDupeChance) return;

        const chance = items.getMonoMonoDupeChance(state.machineCoinsLoaded, state.machineRollCount);
        const safeCoins = Math.max(0, Number(chance.availableCoins || 0));
        const chancePercent = Math.round(Number(chance.chancePercent || 0));

        $(selectors.machineDisplayCoins).text(`x ${safeCoins}`);
        $(selectors.machineDisplayLoad).text(`LOAD: ${state.machineCoinsLoaded} COIN${state.machineCoinsLoaded === 1 ? "" : "S"} / ROLL`);
        $(selectors.machineDisplayRolls).text(`ROLLS: ${state.machineRollCount}`);
        $(selectors.machineDisplayDupe).text(`DUPE CHANCE: ${chancePercent}% PER ROLL`);

    }

    function openMachineOverlay($panel) {
        ensureMachineOverlay($panel);
        state.machineCoinsLoaded = 1;
        state.machineRollCount = 1;
        updateMachineOverlay($panel);
        state.machineRolling = false;
        $(selectors.machineRoll).prop("disabled", false);
        $(selectors.machineAdd).prop("disabled", false);
        $(selectors.machineAddRoll).prop("disabled", false);
        $(selectors.machineImage).attr("src", `${extensionFolderPath}/assets/monochine/monochine_idle.png`);
        $panel.addClass("machine-overlay-open");
        $(selectors.machineOverlay).addClass("open").attr("aria-hidden", "false");
        syncMachineTrack($panel);
        onMachineOpen?.();
    }

    function renderFloorButtons($panel) {
        const $floorList = $panel.find(selectors.floorList);
        if (!$floorList.length) return;

        const area = getAllAreas()[state.area];
        if (!area) return;

        $floorList.empty();

        for (const floor of area.floors) {
            const isActive = floor.key === state.floor;
            const $entry = $(`
                <div class="map-floor-entry">
                    <button class="map-floor-button${isActive ? " active" : ""}" type="button" data-floor="${escapeHtml(floor.key)}" aria-pressed="${String(isActive)}">${escapeHtml(floor.label)}</button>
                    <div class="map-floor-entry-controls">
                        <button class="map-floor-entry-rename" type="button" title="Rename">&#x270F;</button>
                        <button class="map-floor-entry-delete" type="button" title="Delete">&#x2715;</button>
                    </div>
                </div>
            `);
            $entry.find(".map-floor-button").on("click", () => {
                if (state.floor === floor.key) return;
                state.floor = floor.key;
                renderMapPanel();
            });
            $entry.find(".map-floor-entry-rename").on("click", (e) => { e.stopPropagation(); openRenameFloorModal(state.area, floor.key); });
            $entry.find(".map-floor-entry-delete").on("click", (e) => {
                e.stopPropagation();
                if (area.floors.length <= 1) return; // can't delete last floor
                confirmDeleteFloor(state.area, floor.key);
            });
            $floorList.append($entry);
        }

        const $addFloor = $(`<button class="map-add-floor-button" type="button">+ ADD FLOOR</button>`);
        $addFloor.on("click", () => openAddFloorModal(state.area));
        $floorList.append($addFloor);
    }

    function renderMapImage($panel) {
        const area = getAllAreas()[state.area];
        const floor = getAreaFloor(state.area, state.floor);

        if (!area || !floor) return;

        const $image = $panel.find(selectors.image);
        const $title = $panel.find(selectors.title);
        const $subtitle = $panel.find(selectors.subtitle);
        const $imageWrap = $panel.find(".map-image-wrap");
        const $pinLayer = $panel.find(selectors.pinLayer);

        if ($image.length) {
            const imageSrc = floor.image?.startsWith("data:")
                ? floor.image
                : floor.image ? `${extensionFolderPath}/assets/${floor.image}` : "";
            $image.attr("src", imageSrc);
            $image.attr("alt", `${area.label} ${floor.label} map`);
            $image.toggle(!!imageSrc);
        }

        if ($title.length) {
            $title.text(`${area.label} / ${floor.label}`);
        }

        if ($subtitle.length) {
            $subtitle.text(floor.description);
        }

        $pinLayer.find(selectors.customPin).remove();

        if ($pinLayer.length) {
            renderCustomPins($pinLayer);
        }
    }

    function openRenameAreaModal(areaKey) {
        $(".map-create-area-modal").remove();
        const area = getAllAreas()[areaKey];
        if (!area) return;

        const $modal = $(`
            <div class="map-create-area-modal">
                <div class="map-create-area-box">
                    <div class="map-create-area-title">EDIT AREA</div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">AREA NAME <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="mra-name" maxlength="60" value="${escapeHtml(area.label)}" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">AREA ID <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input map-create-area-id-input" id="mra-id" maxlength="80" value="${escapeHtml(area.id || '')}" placeholder="e.g. hopes_peak" />
                    </div>
                    <div class="map-create-area-actions">
                        <button class="map-create-area-save" type="button">SAVE</button>
                        <button class="map-create-area-cancel" type="button">CANCEL</button>
                    </div>
                </div>
            </div>
        `);
        $("body").append($modal);
        $modal.find("#mra-name").trigger("focus").trigger("select");

        $modal.find("#mra-id").on("input", function () {
            const el = this;
            const start = el.selectionStart, end = el.selectionEnd;
            const cleaned = el.value.replace(/ /g, "_");
            if (cleaned !== el.value) { el.value = cleaned; el.setSelectionRange(start, end); }
        });

        $modal.find(".map-create-area-save").on("click", () => {
            const newLabel = $modal.find("#mra-name").val().trim();
            const newId    = $modal.find("#mra-id").val().trim();
            if (!newLabel) { $modal.find("#mra-name").css("border-color", "rgba(255,80,80,0.8)").trigger("focus"); return; }
            if (!newId)    { $modal.find("#mra-id").css("border-color", "rgba(255,80,80,0.8)").trigger("focus"); return; }
            if (isBuiltInArea(areaKey)) {
                if (!state.areaOverrides[areaKey]) state.areaOverrides[areaKey] = {};
                state.areaOverrides[areaKey].label = newLabel.toUpperCase();
                state.areaOverrides[areaKey].id    = newId;
                saveAreaOverrides();
            } else {
                const ca = state.customAreas.find(a => a.key === areaKey);
                if (ca) { ca.label = newLabel.toUpperCase(); ca.id = newId; saveCustomAreas(); }
            }
            $modal.remove();
            renderMapPanel();
        });
        $modal.find(".map-create-area-cancel").on("click", () => $modal.remove());
        $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });
    }

    function confirmDeleteArea(areaKey) {
        $(".map-create-area-modal").remove();
        const area = getAllAreas()[areaKey];
        if (!area) return;

        const $modal = $(`
            <div class="map-create-area-modal">
                <div class="map-create-area-box">
                    <div class="map-create-area-title">DELETE AREA</div>
                    <div class="map-create-area-confirm-text">Delete "<strong>${escapeHtml(area.label)}</strong>"? All location pins in this area will be removed. This cannot be undone.</div>
                    <div class="map-create-area-actions">
                        <button class="map-create-area-save map-create-area-danger" type="button">DELETE</button>
                        <button class="map-create-area-cancel" type="button">CANCEL</button>
                    </div>
                </div>
            </div>
        `);
        $("body").append($modal);

        $modal.find(".map-create-area-danger").on("click", () => {
            if (isBuiltInArea(areaKey)) {
                if (!state.areaOverrides[areaKey]) state.areaOverrides[areaKey] = {};
                state.areaOverrides[areaKey].deleted = true;
                saveAreaOverrides();
            } else {
                state.customAreas = state.customAreas.filter(a => a.key !== areaKey);
                saveCustomAreas();
            }
            state.customPins = state.customPins.filter(p => p.areaKey !== areaKey);
            saveCustomPins();
            if (state.area === areaKey) {
                const firstKey = Object.keys(getAllAreas())[0];
                state.area = firstKey || "hopes_peak";
                state.floor = getAllAreas()[state.area]?.floors[0]?.key || "floor_1";
            }
            $modal.remove();
            renderMapPanel();
        });
        $modal.find(".map-create-area-cancel").on("click", () => $modal.remove());
        $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });
    }

    function openRenameFloorModal(areaKey, floorKey) {
        $(".map-create-area-modal").remove();
        const floor = getAreaFloor(areaKey, floorKey);
        if (!floor) return;

        const $modal = $(`
            <div class="map-create-area-modal">
                <div class="map-create-area-box">
                    <div class="map-create-area-title">EDIT FLOOR</div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">FLOOR NAME <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="mrf-name" maxlength="60" value="${escapeHtml(floor.label)}" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">FLOOR ID <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input map-create-area-id-input" id="mrf-id" maxlength="80" value="${escapeHtml(floor.id || '')}" placeholder="e.g. floor_1" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">DESCRIPTION</div>
                        <input type="text" class="map-create-area-input" id="mrf-desc" maxlength="120" value="${escapeHtml(floor.description || '')}" />
                    </div>
                    <div class="map-create-area-actions">
                        <button class="map-create-area-save" type="button">SAVE</button>
                        <button class="map-create-area-cancel" type="button">CANCEL</button>
                    </div>
                </div>
            </div>
        `);
        $("body").append($modal);
        $modal.find("#mrf-name").trigger("focus").trigger("select");

        $modal.find("#mrf-id").on("input", function () {
            const el = this;
            const start = el.selectionStart, end = el.selectionEnd;
            const cleaned = el.value.replace(/ /g, "_");
            if (cleaned !== el.value) { el.value = cleaned; el.setSelectionRange(start, end); }
        });

        $modal.find(".map-create-area-save").on("click", () => {
            const newLabel = $modal.find("#mrf-name").val().trim();
            const newId    = $modal.find("#mrf-id").val().trim();
            const newDesc  = $modal.find("#mrf-desc").val().trim();
            if (!newLabel) { $modal.find("#mrf-name").css("border-color", "rgba(255,80,80,0.8)").trigger("focus"); return; }
            if (!newId)    { $modal.find("#mrf-id").css("border-color", "rgba(255,80,80,0.8)").trigger("focus"); return; }

            if (isBuiltInArea(areaKey)) {
                const ov = state.areaOverrides[areaKey] || {};
                const extra = (ov.extraFloors || []).find(f => f.key === floorKey);
                if (extra) {
                    extra.label = newLabel.toUpperCase();
                    extra.description = newDesc;
                    extra.id = newId;
                } else {
                    if (!ov.floorRenames) ov.floorRenames = {};
                    if (!ov.floorDescs)   ov.floorDescs   = {};
                    if (!ov.floorIds)     ov.floorIds     = {};
                    ov.floorRenames[floorKey] = newLabel.toUpperCase();
                    ov.floorDescs[floorKey]   = newDesc;
                    ov.floorIds[floorKey]     = newId;
                }
                state.areaOverrides[areaKey] = ov;
                saveAreaOverrides();
            } else {
                const ca = state.customAreas.find(a => a.key === areaKey);
                const f = ca?.floors.find(f => f.key === floorKey);
                if (f) { f.label = newLabel.toUpperCase(); f.description = newDesc; f.id = newId; saveCustomAreas(); }
            }
            $modal.remove();
            renderMapPanel();
        });
        $modal.find(".map-create-area-cancel").on("click", () => $modal.remove());
        $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });
    }

    function confirmDeleteFloor(areaKey, floorKey) {
        $(".map-create-area-modal").remove();
        const floor = getAreaFloor(areaKey, floorKey);
        if (!floor) return;

        const $modal = $(`
            <div class="map-create-area-modal">
                <div class="map-create-area-box">
                    <div class="map-create-area-title">DELETE FLOOR</div>
                    <div class="map-create-area-confirm-text">Delete "<strong>${escapeHtml(floor.label)}</strong>"? All location pins on this floor will be removed. This cannot be undone.</div>
                    <div class="map-create-area-actions">
                        <button class="map-create-area-save map-create-area-danger" type="button">DELETE</button>
                        <button class="map-create-area-cancel" type="button">CANCEL</button>
                    </div>
                </div>
            </div>
        `);
        $("body").append($modal);

        $modal.find(".map-create-area-danger").on("click", () => {
            if (isBuiltInArea(areaKey)) {
                const ov = state.areaOverrides[areaKey] || {};
                const extraIdx = (ov.extraFloors || []).findIndex(f => f.key === floorKey);
                if (extraIdx >= 0) {
                    ov.extraFloors.splice(extraIdx, 1);
                } else {
                    if (!ov.deletedFloors) ov.deletedFloors = [];
                    ov.deletedFloors.push(floorKey);
                }
                state.areaOverrides[areaKey] = ov;
                saveAreaOverrides();
            } else {
                const ca = state.customAreas.find(a => a.key === areaKey);
                if (ca) { ca.floors = ca.floors.filter(f => f.key !== floorKey); saveCustomAreas(); }
            }
            state.customPins = state.customPins.filter(p => !(p.areaKey === areaKey && p.floorKey === floorKey));
            saveCustomPins();
            if (state.floor === floorKey) {
                ensureValidFloorSelection();
            }
            $modal.remove();
            renderMapPanel();
        });
        $modal.find(".map-create-area-cancel").on("click", () => $modal.remove());
        $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });
    }

    function openAddFloorModal(areaKey) {
        $(".map-create-area-modal").remove();

        const $modal = $(`
            <div class="map-create-area-modal">
                <div class="map-create-area-box">
                    <div class="map-create-area-title">ADD FLOOR</div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">FLOOR NAME <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="maf-name" maxlength="60" placeholder="e.g. Basement" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">FLOOR ID <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input map-create-area-id-input" id="maf-id" maxlength="80" placeholder="e.g. basement" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">DESCRIPTION <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="maf-desc" maxlength="120" placeholder="e.g. Underground storage level." />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">MAP IMAGE <span class="map-create-area-optional">(optional)</span></div>
                        <label class="map-create-area-upload-label">
                            <span class="map-create-area-upload-text">UPLOAD IMAGE</span>
                            <input type="file" class="map-create-area-file" accept="image/*" style="display:none" />
                        </label>
                        <div class="map-create-area-filename"></div>
                    </div>
                    <div class="map-create-area-actions">
                        <button class="map-create-area-save" type="button">ADD</button>
                        <button class="map-create-area-cancel" type="button">CANCEL</button>
                    </div>
                </div>
            </div>
        `);
        $("body").append($modal);
        $modal.find("#maf-name").trigger("focus");

        $modal.find("#maf-name").on("input", function () {
            const $idInput = $modal.find("#maf-id");
            if ($idInput.data("user-edited")) return;
            $idInput.val(toAreaSlug($(this).val()));
        });

        $modal.find("#maf-id").on("input", function () {
            $(this).data("user-edited", true);
            const el = this;
            const start = el.selectionStart, end = el.selectionEnd;
            const cleaned = el.value.replace(/ /g, "_");
            if (cleaned !== el.value) { el.value = cleaned; el.setSelectionRange(start, end); }
        });

        let pendingImageDataUrl = "";
        $modal.find(".map-create-area-file").on("change", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingImageDataUrl = e.target.result;
                $modal.find(".map-create-area-filename").text(file.name);
                $modal.find(".map-create-area-upload-text").text("CHANGE IMAGE");
            };
            reader.readAsDataURL(file);
        });

        $modal.find(".map-create-area-save").on("click", () => {
            const name = $modal.find("#maf-name").val().trim();
            const id   = $modal.find("#maf-id").val().trim();
            const desc = $modal.find("#maf-desc").val().trim();
            let valid = true;
            [[$modal.find("#maf-name"), name], [$modal.find("#maf-id"), id], [$modal.find("#maf-desc"), desc]].forEach(([$el, val]) => {
                $el.css("border-color", val ? "" : "rgba(255,80,80,0.8)");
                if (!val) { if (valid) $el.trigger("focus"); valid = false; }
            });
            if (!valid) return;

            const floorKey = "floor_" + Date.now();
            const newFloor = { key: floorKey, label: name.toUpperCase(), id, description: desc, image: pendingImageDataUrl };

            if (isBuiltInArea(areaKey)) {
                if (!state.areaOverrides[areaKey]) state.areaOverrides[areaKey] = {};
                if (!state.areaOverrides[areaKey].extraFloors) state.areaOverrides[areaKey].extraFloors = [];
                state.areaOverrides[areaKey].extraFloors.push(newFloor);
                saveAreaOverrides();
            } else {
                const ca = state.customAreas.find(a => a.key === areaKey);
                if (ca) { ca.floors.push(newFloor); saveCustomAreas(); }
            }
            state.floor = floorKey;
            $modal.remove();
            renderMapPanel();
        });
        $modal.find(".map-create-area-cancel").on("click", () => $modal.remove());
        $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });
    }

    function renderAreaButtons($panel) {
        const $areaList = $panel.find(".map-area-list");
        $areaList.find(".map-area-entry").remove();

        for (const [key, area] of Object.entries(getAllAreas())) {
            const isActive = key === state.area;
            const $entry = $(`
                <div class="map-area-entry">
                    <button class="map-area-button${isActive ? " active" : ""}" type="button" data-area="${escapeHtml(key)}" aria-pressed="${String(isActive)}">${escapeHtml(area.label)}</button>
                    <div class="map-area-entry-controls">
                        <button class="map-area-entry-rename" type="button" title="Rename">&#x270F;</button>
                        <button class="map-area-entry-delete" type="button" title="Delete">&#x2715;</button>
                    </div>
                </div>
            `);
            $entry.find(".map-area-button").on("click", () => {
                if (state.area === key) return;
                state.area = key;
                ensureValidFloorSelection();
                renderMapPanel();
            });
            $entry.find(".map-area-entry-rename").on("click", (e) => { e.stopPropagation(); openRenameAreaModal(key); });
            $entry.find(".map-area-entry-delete").on("click", (e) => { e.stopPropagation(); confirmDeleteArea(key); });
            $areaList.find(selectors.addAreaBtn).before($entry);
        }
    }

    function openCreateAreaModal() {
        $(".map-create-area-modal").remove();

        const $modal = $(`
            <div class="map-create-area-modal">
                <div class="map-create-area-box">
                    <div class="map-create-area-title">CREATE AREA</div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">AREA NAME <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="mca-name" maxlength="60" placeholder="e.g. Jabberwock Island" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">AREA ID <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input map-create-area-id-input" id="mca-id" maxlength="80" placeholder="e.g. jabberwock_island" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">FLOOR NAME <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="mca-floor" maxlength="60" placeholder="e.g. Main Island" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">FLOOR ID <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input map-create-area-id-input" id="mca-floor-id" maxlength="80" placeholder="e.g. main_island" />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">DESCRIPTION <span class="map-create-area-required">*</span></div>
                        <input type="text" class="map-create-area-input" id="mca-desc" maxlength="120" placeholder="e.g. The central island area." />
                    </div>
                    <div class="map-create-area-field">
                        <div class="map-create-area-label">MAP IMAGE <span class="map-create-area-optional">(optional)</span></div>
                        <label class="map-create-area-upload-label">
                            <span class="map-create-area-upload-text">UPLOAD IMAGE</span>
                            <input type="file" class="map-create-area-file" accept="image/*" style="display:none" />
                        </label>
                        <div class="map-create-area-filename"></div>
                    </div>
                    <div class="map-create-area-actions">
                        <button class="map-create-area-save" type="button">CREATE</button>
                        <button class="map-create-area-cancel" type="button">CANCEL</button>
                    </div>
                </div>
            </div>
        `);

        $("body").append($modal);

        $modal.find("#mca-name").on("input", function () {
            const $idInput = $modal.find("#mca-id");
            if ($idInput.data("user-edited")) return;
            $idInput.val(toAreaSlug($(this).val()));
        });

        $modal.find("#mca-floor").on("input", function () {
            const $idInput = $modal.find("#mca-floor-id");
            if ($idInput.data("user-edited")) return;
            $idInput.val(toAreaSlug($(this).val()));
        });

        $modal.find("#mca-id, #mca-floor-id").on("input", function () {
            $(this).data("user-edited", true);
            const el = this;
            const start = el.selectionStart, end = el.selectionEnd;
            const cleaned = el.value.replace(/ /g, "_");
            if (cleaned !== el.value) { el.value = cleaned; el.setSelectionRange(start, end); }
        });

        let pendingImageDataUrl = "";

        $modal.find(".map-create-area-file").on("change", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingImageDataUrl = e.target.result;
                $modal.find(".map-create-area-filename").text(file.name);
                $modal.find(".map-create-area-upload-text").text("CHANGE IMAGE");
            };
            reader.readAsDataURL(file);
        });

        $modal.find(".map-create-area-save").on("click", () => {
            const name    = $modal.find("#mca-name").val().trim();
            const areaId  = $modal.find("#mca-id").val().trim();
            const floor   = $modal.find("#mca-floor").val().trim();
            const floorId = $modal.find("#mca-floor-id").val().trim();
            const desc    = $modal.find("#mca-desc").val().trim();

            let valid = true;
            [[$modal.find("#mca-name"), name], [$modal.find("#mca-id"), areaId], [$modal.find("#mca-floor"), floor], [$modal.find("#mca-floor-id"), floorId], [$modal.find("#mca-desc"), desc]].forEach(([$el, val]) => {
                $el.css("border-color", val ? "" : "rgba(255,80,80,0.8)");
                if (!val) { if (valid) $el.trigger("focus"); valid = false; }
            });
            if (!valid) return;

            const key = "custom_" + Date.now();
            const newArea = {
                key,
                label: name.toUpperCase(),
                id: areaId,
                custom: true,
                floors: [{ key: "floor_1", label: floor.toUpperCase(), id: floorId, description: desc, image: pendingImageDataUrl }],
            };

            state.customAreas.push(newArea);
            saveCustomAreas();
            state.area  = key;
            state.floor = "floor_1";
            $modal.remove();
            renderMapPanel();
        });

        $modal.find(".map-create-area-cancel").on("click", () => $modal.remove());
        $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });
    }

    function applyMapTransform($panel) {
        const zoom = state.mapZoom;
        const t = `translate(${state.mapPanX}px, ${state.mapPanY}px) scale(${zoom})`;
        $panel.find(selectors.image).css({ transform: t });
        $panel.find(selectors.pinLayer).css({ transform: t });
    }

    function applyMapZoom($panel) {
        const zoom = state.mapZoom;
        const pct = Math.round(zoom * 100);
        if (zoom <= 1.0) {
            state.mapPanX = 0;
            state.mapPanY = 0;
        }
        $panel.find(selectors.scrollArea).toggleClass("map-zoomed", zoom > 1.0);
        applyMapTransform($panel);
        $panel.find(selectors.zoomLevel).text(`${pct}%`);
    }

    function bindMapPan($panel) {
        const $scrollArea = $panel.find(selectors.scrollArea);
        const $wrap = $panel.find(".map-image-wrap");
        if (!$scrollArea.length || !$wrap.length) return;

        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let startPanX = 0;
        let startPanY = 0;

        $wrap.off("mousedown.mappan");
        $(document).off("mousemove.mappan mouseup.mappan");

        $wrap.on("mousedown.mappan", (e) => {
            if (!$scrollArea.hasClass("map-zoomed")) return;
            if ($(e.target).closest("button, select").length) return;
            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            startPanX = state.mapPanX;
            startPanY = state.mapPanY;
            $wrap.addClass("map-panning");
            e.preventDefault();
        });

        $(document).on("mousemove.mappan", (e) => {
            if (!isPanning) return;
            const zoom = state.mapZoom;
            const el = $scrollArea.get(0);
            const maxX = (el.clientWidth * (zoom - 1)) / 2;
            const maxY = (el.clientHeight * (zoom - 1)) / 2;
            state.mapPanX = Math.max(-maxX, Math.min(maxX, startPanX + (e.clientX - startX)));
            state.mapPanY = Math.max(-maxY, Math.min(maxY, startPanY + (e.clientY - startY)));
            applyMapTransform($panel);
        });

        $(document).on("mouseup.mappan", () => {
            if (!isPanning) return;
            isPanning = false;
            $wrap.removeClass("map-panning");
        });
    }

    function bindMapZoomControls($panel) {
        $panel.find(selectors.zoomIn).off("click.mapzoom").on("click.mapzoom", () => {
            if (state.mapZoom >= 2.5) return;
            state.mapZoom = Math.min(2.5, Math.round((state.mapZoom + 0.25) * 100) / 100);
            applyMapZoom($panel);
        });
        $panel.find(selectors.zoomOut).off("click.mapzoom").on("click.mapzoom", () => {
            if (state.mapZoom <= 1.0) return;
            state.mapZoom = Math.max(1.0, Math.round((state.mapZoom - 0.25) * 100) / 100);
            applyMapZoom($panel);
        });
    }

    function bindCustomPinsControls($panel) {
        const $imageWrap = $panel.find(".map-image-wrap");

        // Populate icon grid once
        const $grid = $panel.find(selectors.pinsIconGrid);
        if ($grid.length && !$grid.children().length) {
            for (const file of ROOM_SVG_FILES) {
                const src = `${extensionFolderPath}/assets/rooms/${file}`;
                const $btn = $(`
                    <button type="button" class="map-pins-icon-btn" data-icon="${escapeHtml(file)}" title="${escapeHtml(file.replace(".svg", "").replace(/-/g, " "))}">
                        <img src="${src}" alt="" />
                    </button>
                `);
                $grid.append($btn);
            }
            // Select first by default
            $grid.find(".map-pins-icon-btn").first().addClass("selected");
        }

        $panel.off("click.pinsIconBtn").on("click.pinsIconBtn", ".map-pins-icon-btn", function () {
            $panel.find(".map-pins-icon-btn.selected").removeClass("selected");
            $(this).addClass("selected");
        });

        $panel.off("click.pinsTypeBtn").on("click.pinsTypeBtn", selectors.pinsTypeBtn, function () {
            $panel.find(`${selectors.pinsTypeBtn}.active`).removeClass("active");
            $(this).addClass("active");
            const isRoom = $(this).data("type") === "room";
            $panel.find(".map-pins-icon-section").prop("hidden", !isRoom);
        });

        // Custom pin click — monomachine opens machine overlay, trial opens trial screen
        $panel.off("click.customPin").on("click.customPin", selectors.customPin, function () {
            if (state.pinPlacementMode) return;
            if ($(this).data("drag-moved")) { $(this).removeData("drag-moved"); return; }
            const pinId = $(this).data("custom-pin-id");
            const pin = state.customPins.find(p => p.id === pinId);
            if (!pin) return;
            playSfx?.(getSfx?.().click);
            if (pin.type === "monomachine") {
                openMachineOverlay($panel);
            } else if (pin.type === "trial") {
                onTrialStartRequest?.({ source: "map_pin", area: state.area, floor: state.floor });
            } else if (pin.type === "truth-bullet" || pin.type === "body") {
                const bullet = getTruthBulletByLocationId?.(pin.locationId);
                if (bullet) navigateToTruth?.(bullet.id);
            }
        });

        // ADD PIN — show creation panel
        $panel.find(selectors.pinsAdd).off("click.pinsAdd").on("click.pinsAdd", () => {
            $panel.find(selectors.pinsCreatePanel).prop("hidden", false);
            $panel.find(selectors.pinsAdd).prop("disabled", true);
        });

        // TOGGLE ROOM VIEW (cycles: on → simple → off → on)
        $panel.find(selectors.pinsToggleRoomView).off("click.pinsToggleRoomView").on("click.pinsToggleRoomView", function () {
            const next = ROOM_VIEW_CYCLE[(ROOM_VIEW_CYCLE.indexOf(state.roomViewMode) + 1) % ROOM_VIEW_CYCLE.length];
            state.roomViewMode = next;
            window.localStorage?.setItem(ROOM_VIEW_STORAGE_KEY, next);
            const roomViewLabels = { on: "ROOM VIEW: ON", simple: "ROOM VIEW: SIMPLE", off: "ROOM VIEW: OFF" };
            $(this).toggleClass("active", next !== "on").text(roomViewLabels[next]);
            const $roomPins = $panel.find(selectors.pinLayer).find(".map-custom-pin.type-room");
            $roomPins.toggleClass("room-view-hidden", next === "off")
                     .toggleClass("simple-pin",       next === "simple");
        });

        // TOGGLE SIMPLE EVIDENCE
        $panel.find(selectors.pinsToggleSimpleEvidence).off("click.pinsToggleSimpleEvidence").on("click.pinsToggleSimpleEvidence", function () {
            state.simpleEvidencePins = !state.simpleEvidencePins;
            window.localStorage?.setItem(SIMPLE_EVIDENCE_STORAGE_KEY, String(state.simpleEvidencePins));
            $(this).toggleClass("active", state.simpleEvidencePins)
                   .text(state.simpleEvidencePins ? "TOGGLE SIMPLE EVIDENCE OFF" : "TOGGLE SIMPLE EVIDENCE ON");
            $panel.find(selectors.pinLayer).find(".map-custom-pin.type-truth-bullet").toggleClass("simple-pin", state.simpleEvidencePins);
        });

        // TOGGLE SIMPLE BODY
        $panel.find(selectors.pinsToggleSimpleBody).off("click.pinsToggleSimpleBody").on("click.pinsToggleSimpleBody", function () {
            state.simpleBodyPins = !state.simpleBodyPins;
            window.localStorage?.setItem(SIMPLE_BODY_STORAGE_KEY, String(state.simpleBodyPins));
            $(this).toggleClass("active", state.simpleBodyPins)
                   .text(state.simpleBodyPins ? "TOGGLE SIMPLE BODY OFF" : "TOGGLE SIMPLE BODY ON");
            $panel.find(selectors.pinLayer).find(".map-custom-pin.type-body").toggleClass("simple-pin", state.simpleBodyPins);
        });

        $panel.find(selectors.pinsLabelInput).off("input.pinsLabel").on("input.pinsLabel", function () {
            const $idInput = $panel.find(selectors.pinsIdInput);
            if ($idInput.data("user-edited")) return;
            $idInput.val($(this).val().trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
        });

        $panel.find(selectors.pinsIdInput).off("input.pinsId").on("input.pinsId", function () {
            $(this).removeClass("map-pins-input-error").data("user-edited", true);
            const el = this;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const replaced = el.value.replace(/ /g, "_");
            if (replaced !== el.value) {
                el.value = replaced;
                el.setSelectionRange(start, end);
            }
        });

        // CANCEL
        $panel.find(selectors.pinsCancelBtn).off("click.pinsCancel").on("click.pinsCancel", () => {
            exitPinPlacementMode($panel);
        });

        // PLACE ON MAP
        $panel.find(selectors.pinsPlaceBtn).off("click.pinsPlace").on("click.pinsPlace", () => {
            const type = $panel.find(`${selectors.pinsTypeBtn}.active`).data("type") || "room";
            const icon = TYPE_DEFAULT_ICONS[type] ?? ($panel.find(".map-pins-icon-btn.selected").data("icon") || ROOM_SVG_FILES[0]);
            const label = ($panel.find(selectors.pinsLabelInput).val() || "").trim() || icon.replace(".svg", "").replace(/-/g, " ");
            const locationId = ($panel.find(selectors.pinsIdInput).val() || "").trim();
            if (!locationId) {
                $panel.find(selectors.pinsIdInput).addClass("map-pins-input-error").trigger("focus");
                return;
            }
            state.pendingCustomPin = { icon, type, label, locationId };
            state.pinPlacementMode = true;
            $panel.find(selectors.pinsPlaceBtn).prop("disabled", true);
            $panel.find(selectors.pinsPlaceHint).prop("hidden", false);
            $imageWrap.addClass("map-placement-mode");
        });

        // Click on map to place pin
        $imageWrap.off("click.pinPlace").on("click.pinPlace", (e) => {
            if (!state.pinPlacementMode || !state.pendingCustomPin) return;
            if ($(e.target).closest("button").length && !$(e.target).closest(".map-image-wrap").is(e.target)) return;
            const { x, y } = clientToMapCoords(e.clientX, e.clientY, $panel);

            const newPin = {
                id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                ...state.pendingCustomPin,
                areaKey: state.area,
                floorKey: state.floor,
                x,
                y,
            };
            state.customPins.push(newPin);
            saveCustomPins();
            exitPinPlacementMode($panel);
            renderMapPanel();
        });

        // PIN LIST — click name to highlight, click X to delete
        // Click off a pin — clear highlight / collapse tooltip
        $panel.off("click.pinDeselect").on("click.pinDeselect", function (e) {
            if (!state.highlightedPinId) return;
            if ($(e.target).closest(selectors.customPin).length) return;
            if ($(e.target).closest(".map-pins-list-item").length) return;
            state.highlightedPinId = null;
            $panel.find(selectors.customPin).removeClass("highlighted");
            $panel.find(".map-pins-list-item").removeClass("active");
        });

        $panel.off("click.pinListHighlight").on("click.pinListHighlight", ".map-pins-list-name", function () {
            const pinId = $(this).closest(".map-pins-list-item").data("pin-id");
            state.highlightedPinId = state.highlightedPinId === pinId ? null : pinId;
            $panel.find(selectors.customPin).removeClass("highlighted");
            $panel.find(".map-pins-list-item").removeClass("active");
            if (state.highlightedPinId) {
                $panel.find(`[data-custom-pin-id="${state.highlightedPinId}"]`).addClass("highlighted");
                $(this).closest(".map-pins-list-item").addClass("active");
            }
        });

        // DRAG PIN to reposition
        $panel.off("mousedown.pinDrag").on("mousedown.pinDrag", selectors.customPin, function (e) {
            if (state.pinPlacementMode) return;
            if (e.button !== 0) return;

            const pinId = $(this).data("custom-pin-id");
            const pin = state.customPins.find(p => p.id === pinId);
            if (!pin) return;
            if (pin.locked) return;

            const $pin = $(this);
            const wrapEl = $imageWrap.get(0);
            let dragged = false;

            function toMapCoords(clientX, clientY) {
                return clientToMapCoords(clientX, clientY, $panel);
            }

            function onMouseMove(ev) {
                dragged = true;
                $pin.addClass("map-custom-pin-dragging");
                const { x, y } = toMapCoords(ev.clientX, ev.clientY);
                const lb = getLetterbox($panel);
                if (lb) {
                    const pxLeft = lb.offsetX + (x / MAP_POINT_WIDTH)  * lb.renderedW;
                    const pxTop  = lb.offsetY + (y / MAP_POINT_HEIGHT) * lb.renderedH;
                    $pin.css({
                        left: `${(pxLeft / lb.containerW) * 100}%`,
                        top:  `${(pxTop  / lb.containerH) * 100}%`,
                    });
                } else {
                    $pin.css({
                        left: `${(x / MAP_POINT_WIDTH)  * 100}%`,
                        top:  `${(y / MAP_POINT_HEIGHT) * 100}%`,
                    });
                }
            }

            function onMouseUp(ev) {
                $(document).off("mousemove.pinDrag mouseup.pinDrag");
                $pin.removeClass("map-custom-pin-dragging");
                if (!dragged) return;
                $pin.data("drag-moved", true);
                const { x, y } = toMapCoords(ev.clientX, ev.clientY);
                pin.x = x;
                pin.y = y;
                saveCustomPins();
            }

            $(document).off("mousemove.pinDrag mouseup.pinDrag")
                .on("mousemove.pinDrag", onMouseMove)
                .on("mouseup.pinDrag", onMouseUp);

            e.preventDefault();
        });

        // Block click after drag so the pin action doesn't fire
        $panel.off("click.pinDragGuard").on("click.pinDragGuard", selectors.customPin, function (e) {
            if ($(this).data("drag-moved")) {
                $(this).removeData("drag-moved");
                e.stopImmediatePropagation();
            }
        });

        $panel.off("click.pinListLock").on("click.pinListLock", ".map-pins-list-lock", function () {
            const pinId = $(this).closest(".map-pins-list-item").data("pin-id");
            const pin = state.customPins.find(p => p.id === pinId);
            if (!pin) return;
            pin.locked = !pin.locked;
            saveCustomPins();
            renderPinList($panel);
        });

        $panel.off("click.pinListEdit").on("click.pinListEdit", ".map-pins-list-edit", function () {
            const pinId = $(this).closest(".map-pins-list-item").data("pin-id");
            const pin = state.customPins.find(p => p.id === pinId);
            if (!pin) return;

            $(".map-pin-edit-modal").remove();

            const isRoom = pin.type === "room";
            const iconGridHtml = isRoom ? `
                <div class="map-pin-edit-field">
                    <div class="map-pin-edit-label">LOCATION ICON</div>
                    <div class="map-pin-edit-icon-grid">
                        ${ROOM_SVG_FILES.map(file => {
                            const src = `${extensionFolderPath}/assets/rooms/${escapeHtml(file)}`;
                            const label = file.replace(".svg", "").replace(/-/g, " ");
                            const sel = file === pin.icon ? " selected" : "";
                            return `<button type="button" class="map-pins-icon-btn${sel}" data-icon="${escapeHtml(file)}" title="${escapeHtml(label)}"><img src="${src}" alt="" /></button>`;
                        }).join("")}
                    </div>
                </div>` : "";

            // Background data — sourced from SillyTavern's <.bg_example> elements.
            // We build a list of { bgfile, label, thumb } so the picker can show
            // a real preview thumbnail for each background, matching the CG picker.
            const bgItems = Array.from(document.querySelectorAll('.bg_example')).map(el => {
                const bgfile = el.getAttribute('bgfile') || '';
                if (!bgfile) return null;
                const label = bgfile.split('/').pop().replace(/\.[^.]+$/, '') || bgfile;
                const imgEl = el.querySelector('.bg_example_img, img');
                let thumb = 'none';
                if (imgEl) {
                    if (imgEl.tagName === 'IMG' && imgEl.src) {
                        thumb = `url("${imgEl.src}")`;
                    } else {
                        const cs = window.getComputedStyle(imgEl);
                        if (cs.backgroundImage && cs.backgroundImage !== 'none') thumb = cs.backgroundImage;
                        else if (imgEl.style.backgroundImage) thumb = imgEl.style.backgroundImage;
                    }
                }
                const isCustom = el.getAttribute('custom') === 'true';
                const cssUrl = el.dataset?.url || el.getAttribute('data-url')
                    || (thumb !== 'none' ? thumb : null)
                    || (isCustom ? `url("${bgfile}")` : `url("backgrounds/${encodeURIComponent(bgfile)}")`);
                if (thumb === 'none' && cssUrl) thumb = cssUrl;
                return { bgfile, label, thumb };
            }).filter(Boolean);

            // Currently chosen BG → its preview, label, and thumbnail.
            // The thumb is applied via JS after the modal renders rather than as an
            // inline `style="…"` attribute, because background-image url() values
            // contain double quotes that would prematurely close the style attribute.
            const chosenBg   = pin.bg || '';
            const chosenItem = bgItems.find(b => b.bgfile === chosenBg) || null;
            const chosenLabel = chosenItem?.label || (chosenBg ? chosenBg : '(none)');

            // Connected To picker — every other pin, every area, every sub-area (floor).
            // Refs are typed: pin:<locationId> | area:<areaKey> | subarea:<areaKey>/<floorKey>
            const connected = Array.isArray(pin.connectedTo) ? pin.connectedTo : [];
            const allPinsForCon = state.customPins.filter(p => p.id !== pin.id);
            const areaEntries = [];
            const floorEntries = [];
            for (const [areaKey, area] of Object.entries(MAP_AREAS)) {
                areaEntries.push({ ref: `area:${areaKey}`, label: `Area — ${area.label}` });
                for (const f of (area.floors || [])) {
                    floorEntries.push({ ref: `subarea:${areaKey}/${f.key}`, label: `Sub-area — ${area.label} › ${f.label}` });
                }
            }
            for (const ca of (state.customAreas || [])) {
                areaEntries.push({ ref: `area:${ca.key}`, label: `Area — ${ca.label || ca.key}` });
                for (const f of (ca.floors || [])) {
                    floorEntries.push({ ref: `subarea:${ca.key}/${f.key}`, label: `Sub-area — ${ca.label || ca.key} › ${f.label || f.key}` });
                }
            }
            const conPinOptions = allPinsForCon.map(p => {
                const ref   = `pin:${p.locationId || p.id}`;
                const chk   = connected.includes(ref) ? ' checked' : '';
                const label = p.label || p.locationId;
                return `<label class="map-pin-edit-conn-row" data-search="${escapeHtml(label.toLowerCase())}"><input type="checkbox" class="map-pin-edit-conn" value="${escapeHtml(ref)}"${chk}> ${escapeHtml(label)}</label>`;
            }).join('');
            const conAreaOptions = areaEntries.map(({ ref, label }) => {
                const chk = connected.includes(ref) ? ' checked' : '';
                return `<label class="map-pin-edit-conn-row" data-search="${escapeHtml(label.toLowerCase())}"><input type="checkbox" class="map-pin-edit-conn" value="${escapeHtml(ref)}"${chk}> ${escapeHtml(label)}</label>`;
            }).join('');
            const conFloorOptions = floorEntries.map(({ ref, label }) => {
                const chk = connected.includes(ref) ? ' checked' : '';
                return `<label class="map-pin-edit-conn-row" data-search="${escapeHtml(label.toLowerCase())}"><input type="checkbox" class="map-pin-edit-conn" value="${escapeHtml(ref)}"${chk}> ${escapeHtml(label)}</label>`;
            }).join('');

            const $modal = $(`
                <div class="map-pin-edit-modal">
                    <div class="map-pin-edit-box">
                        <div class="map-pin-edit-title">EDIT LOCATION</div>
                        ${iconGridHtml}
                        <div class="map-pin-edit-field">
                            <div class="map-pin-edit-label">LOCATION NAME</div>
                            <input type="text" class="map-pin-edit-input map-pin-edit-name" value="${escapeHtml(pin.label)}" maxlength="40" />
                        </div>
                        <div class="map-pin-edit-field">
                            <div class="map-pin-edit-label">LOCATION ID</div>
                            <input type="text" class="map-pin-edit-input map-pin-edit-id" value="${escapeHtml(pin.locationId || '')}" maxlength="80" />
                        </div>
                        <div class="map-pin-edit-field">
                            <div class="map-pin-edit-label">BG</div>
                            <div class="map-pin-edit-bg-row">
                                <button type="button" class="map-pin-edit-bg-btn" data-bg="${escapeHtml(chosenBg)}">
                                    <span class="map-pin-edit-bg-thumb"></span>
                                    <span class="map-pin-edit-bg-name">${escapeHtml(chosenLabel)}</span>
                                </button>
                                <button type="button" class="map-pin-edit-bg-clear" title="Clear background">✕</button>
                            </div>
                        </div>
                        <div class="map-pin-edit-field">
                            <div class="map-pin-edit-label">BGM</div>
                            <div class="map-pin-edit-bg-row">
                                <button type="button" class="map-pin-edit-bgm-btn" data-bgm="${escapeHtml(pin.bgm || '')}">
                                    <span class="map-pin-edit-bgm-icon">♪</span>
                                    <span class="map-pin-edit-bgm-name">${escapeHtml(bgmTrackLabel(pin.bgm))}</span>
                                </button>
                                <button type="button" class="map-pin-edit-bgm-preview" title="Preview / stop">▶</button>
                                <button type="button" class="map-pin-edit-bgm-clear" title="Clear BGM override">✕</button>
                            </div>
                        </div>
                        <div class="map-pin-edit-field">
                            <div class="map-pin-edit-label">FORCED OUTFIT</div>
                            <input type="text" class="map-pin-edit-input map-pin-edit-outfit" value="${escapeHtml(pin.outfitPrefix || '')}" maxlength="40" placeholder="e.g. pool-" autocomplete="off" />
                            <div class="map-pin-edit-hint">Forces character sprites to this outfit while the scene is here. Type the sprite prefix <b>including the trailing hyphen</b> — e.g. <b>pool-</b> pulls pool-neutral, pool-love, pool-grief. Characters without these sprites keep their normal ones.</div>
                        </div>
                        <div class="map-pin-edit-field">
                            <div class="map-pin-edit-label">CONNECTED TO</div>
                            <input type="text" class="map-pin-edit-input map-pin-edit-conn-search" placeholder="Search…" autocomplete="off" />
                            <div class="map-pin-edit-conn-list">
                                ${conPinOptions || '<div class="map-pin-edit-conn-empty">(no other pins)</div>'}
                                ${conAreaOptions}
                                ${conFloorOptions}
                            </div>
                        </div>
                        <div class="map-pin-edit-actions">
                            <button class="map-pin-edit-save" type="button">SAVE</button>
                            <button class="map-pin-edit-cancel" type="button">CANCEL</button>
                        </div>
                    </div>
                </div>
            `);

            $("body").append($modal);

            // BG picker — CG-style modal grid with previews.
            function setChosenBg(bgfile) {
                const item   = bgItems.find(b => b.bgfile === bgfile) || null;
                const label  = item?.label || (bgfile ? bgfile : '(none)');
                const $btn   = $modal.find(".map-pin-edit-bg-btn");
                $btn.attr('data-bg', bgfile || '');
                $btn.find('.map-pin-edit-bg-name').text(label);
                const thumbEl = $btn.find('.map-pin-edit-bg-thumb')[0];
                if (thumbEl) {
                    if (item?.thumb && item.thumb !== 'none') thumbEl.style.backgroundImage = item.thumb;
                    else thumbEl.style.backgroundImage = '';
                }
            }
            // Apply the initial thumbnail (avoids inline-style attribute quote breakage).
            setChosenBg(chosenBg);
            $modal.on("click", ".map-pin-edit-bg-clear", (e) => { e.stopPropagation(); setChosenBg(''); });
            $modal.on("click", ".map-pin-edit-bg-btn", (e) => {
                e.stopPropagation();
                openBgPicker(bgItems, $modal.find(".map-pin-edit-bg-btn").attr('data-bg') || '', setChosenBg);
            });

            // BGM picker + preview wiring
            function setChosenBgm(path) {
                const $btn = $modal.find(".map-pin-edit-bgm-btn");
                $btn.attr('data-bgm', path || '');
                $btn.find('.map-pin-edit-bgm-name').text(bgmTrackLabel(path));
                $modal.find(".map-pin-edit-bgm-preview").text('▶');
            }
            $modal.on("click", ".map-pin-edit-bgm-btn", (e) => {
                e.stopPropagation();
                openBgmPicker($modal.find(".map-pin-edit-bgm-btn").attr('data-bgm') || '', setChosenBgm);
            });
            $modal.on("click", ".map-pin-edit-bgm-clear", (e) => { e.stopPropagation(); stopBgmPreview(); setChosenBgm(''); });
            let modalPreviewPlaying = false;
            $modal.on("click", ".map-pin-edit-bgm-preview", (e) => {
                e.stopPropagation();
                const path = $modal.find(".map-pin-edit-bgm-btn").attr('data-bgm') || '';
                if (!path) return;
                if (modalPreviewPlaying) {
                    stopBgmPreview();
                    modalPreviewPlaying = false;
                    $(e.currentTarget).text('▶');
                } else {
                    playBgmPreview(path);
                    modalPreviewPlaying = true;
                    $(e.currentTarget).text('■');
                }
            });
            // Make sure preview audio doesn't keep playing after the modal closes.
            const origRemove = $modal[0].remove.bind($modal[0]);
            $modal[0].remove = function () { stopBgmPreview(); origRemove(); };

            // Live filter the Connected To list by row label.
            $modal.find(".map-pin-edit-conn-search").on("input", function () {
                const q = this.value.toLowerCase().trim();
                $modal.find(".map-pin-edit-conn-row").each(function () {
                    const hay = this.dataset.search || '';
                    this.style.display = !q || hay.includes(q) ? '' : 'none';
                });
            });

            // spaces → underscores on ID input
            $modal.find(".map-pin-edit-id").on("input", function () {
                const el = this;
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const replaced = el.value.replace(/ /g, "_");
                if (replaced !== el.value) {
                    el.value = replaced;
                    el.setSelectionRange(start, end);
                }
            });

            $modal.find(".map-pin-edit-save").on("click", () => {
                const newLabel = $modal.find(".map-pin-edit-name").val().trim();
                const newId    = $modal.find(".map-pin-edit-id").val().trim();
                if (!newId) {
                    $modal.find(".map-pin-edit-id").css("border-color", "rgba(255,80,80,0.8)").trigger("focus");
                    return;
                }
                pin.label = newLabel || pin.label;
                pin.locationId = newId;
                if (isRoom) {
                    const selectedIcon = $modal.find(".map-pins-icon-btn.selected").data("icon");
                    if (selectedIcon) pin.icon = selectedIcon;
                }
                pin.bg = String($modal.find(".map-pin-edit-bg-btn").attr('data-bg') || '');
                pin.bgm = String($modal.find(".map-pin-edit-bgm-btn").attr('data-bgm') || '');
                pin.outfitPrefix = String($modal.find(".map-pin-edit-outfit").val() || '').trim();
                pin.connectedTo = $modal.find(".map-pin-edit-conn:checked").map(function () { return this.value; }).get();
                saveCustomPins();
                $modal.remove();
                renderMapPanel();
            });

            $modal.find(".map-pin-edit-cancel").on("click", () => $modal.remove());
            $modal.on("click", function (e) { if (e.target === this) $modal.remove(); });

            // icon grid selection inside modal
            $modal.on("click", ".map-pins-icon-btn", function () {
                $modal.find(".map-pins-icon-btn.selected").removeClass("selected");
                $(this).addClass("selected");
            });
        });

        $panel.off("click.pinListDelete").on("click.pinListDelete", ".map-pins-list-delete", function () {
            const pinId = $(this).closest(".map-pins-list-item").data("pin-id");
            state.customPins = state.customPins.filter(p => p.id !== pinId);
            if (state.highlightedPinId === pinId) state.highlightedPinId = null;
            saveCustomPins();
            renderMapPanel();
        });

        // CLEAR FLOOR — modal confirmation
        $panel.find(selectors.pinsClearFloor).off("click.pinsClear").on("click.pinsClear", function () {
            $(".truth-discard-modal").remove();

            const $modal = $(`
                <div class="truth-discard-modal">
                    <div class="truth-discard-box">
                        <div class="truth-discard-warning">&#9888;</div>
                        <div class="truth-discard-message">Are you sure? This will remove all pins on the current floor.</div>
                        <div class="truth-discard-actions">
                            <button class="truth-discard-confirm">CLEAR FLOOR</button>
                            <button class="truth-discard-cancel">CANCEL</button>
                        </div>
                    </div>
                </div>
            `);

            $("body").append($modal);

            $modal.find(".truth-discard-confirm").on("click", () => {
                $modal.remove();
                state.customPins = state.customPins.filter(
                    p => !(p.areaKey === state.area && p.floorKey === state.floor)
                );
                saveCustomPins();
                renderMapPanel();
            });

            $modal.find(".truth-discard-cancel").on("click", () => {
                $modal.remove();
            });

            $modal.on("click", function (e) {
                if (e.target === this) $modal.remove();
            });
        });

    }

    function renderPinList($panel) {
        const $list = $panel.find(selectors.pinsList);
        if (!$list.length) return;
        $list.empty();
        const floorPins = state.customPins.filter(
            p => p.areaKey === state.area && p.floorKey === state.floor && !p.hidden
        );
        for (const pin of floorPins) {
            const isActive = pin.id === state.highlightedPinId;
            $list.append(`
                <div class="map-pins-list-item type-${escapeHtml(pin.type)}${isActive ? " active" : ""}${pin.locked ? " locked" : ""}" data-pin-id="${escapeHtml(pin.id)}">
                    <button type="button" class="map-pins-list-name" title="${escapeHtml(pin.locationId || '')}">${escapeHtml(pin.label)}</button>
                    <button type="button" class="map-pins-list-lock${pin.locked ? " is-locked" : ""}" aria-label="${pin.locked ? "Unlock" : "Lock"} ${escapeHtml(pin.label)}" title="${pin.locked ? "Unlock pin" : "Lock pin"}"><img src="${extensionFolderPath}/assets/icons/${pin.locked ? "padlock.svg" : "padlock-open.svg"}" alt="" /></button>
                    <button type="button" class="map-pins-list-edit" aria-label="Edit ${escapeHtml(pin.label)}">✏</button>
                    <button type="button" class="map-pins-list-delete" aria-label="Delete ${escapeHtml(pin.label)}">✕</button>
                </div>
            `);
        }
    }

    function exitPinPlacementMode($panel) {
        state.pinPlacementMode = false;
        state.pendingCustomPin = null;
        $panel.find(".map-image-wrap").removeClass("map-placement-mode");
        $panel.find(selectors.pinsCreatePanel).prop("hidden", true);
        $panel.find(selectors.pinsAdd).prop("disabled", false);
        $panel.find(selectors.pinsPlaceBtn).prop("disabled", false);
        $panel.find(selectors.pinsPlaceHint).prop("hidden", true);
        $panel.find(selectors.pinsLabelInput).val("");
        $panel.find(selectors.pinsIdInput).val("").removeData("user-edited");
        $panel.find(`${selectors.pinsTypeBtn}.active`).removeClass("active");
        $panel.find(`${selectors.pinsTypeBtn}[data-type="room"]`).addClass("active");
        $panel.find(".map-pins-icon-section").prop("hidden", false);
    }

    function renderMapPanel() {
        const $panel = $(selectors.panel);
        if (!$panel.length) return;

        ensureValidFloorSelection();
        renderAreaButtons($panel);
        $panel.find(selectors.addAreaBtn).off("click.addArea").on("click.addArea", openCreateAreaModal);
        renderFloorButtons($panel);
        renderMapImage($panel);

        // Re-render pins when the image loads (natural dimensions needed for letterbox calc)
        $panel.find(selectors.image).off("load.pinresize").on("load.pinresize", () => {
            renderCustomPins($panel.find(selectors.pinLayer));
        });

        // Re-render pins whenever the scroll area is resized (browser resize changes letterbox)
        if (window.ResizeObserver) {
            const saEl = $panel.find(selectors.scrollArea).get(0);
            if (saEl && !_observedScrollAreas.has(saEl)) {
                _observedScrollAreas.add(saEl);
                new ResizeObserver(() => {
                    const $p = $(selectors.panel);
                    const $pl = $p.find(selectors.pinLayer);
                    if ($pl.length) renderCustomPins($pl);
                }).observe(saEl);
            }
        }
        bindMapZoomControls($panel);
        bindMapPan($panel);
        bindCustomPinsControls($panel);
        const roomViewLabels = { on: "ROOM VIEW: ON", simple: "ROOM VIEW: SIMPLE", off: "ROOM VIEW: OFF" };
        $panel.find(selectors.pinsToggleRoomView)
            .toggleClass("active", state.roomViewMode !== "on")
            .text(roomViewLabels[state.roomViewMode]);
        $panel.find(selectors.pinsToggleSimpleEvidence)
            .toggleClass("active", state.simpleEvidencePins)
            .text(state.simpleEvidencePins ? "TOGGLE SIMPLE EVIDENCE OFF" : "TOGGLE SIMPLE EVIDENCE ON");
        $panel.find(selectors.pinsToggleSimpleBody)
            .toggleClass("active", state.simpleBodyPins)
            .text(state.simpleBodyPins ? "TOGGLE SIMPLE BODY OFF" : "TOGGLE SIMPLE BODY ON");
        renderPinList($panel);
        applyMapZoom($panel);

        ensureMachineOverlay($panel);

        if (!(state.area === "hopes_peak" && state.floor === "floor_1")) {
            closeMachineOverlay($panel);
        }

        syncMachineTrack($panel);
    }

    function handleSettingsChanged() {
        const $panel = $(selectors.panel);
        if (!$panel.length) return;
        syncMachineTrack($panel);
    }

    function hasPinForLocationId(locationId) {
        return locationId ? state.customPins.some(p => p.locationId === locationId && !p.hidden) : false;
    }

    function openPinCreatorWithPrefill(label, locationId) {
        const $panel = $(selectors.panel);
        if (!$panel.length) return;

        // Show panel, disable ADD PIN
        $panel.find(selectors.pinsCreatePanel).prop("hidden", false);
        $panel.find(selectors.pinsAdd).prop("disabled", true);

        // Pre-select Evidence type
        $panel.find(`${selectors.pinsTypeBtn}.active`).removeClass("active");
        $panel.find(`${selectors.pinsTypeBtn}[data-type="truth-bullet"]`).addClass("active");
        $panel.find(".map-pins-icon-section").prop("hidden", true);

        // Prefill name and ID
        $panel.find(selectors.pinsLabelInput).val(label);
        $panel.find(selectors.pinsIdInput).val(locationId).data("user-edited", true);

        // Enter placement mode immediately
        const icon = TYPE_DEFAULT_ICONS["truth-bullet"];
        state.pendingCustomPin = { icon, type: "truth-bullet", label, locationId };
        state.pinPlacementMode = true;
        $panel.find(selectors.pinsPlaceBtn).prop("disabled", true);
        $panel.find(selectors.pinsPlaceHint).prop("hidden", false);
        $panel.find(".map-image-wrap").addClass("map-placement-mode");
    }

    function highlightPinByLocationId(locationId) {
        const pin = state.customPins.find(p => p.locationId === locationId);
        if (!pin) return;
        state.area  = pin.areaKey;
        state.floor = pin.floorKey;
        state.highlightedPinId = pin.id;
        renderMapPanel();
        const $panel = $(selectors.panel);
        $panel.find(`[data-custom-pin-id="${pin.id}"]`).trigger("focus");
    }

    function removePinByLocationId(locationId) {
        if (!locationId) return;
        const before = state.customPins.length;
        state.customPins = state.customPins.filter(p => p.locationId !== locationId);
        if (state.customPins.length !== before) {
            saveCustomPins();
            renderMapPanel();
        }
    }

    // Derive a friendly track label from a BGM file path.
    function bgmTrackLabel(path) {
        if (!path) return '(none)';
        return String(path).split('/').pop().replace(/\.[^.]+$/, '');
    }

    // Audio element used by both the pin-edit modal preview and the BGM picker
    // grid preview buttons. Single shared instance so previews don't stack.
    let bgmPreviewAudio = null;
    function stopBgmPreview() {
        if (bgmPreviewAudio) {
            try { bgmPreviewAudio.pause(); bgmPreviewAudio.src = ''; } catch {}
            bgmPreviewAudio = null;
        }
    }
    function playBgmPreview(path) {
        stopBgmPreview();
        if (!path) return;
        try {
            bgmPreviewAudio = new Audio(path);
            bgmPreviewAudio.volume = 0.5;
            bgmPreviewAudio.play().catch(() => {});
        } catch {}
    }

    // CG-style modal BGM picker — same shell as the BG picker, but each row is
    // a track label + Preview ▶ / ■ button instead of a thumbnail.
    async function openBgmPicker(currentBgm, onPick) {
        document.getElementById('map-bgm-picker')?.remove();
        const picker = document.createElement('div');
        picker.id = 'map-bgm-picker';
        picker.innerHTML = `
            <div class="map-bg-picker-inner">
                <div class="map-bg-picker-header">
                    <span class="map-bg-picker-title">CHOOSE BGM</span>
                    <button type="button" class="map-bg-picker-close">✕</button>
                </div>
                <div class="map-bg-picker-search-row">
                    <input type="text" class="map-bg-picker-search" placeholder="Search BGM tracks…" autocomplete="off" />
                </div>
                <div class="map-bgm-picker-list"></div>
            </div>
        `;
        document.body.appendChild(picker);

        const list = picker.querySelector('.map-bgm-picker-list');
        const search = picker.querySelector('.map-bg-picker-search');

        let paths = [];
        try { paths = (await fetchBgmPaths?.()) || []; } catch { paths = []; }
        paths = paths.filter(p => typeof p === 'string' && p.trim());

        let playingPath = null;

        function render() {
            list.innerHTML = '';
            const q = search.value.trim().toLowerCase();
            const visible = q
                ? paths.filter(p => p.toLowerCase().includes(q) || bgmTrackLabel(p).toLowerCase().includes(q))
                : paths;
            if (!visible.length) {
                const empty = document.createElement('div');
                empty.className = 'map-bg-picker-empty';
                empty.textContent = 'No BGM tracks found';
                list.appendChild(empty);
                return;
            }
            for (const p of visible) {
                const row = document.createElement('div');
                row.className = 'map-bgm-picker-row' + (p === currentBgm ? ' selected' : '');
                row.innerHTML = `
                    <button type="button" class="map-bgm-picker-preview" data-path="${escapeHtml(p)}" title="Preview / stop">${p === playingPath ? '■' : '▶'}</button>
                    <span class="map-bgm-picker-label" title="${escapeHtml(p)}">${escapeHtml(bgmTrackLabel(p))}</span>
                    <button type="button" class="map-bgm-picker-pick" data-path="${escapeHtml(p)}">Use</button>
                `;
                list.appendChild(row);
            }
        }
        render();
        search.addEventListener('input', render);

        picker.addEventListener('click', (e) => {
            const previewBtn = e.target.closest?.('.map-bgm-picker-preview');
            if (previewBtn) {
                const path = previewBtn.dataset.path;
                if (playingPath === path) {
                    stopBgmPreview();
                    playingPath = null;
                } else {
                    playBgmPreview(path);
                    playingPath = path;
                }
                render();
                return;
            }
            const pickBtn = e.target.closest?.('.map-bgm-picker-pick');
            if (pickBtn) {
                stopBgmPreview();
                const path = pickBtn.dataset.path;
                picker.remove();
                onPick(path);
                return;
            }
            if (e.target === picker || e.target.closest?.('.map-bg-picker-close')) {
                stopBgmPreview();
                picker.remove();
            }
        });
    }

    // CG-style modal background picker. Shows every <.bg_example> as a labelled
    // thumbnail in a 5-column grid with a search field. Click a thumb → onPick(bgfile).
    function openBgPicker(items, currentBg, onPick) {
        document.getElementById('map-bg-picker')?.remove();
        const picker = document.createElement('div');
        picker.id = 'map-bg-picker';
        picker.innerHTML = `
            <div class="map-bg-picker-inner">
                <div class="map-bg-picker-header">
                    <span class="map-bg-picker-title">CHOOSE BACKGROUND</span>
                    <button type="button" class="map-bg-picker-close">✕</button>
                </div>
                <div class="map-bg-picker-search-row">
                    <input type="text" class="map-bg-picker-search" placeholder="Search backgrounds…" autocomplete="off" />
                </div>
                <div class="map-bg-picker-grid"></div>
            </div>
        `;
        document.body.appendChild(picker);

        const grid = picker.querySelector('.map-bg-picker-grid');
        const search = picker.querySelector('.map-bg-picker-search');

        function render() {
            grid.innerHTML = '';
            const q = search.value.trim().toLowerCase();
            const visible = q ? items.filter(it => it.label.toLowerCase().includes(q) || it.bgfile.toLowerCase().includes(q)) : items;
            if (!visible.length) {
                const empty = document.createElement('div');
                empty.className = 'map-bg-picker-empty';
                empty.textContent = 'No backgrounds found';
                grid.appendChild(empty);
                return;
            }
            for (const item of visible) {
                const cell = document.createElement('div');
                cell.className = 'map-bg-picker-item' + (item.bgfile === currentBg ? ' selected' : '');
                const thumb = document.createElement('div');
                thumb.className = 'map-bg-picker-thumb';
                if (item.thumb && item.thumb !== 'none') thumb.style.backgroundImage = item.thumb;
                const lbl = document.createElement('span');
                lbl.className = 'map-bg-picker-label';
                lbl.textContent = item.label;
                cell.appendChild(thumb);
                cell.appendChild(lbl);
                cell.onclick = () => { picker.remove(); onPick(item.bgfile); };
                grid.appendChild(cell);
            }
        }
        render();
        search.addEventListener('input', render);

        picker.querySelector('.map-bg-picker-close').addEventListener('click', () => picker.remove());
        picker.addEventListener('click', (e) => { if (e.target === picker) picker.remove(); });
        setTimeout(() => search.focus(), 30);
    }

    function setPinHidden(locationId, hidden) {
        if (!locationId) return;
        const pin = state.customPins.find(p => p.locationId === locationId);
        if (!pin) return;
        pin.hidden = hidden;
        saveCustomPins();
        renderMapPanel();
    }

    function getAllPins() {
        return state.customPins.slice();
    }

    // Read the data needed to render a small floor preview (minimap) outside the
    // main Map panel. Excludes evidence ('truth-bullet') and body pins.
    //
    // `currentLocationId` controls which floor the minimap targets, irrespective
    // of what the Map panel itself is currently displaying:
    //   - "<locationId>"           — look up the pin; use its areaKey + floorKey.
    //   - "area:<areaKey>"         — use the area's first floor.
    //   - "subarea:<areaKey>/<floorKey>" — use those directly.
    //   - null / unknown           — fall back to state.area / state.floor.
    function getMinimapState(currentLocationId = null) {
        let areaKey = state.area;
        let floorKey = state.floor;
        const allAreas = getAllAreas();

        if (typeof currentLocationId === 'string' && currentLocationId) {
            if (currentLocationId.startsWith('subarea:')) {
                const tail = currentLocationId.slice(8);
                const slash = tail.indexOf('/');
                if (slash >= 0) {
                    areaKey = tail.slice(0, slash);
                    floorKey = tail.slice(slash + 1);
                }
            } else if (currentLocationId.startsWith('area:')) {
                areaKey = currentLocationId.slice(5);
                floorKey = allAreas[areaKey]?.floors?.[0]?.key || floorKey;
            } else {
                const pin = state.customPins.find(p => p.locationId === currentLocationId);
                if (pin) { areaKey = pin.areaKey; floorKey = pin.floorKey; }
            }
        }

        const area = allAreas[areaKey];
        const floor = getAreaFloor(areaKey, floorKey);
        if (!area || !floor) return null;
        const imageSrc = floor.image?.startsWith('data:')
            ? floor.image
            : floor.image ? `${extensionFolderPath}/assets/${floor.image}` : '';
        const LOCATION_PIN_TYPES = new Set(['room', 'monomachine', 'trial']);
        const pins = state.customPins
            .filter(p => p.areaKey === areaKey && p.floorKey === floorKey && !p.hidden)
            .filter(p => LOCATION_PIN_TYPES.has(p.type))
            .map(p => {
                const ICON_MIGRATIONS = {
                    'truth-bullet-location.svg': 'artillery-shell.svg',
                    'body-discovery-location.svg': 'chalk-outline-murder.svg',
                };
                const icon = ICON_MIGRATIONS[p.icon] ?? p.icon;
                const iconUrl = icon ? `${extensionFolderPath}/assets/rooms/${icon}` : '';
                return {
                    id: p.id, type: p.type, label: p.label,
                    x: p.x, y: p.y, iconUrl,
                };
            });
        return {
            areaLabel: area.label,
            floorLabel: floor.label,
            areaKey, floorKey,
            imageSrc,
            pins,
            mapWidth: MAP_POINT_WIDTH,
            mapHeight: MAP_POINT_HEIGHT,
        };
    }

    // Flat list view of every known area + floor for use by /setlocation autocomplete.
    // Avoids shadowing the controller's existing getAllAreas() (which returns an
    // object map keyed by areaKey and is consumed all over the panel).
    function listAreasForNav() {
        const all = getAllAreas();
        const out = [];
        for (const [key, area] of Object.entries(all)) {
            out.push({
                key,
                label: area.label || key,
                floors: (area.floors || []).map(f => ({ key: f.key, label: f.label || f.key })),
            });
        }
        return out;
    }

    function getPinByLocationId(locationId) {
        if (!locationId) return null;
        return state.customPins.find(p => p.locationId === locationId) || null;
    }

    // Resolve a labelled human description for a connectedTo ref (pin/area/subarea).
    function describeConnectionRef(ref) {
        if (typeof ref !== 'string' || !ref) return null;
        if (ref.startsWith('pin:')) {
            const id = ref.slice(4);
            const p = getPinByLocationId(id);
            return { ref, kind: 'pin', value: id, label: p?.label || id };
        }
        if (ref.startsWith('area:')) {
            const key = ref.slice(5);
            const a = MAP_AREAS[key] || (state.customAreas || []).find(c => c.key === key);
            return { ref, kind: 'area', value: key, label: a?.label || key };
        }
        if (ref.startsWith('subarea:')) {
            const tail = ref.slice(8);
            const slash = tail.indexOf('/');
            if (slash < 0) return null;
            const areaKey = tail.slice(0, slash);
            const floorKey = tail.slice(slash + 1);
            const a = MAP_AREAS[areaKey] || (state.customAreas || []).find(c => c.key === areaKey);
            const f = a?.floors?.find(fl => fl.key === floorKey);
            if (!a || !f) return null;
            return {
                ref, kind: 'subarea', value: `${areaKey}/${floorKey}`,
                areaKey, floorKey, label: `${a.label || areaKey} › ${f.label || floorKey}`,
            };
        }
        return null;
    }

    function getConnectionsForLocationId(locationId) {
        const pin = getPinByLocationId(locationId);
        if (!pin || !Array.isArray(pin.connectedTo)) return [];
        return pin.connectedTo.map(describeConnectionRef).filter(Boolean);
    }

    // Play a pin's BGM override via the host extension's playBgmPath helper.
    function playPinBgm(path) {
        if (!path) return false;
        if (typeof playBgmPath === 'function') {
            playBgmPath(path);
            return true;
        }
        return false;
    }

    // Switch SillyTavern's chat background by clicking the matching <.bg_example>.
    // Accepts a partial filename match (case-insensitive), mirroring /bda bg=…
    function switchChatBackground(bg) {
        if (!bg) return false;
        const bgElements = Array.from(document.querySelectorAll('.bg_example'));
        const lower = String(bg).toLowerCase();
        const match = bgElements.find(el => el.getAttribute('bgfile')?.toLowerCase().includes(lower));
        if (match instanceof HTMLElement) { match.click(); return true; }
        return false;
    }

    // Navigate the map UI to an area/floor without changing background.
    function navigateToArea(areaKey, floorKey = null) {
        if (!areaKey) return false;
        const a = MAP_AREAS[areaKey] || (state.customAreas || []).find(c => c.key === areaKey);
        if (!a) return false;
        state.area = areaKey;
        const floor = floorKey ? a.floors?.find(f => f.key === floorKey) : a.floors?.[0];
        state.floor = floor?.key || state.floor;
        renderMapPanel();
        return true;
    }

    return {
        renderMapPanel,
        handleSettingsChanged,
        highlightPinByLocationId,
        hasPinForLocationId,
        openPinCreatorWithPrefill,
        removePinByLocationId,
        setPinHidden,
        getAllPins,
        getAllAreas: listAreasForNav,
        getMinimapState,
        getPinByLocationId,
        describeConnectionRef,
        getConnectionsForLocationId,
        switchChatBackground,
        playPinBgm,
        navigateToArea,
    };
}
