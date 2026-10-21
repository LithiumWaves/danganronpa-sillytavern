import { buildFinishPayload, nextStep, prevStep, stepsFor, validateStep } from "./titleNewGame.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(stepsFor("multi").join() === "style,roster,summary", "several chats skips the story chat step");
    assert(stepsFor("single").join() === "style,group,roster,summary", "one main chat includes the story chat step");

    assert(nextStep({ step: "style", mode: "multi" }) === "roster", "multi: style -> roster");
    assert(nextStep({ step: "style", mode: "single" }) === "group", "single: style -> group");
    assert(nextStep({ step: "summary", mode: "single" }) === null, "summary is last");
    assert(prevStep({ step: "roster", mode: "multi" }) === "style", "multi: roster <- style");
    assert(prevStep({ step: "roster", mode: "single" }) === "group", "single: roster <- group");
    assert(prevStep({ step: "style", mode: "single" }) === null, "style is first");

    assert(validateStep({ step: "style", mode: null }) !== "", "style needs a mode");
    assert(validateStep({ step: "style", mode: "single" }) === "", "style ok with a mode");
    assert(validateStep({ step: "group", groupName: " ", groupMembers: new Set(["A", "B"]) }) !== "", "group needs a name");
    assert(validateStep({ step: "group", groupName: "X", groupMembers: new Set(["A"]) }) !== "", "group needs two members");
    assert(validateStep({ step: "group", groupName: "X", groupMembers: new Set(["A", "B"]) }) === "", "group ok");
    assert(validateStep({ step: "roster", roster: new Map() }) !== "", "roster needs a classmate");
    assert(validateStep({ step: "roster", roster: new Map([["A", ""]]) }) === "", "roster ok");

    const multi = buildFinishPayload({
        fresh: true, mode: "multi", groupName: "Ignored", groupMembers: new Set(["A", "B"]),
        roster: new Map([["A", " Lucky Student "]]), persona: "me.png",
    });
    assert(multi.groupName === "" && multi.groupMembers.length === 0, "multi drops story chat fields");
    assert(multi.roster[0].ultimate === "Lucky Student", "trims Ultimates");
    assert(multi.fresh === true && multi.persona === "me.png", "carries fresh flag and persona");

    const single = buildFinishPayload({
        fresh: false, mode: "single", groupName: " Hope's Peak ", groupMembers: new Set(["A", "B"]),
        roster: new Map([["A", ""], ["B", "Detective"]]), persona: "",
    });
    assert(single.groupName === "Hope's Peak" && single.groupMembers.join() === "A,B", "single keeps story chat");
    assert(single.roster.length === 2, "single keeps roster");

    console.log("titleNewGame tests passed");
}

run();
