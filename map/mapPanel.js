import { LOCATION_PINPOINTS } from "./locationPresence.js";

const FLOOR_ONE_MACHINE_PIN = {
    x: 276,
    y: 145,
    width: 480,
    height: 272,
};

const MACHINE_ROLL_DURATION_MS = 2000;
const MACHINE_JINGLE_FRAME = 50;
const MACHINE_GIF_TOTAL_FRAMES = 100;
const MACHINE_JINGLE_DELAY_MS = Math.round((MACHINE_JINGLE_FRAME / MACHINE_GIF_TOTAL_FRAMES) * MACHINE_ROLL_DURATION_MS);
const MACHINE_BANNER_DELAY_MS = 500;

const MAP_AREAS = {
    hopes_peak: {
        label: "HOPE'S PEAK",
        floors: [
            { key: "floor_1", label: "FLOOR 1", image: "floor_one.png", description: "Main academy first floor." },
            { key: "floor_2", label: "FLOOR 2", image: "floor_two.png", description: "Main academy second floor." },
            { key: "floor_3", label: "FLOOR 3", image: "floor_three.png", description: "Main academy third floor." },
            { key: "floor_4", label: "FLOOR 4", image: "floor_four.png", description: "Main academy fourth floor." },
            { key: "floor_5", label: "FLOOR 5", image: "floor_five.png", description: "Main academy fifth floor." },
        ],
    },
    hotel_despair: {
        label: "HOTEL DESPAIR",
        floors: [
            { key: "floor_1", label: "FLOOR 1", image: "hotel_despair.png", description: "Accessible by corridor from academy floor 1." },
            { key: "hidden_floor", label: "HIDDEN FLOOR", image: "hidden_floor.png", description: "Secret second floor above Hotel Despair." },
        ],
    },
};

function getFloorByKey(areaKey, floorKey) {
    const area = MAP_AREAS[areaKey];
    if (!area) return null;
    return area.floors.find(floor => floor.key === floorKey) || null;
}

export function createMapPanelController({ extensionFolderPath, getItemsPanelController, playSfx, getSfx, getSetting, onWalkStep }) {
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
    };

    const selectors = {
        panel: `.monopad-panel-content[data-panel="map"]`,
        areaButtons: ".map-area-button",
        floorList: ".map-floor-list",
        image: ".map-image",
        title: ".map-location-title",
        subtitle: ".map-location-subtitle",
        machinePin: ".map-machine-pin",
        machineOverlay: ".map-machine-overlay",
        machineDisplayCoins: ".map-machine-coins",
        machineDisplayLoad: ".map-machine-load",
        machineDisplayDupe: ".map-machine-dupe",
        machineDisplayRolls: ".map-machine-rolls",
        machineBanner: ".map-machine-banner",
        machineImage: ".map-machine-image",
        machineAdd: ".map-machine-button.add",
        machineAddRoll: ".map-machine-button.add-roll",
        machineRoll: ".map-machine-button.roll",
        machineClose: ".map-machine-close",
        presencePin: ".map-presence-pin",
        presenceTooltip: ".map-presence-tooltip",
    };

    function isMapPresenceEnabled() {
        if (typeof getSetting !== "function") return true;
        return !!getSetting("mapPresencePinsEnabled");
    }

    function getLocationPresence() {
        const payload = typeof window.getMonopadRecentLocationPresence === "function"
            ? window.getMonopadRecentLocationPresence()
            : null;

        return payload && typeof payload === "object"
            ? payload
            : { user: null, characters: [] };
    }

    function buildPresencePinsForFloor() {
        if (!isMapPresenceEnabled()) return [];

        const payload = getLocationPresence();
        const byLocation = new Map();

        function ensureLocationBucket(locationId) {
            const existing = byLocation.get(locationId);
            if (existing) return existing;

            const bucket = {
                locationId,
                userLabel: null,
                characters: [],
            };

            byLocation.set(locationId, bucket);
            return bucket;
        }

        const userLocation = payload?.user?.locationId;
        if (userLocation && LOCATION_PINPOINTS[userLocation]) {
            const bucket = ensureLocationBucket(userLocation);
            bucket.userLabel = payload.user.label || "You";
        }

        const characters = Array.isArray(payload?.characters) ? payload.characters : [];
        for (const entry of characters) {
            const locationId = entry?.locationId;
            if (!locationId || !LOCATION_PINPOINTS[locationId]) continue;

            const bucket = ensureLocationBucket(locationId);
            const characterName = entry.name || "Unknown";
            if (!bucket.characters.includes(characterName)) {
                bucket.characters.push(characterName);
            }
        }

        return Array.from(byLocation.values()).filter(pin => {
            const point = LOCATION_PINPOINTS[pin.locationId];
            return point.area === state.area && point.floor === state.floor;
        });
    }

    function closePresenceTooltip($imageWrap) {
        $imageWrap.find(selectors.presenceTooltip).remove();
        $imageWrap.find(`${selectors.presencePin}.active`).removeClass("active");
    }

    function openPresenceTooltip($imageWrap, pin, point, $pin) {
        closePresenceTooltip($imageWrap);

        const who = [];
        if (pin.userLabel) {
            who.push(`<li><strong>YOU</strong> (${pin.userLabel})</li>`);
        }
        for (const name of pin.characters) {
            who.push(`<li>${name}</li>`);
        }

        const whoMarkup = who.length ? who.join("") : "<li>Unknown presence</li>";
        const leftPercent = (point.x / point.width) * 100;
        const topPercent = (point.y / point.height) * 100;

        $imageWrap.append(`
            <div class="map-presence-tooltip" role="status" style="left:${leftPercent}%; top:${topPercent}%;">
                <div class="map-presence-tooltip-title">${point.label}</div>
                <ul>${whoMarkup}</ul>
            </div>
        `);

        $pin.addClass("active");
    }

    function renderPresencePins($imageWrap) {
        closePresenceTooltip($imageWrap);
        $imageWrap.find(selectors.presencePin).remove();
        const pins = buildPresencePinsForFloor();
        if (!pins.length) return;

        for (const pin of pins) {
            const point = LOCATION_PINPOINTS[pin.locationId];
            if (!point) continue;

            const pinLeftPercent = (point.x / point.width) * 100;
            const pinTopPercent = (point.y / point.height) * 100;
            const hasUser = !!pin.userLabel;
            const hasCharacters = pin.characters.length > 0;
            const pinTypeClass = hasUser && hasCharacters
                ? "mixed"
                : hasUser
                    ? "user"
                    : "character";
            const pinSymbol = hasUser ? "▲" : "◆";
            const charCountBadge = hasCharacters ? `<span class="map-presence-count">${pin.characters.length}</span>` : "";
            const title = `${point.label} · ${hasUser ? "You" : "Characters"}`;

            const $pin = $(`
                <button
                    type="button"
                    class="map-presence-pin ${pinTypeClass}"
                    aria-label="${title}"
                    title="${title}"
                    style="left:${pinLeftPercent}%; top:${pinTopPercent}%;"
                >
                    <span class="map-presence-symbol">${pinSymbol}</span>
                    ${charCountBadge}
                </button>
            `);

            $pin.on("click", (event) => {
                event.stopPropagation();
                const isActive = $pin.hasClass("active");
                if (isActive) {
                    closePresenceTooltip($imageWrap);
                    return;
                }

                playSfx?.(getSfx?.().click);
                openPresenceTooltip($imageWrap, pin, point, $pin);
            });

            $imageWrap.append($pin);
        }

        $imageWrap.off("click.presenceTooltip").on("click.presenceTooltip", () => {
            closePresenceTooltip($imageWrap);
        });
    }

    function ensureValidFloorSelection() {
        const area = MAP_AREAS[state.area];
        if (!area) {
            state.area = "hopes_peak";
            state.floor = "floor_1";
            return;
        }

        const floorExists = area.floors.some(floor => floor.key === state.floor);
        if (!floorExists) {
            state.floor = area.floors[0]?.key || "floor_1";
        }
    }

    function getItemsController() {
        return typeof getItemsPanelController === "function" ? getItemsPanelController() : null;
    }


    function isMachineTrackEnabled() {
        if (typeof getSetting !== "function") return true;
        return !!getSetting("monochineTrackEnabled");
    }

    function syncMachineTrack($panel) {
        const track = document.getElementById("monopad_sfx_monochine_track");
        if (!track) return;

        const shouldPlay = isMachineTrackEnabled() && $panel.find(selectors.machineOverlay).hasClass("open");
        if (shouldPlay) {
            track.loop = true;
            if (state.machineTrackStarted) return;
            track.currentTime = 0;
            track.volume = 0.4;
            track.play().then(() => {
                state.machineTrackStarted = true;
            }).catch(() => {
                state.machineTrackStarted = false;
            });
            return;
        }

        if (!track.paused) {
            track.pause();
        }
        track.currentTime = 0;
        state.machineTrackStarted = false;
    }

    function ensureMachineOverlay($panel) {
        if ($panel.find(selectors.machineOverlay).length) return;

        $panel.append(`
            <div class="map-machine-overlay" aria-hidden="true">
                <div class="map-machine-window" role="dialog" aria-label="MonoMono Machine">
                    <button type="button" class="map-machine-close" aria-label="Close MonoMono Machine">✕</button>

                    <div class="map-machine-coins-row">
                        <img class="map-machine-coin-icon" src="${extensionFolderPath}/assets/monocoin.png" alt="Monocoin" />
                        <div class="map-machine-coins">x 0</div>
                    </div>

                    <img class="map-machine-image" src="${extensionFolderPath}/assets/monochine_idle.png" alt="MonoMono Machine" />

                    <div class="map-machine-controls">
                        <button type="button" class="map-machine-button add" title="Add one coin to dupe protection load">+C</button>
                        <button type="button" class="map-machine-button add-roll" title="Add one extra roll">+R</button>
                        <button type="button" class="map-machine-button roll" title="Roll">▶</button>
                    </div>

                    <div class="map-machine-info">
                        <div class="map-machine-load">LOAD: 1 COIN</div>
                        <div class="map-machine-rolls">ROLLS: 1</div>
                        <div class="map-machine-dupe">DUPE CHANCE: 0%</div>
                    </div>

                    <div class="map-machine-banner" aria-live="polite"></div>
                </div>
            </div>
        `);

        $panel.find(selectors.machineClose).off("click").on("click", () => {
            closeMachineOverlay($panel);
        });

        $panel.find(selectors.machineOverlay).off("click").on("click", function (event) {
            if (event.target === this) {
                closeMachineOverlay($panel);
            }
        });

        $panel.find(selectors.machineAdd).off("click").on("click", () => {
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

        $panel.find(selectors.machineAddRoll).off("click").on("click", () => {
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

        $panel.find(selectors.machineRoll).off("click").on("click", () => {
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
            $panel.find(selectors.machineRoll).prop("disabled", true);
            $panel.find(selectors.machineAdd).prop("disabled", true);
            $panel.find(selectors.machineAddRoll).prop("disabled", true);

            if (state.machineRollTimeout) {
                clearTimeout(state.machineRollTimeout);
                state.machineRollTimeout = null;
            }
            if (state.machineJingleTimeout) {
                clearTimeout(state.machineJingleTimeout);
                state.machineJingleTimeout = null;
            }

            const $img = $panel.find(selectors.machineImage);
            if ($img.length) {
                $img.attr("src", `${extensionFolderPath}/assets/monochine_roll.gif`);

                const obtainedMessage = run.rollCount > 1
                    ? `You've obtained ${run.rollCount} gifts! ${run.duplicateCount} duplicate${run.duplicateCount === 1 ? "" : "s"}.`
                    : `You've obtained a ${run.result.name}!`;
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
                    $img.attr("src", `${extensionFolderPath}/assets/monochine_idle.png`);
                    state.machineRolling = false;
                    $panel.find(selectors.machineRoll).prop("disabled", false);
                    $panel.find(selectors.machineAdd).prop("disabled", false);
                    $panel.find(selectors.machineAddRoll).prop("disabled", false);
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
        const $banner = $panel.find(selectors.machineBanner);
        if (!$banner.length || !text) return;

        if (state.machineBannerTimeout) {
            clearTimeout(state.machineBannerTimeout);
            state.machineBannerTimeout = null;
        }

        $banner.text(text).addClass("show");
        state.machineBannerTimeout = setTimeout(() => {
            $banner.removeClass("show").text("");
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
        $panel.find(selectors.machineImage).attr("src", `${extensionFolderPath}/assets/monochine_idle.png`);
        $panel.find(selectors.machineRoll).prop("disabled", false);
        $panel.find(selectors.machineAdd).prop("disabled", false);
        $panel.find(selectors.machineAddRoll).prop("disabled", false);
        $panel.find(selectors.machineBanner).removeClass("show").text("");
        $panel.find(selectors.machineOverlay).removeClass("open").attr("aria-hidden", "true");
        syncMachineTrack($panel);
    }

    function updateMachineOverlay($panel) {
        const items = getItemsController();
        if (!items?.getMonoMonoDupeChance) return;

        const chance = items.getMonoMonoDupeChance(state.machineCoinsLoaded, state.machineRollCount);
        const safeCoins = Math.max(0, Number(chance.availableCoins || 0));
        const chancePercent = Math.round(Number(chance.chancePercent || 0));

        $panel.find(selectors.machineDisplayCoins).text(`x ${safeCoins}`);
        $panel.find(selectors.machineDisplayLoad).text(`LOAD: ${state.machineCoinsLoaded} COIN${state.machineCoinsLoaded === 1 ? "" : "S"} / ROLL`);
        $panel.find(selectors.machineDisplayRolls).text(`ROLLS: ${state.machineRollCount}`);
        $panel.find(selectors.machineDisplayDupe).text(`DUPE CHANCE: ${chancePercent}% PER ROLL`);

    }

    function openMachineOverlay($panel) {
        ensureMachineOverlay($panel);
        state.machineCoinsLoaded = 1;
        state.machineRollCount = 1;
        updateMachineOverlay($panel);
        state.machineRolling = false;
        $panel.find(selectors.machineRoll).prop("disabled", false);
        $panel.find(selectors.machineAdd).prop("disabled", false);
        $panel.find(selectors.machineAddRoll).prop("disabled", false);
        $panel.find(selectors.machineImage).attr("src", `${extensionFolderPath}/assets/monochine_idle.png`);
        $panel.find(selectors.machineOverlay).addClass("open").attr("aria-hidden", "false");
        syncMachineTrack($panel);
    }

    function updateAreaButtons($panel) {
        $panel.find(selectors.areaButtons).each((_, button) => {
            const isActive = button.dataset.area === state.area;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function renderFloorButtons($panel) {
        const $floorList = $panel.find(selectors.floorList);
        if (!$floorList.length) return;

        const area = MAP_AREAS[state.area];
        if (!area) return;

        $floorList.empty();

        for (const floor of area.floors) {
            const isActive = floor.key === state.floor;
            const $button = $(`
                <button
                    class="map-floor-button${isActive ? " active" : ""}"
                    type="button"
                    data-floor="${floor.key}"
                    aria-pressed="${String(isActive)}"
                >
                    ${floor.label}
                </button>
            `);

            $button.on("click", () => {
                if (state.floor === floor.key) return;
                state.floor = floor.key;
                onWalkStep?.();
                renderMapPanel();
            });

            $floorList.append($button);
        }
    }

    function renderMapImage($panel) {
        const area = MAP_AREAS[state.area];
        const floor = getFloorByKey(state.area, state.floor);

        if (!area || !floor) return;

        const $image = $panel.find(selectors.image);
        const $title = $panel.find(selectors.title);
        const $subtitle = $panel.find(selectors.subtitle);
        const $imageWrap = $panel.find(".map-image-wrap");

        if ($image.length) {
            $image.attr("src", `${extensionFolderPath}/assets/${floor.image}`);
            $image.attr("alt", `${area.label} ${floor.label} map`);
        }

        if ($title.length) {
            $title.text(`${area.label} / ${floor.label}`);
        }

        if ($subtitle.length) {
            $subtitle.text(floor.description);
        }

        $imageWrap.find(`${selectors.machinePin}, ${selectors.presencePin}`).remove();

        const showMachinePin = state.area === "hopes_peak" && state.floor === "floor_1";
        if (showMachinePin && $imageWrap.length) {
            const pinLeftPercent = (FLOOR_ONE_MACHINE_PIN.x / FLOOR_ONE_MACHINE_PIN.width) * 100;
            const pinTopPercent = (FLOOR_ONE_MACHINE_PIN.y / FLOOR_ONE_MACHINE_PIN.height) * 100;

            $imageWrap.append(`
                <button
                    class="map-machine-pin"
                    type="button"
                    aria-label="MonoMono Machine"
                    title="MonoMono Machine"
                    style="left:${pinLeftPercent}%; top:${pinTopPercent}%;"
                >
                    ¥
                </button>
            `);
        }

        if ($imageWrap.length) {
            renderPresencePins($imageWrap);
        }
    }

    function bindAreaButtons($panel) {
        $panel.find(selectors.areaButtons).off("click").on("click", function () {
            const nextArea = this.dataset.area;
            if (!MAP_AREAS[nextArea]) return;
            if (state.area === nextArea) return;

            state.area = nextArea;
            ensureValidFloorSelection();
            onWalkStep?.();
            renderMapPanel();
        });
    }

    function bindMachinePin($panel) {
        $panel.find(selectors.machinePin).off("click").on("click", () => {
            playSfx?.(getSfx?.().click);
            openMachineOverlay($panel);
        });
    }

    function renderMapPanel() {
        const $panel = $(selectors.panel);
        if (!$panel.length) return;

        ensureValidFloorSelection();
        bindAreaButtons($panel);
        updateAreaButtons($panel);
        renderFloorButtons($panel);
        renderMapImage($panel);
        bindMachinePin($panel);
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

    return {
        renderMapPanel,
        handleSettingsChanged,
    };
}
