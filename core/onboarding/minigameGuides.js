import { extensionFolderPath } from "../constants.js";

const STYLE_ID = "dangan-minigame-guide-style";
const PROMPT_ID = "dangan-minigame-guide-prompt";
const MODAL_ID = "dangan-minigame-guide-modal";

let _isEnabled = () => true;
let _disable = () => {};

// Each tutorial: a looping gameplay clip (assets/images/minigames/tutorials/,
// see the README there to swap one), a colour theme matching the minigame,
// and one paragraph with the key terms in bold. `fallbackImage` shows if the
// clip is missing.
const TUTORIAL_CLIPS = "assets/images/minigames/tutorials";

export const MINIGAME_GUIDES = {
    hangmansGambit: {
        title: "Hangman's Gambit",
        promptName: "Hangman's Gambit",
        theme: "hangman",
        image: `${TUTORIAL_CLIPS}/hangmans-gambit.webp`,
        fallbackImage: "assets/images/minigames/hangmans-gambit-tutorial.png",
        imageAlt: "Letter spheres drifting across the screen while matching pairs fill in the anagram.",
        bodyHtml: `<p><strong>Hangman's Gambit</strong> is a minigame where you are tasked with answering a <strong>Question</strong>, visible in the bottom-right side of your screen. The answer to this question is in the form of an <strong>Anagram</strong>. During <strong>Hangman's Gambit</strong>, you will see colored spheres with letters printed on them. Clicking a sphere will load it into your <strong>Stock</strong>, at the bottom of your screen in the center. Matching two of the same letter will fire that combination into the <strong>Anagram</strong>. If the letter is correct, you'll expose a part of the Anagram! If it's wrong, however, you'll take damage to your <strong>Health</strong>. You can see your <strong>Health</strong> on the top-right, represented by hearts. Taking damage deducts <strong>Monocoins</strong>; run out of <strong>Health</strong> and it's game over! Underneath your Health you will see a green bar — by pressing either Shift key, you can activate <strong>Bullet Time</strong>, which will slow time by 50% for both the timer (Visible in the bottom left), and for the moving spheres. <strong>Bullet Time</strong> regenerates over time. Can you solve the Hangman's Gambit..?</p>`,
    },
    argumentArmament: {
        title: "Argument Armament",
        promptName: "Argument Armament",
        theme: "armament",
        yesLabel: "Yes, please!",
        noLabel: "No, let's go!",
        image: `${TUTORIAL_CLIPS}/argument-armament.webp`,
        fallbackImage: "assets/images/minigames/aa-tutorial.png",
        imageAlt: "Statements filling the 3×3 grid while the player shoots them down.",
        bodyHtml: `<p><strong>Argument Armament</strong> is a minigame where you are tasked with combating your opponent's <strong>Statements</strong>. <strong>Statements</strong> will fill the 3×3 grid at random, and zoom closer to the camera, making the grid cell glow red gradually. After a small amount of time glowing red, you will take damage to your <strong>Health</strong>. Running out of <strong>Health</strong>, visible in the bottom-right. Run out of health and it's game over! To combat a <strong>Statement</strong>, simply click the grid cell you wish to <strong>Shoot</strong>, or use the Arrow Keys and the Space bar to <strong>Shoot</strong>. <strong>Shooting</strong> consumes 1 <strong>Ammo</strong>; you can reload <strong>Ammo</strong> by pressing the R key, or clicking the <strong>Ammo</strong> icon, or by running out of <strong>Ammo</strong>. Shooting a <strong>White Statement</strong> prevents you from taking damage. Shooting a <strong>Yellow Statement</strong> prevents you from taking damage and deals damage to your opponent. Shooting a <strong>Blue Statement</strong> will deal damage to your opponent and turn the <strong>Blue Statement</strong> into a <strong>Yellow Statement</strong>. Shooting a <strong>Pink Statement</strong> will deal damage to yourself, so watch out! But don't worry! Letting a <strong>Pink Statement</strong> turn red won't deal damage to you! After enough damage is dealt, your opponent — and their <strong>Statements</strong> — will speed up. Damage your opponent enough and you'll enter the <strong>Final Question</strong>! During the <strong>Final Question</strong>, you'll need to make a <strong>Final Answer</strong> that answers the opponent's <strong>Final Question</strong> by using the Arrow Keys; there are four options, so think quickly and with confidence! Getting the <strong>Final Answer</strong> wrong or running out of time will give the opponent some <strong>Health</strong> back, and deal some damage to you, so try not to mess up! It's all or nothing now..!</p>`,
    },
    nonStopDebate: {
        title: "Non-Stop Debate",
        promptName: "a Non-Stop Debate",
        theme: "nsd",
        image: `${TUTORIAL_CLIPS}/non-stop-debate.webp`,
        imageAlt: "Statements sliding across the courtroom while the reticle aims a Truth Bullet at a glowing weak point.",
        bodyHtml: `<p>A <strong>Non-Stop Debate</strong> is where your classmates argue it out, one <strong>Statement</strong> at a time, as the lines slide across the screen. Somewhere in there is a contradiction: a <strong>Weak Point</strong>, glowing yellow. Your job is to find it and shoot it with the right <strong>Truth Bullet</strong>. Aim with the mouse and <strong>Left Click</strong> to fire. Your <strong>Truth Bullets</strong> are loaded in the cylinder in the bottom-left; press <strong>Arrow Up</strong> or <strong>Arrow Down</strong> to cycle through them before you shoot. Hitting a <strong>Weak Point</strong> ends the debate and moves on to explaining your <strong>Truth Bullet</strong>, so pick carefully! Purple floating text is <strong>White Noise</strong>: it gets in your way, and firing a Truth Bullet while you're over it costs you <strong>Health</strong> (top-right). Press <strong>Space</strong> while hovering over <strong>White Noise</strong> to blast it away with your silencer instead. White Noise covering a <strong>Weak Point</strong> also blocks your shot, so clear it first! Some lines contain glowing cyan <strong>Agree</strong> text: shoot it to back that classmate up instead, which also ends the debate. Need a closer look? Hold <strong>Left Shift</strong> for <strong>Concentration</strong>, which slows everything down until the gauge runs dry. Hold <strong>Right Shift</strong> over a <strong>Weak Point</strong> to <strong>Absorb</strong> it and turn its words into a temporary Truth Bullet, or hold <strong>Enter</strong> over one to turn it into a <strong>Lie</strong>. Holding <strong>Left Click</strong> for a moment charges a <strong>Perjury</strong> shot. Hold <strong>Escape</strong> to fast-forward through lines you've already heard, or tap it to back out. Lose all your <strong>Health</strong> and the debate breaks down, costing you <strong>Monocoins</strong>. Now... let's find that contradiction!</p>`,
    },
    massPanicDebate: {
        title: "Mass Panic Debate",
        promptName: "a Mass Panic Debate",
        theme: "mpd",
        image: `${TUTORIAL_CLIPS}/mass-panic-debate.webp`,
        imageAlt: "Three columns of statements talking over each other while the reticle hunts for the orange weak point.",
        bodyHtml: `<p>A <strong>Mass Panic Debate</strong> is a <strong>Non-Stop Debate</strong> where everyone talks at once! The screen splits into three <strong>Columns</strong>, each with its own speaker, and their <strong>Statements</strong> overlap and pile up. Somewhere in the chaos is an orange <strong>Weak Point</strong>; aim with the mouse and <strong>Left Click</strong> to shoot it with the right <strong>Truth Bullet</strong>. Cycle your <strong>Truth Bullets</strong> with <strong>Arrow Up</strong> and <strong>Arrow Down</strong>, and press <strong>Space</strong> over <strong>White Noise</strong> to clear it, just like a Non-Stop Debate. Firing while you're over <strong>White Noise</strong> costs <strong>Health</strong>. Sometimes a character <strong>Steals the Focus</strong>: the other columns <strong>Lock</strong> and you can't shoot into them. Move into the one free column, the one that lit up, and mash <strong>Space</strong> to break the lock. <strong>Left Shift</strong> slows time with <strong>Concentration</strong>, <strong>Right Shift</strong> absorbs a Weak Point into a temporary bullet, and holding <strong>Escape</strong> fast-forwards. Keep your head while everyone else is losing theirs!</p>`,
    },
    scrumDebate: {
        title: "Scrum Debate",
        promptName: "a Scrum Debate",
        theme: "scrum",
        image: `${TUTORIAL_CLIPS}/scrum-debate.webp`,
        imageAlt: "Two teams facing off while the player picks a Truth Bullet to answer the opposing claim.",
        bodyHtml: `<p>A <strong>Scrum Debate</strong> splits the class into two <strong>Teams</strong> that disagree on the case. The opposing team makes a <strong>Claim</strong>, and each claim has a highlighted <strong>Weak Spot</strong>: the part you need to answer. Choose the <strong>Truth Bullet</strong> that refutes it from the cylinder with <strong>Arrow Up</strong> and <strong>Arrow Down</strong>, then fire it with <strong>Enter</strong> or <strong>Space</strong>. A correct answer exposes the weak spot, earns you <strong>Monocoins</strong>, and moves on to the next claim. A wrong one costs a <strong>Heart</strong> and a couple of Monocoins; lose all your hearts and your side loses the scrum. Hold <strong>Shift</strong> to slow things down with <strong>Concentration</strong>, or hold <strong>Escape</strong> to speed the claims along. Debunk every claim before the <strong>Timer</strong> runs out and it's time to clinch it: an arrow appears in the middle of the screen, so press the matching <strong>Arrow Key</strong> as fast as you can to push the opposing team back. The arrow changes every few seconds, and wrong keys push you back! Win the push and the whole class comes around to your theory. Let's settle this!</p>`,
    },
    rebuttalShowdown: {
        title: "Rebuttal Showdown",
        promptName: "a Rebuttal Showdown",
        theme: "rebuttal",
        image: `${TUTORIAL_CLIPS}/rebuttal-showdown.webp`,
        imageAlt: "Statements flying at the player while a Truth Blade slashes through them.",
        bodyHtml: `<p>A <strong>Rebuttal Showdown</strong> is a one-on-one sword fight with a classmate who won't back down. Before it starts, choose your <strong>Truth Blade</strong> with <strong>Arrow Up</strong> and <strong>Arrow Down</strong>, then press <strong>Enter</strong> or click it. Your blade sits at the bottom of the screen and points toward your mouse. In the first phase, their <strong>Statements</strong> fly at you; aim and <strong>Left Click</strong> to <strong>Slash</strong> them. Each statement that gets past you counts as a <strong>Miss</strong>, and too many misses start a <strong>Duel</strong>: mash <strong>Left Click</strong> to fill the bar before time runs out, and you'll win back ten seconds. Cut through enough statements and the second phase begins. Now one statement hides a glowing <strong>Weak Point</strong>. Switch blades with <strong>Arrow Up</strong> and <strong>Arrow Down</strong> if you need to, and <strong>Right Click</strong> the weak point with the right blade to cut it down for good! Hold <strong>Shift</strong> to <strong>Concentrate</strong> and slow everything down while the gauge lasts. If the <strong>Timer</strong> runs out, the showdown starts over. Show them the sharpness of your argument!</p>`,
    },
    questionTruth: {
        title: "Question Truth",
        promptName: "Question Truth",
        theme: "questionTruth",
        image: `${TUTORIAL_CLIPS}/question-truth.webp`,
        imageAlt: "The Truth Bullet list beside the question, with one bullet being picked.",
        bodyHtml: `<p><strong>Question Truth</strong> asks you a <strong>Question</strong> about the case, shown at the top-right. Your <strong>Truth Bullets</strong> are listed on the left; hover over or use <strong>Arrow Up</strong> and <strong>Arrow Down</strong> to read each one's description, then <strong>Click</strong> it or press <strong>Enter</strong> to answer with it. There's no confirm step, so be sure before you choose! A correct answer earns you <strong>Monocoins</strong>. A wrong one costs <strong>Health</strong>, shown as hearts in the <strong>Status</strong> panel; run out and you fail. Stuck? Press <strong>HINT</strong> to reveal the first and last letters of the answer. If there's a <strong>Timer</strong> in the bottom-right, answer before it hits zero. What's the truth?</p>`,
    },
    questionTime: {
        title: "Question Time",
        promptName: "Question Time",
        theme: "questionTime",
        image: `${TUTORIAL_CLIPS}/question-time.webp`,
        imageAlt: "A question with four numbered answers and a countdown timer.",
        bodyHtml: `<p><strong>Question Time</strong> puts a <strong>Question</strong> on screen with four possible <strong>Answers</strong> and a <strong>Timer</strong> counting down below them. <strong>Click</strong> an answer, press its number (<strong>1</strong> to <strong>4</strong>), or move with <strong>Arrow Up</strong> and <strong>Arrow Down</strong> and press <strong>Enter</strong>. A correct answer passes and earns you <strong>Monocoins</strong> and <strong>XP</strong>. A wrong one crosses that answer out and costs a heart of <strong>Health</strong>, shown in the <strong>Status</strong> panel; you can try again with what's left. Run out of <strong>Health</strong> or let the <strong>Timer</strong> hit zero and you fail. Think fast!</p>`,
    },
    mindMine: {
        title: "Mind Mine",
        promptName: "Mind Mine",
        theme: "mindMine",
        image: `${TUTORIAL_CLIPS}/mind-mine.webp`,
        imageAlt: "A grid of silver, gold and pink blocks breaking apart to reveal hidden sentences.",
        bodyHtml: `<p><strong>Mind Mine</strong> is a puzzle where your thoughts are buried under a wall of <strong>Blocks</strong>. Hidden underneath are a few <strong>Sentences</strong>; one of them is the idea you're looking for. <strong>Click</strong> a block to break it along with every touching block of the <strong>Same Color</strong>. Every block next to the group you broke then <strong>Changes Color</strong>, from <strong>Silver</strong> to <strong>Gold</strong> to <strong>Pink</strong> and back to Silver, so plan ahead to build bigger groups! Clicking a block with no same-colored neighbours still breaks it, but costs you <strong>Time</strong> off the clock at the bottom. Once all the blocks over a sentence are gone, it lights up; <strong>Click</strong> the revealed sentence to lock in that thought. Choose wisely before the <strong>Timer</strong> runs out!</p>`,
    },
    voting: {
        title: "Voting Time",
        promptName: "Voting Time",
        theme: "voting",
        image: `${TUTORIAL_CLIPS}/voting.webp`,
        imageAlt: "The voting screen with student portraits and the vote button.",
        bodyHtml: `<p>It's <strong>Voting Time</strong>! Everyone has to vote for who they think the <strong>Blackened</strong> is: the student who committed the murder. <strong>Click</strong> a classmate's portrait to select them; their name and picture show up on the right, and you can change your mind as often as you like. Press the <strong>Vote</strong> button to cast your vote before the <strong>Timer</strong> runs out, or your current pick goes in automatically. Students who have died are crossed out. Everyone else votes too, and the student with the most votes is the class's answer. Pick right, and the Blackened alone is punished. Pick wrong... and, well. You know how this goes.</p>`,
    },
};

export function configureMinigameGuides({ isTutorialPromptEnabled, disableTutorialPrompt } = {}) {
    if (typeof isTutorialPromptEnabled === "function") _isEnabled = isTutorialPromptEnabled;
    if (typeof disableTutorialPrompt === "function") _disable = disableTutorialPrompt;
}

// Minigame loading overlays use the max 32-bit z-index (2147483647) and keep
// pointer-events while they fade out. The prompt has to sit at that same
// ceiling *and* yank the loader out of the DOM, or the Yes/No bar is invisible
// and unclickable underneath it (NSD/MPD even await the prompt *before* hide()).
const GUIDE_Z = "2147483647";
const LOADING_OVERLAY_ID = "hg-loading-state";

function dismissMinigameLoadingOverlay() {
    const el = document.getElementById(LOADING_OVERLAY_ID);
    if (!el) return;
    try { el.hide?.(); } catch {}
    el.style.pointerEvents = "none";
    el.remove();
}

function liftGuideLayer(el) {
    if (!el) return;
    el.style.setProperty("z-index", GUIDE_Z, "important");
    el.style.setProperty("pointer-events", "auto", "important");
}

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${PROMPT_ID} {
    position: fixed; bottom: 0; left: 0; right: 0;
    z-index: ${GUIDE_Z};
    pointer-events: auto;
    cursor: auto;
    background: rgba(6, 10, 18, 0.97);
    border-top: 2px solid rgba(120, 200, 255, 0.45);
    box-shadow: 0 -12px 40px rgba(40, 90, 160, 0.28);
    padding: 20px 32px 24px;
    font-family: "Rajdhani", "Noto Sans JP", sans-serif;
    text-align: center;
    opacity: 0; transform: translateY(12px);
    transition: opacity 280ms ease, transform 280ms ease;
}
#${PROMPT_ID}.is-on { opacity: 1; transform: translateY(0); }
.dgn-mg-prompt-text {
    color: rgba(220, 232, 255, 0.94);
    font-size: clamp(13px, 2vw, 17px);
    line-height: 1.6;
    margin-bottom: 18px;
}
.dgn-mg-prompt-text strong { color: #9be7ff; }
.dgn-mg-prompt-buttons { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.dgn-mg-prompt-btn {
    padding: 9px 22px;
    border-radius: 4px;
    border: 1.5px solid rgba(120, 200, 255, 0.55);
    background: rgba(8, 18, 32, 0.9);
    color: #e8f4ff;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
}
.dgn-mg-prompt-btn:hover { background: rgba(18, 40, 70, 0.95); box-shadow: 0 0 12px rgba(80, 180, 255, 0.35); }
.dgn-mg-prompt-btn.never { border-color: rgba(180, 180, 190, 0.4); color: rgba(200, 210, 220, 0.8); }

#${MODAL_ID} {
    position: fixed; inset: 0;
    z-index: ${GUIDE_Z};
    pointer-events: auto;
    cursor: auto;
    background: rgba(2, 4, 10, 0.72);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 220ms ease;
    padding: 24px;
}
#${MODAL_ID}.is-on { opacity: 1; }
.dgn-mg-modal-inner {
    width: min(640px, 94vw);
    max-height: min(86vh, 760px);
    overflow: hidden;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, rgba(8, 14, 24, 0.98), rgba(4, 8, 14, 0.98));
    border: 1px solid rgba(140, 200, 255, 0.4);
    border-radius: 10px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
}
.dgn-mg-modal-inner.has-art {
    width: min(700px, 94vw);
    max-height: 90vh;
}
.dgn-mg-modal-header {
    padding: 14px 18px 10px;
    border-bottom: 1px solid rgba(120, 180, 255, 0.22);
    font-family: "Orbitron", "Rajdhani", sans-serif;
    letter-spacing: 0.12em;
    color: #e8f6ff;
    font-size: 14px;
}
.dgn-mg-modal-title {
    font-family: "Orbitron", "Impact", monospace;
    font-size: clamp(16px, 3vw, 22px);
    font-weight: 900;
    letter-spacing: 0.06em;
}
.dgn-mg-modal-frame {
    position: relative;
    flex-shrink: 0;
    aspect-ratio: 16 / 9;
    max-height: 46vh;
    background: #000;
    border-bottom: 1px solid rgba(120, 180, 255, 0.16);
    overflow: hidden;
}
.dgn-mg-modal-img {
    width: 100%; height: 100%; display: block;
    object-fit: cover;
}
.dgn-mg-modal-body {
    padding: 16px 20px 8px;
    overflow-y: auto;
    color: rgba(214, 226, 244, 0.92);
    font-family: "Rajdhani", sans-serif;
    font-size: clamp(13px, 1.7vw, 16px);
    line-height: 1.45;
    flex: 1;
}
.dgn-mg-modal-inner.has-art .dgn-mg-modal-body {
    padding: 20px 24px;
    font-family: "Noto Sans JP", "Noto Sans", sans-serif;
    font-size: clamp(12px, 1.8vw, 14px);
    line-height: 1.75;
}
.dgn-mg-modal-body p { margin: 0; }
.dgn-mg-modal-body ul { margin: 0; padding-left: 1.15em; }
.dgn-mg-modal-body li { margin: 0 0 8px; }
.dgn-mg-modal-body strong { color: #9be7ff; }

/* Themes: each minigame sets these variables; the rules below apply them. */
.theme-hangman {
    --mg-accent: #44ff88; --mg-strong: #66ffaa;
    --mg-line: rgba(0, 200, 80, 0.55); --mg-glow: rgba(0, 220, 100, 0.25); --mg-hover-glow: rgba(0, 255, 100, 0.4);
    --mg-bg: rgba(4, 12, 32, 0.98); --mg-btn-bg: rgba(0, 30, 12, 0.85); --mg-btn-hover: rgba(0, 60, 24, 0.95);
    --mg-text: rgba(205, 228, 208, 0.9);
}
.theme-armament {
    --mg-accent: rgba(220, 160, 255, 0.95); --mg-strong: rgba(220, 160, 255, 0.95);
    --mg-line: rgba(190, 70, 255, 0.55); --mg-glow: rgba(160, 50, 255, 0.25); --mg-hover-glow: rgba(180, 60, 255, 0.4);
    --mg-bg: rgba(8, 0, 24, 0.98); --mg-btn-bg: rgba(32, 0, 60, 0.85); --mg-btn-hover: rgba(120, 30, 200, 0.6);
    --mg-text: rgba(220, 200, 238, 0.9);
}
.theme-nsd {
    --mg-accent: #ffb347; --mg-strong: #ffc870;
    --mg-line: rgba(255, 170, 60, 0.55); --mg-glow: rgba(255, 150, 40, 0.22); --mg-hover-glow: rgba(255, 170, 60, 0.4);
    --mg-bg: rgba(6, 12, 34, 0.98); --mg-btn-bg: rgba(40, 22, 4, 0.85); --mg-btn-hover: rgba(90, 50, 8, 0.9);
    --mg-text: rgba(226, 222, 236, 0.9);
}
.theme-mpd {
    --mg-accent: #ff6a55; --mg-strong: #ff8c70;
    --mg-line: rgba(255, 80, 60, 0.55); --mg-glow: rgba(255, 50, 30, 0.25); --mg-hover-glow: rgba(255, 90, 60, 0.45);
    --mg-bg: rgba(26, 4, 6, 0.98); --mg-btn-bg: rgba(50, 6, 6, 0.85); --mg-btn-hover: rgba(110, 14, 12, 0.9);
    --mg-text: rgba(240, 214, 210, 0.9);
}
.theme-scrum {
    --mg-accent: #ffd23f; --mg-strong: #ffe07a;
    --mg-line: rgba(255, 200, 60, 0.5); --mg-glow: rgba(200, 80, 255, 0.25); --mg-hover-glow: rgba(255, 210, 60, 0.4);
    --mg-bg: rgba(22, 6, 36, 0.98); --mg-btn-bg: rgba(48, 14, 70, 0.85); --mg-btn-hover: rgba(90, 30, 120, 0.9);
    --mg-text: rgba(232, 220, 240, 0.9);
}
.theme-rebuttal {
    --mg-accent: #b6ff5c; --mg-strong: #ccff8a;
    --mg-line: rgba(160, 240, 80, 0.5); --mg-glow: rgba(120, 220, 60, 0.22); --mg-hover-glow: rgba(170, 255, 90, 0.4);
    --mg-bg: rgba(6, 18, 10, 0.98); --mg-btn-bg: rgba(18, 40, 8, 0.85); --mg-btn-hover: rgba(40, 80, 16, 0.9);
    --mg-text: rgba(220, 236, 210, 0.9);
}
.theme-questionTruth {
    --mg-accent: #ff4fb4; --mg-strong: #ff7cc8;
    --mg-line: rgba(255, 80, 180, 0.5); --mg-glow: rgba(255, 60, 170, 0.22); --mg-hover-glow: rgba(255, 90, 190, 0.42);
    --mg-bg: rgba(14, 4, 20, 0.98); --mg-btn-bg: rgba(46, 6, 36, 0.85); --mg-btn-hover: rgba(96, 14, 72, 0.9);
    --mg-text: rgba(238, 218, 232, 0.9);
}
.theme-questionTime {
    --mg-accent: #4fe3ff; --mg-strong: #8ceeff;
    --mg-line: rgba(80, 220, 255, 0.5); --mg-glow: rgba(60, 200, 255, 0.22); --mg-hover-glow: rgba(90, 230, 255, 0.42);
    --mg-bg: rgba(4, 10, 24, 0.98); --mg-btn-bg: rgba(6, 30, 46, 0.85); --mg-btn-hover: rgba(10, 60, 90, 0.9);
    --mg-text: rgba(214, 232, 244, 0.9);
}
.theme-mindMine {
    --mg-accent: #ffd166; --mg-strong: #ffe09a;
    --mg-line: rgba(255, 200, 90, 0.5); --mg-glow: rgba(255, 190, 80, 0.2); --mg-hover-glow: rgba(255, 210, 110, 0.4);
    --mg-bg: rgba(6, 10, 26, 0.98); --mg-btn-bg: rgba(40, 30, 6, 0.85); --mg-btn-hover: rgba(80, 60, 12, 0.9);
    --mg-text: rgba(226, 226, 236, 0.9);
}
.theme-voting {
    --mg-accent: #ff3b3b; --mg-strong: #ffd23f;
    --mg-line: rgba(255, 60, 60, 0.55); --mg-glow: rgba(255, 40, 40, 0.25); --mg-hover-glow: rgba(255, 70, 70, 0.45);
    --mg-bg: rgba(16, 6, 6, 0.98); --mg-btn-bg: rgba(50, 6, 6, 0.85); --mg-btn-hover: rgba(110, 12, 12, 0.9);
    --mg-text: rgba(238, 220, 214, 0.9);
}

#${PROMPT_ID}.is-themed {
    border-top-color: var(--mg-line);
    box-shadow: 0 -12px 40px var(--mg-glow);
}
#${PROMPT_ID}.is-themed .dgn-mg-prompt-text { color: var(--mg-text); }
#${PROMPT_ID}.is-themed .dgn-mg-prompt-text strong { color: var(--mg-accent); }
#${PROMPT_ID}.is-themed .dgn-mg-prompt-btn {
    border-color: var(--mg-line);
    background: var(--mg-btn-bg);
    color: var(--mg-accent);
}
#${PROMPT_ID}.is-themed .dgn-mg-prompt-btn:hover {
    background: var(--mg-btn-hover);
    box-shadow: 0 0 12px var(--mg-hover-glow);
}
#${PROMPT_ID}.is-themed .dgn-mg-prompt-btn.never {
    border-color: rgba(180, 180, 190, 0.4);
    background: rgba(10, 12, 18, 0.85);
    color: rgba(200, 210, 220, 0.8);
}
#${MODAL_ID}.is-themed .dgn-mg-modal-inner {
    background: var(--mg-bg);
    border-color: var(--mg-line);
    box-shadow: 0 0 40px var(--mg-glow);
}
#${MODAL_ID}.is-themed .dgn-mg-modal-header,
#${MODAL_ID}.is-themed .dgn-mg-modal-footer,
#${MODAL_ID}.is-themed .dgn-mg-modal-frame { border-color: var(--mg-glow); }
#${MODAL_ID}.is-themed .dgn-mg-modal-title {
    color: var(--mg-accent);
    text-shadow: 0 0 14px var(--mg-hover-glow);
}
#${MODAL_ID}.is-themed .dgn-mg-modal-body { color: var(--mg-text); }
#${MODAL_ID}.is-themed .dgn-mg-modal-body strong { color: var(--mg-strong); }
#${MODAL_ID}.is-themed .dgn-mg-modal-close {
    border-color: var(--mg-line);
    background: var(--mg-btn-bg);
    color: var(--mg-accent);
}
#${MODAL_ID}.is-themed .dgn-mg-modal-close:hover { box-shadow: 0 0 12px var(--mg-hover-glow); }
.dgn-mg-modal-footer {
    padding: 12px 18px 16px;
    display: flex; justify-content: flex-end;
    border-top: 1px solid rgba(120, 180, 255, 0.16);
}
.dgn-mg-modal-close {
    padding: 8px 22px;
    border-radius: 4px;
    border: 1.5px solid rgba(120, 200, 255, 0.6);
    background: rgba(8, 22, 40, 0.95);
    color: #9be7ff;
    font-family: "Rajdhani", sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
}
.dgn-mg-modal-close:hover { box-shadow: 0 0 12px rgba(80, 180, 255, 0.4); }
    `;
    document.head.appendChild(style);
}

function dismissEl(el, className = "is-on") {
    return new Promise((resolve) => {
        if (!el) {
            resolve();
            return;
        }
        el.classList.remove(className);
        setTimeout(() => {
            el.remove();
            resolve();
        }, 280);
    });
}

function showPrompt(guide) {
    if (!_isEnabled()) return Promise.resolve(false);
    ensureStyles();
    document.getElementById(PROMPT_ID)?.remove();

    return new Promise((resolve) => {
        const el = document.createElement("div");
        el.id = PROMPT_ID;
        el.innerHTML = `
            <div class="dgn-mg-prompt-text">
                The minigame <strong>${guide.promptName || guide.title}</strong> is about to begin. Would you like to hear an explanation?
            </div>
            <div class="dgn-mg-prompt-buttons">
                <button type="button" class="dgn-mg-prompt-btn yes">${guide.yesLabel || "Let's hear it"}</button>
                <button type="button" class="dgn-mg-prompt-btn no">${guide.noLabel || "No, just start"}</button>
                <button type="button" class="dgn-mg-prompt-btn never">No, and don't remind me</button>
            </div>
        `;
        if (guide.theme) el.classList.add("is-themed", `theme-${guide.theme}`);
        document.body.appendChild(el);
        liftGuideLayer(el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));

        const finish = async (answer) => {
            await dismissEl(el);
            resolve(answer);
        };

        el.querySelector(".yes")?.addEventListener("click", () => finish(true));
        el.querySelector(".no")?.addEventListener("click", () => finish(false));
        el.querySelector(".never")?.addEventListener("click", () => {
            try { _disable(); } catch {}
            finish(false);
        });
    });
}

function showModal(guide) {
    ensureStyles();
    document.getElementById(MODAL_ID)?.remove();

    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.id = MODAL_ID;
        const img = guide.image
            ? `<div class="dgn-mg-modal-frame"><img class="dgn-mg-modal-img" src="${extensionFolderPath}/${guide.image}" alt="${guide.imageAlt || ""}" loading="eager" draggable="false"/></div>`
            : "";
        const items = (guide.bullets || []).map((line) => `<li>${line}</li>`).join("");
        const body = guide.bodyHtml || `<ul>${items}</ul>`;
        const innerClass = guide.image || guide.bodyHtml ? "dgn-mg-modal-inner has-art" : "dgn-mg-modal-inner";
        modal.innerHTML = `
            <div class="${innerClass}">
                <div class="dgn-mg-modal-header"><div class="dgn-mg-modal-title">${guide.title}</div></div>
                ${img}
                <div class="dgn-mg-modal-body">${body}</div>
                <div class="dgn-mg-modal-footer">
                    <button type="button" class="dgn-mg-modal-close">OK, let's go!</button>
                </div>
            </div>
        `;
        if (guide.theme) modal.classList.add("is-themed", `theme-${guide.theme}`);
        // A missing clip falls back to the still picture, or drops the frame.
        const imgEl = modal.querySelector(".dgn-mg-modal-img");
        imgEl?.addEventListener("error", () => {
            if (guide.fallbackImage && !imgEl.dataset.fellBack) {
                imgEl.dataset.fellBack = "1";
                imgEl.src = `${extensionFolderPath}/${guide.fallbackImage}`;
            } else {
                imgEl.closest(".dgn-mg-modal-frame")?.remove();
            }
        });
        document.body.appendChild(modal);
        liftGuideLayer(modal);
        requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("is-on")));

        modal.querySelector(".dgn-mg-modal-close")?.addEventListener("click", async () => {
            await dismissEl(modal);
            resolve();
        });
    });
}

export async function promptMinigameTutorial(guideId) {
    const guide = MINIGAME_GUIDES[guideId];
    if (!guide) return false;
    dismissMinigameLoadingOverlay();
    const wants = await showPrompt(guide);
    if (wants) await showModal(guide);
    return wants;
}

export function destroyMinigameGuideUi() {
    document.getElementById(PROMPT_ID)?.remove();
    document.getElementById(MODAL_ID)?.remove();
}
