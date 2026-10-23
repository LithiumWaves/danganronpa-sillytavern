// Expression picker, for fun (after the Shinri Trial fangame's): a small
// tab on the right edge opens a drawer listing everyone on screen plus you,
// with a grid of their sprites. Picking one puts that sprite on screen until
// the character's next line changes it. Works in conversations and Class
// Trials. Settings → Customize → "Expression picker" hides it entirely.
//
// index.js supplies who is on screen (getTargets) and how to show a sprite
// (applySprite); this module only builds the drawer.

const ROOT_ID = "dangan-expr-picker";

// Files that aren't expressions to pick from.
const SKIP_STEM = /(-half$|^death-portrait$|^mugshot$)/i;

export function createExpressionPicker({ getTargets, listSprites, applySprite, isAvailable, playSfx }) {
    let open = false;
    let selectedKey = null;
    let targets = [];
    let renderToken = 0;
    const chosen = new Map(); // target key → path picked in this drawer

    function ensureRoot() {
        let root = document.getElementById(ROOT_ID);
        if (root) return root;
        root = document.createElement("div");
        root.id = ROOT_ID;
        root.innerHTML = `
            <button type="button" class="dangan-expr-tab" aria-expanded="false" aria-controls="dangan-expr-drawer" title="Expressions">
                <span class="dangan-expr-tab-icon" aria-hidden="true">☺</span>
                <span class="dangan-expr-tab-label">EXPRESSIONS</span>
            </button>
            <div class="dangan-expr-drawer" id="dangan-expr-drawer" role="dialog" aria-label="Expressions">
                <div class="dangan-expr-head">
                    <span class="dangan-expr-title">EXPRESSIONS</span>
                    <button type="button" class="dangan-expr-close" aria-label="Hide expressions" title="Hide">›</button>
                </div>
                <div class="dangan-expr-people" role="tablist"></div>
                <div class="dangan-expr-grid" role="listbox" aria-label="Sprites"></div>
            </div>
        `;
        root.querySelector(".dangan-expr-tab").addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(!open);
        });
        root.querySelector(".dangan-expr-close").addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(false);
        });
        root.querySelector(".dangan-expr-people").addEventListener("click", (e) => {
            e.stopPropagation();
            const chip = e.target.closest?.("[data-key]");
            if (!chip) return;
            selectedKey = chip.dataset.key;
            playSfx?.("click");
            renderPeople();
            renderGrid();
        });
        root.querySelector(".dangan-expr-grid").addEventListener("click", async (e) => {
            e.stopPropagation();
            const cell = e.target.closest?.("[data-path]");
            if (!cell) return;
            const target = targets.find((t) => t.key === selectedKey);
            if (!target) return;
            chosen.set(target.key, cell.dataset.path);
            root.querySelectorAll(".dangan-expr-cell.is-on").forEach((el) => el.classList.remove("is-on"));
            cell.classList.add("is-on");
            playSfx?.("select");
            try { await applySprite(target, cell.dataset.path, cell.dataset.stem); } catch (err) {
                console.warn("[Dangan][Expressions] couldn't apply sprite:", err);
            }
        });
        // Keep clicks inside the drawer from advancing the text box.
        root.addEventListener("pointerdown", (e) => e.stopPropagation());
        document.body.appendChild(root);
        return root;
    }

    function setOpen(next) {
        open = !!next;
        const root = ensureRoot();
        root.classList.toggle("open", open);
        root.querySelector(".dangan-expr-tab").setAttribute("aria-expanded", String(open));
        playSfx?.(open ? "open" : "close");
        if (open) refreshTargets();
    }

    function refreshTargets() {
        try { targets = getTargets() || []; } catch { targets = []; }
        if (!targets.some((t) => t.key === selectedKey)) selectedKey = targets[0]?.key ?? null;
        renderPeople();
        renderGrid();
    }

    function renderPeople() {
        const root = ensureRoot();
        const people = root.querySelector(".dangan-expr-people");
        people.innerHTML = "";
        if (!targets.length) {
            people.innerHTML = `<div class="dangan-expr-empty">Nobody on screen.</div>`;
            return;
        }
        for (const t of targets) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "dangan-expr-person" + (t.key === selectedKey ? " is-on" : "");
            chip.dataset.key = t.key;
            chip.setAttribute("role", "tab");
            chip.setAttribute("aria-selected", String(t.key === selectedKey));
            chip.title = t.label;
            if (t.thumb) chip.style.setProperty("--dangan-expr-thumb", `url("${String(t.thumb).replace(/"/g, "%22")}")`);
            const name = document.createElement("span");
            name.className = "dangan-expr-person-name";
            name.textContent = t.label;
            chip.appendChild(name);
            people.appendChild(chip);
        }
    }

    async function renderGrid() {
        const root = ensureRoot();
        const grid = root.querySelector(".dangan-expr-grid");
        const target = targets.find((t) => t.key === selectedKey);
        const mine = ++renderToken;
        grid.innerHTML = target ? `<div class="dangan-expr-empty">LOADING…</div>` : "";
        if (!target) return;
        let sprites = [];
        try { sprites = await listSprites(target); } catch { sprites = []; }
        if (mine !== renderToken) return;
        const seen = new Set();
        const items = (sprites || []).filter((s) => {
            if (!s?.path || SKIP_STEM.test(s.stem) || seen.has(s.stem)) return false;
            seen.add(s.stem);
            return true;
        });
        if (!items.length) {
            grid.innerHTML = `<div class="dangan-expr-empty">No sprites found.</div>`;
            return;
        }
        const current = chosen.get(target.key) || target.currentPath || "";
        const currentStem = stemOf(current);
        grid.innerHTML = "";
        for (const s of items) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "dangan-expr-cell" + (s.stem === currentStem ? " is-on" : "");
            cell.dataset.path = s.path;
            cell.dataset.stem = s.stem;
            cell.title = s.stem;
            cell.setAttribute("role", "option");
            cell.style.setProperty("--dangan-expr-sprite", `url("${String(s.path).replace(/"/g, "%22")}")`);
            grid.appendChild(cell);
        }
    }

    function stemOf(path) {
        return String(path || "").split("/").pop().split("?")[0].replace(/\.[a-z0-9]+$/i, "").replace(/-half$/i, "").toLowerCase();
    }

    return {
        // Show or hide the whole picker (setting, play state).
        sync() {
            const root = ensureRoot();
            let show = false;
            try { show = !!isAvailable(); } catch { show = false; }
            root.classList.toggle("available", show);
            if (!show && open) {
                open = false;
                root.classList.remove("open");
                root.querySelector(".dangan-expr-tab").setAttribute("aria-expanded", "false");
            }
        },
        // Someone new on screen, or a new chat.
        refresh() {
            chosen.clear();
            if (open) refreshTargets();
        },
    };
}
