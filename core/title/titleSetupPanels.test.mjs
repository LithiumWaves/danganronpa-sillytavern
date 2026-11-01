import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { cardNameFromPath, markImportedSamples } from "./titleCharacters.js";
import { emotionFromFileName } from "./titleSprites.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "../../sample-character-cards");

function listCards(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return listCards(full);
        return name.endsWith(".json") && name !== "manifest.json" ? [relative(root, full).split("\\").join("/")] : [];
    });
}

function run() {
    assert(cardNameFromPath("danganronpa-cards/Danganronpa V3/Kaede Akamatsu.json") === "Kaede Akamatsu", "card name from its file");

    const sets = markImportedSamples([{ id: "v3", label: "V3", files: ["a/Kaede Akamatsu.json", "a/Shuichi Saihara.json"] }], ["kaede akamatsu "]);
    assert(sets[0].importedCount === 1 && sets[0].cards[0].imported && !sets[0].cards[1].imported, "already-imported cards are matched by name");

    assert(emotionFromFileName("Joy.PNG", ["neutral", "joy"]) === "joy", "a file named after an emotion");
    assert(emotionFromFileName("sprite_01.png", ["neutral", "joy"]) === null, "other names are skipped");

    // The sample card manifest lists every card in the folder, once.
    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
    const listed = manifest.sets.flatMap((s) => s.files);
    const onDisk = listCards(root);
    assert(new Set(listed).size === listed.length, "no card is listed twice");
    assert(listed.length === onDisk.length && onDisk.every((f) => listed.includes(f)), "manifest.json matches the sample cards on disk");

    console.log("title setup panel tests passed");
}

run();
