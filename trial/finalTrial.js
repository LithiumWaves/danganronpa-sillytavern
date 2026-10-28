// The end of the final trial: the mastermind exposed (or not), and the
// students' last choice, HOPE or DESPAIR, as at the end of DR1 and V3. Also
// the white flash of a Flashback Light. Pure DOM, no game state.

const STYLE_ID = "dangan-final-style";
const ENDING_ID = "dangan-ending-choice";
const FLASH_ID = "dangan-flashback-flash";

const CSS = `
#${ENDING_ID} {
    position: fixed; inset: 0; z-index: 100055; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 28px; padding: 16px; box-sizing: border-box;
    background: radial-gradient(ellipse at 50% 40%, rgba(40, 6, 30, 0.96), rgba(0, 0, 0, 0.98));
    color: #fff; font-family: inherit; animation: dfe-in 0.6s ease;
}
#${ENDING_ID} .dfe-title { font-size: clamp(1.2rem, 4vw, 2.2rem); letter-spacing: 0.2em; text-align: center; }
#${ENDING_ID} .dfe-sub { max-width: 640px; text-align: center; color: #d9c4e6; line-height: 1.5; font-size: 0.95rem; }
#${ENDING_ID} .dfe-choices { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
#${ENDING_ID} button {
    width: min(280px, 80vw); padding: 22px 12px; font: inherit; font-size: clamp(1.4rem, 5vw, 2.4rem);
    letter-spacing: 0.3em; font-weight: 900; cursor: pointer; border-radius: 6px; transition: transform 0.15s, box-shadow 0.15s;
}
#${ENDING_ID} button:hover { transform: scale(1.05); }
#${ENDING_ID} .dfe-hope { background: #f7f3e8; color: #1c2a4a; border: 3px solid #fff; box-shadow: 0 0 24px rgba(255, 255, 220, 0.6); }
#${ENDING_ID} .dfe-despair { background: #120008; color: #ff1f8e; border: 3px solid #ff1f8e; box-shadow: 0 0 24px rgba(255, 31, 142, 0.6); }
#${FLASH_ID} { position: fixed; inset: 0; z-index: 100058; background: #fff; pointer-events: none; animation: dfe-flash 1.6s ease forwards; }
@keyframes dfe-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes dfe-flash { 0% { opacity: 0; } 12% { opacity: 1; } 55% { opacity: 1; } 100% { opacity: 0; } }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// { mastermind, correct } → Promise<"hope" | "despair">
export function openEndingChoice({ mastermind = "", correct = true } = {}) {
    ensureStyle();
    document.getElementById(ENDING_ID)?.remove();
    return new Promise((resolve) => {
        const root = document.createElement("div");
        root.id = ENDING_ID;
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-label", "Hope or despair");
        const who = mastermind ? mastermind : "the mastermind";
        root.innerHTML = `
            <div class="dfe-title">${correct ? "THE TRUTH IS OUT" : "THE WRONG ANSWER"}</div>
            <div class="dfe-sub">${correct
                ? `${escapeHtml(who)} stands exposed as the mastermind behind the killing game. Now everyone must choose what comes next.`
                : `The vote missed ${escapeHtml(who)}, and the mastermind laughs. Still, one last choice is left to everyone.`}</div>
            <div class="dfe-choices"><button type="button" class="dfe-hope">HOPE</button><button type="button" class="dfe-despair">DESPAIR</button></div>`;
        document.body.appendChild(root);
        const pick = (choice) => {
            root.remove();
            resolve(choice);
        };
        root.querySelector(".dfe-hope").addEventListener("click", () => pick("hope"));
        root.querySelector(".dfe-despair").addEventListener("click", () => pick("despair"));
    });
}

// What the chapter journal keeps of the ending.
export function buildEndingJournalText({ ending = "hope", mastermind = "", correct = true, goal = "" } = {}) {
    const exposed = correct ? `${mastermind || "The mastermind"} was exposed as the mastermind at the final trial.` : `The final vote missed the mastermind, ${mastermind || "who"} got away with it.`;
    const end = ending === "hope"
        ? "Everyone chose HOPE: they walked out of the school together, into whatever the world had become."
        : "Everyone chose DESPAIR: the killing game won, and the students stayed behind its walls.";
    return `ENDING — ${ending === "hope" ? "HOPE" : "DESPAIR"}\n${exposed}${goal ? ` Their goal had been: ${goal}` : ""}\n${end}`;
}

// The white flash of a Flashback Light. Resolves when it's over.
export function playFlashbackFlash() {
    ensureStyle();
    document.getElementById(FLASH_ID)?.remove();
    const flash = document.createElement("div");
    flash.id = FLASH_ID;
    document.body.appendChild(flash);
    return new Promise((resolve) => setTimeout(() => { flash.remove(); resolve(); }, 1600));
}

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
