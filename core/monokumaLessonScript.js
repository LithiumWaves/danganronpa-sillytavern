export const MONOKUMA_LESSON_TITLE = "Mr. Monokuma's Lesson - The Monopad";

// Easy-to-edit transcript + flow controls.
// - sprite: filename inside assets/monokuma/
// - tab: monopad tab to switch to before line renders
// - board: true to show blackboard background
// - action: symbolic action handled by index.js
export const MONOKUMA_LESSON_STEPS = [
    {
        board: true,
        chalkTitle: MONOKUMA_LESSON_TITLE,
        sprite: "monokuma_eto.png",
        text: "Welcome, welcome everyone! I'll be walking you through the specifics on how to use your newly acquired Monopad, after all, it's essential to the Killing Game!",
    },
    {
        tab: "settings",
        sprite: "monokuma_confused.png",
        text: "Well this one's pretty self-explanatory... I don't want to dwindle too much on this one. If you don't get it, you probably shouldn't keep going.",
    },
    {
        action: "dropAndSwitchToTruth",
        tab: "truth",
        sprite: "monokuma_cheerful.png",
        text: "This is where you'll find all the exciting evidence you collect during an investigation. Let's see...",
    },
    {
        action: "spawnTruthBullet",
        sprite: "monokuma_tadam.png",
        text: "There we go! If you click on the Truth Bullet you'll be able to see it's description and even discard it.",
    },
    {
        action: "autoReadAndDeleteTruthBullet",
        sprite: "monokuma_laugh.png",
        text: "That's enough of that, moving on!",
    },
    {
        action: "dropAndSwitchToSocial",
        tab: "social",
        sprite: "monokuma_whimsyjoy.png",
        text: "Here's where you'll find information on all your fellow students and the bonds you share... once you open up a chat, characters will appear on the very obvious tab over there.",
    },
    {
        sprite: "monokuma_cheerful.png",
        text: "Just click on a name: once to open their profile and one more time to generate information. Your trust with them may deepen depending on how you spend your time with them, but it can go down as well.",
    },
    {
        sprite: "monokuma_sadback.png",
        text: "Sadly your Headmaster is not a bond you can nurture. Meanies...",
    },
    {
        action: "dropAndSwitchToSkills",
        tab: "skills",
        sprite: "monokuma_idle.png",
        text: "On that topic, we have gifts! Here's where you'll see what gifts you currently own. Simply select one, click on use...",
    },
    {
        sprite: "monokuma_tadam.png",
        text: "And you'll give it to the next character who replies! Choose well, because what you give might affect what they think of you.",
    },
    {
        action: "throwAndSwitchToMap",
        tab: "map",
        sprite: "monokuma_tweaking.png",
        text: "You want me to explain a map?! I'm not doing that!",
    },
    {
        action: "switchMapToHotelFloor1",
        sprite: "monokuma_angry.png",
        text: "That ¥ symbol over there's where my MonoMono Machine is at. You probably noticed the Monocoin counter on the Gifts tab... you gain them by finding Truth Bullets, nurturing bonds and such.",
    },
    {
        action: "shakeAndDrop",
        sprite: "monokuma_pissed.png",
        text: "You better not mess with it! Spend your hard-earned cash or get out!",
    },
    {
        action: "boardReturnBounce",
        board: true,
        sprite: "monokuma_idle.png",
        text: "Well, that should be everything. Any questions you have are probably answered on the... Github page, whatever that is.",
    },
    {
        sprite: "monokuma_eto.png",
        text: "Have fun! Kill! Get killed! Who knows what awaits you from here on out?!",
    },
];
