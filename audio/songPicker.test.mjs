import {
    buildAssignedTrackCatalog,
    catalogParents,
    catalogPlaylistsForParent,
    filterTrackCatalog,
    pickPlaylistForTrack,
    pathsReferToSameTrack,
    trackDisplayName,
} from "./songPicker.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function run() {
    assert(trackDisplayName("/user/bgm/Hope's Peak.mp3") === "Hope's Peak", "display name strips path and extension");
    assert(pathsReferToSameTrack("/user/bgm/foo.mp3", "http://st/user/bgm/foo.mp3"), "same file via absolute URL");

    const tabs = [
        { settingKey: "daytimeTracks" },
        { settingKey: "happyTracks" },
        { settingKey: "sadTracks" },
        { settingKey: "trialAaTracks" },
    ];
    const tracks = {
        daytimeTracks: ["/bgm/box.mp3", "/bgm/hope.mp3"],
        happyTracks: ["/bgm/hope.mp3", "/bgm/sunny.mp3"],
        sadTracks: ["/bgm/rain.mp3"],
        trialAaTracks: ["/bgm/orphan.mp3"],
    };
    const catalog = buildAssignedTrackCatalog({
        tabs,
        getTracks: (key) => tracks[key] || [],
        labels: {
            daytimeTracks: "DAYTIME",
            happyTracks: "HAPPY",
            sadTracks: "SAD",
        },
        parents: {
            daytimeTracks: "PHASES",
            happyTracks: "MOODS",
            sadTracks: "MOODS",
        },
    });

    assert(catalog.length === 4, "unique paths only; orphan without parent skipped");
    const hope = catalog.find((e) => e.path === "/bgm/hope.mp3");
    assert(hope.playlists.length === 2, "hope tagged as both daytime and happy");
    assert(catalogParents(catalog).join(",") === "PHASES,MOODS", "parent chips");
    assert(catalogPlaylistsForParent(catalog, "MOODS").length === 2, "mood sub-filters");

    const moods = filterTrackCatalog(catalog, { parent: "MOODS" });
    assert(moods.every((e) => e.playlists.some((p) => p.parent === "MOODS")), "moods filter");
    assert(filterTrackCatalog(catalog, { query: "sun" }).length === 1, "name search");

    const picked = pickPlaylistForTrack(hope, { parent: "MOODS" });
    assert(picked.settingKey === "happyTracks", "filter prefers matching parent playlist");

    console.log("songPicker tests passed");
}

run();
