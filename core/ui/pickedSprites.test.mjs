import { clearPickedSprite, clearPickedSprites, getPickedSprite, onPickedSpritesChanged, setPickedSprite } from "./pickedSprites.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

let changes = 0;
const off = onPickedSpritesChanged(() => changes++);

setPickedSprite("Makoto  Naegi", "/characters/Makoto/joy-2.png", "joy");
assert(getPickedSprite("makoto naegi")?.path === "/characters/Makoto/joy-2.png", "names match loosely");
assert(getPickedSprite("MAKOTO NAEGI")?.expression === "joy", "keeps the expression");
assert(getPickedSprite("Kyoko") === null, "nobody else is picked");
setPickedSprite("", "/x.png");
setPickedSprite("Kyoko", "");
assert(getPickedSprite("Kyoko") === null && changes === 1, "ignores a missing name or path");

clearPickedSprite("Kyoko");
assert(changes === 1, "clearing nobody changes nothing");
clearPickedSprite("makoto naegi");
assert(getPickedSprite("Makoto Naegi") === null && changes === 2, "clears one");

setPickedSprite("A", "/a.png");
setPickedSprite("B", "/b.png");
clearPickedSprites();
assert(!getPickedSprite("A") && !getPickedSprite("B"), "clears all");
off();
setPickedSprite("C", "/c.png");
assert(changes === 5, "unsubscribes");
console.log("pickedSprites: ok");
