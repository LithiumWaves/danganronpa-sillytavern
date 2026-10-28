// Full-screen pink blood splash for a grave rule's punishment (Mukuro in DR1
// Chapter 1): splatters burst across the screen, drip, and fade, with the
// punished student's name. Resolves once it's over (or clicked away).

const STYLE_ID = "dangan-blood-style";
const ROOT_ID = "dangan-blood-splash";
const PINK = "#ff1f8e";

const CSS = `
#${ROOT_ID} {
    position: fixed; inset: 0; z-index: 100060; pointer-events: auto; overflow: hidden;
    background: rgba(20, 0, 10, 0); animation: dbs-dim 2.8s ease forwards;
}
#${ROOT_ID} .dbs-flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: dbs-flash 0.35s ease-out; }
#${ROOT_ID} .dbs-blob {
    position: absolute; border-radius: 50%; transform: scale(0); opacity: 0.95;
    background: radial-gradient(circle at 40% 40%, #ff5fb0 0%, ${PINK} 45%, #c4006a 80%, transparent 82%);
    animation: dbs-burst 0.28s cubic-bezier(.2,1.6,.4,1) forwards;
    filter: drop-shadow(0 0 6px rgba(255, 31, 142, 0.5));
}
#${ROOT_ID} .dbs-drip {
    position: absolute; width: 10px; border-radius: 0 0 6px 6px; height: 0;
    background: linear-gradient(${PINK}, #c4006a);
    animation: dbs-drip 2.2s ease-in forwards;
}
#${ROOT_ID} .dbs-name {
    position: absolute; left: 0; right: 0; top: 42%; text-align: center;
    font-size: clamp(1.6rem, 6vw, 4rem); letter-spacing: 0.2em; font-weight: 900; color: #fff;
    text-shadow: 0 0 12px ${PINK}, 0 4px 0 #6b0039; opacity: 0;
    animation: dbs-name 2.4s ease 0.35s forwards;
}
#${ROOT_ID}.dbs-out { animation: dbs-out 0.5s ease forwards; }
@keyframes dbs-dim { to { background: rgba(20, 0, 10, 0.55); } }
@keyframes dbs-flash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
@keyframes dbs-burst { to { transform: scale(1); } }
@keyframes dbs-drip { to { height: var(--dbs-len, 30vh); } }
@keyframes dbs-name { 0% { opacity: 0; transform: scale(1.4); } 15% { opacity: 1; transform: scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }
@keyframes dbs-out { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
    #${ROOT_ID} .dbs-blob { animation-duration: 0.01s; }
    #${ROOT_ID} .dbs-drip { animation-duration: 0.01s; }
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// { name, playSound(), durationMs, rng } → Promise<void>
export function playBloodSplash({ name = "", playSound = null, durationMs = 3200, rng = Math.random } = {}) {
    ensureStyle();
    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");
    root.appendChild(Object.assign(document.createElement("div"), { className: "dbs-flash" }));

    const blobs = 14 + Math.floor(rng() * 8);
    for (let i = 0; i < blobs; i += 1) {
        const blob = document.createElement("div");
        blob.className = "dbs-blob";
        const size = 6 + rng() * (i < 3 ? 38 : 16);
        blob.style.width = `${size}vmax`;
        blob.style.height = `${size * (0.7 + rng() * 0.5)}vmax`;
        blob.style.left = `${rng() * 100 - size / 2}vw`;
        blob.style.top = `${rng() * 90 - size / 2}vh`;
        blob.style.animationDelay = `${Math.floor(rng() * 220)}ms`;
        const r = () => `${35 + Math.floor(rng() * 30)}%`;
        blob.style.borderRadius = `${r()} ${r()} ${r()} ${r()} / ${r()} ${r()} ${r()} ${r()}`;
        root.appendChild(blob);
    }
    const drips = 6 + Math.floor(rng() * 6);
    for (let i = 0; i < drips; i += 1) {
        const drip = document.createElement("div");
        drip.className = "dbs-drip";
        drip.style.left = `${rng() * 98}vw`;
        drip.style.top = `${rng() * 40}vh`;
        drip.style.width = `${4 + rng() * 10}px`;
        drip.style.setProperty("--dbs-len", `${15 + rng() * 45}vh`);
        drip.style.animationDelay = `${300 + Math.floor(rng() * 500)}ms`;
        root.appendChild(drip);
    }
    if (name) root.appendChild(Object.assign(document.createElement("div"), { className: "dbs-name", textContent: String(name).toUpperCase() }));
    document.body.appendChild(root);
    try { playSound?.(); } catch { /* no sound */ }

    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            root.classList.add("dbs-out");
            setTimeout(() => { root.remove(); resolve(); }, 500);
        };
        setTimeout(finish, durationMs);
        root.addEventListener("click", finish);
    });
}
