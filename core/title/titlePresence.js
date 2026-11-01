import { escapeHtml } from "./titleUtils.js";

// SETUP → install an extension from inside the title screen. SillyTavern
// loads new extensions on the next page load.
function mountExtensionInstallPanel(container, api, { title, notes, url, isInstalled, install, installedText }) {
    const { sfx } = api;
    let state = isInstalled?.() ? "installed" : "idle"; // idle | busy | done | installed | failed
    let message = "";

    const render = () => {
        api.setTitle(title);
        container.innerHTML = `
            ${notes.map((note) => `<p class="dgn-title-note">${escapeHtml(note)}</p>`).join("")}
            <p class="dgn-title-note">${escapeHtml(url || "")}</p>
            <div class="dgn-title-options-foot">
                <span class="dgn-title-note" aria-live="polite">${escapeHtml(
                    state === "installed" ? installedText
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
            api.services.reloadPage?.();
            return;
        }
        if (!ev.target.closest?.("[data-install]") || state === "busy") return;
        sfx("click");
        state = "busy";
        render();
        let result = null;
        try { result = await install?.(); } catch (e) { result = { ok: false, error: String(e?.message || e) }; }
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

// One Main Chat uses Presence so characters outside the room don't hear
// what was said.
export function mountPresencePanel(container, api) {
    const { services } = api;
    return mountExtensionInstallPanel(container, api, {
        title: "PRESENCE EXTENSION",
        notes: ["One Main Chat keeps the whole cast in one group chat. Presence makes characters outside the room forget what they didn't hear. Without it, muted characters still read the whole chat."],
        url: services.presenceUrl,
        isInstalled: services.isPresenceInstalled,
        install: services.installPresence,
        installedText: "Presence is installed.",
    });
}

// Prome's user sprite is where your own character's sprites come from.
export function mountPromePanel(container, api) {
    const { services } = api;
    return mountExtensionInstallPanel(container, api, {
        title: "PROME EXTENSION",
        notes: [
            "Your character's sprites come from Prome's user sprite: Class Trials, minigames, your sprite in conversations and the Sprite Manager all read it. Without Prome, your character has no sprite.",
            "After installing and reloading, open Prome's settings, turn on User Sprite and pick the folder with your sprites.",
        ],
        url: services.promeUrl,
        isInstalled: services.isPromeInstalled,
        install: services.installProme,
        installedText: "Prome is installed. Pick your user sprite in its settings.",
    });
}
