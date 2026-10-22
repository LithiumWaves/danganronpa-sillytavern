// Where the map keeps what players change.
//
// - Layout (rooms, Monomachine and trial pins, edited default pins, custom
//   areas and floors, area overrides) is global: it lives in the extension
//   settings under `mapLayout`, so it follows the SillyTavern account rather
//   than one browser.
// - Story pins (evidence and body pins) belong to a save: they live under
//   `map.storyPins`, one of the save system's story keys.
//
// Older versions kept all of it in localStorage; migrateLegacyMapStorage
// moves it over once.

export const STORY_PIN_TYPES = Object.freeze(["truth-bullet", "body"]);

export const LEGACY_KEYS = Object.freeze({
    pins: "dangan_map_custom_pins_v1",
    deletedDefaultPins: "dangan_map_deleted_default_pins_v1",
    customAreas: "dangan_map_custom_areas_v1",
    areaOverrides: "dangan_map_area_overrides_v1",
});

export function isStoryPin(pin) {
    return STORY_PIN_TYPES.includes(pin?.type);
}

function stripRuntime(pin) {
    const copy = { ...pin };
    delete copy._default;
    return copy;
}

// The working list the map edits: stored layout pins, shipped defaults the
// player hasn't deleted or edited, and the active save's story pins.
export function mergePins({ layoutPins = [], storyPins = [], deletedDefaultPins = [], defaults = [] } = {}) {
    const storedIds = new Set(layoutPins.map((p) => p.id));
    const deleted = new Set(deletedDefaultPins);
    const merged = layoutPins.map((p) => ({ ...p }));
    for (const def of defaults) {
        if (deleted.has(def.id) || storedIds.has(def.id)) continue;
        merged.push({ ...JSON.parse(JSON.stringify(def)), _default: true });
    }
    for (const pin of storyPins) merged.push({ ...pin });
    return merged;
}

// Splits the working list back into what each store keeps. Untouched default
// pins aren't stored (they're rebuilt from code); a default missing from the
// list was deleted and gets a tombstone.
export function splitPins(pins = [], { defaults = [], isUnchangedDefault = () => false } = {}) {
    const layoutPins = [];
    const storyPins = [];
    for (const pin of pins) {
        if (isStoryPin(pin)) storyPins.push(stripRuntime(pin));
        else if (!isUnchangedDefault(pin)) layoutPins.push(stripRuntime(pin));
    }
    const presentIds = new Set(pins.map((p) => p.id));
    const deletedDefaultPins = defaults.filter((d) => !presentIds.has(d.id)).map((d) => d.id);
    return { layoutPins, storyPins, deletedDefaultPins };
}

function readLegacy(storage, key, fallback) {
    try {
        const raw = storage?.getItem?.(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

// One-time move from localStorage into the settings. Returns true if it ran.
// The localStorage values are left in place as a backup.
export function migrateLegacyMapStorage(root, storage) {
    if (!root || root.mapLayout) return false;
    const pins = readLegacy(storage, LEGACY_KEYS.pins, []);
    const list = Array.isArray(pins) ? pins : [];
    const deleted = readLegacy(storage, LEGACY_KEYS.deletedDefaultPins, []);
    const areas = readLegacy(storage, LEGACY_KEYS.customAreas, []);
    const overrides = readLegacy(storage, LEGACY_KEYS.areaOverrides, {});
    root.mapLayout = {
        pins: list.filter((p) => !isStoryPin(p)),
        deletedDefaultPins: Array.isArray(deleted) ? deleted : [],
        customAreas: Array.isArray(areas) ? areas : [],
        areaOverrides: overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {},
    };
    const storyPins = list.filter(isStoryPin);
    if (storyPins.length) {
        root.map ??= {};
        const existing = Array.isArray(root.map.storyPins) ? root.map.storyPins : [];
        const ids = new Set(existing.map((p) => p.id));
        root.map.storyPins = [...existing, ...storyPins.filter((p) => !ids.has(p.id))];
    }
    return true;
}

// Floor images are a file under the extension's assets, an uploaded path
// (/user/images/…) or, from older versions, a data URL.
export function resolveFloorImageSrc(image, extensionFolderPath = "") {
    if (!image) return "";
    if (image.startsWith("data:") || image.startsWith("/")) return image;
    return `${extensionFolderPath}/assets/${image}`;
}

// Every custom floor object (custom areas and floors added to built-in
// areas), for migrating their images.
export function listCustomFloors(layout) {
    const floors = [];
    for (const area of layout?.customAreas || []) floors.push(...(area?.floors || []));
    for (const ov of Object.values(layout?.areaOverrides || {})) floors.push(...(ov?.extraFloors || []));
    return floors;
}
