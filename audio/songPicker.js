/** Friendly filename without folders or extension. */
export function trackDisplayName(path) {
    if (!path) return "";
    let name = String(path);
    try {
        name = decodeURIComponent(new URL(path, "http://local").pathname.split("/").pop() || name);
    } catch {
        name = name.split("/").pop() || name;
    }
    name = name.replace(/\.[^.]+$/, "");
    return name.replace(/^asset:\s*/i, "");
}

export function pathsReferToSameTrack(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return trackDisplayName(a) === trackDisplayName(b);
}

/**
 * One row per assigned audio file. A file that sits on both a phase list and a
 * mood list appears once, with every playlist tagged on it.
 *
 * @param {object} opts
 * @param {{ settingKey: string }[]} opts.tabs
 * @param {(key: string) => string[]} opts.getTracks
 * @param {Record<string, string>} opts.labels
 * @param {Record<string, string>} opts.parents
 */
export function buildAssignedTrackCatalog({ tabs = [], getTracks, labels = {}, parents = {} } = {}) {
    const byPath = new Map();
    for (const tab of tabs) {
        const settingKey = tab?.settingKey;
        if (!settingKey) continue;
        const parent = parents[settingKey];
        if (!parent) continue;
        const label = labels[settingKey] || settingKey;
        const tracks = typeof getTracks === "function" ? (getTracks(settingKey) || []) : [];
        for (const path of tracks) {
            if (!path) continue;
            const key = String(path);
            let entry = byPath.get(key);
            if (!entry) {
                entry = { path: key, name: trackDisplayName(key), playlists: [] };
                byPath.set(key, entry);
            }
            if (!entry.playlists.some((p) => p.settingKey === settingKey)) {
                entry.playlists.push({ settingKey, parent, label });
            }
        }
    }
    return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function catalogParents(catalog) {
    const seen = new Set();
    const out = [];
    for (const entry of catalog || []) {
        for (const p of entry.playlists) {
            if (!p.parent || seen.has(p.parent)) continue;
            seen.add(p.parent);
            out.push(p.parent);
        }
    }
    return out;
}

export function catalogPlaylistsForParent(catalog, parent) {
    const seen = new Set();
    const out = [];
    for (const entry of catalog || []) {
        for (const p of entry.playlists) {
            if (parent && p.parent !== parent) continue;
            if (seen.has(p.settingKey)) continue;
            seen.add(p.settingKey);
            out.push(p);
        }
    }
    return out;
}

export function filterTrackCatalog(catalog, { parent = "", settingKey = "", query = "" } = {}) {
    const q = String(query || "").trim().toLowerCase();
    return (catalog || []).filter((entry) => {
        if (parent && !entry.playlists.some((p) => p.parent === parent)) return false;
        if (settingKey && !entry.playlists.some((p) => p.settingKey === settingKey)) return false;
        if (q && !entry.name.toLowerCase().includes(q)) return false;
        return true;
    });
}

export function pickPlaylistForTrack(entry, { parent = "", settingKey = "", preferredSettingKey = "" } = {}) {
    const lists = entry?.playlists || [];
    if (!lists.length) return null;
    if (settingKey) {
        const exact = lists.find((p) => p.settingKey === settingKey);
        if (exact) return exact;
    }
    if (parent) {
        const inParent = lists.filter((p) => p.parent === parent);
        if (preferredSettingKey) {
            const preferred = inParent.find((p) => p.settingKey === preferredSettingKey);
            if (preferred) return preferred;
        }
        if (inParent.length) return inParent[0];
    }
    if (preferredSettingKey) {
        const preferred = lists.find((p) => p.settingKey === preferredSettingKey);
        if (preferred) return preferred;
    }
    return lists[0];
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Modal over the game: filter assigned BGM by phase/mood, click a row to play.
 */
export function openSongPicker({
    catalog = [],
    currentPath = "",
    currentSettingKey = "",
    onPick,
    onClose,
} = {}) {
    document.getElementById("dangan-song-picker")?.remove();

    const parents = catalogParents(catalog);
    let parent = "";
    let settingKey = "";
    let query = "";

    const modal = document.createElement("div");
    modal.id = "dangan-song-picker";
    modal.className = "dangan-grab-modal dangan-song-picker";
    modal.innerHTML = `
        <div class="dangan-grab-backdrop" data-song-picker-dismiss></div>
        <div class="dangan-grab-card dangan-song-picker-card" role="dialog" aria-modal="true" aria-labelledby="dangan-song-picker-title">
            <div class="dangan-grab-header">
                <span id="dangan-song-picker-title">Songs</span>
                <button type="button" class="dangan-grab-close" aria-label="Close">✕</button>
            </div>
            <div class="dangan-song-picker-toolbar">
                <input type="search" class="dangan-song-picker-search" placeholder="Filter by name…" autocomplete="off" />
                <div class="dangan-song-picker-chips" data-chips="parent"></div>
                <div class="dangan-song-picker-chips" data-chips="playlist"></div>
            </div>
            <ul class="dangan-grab-list dangan-song-picker-list"></ul>
        </div>
    `;

    const closeBtn = modal.querySelector(".dangan-grab-close");
    const searchEl = modal.querySelector(".dangan-song-picker-search");
    const parentChips = modal.querySelector('[data-chips="parent"]');
    const playlistChips = modal.querySelector('[data-chips="playlist"]');
    const listEl = modal.querySelector(".dangan-song-picker-list");

    const close = () => {
        modal.remove();
        document.removeEventListener("keydown", onKeydown);
        try { onClose?.(); } catch { /* ignore */ }
    };
    const onKeydown = (e) => { if (e.key === "Escape") close(); };

    function chipButton(label, active, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dangan-song-picker-chip" + (active ? " is-active" : "");
        btn.textContent = label;
        btn.addEventListener("click", onClick);
        return btn;
    }

    function renderChips() {
        parentChips.innerHTML = "";
        parentChips.appendChild(chipButton("ALL", !parent, () => {
            parent = "";
            settingKey = "";
            render();
        }));
        for (const p of parents) {
            parentChips.appendChild(chipButton(p, parent === p, () => {
                parent = p;
                settingKey = "";
                render();
            }));
        }

        playlistChips.innerHTML = "";
        if (!parent) return;
        const playlists = catalogPlaylistsForParent(catalog, parent);
        if (playlists.length < 2) return;
        playlistChips.appendChild(chipButton("ALL", !settingKey, () => {
            settingKey = "";
            render();
        }));
        for (const p of playlists) {
            playlistChips.appendChild(chipButton(p.label, settingKey === p.settingKey, () => {
                settingKey = p.settingKey;
                render();
            }));
        }
    }

    function renderList() {
        const rows = filterTrackCatalog(catalog, { parent, settingKey, query });
        listEl.innerHTML = "";
        if (!rows.length) {
            const empty = document.createElement("li");
            empty.className = "dangan-song-picker-empty";
            empty.textContent = catalog.length
                ? "No songs match this filter."
                : "No tracks assigned. Add songs in Settings → BGM Tracks.";
            listEl.appendChild(empty);
            return;
        }
        for (const entry of rows) {
            const li = document.createElement("li");
            const playing = pathsReferToSameTrack(entry.path, currentPath);
            if (playing) li.classList.add("is-playing");
            const tags = entry.playlists
                .filter((p) => !parent || p.parent === parent)
                .map((p) => p.label);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dangan-song-picker-item";
            btn.innerHTML = `
                <span class="dangan-song-picker-name">${escapeHtml(entry.name)}</span>
                <span class="dangan-song-picker-tags">${escapeHtml(tags.join(" · "))}</span>
            `;
            btn.addEventListener("click", () => {
                const playlist = pickPlaylistForTrack(entry, {
                    parent,
                    settingKey,
                    preferredSettingKey: currentSettingKey,
                });
                try { onPick?.({ path: entry.path, settingKey: playlist?.settingKey || currentSettingKey }); } catch { /* ignore */ }
                close();
            });
            li.appendChild(btn);
            listEl.appendChild(li);
        }
    }

    function render() {
        renderChips();
        renderList();
    }

    closeBtn.addEventListener("click", close);
    modal.querySelector("[data-song-picker-dismiss]")?.addEventListener("click", close);
    searchEl.addEventListener("input", () => {
        query = searchEl.value;
        renderList();
    });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(modal);
    render();
    searchEl.focus();
    return { close };
}
