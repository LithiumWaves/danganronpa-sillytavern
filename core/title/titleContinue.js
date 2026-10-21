import { escapeHtml, isTypingTarget } from "./titleUtils.js";

const FILTERS = Object.freeze([
    { id: "all", label: "ALL" },
    { id: "char", label: "ONE-ON-ONE" },
    { id: "group", label: "GROUP" },
]);

// SillyTavern reports a chat's last date as epoch ms, an ISO string, a
// locale string ("October 21, 2026 7:16pm") or its humanized form
// ("2026-10-21@19h16m05s"). Normalise everything to epoch ms (0 if unknown).
export function toTimestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const humanized = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*@\s*(\d{1,2})h\s*(\d{1,2})m\s*(\d{1,2})s/);
    if (humanized) {
        const [, y, mo, d, h, mi, s] = humanized.map(Number);
        return new Date(y, mo - 1, d, h, mi, s).getTime();
    }
    const parsed = Date.parse(text.replace(/(\d)(am|pm)$/i, "$1 $2"));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function sortChats(rows) {
    return [...(Array.isArray(rows) ? rows : [])]
        .sort((a, b) => toTimestamp(b?.lastDate) - toTimestamp(a?.lastDate));
}

export function filterChats(rows, { query = "", kind = "all" } = {}) {
    const needle = String(query || "").trim().toLowerCase();
    return (Array.isArray(rows) ? rows : []).filter((row) => {
        if (kind !== "all" && row?.kind !== kind) return false;
        if (!needle) return true;
        const hay = [row?.title, row?.chatFile, row?.lastMessage, ...(row?.memberNames || [])]
            .join(" ")
            .toLowerCase();
        return hay.includes(needle);
    });
}

export function formatRelativeTime(value, now = Date.now()) {
    const ts = toTimestamp(value);
    if (!ts) return "";
    const diff = Math.max(0, now - ts);
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    if (diff < min) return "just now";
    if (diff < hour) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return new Date(ts).toLocaleDateString();
}

function previewText(text, max = 140) {
    const flat = String(text ?? "").replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function renderAvatars(avatars = []) {
    const shown = avatars.slice(0, 3);
    const extra = avatars.length - shown.length;
    return `
        <div class="dgn-title-avatars" data-count="${shown.length}">
            ${shown.map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy" draggable="false">`).join("")}
            ${extra > 0 ? `<span class="dgn-title-avatars-more">+${extra}</span>` : ""}
        </div>
    `;
}

export function mountContinuePanel(container, api) {
    const { services, sfx, close } = api;
    container.innerHTML = `
        <div class="dgn-title-continue">
            <div class="dgn-title-toolbar">
                <input type="search" class="dgn-title-input dgn-title-search" placeholder="Search chats, characters, messages…" aria-label="Search chats">
                <div class="dgn-title-tabs" role="tablist">
                    ${FILTERS.map((f, i) => `<button type="button" class="dgn-title-tab${i === 0 ? " is-active" : ""}" role="tab" data-filter="${f.id}">${f.label}</button>`).join("")}
                </div>
            </div>
            <div class="dgn-title-chat-list" role="listbox" aria-label="Saved chats">
                <div class="dgn-title-empty">LOADING CHATS…</div>
            </div>
        </div>
    `;
    const searchEl = container.querySelector(".dgn-title-search");
    const listEl = container.querySelector(".dgn-title-chat-list");
    const tabs = Array.from(container.querySelectorAll(".dgn-title-tab"));

    let allRows = [];
    let visible = [];
    let active = 0;
    let kind = "all";
    let disposed = false;
    let opening = false;

    const setActive = (index, { focus = true, silent = false } = {}) => {
        if (!visible.length) return;
        const next = Math.max(0, Math.min(visible.length - 1, index));
        if (next !== active && !silent) sfx("hover");
        active = next;
        listEl.querySelectorAll(".dgn-title-chat").forEach((el, i) => {
            el.classList.toggle("is-active", i === active);
            el.tabIndex = i === active ? 0 : -1;
        });
        const el = listEl.querySelectorAll(".dgn-title-chat")[active];
        if (focus) el?.focus({ preventScroll: true });
        el?.scrollIntoView?.({ block: "nearest" });
    };

    const render = () => {
        visible = filterChats(allRows, { query: searchEl.value, kind });
        if (!allRows.length) {
            listEl.innerHTML = `
                <div class="dgn-title-empty">
                    <p>NO SAVED CHATS YET.</p>
                    <button type="button" class="dgn-title-btn is-primary" data-go="newGame">START A NEW GAME</button>
                </div>`;
            return;
        }
        if (!visible.length) {
            listEl.innerHTML = `<div class="dgn-title-empty">NO CHATS MATCH.</div>`;
            return;
        }
        listEl.innerHTML = visible.map((row, i) => `
            <button type="button" class="dgn-title-chat" role="option" data-index="${i}" tabindex="-1">
                ${renderAvatars(row.avatars)}
                <span class="dgn-title-chat-main">
                    <span class="dgn-title-chat-name">
                        ${escapeHtml(row.title)}
                        ${row.current ? `<span class="dgn-title-badge">CURRENT</span>` : ""}
                        <span class="dgn-title-chip">${row.kind === "group" ? "GROUP" : "1:1"}</span>
                    </span>
                    <span class="dgn-title-chat-file">${escapeHtml(row.chatFile)}</span>
                    <span class="dgn-title-chat-preview">${escapeHtml(previewText(row.lastMessage))}</span>
                </span>
                <span class="dgn-title-chat-meta">
                    <span>${escapeHtml(formatRelativeTime(row.lastDate))}</span>
                    ${Number.isFinite(row.messageCount) ? `<span>${row.messageCount} MSG</span>` : ""}
                </span>
            </button>
        `).join("");
        active = Math.min(active, visible.length - 1);
        setActive(active, { focus: false, silent: true });
    };

    const pick = (row) => {
        if (!row || opening) return;
        opening = true;
        sfx("click");
        close(() => services.openChat?.(row));
    };

    const setKind = (next) => {
        if (next === kind) return;
        kind = next;
        tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.filter === kind));
        sfx("hover");
        active = 0;
        render();
    };

    searchEl.addEventListener("input", () => { active = 0; render(); });
    tabs.forEach((t) => t.addEventListener("click", () => setKind(t.dataset.filter)));
    listEl.addEventListener("click", (ev) => {
        if (ev.target.closest?.('[data-go="newGame"]')) {
            sfx("click");
            api.openPanel("newGame");
            return;
        }
        const el = ev.target.closest?.(".dgn-title-chat");
        if (el) pick(visible[Number(el.dataset.index)]);
    });
    listEl.addEventListener("mouseover", (ev) => {
        const el = ev.target.closest?.(".dgn-title-chat");
        if (el) setActive(Number(el.dataset.index), { focus: false });
    });

    Promise.resolve()
        .then(() => services.listChats?.() ?? [])
        .then((rows) => {
            if (disposed) return;
            allRows = sortChats(rows);
            render();
            if (visible.length) setActive(0, { silent: true });
        })
        .catch((e) => {
            if (disposed) return;
            console.warn("[Dangan][Title] listChats failed:", e);
            listEl.innerHTML = `<div class="dgn-title-empty">COULDN'T LOAD CHATS. Check the console for details.</div>`;
        });

    return {
        unmount() { disposed = true; },
        onKey(ev) {
            const typing = isTypingTarget(ev.target);
            if (ev.key === "ArrowDown") {
                if (typing) setActive(active, { silent: true });
                else setActive(active + 1);
                return true;
            }
            if (ev.key === "ArrowUp") {
                if (!typing && active === 0) {
                    searchEl.focus();
                    return true;
                }
                if (!typing) setActive(active - 1);
                return !typing;
            }
            if (typing) {
                if (ev.key === "Enter" && visible.length) {
                    pick(visible[active]);
                    return true;
                }
                return false;
            }
            if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
                const idx = FILTERS.findIndex((f) => f.id === kind);
                const next = FILTERS[(idx + (ev.key === "ArrowRight" ? 1 : FILTERS.length - 1)) % FILTERS.length];
                setKind(next.id);
                return true;
            }
            if ((ev.key === "Enter" || ev.key === " ") && ev.target.closest?.(".dgn-title-chat")) {
                pick(visible[active]);
                return true;
            }
            if (ev.key === "/") {
                searchEl.focus();
                return true;
            }
            return false;
        },
    };
}
