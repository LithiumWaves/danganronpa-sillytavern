import { buildFinishPayload, nextStep, prevStep, stepsFor, validateStep } from "./titleNewGame.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(stepsFor("multi").join() === "style,roster,map,summary", "several chats skips the story chat step");
    assert(stepsFor("single").join() === "style,group,roster,map,summary", "one main chat includes the story chat step");
    assert(stepsFor({ mode: "single", mapChoice: "hopes_peak" }).join() === "style,group,roster,map,summary", "built-in maps skip room placing");
    assert(stepsFor({ mode: "multi", mapChoice: "custom" }).join() === "style,roster,map,rooms,summary", "an uploaded map adds room placing");

    assert(nextStep({ step: "roster", mode: "multi" }) === "map", "roster -> map");
    assert(nextStep({ step: "map", mode: "multi", mapChoice: "hopes_peak" }) === "summary", "built-in map -> summary");
    assert(nextStep({ step: "map", mode: "multi", mapChoice: "custom" }) === "rooms", "custom map -> rooms");
    assert(prevStep({ step: "summary", mode: "multi", mapChoice: "custom" }) === "rooms", "summary <- rooms");

    assert(validateStep({ step: "map", mapChoice: "hopes_peak" }) === "", "built-in map ok");
    assert(validateStep({ step: "map", mapChoice: "bogus" }) !== "", "unknown map rejected");
    assert(validateStep({ step: "map", mapChoice: "custom", customMap: { name: "X", floors: [{ label: "F1", image: "" }] } }) !== "", "custom map needs a picture");
    assert(validateStep({ step: "rooms", customMap: { rooms: [] } }) !== "", "custom map needs a room");

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
    assert(multi.map.choice === "hopes_peak" && multi.map.areas.includes("hopes_peak"), "defaults to Hope's Peak");

    const single = buildFinishPayload({
        fresh: false, mode: "single", groupName: " Hope's Peak ", groupMembers: new Set(["A", "B"]),
        roster: new Map([["A", ""], ["B", "Detective"]]), persona: "",
    });
    assert(single.groupName === "Hope's Peak" && single.groupMembers.join() === "A,B", "single keeps story chat");
    assert(single.roster.length === 2, "single keeps roster");
    assert(Array.isArray(single.hosts) && single.hosts.length === 0, "no hosts picked means Auto");

    const hosted = buildFinishPayload({
        fresh: false, mode: "single", groupName: "X", groupMembers: new Set(["A", "Monokuma", "Monomi"]),
        roster: new Map([["A", ""], ["Monokuma", ""], ["Monomi", ""]]), hosts: new Set(["Monomi"]), persona: "",
    });
    assert(hosted.hosts.join() === "Monomi", "picked hosts are carried");
    assert(hosted.roster.map((r) => r.name).join() === "A,Monokuma", "hosts are kept off the class roster");
    const auto = buildFinishPayload({
        fresh: false, mode: "multi", groupMembers: new Set(), roster: new Map([["A", ""], ["monokuma", ""]]), persona: "",
    });
    assert(auto.roster.map((r) => r.name).join() === "A", "Auto keeps Monokuma off the class roster");

    console.log("titleNewGame tests passed");
}

run();
