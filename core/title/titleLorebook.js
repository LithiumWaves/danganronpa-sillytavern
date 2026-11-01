import { escapeHtml, isTypingTarget, stepFocus } from "./titleUtils.js";

// SETUP → LOREBOOKS. A lorebook (World Info) editor inside the title screen:
// books → a book's entries → one entry. Covers what most players touch in
// SillyTavern's own editor; the rarer entry settings are left as they are.

export const LORE_POSITIONS = Object.freeze([
    { value: 0, label: "Before character definitions" },
    { value: 1, label: "After character definitions" },
    { value: 5, label: "Before example messages" },
    { value: 6, label: "After example messages" },
    { value: 2, label: "Top of Author's Note" },
    { value: 3, label: "Bottom of Author's Note" },
    { value: 4, label: "At chat depth" },
]);
const AT_DEPTH = 4;

export const LORE_LOGIC = Object.freeze([
    { value: 0, label: "AND ANY" },
    { value: 3, label: "AND ALL" },
    { value: 1, label: "NOT ALL" },
    { value: 2, label: "NOT ANY" },
]);

const ROLES = Object.freeze([
    { value: 0, label: "System" },
    { value: 1, label: "User" },
    { value: 2, label: "Assistant" },
]);

const SAVE_DELAY_MS = 500;

export function splitKeys(text) {
    return String(text || "").split(",").map((k) => k.trim()).filter(Boolean);
}

export function entryTitle(entry) {
    return String(entry?.comment || "").trim() || (entry?.key || [])[0] || "Untitled entry";
}

export function sortedEntries(data) {
    return Object.values(data?.entries || {}).sort((a, b) =>
        (Number(b.order) || 0) - (Number(a.order) || 0) || (Number(a.uid) || 0) - (Number(b.uid) || 0));
}

function entryMatches(entry, q) {
    if (!q) return true;
    const hay = [entry.comment, entry.content, ...(entry.key || []), ...(entry.keysecondary || [])].join("\n").toLowerCase();
    return hay.includes(q);
}

const options = (list, value) => list.map((o) =>
    `<option value="${o.value}"${Number(value) === o.value ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("");

const switchHtml = (on, attrs) =>
    `<button type="button" class="dgn-title-switch${on ? " is-on" : ""}" role="switch" aria-checked="${on}" ${attrs}><span></span></button>`;

export function mountLorebookPanel(container, api) {
    const { services, sfx, confirm } = api;
    let view = "books";
    let books = [];
    let book = null; // { name, data }
    let entry = null;
    let query = "";
    let saveTimer = null;
    let disposed = false;
    let prompt = null; // { kind: "new" | "rename", name }

    // ── Saving ────────────────────────────────────────────────────────────
    const flush = async () => {
        if (!saveTimer) return;
        clearTimeout(saveTimer);
        saveTimer = null;
        if (!book) return;
        try { await services.saveLorebook?.(book.name, book.data); } catch (e) { console.warn("[Dangan][Title] saving lorebook failed:", e); }
    };
    const scheduleSave = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, SAVE_DELAY_MS);
    };

    // ── Books ─────────────────────────────────────────────────────────────
    const loadBooks = async () => {
        try { books = (await services.listLorebooks?.()) || []; } catch (e) {
            console.warn("[Dangan][Title] listing lorebooks failed:", e);
            books = [];
        }
    };

    const renderPrompt = () => !prompt ? "" : `
        <form class="dgn-title-lore-prompt">
            <span class="dgn-title-count">${prompt.kind === "rename" ? `RENAME "${escapeHtml(prompt.name)}"` : "NEW LOREBOOK"}</span>
            <input type="text" class="dgn-title-input" name="name" value="${escapeHtml(prompt.kind === "rename" ? prompt.name : "")}" placeholder="Lorebook name" aria-label="Lorebook name" autocomplete="off">
            <button type="submit" class="dgn-title-btn is-small is-primary">${prompt.kind === "rename" ? "RENAME" : "CREATE"}</button>
            <button type="button" class="dgn-title-btn is-small" data-prompt-cancel>CANCEL</button>
        </form>`;

    const renderBooks = () => {
        view = "books";
        api.setTitle("LOREBOOKS");
        const active = books.filter((b) => b.active).map((b) => b.name);
        container.innerHTML = `
            <p class="dgn-title-note">Lorebooks feed the AI facts when their keywords come up. Turn a book ON to use it in every chat. The game reads each classmate's Ultimate from these books.${active.length ? "" : " No book is on right now."}</p>
            <div class="dgn-title-toolbar">
                <button type="button" class="dgn-title-btn is-primary" data-new-book>NEW LOREBOOK</button>
                <button type="button" class="dgn-title-btn" data-import>IMPORT</button>
                <input type="file" accept=".json,.png" hidden data-import-file>
                <span class="dgn-title-count">${books.length} ${books.length === 1 ? "BOOK" : "BOOKS"}</span>
            </div>
            ${renderPrompt()}
            <div class="dgn-title-lore-list">
                ${books.length ? books.map((b, i) => `
                    <div class="dgn-title-lore-row${b.active ? " is-on" : ""}" data-book="${i}">
                        <button type="button" class="dgn-title-lore-open" data-open-book>
                            <span class="dgn-title-lore-name">${escapeHtml(b.name)}</span>
                            ${(b.linked || []).length ? `<span class="dgn-title-lore-meta">Linked to ${escapeHtml(b.linked.join(", "))}</span>` : ""}
                        </button>
                        <span class="dgn-title-lore-actions">
                            <span class="dgn-title-lore-label">ON</span>
                            ${switchHtml(b.active, `data-toggle-book aria-label="Use ${escapeHtml(b.name)} in every chat"`)}
                            <button type="button" class="dgn-title-btn is-small" data-rename-book>RENAME</button>
                            <button type="button" class="dgn-title-btn is-small" data-delete-book>DELETE</button>
                        </span>
                    </div>
                `).join("") : `<div class="dgn-title-empty">NO LOREBOOKS YET. Create one, or import the ones in /sample-lorebooks.</div>`}
            </div>
        `;
        if (prompt) container.querySelector(".dgn-title-lore-prompt input")?.focus();
    };

    const showBooks = async () => {
        await flush();
        book = null;
        entry = null;
        query = "";
        await loadBooks();
        if (!disposed) renderBooks();
    };

    const openBook = async (name) => {
        container.innerHTML = `<div class="dgn-title-empty">LOADING…</div>`;
        let data = null;
        try { data = await services.loadLorebook?.(name); } catch (e) { console.warn("[Dangan][Title] loading lorebook failed:", e); }
        if (disposed) return;
        if (!data) {
            await showBooks();
            return;
        }
        data.entries ??= {};
        book = { name, data };
        query = "";
        renderEntries();
    };

    const bookByRow = (el) => books[Number(el.closest("[data-book]")?.dataset.book)];

    const submitPrompt = async (name) => {
        const clean = String(name || "").trim();
        if (!clean || !prompt) return;
        const { kind, name: oldName } = prompt;
        if (kind === "rename" && clean === oldName) {
            prompt = null;
            renderBooks();
            return;
        }
        if (books.some((b) => b.name.toLowerCase() === clean.toLowerCase() && b.name !== oldName)) {
            const input = container.querySelector(".dgn-title-lore-prompt input");
            input?.setCustomValidity("A lorebook with that name already exists.");
            input?.reportValidity();
            return;
        }
        prompt = null;
        let ok = false;
        try {
            ok = kind === "rename"
                ? await services.renameLorebook?.(oldName, clean)
                : await services.createLorebook?.(clean);
        } catch (e) { console.warn(`[Dangan][Title] ${kind} lorebook failed:`, e); }
        sfx(ok ? "click" : "close");
        if (kind === "new" && ok) {
            await openBook(clean);
            return;
        }
        await showBooks();
    };

    // ── Entries ───────────────────────────────────────────────────────────
    const renderEntryRows = () => {
        const q = query.trim().toLowerCase();
        const list = sortedEntries(book.data).filter((e) => entryMatches(e, q));
        if (!list.length) return `<div class="dgn-title-empty">${q ? "NO ENTRIES MATCH." : "NO ENTRIES YET."}</div>`;
        return list.map((e) => `
            <div class="dgn-title-lore-row${e.disable ? " is-off" : ""}" data-uid="${escapeHtml(e.uid)}">
                <button type="button" class="dgn-title-lore-open" data-open-entry>
                    <span class="dgn-title-lore-name">${escapeHtml(entryTitle(e))}
                        ${e.disable ? `<span class="dgn-title-chip">OFF</span>` : ""}
                        ${e.constant ? `<span class="dgn-title-badge">ALWAYS</span>` : ""}
                    </span>
                    <span class="dgn-title-lore-meta">${(e.key || []).length ? escapeHtml((e.key || []).join(", ")) : e.constant ? "No keywords" : "No keywords. Never triggers."}</span>
                </button>
                <span class="dgn-title-lore-actions">
                    <span class="dgn-title-lore-label">ORDER ${escapeHtml(e.order ?? 100)}</span>
                    <button type="button" class="dgn-title-btn is-small" data-duplicate-entry>COPY</button>
                    <button type="button" class="dgn-title-btn is-small" data-delete-entry>DELETE</button>
                </span>
            </div>
        `).join("");
    };

    const renderEntries = () => {
        view = "entries";
        entry = null;
        api.setTitle(book.name.toUpperCase());
        const active = books.find((b) => b.name === book.name)?.active;
        container.innerHTML = `
            <div class="dgn-title-toolbar">
                <button type="button" class="dgn-title-btn is-primary" data-add-entry>ADD ENTRY</button>
                <input type="search" class="dgn-title-input" placeholder="Search titles, keywords and text…" value="${escapeHtml(query)}" aria-label="Search entries">
                <span class="dgn-title-lore-actions">
                    <span class="dgn-title-lore-label">USE IN EVERY CHAT</span>
                    ${switchHtml(!!active, `data-toggle-open-book aria-label="Use ${escapeHtml(book.name)} in every chat"`)}
                </span>
            </div>
            <div class="dgn-title-lore-list">${renderEntryRows()}</div>
        `;
    };

    const addEntry = (from = null) => {
        let created = null;
        try { created = services.createLorebookEntry?.(book.data); } catch (e) { console.warn("[Dangan][Title] adding entry failed:", e); }
        if (!created) return null;
        if (from) {
            const { uid, ...rest } = structuredClone(from);
            Object.assign(created, rest);
        }
        scheduleSave();
        return created;
    };

    // ── One entry ─────────────────────────────────────────────────────────
    const renderEntry = () => {
        view = "entry";
        api.setTitle(entryTitle(entry).toUpperCase());
        const e = entry;
        const atDepth = Number(e.position) === AT_DEPTH;
        container.innerHTML = `
            <form class="dgn-title-lore-form" autocomplete="off">
                <label class="dgn-title-field is-wide">
                    <span>TITLE / MEMO</span>
                    <input type="text" class="dgn-title-input" data-field="comment" value="${escapeHtml(e.comment || "")}" placeholder="What this entry is about (not sent to the AI)">
                </label>
                <label class="dgn-title-field is-wide">
                    <span>KEYWORDS <small>comma-separated; the entry triggers when one appears in the chat</small></span>
                    <input type="text" class="dgn-title-input" data-field="key" value="${escapeHtml((e.key || []).join(", "))}" placeholder="e.g. Kyoko, Ultimate Detective">
                </label>
                <div class="dgn-title-lore-pair is-wide">
                    <label class="dgn-title-field">
                        <span>OPTIONAL FILTER</span>
                        <select class="dgn-title-input" data-field="selectiveLogic">${options(LORE_LOGIC, e.selectiveLogic ?? 0)}</select>
                    </label>
                    <label class="dgn-title-field">
                        <span>SECONDARY KEYWORDS <small>leave empty to skip the filter</small></span>
                        <input type="text" class="dgn-title-input" data-field="keysecondary" value="${escapeHtml((e.keysecondary || []).join(", "))}">
                    </label>
                </div>
                <label class="dgn-title-field is-wide">
                    <span>CONTENT <small class="dgn-title-lore-chars">${String(e.content || "").length} characters</small></span>
                    <textarea class="dgn-title-input dgn-title-lore-content" data-field="content" rows="9" placeholder="What the AI is told when this entry triggers">${escapeHtml(e.content || "")}</textarea>
                </label>
                <div class="dgn-title-lore-toggles is-wide">
                    <span class="dgn-title-lore-toggle"><span class="dgn-title-lore-label">ENABLED</span>${switchHtml(!e.disable, `data-flag="enabled" aria-label="Enabled"`)}</span>
                    <span class="dgn-title-lore-toggle"><span class="dgn-title-lore-label">ALWAYS ON <small>(ignores keywords)</small></span>${switchHtml(!!e.constant, `data-flag="constant" aria-label="Always on"`)}</span>
                </div>
                <label class="dgn-title-field">
                    <span>POSITION</span>
                    <select class="dgn-title-input" data-field="position">${options(LORE_POSITIONS, e.position ?? 0)}</select>
                </label>
                <label class="dgn-title-field" ${atDepth ? "" : "hidden"} data-depth-only>
                    <span>DEPTH</span>
                    <input type="number" class="dgn-title-input" data-field="depth" min="0" max="1000" value="${escapeHtml(e.depth ?? 4)}">
                </label>
                <label class="dgn-title-field" ${atDepth ? "" : "hidden"} data-depth-only>
                    <span>ROLE</span>
                    <select class="dgn-title-input" data-field="role">${options(ROLES, e.role ?? 0)}</select>
                </label>
                <label class="dgn-title-field">
                    <span>ORDER <small>higher goes later, closer to the chat</small></span>
                    <input type="number" class="dgn-title-input" data-field="order" value="${escapeHtml(e.order ?? 100)}">
                </label>
                <label class="dgn-title-field">
                    <span>TRIGGER CHANCE %</span>
                    <input type="number" class="dgn-title-input" data-field="probability" min="0" max="100" value="${escapeHtml(e.useProbability === false ? 100 : (e.probability ?? 100))}">
                </label>
                <div class="dgn-title-options-foot is-wide">
                    <span class="dgn-title-note">Changes save automatically.</span>
                    <span class="dgn-title-lore-actions">
                        <button type="button" class="dgn-title-btn is-small" data-duplicate-entry>COPY</button>
                        <button type="button" class="dgn-title-btn is-small" data-delete-entry>DELETE</button>
                        <button type="button" class="dgn-title-btn is-small is-primary" data-done-entry>DONE</button>
                    </span>
                </div>
            </form>
        `;
    };

    const NUMBER_FIELDS = { order: [-Infinity, Infinity, 100], depth: [0, 1000, 4], probability: [0, 100, 100], position: [0, 7, 0], selectiveLogic: [0, 3, 0], role: [0, 2, 0] };

    const writeField = (field, raw) => {
        if (!entry) return;
        if (field === "key" || field === "keysecondary") {
            entry[field] = splitKeys(raw);
            if (field === "keysecondary") entry.selective = true;
        } else if (field in NUMBER_FIELDS) {
            const [min, max, fallback] = NUMBER_FIELDS[field];
            const n = Number(raw);
            entry[field] = Number.isFinite(n) && raw !== "" ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
            if (field === "probability") entry.useProbability = true;
        } else {
            entry[field] = String(raw);
        }
        scheduleSave();
    };

    const deleteEntry = async (target) => {
        const ok = await confirm({
            title: "DELETE ENTRY?",
            message: `"${entryTitle(target)}" will be removed from ${book.name}. This can't be undone.`,
            confirmLabel: "DELETE",
        });
        if (!ok || !book) return false;
        delete book.data.entries[target.uid];
        scheduleSave();
        return true;
    };

    // ── Events ────────────────────────────────────────────────────────────
    container.addEventListener("click", async (ev) => {
        const t = ev.target;
        if (view === "books") {
            if (t.closest("[data-new-book]")) {
                sfx("click");
                prompt = { kind: "new", name: "" };
                renderBooks();
            } else if (t.closest("[data-prompt-cancel]")) {
                sfx("close");
                prompt = null;
                renderBooks();
            } else if (t.closest("[data-import]")) {
                sfx("click");
                container.querySelector("[data-import-file]")?.click();
            } else if (t.closest("[data-open-book]")) {
                sfx("click");
                await openBook(bookByRow(t).name);
            } else if (t.closest("[data-toggle-book]")) {
                const b = bookByRow(t);
                sfx("click");
                try { await services.setLorebookActive?.(b.name, !b.active); } catch (e) { console.warn("[Dangan][Title] toggling lorebook failed:", e); }
                await loadBooks();
                renderBooks();
            } else if (t.closest("[data-rename-book]")) {
                sfx("click");
                prompt = { kind: "rename", name: bookByRow(t).name };
                renderBooks();
            } else if (t.closest("[data-delete-book]")) {
                const b = bookByRow(t);
                sfx("click");
                const ok = await confirm({
                    title: "DELETE LOREBOOK?",
                    message: `"${b.name}" and all its entries will be deleted. This can't be undone.`,
                    confirmLabel: "DELETE",
                });
                if (!ok) return;
                try { await services.deleteLorebook?.(b.name); } catch (e) { console.warn("[Dangan][Title] deleting lorebook failed:", e); }
                await showBooks();
            }
            return;
        }

        if (view === "entries") {
            if (t.closest("[data-add-entry]")) {
                sfx("click");
                const created = addEntry();
                if (created) {
                    entry = created;
                    renderEntry();
                    container.querySelector('[data-field="comment"]')?.focus();
                }
            } else if (t.closest("[data-toggle-open-book]")) {
                const b = books.find((x) => x.name === book.name);
                sfx("click");
                try { await services.setLorebookActive?.(book.name, !b?.active); } catch (e) { console.warn("[Dangan][Title] toggling lorebook failed:", e); }
                await loadBooks();
                const sw = container.querySelector("[data-toggle-open-book]");
                const on = !!books.find((x) => x.name === book.name)?.active;
                sw?.classList.toggle("is-on", on);
                sw?.setAttribute("aria-checked", String(on));
            } else {
                const uid = t.closest("[data-uid]")?.dataset.uid;
                const target = uid != null ? book.data.entries[uid] : null;
                if (!target) return;
                if (t.closest("[data-open-entry]")) {
                    sfx("click");
                    entry = target;
                    renderEntry();
                } else if (t.closest("[data-duplicate-entry]")) {
                    sfx("click");
                    addEntry(target);
                    container.querySelector(".dgn-title-lore-list").innerHTML = renderEntryRows();
                } else if (t.closest("[data-delete-entry]")) {
                    sfx("click");
                    if (await deleteEntry(target)) container.querySelector(".dgn-title-lore-list").innerHTML = renderEntryRows();
                }
            }
            return;
        }

        if (view === "entry" && entry) {
            const flag = t.closest("[data-flag]");
            if (flag) {
                sfx("click");
                if (flag.dataset.flag === "enabled") entry.disable = !entry.disable;
                else entry.constant = !entry.constant;
                const on = flag.dataset.flag === "enabled" ? !entry.disable : !!entry.constant;
                flag.classList.toggle("is-on", on);
                flag.setAttribute("aria-checked", String(on));
                scheduleSave();
            } else if (t.closest("[data-done-entry]")) {
                sfx("close");
                renderEntries();
            } else if (t.closest("[data-duplicate-entry]")) {
                sfx("click");
                const copy = addEntry(entry);
                if (copy) {
                    entry = copy;
                    renderEntry();
                }
            } else if (t.closest("[data-delete-entry]")) {
                sfx("click");
                if (await deleteEntry(entry)) renderEntries();
            }
        }
    });

    container.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (ev.target.closest(".dgn-title-lore-prompt")) submitPrompt(ev.target.elements.name?.value);
    });

    container.addEventListener("input", (ev) => {
        const t = ev.target;
        if (view === "books" && t.closest(".dgn-title-lore-prompt")) {
            t.setCustomValidity?.("");
            return;
        }
        if (view === "entries" && t.type === "search") {
            query = t.value;
            container.querySelector(".dgn-title-lore-list").innerHTML = renderEntryRows();
            return;
        }
        const field = t.dataset?.field;
        if (view !== "entry" || !field) return;
        // Keyword lists are parsed when the field is left, so typing a comma
        // doesn't jump the cursor.
        if (field === "key" || field === "keysecondary") return;
        writeField(field, t.value);
        if (field === "content") container.querySelector(".dgn-title-lore-chars").textContent = `${t.value.length} characters`;
        if (field === "comment") api.setTitle(entryTitle(entry).toUpperCase());
    });

    container.addEventListener("change", async (ev) => {
        const t = ev.target;
        if (t.matches?.("[data-import-file]")) {
            const file = t.files?.[0];
            t.value = "";
            if (!file) return;
            const name = file.name.replace(/\.[^.]+$/, "");
            if (books.some((b) => b.name === name)) {
                const ok = await confirm({
                    title: "REPLACE LOREBOOK?",
                    message: `There's already a lorebook called "${name}". Importing replaces it.`,
                    confirmLabel: "REPLACE",
                });
                if (!ok) return;
            }
            container.innerHTML = `<div class="dgn-title-empty">IMPORTING…</div>`;
            try { await services.importLorebook?.(file); } catch (e) { console.warn("[Dangan][Title] importing lorebook failed:", e); }
            await showBooks();
            return;
        }
        const field = t.dataset?.field;
        if (view !== "entry" || !field) return;
        writeField(field, t.value);
        if (field === "position") {
            const atDepth = Number(t.value) === AT_DEPTH;
            container.querySelectorAll("[data-depth-only]").forEach((el) => { el.hidden = !atDepth; });
        }
    });

    container.innerHTML = `<div class="dgn-title-empty">LOADING LOREBOOKS…</div>`;
    showBooks();

    return {
        unmount() {
            disposed = true;
            flush();
        },
        onBack() {
            if (prompt) {
                prompt = null;
                sfx("close");
                renderBooks();
                return true;
            }
            if (view === "entry") {
                sfx("close");
                // A keyword field still focused hasn't fired "change" yet.
                const focused = document.activeElement;
                if (focused?.dataset?.field && container.contains(focused)) writeField(focused.dataset.field, focused.value);
                renderEntries();
                return true;
            }
            if (view === "entries") {
                sfx("close");
                showBooks();
                return true;
            }
            flush();
            api.openPanel("setup");
            return true;
        },
        onKey(ev) {
            if (isTypingTarget(ev.target)) return false;
            if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return false;
            const selector = view === "entry"
                ? "input, select, textarea, .dgn-title-switch, .dgn-title-btn"
                : ".dgn-title-lore-open, .dgn-title-toolbar .dgn-title-btn";
            return stepFocus(container, selector, ev.key === "ArrowDown" ? 1 : -1, sfx);
        },
    };
}
