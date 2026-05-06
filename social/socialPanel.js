// Canonical heights (cm), mirrors trialManager — first/last name tokens, lowercase
const REPORT_KNOWN_HEIGHTS_CM = new Map([
    ['monokuma',  75],
    ['saionji', 130], ['hiyoko',   130],
    ['hanamura', 133], ['teruteru', 133],
    ['kuzuryu',  157], ['fuyuhiko', 157],
    ['nanami',   160], ['chiaki',   160],
    ['mioda',    164], ['ibuki',    164],
    ['koizumi',  165], ['mahiru',   165],
    ['tsumiki',  165], ['mikan',    165],
    ['soda',     172], ['kazuichi', 172],
    ['pekoyama', 172], ['peko',     172],
    ['nevermind',174], ['sonia',    174],
    ['owari',    176], ['akane',    176],
    ['hinata',   179], ['hajime',   179],
    ['komaeda',  180], ['nagito',   180],
    ['tanaka',   182], ['gundham',  182],
    ['togami',   185], ['byakuya',  185],
    ['nidai',    198], ['nekomaru', 198],
]);

function parseReportHeightCm(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    const cmMatch = s.match(/(\d+(?:\.\d+)?)\s*cm/i);
    if (cmMatch) return parseFloat(cmMatch[1]);
    const ftInMatch = s.match(/(\d+)\s*(?:ft|'|′|feet)\s*(\d+)?\s*(?:in|"|″)?/i);
    if (ftInMatch) {
        const ft = parseInt(ftInMatch[1]) || 0;
        const inches = parseInt(ftInMatch[2]) || 0;
        return Math.round(ft * 30.48 + inches * 2.54);
    }
    return null;
}

function getReportCharacterHeightCm(name) {
    if (!name) return null;
    const needle = String(name).trim().toLowerCase();
    for (const token of needle.split(/\s+/)) {
        if (REPORT_KNOWN_HEIGHTS_CM.has(token)) return REPORT_KNOWN_HEIGHTS_CM.get(token);
    }
    return null;
}

function applyReportSpriteHeight(cm, $sprite) {
    const scale = cm ? Math.min(1.45, Math.max(0.55, cm / 170)) : 1;
    $sprite.css("height", `${Math.round(scale * 75)}%`);
}

export function createSocialPanelController({
    characters,
    saveCharacters,
    lookupUltimateFromLorebook,
    generateCharacterNotes,
    getActiveSocialCharacterId,
    setActiveSocialCharacterId,
    getSpriteUrl,
    getUserName,
    getUserAvatarUrl,
    getPromeSpritePack,
    getMonopadSetting,
    onCharacterDead = null,
}) {
    let statusFilters = new Set(); // empty = show all statuses
    let overlaysHidden = false;
    let sortOrder = "asc"; // "asc" = A→Z, "desc" = Z→A

    const playerChar = {
        id: "player",
        isPlayer: true,
        name: "",
        dead: false,
        missing: false,
        mastermind: false,
        trustLevel: 1,
        ultimate: "",
        social: null,
    };

    function removeCharacter(key) {
        if (!characters.has(key)) return;

        const name = characters.get(key)?.name;
        characters.delete(key);
        saveCharacters();

        console.log(`[Dangan][Social] Removed character: ${name}`);
        renderSocialPanel();
    }

    function openCharacterReport(char) {
        setActiveSocialCharacterId(char.id);
        const $report = $(".social-report");
        if (!$report.length) return;

        // Highlight active entry in sidebar list
        const $listItems = $(`.monopad-panel-content[data-panel="social"] .social-list-items`);
        $listItems.find(".social-list-item").removeClass("social-list-item-active");
        if (char.isPlayer) {
            $listItems.find(".social-list-item-user").addClass("social-list-item-active");
        } else {
            $listItems.find(`.social-list-item[data-char-id="${char.id}"]`).addClass("social-list-item-active");
        }
        $report.addClass("has-character");
        $report.toggleClass("player-view", !!char.isPlayer);

        const svg = document.getElementById("trust-decagram");
        if (svg) {
            delete svg.dataset.mode;
            delete svg.dataset.gold;

            if (char.trustLevel < 0) {
                svg.dataset.mode = "distrust";
            }

            if (char.trustLevel === 10) {
                svg.dataset.gold = "true";
            }
        }

        $report.find(".report-name").text(char.name || "—");

        // Dead / Missing / Mastermind toggle buttons
        const $deadBtn = $report.find("#report-dead-toggle");
        const $missingBtn = $report.find("#report-missing-toggle");
        const $mastermindBtn = $report.find("#report-mastermind-toggle");

        function applyStampState(dead, missing, mastermind) {
            const $spriteCol = $report.find(".report-sprite-col");
            $deadBtn.text(dead ? "MARK AS ALIVE" : "MARK AS DEAD");
            $deadBtn.toggleClass("dead", !!dead);
            $missingBtn.text(missing ? "MARK AS FOUND" : "MARK AS MISSING");
            $missingBtn.toggleClass("missing", !!missing);
            $mastermindBtn.text(mastermind ? "UNMARK MASTERMIND" : "MARK AS MASTERMIND");
            $mastermindBtn.toggleClass("mastermind", !!mastermind);
            // DEAD > MISSING > MASTERMIND
            $spriteCol.toggleClass("dead", !!dead);
            $spriteCol.toggleClass("missing", !dead && !!missing);
            $spriteCol.toggleClass("mastermind", !dead && !missing && !!mastermind);
            $sprite.toggleClass("dead", !!dead);
            $sprite.toggleClass("missing", !dead && !!missing);
            $sprite.toggleClass("mastermind", !dead && !missing && !!mastermind);
        }

        $deadBtn.off("click.dead").on("click.dead", () => {
            char.dead = !char.dead;
            if (!char.isPlayer) saveCharacters();
            applyStampState(char.dead, char.missing, char.mastermind);
            renderNoCharacterOverlay();
            if (char.dead && !char.isPlayer) onCharacterDead?.(char.name);
        });

        $missingBtn.off("click.missing").on("click.missing", () => {
            char.missing = !char.missing;
            if (!char.isPlayer) saveCharacters();
            applyStampState(char.dead, char.missing, char.mastermind);
            renderNoCharacterOverlay();
        });

        $mastermindBtn.off("click.mastermind").on("click.mastermind", () => {
            char.mastermind = !char.mastermind;
            if (!char.isPlayer) saveCharacters();
            applyStampState(char.dead, char.missing, char.mastermind);
            renderNoCharacterOverlay();
        });

        // Load neutral sprite
        const $sprite = $report.find("#report-sprite-img");
        $sprite[0].src = "";
        $sprite[0].style.display = "none";
        const useTalent = !char.isPlayer && getMonopadSetting?.('talentImagesForAnalysis');
        // Apply height scaling — skip for talent images since they aren't full-body sprites
        if (useTalent) {
            $sprite.css("height", "75%");
        } else {
            applyReportSpriteHeight(getReportCharacterHeightCm(char.name), $sprite);
        }
        applyStampState(char.dead, char.missing, char.mastermind);
        const spriteOpenedId = char.id;
        const promePack = getPromeSpritePack?.();
        const spritePromise = char.isPlayer
            ? (promePack
                ? getSpriteUrl?.(promePack, 'panictalkaction').catch(() => `/characters/${promePack}/neutral.png`)
                : (char.name
                    ? getSpriteUrl?.(char.name, 'panictalkaction')
                        .catch(() => Promise.resolve(getSpriteUrl?.(char.name) || getUserAvatarUrl?.() || ""))
                    : Promise.resolve(getUserAvatarUrl?.() || "")))
            : useTalent
                ? getSpriteUrl?.(char.name, 'panictalkaction').catch(() => getSpriteUrl?.(char.name))
                : Promise.resolve(getSpriteUrl?.(char.name));
        spritePromise.then(spriteUrl => {
            if (getActiveSocialCharacterId() !== spriteOpenedId) return;
            if (!spriteUrl) return;
            $sprite[0].onerror = function () { this.onerror = null; this.style.display = "none"; };
            $sprite[0].onload  = function () { this.style.display = "block"; };
            $sprite[0].src = spriteUrl;
        });

        const liveUltimate = char.isPlayer
            ? (char.ultimate || lookupUltimateFromLorebook(char.name) || "player character")
            : (lookupUltimateFromLorebook(char.name) || char.ultimate || "unknown");

        char.ultimate = liveUltimate;
        if (!char.isPlayer) saveCharacters();

        $report.find(".report-ultimate").text(
            char.ultimate
                ? `ULTIMATE ${char.ultimate.toUpperCase()}`
                : "ULTIMATE —"
        );

        const trust = char.trustLevel ?? 1;
        const $segments = $report.find(".trust-segment");

        $segments.removeClass("filled distrust");

        if (trust > 0) {
            $segments.each((i, el) => {
                if (i < trust) el.classList.add("filled");
            });

            $report.find(".trust-value").text(`${trust} / 10`);
            $report.find(".trust-label")
                .text("TRUST LEVEL")
                .removeClass("distrust");
        } else {
            const abs = Math.abs(trust);

            $segments.each((i, el) => {
                if (i >= 10 - abs) el.classList.add("distrust");
            });

            $report.find(".trust-value").text(`${abs} / 10`);
            $report.find(".trust-label")
                .text("DISTRUST LEVEL")
                .addClass("distrust");
        }

        $report.find(".trust-value").text(`${trust} / 10`);

        $report.find(".notes-content").text("ANALYZING...");

        // ── Edit stats ────────────────────────────────────────────────────────
        const $editBtn   = $report.find('#report-edit-stats-btn');
        const $saveBtn   = $report.find('#report-save-stats-btn');
        const $cancelBtn = $report.find('#report-cancel-stats-btn');

        $editBtn.show();
        $saveBtn.hide();
        $cancelBtn.hide();

        const STAT_FIELDS = [
            { id: 'stat-height',       key: 'height'       },
            { id: 'stat-measurements', key: 'measurements' },
            { id: 'stat-personality',  key: 'personality'  },
            { id: 'stat-likes',        key: 'likes'        },
            { id: 'stat-dislikes',     key: 'dislikes'     },
        ];

        $editBtn.off('click.edit').on('click.edit', () => {
            const profile = char.social?.profile || {};
            const $ultimateInput = $('<input class="stat-edit-input" id="edit-ultimate" />').val(char.ultimate || '');
            $report.find('.report-ultimate').empty().append(`ULTIMATE `, $ultimateInput);
            STAT_FIELDS.forEach(({ id, key }) => {
                $report.find(`#${id}`).empty().append($('<input class="stat-edit-input" />').val(profile[key] || ''));
            });
            $editBtn.hide();
            $saveBtn.show();
            $cancelBtn.show();
        });

        $saveBtn.off('click.save').on('click.save', () => {
            char.ultimate = ($report.find('#edit-ultimate').val() || '').trim() || 'unknown';
            if (!char.social) char.social = {};
            if (!char.social.profile) char.social.profile = {};
            char.social.profile.ultimate = char.ultimate;
            STAT_FIELDS.forEach(({ id, key }) => {
                char.social.profile[key] = ($report.find(`#${id}`).find('input').val() || '').trim();
            });
            if (!char.isPlayer) saveCharacters();
            $report.find('.report-ultimate').text(`ULTIMATE ${char.ultimate.toUpperCase()}`);
            STAT_FIELDS.forEach(({ id, key }) => {
                $report.find(`#${id}`).text(char.social.profile[key] || '—');
            });
            $editBtn.show();
            $saveBtn.hide();
            $cancelBtn.hide();
        });

        $cancelBtn.off('click.cancel').on('click.cancel', () => {
            const profile = char.social?.profile || {};
            $report.find('.report-ultimate').text(`ULTIMATE ${(char.ultimate || '???').toUpperCase()}`);
            STAT_FIELDS.forEach(({ id, key }) => {
                $report.find(`#${id}`).text(profile[key] || '—');
            });
            $editBtn.show();
            $saveBtn.hide();
            $cancelBtn.hide();
        });
        // ── End edit stats ────────────────────────────────────────────────────

        const openedId = char.id;

        generateCharacterNotes(char).then(() => {
            if (getActiveSocialCharacterId() !== openedId) return;

            const profile = char.social?.profile;

            if (!profile) {
                console.warn("[Dangan][Social] Profile missing after generation");
                $report.find(".notes-content").text("ANALYSIS FAILED");
                return;
            }

            $report.find("#stat-height").text(profile.height || "—");
            $report.find("#stat-measurements").text(profile.measurements || "—");
            $report.find("#stat-personality").text(profile.personality || "—");
            $report.find("#stat-likes").text(profile.likes || "—");
            $report.find("#stat-dislikes").text(profile.dislikes || "—");

            $report.find(".notes-content").text("ANALYSIS COMPLETE");

            // Refine sprite height from profile if canonical table had no entry
            if (!getReportCharacterHeightCm(char.name)) {
                const cm = parseReportHeightCm(profile.height);
                if (cm) applyReportSpriteHeight(cm, $report.find("#report-sprite-img"));
            }
        });
    }

    function openPlayerReport() {
        playerChar.name = getUserName?.() || "";
        openCharacterReport(playerChar);
    }

    function renderNoCharacterOverlay() {
        const $content = $(".social-no-char-content");
        if (!$content.length) return;

        if (!characters.size) {
            $content.html(`
                <img class="social-no-char-crest"
                    src="scripts/extensions/third-party/danganronpa-extension/assets/images/ui/hopes-peak-crest.png"
                    alt="Hope's Peak Academy" />
            `);
            return;
        }

        // ── Stamp SVGs ────────────────────────────────────────────────────────
        const deadStampSvg = `
            <div class="social-char-dead-overlay">
                <svg class="dead-stamp-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" overflow="visible">
                    <polygon points="91,-20 111,0 111,220 91,200" fill="rgb(185,15,15)" transform="rotate(45,100,100)"/>
                    <polygon points="111,-20 91,0 91,220 111,200" fill="rgb(185,15,15)" transform="rotate(-45,100,100)"/>
                    <polygon points="100,6 194,100 100,194 6,100" fill="none" stroke="rgb(210,20,20)" stroke-width="3.5"/>
                    <polygon points="100,21 179,100 100,179 21,100" fill="none" stroke="rgb(210,20,20)" stroke-width="2.5"/>
                    <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Orbitron,monospace" font-size="64" font-weight="900" fill="rgb(130,6,6)" paint-order="stroke" stroke="rgb(220,22,22)" stroke-width="4" letter-spacing="2">DEAD</text>
                </svg>
            </div>`;

        const missingStampSvg = `
            <div class="social-char-dead-overlay">
                <svg class="missing-stamp-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" overflow="visible">
                    <polygon points="91,-20 111,0 111,220 91,200" fill="rgb(185,155,15)" transform="rotate(45,100,100)"/>
                    <polygon points="111,-20 91,0 91,220 111,200" fill="rgb(185,155,15)" transform="rotate(-45,100,100)"/>
                    <polygon points="100,6 194,100 100,194 6,100" fill="none" stroke="rgb(210,180,20)" stroke-width="3.5"/>
                    <polygon points="100,21 179,100 100,179 21,100" fill="none" stroke="rgb(210,180,20)" stroke-width="2.5"/>
                    <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Orbitron,monospace" font-size="64" font-weight="900" fill="rgb(130,110,6)" paint-order="stroke" stroke="rgb(220,190,22)" stroke-width="4" letter-spacing="2">???</text>
                </svg>
            </div>`;

        const mastermindStampSvg = `
            <div class="social-char-dead-overlay">
                <svg class="mastermind-stamp-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" overflow="visible">
                    <polygon points="100,6 194,100 100,194 6,100" fill="none" stroke="rgb(255,20,180)" stroke-width="3.5"/>
                    <polygon points="100,21 179,100 100,179 21,100" fill="none" stroke="rgb(255,20,180)" stroke-width="2.5"/>
                    <image class="mono-eye-img" href="scripts/extensions/third-party/danganronpa-extension/assets/images/ui/eye.png" x="35" y="59" width="130" height="83"/>
                </svg>
            </div>`;

        // ── Helpers ───────────────────────────────────────────────────────────
        function getCharStatus(char) {
            if (char.dead) return "dead";
            if (char.missing) return "missing";
            if (char.mastermind) return "mastermind";
            return "alive";
        }

        function buildCard(char) {
            const status = getCharStatus(char);
            const isPlayer = char.isPlayer;
            const cardClass = (isPlayer ? " social-char-card-user" : "") + (status !== "alive" ? ` ${status}` : "");
            const stampSvg = overlaysHidden ? "" :
                status === "dead" ? deadStampSvg :
                status === "missing" ? missingStampSvg :
                status === "mastermind" ? mastermindStampSvg : "";
            const imgSrc = isPlayer
                ? (getUserAvatarUrl?.() || "")
                : `/characters/${encodeURIComponent(char.name)}.png`;
            const dataAttr = isPlayer ? "" : `data-char-id="${char.id}"`;
            return `
                <button class="social-char-card${cardClass}" ${dataAttr} type="button">
                    <div class="social-char-portrait">
                        <img class="social-char-portrait-img" src="${imgSrc}" alt="${char.name}" />
                        ${stampSvg}
                    </div>
                    <div class="social-char-card-name">${char.name.toUpperCase()}</div>
                </button>`;
        }

        // ── Status groups ─────────────────────────────────────────────────────
        const userName = getUserName?.();
        if (userName) playerChar.name = userName;
        let allChars = [
            ...(userName ? [playerChar] : []),
            ...characters.values(),
        ];
        if (sortOrder === "asc") {
            allChars = allChars.slice().sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortOrder === "desc") {
            allChars = allChars.slice().sort((a, b) => b.name.localeCompare(a.name));
        }
        const showAll = statusFilters.size === 0;
        const statusGroups = [
            { key: "alive",      label: "SHOW ONLY: ALIVE",      heading: "ALIVE" },
            { key: "dead",       label: "SHOW ONLY: DEAD",       heading: "DEAD" },
            { key: "missing",    label: "SHOW ONLY: MISSING",    heading: "MISSING" },
            { key: "mastermind", label: "SHOW ONLY: MASTERMIND", heading: "MASTERMIND" },
        ];

        // Count chars per status to drive visibility rules
        const countByStatus = {};
        for (const { key } of statusGroups) {
            countByStatus[key] = allChars.filter(c => getCharStatus(c) === key).length;
        }
        const onlyAlive = statusGroups
            .filter(({ key }) => key !== "alive")
            .every(({ key }) => countByStatus[key] === 0);

        const sections = statusGroups.map(({ key, heading }) => {
            if (!showAll && !statusFilters.has(key)) return "";
            const chars = allChars.filter(c => getCharStatus(c) === key);
            if (!chars.length) return "";
            // Hide the divider label when every character is alive
            const divider = onlyAlive ? "" :
                `<div class="social-section-divider" data-status="${key}"><span>${heading}</span></div>`;
            return `
                <div class="social-char-section">
                    ${divider}
                    <div class="social-char-grid">${chars.map(buildCard).join("")}</div>
                </div>`;
        }).join("");

        // ── Filter bar ────────────────────────────────────────────────────────
        // Show a filter button only if that status has characters;
        // hide the ALIVE button too when everyone is alive (no other statuses exist)
        const visibleFilters = statusGroups.filter(({ key }) => {
            if (key === "alive") return !onlyAlive && countByStatus.alive > 0;
            return countByStatus[key] > 0;
        });

        const sortLabel = sortOrder === "desc" ? "SORT: Z-A" : "SORT: A-Z";
        const filterBar = `
            <div class="social-filter-bar">
                <button class="social-sort-btn${sortOrder ? " active" : ""}" type="button">${sortLabel}</button>
                ${visibleFilters.length ? `<div class="social-filter-sep-sm"></div>` : ""}
                ${visibleFilters.map(({ key, label }) => `
                    <button class="social-filter-btn${statusFilters.has(key) ? " active" : ""}" data-filter="${key}" type="button">${label}</button>
                `).join("")}
                <div class="social-filter-sep"></div>
                <button class="social-overlay-toggle${overlaysHidden ? " active" : ""}" type="button">
                    ${overlaysHidden ? "SHOW OVERLAYS" : "HIDE OVERLAYS"}
                </button>
            </div>`;

        $content.html(`
            <img class="social-no-char-crest" src="scripts/extensions/third-party/danganronpa-extension/assets/images/ui/hopes-peak-crest.png" alt="" aria-hidden="true" />
            ${filterBar}
            <div class="social-char-sections">
                ${sections}
            </div>
        `);

        // ── Event handlers ────────────────────────────────────────────────────
        $content.find(".social-char-card-user").on("click", openPlayerReport);

        $content.find(".social-char-card:not(.social-char-card-user)").on("click", function () {
            const charId = this.dataset.charId;
            const char = [...characters.values()].find(c => c.id === charId);
            if (char) openCharacterReport(char);
        });

        $content.find(".social-sort-btn").on("click", () => {
            sortOrder = sortOrder === "asc" ? "desc" : "asc";
            renderNoCharacterOverlay();
        });

        $content.find(".social-filter-btn[data-filter]").on("click", function () {
            const filter = this.dataset.filter;
            if (statusFilters.has(filter)) statusFilters.delete(filter);
            else statusFilters.add(filter);
            renderNoCharacterOverlay();
        });

        $content.find(".social-overlay-toggle").on("click", () => {
            overlaysHidden = !overlaysHidden;
            renderNoCharacterOverlay();
        });
    }

    function renderSocialPanel() {
        const $panel = $(`.monopad-panel-content[data-panel="social"]`);
        if (!$panel.length) return;

        const activeId = getActiveSocialCharacterId();
        const activeStillExists = activeId &&
            (activeId === "player" || [...characters.values()].some(c => c.id === activeId));
        if (!activeStillExists) {
            $(".social-report").removeClass("has-character");
        }

        renderNoCharacterOverlay();

        $panel.find(".social-list-header").off("click.overview").on("click.overview", () => {
            setActiveSocialCharacterId(null);
            $(".social-report").removeClass("has-character");
            renderNoCharacterOverlay();
        });

        const $listItems = $panel.find(".social-list-items");
        $listItems.empty();

        const userName = getUserName?.();
        if (userName) {
            const isActive = activeId === "player";
            const $userItem = $(`
                <div class="social-list-item social-list-item-user${isActive ? " social-list-item-active" : ""}">
                    <span class="social-name">${userName.toUpperCase()}</span>
                </div>
            `);
            $userItem.on("click", openPlayerReport);
            $listItems.append($userItem);
        }

        if (!characters.size) {
            $listItems.append(`<div class="social-empty">NO STUDENTS FOUND</div>`);
            return;
        }

        for (const [key, char] of characters.entries()) {
            const isActive = char.id === activeId;
            const $item = $(`
                <div class="social-list-item${isActive ? " social-list-item-active" : ""}" data-char-id="${char.id}">
                    <span class="social-name">${char.name.toUpperCase()}</span>
                    <span class="social-delete" title="Remove">✕</span>
                </div>
            `);

            $item.find(".social-name").on("click", () => {
                openCharacterReport(char);
            });

            $item.find(".social-delete").on("click", e => {
                e.stopPropagation();
                removeCharacter(key);
            });

            $listItems.append($item);
        }
    }

    return {
        renderSocialPanel,
        openCharacterReport,
    };
}
