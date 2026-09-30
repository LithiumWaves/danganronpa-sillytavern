import { DEFAULT_GAMEPLAY_PROMPT_TEMPLATES } from "../core/constants.js";

export const ROOM_CONTEXT_PROMPT_KEY = "dangan_room_context";

export function fillRoomContextTemplate(template, { room, characters } = {}) {
    const text = (typeof template === "string" && template.length)
        ? template
        : DEFAULT_GAMEPLAY_PROMPT_TEMPLATES.roomContext;
    const names = (Array.isArray(characters) ? characters : [])
        .map((n) => String(n || "").trim())
        .filter(Boolean);
    return text
        .replace(/\{\{room\}\}/g, room || "unknown")
        .replace(/\{\{characters\}\}/g, names.length ? names.join(", ") : "none");
}

export function resolveRoomLabel(locationId, pin) {
    if (pin?.label) return String(pin.label);
    const id = String(locationId || "");
    if (!id) return "";
    if (id.startsWith("area:")) return id.slice(5);
    if (id.startsWith("subarea:")) return id.slice(8);
    return id;
}

export function buildRoomContextPrompt({
    enabled,
    trialActive,
    locationId,
    room,
    characters,
    template,
} = {}) {
    if (!enabled || trialActive || !locationId) return "";
    return fillRoomContextTemplate(template, { room, characters });
}
