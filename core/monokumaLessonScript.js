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
        text: "Welcome, students. I’m your headmaster, Monokuma! Today’s lesson: how to use that shiny little Monopad you’ve been given. It’s pretty important… unless you’re planning to die early.",
    },
    {
        tab: "settings",
        sprite: "monokuma_confused.png",
        text: "This screen? It’s just settings. If you can’t figure this one out on your own… well, I guess that’s one less mystery for later.",
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
        text: "There we go! Click one to see the details… or toss it if it’s useless.",
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
        text: "Here’s where you’ll find your classmates and all those warm, fuzzy bonds you’ll form… or break.",
    },
    {
        sprite: "monokuma_cheerful.png",
        text: "Click a name once to view their profile. Click again to learn more. Spend time with them and your trust might grow… or maybe it won’t. People can be so disappointing.",
    },
    {
        sprite: "monokuma_sadback.png",
        text: "Sadly, you can’t build a bond with your beloved headmaster. Tragic, I know.",
    },
    {
        action: "dropAndSwitchToSkills",
        tab: "skills",
        sprite: "monokuma_idle.png",
        text: "Next up: gifts. Everything you’ve collected is listed right here. Pick one, press use...",
    },
    {
        sprite: "monokuma_tadam.png",
        text: "And it’ll go to the next person you interact with. Choose carefully. A good gift can win hearts. A bad one… well, you’ll see.",
    },
    {
        action: "throwAndSwitchToMap",
        tab: "map",
        sprite: "monokuma_tweaking.png",
        text: "A map? Really? You need me to explain how a map works?",
    },
    {
        action: "switchMapToHopesPeakFloor1",
        sprite: "monokuma_angry.png",
        spriteOpacity: 0.78,
        text: "That little ¥ symbol marks my MonoMono Machine. You’ve seen your Monocoins already, right? You get those from investigations, socializing… all that good stuff.",
    },
    {
        sprite: "monokuma_pissed.png",
        text: "You better not mess with it! Spend your hard-earned cash or get out!",
    },
    {
        board: true,
        sprite: "monokuma_idle.png",
        text: "That’s the basics. If you still have questions, check the… GitHub page, or whatever it’s called. Do your own homework.",
    },
    {
        board: true,
        sprite: "monokuma_eto.png",
        text: "Anyway… enjoy your stay. Make friends. Break them. Kill. Get killed. It’s all part of the fun!",
    },
];
