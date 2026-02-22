export function createClassTrialMenuController({ playSfx, getSfx } = {}) {
    const OVERLAY_ID = "dangan-class-trial-menu-overlay";

    function ensureOverlay() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.className = "dangan-class-trial-menu-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-class-trial-menu-window" role="dialog" aria-modal="true" aria-labelledby="dangan-class-trial-menu-title">
                <div class="dangan-class-trial-menu-kicker">CLASS TRIAL</div>
                <div class="dangan-class-trial-menu-title" id="dangan-class-trial-menu-title">BEGIN CLASS TRIAL?</div>
                <div class="dangan-class-trial-menu-subtitle"><span>Inspired by Danganronpa V3</span></div>
                <div class="dangan-class-trial-menu-actions">
                    <button type="button" class="dangan-class-trial-menu-button cancel" data-action="cancel">CANCEL</button>
                    <button type="button" class="dangan-class-trial-menu-button begin" data-action="begin">BEGIN CLASS TRIAL</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    function open() {
        return new Promise((resolve) => {
            const overlay = ensureOverlay();
            const beginButton = overlay.querySelector('[data-action="begin"]');
            const cancelButton = overlay.querySelector('[data-action="cancel"]');

            const cleanup = (accepted) => {
                overlay.classList.remove("open");
                overlay.setAttribute("aria-hidden", "true");
                overlay.removeEventListener("click", onBackdropClick);
                beginButton?.removeEventListener("click", onBegin);
                cancelButton?.removeEventListener("click", onCancel);
                resolve(Boolean(accepted));
            };

            const onBackdropClick = (event) => {
                if (event.target !== overlay) return;
                playSfx?.(getSfx?.().click);
                cleanup(false);
            };

            const onBegin = () => {
                playSfx?.(getSfx?.().click);
                cleanup(true);
            };

            const onCancel = () => {
                playSfx?.(getSfx?.().click);
                cleanup(false);
            };

            overlay.classList.add("open");
            overlay.setAttribute("aria-hidden", "false");
            overlay.addEventListener("click", onBackdropClick);
            beginButton?.addEventListener("click", onBegin);
            cancelButton?.addEventListener("click", onCancel);
        });
    }

    return { open };
}
