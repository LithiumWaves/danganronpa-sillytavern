const itemCatalog = [
    { id: "g_rose_whip", name: "Rose Whip", category: "gift", rarity: "R", description: "A decorative whip popular in stage magic circles.", effect: "Boosts confidence-driven dialogue routes.", character: "Maki" },
    { id: "g_crystal_skull", name: "Crystal Skull", category: "gift", rarity: "SR", description: "A tiny crystal skull with unsettling detail work.", effect: "Increases reaction checks in tense scenes.", character: "Kokichi" },
    { id: "g_monokuma_pin", name: "Monokuma Pin", category: "gift", rarity: "N", description: "A cheaply made pin with suspiciously sharp edges.", effect: "Minor passive boost to social probing.", character: "Monokuma" }
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
