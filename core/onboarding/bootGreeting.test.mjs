import { maybeShowBootGreeting } from "./bootGreeting.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

async function run() {
    const skippedSeen = await maybeShowBootGreeting({
        isWelcomeSeen: () => true,
        markWelcomeSeen: () => { throw new Error("should not persist"); },
        isBlocked: () => false,
    });
    assert(skippedSeen === false, "skips when welcome already seen");

    const skippedBlocked = await maybeShowBootGreeting({
        isWelcomeSeen: () => false,
        markWelcomeSeen: () => { throw new Error("should not persist"); },
        isBlocked: () => true,
    });
    assert(skippedBlocked === false, "skips when blocked");

    console.log("bootGreeting tests passed");
}

run();
