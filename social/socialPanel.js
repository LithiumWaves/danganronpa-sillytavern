export function createSocialPanelController({
    characters,
    saveCharacters,
    lookupUltimateFromLorebook,
    generateCharacterNotes,
    getActiveSocialCharacterId,
    setActiveSocialCharacterId,
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

    function renderSocialPanel() {
        const $panel = $(`.monopad-panel-content[data-panel="social"]`);
        if (!$panel.length) return;

        const $listItems = $panel.find(".social-list-items");
        $listItems.empty();

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
