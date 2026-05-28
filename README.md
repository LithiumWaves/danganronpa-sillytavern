# Danganronpa Extension

Adds a menu based on the Monopad from **Danganronpa V3** with progression, trust tracking, truth-bullet parsing, gift/inventory systems, map navigation, and optional OpenRouter-powered generation.

## Installation:
1. Place this folder in:
   `scripts/extensions/third-party/danganronpa-extension`
2. Refresh/reload SillyTavern.
Alternatively, install directly from SillyTavern by accessing the extensions tab and pasting the main link.
3. In chat, click the Monopad crest button to open the UI.

## Requirements:
The Lorebook: [TBA]
The Generation Preset: [TBA]

## What the Extension Includes:

### Monopad Tabs
- **Truth (🧠):** Stores discovered Truth Bullets, supports detail view, archival and removal.
- **Map (🌐):** Shows the current Map & Floor, supports custom maps, pin locations, and evidence placement.
- **Gifts & Skills (🎁):** Shows the Inventory, item browsing, gifting flow, and skill shop display.
- **Social (👥):** Shows the Roster, trust/distrust progress, and generated profile notes.
- - **Chapters (📖):** Shows a log of your chats in an easy-to-read, easy-to-revisit format to help you build narratives.
- **Settings (⚙️):** Shows Audio/display toggles, progression reset, expression configurer, CG creators, generation provider selection and a fun tutorial.

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
- **Panic Talk Action (PTA):** Acts as a 'boss fight' of sorts against a character; this is purely for roleplay purposes, but rewards Monocoins. Commenced either via the UI, or through the `/panictalkaction` command.
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
The extension scans assistant messages for these patterns:

- `V3C| TB: <title> || <description>`
- `V3C| SOCIAL: <name>`
- `V3C| SOCIAL_UP: <name>`
- `V3C| SOCIAL_DOWN: <name>`
- `V3C| INVESTIGATION_START` (plays Investigation Start banner/sfx and attempts to enable the `Investigation Time` toggle in your current preset)
- `V3C| TRIAL_START` (opens a confirmation prompt to begin Class Trial phase flow)
- `V3C| BODY_DISCOVERY` (plays a separate static/shake body discovery cutscene using `assets/sfx/etc/despairnoise.mp3`)

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
2. Emit V3C lines from your prompt template/character logic.
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
| **BGM Tracks** | File multi-select | — | Assign audio files to each game phase. Available phases: Shop, Daytime, Nighttime, Investigation, Trial General, Trial Preparation, Non-Stop Debates, Mass Panic Debates, Scrum Debates, Hangman's Gambit, Rebuttal Showdown, Interjection, Suspect Choice, PTA Phase 1/2/3 |
---

### Display
| Setting | Type | Default | Description |
|---|---|---|---|
| **CRT Effects** | Toggle | On | Applies a CRT scanline filter over the Monopad UI |
| **CRT Intensity** | Slider (0–100) | 35 | Controls the strength of the CRT scanline filter |
| **Boot Animations** | Toggle | On | Shows the startup animation sequence when SillyTavern loads |
| **Visual Novel Mode** | Toggle | Off | Enables VN-style character sprite and text presentation in chat |
| **Daily / Deadly Life Dynamic Themes** | Toggle | On | Automatically switches the UI theme based on daytime, nighttime, or investigation state |
| **Hide Truth Bullet Images** | Toggle | Off | Hides thumbnail images on Truth Bullet entries in the Monopad |
| **Hide Gift Images** | Toggle | Off | Hides thumbnail images on gift and inventory entries |
| **Class Trial Podium** | DEFAULT / CUSTOM | Default | Use the built-in lectern sprite or upload a custom replacement image |
| **Hide Hope's Peak Branding** | Toggle | Off | Unlocks Announcement Customization — replace default announcement images, voice lines, and text for Daytime, Nighttime, and Body Discovery announcements |
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

#### `/panictalkaction`
Starts a Panic Talk Action boss-fight sequence against the current speaker character. At least one `dialog` line is required.
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

## Notes and current behavior
- Class Trials and what they entail are still under development and should come out soon.
- Skill shop entries are available for ownership/equip-cost display; deeper skill effects can be expanded over time.

## Q&A
- **Q: How do gifts work?**
  **A: First and foremost, gifts are obtained through a gacha minigame on the MonoMono Machine, accessible through the map tab. To use them, access your inventory, select the gift and press use. The next character who sends a message in chat will receive and judge it, granting you either a rank up or down or simply staying neutral.**

- **Q: There's something you didn't explain here. I'm confused. What do I do?**
  **A: Check the settings tab. On the top right is a question mark button with a short tutorial that walks you through the entire Monopad.**

## Troubleshooting
- **Extension not visible:** verify folder path and refresh SillyTavern.
- **No Truth Bullets or Social updates:** confirm your messages output valid `V3C| ...` lines.
- **OpenRouter errors:** confirm API key/model and use **Test Connection** in Settings.
- **Audio missing:** ensure browser autoplay permissions and extension sound toggles are enabled.
