import {
    EVENT_STATUS,
    addGroupEvent,
    buildEventProposalPrompt,
    buildEventTodayNote,
    describeEventsForCase,
    describeGroupEvents,
    eventAttendees,
    eventFromMarker,
    eventsForSlot,
    finishPastEvents,
    normalizeGroupEvents,
    parseEventMarkers,
    resolveWhen,
    stripEventMarkers,
    updateGroupEvent,
    upcomingEvents,
} from "./groupEvents.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const rooms = [
    { id: "cafeteria", label: "Cafeteria" },
    { id: "gym", label: "Gym" },
    { id: "laundry_room", label: "Laundry Room" },
];

function run() {
    // When.
    assert(JSON.stringify(resolveWhen("Day 3 night", { day: 2 })) === '{"day":3,"time":"night"}', "Day N night");
    assert(JSON.stringify(resolveWhen("day 2", { day: 2 })) === '{"day":2,"time":"day"}', "Day N");
    assert(JSON.stringify(resolveWhen("tonight", { day: 4 })) === '{"day":4,"time":"night"}', "tonight");
    assert(JSON.stringify(resolveWhen("tomorrow night", { day: 4, time: "night" })) === '{"day":5,"time":"night"}', "tomorrow night");
    assert(resolveWhen("Day 1 night", { day: 2 }) === null, "never the past");
    assert(resolveWhen("Day 2 day", { day: 2, time: "night" }) === null, "nor this morning once it's night");
    assert(resolveWhen("someday", { day: 2 }) === null, "nonsense");

    // Markers.
    const reply = "Sure, let's do it!\nV3C| EVENT: Byakuya's Party | the gym | Day 3 night | Byakuya Togami\nV3C｜EVENT: Study Group | Laundry Room | tomorrow | Kyoko | Makoto, Aoi\nV3C| EVENT: broken";
    const markers = parseEventMarkers(reply);
    assert(markers.length === 2 && markers[0].title === "Byakuya's Party" && markers[0].host === "Byakuya Togami", "parses markers");
    assert(markers[1].attendees.join() === "Makoto,Aoi", "optional invitees");
    assert(stripEventMarkers(reply).trim() === "Sure, let's do it!", "strips markers");

    const { event } = eventFromMarker(markers[0], { rooms, day: 2 });
    assert(event.roomId === "gym" && event.day === 3 && event.time === "night" && event.status === EVENT_STATUS.PLANNED, "event from marker");
    assert(eventFromMarker({ ...markers[0], room: "the moon" }, { rooms, day: 2 }).error, "unknown room");
    assert(eventFromMarker({ ...markers[0], when: "Day 1" }, { rooms, day: 2 }).error, "past slot");

    // The list.
    let list = [];
    let r = addGroupEvent(list, event);
    assert(r.added, "added");
    list = r.list;
    r = addGroupEvent(list, { ...event, id: "" });
    assert(!r.added && r.list.length === 1, "no duplicates");
    const study = eventFromMarker(markers[1], { rooms, day: 2 }).event;
    list = addGroupEvent(list, study).list;
    assert(list.length === 2 && new Set(list.map((e) => e.id)).size === 2, "unique ids");
    assert(upcomingEvents(list, 2, "day").map((e) => e.title).join() === "Study Group,Byakuya's Party", "soonest first");
    assert(eventsForSlot(list, 3, "night").length === 1 && eventsForSlot(list, 3, "day")[0].title === "Study Group", "events for a slot");

    // Who comes.
    const alive = ["Byakuya Togami", "Kyoko Kirigiri", "Makoto Naegi", "Aoi Asahina", "Celeste"];
    assert(eventAttendees(event, alive).length === 5, "everyone when nobody is listed");
    assert(eventAttendees(normalizeGroupEvents([{ ...study, host: "Kyoko Kirigiri", attendees: ["Makoto Naegi", "Ghost"] }])[0], alive).join() === "Kyoko Kirigiri,Makoto Naegi", "host and invitees, alive only");

    // Notes.
    const here = buildEventTodayNote(list, { roomId: "gym", day: 3, time: "night" });
    assert(here.includes("[EVENT TODAY]") && here.includes("Byakuya's Party"), "event note in its room");
    const away = buildEventTodayNote(list, { roomId: "cafeteria", day: 3, time: "night" });
    assert(!away.includes("[EVENT TODAY]") && away.includes("happening now"), "elsewhere it's only known about");
    assert(!here.includes("[PLANNED GET-TOGETHERS]"), "nothing else planned once the study group is over");
    assert(buildEventTodayNote(list, { roomId: "cafeteria", day: 3, time: "day" }).includes("Byakuya's Party in the Gym, Day 3 night"), "planned ones are known");
    assert(buildEventTodayNote(list, { roomId: "gym", day: 5, time: "day" }) === "", "nothing after");

    // Finishing, cancelling.
    const later = finishPastEvents(list, 4, "day");
    assert(later.every((e) => e.status === EVENT_STATUS.DONE), "past events are done");
    const cancelled = updateGroupEvent(list, list[0].id, { status: EVENT_STATUS.CANCELLED });
    assert(upcomingEvents(cancelled, 2, "day").length === 1, "cancelled events aren't upcoming");
    assert(normalizeGroupEvents([{ title: "x" }, null, { title: "Ok", roomId: "gym", day: 2 }]).length === 1, "bad rows dropped");

    // Prompts.
    assert(describeEventsForCase(list, 2, "day")[1].includes("gym") && describeEventsForCase(list, 2, "day")[1].includes("Day 3 night"), "planner lines");
    const prompt = buildEventProposalPrompt({ cast: [{ name: "Aoi", ultimate: "Swimmer" }], rooms, day: 4 });
    assert(prompt.includes("Day 4") && prompt.includes("Aoi (Ultimate Swimmer)") && prompt.includes("- Gym") && !prompt.includes("{{"), "proposal prompt");
    assert(describeGroupEvents(list).includes("Study Group"), "describe");

    console.log("groupEvents tests passed");
}

run();
