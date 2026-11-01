// Find a SillyTavern background (.bg_example) by name. Pins, /bda bg= and the
// like name a background loosely ("kitchen", "Kitchen.png"), so the closest
// match wins: the exact file, then the file without its extension, then a
// name that starts with it, and only then one that contains it. Otherwise
// "kitchen" could land on "hotel_kitchen.png" just by coming first.

function stemOf(bgfile) {
    return String(bgfile || "").split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
}

// Best match in a list of bgfile names, or null.
export function pickBackgroundFile(files, name) {
    const want = String(name || "").trim().toLowerCase();
    if (!want) return null;
    const list = (files || []).filter(Boolean).map(String);
    const wantStem = stemOf(want);
    return list.find(f => f.toLowerCase() === want)
        || list.find(f => stemOf(f) === wantStem)
        || list.find(f => stemOf(f).startsWith(wantStem))
        || list.find(f => f.toLowerCase().includes(want))
        || null;
}

// The .bg_example element for a background name, or null.
export function findBackgroundElement(name) {
    const els = Array.from(document.querySelectorAll(".bg_example"));
    const file = pickBackgroundFile(els.map(el => el.getAttribute("bgfile")), name);
    return file ? els.find(el => el.getAttribute("bgfile") === file) || null : null;
}
