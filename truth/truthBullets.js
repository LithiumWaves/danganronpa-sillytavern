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
let deps = {};

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
        getSetting
    } = deps);

    // Loads saved bullets
    loadTruthBullets();

    // Render them ASAP
    window.renderTruthBullets = renderTruthBullets;
    
    startV3CObserver();
}

const truthBullets = [];
const truthBulletQueue = [];
let truthBulletAnimating = false;

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

function saveTruthBullets() {
    deps.extension_settings[deps.extensionName].truthBullets = truthBullets;
    deps.saveSettingsDebounced();
}

function loadTruthBullets() {
    const saved = extension_settings[extensionName].truthBullets;
    if (!Array.isArray(saved)) return;

    truthBullets.length = 0;
    processedTruthSignatures.clear();

    saved.forEach(tb => {
        truthBullets.push(tb);

        // Prevent re-adding from chat scan
        const sig = `${tb.title}||${tb.description || ""}`;
        processedTruthSignatures.add(sig);
    });
}

/* =========================
   TRUTH BULLET FUNCTIONS
   ========================= */

function addTruthBullet(title, description = "") {
    if (!title) return;
    if (truthBullets.some(tb => tb.title === title)) return;

    const bullet = {
        id: `tb_${Date.now()}`,
        title,
        description,
        timestamp: new Date().toLocaleString()
    };

    truthBullets.push(bullet);
    insertTruthBulletUI(bullet);
    queueTruthBulletAnimation(title);
    saveTruthBullets();

    console.log(`[${deps.extensionName}] Truth Bullet added: ${title}`);
}

function insertTruthBulletUI(bullet) {
    const $list = $(".truth-list-items");
    if (!$list.length) return;

    if ($list.find(`[data-id="${bullet.id}"]`).length) return;

    $list.find(".truth-empty").remove();

    const $item = $(`
        <div class="truth-item" data-id="${bullet.id}">
            ${bullet.title.toUpperCase()}
        </div>
    `);

    $list.append($item);

    $item.on("click", () => {
        $(".truth-item").removeClass("active");
        $item.addClass("active");
        showTruthBulletDetails(bullet);
    });
}

function showTruthBulletDetails(bullet) {
    const $details = $(".truth-details");
    if (!$details.length) return;

    $details.html(`
        <div class="truth-details-content">
            <div class="truth-title">${bullet.title}</div>
            <div class="truth-description">
                ${bullet.description || "No further details recorded."}
            </div>
            <div class="truth-meta">
                OBTAINED: ${bullet.timestamp}
            </div>

            <button class="truth-remove-button">
                DISCARD TRUTH BULLET
            </button>
        </div>
    `);

    $details.find(".truth-remove-button").on("click", () => {
        removeTruthBullet(bullet.id);
    });
}

function removeTruthBullet(id) {
    const index = truthBullets.findIndex(tb => tb.id === id);
    if (index === -1) return;

    truthBullets.splice(index, 1);
    saveTruthBullets();

    $(`.truth-item[data-id="${id}"]`).remove();
    $(".truth-details").empty();

    if (!truthBullets.length) {
        $(".truth-list-items")
            .append(`<div class="truth-empty">NO TRUTH BULLETS FOUND</div>`);
    }

    console.log(`[${extensionName}] Truth Bullet removed`);
}

function renderTruthBullets() {
    const $list = $(".truth-list-items");
    if (!$list.length) return;

    $list.empty();

    if (!truthBullets.length) {
        $list.append(`<div class="truth-empty">NO TRUTH BULLETS FOUND</div>`);
        return;
    }

    truthBullets.forEach(bullet => {
        insertTruthBulletUI(bullet);
    });
}

function queueTruthBulletAnimation(title) {
    if (getSetting && !getSetting("truthBulletAnimations")) return;

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

    const useAlt = Math.random() < 0.3; // 30% chance
    const sound = useAlt && sfx.bullet_get_alt
        ? sfx.bullet_get_alt
        : sfx.bullet_get;

    deps.playSfx(sound);
}

export function handleTruthBullet(title, description) {
    addTruthBullet(title, description);
}
