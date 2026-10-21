import { createEffectLedger, emptyEffects, hasEffects, markerSummary, messageIdentity } from "./effectLedger.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const msg = (name, mes, swipe_id = 0) => ({ name, mes, swipe_id, is_user: false });
const effects = (patch) => ({ ...emptyEffects(), ...patch });

function run() {
    assert(markerSummary("hi\nV3C| TB: Bloody Knife || kitchen\n*V3C| SOCIAL_DOWN: Byakuya*") === "down:byakuya,tb:bloodyknife", "summary lists markers");
    assert(markerSummary("**V3C| TB: Bloody  knife**") === markerSummary("V3C| TB: Bloody Knife"), "summary ignores formatting");
    assert(markerSummary("V3C| SOCIAL: Kyoko") === "up:kyoko", "plain SOCIAL counts as up");
    assert(markerSummary("no markers") === "", "no markers");
    assert(messageIdentity(msg("Kyoko", "a")) !== messageIdentity(msg("Kyoko", "a", 1)), "swipes differ");
    assert(messageIdentity(msg("Kyoko", "a")) !== messageIdentity(msg("Kyoko", "b")), "text differs");
    assert(!hasEffects(emptyEffects()) && hasEffects(effects({ coins: 5 })), "hasEffects");

    let store = {};
    let t = 0;
    const ledger = createEffectLedger({ getStore: () => store, now: () => ++t });
    const chat = [
        msg("Kyoko", "Look.\nV3C| TB: Knife || kitchen"),
        { name: "Me", mes: "ok", is_user: true },
        msg("Aoi", "Thanks!\nV3C| SOCIAL: Aoi"),
    ];
    assert(ledger.record({ chatId: "c1", mesId: 0, message: chat[0], effects: emptyEffects() }) === null, "nothing to record");
    ledger.record({ chatId: "c1", mesId: 0, message: chat[0], effects: effects({ truth: [{ id: "tb1" }], coins: 25 }) });
    ledger.record({ chatId: "c1", mesId: 2, message: chat[2], effects: effects({ trust: [{ key: "aoi" }] }) });
    ledger.record({ chatId: "c1", mesId: 2, message: chat[2], effects: effects({ xp: 3 }) });
    assert(Object.keys(store).length === 2, "one entry per message");
    assert(Object.values(store).find((e) => e.mesId === 2).xp === 3, "effects merge");

    // Nothing changed.
    let r = ledger.reconcile("c1", chat);
    assert(r.revert.length === 0 && r.moved.length === 0, "unchanged chat reverts nothing");
    assert(ledger.reconcile("other", []).revert.length === 0, "other chats untouched");

    // Delete the user message: Aoi's message moves up and keeps its effects.
    const afterDelete = [chat[0], chat[2]];
    r = ledger.reconcile("c1", afterDelete);
    assert(r.revert.length === 0 && r.moved.length === 1 && r.moved[0].from === 2 && r.moved[0].to === 1, "moved message follows");

    // Edit Kyoko's message without touching the marker: kept.
    const edited = [msg("Kyoko", "Look here.\n**V3C| TB: Knife || kitchen**"), afterDelete[1]];
    r = ledger.reconcile("c1", edited);
    assert(r.revert.length === 0, "marker-preserving edit keeps effects");
    assert(r.rekeyed.length === 1 && r.rekeyed[0].oldIdentity !== r.rekeyed[0].entry.identity, "edit reports the new identity");
    assert(ledger.reconcile("c1", edited).revert.length === 0, "and is re-keyed");

    // Swipe Kyoko's message: reverted.
    const swiped = [msg("Kyoko", "Something else.", 1), afterDelete[1]];
    r = ledger.reconcile("c1", swiped);
    assert(r.revert.length === 1 && r.revert[0].coins === 25, "swiped message reverted");
    assert(ledger.reconcile("c1", swiped).revert.length === 0, "reverted only once");

    // Delete Aoi's message.
    r = ledger.reconcile("c1", [swiped[0]]);
    assert(r.revert.length === 1 && r.revert[0].trust[0].key === "aoi", "deleted message reverted");
    assert(Object.keys(store).length === 0, "store empty");

    // Streaming: keyed by position, ignored by reconcile, finalized later.
    const live = [msg("Kyoko", "Partial V3C| TB: Rope")];
    ledger.record({ chatId: "c1", mesId: 0, message: live[0], effects: effects({ truth: [{ id: "tb2" }] }), pending: true });
    ledger.record({ chatId: "c1", mesId: 0, message: live[0], effects: effects({ coins: 5 }), pending: true });
    assert(ledger.reconcile("c1", []).revert.length === 0, "pending entries are not reconciled");
    live[0].mes = "Partial V3C| TB: Rope || in the gym\nThe end.";
    const done = ledger.finalize("c1", live);
    assert(done.length === 1 && done[0].identity, "finalize reports entries");
    const final = Object.values(store);
    assert(final.length === 1 && !final[0].pending && final[0].coins === 5 && final[0].truth.length === 1, "finalized with merged effects");
    assert(ledger.reconcile("c1", live).revert.length === 0, "finalized entry matches the final text");

    // Size cap keeps the newest entries.
    store = {};
    for (let i = 0; i < 650; i += 1) ledger.record({ chatId: "c2", mesId: i, message: msg("A", `m${i}`), effects: effects({ coins: 1 }) });
    assert(Object.keys(store).length === 600, "ledger is capped");
    assert(!Object.values(store).some((e) => e.mesId < 50), "oldest dropped");

    console.log("effectLedger tests passed");
}

run();
