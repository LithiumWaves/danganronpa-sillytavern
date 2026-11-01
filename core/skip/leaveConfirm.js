// "Leave this minigame?" — asked before Escape backs out of a minigame. It
// sits above every minigame overlay and takes the keyboard while it's open.

export const LEAVE_CONFIRM_ID = "dangan-leave-confirm";

export function confirmLeaveMinigame(label = "THIS MINIGAME") {
    if (typeof document === "undefined") return Promise.resolve(false);
    document.getElementById(LEAVE_CONFIRM_ID)?.remove();

    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = LEAVE_CONFIRM_ID;
        root.setAttribute("role", "alertdialog");
        root.setAttribute("aria-modal", "true");
        root.innerHTML = `
            <div class="dgn-leave-box">
                <div class="dgn-leave-title"></div>
                <p class="dgn-leave-text">Nothing from it will be kept: Monocoins, XP and the trial go back to how they were.</p>
                <div class="dgn-leave-actions">
                    <button type="button" class="dgn-leave-btn" data-choice="stay">KEEP PLAYING</button>
                    <button type="button" class="dgn-leave-btn is-primary" data-choice="leave">LEAVE</button>
                </div>
            </div>
        `;
        root.querySelector(".dgn-leave-title").textContent = `LEAVE ${String(label).toUpperCase()}?`;
        document.body.appendChild(root);
        const buttons = [...root.querySelectorAll(".dgn-leave-btn")];
        buttons[0].focus({ preventScroll: true });

        const finish = (leave) => {
            window.removeEventListener("keydown", onKey, true);
            root.remove();
            resolve(leave);
        };

        function onKey(ev) {
            ev.stopImmediatePropagation();
            if (ev.key === "Escape") {
                ev.preventDefault();
                finish(false);
            } else if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                finish(document.activeElement === buttons[1]);
            } else if (["ArrowLeft", "ArrowRight", "Tab"].includes(ev.key)) {
                ev.preventDefault();
                (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus({ preventScroll: true });
            }
        }

        window.addEventListener("keydown", onKey, true);
        root.addEventListener("click", (ev) => {
            const btn = ev.target.closest?.("[data-choice]");
            if (btn) finish(btn.dataset.choice === "leave");
        });
    });
}
