import { filterChats, formatRelativeTime, sortChats, toTimestamp } from "./titleContinue.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(toTimestamp(1700000000000) === 1700000000000, "keeps epoch ms");
    assert(toTimestamp("2026-10-21@19h16m05s") === new Date(2026, 9, 21, 19, 16, 5).getTime(), "parses humanized dates");
    assert(toTimestamp("2026-10-21T19:16:05.000Z") === Date.parse("2026-10-21T19:16:05.000Z"), "parses ISO dates");
    assert(toTimestamp("October 21, 2026 7:16pm") > 0, "parses locale send_date");
    assert(toTimestamp("") === 0 && toTimestamp("nonsense") === 0, "unknown dates are 0");

    const rows = [
        { kind: "char", title: "Makoto", chatFile: "a", lastMessage: "hello", lastDate: 100, memberNames: ["Makoto"] },
        { kind: "group", title: "Class", chatFile: "b", lastMessage: "the trial begins", lastDate: 300, memberNames: ["Kyoko", "Byakuya"] },
        { kind: "char", title: "Kyoko", chatFile: "c", lastMessage: "", lastDate: "2026-01-01@00h00m00s", memberNames: ["Kyoko"] },
    ];
    const sorted = sortChats(rows);
    assert(sorted[0].chatFile === "c" && sorted[2].chatFile === "a", "sorts newest first");
    assert(rows[0].chatFile === "a", "does not mutate input");

    assert(filterChats(rows, { kind: "group" }).length === 1, "filters by kind");
    assert(filterChats(rows, { query: "kyoko" }).length === 2, "searches member names");
    assert(filterChats(rows, { query: "TRIAL" })[0].chatFile === "b", "searches previews case-insensitively");
    assert(filterChats(rows, { query: "kyoko", kind: "char" }).length === 1, "combines query and kind");

    const withSaves = [...rows, { kind: "save", title: "Hope's Peak", chatFile: "CHAPTER 1", lastMessage: "Kyoko", lastDate: 50, memberNames: ["Kyoko"] }];
    assert(filterChats(withSaves, { kind: "saves" }).length === 1, "saves tab lists only saves");
    assert(filterChats(withSaves, { kind: "all" }).length === 3, "all chats leaves saves out");
    assert(filterChats(withSaves, { kind: "saves", query: "kyoko" }).length === 1, "searches save rosters");
    assert(filterChats(withSaves, { kind: "group" }).length === 1, "kind filters still work");

    const now = 10 * 24 * 3600 * 1000;
    assert(formatRelativeTime(now - 30 * 1000, now) === "just now", "just now");
    assert(formatRelativeTime(now - 5 * 60 * 1000, now) === "5m ago", "minutes");
    assert(formatRelativeTime(now - 3 * 3600 * 1000, now) === "3h ago", "hours");
    assert(formatRelativeTime(now - 2 * 24 * 3600 * 1000, now) === "2d ago", "days");
    assert(formatRelativeTime(0, now) === "", "unknown date is blank");

    console.log("titleContinue tests passed");
}

run();
