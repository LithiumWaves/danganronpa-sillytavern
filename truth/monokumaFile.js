// The Monokuma File screen, after Killing Harmony's: a tilted tablet with a
// Victim tab (DEAD stamp, name, portrait, basic info) and a Situation tab
// (the crime scene and the autopsy), narrated line by line in the text box
// below. Opened when an investigation starts, and again from the Truth tab.

import { createSkipToken, pushSkippable } from "../core/skip/skipRegistry.js";

const STYLE_ID = "dangan-mkfile-style";
const ROOT_ID = "dangan-mkfile";

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 100050;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 40% 35%, #e9e3d6 0%, #cfc7b7 55%, #a9a192 100%);
    font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif;
    opacity: 0; transition: opacity 0.25s ease;
    perspective: 1400px;
}
#${ROOT_ID}.open { opacity: 1; }
#${ROOT_ID} .mkf-tablet {
    position: relative;
    width: min(72vw, 900px); aspect-ratio: 16 / 11; max-height: 72vh;
    background: linear-gradient(145deg, #5a5a5c, #2b2b2d 40%, #1c1c1e);
    border-radius: 26px; padding: 18px;
    box-shadow: 0 30px 60px rgba(0,0,0,0.45), inset 0 0 0 2px #77777a, inset 0 0 0 6px #1a1a1a;
    transform: translateY(-10vh) rotateX(14deg) rotateZ(-7deg) scale(0.92);
    transition: transform 0.45s cubic-bezier(.2,.9,.3,1.1);
}
#${ROOT_ID}.open .mkf-tablet { transform: translateY(-10vh) rotateX(10deg) rotateZ(-6deg) scale(1); }
#${ROOT_ID} .mkf-screen {
    position: relative; width: 100%; height: 100%; overflow: hidden;
    background: #050505; border-radius: 6px;
    display: flex; flex-direction: column;
}
#${ROOT_ID} .mkf-header {
    background: #f2f2f2; color: #111; padding: 6px 18px 4px;
    display: flex; align-items: center; gap: 12px;
    font-style: italic; letter-spacing: 0.04em; line-height: 0.95;
    font-size: clamp(14px, 2.1vw, 28px);
}
#${ROOT_ID} .mkf-bear {
    width: 1.5em; height: 1.5em; border-radius: 50%; flex: none;
    background: linear-gradient(90deg, #111 50%, #f2f2f2 50%);
    box-shadow: 0 0 0 3px #111;
}
#${ROOT_ID} .mkf-updated {
    display: inline-block; margin-left: 0.4em; padding: 0 0.3em; font-size: 0.55em; vertical-align: middle;
    background: #ff2ec4; color: #fff; font-style: normal; transform: skewX(-12deg);
}
#${ROOT_ID} .mkf-searchbar {
    height: 10px; width: 34%; margin: 8px 18px 0; border-radius: 6px; background: #8a8a8a;
}
#${ROOT_ID} .mkf-tabs {
    position: relative; z-index: 2;
    display: flex; justify-content: flex-end; gap: 7%; padding: 2px 6% 0;
    font-style: italic; font-size: clamp(12px, 1.5vw, 20px);
}
#${ROOT_ID} .mkf-tab {
    background: none; border: 0; padding: 2px 4px; cursor: pointer;
    color: #f2f2f2; font: inherit; font-style: italic;
    border-bottom: 3px solid transparent;
}
#${ROOT_ID} .mkf-tab.active { color: #ff2ec4; border-bottom-color: #ff2ec4; }
#${ROOT_ID} .mkf-page { position: absolute; inset: 22% 0 0 0; display: none; }
#${ROOT_ID} .mkf-page.active { display: block; animation: mkf-page-in 0.3s ease; }
@keyframes mkf-page-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }

/* Victim */
#${ROOT_ID} .mkf-stamp {
    position: absolute; left: 7%; top: -6%; width: 15%; aspect-ratio: 1;
    border: 4px solid #ff2ec4; transform: rotate(45deg) scale(0.72);
    display: flex; align-items: center; justify-content: center;
}
#${ROOT_ID} .mkf-stamp span {
    transform: rotate(-45deg); color: #ff2ec4; font-size: clamp(16px, 3vw, 40px);
    font-family: Georgia, "Times New Roman", serif; font-weight: 900;
    border-top: 3px solid #ff2ec4; border-bottom: 3px solid #ff2ec4; padding: 0 4px;
}
#${ROOT_ID} .mkf-name {
    position: absolute; left: 6%; top: 24%; max-width: 44%;
    color: #fff; font-style: italic; line-height: 0.95;
    font-size: clamp(20px, 3.8vw, 52px); text-shadow: 3px 3px 0 #000;
}
#${ROOT_ID} .mkf-portrait {
    position: absolute; right: 4%; top: 4%; height: 62%; max-width: 50%;
    object-fit: contain; object-position: bottom right;
    filter: grayscale(1) contrast(1.15) brightness(1.05);
}
#${ROOT_ID} .mkf-info {
    position: absolute; left: 6%; right: 18%; bottom: 6%;
    border-collapse: collapse; color: #111; font-size: clamp(10px, 1.2vw, 16px);
}
#${ROOT_ID} .mkf-info caption {
    caption-side: top; text-align: left; color: #ff2ec4; font-style: italic; padding: 0 0 2px;
}
#${ROOT_ID} .mkf-info td { background: #ff2ec4; border: 2px solid #050505; padding: 2px 8px; font-style: italic; }
#${ROOT_ID} .mkf-info td + td { text-align: right; width: 45%; }

/* Situation */
#${ROOT_ID} .mkf-scene {
    position: absolute; left: 3%; right: 3%; top: 0; height: 52%;
    background: #222 center / cover no-repeat;
    filter: grayscale(0.55) contrast(1.25) brightness(0.95);
    clip-path: polygon(0 0, 100% 0, 100% 78%, 93% 86%, 86% 80%, 74% 92%, 61% 84%, 48% 97%, 37% 86%, 24% 93%, 12% 84%, 0 92%);
}
#${ROOT_ID} .mkf-cause { position: absolute; left: 6%; top: 56%; width: 46%; color: #ddd; font-family: Arial, sans-serif; font-size: clamp(9px, 1.05vw, 14px); line-height: 1.35; }
#${ROOT_ID} .mkf-cause h3 { margin: 0 0 4px; color: #ff2ec4; font-family: "Arial Black", Arial, sans-serif; font-style: italic; font-size: 1.25em; }
#${ROOT_ID} .mkf-cause p { margin: 0 0 6px; }
#${ROOT_ID} .mkf-body {
    position: absolute; right: 8%; bottom: -6%; height: 46%;
    filter: grayscale(1) contrast(1.2);
}
#${ROOT_ID} .mkf-body-mark {
    position: absolute; right: 15%; bottom: 22%; width: 6%; aspect-ratio: 1.4;
    border-radius: 50%; background: rgba(255,46,196,0.75); mix-blend-mode: screen;
}

/* Text box */
#${ROOT_ID} .mkf-textbox {
    position: absolute; left: 0; right: 0; bottom: 4vh; min-height: 12vh;
    background: linear-gradient(90deg, rgba(10,10,12,0.25), rgba(10,10,12,0.88) 12%, rgba(10,10,12,0.88) 88%, rgba(10,10,12,0.25));
    color: #8ee8ff; font-family: Arial, "Helvetica Neue", sans-serif; font-weight: 700;
    font-size: clamp(14px, 1.7vw, 24px); line-height: 1.35;
    padding: 2.2vh 20vw 2.2vh 20vw; box-sizing: border-box; cursor: pointer;
}
#${ROOT_ID} .mkf-textbox b { color: #ffd23f; font-weight: 700; }
#${ROOT_ID} .mkf-next {
    position: absolute; right: 8vw; bottom: 2vh; color: #ffd23f; font-size: 1.3em;
    animation: mkf-blink 0.8s steps(2) infinite; visibility: hidden;
}
#${ROOT_ID} .mkf-textbox.done .mkf-next { visibility: visible; }
@keyframes mkf-blink { 50% { opacity: 0.2; } }
#${ROOT_ID} .mkf-close {
    position: absolute; top: 2vh; right: 2vw; background: #111; color: #fff; border: 2px solid #fff;
    font: inherit; font-size: 14px; padding: 6px 12px; cursor: pointer;
}
@media (max-width: 700px) {
    #${ROOT_ID} .mkf-tablet { width: 94vw; padding: 10px; aspect-ratio: 4 / 5; }
    #${ROOT_ID} .mkf-page { inset: 18% 0 0 0; }
    #${ROOT_ID} .mkf-textbox { padding: 2vh 6vw; }
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Narration lines mark highlighted words with **double asterisks**.
function lineHtml(line) {
    return escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

function plain(line) {
    return String(line || "").replace(/\*\*/g, "");
}

// data: { number, victim: { name, ultimate, portraitUrl, info: [[label, value]] },
//         sceneUrl, situation: [paragraphs], lines: [narration] }
// With `narrate`, the lines play in the text box and the screen closes after
// the last one; otherwise it stays open until closed.
export function openMonokumaFile(data, { narrate = true, playSfx = null } = {}) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();

    // A second body's file reads like "03-2".
    const number = /^\d+-\d+$/.test(String(data.number ?? ""))
        ? String(data.number).replace(/^(\d+)/, (n) => n.padStart(2, "0"))
        : String(Math.max(1, Number(data.number) || 1)).padStart(2, "0");
    const victim = data.victim || {};
    const nameParts = String(victim.name || "???").split(/\s+/);
    const info = (victim.info || []).map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value || "???")}</td></tr>`).join("");
    const portrait = victim.portraitUrl ? `<img class="mkf-portrait" src="${escapeHtml(victim.portraitUrl)}" alt="">` : "";
    const body = victim.bodyUrl ? `<img class="mkf-body" src="${escapeHtml(victim.bodyUrl)}" alt=""><div class="mkf-body-mark"></div>` : "";
    const situation = (data.situation || []).map((p) => `<p>${escapeHtml(p)}</p>`).join("");

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", `Monokuma File ${number}`);
    root.innerHTML = `
        <div class="mkf-tablet"><div class="mkf-screen">
            <div class="mkf-header"><div class="mkf-bear"></div><div>MONOKUMA<br>FILE ${number}${data.revision > 1 ? ` <span class="mkf-updated">UPDATED</span>` : ""}</div></div>
            <div class="mkf-searchbar"></div>
            <div class="mkf-tabs">
                <button type="button" class="mkf-tab active" data-page="victim">Victim</button>
                <button type="button" class="mkf-tab" data-page="situation">Situation</button>
            </div>
            <div class="mkf-page active" data-page="victim">
                <div class="mkf-stamp"><span>DEAD</span></div>
                <div class="mkf-name">${nameParts.map(escapeHtml).join("<br>")}</div>
                ${portrait}
                <table class="mkf-info"><caption>Basic Info</caption>${info}</table>
            </div>
            <div class="mkf-page" data-page="situation">
                <div class="mkf-scene"${data.sceneUrl ? ` style="background-image:url('${escapeHtml(data.sceneUrl)}')"` : ""}></div>
                <div class="mkf-cause"><h3>Cause of Death</h3>${situation}</div>
                ${body}
            </div>
        </div></div>
        <div class="mkf-textbox" ${narrate ? "" : "hidden"}><span class="mkf-text"></span><span class="mkf-next">»</span></div>
        ${narrate ? "" : `<button type="button" class="mkf-close">CLOSE</button>`}
    `;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add("open"));

    const showPage = (page) => {
        root.querySelectorAll(".mkf-tab").forEach((t) => t.classList.toggle("active", t.dataset.page === page));
        root.querySelectorAll(".mkf-page").forEach((p) => p.classList.toggle("active", p.dataset.page === page));
    };
    root.querySelectorAll(".mkf-tab").forEach((tab) => tab.addEventListener("click", (e) => {
        e.stopPropagation();
        playSfx?.();
        showPage(tab.dataset.page);
    }));

    const token = createSkipToken();
    let closed = false;
    let resolveClosed;
    const closedPromise = new Promise((r) => { resolveClosed = r; });
    const close = () => {
        if (closed) return;
        closed = true;
        release();
        document.removeEventListener("keydown", onKey, true);
        root.classList.remove("open");
        setTimeout(() => root.remove(), 260);
        resolveClosed();
    };
    const release = pushSkippable({ kind: "sequence", skip: () => { token.skip(); close(); } });

    // Clicks and Enter/Space advance the narration.
    let advance = null;
    const next = () => { const fn = advance; advance = null; fn?.(); };
    const onKey = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            if (narrate) next(); else close();
        }
    };
    document.addEventListener("keydown", onKey, true);
    root.querySelector(".mkf-close")?.addEventListener("click", close);

    if (!narrate) {
        root.addEventListener("click", (e) => { if (e.target === root) close(); });
        return closedPromise;
    }

    const box = root.querySelector(".mkf-textbox");
    const textEl = root.querySelector(".mkf-text");
    box.addEventListener("click", next);
    root.addEventListener("click", (e) => { if (e.target === root) next(); });

    (async () => {
        const lines = data.lines || [];
        for (let i = 0; i < lines.length && !closed; i += 1) {
            // The first line introduces the victim; the rest read the autopsy.
            if (i === 1) showPage("situation");
            const full = plain(lines[i]);
            box.classList.remove("done");
            let shown = 0;
            let instant = false;
            advance = () => { instant = true; };
            while (shown < full.length && !instant && !closed) {
                shown += 2;
                textEl.textContent = full.slice(0, shown);
                await token.delay(28);
            }
            textEl.innerHTML = lineHtml(lines[i]);
            box.classList.add("done");
            await token.race(new Promise((r) => { advance = r; }));
            playSfx?.();
        }
        close();
    })();

    return closedPromise;
}
