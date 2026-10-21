import { maybeShowTitleScreen } from "./titleScreen.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

async function run() {
    const skippedDisabled = await maybeShowTitleScreen({
        isEnabled: () => false,
        isBlocked: () => false,
        onStart: () => { throw new Error("should not start"); },
    });
    assert(skippedDisabled === false, "skips when disabled");

    const skippedBlocked = await maybeShowTitleScreen({
        isEnabled: () => true,
        isBlocked: () => true,
        onStart: () => { throw new Error("should not start"); },
    });
    assert(skippedBlocked === false, "skips when blocked");

    const skippedNoDom = await maybeShowTitleScreen({ isEnabled: () => true });
    assert(skippedNoDom === false, "skips without a document");

    console.log("titleScreen tests passed");
}

run();
