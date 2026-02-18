# Class Trial (“Second Part”) Implementation Plan

This document defines a concrete implementation blueprint for Class Trial gameplay in the Danganronpa extension, with an initial focus on **Nonstop Debate (NSD)**.

## Goals
- Start Class Trial mode from the **Map tab**.
- Run NSD in repeatable waves with predictable state transitions.
- Keep UX faithful to Danganronpa while remaining robust in SillyTavern constraints.
- Reuse existing extension architecture (settings, generation provider abstraction, marker parsing, SFX/UI systems).

## Non-goals (Phase 1)
- Full rebuttal showdowns / panic talk action minigames.
- Rhythm/timing minigame mechanics.
- Full courtroom 3D rendering.

---

## 1) User Experience Flow

1. User opens **Map** and clicks **Start Class Trial**.
2. Extension enters `TRIAL_INTRO`:
   - If VN mode is active: short “camera spin + Nonstop Debate banner”.
   - Otherwise: banner-only intro.
3. Extension enters `NSD_ACTIVE` and starts first NSD wave:
   - Randomly picks wave length `N` in `[3, 8]`.
   - Generates/displays dialogue phrases one-by-one as floating text.
   - Hides main ST message box while NSD overlay is active.
4. During wave, random phrases are marked as **Weak Points**.
5. User can “shoot” a Truth Bullet at a Weak Point.
6. On wave end:
   - Pending generation is aborted.
   - Small pause.
   - Next wave begins, unless trial win/exit conditions are met.
7. Trial exits cleanly and restores normal ST UI state.

---

## 2) Architecture Overview

### 2.1 New module layout

- `trial/trialState.js`
  - Single source of truth for trial state.
  - FSM transition helpers and guards.

- `trial/trialController.js`
  - Orchestrates state transitions, generation queue, cancellation, and wave loops.
  - Public API used by map panel + global handlers.

- `trial/trialGeneration.js`
  - Provider-agnostic generation adapter for NSD lines.
  - Structured output parsing + fallback extraction.

- `trial/nonstopDebateUI.js`
  - Overlay rendering: banner, floating phrases, weak-point highlights, shot feedback.

- `trial/weakPoint.js`
  - Weak-point selection strategy.
  - Hit validation and scoring rules.

- `trial/trialMarkers.js`
  - Optional `V3C| ...` marker regexes and parser helpers for trial events.

### 2.2 Existing files to integrate

- `map/mapPanel.js`
  - Add “Start Class Trial” CTA and callback.

- `index.js`
  - Instantiate trial controller.
  - Wire lifecycle hooks + teardown.

- `core/constants.js`
  - Trial default settings and marker regex constants.

- `style.css`
  - Trial overlay and phrase animation styling.

---

## 3) Finite State Machine (FSM)

Use explicit FSM to avoid desync between async generation, UI animations, and user actions.

### 3.1 States
- `IDLE`
- `TRIAL_INTRO`
- `NSD_PREP`
- `NSD_ACTIVE`
- `NSD_PAUSE`
- `WEAK_POINT_RESOLUTION`
- `TRIAL_END`
- `ERROR`

### 3.2 Core transitions
- `IDLE -> TRIAL_INTRO` (start button)
- `TRIAL_INTRO -> NSD_PREP` (intro animation complete)
- `NSD_PREP -> NSD_ACTIVE` (wave initialized)
- `NSD_ACTIVE -> WEAK_POINT_RESOLUTION` (user shot)
- `NSD_ACTIVE -> NSD_PAUSE` (wave exhausted with no resolution)
- `WEAK_POINT_RESOLUTION -> NSD_PAUSE` (resolve shot feedback)
- `NSD_PAUSE -> NSD_PREP` (next wave)
- `* -> TRIAL_END` (win/loss/manual exit)
- `* -> ERROR` (unexpected failure)
- `ERROR -> IDLE`, `TRIAL_END -> IDLE` (cleanup)

### 3.3 State data (minimum)

```js
{
  mode: 'IDLE' | ...,
  trialId: string,
  currentWave: number,
  waveLength: number,
  phraseIndex: number,
  activeSpeakerId: string | null,
  activeBulletId: string | null,
  weakPoints: Array<{ phraseId, start, end, confidence }> ,
  queue: Array<Phrase>,
  pendingGeneration: { abortController, requestId } | null,
  ui: {
    overlayVisible: boolean,
    textBoxHidden: boolean,
    vnIntroEnabled: boolean,
  },
}
```

---

## 4) Generation Pipeline

### 4.1 Recommendation: structured output first

Preferred model output contract for each phrase:

```json
{
  "speaker": "Kyoko",
  "spoken": "No, that timeline doesn’t match the evidence.",
  "tone": "firm",
  "weakPointCandidate": true,
  "topic": "crime_scene_window"
}
```

Fallback parser if contract fails:
- Extract first valid quoted sentence.
- Drop narration/action text.
- Hard-cap length to avoid layout overflow.

### 4.2 Queue strategy
- Keep queue depth 1–2 phrases.
- While phrase `i` animates, prefetch phrase `i+1`.
- Timeout each generation request (e.g. 8–15s) and fail over.

### 4.3 Cancellation
- Use `AbortController` per active request.
- Abort on:
  - wave complete,
  - successful shot resolution,
  - manual trial exit,
  - state invalidation.

---

## 5) Weak Point Design

### 5.1 Placement
- Select ~20–35% of phrases for weak point eligibility.
- Bias toward contradiction-style language:
  - certainty terms (`definitely`, `impossible`, `no way`, `must have`),
  - timeline claims,
  - absolute statements.

### 5.2 Fairness constraints
- Never hide every weak point in one wave.
- Ensure at least one eligible weak point appears every 1–2 waves.
- Optional subtle visual cue (small pulse or tint).

### 5.3 Hit resolution
- On shot:
  - Validate bullet-vs-weak-point mapping.
  - Trigger hit/miss feedback.
  - On hit: progress trial objective.
  - On miss: optional penalty (time freeze, confidence drop, etc.).

---

## 6) UI/Animation Plan

### 6.1 Overlay layers
1. Intro layer (banner/spin)
2. Floating phrase layer
3. Weak-point highlights
4. Reticle + bullet tray
5. Resolution feedback layer

### 6.2 ST UI coordination
- On entering NSD overlay:
  - Hide primary ST input box and unrelated panel affordances.
- On exit/interrupt:
  - Restore everything exactly to prior visibility state.

### 6.3 Accessibility/perf
- Respect reduced-motion preference where possible.
- Keep phrase DOM count bounded (recycle old nodes).
- Use CSS transforms/opacity for smooth animation.

---

## 7) Trigger/Protocol Options

### Option A: Controller-driven (recommended)
Internal controller owns NSD lifecycle and asks model for structured phrases.

### Option B: Marker-driven (hybrid)
Support explicit markers for external prompt control:
- `V3C| TRIAL_START`
- `V3C| NSD_START`
- `V3C| NSD_LINE: <speaker> || <text> || weak_point=<true|false>`
- `V3C| NSD_END`
- `V3C| TRIAL_END`

Implement both eventually; start with controller-driven and add marker compatibility later.

---

## 8) Settings Additions

Add to default settings (phase 1 candidates):
- `trialEnabled: true`
- `trialIntroMode: "auto" | "banner" | "full"`
- `trialWaveMin: 3`
- `trialWaveMax: 8`
- `trialWeakPointDensity: 0.25`
- `trialDebugOverlay: false`

Validation rules:
- clamp `trialWaveMin` and `trialWaveMax` to `[1, 12]`
- enforce `trialWaveMin <= trialWaveMax`
- clamp weak-point density to `[0.05, 0.6]`

---

## 9) Error Handling & Recovery

- If generation fails mid-wave:
  - Show short “interference” banner,
  - retry current phrase once,
  - skip phrase if retry fails.
- If repeated failures exceed threshold:
  - transition to `ERROR`,
  - offer “Resume Trial” or “Exit Trial”.
- Always run cleanup routine on any terminal transition.

---

## 10) Telemetry/Debug (local only)

Expose optional debug panel (behind setting):
- current FSM mode
- wave number / phrase index
- queue depth
- avg generation latency
- last error + stack snippet

Useful for tuning weak-point density and wave pacing.

---

## 11) Incremental Delivery Plan

### Milestone 1: Skeleton
- Add trial state/controller modules.
- Add map button that toggles `TRIAL_INTRO -> TRIAL_END` with no generation.

### Milestone 2: NSD Core
- Add phrase generation queue.
- Add floating phrase rendering + basic weak points.

### Milestone 3: Shooting + Resolution
- Add truth-bullet selection + shot events.
- Add hit/miss logic and trial progress rules.

### Milestone 4: Robustness
- Add cancellation hardening, fallback parser, retries.
- Add debug overlay and settings tuning.

---

## 12) Acceptance Criteria (Phase 1)

- Trial can be started from map in ≤2 clicks.
- NSD wave length randomizes between configured min/max.
- Main ST text box is hidden only during active overlay and always restored.
- At least one weak point appears within two waves.
- User can fire a truth bullet and receive deterministic hit/miss feedback.
- Exiting trial always aborts pending generation and leaves no orphan timers.

---

## 13) Recommended Next Step

Implement Milestone 1 immediately (state/controller skeleton + map CTA), then iterate behind a feature flag so users can opt into trial beta safely.
