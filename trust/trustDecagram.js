const NS = "http://www.w3.org/2000/svg";

const CENTER = 100;
const RADIUS = 92;
const SLICE = (Math.PI * 2) / 10;
const GAP = 0.036;
const HUB_RADIUS = 27;

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null) continue;
        el.setAttribute(key, String(value));
    }
    return el;
}

function stop(offset, color) {
    return svgEl("stop", { offset, "stop-color": color });
}

function shardPath(angle1, angle2) {
    const x1 = CENTER + Math.cos(angle1) * RADIUS;
    const y1 = CENTER + Math.sin(angle1) * RADIUS;
    const x2 = CENTER + Math.cos(angle2) * RADIUS;
    const y2 = CENTER + Math.sin(angle2) * RADIUS;
    return `M ${CENTER} ${CENTER} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function addLinearGradient(defs, id, angle1, angle2, stops) {
    const mid = (angle1 + angle2) / 2;
    const gradient = svgEl("linearGradient", {
        id,
        gradientUnits: "userSpaceOnUse",
        x1: CENTER,
        y1: CENTER,
        x2: (CENTER + Math.cos(mid) * RADIUS).toFixed(2),
        y2: (CENTER + Math.sin(mid) * RADIUS).toFixed(2)
    });
    stops.forEach(([offset, color]) => gradient.appendChild(stop(offset, color)));
    defs.appendChild(gradient);
    return id;
}

function filledStops(kind) {
    if (kind === "gold") {
        return [
            ["0%", "#fff6c8"],
            ["28%", "#ffd56a"],
            ["68%", "#c79220"],
            ["100%", "#6a4a10"]
        ];
    }
    if (kind === "distrust") {
        return [
            ["0%", "#ff8a8a"],
            ["32%", "#e32626"],
            ["74%", "#8a0d0d"],
            ["100%", "#3a0505"]
        ];
    }
    return [
        ["0%", "#b7efff"],
        ["32%", "#4aa8e8"],
        ["76%", "#1a4d7a"],
        ["100%", "#0c2a48"]
    ];
}

function emptyFill(isDistrust) {
    return isDistrust ? "rgba(255, 90, 90, 0.08)" : "rgba(166, 237, 255, 0.07)";
}

function emptyStroke(isDistrust) {
    return isDistrust ? "rgba(255, 120, 120, 0.28)" : "rgba(166, 237, 255, 0.22)";
}

function isShardFilled(index, filled) {
    if (filled > 0) return index < filled;
    if (filled < 0) return index >= 10 - Math.abs(filled);
    return false;
}

function buildDefs(svg) {
    const defs = svgEl("defs");

    const glow = svgEl("filter", {
        id: "trustShardGlow",
        x: "-45%",
        y: "-45%",
        width: "190%",
        height: "190%"
    });
    glow.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "1.35", result: "blur" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "blur" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);

    const goldRadial = svgEl("radialGradient", {
        id: "trustGoldGradient",
        cx: "35%",
        cy: "30%",
        r: "70%"
    });
    goldRadial.appendChild(stop("0%", "#fff2b0"));
    goldRadial.appendChild(stop("35%", "#ffd86b"));
    goldRadial.appendChild(stop("65%", "#c79a2b"));
    goldRadial.appendChild(stop("100%", "#7a5a12"));
    defs.appendChild(goldRadial);

    const hubFill = svgEl("radialGradient", {
        id: "trustHubGradient",
        cx: "38%",
        cy: "32%",
        r: "72%"
    });
    hubFill.appendChild(stop("0%", "#1c3a58"));
    hubFill.appendChild(stop("55%", "#0b1828"));
    hubFill.appendChild(stop("100%", "#050b12"));
    defs.appendChild(hubFill);

    const hubFillRed = svgEl("radialGradient", {
        id: "trustHubGradientDistrust",
        cx: "38%",
        cy: "32%",
        r: "72%"
    });
    hubFillRed.appendChild(stop("0%", "#4a1218"));
    hubFillRed.appendChild(stop("55%", "#1a0508"));
    hubFillRed.appendChild(stop("100%", "#0a0203"));
    defs.appendChild(hubFillRed);

    const hubFillGold = svgEl("radialGradient", {
        id: "trustHubGradientGold",
        cx: "38%",
        cy: "32%",
        r: "72%"
    });
    hubFillGold.appendChild(stop("0%", "#5a4314"));
    hubFillGold.appendChild(stop("55%", "#1c1406"));
    hubFillGold.appendChild(stop("100%", "#0a0802"));
    defs.appendChild(hubFillGold);

    const mask = svgEl("mask", {
        id: "goldRevealMask",
        maskUnits: "userSpaceOnUse"
    });
    mask.appendChild(svgEl("rect", { width: "200", height: "200", fill: "black" }));
    mask.appendChild(svgEl("circle", {
        id: "goldRevealCircle",
        cx: CENTER,
        cy: CENTER,
        r: "0",
        fill: "white"
    }));
    defs.appendChild(mask);

    svg.appendChild(defs);
    return defs;
}

function createShard(index, filled, isDistrust, isGoldBase, defs) {
    const angle1 = SLICE * index + GAP;
    const angle2 = SLICE * (index + 1) - GAP;
    const filledNow = isShardFilled(index, filled);
    const kind = isDistrust ? "distrust" : "trust";

    const path = svgEl("path", {
        d: shardPath(angle1, angle2),
        class: `decagram-shard${filledNow ? " is-filled" : ""}`,
        "data-index": index,
        "stroke-linejoin": "round"
    });

    if (filledNow && !isGoldBase) {
        const gradientId = addLinearGradient(
            defs,
            `trust-shard-fill-${index}`,
            angle1,
            angle2,
            filledStops(kind)
        );
        path.setAttribute("fill", `url(#${gradientId})`);
        path.setAttribute("stroke", isDistrust ? "rgba(80, 8, 8, 0.55)" : "rgba(8, 28, 48, 0.55)");
        path.setAttribute("stroke-width", "0.7");
        path.setAttribute("filter", "url(#trustShardGlow)");
    } else if (filledNow && isGoldBase) {
        path.setAttribute("fill", "url(#trustGoldGradient)");
        path.setAttribute("stroke", "rgba(72, 48, 8, 0.55)");
        path.setAttribute("stroke-width", "0.7");
        path.setAttribute("filter", "url(#trustShardGlow)");
        path.classList.add("is-gold");
    } else {
        path.setAttribute("fill", emptyFill(isDistrust));
        path.setAttribute("stroke", emptyStroke(isDistrust));
        path.setAttribute("stroke-width", "0.65");
    }

    return { path, angle1, angle2, filledNow };
}

function appendHub(svg, isDistrust, isGold) {
    const fillId = isGold
        ? "trustHubGradientGold"
        : isDistrust
            ? "trustHubGradientDistrust"
            : "trustHubGradient";
    const ring = isGold
        ? "rgba(255, 214, 96, 0.55)"
        : isDistrust
            ? "rgba(255, 120, 120, 0.42)"
            : "rgba(166, 237, 255, 0.42)";

    svg.appendChild(svgEl("circle", {
        class: "trust-hub-disc",
        cx: CENTER,
        cy: CENTER,
        r: HUB_RADIUS,
        fill: `url(#${fillId})`,
        stroke: ring,
        "stroke-width": "1.4"
    }));
}

function buildDecagram(svg, filled) {
    if (!svg) return;

    const isGold = svg.dataset.gold === "true";
    const isDistrust = filled < 0 || svg.dataset.mode === "distrust";

    svg.innerHTML = "";
    const defs = buildDefs(svg);

    const baseGroup = svgEl("g", { class: "trust-base-shards" });
    const goldGroup = svgEl("g", {
        class: "trust-gold-shards",
        mask: isGold ? "url(#goldRevealMask)" : undefined
    });

    for (let i = 0; i < 10; i++) {
        const shard = createShard(i, filled, isDistrust, false, defs);
        baseGroup.appendChild(shard.path);

        if (isGold) {
            const goldShard = createShard(i, 10, false, true, defs);
            goldShard.path.classList.add("gold-overlay");
            goldGroup.appendChild(goldShard.path);
        }
    }

    svg.appendChild(baseGroup);
    if (isGold) svg.appendChild(goldGroup);
    appendHub(svg, isDistrust && !isGold, isGold);
}

function crackShard(svg, shardIndex) {
    const shards = svg?.querySelectorAll?.(`.decagram-shard[data-index="${shardIndex}"]`);
    if (!shards?.length) return;
    shards.forEach((shard) => {
        shard.classList.remove("trust-shard-crack");
        void shard.getBoundingClientRect();
        shard.classList.add("trust-shard-crack");
    });
}

function shatterShard(svg, index) {
    const shards = svg?.querySelectorAll?.(`.decagram-shard[data-index="${index}"]`);
    if (!shards?.length) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = 72 + Math.random() * 48;
    const dx = `${Math.cos(angle) * distance}px`;
    const dy = `${Math.sin(angle) * distance}px`;
    const rot = `${Math.random() * 110 - 55}deg`;

    shards.forEach((shard) => {
        shard.style.setProperty("--dx", dx);
        shard.style.setProperty("--dy", dy);
        shard.style.setProperty("--rot", rot);
        shard.classList.add("trust-shatter");
    });
}

export {
    buildDecagram,
    crackShard,
    shatterShard
};
