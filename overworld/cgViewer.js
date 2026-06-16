// Standalone CG viewer for the Overworld.
// ----------------------------------------
// Mirrors the Class Trial "Show CG" control (see showCgPicker / showCgOverlay in
// trial/trialManager.js): a picker built from SillyTavern's background
// thumbnails (.bg_example) plus a fullscreen overlay with optional
// sepia/grayscale filters and a dismiss button. It deliberately omits the trial
// speaker-name panel (the overworld has no active speaker) and reuses the global
// .dangan-cg-* styles defined in styles/systems/trial/trial.css, so no new CSS
// is needed for the picker/overlay themselves.

const PICKER_ID  = "dangan-cg-picker";
const OVERLAY_ID = "dangan-cg-overlay";

// Elements that must stay visible and interactive ABOVE the CG so the user can
// keep chatting with the CG as a backdrop: SillyTavern's chrome + chat shell,
// the extension HUD, and the VN dialogue box (#dangan-vn-overlay) — which is the
// "current speaker" nameplate + line in solo/group chats. Trial-only widgets are
// not listed; the overworld is hidden during Trials, which keep their own CG.
//
// #dangan-hud-topright carries the Chapter/Level area, the LVL bar AND the area
// indicator (#dangan-current-room) as children, so boosting it lifts all three.
// The overworld room buttons (Talk / Grab / Call) live inside #dangan-overworld,
// which render() replaces wholesale — those are lifted via the body.dangan-ow-cg-open
// CSS class instead (see style.css) so the lift survives a re-render.
const ABOVE_CG = [
    "#top-bar",
    "#top-settings-holder",
    "#sheld",            // chat sheld (chat list + messages)
    "#chat",             // chat messages container
    "#send_form",        // text input area
    "#form_sheld",       // form wrapper around the text input
    "#dangan-vn-overlay", // VN dialogue box — current speaker + line
    "#dangan-hud-topright", // Chapter/Level area + LVL bar + area indicator
    "#dangan-bgm-display",  // BGM visualiser
    "#dangan-bgm-panel",
];

// Fullscreen CG with a dismiss button. bgCssUrl is a CSS url("…") string;
// filter is null | "sepia" | "grayscale".
function showCgOverlay(bgCssUrl, filter = null) {
    document.getElementById(OVERLAY_ID)?.remove();
    document.querySelector(".dangan-cg-dismiss-btn")?.remove();

    // Boost the chat area + current speaker above the CG (z:2147483646). Force
    // position:relative on static elements so z-index applies; some ST rules use
    // !important on z-index, so set ours !important too and save originals for a
    // clean restore on dismiss.
    const saved = ABOVE_CG.flatMap(sel =>
        Array.from(document.querySelectorAll(sel)).map(el => {
            const origZ      = el.style.getPropertyValue("z-index");
            const origZPri   = el.style.getPropertyPriority("z-index");
            const origPos    = el.style.getPropertyValue("position");
            const origPosPri = el.style.getPropertyPriority("position");
            const cs = getComputedStyle(el);
            el.style.setProperty("z-index", "2147483647", "important");
            if (cs.position === "static") el.style.setProperty("position", "relative", "important");
            return { el, origZ, origZPri, origPos, origPosPri };
        })
    );

    // Lift the overworld room buttons (Talk / Grab / Call) above the CG and hide
    // the sprite strip + the Show CG trigger so the CG reads as a clean backdrop.
    // Done via a body class (not inline styles) so it survives an overworld
    // re-render, which replaces the #dangan-overworld element wholesale.
    document.body.classList.add("dangan-ow-cg-open");

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "dangan-cg-dismiss-btn";
    dismissBtn.textContent = "✕ DISMISS";

    const FADE_OUT_MS = 450;
    let dismissing = false;
    const cleanup = () => {
        if (dismissing) return;
        dismissing = true;
        overlay.classList.add("dangan-cg-fading-out");
        dismissBtn.classList.add("dangan-cg-fading-out");
        setTimeout(() => {
            overlay.remove();
            dismissBtn.remove();
            document.body.classList.remove("dangan-ow-cg-open");
            saved.forEach(({ el, origZ, origZPri, origPos, origPosPri }) => {
                if (origZ)   el.style.setProperty("z-index",  origZ,   origZPri);
                else         el.style.removeProperty("z-index");
                if (origPos) el.style.setProperty("position", origPos, origPosPri);
                else         el.style.removeProperty("position");
            });
        }, FADE_OUT_MS);
    };
    dismissBtn.onclick = cleanup;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.backgroundImage = bgCssUrl;
    if (filter === "sepia")     overlay.classList.add("dangan-cg-sepia");
    if (filter === "grayscale") overlay.classList.add("dangan-cg-grayscale");

    document.body.appendChild(overlay);
    document.body.appendChild(dismissBtn);
}

// Resolve a SillyTavern .bg_example element to { label, thumb, cssUrl }. The
// thumbnail can be an <img>, a div with a CSS background-image, or an inline
// style — handle all three; cssUrl prefers the full-res data-url, then the
// thumbnail, then the canonical backgrounds/ path.
function resolveBgItem(el) {
    const bgfile = el.getAttribute("bgfile") || "";
    const label  = bgfile.split("/").pop().replace(/\.[^.]+$/, "") || bgfile;
    const imgEl = el.querySelector(".bg_example_img, img");
    let thumb = "none";
    if (imgEl) {
        if (imgEl.tagName === "IMG" && imgEl.src) {
            thumb = `url("${imgEl.src}")`;
        } else {
            const cs = window.getComputedStyle(imgEl);
            if (cs.backgroundImage && cs.backgroundImage !== "none") thumb = cs.backgroundImage;
            else if (imgEl.style.backgroundImage) thumb = imgEl.style.backgroundImage;
        }
    }
    const isCustom = el.getAttribute("custom") === "true";
    const cssUrl = el.dataset?.url
        || el.getAttribute("data-url")
        || (thumb && thumb !== "none" ? thumb : null)
        || (isCustom ? `url("${bgfile}")` : `url("backgrounds/${encodeURIComponent(bgfile)}")`);
    if (thumb === "none" && cssUrl) thumb = cssUrl;
    return { label, thumb, cssUrl, bgfile };
}

// Load a background into CG Mode by (partial, case-insensitive) bgfile name —
// mirrors how /bodydiscovery's bg= switch matches a .bg_example. Returns true
// if a matching background was found and shown. Used by the Body Discovery flow
// to reveal the crime-scene BG as a CG.
export function showCgByBgName(bgName) {
    const lower = String(bgName || "").trim().toLowerCase();
    if (!lower) return false;
    const el = Array.from(document.querySelectorAll(".bg_example"))
        .find(e => (e.getAttribute("bgfile") || "").toLowerCase().includes(lower));
    if (!el) return false;
    const { cssUrl } = resolveBgItem(el);
    if (!cssUrl) return false;
    showCgOverlay(cssUrl);
    return true;
}

// Background picker grid. Reads ST's .bg_example thumbnails so it works wherever
// the backgrounds drawer has been populated (i.e. always, after load).
//
// Options:
//   title  — header text (default "CHOOSE CG").
//   onPick — (item) => void. When provided, selecting a background calls this
//            (with { label, cssUrl, bgfile }) and closes the picker, instead of
//            showing the CG overlay. The sepia/grayscale filters are hidden in
//            this mode since they only apply to the CG overlay.
export function showCgPicker({ title = "CHOOSE CG", onPick = null } = {}) {
    document.getElementById(PICKER_ID)?.remove();

    const bgs = Array.from(document.querySelectorAll(".bg_example"));
    if (!bgs.length) return;

    const items = bgs.map(resolveBgItem).filter(item => item.cssUrl);

    if (!items.length) return;

    let selectedFilter = null; // null | "sepia" | "grayscale"

    const picker = document.createElement("div");
    picker.id = PICKER_ID;

    const inner = document.createElement("div");
    inner.className = "dangan-cg-picker-inner";

    const header = document.createElement("div");
    header.className = "dangan-cg-picker-header";
    header.innerHTML = `<span class="dangan-cg-picker-title">${String(title).replace(/[<>&]/g, "")}</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "dangan-cg-picker-close";
    closeBtn.textContent = "✕";
    closeBtn.onclick = () => picker.remove();
    header.appendChild(closeBtn);

    const filterRow = document.createElement("div");
    filterRow.className = "dangan-cg-picker-filters";
    if (onPick) filterRow.style.display = "none";
    ["sepia", "grayscale"].forEach(f => {
        const btn = document.createElement("button");
        btn.className = "dangan-cg-filter-btn";
        btn.textContent = f.toUpperCase();
        btn.dataset.filter = f;
        btn.onclick = () => {
            if (selectedFilter === f) {
                selectedFilter = null;
                btn.classList.remove("active");
            } else {
                selectedFilter = f;
                filterRow.querySelectorAll(".dangan-cg-filter-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            }
        };
        filterRow.appendChild(btn);
    });

    const searchRow = document.createElement("div");
    searchRow.className = "dangan-cg-picker-search-row";
    const searchInput = document.createElement("input");
    searchInput.className = "dangan-cg-search";
    searchInput.type = "text";
    searchInput.placeholder = "Search backgrounds…";
    searchRow.appendChild(searchInput);

    const grid = document.createElement("div");
    grid.className = "dangan-cg-picker-grid";

    inner.appendChild(header);
    inner.appendChild(filterRow);
    inner.appendChild(searchRow);
    inner.appendChild(grid);
    picker.appendChild(inner);
    document.body.appendChild(picker);

    function renderItems() {
        grid.innerHTML = "";
        const query = searchInput.value.trim().toLowerCase();
        const visible = query ? items.filter(it => it.label.toLowerCase().includes(query)) : items;
        if (!visible.length) {
            const empty = document.createElement("div");
            empty.className = "dangan-cg-no-results";
            empty.textContent = "No backgrounds found";
            grid.appendChild(empty);
            return;
        }
        visible.forEach(item => {
            const cell = document.createElement("div");
            cell.className = "dangan-cg-pick-item";

            const thumb = document.createElement("div");
            thumb.className = "dangan-cg-pick-thumb";
            if (item.thumb && item.thumb !== "none") thumb.style.backgroundImage = item.thumb;

            const lbl = document.createElement("span");
            lbl.className = "dangan-cg-pick-label";
            lbl.textContent = item.label;

            cell.appendChild(thumb);
            cell.appendChild(lbl);
            cell.onclick = () => {
                picker.remove();
                if (onPick) onPick(item);
                else showCgOverlay(item.cssUrl, selectedFilter);
            };
            grid.appendChild(cell);
        });
    }

    renderItems();
    searchInput.addEventListener("input", renderItems);

    picker.addEventListener("click", e => { if (e.target === picker) picker.remove(); });
}
