# Danganronpa Extension

Adds a menu based on the Monopad from **Danganronpa V3** with progression, trust tracking, truth-bullet parsing, gift/inventory systems, map navigation, and optional OpenRouter-powered generation.

## Installation
1. Place this folder in:
   `scripts/extensions/third-party/danganronpa-extension`
2. Refresh/reload SillyTavern.
Alternatively, install directly from SillyTavern by accessing the extensions tab and pasting the main link.
3. In chat, click the Monopad crest button to open the UI.

## Requirements:
The Lorebook: [TBA]
The Generation Preset: [TBA]

## What the extension includes

### Monopad tabs
- **Truth (🧠):** Stores discovered Truth Bullets, supports detail view and removal.
- **Map (🌐):** Area/floor navigation plus MonoMono Machine minigame.
- **Gifts & Skills (🎁):** Inventory, item browsing, gifting flow, and skill shop display.
- **Social (👥):** Character list, trust/distrust progress, and generated profile notes.
- **Settings (⚙️):** Audio/display toggles, progression reset, generation provider selection and a fun tutorial.

### Class Trials

Coming soon

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

### Examples
```text
V3C| TB: Bloody Handprint || Found on the west hall window.
V3C| SOCIAL: Kyoko Kirigiri
V3C| SOCIAL_UP: Aoi Asahina
V3C| SOCIAL_DOWN: Byakuya Togami
V3C| INVESTIGATION_START
```

## Typical usage flow
1. Roleplay/investigate in chat.
2. Emit V3C lines from your prompt template/character logic.
3. Open Monopad to review Truth Bullets and Social updates.
4. Spend rewards in Gifts & Skills and use gifts in conversations.
5. Partake in Class Trials and advance the story


## Settings reference
- **Monopad Sounds** – UI SFX toggle.
- **Trust Ceremonies** – trust rank ceremony effects.
- **Truth Bullets** – truth bullet obtain animation toggle.
- **MonoMono BGM** – machine background track toggle.
- **CRT Effects / CRT Intensity** – visual filter controls.
- **Boot Animations** – startup/welcome transitions.
- **Generation Source** – Main API vs OpenRouter.
- **OpenRouter Model / Key / Test Connection** – OpenRouter controls.
- **Reset Level + Skill Points** – progression reset to LV1 / 0 XP / 10 SP.

## Notes and current behavior
- Class Trials and what they entail are still under development and should come out soon.
- Skill shop entries are available for ownership/equip-cost display; deeper skill effects can be expanded over time.

## Q&A
- **Q: How do gifts work?**
  **A: First and foremost, gifts are obtained through a gacha minigame on the MonoMono Machine. To use them, access your inventory, select the gift and press use. The next character who sends a message in chat will receive and judge it, granting you either a rank up or down or simply staying neutral.**

- **Q: There's something you didn't explain here. I'm confused. What do I do?
  **A: Check the settings tab. On the top right is a question mark button with a short tutorial that walks you through the entire Monopad.

## Troubleshooting
- **Extension not visible:** verify folder path and refresh SillyTavern.
- **No Truth Bullets or Social updates:** confirm your messages output valid `V3C| ...` lines.
- **OpenRouter errors:** confirm API key/model and use **Test Connection** in Settings.
- **Audio missing:** ensure browser autoplay permissions and extension sound toggles are enabled.
