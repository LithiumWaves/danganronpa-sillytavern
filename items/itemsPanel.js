const itemCatalog = [
    { id: "g_crimson_veil_lipstick", name: "Crimson Veil Lipstick", category: "gift", rarity: "N", description: "A deep red lipstick with dramatic stage-paint staying power.", effect: "Adds flair to charm-focused dialogue checks." },
    { id: "g_polaroid_spirit_camera", name: "Polaroid Spirit Camera", category: "gift", rarity: "R", description: "An instant camera that develops grainy photos with suspiciously perfect framing.", effect: "Improves memory-based deductions in social scenes." },
    { id: "g_midnight_orchid_perfume", name: "Midnight Orchid Perfume", category: "gift", rarity: "R", description: "A perfume blending floral sweetness with a cold metallic finish.", effect: "Raises first-impression success in introductions." },
    { id: "g_patchwork_rabbit_doll", name: "Patchwork Rabbit Doll", category: "gift", rarity: "N", description: "A hand-stitched rabbit plush with uneven button eyes and careful repairs.", effect: "Slightly calms stress in tense interactions." },
    { id: "g_rose_thorn_choker", name: "Rose Thorn Choker", category: "gift", rarity: "R", description: "A faux-thorned velvet choker inspired by academy fashion circles.", effect: "Boosts confidence during confrontation exchanges." },
    { id: "g_vintage_compact_mirror", name: "Vintage Compact Mirror", category: "gift", rarity: "N", description: "A gold-trimmed mirror that snaps shut with a sharp click.", effect: "Improves composure before critical conversations." },
    { id: "g_velvet_nail_set", name: "Velvet Nail Lacquer Set", category: "gift", rarity: "N", description: "A set of moody polish colors in tiny glass bottles.", effect: "Adds style-based rapport in casual scenes." },
    { id: "g_thunderbolt_hairdryer", name: "Thunderbolt Hair Dryer", category: "gift", rarity: "R", description: "A salon-grade dryer with enough airflow to rattle documents.", effect: "Raises prep speed before social events." },
    { id: "g_portable_makeup_case", name: "Portable Makeup Case", category: "gift", rarity: "R", description: "A layered cosmetics case with hidden side compartments.", effect: "Improves disguise and presentation checks." },
    { id: "g_blossom_perfume_atomizer", name: "Blossom Perfume Atomizer", category: "gift", rarity: "N", description: "A refillable perfume atomizer etched with tiny sakura petals.", effect: "Slightly boosts approachability in first meetings." },
    { id: "g_crystal_skull", name: "Crystal Skull", category: "gift", rarity: "SR", description: "A tiny crystal skull with unsettling detail work.", effect: "Increases reaction checks in tense scenes." },
    { id: "g_monokuma_pin", name: "Monokuma Pin", category: "gift", rarity: "N", description: "A cheaply made pin with suspiciously sharp edges.", effect: "Minor passive boost to social probing." },
    { id: "g_hope_shard", name: "Hope Shard", category: "gift", rarity: "R", description: "A polished crystal fragment sold near Hope's Peak.", effect: "Raises social resilience in difficult exchanges." },
    { id: "g_robot_gear", name: "Clockwork Gear", category: "gift", rarity: "N", description: "A small precision gear from an unknown machine.", effect: "Slightly improves logic-chain consistency." },
    { id: "g_silver_dice", name: "Silver Dice", category: "gift", rarity: "SR", description: "Weighted-looking dice that somehow land perfectly fair.", effect: "Improves luck checks during event triggers." },
    { id: "g_ocean_glass_bracelet", name: "Ocean Glass Bracelet", category: "gift", rarity: "N", description: "A bracelet of sea-glass beads that chime softly when moved.", effect: "Adds a small bonus to empathy checks." },
    { id: "g_noir_fountain_pen", name: "Noir Fountain Pen", category: "gift", rarity: "R", description: "A black-lacquer fountain pen with a nib tuned for fast note taking.", effect: "Improves planning and report-focused actions." },
    { id: "g_constellation_music_box", name: "Constellation Music Box", category: "gift", rarity: "SR", description: "A clockwork music box that projects tiny star patterns when opened.", effect: "Strengthens morale during prolonged investigations." },
    { id: "g_tea_ceremony_set", name: "Pocket Tea Ceremony Set", category: "gift", rarity: "R", description: "A travel-sized matcha kit packed in a lacquered case.", effect: "Stabilizes composure after failed checks." },
    { id: "g_lucky_cat_keychain", name: "Lucky Cat Keychain", category: "gift", rarity: "N", description: "A tiny beckoning cat charm worn smooth from constant handling.", effect: "Slightly lowers the chance of critical social missteps." },
    { id: "g_analog_field_recorder", name: "Analog Field Recorder", category: "gift", rarity: "R", description: "A cassette recorder with chunky buttons and excellent mic sensitivity.", effect: "Improves clue retention from spoken testimony." },
    { id: "g_stargazer_binoculars", name: "Stargazer Binoculars", category: "gift", rarity: "R", description: "Compact binoculars with surprisingly clear low-light focus.", effect: "Boosts surveillance and distance observation." },
    { id: "g_silver_filament_camera", name: "Silver Filament Camera", category: "gift", rarity: "SR", description: "A premium film camera prized by academy photography clubs.", effect: "Greatly improves visual evidence captures." },
    { id: "g_lavender_wardrobe_sachet", name: "Lavender Wardrobe Sachet", category: "gift", rarity: "N", description: "A scented sachet meant to keep uniforms fresh between classes.", effect: "Minor boost to daily social comfort." },
    { id: "g_electric_toothbrush_neo", name: "Electric Toothbrush NEO", category: "gift", rarity: "N", description: "A compact sonic toothbrush with three aggressive cleaning modes.", effect: "Slight morale boost during morning prep." },
    { id: "g_academy_scarf_set", name: "Academy Scarf Set", category: "gift", rarity: "R", description: "A matching scarf set in muted school colors for group outings.", effect: "Improves squad cohesion during team events." },
    { id: "g_porcelain_kokeshi", name: "Porcelain Kokeshi Doll", category: "gift", rarity: "R", description: "A delicate hand-painted doll wrapped in a tiny ceremonial kimono.", effect: "Raises calm and focus during downtime." },
    { id: "g_mechanical_bear_plush", name: "Mechanical Bear Plush", category: "gift", rarity: "SR", description: "A wind-up plush that giggles in a way nobody trusts.", effect: "Increases resolve during unsettling encounters." },
    { id: "g_archival_sketchbook", name: "Archival Sketchbook", category: "gift", rarity: "N", description: "A thick-bound sketchbook with numbered pages for clean indexing.", effect: "Improves pattern tracking during investigations." },
    { id: "g_inkwash_calligraphy_kit", name: "Inkwash Calligraphy Kit", category: "gift", rarity: "R", description: "A compact calligraphy set with brush, stone, and travel ink pot.", effect: "Boosts precision in careful communication." },
    { id: "g_aurora_gel_pen_pack", name: "Aurora Gel Pen Pack", category: "gift", rarity: "N", description: "A rainbow set of smooth-flow pens that never seem to dry out.", effect: "Small bonus to note-taking consistency." },
    { id: "g_class_trial_rulebook", name: "Class Trial Rulebook", category: "gift", rarity: "SR", description: "A heavily annotated trial manual full of sticky tabs and warnings.", effect: "Improves argument sequencing under pressure." },
    { id: "g_fine_tea_sampler", name: "Fine Tea Sampler", category: "gift", rarity: "N", description: "An assortment of fragrant tea sachets with tasting notes.", effect: "Slightly reduces stress accumulation." },
    { id: "g_artisanal_chocolate_box", name: "Artisanal Chocolate Box", category: "gift", rarity: "R", description: "A gift box of dark chocolates molded into tiny puzzle pieces.", effect: "Boosts rapport in gift-giving scenes." },
    { id: "g_retro_game_handheld", name: "Retro Game Handheld", category: "gift", rarity: "R", description: "A pocket console loaded with notoriously hard mini-games.", effect: "Raises persistence after repeated failures." },
    { id: "g_novelty_yo_yo_pro", name: "Novelty Yo-Yo Pro", category: "gift", rarity: "N", description: "A weighted yo-yo marketed to students with restless hands.", effect: "Minor concentration bonus in waiting phases." },
    { id: "g_portable_chess_set", name: "Portable Chess Set", category: "gift", rarity: "R", description: "A magnetic travel chess board with polished metal pieces.", effect: "Improves strategic foresight during debates." },
    { id: "g_gold_cufflinks_vortex", name: "Vortex Gold Cufflinks", category: "gift", rarity: "SR", description: "Luxurious cufflinks engraved with a hypnotic spiral motif.", effect: "Raises authority in formal confrontations." },
    { id: "g_starfall_umbrella", name: "Starfall Umbrella", category: "gift", rarity: "N", description: "A foldable umbrella patterned with neon constellations.", effect: "Small comfort boost during gloomy events." },
    { id: "g_mountain_hiking_boots", name: "Trailmaster Hiking Boots", category: "gift", rarity: "R", description: "Durable boots with reinforced soles for rough terrain.", effect: "Improves stamina in exploration segments." },
    { id: "g_vinyl_record_sampler", name: "Vinyl Record Sampler", category: "gift", rarity: "R", description: "A curated record set spanning jazz, city pop, and synthwave.", effect: "Raises morale recovery after high-tension scenes." },
    { id: "g_origami_crane_box", name: "Origami Crane Box", category: "gift", rarity: "N", description: "A lacquered box filled with tiny hand-folded paper cranes.", effect: "Small bonus to patience and composure." },
    { id: "g_glass_rose_paperweight", name: "Glass Rose Paperweight", category: "gift", rarity: "N", description: "A rose sealed inside clear glass that catches every light source.", effect: "Improves focus during desk analysis." },
    { id: "g_cosmic_snow_globe", name: "Cosmic Snow Globe", category: "gift", rarity: "SR", description: "A snow globe filled with glittering stars and a miniature school dome.", effect: "Boosts determination in critical moments." },
    { id: "g_platinum_wristwatch", name: "Platinum Wristwatch", category: "gift", rarity: "SR", description: "A precision watch with a silent sweep second hand.", effect: "Improves timing windows in rapid exchanges." },
    { id: "g_scented_candle_set", name: "Nocturne Candle Set", category: "gift", rarity: "N", description: "A trio of candles: cedar, rain, and vanilla smoke.", effect: "Slightly lowers anxiety during night sequences." },
    { id: "g_tactical_flashlight", name: "Tactical Flashlight Mk-II", category: "gift", rarity: "R", description: "A compact flashlight with wide-beam and pin-beam modes.", effect: "Improves discovery chance in dark areas." },
    { id: "g_portable_drone_camera", name: "Pocket Drone Camera", category: "gift", rarity: "SR", description: "A folding mini-drone with stabilized aerial capture.", effect: "Greatly improves environmental scouting." },
    { id: "g_mystery_key_bundle", name: "Mystery Key Bundle", category: "gift", rarity: "R", description: "A ring of unlabeled keys from unknown academy locks.", effect: "Boosts improv options in locked-room scenarios." },
    { id: "g_sakura_stationery_box", name: "Sakura Stationery Box", category: "gift", rarity: "N", description: "A pastel stationery set with sticky notes and matching envelopes.", effect: "Minor bonus to organized communication." },

    { id: "g_echo_line_baton", name: "Echo-Line Baton", category: "gift", rarity: "SR", description: "A tactile conductor baton etched with raised tempo guides for blind rehearsal.", effect: "Sharpens rhythm cues in high-pressure sequences." },
    { id: "g_street_sprint_gloves", name: "Street Sprint Gloves", category: "gift", rarity: "N", description: "Reinforced fingerless gloves built for scrappy parkour and quick climbs.", effect: "Small boost to physical confidence checks." },
    { id: "g_savage_sticker_pack", name: "Savage Sticker Pack", category: "gift", rarity: "N", description: "A notorious sticker set full of snarky one-liners and mockery faces.", effect: "Improves intimidation in teasing exchanges." },
    { id: "g_stage_smoke_compact", name: "Stage Smoke Compact", category: "gift", rarity: "R", description: "A pocket theater prop that emits harmless smoke for dramatic entrances.", effect: "Raises flair during performance-heavy dialogue." },
    { id: "g_solderstar_tool_roll", name: "SolderStar Tool Roll", category: "gift", rarity: "R", description: "A neatly organized toolkit with precision drivers and mini solder wand.", effect: "Improves tech troubleshooting outcomes." },
    { id: "g_pattern_break_notebook", name: "Pattern-Break Notebook", category: "gift", rarity: "R", description: "A ruled notebook designed for anomaly logging and prediction trees.", effect: "Boosts analytical consistency in investigations." },
    { id: "g_golden_stride_whistle", name: "Golden Stride Whistle", category: "gift", rarity: "R", description: "A coach whistle paired with upbeat drills for team motivation.", effect: "Improves morale and group coordination." },
    { id: "g_midnight_patch_jacket", name: "Midnight Patch Jacket", category: "gift", rarity: "SR", description: "An alt-fashion jacket covered in removable culture-scene patches.", effect: "Raises style and identity resonance in social scenes." },
    { id: "g_critter_quest_set", name: "Critter Quest Set", category: "gift", rarity: "R", description: "A hybrid bundle of pet-care planner, RPG dice, and foldable board map.", effect: "Improves nurture and strategy balance checks." },
    { id: "g_iris_truth_lens", name: "Iris Truth Lens", category: "gift", rarity: "SR", description: "A specialist diagnostic lens tuned for micro eye-movement observation.", effect: "Greatly improves intention-reading in direct eye contact." },
];

export function createItemsPanelController({ extensionName, extension_settings, saveSettingsDebounced, playSfx, getSfx, onGiftUseRequest }) {
    let activeItemsFilter = "all";
    let activeItemsSort = "recent";
    let selectedItemId = null;
    let monoMachineDupReduction = 0;
    let monoMachineOpen = false;

    const placeholderSkillShopCatalog = [
        { id: "shop_skill_lie_detector_earring", name: "Lie Detector Earring", cost: 1, teaserEffect: "Highlights suspicious dialogue beats." },
        { id: "shop_skill_dramatic_pause_plus", name: "Dramatic Pause+", cost: 1, teaserEffect: "Adds impact before major rebuttals." },
        { id: "shop_skill_monokuma_warranty", name: "Monokuma Warranty", cost: 1, teaserEffect: "Survive one terrible bargain (maybe)." },
        { id: "shop_skill_protagonist_hair_flip", name: "Protagonist Hair Flip", cost: 1, teaserEffect: "Temporarily boosts confidence in tense scenes." },
    ];


    function loadInventoryState() {
        const ext = extension_settings[extensionName];
        ext.inventory ||= {};
        ext.inventory.monocoins ??= 0;
        ext.inventory.trustFragments ??= 0;
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

    function consumeGiftForUse(item) {
        if (!item || item.category !== "gift") return false;
        const consumed = discardInventoryItem(item.id, 1);
        if (!consumed) return false;

        if (typeof onGiftUseRequest === "function") {
            onGiftUseRequest({
                id: item.id,
                name: item.name,
                rarity: item.rarity,
                description: item.description,
                effect: item.effect,
            });
        }

        const $result = $("#items-machine-result");
        if ($result.length) {
            $result.text(`QUEUED ${item.name.toUpperCase()} FOR THE NEXT CHARACTER REPLY.`);
        }

        return true;
    }

    function discardGiftsByRarity(rarity) {
        loadInventoryState();

        const inventory = extension_settings[extensionName].inventory;
        const giftEntries = Object.entries(inventory.gifts || {});
        let removedTotal = 0;

        for (const [itemId, qtyRaw] of giftEntries) {
            const item = getItemById(itemId);
            if (!item || item.category !== "gift") continue;
            if (item.rarity !== rarity) continue;

            const qty = Number(qtyRaw || 0);
            removedTotal += Math.max(0, qty);
            delete inventory.gifts[itemId];
        }

        if (removedTotal > 0 && selectedItemId) {
            const selected = getItemById(selectedItemId);
            if (selected?.rarity === rarity) {
                selectedItemId = null;
            }
            saveSettingsDebounced();
        }

        return removedTotal;
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

    function computeMonoMachineDupeChance() {
        const inventory = extension_settings[extensionName].inventory || {};
        const giftPoolSize = Math.max(1, getGiftPool().length);
        const ownedUnique = Object.values(inventory.gifts || {}).filter(qty => Number(qty || 0) > 0).length;
        const baseChance = Math.min(90, 24 + Math.round((ownedUnique / giftPoolSize) * 56));
        return Math.max(3, baseChance - monoMachineDupReduction);
    }

    function runMonoMonoMachine() {
        loadInventoryState();

        const inventory = extension_settings[extensionName].inventory;
        const availableCoins = Number(inventory.monocoins || 0);
        if (availableCoins < 1) {
            return { ok: false, reason: "NOT ENOUGH MONOCOINS." };
        }

        const gifts = getGiftPool();
        if (!gifts.length) {
            return { ok: false, reason: "NO GIFTS REGISTERED IN CATALOG." };
        }

        const rarityWeight = { N: 1, R: 0.75, SR: 0.5, KEY: 0.2 };
        const dupeChance = computeMonoMachineDupeChance() / 100;
        const dupeCandidates = gifts.filter(item => Number(inventory.gifts[item.id] || 0) > 0);
        const freshCandidates = gifts.filter(item => Number(inventory.gifts[item.id] || 0) <= 0);
        const wantsDupe = dupeCandidates.length > 0 && Math.random() < dupeChance;
        const pool = (wantsDupe || !freshCandidates.length) ? dupeCandidates : freshCandidates;
        const weighted = (pool.length ? pool : gifts).map(item => ({ item, weight: rarityWeight[item.rarity] || 0.6 }));

        const won = weightedPick(weighted);
        if (!won) {
            return { ok: false, reason: "MONOMONO MACHINE JAMMED." };
        }

        const preOwned = Number(inventory.gifts[won.id] || 0) > 0;
        inventory.gifts[won.id] = Number(inventory.gifts[won.id] || 0) + 1;
        inventory.monocoins = Math.max(0, availableCoins - 1);
        selectedItemId = won.id;

        saveSettingsDebounced();
        return {
            ok: true,
            duplicate: preOwned,
            dupeChancePercent: Math.round(dupeChance * 100),
            result: won,
        };
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

            <!-- <div class="items-detail-section-label">EFFECT</div>
            <div class="items-detail-effect">${item.effect}</div> -->

            <div class="items-detail-actions">
                <button class="items-detail-action" data-action="use-item" ${showDiscardGift ? '' : 'disabled'}>USE</button>
                <button class="items-detail-action" disabled>INSPECT</button>
                ${showDiscardGift ? '<button class="items-detail-action discard" data-action="discard-gift">DISCARD GIFT</button>' : ""}
                ${showDiscardGift ? `<button class="items-detail-action discard" data-action="discard-rarity">MASS DISCARD ${item.rarity}</button>` : ""}
            </div>
        `);

        if (showDiscardGift) {
            $detail.find('[data-action="use-item"]').on("click", () => {
                playSfx(getSfx().click);
                consumeGiftForUse(item);
                renderSkillsItemsPanel();
            });

            $detail.find('[data-action="discard-gift"]').on("click", () => {
                playSfx(getSfx().click);
                discardInventoryItem(item.id, 1);
                renderSkillsItemsPanel();
            });

            $detail.find('[data-action="discard-rarity"]').on("click", () => {
                playSfx(getSfx().click);
                const removed = discardGiftsByRarity(item.rarity);
                const $result = $("#items-machine-result");
                if ($result.length) {
                    $result.text(removed > 0
                        ? `MASS DISCARDED ${removed} ${item.rarity}-RARITY GIFTS.`
                        : `NO ${item.rarity}-RARITY GIFTS TO DISCARD.`);
                }
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
        const trustFragments = Number(extension_settings[extensionName].inventory?.trustFragments || 0);
        const showSkillShop = activeItemsFilter === "skill";

        $("#items-monocoin-value").text(monocoins.toLocaleString());
        $("#items-trust-fragment-value").text(trustFragments.toLocaleString());
        bindSkillShopButton();
        bindMonoMonoMachine();

        const $skillShopRow = $panel.find("#items-skill-shop-row");
        if ($skillShopRow.length) {
            $skillShopRow.prop("hidden", !showSkillShop);
        }

        $panel.find(".items-filter-button").each((_, el) => {
            const isActive = el.dataset.filter === activeItemsFilter;
            el.classList.toggle("active", isActive);
            el.setAttribute("aria-selected", String(isActive));
        });

        $panel.find('input[name="items-sort"]').each((_, el) => {
            el.checked = el.value === activeItemsSort;
        });

        renderInventoryGrid();

        if (monoMachineOpen) {
            updateMonoMachineUi();
        }
    }

    function setFilter(filter = "all") {
        activeItemsFilter = filter;
    }

    function setSort(sort = "recent") {
        activeItemsSort = sort;
    }


    function getSkillShopListings() {
        return placeholderSkillShopCatalog.map(skill => ({
            ...skill,
            available: false,
            futureEffectHook: skill.teaserEffect,
        }));
    }

    function renderSkillShopDetails() {
        const $detail = $("#items-detail-panel");
        if (!$detail.length) return;

        const skillRows = getSkillShopListings()
            .map(skill => `
                <div class="items-shop-entry" data-shop-skill-id="${skill.id}">
                    <div class="items-shop-entry-main">
                        <div class="items-shop-entry-name">${skill.name.toUpperCase()}</div>
                        <div class="items-shop-entry-effect">EFFECT: ${skill.futureEffectHook.toUpperCase()}</div>
                    </div>
                    <div class="items-shop-entry-meta">
                        <div class="items-shop-entry-cost">◈ x${skill.cost} TRUST FRAGMENT</div>
                        <button class="items-shop-entry-buy" type="button" disabled>SOON</button>
                    </div>
                </div>
            `)
            .join("");

        $detail.html(`
            <div class="items-panel-title">SKILL SHOP</div>
            <div class="items-shop-placeholder-title">TRUST FRAGMENT EXCHANGE</div>
            <div class="items-shop-placeholder-copy">SELECTED SKILLS ARE PLACEHOLDERS FOR NOW. EACH ONE COSTS 1 TRUST FRAGMENT AND WILL RECEIVE LIVE EFFECTS LATER.</div>
            <div class="items-shop-list">${skillRows}</div>
        `);
    }

    function bindSkillShopButton() {
        const $button = $("#items-skill-shop-button");
        if (!$button.length) return;

        $button.off("click").on("click", () => {
            playSfx(getSfx().click);
            renderSkillShopDetails();
        });
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
            },
            setTrustFragments(value = 0) {
                loadInventoryState();
                extension_settings[extensionName].inventory.trustFragments = Math.max(0, Number(value || 0));
                saveSettingsDebounced();
                renderSkillsItemsPanel();
            }
        };
    }


    function rollMonoMonoMachine() {
        const run = runMonoMonoMachine();
        if (!run.ok) return run;

        return {
            ...run,
            message: `${run.duplicate ? "DUPE" : "NEW"} · ${run.result.name.toUpperCase()}`
        };
    }

    function addMonoMachineCoin() {
        loadInventoryState();

        const inventory = extension_settings[extensionName].inventory;
        const availableCoins = Number(inventory.monocoins || 0);
        if (availableCoins < 1) {
            return { ok: false, reason: "NOT ENOUGH MONOCOINS." };
        }

        inventory.monocoins = Math.max(0, availableCoins - 1);
        monoMachineDupReduction = Math.min(70, monoMachineDupReduction + 6);
        saveSettingsDebounced();

        return {
            ok: true,
            reduction: monoMachineDupReduction,
            dupeChancePercent: computeMonoMachineDupeChance(),
        };
    }

    function updateMonoMachineUi() {
        loadInventoryState();
        const monocoins = Number(extension_settings[extensionName].inventory?.monocoins || 0);
        const chance = computeMonoMachineDupeChance();

        $("#items-machine-coins").text(`x ${monocoins.toLocaleString()}`);
        $("#items-machine-dupe").text(`DUPE CHANCE: ${chance}%`);
        $("#items-machine-roll").prop("disabled", monocoins < 1);
        $("#items-machine-add").prop("disabled", monocoins < 1 || monoMachineDupReduction >= 70);
    }

    function openMonoMonoMachine() {
        monoMachineOpen = true;
        $("#items-machine-overlay").prop("hidden", false);
        $("#items-machine-result").text("ROLL FOR A GIFT OR SPEND A COIN TO LOWER DUPE CHANCE.");
        updateMonoMachineUi();
    }

    function closeMonoMonoMachine() {
        monoMachineOpen = false;
        $("#items-machine-overlay").prop("hidden", true);
        monoMachineDupReduction = 0;
    }

    function bindMonoMonoMachine() {
        $("#items-machine-launch").off("click").on("click", () => {
            playSfx(getSfx().click);
            openMonoMonoMachine();
        });

        $("#items-machine-close").off("click").on("click", () => {
            playSfx(getSfx().click);
            closeMonoMonoMachine();
        });

        $("#items-machine-roll").off("click").on("click", () => {
            playSfx(getSfx().click);
            const run = rollMonoMonoMachine();
            const $result = $("#items-machine-result");
            if (!run.ok) {
                $result.text(run.reason || "ROLL FAILED.");
            } else {
                $result.text(`${run.message} · DUPE CHANCE ${run.dupeChancePercent}%`);
            }
            renderSkillsItemsPanel();
        });

        $("#items-machine-add").off("click").on("click", () => {
            playSfx(getSfx().click);
            const add = addMonoMachineCoin();
            const $result = $("#items-machine-result");
            if (!add.ok) {
                $result.text(add.reason || "UNABLE TO ADD COIN.");
            } else {
                $result.text(`DUPE CHANCE REDUCED TO ${add.dupeChancePercent}%`);
            }
            renderSkillsItemsPanel();
        });
    }

    return {
        bindWindowApi,
        loadInventoryState,
        renderSkillsItemsPanel,
        setFilter,
        setSort,
        rollMonoMonoMachine,
    };
}
