import { mountBackgroundsPanel } from "./titleBackgrounds.js";
import { mountContinuePanel } from "./titleContinue.js";
import { mountLorebookPanel } from "./titleLorebook.js";
import { mountMusicPanel } from "./titleMusic.js";
import { mountNewGamePanel } from "./titleNewGame.js";
import { mountOptionsPanel } from "./titleOptions.js";
import { mountSetupPanel } from "./titleSetup.js";
import { escapeHtml } from "./titleUtils.js";

export const TITLE_SCREEN_ID = "dangan-title-screen";

const MENU_ITEMS = Object.freeze([
    { action: "newGame", label: "NEW GAME" },
    { action: "continue", label: "CONTINUE" },
    { action: "options", label: "OPTIONS" },
    { action: "setup", label: "SETUP" },
]);

const PANELS = Object.freeze({
    newGame: { title: "NEW GAME", mount: mountNewGamePanel },
    continue: { title: "CONTINUE", mount: mountContinuePanel },
    options: { title: "OPTIONS", mount: mountOptionsPanel },
    setup: { title: "SETUP CHECKLIST", mount: mountSetupPanel },
    // Reached from SETUP; BACK returns there.
    music: { title: "MUSIC", mount: mountMusicPanel },
    backgrounds: { title: "ROOM BACKGROUNDS", mount: mountBackgroundsPanel },
    lorebook: { title: "LOREBOOKS", mount: mountLorebookPanel },
});

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

// Resolves once the screen is gone: with the panel that closed it
// ("newGame" | "continue" | "options" | "setup"), or "dismiss".
export function showTitleScreen({
    logoUrl = "",
    onStart,
    onClose,
    onShown,
    playSfx,
    services = {},
    skipSplash = false,
    initialPanel = "",
    // Hold the entrance until this settles, then skip the fade-in (the
    // loading curtain is covering the screen and opens over it).
    revealAfter = null,
} = {}) {
    if (typeof document === "undefined") return Promise.resolve(false);
    document.getElementById(TITLE_SCREEN_ID)?.remove();

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
                        ? `<img class="dgn-title-logo" src="${escapeHtml(logoUrl)}" alt="Danganronpa ST" draggable="false">`
                        : `<div class="dgn-title-logo dgn-title-logo-text">DANGANRONPA</div>`}
                </div>
                <div class="dgn-title-press">PRESS START</div>
                <nav class="dgn-title-menu" aria-label="Title menu">
                    ${MENU_ITEMS.map((item, i) => `
                        <button type="button" class="dgn-title-item" data-action="${item.action}" style="--i:${i}" tabindex="-1">
                            <span class="dgn-title-item-mark" aria-hidden="true"></span>
                            <span class="dgn-title-item-label">${item.label}</span>
                            <span class="dgn-title-item-badge" hidden></span>
                        </button>
                    `).join("")}
                </nav>
            </div>
            <section class="dgn-title-panel" aria-live="polite" hidden>
                <header class="dgn-title-panel-head">
                    <button type="button" class="dgn-title-back" aria-label="Back">
                        <span aria-hidden="true">&#9664;</span> BACK
                    </button>
                    <h2 class="dgn-title-panel-title"></h2>
                </header>
                <div class="dgn-title-panel-body"></div>
            </section>
            <div class="dgn-title-flash" aria-hidden="true"></div>
        `;
        document.body.appendChild(root);
        root.style.setProperty("z-index", "2147483646", "important");
        root.style.setProperty("pointer-events", "auto", "important");

        const items = Array.from(root.querySelectorAll(".dgn-title-item"));
        const panelEl = root.querySelector(".dgn-title-panel");
        const panelTitleEl = root.querySelector(".dgn-title-panel-title");
        let panelBodyEl = root.querySelector(".dgn-title-panel-body");
        let stage = "splash";
        let active = 0;
        let leaving = false;
        let panel = null;
        let confirmState = null;
        // Set once the SETUP check finds something to fix; NEW GAME and
        // CONTINUE point there once per visit.
        let setupNeedsAttention = false;
        let setupReminderShown = false;

        const setActive = (index, { silent = false } = {}) => {
            const next = (index + items.length) % items.length;
            if (next !== active && !silent) sfx("hover");
            active = next;
            items.forEach((el, i) => {
                el.classList.toggle("is-active", i === active);
                el.tabIndex = i === active ? 0 : -1;
            });
            if (stage === "menu") items[active]?.focus({ preventScroll: true });
        };

        const showMenu = () => {
            stage = "menu";
            root.classList.add("is-menu");
            root.classList.remove("is-panel");
            setActive(active, { silent: true });
        };

        const start = () => {
            if (stage !== "splash") return;
            sfx("open");
            try { onStart?.(); } catch (e) { console.warn("[Dangan][Title] onStart failed:", e); }
            showMenu();
            if (!initialPanel) maybeWelcomeBack();
        };

        // Players with data from an earlier version get offered the tutorials again.
        const maybeWelcomeBack = async () => {
            let show = false;
            try { show = !!services.shouldShowReturningNotice?.(); } catch { show = false; }
            if (!show) return;
            const { ok, checked } = await confirm({
                title: "Returning? Welcome back!",
                message: "A lot has changed since the last update and changes were made to make things less confusing. Would you like to reset the tutorials in order to see them again?",
                confirmLabel: "RESET TUTORIALS",
                cancelLabel: "NO THANKS",
                checkbox: "Don't show me again",
                className: "is-welcome-back",
            });
            try {
                if (ok) services.resetTutorials?.();
                if (ok || checked) services.dismissReturningNotice?.();
            } catch (e) {
                console.warn("[Dangan][Title] welcome back failed:", e);
            }
        };

        const unmountPanel = () => {
            if (!panel) return;
            try { panel.handle?.unmount?.(); } catch (e) { console.warn("[Dangan][Title] unmount failed:", e); }
            panel = null;
            // A fresh element, so the panel's event listeners go with it.
            const freshBody = panelBodyEl.cloneNode(false);
            panelBodyEl.replaceWith(freshBody);
            panelBodyEl = freshBody;
            panelEl.hidden = true;
            panelEl.className = "dgn-title-panel";
        };

        const backToMenu = () => {
            if (leaving) return;
            const previous = panel?.name;
            unmountPanel();
            sfx("close");
            showMenu();
            const idx = items.findIndex((el) => el.dataset.action === previous);
            if (idx >= 0) setActive(idx, { silent: true });
        };

        const close = async (after, result = panel?.name || "dismiss") => {
            if (leaving) return;
            leaving = true;
            root.classList.add("is-leaving");
            document.removeEventListener("keydown", onKey, true);
            await new Promise((r) => setTimeout(r, EXIT_DURATION_MS));
            unmountPanel();
            root.remove();
            try { await after?.(); } catch (e) { console.warn(`[Dangan][Title] ${result} failed:`, e); }
            try { await onClose?.(result); } catch (e) { console.warn("[Dangan][Title] onClose failed:", e); }
            resolve(result);
        };

        // With `checkbox` (a label) it resolves { ok, checked } instead of a boolean.
        const confirm = ({ title = "CONFIRM", message = "", confirmLabel = "OK", cancelLabel = "CANCEL", checkbox = "", className = "" } = {}) => {
            confirmState?.finish(false);
            return new Promise((done) => {
                const overlay = document.createElement("div");
                overlay.className = `dgn-title-confirm${className ? ` ${className}` : ""}`;
                overlay.innerHTML = `
                    <div class="dgn-title-confirm-box" role="alertdialog" aria-modal="true">
                        <div class="dgn-title-confirm-title"></div>
                        <p class="dgn-title-confirm-message"></p>
                        ${checkbox ? `<label class="dgn-title-confirm-check"><input type="checkbox"><span></span></label>` : ""}
                        <div class="dgn-title-confirm-actions">
                            <button type="button" class="dgn-title-btn" data-choice="cancel"></button>
                            <button type="button" class="dgn-title-btn is-primary" data-choice="ok"></button>
                        </div>
                    </div>
                `;
                overlay.querySelector(".dgn-title-confirm-title").textContent = title;
                overlay.querySelector(".dgn-title-confirm-message").textContent = message;
                const checkEl = overlay.querySelector(".dgn-title-confirm-check input");
                if (checkEl) checkEl.nextElementSibling.textContent = checkbox;
                const okBtn = overlay.querySelector('[data-choice="ok"]');
                const cancelBtn = overlay.querySelector('[data-choice="cancel"]');
                okBtn.textContent = confirmLabel;
                cancelBtn.textContent = cancelLabel;
                const previousFocus = document.activeElement;
                const finish = (value) => {
                    if (confirmState?.overlay !== overlay) return;
                    confirmState = null;
                    overlay.remove();
                    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
                    done(checkEl ? { ok: value, checked: checkEl.checked } : value);
                };
                confirmState = { overlay, finish, buttons: checkEl ? [cancelBtn, okBtn, checkEl] : [cancelBtn, okBtn] };
                overlay.addEventListener("click", (ev) => {
                    const btn = ev.target.closest?.("[data-choice]");
                    if (btn) {
                        sfx("click");
                        finish(btn.dataset.choice === "ok");
                    }
                });
                root.appendChild(overlay);
                okBtn.focus({ preventScroll: true });
                sfx("open");
            });
        };

        const openPanel = (name) => {
            const def = PANELS[name];
            if (!def || leaving) return;
            unmountPanel();
            stage = "panel";
            root.classList.add("is-panel");
            panelEl.hidden = false;
            panelEl.classList.add(`dgn-title-panel-${name}`);
            panelTitleEl.textContent = def.title;
            panel = { name, handle: null };
            const api = {
                services,
                sfx,
                confirm,
                back: backToMenu,
                close: (after) => close(after, name),
                openPanel,
                setTitle: (text) => { panelTitleEl.textContent = text; },
            };
            try {
                panel.handle = def.mount(panelBodyEl, api) || null;
            } catch (e) {
                console.warn(`[Dangan][Title] ${name} panel failed:`, e);
                panelBodyEl.innerHTML = `<div class="dgn-title-empty">Something went wrong opening this screen.</div>`;
            }
            requestAnimationFrame(() => {
                if (panelEl.contains(document.activeElement)) return;
                const first = panelBodyEl.querySelector("[autofocus], input, button, [tabindex='0']");
                (first || root.querySelector(".dgn-title-back"))?.focus({ preventScroll: true });
            });
        };

        const choose = async (action) => {
            if (leaving || stage !== "menu" || confirmState) return;
            sfx("click");
            if ((action === "newGame" || action === "continue") && setupNeedsAttention && !setupReminderShown) {
                setupReminderShown = true;
                const goToSetup = await confirm({
                    title: "CHECK SETUP?",
                    message: "Some things the game needs aren't set up yet. SETUP shows what's missing and takes you to each fix.",
                    confirmLabel: "OPEN SETUP",
                    cancelLabel: "CONTINUE ANYWAY",
                });
                if (leaving || stage !== "menu") return;
                openPanel(goToSetup ? "setup" : action);
                return;
            }
            openPanel(action);
        };

        function onConfirmKey(ev) {
            const { buttons, finish } = confirmState;
            const idx = buttons.indexOf(document.activeElement);
            const onCheckbox = idx === 2;
            if (ev.key === "Escape") {
                finish(false);
            } else if (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "Tab") {
                const step = ev.key === "ArrowLeft" || (ev.key === "Tab" && ev.shiftKey) ? -1 : 1;
                buttons[(Math.max(0, idx) + step + buttons.length) % buttons.length].focus({ preventScroll: true });
                sfx("hover");
            } else if (onCheckbox && (ev.key === "Enter" || ev.key === " ")) {
                buttons[2].checked = !buttons[2].checked;
                sfx("click");
            } else if (ev.key === "Enter" || ev.key === " ") {
                sfx("click");
                finish(idx === 1 || idx === -1);
            } else {
                return;
            }
            ev.preventDefault();
        }

        function onKey(ev) {
            if (!root.isConnected || leaving) return;
            // Keep SillyTavern's global hotkeys (and its type-to-focus) out of
            // the title screen; default actions such as typing still happen.
            ev.stopPropagation();

            if (confirmState) {
                onConfirmKey(ev);
                return;
            }
            if (stage === "splash") {
                if (["Tab", "Shift", "Control", "Alt", "Meta"].includes(ev.key)) return;
                ev.preventDefault();
                start();
                return;
            }
            if (stage === "panel") {
                if (ev.key === "Escape") {
                    ev.preventDefault();
                    if (!panel?.handle?.onBack?.()) backToMenu();
                    return;
                }
                let handled = false;
                try { handled = !!panel?.handle?.onKey?.(ev); } catch (e) { console.warn("[Dangan][Title] panel key failed:", e); }
                if (handled) ev.preventDefault();
                return;
            }
            const key = ev.key;
            if (key === "ArrowDown" || key === "s" || key === "S" || (key === "Tab" && !ev.shiftKey)) {
                setActive(active + 1);
            } else if (key === "ArrowUp" || key === "w" || key === "W" || (key === "Tab" && ev.shiftKey)) {
                setActive(active - 1);
            } else if (key === "Enter" || key === " ") {
                choose(items[active]?.dataset.action);
            } else {
                return;
            }
            ev.preventDefault();
        }

        document.addEventListener("keydown", onKey, true);

        root.addEventListener("click", (ev) => {
            if (stage === "splash") {
                start();
                return;
            }
            if (ev.target.closest?.(".dgn-title-back")) {
                if (panel?.handle?.onBack?.()) return;
                backToMenu();
                return;
            }
            const item = ev.target.closest?.(".dgn-title-item");
            if (item && stage === "menu") choose(item.dataset.action);
        });

        items.forEach((el, i) => {
            el.addEventListener("mouseenter", () => {
                if (stage === "menu" && !leaving) setActive(i);
            });
        });

        const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!root.isConnected) return;
            root.classList.add("is-on");
            root.focus({ preventScroll: true });
            try { onShown?.(); } catch (e) { console.warn("[Dangan][Title] onShown failed:", e); }
            if (skipSplash || initialPanel) start();
            if (PANELS[initialPanel]) openPanel(initialPanel);
        }));
        if (revealAfter) {
            root.classList.add("is-instant");
            Promise.resolve(revealAfter).catch(() => {}).then(reveal);
        } else {
            reveal();
        }

        // Count of setup requirements that are missing, on the SETUP item, and
        // a glow while anything besides sprites or Ultimates needs attention.
        Promise.resolve()
            .then(() => services.countSetupProblems?.())
            .then((count) => {
                const badge = root.querySelector('.dgn-title-item[data-action="setup"] .dgn-title-item-badge');
                if (!badge || !(count > 0)) return;
                badge.textContent = String(count);
                badge.hidden = false;
                badge.setAttribute("aria-label", `${count} setup ${count === 1 ? "problem" : "problems"}`);
            })
            .catch(() => { /* the badge is optional */ });
        Promise.resolve()
            .then(() => (services.isSetupPulseEnabled?.() === false ? 0 : services.countSetupReminders?.()))
            .then((count) => {
                if (!(count > 0) || !root.isConnected) return;
                setupNeedsAttention = true;
                root.querySelector('.dgn-title-item[data-action="setup"]')?.classList.add("is-pulsing");
            })
            .catch(() => { /* the glow is optional */ });
    });
}
