import {
    tokenizeStatement, assignTiers, breakLines, layoutStatement, renderStatementHtml, VERTICAL_MAX_TOKENS,
} from "./nsdStatementLayout.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function seq(...values) {
    let i = 0;
    return () => values[i++ % values.length];
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function run() {
    // A weak span stays one token, with its spaces, and punctuation after it hugs it.
    const t = tokenizeStatement("He was killed in [[the library]].");
    const weak = t.filter(x => x.kind === "weak");
    assert(weak.length === 1 && weak[0].text === "the library", "weak span is one token");
    assert(t[t.length - 1].text === "." && t[t.length - 1].tail, "trailing punctuation marked as tail");

    // Agreement wins over weak markup, as before.
    const both = tokenizeStatement("[[Rantaro]] was ((alone)) there");
    assert(!both.some(x => x.kind === "weak") && both.some(x => x.kind === "agree"), "agree beats weak");

    // Markup spans are always the biggest tier; stopwords the smallest.
    const tiers = assignTiers(tokenizeStatement("Rantaro's [[body]] was found in the library"));
    assert(tiers.find(x => x.kind === "weak").tier === 2, "weak is tier 2");
    assert(tiers.find(x => x.text === "was").tier === 0, "stopword is tier 0");
    assert(tiers.find(x => x.text === "the").tier === 0, "article is tier 0");

    // Emphasis is capped: at most 3 enlarged plain words, fewer with markup.
    const long = assignTiers(tokenizeStatement(
        "Gigantic monstrous ridiculous outrageous unbelievable astonishing preposterous evidence everywhere"));
    assert(long.filter(x => x.tier === 2).length <= 3, "at most 3 emphasised words");
    const withWeak = assignTiers(tokenizeStatement("Gigantic monstrous ridiculous [[outrageous]] unbelievable"));
    assert(withWeak.filter(x => x.kind === "plain" && x.tier === 2).length <= 1, "markup leaves at most 1 more");

    // Line breaking keeps every token, in order, and never makes empty lines.
    const toks = assignTiers(tokenizeStatement("Cuz he knew about the hidden door and nobody else did"));
    for (const n of [1, 2, 3]) {
        const lines = breakLines(toks, n);
        assert(lines.length <= n && lines.every(l => l.length), `no empty lines for ${n}`);
        assert(lines.flat().map(x => x.text).join(" ") === toks.map(x => x.text).join(" "), "order kept");
    }

    // Vertical only for short lines.
    const longLine = "That means Rantaro was masterminding this whole thing all along you see";
    for (let i = 0; i < 20; i++) {
        const l = layoutStatement(longLine, { rng: seq(i / 20, 0.5, 0.3) });
        assert(l.layout !== "vertical", "long lines never vertical");
    }
    assert(tokenizeStatement("He was killed in the library").length <= VERTICAL_MAX_TOKENS, "fixture is short");
    const vert = layoutStatement("He was killed in the library", { rng: seq(0.05, 0.5, 0.5) });
    assert(vert.layout === "vertical" && vert.tilt === -90, "short line can be vertical");

    // Rendering keeps the hit-test classes and escapes text.
    const html = renderStatementHtml(layoutStatement("A <b> [[weak spot]] and ((agree))", { rng: seq(0.9) }), esc);
    assert(html.includes('class="nsd-w nsd-w-t2 dangan-weak-point">weak spot<') === false, "agree beats weak in render");
    assert(html.includes("dangan-agree-text") && html.includes("&lt;b&gt;"), "agree span + escaping");
    const html2 = renderStatementHtml(layoutStatement("Rantaro was in the [[library]].", { rng: seq(0.9) }), esc);
    assert(/dangan-weak-point">library<\/span><span class="nsd-w nsd-w-t0">\.</.test(html2), "weak span + hugging dot");

    console.log("nsdStatementLayout: ok");
}

run();
