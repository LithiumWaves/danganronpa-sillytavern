import { escapeHtml, isTypingTarget, stepFocus, trackName } from "./titleUtils.js";

// SETUP → MUSIC. Picks the tracks for each BGM playlist (the same lists as the
// Monopad's BGM tab) from the files in SillyTavern's assets/bgm folder.
export function mountMusicPanel(container, api) {
    const { services, sfx } = api;
    let playlists = [];
    let files = [];
    let selectedKey = "";
    let query = "";
    let previewing = "";
    let disposed = false;

    container.innerHTML = `<div class="dgn-title-empty">LOADING MUSIC…</div>`;

    const selected = () => playlists.find((p) => p.settingKey === selectedKey) || null;

    const renderLists = () => {
        const groups = [];
        for (const list of playlists) {
            let group = groups.find((g) => g.name === list.group);
            if (!group) groups.push(group = { name: list.group, lists: [] });
            group.lists.push(list);
        }
        return groups.map((group) => `
            <h4 class="dgn-title-split-group">${escapeHtml(group.name)}</h4>
            ${group.lists.map((list) => `
                <button type="button" class="dgn-title-split-item${list.settingKey === selectedKey ? " is-active" : ""}${list.tracks.length ? "" : " is-empty"}" data-list="${escapeHtml(list.settingKey)}">
                    <span>${escapeHtml(list.label)}</span>
                    <span class="dgn-title-split-count">${list.tracks.length || "–"}</span>
                </button>
            `).join("")}
        `).join("");
    };

    const renderTracks = () => {
        const list = selected();
        if (!list) return "";
        const picked = new Set(list.tracks);
        // Picked tracks whose file is gone still show, so they can be removed.
        const all = [...files, ...list.tracks.filter((t) => !files.includes(t))];
        const q = query.trim().toLowerCase();
        const visible = q ? all.filter((path) => trackName(path).toLowerCase().includes(q)) : all;
        if (!visible.length) return `<div class="dgn-title-empty">NO TRACKS MATCH.</div>`;
        return visible.map((path) => `
            <div class="dgn-title-track${picked.has(path) ? " is-on" : ""}${files.includes(path) ? "" : " is-missing"}" data-path="${escapeHtml(path)}">
                <label>
                    <input type="checkbox"${picked.has(path) ? " checked" : ""}>
                    <span class="dgn-title-track-name">${escapeHtml(trackName(path))}</span>
                    ${files.includes(path) ? "" : `<span class="dgn-title-chip">FILE MISSING</span>`}
                </label>
                <button type="button" class="dgn-title-btn is-small dgn-title-track-play${previewing === path ? " is-playing" : ""}" aria-label="Preview ${escapeHtml(trackName(path))}">${previewing === path ? "■ STOP" : "▶ PLAY"}</button>
            </div>
        `).join("");
    };

    const renderDetail = () => {
        const list = selected();
        const detail = container.querySelector(".dgn-title-split-detail");
        if (!detail) return;
        if (!list) {
            detail.innerHTML = `<div class="dgn-title-empty">PICK A PLAYLIST.</div>`;
            return;
        }
        detail.innerHTML = `
            <div class="dgn-title-split-head">
                <h3>${escapeHtml(list.label)}</h3>
                <span class="dgn-title-count">${list.tracks.length} PICKED</span>
                ${list.tracks.length ? `<button type="button" class="dgn-title-btn is-small" data-clear>CLEAR</button>` : ""}
            </div>
            <div class="dgn-title-toolbar">
                <input type="search" class="dgn-title-input" placeholder="Search tracks…" value="${escapeHtml(query)}" aria-label="Search tracks">
            </div>
            <div class="dgn-title-track-list">${renderTracks()}</div>
        `;
    };

    const refreshTracks = () => {
        const host = container.querySelector(".dgn-title-track-list");
        if (host) host.innerHTML = renderTracks();
        const count = container.querySelector(".dgn-title-split-head .dgn-title-count");
        if (count) count.textContent = `${selected()?.tracks.length || 0} PICKED`;
        const nav = container.querySelector(".dgn-title-split-list");
        if (nav) nav.innerHTML = renderLists();
    };

    const render = () => {
        if (!files.length && !playlists.some((p) => p.tracks.length)) {
            container.innerHTML = `
                <div class="dgn-title-empty">
                    <p>NO MUSIC FILES FOUND.</p>
                    <p class="dgn-title-note">Put audio files in SillyTavern's data/default-user/assets/bgm folder, then reload the page.</p>
                </div>`;
            return;
        }
        container.innerHTML = `
            <p class="dgn-title-note">Pick the tracks each part of the game plays. A playlist with several tracks plays one at random. Changes save immediately.</p>
            <div class="dgn-title-split dgn-title-music">
                <nav class="dgn-title-split-list" aria-label="Playlists">${renderLists()}</nav>
                <section class="dgn-title-split-detail"></section>
            </div>
        `;
        renderDetail();
    };

    const stopPreview = () => {
        if (!previewing) return;
        previewing = "";
        try { services.stopBgmPreview?.(); } catch { /* ignore */ }
    };

    const save = (list) => {
        try { services.setBgmPlaylist?.(list.settingKey, [...list.tracks]); } catch (e) { console.warn("[Dangan][Title] saving playlist failed:", e); }
    };

    const selectList = (key) => {
        if (key === selectedKey) return;
        selectedKey = key;
        query = "";
        container.querySelectorAll(".dgn-title-split-item").forEach((el) => el.classList.toggle("is-active", el.dataset.list === key));
        renderDetail();
    };

    container.addEventListener("click", (ev) => {
        const t = ev.target;
        const item = t.closest?.(".dgn-title-split-item");
        if (item) {
            sfx("click");
            selectList(item.dataset.list);
            return;
        }
        if (t.closest?.("[data-clear]")) {
            const list = selected();
            if (!list) return;
            sfx("click");
            list.tracks = [];
            save(list);
            renderDetail();
            container.querySelector(".dgn-title-split-list").innerHTML = renderLists();
            return;
        }
        const play = t.closest?.(".dgn-title-track-play");
        if (play) {
            const path = play.closest(".dgn-title-track")?.dataset.path;
            if (!path) return;
            if (previewing === path) {
                stopPreview();
            } else {
                stopPreview();
                let ok = false;
                try { ok = services.previewBgm?.(path) !== false; } catch { ok = false; }
                if (ok) previewing = path;
            }
            sfx("click");
            refreshTracks();
        }
    });

    container.addEventListener("change", (ev) => {
        const box = ev.target;
        if (box.type !== "checkbox") return;
        const list = selected();
        const path = box.closest(".dgn-title-track")?.dataset.path;
        if (!list || !path) return;
        list.tracks = box.checked ? [...list.tracks.filter((t) => t !== path), path] : list.tracks.filter((t) => t !== path);
        save(list);
        sfx("click");
        box.closest(".dgn-title-track").classList.toggle("is-on", box.checked);
        container.querySelector(".dgn-title-split-head .dgn-title-count").textContent = `${list.tracks.length} PICKED`;
        container.querySelector(".dgn-title-split-list").innerHTML = renderLists();
    });

    container.addEventListener("input", (ev) => {
        if (ev.target.type !== "search") return;
        query = ev.target.value;
        container.querySelector(".dgn-title-track-list").innerHTML = renderTracks();
    });

    Promise.all([
        Promise.resolve().then(() => services.getBgmPlaylists?.() || []),
        Promise.resolve().then(() => services.listBgmFiles?.() || []),
    ]).then(([lists, paths]) => {
        if (disposed) return;
        playlists = (Array.isArray(lists) ? lists : []).map((p) => ({ ...p, tracks: [...(p.tracks || [])] }));
        files = Array.isArray(paths) ? paths : [];
        selectedKey = playlists.find((p) => !p.tracks.length)?.settingKey || playlists[0]?.settingKey || "";
        render();
    }).catch((e) => {
        console.warn("[Dangan][Title] music panel failed:", e);
        if (!disposed) container.innerHTML = `<div class="dgn-title-empty">COULDN'T LOAD THE MUSIC LIST.</div>`;
    });

    return {
        unmount() {
            disposed = true;
            stopPreview();
        },
        onBack() {
            stopPreview();
            api.openPanel("setup");
            return true;
        },
        onKey(ev) {
            if (isTypingTarget(ev.target)) return false;
            if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return false;
            const inNav = !!ev.target.closest?.(".dgn-title-split-list");
            const selector = inNav ? ".dgn-title-split-item" : ".dgn-title-split-detail input, .dgn-title-split-detail button";
            return stepFocus(container, selector, ev.key === "ArrowDown" ? 1 : -1, sfx);
        },
    };
}
