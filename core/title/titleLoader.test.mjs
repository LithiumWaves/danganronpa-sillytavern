import { existsSync, readdirSync } from "node:fs";
import { CHIBI_SPRITES, dressSplashScreen, pickChibiSprite } from "./titleLoader.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(pickChibiSprite(() => 0) === CHIBI_SPRITES[0], "picks the first sprite");
    assert(pickChibiSprite(() => 0.9999) === CHIBI_SPRITES.at(-1), "picks the last sprite");
    assert(pickChibiSprite(() => 1) === CHIBI_SPRITES.at(-1), "clamps out-of-range randoms");

    const dir = new URL("../../assets/images/title/chibisprites/", import.meta.url);
    for (const name of CHIBI_SPRITES) {
        assert(existsSync(new URL(`${name}.png`, dir)), `missing sprite file: ${name}.png`);
    }
    const files = readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));
    for (const name of files) {
        assert(CHIBI_SPRITES.includes(name), `sprite not listed in CHIBI_SPRITES: ${name}`);
    }

    assert(dressSplashScreen() === false, "skips without a document");

    console.log("titleLoader tests passed");
}

run();
