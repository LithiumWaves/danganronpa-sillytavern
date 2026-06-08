const itemCatalog = [
    { id: "g_mineral_water", name: "Carbonated Water", category: "gift", rarity: "N", description: "Drawn from the ocean depths and rigorously purified and carbonated. Ideal for a modern on-the-go public unsatisfied with tap water.", effect: "A modest but welcome gesture." },
    { id: "g_cola_cola", name: "Cola Cola", category: "gift", rarity: "N", description: "Contains a highly stimulating almost addictive sweetness. Pair it with some nice junk food for a can't-miss combo.", effect: "Perks up the mood slightly." },
    { id: "g_civet_coffee", name: "Civet Coffee", category: "gift", rarity: "R", description: "Made from an extremely rare and expensive coffee bean collected from the dung of the Asian palm civet. It has a unique fragrance...", effect: "A refined taste that impresses the discerning." },
    { id: "g_rose_hip_tea", name: "Rose Hip Tea", category: "gift", rarity: "R", description: "An herbal tea said to promote beauty and wellness. You can somehow sense its essential elegance...", effect: "Raises composure and rapport in refined company." },
    { id: "g_sea_salt", name: "Sea Salt", category: "gift", rarity: "N", description: "A basic seasoning produced from the evaporation of seawater. It also sees use as a preservative.", effect: "A humble gift with no particular appeal." },
    { id: "g_potato_chips", name: "Leighs Chips", category: "gift", rarity: "N", description: "A staple snack food made by frying thick potato slices in oil. Beware its dangerously high calorie count.", effect: "A reliable crowd-pleaser among snack enthusiasts." },
    { id: "g_prismatic_hardtack", name: "Prismatic Hardtack", category: "gift", rarity: "N", description: "A tough, long-lasting cracker used mainly as an emergency ration. Each piece contains a full seven different flavors.", effect: "Boosts spirits in tough situations." },
    { id: "g_black_croissant", name: "Black Croissant", category: "gift", rarity: "N", description: "A baked good made from black ingredients. It looks burnt, but it's actually pretty good.", effect: "Surprises with hidden appeal." },
    { id: "g_sonic_cup_a_noodle", name: "Sonic Cup-a-Noodle", category: "gift", rarity: "N", description: "Instant noodles. Fill it with boiling water and it's ready in 3 seconds. Of course, it also goes bad in like 30...", effect: "Quick comfort for the hungry and impatient." },
    { id: "g_royal_curry", name: "Royal Curry", category: "gift", rarity: "N", description: "A curry pack made for kids. It's made with expensive, high-quality ingredients you wouldn't expect from a kid's food.", effect: "A surprisingly lavish taste that catches people off guard." },
    { id: "g_ration", name: "Ration", category: "gift", rarity: "N", description: "A set of canned and vacuum-sealed foodstuffs. The taste isn't bad, and certain snakes that enjoy hide-and-go-seek are just crazy about it.", effect: "Practical, if nothing else." },
    { id: "g_flotation_donut", name: "Flotation Donut", category: "gift", rarity: "N", description: "A gigantic donut that doubles as a flotation device. And naturally, you can snack on it while floating out to sea. It comes in a variety of styles.", effect: "Delights the sporty and the sweet-toothed alike." },
    { id: "g_overflowing_lunch_box", name: "Overflowing Lunch Box", category: "gift", rarity: "N", description: "A lunch box stuffed with rice, ginger, carrots, peppers, mushrooms, and more. It's meat-free, so you vegetarians out there are covered, too.", effect: "A hearty gift that warms the stomach." },
    { id: "g_sunflower_seeds", name: "Sunflower Seeds", category: "gift", rarity: "N", description: "The seeds of that particular flower that loves facing the sun. They have a flavor somewhat similar to peanuts.", effect: "A simple snack with little sentimental value." },
    { id: "g_birdseed", name: "Birdseed", category: "gift", rarity: "N", description: "Sprinkle this around outside and watch the birds come flocking. There's nothing stopping you from eating it too, I suppose...", effect: "Appeals to the nature-minded." },
    { id: "g_kitten_hairclip", name: "Kitten Hairclip", category: "gift", rarity: "N", description: "A hairclip in the shape of a little kitty cat. Properly placed, it can make a girl positively sparkle.", effect: "Boosts warmth and approachability." },
    { id: "g_everlasting_bracelet", name: "Everlasting Bracelet", category: "gift", rarity: "R", description: "A handcrafted item made with needle and thread. They say that once you put it on, it will never come off again.", effect: "A token of lasting connection." },
    { id: "g_love_status_ring", name: "Love Status Ring", category: "gift", rarity: "R", description: "Wear it on your right hand, you're looking for love. On your left, you've found it. On both... well, that's just asking for catastrophe.", effect: "Sends an unmistakable message." },
    { id: "g_zoles_diamond", name: "Zoles Diamond", category: "gift", rarity: "R", description: "A brand-name diamond popularly used in engagement rings. Although... this one's just an imitation...", effect: "Impresses at first glance, less so on close inspection." },
    { id: "g_hopes_peak_ring", name: "Hope's Peak Ring", category: "gift", rarity: "SR", description: "A school ring emblazoned with the Hope's Peak Academy school crest. It stands as proof of friendship between those who spent their youth together.", effect: "Raises rapport with all students at Hope's Peak." },
    { id: "g_blueberry_perfume", name: "Blueberry Perfume", category: "gift", rarity: "R", description: "Very popular with men these days. But to be honest, although it does attract the ladies, most guys hate the smell...", effect: "A divisive but memorable impression." },
    { id: "g_scarab_brooch", name: "Scarab Brooch", category: "gift", rarity: "R", description: "The scarab was considered to be sacred by many ancient societies. It's better known today as... the dung beetle.", effect: "Appeals to the eccentric and the scholarly." },
    { id: "g_god_of_war_charm", name: "God of War Charm", category: "gift", rarity: "R", description: "A charm devised by the protective deity of martial arts, the Great and Gracious Kashima.", effect: "Bolsters resolve in physical and confrontational scenes." },
    { id: "g_macs_gloves", name: "Mac's Gloves", category: "gift", rarity: "R", description: "A pair of boxing gloves infused with a staggering amount of passion and effort. Wearing them makes you want to throw a thousand cross-counters.", effect: "Inspires fighting spirit in competitive exchanges." },
    { id: "g_glasses", name: "Glasses", category: "gift", rarity: "N", description: "They say that wearing these while performing incantations will help you better speak with the target of your spell.", effect: "Slightly improves focus during analytical conversations." },
    { id: "g_g_sick", name: "G-Sick", category: "gift", rarity: "N", description: "Most people consider it a 'throwaway watch' due to its poor quality. Still, it enjoys massive popularity thanks to its low price.", effect: "A fashionable trifle for the young and casual." },
    { id: "g_roller_slippers", name: "Roller Slippers", category: "gift", rarity: "N", description: "Slippers with a small wheel installed in each heel. They were invented to move easily around the house, but there is absolutely no demand for them.", effect: "Novelty value only." },
    { id: "g_red_scarf", name: "Red Scarf", category: "gift", rarity: "R", description: "A scarf belonging to a certain masked hero. It's tattered and worn due to the countless battles it's been through.", effect: "Inspires courage and camaraderie." },
    { id: "g_leaf_covering", name: "Leaf Covering", category: "gift", rarity: "N", description: "A loincloth meant to emphasize one's manliness. Its simple design features a single leaf overlaid on white cloth.", effect: "A bewildering gift of questionable appeal." },
    { id: "g_tornekos_pants", name: "Torneko's Pants", category: "gift", rarity: "N", description: "The latest style from premier Gothic Lolita fashion label, Wonder Dungeon.", effect: "Appreciated by those with eclectic fashion sense." },
    { id: "g_bunny_earmuffs", name: "Bunny Earmuffs", category: "gift", rarity: "N", description: "One of the most popular items from Gothic Lolita designer Ina Bauer.", effect: "Cute and comforting for the right recipient." },
    { id: "g_fresh_bindings", name: "Fresh Wrappings", category: "gift", rarity: "N", description: "Strips of cotton cloth. They were once commonly used for underwear and bandages. They say when you wrap it around yourself, both body and soul become taut.", effect: "Sharpens focus and discipline." },
    { id: "g_jimmy_decay_tshirt", name: "Jimmy Decay T-Shirt", category: "gift", rarity: "R", description: "A limited-edition shirt featuring legendary punk rocker Jimmy Decay. Only a hundred were ever made.", effect: "A rare find that earns instant respect from music fans." },
    { id: "g_emperors_thong", name: "Emperor's Thong", category: "gift", rarity: "N", description: "Designed solely for those in control of their buttocks. For better or worse, it's unisexual.", effect: "Provokes a strong reaction, one way or another." },
    { id: "g_hand_bra", name: "Hand Bra", category: "gift", rarity: "N", description: "A bra designed to slip over your hands. Its slogan? 'Raise your hands, raise your spirits!'", effect: "An unexpected item that bewilders most recipients." },
    { id: "g_waterlover", name: "Waterlover", category: "gift", rarity: "R", description: "A competition swimsuit for women. Its design concept is to 'become one with the water' and it claims to increase swimming speed by 10%.", effect: "A prized gift for serious swimmers." },
    { id: "g_demon_angel_princess_figure", name: "Demon Angel Princess Figure", category: "gift", rarity: "R", description: "A collectible figure of Princess Piggles, the popular heroine from 'Demon Angel Pretty Pudgy Princess'.", effect: "Treasured by fans of the series." },
    { id: "g_astral_boy_doll", name: "Astral Boy Doll", category: "gift", rarity: "N", description: "A figurine of the popular TV personality who hosted 'Lost in Forbidden Love Fantasy Outer Space'.", effect: "Brings a nostalgic smile to TV fans." },
    { id: "g_shears", name: "Shears", category: "gift", rarity: "N", description: "Since Hope's Peak Academy doesn't have a barber, the students are responsible for cutting their own hair.", effect: "Practically useful, if not sentimental." },
    { id: "g_layering_shears", name: "Layering Shears", category: "gift", rarity: "N", description: "A specialized set of scissors used to create advanced styling designs. Watch the edges!", effect: "Appreciated by those with an eye for style." },
    { id: "g_quality_chinchilla_cover", name: "Quality Chinchilla Cover", category: "gift", rarity: "R", description: "A dark red seat cover. Its refined design is intended for only the most elite clientele.", effect: "An ostentatious gift for those who demand the best." },
    { id: "g_kirlian_camera", name: "Kirlian Camera", category: "gift", rarity: "R", description: "A camera invented to take pictures of electrical fields surrounding objects. Sadly, there's no film in it...", effect: "Fascinates the curious and the supernatural-minded." },
    { id: "g_adorable_reactions_collection", name: "Adorable Reactions Collection", category: "gift", rarity: "N", description: "A DVD that contains footage of people reacting to various pieces of art.", effect: "A lighthearted gift for entertainment lovers." },
    { id: "g_tumbleweed", name: "Tumbleweed", category: "gift", rarity: "N", description: "A dried-out plant seen in many Western films. If they pile up around your yard, just toss 'em off a cliff or something.", effect: "Has essentially no effect whatsoever." },
    { id: "g_unending_dandelion", name: "Unending Dandelion", category: "gift", rarity: "N", description: "A dandelion toy. You can blow the fluff away, and the attached string will pull it back, so you can do it over and over and over and...", effect: "A charming novelty for the easily amused." },
    { id: "g_rose_in_vitro", name: "Rose in Vitro", category: "gift", rarity: "R", description: "A small rose stored inside a test tube. Makes a great gift. It's good for both hellos and farewells. In the language of flowers, a red rose means passionate love.", effect: "A deeply romantic gesture." },
    { id: "g_cherry_blossom_bouquet", name: "Cherry Blossom Bouquet", category: "gift", rarity: "R", description: "A collection of branches from a sakura tree. In the language of flowers, cherry blossoms represent 'a woman of superior beauty'.", effect: "Warmly received by nearly everyone." },
    { id: "g_rose_whip", name: "Rose Whip", category: "gift", rarity: "R", description: "A whip made from real roses. Even the most beautiful rose has thorns...", effect: "Appeals to those with a theatrical or dangerous edge." },
    { id: "g_zantetsuken", name: "Zantetsuken", category: "gift", rarity: "N", description: "A sword that can't even cut through iron. Or flesh. Or anything, really. In other words, totally useless...", effect: "Impresses no one, but makes a bold statement." },
    { id: "g_muramasa", name: "Muramasa", category: "gift", rarity: "R", description: "The strongest weapon ever made. It's great for dungeon diving and lets you warp through walls. Of course, it doesn't actually exist in this reality, so...", effect: "A legendary-sounding gift for gaming and mythology fans." },
    { id: "g_raygun_zurion", name: "Raygun Zurion", category: "gift", rarity: "R", description: "Created with hi-tech future technology. A single shot can melt every molecule in a fully grown human. There aren't any batteries, though, so you can't fire it...", effect: "Impresses sci-fi enthusiasts, if nothing else." },
    { id: "g_golden_gun", name: "Golden Gun", category: "gift", rarity: "SR", description: "A replica of the gun preferred by a famous assassin. It's not really much good by itself. You can't even cock it...", effect: "A stylish collector's piece for the elite." },
    { id: "g_berserker_armor", name: "Berserker Armor", category: "gift", rarity: "R", description: "Donning this armor bestows the wearer with immense power, but at the cost of their soul and senses.", effect: "Appeals to those drawn to dark power." },
    { id: "g_self_destructing_cassette", name: "Self-Destructing Cassette", category: "gift", rarity: "R", description: "Once you record a message onto this, it sets up a chemical reaction that will destroy the tape after a few seconds after it's played.", effect: "Perfect for secrets that must not be kept." },
    { id: "g_silent_receiver", name: "Silent Receiver", category: "gift", rarity: "N", description: "A phone that, for some unknown reason, doesn't let you hear the person on the other end, and doesn't let them hear you.", effect: "An oddly comforting device for the introverted." },
    { id: "g_pretty_hungry_caterpillar", name: "Pretty Hungry Caterpillar", category: "gift", rarity: "N", description: "A caterpillar toy that was all the rage years ago. As you pull it, it moves up and down, making it look alive.", effect: "A nostalgic toy for the childlike at heart." },
    { id: "g_old_timey_radio", name: "Ancient Radio", category: "gift", rarity: "N", description: "A radio with a retro exterior but state-of-the-art technology inside. Of course, there's no reception in the school, so you can't hear anything anyway.", effect: "An aesthetic piece with little practical use here." },
    { id: "g_mr_fastball", name: "Mr. Fastball", category: "gift", rarity: "N", description: "A baseball-shaped velocity measurement machine. Throw it to measure your speed. But, uh... don't throw it at the wall.", effect: "Appreciated by athletes and competitive types." },
    { id: "g_antique_doll", name: "Antique Doll", category: "gift", rarity: "R", description: "A porcelain doll. Due to the exquisite craftsmanship of the doll and its clothing, many people still collect and prize them to this very day.", effect: "A refined collector's gift." },
    { id: "g_crystal_skull", name: "Crystal Skull", category: "gift", rarity: "SR", description: "A skull carved from pure rock crystal. Some think skulls like this were created hundreds of years ago, perhaps with alien intervention, and consider them 'OOPArt'.", effect: "Captivates those fascinated by the mysterious and unexplained." },
    { id: "g_golden_airplane", name: "Golden Airplane", category: "gift", rarity: "SR", description: "A golden sculpture said to represent a plane or spaceship. It was found in ruins in Colombia dated to around 1,000 CE, indicating to some that this represents an 'OOPArt'.", effect: "A prized curiosity for OOPArt enthusiasts." },
    { id: "g_prince_shotokus_globe", name: "Prince Shotoku's Globe", category: "gift", rarity: "SR", description: "A spherical representation of Earth, about the size of a softball. Some believe it to be an 'OOPArt' since it depicts a round Earth, despite being many centuries old.", effect: "Impresses those who value ancient mysteries." },
    { id: "g_moon_rock", name: "Meteorite", category: "gift", rarity: "SR", description: "A rock taken from the Sea of Tranquility on the moon by the astronauts on Apollo 11. Its composition is apparently unusual for where it was found...", effect: "An extraordinary gift that leaves most speechless." },
    { id: "g_asuras_tears", name: "Asura's Tears", category: "gift", rarity: "SR", description: "A jewel treasured by an ancient super-race. 'Even the devil has friends. You..fool'. And then...tears flow.", effect: "Resonates deeply with those who understand loss." },
    { id: "g_secrets_of_the_omoplata", name: "Secrets of the Omoplata", category: "gift", rarity: "R", description: "A little-known book about Brazilian jiu-jitsu that teaches high-level shoulder lock techniques. 'Omoplata' is another word for the scapula, or shoulder blade.", effect: "A treasured find for martial arts specialists." },
    { id: "g_millennium_prize_problems", name: "Millennium Prize Problems", category: "gift", rarity: "SR", description: "These seven important mathematical problems were posted by the Clay Mathematics Institute, with a reward of one million dollars for each one solved.", effect: "Speaks directly to those who live for intellectual challenge." },
    { id: "g_the_funplane", name: "The Funplane", category: "gift", rarity: "R", description: "The newest popular portable game system. It has a hi-def touchscreen, and can also play music and videos, making for the perfect all-in-one media machine!", effect: "Universally liked by gamers and media fans." },
    { id: "g_project_zombie", name: "Project Zombie", category: "gift", rarity: "R", description: "A mature game designed for the Funplane, where a former runway model takes zombies as slaves in a post-apocalyptic world. It's been out of print for a while...", effect: "A rare find for fans of the genre." },
    { id: "g_pagan_dancer", name: "Pagan Dancer", category: "gift", rarity: "R", description: "A mature game designed for the Funplane, which allows you to become a massive god handing out divine punishment to puny mortals. Good luck finding a copy...", effect: "Appeals to those with a taste for power fantasies." },
    { id: "g_tips_and_tips", name: "Tips & Tips", category: "gift", rarity: "R", description: "A thick book that has hints and codes for every game ever released. A must-have for any true gaming fanatic.", effect: "An invaluable resource for dedicated gamers." },
    { id: "g_maidens_handbag", name: "Maiden's Handbag", category: "gift", rarity: "R", description: "Available only at the posh Maiden Road, which is geared toward female fanfic fans. Please, PLEASE take me with you next time you go!", effect: "A treasured item for fans of doujin culture." },
    { id: "g_kokeshi_go", name: "Kokeshi Go!", category: "gift", rarity: "N", description: "Flip the switch on the bottom to set the doll shaking. Apparently it's a kid's toy, but I don't really get the point of it...", effect: "Puzzling, yet oddly compelling." },
    { id: "g_the_second_button", name: "The Second Button", category: "gift", rarity: "N", description: "The button from a school uniform which increases in value as graduation approaches. In a few cases, reservations are necessary.", effect: "A sentimental token of youth." },
    { id: "g_someones_graduation_album", name: "Someone's Graduation Album", category: "gift", rarity: "N", description: "A Hope's Peak graduation album that someone left behind. The signature pages are all completely blank...", effect: "A melancholy memento with a mysterious emptiness." },
    { id: "g_vise", name: "Vise", category: "gift", rarity: "N", description: "A tool used to grip and stabilize materials (like metal) to shape and fix it. Somehow, just the name conveys a strong sense of power...", effect: "Useful in workshops; curious everywhere else." },
    { id: "g_sacred_tree_sprig", name: "Sacred Tree Sprig", category: "gift", rarity: "R", description: "The branch from a sakaki tree, commonly used in Shinto rituals. It serves as a connection between humans and the gods.", effect: "A spiritually significant gift for the faith-minded." },
    { id: "g_pumice", name: "Pumice", category: "gift", rarity: "N", description: "A porous rock formed during violent volcanic eruptions. Use it to scrape off all that old, dry skin on the body.", effect: "Practical self-care, if not exactly glamorous." },
    { id: "g_oblaat", name: "Oblaat", category: "gift", rarity: "N", description: "A thin, edible film made from starch. It's commonly used as a candy wrapper, but also helps cover up the taste of bitter medicine.", effect: "A thoughtful gift for those who struggle with medicine." },
    { id: "g_water_flute", name: "Water Flute", category: "gift", rarity: "N", description: "A unique type of flute. You pour water into the base and blow into the top, which can create a variety of sounds similar to a chirping bird.", effect: "A calming curiosity for music lovers." },
    { id: "g_bojoba_dolls", name: "Bojoba Dolls", category: "gift", rarity: "R", description: "Made from seeds and coconut fiber, these are used in Buddhist prayers. You determine your wish based on how you position the arms and legs.", effect: "A meaningful gift for the spiritually inclined." },
    { id: "g_small_light", name: "Small Light", category: "gift", rarity: "N", description: "Common wisdom might make you think that shining this light on you will turn you small... but nope. It's just that the light itself is about the size of a matchbox.", effect: "Amuses fans of a certain anime robot cat." },
    { id: "g_voice_changing_bowtie", name: "Voice-Changing Bowtie", category: "gift", rarity: "R", description: "This originally belonged to a detective who has the body of a child but the mind of a genius. The bowtie lets its user speak in a variety of voices.", effect: "Delights mystery fans with its iconic origins." },
    { id: "g_ancient_tour_tickets", name: "Ancient Tour Tickets", category: "gift", rarity: "N", description: "Two tickets that advertise 'a whirlwind tour of Mu with the Ancients for four days and three nights!'", effect: "For the adventurous, or the deeply gullible." },
    { id: "g_novelists_fountain_pen", name: "Novelist's Fountain Pen", category: "gift", rarity: "SR", description: "It once belonged to a late, great novelist. They say the writer's soul is sealed within the pen, and any user can only write one sentence: 'I have become something not human'.", effect: "Inspires and unsettles in equal measure." },
    { id: "g_if_fax", name: "\"If\" Fax", category: "gift", rarity: "N", description: "Used to distribute a full-length novel based on what the world would look like if all of someone's dreams came true.", effect: "A whimsical device for dreamers." },
    { id: "g_cat_dog_magazine", name: "Cat-Dog Magazine", category: "gift", rarity: "N", description: "You might think it has to do with pets, but it's more related to... beds. It's a guide for junior high and high school students to help with their... um... physical health.", effect: "Received with mixed reactions depending on the recipient." },
    { id: "g_meteorite_arrowhead", name: "Meteorite Arrowhead", category: "gift", rarity: "SR", description: "An arrowhead discovered in some ancient ruins. Fashioned from a meteorite, they say that getting pierced by it will give you the power to see demons.", effect: "Captivates those drawn to the occult and the cosmic." },
    { id: "g_chin_drill", name: "Chin Drill", category: "gift", rarity: "R", description: "A fashion accessory that allows you to equip a drill on your chin. It is said to represent the idea of 'spiral energy'.", effect: "Pierce the heavens — or at least look like you're trying." },
    { id: "g_green_costume", name: "Green Costume", category: "gift", rarity: "N", description: "As soon as you put this on, you'll feel like you can take on any challenge. It resembles a stereotypical dinosaur.", effect: "Boosts confidence in a ridiculous but effective way." },
    { id: "g_red_costume", name: "Red Costume", category: "gift", rarity: "N", description: "Jump into this, and you'll feel like you can support the world. It resembles some kind of yeti creature...", effect: "Inspires a sense of invincibility, costume notwithstanding." },
    { id: "g_mans_fantasy", name: "A Man's Fantasy", category: "gift", rarity: "SR", description: "A wash basin intended to give you the courage to seek out a true man's fantasy. Specifically, in public bathhouses...", effect: "Cozy." },
    { id: "g_escape_button", name: "Escape Button", category: "gift", rarity: "SR", description: "This button supposedly leads to an escape... Is it for you..? Or something else..?", effect: "How curious." },
    { id: "g_school_crest", name: "School Crest", category: "gift", rarity: "SR", description: "A patch that displays the Hope's Peak Academy school crest.", effect: "A keepsake marking the very first step." },
    { id: "g_despair_bat", name: "Despair Bat", category: "gift", rarity: "SR", description: "The name really doesn't sound pleasant. Feels like it's hit thousands of baseballs.", effect: "A reliable bat for an unreliable batter." },
    { id: "g_crazy_diamond", name: "Crazy Diamond", category: "gift", rarity: "SR", description: "An old delinquent's trenchcoat, which has the name of the country's greatest biker gang leader embroidered on it.", effect: "Shine on." },
    { id: "g_super_robo_justice", name: "Super Robo Justice", category: "gift", rarity: "SR", description: "A home-made cosplay outfit of a popular mecha anime character, but the quality is so high, it's hard to imagine it was made solely with materials in the school.", effect: "Beep boop." },
    { id: "g_alter_lump", name: "Alter Lump", category: "gift", rarity: "SR", description: "A dark ball that hums with an electric current. Feels ominous.", effect: "Crushed Hope. Crushed Dream." },
    { id: "g_dream_island_rocket", name: "Dream Island Rocket", category: "gift", rarity: "SR", description: "It was once abandoned on Dream Island. It feels strangely familiar...", effect: "Fly me to the moon..." },
    { id: "g_monokuma_hairties", name: "Monokuma Hairties", category: "gift", rarity: "SR", description: "A despairful reminder of hopelessness. They're decorated with twin bear figures.", effect: "Upupupu~" },
    { id: "g_easter_egg", name: "Black Egg", category: "gift", rarity: "SR", description: "Is it a symbol of hope, or of despair...?", effect: "It rumbles with a bizarre warmth." },

    // ── DR2: Goodbye Despair ─────────────────────────────────────────────────
    { id: "dr2_mineral_water", name: "Mineral Water", category: "gift", rarity: "N", description: "Drawn from the ocean depths and rigorously purified. Ideal for a modern on-the-go public unsatisfied with tap water.", effect: "A modest, refreshing gesture." },
    { id: "dr2_ramune", name: "Ramune", category: "gift", rarity: "N", description: "A sweet, lemon-flavored carbonated drink. A marble plugs the opening of the uniquely designed bottle. The bottle can also be reused if you bring it to the ramune store.", effect: "The nostalgic pop of the marble stopper brightens the mood." },
    { id: "dr2_coconut_juice", name: "Coconut Juice", category: "gift", rarity: "N", description: "A colorless, transparent juice found inside coconuts. The sweet taste is considered refreshing.", effect: "Cool and refreshing — a taste of the island." },
    { id: "dr2_blue_ram", name: "Blue Ram", category: "gift", rarity: "N", description: "A famous anti-energy drink that will make you feel very relaxed after drinking it. Became a huge hit through its marketing slogan, \"Blue Ram Clips Your Wing\".", effect: "Paradoxically relaxing. Clips your wings right back." },
    { id: "dr2_civet_coffee", name: "Cappuccino", category: "gift", rarity: "R", description: "Made from an extremely rare and expensive coffee bean collected from the dung of the Asian palm civet. It has a unique fragrance...", effect: "A refined, rare taste that impresses the discerning." },
    { id: "dr2_cinnamon_tea", name: "Cinnamon Tea", category: "gift", rarity: "N", description: "Black tea infused with cinnamon sticks. It is said to be effective for warming your body and maintaining proper digestion.", effect: "Warming and soothing for the body." },
    { id: "dr2_non_alcoholic_wine", name: "Non-Alcoholic Wine", category: "gift", rarity: "N", description: "A refreshing drink that contains no alcohol. It tastes more like sour grape juice than actual wine.", effect: "The taste of sophistication, without the consequences." },
    { id: "dr2_prepackaged_orzotto", name: "Prepackaged Orzotto", category: "gift", rarity: "N", description: "A dish made of boiled pearl barley. It's very nutritious and high in fiber. It also tastes good with beef tongue.", effect: "Nutritious and appreciated by those who work hard." },
    { id: "dr2_chocolate_chip_jerky", name: "Chocolate Chip Jerky", category: "gift", rarity: "R", description: "Dried beef sprinkled with chocolate chips. A preserved meat product invented by an experimental cook. There's no guarantee this will actually taste good.", effect: "An experimental snack that polarizes anyone who tries it." },
    { id: "dr2_cod_roe_baguette", name: "Cod Roe Baguette", category: "gift", rarity: "N", description: "This thin loaf of bread is stuffed to the brim with butter and crushed cod roe. A perfect fusion of French and Japanese cuisine.", effect: "A bold fusion that impresses adventurous eaters." },
    { id: "dr2_gugelhupf_cake", name: "Gugelhupf Cake", category: "gift", rarity: "R", description: "This cake is said to be a favorite of Marie Antoinette. Its name is German for \"priest's hat\".", effect: "Fit for royalty — appreciated by those with refined taste." },
    { id: "dr2_hardtack_of_hope", name: "Hardtack of Hope", category: "gift", rarity: "N", description: "Emergency ration that excels at maintaining its freshness. They are often given to students as an emergency food source in case of natural disasters.", effect: "Emergency rations that convey quiet reliability." },
    { id: "dr2_sweet_bun_bag", name: "Sweet Bun Bag", category: "gift", rarity: "N", description: "Filled with a variety of sweet breads, including melon and peanut butter flavors. The bag has a logo of Hansel & Gretel.", effect: "A cheerful assortment that brings simple joy." },
    { id: "dr2_potato_chips", name: "Potato Chips", category: "gift", rarity: "N", description: "A staple snack food made by frying thin potato slices in oil. Beware its dangerously high calorie count. Many men have lost everything after betting they could only eat just one.", effect: "A reliable crowd-pleaser among snack enthusiasts." },
    { id: "dr2_viva_ice", name: "Viva Ice", category: "gift", rarity: "N", description: "This strawberry-flavored shaved ice treat comes with a spoon containing lottery numbers. If your numbers win, you receive more shaved ice.", effect: "A sweet summer treat with a lucky surprise inside." },
    { id: "dr2_jabbas_natural_salt", name: "Jabba's Natural Salt", category: "gift", rarity: "N", description: "A natural salt found on Jabberwock Island. Though it's commonly used to cook various island dishes, apparently it's also used for strange ceremonial rituals by the local natives.", effect: "A local treasure with ceremonial significance." },
    { id: "dr2_cocoshimi", name: "Cocoshimi", category: "gift", rarity: "N", description: "The pulpy white insides of a coconut. If you eat it with soy sauce and wasabi, it tastes just like sashimi.", effect: "An acquired island taste that surprises the palate." },
    { id: "dr2_sunflower_seeds", name: "Sunflower Snack", category: "gift", rarity: "N", description: "The seeds of that particular flower that loves facing the sun. They have a flavor somewhat similar to peanuts. The flower itself represents the sun's watchful eyes.", effect: "The flower of the sun — a thoughtful, natural gift." },
    { id: "dr2_coconut", name: "Coconut", category: "gift", rarity: "N", description: "The hard-shelled fruit from a coconut tree. Not only is it edible, it can also be used for several purposes, such as crafting musical instruments.", effect: "Versatile and filling — a gift from the island itself." },
    { id: "dr2_iroha_tshirt", name: "Iroha T-Shirt", category: "gift", rarity: "N", description: "A regular t-shirt emblazoned with a cluttered poem. \"Though the flower is gone, its scent lingers. Who in this world is truly unchanging?\"", effect: "A wearable meditation on impermanence." },
    { id: "dr2_brightly_colored_jeans", name: "Brightly Colored Jeans", category: "gift", rarity: "N", description: "The frayed jean pants of a detective who roared at the sun in the name of justice. They're not jeans, they're jean pants.", effect: "Fashion with fighting spirit built in." },
    { id: "dr2_apron_dress", name: "Apron Dress", category: "gift", rarity: "N", description: "A dress that resembles a maid's uniform. When you wear this, it might seem like you won't be able to defy your master, but in actuality, you'll be the one in control.", effect: "Deceptively domestic, genuinely powerful." },
    { id: "dr2_falkors_muffler", name: "Falkor's Muffler", category: "gift", rarity: "N", description: "A muffler crafted from the fur of a legendary luckdragon. It's sweltering hot to wear in the land of eternal summer.", effect: "Warm, legendary, and absolutely sweltering in this heat." },
    { id: "dr2_fresh_bindings", name: "Fresh Bindings", category: "gift", rarity: "N", description: "Strips of cotton cloth. They were once commonly used for underwear and bandages. They say when you wrap it around yourself, both body and soul become taut.", effect: "Sharpens focus and disciplines the wearer." },
    { id: "dr2_queens_straitjacket", name: "Queen's Straitjacket", category: "gift", rarity: "R", description: "This hand-binding garment was worn by the genius magician Queen Teruko during her escape magic performances. Apparently there are people who might enjoy being bound up.", effect: "For those who find freedom in restraint." },
    { id: "dr2_spy_spike", name: "Spy Spike", category: "gift", rarity: "N", description: "A spike that you can wield with swiftness and agility, just like a real spy. Also known as \"Spy-Spi\".", effect: "Agile, swift, and suspiciously stylish." },
    { id: "dr2_secret_boots", name: "Secret Boots", category: "gift", rarity: "N", description: "Boots that have raised soles, allowing the wearer to face their height.", effect: "What nobody can see still makes you taller." },
    { id: "dr2_safety_half_shoes", name: "Safety Half-Shoes", category: "gift", rarity: "N", description: "These shoes only cover your toes, but the iron plate in the tip keeps your toes safe.", effect: "Protects what matters most — at least half of it." },
    { id: "dr2_passionate_glasses", name: "Passionate Glasses", category: "gift", rarity: "N", description: "Glasses that let you see your passions as they blend with reality. They also have a function that lets you shoot your passion like a laser. (WARNING: This laser *will* come out of your butt.)", effect: "Reveals your deepest desires. Hazardous side effects apply." },
    { id: "dr2_bvlbaris_gold", name: "Bvlbari's Gold", category: "gift", rarity: "R", description: "A popular, name-brand bracelet made of pure gold that's loved by both men and women. With its high-quality fashion sense and brightness, it increases the wearer's visibility by 10 percent.", effect: "Raises visibility and status among the fashionable." },
    { id: "dr2_earring_of_crushed_evil", name: "Earring of Crushed Evil", category: "gift", rarity: "R", description: "An earring created by the legendary home tutor. Crafted from silver and gold into the shape of a wing. The gold is said to increase luck, while the silver is said to accumulate luck.", effect: "Accumulates luck and repels misfortune." },
    { id: "dr2_silver_ring", name: "Silver Ring", category: "gift", rarity: "R", description: "A ring made from the purest silver with a natural pink tourmaline set into it. If you need to get a present for someone and have no idea, get them this.", effect: "A safe, beautiful choice when inspiration fails." },
    { id: "dr2_hopes_peak_ring", name: "Hope's Peak Graduate's Ring", category: "gift", rarity: "SR", description: "A school ring emblazoned with the Hope's Peak Academy crest. It stands as proof of friendship between those who spent their youth together.", effect: "Raises rapport with all students at Hope's Peak." },
    { id: "dr2_spectre_ring", name: "Spectre Ring", category: "gift", rarity: "R", description: "A blond earthling was wearing this ring when he was swept into our world from a distant galaxy. A very icy, lame joke is sealed within the ring.", effect: "A cosmic accessory with a terrible pun sealed inside." },
    { id: "dr2_cloth_wrap_backpack", name: "Cloth Wrap Backpack", category: "gift", rarity: "N", description: "A cloth wrap with a very fashionable design. Perfect for giving presents to modern girls and elders. Nothing you wrap with this will be sent forward or backward in time.", effect: "Stylish, practical, and temporally stable." },
    { id: "dr2_another_hope", name: "Another Hope", category: "gift", rarity: "SR", description: "This valuable diamond was created from the remaining fragments of the original Hope Diamond when it was cut long ago. Rumors persist that death follows anyone who has this item in their possession.", effect: "Legendary, beautiful, and allegedly cursed." },
    { id: "dr2_jabbaian_jewelry", name: "Jabbaian Jewelry", category: "gift", rarity: "R", description: "A pendant designed with a coconut tree motif. There's a custom on Jabberwock Island in which parents give this to their children so they can one day pass it down to their own kids.", effect: "A pendant that carries generations of island tradition." },
    { id: "dr2_biggest_fantom", name: "Biggest Fantom", category: "gift", rarity: "R", description: "An ancient fan that has been passed down since the Heian Period. Those who possess it will be able to speak with ghosts.", effect: "Allows communion with the spirits of the departed." },
    { id: "dr2_ubiquitous_handbook", name: "Ubiquitous Handbook", category: "gift", rarity: "N", description: "A perfectly designed handbook useful for documenting various events that occur throughout the day. It comes with a pen that can be easily stored inside.", effect: "Brings order to the chaos of daily life." },
    { id: "dr2_millennium_prize_problems", name: "Millennium Prize Problems 2nd Edition", category: "gift", rarity: "SR", description: "These seven important mathematical problems were posed by the Clay Mathematics Institute, with a reward of one million dollars for each one solved.", effect: "Speaks directly to those who live for intellectual challenge." },
    { id: "dr2_tips_and_tips_2nd", name: "Tips & Tips 2nd Edition", category: "gift", rarity: "R", description: "A thick book that has hints and codes for every game ever released. The 2nd Edition now includes tips for clearing even the most difficult levels. A must-have for any true gaming fanatic.", effect: "Even the hardest levels fall before this guide." },
    { id: "dr2_ogami_clan_codex", name: "Ogami Clan Codex", category: "gift", rarity: "R", description: "A book which documents the 708 Meridian Channel pressure points that exist throughout the human body. Those who master these points can become the Ultimate Masseuse.", effect: "Mastery of 708 pressure points — a priceless manual." },
    { id: "dr2_mens_manma", name: "Men's Manma", category: "gift", rarity: "N", description: "A magazine for gourmands that lists popular restaurants for all kinds of situations. The articles about recommended date spots are especially popular.", effect: "Maps out the best restaurants for every occasion." },
    { id: "dr2_kiss_note", name: "Kiss Note", category: "gift", rarity: "R", description: "A notebook considered to be a good luck charm. The human whose name is written in this notebook shall kiss you. The human who uses this notebook will lose their heart forever.", effect: "A romantic shortcut with a steep emotional price." },
    { id: "dr2_black_rabbit_picture_book", name: "Black Rabbit Picture Book", category: "gift", rarity: "R", description: "An introductory book for pulling various cons. The cover has a black rabbit on it to avoid attention. Apparently there is a white rabbit and red rabbit version of this book as well.", effect: "A covert guide to cons, wrapped in innocence." },
    { id: "dr2_25d_headphones", name: "2.5D Headphones", category: "gift", rarity: "R", description: "Headphones that provide a 2.5-dimensional sound quality. Every audiophile who used these said the same thing: \"These are hella psychopop.\"", effect: "A dimension beyond ordinary sound quality." },
    { id: "dr2_radiosonde", name: "Radiosonde", category: "gift", rarity: "N", description: "A meteorological instrument that measures the temperature, humidity, and barometric pressure by shooting a balloon into the sky.", effect: "Sends data skyward for those who study the weather." },
    { id: "dr2_male_cylinder", name: "Male Cylinder", category: "gift", rarity: "N", description: "A laboratory instrument with a masculine symbol on it. Organic synthesis is possible by combining this with the measuring flask.", effect: "One half of a potentially volatile chemical pair." },
    { id: "dr2_measuring_flask", name: "Measuring Flask", category: "gift", rarity: "N", description: "A laboratory instrument with a feminine symbol on it. Organic synthesis is possible when combined with the Male Cylinder.", effect: "The other half. Combination may yield unpredictable results." },
    { id: "dr2_razor_ramon_hg", name: "Razor Ramon HG", category: "gift", rarity: "N", description: "A cooking device that makes pho simply by putting leftover rice inside it. Vietnamese food has surged in popularity due to this item.", effect: "Makes pho from leftover rice. Surprisingly life-changing." },
    { id: "dr2_infrared_thermometer", name: "Infrared Thermometer", category: "gift", rarity: "N", description: "By detecting the infrared radiation released by your body, this thermometer can measure your body temperature without making direct contact with your skin.", effect: "Takes your temperature without even touching you." },
    { id: "dr2_flash_suppressor", name: "Flash Suppressor", category: "gift", rarity: "R", description: "Attaching this item to the barrel of a gun will suppress the muzzle flare and recoil while firing. However, this item will also amplify the sound of the shot to sound like a tiger's roar.", effect: "Reduces muzzle flash, amplifies the roar. Trade-offs." },
    { id: "dr2_lilienthals_wings", name: "Lilienthal's Wings", category: "gift", rarity: "R", description: "A model left behind by flight engineer Otto Lilienthal. It's filled with the dreams of those who aim for the sky.", effect: "The dream of flight, preserved in miniature." },
    { id: "dr2_kirlian_photography", name: "Kirlian Photography", category: "gift", rarity: "R", description: "A camera invented to take pictures of electrical fields surrounding objects. Sadly, there's no film in it...", effect: "Captures what cannot be seen by ordinary eyes." },
    { id: "dr2_mr_stapler", name: "Mr. Stapler", category: "gift", rarity: "R", description: "A stapler used in the medical field. As long as you set the appropriate needle, you can staple a wound closed as easy as assembling a manga.", effect: "Closes wounds as efficiently as it closes reports." },
    { id: "dr2_small_degenerated_reactor", name: "Small Degenerated Reactor", category: "gift", rarity: "SR", description: "A powerful organization used nuclear fission to repeatedly degenerate gravity and create miniature black holes for the purpose of researching alternate sources of energy.", effect: "Compact, powerful, and possibly destabilizing." },
    { id: "dr2_many_sided_dice_set", name: "Many-Sided Dice Set", category: "gift", rarity: "N", description: "A full set of dice consisting of a d4, d8, d10, d12, and d20. Created to celebrate the 30 year anniversary of the world-famous tabletop RPG: Mazes and Monsters.", effect: "Thirty years of tabletop tradition, commemorated." },
    { id: "dr2_the_funbox", name: "The Funbox", category: "gift", rarity: "R", description: "The newest home video game console. It promises a rewarding experience that money simply can't buy. You will need money to buy games for it, though.", effect: "A rewarding home console experience — games sold separately." },
    { id: "dr2_the_funplane", name: "The Funplane Advance", category: "gift", rarity: "R", description: "The newest popular portable game system. It has a hi-def touchscreen, and can also play music and videos, making for the perfect all-in-one media machine!", effect: "A portable media machine beloved by gamers everywhere." },
    { id: "dr2_american_clacker", name: "American Clacker", category: "gift", rarity: "N", description: "A toy consisting of two balls tied with string. You play with it by swinging the balls together to produce a \"clack clack\" sound. Adults and children alike are fascinated by this toy.", effect: "Fascinates all ages with its simple, satisfying clack." },
    { id: "dr2_toy_camera", name: "Toy Camera", category: "gift", rarity: "SR", description: "A cheaply made camera. Due to its poor quality, its photos are sometimes out of focus or have weird coloration. Oddly enough, that has actually made it more popular.", effect: "Pose for the fans!" },
    { id: "dr2_power_gauntlet", name: "Power Gauntlet", category: "gift", rarity: "N", description: "A video game controller shaped like a glove. You use your fingers to play games, but it is not compatible with modern game consoles. Die-hard fans love how \"bad\" this thing is.", effect: "A glove controller beloved for being wonderfully bad." },
    { id: "dr2_mesopotamia", name: "Mesopotamia", category: "gift", rarity: "N", description: "This bright red, spring-shaped toy is made out of steel. You can play with it by dropping it down the stairs. It's said its unique form was crafted by an ancient Sumerian god.", effect: "A spring-shaped toy allegedly crafted by a Sumerian god." },
    { id: "dr2_nitro_racer", name: "Nitro Racer", category: "gift", rarity: "N", description: "A toy car that was popular a few years ago. A unique feature of this product is the Nitro Button. Pressing this button releases a very nice breeze from the car.", effect: "The Nitro Button releases a very nice breeze." },
    { id: "dr2_slap_bracelet", name: "Slap Bracelet", category: "gift", rarity: "N", description: "A toy that's straight like a ruler, but when you slap it against your wrist it wraps around your arm.", effect: "Satisfying to apply; impossible to explain to others." },
    { id: "dr2_gag_ball", name: "Gag Ball", category: "gift", rarity: "N", description: "You bite into this toy like a dog. When you do, you end up making a funny face. That's why it's called a gag ball.", effect: "Produces a funny face. That's the entire point." },
    { id: "dr2_kokeshi_dynamo", name: "Kokeshi Dynamo", category: "gift", rarity: "N", description: "Flip the switch on the bottom to set the doll shaking. Apparently it's a kid's toy, but I don't really get the point of it...", effect: "A shaking doll with no clear purpose." },
    { id: "dr2_go_stone", name: "Go Stone", category: "gift", rarity: "R", description: "A black and white stone used to play Go. This game was responsible for popularizing a lot of strategic concepts. The black and white colors may also induce despair.", effect: "A stone of strategy — and perhaps of despair." },
    { id: "dr2_message_in_a_bottle", name: "Message In a Bottle", category: "gift", rarity: "N", description: "A bottle with a letter inside. The mouth of the bottle is too narrow, so you can't actually read the letter.", effect: "A mystery sealed inside where nobody can reach it." },
    { id: "dr2_old_timey_radio", name: "Old Timey Radio", category: "gift", rarity: "N", description: "A radio with a retro exterior but state-of-the-art technology inside. All you gotta do now is create a radio station!", effect: "Retro outside, modern inside. Just needs a signal." },
    { id: "dr2_antique_doll", name: "Antique Doll", category: "gift", rarity: "R", description: "A porcelain doll. Due to the exquisite craftsmanship of the doll and its clothing, many people still collect and prize them to this very day.", effect: "A refined collector's gift with exquisite craftsmanship." },
    { id: "dr2_the_third_button", name: "The Third Button", category: "gift", rarity: "N", description: "The button from a school uniform which increases in value as graduation approaches. In a few cases, reservations are necessary.", effect: "A sentimental token whose value rises near graduation." },
    { id: "dr2_moon_rock", name: "Moon Rock", category: "gift", rarity: "SR", description: "A rock taken from the Sea of Tranquility of the moon by astronauts on Apollo 11. Its composition is apparently unusual for where it was found...", effect: "An extraordinary piece of the universe itself." },
    { id: "dr2_another_battle", name: "Another Battle", category: "gift", rarity: "R", description: "The first in a series of yakuza films. It became popular for being a yakuza film that had no battle scenes in it whatsoever.", effect: "A yakuza film with zero battle scenes. Beloved for it." },
    { id: "dr2_desperation", name: "Desperation", category: "gift", rarity: "R", description: "A collection of famous songs by Tatsuro Furuta, a folk singer/songwriter who ushered in a new era of folk music.", effect: "Folk songs from an era that changed music forever." },
    { id: "dr2_1000_cherry_blossoms", name: "1000 Cherry Blossoms", category: "gift", rarity: "N", description: "A high quality tool used for floral arrangements. The needles are inserted into flowers and branches.", effect: "A high-quality tool for delicate floral arrangements." },
    { id: "dr2_paper_10th_act_verse", name: "Paper \"10th Act Verse\"", category: "gift", rarity: "N", description: "A paper handkerchief used by upper-class craftsmen. They keep it inside their pockets until they need to wipe their mouths.", effect: "A refined handkerchief for upper-class craftsmen." },
    { id: "dr2_marine_snow", name: "Marine Snow", category: "gift", rarity: "N", description: "This floating snow-like substance displays a fantastic beauty. It's actually a collection of plankton corpses.", effect: "Beautiful and unsettling — it's plankton all the way down." },
    { id: "dr2_gold_coated_sheath", name: "Gold Coated Sheath", category: "gift", rarity: "R", description: "A bamboo sword sheath with a beautiful gold finish on the part where the blade is inserted.", effect: "A bamboo sword sheath gleaming with golden finish." },
    { id: "dr2_mini_wave_dissipaters", name: "Mini Wave-Dissipaters", category: "gift", rarity: "N", description: "This island souvenir is a wave dissipation block that fits in the palm of your hand. If you leave it on the coast, sea water gathers around it.", effect: "A charming island souvenir with real tidal properties." },
    { id: "dr2_stardust", name: "Stardust", category: "gift", rarity: "R", description: "A small bottle of stardust. It's said that owning this item is enough to make you happy. Despite its name, it's actually made from the shell of a small sea creature.", effect: "They say owning this is enough to make you happy." },
    { id: "dr2_japanese_tea_cup", name: "Japanese Tea Cup", category: "gift", rarity: "R", description: "A fancy teacup made from royal wood. It's said that regular water will taste sweet if it's served in this cup.", effect: "Said to make even plain water taste sweet." },
    { id: "dr2_two_sided_ukulele", name: "Two-Sided Ukulele", category: "gift", rarity: "R", description: "This tropical instrument is stringed on both sides. The outer side produces a light, happy sound, while the inner side produces a dark, heavy sound.", effect: "Light on one side, dark on the other." },
    { id: "dr2_collapsible_fishing_rod", name: "Collapsible Fishing Rod", category: "gift", rarity: "N", description: "A fishing rod designed so you can enjoy fishing anytime, anywhere. It becomes the size of a ballpoint pen when you collapse it, allowing you to carry it with you freely.", effect: "Fishing at a moment's notice, anywhere you go." },
    { id: "dr2_bojobo_dolls", name: "Bojobo Dolls", category: "gift", rarity: "R", description: "Made from seeds and coconut fiber, these are used in Buddhist prayers. You determine your wish based on how you position the arms and legs.", effect: "Position the arms and legs to determine your wish." },
    { id: "dr2_century_potpourri", name: "Century Potpourri", category: "gift", rarity: "R", description: "An aromatic blend of ripened flowers, herbs, and fruit skins. You'll enjoy the smell of this potpourri for one hundred years.", effect: "A century of fragrance, compressed into one gift." },
    { id: "dr2_absolute_tuning_fork", name: "Absolute Tuning Fork", category: "gift", rarity: "SR", description: "An enormous tuning fork. In the hands of a tuning master, it has the power to destroy everything with its resonance. In a pinch, you can also hang your laundry from it.", effect: "In the right hands, capable of destroying everything." },
    { id: "dr2_seven_sword", name: "Seven Sword", category: "gift", rarity: "R", description: "A sword discovered inside a clay doll excavated from the island. The blade has the unique characteristic of branching off into seven blades, but its number of uses is already maxed out.", effect: "Seven blades, already at maximum use." },
    { id: "dr2_sand_gods_storm_horn", name: "Sand God's Storm Horn", category: "gift", rarity: "R", description: "A broken horn from some unknown creature. Those who possess this horn will be able to read the wind.", effect: "Those who hold this can read the wind." },
    { id: "dr2_memory_notebook", name: "Memory Notebook", category: "gift", rarity: "SR", description: "A ragged notebook. The cover says, \"Ry.…ko... Oto…'s Memory Notebook\". The writings on the inside are too worn out to read.", effect: "A ragged notebook filled with words too worn to read." },
    { id: "dr2_mukuros_knife", name: "Rusty Knife", category: "gift", rarity: "SR", description: "A knife with the Hope's Peak Academy crest on it. The blade is too rusted to use.", effect: "A relic of someone who once stood on the front lines." },
    { id: "dr2_broken_warhead", name: "Broken Warhead", category: "gift", rarity: "SR", description: "A weapon of mass destruction found at the bottom of the ocean. The following words were inscribed on the warhead by a fallen princess: \"Humans can still live without this.\"", effect: "A weapon of mass destruction, inscribed with hope." },
    { id: "dr2_girl_with_the_bear_hairpin", name: "Girl with the Bear Hairpin", category: "gift", rarity: "R", description: "A masterpiece from the realist artist, Riskini Harden Phenomenon. It was reported last year that he immersed himself in despair, and was constantly painting the entire time.", effect: "A masterpiece painted in the shadow of despair." },
    { id: "dr2_bar", name: "Bar", category: "gift", rarity: "N", description: "A metal tool used to remove nails or apply leverage. Not to be confused with its J-shaped cousin, the crowbar.", effect: "Practical and forceful. Not a crowbar." },
    { id: "dr2_dip_pen", name: "Dip Pen", category: "gift", rarity: "N", description: "A pen used for drawing lines by absorbing ink into the nib. Depending on your technique, you can create vivid lines with it. The pen of choice for manga artists and illustrators.", effect: "The tool of choice for manga artists and illustrators." },
    { id: "dr2_tissue", name: "Tissue", category: "gift", rarity: "N", description: "A modern symbol of our present society. This disposable paper has many uses, such as blowing your nose, wiping away dirt, and wrapping with kindness.", effect: "A modern symbol of society. Has many uses." },
    { id: "dr2_jabba_the_frog", name: "Jabba the Frog", category: "gift", rarity: "N", description: "A frog native to Jabberwock Island. It has an extremely long lifespan, and is said to live approximately 600 years.", effect: "A frog native to the island. Lives approximately 600 years." },
    { id: "dr2_iguana_daughter", name: "Iguana Daughter", category: "gift", rarity: "N", description: "An iguana native to Jabberwock Island. According to local legend, this creature was originally a young maiden who was changed into this form through magic.", effect: "A local legend: once a maiden, transformed by magic." },
    { id: "dr2_dull_kitchen_knife", name: "Dull Kitchen Knife", category: "gift", rarity: "N", description: "A kitchen knife that's useless for cutting. A first-rate cook will never use this knife...", effect: "Useless for cutting. No first-rate cook would touch it." },
    { id: "dr2_occult_photo_frame", name: "Occult Photo Frame", category: "gift", rarity: "N", description: "A picture frame that automatically converts digital photographs into ghostly photos.", effect: "Automatically converts digital photos into ghostly images." },
    { id: "dr2_lust_setsugekka", name: "Lust Setsugekka", category: "gift", rarity: "R", description: "Japanese sake that contains no alcohol. Despite being alcohol free, it will still get you drunk.", effect: "Non-alcoholic sake that somehow still gets you drunk." },
    { id: "dr2_rose_in_vitro", name: "Rose In a Tube", category: "gift", rarity: "R", description: "A small rose stored inside a test tube. It's good for both hellos and farewells. In the language of flowers, a red rose means passionate love.", effect: "A sealed rose — a symbol of love for hellos and farewells." },
    { id: "dr2_skullhead_mask", name: "Skullhead Mask", category: "gift", rarity: "R", description: "A creepy skull mask that appears in \"Skullhead Mask\". The lackeys of the terrorist Skelton are known to wear this.", effect: "The signature look of Skelton's lackeys." },
    { id: "dr2_replica_sword", name: "Replica Sword", category: "gift", rarity: "SR", description: "A sword for display purposes. The sheath has a scratch on it, and the gold foil near the hilt is scraped off. It doesn't look very valuable...", effect: "It smells of bathroom cleaner." },
    { id: "dr2_an_an_aan", name: "An An Aan", category: "gift", rarity: "SR", description: "A fashion magazine for teenage girls and women in their twenties. Its articles about the latest fashion trends, cooking techniques, and tips for appearing more feminine have made it extremely popular.", effect: "Also popular with boys!" },
    { id: "dr2_mans_nut", name: "Man's Nut", category: "gift", rarity: "SR", description: "A huge nut that can't be found in nature. It's said to exist within a man's heart. It's said that consuming this will increase your power to pursue romance.", effect: "Don't go busting it." },
    { id: "dr2_compact_costume", name: "Compact Costume", category: "gift", rarity: "R", description: "By chanting a secret spell, this mysterious compact mirror will transform you into anything. Even if you're a girl who doesn't stand out much, this item will help put you at the front and center.", effect: "A mirror that transforms you — center stage awaits." },
    { id: "dr2_angels_fruit", name: "Angel's Fruit", category: "gift", rarity: "R", description: "Despite its toxic appearance, this fruit bears a sweetness that will take you to heaven. However, they say that those who eat this fruit will be possessed by evil and fall to the dark side.", effect: "Sweet as heaven, dark as the fall from it." },
    { id: "dr2_bandage_wrap", name: "Bandage Wrap", category: "gift", rarity: "N", description: "A cloth bandage wrap used to treat wounds. In some cases, you can also use this to demonstrate your morbidity or cruelty.", effect: "For wounds — or for demonstrating morbidity." },
    { id: "dr2_secret_wind_sword_book", name: "Secret Wind Sword Book", category: "gift", rarity: "SR", description: "A book documenting a certain sword technique named after \"Sayaka M.\" The beautiful movements of this technique look like you're cutting through fluttering flower petals. Even the sword itself looks like it's singing.", effect: "Movements like flower petals. A sword that sings." },
    { id: "dr2_summer_festival_tree", name: "Summer Festival Tree", category: "gift", rarity: "SR", description: "The debut single of the boy band, Black Cherry. This song became a huge hit due to its rhythmic beat and catchy lyrics about summer.", effect: "Pop it baby!." },
    { id: "dr2_hagakure_crystal_ball", name: "Hagakure Crystal Ball", category: "gift", rarity: "N", description: "A broken crystal ball held together with adhesive tape. The previous owner used this item to predict the future. 30 percent of the time, he was accurate 100 percent of the time.", effect: "Accurate 100% of the time. 30% of the time." },
    { id: "dr2_rc_4wd_battler_taro", name: "R/C 4WD Battler Taro", category: "gift", rarity: "SR", description: "A manga about a boy named Taro who fights using RC cars. Children across Japan cried when Taro said this line in the final chapter: \"Adults will never understand! A goal is still a goal, even if it's a reverse run!\"", effect: "In the ball you can see a bushy haired man die dozens of times." },
    { id: "dr2_used_carrot", name: "Used Carrot", category: "gift", rarity: "N", description: "A plush carrot. It's been used so much that it's practically scraped clean.", effect: "A scraped-clean carrot. Not much left of it." },
    { id: "dr2_wooden_stick", name: "Wooden Stick", category: "gift", rarity: "SR", description: "A wooden stick with magical powers. It gives you the courage to fight.", effect: "Maybe try Spheda." },
    { id: "dr2_usami_strap", name: "Usami Strap", category: "gift", rarity: "SR", description: "An item that splits the world. There's a paradise waiting on the other end.", effect: "It reminds you of Monokuma in a way..." },
    { id: "dr2_fosho_broken_wand", name: "Fosho Broken Wand", category: "gift", rarity: "SR", description: "A magic stick wielded by a rabbit from the moon, but it's seriously broken, fosho.", effect: "Mono-mono-magic-mi!" },
    { id: "dr2_3_star_badge", name: "3 Star Badge", category: "gift", rarity: "SR", description: "A set of three bronze stars. It's filled with the boastings and pride that have made countless gourmands roar with ecstasy.", effect: "Always juicy. Never raw." },
    { id: "dr2_black_dragon_blade", name: "Black Dragon Blade", category: "gift", rarity: "SR", description: "The highest quality bamboo sword, this ancient and honorable weapon has been passed down through the ages.", effect: "Maybe I'll unlock my Bankai!" },
    { id: "dr2_nurses_apron", name: "Nurse's Apron", category: "gift", rarity: "SR", description: "A cute nurses' dress that's soaked with the smell of medicine. Just long enough to somehow trip on.", effect: "Egregious fanservice guaranteed." },
    { id: "dr2_hell_hound_earring", name: "Hell Hound Earring", category: "gift", rarity: "SR", description: "When it's worn by a legendary warlock, its true power shines through.", effect: "You can hear the whispers of Four Dark Devas..." },
    { id: "dr2_gamers_backpack", name: "Gamer's Backpack", category: "gift", rarity: "SR", description: "Apparently, it was a present from a certain gaming magazine.", effect: "Is that a pink stain..?" },
    { id: "dr2_giant_cell_phone", name: "Giant Cell Phone", category: "gift", rarity: "SR", description: "This hopelessly decorated cellphone will no longer reach anyone.", effect: "It dials endlessley." },
    { id: "dr2_easter_egg", name: "Monolith", category: "gift", rarity: "SR", description: "A sleek black monolith. It hums with an odd, almost alien force.", effect: "One more Mono rejected." },

    // ── DRV3: Killing Harmony ────────────────────────────────────────────────
    { id: "drv3_oolong_tea", name: "Oolong Tea", category: "gift", rarity: "N", description: "An oxidized Chinese tea. Different flavors and fragrances can be brought out depending on the degree of oxidation.", effect: "A balanced, calming drink for the thoughtful." },
    { id: "drv3_boba_tea", name: "Boba Tea", category: "gift", rarity: "N", description: "A popular drink with a bunch of tapioca balls at the bottom. The chewy tapioca balls are made from the root of the cassava plant.", effect: "Chewy tapioca at the bottom. Universally beloved." },
    { id: "drv3_ginger_tea", name: "Ginger Tea", category: "gift", rarity: "N", description: "Hot water with grated ginger in it. It warms the body and prevents colds. It tastes delicious with honey mixed in.", effect: "Warms the body and wards off colds." },
    { id: "drv3_cleopatras_pearl_cocktail", name: "Cleopatra's Pearl Cocktail", category: "gift", rarity: "R", description: "A drink based on the story of Cleopatra dissolving one of her pearl earrings in a cup of vinegar. Said to be good for beauty.", effect: "Dissolves barriers as easily as Cleopatra dissolved pearls." },
    { id: "drv3_non_alcoholic_drink_of_immortality", name: "Non-Alcoholic Drink of Immortality", category: "gift", rarity: "N", description: "A non-alcoholic drink based on a legendary alcoholic beverage said to make the drinker immortal. It neither grants immortality, nor does it taste good.", effect: "Grants neither immortality nor good flavor." },
    { id: "drv3_ketchup", name: "Ketchup", category: "gift", rarity: "N", description: "An exclusive writing instrument for a maid to use to write messages on omelettes. Considered a normal condiment by some people.", effect: "An exclusive tool for writing omelette messages." },
    { id: "drv3_sugar", name: "Sugar", category: "gift", rarity: "N", description: "A basic seasoning that's primarily made up of sucrose. Be careful not to consume too much of it.", effect: "A basic sweetener. Handle with moderation." },
    { id: "drv3_olive_oil", name: "Olive Oil", category: "gift", rarity: "N", description: "A vegetable oil created from olives. If you wield it correctly, it will make you look cool as you cook.", effect: "Makes you look cool as you cook, if wielded correctly." },
    { id: "drv3_astro_cake", name: "Astro Cake", category: "gift", rarity: "R", description: "A freeze-dried slice of cake sold to the public as space food. It's both healthy and vegetarian-friendly.", effect: "Freeze-dried space food — healthy, vegetarian, and otherworldly." },
    { id: "drv3_bubble_gum_bomb", name: "Bubble Gum Bomb", category: "gift", rarity: "N", description: "A gum that makes an explosive sound when it's fully blown and popped. Weak-hearted people should not chew it.", effect: "Pops explosively. Not for the faint-hearted." },
    { id: "drv3_maple_fudge", name: "Maple Fudge", category: "gift", rarity: "N", description: "A British candy that's made by boiling down sugar, condensed milk, and butter, and then adding maple syrup. It's really sweet.", effect: "A British sweet of uncommon richness." },
    { id: "drv3_greek_yogurt", name: "Greek Yogurt", category: "gift", rarity: "N", description: "A food that's made by straining water from plain yogurt. The thick taste is popular and used in several dishes.", effect: "Thick, strained, and versatile — widely appreciated." },
    { id: "drv3_bunny_apples", name: "Bunny Apples", category: "gift", rarity: "N", description: "Apples cut into bunny shapes. Often used as bait for certain animals and insects.", effect: "Apple slices cut into bunny shapes. Doubles as insect bait." },
    { id: "drv3_rock_hard_ice_cream", name: "Rock Hard Ice Cream", category: "gift", rarity: "N", description: "A cup of ice cream engineered to never melt. It can be carried around for a long time, even in summer. But it's so hard, ordinary spoons can't penetrate it.", effect: "Never melts, but ordinary spoons cannot penetrate it." },
    { id: "drv3_sukiyaki_caramel", name: "Sukiyaki Caramel", category: "gift", rarity: "N", description: "Sukiyaki-flavored caramels that combine the flavors of meat, soy sauce, eggs, and caramel. The flavors are all really strong and don't mix well.", effect: "Combines meat, soy sauce, eggs, and caramel. Polarizing." },
    { id: "drv3_candy_cigarette", name: "Candy Cigarette", category: "gift", rarity: "N", description: "A sweet cigarette-shaped candy. It's popular among kids who want to imitate adults.", effect: "A sweet imitation of adulthood." },
    { id: "drv3_gyoza_in_the_shape_of_a_face", name: "Gyoza In the Shape of a Face", category: "gift", rarity: "N", description: "A dumpling that's modeled after someone you swear you've seen somewhere before. The skin is thick and it's a little tough.", effect: "A dumpling that resembles someone uncannily familiar." },
    { id: "drv3_silver_earring", name: "Silver Earring", category: "gift", rarity: "R", description: "A simple earring that can look good on anyone. It's casually stylish.", effect: "Casually stylish. Looks good on anyone." },
    { id: "drv3_crystal_bangle", name: "Crystal Bangle", category: "gift", rarity: "R", description: "A bangle made out of common crystal glass. It's sparkly and draws quite a bit of attention.", effect: "Sparkly and draws quite a bit of attention." },
    { id: "drv3_striped_necktie", name: "Striped Necktie", category: "gift", rarity: "N", description: "A stylish tie both men and women can wear. It's convenient to have one around for special occasions.", effect: "A versatile accessory for any special occasion." },
    { id: "drv3_bondage_boots", name: "Bondage Boots", category: "gift", rarity: "SR", description: "Enamel boots fit for a queen. They have high heels and long laces decorated with a chain. Made to be worn as shoes, but usable as art or an umbrella holder.", effect: "Enamel boots fit for a queen — or an umbrella stand." },
    { id: "drv3_ultimate_academy_bracelet", name: "Ultimate Academy Bracelet", category: "gift", rarity: "R", description: "A handcuff bracelet with the crest for the Ultimate Academy emblazoned on it. It is a symbol of friendship, even in the face of death and despair.", effect: "A symbol of friendship even in the face of death and despair." },
    { id: "drv3_workout_clothes", name: "Workout Clothes", category: "gift", rarity: "N", description: "Easy-to-move workout clothes that wick away any sweat. With these, you can work out all day and still be comfortable.", effect: "Comfortable, sweat-wicking, and built to last all day." },
    { id: "drv3_mono_jinbei", name: "Mono-Jinbei", category: "gift", rarity: "N", description: "Popular Japanese summer clothes colored black and white, like Monokuma. It's easy to move around in, and breathes well.", effect: "Cool, breathable, and black and white like Monokuma." },
    { id: "drv3_autumn_colored_scarf", name: "Autumn-Colored Scarf", category: "gift", rarity: "N", description: "A chic autumn-colored scarf that can be used by men, women, and robots. It is very trendy and a fashionable accent to any outfit.", effect: "Trendy and fashionable for men, women, and robots alike." },
    { id: "drv3_hand_knit_sweater", name: "Hand-Knit Sweater", category: "gift", rarity: "N", description: "A sweater that's been knitted with love in every stitch. Those who wear it can feel themselves enveloped in the power of love and will stay warm through even the coldest winter.", effect: "Knitted with love in every stitch." },
    { id: "drv3_cheer_coat_uniform", name: "Cheer Coat Uniform", category: "gift", rarity: "N", description: "A long coat with passionate red lining. It protects you from the cold and makes you burn with passion.", effect: "Burns with a passionate red that warms the wearer's heart." },
    { id: "drv3_nail_brush", name: "Nail Brush", category: "gift", rarity: "N", description: "A brush for painting nails beautifully. With this, anyone can make their nails sparkle like magic.", effect: "Makes any nail sparkle like magic." },
    { id: "drv3_wearable_blanket", name: "Wearable Blanket", category: "gift", rarity: "N", description: "A blanket that will completely defend you from the cold by closing off any gaps around your hands, neck, and feet. Moving around in it is near impossible.", effect: "Complete cold protection. Moving around is near impossible." },
    { id: "drv3_beret", name: "Beret", category: "gift", rarity: "N", description: "A size-adjustable beret. It's a pretty popular hat that lets you look trendy and somewhat artistic.", effect: "A popular, size-adjustable hat that makes you look artistic." },
    { id: "drv3_ladybug_brooch", name: "Ladybug Brooch", category: "gift", rarity: "R", description: "A cute and fashionable brooch that resembles a seven-spotted ladybug. Despite how realistic it looks, it is not alive.", effect: "A cute, fashionable brooch. Despite appearances, not alive." },
    { id: "drv3_cufflinks", name: "Cufflinks", category: "gift", rarity: "N", description: "An accessory that is attached to the cuffs of a shirt. The black onyx design makes it look good on both men and women.", effect: "Black onyx cufflinks that look good on anyone." },
    { id: "drv3_dog_tag", name: "Dog Tag", category: "gift", rarity: "R", description: "A dog tag used to identify soldiers. The same profile is engraved on two plates so that if the owner is killed, one is collected to report death.", effect: "An identity tag whose second plate is collected in the event of death." },
    { id: "drv3_white_robot_mustache", name: "White Robot Mustache", category: "gift", rarity: "R", description: "A gentlemanly mustache that can be stuck on robots. Does not include antenna functions or earthquake powers.", effect: "A gentlemanly mustache for robots. No antenna functions." },
    { id: "drv3_book_of_the_blackened", name: "Book of the Blackened", category: "gift", rarity: "R", description: "A book of criminal offenses that contains records of the cruelest, most atrocious murders committed by humans. Many of these cases weren't released to the public.", effect: "Contains murder records never released to the public." },
    { id: "drv3_feelings_of_ham", name: "Feelings of Ham", category: "gift", rarity: "N", description: "How to raise hamsters... is not what this book is about. It's a book about raising domestic animals for meat. For those who are interested in the farming industry.", effect: "A guide to raising domestic animals for meat. Not hamsters." },
    { id: "drv3_travel_journal", name: "Travel Journal", category: "gift", rarity: "R", description: "A thick journal packed with records of trips. However, it was actually written using vague knowledge and the rich imagination of someone looking at a world map.", effect: "Rich in imagination, vague on actual travel experience." },
    { id: "drv3_dreams_come_true_spell_book", name: "Dreams Come True ☆ Spell Book", category: "gift", rarity: "N", description: "A book that contains old magic gathered from all over the country. Any dangerous magic has been removed, so only love spells are left.", effect: "Old magic collected for kids. Only love spells remain." },
    { id: "drv3_story_of_tokono", name: "Story of Tokono", category: "gift", rarity: "R", description: "A collection of stories about the customs, legends, and knowledge of civilizations from long ago. It has a high scientific value.", effect: "High scientific value — customs, legends, and ancient knowledge." },
    { id: "drv3_spla_teen_vogue", name: "Spla-Teen Vogue", category: "gift", rarity: "N", description: "A teen magazine featuring many models just enjoying their summer. This magazine is meant for kids, not squids.", effect: "A teen magazine. For kids, not squids." },
    { id: "drv3_fun_book_of_animals", name: "Fun Book of Animals", category: "gift", rarity: "N", description: "An animal picture book for preschool kids. For some reason, bears are not featured in it.", effect: "An animal picture book. No bears featured." },
    { id: "drv3_latest_machine_parts_catalogue", name: "Latest Machine Parts Catalogue", category: "gift", rarity: "N", description: "A comprehensive catalog that features the latest cables, screws, motors, etc. It could be considered a fashion magazine for robots.", effect: "A fashion magazine for robots." },
    { id: "drv3_stainless_tray", name: "Stainless Tray", category: "gift", rarity: "R", description: "A circular silver tray that shines like a mirror. It is befitting of a maid.", effect: "A mirror-bright tray befitting of a maid." },
    { id: "drv3_tennis_ball_set", name: "Tennis Ball Set", category: "gift", rarity: "N", description: "A standard tennis ball four-pack set. Not only is it used for tennis, but it's also used for massage and weight loss exercises.", effect: "Standard four-pack, good for tennis and massage exercises." },
    { id: "drv3_high_end_headphones", name: "High-End Headphones", category: "gift", rarity: "SR", description: "Top-grade, high-end headphones. Use these if you truly want to hear the nuances in classical and jazz music.", effect: "Top-grade. Hear the nuances in classical and jazz music." },
    { id: "drv3_teddy_bear", name: "Teddy Bear", category: "gift", rarity: "R", description: "A typical stuffed toy bear that's not black and white. If you love it enough, then it might come to life one day.", effect: "Love it enough, and it might come to life one day." },
    { id: "drv3_milk_puzzle", name: "Milk Puzzle", category: "gift", rarity: "N", description: "A plain puzzle with one side as white as milk. It's said to be good for concentration training and is used for astronaut selection exams.", effect: "White on all sides. Used for astronaut selection exams." },
    { id: "drv3_illusion_rod", name: "Illusion Rod", category: "gift", rarity: "R", description: "A miracle rod that can show a happy illusion when it's spun in circles in front of someone's eyes.", effect: "Spun in circles, it shows a happy illusion." },
    { id: "drv3_hand_mirror", name: "Hand Mirror", category: "gift", rarity: "N", description: "A pocket-sized mirror that is incredibly useful for checking your appearance.", effect: "Incredibly useful for checking your appearance." },
    { id: "drv3_prop_carrying_case", name: "Prop Carrying Case", category: "gift", rarity: "R", description: "A case in high demand by cosplayers for its usability. Not only is it useful for conventions, but it's great for trips too.", effect: "In high demand by cosplayers. Great for trips too." },
    { id: "drv3_japanese_doll_wig", name: "Japanese Doll Wig", category: "gift", rarity: "R", description: "A glamorous black wig that has hair like that of a Japanese doll. Even if you cut it, it grows back instantly.", effect: "Cut it, and it grows back instantly." },
    { id: "drv3_photoshop_software", name: "Photoshop Software", category: "gift", rarity: "R", description: "A photo editing software that lets you retouch photos. Turn a plain, freckled face into something flashy!", effect: "Turns a plain face into something flashy." },
    { id: "drv3_sewing_kit", name: "Sewing Kit", category: "gift", rarity: "N", description: "A basic sewing kit that has a needle and several colors of thread. With this, you will always be prepared in case a button comes off.", effect: "Basic, but always useful when a button comes off." },
    { id: "drv3_flame_thunder", name: "Flame Thunder", category: "gift", rarity: "R", description: "A broom that lets mages fly at high speeds when they sit on it. It's a little bent, but it can also be used for cleaning.", effect: "A broom for high-speed mage flight. Also cleans floors." },
    { id: "drv3_tattered_music_score", name: "Tattered Music Score", category: "gift", rarity: "R", description: "A tattered handwritten music score. Rumor has it that it's unpublished music from a certain famous composer.", effect: "Rumored to be unpublished music from a famous composer." },
    { id: "drv3_indigo_hakama", name: "Indigo Hakama", category: "gift", rarity: "R", description: "Traditional Japanese clothing. This particular kind is made of high-quality cotton and used for martial arts. Wear it when it's time to spar.", effect: "High-quality martial arts clothing. Wear it when it's time to spar." },
    { id: "drv3_fashionable_glasses", name: "Fashionable Glasses", category: "gift", rarity: "N", description: "A fashionable accessory that appears to be a pair of glasses, but does not actually correct its wearer's vision.", effect: "Looks like glasses. Does not correct vision." },
    { id: "drv3_gold_origami", name: "Gold Origami", category: "gift", rarity: "N", description: "An origami pack that has 24 sheets of gold origami paper. With this, you can create gorgeous origami.", effect: "24 sheets of gold origami paper for gorgeous creations." },
    { id: "drv3_plastic_moon_buggy_model", name: "Plastic Moon Buggy Model", category: "gift", rarity: "N", description: "A plastic model of an actual buggy used by astronauts on the moon. It looks plain, but it's actually filled with a burning passion.", effect: "Plain-looking, but filled with burning passion." },
    { id: "drv3_im_a_picture_book_artist", name: "I'm a Picture Book Artist!", category: "gift", rarity: "N", description: "An electronic device that's equipped with an AI to produce a new picture book every time it's turned on. Great for kids who love hearing bedtime stories.", effect: "An AI that produces a new picture book every time it's turned on." },
    { id: "drv3_hand_grips", name: "Hand Grips", category: "gift", rarity: "N", description: "A device for grip training. The strength of a punch is determined by grip strength, weight, and speed combined.", effect: "Grip strength determines the strength of a punch." },
    { id: "drv3_commemorative_medal_set", name: "Commemorative Medal Set", category: "gift", rarity: "SR", description: "A medal set Monokuma made himself. You can feel the care he put into making it.", effect: "Monokuma wants to battle!" },
    { id: "drv3_metronome", name: "Metronome", category: "gift", rarity: "N", description: "A musical device that is used to match the tempo when playing an instrument. A basic pendulum type.", effect: "A basic pendulum metronome for matching tempo." },
    { id: "drv3_sketchbook", name: "Sketchbook", category: "gift", rarity: "N", description: "An art book for sketches. It's pocket-sized so it's convenient to carry around.", effect: "Pocket-sized, convenient to carry everywhere." },
    { id: "drv3_art_manikin", name: "Art Manikin", category: "gift", rarity: "N", description: "A model doll that has the same joints as humans. It's pretty versatile and can stay balanced in positions humans can't maintain.", effect: "Can balance in positions no human can maintain." },
    { id: "drv3_bird_food", name: "Bird Food", category: "gift", rarity: "N", description: "A carefully selected collection of fresh seeds for domestic pigeons. Wild pigeons can't appreciate the increased quality, so it would be a waste to give them these.", effect: "Fresh seeds for domestic pigeons. Wild ones can't appreciate the quality." },
    { id: "drv3_proxilingual_device", name: "Proxilingual Device", category: "gift", rarity: "R", description: "A tool that can translate any language, even animal sounds. It can pick up a dog's bark and eloquently describe the emotions in it with an electronic bark.", effect: "Translates any language, including animal sounds." },
    { id: "drv3_gourd_insect_trap", name: "Gourd Insect Trap", category: "gift", rarity: "R", description: "An opaque, gourd-shaped insect keeper. Used for keeping bugs to listen to the noises they make.", effect: "A gourd-shaped keeper for listening to the sounds insects make." },
    { id: "drv3_potted_banyan_tree", name: "Potted Banyan Tree", category: "gift", rarity: "SR", description: "A potted banyan tree with spirits living inside it. It is said to be good luck. It grows aerial roots from the middle of its trunk.", effect: "Spirits live inside it. Said to bring good luck." },
    { id: "drv3_pocket_tissue", name: "Pocket Tissue", category: "gift", rarity: "N", description: "A normal package of tissues. It's best to carry it alongside a handkerchief.", effect: "Best carried alongside a handkerchief." },
    { id: "drv3_dancing_haniwa", name: "Dancing Haniwa", category: "gift", rarity: "R", description: "A ceramic figure from the Japanese Kofun period. It is said to resemble a person dancing very intensely.", effect: "A ceramic figure from the Kofun period, mid-intense dance." },
    { id: "drv3_work_chair_of_doom", name: "Work Chair Of Doom", category: "gift", rarity: "R", description: "The ultimate work station with a comfy chair and so much technology that you will never want to get up. Those who sit here will be in danger of becoming obese.", effect: "The ultimate workstation. Those who sit here risk obesity." },
    { id: "drv3_3_hit_ko_sandbag", name: "3-Hit KO Sandbag", category: "gift", rarity: "N", description: "Regardless of whether it's hit by a kick from a sickly child or a punch from a superhuman adult, this punching bag will always break on the third hit.", effect: "Breaks on the third hit, regardless of who's hitting it." },
    { id: "drv3_sports_towel", name: "Sports Towel", category: "gift", rarity: "N", description: "A towel that's perfect for hanging around your neck to wipe off sweat. It's the color of the bright, blue sky on a youthful summer day.", effect: "The color of the bright, blue sky on a youthful summer day." },
    { id: "drv3_steel_glasses_case", name: "Steel Glasses Case", category: "gift", rarity: "R", description: "A sturdy glasses case that won't break, even if it's stomped on by an Exisal. No matter what abuse it takes, the glasses inside will be kept safe.", effect: "Won't break even if stomped on by an Exisal." },
    { id: "drv3_robot_oil", name: "Robot Oil", category: "gift", rarity: "N", description: "An oil that's necessary to have when making robots. It has started to separate, so the top half is diluted. Please be sure to shake before use.", effect: "Necessary for making robots. Shake before use." },
    { id: "drv3_clock_shaped_gaming_console", name: "Clock-Shaped Gaming Console", category: "gift", rarity: "R", description: "A pocket watch-shaped game console with monochrome LCD and several buttons. Play a game called \"Factory\" and mash buttons to create more bears!", effect: "A pocket-watch console. Play Factory and make bears." },
    { id: "drv3_everywhere_parasol", name: "Everywhere Parasol", category: "gift", rarity: "N", description: "A parasol with a stand so it can be used anywhere. Set it up poolside to feel fancy!", effect: "This is no paradise, boy." },
    { id: "drv3_three_layered_lunch_box", name: "Three-Layered Lunch Box", category: "gift", rarity: "N", description: "A family-sized lunch box that can fit a variety of side dishes. Perfect for a picnic.", effect: "Family-sized and perfect for a picnic." },
    { id: "drv3_aluminum_water_bottle", name: "Aluminum Water Bottle", category: "gift", rarity: "N", description: "A round, retro water bottle. Having it slung over your shoulder makes you want to go on an adventure.", effect: "Retro and round. Makes you want to go on an adventure." },
    { id: "drv3_jelly_balls", name: "Jelly Balls", category: "gift", rarity: "N", description: "Squishy, colorful beads that swell to marble size when wet. Good for decoration and gardening. Lining up 4 of the same color won't make them vanish.", effect: "Squishy, colorful beads that swell to marble size when wet." },
    { id: "drv3_upbeat_humidifier", name: "Upbeat Humidifier", category: "gift", rarity: "N", description: "It humidifies your room based on the amount of tears you have shed. Great for gloomy people, but to cheerful people, it's just a paperweight.", effect: "Humidifies based on your tears. Useless to cheerful people." },
    { id: "drv3_earnest_compass", name: "Earnest Compass", category: "gift", rarity: "N", description: "A compass that ignores the North Pole and South Pole, and instead points to the owner's loved ones. A must-have for stalkers.", effect: "Points to your loved ones instead of north." },
    { id: "drv3_semazen_doll", name: "Semazen Doll", category: "gift", rarity: "N", description: "A ceramic doll that spins like a Whirling Dervish. It's a very popular Turkish souvenir.", effect: "A ceramic doll that spins like a Whirling Dervish." },
    { id: "drv3_weathercock_of_barcelous", name: "Weathercock of Barcelous", category: "gift", rarity: "N", description: "A weathercock that imitates the Portuguese \"Rooster of Barcelous\". A symbol of truth, this is a popular souvenir from Portugal.", effect: "A rooster weathercock — a symbol of truth from Portugal." },
    { id: "drv3_pillow_of_admiration", name: "Pillow of Admiration", category: "gift", rarity: "R", description: "A pillow that helps you sleep well and gives you wonderful dreams. However, the dreams will show an entire lifetime, making you feel intensely empty after you wake up.", effect: "Gives wonderful dreams. Leaves you intensely empty after." },
    { id: "drv3_46_moves_of_the_killing_game", name: "46 Moves of the Killing Game", category: "gift", rarity: "R", description: "A card game with Japanese characters relating to killing games. Some cards are: \"A metal bat to kill demons\", \"Blackened are soaked in blood\", and \"Certain evidence over arguments\".", effect: "A card game about killing games. Some cards are intense." },
    { id: "drv3_monkeys_paw", name: "Monkey's Paw", category: "gift", rarity: "SR", description: "The mummified hand of a monkey said to grant three wishes. However, none of the wishes it grants have happy endings.", effect: "Grants three wishes. None of them have happy endings." },
    { id: "drv3_art_piece_of_spring", name: "Art Piece of Spring", category: "gift", rarity: "SR", description: "An ornament that looks like a urinal. The more you look at it, the more you start to question what art really is.", effect: "Makes you question what art really is." },
    { id: "drv3_electric_tempest", name: "Electric Tempest", category: "gift", rarity: "R", description: "A cool high-powered water gun. The water shoots over 10 yards and it can be fired continuously for a whole minute. Fun for kids and adults!", effect: "Shoots water over 10 yards. Fires continuously for a minute." },
    { id: "drv3_space_egg", name: "Space Egg", category: "gift", rarity: "SR", description: "An object made out of borosilicate glass. Depending on the angle, it changes form. The mysterious pattern is what makes it popular.", effect: "Changes form depending on the angle. Mysteriously popular." },
    { id: "drv3_death_flag", name: "Death Flag", category: "gift", rarity: "N", description: "The blackened might be one of us, so I refuse to stay with you guys! I'm gonna go hide in my room!", effect: "A self-fulfilling prophecy in gift form." },
    { id: "drv3_survival_flag", name: "Survival Flag", category: "gift", rarity: "R", description: "The chance of this succeeding is only 5%. No one has ever made it out alive before... but this is my last chance to survive.", effect: "A 5% chance. The last chance to survive." },
    { id: "drv3_helping_yacchi", name: "Helping Yacchi", category: "gift", rarity: "N", description: "A robot mascot that looks like a killer whale. It can sense when its owner is distressed, and offers a research solution.", effect: "A robot mascot that offers research solutions when distressed." },
    { id: "drv3_home_planet", name: "Home Planet", category: "gift", rarity: "R", description: "A mini planetarium machine that can project the cosmos onto your bedroom walls when it's time for bed. Comes with a narration by a popular voice actor.", effect: "Projects the cosmos onto your bedroom walls at bedtime." },
    { id: "drv3_super_lucky_button", name: "Super Lucky Button", category: "gift", rarity: "SR", description: "A shiny button that makes its owner feel like their luck will turn around. It may or may not pull in a powerful wave of luck.", effect: "I got it out of a bag of chips!" },
    { id: "drv3_sparkly_sheet", name: "Sparkly Sheet", category: "gift", rarity: "N", description: "A cleaning sheet that gets rid of any mess in the kitchen sink or dirt on the faucet. Can also be used to clean robots.", effect: "Removes kitchen mess and faucet grime. Also cleans robots." },
    { id: "drv3_hammock", name: "Hammock", category: "gift", rarity: "N", description: "Bedding created by hanging a net between two poles or trees. Lounging in one of these is something everyone has dreamed of at least once.", effect: "Something everyone has dreamed of lounging in at least once." },
    { id: "drv3_cleansing_air_freshener", name: "Cleansing Air Freshener", category: "gift", rarity: "N", description: "A spray air freshener. It has holy water mixed in, and is said to repel ghosts and paranormal entities.", effect: "Has holy water mixed in. Repels ghosts and paranormal entities." },
    { id: "drv3_flower_for_floromancy", name: "Flower for Floromancy", category: "gift", rarity: "N", description: "\"Loves me, loves me not, loves me...\" An artificial flower used for flower fortune-telling. It has an odd number of petals to soothe the pain of unrequited love.", effect: "An artificial flower with an odd number of petals for fortune-telling." },
    { id: "drv3_marigold_seeds", name: "Marigold Seeds", category: "gift", rarity: "N", description: "Marigold seeds that bloom into colorful flowers. By the way, marigolds symbolize \"despair\".", effect: "Colorful flowers that symbolize despair." },
    { id: "drv3_rock_paper_scissors_cards", name: "Rock-Paper-Scissors Cards", category: "gift", rarity: "N", description: "A set of cards containing four rocks, four papers, and four scissors. If you bet your life on this game, it can be a thrilling psychological battle.", effect: "Bet your life on this game for a thrilling psychological battle." },
    { id: "drv3_perfect_laser_gun", name: "Perfect Laser Gun", category: "gift", rarity: "R", description: "A replica of a laser gun used by upstanding citizens to punish rebellious or unhappy people. When carrying it around, be sure to watch your coefficient.", effect: "Watch your coefficient when carrying this around." },
    { id: "drv3_someones_student_id", name: "Someone's Student ID", category: "gift", rarity: "N", description: "A replica of a student ID from some academy. There are as many different designs of ID as there are talented students.", effect: "A replica ID from some talented academy." },
    { id: "drv3_bear_ears", name: "Bear Ears", category: "gift", rarity: "N", description: "A headband with Monokuma ears. When worn, it picks up your brainwaves and the ears wiggle according to your emotions.", effect: "Picks up your brainwaves and wiggles with your emotions." },
    { id: "drv3_dangan_werewolf", name: "Dangan Werewolf", category: "gift", rarity: "R", description: "A party game of hope and despair. Draw cards and become the characters to start deducing and debating! Now on sale!", effect: "A party game of hope and despair. Now on sale!" },
    { id: "drv3_tentacle_machine", name: "Tentacle Machine", category: "gift", rarity: "R", description: "An extremely handy reacher grabber. Once you use it, you can't live without it.", effect: "An extremely handy reacher grabber. You can't live without it." },
    { id: "drv3_rice_toy_blocks", name: "Rice Toy Blocks", category: "gift", rarity: "N", description: "Toy blocks made out of rice, so they're safe for babies to put in their mouths. But they'll go bad if they aren't eaten right away.", effect: "Safe for babies to mouth. Will go bad if not eaten right away." },
    { id: "drv3_cosmic_blanket", name: "Cosmic Blanket", category: "gift", rarity: "N", description: "Aluminum film that makes excellent insulation. It warms your body when you wrap it around yourself, making it handy for outdoor activities.", effect: "Aluminum film insulation. Handy for outdoor activities." },
    { id: "drv3_fully_automated_shaved_ice_machine", name: "Fully-Automated Shaved Ice Machine", category: "gift", rarity: "R", description: "A shaved ice machine that automatically crushes up ice and pours strawberry syrup on top.", effect: "Automatically crushes ice and pours strawberry syrup on top." },
    { id: "drv3_gun_of_mans_passion", name: "Gun of Man's Passion", category: "gift", rarity: "SR", description: "A model of an imaginary weapon. It's powerful, but only the worthy may fire it. Embrace it to feel a man's fantasy.", effect: "May the Force be with you." },
    { id: "drv3_pure_white_practice_sword", name: "Pure-White Practice Sword", category: "gift", rarity: "SR", description: "An ornamental katana that contains a divine power capable of taking out ordinary people with a single slash.", effect: "Ars Arcanum!" },
    { id: "drv3_dark_belt", name: "Dark Belt", category: "gift", rarity: "SR", description: "A black-ish belt worn with karate clothes. It can only be worn by those with justice in their hearts.", effect: "Can only be worn by those with justice in their hearts." },
    { id: "drv3_variety_cushion", name: "Variety Cushion", category: "gift", rarity: "SR", description: "A cushion that expresses the will of the outside world to abandon killing games and watch human relationships instead.", effect: "Puff-puff." },
    { id: "drv3_key_of_love", name: "Key of Love", category: "gift", rarity: "SR", description: "A key to the heart. Not to be used by boys with talking dogs and ducks.", effect: "Not approved by Diz'knee." },
    { id: "drv3_to_each_their_own_roulette", name: "To Each Their Own Roulette", category: "gift", rarity: "SR", description: "A lucky roulette with ups and downs that can impact people's lives.", effect: "Where will you land..?" },
    { id: "drv3_monomune", name: "Monomune", category: "gift", rarity: "SR", description: "A legendary sword said to have sliced apart the despair that covered the entire world.", effect: "Shame it's blunt as all hell." },
    { id: "drv3_ultimate_academy_badge", name: "Ultimate Academy for Gifted Juveniles Badge", category: "gift", rarity: "SR", description: "It's a badge of the Ultimate Academy insignia. Apparently, there are only 16 of these in the world.", effect: "How poetic." },
    { id: "drv3_musical_note_hairpin", name: "Musical Note Hairpin", category: "gift", rarity: "SR", description: "No matter the hardship, there's always a deep melody playing in your heart.", effect: "Clair de Lune - Debussy" },
    { id: "drv3_servants_gloves", name: "Servant's Gloves", category: "gift", rarity: "SR", description: "A maid's gloves that's been associated with royalty and power...", effect: "Get down Mr President!" },
    { id: "drv3_mysterious_mask", name: "Mysterious Mask", category: "gift", rarity: "SR", description: "A gnarly mask that shocks those who come across it. It covers the mouth and neck to hide them from view.", effect: "Nothing more to unravel." },
    { id: "drv3_empty_insect_cage", name: "Empty Insect Cage", category: "gift", rarity: "SR", description: "Fill it with all your favourite bugs!", effect: "Gotta catch 'em all!" },
    { id: "drv3_galactic_jacket", name: "Galactic Jacket", category: "gift", rarity: "SR", description: "An old trench coat that has a hole in the sleeve. It depicts his fantasies of the universe.", effect: "For some reason, Monokuma hates this jacket..." },
    { id: "drv3_team_danganronpa_badge", name: "Bizarre Badge", category: "gift", rarity: "SR", description: "An odd badge that has a striking resemblence to Monokuma.", effect: "Is this thing even real..?" },
    { id: "drv3_easter_egg", name: "Egg CD", category: "gift", rarity: "SR", description: "A CD with dreadful, egg-themed music loaded on it. Intermissions include Monokuma laughing heartily.", effect: "At least one of the songs has to be a good egg, no..?" },
    { id: "drv3_date_ticket", name: "Date Ticket", category: "gift", rarity: "SR", description: "A ticket that's used to profess your adoration to someone.", effect: "I choo-choo-choose you." },
    { id: "drv3_monomergen_c", name: "Monomergen-C", category: "gift", rarity: "N", description: "A suspicious-looking energy drink. Not only will it increase your energy a hundredfold, but it can also manipulate time itself.", effect: "Increases energy a hundredfold and can manipulate time itself." },

    { id: "shop_skill_clairvoyance", name: "Clairvoyance", category: "skill", rarity: "R", description: "A subtle sharpening of perception — you begin to read the room's pulse.", effect: "Displays HP values for you and your opponent during Argument Armament." },
    { id: "shop_skill_beta_block", name: "Beta Block", category: "skill", rarity: "R", description: "A strategic read of panic — you sense the pressure before the chains appear.", effect: "Shows the number of hits required to break column locks during Mass Panic Debate." },
];

// ---------------------------------------------------------------------------
// Custom Skill parameter registry
// ---------------------------------------------------------------------------
// Single source of truth for the tunable minigame parameters a player-authored
// "Custom Skill" can modify. Used by the skill-creation UI (to build the effect
// dropdowns) and by the resolver in index.js (to clamp resolved values).
//
// Each entry:
//   key        - canonical id stored on each effect ({parameter})
//   label      - display name in the effects builder
//   group      - section heading in the dropdown
//   valueTypes - allowed value-type choices for an effect ('percent'|'absolute')
//   unit       - shown next to the value (informational)
//   base       - reference/default value (null when the base is dynamic at runtime)
//   dynamicBase- true when `base` is just a fallback and the real base varies per run
//   clampMin/clampMax - hard safety bounds applied after the modifier is resolved
//   integer    - round the resolved value to a whole number
//   lowerIsBetter - hint for the UI (lower value = buff, e.g. reload time)
export const SKILL_PARAM_REGISTRY = [
    { key: "reticuleSize",     label: "NSD — Reticule Size",          group: "Non-Stop Debate", valueTypes: ["percent", "absolute"], unit: "px", base: 120,    clampMin: 40,     clampMax: 400,    integer: true },
    { key: "reticuleSway",     label: "NSD — Reticule Sway",          group: "Non-Stop Debate", valueTypes: ["percent", "absolute"], unit: "",   base: 9,      clampMin: 0,      clampMax: 40,     integer: false },
    { key: "btFireSpeed",      label: "NSD — Truth Bullet Fire Speed",group: "Non-Stop Debate",       valueTypes: ["percent", "absolute"], unit: "/s", base: 0.25,   clampMin: 0.05,   clampMax: 1.0,    integer: false },
    { key: "btReloadSpeed",    label: "NSD — Truth Bullet Reload Speed",group: "Non-Stop Debate",     valueTypes: ["percent", "absolute"], unit: "/s", base: 0.125,  clampMin: 0.02,   clampMax: 1.0,    integer: false },
    { key: "debateTimer",      label: "NSD — Debate Timer",           group: "Non-Stop Debate", valueTypes: ["percent", "absolute"], unit: "ms", base: 120000, dynamicBase: true, clampMin: 120000, clampMax: 600000, integer: true },
    { key: "mpdReticuleSize",  label: "MPD — Reticule Size",          group: "Mass Panic Debate", valueTypes: ["percent", "absolute"], unit: "px", base: 120,    clampMin: 40,     clampMax: 400,    integer: true },
    { key: "mpdReticuleSway",  label: "MPD — Reticule Sway",          group: "Mass Panic Debate", valueTypes: ["percent", "absolute"], unit: "",   base: 9,      clampMin: 0,      clampMax: 40,     integer: false },
    { key: "mpdBtFireSpeed",   label: "MPD — Truth Bullet Fire Speed",group: "Mass Panic Debate", valueTypes: ["percent", "absolute"], unit: "/s", base: 0.25,   clampMin: 0.05,   clampMax: 1.0,    integer: false },
    { key: "mpdBtReloadSpeed", label: "MPD — Truth Bullet Reload Speed",group: "Mass Panic Debate", valueTypes: ["percent", "absolute"], unit: "/s", base: 0.125,  clampMin: 0.02,   clampMax: 1.0,    integer: false },
    { key: "mpdDebateTimer",   label: "MPD — Debate Timer",           group: "Mass Panic Debate", valueTypes: ["percent", "absolute"], unit: "ms", base: 120000, dynamicBase: true, clampMin: 120000, clampMax: 600000, integer: true },
    { key: "aaPlayerHp",       label: "AA — Your Health",       group: "Argument Armament", valueTypes: ["percent", "absolute"], unit: "hp", base: 100,    dynamicBase: true, clampMin: 1,    clampMax: 9999,   integer: true },
    { key: "aaEnemyHp",        label: "AA — Enemy Health",      group: "Argument Armament", valueTypes: ["percent", "absolute"], unit: "hp", base: 100,    dynamicBase: true, clampMin: 1,    clampMax: 9999,   integer: true },
    { key: "aaDamage",         label: "AA — Damage Dealt",      group: "Argument Armament", valueTypes: ["percent", "absolute"], unit: "hp", base: 1,      clampMin: 1,      clampMax: 999,    integer: true },
    { key: "aaDamageTaken",    label: "AA — Damage Taken",      group: "Argument Armament", valueTypes: ["percent"],             unit: "×",  base: 1,      clampMin: 0,      clampMax: 5,      integer: false, lowerIsBetter: true },
    { key: "aaAmmo",           label: "AA — Ammo Capacity",     group: "Argument Armament", valueTypes: ["percent", "absolute"], unit: "",   base: 6,      clampMin: 1,      clampMax: 30,     integer: true },
    { key: "aaReloadTime",     label: "AA — Reload Time",       group: "Argument Armament", valueTypes: ["percent", "absolute"], unit: "ms", base: 500,    clampMin: 100,    clampMax: 3000,   integer: true, lowerIsBetter: true },
    { key: "aaTimer",          label: "AA — Timer",             group: "Argument Armament", valueTypes: ["percent", "absolute"], unit: "ms", base: 90000,  clampMin: 15000,  clampMax: 600000, integer: true },
    { key: "hangmanSpeed",     label: "HMG — Letter Speed", group: "Hangman's Gambit",  valueTypes: ["percent", "absolute"], unit: "px/s", base: 155, dynamicBase: true, clampMin: 30,   clampMax: 600,    integer: false, lowerIsBetter: true },
    { key: "hangmanSpotlight", label: "HMG — Spotlight Size",group: "Hangman's Gambit", valueTypes: ["percent"],             unit: "×",  base: 1,      clampMin: 0.25,   clampMax: 4.0,    integer: false },
    { key: "hangmanHealth",    label: "HMG — Your Health",  group: "Hangman's Gambit",  valueTypes: ["percent", "absolute"], unit: "hp", base: 7,      dynamicBase: true, clampMin: 1,    clampMax: 99,     integer: true },
    { key: "hangmanConcDrain", label: "HMG — Concentration Consumption", group: "Hangman's Gambit", valueTypes: ["percent"], unit: "/s", base: 0.3333, clampMin: 0.05, clampMax: 1.0, integer: false, lowerIsBetter: true },
    { key: "hangmanConcRegen", label: "HMG — Concentration Regeneration", group: "Hangman's Gambit", valueTypes: ["percent"], unit: "/s", base: 0.1,    clampMin: 0.02, clampMax: 1.0, integer: false },
    { key: "hangmanTimer",     label: "HMG — Timer",        group: "Hangman's Gambit",  valueTypes: ["percent", "absolute"], unit: "s",  base: 120,    dynamicBase: true, clampMin: 30,   clampMax: 1200,   integer: true },
    { key: "mindMinePenalty",  label: "MDM — Incorrect Block Penalty", group: "Mind Mine", valueTypes: ["percent", "absolute"], unit: "s", base: 10,  clampMin: 0,    clampMax: 120,    integer: true, lowerIsBetter: true },
    { key: "mindMineTimer",    label: "MDM — Timer",        group: "Mind Mine",         valueTypes: ["percent", "absolute"], unit: "s",  base: 120,    dynamicBase: true, clampMin: 30,   clampMax: 1200,   integer: true },
    { key: "scrumTimer",       label: "SDB — Timer",        group: "Scrum Debate",      valueTypes: ["percent", "absolute"], unit: "ms", base: 180000, dynamicBase: true, clampMin: 30000, clampMax: 600000, integer: true },
    { key: "scrumHealth",      label: "SDB — Your Health",  group: "Scrum Debate",      valueTypes: ["percent", "absolute"], unit: "hp", base: 3,      clampMin: 1,      clampMax: 99,     integer: true },
    { key: "qthTimer",         label: "QTH — Timer",        group: "Question Truth",    valueTypes: ["percent", "absolute"], unit: "s",  base: 0,      dynamicBase: true, clampMin: 0,    clampMax: 1200,   integer: true },
    { key: "qthHealth",        label: "QTH — Your Health",  group: "Question Truth",    valueTypes: ["percent", "absolute"], unit: "hp", base: 5,      clampMin: 1,      clampMax: 99,     integer: true },
    { key: "qttTimer",         label: "QTT — Timer",        group: "Question Time",     valueTypes: ["percent", "absolute"], unit: "s",  base: 30,     dynamicBase: true, clampMin: 0,    clampMax: 1200,   integer: true },
    { key: "monocoinGen",      label: "Monocoin Generation",    group: "Rewards",           valueTypes: ["percent", "absolute"], unit: "",   base: null,   dynamicBase: true, clampMin: 0,    clampMax: 1e9,    integer: true },
    { key: "playerExp",        label: "Player EXP Gain",        group: "Rewards",           valueTypes: ["percent", "absolute"], unit: "",   base: null,   dynamicBase: true, clampMin: 0,    clampMax: 1e9,    integer: true },
    { key: "trustExp",         label: "Trust Fragment Gain",    group: "Rewards",           valueTypes: ["percent", "absolute"], unit: "",   base: null,   dynamicBase: true, clampMin: 0,    clampMax: 1e9,    integer: true },
];

// Emotion-bias parameters — one per canonical emotion (kept in sync with
// vfx/vfxSystem.js VFX_MAP and vfx/emotionFontsSystem.js EMOTIONS). Unlike the
// gameplay params above these aren't base-value multipliers: their value is a
// percentage-point chance that the favored emotion is fired instead of the one
// that would otherwise play (consumed by getEmotionBias()/rollBiasedEmotion()
// in index.js, NOT resolveSkillParam). Flagged with `emotion: true`.
const SKILL_EMOTION_NAMES = [
    "realization", "surprise", "fear", "anger", "joy", "excitement",
    "sadness", "grief", "nervousness", "disgust", "embarrassment", "love",
];
for (const emo of SKILL_EMOTION_NAMES) {
    SKILL_PARAM_REGISTRY.push({
        key: `emotion_${emo}`,
        label: `Emotion: ${emo.charAt(0).toUpperCase()}${emo.slice(1)}`,
        group: "Influence Character Emotion Chance",
        valueTypes: ["percent"],
        unit: "% chance",
        base: null,
        emotion: true,
        emotionName: emo,
        clampMin: 0,
        clampMax: 100,
        integer: false,
    });
}

export const SKILL_PARAM_MAP = Object.fromEntries(SKILL_PARAM_REGISTRY.map(p => [p.key, p]));

// Pure modifier application + clamp. Shared by the resolver in index.js.
//   base * (1 + percent/100) + absolute, clamped to the parameter's safe range.
export function applySkillModifier(base, mod, { clampMin = -Infinity, clampMax = Infinity, integer = false } = {}) {
    const m = mod || {};
    let v = Number(base) * (1 + (Number(m.percent) || 0) / 100) + (Number(m.absolute) || 0);
    if (!Number.isFinite(v)) v = Number(base);
    v = Math.min(clampMax, Math.max(clampMin, v));
    return integer ? Math.round(v) : v;
}

// ---------------------------------------------------------------------------
// Default Custom Skills — canonical Danganronpa cast skills, seeded once into
// inventory.customSkills (see loadInventoryState). Each maps the original skill
// to the closest tunable effect(s); some original effects (lock-on, auto-target,
// statement-count reduction, gauge "recovery") have no dedicated parameter, so
// they are approximated and the flavour is preserved in the description.
// "Focus Gauge" ≈ concentration/bullet-time meter; "Influence Gauge" ≈ debate
// health; "Bullet Time Battle" is treated as the Non-Stop Debate shooting.
const _fx = (parameter, valueType, value) => ({ parameter, valueType, value });
// Trial-wide health (Influence Gauge) boost across the battle minigames.
const _influence = (pct) => [
    _fx("hangmanHealth", "percent", pct), _fx("aaPlayerHp", "percent", pct),
    _fx("scrumHealth", "percent", pct), _fx("qthHealth", "percent", pct),
];
// Focus Gauge "lasts longer" — slower concentration drain.
const _focusCapacity = (pct) => [ _fx("btFireSpeed", "percent", -pct), _fx("hangmanConcDrain", "percent", -pct) ];
// Focus Gauge "recovers faster" — quicker concentration regen.
const _focusRegen = (pct) => [ _fx("btReloadSpeed", "percent", pct), _fx("hangmanConcRegen", "percent", pct) ];

const DEFAULT_SKILLS = [
    { id: "custom_skill_def_extraordinary_focus", name: "Extraordinary Focus", rarity: "N", skillPointCost: 2, cost: 8,  effects: _focusCapacity(15),
      description: "Your Focus drains a little more slowly while concentrating in Non-Stop Debate and Hangman's Gambit." },
    { id: "custom_skill_def_ambidextrousness", name: "Ambidextrousness", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("reticuleSize", "percent", 30)],
      description: "Enlarges your Non-Stop Debate reticule, making statements easier to lock onto." },

    { id: "custom_skill_def_cool_and_composed", name: "Cool and Composed", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("reticuleSway", "percent", -20)],
      description: "Steadies your Non-Stop Debate reticule, reducing its sway a little." },
    { id: "custom_skill_def_envious_influence", name: "Envious Influence", rarity: "R", skillPointCost: 4, cost: 16, effects: _influence(50),
      description: "Greatly increases your health across Class Trial battles." },

    { id: "custom_skill_def_raise", name: "Raise", rarity: "R", skillPointCost: 0, cost: 12, effects: [_fx("monocoinGen", "percent", 200)],
      description: "Triples the Monocoins you earn." },
    { id: "custom_skill_def_menacing_focus", name: "Menacing Focus", rarity: "R", skillPointCost: 4, cost: 16, effects: _focusCapacity(25),
      description: "Your Focus drains much more slowly while concentrating in Non-Stop Debate and Hangman's Gambit." },

    { id: "custom_skill_def_algorithm", name: "Algorithm", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("debateTimer", "percent", 25)],
      description: "Extends the Non-Stop Debate time limit." },
    { id: "custom_skill_def_cheat_code", name: "Cheat Code", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("debateTimer", "percent", 400)],
      description: "Stretches the Non-Stop Debate time limit to its maximum, so it barely runs down." },

    { id: "custom_skill_def_handiwork", name: "Handiwork", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("aaReloadTime", "percent", -50), _fx("btReloadSpeed", "percent", 100)],
      description: "Halves your Argument Armament reload time and sharply speeds Non-Stop Debate Focus recovery." },
    { id: "custom_skill_def_delusion", name: "Delusion", rarity: "SR", skillPointCost: 5, cost: 20, effects: _influence(30),
      description: "Increases your health across Class Trial battles." },

    { id: "custom_skill_def_trance", name: "Trance", rarity: "R", skillPointCost: 4, cost: 16, effects: _focusRegen(40),
      description: "Your Focus recovers more quickly in Non-Stop Debate and Hangman's Gambit." },
    { id: "custom_skill_def_charisma", name: "Charisma", rarity: "SR", skillPointCost: 5, cost: 20, effects: _influence(60),
      description: "Greatly increases your health across Class Trial battles." },

    { id: "custom_skill_def_attentive_influence", name: "Attentive Influence", rarity: "N", skillPointCost: 2, cost: 8, effects: _influence(20),
      description: "Slightly increases your health across Class Trial battles." },
    { id: "custom_skill_def_steel_patience", name: "Steel Patience", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("aaDamageTaken", "percent", -40)],
      description: "Reduces the damage you take in Argument Armament." },

    { id: "custom_skill_def_neural_liberation", name: "Neural Liberation", rarity: "SR", skillPointCost: 5, cost: 20, effects: _focusCapacity(35),
      description: "Your Focus drains drastically more slowly while concentrating in Non-Stop Debate and Hangman's Gambit." },

    { id: "custom_skill_def_robot_jock", name: "Robot Jock", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("btReloadSpeed", "percent", 50)],
      description: "Speeds up your Truth Bullet recharge in Non-Stop Debate." },
    { id: "custom_skill_def_kinetic_depth_perception", name: "Kinetic Depth Perception", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("reticuleSize", "percent", 40)],
      description: "Enlarges your Non-Stop Debate reticule, making weak points easier to hit." },

    { id: "custom_skill_def_downshift", name: "Downshift", rarity: "N", skillPointCost: 1, cost: 6, effects: [_fx("reticuleSway", "percent", -30)],
      description: "Slows your Non-Stop Debate reticule, steadying its sway." },
    { id: "custom_skill_def_upshift", name: "Upshift", rarity: "N", skillPointCost: 1, cost: 6, effects: [_fx("reticuleSway", "percent", 30)],
      description: "Speeds up your Non-Stop Debate reticule, increasing its sway." },

    { id: "custom_skill_def_breathing_technique", name: "Breathing Technique", rarity: "R", skillPointCost: 4, cost: 16, effects: _focusRegen(50),
      description: "Your Focus recovers quickly in Non-Stop Debate and Hangman's Gambit." },
    { id: "custom_skill_def_tranquility", name: "Tranquility", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("reticuleSway", "percent", -100)],
      description: "Completely steadies your Non-Stop Debate reticule, removing all sway." },

    { id: "custom_skill_def_melodious_voice", name: "Melodious Voice", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("aaDamage", "absolute", 2)],
      description: "Increases the damage your shots deal in Argument Armament." },

    { id: "custom_skill_def_vocabulary", name: "Vocabulary", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("aaAmmo", "absolute", 3)],
      description: "Increases your ammo capacity in Argument Armament." },

    { id: "custom_skill_def_crystal_prediction", name: "Crystal Prediction", rarity: "SR", skillPointCost: 5, cost: 20, effects: [_fx("reticuleSize", "percent", 30), _fx("debateTimer", "percent", 30)],
      description: "Enlarges your Non-Stop Debate reticule and extends its time limit." },
    { id: "custom_skill_def_lost_in_thought", name: "Lost in Thought", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("debateTimer", "percent", 50), _fx("hangmanTimer", "percent", 50), _fx("aaTimer", "percent", 50)],
      description: "Extends the time limit in Non-Stop Debate, Hangman's Gambit, and Argument Armament." },

    { id: "custom_skill_def_trigger_happy", name: "Trigger Happy", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("btReloadSpeed", "percent", 60)],
      description: "Quickens your Truth Bullet recharge in Non-Stop Debate." },

    // --- Second skill set. Skills sharing a name with one above are omitted to
    // avoid duplicate effects, as are skills for minigames not present here.
    // Some effects are approximated onto the closest supported battle.
    { id: "custom_skill_def_peach_muscle", name: "Peach Muscle", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("btReloadSpeed", "percent", 70)],
      description: "Greatly speeds up your Truth Bullet recharge in Non-Stop Debate." },
    { id: "custom_skill_def_sting", name: "Sting", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("monocoinGen", "percent", 50)],
      description: "Increases the Monocoins you earn." },
    { id: "custom_skill_def_silver_spoon", name: "Silver Spoon", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("aaDamageTaken", "percent", -60)],
      description: "Greatly reduces the damage you take in Argument Armament." },
    { id: "custom_skill_def_infinity_unlimited_flame", name: "Infinity Unlimited Flame", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("btFireSpeed", "percent", -50)],
      description: "Your Focus drains much more slowly while concentrating in Non-Stop Debate." },
    { id: "custom_skill_def_pivot_turn", name: "Pivot Turn", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("mindMinePenalty", "percent", -100)],
      description: "Removes the time penalty for mistakes in Mind Mine." },
    { id: "custom_skill_def_auto_focus", name: "Auto Focus", rarity: "R", skillPointCost: 3, cost: 12, effects: [_fx("reticuleSize", "percent", 50)],
      description: "Greatly enlarges your Non-Stop Debate reticule, making weak points far easier to hit." },
    { id: "custom_skill_def_silent_massage", name: "Silent Massage", rarity: "SR", skillPointCost: 5, cost: 20, effects: [_fx("btReloadSpeed", "percent", 60), _fx("hangmanConcRegen", "percent", 60)],
      description: "Your Focus recovers much faster in Non-Stop Debate and Hangman's Gambit." },
    { id: "custom_skill_def_power_of_life_and_death", name: "Power of Life and Death", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("aaEnemyHp", "percent", -40)],
      description: "Weakens your opponent in Argument Armament." },
    { id: "custom_skill_def_lightning_flash", name: "Lightning Flash", rarity: "SR", skillPointCost: 5, cost: 20, effects: [_fx("aaDamage", "percent", 100)],
      description: "Doubles the damage your shots deal in Argument Armament." },
    { id: "custom_skill_def_tasting", name: "Tasting", rarity: "SR", skillPointCost: 5, cost: 20, effects: [_fx("reticuleSize", "percent", 35), _fx("debateTimer", "percent", 35)],
      description: "Enlarges your Non-Stop Debate reticule and extends its time limit." },
    { id: "custom_skill_def_excellent_blade", name: "Excellent Blade", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("aaDamage", "absolute", 3)],
      description: "Increases the damage your shots deal in Argument Armament." },
    { id: "custom_skill_def_fine_sword", name: "Fine Sword", rarity: "SR", skillPointCost: 6, cost: 24, effects: [_fx("aaDamage", "absolute", 6)],
      description: "Greatly increases the damage your shots deal in Argument Armament." },
    { id: "custom_skill_def_moodmaker", name: "Moodmaker", rarity: "SR", skillPointCost: 6, cost: 24, effects: [_fx("aaEnemyHp", "percent", -25)],
      description: "Weakens your opponent in Argument Armament." },

    // --- Third skill set. Name-duplicates and skills for absent minigames are
    // omitted. Each effect array is unique; some effects are approximated onto
    // the nearest supported minigame.
    { id: "custom_skill_def_minds_eye", name: "Mind's Eye", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("reticuleSize", "percent", 20)],
      description: "Enlarges your Non-Stop Debate reticule, revealing weak points more easily." },
    { id: "custom_skill_def_saint_mikos_ability", name: "Saint Miko's Ability", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("mpdReticuleSize", "percent", 30)],
      description: "Enlarges your Mass Panic Debate reticule." },
    { id: "custom_skill_def_librarians_glare", name: "Librarian's Glare", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("mpdReticuleSway", "percent", -40)],
      description: "Steadies your Mass Panic Debate reticule, reducing its sway." },
    { id: "custom_skill_def_first_strike", name: "First Strike", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("scrumTimer", "percent", 25)],
      description: "Extends the time limit in Scrum Debate." },
    { id: "custom_skill_def_just_a_peek", name: "Just a Peek", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("hangmanSpotlight", "percent", 50)],
      description: "Enlarges the concentration spotlight in Hangman's Gambit." },
    { id: "custom_skill_def_safety_first", name: "Safety First", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("mindMinePenalty", "percent", -50), _fx("mindMineTimer", "percent", 20)],
      description: "Halves the mistake time penalty and extends the time limit in Mind Mine." },
    { id: "custom_skill_def_high_tension", name: "High Tension", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("aaDamage", "percent", 50)],
      description: "Boosts the damage your shots deal in Argument Armament." },
    { id: "custom_skill_def_atuas_intuition", name: "Atua's Intuition", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("hangmanSpotlight", "percent", 100)],
      description: "Doubles the size of the concentration spotlight in Hangman's Gambit." },
    { id: "custom_skill_def_wild_awakening", name: "Wild Awakening", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("aaDamage", "percent", 75)],
      description: "Greatly boosts the damage your shots deal in Argument Armament." },
    { id: "custom_skill_def_abracadabra", name: "Abracadabra", rarity: "SR", skillPointCost: 24, cost: 96, effects: [_fx("reticuleSize", "percent", 60)],
      description: "Greatly enlarges your Non-Stop Debate reticule, making weak points far easier to hit." },
    { id: "custom_skill_def_digital_love", name: "Digital Love", rarity: "SR", skillPointCost: 32, cost: 128, effects: [_fx("reticuleSize", "percent", 70)],
      description: "Massively enlarges your Non-Stop Debate reticule, all but locking on to weak points." },
    { id: "custom_skill_def_piano_duet", name: "Piano Duet", rarity: "R", skillPointCost: 5, cost: 20, effects: [_fx("scrumHealth", "percent", 40)],
      description: "Increases your health in Scrum Debate." },
    { id: "custom_skill_def_bed_making", name: "Bed Making", rarity: "SR", skillPointCost: 16, cost: 64, effects: _focusRegen(70),
      description: "Your Focus recovers very quickly in Non-Stop Debate and Hangman's Gambit." },
    { id: "custom_skill_def_kind_lie", name: "Kind Lie", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("aaDamageTaken", "percent", -30)],
      description: "Reduces the damage you take in Argument Armament." },
    { id: "custom_skill_def_supernatural_phenomenon", name: "Supernatural Phenomenon", rarity: "SR", skillPointCost: 16, cost: 64, effects: [_fx("reticuleSize", "percent", 55)],
      description: "Greatly enlarges your Non-Stop Debate reticule, drawing your aim onto weak points." },
    { id: "custom_skill_def_financing", name: "Financing", rarity: "SR", skillPointCost: 32, cost: 128, effects: [_fx("monocoinGen", "percent", 100)],
      description: "Doubles the Monocoins you earn." },
    { id: "custom_skill_def_xxx_ray_goggles", name: "XXX-Ray Goggles", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("mindMineTimer", "percent", 30)],
      description: "Extends the time limit in Mind Mine." },
    { id: "custom_skill_def_viability", name: "Viability", rarity: "SR", skillPointCost: 15, cost: 60, effects: _influence(25),
      description: "Modestly increases your health across Class Trial battles." },
    { id: "custom_skill_def_killer_smash", name: "Killer Smash", rarity: "SR", skillPointCost: 8, cost: 32, effects: [_fx("reticuleSize", "percent", 25)],
      description: "Enlarges your Non-Stop Debate reticule a little." },
    { id: "custom_skill_def_laws_of_the_globe", name: "Laws of the Globe", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("aaReloadTime", "percent", -30)],
      description: "Speeds up reloading in Argument Armament." },
    { id: "custom_skill_def_2d_love", name: "2D Love", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("mindMinePenalty", "percent", -40)],
      description: "Reduces the mistake time penalty in Mind Mine." },
    { id: "custom_skill_def_laser_beam", name: "Laser Beam", rarity: "SR", skillPointCost: 8, cost: 32, effects: [_fx("btReloadSpeed", "percent", 80)],
      description: "Rapidly speeds up your Truth Bullet recharge in Non-Stop Debate." },
    { id: "custom_skill_def_machine_gun", name: "Machine Gun", rarity: "SR", skillPointCost: 8, cost: 32, effects: [_fx("btReloadSpeed", "percent", 90)],
      description: "Drastically speeds up your Truth Bullet recharge in Non-Stop Debate." },
    { id: "custom_skill_def_shotgun", name: "Shotgun", rarity: "SR", skillPointCost: 16, cost: 64, effects: [_fx("reticuleSize", "percent", 45)],
      description: "Enlarges your Non-Stop Debate reticule for wider shots." },
    { id: "custom_skill_def_grenade", name: "Grenade", rarity: "SR", skillPointCost: 24, cost: 96, effects: [_fx("reticuleSize", "percent", 65)],
      description: "Greatly enlarges your Non-Stop Debate reticule for powerful shots." },
    { id: "custom_skill_def_point_blank", name: "Point Blank", rarity: "SR", skillPointCost: 8, cost: 32, effects: [_fx("reticuleSize", "percent", 15)],
      description: "Slightly enlarges your Non-Stop Debate reticule." },
    { id: "custom_skill_def_initial_a", name: "Initial A", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("hangmanSpeed", "percent", -20)],
      description: "Slows the scrolling letters in Hangman's Gambit." },
    { id: "custom_skill_def_zanbato", name: "Zanbato", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("aaDamage", "absolute", 4)],
      description: "Increases the damage your shots deal in Argument Armament." },
    { id: "custom_skill_def_operation_giant_roller", name: "Operation Giant Roller", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("mindMinePenalty", "percent", -30)],
      description: "Reduces the mistake time penalty in Mind Mine." },
    { id: "custom_skill_def_undo_trois", name: "Undo Trois", rarity: "R", skillPointCost: 4, cost: 16, effects: [_fx("mindMinePenalty", "percent", -20)],
      description: "Reduces the mistake time penalty in Mind Mine a little." },
    { id: "custom_skill_def_beat_heaven", name: "Beat Heaven", rarity: "R", skillPointCost: 6, cost: 24, effects: [_fx("aaDamageTaken", "percent", -50)],
      description: "Reduces the damage you take in Argument Armament." },

    // --- Emotion-sway skills. Each raises the chance of one emotion being fired by 25%.
    { id: "custom_skill_def_sex_appeal", name: "Sex Appeal", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_love", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Love emotion by 25%." },
    { id: "custom_skill_def_intuitive_aura", name: "Intuitive Aura", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_realization", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Realization emotion by 25%." },
    { id: "custom_skill_def_plot_twister", name: "Plot Twister", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_surprise", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Surprise emotion by 25%." },
    { id: "custom_skill_def_menacing_menacing_menacing", name: "Menacing Menacing Menacing", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_fear", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Fear emotion by 25%." },
    { id: "custom_skill_def_certified_asshole", name: "Certified Asshole", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_anger", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Anger emotion by 25%." },
    { id: "custom_skill_def_comedian", name: "Comedian", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_joy", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Joy emotion by 25%." },
    { id: "custom_skill_def_electrifying_presence", name: "Electrifying Presence", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_excitement", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Excitement emotion by 25%." },
    { id: "custom_skill_def_major_bummer", name: "Major Bummer", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_sadness", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Sadness emotion by 25%." },
    { id: "custom_skill_def_black_hole_heart", name: "Black Hole Heart", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_grief", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Grief emotion by 25%." },
    { id: "custom_skill_def_intimidation_factor", name: "Intimidation Factor", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_nervousness", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Nervousness emotion by 25%." },
    { id: "custom_skill_def_overwhelming_stench", name: "Overwhelming Stench", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_disgust", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Disgust emotion by 25%." },
    { id: "custom_skill_def_cringelord", name: "Cringelord", rarity: "N", skillPointCost: 2, cost: 8, effects: [_fx("emotion_embarrassment", "percent", 25)],
      description: "Increases the chance of characters being swayed to the Embarrassment emotion by 25%." },
];

// Default cast skills are seeded into customSkills but are treated as BASE skills:
// they cannot be deleted and don't show the "CUSTOM" tag. Identified by id prefix.
const isBaseSkill = (id) => typeof id === "string" && id.startsWith("custom_skill_def_");

export function createItemsPanelController({ extensionName, extension_settings, saveSettingsDebounced, playSfx, getSfx, onGiftUseRequest }) {
    let activeItemsFilter = "all";
    let activeItemsSort = "recent";
    let selectedItemId = null;
    let itemSearchQuery = "";

    const placeholderSkillShopCatalog = [
        { id: "shop_skill_clairvoyance", name: "Clairvoyance", cost: 10, skillPointCost: 2, teaserEffect: "Displays HP values for you and your opponent during Argument Armament." },
        { id: "shop_skill_beta_block", name: "Beta Block", cost: 10, skillPointCost: 2, teaserEffect: "Shows the number of hits required to break column locks during Mass Panic Debate." },
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
        ext.inventory.customSkills ||= {};
        ext.inventory.itemImages ||= {};

        // Seed and keep the canonical base skills in sync. A per-id ledger records
        // which defaults have been offered, so newly-added defaults reach existing
        // saves while a default the player deletes stays deleted. Base skills are
        // not user-editable, so a present one is always refreshed to the canonical
        // definition (this also brings old saves' descriptions up to date).
        ext.inventory._seededDefaultSkillIds ||= [];
        const seededDefaults = new Set(ext.inventory._seededDefaultSkillIds);
        // Migrate the old one-shot boolean: anything already present counts as seeded.
        if (ext.inventory._defaultSkillsSeeded) {
            for (const id of Object.keys(ext.inventory.customSkills)) {
                if (id.startsWith("custom_skill_def_")) seededDefaults.add(id);
            }
            delete ext.inventory._defaultSkillsSeeded;
        }
        let seededAny = false;
        for (const s of DEFAULT_SKILLS) {
            const canonical = {
                name: s.name,
                rarity: s.rarity,
                description: s.description,
                cost: s.cost,
                skillPointCost: s.skillPointCost,
                effects: s.effects.map(e => ({ ...e })),
            };
            const existing = ext.inventory.customSkills[s.id];
            if (existing) {
                // Refresh in place if anything drifted from the canonical definition.
                if (JSON.stringify(existing) !== JSON.stringify(canonical)) {
                    ext.inventory.customSkills[s.id] = canonical;
                    seededAny = true;
                }
            } else if (!seededDefaults.has(s.id)) {
                ext.inventory.customSkills[s.id] = canonical;
                seededAny = true;
            }
            seededDefaults.add(s.id);
        }
        if (seededDefaults.size !== ext.inventory._seededDefaultSkillIds.length) seededAny = true;
        if (seededAny) {
            ext.inventory._seededDefaultSkillIds = [...seededDefaults];
            saveSettingsDebounced();
        }

        delete ext.inventory.skills.s_micro_focus;
        delete ext.inventory.skills.s_false_lead;
        delete ext.inventory.keyItems.k_student_profile;

        // Retired placeholder skills — clean up any owned/equipped entries in old saves.
        for (const retiredId of ["shop_skill_lie_detector_earring", "shop_skill_dramatic_pause_plus", "shop_skill_monokuma_warranty", "shop_skill_protagonist_hair_flip", "shop_skill_seating_plan_copy"]) {
            delete ext.inventory.skills?.[retiredId];
            delete ext.inventory.equippedSkills?.[retiredId];
        }
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

        const customSkills = Object.entries(inv.customSkills || {})
            .filter(([id]) => Number(inv.skills?.[id] || 0) > 0)
            .map(([id, data]) => ({
                id,
                name: data.name,
                description: data.description || summarizeSkillEffects(data.effects),
                category: "skill",
                rarity: data.rarity || "N",
                effect: summarizeSkillEffects(data.effects),
                quantity: 1,
                catalogIndex: -1,
                isCustom: !isBaseSkill(id),
            }));

        const items = [...catalogItems, ...customKeyItems, ...customGifts, ...customSkills];

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
        const builtIn = placeholderSkillShopCatalog.find(skill => skill.id === skillId);
        if (builtIn) return builtIn;
        const custom = extension_settings[extensionName].inventory?.customSkills?.[skillId];
        if (custom) {
            return {
                id: skillId,
                name: custom.name,
                cost: Number(custom.cost || 0),
                skillPointCost: Number(custom.skillPointCost || 0),
                teaserEffect: summarizeSkillEffects(custom.effects) || (custom.description || ""),
                isCustom: !isBaseSkill(skillId),
            };
        }
        return null;
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

    // --- Custom Skills -----------------------------------------------------
    function sanitizeSkillEffects(effects) {
        if (!Array.isArray(effects)) return [];
        return effects
            .map(e => {
                const param = SKILL_PARAM_MAP[e?.parameter];
                if (!param) return null;
                let valueType = String(e?.valueType || param.valueTypes[0]);
                if (!param.valueTypes.includes(valueType)) valueType = param.valueTypes[0];
                const value = Number(e?.value);
                if (!Number.isFinite(value)) return null;
                return {
                    parameter: param.key,
                    valueType,
                    value,
                };
            })
            .filter(Boolean);
    }

    function summarizeSkillEffects(effects) {
        const list = sanitizeSkillEffects(effects);
        if (!list.length) return "";
        return list
            .map(e => {
                const label = SKILL_PARAM_MAP[e.parameter]?.label || e.parameter;
                const sign = e.value >= 0 ? "+" : "";
                const suffix = e.valueType === "percent" ? "%" : "";
                return `${label} ${sign}${e.value}${suffix}`;
            })
            .join(" · ");
    }

    function createCustomSkill({ name, rarity, description, cost, skillPointCost, effects, imageBase64 } = {}) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        const id = "custom_skill_" + Date.now();
        inv.customSkills[id] = {
            name: String(name || "").trim() || "Custom Skill",
            rarity: rarity || "N",
            description: String(description || "").trim(),
            cost: Math.max(0, Math.round(Number(cost) || 0)),
            skillPointCost: Math.max(0, Math.round(Number(skillPointCost) || 0)),
            effects: sanitizeSkillEffects(effects),
        };
        if (imageBase64) inv.itemImages[id] = imageBase64;
        saveSettingsDebounced();
        return id;
    }

    function updateCustomSkill(id, patch = {}) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        const skill = inv.customSkills?.[id];
        if (!skill) return false;
        if (patch.name !== undefined) skill.name = String(patch.name).trim() || skill.name;
        if (patch.rarity !== undefined) skill.rarity = patch.rarity || skill.rarity;
        if (patch.description !== undefined) skill.description = String(patch.description).trim();
        if (patch.cost !== undefined) skill.cost = Math.max(0, Math.round(Number(patch.cost) || 0));
        if (patch.skillPointCost !== undefined) skill.skillPointCost = Math.max(0, Math.round(Number(patch.skillPointCost) || 0));
        if (patch.effects !== undefined) skill.effects = sanitizeSkillEffects(patch.effects);
        if (patch.imageBase64) inv.itemImages[id] = patch.imageBase64;
        saveSettingsDebounced();
        return true;
    }

    function removeCustomSkill(id) {
        loadInventoryState();
        const inv = extension_settings[extensionName].inventory;
        if (!inv.customSkills?.[id]) return false;
        if (isBaseSkill(id)) return false;  // base (default cast) skills are not erasable
        // Refund SP if it was equipped before removing.
        if (isSkillEquipped(id)) unequipSkill(id);
        delete inv.customSkills[id];
        delete inv.skills?.[id];
        delete inv.equippedSkills?.[id];
        delete inv.itemImages?.[id];
        saveSettingsDebounced();
        return true;
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

        $(document).off("keydown.itemsNav").on("keydown.itemsNav", (e) => {
            if (!$(`.monopad-panel-content[data-panel="skills"]`).is(":visible")) return;
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            let navItems = getOwnedItems();
            if (itemSearchQuery) {
                const q = itemSearchQuery.toLowerCase();
                navItems = navItems.filter(i => i.name.toLowerCase().includes(q));
            }
            if (!navItems.length) return;
            const idx = navItems.findIndex(i => i.id === selectedItemId);
            if (idx === -1) return;
            const newIdx = e.key === "ArrowRight"
                ? (idx + 1) % navItems.length
                : (idx - 1 + navItems.length) % navItems.length;
            selectedItemId = navItems[newIdx].id;
            renderInventoryGrid();
        });
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

        const builtIn = placeholderSkillShopCatalog.map(skill => ({
            ...skill,
            description: getItemById(skill.id)?.description || "",
            available: trustFragments >= skill.cost,
            owned: Number(inventory.skills?.[skill.id] || 0) > 0,
            skillPointCost: Number(skill.skillPointCost || 0),
            futureEffectHook: skill.teaserEffect,
            isCustom: false,
        }));

        const custom = Object.entries(inventory.customSkills || {}).map(([id, data]) => ({
            id,
            name: data.name,
            description: data.description || "",
            cost: Number(data.cost || 0),
            skillPointCost: Number(data.skillPointCost || 0),
            teaserEffect: summarizeSkillEffects(data.effects) || (data.description || ""),
            available: trustFragments >= Number(data.cost || 0),
            owned: Number(inventory.skills?.[id] || 0) > 0,
            futureEffectHook: summarizeSkillEffects(data.effects) || (data.description || ""),
            isCustom: !isBaseSkill(id),
        }));

        return [...builtIn, ...custom];
    }

    function buySkillFromShop(skillId) {
        loadInventoryState();

        const skill = getSkillShopEntry(skillId);
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

    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function buildSkillParamOptions(selectedKey) {
        const groups = {};
        SKILL_PARAM_REGISTRY.forEach(p => { (groups[p.group] ||= []).push(p); });
        return Object.entries(groups)
            .map(([group, params]) =>
                `<optgroup label="${escapeHtml(group)}">` +
                params.map(p => `<option value="${p.key}" ${p.key === selectedKey ? "selected" : ""}>${escapeHtml(p.label)}</option>`).join("") +
                `</optgroup>`)
            .join("");
    }

    function buildValueTypeOptions(paramKey, selected) {
        const param = SKILL_PARAM_MAP[paramKey] || SKILL_PARAM_REGISTRY[0];
        return param.valueTypes
            .map(t => `<option value="${t}" ${t === selected ? "selected" : ""}>${t === "percent" ? "%" : "ABS"}</option>`)
            .join("");
    }

    function buildEffectRowHtml(effect) {
        const paramKey = effect?.parameter || SKILL_PARAM_REGISTRY[0].key;
        const valueType = effect?.valueType;
        const value = Number.isFinite(Number(effect?.value)) ? Number(effect.value) : 0;
        return `
            <div class="csk-effect-row">
                <select class="csk-effect-param">${buildSkillParamOptions(paramKey)}</select>
                <select class="csk-effect-type">${buildValueTypeOptions(paramKey, valueType)}</select>
                <input type="number" class="csk-effect-value" value="${value}" step="any">
                <button type="button" class="csk-effect-remove" title="Remove">✕</button>
            </div>`;
    }

    function renderSkillShopDetails() {
        const $detail = $("#items-detail-panel");
        if (!$detail.length) return;

        const skillRows = getSkillShopListings()
            .map(skill => `
                <div class="items-shop-entry" data-shop-skill-id="${skill.id}" data-custom="${skill.isCustom ? "1" : "0"}">
                    <div class="items-shop-entry-main">
                        <div class="items-shop-entry-name">${escapeHtml(skill.name.toUpperCase())}${skill.isCustom ? ' <span class="items-shop-entry-tag">CUSTOM</span>' : ''}</div>
                        ${skill.description ? `<div class="items-shop-entry-desc">${escapeHtml(skill.description)}</div>` : ''}
                        <div class="items-shop-entry-effect">EFFECT: ${escapeHtml((skill.futureEffectHook || "—").toUpperCase())}</div>
                        <div class="items-shop-entry-effect">EQUIP COST: ${skill.skillPointCost} SP</div>
                    </div>
                    <div class="items-shop-entry-meta">
                        <div class="items-shop-entry-cost">◈ x${skill.cost} TRUST FRAGMENT</div>
                        <button class="items-shop-entry-buy" type="button" ${skill.owned || !skill.available ? "disabled" : ""}>${skill.owned ? "OWNED" : "BUY"}</button>
                        ${skill.isCustom ? '<button class="items-shop-entry-delete" type="button" title="Delete custom skill">✕</button>' : ''}
                    </div>
                </div>
            `)
            .join("");

        $detail.html(`
            <div class="items-panel-title">SKILL SHOP</div>
            <div class="items-shop-placeholder-title">TRUST FRAGMENT EXCHANGE</div>
            <div class="items-shop-placeholder-copy">SELECT A SKILL TO PURCHASE WITH TRUST FRAGMENTS. CUSTOM SKILLS YOU CREATE APPEAR HERE TOO.</div>
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

        $detail.find(".items-shop-entry-delete").on("click", (evt) => {
            const skillId = evt.currentTarget.closest(".items-shop-entry")?.dataset.shopSkillId;
            if (!skillId) return;
            if (!removeCustomSkill(skillId)) return;

            playSfx(getSfx().click);
            renderSkillsItemsPanel();
            renderSkillShopDetails();
        });
    }

    function renderCreateSkillForm() {
        $(".csk-modal").remove();
        $(document.body).append(`
            <div class="csk-modal">
                <div class="csk-modal-window">
                    <div class="csk-modal-header">
                        <span class="csk-modal-title">CREATE CUSTOM SKILL</span>
                        <button type="button" class="csk-modal-close" title="Close">✕</button>
                    </div>
                    <div class="csk-create-panel">
                        <input class="csk-input csk-name" placeholder="SKILL NAME..." maxlength="60" autocomplete="off" spellcheck="false">
                        <textarea class="csk-input csk-desc" placeholder="DESCRIPTION (OPTIONAL)..." maxlength="300" rows="2"></textarea>
                        <div class="csk-meta-row">
                            <label class="csk-field">RARITY
                                <select class="csk-input csk-rarity"><option value="N">N</option><option value="R">R</option><option value="SR">SR</option></select>
                            </label>
                            <label class="csk-field">BUY COST (◈)
                                <input type="number" class="csk-input csk-cost" min="0" value="0">
                            </label>
                            <label class="csk-field">EQUIP COST (SP)
                                <input type="number" class="csk-input csk-sp" min="0" value="0">
                            </label>
                        </div>
                        <div class="csk-effects-head">EFFECTS (APPLIED WHILE EQUIPPED)</div>
                        <div class="csk-effects-list"></div>
                        <button type="button" class="csk-add-effect csk-add-btn">+ ADD EFFECT</button>
                        <div class="csk-create-status" id="csk-create-status"></div>
                        <div class="csk-create-actions">
                            <button type="button" class="csk-create-cancel">CANCEL</button>
                            <button type="button" class="csk-create-submit">CREATE</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        const $modal = $(".csk-modal");
        const $panel = $modal.find(".csk-create-panel");
        const closeModal = () => $modal.remove();

        // Start with one effect row ready to fill in.
        $panel.find(".csk-effects-list").append(buildEffectRowHtml());
        $panel.find(".csk-name").focus();

        $modal.find(".csk-add-effect").on("click", () => {
            $panel.find(".csk-effects-list").removeClass("csk-invalid").append(buildEffectRowHtml());
        });

        // Keep value-type options in sync with the selected parameter (delegated
        // within this modal instance, which is removed on close).
        $modal.on("change", ".csk-effect-param", (evt) => {
            const $row = $(evt.currentTarget).closest(".csk-effect-row");
            const current = $row.find(".csk-effect-type").val();
            $row.find(".csk-effect-type").html(buildValueTypeOptions(evt.currentTarget.value, current));
        });
        $modal.on("click", ".csk-effect-remove", (evt) => {
            $(evt.currentTarget).closest(".csk-effect-row").remove();
        });

        // Close on ✕, CANCEL, or backdrop click (not when clicking inside the window).
        $modal.find(".csk-modal-close, .csk-create-cancel").on("click", () => {
            playSfx(getSfx().click);
            closeModal();
        });
        $modal.on("click", (e) => {
            if (e.target === $modal[0]) closeModal();
        });

        $modal.find(".csk-create-submit").on("click", () => {
            const name = $panel.find(".csk-name").val().trim();
            const effects = $panel.find(".csk-effects-list .csk-effect-row").map((_, row) => {
                const $r = $(row);
                return { parameter: $r.find(".csk-effect-param").val(), valueType: $r.find(".csk-effect-type").val(), value: Number($r.find(".csk-effect-value").val()) };
            }).get();
            if (!name) { $modal.find("#csk-create-status").text("NAME IS REQUIRED."); $panel.find(".csk-name").focus(); return; }
            if (!effects.length) {
                $modal.find("#csk-create-status").text("ADD AT LEAST ONE EFFECT.");
                $panel.find(".csk-effects-list").addClass("csk-invalid");
                return;
            }

            createCustomSkill({
                name,
                rarity: $panel.find(".csk-rarity").val(),
                description: $panel.find(".csk-desc").val(),
                cost: $panel.find(".csk-cost").val(),
                skillPointCost: $panel.find(".csk-sp").val(),
                effects,
            });
            playSfx(getSfx().click);
            closeModal();
            renderSkillsItemsPanel();
            renderSkillShopDetails();
        });
    }

    function bindSkillShopButton() {
        const $shopButton = $("#items-skill-shop-button");
        if ($shopButton.length) {
            $shopButton.off("click").on("click", () => {
                playSfx(getSfx().click);
                renderSkillShopDetails();
            });
        }

        const $createButton = $("#items-create-skill-button");
        if ($createButton.length) {
            $createButton.off("click").on("click", () => {
                playSfx(getSfx().click);
                renderCreateSkillForm();
            });
        }
    }



    function getTrialSkillEntries() {
        loadInventoryState();
        const inventory = extension_settings[extensionName].inventory || {};
        const skillPoints = Number(inventory.skillPoints || 0);

        const catalogSkills = itemCatalog
            .filter(item => item.category === "skill" && Number(inventory.skills?.[item.id] || 0) > 0)
            .map(item => ({
                id: item.id,
                name: item.name,
                rarity: item.rarity,
                effect: item.effect,
                equipped: isSkillEquipped(item.id),
                skillPointCost: getSkillPointCost(item.id),
            }));

        const customSkills = Object.entries(inventory.customSkills || {})
            .filter(([id]) => Number(inventory.skills?.[id] || 0) > 0)
            .map(([id, data]) => ({
                id,
                name: data.name,
                rarity: data.rarity || "N",
                effect: summarizeSkillEffects(data.effects) || (data.description || ""),
                equipped: isSkillEquipped(id),
                skillPointCost: getSkillPointCost(id),
                isCustom: !isBaseSkill(id),
            }));

        const ownedSkills = [...catalogSkills, ...customSkills]
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
        createCustomSkill,
        updateCustomSkill,
        removeCustomSkill,
    };
}
