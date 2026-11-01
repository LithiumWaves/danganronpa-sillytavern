import { escapeHtml, isTypingTarget, stepFocus } from "./titleUtils.js";

// SETUP → PERSONA. Pick who you play as, or make a new persona, without
// leaving the title screen.
export function mountPersonaPanel(container, api) {
    const { services, sfx } = api;
    let personas = { list: [], current: "" };
    let creating = false;
    let busy = false;
    let error = "";

    const renderList = () => {
        api.setTitle("PERSONA");
        const { list, current } = personas;
        container.innerHTML = `
            <p class="dgn-title-note">Your persona is the character you play as. Pick one, or make a new one.</p>
            ${list.length ? `
                <div class="dgn-title-personas">
                    ${list.map((p) => `
                        <button type="button" class="dgn-title-persona${p.key === current ? " is-on" : ""}" data-persona="${escapeHtml(p.key)}" aria-pressed="${p.key === current}"${busy ? " disabled" : ""}>
                            ${p.avatarUrl ? `<img src="${escapeHtml(p.avatarUrl)}" alt="" loading="lazy" draggable="false">` : ""}
                            <span>${escapeHtml(p.name)}</span>
                        </button>`).join("")}
                </div>` : `<div class="dgn-title-empty">NO PERSONAS YET.</div>`}
            <div class="dgn-title-options-foot">
                <span class="dgn-title-note" aria-live="polite">${escapeHtml(error)}</span>
                <button type="button" class="dgn-title-btn is-primary" data-new-persona>NEW PERSONA</button>
            </div>
        `;
    };

    const renderForm = () => {
        api.setTitle("NEW PERSONA");
        container.innerHTML = `
            <label class="dgn-title-field">
                <span>NAME</span>
                <input type="text" class="dgn-title-input" data-persona-name maxlength="80" autocomplete="off" autofocus>
            </label>
            <label class="dgn-title-field">
                <span>DESCRIPTION</span>
                <textarea class="dgn-title-input" data-persona-desc rows="4" placeholder="Who they are, how they look. The AI reads this."></textarea>
            </label>
            <div class="dgn-title-field">
                <span>PICTURE (OPTIONAL)</span>
                <div class="dgn-title-toolbar">
                    <button type="button" class="dgn-title-btn" data-pick-picture>CHOOSE PICTURE</button>
                    <span class="dgn-title-note" data-picture-name>No picture chosen.</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-persona-file>
                </div>
            </div>
            <div class="dgn-title-options-foot">
                <span class="dgn-title-note" aria-live="polite">${escapeHtml(error)}</span>
                <button type="button" class="dgn-title-btn" data-cancel-persona>CANCEL</button>
                <button type="button" class="dgn-title-btn is-primary" data-create-persona${busy ? " disabled" : ""}>CREATE</button>
            </div>
        `;
        requestAnimationFrame(() => container.querySelector("[data-persona-name]")?.focus({ preventScroll: true }));
    };

    const render = () => (creating ? renderForm() : renderList());

    const load = () => {
        try { personas = services.getPersonas?.() || { list: [], current: "" }; } catch (e) { console.warn("[Dangan][Title] personas failed:", e); }
        render();
    };

    const pick = async (key) => {
        if (busy || key === personas.current) return;
        busy = true;
        error = "";
        try {
            await services.setPersona?.(key);
            sfx("click");
        } catch (e) {
            console.warn("[Dangan][Title] switching persona failed:", e);
            error = "Couldn't switch persona.";
        }
        busy = false;
        load();
    };

    const create = async () => {
        if (busy) return;
        const name = String(container.querySelector("[data-persona-name]")?.value || "").trim();
        if (!name) {
            error = "Give the persona a name.";
            sfx("close");
            renderForm();
            return;
        }
        const description = String(container.querySelector("[data-persona-desc]")?.value || "");
        const file = container.querySelector("[data-persona-file]")?.files?.[0] || null;
        busy = true;
        error = "";
        try {
            await services.createPersona?.({ name, description, file });
            creating = false;
            sfx("click");
        } catch (e) {
            console.warn("[Dangan][Title] creating persona failed:", e);
            error = "Couldn't create the persona.";
        }
        busy = false;
        load();
    };

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        const persona = t.closest?.("[data-persona]");
        if (persona) { pick(persona.dataset.persona); return; }
        if (t.closest?.("[data-new-persona]")) { sfx("click"); creating = true; error = ""; render(); return; }
        if (t.closest?.("[data-cancel-persona]")) { sfx("close"); creating = false; error = ""; render(); return; }
        if (t.closest?.("[data-pick-picture]")) { sfx("click"); container.querySelector("[data-persona-file]")?.click(); return; }
        if (t.closest?.("[data-create-persona]")) create();
    });

    container.addEventListener("change", (ev) => {
        if (!ev.target.matches?.("[data-persona-file]")) return;
        const nameEl = container.querySelector("[data-picture-name]");
        if (nameEl) nameEl.textContent = ev.target.files?.[0]?.name || "No picture chosen.";
    });

    load();

    return {
        onBack() {
            if (creating) {
                sfx("close");
                creating = false;
                error = "";
                render();
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
