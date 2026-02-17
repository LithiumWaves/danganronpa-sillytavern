export const LOCATION_PINPOINTS = {
    academy_entrance_hall: { area: "hopes_peak", floor: "floor_1", x: 238, y: 218, width: 480, height: 272, label: "Entrance Hall" },
    academy_classroom_block: { area: "hopes_peak", floor: "floor_1", x: 130, y: 128, width: 480, height: 272, label: "Classroom Block" },
    academy_gym: { area: "hopes_peak", floor: "floor_1", x: 332, y: 95, width: 480, height: 272, label: "Gym" },
    academy_library: { area: "hopes_peak", floor: "floor_2", x: 212, y: 121, width: 480, height: 272, label: "Library" },
    academy_pool: { area: "hopes_peak", floor: "floor_2", x: 344, y: 150, width: 480, height: 272, label: "Pool" },
    academy_dorm_hall: { area: "hopes_peak", floor: "floor_3", x: 256, y: 116, width: 480, height: 272, label: "Dorm Hall" },
    academy_music_room: { area: "hopes_peak", floor: "floor_3", x: 148, y: 80, width: 480, height: 272, label: "Music Room" },
    academy_lab_block: { area: "hopes_peak", floor: "floor_4", x: 245, y: 134, width: 480, height: 272, label: "Lab Block" },
    academy_data_center: { area: "hopes_peak", floor: "floor_5", x: 286, y: 92, width: 480, height: 272, label: "Data Center" },
    hotel_lobby: { area: "hotel_despair", floor: "floor_1", x: 236, y: 210, width: 480, height: 272, label: "Hotel Lobby" },
    hotel_restaurant: { area: "hotel_despair", floor: "floor_1", x: 132, y: 137, width: 480, height: 272, label: "Hotel Restaurant" },
    hotel_guest_hall: { area: "hotel_despair", floor: "floor_1", x: 340, y: 108, width: 480, height: 272, label: "Guest Hall" },
    hotel_hidden_floor: { area: "hotel_despair", floor: "hidden_floor", x: 245, y: 132, width: 480, height: 272, label: "Hidden Floor" },
};

export const LOCATION_ALIAS_INDEX = {
    academy_entrance_hall: ["entrance hall", "main hall", "front hall", "academy entrance"],
    academy_classroom_block: ["classroom", "class room", "class block"],
    academy_gym: ["gym", "gymnasium"],
    academy_library: ["library", "archives"],
    academy_pool: ["pool", "swimming"],
    academy_dorm_hall: ["dorm", "dorm hall", "dormitory", "bedroom wing"],
    academy_music_room: ["music room", "piano room"],
    academy_lab_block: ["lab", "laboratory", "science wing"],
    academy_data_center: ["data center", "server room", "control room", "headmaster room"],
    hotel_lobby: ["hotel lobby", "lobby", "reception"],
    hotel_restaurant: ["restaurant", "diner", "cafeteria"],
    hotel_guest_hall: ["guest hall", "guest room", "hotel room", "suite"],
    hotel_hidden_floor: ["hidden floor", "secret floor", "hidden level"],
};

export function resolveLocationIdFromText(input) {
    const text = String(input || "").toLowerCase();
    if (!text) return null;

    for (const [locationId, aliases] of Object.entries(LOCATION_ALIAS_INDEX)) {
        if (aliases.some(alias => text.includes(alias))) {
            return locationId;
        }
    }

    return null;
}

export function getLocationPromptReference() {
    return Object.entries(LOCATION_ALIAS_INDEX)
        .map(([locationId, aliases]) => `${locationId}: ${aliases.join(", ")}`)
        .join("\n");
}
