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
    };

    const selectors = {
        panel: `.monopad-panel-content[data-panel="map"]`,
        areaButtons: ".map-area-button",
        floorList: ".map-floor-list",
        image: ".map-image",
        title: ".map-location-title",
        subtitle: ".map-location-subtitle",
        machinePin: ".map-machine-pin",
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
        const $imageWrap = $panel.find('.map-image-wrap');

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

        const showMachinePin = state.area === 'hopes_peak' && state.floor === 'floor_1';
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
        $panel.find(selectors.machinePin).off('click').on('click', () => {
            const items = typeof getItemsPanelController === 'function' ? getItemsPanelController() : null;
            if (!items) return;

            playSfx?.(getSfx?.().click);

            const run = items.rollMonoMonoMachine?.(1);
            const message = run?.ok
                ? `MONOMONO MACHINE: ${run.message}`
                : `MONOMONO MACHINE: ${run?.reason || 'UNAVAILABLE.'}`;

            const $subtitle = $panel.find(selectors.subtitle);
            if ($subtitle.length) {
                $subtitle.text(message);
            }
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
    }

    return {
        renderMapPanel,
    };
}
