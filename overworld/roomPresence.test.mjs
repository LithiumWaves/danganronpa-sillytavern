import { computeRoomDisabledMembers, disabledMembersEqual, shouldLeavePresenceMuteAlone } from "./roomPresence.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(shouldLeavePresenceMuteAlone("Narrator") === true, "narrator left alone");
    assert(shouldLeavePresenceMuteAlone("Kyoko Kirigiri") === false, "student not left alone");

    const members = ["kyoko.png", "byakuya.png", "makoto.png", "narrator.png"];
    const charByAvatar = {
        "kyoko.png": { name: "Kyoko Kirigiri" },
        "byakuya.png": { name: "Byakuya Togami" },
        "makoto.png": { name: "Makoto Naegi" },
        "narrator.png": { name: "Narrator" },
    };
    const rosterByKey = {
        "kyoko kirigiri": {},
        "byakuya togami": {},
        "makoto naegi": {},
        narrator: {},
    };

    const dining = computeRoomDisabledMembers({
        memberAvatars: members,
        currentDisabled: ["narrator.png"],
        charByAvatar,
        inRoomNameKeys: ["Kyoko Kirigiri", "Byakuya Togami"],
        rosterByKey,
    });
    assert(dining.includes("makoto.png"), "makoto muted when not in dining hall");
    assert(!dining.includes("kyoko.png"), "kyoko unmuted in dining hall");
    assert(!dining.includes("byakuya.png"), "byakuya unmuted in dining hall");
    assert(dining.includes("narrator.png"), "narrator mute preserved");

    const deadRoster = { ...rosterByKey, "kyoko kirigiri": { dead: true } };
    const withDead = computeRoomDisabledMembers({
        memberAvatars: members,
        currentDisabled: [],
        charByAvatar,
        inRoomNameKeys: ["Kyoko Kirigiri", "Byakuya Togami"],
        rosterByKey: deadRoster,
    });
    assert(withDead.includes("kyoko.png"), "dead kyoko stays muted even if her sprite would be in-room");

    const emptyRoom = computeRoomDisabledMembers({
        memberAvatars: members,
        currentDisabled: [],
        charByAvatar,
        inRoomNameKeys: [],
        rosterByKey,
    });
    assert(emptyRoom.includes("kyoko.png") && emptyRoom.includes("byakuya.png") && emptyRoom.includes("makoto.png"), "empty room mutes all students");
    assert(!emptyRoom.includes("narrator.png"), "unmuted narrator stays unmuted when left alone");

    const spaced = computeRoomDisabledMembers({
        memberAvatars: members,
        currentDisabled: [],
        charByAvatar,
        inRoomNameKeys: ["  KYOKO   KIRIGIRI  "],
        rosterByKey,
    });
    assert(!spaced.includes("kyoko.png"), "normalized names still count as in-room");
    assert(!disabledMembersEqual(["a"], ["a", "b"]), "length mismatch");

    console.log("roomPresence tests passed");
}

run();
