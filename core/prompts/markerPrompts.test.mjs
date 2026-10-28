import { buildMarkerPrompt, selectMarkerBlocks, textHasMarkerInstructions } from "./markerPrompts.js";
import { DEFAULT_GAMEPLAY_PROMPT_TEMPLATES } from "../constants.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    const defaults = { truth: "markerTruth", social: "markerSocial", investigation: "markerInvestigation", announcements: "markerAnnouncements", events: "markerEvents", rules: "markerRules" };
    const getTemplate = (id) => DEFAULT_GAMEPLAY_PROMPT_TEMPLATES[defaults[id]];

    assert(selectMarkerBlocks("INVESTIGATION").join() === "truth,social,rules", "investigation: evidence and trust");
    assert(selectMarkerBlocks("DAY").join() === "social,investigation,announcements,events,rules", "daily life");
    assert(selectMarkerBlocks("NIGHT").includes("investigation"), "night can start an investigation");
    assert(selectMarkerBlocks("TRIAL").length === 0, "nothing during trials");
    assert(selectMarkerBlocks("???").join() === selectMarkerBlocks("DAY").join(), "unknown phase falls back to daily life");

    assert(buildMarkerPrompt({ enabled: false, phase: "DAY", getTemplate }) === "", "off sends nothing");
    assert(buildMarkerPrompt({ enabled: true, phase: "TRIAL", getTemplate }) === "", "trial sends nothing");

    const inv = buildMarkerPrompt({ enabled: true, phase: "INVESTIGATION", getTemplate });
    assert(inv.startsWith("[STORY MARKERS]"), "has a header");
    assert(inv.includes("V3C| TB:") && inv.includes("V3C| SOCIAL:"), "investigation includes evidence and trust markers");
    assert(!inv.includes("INVESTIGATION_START") && !inv.includes("DAY_ANNOUN"), "investigation leaves out daily-life markers");

    const day = buildMarkerPrompt({ enabled: true, phase: "DAY", getTemplate });
    assert(!day.includes("V3C| TB:"), "no evidence markers in daily life");
    assert(day.includes("INVESTIGATION_START") && day.includes("V3C| BDA"), "daily life includes investigation start and announcements");
    assert(day.includes("V3C| EVENT:") && !inv.includes("V3C| EVENT:"), "group events only in daily life");
    assert(day.includes("V3C| RULE_BREAK:") && inv.includes("V3C| RULE_BREAK:"), "rule markers in daily life and investigations");
    assert(!/\{\{/.test(day + inv), "templates use no macros");

    const edited = buildMarkerPrompt({ enabled: true, phase: "INVESTIGATION", getTemplate: (id) => (id === "truth" ? "MY RULES" : "") });
    assert(edited.includes("MY RULES") && !edited.includes("TRUST MARKERS"), "edited and emptied blocks are respected");

    assert(textHasMarkerInstructions("record it: V3C| TB: Title || desc"), "detects pasted truth rules");
    assert(textHasMarkerInstructions("V3C｜SOCIAL: {{char}}"), "detects full-width bar");
    assert(!textHasMarkerInstructions("nothing here"), "no false positive");

    console.log("markerPrompts tests passed");
}

run();
