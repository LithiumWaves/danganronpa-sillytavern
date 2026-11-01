import { frameAt, loadGameOverFrames, pictureRect, unpackFrames } from "./gameOver.js";
import { GAME_OVER_FRAMES } from "./gameOverFrames.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

async function run() {
    const g = GAME_OVER_FRAMES;
    // The shipped frames inflate to every unique frame, with only the four levels.
    const frames = await loadGameOverFrames();
    assert(frames.length === g.count && frames.every((f) => f.length === g.cols * g.rows), "every frame decodes");
    assert(frames.every((f) => f.every((v) => v <= 3)), "four levels");
    assert(frames[g.sequence[0]].every((v) => v === 0), "the clip starts black");
    const lit = (f) => f.reduce((n, v) => n + (v ? 1 : 0), 0);
    assert(lit(frames[g.sequence[g.sequence.length - 1]]) > 2500, "the last frame is the full screen");
    assert(frames[g.sequence[30]].some((v) => v === 3) && frames[g.sequence[30]].some((v) => v === 1), "white Monokuma and dim red lettering");

    // Packing round-trip.
    const cells = new Uint8Array([0, 1, 2, 3, 3, 2]);
    const packed = new Uint8Array([0b11100100, 0b1011]);
    assert(unpackFrames(packed, { cols: 3, rows: 2, count: 1 })[0].join() === cells.join(), "unpack");

    // Timing: the clip once, then its glitch part on a loop.
    const ms = (n) => (n / g.fps) * 1000 + 1;
    assert(frameAt(0, g) === g.sequence[0] && frameAt(ms(20), g) === g.sequence[20], "the clip plays in order");
    assert(frameAt(ms(g.sequence.length), g) === g.sequence[g.loopFrom], "then loops from loopFrom");
    assert(frameAt(ms(g.sequence.length * 5 + 3), g) !== undefined, "forever");

    // Letterboxing.
    const wide = pictureRect(2000, 720);
    assert(wide.h === 720 && wide.w === 1280 && wide.x === 360 && wide.y === 0, "pillarbox on a wide screen");
    const tall = pictureRect(390, 844);
    assert(tall.w === 390 && Math.abs(tall.h - 219.375) < 0.01 && tall.y > 300, "letterbox on a phone");
    console.log("gameOver tests passed");
}

run();
