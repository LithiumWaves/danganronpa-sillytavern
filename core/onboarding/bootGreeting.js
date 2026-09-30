export const BOOT_GREETING_ID = "dangan-boot-greeting";
export const MINIGAME_GUIDE_MODAL_ID = "dangan-minigame-guide-modal";

export function isBootGreetingBlocked() {
    if (typeof document === "undefined") return true;
    if (document.body?.classList?.contains("dangan-trial-active")) return true;
    if (document.getElementById(MINIGAME_GUIDE_MODAL_ID)) return true;
    if (document.getElementById(BOOT_GREETING_ID)) return true;
    return false;
}

export function maybeShowBootGreeting({
    isWelcomeSeen,
    markWelcomeSeen,
    isBlocked = isBootGreetingBlocked,
} = {}) {
    if (typeof isWelcomeSeen === "function" && isWelcomeSeen()) return Promise.resolve(false);
    if (typeof isBlocked === "function" && isBlocked()) return Promise.resolve(false);
    return showBootGreeting({ markWelcomeSeen });
}

export function showBootGreeting({ markWelcomeSeen } = {}) {
    if (typeof document === "undefined") return Promise.resolve(false);
    document.getElementById(BOOT_GREETING_ID)?.remove();

    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.id = BOOT_GREETING_ID;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "dangan-boot-greeting-title");
        modal.innerHTML = `
            <div class="dgn-boot-greeting-inner">
                <div class="dgn-boot-greeting-header">
                    <div class="dgn-boot-greeting-title" id="dangan-boot-greeting-title">TWO WAYS TO PLAY</div>
                </div>
                <div class="dgn-boot-greeting-body">
                    <div class="dgn-boot-greeting-modes">
                        <section class="dgn-boot-greeting-mode">
                            <h3>SEVERAL CHATS (DEFAULT)</h3>
                            <p>Talk to the Room, Grab Group, and sprite clicks each open or switch to their own chat. Use this for separate 1-on-1s, room threads, and trial chats.</p>
                        </section>
                        <section class="dgn-boot-greeting-mode">
                            <h3>ONE MAIN CHAT</h3>
                            <p>Keep a single group chat as the story and start each chapter in that same thread. Turn on <strong>Single-Chat Overworld</strong> in Settings → Gameplay: exploring stays in that chat, whoever is in the room is unmuted, everyone else is muted (install Presence so absentees forget those lines). Call Student brings people to you.</p>
                        </section>
                    </div>
                    <p class="dgn-boot-greeting-note">You can switch later. Class trials work in both styles.</p>
                </div>
                <div class="dgn-boot-greeting-footer">
                    <div class="dgn-boot-greeting-skip">
                        <button type="button" class="settings-toggle on" id="dangan-boot-greeting-dont-show" aria-pressed="true" aria-label="Don't show again"></button>
                        <span>Don't show again</span>
                    </div>
                    <button type="button" class="dgn-boot-greeting-continue">CONTINUE</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.setProperty("z-index", "2147483647", "important");
        modal.style.setProperty("pointer-events", "auto", "important");
        requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("is-on")));

        const toggle = modal.querySelector("#dangan-boot-greeting-dont-show");
        const setDontShow = (next) => {
            toggle?.classList.toggle("on", next);
            toggle?.setAttribute("aria-pressed", next ? "true" : "false");
        };
        modal.querySelector(".dgn-boot-greeting-skip")?.addEventListener("click", (ev) => {
            ev.preventDefault();
            setDontShow(!toggle?.classList.contains("on"));
        });

        modal.querySelector(".dgn-boot-greeting-continue")?.addEventListener("click", async () => {
            const persist = toggle?.classList.contains("on");
            if (persist) {
                try { markWelcomeSeen?.(); } catch { /* ignore */ }
            }
            modal.classList.remove("is-on");
            await new Promise((r) => setTimeout(r, 280));
            modal.remove();
            resolve(true);
        });
    });
}
