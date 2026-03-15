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
}) {
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
        $report.addClass("has-character");

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

        // Dead toggle button
        const $deadBtn = $report.find("#report-dead-toggle");
        function applyDeadState(dead) {
            $deadBtn.text(dead ? "MARK AS ALIVE" : "MARK AS DEAD");
            $deadBtn.toggleClass("dead", !!dead);
            $sprite.toggleClass("dead", !!dead);
            $report.find(".report-sprite-col").toggleClass("dead", !!dead);
        }
        $deadBtn.off("click.dead").on("click.dead", () => {
            char.dead = !char.dead;
            saveCharacters();
            applyDeadState(char.dead);
        });

        // Load neutral sprite
        const $sprite = $report.find("#report-sprite-img");
        $sprite[0].src = "";
        $sprite[0].style.display = "none";
        applyDeadState(char.dead);
        const spriteOpenedId = char.id;
        Promise.resolve(getSpriteUrl?.(char.name)).then(spriteUrl => {
            if (getActiveSocialCharacterId() !== spriteOpenedId) return;
            if (!spriteUrl) return;
            $sprite[0].onerror = function () { this.onerror = null; this.style.display = "none"; };
            $sprite[0].onload  = function () { this.style.display = "block"; };
            $sprite[0].src = spriteUrl;
        });

        const liveUltimate =
            lookupUltimateFromLorebook(char.name) || char.ultimate || "unknown";

        char.ultimate = liveUltimate;
        saveCharacters();

        $report.find(".report-ultimate").text(
            char.ultimate
                ? `ULTIMATE: ${char.ultimate.toUpperCase()}`
                : "ULTIMATE: —"
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

        const openedId = char.id;

        generateCharacterNotes(char).then(() => {
            if (getActiveSocialCharacterId() !== openedId) return;

            const profile = char.social?.profile;

            if (!profile) {
                console.warn("[Dangan][Social] Profile missing after generation");
                return;
            }

            $("#stat-height").text(profile.height || "—");
            $("#stat-measurements").text(profile.measurements || "—");
            $("#stat-personality").text(profile.personality || "—");
            $("#stat-likes").text(profile.likes || "—");
            $("#stat-dislikes").text(profile.dislikes || "—");

            $report.find(".notes-content").text("ANALYSIS COMPLETE");
        });
    }

    function renderNoCharacterOverlay() {
        const $content = $(".social-no-char-content");
        if (!$content.length) return;

        if (!characters.size) {
            $content.html(`
                <img class="social-no-char-crest"
                    src="scripts/extensions/third-party/danganronpa-extension/assets/hopes-peak-crest.png"
                    alt="Hope's Peak Academy" />
            `);
            return;
        }

        const userName = getUserName?.();
        const userAvatarUrl = getUserAvatarUrl?.() || "";
        const userCard = userName ? `
            <button class="social-char-card social-char-card-user" type="button" disabled>
                <div class="social-char-portrait">
                    <img class="social-char-portrait-img" src="${userAvatarUrl}" alt="${userName}" />
                </div>
                <div class="social-char-card-name">${userName.toUpperCase()}</div>
            </button>
        ` : "";

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

        const cards = [...characters.values()].map(char => `
            <button class="social-char-card${char.dead ? " dead" : ""}" data-char-id="${char.id}" type="button">
                <div class="social-char-portrait">
                    <img class="social-char-portrait-img" src="/characters/${encodeURIComponent(char.name)}.png" alt="${char.name}" />
                    ${char.dead ? deadStampSvg : ""}
                </div>
                <div class="social-char-card-name">${char.name.toUpperCase()}</div>
            </button>
        `).join("");

        $content.html(`
            <img class="social-no-char-crest" src="scripts/extensions/third-party/danganronpa-extension/assets/hopes-peak-crest.png" alt="" aria-hidden="true" />
            <div class="social-char-grid">${userCard}${cards}</div>
        `);

        $content.find(".social-char-card:not(:disabled)").on("click", function () {
            const charId = this.dataset.charId;
            const char = [...characters.values()].find(c => c.id === charId);
            if (char) openCharacterReport(char);
        });
    }

    function renderSocialPanel() {
        const $panel = $(`.monopad-panel-content[data-panel="social"]`);
        if (!$panel.length) return;

        const activeId = getActiveSocialCharacterId();
        const activeStillExists = activeId && [...characters.values()].some(c => c.id === activeId);
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
            $listItems.append(`
                <div class="social-list-item social-list-item-user">
                    <span class="social-name">${userName.toUpperCase()}</span>
                </div>
            `);
        }

        if (!characters.size) {
            $listItems.append(`<div class="social-empty">NO STUDENTS FOUND</div>`);
            return;
        }

        for (const [key, char] of characters.entries()) {
            const $item = $(`
                <div class="social-list-item">
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
