export function openMonopadConfirmDialog({ title = "CONFIRM ACTION", message = "", confirmLabel = "CONFIRM", cancelLabel = "CANCEL" } = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("monopad-confirm-overlay");
        const titleEl = document.getElementById("monopad-confirm-title");
        const messageEl = document.getElementById("monopad-confirm-message");
        const confirmBtn = document.getElementById("monopad-confirm-accept");
        const cancelBtn = document.getElementById("monopad-confirm-cancel");

        if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmLabel;
        cancelBtn.textContent = cancelLabel;

        let settled = false;
        const finish = (accepted) => {
            if (settled) return;
            settled = true;
            overlay.classList.remove("open");
            overlay.setAttribute("aria-hidden", "true");
            overlay.removeEventListener("click", onBackdropClick);
            confirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);
            resolve(Boolean(accepted));
        };

        const onBackdropClick = (event) => {
            if (event.target === overlay) finish(false);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);

        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");

        overlay.addEventListener("click", onBackdropClick);
        confirmBtn.addEventListener("click", onConfirm);
        cancelBtn.addEventListener("click", onCancel);
    });
}
