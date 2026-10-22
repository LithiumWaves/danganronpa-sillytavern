// Pure helpers for the New Game map step: the built-in map choices, checks for
// an uploaded map, and turning the wizard's draft into the area + room pins the
// Monopad map stores (see applyNewGameMap in map/mapPanel.js).

// Pin coordinates are fractions of the floor picture scaled to this box, the
// same space the Monopad map uses (MAP_POINT_WIDTH/HEIGHT in mapPanel.js).
export const MAP_POINT = Object.freeze({ width: 480, height: 272 });

export const BUILT_IN_MAP_CHOICES = Object.freeze({
    hopes_peak: Object.freeze({
        name: "HOPE'S PEAK ACADEMY",
        tag: "RECOMMENDED · BUILT-IN",
        text: "The academy from the first game: five school floors, the Inn and the Dorms. Every room is already placed, so you can start right away.",
        areas: Object.freeze(["hopes_peak", "hotel_despair"]),
        startLocationId: "classroom_1a",
        preview: "images/maps/floor_one.png",
    }),
    jabberwock_island: Object.freeze({
        name: "JABBERWOCK ISLAND",
        tag: "BUILT-IN",
        text: "The first island from the second game: the old storehouse, the pier cottages and Hotel Despair. Its rooms are already placed too.",
        areas: Object.freeze(["jabberwock_island"]),
        startLocationId: "pier_cottages_courtyard",
        preview: "images/maps/jabberwock_pier_cottages.png",
    }),
});

export const CUSTOM_MAP_CHOICE = "custom";

// A short list of room icons (files in assets/rooms/) for the Place Rooms step.
export const ROOM_ICON_CHOICES = Object.freeze([
    ["classroom.svg", "Classroom"],
    ["bedroom.svg", "Bedroom"],
    ["cafeteria.svg", "Dining / Kitchen"],
    ["library.svg", "Library"],
    ["gym.svg", "Gym"],
    ["infirmary.svg", "Infirmary"],
    ["rec-room.svg", "Lounge / Hall"],
    ["storage.svg", "Storage"],
    ["garden.svg", "Garden / Outdoors"],
    ["pool.svg", "Pool"],
    ["mens-bathroom.svg", "Boys' Toilets"],
    ["womens-bathroom.svg", "Girls' Toilets"],
    ["stairs.svg", "Stairs / Exit"],
    ["locked-room.svg", "Locked Room"],
    ["monokuma-eye.svg", "Monokuma Room"],
]);

export const DEFAULT_ROOM_ICON = "classroom.svg";

export function emptyCustomMap() {
    return { name: "", floors: [{ label: "FLOOR 1", image: "", fileName: "" }], rooms: [], startIdx: 0 };
}

export function slugify(str) {
    return String(str || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// Floors that will actually be created: both a name and a picture.
export function usableFloors(map) {
    return (map?.floors || []).filter((f) => String(f?.label || "").trim() && f?.image);
}

export function validateCustomMapDetails(map) {
    if (!String(map?.name || "").trim()) return "Give your map a name.";
    const floors = map?.floors || [];
    if (!floors.length) return "Add at least one floor.";
    const missingName = floors.findIndex((f) => !String(f?.label || "").trim());
    if (missingName >= 0) return `Floor ${missingName + 1} needs a name.`;
    const missingImage = floors.findIndex((f) => !f?.image);
    if (missingImage >= 0) return `Floor ${missingImage + 1} needs a picture. Use UPLOAD PICTURE, or remove the floor.`;
    return "";
}

export function validateCustomMapRooms(map) {
    const rooms = map?.rooms || [];
    if (!rooms.length) return "Place at least one room. Click anywhere on the floor picture.";
    const unnamed = rooms.findIndex((r) => !String(r?.label || "").trim());
    if (unnamed >= 0) return `Room ${unnamed + 1} needs a name.`;
    return "";
}

// A click inside the floor picture's box (local px) to map coordinates.
export function toMapPoint(localX, localY, boxWidth, boxHeight) {
    if (!(boxWidth > 0) || !(boxHeight > 0)) return { x: 0, y: 0 };
    const fx = Math.max(0, Math.min(1, localX / boxWidth));
    const fy = Math.max(0, Math.min(1, localY / boxHeight));
    return { x: Math.round(fx * MAP_POINT.width), y: Math.round(fy * MAP_POINT.height) };
}

// The finish payload's `map` field.
export function buildMapPayload(choice, customMap) {
    const builtIn = BUILT_IN_MAP_CHOICES[choice];
    if (builtIn) {
        return { choice, areas: [...builtIn.areas], startLocationId: builtIn.startLocationId };
    }
    if (choice !== CUSTOM_MAP_CHOICE) return null;
    const floors = customMap?.floors || [];
    return {
        choice,
        custom: {
            name: String(customMap?.name || "").trim(),
            floors: floors.map((f) => ({ label: String(f.label || "").trim(), image: f.image })),
            rooms: (customMap?.rooms || []).map((r) => ({
                label: String(r.label || "").trim(),
                icon: r.icon || DEFAULT_ROOM_ICON,
                floorIdx: r.floorIdx,
                x: r.x,
                y: r.y,
            })),
            startIdx: Math.max(0, Math.min((customMap?.rooms?.length || 1) - 1, Number(customMap?.startIdx) || 0)),
        },
    };
}

// Turns a custom map payload into the stored custom area and its room pins.
// Room ids are prefixed with the area's id so they can't clash with a room of
// the same name on another map (several built-in maps have a "Kitchen").
export function buildCustomArea(custom, { key, now = Date.now() } = {}) {
    const areaId = slugify(custom.name) || "custom_map";
    const floors = custom.floors.map((f, i) => ({
        key: `floor_${i + 1}`,
        label: f.label.toUpperCase(),
        id: slugify(f.label) || `floor_${i + 1}`,
        description: `${custom.name}: ${f.label}.`,
        image: f.image,
    }));
    const area = { key, label: custom.name.toUpperCase(), id: areaId, custom: true, floors };
    const used = new Set();
    const pins = custom.rooms.map((r, i) => {
        const base = `${areaId}_${slugify(r.label) || `room_${i + 1}`}`;
        let locationId = base;
        for (let n = 2; used.has(locationId); n++) locationId = `${base}_${n}`;
        used.add(locationId);
        return {
            id: `custom_${now}_${i}`,
            icon: r.icon || DEFAULT_ROOM_ICON,
            type: "room",
            label: r.label,
            locationId,
            areaKey: key,
            floorKey: floors[r.floorIdx]?.key || floors[0]?.key || "floor_1",
            x: r.x,
            y: r.y,
        };
    });
    const start = pins[custom.startIdx] || pins[0] || null;
    return { area, pins, startLocationId: start?.locationId || null, startFloorKey: start?.floorKey || floors[0]?.key || null };
}
