export const TITLE_SCREEN_ID = "dangan-title-screen";

const MENU_ITEMS = Object.freeze([
    { action: "newGame", label: "NEW GAME" },
    { action: "continue", label: "CONTINUE" },
    { action: "options", label: "OPTIONS" },
]);

const EXIT_DURATION_MS = 620;

export function isTitleScreenBlocked() {
    if (typeof document === "undefined") return true;
    if (document.body?.classList?.contains("dangan-trial-active")) return true;
    if (document.getElementById(TITLE_SCREEN_ID)) return true;
    return false;
}

export function maybeShowTitleScreen({
    isEnabled,
    isBlocked = isTitleScreenBlocked,
    ...options
} = {}) {
    if (typeof isEnabled === "function" && !isEnabled()) return Promise.resolve(false);
    if (typeof isBlocked === "function" && isBlocked()) return Promise.resolve(false);
    return showTitleScreen(options);
}

// Resolves with the chosen action ("newGame" | "continue" | "options") once the
// screen is gone and that action's handler has been called.
export function showTitleScreen({
    logoUrl = "",
    onStart,
    onNewGame,
    onContinue,
    onOptions,
    onClose,
    playSfx,
} = {}) {
    if (typeof document === "undefined") return Promise.resolve(false);
    document.getElementById(TITLE_SCREEN_ID)?.remove();

    const handlers = { newGame: onNewGame, continue: onContinue, options: onOptions };
    const sfx = (name) => { try { playSfx?.(name); } catch { /* ignore */ } };

    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = TITLE_SCREEN_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-label", "Title screen");
        root.tabIndex = -1;
        root.innerHTML = `
            <div class="dgn-title-bg" aria-hidden="true">
                <div class="dgn-title-stripes"></div>
                <div class="dgn-title-slab dgn-title-slab-pink"></div>
                <div class="dgn-title-slab dgn-title-slab-dark"></div>
                <div class="dgn-title-vignette"></div>
                <div class="dgn-title-scanlines"></div>
            </div>
            <div class="dgn-title-stage">
                <div class="dgn-title-logo-wrap">
                    ${logoUrl
                        ? `<img class="dgn-title-logo" src="${logoUrl}" alt="Danganronpa ST" draggable="false">`
                        : `<div class="dgn-title-logo dgn-title-logo-text">DANGANRONPA</div>`}
                </div>
                <div class="dgn-title-press">PRESS START</div>
                <nav class="dgn-title-menu" aria-label="Title menu">
                    ${MENU_ITEMS.map((item, i) => `
                        <button type="button" class="dgn-title-item" data-action="${item.action}" style="--i:${i}" tabindex="-1">
                            <span class="dgn-title-item-mark" aria-hidden="true"></span>
                            <span class="dgn-title-item-label">${item.label}</span>
                        </button>
                    `).join("")}
                </nav>
            </div>
            <div class="dgn-title-flash" aria-hidden="true"></div>
        `;
        document.body.appendChild(root);
        root.style.setProperty("z-index", "2147483646", "important");
        root.style.setProperty("pointer-events", "auto", "important");
        requestAnimationFrame(() => requestAnimationFrame(() => {
            root.classList.add("is-on");
            root.focus({ preventScroll: true });
        }));

        const items = Array.from(root.querySelectorAll(".dgn-title-item"));
        let stage = "splash";
        let active = 0;
        let leaving = false;

        const setActive = (index, { silent = false } = {}) => {
            const next = (index + items.length) % items.length;
            if (next !== active && !silent) sfx("hover");
            active = next;
            items.forEach((el, i) => {
                el.classList.toggle("is-active", i === active);
                el.tabIndex = i === active ? 0 : -1;
            });
            items[active]?.focus({ preventScroll: true });
        };

        const start = () => {
            if (stage !== "splash") return;
            stage = "menu";
            sfx("open");
            try { onStart?.(); } catch (e) { console.warn("[Dangan][Title] onStart failed:", e); }
            root.classList.add("is-menu");
            setActive(0, { silent: true });
        };

        const choose = async (action) => {
            if (leaving || stage !== "menu") return;
            leaving = true;
            sfx("click");
            items.forEach((el) => el.classList.toggle("is-chosen", el.dataset.action === action));
            root.classList.add("is-leaving");
            document.removeEventListener("keydown", onKey, true);
            await new Promise((r) => setTimeout(r, EXIT_DURATION_MS));
            root.remove();
            try { await handlers[action]?.(); } catch (e) { console.warn(`[Dangan][Title] ${action} failed:`, e); }
            try { await onClose?.(action); } catch (e) { console.warn("[Dangan][Title] onClose failed:", e); }
            resolve(action);
        };

        function onKey(ev) {
            if (!root.isConnected || leaving) return;
            if (stage === "splash") {
                if (ev.key === "Tab" || ev.key === "Shift" || ev.key === "Control" || ev.key === "Alt" || ev.key === "Meta") return;
                ev.preventDefault();
                ev.stopPropagation();
                start();
                return;
            }
            const key = ev.key;
            if (key === "ArrowDown" || key === "s" || key === "S" || (key === "Tab" && !ev.shiftKey)) {
                setActive(active + 1);
            } else if (key === "ArrowUp" || key === "w" || key === "W" || (key === "Tab" && ev.shiftKey)) {
                setActive(active - 1);
            } else if (key === "Enter" || key === " ") {
                choose(items[active]?.dataset.action);
            } else if (key === "Escape") {
                choose("continue");
            } else {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
        }

        document.addEventListener("keydown", onKey, true);

        root.addEventListener("click", (ev) => {
            if (stage === "splash") {
                start();
                return;
            }
            const item = ev.target.closest?.(".dgn-title-item");
            if (item) choose(item.dataset.action);
        });

        items.forEach((el, i) => {
            el.addEventListener("mouseenter", () => {
                if (stage === "menu" && !leaving) setActive(i);
            });
        });
    });
}
