import {
    avatarStemKey,
    computeRoomDisabledMembers,
    disabledMembersEqual,
    indexCharsByAvatar,
    lookupCharByAvatar,
    shouldLeavePresenceMuteAlone,
} from "./roomPresence.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(shouldLeavePresenceMuteAlone("Narrator") === true, "narrator left alone");
    assert(shouldLeavePresenceMuteAlone("Kyoko Kirigiri") === false, "student not left alone");
    assert(shouldLeavePresenceMuteAlone("") === false, "empty name is not left unmuted");

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

    const unresolved = computeRoomDisabledMembers({
        memberAvatars: ["ghost.png", "kyoko.png"],
        currentDisabled: [],
        charByAvatar: { "kyoko.png": { name: "Kyoko Kirigiri" } },
        inRoomNameKeys: ["Kyoko Kirigiri"],
        rosterByKey,
    });
    assert(unresolved.includes("ghost.png"), "unresolved avatar is muted instead of left present");
    assert(!unresolved.includes("kyoko.png"), "resolved occupant still unmuted");

    const suffixed = computeRoomDisabledMembers({
        memberAvatars: ["kyoko.png", "makoto.png"],
        currentDisabled: ["kyoko.png"],
        charByAvatar: {
            "kyoko.png": { name: "Kyoko Kirigiri (DR1)" },
            "makoto.png": { name: "Makoto Naegi" },
        },
        inRoomNameKeys: ["Kyoko Kirigiri"],
        rosterByKey,
    });
    assert(!suffixed.includes("kyoko.png"), "card title suffix still counts as in-room so she unmutes");
    assert(suffixed.includes("makoto.png"), "other students stay muted");

    const firstName = computeRoomDisabledMembers({
        memberAvatars: ["kyoko.png", "makoto.png"],
        currentDisabled: ["kyoko.png"],
        charByAvatar,
        inRoomNameKeys: ["Kyoko"],
        rosterByKey,
    });
    assert(!firstName.includes("kyoko.png"), "unique first name unmutes the matching student");
    assert(firstName.includes("makoto.png"), "other students stay muted on first-name match");

    const encodedAvatar = "Kyoko%20Kirigiri.png";
    const indexed = indexCharsByAvatar([{ name: "Kyoko Kirigiri", avatar: "Kyoko Kirigiri.png" }]);
    assert(lookupCharByAvatar(indexed, encodedAvatar)?.name === "Kyoko Kirigiri", "encoded avatar still resolves");
    assert(avatarStemKey("folder/Kyoko_Kirigiri.png") === "kyoko kirigiri", "avatar stem matches roster names");

    const byStem = computeRoomDisabledMembers({
        memberAvatars: ["Kyoko Kirigiri.png", "makoto.png"],
        currentDisabled: ["Kyoko Kirigiri.png"],
        charByAvatar: {},
        inRoomNameKeys: ["Kyoko Kirigiri"],
        rosterByKey,
    });
    assert(!byStem.includes("Kyoko Kirigiri.png"), "avatar filename unmutes even when the ST card name is missing");
    assert(byStem.includes("makoto.png"), "unrelated missing-name member stays muted");

    console.log("roomPresence tests passed");
}

run();
