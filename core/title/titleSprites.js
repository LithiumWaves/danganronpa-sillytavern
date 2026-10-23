import { escapeHtml, isTypingTarget, stepFocus } from "./titleUtils.js";

// SETUP → SPRITES. Upload a character's expression sprites without leaving
// the title screen: one emotion at a time, several images named after their
// emotions ("joy.png"), or a ZIP sprite pack.

export const SPRITE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/apng,.png,.jpg,.jpeg,.webp,.gif,.apng";

// "joy.png" → "joy"; null for names that aren't one of `emotions`.
export function emotionFromFileName(fileName, emotions = []) {
    const stem = String(fileName || "").split("/").pop().replace(/\.[^.]+$/, "").trim().toLowerCase();
    return emotions.find((e) => e.toLowerCase() === stem) || null;
}

export function mountSpritesPanel(container, api) {
    const { services, sfx } = api;
    let people = [];
    let person = null;
    let sprites = [];
    let emotions = [];
    let query = "";
    let busy = false;
    let status = "";
    let pendingEmotion = null;

    const spriteFor = (emotion) => sprites.find((s) => s.stem.toLowerCase() === emotion.toLowerCase()) || null;

    const renderPeopleGrid = () => {
        const q = query.trim().toLowerCase();
        const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q));
        return shown.length ? shown.map((p) => `
            <button type="button" class="dgn-title-persona${p.hasSprites ? "" : " is-missing"}" data-person="${escapeHtml(p.folder)}">
                ${p.avatarUrl ? `<img src="${escapeHtml(p.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}
                <span>${escapeHtml(p.name)}${p.hasSprites ? "" : " · NO SPRITES"}</span>
            </button>`).join("") : `<div class="dgn-title-empty">${people.length ? "NO ONE MATCHES." : "IMPORT CHARACTER CARDS FIRST."}</div>`;
    };

    const renderPeople = () => {
        api.setTitle("SPRITES");
        const missing = people.filter((p) => !p.hasSprites).length;
        container.innerHTML = `
            <p class="dgn-title-note">Pick a character to upload their expression sprites. ${missing ? `${missing} ${missing === 1 ? "has" : "have"} none yet.` : ""}</p>
            <div class="dgn-title-toolbar">
                <input type="search" class="dgn-title-input" placeholder="Search characters…" value="${escapeHtml(query)}" aria-label="Search characters">
            </div>
            <div class="dgn-title-personas" data-people>${renderPeopleGrid()}</div>
        `;
    };

    const renderPerson = () => {
        api.setTitle(person.name.toUpperCase());
        container.innerHTML = `
            <p class="dgn-title-note">Click an emotion to upload its sprite. UPLOAD IMAGES takes several files named after their emotions (joy.png, anger.png…); UPLOAD ZIP takes a sprite pack.</p>
            <div class="dgn-title-toolbar">
                <button type="button" class="dgn-title-btn" data-upload-many${busy ? " disabled" : ""}>UPLOAD IMAGES</button>
                <button type="button" class="dgn-title-btn" data-upload-zip${busy ? " disabled" : ""}>UPLOAD ZIP</button>
                <span class="dgn-title-note" aria-live="polite">${escapeHtml(status)}</span>
                <input type="file" accept="${SPRITE_IMAGE_ACCEPT}" hidden data-file-one>
                <input type="file" accept="${SPRITE_IMAGE_ACCEPT}" multiple hidden data-file-many>
                <input type="file" accept=".zip,application/zip" hidden data-file-zip>
            </div>
            <div class="dgn-title-bg-grid">
                ${emotions.map((emotion) => {
                    const sprite = spriteFor(emotion);
                    return `
                    <button type="button" class="dgn-title-bg-tile${sprite ? " is-on" : ""}" data-emotion="${escapeHtml(emotion)}"${busy ? " disabled" : ""}>
                        <span class="dgn-title-bg-thumb dgn-title-sprite-thumb">${sprite ? `<img src="${escapeHtml(sprite.path)}" alt="" loading="lazy" draggable="false">` : "EMPTY"}</span>
                        <span class="dgn-title-bg-name">${escapeHtml(emotion.toUpperCase())}</span>
                    </button>`;
                }).join("")}
            </div>
        `;
    };

    const render = () => (person ? renderPerson() : renderPeople());

    const loadPeople = async () => {
        container.innerHTML = `<div class="dgn-title-empty">CHECKING…</div>`;
        try {
            emotions = services.getSpriteEmotions?.() || [];
            people = await services.listSpriteCharacters?.() || [];
        } catch (e) {
            console.warn("[Dangan][Title] sprites panel failed:", e);
            people = [];
        }
        render();
    };

    const loadSprites = async () => {
        try { sprites = await services.listSprites?.(person.folder) || []; } catch (e) { console.warn("[Dangan][Title] listing sprites failed:", e); sprites = []; }
        render();
    };

    const run = async (label, job) => {
        if (busy) return;
        busy = true;
        status = `${label}…`;
        render();
        let message = "";
        try { message = await job(); } catch (e) { console.warn("[Dangan][Title] sprite upload failed:", e); message = "Upload failed."; }
        busy = false;
        status = message || "";
        await loadSprites();
    };

    const uploadOne = (emotion, file) => run(`UPLOADING ${emotion.toUpperCase()}`, async () => {
        const ok = await services.uploadSprite?.(person.folder, emotion, file);
        sfx(ok ? "click" : "close");
        return ok ? `${emotion.toUpperCase()} uploaded.` : "Upload failed.";
    });

    const uploadMany = (files) => run("UPLOADING", async () => {
        let done = 0;
        const skipped = [];
        for (const file of files) {
            const emotion = emotionFromFileName(file.name, emotions);
            if (!emotion) { skipped.push(file.name); continue; }
            if (await services.uploadSprite?.(person.folder, emotion, file)) done++;
        }
        sfx(done ? "click" : "close");
        return `${done} uploaded.${skipped.length ? ` Skipped ${skipped.length} not named after an emotion.` : ""}`;
    });

    const uploadZip = (file) => run("UPLOADING ZIP", async () => {
        const ok = await services.uploadSpriteZip?.(person.folder, file);
        sfx(ok ? "click" : "close");
        return ok ? "Sprite pack uploaded." : "Upload failed.";
    });

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        const who = t.closest?.("[data-person]");
        if (who && !person) {
            person = people.find((p) => p.folder === who.dataset.person) || null;
            if (!person) return;
            sfx("click");
            status = "";
            sprites = [];
            render();
            loadSprites();
            return;
        }
        if (!person || busy) return;
        const tile = t.closest?.("[data-emotion]");
        if (tile) {
            sfx("click");
            pendingEmotion = tile.dataset.emotion;
            container.querySelector("[data-file-one]")?.click();
            return;
        }
        if (t.closest?.("[data-upload-many]")) { sfx("click"); container.querySelector("[data-file-many]")?.click(); return; }
        if (t.closest?.("[data-upload-zip]")) { sfx("click"); container.querySelector("[data-file-zip]")?.click(); }
    });

    container.addEventListener("change", (ev) => {
        const input = ev.target;
        const files = Array.from(input.files || []);
        input.value = "";
        if (!files.length || !person) return;
        if (input.matches("[data-file-one]") && pendingEmotion) uploadOne(pendingEmotion, files[0]);
        else if (input.matches("[data-file-many]")) uploadMany(files);
        else if (input.matches("[data-file-zip]")) uploadZip(files[0]);
        pendingEmotion = null;
    });

    container.addEventListener("input", (ev) => {
        if (ev.target.type !== "search" || person) return;
        query = ev.target.value;
        container.querySelector("[data-people]").innerHTML = renderPeopleGrid();
    });

    loadPeople();

    return {
        onBack() {
            if (person) {
                sfx("close");
                person = null;
                status = "";
                loadPeople();
                return true;
            }
            api.openPanel("setup");
            return true;
        },
        onKey(ev) {
            if (isTypingTarget(ev.target)) return false;
            const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
            if (!dir) return false;
            return stepFocus(container, "button:not([disabled])", dir, sfx);
        },
    };
}
