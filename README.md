# Danganronpa Extension

A Monopad-style SillyTavern extension with progression, trust tracking, truth-bullet parsing, gift/inventory systems, map navigation, and optional OpenRouter-powered generation.

## Installation
1. Place this folder in:
   `scripts/extensions/third-party/danganronpa-extension`
2. Refresh/reload SillyTavern.
3. Open **Extensions** and enable **Danganronpa Extension**.
4. In chat, click the Monopad crest button to open the UI.

## What the extension includes

### Monopad tabs
- **Truth (🧠):** Stores discovered Truth Bullets, supports detail view and removal.
- **Map (🌐):** Area/floor navigation plus MonoMono Machine interaction.
- **Gifts & Skills (🎁):** Inventory, item browsing, gifting flow, and skill shop display.
- **Social (👥):** Character list, trust/distrust progress, and generated profile notes.
- **Settings (⚙️):** Audio/display toggles, progression reset, generation provider selection.

### Progression and currencies
- **Monocoins** and **XP** are awarded from core actions (for example Truth Bullet and social progress events).
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

### Examples
```text
V3C| TB: Bloody Handprint || Found on the west hall window.
V3C| SOCIAL: Kyoko Kirigiri
V3C| SOCIAL_UP: Aoi Asahina
V3C| SOCIAL_DOWN: Byakuya Togami
```

## Typical usage flow
1. Roleplay/investigate in chat.
2. Emit V3C lines from your prompt template/character logic.
3. Open Monopad to review Truth Bullets and Social updates.
4. Spend rewards in Gifts & Skills and use gifts in conversations.
5. Tune visuals/audio/generation options from Settings.

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
- Social trust can currently be adjusted via list interactions in the Social tab (single-click opens report; additional controls are planned).
- Skill shop entries are available for ownership/equip-cost display; deeper skill effects can be expanded over time.

## Troubleshooting
- **Extension not visible:** verify folder path and refresh SillyTavern.
- **No Truth Bullets or Social updates:** confirm your messages output valid `V3C| ...` lines.
- **OpenRouter errors:** confirm API key/model and use **Test Connection** in Settings.
- **Audio missing:** ensure browser autoplay permissions and extension sound toggles are enabled.

## Development quick checks
From the extension root:

```bash
# Syntax check key JS modules (Node.js)
node --check index.js
node --check truth/truthBullets.js
node --check items/itemsPanel.js
node --check social/socialPanel.js
node --check map/mapPanel.js
node --check core/openrouterSettings.js
```

## Project structure
```text
core/      constants, OpenRouter settings manager, lesson script
truth/     truth bullet parsing, persistence, animations
social/    social panel + character utilities
items/     inventory, gifts, skill shop UI, rewards/progression
map/       map panel + MonoMono machine flow
assets/    extension images/audio
```
