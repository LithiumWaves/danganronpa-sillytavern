# Danganronpa SillyTavern

Adds a menu based on the Monopad from **Danganronpa V3** with progression, trust tracking, truth-bullet parsing, gift/inventory systems, map navigation, and optional OpenRouter-powered generation.

## Contributing & Contact:
- To raise a bug, visit the Issues tab and [raise a new Issue](https://github.com/LithiumWaves/danganronpa-extension/issues/new). Please use Labels appropriately and accurately.
- To raise a suggestion, visit the Issues tab and [raise a new Issue](https://github.com/LithiumWaves/danganronpa-extension/issues/new) and use the `idea` Label.
- To contribute code, please open a Pull Request. Only `@lithiumwaves_` and `@jojicus` can merge Pull Requests.
- For copyright issues, please DM either `@lithiumwaves_` and `@jojicus` on Discord.

## Installation:
1. Place this folder in:
   `scripts/extensions/third-party/danganronpa-extension`
2. Refresh/reload SillyTavern.
Alternatively, install directly from SillyTavern by accessing the extensions tab and pasting the main link.
3. In chat, click the Monopad crest button to open the UI.

**Recommended way to play: One Main Chat.** Pick NEW GAME on the title screen and keep the selected **One Main Chat** style: one group chat holds the whole story, and exploring the overworld stays inside it (Single-Chat Overworld). Install the [Presence](https://github.com/leandrojofre/SillyTavern-Presence) extension so characters who aren't in the room don't remember what was said there. Several Chats is still available if you prefer separate chats.

## Requirements:
- The Lorebook: You can select one of the supplied Lorebooks in `/sample-lorebooks`, or create your own.
- Character Cards: You can import one (Or multiple) characters from `/sample-character-cards`, or create your own.

## What the Extension Includes:

### Monopad Tabs
- **Truth (🧠):** Stores discovered Truth Bullets, supports detail view, editing the title and description, archival and removal. Archived and deleted bullets stay that way; the message that found them won't add them again.
- **Map (🌐):** Shows the current Map & Floor, supports custom maps, pin locations, and evidence placement. Evidence and body pins belong to the current save; rooms, custom areas and floors are shared by every save and stored with your SillyTavern settings, so they follow you to other browsers. Which areas a save uses is picked in NEW GAME and kept with the save. Lock a floor (or island, or any floor of a custom area) until a chapter with the pencil button → **OPENS IN**: like the original games, it opens when the story reaches that chapter. Until then nobody spawns there and Move To won't lead there; the floor button shows a 🔒. **RESHUFFLE CHARACTERS** moves everyone to new rooms (the same shuffle Pass Time and Sleep do) without changing the time.
- **Gifts & Skills (🎁):** Shows the Inventory, item browsing, gifting flow, and skill shop display.
- **Social (👥):** Shows the Roster, trust/distrust progress, and generated profile notes. The − and + buttons next to the trust value correct it one rank at a time, without a ceremony or rewards.
- **Chapters (📖):** Shows a log of your chats in an easy-to-read, easy-to-revisit format to help you build narratives.
- **Settings (⚙️):** Shows Audio/display toggles, progression reset, expression configurer, CG creators, generation provider selection, and Mr. Monokuma's Lesson (replayable).

### Title Screen
SillyTavern opens on a Trigger Happy Havoc-style title screen. Press any key or click to start, then pick from the menu (arrow keys, Enter, Escape/BACK all work):
- **NEW GAME:** a guided setup. If you have progress it first asks whether to start a **NEW SAVE** (your current save is kept and can be loaded again) or **KEEP CURRENT SAVE**. Then:
  1. Choose a play style: **One Main Chat** (recommended, and selected by default) or **Several Chats**.
  2. One Main Chat only: name the story chat and pick its members. The group chat is created for you and Single-Chat Overworld is turned on.
  3. Class roster: tick your classmates, set each one's Ultimate, and choose your persona.
  4. Choose the map: **Hope's Peak Academy** (recommended, built in with every room placed), **Jabberwock Island**, or **Upload Your Own**. For your own map, name it and upload one picture per floor, then click on each picture to place its rooms, name them, and pick the room you start in. The save only uses the map you chose: other areas are hidden and characters only spawn in its rooms. **SHOW ALL MAPS** in the Monopad MAP tab brings the other areas back for that save.
  5. Review and **BEGIN**.

  Every step has a **WHAT DOES THIS MEAN?** panel that explains it in more detail.
- **Music:** a few seconds after you leave the title screen, the current phase's music (Daytime, Nighttime or Investigation) starts by itself, unless something is already playing.
- **CONTINUE:** the **SAVES** tab lists your saves with their chapter, day, Truth Bullets and classmates. Picking a One Main Chat save opens its story chat; picking a Several Chats save opens the Monopad map. **ALL CHATS** lists every chat, newest first, with avatars, a last-message preview, message count and time. Search by name or message, or filter by one-on-one / group.
- **OPTIONS:** the main audio, display and gameplay settings in the title screen's own style. Changes save immediately; **ALL SETTINGS (MONOPAD)** opens the full list.
- **SETUP:** a checklist of what the game needs from SillyTavern: character cards, sprites, a lorebook with Ultimates, the Presence extension (One Main Chat), music, room backgrounds, AI instructions, a persona and a save. Each row says what's missing and has a button that opens the place to fix it. A badge on SETUP counts anything the game can't run without. Also in Monopad Settings → Gameplay.
  - Music, room backgrounds and lorebooks are set up without leaving the title screen:
    - **MUSIC** picks the tracks for each playlist (phases, moods, locations, trial), with a preview button.
    - **ROOM BACKGROUNDS** gives each room on your save's map a SillyTavern background, shown when you walk in.
    - **LOREBOOKS** is a World Info editor: create, import, rename, delete and turn books on, and add, copy, delete or edit entries (title, keywords, optional filter, content, enabled, always on, position, depth, order and trigger chance).

Assign music under BGM Tracks → Phases → Title. Turn the screen off with the **Title Screen** setting, reopen it with `/title`, or use **Return to Title** in Monopad Settings → Display.

### Save Files
Each save keeps its own story: classmates and trust, Truth Bullets, chapter, day and phase, Monocoins, items, skills and level, introductions, journal and trial state. Settings, music, cinematics and custom item definitions are shared by every save.
- **One Main Chat** saves belong to their story chat (and any Class Trial chats started from it). Opening that chat loads the save by itself.
- **Several Chats** saves are named slots. Chats that don't belong to a save keep whichever save is loaded.
- Manage saves in Monopad Settings → **SAVES**: load, rename, copy, delete, export to a file and import from one. Loading a save switches Single-Chat Overworld to match its play style.
- Updating from an older version wraps your existing progress into a save called **Imported Save**, so nothing is lost.

### Phase HUD
A small readout under the chapter title and level bar at the top right shows where the story is, for example `DAY 4 · INVESTIGATION`. Click it to see what usually comes next and the actions for the current phase:
- **End Investigation:** go back to daily life without starting a trial. Your Truth Bullets are kept.
- **Start Class Trial**, **Pass Time**, **Sleep** and **Start Investigation**, each with a confirmation.
- **Undo:** reverses the last phase change, whether you made it or the story did.

When the story starts an investigation on its own, a toast offers **UNDO** for a few seconds. Turn the readout off under Settings → Display → **Phase HUD**.

### Escape
- **Cutscenes:** Escape ends the one playing now: Monokuma announcements, body discoveries, phase banners, character introductions, the chapter-end roster, vote results, execution cinematics, trust ceremonies, Truth Bullet pop-ups and interjections. Whatever they change still happens (the investigation still starts, the chapter still advances). Queued ones play next.
- **Minigames:** Escape asks to leave. Leaving puts back everything the game changed: Monocoins, Trust Fragments, XP, and the trial phase and debate history. In Non-Stop Debate, Mass Panic Debate and Scrum Debate, holding Escape still fast-forwards; a quick tap asks to leave.

### Character Introductions
Character Introductions takes a character's `neutral` sprite and renders them on an animated background, grabbing their `name` and `ultimate` values. Commenced through the `/introduce` command.

### Body Discovery

Body Discovery Announcements take a SillyTavern BG and animates randomly over it, using shaking and static effects to create tension. Alternatively, you can create your own, more cinematic Body Discovery CG's in the Settings panel. Commenced through the `/bodydiscovery` command.

### Class Trials

Class Trials are commenced once the user is in a Group Chat and either uses the `/startclasstrial` command, or clicks the blue Trial Grounds pin to access the Class Trial preparation screen. After beginning, the current Group Chat will be converted into a Class Trial Chat. Class Trials are composed of an `objective`, a current `topic`, and a list of `suspects` that grows as the chat continues.

Supplied in this extension are a wide array of minigames, including:

- **Non-Stop Debates (NSD):** Using LLM generation, the characters will provide statements that can contain Weak Spots - Using a Truth Bullet on these Weak Spots will preformat your next response to build the flow of the conversation. Commenced either via the UI, or through the `/nonstopdebate` command.
- **Mass Panic Debates (MPD):** Also using LLM generation, three characters will talk simultaneously in a frantic debate - Again, using a Truth Bullet on a Weak Spot will preformat your next response. Commenced either via the UI, or through the `/masspanicdebate` command.
- **Interjections (INT) & Rebuttal Showdown (RBS):** Be surprised as a character interrupts your message! Clash against this single character in a one-on-one debate, using the same LLM generation and preformatting as before. Commenced either via the UI, or through the `/interjection` and `/rebuttalshowdown` command.
- **Scrum Debates (SCD):** Splits the group into two teams based on emotion, where the opposition will present an opposing theory; completing a Scrum Debate will align all the characters on your team in terms of thinking and preformat your next response.  Commenced either via the UI, or through the `/scrumdebate` command.
- **Argument Armament (AA):** Acts as a 'boss fight' of sorts against a character; this is purely for roleplay purposes, but rewards Monocoins. Commenced either via the UI, or through the `/argumentarmament` command.
- **Hangman's Gambit (HMG):** Presents a term or sentence that is critical to the current Class Trial, and tasks the user with solving it by matching letters in order. Commenced either via the UI, or through the `/hangmansgambit` command.
- **Question Truth (QTT):** Gets your LLM to generate a question revolving around the current Class Trial that has an associated Truth Bullet answer. Can help you figure new branches of discussion. Commenced either via the UI, or through the `/questiontruth` command.
- **Question Time (QTM):** Gets your LLM to generate a four-answer question revolving around the current Class Trial that has a definitive answer. Can help you figure new branches of discussion. Commenced either via the UI, or through the `/questiontime` command.
- **Suspect Choosing (SCC):** Single out a suspect to direct the flow of the conversation towards them. Commenced either via the UI, or through the `/suspectchoosing` command.
- **Voting Time (VTT):** Vote for your choice of suspect. Your other characters will vote too, with the one choice with the most votes being the submitted suspect; if you get it right, fantastic! But if you get it wrong... Commenced either via the UI, or through the `/votingtime` command.
- **Punishment Time (PTT):** Play either an MP4 video, or a custom-made Punishment Time CG to show off the retribution your suspect will face! Commenced either via the UI, or through the `/punishmenttime` command.
 
### Progression and currencies
- **Monocoins** and **XP** are awarded from core actions (for example obtaining Truth Bullets and social progress events).
- **Trust Fragments** are granted on social rank-up and spent in the skill shop.
- Player progression displays **Level** and **XP bar** in the Monopad top bar.

### AI generation
- **Main API Connection** (uses your normal SillyTavern generation flow), or
- **OpenRouter (Direct)** with optional model override and connection test.
- OpenRouter key is session-only by default unless “Remember key” is enabled.

## V3C trigger format (chat parsing)
The extension scans assistant messages for these patterns.

**You don't have to teach the AI these yourself.** With **AI INSTRUCTIONS** on (Settings → Gameplay), the extension adds the rules to the prompt itself and sends only the ones that fit the current phase: evidence markers during investigations, trust markers outside Class Trials, and the investigation-start and announcement markers during daily life. Edit each block from the same setting. It's on for new players. If you're updating and already pasted the rules from `v3c-marker-prompts/prompts.txt` into your preset, a toast offers to turn it on; remove the pasted rules when you do. The extension warns you if both are active.

- `V3C| TB: <title> || <description>`
- `V3C| SOCIAL: <name>`
- `V3C| SOCIAL_UP: <name>`
- `V3C| SOCIAL_DOWN: <name>`
- `V3C| INVESTIGATION_START` (plays the Investigation Start banner/sfx and shows a toast with UNDO; with AI INSTRUCTIONS off, it also tries to enable an `Investigation Time` toggle in your current preset)
- `V3C| TRIAL_START` (opens the Class Trial menu, which asks before the trial begins)
- `V3C| BODY_DISCOVERY` (plays a separate static/shake body discovery cutscene using `assets/sfx/etc/despairnoise.mp3`)
- `V3C| DAY_ANNOUN`, `V3C| NIGHT_ANNOUN`, `V3C| BDA` (play Monokuma's daytime, nighttime or body discovery announcement; they don't change the day or phase)

### Swipes, deletes and edits
What a message did is remembered per save: Truth Bullets, trust changes, gift reactions, the Monocoins, Trust Fragments and XP that came with them, and an investigation it started. Swiping that message away, deleting it, or editing its markers out takes all of that back, and a toast lists what was undone. Swiping back to it applies it again. Edits that keep the markers change nothing. If the message held a gift reaction, the gift goes back to waiting and the next reply reacts to it instead.

### Examples
```text
V3C| TB: Bloody Handprint || Found on the west hall window.
V3C| SOCIAL: Kyoko Kirigiri
V3C| SOCIAL_UP: Aoi Asahina
V3C| SOCIAL_DOWN: Byakuya Togami
V3C| INVESTIGATION_START
V3C| TRIAL_START
V3C| BODY_DISCOVERY
```

## Typical usage flow
1. Roleplay/investigate in chat.
2. Let the extension give the AI the V3C rules (AI INSTRUCTIONS), or put them in your own prompt template.
3. Open Monopad to review Truth Bullets and Social updates.
4. Spend rewards in Gifts & Skills and use gifts in conversations.
5. Partake in Class Trials and advance the story


## Settings reference

### Audio
| Setting | Type | Default | Description |
|---|---|---|---|
| **Monopad Volume** | Slider (0–100) | 50 | Master volume for all Monopad UI sounds and SFX |
| **Monopad Jingle** | Toggle | On | Plays the startup jingle when the Monopad is opened |
| **Announcement Volume** | Slider (0–100) | 65 | Volume for Monokuma's announcement voice lines |
| **Announcement Voice Language** | EN / JP | JP | Language used for Monokuma's spoken announcements |
| **Trust Ceremonies** | Toggle | On | Plays a ceremony sequence when a trust rank milestone is reached |
| **Truth Bullets** | Toggle | On | Plays the Truth Bullet obtain animation when one is discovered in chat |
| **MonoMono BGM Volume** | Slider (0–100) | 40 | Volume for the MonoMono machine background track |
| **Play BGM in Assistant Chat** | Toggle | Off | Keeps phase BGM playing outside of group chats |
| **Dynamic Songs** | Toggle | Off | When on, the extension majority-votes the latest sprite of every living character in the current scene (group-chat portraits, or overworld room if portraits are not up) and plays a matching mood track. Only replaces daytime / nighttime / investigation BGM — shop, map-pin BGM, class trials, and minigames are left alone. Neutral and unknown sprites are ignored. Ties keep the current mood if it is still tied for first, otherwise fall back to phase BGM. The media player list button opens assigned songs filtered by mood or phase. SCAN on the player re-reads current sprites and forces a mood change. |
| **Mood Scan Toast** | Toggle | Off | After SCAN, shows a themed HUD toast with sprite vote counts and the track that started playing. |
| **BGM Tracks** | File multi-select | — | Assign audio files to each game phase or mood. Available phases: Title, Shop, Daytime, Nighttime, Investigation, Trial General, Trial Preparation, Non-Stop Debates, Mass Panic Debates, Scrum Debates, Hangman's Gambit, Rebuttal Showdown, Interjection, Suspect Choice, AA Phase 1/2/3. Moods (used by Dynamic Songs): Happy (joy, excitement), Sad (sadness, grief), Dramatic (realization, surprise), Tense (fear, nervousness), Angry (anger, disgust), Romantic (love, embarrassment). A track can belong to both a phase list and a mood list. |
---

### Display
| Setting | Type | Default | Description |
|---|---|---|---|
| **CRT Effects** | Toggle | On | Applies a CRT scanline filter over the Monopad UI |
| **CRT Intensity** | Slider (0–100) | 35 | Controls the strength of the CRT scanline filter |
| **Boot Animations** | Toggle | On | Shows the startup animation sequence when SillyTavern loads |
| **Title Screen** | Toggle | On | Shows the title screen when SillyTavern loads. `/title` opens it any time |
| **Setup Reminder** | Toggle | On | The title screen's SETUP glows while something the game needs isn't set up (sprites, Ultimates and room backgrounds don't count), and NEW GAME / CONTINUE suggest checking it first |
| **Return to Title** | Button | — | Closes the Monopad and opens the title screen |
| **Visual Novel Mode** | Toggle | Off | Enables VN-style character sprite and text presentation in chat |
| **Daily / Deadly Life Dynamic Themes** | Toggle | On | Automatically switches the UI theme based on daytime, nighttime, or investigation state |
| **Hide Truth Bullet Images** | Toggle | Off | Hides thumbnail images on Truth Bullet entries in the Monopad |
| **Hide Gift Images** | Toggle | Off | Hides thumbnail images on gift and inventory entries |
| **Class Trial Podium** | DEFAULT / CUSTOM | Default | Use the built-in lectern sprite or upload a custom replacement image |
| **Hide Hope's Peak Branding** | Toggle | Off | Unlocks Announcement Customization — replace default announcement images, voice lines, and text for Daytime, Nighttime, and Body Discovery announcements |
---

### Gameplay
| Setting | Type | Default | Description |
|---|---|---|---|
| **Sprite Click Gifts** | Toggle | Off | Overworld sprite clicks open a gift picker for that character instead of starting a 1-on-1 or cluster chat. The gift waits until that character next speaks in your main chat. Talk to the Room / Grab Group Members still open chats when Single-Chat Overworld is off. |
| **Single-Chat Overworld** | Toggle | Off | Explore the overworld without leaving your open group chat. Sprites cover the chat UI; the VN talk box and send box stay usable. Who is standing in the current room is unmuted (present) via SillyTavern group mute; everyone else is muted so they will not hear or auto-reply. Requires the [Presence](https://github.com/leandrojofre/SillyTavern-Presence) extension for per-character memory. View conversation and the minimap only show who is in the current room. Explore brings the overlay back. Call Student warps selected students into the room. Sprite clicks do not open new chats (Sprite Click Gifts still queues a gift). Class trials are unchanged. |
| **Room Context Prompt** | Toggle + editor | Off | When on, chat completions receive a short system prompt with the current room (`{{room}}`) and living occupants (`{{characters}}`, or `none`). Cleared during class trials and when no location is set. Edit or reset the template from the same row. |
---

### FX
| Setting | Type | Description |
|---|---|---|
| **Expression VFX / SFX** | Configure button | Opens a dialog to assign visual effects and sound effects to individual character emotions |
| **Body Discovery Cinematics** | Configure button | Create and manage custom Body Discovery CG sequences used by `/bodydiscovery` |
| **Execution Cinematics** | Configure button | Create and manage custom execution cinematic sequences used by `/punishmenttime` |
---

### Progression
| Setting | Type | Default | Description |
|---|---|---|---|
| **Reward Difficulty** | Easy / Normal / Hard | Normal | Controls how generously Monocoins and XP are awarded for actions |
| **Reset Level Data** | Button | — | Resets player level, XP, and skill points to starting values |
| **Reset Time Data** | Button | — | Resets the in-game time and day tracker |
| **Reset Chapter Data** | Button | — | Resets the chapter counter to PROLOGUE |
---

### AI Generation
| Setting | Type | Default | Description |
|---|---|---|---|
| **Generation Source** | Main API / OpenRouter | Main API | Which provider to use for all LLM generation within the extension |
| **OpenRouter Model** | Text input | `google/gemini-2.5-flash` | Model ID to use when OpenRouter is selected |
| **OpenRouter API Key** | Password input | — | Your OpenRouter API key — session-only unless Remember Key is enabled |
| **Remember Key on This Device** | Checkbox | Off | Persists the OpenRouter API key across sessions |
| **Test Connection** | Button | — | Sends a test request to verify your OpenRouter key and model are working |

## Commands

### Utility

---

#### `/bodydiscovery`
Plays the body discovery static/shake vignette, then the Body Discovery announcement, then triggers Investigation mode and switches to the Investigation theme.

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `bg` | No | — | Background image to switch to under the static effect (partial name match) |
| `cinematic` | No | — | Name of a configured Body Discovery cinematic to play instead of the default sequence |
---

#### `/punishmenttime`
Plays the execution cinematic for the named character, then marks them as dead in the Monopad roster.

| Option | Required | Default | Description |
|---|---|---|---|
| `name` | **Yes** | — | Character name — must match both a configured execution cinematic and a registered character |
---

#### `/title`
Opens the title screen, even when the **Title Screen** setting is off.

#### `/introduce`
Shows a 4-second character introduction screen for the current SillyTavern speaker.

| Option | Required | Default | Description |
|---|---|---|---|
| `ultimate` | No | Auto-detected from lorebook | Overrides the Ultimate title shown on the card (e.g. `ultimate=Gymnast`) |
---

#### `/nextchapter`
Advances the Chapter counter one step to a maximum of 9 Chapters: `PROLOGUE → CHAPTER 1 → … → CHAPTER 9`.

#### `/epiloguechapter`
Sets the Chapter display to `EPILOGUE`.

#### `/passtime`
Triggers the nighttime announcement, shows a Night Time Start banner, and switches to the Night theme.

#### `/gotosleep`
Advances to the next day, plays the daytime announcement, shows a Free Time Start banner, and switches to the Day theme.

#### `/endinvestigation`
Ends the current investigation and returns to daytime or nighttime. Truth Bullets are kept, and the `Investigation Time` preset toggle is switched back off.

#### `/undophase`
Undoes the last phase change: an investigation starting or ending, passing time, or sleeping.

#### `/endtrial`
Immediately ends the current Class Trial and clears all persistent trial states.

---

#### `/givetruthbullet`
Manually adds a Truth Bullet to the Monopad. You can add an image to the Truth Bullet via the Truth Bullet Monopad tab.
| Option | Required | Default | Description |
|---|---|---|---|
| `name` | **Yes** | — | Truth Bullet title — quote if it contains spaces: `name="Bloody Knife"` |
| *(unnamed)* | **Yes** | — | The Truth Bullet description (everything after the named args) |
---

#### `/setclasstrialgoal`
Sets the overall objective text shown in the Trial Context panel.
| Option | Required | Default | Description |
|---|---|---|---|
| *(unnamed)* | **Yes** | — | The goal text, e.g. `/setclasstrialgoal Who killed Byakuya?` |
---

#### `/suspectchoosing`
Opens the character selection screen to single out a suspect and direct the flow of conversation toward them. Navigate with arrow keys, confirm with Enter. No options.

---

#### `/votingtime`
Spins the class trial vote roulette. A correct guess awards XP; an incorrect one triggers failure.
| Option | Required | Default | Description |
|---|---|---|---|
| `guess` | **Yes** | — | The character that was voted for (partial name match) |
| `result` | No | Random | The actual blackened character — omit to pick randomly |
---

### Minigames

Note that in each Minigame, a `step` or `dialogue` is referred to as a `scenario`. For instance, `"But that's Kaede's lie, isn't it?"` would be `one scenario`.

---

#### `/nonstopdebate`
Force-starts a Non-Stop Debate with manually provided lines. Each line supports `[[weak spot]]` and `((agreement))` markup.
| Option | Required | Default | Description |
|---|---|---|---|
| `s1-q` … `s8-q` | At least one | — | Dialogue lines for sections 1–8 |
| *(unnamed)* | — | — | Shorthand for a single-line debate |
---

#### `/masspanicdebate`
Starts a Mass Panic Debate with up to 8 scenarios. Each scenario requires all three columns; mark the weak spot in one column with `[[brackets]]`.
| Option | Required | Default | Description |
|---|---|---|---|
| `sc1-c1-q` … `sc8-c3-q` | At least one full scenario | — | Dialogue text for scenario N, column 1–3 |
| `sc1-c1-speaker` … `sc8-c3-speaker` | No | Auto | Speaker name for each column |
---

#### `/interjection`
Plays the rebuttal interjection cinematic and switches BGM to `New Classmates of the Dead`. After the cinematic the interjecting character immediately replies.
| Option | Required | Default | Description |
|---|---|---|---|
| `character` | No | Last speaker | Character name for the interjection sprite |
---

#### `/rebuttalshowdown`
Starts a default-size Rebuttal Showdown — Cut through scrolling statements with slashes, then land the correct Truth Blade on the weak point. No options.

Also available as sized variants with configurable statements:
| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `opponent` | No | Last speaker | Opponent character name |
| `player` | No | Taken from Prome's current player character profile | Player character name |
| `s1-q` … `sN-q` | No | — | Statement phrases (auto-split into scroll chunks) |
---

#### `/scrumdebate`
Starts the Scrum Debate minigame. The group splits into two teams; debunk each opposing claim with the correct Truth Bullet, then win the final tug-of-war to conclude.

---

#### `/argumentarmament`
Starts a Argument Armament boss-fight sequence against the current speaker character. At least one `dialog` line is required.
| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `dialogA` … `dialogK` | At least one | — | Up to 11 dialogue lines displayed during the encounter |
| `enemyHp` | No | `100` | Enemy starting HP |
| `playerHp` | No | `100` | Player starting HP |
| `phases` | No | `3` | Number of phases (1–3) |
| `nSolution` | No | — | Answer word for the North direction prompt |
| `sSolution` | No | — | Answer word for the South direction prompt |
| `eSolution` | No | — | Answer word for the East direction prompt |
| `wSolution` | No | — | Answer word for the West direction prompt |
| `finalSolution` | No | — | Final answer word (shown uppercased), I.E. `Meat on the Bone` |
| `finalSolutionQuote` | No | — | Quote line accompanying the final solution, I.E. `Where would I hide a skewer?!` |
| `bg` | No | — | Background image to display (partial name match) |
---

#### `/hangmansgambit`
Starts a Hangman's Gambit — letters scroll across the screen; stock a letter then match it against the current target position in the anagram to reveal it.
| Option | Required | Default | Description |
|---|---|---|---|
| `question` | **Yes** | — | Title or prompt shown to the player |
| `answer` | **Yes** | — | The word or phrase to unscramble |
| `time` | No | `60` | Time limit in seconds |
| `health` | No | `3` | Number of health points |
| `difficulty` | No | `2` | Difficulty 1–5 — controls scroll speed, bubble count, and letter variety |
---

#### `/questiontime`
Displays a timed four-answer multiple choice question. Correct answer triggers the GOT IT banner and awards XP.
| Option | Required | Default | Description |
|---|---|---|---|
| `title` | **Yes** | — | The question text |
| `time` | **Yes** | — | Time limit in seconds |
| `a1` … `a4` | **Yes** | — | The four answer options |
| `correct` | **Yes** | — | Which answer is correct (1–4) |
---

#### `/questiontruth`
Displays the Truth Bullet list and asks the player to select the correct one for a given statement. Correct answer awards Monocoins and the GOT IT banner.
| Option | Required | Default | Description |
|---|---|---|---|
| `question` | **Yes** | — | The statement or prompt to answer |
| `answer` | **Yes** | — | The title of the correct Truth Bullet (exact match) |
| `time` | No | None | Optional time limit in seconds |
---

## Q&A
- **Q: How do gifts work?**
  
  **A: First and foremost, gifts are obtained through a gacha minigame on the MonoMono Machine, accessible through the map tab. To use them, access your inventory, select the gift and press use. The next character who replies after you use it will receive and judge it (older messages in the chat don't count), granting you either a rank up or down or simply staying neutral. If Sprite Click Gifts is on in Settings, clicking an overworld sprite queues a gift for that specific character instead of opening a new chat — they react the next time they speak in your main group chat. Talk to the Room and Grab Group Members still open chats when Single-Chat Overworld is off.**

---

- **Q: I only use one group chat. How do I explore the overworld without creating extra chats?**
  
  **A: Turn on Single-Chat Overworld in Settings → Gameplay, then stay in your main group chat. Walking to a room (Move To) shows whoever is there and toggles SillyTavern group mute (the speech-bubble icons) so only those sprites hear what you type. The VN talk box stays up while you explore. Install [Presence](https://github.com/leandrojofre/SillyTavern-Presence) so absentees also do not remember those messages. Call Student brings chosen students into the room you are standing in. View conversation hides the overworld overlay so you can read the chat — only people in that room appear as portraits or minimap pins. Explore puts the overlay back. Sprite Click Gifts still queues a gift instead of talking if that toggle is also on.**

---

- **Q: There's something you didn't explain here. I'm confused. What do I do?**
  
  **A: On first load, a play-mode overlay explains several chats vs one main chat. Leave Don't show again on and press CONTINUE to hide it for later sessions; Reset Lesson Hints in Settings brings it back. The question mark in the top right of Settings starts Mr. Monokuma's Lesson, which walks you through the Monopad. After that, he explains each tab and minigame the first time you use it. Each minigame's explanation opens with a short looping clip of it being played, then walks through every control.**

---

- **Q: My characters are really small! What do I do?!**

   **A: Click either the Padlock (🔓) icon on the minimap to force non-perspective viewing, or click Edit Character Positions in the top-right (Under the Chapter and Level indicators) to reposition characters (Click Exit Conversation if you're in a chat). Additionally, in your Character Description, include a line that states the character's height (In any unit), such as "`Darumi Amemiya stands at 164cm (5'3").`".**

---

## Troubleshooting
- **Extension not visible:** verify folder path and refresh SillyTavern.
- **No Truth Bullets or Social updates:** confirm your messages output valid `V3C| ...` lines.
- **OpenRouter errors:** confirm API key/model and use **Test Connection** in Settings.
- **Audio missing:** ensure browser autoplay permissions and extension sound toggles are enabled.

## Credits
- Spike Chunsoft for building the Danganronpa franchise.
- Kazutaka Kodaka as Danganronpa's creator.
- /u/xReflexx17 on Reddit for creating the Danganronpa V3 Minigame Cut-In Templates.
- [DrizzleMonster2567](https://www.deviantart.com/drizzlemonster2567/art/New-DanganRonpa-V3-Killing-Harmony-Class-Trial-UI-942741080) for creating the Danganronpa V3 Class Trial Overlay we use.
- [lockheartz](https://www.youtube.com/watch?v=dBXnczvjzj4) for creating the Non-Stop Debate Intro.
- [game-icons.net](https://game-icons.net/) for creating a tonne of icons we use.
