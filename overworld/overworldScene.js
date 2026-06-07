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

// Each cluster (solo or group) sits at a vertical offset that doubles as
// its perspective-scale input. The strip's CSS baseline is at `bottom: 22vh`,
// so offset 0 = feet at 78vh from viewport top.
//   offset = -22vh  → feet at viewport bottom (largest scale)
//   offset =   0vh  → feet at the strip baseline
//   offset = +28vh  → feet at viewport midpoint (smallest scale)
// Auto-layout uses [0, MAX_VERTICAL_OFFSET_VH]; Edit-Positions drag uses the
// full [MIN_VERTICAL_OFFSET_VH, MAX_VERTICAL_OFFSET_VH] range so the user can
// drag from screen-bottom up to roughly half-screen, and the perspective
// curve owns the entire range.
const MIN_VERTICAL_OFFSET_VH = -22;
const MAX_VERTICAL_OFFSET_VH = 28;
const PERSPECTIVE_SCALE_MIN = 0.35;
const PERSPECTIVE_SCALE_MAX = 0.65;
const PERSPECTIVE_FALLOFF_POWER = 2.2;

// Manual scale override applied via the ±/+ buttons in edit mode. Stacks on
// top of heightScale × perspectiveScale as a final multiplier.
const CUSTOM_SCALE_MIN = 0.3;
const CUSTOM_SCALE_MAX = 2.5;
const CUSTOM_SCALE_STEP = 0.1;
function randomVerticalOffsetVh() {
    // Auto-laid-out clusters only lift upward from the strip baseline.
    return Math.round(Math.random() * MAX_VERTICAL_OFFSET_VH * 10) / 10;
}
function scaleFromVerticalOffset(vh) {
    const span = MAX_VERTICAL_OFFSET_VH - MIN_VERTICAL_OFFSET_VH;
    const ratio = Math.max(0, Math.min(1, ((vh || 0) - MIN_VERTICAL_OFFSET_VH) / span));
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
    getCharacterDisplayName, // (name) => string — returns "???" until /introduce has been run on the character
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

    // Bind hover FX (click reticle + sfx) on the visible sprite. The cursor
    // reticle is suppressed in edit mode; instead each enter/leave drives the
    // group's edit-frame active state via the same delayed-release tracker used
    // by the frame's ± buttons + resize handle, so moving the cursor sprite ↔
    // control doesn't flicker.
    function attachSpriteHoverFx(spriteEl, groupEl) {
        spriteEl.addEventListener("mouseenter", (e) => {
            if (editMode) { markGroupHovered(groupEl); return; }
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
            if (editMode) { scheduleGroupUnhover(groupEl); return; }
            cursorActiveHoverCount = Math.max(0, cursorActiveHoverCount - 1);
            if (cursorActiveHoverCount === 0) hideCursor();
        });
    }

    // The active group's edit-frame shows its blue border + ± buttons + resize
    // handle; every other frame shows just its thin dashed boundary. Only one
    // group is active at a time.
    function setEditActiveGroup(groupEl) {
        if (activeEditGroup === groupEl) return;
        if (activeEditGroup) {
            activeEditGroup._owFrame?.classList.remove("is-active");
            // Drives the blue (vs amber) silhouette outline on the sprite.
            activeEditGroup.classList.remove("is-edit-active");
        }
        activeEditGroup = groupEl;
        if (groupEl) {
            groupEl._owFrame?.classList.add("is-active");
            groupEl.classList.add("is-edit-active");
        }
    }

    // Clicking a character SELECTS it: its frame stays active (blue) regardless
    // of the cursor, and hovering other characters becomes inert (see the lock
    // in markGroupHovered) — so an overlapping neighbour can't steal focus.
    // Passing null deselects and hands control back to plain hover.
    function setSelectedEditGroup(groupEl) {
        const prev = selectedEditGroup;
        selectedEditGroup = groupEl;
        if (groupEl) { setEditActiveGroup(groupEl); return; }
        // Deselected — revert to hover: keep the just-released group active only
        // if the cursor is still over it, otherwise clear.
        if (prev?.querySelector(".dangan-ow-sprite:hover")) setEditActiveGroup(prev);
        else setEditActiveGroup(null);
    }

    // Sprite ↔ frame-control hover tracking. The visible sprite and the frame's
    // controls live in separate DOM subtrees (the frame is in the overlay
    // layer, not inside the group), so moving the cursor sprite → button fires
    // a mouseleave then a mouseenter. A short delay before deactivating bridges
    // that transit so the controls don't flicker.
    function markGroupHovered(groupEl) {
        // While a character is selected, hovering any OTHER character is inert.
        if (selectedEditGroup && groupEl !== selectedEditGroup) return;
        if (groupEl._owHoverLeaveTimer) {
            clearTimeout(groupEl._owHoverLeaveTimer);
            groupEl._owHoverLeaveTimer = null;
        }
        setEditActiveGroup(groupEl);
    }
    function scheduleGroupUnhover(groupEl) {
        // The locked selection never deactivates on hover-out.
        if (groupEl === selectedEditGroup) return;
        if (groupEl._owHoverLeaveTimer) clearTimeout(groupEl._owHoverLeaveTimer);
        // A generous delay covers slow cursor transit between the sprite and the
        // frame's controls; the recheck inside means a fast user pays nothing.
        groupEl._owHoverLeaveTimer = setTimeout(() => {
            groupEl._owHoverLeaveTimer = null;
            // Keep active if the cursor actually landed on the sprite or a frame
            // control, or while a drag/resize on this group is still in flight.
            const onSprite = groupEl.querySelector(".dangan-ow-sprite:hover");
            const onFrame = groupEl._owFrame?.querySelector(":hover");
            const busy = dragState?.groupEl === groupEl || resizeState?.groupEl === groupEl;
            if (onSprite || onFrame || busy) return;
            if (activeEditGroup === groupEl) setEditActiveGroup(null);
        }, 280);
    }
    function attachGroupHoverTracking(el, groupEl) {
        el.addEventListener("mouseenter", () => markGroupHovered(groupEl));
        el.addEventListener("mouseleave", () => scheduleGroupUnhover(groupEl));
    }

    function teardownCursor() {
        cursorActiveHoverCount = 0;
        hideCursor();
        if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    }

    // ── Fit-to-viewport ──────────────────────────────────────────────────────
    // Flex layout uses each sprite's natural width (driven by img height:75vh +
    // width:auto). transform:scale on sprites doesn't affect layout, so when
    // several spawn-groups crowd one room their combined natural widths exceed
    // the viewport and the outermost characters render off-screen.
    //
    // Two-stage response:
    //   1. --ow-fit on the strip scales the img/ghost height, which IS what flex
    //      measures — the layout reflows. Three passes converge because fixed
    //      gap/padding/group-margin pixels don't scale with --ow-fit.
    //   2. Once we know how much we had to shrink, lift every group toward the
    //      top of the strip proportionally. The existing perspective system
    //      maps higher offset → smaller scale, so crowded rooms read as a
    //      "background" of small, distant characters rather than a clipped row
    //      of half-sized ones glued to the floor.
    // Measure how much the flex LAYOUT overflows the strip. We can't use
    // getBoundingClientRect on .dangan-ow-sprite because that returns the
    // POST-transform (visual) box — each sprite already has a perspective
    // transform: scale that shrinks the visual, so its visual right edge
    // can look fine even when the layout box extends far past the viewport.
    // scrollWidth, however, reflects the pre-transform layout content and is
    // clamped to ≥ clientWidth — so scrollWidth > clientWidth iff overflow.
    function measureStripBounds(strip) {
        const layoutWidth = strip.scrollWidth;
        const containerWidth = strip.clientWidth;
        if (!layoutWidth || !containerWidth) return null;
        return { layoutWidth, containerWidth };
    }

    function applyGroupLifts(strip, flatMode, liftFactor) {
        for (const groupEl of strip.querySelectorAll(".dangan-ow-group")) {
            // Manually-positioned or manually-scaled groups own their state —
            // the auto crowd-lift must not yank them around.
            if (groupEl.classList.contains("is-positioned")) continue;
            if (groupEl.classList.contains("has-custom-scale")) continue;
            const baseOffset = parseFloat(groupEl.dataset.baseOffsetVh) || 0;
            const offset = flatMode
                ? 0
                : Math.min(MAX_VERTICAL_OFFSET_VH, baseOffset + (MAX_VERTICAL_OFFSET_VH - baseOffset) * liftFactor);
            const perspective = flatMode ? 1 : scaleFromVerticalOffset(offset);
            groupEl.style.setProperty("--ow-vert-offset", `${offset}vh`);
            for (const spriteEl of groupEl.querySelectorAll(".dangan-ow-sprite")) {
                const hs = parseFloat(spriteEl.dataset.heightScale) || 1;
                spriteEl.style.setProperty("--ow-scale", String(hs * perspective));
            }
        }
    }

    async function fitCrowdedRoomToViewport(strip, flatMode, isStale) {
        if (!strip) return;
        // Reset prior crowd adjustments so we measure intrinsic layout.
        strip.style.removeProperty("--ow-fit");
        applyGroupLifts(strip, flatMode, 0);

        // Stage 1: --ow-fit reflow until layoutWidth fits the container.
        // Up to 5 passes — gap/padding/group-margin are fixed px and don't
        // scale with --ow-fit, so a pure ratio shrink under-shrinks by the
        // fixed fraction; the 0.92 factor closes that gap so we converge in
        // 2-3 passes instead of asymptotically approaching the target.
        for (let pass = 0; pass < 5; pass++) {
            await new Promise(r => requestAnimationFrame(r));
            if (isStale?.()) return;
            const m = measureStripBounds(strip);
            if (!m) return;
            if (m.layoutWidth <= m.containerWidth) break;
            const currentFit = parseFloat(strip.style.getPropertyValue("--ow-fit")) || 1;
            const ratio = m.containerWidth / m.layoutWidth;
            const newFit = Math.max(0.2, currentFit * ratio * 0.92);
            strip.style.setProperty("--ow-fit", String(newFit));
        }

        // Stage 2: proportional crowd-lift if we had to shrink. Skip in flat
        // mode (per-room user setting that explicitly disables perspective).
        if (flatMode) return;
        const finalFit = parseFloat(strip.style.getPropertyValue("--ow-fit")) || 1;
        if (finalFit >= 0.99) return;
        // Map shrink amount (1 - fit) to a lift factor in [0, 1]. A 30%
        // shrink → ~36% lift toward the top; a 50% shrink → ~60%; clamp to 1.
        const liftFactor = Math.min(1, (1 - finalFit) * 1.2);
        applyGroupLifts(strip, flatMode, liftFactor);
    }

    async function fitStripWhenImagesReady(strip, flatMode, isStale) {
        if (!strip) return;
        const imgs = [...strip.querySelectorAll(".dangan-ow-sprite-img")];
        await Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(resolve => {
                const onDone = () => {
                    img.removeEventListener("load", onDone);
                    img.removeEventListener("error", onDone);
                    resolve();
                };
                img.addEventListener("load", onDone);
                img.addEventListener("error", onDone);
            });
        }));
        if (isStale?.()) return;
        await fitCrowdedRoomToViewport(strip, flatMode, isStale);
    }

    // ── Edit Character Positions ─────────────────────────────────────────────
    // Toggle: click "Edit Character Positions" → drag any group around the
    // room. Drag-Y maps to verticalOffsetVh, which feeds the existing
    // scaleFromVerticalOffset() perspective curve (lower on screen = bigger,
    // higher on screen = smaller). Click the button again to persist customX
    // and verticalOffsetVh onto each member's state entry.
    let editMode = false;
    let dragState = null;
    let resizeState = null;
    // The group whose edit-frame currently shows its controls (hovered or being
    // dragged/resized). Drives .is-active on the frame and the 1/2 keyboard
    // shortcuts — we can't lean on CSS :hover anymore because the group box is
    // pointer-events: none in edit mode (events land on the visible sprite).
    let activeEditGroup = null;
    // The clicked/locked character. While set, its frame stays blue and hover
    // on other characters is ignored. Click it again (or click another) to
    // change. Cleared on exit / re-render.
    let selectedEditGroup = null;
    let editOverlayEl = null;
    // Strip is positioned at bottom: 22vh. Drag-Y math anchors against this.
    const STRIP_BOTTOM_VH = 22;

    // ── Edit-mode overlay frames ─────────────────────────────────────────────
    // Each on-stage group gets a dashed selection frame drawn in the overlay
    // layer. Crucially the frame is sized from the group's VISIBLE bounds
    // (getBoundingClientRect on its sprites — already the post-transform box,
    // see measureStripBounds) rather than the group's 75vh layout box, so the
    // boundary hugs the character instead of stretching to the top of the
    // window. Controls (± buttons + resize handle) live on the frame and reveal
    // when the group is active.

    // Union of a group's visible sprite rects, in viewport coordinates.
    function groupVisibleRect(groupEl) {
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const spriteEl of groupEl.querySelectorAll(".dangan-ow-sprite")) {
            const k = spriteEl.getBoundingClientRect();
            if (k.width === 0 && k.height === 0) continue;
            if (k.left < l) l = k.left;
            if (k.top < t) t = k.top;
            if (k.right > r) r = k.right;
            if (k.bottom > b) b = k.bottom;
        }
        if (!isFinite(l)) return null;
        return { left: l, top: t, width: r - l, height: b - t };
    }

    function positionFrame(groupEl) {
        const frame = groupEl._owFrame;
        if (!frame) return;
        const rect = groupVisibleRect(groupEl);
        if (!rect) { frame.style.display = "none"; return; }
        frame.style.display = "";
        frame.style.left = `${rect.left}px`;
        frame.style.top = `${rect.top}px`;
        frame.style.width = `${rect.width}px`;
        frame.style.height = `${rect.height}px`;
    }

    // Reposition all frames, or just one (passed during drag/resize so we don't
    // walk every sprite on the stage on each mousemove).
    function layoutEditFrames(onlyGroupEl) {
        if (!editMode) return;
        if (onlyGroupEl) { positionFrame(onlyGroupEl); return; }
        const root = getDomRoot();
        if (!root) return;
        for (const groupEl of root.querySelectorAll(".dangan-ow-group")) positionFrame(groupEl);
    }

    function onEditViewportChange() { layoutEditFrames(); }

    function buildFrameControls(groupEl, frame) {
        const mk = (cls, txt, dir) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `dangan-ow-scale-btn ${cls}`;
            btn.textContent = txt;
            // mousedown stopProp so the click doesn't start a group drag.
            btn.addEventListener("mousedown", (e) => e.stopPropagation());
            btn.addEventListener("click", (e) => { e.stopPropagation(); onScaleBtnClick(groupEl, dir); });
            attachGroupHoverTracking(btn, groupEl);
            frame.appendChild(btn);
        };
        mk("dangan-ow-scale-minus", "−", -1);
        mk("dangan-ow-scale-plus", "+", +1);

        const handle = document.createElement("div");
        handle.className = "dangan-ow-resize-handle";
        handle.title = "Drag to resize";
        handle.addEventListener("mousedown", (e) => onResizeStart(e, groupEl));
        attachGroupHoverTracking(handle, groupEl);
        frame.appendChild(handle);
    }

    function mountEditOverlay() {
        const root = getDomRoot();
        if (!root) return;
        unmountEditOverlay();
        const overlay = document.createElement("div");
        overlay.className = "dangan-ow-edit-overlay";
        for (const groupEl of root.querySelectorAll(".dangan-ow-group")) {
            const frame = document.createElement("div");
            frame.className = "dangan-ow-frame";
            groupEl._owFrame = frame;
            buildFrameControls(groupEl, frame);
            overlay.appendChild(frame);
        }
        root.appendChild(overlay);
        editOverlayEl = overlay;
        layoutEditFrames();
        window.addEventListener("resize", onEditViewportChange, { passive: true });
    }

    function unmountEditOverlay() {
        window.removeEventListener("resize", onEditViewportChange, { passive: true });
        const root = getDomRoot();
        if (root) {
            for (const groupEl of root.querySelectorAll(".dangan-ow-group")) {
                if (groupEl._owHoverLeaveTimer) {
                    clearTimeout(groupEl._owHoverLeaveTimer);
                    groupEl._owHoverLeaveTimer = null;
                }
                groupEl._owFrame = null;
            }
        }
        if (editOverlayEl) { editOverlayEl.remove(); editOverlayEl = null; }
        selectedEditGroup = null;
        setEditActiveGroup(null);
    }

    function setGroupVerticalOffsetLive(groupEl, offsetVh) {
        const perspective = scaleFromVerticalOffset(offsetVh);
        const customScale = parseFloat(groupEl.dataset.customScale) || 1;
        groupEl.style.setProperty("--ow-vert-offset", `${offsetVh}vh`);
        for (const spriteEl of groupEl.querySelectorAll(".dangan-ow-sprite")) {
            const hs = parseFloat(spriteEl.dataset.heightScale) || 1;
            spriteEl.style.setProperty("--ow-scale", String(hs * perspective * customScale));
        }
    }

    function applyGroupCustomScale(groupEl, customScale) {
        const cssOffset = groupEl.style.getPropertyValue("--ow-vert-offset");
        const offsetVh = parseFloat(cssOffset) || 0;
        const flatMode = !!getDomRoot()?.classList.contains("dangan-ow-flat");
        const perspective = flatMode ? 1 : scaleFromVerticalOffset(offsetVh);
        for (const spriteEl of groupEl.querySelectorAll(".dangan-ow-sprite")) {
            const hs = parseFloat(spriteEl.dataset.heightScale) || 1;
            spriteEl.style.setProperty("--ow-scale", String(hs * perspective * customScale));
        }
    }

    function onScaleBtnClick(groupEl, direction) {
        if (!editMode) return;
        const current = parseFloat(groupEl.dataset.customScale) || 1;
        const next = Math.max(CUSTOM_SCALE_MIN, Math.min(CUSTOM_SCALE_MAX,
            current + direction * CUSTOM_SCALE_STEP));
        // Round to 2 decimals so dataset stays clean across many clicks.
        const rounded = Math.round(next * 100) / 100;
        groupEl.dataset.customScale = String(rounded);
        groupEl.classList.add("has-custom-scale");
        applyGroupCustomScale(groupEl, rounded);
        layoutEditFrames(groupEl);
    }

    // ── Resize handle (smooth scale) ─────────────────────────────────────────
    // Dragging the frame's bottom-right handle scales the group continuously.
    // Scale tracks the pointer's distance from the group's feet-anchor relative
    // to where the drag started, so grabbing the handle never makes the sprite
    // jump.
    function onResizeStart(e, groupEl) {
        if (!editMode || resizeState) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = groupVisibleRect(groupEl);
        if (!rect) return;
        const anchorX = rect.left + rect.width / 2;
        const anchorY = rect.top + rect.height; // feet (transform-origin bottom)
        resizeState = {
            groupEl,
            anchorX,
            anchorY,
            startDist: Math.max(1, Math.hypot(e.clientX - anchorX, e.clientY - anchorY)),
            startScale: parseFloat(groupEl.dataset.customScale) || 1,
            moved: false,
        };
        markGroupHovered(groupEl);
        window.addEventListener("mousemove", onResizeMove);
        window.addEventListener("mouseup", onResizeEnd);
    }

    function onResizeMove(e) {
        if (!resizeState) return;
        const { groupEl, anchorX, anchorY, startDist, startScale } = resizeState;
        if (!groupEl.isConnected) { onResizeEnd(); return; }
        const dist = Math.hypot(e.clientX - anchorX, e.clientY - anchorY);
        const next = Math.max(CUSTOM_SCALE_MIN, Math.min(CUSTOM_SCALE_MAX,
            startScale * (dist / startDist)));
        const rounded = Math.round(next * 100) / 100;
        groupEl.dataset.customScale = String(rounded);
        groupEl.classList.add("has-custom-scale");
        applyGroupCustomScale(groupEl, rounded);
        layoutEditFrames(groupEl);
        resizeState.moved = true;
    }

    function onResizeEnd() {
        window.removeEventListener("mousemove", onResizeMove);
        window.removeEventListener("mouseup", onResizeEnd);
        resizeState = null;
    }

    function onGroupDragStart(e) {
        if (!editMode || dragState) return;
        // Ignore right-clicks etc.
        if (e.button !== 0) return;
        // Bound on the sprite — walk up to the actual draggable group. The
        // group is what we move (and its members move with it).
        const groupEl = e.currentTarget.closest(".dangan-ow-group");
        if (!groupEl) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = groupEl.getBoundingClientRect();
        dragState = {
            groupEl,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startCenterX: rect.left + rect.width / 2,
            startFeetY: rect.bottom,
            moved: false,
            lastCustomX: null,
            lastOffsetVh: null,
        };
        // Pressing a character lights its frame immediately (bypasses the hover
        // lock — this is an explicit interaction). Selection is finalised on
        // mouseup so we can tell a click apart from a drag.
        setEditActiveGroup(groupEl);
        window.addEventListener("mousemove", onGroupDragMove);
        window.addEventListener("mouseup", onGroupDragEnd);
    }

    function onGroupDragMove(e) {
        if (!dragState) return;
        if (!dragState.groupEl.isConnected) { dragState = null; return; }
        const dx = e.clientX - dragState.startMouseX;
        const dy = e.clientY - dragState.startMouseY;
        if (!dragState.moved) {
            if (Math.abs(dx) + Math.abs(dy) < 4) return;
            dragState.moved = true;
            // Convert to absolute positioning, seeded with the group's
            // pre-drag visual center so the sprite doesn't jump.
            const seedCustomX = dragState.startCenterX / window.innerWidth;
            dragState.groupEl.style.setProperty("--ow-custom-x", String(seedCustomX));
            dragState.groupEl.classList.add("is-positioned");
        }
        const newCenterX = dragState.startCenterX + dx;
        const newFeetY = dragState.startFeetY + dy;
        const customX = Math.max(0, Math.min(1, newCenterX / window.innerWidth));
        // Strip's bottom edge in viewport-pixel space (top-left origin).
        const stripBottomY = window.innerHeight * (1 - STRIP_BOTTOM_VH / 100);
        const offsetPx = stripBottomY - newFeetY;
        // Allow the full drag range: negative offsets push feet below the
        // strip baseline (toward viewport bottom = biggest); positive offsets
        // lift feet upward (toward viewport mid = smallest).
        const offsetVh = Math.max(MIN_VERTICAL_OFFSET_VH, Math.min(
            MAX_VERTICAL_OFFSET_VH,
            (offsetPx / window.innerHeight) * 100,
        ));
        dragState.groupEl.style.setProperty("--ow-custom-x", String(customX));
        setGroupVerticalOffsetLive(dragState.groupEl, offsetVh);
        layoutEditFrames(dragState.groupEl);
        dragState.lastCustomX = customX;
        dragState.lastOffsetVh = offsetVh;
    }

    function onGroupDragEnd() {
        window.removeEventListener("mousemove", onGroupDragMove);
        window.removeEventListener("mouseup", onGroupDragEnd);
        const groupEl = dragState?.groupEl;
        if (dragState?.moved && dragState.lastCustomX != null) {
            // Stash final values on the DOM node — they're read off at save.
            groupEl.dataset.customX = String(dragState.lastCustomX);
            groupEl.dataset.customVertOffsetVh = String(dragState.lastOffsetVh);
            // A drag keeps the dragged character selected.
            setSelectedEditGroup(groupEl);
        } else if (groupEl) {
            // A click (press without drag) toggles selection: select this
            // character, or deselect it if it was already the selected one.
            setSelectedEditGroup(selectedEditGroup === groupEl ? null : groupEl);
        }
        dragState = null;
    }

    function updateEditButtonLabel() {
        const root = getDomRoot();
        if (!root) return;
        const label = root.querySelector(".dangan-ow-edit-btn .dangan-ow-room-btn-label");
        if (label) label.textContent = editMode ? "Save Character Positions" : "Edit Character Positions";
    }

    function enterEditMode() {
        if (editMode) return;
        editMode = true;
        document.body.classList.add("dangan-ow-edit-mode");
        // Tear the hover cursor down if it's showing — edit mode replaces
        // the click-reticle with the OS move cursor.
        try { teardownCursor(); } catch (_) {}
        mountEditOverlay();
        updateEditButtonLabel();
    }

    function commitEditPositionsToState() {
        const root = getDomRoot();
        if (!root) return;
        const state = getState();
        let touched = false;
        // Walk every group the user touched this session — could be drag
        // (.is-positioned), manual scale (.has-custom-scale), or both.
        const groups = root.querySelectorAll(
            ".dangan-ow-group.is-positioned, .dangan-ow-group.has-custom-scale",
        );
        for (const groupEl of groups) {
            const cxStr = groupEl.dataset.customX;
            const voStr = groupEl.dataset.customVertOffsetVh;
            const csStr = groupEl.dataset.customScale;
            const customX = cxStr != null && cxStr !== "" ? parseFloat(cxStr) : NaN;
            const offsetVh = voStr != null && voStr !== "" ? parseFloat(voStr) : NaN;
            const customScale = csStr != null && csStr !== "" ? parseFloat(csStr) : NaN;
            // Skip groups whose dataset is empty — i.e. they were on the page
            // already-customized but no edit happened in this session.
            if (!isFinite(customX) && !isFinite(customScale)) continue;
            const memberKeys = [...groupEl.querySelectorAll(".dangan-ow-sprite")]
                .map(el => el.dataset.key).filter(Boolean);
            for (const key of memberKeys) {
                const entry = state.characters[key];
                if (!entry) continue;
                if (isFinite(customX)) entry.customX = customX;
                if (isFinite(offsetVh)) entry.verticalOffsetVh = offsetVh;
                if (isFinite(customScale)) entry.customScale = customScale;
                touched = true;
            }
        }
        if (touched) { saveState(); notifySceneChanged(); }
    }

    function exitEditModeAndSave() {
        if (!editMode) return;
        // Drop any in-flight drag/resize so we don't try to write to a removed node.
        if (dragState) { onGroupDragEnd(); }
        if (resizeState) { onResizeEnd(); }
        // Flip the flag and tear the overlay down BEFORE committing — commit
        // calls notifySceneChanged(), which can trigger a re-render; with
        // editMode already false the render won't re-mount a stale overlay.
        editMode = false;
        unmountEditOverlay();
        document.body.classList.remove("dangan-ow-edit-mode");
        updateEditButtonLabel();
        commitEditPositionsToState();
    }

    function toggleEditMode() {
        if (editMode) exitEditModeAndSave();
        else enterEditMode();
    }

    function buildEditPositionsBtn(solo = false) {
        const btn = document.createElement("button");
        btn.type = "button";
        // `solo` adds a modifier class that promotes the button to the
        // Talk-to-Room slot (top:186px) when it's the only button on screen —
        // otherwise it'd sit at top:266px with empty space above it.
        btn.className = "dangan-ow-room-btn dangan-ow-edit-btn"
            + (solo ? " dangan-ow-edit-btn-solo" : "");
        const label = document.createElement("span");
        label.className = "dangan-ow-room-btn-label";
        label.textContent = editMode ? "Save Character Positions" : "Edit Character Positions";
        btn.appendChild(label);
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleEditMode();
        });
        return btn;
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
                    // Room changed — any user-placed customization from a
                    // previous room is meaningless in the new one.
                    entry.customX = null;
                    entry.customScale = null;
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
                state.characters[key].customX = null;
                state.characters[key].customScale = null;
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
            // Manual customizations were anchored to the old room — drop them
            // so the character flows back into the auto layout in their new
            // room.
            entry.customX = null;
            entry.customScale = null;
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
                entry.customX = null;
                entry.customScale = null;
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

    let scheduleRenderTimer = null;
    function scheduleRender() {
        // Don't disturb the bouncing sprites mid-transition — the click handler
        // tears the DOM down once the fade completes.
        if (isFadingOutForChat) return;
        // Always refresh roster locations — even when sprites are hidden
        // (in-chat), the minimap still draws pins from this state.
        try { ensureCharacterLocations(); } catch (e) { debug("ensure failed", e); }
        // Coalesce bursts of scheduleRender calls — multiple event listeners
        // (chat_changed, character_renamed, trial state change, minimap render
        // hook, …) all fire during page boot and each used to start its own
        // microtask-deferred render, producing visible despawn/respawn flashes
        // as render() wipes root.innerHTML upfront on every pass. A 40 ms
        // debounce collapses the whole burst into a single render at the end
        // without noticeably delaying user-triggered movement updates.
        const myToken = ++renderToken;
        if (scheduleRenderTimer) clearTimeout(scheduleRenderTimer);
        scheduleRenderTimer = setTimeout(() => {
            scheduleRenderTimer = null;
            if (myToken !== renderToken) return;
            render();
        }, 40);
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
            // Always build into a fresh detached root and swap at the end so
            // the live overworld stays on screen until the new content is
            // ready — no wipe-then-await flash.
            const root = document.createElement("div");
            root.id = ROOT_ID;

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

            const liveRoot = getDomRoot();
            if (liveRoot) liveRoot.replaceWith(root);
            else document.body.appendChild(root);
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
        // NOTE: don't bail when charsHere is empty — Call-to-the-Room is still
        // available in an empty room (summons cross-room characters from the
        // player's area). The sprite-strip rendering is gated below so it
        // only fires when there are actually characters to draw.

        const myToken = renderToken;

        const flatMode = isRoomFlat(playerRoom);
        setBodyMode("scene");

        // Build into a fresh detached root each pass — the live overworld
        // stays mounted with its existing sprites visible until the new
        // content is ready, then we atomically replace it. This avoids the
        // wipe-then-await window that produced the despawn/respawn flashes.
        const root = document.createElement("div");
        root.id = ROOT_ID;
        root.classList.toggle("dangan-ow-flat", flatMode);

        // Default empty when room is unpopulated; the sprite-strip block below
        // overwrites this with the actual rendered groups when chars are
        // present.
        let renderable = [];
        let groupStrip = null;

        if (charsHere.length > 0) {
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
        const OW_EXCLUDED_EXPRESSIONS = new Set(["mugshot", "interjection", "argumentarmament"]);
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
        renderable = resolved.filter(g => g.members.length > 0);
        debug(`resolved sprite groups=${renderable.length} (of ${groupList.length})`);

        if (renderable.length > 0) {
        // Distribute groups horizontally across the viewport.
        groupStrip = document.createElement("div");
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
            // Stamp the base offset so fitCrowdedRoomToViewport can recompute
            // a lifted offset + perspective scale without losing the seed.
            groupEl.dataset.baseOffsetVh = String(offsetVh);
            // Apply a previously-saved custom horizontal position (set via
            // Edit Character Positions). All members of a cluster share one
            // customX, so take the first one we find.
            const savedCustomX = (() => {
                for (const m of group.members) {
                    const cx = m.entry?.customX;
                    if (typeof cx === "number" && isFinite(cx)) return cx;
                }
                return null;
            })();
            if (savedCustomX != null) {
                groupEl.classList.add("is-positioned");
                groupEl.style.setProperty("--ow-custom-x", String(savedCustomX));
            }
            // Saved manual scale override (set via ±/+ buttons in edit mode).
            const savedCustomScale = (() => {
                for (const m of group.members) {
                    const cs = m.entry?.customScale;
                    if (typeof cs === "number" && isFinite(cs)) return cs;
                }
                return null;
            })();
            if (savedCustomScale != null) {
                groupEl.classList.add("has-custom-scale");
                groupEl.dataset.customScale = String(savedCustomScale);
            }
            const customScaleMul = savedCustomScale != null ? savedCustomScale : 1;
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
                const finalScale = heightScale * perspectiveScale * customScaleMul;

                const spriteEl = document.createElement("div");
                spriteEl.className = "dangan-ow-sprite";
                spriteEl.dataset.name = m.char.name;
                spriteEl.dataset.key = m.key;
                spriteEl.dataset.heightScale = String(heightScale);
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
                // alt doubles as the native browser hover tooltip — mask it as
                // "???" until /introduce has run on this character.
                img.alt = typeof getCharacterDisplayName === "function"
                    ? getCharacterDisplayName(m.char.name)
                    : m.char.name;
                img.draggable = false;
                img.addEventListener("error", () => { spriteEl.style.display = "none"; });
                spriteEl.appendChild(img);

                spriteEl.addEventListener("click", (e) => {
                    // In edit mode, clicks are reserved for drag interaction.
                    if (editMode) { e.stopPropagation(); return; }
                    e.stopPropagation();
                    playOwSfx("character_click");
                    // Drop the cursor instantly — once a click is committed it
                    // shouldn't linger over the bouncing sprite.
                    cursorActiveHoverCount = 0;
                    hideCursor();
                    if (isMulti) onGroupClick(group);
                    else onSoloClick(m);
                });

                // Drag (edit-mode only) binds on the sprite so the hit target
                // is the transformed visual box, not the group's wider layout
                // box. The handler walks up to the parent group internally.
                spriteEl.addEventListener("mousedown", onGroupDragStart);
                // Hover FX + edit-mode active state both fire on the sprite —
                // see attachSpriteHoverFx for the multi-sprite counting logic
                // that keeps the cursor / frame active state stable across
                // siblings.
                attachSpriteHoverFx(spriteEl, groupEl);

                groupEl.appendChild(spriteEl);
            }
            // The ± scale buttons + resize handle live on the edit-overlay frame
            // (built per group by mountEditOverlay), not inside the group — so
            // they're sized/placed against the visible sprite, not the 75vh box.

            groupStrip.appendChild(groupEl);
        }
        root.appendChild(groupStrip);
        } // end if (renderable.length > 0)
        } // end if (charsHere.length > 0)

        // Button visibility per population:
        //   total >= 2 → LEFT column gets Talk-to-Room (186) + Grab-Group (226)
        //   total >= 1 → RIGHT column gets Edit-Positions (226)
        //   always    → RIGHT column gets Call-to-Room (186)
        // Call always renders so the player can summon characters into an
        // empty room. Edit only when there's at least one sprite to reposition.
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
        root.appendChild(buildCallToRoomBtn());
        if (total >= 1) {
            root.appendChild(buildEditPositionsBtn());
        }

        const liveRoot = getDomRoot();
        if (liveRoot) liveRoot.replaceWith(root);
        else document.body.appendChild(root);
        // If a re-render happened mid edit-session (e.g. window resize →
        // scheduleRender), rebuild the overlay against the fresh group DOM.
        if (editMode) mountEditOverlay();
        if (groupStrip) {
            fitStripWhenImagesReady(groupStrip, flatMode, () => myToken !== renderToken)
                // Crowd-fit shifts/scales sprites asynchronously after layout;
                // re-snap the frames once it settles so they stay snug.
                .then(() => { if (editMode) layoutEditFrames(); })
                .catch(() => {});
        }
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

    function buildCallToRoomBtn() {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dangan-ow-room-btn dangan-ow-call-btn";
        const label = document.createElement("span");
        label.className = "dangan-ow-room-btn-label";
        label.textContent = "Call to Your Location";
        btn.appendChild(label);
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            showCallToRoomModal();
        });
        return btn;
    }

    // Mirror of showGrabGroupModal, but the candidate list spans every active
    // roster character in the player's area + sub-area (not just the current
    // room). Confirmed characters are warped into the player's room (location
    // updated, customX/customScale/groupId cleared) and then handed to
    // transitionToChat to open the chat with them.
    function showCallToRoomModal() {
        if (document.getElementById("dangan-grab-modal")) return;

        // Characters already in the player's current room are handled by
        // "Grab Group Members" — exclude them here so Call-to-the-Room is
        // strictly the cross-room summons list. Track the full area total
        // separately so we can distinguish "nobody anywhere" from
        // "everyone's already here" when picking the empty-state message.
        const allInArea = isRoomLocationId(getCurrentLocationId())
            ? getCharactersInPlayerArea()
            : [];
        const inArea = allInArea.filter(c => !c.isInPlayerRoom);
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
        title.textContent = "Call to Your Location";
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
        if (!inArea.length) {
            const empty = document.createElement("div");
            empty.className = "dangan-grab-empty";
            // If the area has chars but they're ALL in the current room, the
            // user has nobody left to call — surface this as a friendlier
            // "everyone's here" rather than the misleading "nobody in area".
            empty.textContent = allInArea.length > 0
                ? "Everyone's here!"
                : "Nobody is in this area.";
            body.appendChild(empty);
        } else {
            const list = document.createElement("ul");
            list.className = "dangan-grab-list";
            for (const c of inArea) {
                const li = document.createElement("li");
                const lbl = document.createElement("label");
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.name = c.name;
                if (preCheck.has(c.name)) cb.checked = true;
                const span = document.createElement("span");
                // Annotate with current room so the player can see where each
                // character is being called FROM. In-room chars get no suffix.
                span.textContent = c.isInPlayerRoom
                    ? c.name
                    : `${c.name} — ${c.roomLabel}`;
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
        confirmBtn.textContent = "Call to Location";
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        card.appendChild(footer);

        modal.appendChild(card);

        const checkboxes = () => [...modal.querySelectorAll('input[type="checkbox"]')];
        const refreshConfirm = () => {
            const n = checkboxes().filter(cb => cb.checked).length;
            confirmBtn.disabled = n < 1;
            confirmBtn.textContent = n >= 2 ? "Call to Location" : "Call to Location";
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
            // Warp the selected characters into the player's room before
            // entering the chat, so the overworld scene reflects their new
            // location once the fade clears.
            const playerRoom = getCurrentLocationId();
            if (isRoomLocationId(playerRoom)) {
                const state = getState();
                let changed = false;
                for (const name of names) {
                    const key = normalizeName(name);
                    const entry = state.characters[key];
                    if (!entry) continue;
                    if (entry.locationId !== playerRoom) {
                        entry.locationId = playerRoom;
                        entry.groupId = null;
                        entry.customX = null;
                        entry.customScale = null;
                        changed = true;
                    }
                }
                if (changed) { saveState(); notifySceneChanged(); }
            }
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

        // Debounce: browser fires `resize` continuously during a drag-resize
        // (potentially dozens of events per second). Each scheduleRender call
        // ultimately re-runs ensureCharacterLocations + a full render() pass
        // that fetches /api/sprites/get for every character on-stage. Wait
        // for the resize to settle before doing that work.
        let resizeTimer = null;
        window.addEventListener("resize", () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resizeTimer = null;
                scheduleRender();
            }, 200);
        }, { passive: true });

        // 1 / 2 keyboard shortcuts as substitutes for the − / + scale buttons.
        // Only fire in edit mode and only for the active group (the one whose
        // frame is currently showing its controls), so the user can hover a
        // sprite + tap the keys instead of clicking small buttons. We track the
        // active group in JS rather than via CSS :hover because the group box is
        // pointer-events: none in edit mode. Ignored while typing in inputs /
        // textareas / contenteditable so the chat composer isn't hijacked.
        window.addEventListener("keydown", (e) => {
            if (!editMode) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
            let direction = 0;
            if (e.key === "1") direction = -1;
            else if (e.key === "2") direction = +1;
            else return;
            if (!activeEditGroup || !activeEditGroup.isConnected) return;
            e.preventDefault();
            onScaleBtnClick(activeEditGroup, direction);
        });
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

    // Cross-room roster within the player's CURRENT area + sub-area. Powers the
    // "Call to the Room" modal — any character in the same area/floor as the
    // player is eligible to be summoned, regardless of which room they're in.
    // Each entry includes a friendly room label resolved via map-panel pins so
    // the modal can show "Hajime — Hotel Lobby" etc.
    function getCharactersInPlayerArea() {
        const playerRoom = getCurrentLocationId();
        const allowedRoomIds = new Set(listSpawnableRoomIds());
        const mp = getMapPanelController?.();
        const state = getState();
        const out = [];
        for (const key of getActiveRosterKeys()) {
            const entry = state.characters[key];
            const loc = entry?.locationId;
            if (!loc || !allowedRoomIds.has(loc)) continue;
            const char = getRosterCharByKey(key);
            if (!char?.name) continue;
            const pin = mp?.getPinByLocationId?.(loc);
            out.push({
                name: char.name,
                locationId: loc,
                roomLabel: pin?.label || loc,
                isInPlayerRoom: loc === playerRoom,
            });
        }
        // Stable sort: in-room first, then by room label, then by name. Gives
        // the modal a predictable ordering instead of roster-map iteration order.
        out.sort((a, b) => {
            if (a.isInPlayerRoom !== b.isInPlayerRoom) return a.isInPlayerRoom ? -1 : 1;
            const r = a.roomLabel.localeCompare(b.roomLabel);
            return r !== 0 ? r : a.name.localeCompare(b.name);
        });
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
