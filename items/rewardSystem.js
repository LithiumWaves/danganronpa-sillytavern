export function createRewardSystem({ extensionName, extensionFolderPath, extension_settings, saveSettingsDebounced, monocoinRewards, xpRewards, getItemsPanelController, increaseTrust }) {
    let monocoinToastTimeout = null;
    let xpPopupTimeout = null;
    let levelUpPopupTimeout = null;

    const LEVEL_CAP = 100;
    const BASE_SKILL_POINTS = 10;
    const SKILL_POINTS_PER_LEVEL = 1;

    function getXpRequiredForLevel(level = 1) {
        const safeLevel = Math.max(1, Number(level || 1));
        return 20 + ((safeLevel - 1) * 5);
    }

    function ensureExtensionState() {
        const ext = (extension_settings[extensionName] ||= {});
        ext.inventory ||= {};
        ext.progression ||= {};
        return ext;
    }

    function ensureProgressionState() {
        const ext = ensureExtensionState();

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

    function ensureLevelBar() {
        let bar = document.getElementById('dangan-level-bar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'dangan-level-bar';
        bar.innerHTML = `
            <span class="dlvl-label">LVL <span class="dlvl-num">1</span></span>
            <div class="dlvl-track"><div class="dlvl-fill"></div></div>
        `;
        document.body.appendChild(bar);
        return bar;
    }

    function flashLevelBar() {
        const bar = document.getElementById('dangan-level-bar');
        if (!bar) return;
        bar.classList.remove('dlvl-flash');
        void bar.offsetWidth;
        bar.classList.add('dlvl-flash');
        setTimeout(() => bar.classList.remove('dlvl-flash'), 1400);
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

        // Persistent level bar (top-right HUD)
        const bar = ensureLevelBar();
        const barNum  = bar.querySelector('.dlvl-num');
        const barFill = bar.querySelector('.dlvl-fill');
        if (barNum)  barNum.textContent = String(level);
        if (barFill) barFill.style.width = `${Math.round(ratio * 100)}%`;
    }

    function ensureMonocoinToast() {
        let toast = document.getElementById("monocoin-toast");
        if (toast) return toast;

        toast = document.createElement("div");
        toast.id = "monocoin-toast";
        toast.innerHTML = `
            <img class="monocoin-toast-icon" src="${extensionFolderPath}/assets/images/ui/monocoin.png" alt="Monocoin" />
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

    function ensureXpPopup() {
        let popup = document.getElementById("dangan-xp-popup");
        if (popup) return popup;
        popup = document.createElement("div");
        popup.id = "dangan-xp-popup";
        popup.innerHTML = `
            <div class="dangan-xp-popup-amount">+0 XP</div>
            <div class="dangan-xp-popup-bar-wrap"><div class="dangan-xp-popup-bar-fill"></div></div>
            <div class="dangan-xp-popup-label">LEVEL <span class="dangan-xp-popup-level">1</span></div>
        `;
        document.body.appendChild(popup);
        return popup;
    }

    function showXpPopup(amount, newXp, required, level) {
        const popup = ensureXpPopup();
        const amountEl = popup.querySelector(".dangan-xp-popup-amount");
        const fillEl = popup.querySelector(".dangan-xp-popup-bar-fill");
        const levelEl = popup.querySelector(".dangan-xp-popup-level");

        if (amountEl) amountEl.textContent = `+${amount} XP`;
        if (levelEl) levelEl.textContent = String(level);

        const ratio = level >= LEVEL_CAP ? 1 : Math.max(0, Math.min(1, newXp / required));
        if (fillEl) fillEl.style.width = `${Math.round(ratio * 100)}%`;

        popup.classList.remove("show");
        void popup.offsetWidth;
        popup.classList.add("show");

        clearTimeout(xpPopupTimeout);
        xpPopupTimeout = setTimeout(() => popup.classList.remove("show"), 1800);
    }

    function ensureLevelUpPopup() {
        let popup = document.getElementById("dangan-levelup-popup");
        if (popup) return popup;
        popup = document.createElement("div");
        popup.id = "dangan-levelup-popup";
        popup.innerHTML = `
            <div class="dangan-levelup-popup-title">LEVEL UP!</div>
            <div class="dangan-levelup-popup-level">LEVEL <span class="dangan-levelup-popup-num">1</span></div>
        `;
        document.body.appendChild(popup);
        return popup;
    }

    function showLevelUpPopup(newLevel) {
        const popup = ensureLevelUpPopup();
        const numEl = popup.querySelector(".dangan-levelup-popup-num");
        if (numEl) numEl.textContent = String(newLevel);

        popup.classList.remove("show");
        void popup.offsetWidth;
        popup.classList.add("show");

        clearTimeout(levelUpPopupTimeout);
        levelUpPopupTimeout = setTimeout(() => popup.classList.remove("show"), 2800);
    }

    function awardMonocoins(amount = 0, reason = "") {
        const reward = Math.max(0, Number(amount || 0));
        if (!reward) return;

        const ext = ensureExtensionState();

        const current = Number(ext.inventory.monocoins || 0);
        ext.inventory.monocoins = Math.max(0, current + reward);

        saveSettingsDebounced();
        getItemsPanelController()?.renderSkillsItemsPanel();
        showMonocoinToast(reward);

        if (reason) {
            console.log(`[${extensionName}] Awarded ${reward} Monocoins (${reason}).`);
        }
    }

    function deductMonocoins(amount = 0, reason = "") {
        const penalty = Math.max(0, Number(amount || 0));
        if (!penalty) return;

        const ext = ensureExtensionState();
        const current = Number(ext.inventory.monocoins || 0);
        ext.inventory.monocoins = Math.max(0, current - penalty);

        saveSettingsDebounced();
        getItemsPanelController()?.renderSkillsItemsPanel();

        // Show toast with negative prefix and red styling
        const toast = ensureMonocoinToast();
        const text = toast.querySelector(".monocoin-toast-text");
        if (text) text.textContent = `-${penalty} MONOCOINS`;
        toast.classList.remove("show");
        void toast.offsetWidth;
        toast.classList.add("show");
        clearTimeout(monocoinToastTimeout);
        monocoinToastTimeout = setTimeout(() => toast.classList.remove("show"), 1400);

        if (reason) {
            console.log(`[${extensionName}] Deducted ${penalty} Monocoins (${reason}).`);
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

        if (leveledUp) {
            showLevelUpPopup(progression.level);
        } else {
            showXpPopup(reward, progression.xp, getXpRequiredForLevel(progression.level), progression.level);
        }
        flashLevelBar();

        if (reason) {
            console.log(`[${extensionName}] Awarded ${reward} XP (${reason})${leveledUp ? ` · +${leveledUp} level${leveledUp === 1 ? '' : 's'}` : ''}.`);
        }
    }

    function awardTrustFragments(amount = 0, reason = "") {
        const reward = Math.max(0, Number(amount || 0));
        if (!reward) return;

        const ext = ensureExtensionState();

        const current = Number(ext.inventory.trustFragments || 0);
        ext.inventory.trustFragments = Math.max(0, current + reward);

        saveSettingsDebounced();
        getItemsPanelController()?.renderSkillsItemsPanel();

        if (reason) {
            console.log(`[${extensionName}] Awarded ${reward} Trust Fragments (${reason}).`);
        }
    }


    function resetProgression({ clearEquippedSkills = true } = {}) {
        const { ext, progression } = ensureProgressionState();

        progression.level = 1;
        progression.xp = 0;
        ext.inventory.skillPoints = BASE_SKILL_POINTS;

        if (clearEquippedSkills) {
            ext.inventory.equippedSkills = {};
        }

        saveSettingsDebounced();
        renderProgressionUi();
        getItemsPanelController()?.renderSkillsItemsPanel();
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
        deductMonocoins,
        awardTrustFragments,
        awardXp,
        increaseTrustWithRewards,
        renderProgressionUi,
        resetProgression,
    };
}
