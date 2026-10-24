import { escapeHtml, isTypingTarget, stepFocus } from "./titleUtils.js";

// SETUP → CHARACTER CARDS. Imports cards without leaving the title screen:
// the player's own files, or the sample cards that ship with the extension.

export const CARD_FILE_ACCEPT = ".png,.json,.charx,.yaml,.yml,.byaf";

// "danganronpa-cards/Danganronpa V3/Kaede Akamatsu.json" → "Kaede Akamatsu"
export function cardNameFromPath(path) {
    const file = String(path || "").split("/").pop() || "";
    return file.replace(/\.[^.]+$/, "");
}

const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Marks which cards of each sample set are already imported.
export function markImportedSamples(sets = [], importedNames = []) {
    return sets.map((set) => {
        const cards = (set.files || []).map((path) => {
            const name = cardNameFromPath(path);
            return { path, name, imported: importedNames.some((n) => sameName(n, name)) };
        });
        return { ...set, cards, importedCount: cards.filter((c) => c.imported).length };
    });
}

export function mountCharactersPanel(container, api) {
    const { services, sfx } = api;
    let cards = [];
    let sets = [];
    let busy = false;
    let status = "";

    const render = () => {
        api.setTitle("CHARACTER CARDS");
        container.innerHTML = `
            <p class="dgn-title-note">${cards.length ? `${cards.length} ${cards.length === 1 ? "card" : "cards"} imported.` : "No character cards yet."} Import your own cards, or the sample cards that come with the extension.</p>
            <div class="dgn-title-toolbar">
                <button type="button" class="dgn-title-btn is-primary" data-import-files${busy ? " disabled" : ""}>IMPORT FILES</button>
                <span class="dgn-title-note dgn-title-chars-status" aria-live="polite">${escapeHtml(status)}</span>
                <input type="file" accept="${CARD_FILE_ACCEPT}" multiple hidden data-card-files>
            </div>
            <h4 class="dgn-title-split-group">SAMPLE CARDS</h4>
            <div class="dgn-title-setup-list" role="list">
                ${sets.length ? sets.map((set) => {
                    const left = set.cards.length - set.importedCount;
                    return `
                    <div class="dgn-title-setup-row is-${left ? "warn" : "ok"}" role="listitem">
                        <span class="dgn-title-setup-icon" aria-hidden="true">${left ? "+" : "✓"}</span>
                        <span class="dgn-title-setup-main">
                            <span class="dgn-title-setup-label">${escapeHtml(set.label)}</span>
                            <span class="dgn-title-setup-detail">${set.importedCount} of ${set.cards.length} imported.</span>
                        </span>
                        ${left ? `<button type="button" class="dgn-title-btn is-small" data-import-set="${escapeHtml(set.id)}"${busy ? " disabled" : ""}>IMPORT ${left}</button>` : ""}
                    </div>`;
                }).join("") : `<div class="dgn-title-empty">NO SAMPLE CARDS FOUND.</div>`}
            </div>
            ${cards.length ? `
                <h4 class="dgn-title-split-group">IMPORTED</h4>
                <div class="dgn-title-personas">
                    ${cards.map((c) => `
                        <span class="dgn-title-persona is-static">
                            ${c.avatarUrl ? `<img src="${escapeHtml(c.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}
                            <span>${escapeHtml(c.name)}</span>
                        </span>`).join("")}
                </div>` : ""}
        `;
    };

    const load = async () => {
        try {
            cards = services.listCharacterCards?.() || [];
            const raw = await services.listSampleCardSets?.() || [];
            sets = markImportedSamples(raw, cards.map((c) => c.name));
        } catch (e) {
            console.warn("[Dangan][Title] character cards panel failed:", e);
        }
        render();
    };

    const run = async (label, job) => {
        if (busy) return;
        busy = true;
        status = `${label}…`;
        render();
        let result = null;
        try { result = await job(); } catch (e) { console.warn("[Dangan][Title] import failed:", e); }
        busy = false;
        const imported = Number(result?.imported || 0);
        const failed = Number(result?.failed || 0);
        status = imported || failed
            ? `Imported ${imported}.${failed ? ` ${failed} couldn't be read.` : ""}`
            : "Nothing new to import.";
        sfx(imported ? "click" : "close");
        await load();
    };

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest?.("[data-import-files]")) {
            sfx("click");
            container.querySelector("[data-card-files]")?.click();
            return;
        }
        const setBtn = t.closest?.("[data-import-set]");
        if (setBtn) {
            const set = sets.find((s) => s.id === setBtn.dataset.importSet);
            if (!set) return;
            sfx("click");
            const paths = set.cards.filter((c) => !c.imported).map((c) => c.path);
            run(`IMPORTING ${set.label.toUpperCase()}`, () => services.importSampleCards?.(paths));
        }
    });

    container.addEventListener("change", (ev) => {
        if (!ev.target.matches?.("[data-card-files]")) return;
        const files = Array.from(ev.target.files || []);
        ev.target.value = "";
        if (files.length) run("IMPORTING", () => services.importCharacterFiles?.(files));
    });

    load();

    return {
        onBack() {
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
