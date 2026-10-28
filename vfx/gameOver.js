// GAME OVER, when the player is punished by death (a grave School
// Regulation). UNDO rewinds to before the violation; CONTINUE goes on as
// someone else: another persona, or a classmate from the roster.

const STYLE_ID = "dangan-gameover-style";
const ROOT_ID = "dangan-gameover";
const PICK_ID = "dangan-gameover-pick";

const CSS = `
#${ROOT_ID}, #${PICK_ID} {
    position: fixed; inset: 0; z-index: 100062; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 22px; padding: 16px; box-sizing: border-box;
    background: radial-gradient(ellipse at 50% 45%, rgba(70, 0, 30, 0.95), rgba(0, 0, 0, 0.99));
    color: #fff; font-family: inherit; animation: dgo-in 0.8s ease;
}
#${ROOT_ID} .dgo-title {
    font-size: clamp(2.4rem, 11vw, 6rem); font-weight: 900; letter-spacing: 0.18em; color: #ff1f8e;
    text-shadow: 0 0 18px rgba(255, 31, 142, 0.7), 0 6px 0 #4a0020; animation: dgo-shake 0.5s ease 0.2s;
}
#${ROOT_ID} .dgo-sub { letter-spacing: 0.2em; text-align: center; font-size: clamp(0.9rem, 3vw, 1.2rem); }
#${ROOT_ID} .dgo-note { max-width: 560px; text-align: center; color: #d9c4e6; line-height: 1.5; font-size: 0.9rem; }
#${ROOT_ID} .dgo-choices, #${PICK_ID} .dgo-foot { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
#${ROOT_ID} button, #${PICK_ID} button {
    font: inherit; letter-spacing: 0.2em; cursor: pointer; border-radius: 6px; padding: 12px 26px; font-size: 1rem;
    background: transparent; color: #fff; border: 2px solid rgba(255, 182, 222, 0.7);
}
#${ROOT_ID} button:hover, #${PICK_ID} button:hover { background: rgba(255, 31, 142, 0.25); }
#${ROOT_ID} button.dgo-primary, #${PICK_ID} button.dgo-primary { border-color: #ff1f8e; background: rgba(255, 31, 142, 0.35); }
#${PICK_ID} .dgo-pick-title { font-size: 1.3rem; letter-spacing: 0.2em; color: #ff1f8e; }
#${PICK_ID} .dgo-pick-note { color: #d9c4e6; font-size: 0.85rem; text-align: center; max-width: 560px; }
#${PICK_ID} .dgo-section { width: min(760px, 100%); font-size: 0.72rem; letter-spacing: 0.14em; color: #ffd23f; }
#${PICK_ID} .dgo-grid { width: min(760px, 100%); display: flex; flex-wrap: wrap; gap: 10px; max-height: 30vh; overflow: auto; }
#${PICK_ID} .dgo-card {
    display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; font-size: 0.85rem; letter-spacing: 0.04em;
    border: 1px solid rgba(255, 182, 222, 0.45); border-radius: 999px;
}
#${PICK_ID} .dgo-card img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
#${PICK_ID} .dgo-card.is-on { border-color: #ff1f8e; background: rgba(255, 31, 142, 0.3); }
#${PICK_ID} .dgo-empty { color: #bfa9cc; font-size: 0.85rem; }
@keyframes dgo-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes dgo-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// { name } → Promise<"undo" | "continue">
export function openGameOver({ name = "" } = {}) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = ROOT_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Game over");
        root.innerHTML = `
            <div class="dgo-title">GAME OVER</div>
            <div class="dgo-sub">${esc(String(name || "You").toUpperCase())} HAS BEEN PUNISHED</div>
            <div class="dgo-note">UNDO rewinds the story to before the violation. CONTINUE goes on without you: play on as another persona, or as one of your classmates.</div>
            <div class="dgo-choices"><button type="button" class="dgo-undo">UNDO</button><button type="button" class="dgo-primary dgo-continue">CONTINUE</button></div>`;
        document.body.appendChild(root);
        const pick = (choice) => {
            root.remove();
            resolve(choice);
        };
        root.querySelector(".dgo-undo").addEventListener("click", () => pick("undo"));
        root.querySelector(".dgo-continue").addEventListener("click", () => pick("continue"));
    });
}

// Who to play as next. personas: [{ key, name, avatarUrl }], classmates:
// [{ name, avatarUrl }]. Resolves { type: "persona", key } |
// { type: "classmate", name } | null (back).
export function openSuccessorPicker({ personas = [], classmates = [] } = {}) {
    ensureStyle();
    document.getElementById(PICK_ID)?.remove();
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = PICK_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Who do you play as now?");
        const card = (kind, id, label, avatarUrl) => `<button type="button" class="dgo-card" data-kind="${kind}" data-id="${esc(id)}">${avatarUrl ? `<img src="${esc(avatarUrl)}" alt="" loading="lazy">` : ""}<span>${esc(label)}</span></button>`;
        root.innerHTML = `
            <div class="dgo-pick-title">WHO DO YOU PLAY AS NOW?</div>
            <div class="dgo-pick-note">A classmate becomes your persona, made from their card, and the AI stops speaking for them.</div>
            <div class="dgo-section">YOUR CLASSMATES</div>
            <div class="dgo-grid">${classmates.map((c) => card("classmate", c.name, c.name, c.avatarUrl)).join("") || `<div class="dgo-empty">Nobody is left.</div>`}</div>
            <div class="dgo-section">YOUR PERSONAS</div>
            <div class="dgo-grid">${personas.map((p) => card("persona", p.key, p.name, p.avatarUrl)).join("") || `<div class="dgo-empty">No other personas.</div>`}</div>
            <div class="dgo-foot"><button type="button" class="dgo-back">BACK</button><button type="button" class="dgo-primary dgo-go" disabled>PLAY AS THEM</button></div>`;
        document.body.appendChild(root);
        let chosen = null;
        const go = root.querySelector(".dgo-go");
        root.querySelectorAll(".dgo-card").forEach((btn) => btn.addEventListener("click", () => {
            root.querySelectorAll(".dgo-card").forEach((b) => b.classList.toggle("is-on", b === btn));
            chosen = btn.dataset.kind === "persona" ? { type: "persona", key: btn.dataset.id } : { type: "classmate", name: btn.dataset.id };
            go.disabled = false;
        }));
        const done = (value) => {
            root.remove();
            resolve(value);
        };
        root.querySelector(".dgo-back").addEventListener("click", () => done(null));
        go.addEventListener("click", () => done(chosen));
    });
}
