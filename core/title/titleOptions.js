import { escapeHtml, isTypingTarget } from "./titleUtils.js";

export const OPTION_SECTIONS = Object.freeze([
    {
        title: "AUDIO",
        rows: [
            { key: "monopadVolume", label: "SOUND EFFECTS VOLUME", type: "slider", fallback: 50, preview: true },
            { key: "announcementVolume", label: "ANNOUNCEMENT VOLUME", type: "slider", fallback: 65 },
            { key: "monomonoBgmVolume", label: "MONOMONO BGM VOLUME", type: "slider", fallback: 40 },
            { key: "monokumaLanguage", label: "ANNOUNCEMENT VOICE", type: "choice", fallback: "JP", choices: [{ value: "EN", label: "EN" }, { value: "JP", label: "JP" }] },
            { key: "monopadJingleEnabled", label: "MONOPAD JINGLE", type: "toggle", fallback: true },
            { key: "dynamicSongsEnabled", label: "DYNAMIC SONGS", type: "toggle", fallback: false, note: "Pick mood music from the sprites on screen." },
        ],
    },
    {
        title: "DISPLAY",
        rows: [
            { key: "titleScreenEnabled", label: "TITLE SCREEN ON LOAD", type: "toggle", fallback: true, note: "/title opens it any time." },
            { key: "setupPulseEnabled", label: "SETUP REMINDER", type: "toggle", fallback: true, note: "SETUP glows when something needs attention." },
            { key: "bootAnimations", label: "BOOT ANIMATIONS", type: "toggle", fallback: true },
            { key: "crtEffects", label: "CRT EFFECTS", type: "toggle", fallback: true },
            { key: "crtIntensity", label: "CRT INTENSITY", type: "slider", fallback: 35 },
            { key: "vnModeEnabled", label: "VISUAL NOVEL MODE", type: "toggle", fallback: false },
            { key: "vnSkin", label: "TEXT BOX STYLE", type: "choice", fallback: "current", choices: [{ value: "current", label: "CURRENT" }, { value: "thh", label: "DR1" }, { value: "sdr2", label: "DR2" }, { value: "v3", label: "V3" }] },
            { key: "dynamicThemes", label: "DAILY / DEADLY LIFE THEMES", type: "toggle", fallback: true },
        ],
    },
    {
        title: "GAMEPLAY",
        rows: [
            { key: "singleChatOverworldEnabled", label: "SINGLE-CHAT OVERWORLD", type: "toggle", fallback: false, note: "One main chat: room occupants unmuted, everyone else muted." },
            { key: "rewardDifficulty", label: "REWARD DIFFICULTY", type: "choice", fallback: "normal", choicesFrom: "rewardDifficulty" },
            { key: "minigameTutorialsEnabled", label: "MINIGAME TUTORIALS", type: "toggle", fallback: true },
            { key: "featureCoachesEnabled", label: "LESSON HINTS", type: "toggle", fallback: true },
        ],
    },
]);

const SLIDER_STEP = 5;

function readValue(services, row) {
    let value;
    try { value = services.settings?.get?.(row.key); } catch { value = undefined; }
    if (value === undefined || value === null || value === "") return row.fallback;
    if (row.type === "slider") return Math.max(0, Math.min(100, Number(value) || 0));
    if (row.type === "toggle") return value !== false;
    return value;
}

function choicesFor(services, row) {
    if (row.choices) return row.choices;
    try { return services.getChoices?.(row.choicesFrom) || []; } catch { return []; }
}

export function cycleChoice(choices, current, dir) {
    if (!choices.length) return current;
    const idx = choices.findIndex((c) => c.value === current);
    const next = (Math.max(0, idx) + dir + choices.length) % choices.length;
    return choices[idx < 0 ? 0 : next].value;
}

export function mountOptionsPanel(container, api) {
    const { services, sfx, close } = api;
    const rows = OPTION_SECTIONS.flatMap((s) => s.rows);

    const renderControl = (row) => {
        const value = readValue(services, row);
        if (row.type === "toggle") {
            return `<button type="button" class="dgn-title-switch${value ? " is-on" : ""}" role="switch" aria-checked="${value}" aria-label="${escapeHtml(row.label)}"><span></span></button>`;
        }
        if (row.type === "slider") {
            return `
                <span class="dgn-title-slider">
                    <input type="range" min="0" max="100" step="1" value="${value}" aria-label="${escapeHtml(row.label)}">
                    <output>${value}</output>
                </span>`;
        }
        const choices = choicesFor(services, row);
        const label = choices.find((c) => c.value === value)?.label ?? String(value);
        return `
            <span class="dgn-title-choice">
                <button type="button" class="dgn-title-choice-arrow" data-dir="-1" tabindex="-1" aria-label="Previous">&#9664;</button>
                <span class="dgn-title-choice-value" tabindex="0" role="spinbutton" aria-label="${escapeHtml(row.label)}">${escapeHtml(label)}</span>
                <button type="button" class="dgn-title-choice-arrow" data-dir="1" tabindex="-1" aria-label="Next">&#9654;</button>
            </span>`;
    };

    container.innerHTML = `
        <div class="dgn-title-options">
            ${OPTION_SECTIONS.map((section) => `
                <section class="dgn-title-options-section">
                    <h3>${section.title}</h3>
                    ${section.rows.map((row) => `
                        <div class="dgn-title-option" data-key="${row.key}" data-type="${row.type}">
                            <span class="dgn-title-option-label">
                                ${escapeHtml(row.label)}
                                ${row.note ? `<small>${escapeHtml(row.note)}</small>` : ""}
                            </span>
                            <span class="dgn-title-option-control">${renderControl(row)}</span>
                        </div>
                    `).join("")}
                </section>
            `).join("")}
            <div class="dgn-title-options-foot">
                <span class="dgn-title-note">Changes save immediately.</span>
                <button type="button" class="dgn-title-btn" data-all-settings>ALL SETTINGS (MONOPAD)</button>
            </div>
        </div>
    `;

    const rowFor = (el) => rows.find((r) => r.key === el?.closest?.(".dgn-title-option")?.dataset.key);
    const refreshRow = (row) => {
        const host = container.querySelector(`.dgn-title-option[data-key="${row.key}"] .dgn-title-option-control`);
        if (!host) return;
        const focusedInside = host.contains(document.activeElement);
        host.innerHTML = renderControl(row);
        if (focusedInside) host.querySelector("button[role='switch'], input, [tabindex='0']")?.focus({ preventScroll: true });
    };
    const write = (row, value) => {
        try { services.settings?.set?.(row.key, value); } catch (e) { console.warn(`[Dangan][Title] setting ${row.key} failed:`, e); }
    };

    const toggle = (row) => {
        write(row, !readValue(services, row));
        sfx("click");
        refreshRow(row);
    };
    const cycle = (row, dir) => {
        write(row, cycleChoice(choicesFor(services, row), readValue(services, row), dir));
        sfx("hover");
        refreshRow(row);
    };
    const nudge = (row, dir) => {
        const next = Math.max(0, Math.min(100, readValue(services, row) + dir * SLIDER_STEP));
        write(row, next);
        refreshRow(row);
        if (row.preview) sfx("hover");
    };

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest?.("[data-all-settings]")) {
            sfx("click");
            close(() => services.openMonopadSettings?.());
            return;
        }
        const row = rowFor(t);
        if (!row) return;
        if (row.type === "toggle" && t.closest(".dgn-title-switch, .dgn-title-option-label")) toggle(row);
        else if (row.type === "choice") {
            const arrow = t.closest(".dgn-title-choice-arrow");
            if (arrow) cycle(row, Number(arrow.dataset.dir));
            else if (t.closest(".dgn-title-choice-value, .dgn-title-option-label")) cycle(row, 1);
        }
    });

    container.addEventListener("input", (ev) => {
        const t = ev.target;
        if (t.type !== "range") return;
        const row = rowFor(t);
        if (!row) return;
        const value = Number(t.value);
        t.nextElementSibling.textContent = String(value);
        write(row, value);
    });
    container.addEventListener("change", (ev) => {
        const row = rowFor(ev.target);
        if (row?.preview) sfx("hover");
    });

    const focusables = () => Array.from(container.querySelectorAll(
        ".dgn-title-switch, .dgn-title-slider input, .dgn-title-choice-value, [data-all-settings]",
    ));

    return {
        onKey(ev) {
            if (isTypingTarget(ev.target)) return false;
            const list = focusables();
            const idx = list.indexOf(ev.target);
            if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
                const next = list[Math.max(0, Math.min(list.length - 1, (idx < 0 ? -1 : idx) + (ev.key === "ArrowDown" ? 1 : -1)))];
                if (next && next !== ev.target) sfx("hover");
                next?.focus({ preventScroll: false });
                next?.scrollIntoView?.({ block: "nearest" });
                return true;
            }
            const row = rowFor(ev.target);
            if (!row) return false;
            if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
                const dir = ev.key === "ArrowRight" ? 1 : -1;
                if (row.type === "slider") nudge(row, dir);
                else if (row.type === "choice") cycle(row, dir);
                else if (row.type === "toggle" && readValue(services, row) !== (dir > 0)) toggle(row);
                return true;
            }
            if ((ev.key === "Enter" || ev.key === " ") && row.type === "choice") {
                cycle(row, 1);
                return true;
            }
            return false;
        },
    };
}
