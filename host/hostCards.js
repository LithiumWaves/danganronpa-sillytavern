// Host / mascot cards: Monokuma, Monomi, the Monokubs… They run the killing
// game rather than take part in it, so they never wander the rooms, get a dorm
// room or sit on the class roster. Instead they slide in from the bottom of the
// screen when called (see hostStage.js).
//
// The choice is kept per save under `hostCards`: a list of card names. An empty
// list means Auto, which picks the card named Monokuma.

export const AUTO_HOST_NAMES = Object.freeze(["Monokuma"]);

export function normalizeHostName(name) {
    return String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// The names picked in settings, cleaned up. Empty means Auto.
export function readHostSetting(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of value) {
        const name = String(raw ?? "").trim();
        const key = normalizeHostName(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
    }
    return out;
}

export function isAutoHostSetting(value) {
    return readHostSetting(value).length === 0;
}

// This save's host names. With `cardNames` (every character card) the result
// uses each card's own spelling and drops picks whose card is gone; without
// it the picked names are returned as they are.
export function resolveHostNames(value, cardNames = null) {
    const picked = readHostSetting(value);
    const wanted = picked.length ? picked : AUTO_HOST_NAMES;
    if (!Array.isArray(cardNames)) return [...wanted];
    const byKey = new Map(cardNames.map((n) => [normalizeHostName(n), String(n)]));
    return wanted.map((n) => byKey.get(normalizeHostName(n))).filter(Boolean);
}

export function isHostName(name, hosts = []) {
    const key = normalizeHostName(name);
    return !!key && hosts.some((h) => normalizeHostName(h) === key);
}

// Whether this host enters with the Rise & Shine splash (hostSplash.js)
// rather than popping up. `splashSetting` is the save's `hostSplashCards`.
export function usesSplashEntrance(name, splashSetting) {
    return isHostName(name, readHostSetting(splashSetting));
}
