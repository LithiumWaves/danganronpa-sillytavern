import { escapeHtml } from "./titleUtils.js";

const STATUS_ICON = Object.freeze({ ok: "✓", warn: "!", missing: "✕", skip: "–" });
const STATUS_TEXT = Object.freeze({ ok: "READY", warn: "CHECK", missing: "NEEDED", skip: "N/A" });

// Fixes that stay inside the title screen instead of closing it.
const IN_TITLE_FIXES = Object.freeze({ newGame: "newGame", continue: "continue" });

export function mountSetupPanel(container, api) {
    const { services, sfx, close } = api;
    container.innerHTML = `
        <div class="dgn-title-setup">
            <p class="dgn-title-note">What the game needs from SillyTavern. FIX takes you to the place to change it.</p>
            <div class="dgn-title-setup-list" role="list">
                <div class="dgn-title-empty">CHECKING…</div>
            </div>
            <div class="dgn-title-options-foot">
                <span class="dgn-title-setup-summary dgn-title-note"></span>
                <button type="button" class="dgn-title-btn" data-recheck>RECHECK</button>
            </div>
        </div>
    `;
    const listEl = container.querySelector(".dgn-title-setup-list");
    const summaryEl = container.querySelector(".dgn-title-setup-summary");
    let rows = [];
    let disposed = false;
    let run = 0;

    const render = () => {
        listEl.innerHTML = rows.map((row, i) => `
            <div class="dgn-title-setup-row is-${row.status}" role="listitem">
                <span class="dgn-title-setup-icon" aria-hidden="true">${STATUS_ICON[row.status] || "?"}</span>
                <span class="dgn-title-setup-main">
                    <span class="dgn-title-setup-label">${escapeHtml(row.label)}
                        <span class="dgn-title-setup-status">${STATUS_TEXT[row.status] || ""}</span>
                    </span>
                    <span class="dgn-title-setup-detail">${escapeHtml(row.detail)}</span>
                </span>
                ${row.status === "ok" || row.status === "skip" || !row.fix ? "" : `
                    <button type="button" class="dgn-title-btn is-small${row.status === "missing" ? " is-primary" : ""}" data-fix="${i}">${escapeHtml(row.fixLabel || "FIX")}</button>
                `}
            </div>
        `).join("");
        const missing = rows.filter((r) => r.status === "missing").length;
        const warn = rows.filter((r) => r.status === "warn").length;
        summaryEl.textContent = missing ? `${missing} needed, ${warn} to check.`
            : warn ? `Ready to play. ${warn} optional ${warn === 1 ? "item" : "items"} to check.`
            : "Everything is set up.";
    };

    const check = async () => {
        const mine = ++run;
        listEl.innerHTML = `<div class="dgn-title-empty">CHECKING…</div>`;
        summaryEl.textContent = "";
        try {
            const result = await services.getSetupRows?.();
            if (disposed || mine !== run) return;
            rows = Array.isArray(result) ? result : [];
            render();
        } catch (e) {
            console.warn("[Dangan][Title] setup check failed:", e);
            if (disposed || mine !== run) return;
            listEl.innerHTML = `<div class="dgn-title-empty">COULDN'T RUN THE CHECKS. See the console for details.</div>`;
        }
    };

    container.addEventListener("click", (ev) => {
        if (ev.target.closest?.("[data-recheck]")) {
            sfx("click");
            check();
            return;
        }
        const btn = ev.target.closest?.("[data-fix]");
        if (!btn) return;
        const row = rows[Number(btn.dataset.fix)];
        if (!row) return;
        sfx("click");
        const inTitle = IN_TITLE_FIXES[row.fix];
        if (inTitle) api.openPanel(inTitle);
        else close(() => services.runSetupFix?.(row.fix));
    });

    check();

    return {
        unmount() { disposed = true; },
        onKey(ev) {
            if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return false;
            const buttons = Array.from(container.querySelectorAll("button"));
            const idx = buttons.indexOf(document.activeElement);
            const next = buttons[Math.max(0, Math.min(buttons.length - 1, idx + (ev.key === "ArrowDown" ? 1 : -1)))];
            if (next && next !== document.activeElement) sfx("hover");
            next?.focus({ preventScroll: false });
            return true;
        },
    };
}
