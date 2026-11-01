import { isGreetingMessage, stripLeadingGreetings } from "./cardHygiene.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const greeting = (mes) => ({ name: "Kokichi", is_user: false, mes, extra: {} });
const reply = (mes) => ({ name: "Kokichi", is_user: false, mes, gen_started: "x", gen_finished: "y", extra: { api: "openai", model: "m" } });
const user = (mes) => ({ name: "You", is_user: true, mes, extra: {} });

function run() {
    assert(isGreetingMessage(greeting("Nishishi! Hello there.")), "a never-generated message is a greeting");
    assert(!isGreetingMessage(reply("Nishishi! Hello there.")), "a generated reply is kept even if it repeats a greeting");
    assert(!isGreetingMessage(reply("A brand new reply")), "a generated reply is never a greeting");
    assert(!isGreetingMessage(user("hello")), "user messages are kept");
    assert(!isGreetingMessage({ ...greeting("note"), is_system: true }), "system messages are kept");
    assert(!isGreetingMessage({ ...greeting("narration"), extra: { type: "narrator" } }), "narrator messages are kept");

    // The bug: a chat with no player message yet lost the reply being saved.
    const noUser = [greeting("Nishishi! Hello there."), reply("Monokuma announces the motive.")];
    assert(stripLeadingGreetings(noUser) === 1 && noUser.length === 1 && noUser[0].mes.startsWith("Monokuma"), "the reply survives, the greeting goes");

    // Greetings before the first player message go; everything after stays.
    const chat = [greeting("Nishishi! Hello there."), greeting("Another card's greeting"), user("hi"), reply("hey"), greeting("Nishishi! Hello there.")];
    assert(stripLeadingGreetings(chat) === 2 && chat.length === 3 && chat[0].is_user, "only leading greetings removed");

    assert(stripLeadingGreetings([]) === 0, "empty chat");

    const seen = [];
    const two = [greeting("a"), greeting("b"), user("hi")];
    stripLeadingGreetings(two, (i) => seen.push(i));
    assert(seen.join() === "1,0", "removed indexes reported last first");

    console.log("cardHygiene tests passed");
}

run();
