import { LOCATION_PINPOINTS } from "../map/locationPresence.js";
import { normalizeName } from "../social/characterUtils.js";

const STATE_VERSION = 1;
const ROOM_ID_PREFIXES_TO_REJECT = ["area:", "subarea:"];
// `mapPanel` exposes type='room' for navigable rooms; the rest (truth-bullet,
// body, monomachine, trial) are content pins we don't spawn characters at.
const SPAWNABLE_PIN_TYPES = new Set(["room"]);

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// Each cluster (solo or group) is lifted a random amount above the strip's
// baseline. The further up they're lifted, the smaller they render — a
// crude single-vanishing-point perspective. Resulting scale is clamped to
// [PERSPECTIVE_SCALE_MIN, PERSPECTIVE_SCALE_MAX]; the falloff is curved so
// small lifts barely shrink but high lifts approach the minimum quickly.
const MAX_VERTICAL_OFFSET_VH = 32;
const PERSPECTIVE_SCALE_MIN = 0.35;
const PERSPECTIVE_SCALE_MAX = 0.65;
const PERSPECTIVE_FALLOFF_POWER = 2.2;
function randomVerticalOffsetVh() {
    return Math.round(Math.random() * MAX_VERTICAL_OFFSET_VH * 10) / 10;
}
function scaleFromVerticalOffset(vh) {
    const ratio = Math.max(0, Math.min(1, (vh || 0) / MAX_VERTICAL_OFFSET_VH));
    const curved = Math.pow(ratio, PERSPECTIVE_FALLOFF_POWER);
    return PERSPECTIVE_SCALE_MAX - curved * (PERSPECTIVE_SCALE_MAX - PERSPECTIVE_SCALE_MIN);
}

// Sample k distinct entries without replacement.
function sampleWithout(list, k) {
    const pool = [...list];
    const out = [];
    for (let i = 0; i < k && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0]);
    }
    return out;
}

// Pick how many "active" rooms to spread characters across this cycle. Aim
// for ~3 characters per occupied room so the player actually runs into
// people instead of wandering through 70 empty rooms.
function chooseActiveRoomCount(rosterSize, totalRoomCount) {
    const desired = Math.max(2, Math.ceil(rosterSize / 3));
    return Math.min(desired, totalRoomCount);
}

function makeGroupId() {
    return `og_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Partition a list of character keys into spawn-groups of 1-3 members each.
// Bias toward solo (60%); the rest form pairs or trios.
function partitionIntoSpawnGroups(keys) {
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    const groups = [];
    let i = 0;
    while (i < shuffled.length) {
        const remaining = shuffled.length - i;
        let take = 1;
        if (remaining >= 3 && Math.random() < 0.18) take = 3;
        else if (remaining >= 2 && Math.random() < 0.32) take = 2;
        groups.push(shuffled.slice(i, i + take));
        i += take;
    }
    return groups;
}

export function createOverworldSceneController({
    extension_settings,
    extensionName,
    saveSettingsDebounced,
    characters,
    getSpriteUrl,
    getAvailableExpressionLabels,
    getCharacterHeightCm,
    getCurrentLocationId,
    isInCharacterChat,
    executeSlashCommands,
    // openGroupById sets `selected_group` so ctx.groupId becomes truthy and the
    // overworld switches to chat-exit mode. ctx.openGroupChat alone does not.
    openGroupById,
    getRequestHeaders,
    eventSource,
    event_types,
    getLastKnownCharacterLocations,
    getMapPanelController, // () => mapPanelController — lazy so initialization order doesn't matter
    onSceneChanged, // optional — fires after randomize / location moves so the host can refresh minimap pins
    getPlayerName, // () => string — used to filter the player's own persona out of the scene
    playSfx, // optional — (sfxObject | id) => void
    getSfx,  // optional — () => the shared sfx registry
    armBgmTransitionGuard, // optional — (durationMs) => void; suppresses BGM pauses for the duration
}) {
    function playOwSfx(key) {
        if (!playSfx) return;
        const reg = getSfx?.();
        const sound = reg?.[key];
        if (sound) try { playSfx(sound); } catch (e) { /* swallow — sfx is non-critical */ }
    }

    // ── Hover cursor (Non-Stop Debate–style reticle) ─────────────────────────
    // One shared element tracks the mouse while the player is hovering an
    // overworld sprite. The cursor is themed via CSS (body.dangan-theme-*).
    let cursorEl = null;
    let cursorRafId = null;
    let cursorTargetX = 0;
    let cursorTargetY = 0;
    let cursorActiveHoverCount = 0;

    function ensureCursorEl() {
        if (cursorEl && cursorEl.isConnected) return cursorEl;
        cursorEl = document.createElement("div");
        cursorEl.id = "dangan-ow-cursor";
        document.body.appendChild(cursorEl);
        return cursorEl;
    }

    function onCursorMove(e) {
        cursorTargetX = e.clientX;
        cursorTargetY = e.clientY;
        if (cursorRafId == null) {
            cursorRafId = requestAnimationFrame(() => {
                cursorRafId = null;
                if (cursorEl) {
                    cursorEl.style.transform = `translate(${cursorTargetX}px, ${cursorTargetY}px) translate(-50%, -50%)`;
                }
            });
        }
    }

    function showCursor() {
        const el = ensureCursorEl();
        el.classList.add("is-active");
        window.addEventListener("mousemove", onCursorMove);
    }

    function hideCursor() {
        if (cursorEl) cursorEl.classList.remove("is-active");
        window.removeEventListener("mousemove", onCursorMove);
        if (cursorRafId != null) { cancelAnimationFrame(cursorRafId); cursorRafId = null; }
    }

    function attachSpriteHoverFx(spriteEl) {
        spriteEl.addEventListener("mouseenter", (e) => {
            cursorActiveHoverCount++;
            // Seed the cursor at the entry point so it doesn't flash from (0,0).
            cursorTargetX = e.clientX;
            cursorTargetY = e.clientY;
            const el = ensureCursorEl();
            el.style.transform = `translate(${cursorTargetX}px, ${cursorTargetY}px) translate(-50%, -50%)`;
            showCursor();
            playOwSfx("character_hover");
        });
        spriteEl.addEventListener("mouseleave", () => {
            cursorActiveHoverCount = Math.max(0, cursorActiveHoverCount - 1);
            if (cursorActiveHoverCount === 0) hideCursor();
        });
    }

    function teardownCursor() {
        cursorActiveHoverCount = 0;
        hideCursor();
        if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    }
    function notifySceneChanged() {
        try { onSceneChanged?.(); } catch (e) { console.warn("[Dangan][Overworld] onSceneChanged failed:", e); }
    }

    function debug(...args) {
        if (window?.dangan_overworld_debug) console.log("[Dangan][Overworld]", ...args);
    }
    // Validate a locationId by asking the map panel for its pin. Falls back to
    // the hardcoded LOCATION_PINPOINTS table so the controller still works in
    // environments where the user hasn't populated custom map pins yet.
    function isRoomLocationId(locationId) {
        if (!locationId) return false;
        if (ROOM_ID_PREFIXES_TO_REJECT.some(p => locationId.startsWith(p))) return false;
        const mp = getMapPanelController?.();
        const pin = mp?.getPinByLocationId?.(locationId);
        if (pin) return SPAWNABLE_PIN_TYPES.has(pin.type);
        return Object.prototype.hasOwnProperty.call(LOCATION_PINPOINTS, locationId);
    }

    // Resolve the player's current area + floor — either from a pin lookup or
    // from "area:" / "subarea:" id prefixes.
    function getPlayerAreaFloor() {
        const id = getCurrentLocationId();
        if (!id) return null;
        if (id.startsWith("subarea:")) {
            const tail = id.slice(8);
            const slash = tail.indexOf("/");
            if (slash >= 0) return { areaKey: tail.slice(0, slash), floorKey: tail.slice(slash + 1) };
            return { areaKey: tail, floorKey: null };
        }
        if (id.startsWith("area:")) return { areaKey: id.slice(5), floorKey: null };
        const pin = getMapPanelController?.()?.getPinByLocationId?.(id);
        if (pin?.areaKey) return { areaKey: pin.areaKey, floorKey: pin.floorKey ?? null };
        return null;
    }

    // Returns the set of room locationIds eligible for character spawning. The
    // user-facing rule: characters only spawn within the player's CURRENT area
    // and sub-area (so a player on the Hotel 1F floor sees Hotel 1F characters,
    // not Academy characters who happen to be elsewhere). Falls back to the
    // hardcoded LOCATION_PINPOINTS table only when no map pins exist at all.
    function listSpawnableRoomIds() {
        const mp = getMapPanelController?.();
        const pins = mp?.getAllPins?.() || [];
        let filtered = pins.filter(p => SPAWNABLE_PIN_TYPES.has(p.type) && !p.hidden);

        if (filtered.length > 0) {
            const af = getPlayerAreaFloor();
            if (af?.areaKey) {
                const sameArea = filtered.filter(p => p.areaKey === af.areaKey);
                if (sameArea.length > 0) {
                    filtered = sameArea;
                    if (af.floorKey) {
                        const sameFloor = filtered.filter(p => p.floorKey === af.floorKey);
                        if (sameFloor.length > 0) filtered = sameFloor;
                    }
                }
            }
            const ids = filtered.map(p => p.locationId).filter(Boolean);
            if (ids.length > 0) return ids;
        }

        return Object.keys(LOCATION_PINPOINTS);
    }
    const ROOT_ID = "dangan-overworld";

    let renderToken = 0;
    let isFadingOutForChat = false;

    function getState() {
        const root = extension_settings[extensionName] ??= {};
        const ow = root.overworld ??= { version: STATE_VERSION, characters: {} };
        if (!ow.characters || typeof ow.characters !== "object") ow.characters = {};
        if (!ow.flatRooms || typeof ow.flatRooms !== "object") ow.flatRooms = {};
        return ow;
    }

    function isRoomFlat(locationId) {
        if (!locationId) return false;
        return !!getState().flatRooms[locationId];
    }

    function setRoomFlat(locationId, value) {
        if (!locationId) return;
        const state = getState();
        if (value) state.flatRooms[locationId] = true;
        else delete state.flatRooms[locationId];
        saveState();
        scheduleRender();
        notifySceneChanged();
    }

    function toggleCurrentRoomFlat() {
        const id = getCurrentLocationId();
        if (!id) return;
        setRoomFlat(id, !isRoomFlat(id));
        return isRoomFlat(id);
    }

    function saveState() {
        saveSettingsDebounced();
    }

    function getRoomKeys() {
        return listSpawnableRoomIds();
    }

    // Returns alive, non-missing roster character keys (normalized name).
    // Excludes whichever roster character the player is currently embodying
    // (active persona) so we don't render the player's own sprite as a
    // separate NPC standing in the room.
    function getActiveRosterKeys() {
        const playerKey = (() => {
            try {
                const n = getPlayerName?.();
                return n ? normalizeName(n) : null;
            } catch { return null; }
        })();
        const out = [];
        for (const [key, char] of characters.entries()) {
            if (!char || !char.name) continue;
            if (char.dead || char.missing) continue;
            if (playerKey && key === playerKey) continue;
            // Defensive belt-and-braces: drop ST system / narrator chars even
            // if they slipped past the load-time filter (older persisted
            // rosters could have them stored).
            const lc = String(char.name).toLowerCase();
            if (lc.includes("sillytavern") || lc.includes("system") || lc === "assistant" || lc.includes("narrator") || lc.includes("prome user sprite")) continue;
            out.push(key);
        }
        return out;
    }

    function getRosterCharByKey(key) {
        return characters.get(key) || null;
    }

    // Seed any character that doesn't have a stored locationId. Uses last-known
    // location from chat history when available; characters without history are
    // clustered into a smaller pool of active rooms so the player actually
    // finds them.
    function ensureCharacterLocations() {
        const state = getState();
        const rooms = getRoomKeys();
        if (rooms.length === 0) return;
        const lastKnown = (typeof getLastKnownCharacterLocations === "function")
            ? (getLastKnownCharacterLocations() || {})
            : {};

        let changed = false;
        const needSeed = [];
        for (const key of getActiveRosterKeys()) {
            const entry = state.characters[key] ??= { locationId: null, groupId: null };
            if (!isRoomLocationId(entry.locationId)) {
                const fromHistory = lastKnown[key];
                if (isRoomLocationId(fromHistory)) {
                    entry.locationId = fromHistory;
                    entry.groupId = null;
                    changed = true;
                } else {
                    needSeed.push(key);
                }
            }
        }

        // For the characters that still need a location, pick a clustered set
        // of active rooms (~roster/3) and round-robin into them. Always keep
        // the player's current room in the pool so the hallway they're standing
        // in isn't unconditionally empty.
        if (needSeed.length > 0) {
            const activeRoomCount = chooseActiveRoomCount(needSeed.length, rooms.length);
            const playerRoom = getCurrentLocationId();
            const playerRoomIsSpawnable = playerRoom && rooms.includes(playerRoom);
            const otherRooms = rooms.filter(r => r !== playerRoom);
            const extraNeeded = Math.max(0, activeRoomCount - (playerRoomIsSpawnable ? 1 : 0));
            const activeRooms = playerRoomIsSpawnable
                ? [playerRoom, ...sampleWithout(otherRooms, extraNeeded)]
                : sampleWithout(otherRooms, extraNeeded);
            const shuffled = [...needSeed].sort(() => Math.random() - 0.5);
            shuffled.forEach((key, i) => {
                const room = i < activeRooms.length ? activeRooms[i] : pickRandom(activeRooms);
                state.characters[key].locationId = room;
                state.characters[key].groupId = null;
            });
            changed = true;
        }

        // Recompute groupIds for any room whose members have no shared group yet.
        const byRoom = new Map();
        for (const key of getActiveRosterKeys()) {
            const entry = state.characters[key];
            if (!entry?.locationId) continue;
            if (!byRoom.has(entry.locationId)) byRoom.set(entry.locationId, []);
            byRoom.get(entry.locationId).push(key);
        }
        for (const [, keys] of byRoom.entries()) {
            const hasAnyGroup = keys.some(k => state.characters[k]?.groupId !== undefined && state.characters[k]?.verticalOffsetVh != null);
            if (hasAnyGroup) continue;
            // Assign spawn groups for this room. Each cluster — solo or
            // group — gets a single shared vertical offset, so group members
            // render identically.
            const groups = partitionIntoSpawnGroups(keys);
            for (const cluster of groups) {
                const isGroup = cluster.length > 1;
                const gid = isGroup ? makeGroupId() : null;
                const offsetVh = randomVerticalOffsetVh();
                for (const k of cluster) {
                    state.characters[k].groupId = gid;
                    state.characters[k].verticalOffsetVh = offsetVh;
                    delete state.characters[k].depthScale;
                }
            }
            changed = true;
        }

        if (changed) { saveState(); notifySceneChanged(); }
    }

    // Randomize location + spawn-grouping for every active roster character.
    // Called on Pass Time / Go to Sleep. Concentrates characters into a smaller
    // pool of "active" rooms so the player isn't walking through empty halls.
    function randomizeLocations() {
        const state = getState();
        const rooms = getRoomKeys();
        const keys = getActiveRosterKeys();
        if (rooms.length === 0 || keys.length === 0) {
            saveState();
            scheduleRender();
            return;
        }

        const activeRoomCount = chooseActiveRoomCount(keys.length, rooms.length);
        const playerRoom = getCurrentLocationId();
        const playerRoomIsSpawnable = playerRoom && rooms.includes(playerRoom);
        // Always include the player's current room in the active set so they
        // see at least one cluster from where they're standing.
        const otherRooms = rooms.filter(r => r !== playerRoom);
        const extraNeeded = Math.max(0, activeRoomCount - (playerRoomIsSpawnable ? 1 : 0));
        const sampledOthers = sampleWithout(otherRooms, extraNeeded);
        const activeRooms = playerRoomIsSpawnable ? [playerRoom, ...sampledOthers] : sampledOthers;
        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        // Round-robin so every active room is occupied; remaining characters
        // pile on randomly into already-active rooms.
        const newRoomByKey = new Map();
        shuffledKeys.forEach((key, i) => {
            const room = i < activeRooms.length
                ? activeRooms[i]
                : pickRandom(activeRooms);
            newRoomByKey.set(key, room);
        });

        for (const key of keys) {
            const entry = state.characters[key] ??= { locationId: null, groupId: null };
            entry.locationId = newRoomByKey.get(key);
            entry.groupId = null;
            // Cycle the expression so a fresh shuffle visibly changes poses
            // alongside locations. Render() will pick a new one lazily.
            delete entry.expression;
        }
        // Partition each occupied room into spawn-groups.
        const byRoom = new Map();
        for (const [key, room] of newRoomByKey.entries()) {
            if (!byRoom.has(room)) byRoom.set(room, []);
            byRoom.get(room).push(key);
        }
        for (const [, roomKeys] of byRoom.entries()) {
            const groups = partitionIntoSpawnGroups(roomKeys);
            for (const cluster of groups) {
                const isGroup = cluster.length > 1;
                const gid = isGroup ? makeGroupId() : null;
                const offsetVh = randomVerticalOffsetVh();
                for (const k of cluster) {
                    state.characters[k].groupId = gid;
                    state.characters[k].verticalOffsetVh = offsetVh;
                    delete state.characters[k].depthScale;
                }
            }
        }
        saveState();
        scheduleRender();
        notifySceneChanged();
    }

    // If the player moves to a new room while in a 1-on-1 or group chat with
    // roster characters, those companions follow them.
    function notifyPlayerMovedTo(newLocationId) {
        if (!isRoomLocationId(newLocationId)) return;
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return;

        const namesInChat = [];
        if (ctx.groupId) {
            const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(g => String(g.id) === String(ctx.groupId));
            if (group?.members && Array.isArray(ctx.characters)) {
                for (const avatar of group.members) {
                    const c = ctx.characters.find(x => x?.avatar === avatar);
                    if (c?.name) namesInChat.push(c.name);
                }
            }
        } else if (ctx.name2 && ctx.name2 !== "Assistant") {
            namesInChat.push(ctx.name2);
        }

        if (!namesInChat.length) return;
        const state = getState();
        let changed = false;
        for (const name of namesInChat) {
            const key = normalizeName(name);
            if (!characters.has(key)) continue;
            const entry = state.characters[key] ??= { locationId: null, groupId: null };
            if (entry.locationId !== newLocationId) {
                entry.locationId = newLocationId;
                entry.groupId = null;
                changed = true;
            }
        }
        if (changed) { saveState(); notifySceneChanged(); }
    }

    // ── Visibility predicate ─────────────────────────────────────────────────
    // Render modes:
    //   "scene"      — full overworld with sprites + Talk-to-room button
    //   "chat-exit"  — root visible but contains only an "Exit Conversation"
    //                  button (no sprites, no click-boxes). Used during any
    //                  real solo or group chat.
    //   "hidden"     — root torn down entirely.
    const SYSTEM_CHAT_NAME_SUBSTRINGS = [
        "narrator",
        "sillytavern system",
        "prome user sprite",
    ];
    function getRenderMode() {
        if (isFadingOutForChat) return "scene"; // keep showing during fade-out
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return "hidden";
        if (!isInCharacterChat()) return "scene"; // Assistant / temp = not in chat
        if (ctx.groupId) return "chat-exit"; // every group chat = real chat
        const activeName = ctx.name2 || null;
        if (!activeName) return "hidden";
        const lc = String(activeName).toLowerCase();
        if (SYSTEM_CHAT_NAME_SUBSTRINGS.some(s => lc.includes(s))) return "scene";
        return "chat-exit";
    }
    // Kept for back-compat with the controller's internal early-return paths.
    function shouldRender() { return getRenderMode() !== "hidden"; }

    function getDomRoot() { return document.getElementById(ROOT_ID); }

    // Mirror the current render mode to a body class so other extensions'
    // overlays (e.g. Prome user sprite at #expression-prome-user) can be
    // hidden via CSS while the overworld scene is showing.
    function setBodyMode(mode) {
        const body = document.body;
        if (!body) return;
        body.classList.toggle("dangan-ow-scene-active", mode === "scene");
        body.classList.toggle("dangan-ow-chat-exit-active", mode === "chat-exit");
    }

    function removeRoot() {
        const root = getDomRoot();
        if (root) root.remove();
        setBodyMode("hidden");
        teardownCursor();
    }

    function scheduleRender() {
        // Don't disturb the bouncing sprites mid-transition — the click handler
        // tears the DOM down once the fade completes.
        if (isFadingOutForChat) return;
        // Always refresh roster locations — even when sprites are hidden
        // (in-chat), the minimap still draws pins from this state.
        try { ensureCharacterLocations(); } catch (e) { debug("ensure failed", e); }
        const myToken = ++renderToken;
        Promise.resolve().then(() => {
            if (myToken !== renderToken) return;
            render();
        });
    }

    async function render() {
        if (isFadingOutForChat) return;
        const mode = getRenderMode();
        if (mode === "hidden") { debug("hide: mode=hidden"); removeRoot(); return; }
        ensureCharacterLocations();

        if (mode === "chat-exit") {
            // In-chat overlay: Exit Conversation + Grab Group Members buttons.
            // No sprites, no click-boxes, no Talk-to-Room.
            setBodyMode("chat-exit");
            const root = getDomRoot() || document.createElement("div");
            root.id = ROOT_ID;
            root.classList.remove("dangan-ow-flat");
            root.innerHTML = "";

            const exitBtn = document.createElement("button");
            exitBtn.type = "button";
            exitBtn.className = "dangan-ow-room-btn";
            const label = document.createElement("span");
            label.className = "dangan-ow-room-btn-label";
            label.textContent = "Exit conversation";
            exitBtn.appendChild(label);
            exitBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                onExitChatClick();
            });
            root.appendChild(exitBtn);

            root.appendChild(buildGrabGroupMembersBtn());

            if (!getDomRoot()) document.body.appendChild(root);
            return;
        }

        const playerRoom = getCurrentLocationId();
        if (!isRoomLocationId(playerRoom)) {
            debug("hide: invalid player room id", playerRoom);
            removeRoot();
            return;
        }

        const state = getState();
        const charsHere = [];
        for (const key of getActiveRosterKeys()) {
            const entry = state.characters[key];
            if (entry?.locationId !== playerRoom) continue;
            const char = getRosterCharByKey(key);
            if (!char?.name) continue;
            charsHere.push({ key, char, entry });
        }

        debug(`room=${playerRoom} rosterTotal=${getActiveRosterKeys().length} inRoom=${charsHere.length}`);
        if (!charsHere.length) { removeRoot(); return; }

        const myToken = renderToken;

        const flatMode = isRoomFlat(playerRoom);
        setBodyMode("scene");

        const root = getDomRoot() || document.createElement("div");
        root.id = ROOT_ID;
        root.classList.toggle("dangan-ow-flat", flatMode);
        root.innerHTML = "";

        // Bucket by spawn-group (solos use a synthetic per-character group).
        const buckets = new Map();
        for (const entry of charsHere) {
            const gid = entry.entry.groupId || `solo:${entry.key}`;
            if (!buckets.has(gid)) buckets.set(gid, []);
            buckets.get(gid).push(entry);
        }
        const groupList = [...buckets.entries()];

        // Resolve sprite URLs in parallel — render skips characters with no sprite.
        // Each character picks a random expression from their available sprite
        // set on first encounter and keeps it until randomizeLocations clears
        // it. getSpriteUrl falls back to neutral if the label has no sprite.
        // Class-trial-only poses are excluded from the random pool (and any
        // previously-saved expression matching them is re-picked).
        const OW_EXCLUDED_EXPRESSIONS = new Set(["mugshot", "interjection", "panictalkaction"]);
        let expressionDirty = false;
        const resolved = await Promise.all(groupList.map(async ([gid, members]) => {
            const sprites = await Promise.all(members.map(async (m) => {
                let expression = m.entry?.expression;
                if (expression && OW_EXCLUDED_EXPRESSIONS.has(String(expression).toLowerCase())) {
                    expression = null;
                }
                if (!expression && typeof getAvailableExpressionLabels === "function") {
                    const labels = (await getAvailableExpressionLabels(m.char.name).catch(() => []))
                        .filter(l => !OW_EXCLUDED_EXPRESSIONS.has(String(l).toLowerCase()));
                    expression = labels.length ? pickRandom(labels) : "neutral";
                    if (m.entry) {
                        m.entry.expression = expression;
                        expressionDirty = true;
                    }
                }
                const url = await getSpriteUrl(m.char.name, expression || "neutral").catch(() => null);
                return url ? { ...m, spriteUrl: url, expression: expression || "neutral" } : null;
            }));
            return { gid, members: sprites.filter(Boolean) };
        }));
        if (expressionDirty) saveState();
        if (myToken !== renderToken) return;
        const renderable = resolved.filter(g => g.members.length > 0);
        debug(`resolved sprite groups=${renderable.length} (of ${groupList.length})`);
        if (!renderable.length) { removeRoot(); return; }

        // Distribute groups horizontally across the viewport.
        const groupStrip = document.createElement("div");
        groupStrip.className = "dangan-ow-strip";
        for (const group of renderable) {
            const isMulti = group.members.length > 1;
            const groupEl = document.createElement("div");
            groupEl.className = `dangan-ow-group${isMulti ? " is-multi" : " is-solo"}`;
            groupEl.dataset.gid = group.gid;
            // All cluster members share one vertical offset; derive the
            // perspective scale from it (higher up = smaller). Group members
            // therefore render at identical scale × heightScale. When the
            // room is in flat mode, ignore the offset entirely.
            const offsetVh = flatMode ? 0 : (() => {
                for (const m of group.members) {
                    const v = m.entry?.verticalOffsetVh;
                    if (typeof v === "number") return v;
                }
                return 0;
            })();
            const perspectiveScale = flatMode ? 1 : scaleFromVerticalOffset(offsetVh);
            groupEl.style.setProperty("--ow-vert-offset", `${offsetVh}vh`);
            for (const m of group.members) {
                const heightCm = getCharacterHeightCm(m.char.name);
                // Exaggerate the spread: raw (cm/170) only swings ~0.76-1.17
                // across the full Danganronpa cast (130cm Hiyoko to 198cm
                // Nidai), which reads as nearly flat. Multiply the deviation
                // from the 170cm pivot by 1.8 so the cast visibly tiers.
                const heightScale = (() => {
                    if (!heightCm) return 1;
                    const baseRatio = heightCm / 170;
                    const exaggerated = 1 + (baseRatio - 1) * 1.8;
                    return Math.min(1.55, Math.max(0.45, exaggerated));
                })();
                const finalScale = heightScale * perspectiveScale;

                const spriteEl = document.createElement("div");
                spriteEl.className = "dangan-ow-sprite";
                spriteEl.dataset.name = m.char.name;
                spriteEl.dataset.key = m.key;
                spriteEl.style.setProperty("--ow-scale", String(finalScale));
                // Encode quotes so the URL is safe inside a CSS `url("…")` token.
                spriteEl.style.setProperty(
                    "--ow-sprite-url",
                    `url("${m.spriteUrl.replace(/"/g, "%22")}")`,
                );

                const shadow = document.createElement("div");
                shadow.className = "dangan-ow-shadow";
                spriteEl.appendChild(shadow);

                const ghost = document.createElement("div");
                ghost.className = "dangan-ow-sprite-ghost";
                spriteEl.appendChild(ghost);

                const img = document.createElement("img");
                img.className = "dangan-ow-sprite-img";
                img.src = m.spriteUrl;
                img.alt = m.char.name;
                img.draggable = false;
                img.addEventListener("error", () => { spriteEl.style.display = "none"; });
                spriteEl.appendChild(img);

                spriteEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    playOwSfx("character_click");
                    // Drop the cursor instantly — once a click is committed it
                    // shouldn't linger over the bouncing sprite.
                    cursorActiveHoverCount = 0;
                    hideCursor();
                    if (isMulti) onGroupClick(group);
                    else onSoloClick(m);
                });

                groupEl.appendChild(spriteEl);
            }
            // Hover FX (cursor + hover sfx) is bound at the GROUP level so that
            // moving the mouse between sprites in the same cluster reads as a
            // single hover. For solos this is still just one sprite, so the
            // behavior is identical there.
            attachSpriteHoverFx(groupEl);
            groupStrip.appendChild(groupEl);
        }
        root.appendChild(groupStrip);

        // "Talk to the room" button — shown when 2+ characters share the room
        // across all spawn-groups. The Grab Group Members button sits under it.
        const total = renderable.reduce((a, g) => a + g.members.length, 0);
        if (total >= 2) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dangan-ow-room-btn";
            const label = document.createElement("span");
            label.className = "dangan-ow-room-btn-label";
            label.textContent = "Talk to the room";
            btn.appendChild(label);
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                onRoomClick(renderable);
            });
            root.appendChild(btn);

            root.appendChild(buildGrabGroupMembersBtn());
        }

        if (!getDomRoot()) document.body.appendChild(root);
    }

    // ── Click handlers ───────────────────────────────────────────────────────

    function bounceThenFade(targets, after) {
        if (!targets || !targets.length) return after?.();
        // Suppress any incidental BGM pauses for the whole bounce + chat-load
        // window. 950ms bounce + ~1500ms of ST chat-load chatter = 2500ms.
        try { armBgmTransitionGuard?.(2500); } catch (_) {}
        for (const el of targets) {
            el.classList.remove("dangan-ow-bounce");
            // force reflow so the animation restarts cleanly
            void el.offsetWidth;
            el.classList.add("dangan-ow-bounce");
        }
        const fade = document.createElement("div");
        fade.className = "dangan-ow-fadeout";
        document.body.appendChild(fade);
        // Bounce duration matches keyframes (0.9s); fade overlaps the tail.
        // body.dangan-ow-fading drives a CSS opacity fade on the MOVE TO
        // panel + minimap so they're not visible during the black wash.
        setTimeout(() => {
            fade.classList.add("on");
            document.body.classList.add("dangan-ow-fading");
            playOwSfx("character_enter_talk");
        }, 750);
        setTimeout(() => {
            after?.();
            setTimeout(() => fade.classList.remove("on"), 350);
            setTimeout(() => {
                fade.remove();
                document.body.classList.remove("dangan-ow-fading");
            }, 950);
        }, 950);
    }

    // CHAT_CHANGED fires during the fade-out while `isFadingOutForChat` is
    // true, so the scheduled re-render is skipped. We have to manually
    // refresh after the flag flips back so the new mode (chat-exit / scene)
    // takes effect on the DOM.
    function finishChatTransition() {
        isFadingOutForChat = false;
        scheduleRender();
    }

    async function onSoloClick(member) {
        if (isFadingOutForChat) return;
        isFadingOutForChat = true;
        const root = getDomRoot();
        const targets = root ? [...root.querySelectorAll(`.dangan-ow-sprite[data-key="${CSS.escape(member.key)}"]`)] : [];
        const expression = member.expression || member.entry?.expression || "neutral";
        bounceThenFade(targets, async () => {
            try {
                await executeSlashCommands(`/go ${member.char.name}`);
                // Carry the overworld sprite into the solo chat. /sprite targets
                // the current (just-opened) character. Skip neutral since that's
                // what ST defaults to.
                if (expression && expression !== "neutral") {
                    try { await executeSlashCommands(`/sprite ${expression}`); }
                    catch (err) { console.warn("[Dangan][Overworld] /sprite carry-over failed:", err); }
                }
            } catch (err) {
                console.warn("[Dangan][Overworld] /go failed for solo:", err);
            }
            finishChatTransition();
        });
    }

    async function onGroupClick(group) {
        if (isFadingOutForChat) return;
        isFadingOutForChat = true;
        const root = getDomRoot();
        const names = group.members.map(m => m.char.name);
        const targets = root ? [...root.querySelectorAll(`.dangan-ow-group[data-gid="${CSS.escape(group.gid)}"] .dangan-ow-sprite`)] : [];
        bounceThenFade(targets, async () => {
            try { await enterOrCreateGroupChat(names); }
            catch (err) { console.warn("[Dangan][Overworld] group chat entry failed:", err); }
            applyGroupChatExpressions(group.members);
            finishChatTransition();
        });
    }

    async function onExitChatClick() {
        if (isFadingOutForChat) return;
        isFadingOutForChat = true;
        // Suppress incidental BGM pauses across the closechat + re-render hold.
        try { armBgmTransitionGuard?.(2500); } catch (_) {}
        // Fade to black, swap chat under the cover, then fade back in.
        const fade = document.createElement("div");
        fade.className = "dangan-ow-fadeout";
        document.body.appendChild(fade);
        // double-rAF to let the element commit its starting opacity:0
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        fade.classList.add("on");
        document.body.classList.add("dangan-ow-fading");
        playOwSfx("character_exit_talk");
        await new Promise(r => setTimeout(r, 320));
        try {
            // /closechat triggers ST's "close current chat" path, which drops
            // the user back to the default Assistant / welcome state.
            await executeSlashCommands("/closechat");
        } catch (err) {
            console.warn("[Dangan][Overworld] /closechat failed:", err);
        }
        // Brief hold so the new chat layout has a frame to settle behind the
        // black before we reveal it.
        await new Promise(r => setTimeout(r, 220));

        // Render the overworld scene while still under the black wash. If we
        // let scheduleRender() fire in parallel with the fade-from-black, the
        // sprite-URL fetches usually finish a frame after the fade ends and
        // the sprites pop in — that's the "flash" the player sees. Driving
        // render() to completion here means the sprites are already mounted
        // when the black clears.
        isFadingOutForChat = false;
        try {
            await render();
        } catch (err) {
            console.warn("[Dangan][Overworld] post-exit render failed:", err);
        }

        fade.classList.remove("on");
        setTimeout(() => {
            fade.remove();
            document.body.classList.remove("dangan-ow-fading");
        }, 600);
    }

    async function onRoomClick(renderable) {
        if (isFadingOutForChat) return;
        isFadingOutForChat = true;
        const root = getDomRoot();
        const allMembers = renderable.flatMap(g => g.members);
        const allNames = allMembers.map(m => m.char.name);
        const targets = root ? [...root.querySelectorAll(".dangan-ow-sprite")] : [];
        bounceThenFade(targets, async () => {
            try { await enterOrCreateGroupChat(allNames); }
            catch (err) { console.warn("[Dangan][Overworld] room chat entry failed:", err); }
            applyGroupChatExpressions(allMembers);
            finishChatTransition();
        });
    }

    // ── Grab Group Members ───────────────────────────────────────────────────

    function buildGrabGroupMembersBtn() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dangan-ow-room-btn dangan-ow-grab-btn";
        const label = document.createElement("span");
        label.className = "dangan-ow-room-btn-label";
        label.textContent = "Grab Group Members";
        btn.appendChild(label);
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            showGrabGroupModal();
        });
        return btn;
    }

    function getCurrentChatMemberNames() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return [];
        const out = [];
        if (ctx.groupId) {
            const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(g => String(g.id) === String(ctx.groupId));
            if (group?.members && Array.isArray(ctx.characters)) {
                for (const avatar of group.members) {
                    const c = ctx.characters.find(x => x?.avatar === avatar);
                    if (c?.name) out.push(c.name);
                }
            }
        } else if (ctx.name2 && ctx.name2 !== "Assistant") {
            out.push(ctx.name2);
        }
        return out;
    }

    function showGrabGroupModal() {
        if (document.getElementById("dangan-grab-modal")) return;

        const playerRoom = getCurrentLocationId();
        const inRoom = isRoomLocationId(playerRoom)
            ? getCharactersInRoom(playerRoom)
            : [];
        const preCheck = new Set(getCurrentChatMemberNames());

        const modal = document.createElement("div");
        modal.id = "dangan-grab-modal";
        modal.className = "dangan-grab-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        const backdrop = document.createElement("div");
        backdrop.className = "dangan-grab-backdrop";
        modal.appendChild(backdrop);

        const card = document.createElement("div");
        card.className = "dangan-grab-card";
        card.setAttribute("role", "document");

        const header = document.createElement("div");
        header.className = "dangan-grab-header";
        const title = document.createElement("span");
        title.textContent = "Grab Group Members";
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "dangan-grab-close";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.textContent = "✕";
        header.appendChild(title);
        header.appendChild(closeBtn);
        card.appendChild(header);

        const body = document.createElement("div");
        body.className = "dangan-grab-body";
        if (!inRoom.length) {
            const empty = document.createElement("div");
            empty.className = "dangan-grab-empty";
            empty.textContent = "Nobody is in this room.";
            body.appendChild(empty);
        } else {
            const list = document.createElement("ul");
            list.className = "dangan-grab-list";
            for (const c of inRoom) {
                const li = document.createElement("li");
                const lbl = document.createElement("label");
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.name = c.name;
                if (preCheck.has(c.name)) cb.checked = true;
                const span = document.createElement("span");
                span.textContent = c.name;
                lbl.appendChild(cb);
                lbl.appendChild(span);
                li.appendChild(lbl);
                list.appendChild(li);
            }
            body.appendChild(list);
        }
        card.appendChild(body);

        const footer = document.createElement("div");
        footer.className = "dangan-grab-footer";
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "dangan-grab-cancel";
        cancelBtn.textContent = "Cancel";
        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "dangan-grab-confirm";
        confirmBtn.textContent = "Open Group Chat";
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        card.appendChild(footer);

        modal.appendChild(card);

        const checkboxes = () => [...modal.querySelectorAll('input[type="checkbox"]')];
        const refreshConfirm = () => {
            const n = checkboxes().filter(cb => cb.checked).length;
            confirmBtn.disabled = n < 1;
            confirmBtn.textContent = n >= 2 ? "Open Group Chat" : "Open Solo Chat";
        };
        for (const cb of checkboxes()) cb.addEventListener("change", refreshConfirm);
        refreshConfirm();

        const close = () => {
            modal.remove();
            document.removeEventListener("keydown", onKeydown);
        };
        const onKeydown = (e) => { if (e.key === "Escape") close(); };

        closeBtn.addEventListener("click", close);
        cancelBtn.addEventListener("click", close);
        backdrop.addEventListener("click", close);
        document.addEventListener("keydown", onKeydown);

        confirmBtn.addEventListener("click", async () => {
            const names = checkboxes().filter(cb => cb.checked).map(cb => cb.dataset.name);
            if (names.length < 1) return;
            close();
            await transitionToChat(names);
        });

        document.body.appendChild(modal);
    }

    // Fade-to-black, open the requested chat (solo if one name, group if 2+),
    // pre-render the scene under the black wash, then fade back in. Mirrors
    // onExitChatClick's pattern but enters a new chat instead of closing.
    async function transitionToChat(memberNames) {
        if (isFadingOutForChat) return;
        if (!Array.isArray(memberNames) || !memberNames.length) return;
        isFadingOutForChat = true;

        const fade = document.createElement("div");
        fade.className = "dangan-ow-fadeout";
        document.body.appendChild(fade);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        fade.classList.add("on");
        document.body.classList.add("dangan-ow-fading");
        await new Promise(r => setTimeout(r, 320));

        // Resolve members (with their saved expression) so the overworld pose
        // carries into the new chat — solo via /sprite, group via DOM override.
        const state = getState();
        const memberObjs = memberNames.map(name => {
            const key = normalizeName(name);
            const entry = state.characters[key] || null;
            const char = getRosterCharByKey(key) || { name };
            return { key, char, entry };
        });

        try {
            if (memberObjs.length === 1) {
                const m = memberObjs[0];
                await executeSlashCommands(`/go ${m.char.name}`);
                const expression = m.entry?.expression;
                if (expression && expression !== "neutral") {
                    try { await executeSlashCommands(`/sprite ${expression}`); }
                    catch (err) { console.warn("[Dangan][Overworld] /sprite carry-over failed:", err); }
                }
            } else {
                await enterOrCreateGroupChat(memberNames);
                applyGroupChatExpressions(memberObjs);
            }
        } catch (err) {
            console.warn("[Dangan][Overworld] grab-modal chat entry failed:", err);
        }

        await new Promise(r => setTimeout(r, 220));

        isFadingOutForChat = false;
        try {
            await render();
        } catch (err) {
            console.warn("[Dangan][Overworld] grab-modal post-entry render failed:", err);
        }

        fade.classList.remove("on");
        setTimeout(() => {
            fade.remove();
            document.body.classList.remove("dangan-ow-fading");
        }, 600);
    }

    // ST's visualNovelSetCharacterSprites takes one expression for ALL group
    // members, so we can't pass per-character sprites through it. Instead, we
    // resolve each member's sprite URL ourselves and override the matching
    // expression-holder img once ST has mounted them. The override sticks
    // until ST re-runs its expression module (e.g. on a new message), which
    // is fine for the "carry-over on entry" moment the user actually sees.
    async function applyGroupChatExpressions(members) {
        if (!Array.isArray(members) || !members.length) return;
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return;
        const allChars = Array.isArray(ctx.characters) ? ctx.characters : [];

        const items = (await Promise.all(members.map(async (m) => {
            const expression = m.expression || m.entry?.expression;
            if (!expression || expression === "neutral") return null;
            const stChar = allChars.find(c => c?.name === m.char.name);
            if (!stChar?.avatar) return null;
            const url = await getSpriteUrl(m.char.name, expression).catch(() => null);
            if (!url) return null;
            return { avatar: stChar.avatar, url };
        }))).filter(Boolean);
        if (!items.length) return;

        // Wait a beat so ST's expressions module has mounted the holders.
        await new Promise(r => setTimeout(r, 350));
        for (const { avatar, url } of items) {
            const holders = document.querySelectorAll('.expression-holder');
            for (const holder of holders) {
                if (holder.dataset.avatar !== avatar) continue;
                const img = holder.querySelector('img');
                if (img) img.src = url;
            }
        }
    }

    // ── Group chat entry / creation ──────────────────────────────────────────

    async function enterOrCreateGroupChat(memberNames) {
        console.log("[Dangan][Overworld] enterOrCreateGroupChat", memberNames);
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) { console.warn("[Dangan][Overworld] no ctx"); return; }
        const allChars = Array.isArray(ctx.characters) ? ctx.characters : [];
        console.log("[Dangan][Overworld] ctx.characters length:", allChars.length);

        // Map character names to avatar keys.
        const wantedAvatars = [];
        const missingNames = [];
        for (const name of memberNames) {
            const c = allChars.find(x => x?.name === name);
            if (c?.avatar) wantedAvatars.push(c.avatar);
            else missingNames.push(name);
        }
        console.log("[Dangan][Overworld] wantedAvatars:", wantedAvatars, "missing:", missingNames);
        if (!wantedAvatars.length) { console.warn("[Dangan][Overworld] aborting: no avatars resolved"); return; }

        const wantedSet = new Set(wantedAvatars);
        const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
        console.log("[Dangan][Overworld] total ST groups:", groups.length);

        // Try to find an existing group that matches our member set exactly.
        const match = groups.find(g => {
            const members = Array.isArray(g?.members) ? g.members : [];
            if (members.length !== wantedSet.size) return false;
            return members.every(m => wantedSet.has(m));
        });
        console.log("[Dangan][Overworld] exact-match group:", match ? `${match.name} (id=${match.id})` : "none");

        if (match) {
            // openGroupById is the only API that assigns `selected_group`,
            // which is what backs ctx.groupId. Without it, the overworld
            // stays in scene mode after the chat opens. Group names can
            // contain commas/colons that the slash parser splits on, so /go
            // is only a last-resort fallback.
            try {
                if (typeof openGroupById === "function") {
                    console.log("[Dangan][Overworld] openGroupById", match.id);
                    await openGroupById(match.id);
                    return;
                }
            } catch (err) {
                console.warn("[Dangan][Overworld] openGroupById failed; trying /go fallback:", err);
            }
            try {
                console.log("[Dangan][Overworld] fallback /go", match.name);
                await executeSlashCommands(`/go ${match.name}`);
                return;
            } catch (err) {
                console.warn("[Dangan][Overworld] /go for existing group failed:", err);
            }
        }

        // Create a new group.
        const groupName = `Overworld: ${memberNames.join(", ")}`;
        const humanize = ctx.humanizedDateTime ? ctx.humanizedDateTime() : `${Date.now()}`;
        const payload = {
            name: groupName,
            members: wantedAvatars,
            avatar_url: "img/ai4.png",
            allow_self_responses: false,
            hideMutedSprites: true,
            activation_strategy: 0,
            generation_mode: 0,
            disabled_members: [],
            fav: false,
            chat_id: humanize,
            chats: [humanize],
            auto_mode_delay: 5,
        };

        try {
            console.log("[Dangan][Overworld] creating group:", payload);
            const resp = await fetch("/api/groups/create", {
                method: "POST",
                headers: getRequestHeaders(),
                body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            console.log("[Dangan][Overworld] group created, id=", data?.id);
            // Refresh ST's character/group list so /go can resolve the new name.
            if (typeof ctx.getCharacters === "function") {
                try { await ctx.getCharacters(); } catch {}
            }
            // Tiny settle delay before entering.
            await new Promise(r => setTimeout(r, 150));
            try {
                if (typeof openGroupById === "function") {
                    console.log("[Dangan][Overworld] openGroupById new", data.id);
                    await openGroupById(data.id);
                } else {
                    console.log("[Dangan][Overworld] /go new group", groupName);
                    await executeSlashCommands(`/go ${groupName}`);
                }
            } catch (err) {
                console.warn("[Dangan][Overworld] enter-after-create failed:", err);
            }
        } catch (err) {
            console.error("[Dangan][Overworld] group creation failed:", err);
        }
    }

    // ── External hooks ───────────────────────────────────────────────────────

    function bind() {
        try {
            if (eventSource && event_types?.CHAT_CHANGED) {
                eventSource.on(event_types.CHAT_CHANGED, () => scheduleRender());
            }
        } catch (e) { console.warn("[Dangan][Overworld] failed to bind CHAT_CHANGED:", e); }

        window.addEventListener("resize", () => scheduleRender(), { passive: true });
    }

    bind();

    console.log("[Dangan][Overworld] controller initialized. Enable verbose logging with `window.dangan_overworld_debug = true` and call `window.dangan_overworld.render()` to diagnose.");

    // Snapshot of characters currently at a given room — used by the minimap
    // to draw pins for whoever the overworld is showing.
    function getCharactersInRoom(locationId) {
        if (!locationId) return [];
        const state = getState();
        const out = [];
        for (const key of getActiveRosterKeys()) {
            const entry = state.characters[key];
            if (entry?.locationId !== locationId) continue;
            const char = getRosterCharByKey(key);
            if (!char?.name) continue;
            out.push({ name: char.name, groupId: entry.groupId || null });
        }
        return out;
    }

    return {
        render: scheduleRender,
        randomizeLocations,
        notifyPlayerMovedTo,
        ensureCharacterLocations,
        getCharactersInRoom,
        isRoomFlat,
        setRoomFlat,
        toggleCurrentRoomFlat,
        destroy: removeRoot,
        // Diagnostic — call from DevTools to see why nothing is on screen.
        _diagnose() {
            const mp = getMapPanelController?.();
            const playerRoom = getCurrentLocationId();
            const validRoom = isRoomLocationId(playerRoom);
            const rosterKeys = getActiveRosterKeys();
            const state = getState();
            const inRoom = rosterKeys.filter(k => state.characters[k]?.locationId === playerRoom).map(k => characters.get(k)?.name);
            const ctx = window.SillyTavern?.getContext?.();
            const playerAF = getPlayerAreaFloor();
            const spawnable = listSpawnableRoomIds();
            const allRoomPins = (mp?.getAllPins?.() || []).filter(p => SPAWNABLE_PIN_TYPES.has(p.type));
            const charsByRoom = {};
            for (const k of rosterKeys) {
                const loc = state.characters[k]?.locationId;
                if (!loc) continue;
                (charsByRoom[loc] ??= []).push(characters.get(k)?.name);
            }
            return {
                renderMode: getRenderMode(),
                inChat: !!isInCharacterChat(),
                ctxName2: ctx?.name2 ?? null,
                ctxGroupId: ctx?.groupId ?? null,
                ctxCharacterId: ctx?.characterId ?? null,
                shouldRender: shouldRender(),
                playerRoom,
                playerAreaFloor: playerAF,
                validRoom,
                mapPanelHasController: !!mp,
                spawnableRoomCount: spawnable.length,
                spawnableRoomIds: spawnable,
                totalRoomPinsAcrossAllAreas: allRoomPins.length,
                roomPinAreaSummary: Object.entries(allRoomPins.reduce((a, p) => {
                    const k = `${p.areaKey}/${p.floorKey}`;
                    a[k] = (a[k] || 0) + 1;
                    return a;
                }, {})),
                rosterTotal: rosterKeys.length,
                rosterNames: rosterKeys.map(k => characters.get(k)?.name),
                charactersInRoom: inRoom,
                charactersByRoom: charsByRoom,
            };
        },
    };
}
