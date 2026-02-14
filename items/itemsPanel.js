const itemCatalog = [
    { id: "g_rose_whip", name: "Rose Whip", category: "gift", rarity: "R", description: "A decorative whip popular in stage magic circles.", effect: "Boosts confidence-driven dialogue routes.", character: "Maki" },
    { id: "g_crystal_skull", name: "Crystal Skull", category: "gift", rarity: "SR", description: "A tiny crystal skull with unsettling detail work.", effect: "Increases reaction checks in tense scenes.", character: "Kokichi" },
    { id: "g_monokuma_pin", name: "Monokuma Pin", category: "gift", rarity: "N", description: "A cheaply made pin with suspiciously sharp edges.", effect: "Minor passive boost to social probing.", character: "Monokuma" },
    { id: "g_hope_shard", name: "Hope Shard", category: "gift", rarity: "R", description: "A polished crystal fragment sold near Hope's Peak.", effect: "Raises social resilience in difficult exchanges.", character: "Kaede" },
    { id: "g_robot_gear", name: "Clockwork Gear", category: "gift", rarity: "N", description: "A small precision gear from an unknown machine.", effect: "Slightly improves logic-chain consistency.", character: "K1-B0" },
    { id: "g_silver_dice", name: "Silver Dice", category: "gift", rarity: "SR", description: "Weighted-looking dice that somehow land perfectly fair.", effect: "Improves luck checks during event triggers.", character: "Nagito" }
];

export function createItemsPanelController({ extensionName, extension_settings, saveSettingsDebounced, playSfx, getSfx }) {
    let activeItemsFilter = "all";
    let activeItemsSort = "recent";
    let selectedItemId = null;

    function loadInventoryState() {
        const ext = extension_settings[extensionName];
        ext.inventory ||= {};
        ext.inventory.monocoins ??= 0;
        ext.inventory.gifts ||= {};
        ext.inventory.skills ||= {};
        ext.inventory.keyItems ||= {};

        delete ext.inventory.skills.s_micro_focus;
        delete ext.inventory.skills.s_false_lead;
        delete ext.inventory.keyItems.k_student_profile;
    }

    function getInventoryBucket(category) {
        if (category === "gift") return "gifts";
        if (category === "skill") return "skills";
        return "keyItems";
    }

    function getItemById(id) {
        return itemCatalog.find(i => i.id === id) || null;
    }

    function categoryOrder(category) {
        if (category === "gift") return 0;
        if (category === "skill") return 1;
        return 2;
    }

    function rarityScore(rarity) {
        return { KEY: 4, SR: 3, R: 2, N: 1 }[rarity] || 0;
    }

    function sortOwnedItems(items) {
        if (activeItemsSort === "rarity") {
            return [...items].sort((a, b) => rarityScore(b.rarity) - rarityScore(a.rarity) || a.name.localeCompare(b.name));
        }

        if (activeItemsSort === "category") {
            return [...items].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name));
        }

        return [...items].sort((a, b) => b.catalogIndex - a.catalogIndex);
    }

    function getOwnedItems() {
        const inv = extension_settings[extensionName].inventory || {};

        const items = itemCatalog
            .map((item, idx) => {
                const bucket = getInventoryBucket(item.category);
                const quantity = Number(inv[bucket]?.[item.id] || 0);
                return { ...item, quantity, catalogIndex: idx };
            })
            .filter(item => item.quantity > 0);

        if (activeItemsFilter !== "all") {
            return sortOwnedItems(items.filter(item => item.category === activeItemsFilter));
        }

        return sortOwnedItems(items);
    }

    function formatCategoryLabel(category) {
        if (category === "gift") return "GIFT";
        if (category === "skill") return "SKILL";
        return "KEY ITEM";
    }

    function discardInventoryItem(itemId, amount = 1) {
        loadInventoryState();

        const item = getItemById(itemId);
        if (!item) return false;

        if (item.category !== "gift") return false;

        const bucket = getInventoryBucket(item.category);
        const bucketState = extension_settings[extensionName].inventory[bucket] || {};
        const qty = Number(bucketState[itemId] || 0);
        const nextQty = Math.max(0, qty - Math.max(1, Number(amount || 1)));

        if (nextQty <= 0) {
            delete bucketState[itemId];
        } else {
            bucketState[itemId] = nextQty;
        }

        if (selectedItemId === itemId && !bucketState[itemId]) {
            selectedItemId = null;
        }

        saveSettingsDebounced();
        return true;
    }

    function getGiftPool() {
        return itemCatalog.filter(item => item.category === "gift");
    }

    function weightedPick(candidates) {
        const total = candidates.reduce((acc, item) => acc + item.weight, 0);
        if (total <= 0) return candidates[0]?.item || null;

        let roll = Math.random() * total;
        for (const candidate of candidates) {
            roll -= candidate.weight;
            if (roll <= 0) return candidate.item;
        }

        return candidates[candidates.length - 1]?.item || null;
    }

    function runMonoMonoMachine(coinInput = 1) {
        loadInventoryState();

        const rolls = Math.max(1, Number(coinInput || 1));
        const inventory = extension_settings[extensionName].inventory;
        const availableCoins = Number(inventory.monocoins || 0);
        if (availableCoins < rolls) {
            return { ok: false, reason: "NOT ENOUGH MONOCOINS." };
        }

        const gifts = getGiftPool();
        if (!gifts.length) {
            return { ok: false, reason: "NO GIFTS REGISTERED IN CATALOG." };
        }

        const rarityWeight = { N: 1, R: 0.75, SR: 0.5, KEY: 0.2 };
        const duplicatePenalty = Math.max(0.18, 0.92 - (rolls - 1) * 0.05);
        const batchCounts = {};
        const results = [];
        let duplicateCount = 0;

        for (let i = 0; i < rolls; i++) {
            const weighted = gifts.map(item => {
                const owned = Number(inventory.gifts[item.id] || 0);
                const alreadyRolled = Number(batchCounts[item.id] || 0);
                const isDupeCandidate = owned > 0 || alreadyRolled > 0;
                const base = rarityWeight[item.rarity] || 0.6;
                const dupeFactor = isDupeCandidate ? duplicatePenalty : 1;
                return { item, weight: base * dupeFactor };
            });

            const won = weightedPick(weighted);
            if (!won) continue;

            const preOwned = Number(inventory.gifts[won.id] || 0) > 0;
            const repeatedInBatch = Number(batchCounts[won.id] || 0) > 0;
            if (preOwned || repeatedInBatch) duplicateCount++;

            batchCounts[won.id] = Number(batchCounts[won.id] || 0) + 1;
            inventory.gifts[won.id] = Number(inventory.gifts[won.id] || 0) + 1;
            results.push(won);
        }

        inventory.monocoins = Math.max(0, availableCoins - rolls);
        if (results.length) {
            selectedItemId = results[results.length - 1].id;
        }

        saveSettingsDebounced();
        return {
            ok: true,
            rolls,
            duplicateCount,
            results,
        };
    }

    function ensureMonoMonoDebugUI() {
        const $panel = $(`.monopad-panel-content[data-panel="skills"]`);
        const $filterPanel = $panel.find(".items-filter-panel");
        if (!$filterPanel.length || $filterPanel.find(".items-machine-debug").length) return;

        $filterPanel.append(`
            <div class="items-machine-debug">
                <div class="items-machine-title">MONOMONO MACHINE (DEBUG)</div>
                <div class="items-machine-controls">
                    <input id="items-machine-roll-count" class="items-machine-input" type="number" min="1" step="1" value="1" />
                    <button id="items-machine-roll" class="items-machine-roll">ROLL</button>
                </div>
                <div id="items-machine-result" class="items-machine-result">ENTER COINS AND ROLL FOR GIFTS.</div>
            </div>
        `);

        $filterPanel.find("#items-machine-roll").on("click", () => {
            playSfx(getSfx().click);

            const raw = Number($filterPanel.find("#items-machine-roll-count").val() || 1);
            const coinInput = Math.max(1, Math.floor(raw));
            const run = runMonoMonoMachine(coinInput);

            if (!run.ok) {
                $filterPanel.find("#items-machine-result").text(run.reason);
                return;
            }

            const uniqueWon = [...new Set(run.results.map(item => item.name.toUpperCase()))].join(", ");
            $filterPanel
                .find("#items-machine-result")
                .text(`ROLLED ${run.rolls}X · DUPES ${run.duplicateCount} · NEW/FOUND: ${uniqueWon || "NONE"}`);

            renderSkillsItemsPanel();
        });
    }

    function renderItemDetails(item) {
        const $detail = $("#items-detail-panel");
        if (!$detail.length) return;

        if (!item) {
            $detail.html(`
                <div class="items-panel-title">SELECTED ITEM</div>
                <div class="items-detail-placeholder">SELECT AN ITEM SLOT TO LOAD TERMINAL READOUT</div>
            `);
            return;
        }

        const showDiscardGift = item.category === "gift";

        $detail.html(`
            <div class="items-panel-title">SELECTED ITEM</div>
            <div class="items-detail-icon">◉</div>
            <div class="items-detail-name">${item.name.toUpperCase()}</div>
            <div class="items-detail-category">CATEGORY: ${formatCategoryLabel(item.category)} · RARITY: ${item.rarity}</div>

            <div class="items-detail-section-label">DESCRIPTION</div>
            <div class="items-detail-description">${item.description}</div>

            <div class="items-detail-section-label">EFFECT</div>
            <div class="items-detail-effect">${item.effect}</div>

            <div class="items-detail-section-label">ASSOCIATED CHARACTER</div>
            <div class="items-detail-character">[ ${item.character} ]</div>

            <div class="items-detail-actions">
                <button class="items-detail-action" disabled>USE</button>
                <button class="items-detail-action" disabled>INSPECT</button>
                ${showDiscardGift ? '<button class="items-detail-action discard" data-action="discard-gift">DISCARD GIFT</button>' : ""}
            </div>
        `);

        if (showDiscardGift) {
            $detail.find('[data-action="discard-gift"]').on("click", () => {
                playSfx(getSfx().click);
                discardInventoryItem(item.id, 1);
                renderSkillsItemsPanel();
            });
        }
    }

    function renderInventoryGrid() {
        const $grid = $("#items-gift-list");
        if (!$grid.length) return;

        const items = getOwnedItems();
        $grid.empty();

        if (!items.length) {
            $grid.append('<div class="items-empty">NO ITEMS IN THIS FILTER</div>');
            renderItemDetails(null);
            return;
        }

        if (!selectedItemId || !items.some(i => i.id === selectedItemId)) {
            selectedItemId = items[0].id;
        }

        items.forEach(item => {
            const active = item.id === selectedItemId ? "active" : "";
            const $slot = $(`
                <button class="items-slot ${active}" data-item-id="${item.id}" data-item-category="${item.category}" title="${item.name}">
                    <span class="items-slot-icon">■</span>
                    <span class="items-slot-name">${item.name.toUpperCase()}</span>
                    <span class="items-slot-qty">x${item.quantity}</span>
                </button>
            `);

            $slot.on("mouseenter", () => renderItemDetails(item));
            $slot.on("click", () => {
                playSfx(getSfx().click);
                selectedItemId = item.id;
                renderInventoryGrid();
            });

            $grid.append($slot);
        });

        renderItemDetails(items.find(i => i.id === selectedItemId) || items[0]);
    }

    function renderSkillsItemsPanel() {
        const $panel = $(`.monopad-panel-content[data-panel="skills"]`);
        if (!$panel.length) return;

        const monocoins = Number(extension_settings[extensionName].inventory?.monocoins || 0);
        $("#items-monocoin-value").text(monocoins.toLocaleString());
        ensureMonoMonoDebugUI();

        $panel.find(".items-filter-button").each((_, el) => {
            const isActive = el.dataset.filter === activeItemsFilter;
            el.classList.toggle("active", isActive);
            el.setAttribute("aria-selected", String(isActive));
        });

        $panel.find('input[name="items-sort"]').each((_, el) => {
            el.checked = el.value === activeItemsSort;
        });

        renderInventoryGrid();
    }

    function setFilter(filter = "all") {
        activeItemsFilter = filter;
    }

    function setSort(sort = "recent") {
        activeItemsSort = sort;
    }

    function bindWindowApi() {
        window.danganInventory = {
            addGift(itemId, amount = 1) {
                loadInventoryState();
                const item = getItemById(itemId);
                if (!item) return false;

                const bucket = getInventoryBucket(item.category);
                const qty = Number(extension_settings[extensionName].inventory[bucket][itemId] || 0);
                extension_settings[extensionName].inventory[bucket][itemId] = Math.max(0, qty + Number(amount || 0));
                saveSettingsDebounced();
                renderSkillsItemsPanel();
                return true;
            },
            setMonocoins(value = 0) {
                loadInventoryState();
                extension_settings[extensionName].inventory.monocoins = Math.max(0, Number(value || 0));
                saveSettingsDebounced();
                renderSkillsItemsPanel();
            }
        };
    }

    return {
        bindWindowApi,
        loadInventoryState,
        renderSkillsItemsPanel,
        setFilter,
        setSort,
    };
}
