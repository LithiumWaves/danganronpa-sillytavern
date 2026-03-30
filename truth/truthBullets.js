// truth/truthBullets.js
let extension_settings;
let saveSettingsDebounced;
let sfx;
let characters;
let normalizeName;
let registerCharacterFromMessage;
let increaseTrust;
let decreaseTrust;
let startV3CObserver;
let playSfx;
let extensionName;
let getSetting;
let awardMonocoins;
let monocoinRewards;
let awardXp;
let xpRewards;
let deps = {};

const DEFAULT_MONOCOIN_REWARD = Object.freeze({
    truthBullet: 5,
});

const DEFAULT_XP_REWARD = Object.freeze({
    truthBullet: 8,
});

export function initTruthBullets(providedDeps) {
    deps = providedDeps;

    ({
        extension_settings,
        saveSettingsDebounced,
        sfx,
        characters,
        normalizeName,
        registerCharacterFromMessage,
        increaseTrust,
        decreaseTrust,
        startV3CObserver,
        playSfx,
        extensionName,
        getSetting,
        awardMonocoins,
        monocoinRewards,
        awardXp,
        xpRewards,
    } = deps);

    // Loads saved bullets
    loadTruthBullets();

    // Render them ASAP
    window.renderTruthBullets = renderTruthBullets;

    // Sort button interactions — each button toggles between its two states when active;
    // clicking an inactive button activates it and resets it to its A state.
    // A states: latest, az  |  B states: oldest, za
    const SORT_A_KEYS = new Set(['latest', 'az']);

    $(document).on('mouseenter', '.truth-sort-btn', function () {
        playSfx(sfx.hover);
    });
    $(document).on('click', '.truth-sort-btn', function () {
        playSfx(sfx.click);
        const $btn = $(this);

        if (!$btn.hasClass('active')) {
            // Activate and reset to A state
            const labelA = $btn.data('label-a');
            const sortA  = $btn.data('label-a') === 'SORT: LATEST' ? 'latest' : 'az';
            $btn.data('sort', sortA).text(labelA);
            currentSort = sortA;
            $('.truth-sort-btn').removeClass('active');
            $btn.addClass('active');
        } else {
            // Toggle between A and B
            const cur  = $btn.data('sort');
            const onA  = SORT_A_KEYS.has(cur);
            const next = onA ? $btn.data('other') : (cur === 'oldest' ? 'latest' : 'az');
            const label = onA ? $btn.data('label-b') : $btn.data('label-a');
            $btn.data('sort', next).text(label);
            currentSort = next;
        }

        renderTruthBullets();
    });

    // Arrow key navigation for the truth bullet list
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const $panel = $('.monopad-panel-content[data-panel="truth"]');
        if (!$panel.is(':visible')) return;

        const $items = $panel.find('.truth-item, .truth-archived-item');
        if (!$items.length) return;

        e.preventDefault();

        const $active = $items.filter('.active');
        let idx = $active.length ? $items.index($active) : -1;
        idx = e.key === 'ArrowDown'
            ? Math.min(idx + 1, $items.length - 1)
            : Math.max(idx - 1, 0);

        $items.eq(idx).trigger('click');
        $items.eq(idx)[0].scrollIntoView({ block: 'nearest' });
    });

    startV3CObserver();
}

export function getTruthBullets() {
    return truthBullets;
}

const truthBullets = [];
const archivedTruthBullets = [];
const truthBulletQueue = [];
let currentSort = 'latest';

function getSortedBullets(arr) {
    const copy = [...arr];
    switch (currentSort) {
        case 'oldest': return copy;
        case 'az':     return copy.sort((a, b) => a.title.localeCompare(b.title));
        case 'za':     return copy.sort((a, b) => b.title.localeCompare(a.title));
        default:       return copy.reverse(); // 'latest'
    }
}
let truthBulletAnimating = false;
let forcedTruthBulletSfxVariant = null;

function ensureCenteredTruthOverlay(overlay) {
    if (!overlay) return;

    if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }

    const isMobile = window.matchMedia?.("(max-width: 700px)")?.matches;
    const topInset = "env(safe-area-inset-top, 0px)";
    const bottomInset = "env(safe-area-inset-bottom, 0px)";

    overlay.style.setProperty("position", "fixed", "important");
    overlay.style.setProperty("top", "0", "important");
    overlay.style.setProperty("left", "0", "important");
    overlay.style.setProperty("width", "100vw", "important");
    overlay.style.setProperty("height", "100dvh", "important");
    overlay.style.setProperty("display", "flex", "important");
    overlay.style.setProperty("align-items", "center", "important");
    overlay.style.setProperty("justify-content", "center", "important");
    overlay.style.setProperty("padding-top", isMobile ? `max(10px, calc(${topInset} + 8px))` : "16px", "important");
    overlay.style.setProperty("padding-bottom", isMobile ? `max(10px, calc(${bottomInset} + 8px))` : "16px", "important");
    overlay.style.setProperty("padding-left", isMobile ? "10px" : "16px", "important");
    overlay.style.setProperty("padding-right", isMobile ? "10px" : "16px", "important");
    overlay.style.setProperty("box-sizing", "border-box", "important");
    overlay.style.setProperty("z-index", "2147483601", "important");

    const inner = overlay.querySelector(".truth-obtained-inner");
    if (inner) {
        inner.style.setProperty("position", "relative", "important");
        inner.style.setProperty("width", isMobile ? "min(94vw, 560px)" : "min(80vw, 700px)", "important");
        inner.style.setProperty("margin", "0 auto", "important");
    }

    const bullet = overlay.querySelector("#truth-bullet-fly");
    if (bullet) {
        bullet.style.setProperty("transform", "translate(-50%, -50%)", "important");
    }
}

const processedTruthSignatures = new Set();

const TB_REGEX = /V3C\|\s*TB:\s*([^|\n\r]+)(?:\|\|\s*([^\n\r]+))?/g;

function toLocationId(title) {
    return title.trim().toLowerCase()
        .replace(/[''`']/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

export function getTruthBulletByLocationId(locationId) {
    if (!locationId) return null;
    return [...truthBullets, ...archivedTruthBullets].find(tb => tb.locationId === locationId) || null;
}

export function showTruthBulletByLocationId(locationId) {
    const bullet = getTruthBulletByLocationId(locationId);
    if (!bullet) return;
    const isArchived = archivedTruthBullets.includes(bullet);
    $(".truth-item, .truth-archived-item").removeClass("active");
    $(`[data-id="${bullet.id}"]`).addClass("active");
    showTruthBulletDetails(bullet, isArchived);
}

export function showTruthBulletById(id) {
    const bullet = [...truthBullets, ...archivedTruthBullets].find(tb => tb.id === id);
    if (!bullet) return;
    const isArchived = archivedTruthBullets.includes(bullet);
    $(".truth-item, .truth-archived-item").removeClass("active");
    $(`[data-id="${bullet.id}"]`).addClass("active");
    showTruthBulletDetails(bullet, isArchived);
}

function saveTruthBullets() {
    deps.extension_settings[deps.extensionName].truthBullets = truthBullets;
    deps.extension_settings[deps.extensionName].archivedTruthBullets = archivedTruthBullets;
    deps.saveSettingsDebounced();
}

function loadTruthBullets() {
    const saved = extension_settings[extensionName].truthBullets;
    if (Array.isArray(saved)) {
        truthBullets.length = 0;
        processedTruthSignatures.clear();
        saved.forEach(tb => {
            truthBullets.push(tb);
            const sig = `${tb.title}||${tb.description || ""}`;
            processedTruthSignatures.add(sig);
        });
    }

    const savedArchived = extension_settings[extensionName].archivedTruthBullets;
    if (Array.isArray(savedArchived)) {
        archivedTruthBullets.length = 0;
        savedArchived.forEach(tb => archivedTruthBullets.push(tb));
    }

    // Backfill locationId for bullets created before this feature
    let needsSave = false;
    for (const tb of [...truthBullets, ...archivedTruthBullets]) {
        if (!tb.locationId) {
            tb.locationId = toLocationId(tb.title);
            needsSave = true;
        }
    }
    if (needsSave) saveTruthBullets();
}

/* =========================
   TRUTH BULLET FUNCTIONS
   ========================= */

function addTruthBullet(title, description = "", { grantMonocoins = true, grantXp = true, image } = {}) {
    if (!title) return false;
    if (truthBullets.some(tb => tb.title === title)) return false;

    const bullet = {
        id: `tb_${Date.now()}`,
        title,
        locationId: toLocationId(title),
        description,
        timestamp: new Date().toLocaleString(),
        ...(image ? { image } : {}),
    };

    truthBullets.push(bullet);
    renderTruthBullets();
    queueTruthBulletAnimation(title);
    saveTruthBullets();

    const truthReward = Number(monocoinRewards?.truthBullet ?? DEFAULT_MONOCOIN_REWARD.truthBullet);
    if (grantMonocoins && awardMonocoins) {
        awardMonocoins(truthReward, "new truth bullet");
    }

    const truthXpReward = Number(xpRewards?.truthBullet ?? DEFAULT_XP_REWARD.truthBullet);
    if (grantXp && awardXp) {
        awardXp(truthXpReward, "new truth bullet");
    }

    console.log(`[${deps.extensionName}] Truth Bullet added: ${title}`);
    return true;
}

function insertTruthBulletUI(bullet) {
    const $list = $(".truth-list-items");
    if (!$list.length) return;

    if ($list.find(`[data-id="${bullet.id}"]`).length) return;

    $list.find(".truth-empty").remove();

    const $item = $(`
        <div class="truth-item" data-id="${bullet.id}">
            <img src="scripts/extensions/third-party/danganronpa-extension/assets/icons/artillery-shell.svg" alt="" class="truth-bullet-icon">
            ${bullet.title.toUpperCase()}
        </div>
    `);

    // Insert before the archive divider if it exists, otherwise append
    const $divider = $list.find(".truth-archive-divider");
    if ($divider.length) {
        $divider.before($item);
    } else {
        $list.append($item);
    }

    $item.on("click", () => {
        $(".truth-item, .truth-archived-item").removeClass("active");
        $item.addClass("active");
        showTruthBulletDetails(bullet, false);
    });
}

function insertArchivedTruthBulletUI(bullet) {
    const $list = $(".truth-list-items");
    if (!$list.length) return;

    if ($list.find(`[data-id="${bullet.id}"]`).length) return;

    // Ensure the archive divider exists
    if (!$list.find(".truth-archive-divider").length) {
        $list.append(`<div class="truth-archive-divider">ARCHIVED</div>`);
    }

    const $item = $(`
        <div class="truth-archived-item" data-id="${bullet.id}">
            <img src="scripts/extensions/third-party/danganronpa-extension/assets/icons/artillery-shell.svg" alt="" class="truth-bullet-icon truth-bullet-icon--archived">
            ${bullet.title.toUpperCase()}
        </div>
    `);

    $list.append($item);

    $item.on("click", () => {
        $(".truth-item, .truth-archived-item").removeClass("active");
        $item.addClass("active");
        showTruthBulletDetails(bullet, true);
    });
}

function showTruthBulletDetails(bullet, isArchived) {
    const $details = $(".truth-details");
    if (!$details.length) return;

    $details.removeAttr("style");

    const hasPin = bullet.locationId && deps.hasMapPin?.(bullet.locationId);
    const mapBtn = !bullet.locationId ? ""
        : hasPin
            ? `<button class="truth-show-on-map-button">SHOW ON MAP</button>`
            : `<button class="truth-place-on-map-button">PLACE ON MAP</button>`;
    const actionButton = isArchived
        ? `<div class="truth-archived-actions">
               <button class="truth-reload-button">RELOAD TRUTH BULLET</button>
               <button class="truth-remove-button truth-delete-button">DELETE TRUTH BULLET</button>
               ${mapBtn}
           </div>`
        : `<div class="truth-active-actions">
               <button class="truth-remove-button">ARCHIVE TRUTH BULLET</button>
               ${mapBtn}
           </div>`;

    $details.html(`
        <div class="truth-detail-main">
            <div class="truth-title">${bullet.title}</div>
            <div class="truth-description">
                ${bullet.description || "No further details recorded."}
            </div>
            <div class="truth-meta">
                OBTAINED: ${bullet.timestamp}
            </div>
            ${actionButton}
        </div>
        <div class="truth-image-col">
            <div style="width:100%;background:radial-gradient(ellipse at 50% 60%,rgba(36,10,46,0.97),rgba(8,3,14,1));border:1px solid rgba(200,80,220,0.38);box-shadow:inset 0 0 60px rgba(0,0,0,0.55),0 0 12px rgba(180,60,200,0.12);padding:16px;box-sizing:border-box;position:relative;">
                <div style="position:absolute;top:6px;left:6px;width:14px;height:14px;border-top:1px solid rgba(220,100,255,0.55);border-left:1px solid rgba(220,100,255,0.55);"></div>
                <div style="position:absolute;bottom:6px;right:6px;width:14px;height:14px;border-bottom:1px solid rgba(220,100,255,0.55);border-right:1px solid rgba(220,100,255,0.55);"></div>
                ${bullet.image ? `<img src="${bullet.image}" alt="" style="max-width:95%;height:auto;object-fit:contain;display:block;margin:16px auto;">` : ""}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px;">
                ${!isArchived ? `<label class="truth-image-upload-label" style="background:transparent;border:1px solid rgba(255,210,60,0.6);color:#ffd43c;font-family:inherit;font-size:0.85rem;letter-spacing:0.08em;padding:6px 16px;cursor:pointer;transition:color 0.15s,border-color 0.15s,background 0.15s;">
                    ${bullet.image ? "REPLACE IMAGE" : "UPLOAD IMAGE"}
                    <input type="file" accept="image/*" class="truth-image-input" style="display:none">
                </label>
                ${bullet.image ? `<button type="button" class="truth-image-delete-btn" style="background:transparent;border:1px solid rgba(255,60,60,0.6);color:#ff4a4a;font-family:inherit;font-size:0.85rem;letter-spacing:0.08em;padding:6px 16px;cursor:pointer;transition:color 0.15s,border-color 0.15s,background 0.15s;">DELETE IMAGE</button>` : ""}` : ""}
            </div>
        </div>
    `);

    if (isArchived) {
        $details.find(".truth-reload-button").on("click", () => {
            reloadArchivedBullet(bullet.id);
        });

        $details.find(".truth-remove-button").on("click", () => {
            showDeleteArchivedConfirm(bullet.id);
        });
    } else {
        $details.find(".truth-remove-button").on("click", () => {
            showArchiveConfirm(bullet.id);
        });

        $details.find(".truth-image-input").on("change", function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                bullet.image = e.target.result;
                saveTruthBullets();
                showTruthBulletDetails(bullet, false);
            };
            reader.readAsDataURL(file);
        });

        $details.find(".truth-image-delete-btn").on("click", () => {
            delete bullet.image;
            saveTruthBullets();
            showTruthBulletDetails(bullet, false);
        });
    }

    $details.find(".truth-show-on-map-button").on("click", () => {
        deps.navigateToMapPin?.(bullet.locationId);
    });

    $details.find(".truth-place-on-map-button").on("click", () => {
        deps.placeOnMap?.(bullet.title, bullet.locationId);
    });
}

function showArchiveConfirm(id) {
    $(".truth-discard-modal").remove();

    const $modal = $(`
        <div class="truth-discard-modal">
            <div class="truth-discard-box">
                <div class="truth-discard-warning">&#9888;</div>
                <div class="truth-discard-message">Are you sure? Archiving a Truth Bullet may make Class Trials more difficult, or impossible to solve.</div>
                <div class="truth-discard-actions">
                    <button class="truth-discard-confirm">ARCHIVE</button>
                    <button class="truth-discard-cancel">CANCEL</button>
                </div>
            </div>
        </div>
    `);

    $("body").append($modal);

    $modal.find(".truth-discard-confirm").on("click", () => {
        $modal.remove();
        archiveTruthBullet(id);
    });

    $modal.find(".truth-discard-cancel").on("click", () => {
        $modal.remove();
    });

    $modal.on("click", function (e) {
        if (e.target === this) $modal.remove();
    });
}

function showDeleteArchivedConfirm(id) {
    $(".truth-discard-modal").remove();

    const $modal = $(`
        <div class="truth-discard-modal">
            <div class="truth-discard-box">
                <div class="truth-discard-warning">&#9888;</div>
                <div class="truth-discard-message">Are you sure? Deleting an archived Truth Bullet is permanent and cannot be undone.</div>
                <div class="truth-discard-actions">
                    <button class="truth-discard-confirm">DELETE</button>
                    <button class="truth-discard-cancel">CANCEL</button>
                </div>
            </div>
        </div>
    `);

    $("body").append($modal);

    $modal.find(".truth-discard-confirm").on("click", () => {
        $modal.remove();
        permanentlyDeleteArchivedBullet(id);
    });

    $modal.find(".truth-discard-cancel").on("click", () => {
        $modal.remove();
    });

    $modal.on("click", function (e) {
        if (e.target === this) $modal.remove();
    });
}

function archiveTruthBullet(id) {
    const index = truthBullets.findIndex(tb => tb.id === id);
    if (index === -1) return;

    const [bullet] = truthBullets.splice(index, 1);
    archivedTruthBullets.push(bullet);
    saveTruthBullets();
    deps.setPinHidden?.(bullet.locationId, true);

    $(".truth-details").removeAttr("style").empty();
    renderTruthBullets();

    console.log(`[${extensionName}] Truth Bullet archived: ${bullet.title}`);
}

function reloadArchivedBullet(id) {
    const index = archivedTruthBullets.findIndex(tb => tb.id === id);
    if (index === -1) return;

    const [bullet] = archivedTruthBullets.splice(index, 1);
    truthBullets.push(bullet);
    saveTruthBullets();
    deps.setPinHidden?.(bullet.locationId, false);

    $(".truth-details").removeAttr("style").empty();
    renderTruthBullets();

    console.log(`[${extensionName}] Truth Bullet reloaded from archive: ${bullet.title}`);
}

function permanentlyDeleteArchivedBullet(id) {
    const index = archivedTruthBullets.findIndex(tb => tb.id === id);
    if (index === -1) return;

    const [bullet] = archivedTruthBullets.splice(index, 1);
    saveTruthBullets();
    deps.removePin?.(bullet.locationId);

    $(".truth-details").removeAttr("style").empty();
    renderTruthBullets();

    console.log(`[${extensionName}] Archived Truth Bullet permanently deleted`);
}

function renderTruthBullets() {
    const $list = $(".truth-list-items");
    if (!$list.length) return;

    $list.empty();

    if (!truthBullets.length && !archivedTruthBullets.length) {
        $list.append(`<div class="truth-empty">NO TRUTH BULLETS FOUND</div>`);
        return;
    }

    if (!truthBullets.length) {
        $list.append(`<div class="truth-empty">NO TRUTH BULLETS FOUND</div>`);
    } else {
        getSortedBullets(truthBullets).forEach(bullet => insertTruthBulletUI(bullet));
    }

    if (archivedTruthBullets.length) {
        $list.append(`<div class="truth-archive-divider">ARCHIVED</div>`);
        getSortedBullets(archivedTruthBullets).forEach(bullet => insertArchivedTruthBulletUI(bullet));
    }
}

function queueTruthBulletAnimation(title) {
    if (getSetting && getSetting("truthBulletAnimations") === false) return;

    truthBulletQueue.push(title);
    runTruthBulletQueue();
}


function runTruthBulletQueue() {
    if (truthBulletAnimating) return;
    if (!truthBulletQueue.length) return;

    truthBulletAnimating = true;

    const title = truthBulletQueue.shift();
    const $overlay = $("#truth-obtained-overlay");
    const $title = $overlay.find(".truth-obtained-title");

    if (!$overlay.length) {
        truthBulletAnimating = false;
        runTruthBulletQueue();
        return;
    }

    ensureCenteredTruthOverlay($overlay[0]);
    $title.text(title.toUpperCase());


    $overlay.removeClass("show");
    void $overlay[0].offsetWidth;
    $overlay.addClass("show");

    playTruthBulletSfx();

    setTimeout(() => {
        $overlay.removeClass("show");
        truthBulletAnimating = false;
        runTruthBulletQueue(); // 🔁 play next bullet
    }, 1800); // MUST match CSS
}

function playTruthBulletSfx() {
    if (!sfx.bullet_get) return;

    const forced = forcedTruthBulletSfxVariant;
    forcedTruthBulletSfxVariant = null;

    if (forced === "udg" && sfx.bullet_get_alt) {
        deps.playSfx(sfx.bullet_get_alt);
        return;
    }

    if (forced === "thh") {
        deps.playSfx(sfx.bullet_get);
        return;
    }

    const useAlt = Math.random() < 0.3; // 30% chance
    const sound = useAlt && sfx.bullet_get_alt
        ? sfx.bullet_get_alt
        : sfx.bullet_get;

    deps.playSfx(sound);
}

export function handleTruthBullet(title, description, options = {}) {
    return addTruthBullet(title, description, options);
}


export function clearAllTruthBullets() {
    truthBullets.length = 0;
    archivedTruthBullets.length = 0;
    processedTruthSignatures.clear();
    saveTruthBullets();
    renderTruthBullets();
}

export function setNextTruthBulletSfxVariant(variant = "") {
    const key = String(variant || "").trim().toLowerCase();
    forcedTruthBulletSfxVariant = key === "udg" ? "udg" : "thh";
}
