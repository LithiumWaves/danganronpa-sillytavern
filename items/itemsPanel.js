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

    { id: "g_braille_chord_atlas", name: "Braille Chord Atlas", category: "gift", rarity: "R", description: "A raised-print chord dictionary with tactile fretboard diagrams.", effect: "Improves rhythm planning in collaborative sessions." },
    { id: "g_resonance_cane_charm", name: "Resonance Cane Charm", category: "gift", rarity: "N", description: "A silver cane charm that rings at different pitches per step.", effect: "Adds confidence to navigation under pressure." },
    { id: "g_nocturne_ear_training_cards", name: "Nocturne Ear-Training Cards", category: "gift", rarity: "R", description: "A deck of interval drills with textured suit markers.", effect: "Boosts audio-memory checks in testimony review." },
    { id: "g_sonic_thread_gloves", name: "Sonic Thread Gloves", category: "gift", rarity: "SR", description: "Performance gloves woven to transmit instrument vibration detail.", effect: "Greatly improves timing during duet events." },
    { id: "g_hummingbird_tuner_pin", name: "Hummingbird Tuner Pin", category: "gift", rarity: "N", description: "A tiny lapel tuner that vibrates when nearby notes go sharp.", effect: "Slightly increases precision in music-based prompts." },
    { id: "g_asphalt_ace_kneepads", name: "Asphalt Ace Kneepads", category: "gift", rarity: "N", description: "Scrape-proof kneepads built for sprinting, sliding, and getting back up.", effect: "Raises recovery speed after physical setbacks." },
    { id: "g_rebar_bat_grip", name: "Rebar Bat Grip", category: "gift", rarity: "R", description: "An impact-absorbing athletic grip wrap with rebellious graffiti print.", effect: "Improves confidence in competitive challenges." },
    { id: "g_rooftop_parkour_guide", name: "Rooftop Parkour Guide", category: "gift", rarity: "R", description: "A heavily annotated manual for urban routes and vault techniques.", effect: "Boosts traversal planning in map events." },
    { id: "g_tomboy_victory_bandana", name: "Tomboy Victory Bandana", category: "gift", rarity: "N", description: "A sweat-wicking bandana tied with a stitched lightning emblem.", effect: "Adds grit to head-on confrontation checks." },
    { id: "g_chainlink_trophy", name: "Chainlink Trophy", category: "gift", rarity: "SR", description: "A handmade trophy forged from court fence metal and pure stubbornness.", effect: "Greatly increases determination in comeback scenes." },
    { id: "g_sharp_tongue_flashcards", name: "Sharp-Tongue Flashcards", category: "gift", rarity: "N", description: "Color-coded insult cards sorted by sarcasm intensity.", effect: "Improves taunt timing in verbal clashes." },
    { id: "g_prankster_airhorn_mini", name: "Prankster Airhorn Mini", category: "gift", rarity: "R", description: "A pocket airhorn that can ruin anyone's dramatic pause.", effect: "Raises disruption chance in hostile exchanges." },
    { id: "g_viper_gum_sampler", name: "Viper Gum Sampler", category: "gift", rarity: "N", description: "Shockingly sour gum flavors used for intimidation dares.", effect: "Slightly boosts intimidation before negotiations." },
    { id: "g_mock_trial_scoreboard", name: "Mock-Trial Scoreboard", category: "gift", rarity: "R", description: "A magnetic board for tracking wins, losses, and petty rivalries.", effect: "Improves strategic focus in debate minigames." },
    { id: "g_razor_confetti_cannon", name: "Razor Confetti Cannon", category: "gift", rarity: "SR", description: "A celebration cannon that launches metallic confetti in villainous style.", effect: "Greatly boosts momentum after successful rebuttals." },
    { id: "g_velour_soliloquy_scarf", name: "Velour Soliloquy Scarf", category: "gift", rarity: "R", description: "A flowing stage scarf designed for dramatic spins and bows.", effect: "Improves charisma during spotlight moments." },
    { id: "g_curtain_call_throat_tea", name: "Curtain Call Throat Tea", category: "gift", rarity: "N", description: "A honey-citrus blend for preserving projection after rehearsals.", effect: "Slightly extends stamina in long conversations." },
    { id: "g_prop_master_ring", name: "Prop Master Ring", category: "gift", rarity: "R", description: "A ring hidden with mini prop tools for quick stage fixes.", effect: "Boosts improvisation in unpredictable scenes." },
    { id: "g_spotlight_powder_palette", name: "Spotlight Powder Palette", category: "gift", rarity: "N", description: "Anti-glare performance powder with warm and cool tones.", effect: "Increases composure under public scrutiny." },
    { id: "g_encore_mask_set", name: "Encore Mask Set", category: "gift", rarity: "SR", description: "A set of expression masks used to practice emotional range drills.", effect: "Greatly improves acting-based deception checks." },
    { id: "g_quantum_cable_kit", name: "Quantum Cable Kit", category: "gift", rarity: "N", description: "A pouch of labeled adapters that somehow covers every port.", effect: "Reduces setup time for device-related tasks." },
    { id: "g_debug_duck_plush", name: "Debug Duck Plush", category: "gift", rarity: "R", description: "A stern little plush duck for explaining code out loud.", effect: "Improves troubleshooting consistency." },
    { id: "g_syntax_sticker_lattice", name: "Syntax Sticker Lattice", category: "gift", rarity: "N", description: "Circuit-style stickers used to organize cases and laptops.", effect: "Minor boost to workflow organization." },
    { id: "g_overclock_thermos", name: "Overclock Thermos", category: "gift", rarity: "R", description: "A temperature-lock thermos etched with hexadecimal runes.", effect: "Raises focus in late-night analysis sessions." },
    { id: "g_hologrid_dev_board", name: "HoloGrid Dev Board", category: "gift", rarity: "SR", description: "A premium prototyping board with modular holographic output.", effect: "Greatly improves high-complexity tech checks." },
    { id: "g_red_string_pin_case", name: "Red String Pin Case", category: "gift", rarity: "N", description: "An elegant case of map pins for connecting suspicious events.", effect: "Slightly boosts clue-linking speed." },
    { id: "g_causality_slide_rule", name: "Causality Slide Rule", category: "gift", rarity: "R", description: "A modernized slide rule designed for probability chains.", effect: "Improves prediction reliability." },
    { id: "g_anomaly_highlighter_set", name: "Anomaly Highlighter Set", category: "gift", rarity: "N", description: "Five fluorescent pens for marking contradictions by severity.", effect: "Adds clarity to evidence review." },
    { id: "g_quiet_room_metronome", name: "Quiet-Room Metronome", category: "gift", rarity: "R", description: "A silent-LED metronome used to pace hypothesis testing.", effect: "Boosts patience during prolonged logic chains." },
    { id: "g_fractal_caseboard", name: "Fractal Caseboard", category: "gift", rarity: "SR", description: "A foldout board that nests sub-cases inside parent mysteries.", effect: "Greatly improves multi-thread deduction." },
    { id: "g_pep_rally_megaphone", name: "Pep Rally Megaphone", category: "gift", rarity: "N", description: "A lightweight megaphone covered in motivational doodles.", effect: "Raises team morale during group events." },
    { id: "g_team_huddle_kit", name: "Team Huddle Kit", category: "gift", rarity: "R", description: "Includes cones, wristbands, and a pocket playbook for quick drills.", effect: "Improves coordination in timed challenges." },
    { id: "g_sunrise_training_hoodie", name: "Sunrise Training Hoodie", category: "gift", rarity: "N", description: "A bright hoodie that somehow makes morning practice feel possible.", effect: "Slightly boosts endurance checks." },
    { id: "g_good_dog_medal", name: "Good-Dog Spirit Medal", category: "gift", rarity: "R", description: "A cheerful medal awarded for impossible optimism and hustle.", effect: "Increases ally support after setbacks." },
    { id: "g_relay_baton_of_hope", name: "Relay Baton of Hope", category: "gift", rarity: "SR", description: "A polished baton engraved with names of everyone on the team.", effect: "Greatly enhances cooperative action success." },
    { id: "g_underground_zine_bundle", name: "Underground Zine Bundle", category: "gift", rarity: "N", description: "A stack of hand-stapled zines on alt fashion, punk venues, and scene lore.", effect: "Boosts cultural rapport in niche conversations." },
    { id: "g_chain_charm_harness", name: "Chain Charm Harness", category: "gift", rarity: "R", description: "A modular accessory harness with removable enamel charms.", effect: "Improves self-expression confidence." },
    { id: "g_neon_grunge_eyeliner", name: "Neon Grunge Eyeliner", category: "gift", rarity: "N", description: "Smudge-proof eyeliner set tuned for cyber-goth palettes.", effect: "Adds style-based influence in social scenes." },
    { id: "g_subculture_archive_drive", name: "Subculture Archive Drive", category: "gift", rarity: "R", description: "A curated drive of runway scans, music flyers, and street snapshots.", effect: "Improves trend analysis and aesthetic references." },
    { id: "g_catwalk_rebellion_boots", name: "Catwalk Rebellion Boots", category: "gift", rarity: "SR", description: "Platform boots with hidden compartments and reinforced soles.", effect: "Greatly boosts presence in confrontational scenes." },
    { id: "g_pocket_vet_notebook", name: "Pocket Vet Notebook", category: "gift", rarity: "N", description: "A waterproof notebook for feeding schedules and health observations.", effect: "Slightly improves caregiving consistency." },
    { id: "g_beastmaster_initiative_tracker", name: "Beastmaster Initiative Tracker", category: "gift", rarity: "R", description: "A dry-erase tracker for turn order in pet-friendly RPG sessions.", effect: "Improves strategy under chaotic conditions." },
    { id: "g_critter_clinic_dice_tower", name: "Critter Clinic Dice Tower", category: "gift", rarity: "R", description: "A foldable dice tower shaped like a tiny animal hospital.", effect: "Boosts planning in game-night bonding events." },
    { id: "g_habitat_tile_expansion", name: "Habitat Tile Expansion", category: "gift", rarity: "N", description: "Board-game tiles featuring forests, reefs, and rescue shelters.", effect: "Adds flexibility to tactical problem solving." },
    { id: "g_guardian_familiar_rulebook", name: "Guardian Familiar Rulebook", category: "gift", rarity: "SR", description: "A deluxe RPG supplement about summoning protective spirit animals.", effect: "Greatly improves nurture-and-defense synergy checks." },
    { id: "g_rainy_window_postcards", name: "Rainy Window Postcards", category: "gift", rarity: "N", description: "A melancholy postcard set painted in muted blues and grays.", effect: "Slightly improves empathy with withdrawn allies." },
    { id: "g_memorial_locket_blank", name: "Memorial Locket Blank", category: "gift", rarity: "R", description: "An empty locket meant to hold a memory when words fail.", effect: "Boosts trust in quiet one-on-one moments." },
    { id: "g_night_watch_eye_mask", name: "Night-Watch Eye Mask", category: "gift", rarity: "N", description: "A weighted sleep mask embroidered with tiny constellations.", effect: "Helps recover composure after emotional events." },
    { id: "g_intent_reflection_prism", name: "Intent Reflection Prism", category: "gift", rarity: "R", description: "A palm prism used to practice reading subtle eye and posture cues.", effect: "Improves intention-reading preparation." },
    { id: "g_oculesic_monocle_frame", name: "Oculesic Monocle Frame", category: "gift", rarity: "SR", description: "A specialist frame that highlights micro-saccades in training drills.", effect: "Greatly increases precision in eye-contact analysis." },
    { id: "g_glacier_postage_stamps", name: "Glacier Postage Stamps", category: "gift", rarity: "N", description: "Limited stamps featuring remote ice fields and aurora skies.", effect: "Minor boost to correspondence-themed interactions." },
    { id: "g_origami_crane_lantern", name: "Origami Crane Lantern", category: "gift", rarity: "R", description: "A collapsible lantern that projects folded-crane shadows.", effect: "Improves calm during nighttime strategy talks." },
    { id: "g_midnight_bento_toolkit", name: "Midnight Bento Toolkit", category: "gift", rarity: "N", description: "Cute cutters and picks for assembling morale-boosting lunches.", effect: "Raises team comfort in long operations." },
    { id: "g_windup_planetarium", name: "Wind-Up Planetarium", category: "gift", rarity: "SR", description: "A hand-cranked projector mapping constellations across the ceiling.", effect: "Improves reflective focus before major decisions." },
    { id: "g_amber_ink_seal_set", name: "Amber Ink Seal Set", category: "gift", rarity: "R", description: "Wax seals with house crests and mystery-novel motifs.", effect: "Adds gravitas to formal requests." },
    { id: "g_horizon_scent_candle", name: "Horizon Scent Candle", category: "gift", rarity: "N", description: "A candle blend of cedar, rain, and a hint of citrus peel.", effect: "Slightly lowers stress during planning scenes." },
    { id: "g_fable_marble_set", name: "Fable Marble Set", category: "gift", rarity: "N", description: "Swirled marbles packaged with tiny folklore cards.", effect: "Improves rapport in lighthearted downtime." },
    { id: "g_brass_compass_rose", name: "Brass Compass Rose", category: "gift", rarity: "R", description: "A desk compass with an etched rose and rotating outer ring.", effect: "Boosts directional confidence during map traversal." },
    { id: "g_stormglass_hourglass", name: "Stormglass Hourglass", category: "gift", rarity: "SR", description: "A crystal hourglass whose sand glows during lightning.", effect: "Increases timing accuracy in high-pressure events." },
    { id: "g_sakura_tea_tin", name: "Sakura Tea Tin", category: "gift", rarity: "N", description: "Spring tea leaves stored in a floral embossed tin.", effect: "Minor boost to peaceful social encounters." },
    { id: "g_vinyl_listening_log", name: "Vinyl Listening Log", category: "gift", rarity: "R", description: "A journal for tracking songs, moods, and hidden lyrics.", effect: "Improves memory recall from auditory clues." },
    { id: "g_obsidian_bookmark_dagger", name: "Obsidian Bookmark Dagger", category: "gift", rarity: "R", description: "A decorative dagger-shaped bookmark with faux obsidian inlay.", effect: "Boosts confidence in literature-themed debates." },
    { id: "g_lanternfish_keylight", name: "Lanternfish Keylight", category: "gift", rarity: "N", description: "A soft blue keylight shaped like a deep-sea lanternfish.", effect: "Adds visibility in low-light searches." },
    { id: "g_thunderhead_umbrella", name: "Thunderhead Umbrella", category: "gift", rarity: "R", description: "A stormproof umbrella printed with crackling cloud art.", effect: "Improves mobility during weather-related events." },
    { id: "g_ginkgo_memory_charm", name: "Ginkgo Memory Charm", category: "gift", rarity: "N", description: "A brass ginkgo leaf charm said to preserve precious memories.", effect: "Slightly improves recall in emotional scenes." },
    { id: "g_clocktower_pocket_map", name: "Clocktower Pocket Map", category: "gift", rarity: "N", description: "A foldout city map with hidden rooftop routes marked in ink.", effect: "Boosts exploration efficiency in urban zones." },
    { id: "g_riverstone_worry_beads", name: "Riverstone Worry Beads", category: "gift", rarity: "N", description: "Smooth beads strung from polished river stones.", effect: "Minor reduction to anxiety during tense dialogue." },
    { id: "g_carillon_chime_pin", name: "Carillon Chime Pin", category: "gift", rarity: "R", description: "An enamel pin that rings softly when tapped.", effect: "Improves attention capture in crowded settings." },
    { id: "g_meteor_shard_pendant", name: "Meteor Shard Pendant", category: "gift", rarity: "SR", description: "A pendant set with a certified fragment of meteorite.", effect: "Boosts awe and curiosity in first impressions." },
    { id: "g_paperback_mystery_bundle", name: "Paperback Mystery Bundle", category: "gift", rarity: "N", description: "Three dog-eared whodunits with penciled margin theories.", effect: "Slightly improves deduction warm-up." },
    { id: "g_tea_house_stamp_card", name: "Tea House Stamp Card", category: "gift", rarity: "N", description: "A loyalty card nearly full from late-night think sessions.", effect: "Minor bonus to restorative breaks." },
    { id: "g_sapphire_chalk_set", name: "Sapphire Chalk Set", category: "gift", rarity: "R", description: "Vivid chalks for mapping clues on dark surfaces.", effect: "Improves visual explanation clarity." },
    { id: "g_electric_kite_kit", name: "Electric Kite Kit", category: "gift", rarity: "R", description: "A reinforced kite with LED strips for evening flights.", effect: "Boosts morale during outdoor downtime." },
    { id: "g_honeycomb_lunch_box", name: "Honeycomb Lunch Box", category: "gift", rarity: "N", description: "A stackable lunch box with leak-proof honeycomb seals.", effect: "Improves daily preparedness." },
    { id: "g_festival_drumming_tape", name: "Festival Drumming Tape", category: "gift", rarity: "N", description: "Grip tape used by parade drummers for long performances.", effect: "Slight stamina increase in rhythm tasks." },
    { id: "g_porcelain_fox_mask", name: "Porcelain Fox Mask", category: "gift", rarity: "R", description: "A hand-painted fox mask from a shrine-side market.", effect: "Improves poise in ceremonial scenes." },
    { id: "g_velvet_card_case", name: "Velvet Card Case", category: "gift", rarity: "N", description: "A soft-lined case for storing club cards and tickets.", effect: "Minor boost to social organization." },
    { id: "g_maple_harmonica", name: "Maple Harmonica", category: "gift", rarity: "R", description: "A warm-toned harmonica tuned for melancholic melodies.", effect: "Improves emotional resonance in quiet interactions." },
    { id: "g_ceramic_moon_cup", name: "Ceramic Moon Cup", category: "gift", rarity: "N", description: "A moon-glazed cup that keeps tea warm longer than expected.", effect: "Slightly boosts comfort in late-night discussions." },
    { id: "g_tidal_wave_puzzle", name: "Tidal Wave Puzzle", category: "gift", rarity: "R", description: "A 3D puzzle of layered ocean currents and islands.", effect: "Improves spatial reasoning drills." },
    { id: "g_jade_lucky_knot", name: "Jade Lucky Knot", category: "gift", rarity: "N", description: "A handcrafted knot charm with a polished jade bead.", effect: "Minor increase to favorable event rolls." },
    { id: "g_aurora_film_roll", name: "Aurora Film Roll", category: "gift", rarity: "R", description: "High-ISO film stock perfect for nighttime color capture.", effect: "Boosts low-light evidence photography." },
    { id: "g_dawn_runner_shoelaces", name: "Dawn Runner Shoelaces", category: "gift", rarity: "N", description: "Reflective laces built for predawn training routes.", effect: "Slight speed bonus in timed movement challenges." },
    { id: "g_sandman_lullaby_box", name: "Sandman Lullaby Box", category: "gift", rarity: "SR", description: "A wind-up box that plays a soft tune for restless nights.", effect: "Greatly improves recovery between stressful chapters." },
    { id: "g_quill_of_second_drafts", name: "Quill of Second Drafts", category: "gift", rarity: "R", description: "A fountain quill that encourages rewriting before speaking.", effect: "Improves precision in important statements." },
    { id: "g_library_afterhours_pass", name: "Library Afterhours Pass", category: "gift", rarity: "SR", description: "A special pass granting quiet stacks access after curfew.", effect: "Greatly increases research yield from reading events." },
    { id: "g_firefly_path_brooch", name: "Firefly Path Brooch", category: "gift", rarity: "N", description: "A glowing brooch inspired by fireflies over summer fields.", effect: "Minor boost to nighttime navigation." },
    { id: "g_lacquer_domino_set", name: "Lacquer Domino Set", category: "gift", rarity: "N", description: "A travel domino set with glossy black-and-gold tiles.", effect: "Improves rapport in downtime game sessions." },
    { id: "g_radiant_court_whistle", name: "Radiant Court Whistle", category: "gift", rarity: "R", description: "A bright whistle that cuts cleanly through gym noise.", effect: "Boosts command presence during drills." },
    { id: "g_blossom_raincoat", name: "Blossom Raincoat", category: "gift", rarity: "N", description: "A pastel raincoat patterned with falling flower petals.", effect: "Minor resilience bonus in wet-weather events." },
    { id: "g_inkstorm_sketch_roll", name: "Inkstorm Sketch Roll", category: "gift", rarity: "R", description: "A roll of textured paper for rapid scene sketching.", effect: "Improves visual note-taking during investigations." },
    { id: "g_phantom_choir_tuning_fork", name: "Phantom Choir Tuning Fork", category: "gift", rarity: "SR", description: "A rare tuning fork said to resonate with hidden harmonics.", effect: "Greatly enhances sensitivity to audio anomalies." },
    { id: "g_orbiting_desk_mobile", name: "Orbiting Desk Mobile", category: "gift", rarity: "N", description: "A delicate solar-system mobile for cluttered workstations.", effect: "Slightly improves concentration while studying." },
    { id: "g_coral_thread_bracelet", name: "Coral Thread Bracelet", category: "gift", rarity: "N", description: "A braided bracelet with tiny coral beads and sea knots.", effect: "Minor bonus to calm under pressure." },
    { id: "g_ivory_ticket_book", name: "Ivory Ticket Book", category: "gift", rarity: "R", description: "A collectible book of old theater and train ticket stubs.", effect: "Improves nostalgia-based rapport gains." },
    { id: "g_wildflower_field_guide", name: "Wildflower Field Guide", category: "gift", rarity: "N", description: "An illustrated guide to edible, medicinal, and symbolic flowers.", effect: "Slightly boosts outdoor clue interpretation." },
    { id: "g_starlit_badminton_set", name: "Starlit Badminton Set", category: "gift", rarity: "R", description: "Glow-rim rackets and shuttlecocks for rooftop matches.", effect: "Improves agility and bonding during recreation." },
    { id: "g_cobalt_record_sleeves", name: "Cobalt Record Sleeves", category: "gift", rarity: "N", description: "Anti-static sleeves printed with minimalist cobalt patterns.", effect: "Minor boost to music collection management." },
    { id: "g_ember_signal_flare", name: "Ember Signal Flare", category: "gift", rarity: "SR", description: "A high-visibility flare for emergencies and dramatic rescues.", effect: "Greatly increases rescue event success rates." },
    { id: "g_mossy_courtyard_bench_kit", name: "Mossy Courtyard Bench Kit", category: "gift", rarity: "R", description: "A maintenance kit for restoring neglected campus benches.", effect: "Improves peaceful meetup opportunities." },
    { id: "g_cassette_confession_mix", name: "Cassette Confession Mix", category: "gift", rarity: "R", description: "A handmade mixtape labeled only with a trembling star.", effect: "Boosts emotional breakthroughs in private talks." },
    { id: "shop_skill_lie_detector_earring", name: "Lie Detector Earring", category: "skill", rarity: "R", description: "An earring attuned to tiny tells and tonal slips.", effect: "Highlights suspicious dialogue beats." },
    { id: "shop_skill_dramatic_pause_plus", name: "Dramatic Pause+", category: "skill", rarity: "N", description: "A stagecraft micro-module for timing your words.", effect: "Adds impact before major rebuttals." },
    { id: "shop_skill_monokuma_warranty", name: "Monokuma Warranty", category: "skill", rarity: "SR", description: "A suspicious service contract stamped with a bear seal.", effect: "Survive one terrible bargain (maybe)." },
    { id: "shop_skill_protagonist_hair_flip", name: "Protagonist Hair Flip", category: "skill", rarity: "R", description: "A dramatic flourish practiced in reflective surfaces.", effect: "Temporarily boosts confidence in tense scenes." },
];

export function createItemsPanelController({ extensionName, extension_settings, saveSettingsDebounced, playSfx, getSfx, onGiftUseRequest }) {
    let activeItemsFilter = "all";
    let activeItemsSort = "recent";
    let selectedItemId = null;
    let itemSearchQuery = "";

    const placeholderSkillShopCatalog = [
        { id: "shop_skill_lie_detector_earring", name: "Lie Detector Earring", cost: 1, skillPointCost: 8, teaserEffect: "Highlights suspicious dialogue beats." },
        { id: "shop_skill_dramatic_pause_plus", name: "Dramatic Pause+", cost: 1, skillPointCost: 6, teaserEffect: "Adds impact before major rebuttals." },
        { id: "shop_skill_monokuma_warranty", name: "Monokuma Warranty", cost: 1, skillPointCost: 12, teaserEffect: "Survive one terrible bargain (maybe)." },
        { id: "shop_skill_protagonist_hair_flip", name: "Protagonist Hair Flip", cost: 1, skillPointCost: 7, teaserEffect: "Temporarily boosts confidence in tense scenes." },
    ];


    function loadInventoryState() {
        const ext = extension_settings[extensionName];
        ext.inventory ||= {};
        ext.inventory.monocoins ??= 0;
        ext.inventory.trustFragments ??= 0;
        ext.inventory.gifts ||= {};
        ext.inventory.skills ||= {};
        ext.inventory.keyItems ||= {};
        ext.inventory.skillPoints ??= 10;
        ext.inventory.equippedSkills ||= {};
        ext.inventory.customKeyItems ||= {};
        ext.inventory.customGifts ||= {};
        ext.inventory.itemImages ||= {};

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
            return [...items].sort((a, b) => {
                const sA = rarityScore(a.rarity) + (a.category === "skill" ? -10 : 0);
                const sB = rarityScore(b.rarity) + (b.category === "skill" ? -10 : 0);
                return sB - sA || a.name.localeCompare(b.name);
            });
        }

        if (activeItemsSort === "category") {
            return [...items].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name));
        }

        return [...items].sort((a, b) => b.catalogIndex - a.catalogIndex);
    }

    function getOwnedItems() {
        const inv = extension_settings[extensionName].inventory || {};

        const catalogItems = itemCatalog
            .map((item, idx) => {
                const bucket = getInventoryBucket(item.category);
                const quantity = Number(inv[bucket]?.[item.id] || 0);
                return { ...item, quantity, catalogIndex: idx };
            })
            .filter(item => item.quantity > 0);

        const customKeyItems = Object.entries(inv.customKeyItems || {}).map(([id, data]) => ({
            id,
            name: data.name,
            description: data.description || "",
            category: "key",
            rarity: "KEY",
            effect: "",
            quantity: 1,
            catalogIndex: -1,
            custom: true,
        }));

        const customGifts = Object.entries(inv.customGifts || {})
            .map(([id, data]) => ({
                id,
                name: data.name,
                description: data.description || "",
                category: "gift",
                rarity: data.rarity || "N",
                effect: "",
                quantity: Number(inv.gifts?.[id] || 0),
                catalogIndex: -1,
                isCustom: true,
            }))
            .filter(item => item.quantity > 0);

        const items = [...catalogItems, ...customKeyItems, ...customGifts];

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
    function getSkillShopEntry(skillId) {
        return placeholderSkillShopCatalog.find(skill => skill.id === skillId) || null;
    }

    function getSkillPointCost(skillId) {
        return Number(getSkillShopEntry(skillId)?.skillPointCost || 0);
    }

    function isSkillEquipped(skillId) {
        return Number(extension_settings[extensionName].inventory?.equippedSkills?.[skillId] || 0) > 0;
    }

    function equipSkill(skillId) {
        loadInventoryState();
        const inventory = extension_settings[extensionName].inventory;
        if (Number(inventory.skills?.[skillId] || 0) <= 0) return false;
        if (isSkillEquipped(skillId)) return false;

        const cost = getSkillPointCost(skillId);
        const points = Number(inventory.skillPoints || 0);
        if (points < cost) return false;

        inventory.skillPoints = points - cost;
        inventory.equippedSkills[skillId] = 1;
        saveSettingsDebounced();
        return true;
    }

    function unequipSkill(skillId) {
        loadInventoryState();
        const inventory = extension_settings[extensionName].inventory;
        if (!isSkillEquipped(skillId)) return false;

        const cost = getSkillPointCost(skillId);
        inventory.skillPoints = Number(inventory.skillPoints || 0) + cost;
        delete inventory.equippedSkills[skillId];
        saveSettingsDebounced();
        return true;
    }

    function forgetSkill(skillId) {
        loadInventoryState();
        const inventory = extension_settings[extensionName].inventory;
        if (Number(inventory.skills?.[skillId] || 0) <= 0) return false;

        // Unequip first if equipped (refunds skill points)
        if (isSkillEquipped(skillId)) {
            unequipSkill(skillId);
        }

        delete inventory.skills[skillId];
        saveSettingsDebounced();
        return true;
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
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        const catalog = itemCatalog.filter(item => item.category === "gift");
        const custom = Object.entries(inv.customGifts || {}).map(([id, data]) => ({
            id,
            name: data.name,
            category: "gift",
            rarity: data.rarity || "N",
            description: data.description || "",
            effect: "",
            isCustom: true,
        }));
        return [...catalog, ...custom];
    }

    function getGiftPoolWithCounts() {
        loadInventoryState();
        const gifts = extension_settings[extensionName].inventory?.gifts || {};
        return getGiftPool().map(item => ({
            ...item,
            owned: Number(gifts[item.id] || 0),
        }));
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

    function getDuplicatePenalty(coinInput = 1) {
        const coins = Math.max(1, Math.floor(Number(coinInput || 1)));
        return Math.max(0.18, 0.92 - (coins - 1) * 0.05);
    }

    function buildWeightedGiftPool(inventory, duplicatePenalty = 0.92) {
        const gifts = getGiftPool();
        const rarityWeight = { N: 1, R: 0.75, SR: 0.5, KEY: 0.2 };

        return gifts.map(item => {
            const owned = Number(inventory.gifts[item.id] || 0);
            const isDupeCandidate = owned > 0;
            const base = rarityWeight[item.rarity] || 0.6;
            const dupeFactor = isDupeCandidate ? duplicatePenalty : 1;
            return { item, weight: base * dupeFactor, isDupeCandidate };
        });
    }

    function getMonoMonoDupeChance(coinInput = 1, rollCountInput = 1) {
        loadInventoryState();

        const inventory = extension_settings[extensionName].inventory;
        const cost = Math.max(1, Math.floor(Number(coinInput || 1)));
        const rollCount = Math.max(1, Math.floor(Number(rollCountInput || 1)));
        const availableCoins = Number(inventory.monocoins || 0);
        const totalCost = cost * rollCount;
        const affordableRolls = Math.floor(availableCoins / cost);
        const affordableLoadMax = Math.floor(availableCoins / rollCount);
        const weighted = buildWeightedGiftPool(inventory, getDuplicatePenalty(cost));
        const totalWeight = weighted.reduce((acc, entry) => acc + entry.weight, 0);

        if (totalWeight <= 0) {
            return {
                ok: false,
                reason: "NO GIFTS REGISTERED IN CATALOG.",
                availableCoins,
                cost,
                rollCount,
                totalCost,
                chancePercent: 0,
                affordable: availableCoins >= totalCost,
                affordableRolls,
                affordableLoadMax,
            };
        }

        const dupeWeight = weighted
            .filter(entry => entry.isDupeCandidate)
            .reduce((acc, entry) => acc + entry.weight, 0);

        return {
            ok: true,
            availableCoins,
            cost,
            rollCount,
            totalCost,
            affordable: availableCoins >= totalCost,
            affordableRolls,
            affordableLoadMax,
            chancePercent: Math.max(0, Math.min(100, (dupeWeight / totalWeight) * 100)),
        };
    }

    function spinMonoMonoMachine(coinInput = 1, rollCountInput = 1) {
        loadInventoryState();

        const inventory = extension_settings[extensionName].inventory;
        const cost = Math.max(1, Math.floor(Number(coinInput || 1)));
        const rollCount = Math.max(1, Math.floor(Number(rollCountInput || 1)));
        const totalCost = cost * rollCount;
        const availableCoins = Number(inventory.monocoins || 0);

        if (availableCoins < totalCost) {
            return { ok: false, reason: "NOT ENOUGH MONOCOINS." };
        }

        const results = [];
        let duplicateCount = 0;
        let lastWon = null;

        for (let i = 0; i < rollCount; i++) {
            const weighted = buildWeightedGiftPool(inventory, getDuplicatePenalty(cost));
            if (!weighted.length) {
                return { ok: false, reason: "NO GIFTS REGISTERED IN CATALOG." };
            }

            const won = weightedPick(weighted);
            if (!won) {
                return { ok: false, reason: "MACHINE JAMMED. TRY AGAIN." };
            }

            const preOwned = Number(inventory.gifts[won.id] || 0) > 0;
            if (preOwned) duplicateCount += 1;
            inventory.gifts[won.id] = Number(inventory.gifts[won.id] || 0) + 1;
            results.push({ item: won, duplicate: preOwned });
            lastWon = won;
        }

        inventory.monocoins = Math.max(0, availableCoins - totalCost);
        selectedItemId = lastWon?.id || null;

        saveSettingsDebounced();
        renderSkillsItemsPanel();

        return {
            ok: true,
            cost: totalCost,
            costPerRoll: cost,
            rollCount,
            duplicate: !!results[0]?.duplicate,
            duplicateCount,
            result: results[0]?.item || null,
            resultLast: lastWon,
            results,
        };
    }

    function runMonoMonoMachine(coinInput = 1, rollCount = 1) {
        return spinMonoMonoMachine(coinInput, rollCount);
    }

    function renderItemDetails(item) {
        const $detail = $("#items-detail-panel");
        if (!$detail.length) return;

        if (!item) {
            $detail.removeAttr("data-rarity");
            $detail.html(`
                <div class="items-panel-title">SELECTED ITEM</div>
                <div class="items-detail-placeholder">SELECT AN ITEM SLOT TO LOAD TERMINAL READOUT</div>
            `);
            return;
        }

        const showDiscardGift = item.category === "gift";
        const isSkill = item.category === "skill";
        const isCustomKey = item.custom === true;
        const showImage = !isSkill;

        $detail.attr("data-rarity", isSkill ? "skill" : (item.rarity || ""));
        const skillPointCost = isSkill ? getSkillPointCost(item.id) : 0;
        const skillPoints = Number(extension_settings[extensionName].inventory?.skillPoints || 0);
        const equipped = isSkill ? isSkillEquipped(item.id) : false;
        const canEquip = isSkill && !equipped && skillPoints >= skillPointCost;
        const categoryLine = isSkill
            ? `CATEGORY: ${formatCategoryLabel(item.category)} · COST: ${skillPointCost} SP · AVAILABLE: ${skillPoints} SP`
            : `CATEGORY: ${formatCategoryLabel(item.category)} · RARITY: ${item.rarity}`;

        const itemImage = showImage
            ? (extension_settings[extensionName].inventory?.itemImages?.[item.id] || null)
            : null;

        const imageBlockHtml = showImage ? `
            <div class="items-detail-img-wrap">
                <div class="items-detail-img-inner">
                    ${itemImage
                        ? `<img class="items-detail-img" src="${itemImage}" alt="">`
                        : ``}
                </div>
            </div>
            <div class="items-detail-img-actions">
                <label class="items-detail-img-upload-btn">
                    ${itemImage ? "REPLACE IMAGE" : "ADD IMAGE"}
                    <input type="file" accept="image/*" class="items-detail-img-input" style="display:none">
                </label>
                ${itemImage ? `<button type="button" class="items-detail-img-remove-btn">REMOVE IMAGE</button>` : ""}
            </div>
        ` : ``;

        $detail.html(`
            <div class="items-panel-title">SELECTED ITEM</div>
            ${imageBlockHtml}
            <div class="items-detail-name">${item.name.toUpperCase()}</div>
            <div class="items-detail-category">${categoryLine}</div>

            <div class="items-detail-section-label">DESCRIPTION</div>
            <div class="items-detail-description">${item.description}</div>

            <div class="items-detail-actions">
                ${isSkill
                    ? `<div class="items-detail-actions-row"><button class="items-detail-action" data-action="equip-skill" ${equipped || canEquip ? '' : 'disabled'}>${equipped ? 'UNEQUIP' : 'EQUIP'}</button><button class="items-detail-action discard" data-action="forget-skill">FORGET</button></div>`
                    : isCustomKey
                        ? `<div class="items-detail-actions-row"><button class="items-detail-action discard" data-action="remove-key-item">REMOVE</button></div>`
                        : `<div class="items-detail-actions-row"><button class="items-detail-action" data-action="use-item" ${showDiscardGift ? '' : 'disabled'}>USE</button><button class="items-detail-action" disabled>INSPECT</button></div>`}
                ${showDiscardGift ? `<div class="items-detail-actions-row"><button class="items-detail-action discard" data-action="discard-gift">DISCARD GIFT</button><button class="items-detail-action discard" data-action="discard-rarity">MASS DISCARD ${item.rarity}</button></div>` : ""}
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

        if (isSkill) {
            $detail.find('[data-action="equip-skill"]').on("click", () => {
                playSfx(getSfx().click);
                const changed = equipped ? unequipSkill(item.id) : equipSkill(item.id);
                if (!changed) return;
                renderSkillsItemsPanel();
            });

            $detail.find('[data-action="forget-skill"]').on("click", () => {
                playSfx(getSfx().click);
                const forgotten = forgetSkill(item.id);
                if (!forgotten) return;
                selectedItemId = null;
                renderSkillsItemsPanel();
            });
        }

        if (isCustomKey) {
            $detail.find('[data-action="remove-key-item"]').on("click", () => {
                playSfx(getSfx().click);
                removeCustomKeyItem(item.id);
                selectedItemId = null;
                renderSkillsItemsPanel();
            });
        }

        if (showImage) {
            $detail.find(".items-detail-img-input").on("change", function () {
                const file = this.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = e => {
                    saveItemImage(item.id, e.target.result);
                    renderItemDetails(item);
                };
                reader.readAsDataURL(file);
            });

            $detail.find(".items-detail-img-remove-btn").on("click", () => {
                removeItemImage(item.id);
                renderItemDetails(item);
            });
        }
    }

    function createKeyItem(name, description) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        const id = "custom_key_" + Date.now();
        inv.customKeyItems[id] = { name: name.trim(), description: description.trim() };
        saveSettingsDebounced();
        return id;
    }

    function removeCustomKeyItem(id) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        if (!inv.customKeyItems?.[id]) return false;
        delete inv.customKeyItems[id];
        delete inv.itemImages?.[id];
        saveSettingsDebounced();
        return true;
    }

    function removeCustomGift(id) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        if (!inv.customGifts?.[id]) return false;
        delete inv.customGifts[id];
        delete inv.gifts?.[id];
        delete inv.itemImages?.[id];
        saveSettingsDebounced();
        return true;
    }

    function createCustomGift(name, rarity, description, imageBase64) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        const id = "custom_gift_" + Date.now();
        inv.customGifts[id] = { name: name.trim(), rarity: rarity || "N", description: description?.trim() || "" };
        if (imageBase64) inv.itemImages[id] = imageBase64;
        saveSettingsDebounced();
        return id;
    }

    function saveItemImage(itemId, base64) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        inv.itemImages ||= {};
        inv.itemImages[itemId] = base64;
        saveSettingsDebounced();
    }

    function removeItemImage(itemId) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        if (inv.itemImages) delete inv.itemImages[itemId];
        saveSettingsDebounced();
    }

    function renderCreateKeyItemForm() {
        const $detail = $("#items-detail-panel");
        if (!$detail.length) return;

        $detail.html(`
            <div class="items-panel-title">CREATE KEY ITEM</div>
            <div class="items-detail-section-label">NAME</div>
            <input class="items-create-input" type="text" id="items-create-key-name" placeholder="ITEM NAME" maxlength="60" autocomplete="off" />
            <div class="items-detail-section-label">DESCRIPTION</div>
            <textarea class="items-create-input items-create-textarea" id="items-create-key-desc" placeholder="ITEM DESCRIPTION" maxlength="280" rows="4"></textarea>
            <div class="items-detail-actions">
                <button class="items-detail-action" id="items-create-key-submit" type="button">CREATE</button>
                <button class="items-detail-action discard" id="items-create-key-cancel" type="button">CANCEL</button>
            </div>
            <div class="items-create-key-status" id="items-create-key-status"></div>
        `);

        $detail.find("#items-create-key-submit").on("click", () => {
            const name = $detail.find("#items-create-key-name").val().trim();
            const desc = $detail.find("#items-create-key-desc").val().trim();
            if (!name) {
                $detail.find("#items-create-key-status").text("NAME IS REQUIRED.");
                return;
            }
            playSfx(getSfx().click);
            const id = createKeyItem(name, desc);
            selectedItemId = id;
            renderSkillsItemsPanel();
        });

        $detail.find("#items-create-key-cancel").on("click", () => {
            playSfx(getSfx().click);
            renderItemDetails(null);
        });
    }

    function bindCreateKeyItemButton() {
        const $button = $("#items-create-key-item-button");
        if (!$button.length) return;

        $button.off("click").on("click", () => {
            playSfx(getSfx().click);
            renderCreateKeyItemForm();
        });
    }

    function renderInventoryGrid() {
        const $grid = $("#items-gift-list");
        if (!$grid.length) return;

        let items = getOwnedItems();
        if (itemSearchQuery) {
            const q = itemSearchQuery.toLowerCase();
            items = items.filter(i => i.name.toLowerCase().includes(q));
        }
        $grid.empty();

        if (!items.length) {
            $grid.append('<div class="items-empty">NO ITEMS IN THIS FILTER</div>');
            renderItemDetails(null);
            return;
        }

        if (!selectedItemId || !items.some(i => i.id === selectedItemId)) {
            selectedItemId = items[0].id;
        }

        const appendSlot = (item) => {
            const active = item.id === selectedItemId ? "active" : "";
            const $slot = $(`
                <button class="items-slot ${active}" data-item-id="${item.id}" data-item-category="${item.category}" data-item-rarity="${item.rarity}" title="${item.name}">
                    <span class="items-slot-icon">■</span>
                    <span class="items-slot-name">${item.name.toUpperCase()}</span>
                    <span class="items-slot-qty">x${item.quantity}</span>
                </button>
            `);

            $slot.on("click", () => {
                playSfx(getSfx().click);
                selectedItemId = item.id;
                renderInventoryGrid();
            });

            return $slot;
        };

        if (activeItemsFilter === "skill") {
            const equippedSkills = [];
            const unequippedSkills = [];

            items.forEach((item) => {
                if (isSkillEquipped(item.id)) {
                    equippedSkills.push(item);
                } else {
                    unequippedSkills.push(item);
                }
            });

            const $skillColumns = $('<div class="items-skill-columns"></div>');
            const $unequippedColumn = $('<div class="items-skill-column"><div class="items-skill-column-title">NOT EQUIPPED</div><div class="items-skill-column-grid"></div></div>');
            const $equippedColumn = $('<div class="items-skill-column"><div class="items-skill-column-title">EQUIPPED</div><div class="items-skill-column-grid"></div></div>');

            const $unequippedGrid = $unequippedColumn.find('.items-skill-column-grid');
            const $equippedGrid = $equippedColumn.find('.items-skill-column-grid');

            if (!unequippedSkills.length) {
                $unequippedGrid.append('<div class="items-empty">NO UNEQUIPPED SKILLS</div>');
            } else {
                unequippedSkills.forEach(item => $unequippedGrid.append(appendSlot(item)));
            }

            if (!equippedSkills.length) {
                $equippedGrid.append('<div class="items-empty">NO EQUIPPED SKILLS</div>');
            } else {
                equippedSkills.forEach(item => $equippedGrid.append(appendSlot(item)));
            }

            $skillColumns.append($unequippedColumn, $equippedColumn);
            $grid.append($skillColumns);
        } else {
            items.forEach(item => {
                $grid.append(appendSlot(item));
            });
        }

        renderItemDetails(items.find(i => i.id === selectedItemId) || items[0]);
    }

    function renderSkillsItemsPanel() {
        const $panel = $(`.monopad-panel-content[data-panel="skills"]`);
        if (!$panel.length) return;

        const monocoins = Number(extension_settings[extensionName].inventory?.monocoins || 0);
        const trustFragments = Number(extension_settings[extensionName].inventory?.trustFragments || 0);
        const skillPoints = Number(extension_settings[extensionName].inventory?.skillPoints || 0);
        const showSkillShop = activeItemsFilter === "skill";
        const showCreateKeyItem = activeItemsFilter === "key";

        $("#items-monocoin-value").text(monocoins.toLocaleString());
        $("#items-trust-fragment-value").text(trustFragments.toLocaleString());
        $("#items-skill-point-value").text(skillPoints.toLocaleString());
        bindSkillShopButton();
        bindCreateKeyItemButton();

        const $skillShopRow = $panel.find("#items-skill-shop-row");
        if ($skillShopRow.length) {
            $skillShopRow.prop("hidden", !showSkillShop);
        }

        const $createKeyItemRow = $panel.find("#items-create-key-item-row");
        if ($createKeyItemRow.length) {
            $createKeyItemRow.prop("hidden", !showCreateKeyItem);
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
    }

    function setFilter(filter = "all") {
        activeItemsFilter = filter;
        itemSearchQuery = "";
        $("#items-search-input").val("");
    }

    function setItemSearch(query = "") {
        itemSearchQuery = query.trim();
        selectedItemId = null;
    }

    function setSort(sort = "recent") {
        activeItemsSort = sort;
    }


    function getSkillShopListings() {
        const inventory = extension_settings[extensionName].inventory || {};
        const trustFragments = Number(inventory.trustFragments || 0);

        return placeholderSkillShopCatalog.map(skill => ({
            ...skill,
            available: trustFragments >= skill.cost,
            owned: Number(inventory.skills?.[skill.id] || 0) > 0,
            skillPointCost: Number(skill.skillPointCost || 0),
            futureEffectHook: skill.teaserEffect,
        }));
    }

    function buySkillFromShop(skillId) {
        loadInventoryState();

        const skill = placeholderSkillShopCatalog.find(entry => entry.id === skillId);
        if (!skill) return false;

        const inventory = extension_settings[extensionName].inventory;
        const owned = Number(inventory.skills?.[skill.id] || 0);
        if (owned > 0) return false;

        const trustFragments = Number(inventory.trustFragments || 0);
        if (trustFragments < skill.cost) return false;

        inventory.trustFragments = trustFragments - skill.cost;
        inventory.skills[skill.id] = 1;

        saveSettingsDebounced();
        return true;
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
                        <div class="items-shop-entry-effect">EQUIP COST: ${skill.skillPointCost} SP</div>
                    </div>
                    <div class="items-shop-entry-meta">
                        <div class="items-shop-entry-cost">◈ x${skill.cost} TRUST FRAGMENT</div>
                        <button class="items-shop-entry-buy" type="button" ${skill.owned || !skill.available ? "disabled" : ""}>${skill.owned ? "OWNED" : "BUY"}</button>
                    </div>
                </div>
            `)
            .join("");

        $detail.html(`
            <div class="items-panel-title">SKILL SHOP</div>
            <div class="items-shop-placeholder-title">TRUST FRAGMENT EXCHANGE</div>
            <div class="items-shop-placeholder-copy">SELECT A SKILL TO PURCHASE WITH TRUST FRAGMENTS. THESE SKILLS CAN BE OWNED NOW AND THEIR EFFECTS WILL EXPAND OVER TIME.</div>
            <div class="items-shop-list">${skillRows}</div>
        `);

        $detail.find(".items-shop-entry-buy").on("click", (evt) => {
            const skillId = evt.currentTarget.closest(".items-shop-entry")?.dataset.shopSkillId;
            if (!skillId) return;

            const purchased = buySkillFromShop(skillId);
            if (!purchased) return;

            playSfx(getSfx().click);
            renderSkillsItemsPanel();
            renderSkillShopDetails();
        });
    }

    function bindSkillShopButton() {
        const $button = $("#items-skill-shop-button");
        if (!$button.length) return;

        $button.off("click").on("click", () => {
            playSfx(getSfx().click);
            renderSkillShopDetails();
        });
    }



    function getTrialSkillEntries() {
        loadInventoryState();
        const inventory = extension_settings[extensionName].inventory || {};
        const skillPoints = Number(inventory.skillPoints || 0);

        const ownedSkills = itemCatalog
            .filter(item => item.category === "skill" && Number(inventory.skills?.[item.id] || 0) > 0)
            .map(item => ({
                id: item.id,
                name: item.name,
                rarity: item.rarity,
                effect: item.effect,
                equipped: isSkillEquipped(item.id),
                skillPointCost: getSkillPointCost(item.id),
            }))
            .sort((a, b) => Number(b.equipped) - Number(a.equipped) || rarityScore(b.rarity) - rarityScore(a.rarity) || a.name.localeCompare(b.name));

        return { skillPoints, skills: ownedSkills };
    }

    function toggleTrialSkillEquip(skillId) {
        if (!skillId) return { changed: false, reason: "invalid_skill" };

        const equipped = isSkillEquipped(skillId);
        const changed = equipped ? unequipSkill(skillId) : equipSkill(skillId);
        if (!changed) {
            return {
                changed: false,
                reason: equipped ? "unequip_failed" : "equip_failed",
                snapshot: getTrialSkillEntries(),
            };
        }

        return {
            changed: true,
            equipped: !equipped,
            snapshot: getTrialSkillEntries(),
        };
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
            },
            setSkillPoints(value = 10) {
                loadInventoryState();
                extension_settings[extensionName].inventory.skillPoints = Math.max(0, Number(value || 0));
                saveSettingsDebounced();
                renderSkillsItemsPanel();
            },
            resetGifts() {
                loadInventoryState();
                extension_settings[extensionName].inventory.gifts = {};
                saveSettingsDebounced();
                renderSkillsItemsPanel();
                return true;
            },
            giveAllGifts() {
                loadInventoryState();
                const inv = extension_settings[extensionName].inventory;
                const pool = getGiftPool();
                for (const item of pool) {
                    if (!Number(inv.gifts[item.id] || 0)) inv.gifts[item.id] = 1;
                }
                saveSettingsDebounced();
                renderSkillsItemsPanel();
                return pool.length;
            }
        };
    }


    function rollMonoMonoMachine(coinInput = 1, rollCount = 1) {
        const cost = Math.max(1, Math.floor(Number(coinInput || 1)));
        const rolls = Math.max(1, Math.floor(Number(rollCount || 1)));
        const run = spinMonoMonoMachine(cost, rolls);
        if (!run.ok) return run;

        if (rolls > 1) {
            return {
                ...run,
                message: `SPENT ${run.cost} COINS · ${run.duplicateCount} DUPE${run.duplicateCount === 1 ? '' : 'S'} · ${run.rollCount} ROLLS COMPLETE`
            };
        }

        return {
            ...run,
            message: `SPENT ${run.cost} COIN${run.cost === 1 ? '' : 'S'} · ${run.duplicate ? 'DUPE' : 'NEW'}: ${run.result.name.toUpperCase()}`
        };
    }

    return {
        bindWindowApi,
        loadInventoryState,
        renderSkillsItemsPanel,
        setFilter,
        setSort,
        setItemSearch,
        renderInventoryGrid,
        rollMonoMonoMachine,
        getMonoMonoDupeChance,
        spinMonoMonoMachine,
        getTrialSkillEntries,
        toggleTrialSkillEquip,
        getGiftPoolWithCounts,
        createCustomGift,
        removeCustomGift,
    };
}
