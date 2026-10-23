import { escapeHtml } from "./titleUtils.js";

// SETUP → PRESENCE. Installs the Presence extension (One Main Chat uses it
// so characters outside the room don't hear what was said) from inside the
// title screen. SillyTavern loads new extensions on the next page load.
export function mountPresencePanel(container, api) {
    const { services, sfx } = api;
    let state = services.isPresenceInstalled?.() ? "installed" : "idle"; // idle | busy | done | installed | failed
    let message = "";

    const render = () => {
        api.setTitle("PRESENCE EXTENSION");
        const url = services.presenceUrl || "";
        container.innerHTML = `
            <p class="dgn-title-note">One Main Chat keeps the whole cast in one group chat. Presence makes characters outside the room forget what they didn't hear. Without it, muted characters still read the whole chat.</p>
            <p class="dgn-title-note">${escapeHtml(url)}</p>
            <div class="dgn-title-options-foot">
                <span class="dgn-title-note" aria-live="polite">${escapeHtml(
                    state === "installed" ? "Presence is installed."
                    : state === "busy" ? "INSTALLING…"
                    : state === "done" ? "Installed. Reload SillyTavern to turn it on."
                    : message)}</span>
                ${state === "done"
                    ? `<button type="button" class="dgn-title-btn is-primary" data-reload>RELOAD</button>`
                    : state === "installed" ? ""
                    : `<button type="button" class="dgn-title-btn is-primary" data-install${state === "busy" ? " disabled" : ""}>INSTALL</button>`}
            </div>
        `;
    };

    container.addEventListener("click", async (ev) => {
        if (ev.target.closest?.("[data-reload]")) {
            sfx("click");
            services.reloadPage?.();
            return;
        }
        if (!ev.target.closest?.("[data-install]") || state === "busy") return;
        sfx("click");
        state = "busy";
        render();
        let result = null;
        try { result = await services.installPresence?.(); } catch (e) { result = { ok: false, error: String(e?.message || e) }; }
        state = result?.ok ? "done" : "failed";
        message = result?.ok ? "" : `Couldn't install it${result?.error ? `: ${result.error}` : "."}`;
        sfx(result?.ok ? "click" : "close");
        render();
    });

    render();

    return {
        onBack() {
            api.openPanel("setup");
            return true;
        },
    };
}
