export function createRewardSystem({ extensionName, extensionFolderPath, extension_settings, saveSettingsDebounced, monocoinRewards, getItemsPanelController, increaseTrust }) {
    let monocoinToastTimeout = null;

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

        if (previous < 10 && current === 10) {
            awardMonocoins(monocoinRewards.trustMaxed, "trust maxed");
        }
    }

    return {
        awardMonocoins,
        awardTrustFragments,
        increaseTrustWithRewards,
    };
}
