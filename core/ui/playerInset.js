// Your sprite in conversations (Settings → Customize → "Your sprite in
// conversations"): a slanted window on the right of the screen, like the
// one Killing Harmony shows the protagonist in, with the player's sprite
// from Prome's user sprite folder. Its expression follows your last message.
//
// index.js decides when it may show (setting on, VN mode, a sprite folder)
// and calls update(); styles/systems/vn/player-inset.css shows the window
// only while a conversation is open and no Class Trial is running.

const INSET_ID = "dangan-player-inset";

export function createPlayerInset({ getSpriteUrl, classify, getLastUserMessage }) {
    let enabled = false;
    let label = "neutral";
    let token = 0;

    function ensureEl() {
        let el = document.getElementById(INSET_ID);
        if (el) return el;
        el = document.createElement("div");
        el.id = INSET_ID;
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = `
            <div class="dangan-player-inset-frame">
                <div class="dangan-player-inset-window">
                    <img class="dangan-player-inset-sprite" alt="" draggable="false">
                </div>
            </div>
            <div class="dangan-player-inset-stripes"></div>
        `;
        const img = el.querySelector("img");
        img.addEventListener("error", () => el.classList.remove("has-sprite"));
        img.addEventListener("load", () => el.classList.add("has-sprite"));
        document.body.appendChild(el);
        return el;
    }

    async function showLabel(next) {
        label = next || "neutral";
        if (!enabled) return;
        const mine = ++token;
        let url = null;
        try { url = await getSpriteUrl(label); } catch { url = null; }
        if (mine !== token || !enabled) return;
        const el = ensureEl();
        const img = el.querySelector("img");
        if (!url) {
            el.classList.remove("has-sprite");
            img.removeAttribute("src");
            return;
        }
        if (img.getAttribute("src") !== url) img.src = url;
        else el.classList.add("has-sprite");
    }

    // The expression of your message, or neutral when it can't be told.
    async function expressionFor(text) {
        const clean = String(text || "").trim();
        if (!clean) return "neutral";
        try { return (await classify(clean)) || "neutral"; } catch { return "neutral"; }
    }

    return {
        setEnabled(on) {
            const next = !!on;
            document.body.classList.toggle("dangan-player-inset-on", next);
            if (next === enabled) return;
            enabled = next;
            if (enabled) {
                ensureEl();
                showLabel(label);
            } else {
                token += 1;
            }
        },
        // A message you just sent: show its expression.
        async onUserMessage(text) {
            if (!enabled) return;
            const mine = ++token;
            const next = await expressionFor(text);
            if (mine !== token) return;
            showLabel(next);
        },
        // A different chat: start from your last message in it.
        async onChatChanged() {
            if (!enabled) return;
            const mine = ++token;
            const next = await expressionFor(getLastUserMessage());
            if (mine !== token) return;
            showLabel(next);
        },
        refresh() {
            if (enabled) showLabel(label);
        },
    };
}
