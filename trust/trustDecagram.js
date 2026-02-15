function buildDecagram(svg, filled) {
    const isGold = svg.dataset.gold === "true";

    svg.innerHTML = "";

    // ---- defs ----
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
<radialGradient id="trustBlueGradient">
    <stop offset="0%" stop-color="#2a4f7a"/>
    <stop offset="100%" stop-color="#142b44"/>
</radialGradient>

<radialGradient id="trustGoldGradient" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#fff2b0"/>
    <stop offset="35%" stop-color="#ffd86b"/>
    <stop offset="65%" stop-color="#c79a2b"/>
    <stop offset="100%" stop-color="#7a5a12"/>
</radialGradient>

<radialGradient id="trustRedGradient" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="#ff5a5a"/>
    <stop offset="40%" stop-color="#e01818"/>
    <stop offset="75%" stop-color="#9c0f0f"/>
    <stop offset="100%" stop-color="#4a0707"/>
</radialGradient>

<mask id="goldRevealMask" maskUnits="userSpaceOnUse">
    <rect width="200" height="200" fill="black"/>
    <circle id="goldRevealCircle" cx="100" cy="100" r="0" fill="white"/>
</mask>

<filter id="goldInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feOffset dx="0" dy="1"/>
    <feGaussianBlur stdDeviation="2"/>
    <feComposite operator="out" in2="SourceGraphic"/>
</filter>
`;
    svg.appendChild(defs);

    const center = 100;
    const radius = 90;

    for (let i = 0; i < 10; i++) {
        const angle1 = (Math.PI * 2 / 10) * i;
        const angle2 = (Math.PI * 2 / 10) * (i + 1);

        const x1 = center + Math.cos(angle1) * radius;
        const y1 = center + Math.sin(angle1) * radius;
        const x2 = center + Math.cos(angle2) * radius;
        const y2 = center + Math.sin(angle2) * radius;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        path.dataset.index = i;
        path.classList.add("decagram-shard");

        path.setAttribute(
            "d",
            `M ${center} ${center} L ${x1} ${y1} L ${x2} ${y2} Z`
        );

        // ✅ THIS IS WHERE THE FILL LOGIC GOES
let fill;

// GOLD (max trust)
if (isGold) {
    fill = "url(#trustGoldGradient)";
}

// DISTRUST (negative values)
else if (filled < 0) {
    const abs = Math.abs(filled);

    // Right → left fill
    fill = i >= 10 - abs
        ? "url(#trustRedGradient)"
        : "rgba(95, 20, 20, 0.35)";
}

// TRUST (positive values)
else {
    if (svg.dataset.mode === "distrust") {
        // Corrupted neutral shell
        fill = "rgba(95, 20, 20, 0.35)";
    } else {
        // Normal trust shell
        fill = i < filled
            ? "url(#trustBlueGradient)"
            : "rgba(31, 58, 95, 0.25)";
    }
}

        path.setAttribute("fill", fill);

// 🟡 ONLY mask during gold REVEAL animation
if (isGold && filled < 10) {
    path.setAttribute("mask", "url(#goldRevealMask)");
} else {
    path.removeAttribute("mask");
}


const isDistrust =
    filled < 0 || svg.dataset.mode === "distrust";

path.setAttribute(
    "stroke",
    isDistrust ? "#3a0000" : "#0e2238"
);
        path.setAttribute("stroke-width", "1");

        svg.appendChild(path);
    }
}

function crackShard(svg, shardIndex) {
    const shard = svg.querySelector(
        `path[data-index="${shardIndex}"]`
    );

    if (!shard) return;

    shard.classList.add("trust-shard-crack");
}

function shatterShard(svg, index) {
    const shard = [...svg.querySelectorAll("path")]
        .find(p => Number(p.dataset.index) === index);

    if (!shard) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 40;

    shard.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    shard.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    shard.style.setProperty("--rot", `${(Math.random() * 90 - 45)}deg`);

    shard.classList.add("trust-shatter");
}

export {
    buildDecagram,
    crackShard,
    shatterShard
};
