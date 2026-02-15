const FLOOR_ONE_MACHINE_PIN = {
    x: 276,
    y: 145,
    width: 480,
    height: 272,
};

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

export function createMapPanelController({ extensionFolderPath, getItemsPanelController, playSfx, getSfx }) {
    const state = {
        area: "hopes_peak",
        floor: "floor_1",
        machineCoinsLoaded: 1,
        machineRolling: false,
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
        machineResult: ".map-machine-result",
        machineImage: ".map-machine-image",
        machineAdd: ".map-machine-button.add",
        machineRoll: ".map-machine-button.roll",
        machineClose: ".map-machine-close",
    };

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
                        <button type="button" class="map-machine-button add" title="Add one coin">+</button>
                        <button type="button" class="map-machine-button roll" title="Roll">▶</button>
                    </div>

                    <div class="map-machine-info">
                        <div class="map-machine-load">LOAD: 1 COIN</div>
                        <div class="map-machine-dupe">DUPE CHANCE: 0%</div>
                    </div>

                    <div class="map-machine-result">SELECT COINS, THEN ROLL.</div>
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

            const chance = items.getMonoMonoDupeChance(state.machineCoinsLoaded);
            if (!chance.ok) {
                updateMachineOverlay($panel, chance.reason || "MACHINE DATA UNAVAILABLE.");
                return;
            }

            if (state.machineCoinsLoaded >= chance.availableCoins) {
                updateMachineOverlay($panel, "NOT ENOUGH MONOCOINS TO INCREASE LOAD.");
                return;
            }

            state.machineCoinsLoaded += 1;
            playSfx?.(getSfx?.().click);
            updateMachineOverlay($panel, `LOAD INCREASED TO ${state.machineCoinsLoaded}.`);
        });

        $panel.find(selectors.machineRoll).off("click").on("click", () => {
            if (state.machineRolling) return;

            const items = getItemsController();
            if (!items?.spinMonoMonoMachine) return;

            playSfx?.(getSfx?.().click);

            const run = items.spinMonoMonoMachine(state.machineCoinsLoaded);
            if (!run.ok) {
                updateMachineOverlay($panel, run.reason || "ROLL FAILED.");
                return;
            }

            state.machineRolling = true;
            $panel.find(selectors.machineRoll).prop("disabled", true);
            $panel.find(selectors.machineAdd).prop("disabled", true);

            const $img = $panel.find(selectors.machineImage);
            if ($img.length) {
                $img.attr("src", `${extensionFolderPath}/assets/monochine_roll.gif`);
                setTimeout(() => {
                    $img.attr("src", `${extensionFolderPath}/assets/monochine_idle.png`);
                    state.machineRolling = false;
                    $panel.find(selectors.machineRoll).prop("disabled", false);
                    $panel.find(selectors.machineAdd).prop("disabled", false);
                }, 2800);
            }

            const resultLine = `${run.duplicate ? "DUPE" : "NEW"}: ${run.result.name.toUpperCase()} (COST ${run.cost})`;
            state.machineCoinsLoaded = 1;
            updateMachineOverlay($panel, resultLine);
        });
    }

    function closeMachineOverlay($panel) {
        $panel.find(selectors.machineOverlay).removeClass("open").attr("aria-hidden", "true");
    }

    function updateMachineOverlay($panel, statusMessage = "") {
        const items = getItemsController();
        if (!items?.getMonoMonoDupeChance) return;

        const chance = items.getMonoMonoDupeChance(state.machineCoinsLoaded);
        const safeCoins = Math.max(0, Number(chance.availableCoins || 0));
        const chancePercent = Math.round(Number(chance.chancePercent || 0));

        $panel.find(selectors.machineDisplayCoins).text(`x ${safeCoins}`);
        $panel.find(selectors.machineDisplayLoad).text(`LOAD: ${state.machineCoinsLoaded} COIN${state.machineCoinsLoaded === 1 ? "" : "S"}`);
        $panel.find(selectors.machineDisplayDupe).text(`DUPE CHANCE: ${chancePercent}%`);

        if (statusMessage) {
            $panel.find(selectors.machineResult).text(statusMessage);
        }
    }

    function openMachineOverlay($panel) {
        ensureMachineOverlay($panel);
        state.machineCoinsLoaded = 1;
        updateMachineOverlay($panel, "SELECT COINS, THEN ROLL.");
        state.machineRolling = false;
        $panel.find(selectors.machineRoll).prop("disabled", false);
        $panel.find(selectors.machineAdd).prop("disabled", false);
        $panel.find(selectors.machineImage).attr("src", `${extensionFolderPath}/assets/monochine_idle.png`);
        $panel.find(selectors.machineOverlay).addClass("open").attr("aria-hidden", "false");
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
                state.floor = floor.key;
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

        $imageWrap.find(selectors.machinePin).remove();

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
    }

    function bindAreaButtons($panel) {
        $panel.find(selectors.areaButtons).off("click").on("click", function () {
            const nextArea = this.dataset.area;
            if (!MAP_AREAS[nextArea]) return;

            state.area = nextArea;
            ensureValidFloorSelection();
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
    }

    return {
        renderMapPanel,
    };
}
