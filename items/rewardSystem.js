export function createRewardSystem({ extensionName, extensionFolderPath, extension_settings, saveSettingsDebounced, monocoinRewards, xpRewards, getItemsPanelController, increaseTrust }) {
    let monocoinToastTimeout = null;

    const LEVEL_CAP = 100;
    const BASE_SKILL_POINTS = 10;
    const SKILL_POINTS_PER_LEVEL = 1;

    function getXpRequiredForLevel(level = 1) {
        const safeLevel = Math.max(1, Number(level || 1));
        return 20 + ((safeLevel - 1) * 5);
    }

    function ensureProgressionState() {
        const ext = extension_settings[extensionName];
        ext.inventory ||= {};
        ext.progression ||= {};

        const progression = ext.progression;
        progression.level = Math.max(1, Math.min(LEVEL_CAP, Number(progression.level || 1)));
        progression.xp = Math.max(0, Number(progression.xp || 0));

        const expectedSkillPoints = BASE_SKILL_POINTS + ((progression.level - 1) * SKILL_POINTS_PER_LEVEL);
        if (typeof ext.inventory.skillPoints !== "number") {
            ext.inventory.skillPoints = expectedSkillPoints;
        } else {
            ext.inventory.skillPoints = Math.max(0, Number(ext.inventory.skillPoints || 0));
        }

        if (progression.level >= LEVEL_CAP) {
            progression.level = LEVEL_CAP;
            progression.xp = 0;
        } else {
            const required = getXpRequiredForLevel(progression.level);
            progression.xp = Math.min(progression.xp, Math.max(0, required - 1));
        }

        return { ext, progression };
    }

    function renderProgressionUi() {
        const { progression } = ensureProgressionState();
        const levelEl = document.getElementById("monopad-level-value");
        const fillEl = document.getElementById("monopad-xp-fill");
        const textEl = document.getElementById("monopad-xp-text");

        const level = Number(progression.level || 1);
        const xp = Number(progression.xp || 0);
        const required = getXpRequiredForLevel(level);
        const ratio = level >= LEVEL_CAP ? 1 : Math.max(0, Math.min(1, xp / required));

        if (levelEl) levelEl.textContent = String(level);
        if (fillEl) fillEl.style.width = `${Math.round(ratio * 100)}%`;
        if (textEl) {
            textEl.textContent = level >= LEVEL_CAP
                ? "MAX LEVEL"
                : `${xp} / ${required} XP`;
        }
    }

    function ensureMonocoinToast() {
        let toast = document.getElementById("monocoin-toast");
        if (toast) return toast;

        toast = document.createElement("div");
        toast.id = "monocoin-toast";
        toast.innerHTML = `
            <img class="monocoin-toast-icon" src="${extensionFolderPath}/assets/monocoin.png" alt="Monocoin" />
            <div class="monocoin-toast-text">+0 MONOCOINS</div>
        `;

        document.body.appendChild(toast);
        return toast;
    }

    function showMonocoinToast(amount) {
        if (!amount) return;

        const toast = ensureMonocoinToast();
        const text = toast.querySelector(".monocoin-toast-text");
        if (text) {
            text.textContent = `+${amount} MONOCOINS`;
        }

        toast.classList.remove("show");
        void toast.offsetWidth;
        toast.classList.add("show");

        clearTimeout(monocoinToastTimeout);
        monocoinToastTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 1400);
    }

    function awardMonocoins(amount = 0, reason = "") {
        const reward = Math.max(0, Number(amount || 0));
        if (!reward) return;

        const ext = extension_settings[extensionName];
        ext.inventory ||= {};

        const current = Number(ext.inventory.monocoins || 0);
        ext.inventory.monocoins = Math.max(0, current + reward);

        saveSettingsDebounced();
        getItemsPanelController()?.renderSkillsItemsPanel();
        showMonocoinToast(reward);

        if (reason) {
            console.log(`[${extensionName}] Awarded ${reward} Monocoins (${reason}).`);
        }
    }

    function awardXp(amount = 0, reason = "") {
        const reward = Math.max(0, Number(amount || 0));
        if (!reward) return;

        const { ext, progression } = ensureProgressionState();
        if (progression.level >= LEVEL_CAP) {
            renderProgressionUi();
            return;
        }

        progression.xp += reward;
        let leveledUp = 0;

        while (progression.level < LEVEL_CAP) {
            const required = getXpRequiredForLevel(progression.level);
            if (progression.xp < required) break;

            progression.xp -= required;
            progression.level += 1;
            ext.inventory.skillPoints = Math.max(0, Number(ext.inventory.skillPoints || 0) + SKILL_POINTS_PER_LEVEL);
            leveledUp += 1;
        }

        if (progression.level >= LEVEL_CAP) {
            progression.level = LEVEL_CAP;
            progression.xp = 0;
        }

        saveSettingsDebounced();
        renderProgressionUi();
        getItemsPanelController()?.renderSkillsItemsPanel();

        if (reason) {
            console.log(`[${extensionName}] Awarded ${reward} XP (${reason})${leveledUp ? ` · +${leveledUp} level${leveledUp === 1 ? '' : 's'}` : ''}.`);
        }
    }

    function awardTrustFragments(amount = 0, reason = "") {
        const reward = Math.max(0, Number(amount || 0));
        if (!reward) return;

        const ext = extension_settings[extensionName];
        ext.inventory ||= {};

        const current = Number(ext.inventory.trustFragments || 0);
        ext.inventory.trustFragments = Math.max(0, current + reward);

        saveSettingsDebounced();
        getItemsPanelController()?.renderSkillsItemsPanel();

        if (reason) {
            console.log(`[${extensionName}] Awarded ${reward} Trust Fragments (${reason}).`);
        }
    }

    function increaseTrustWithRewards(char) {
        if (!char) return;

        const previous = Number(char.trustLevel ?? 1);
        increaseTrust(char);

        const current = Number(char.trustLevel ?? previous);
        if (current <= previous) return;

        awardMonocoins(monocoinRewards.socialRankUp, "social rank-up");
        awardTrustFragments(1, "social rank-up");
        awardXp(Number(xpRewards?.socialRankUp || 0), "social rank-up");

        if (previous < 10 && current === 10) {
            awardMonocoins(monocoinRewards.trustMaxed, "trust maxed");
            awardXp(Number(xpRewards?.trustMaxed || 0), "trust maxed");
        }
    }

    ensureProgressionState();
    renderProgressionUi();

    return {
        awardMonocoins,
        awardTrustFragments,
        awardXp,
        increaseTrustWithRewards,
        renderProgressionUi,
    };
}
