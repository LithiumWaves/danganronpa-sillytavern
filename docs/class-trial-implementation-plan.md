# Class Trial Implementation Plan (Phased)

This plan breaks "The Second Part" into incremental phases so each milestone is testable and shippable.

## Goals
- Support two Trial start methods:
  - map interaction (Trial Grounds pin on floor 1)
  - marker-driven prompt (`V3C| TRIAL_START`) from assistant output
- Introduce a Trial-specific UI flow that can replace standard chat visuals (especially in Visual Novel mode).
- Implement Nonstop Debate as a controlled loop with weak points and Truth Bullet interactions.
- Keep generation stable by using bounded rounds and explicit state transitions.

## Architecture principles
1. **State machine first**: every trial action depends on a single active phase.
2. **Bounded generation**: avoid unbounded background generation chains.
3. **Marker optionality**: support both structured markers and fallback quote extraction.
4. **UI isolation**: use a global overlay mounted under `document.body` so DOM remounts don't break trial UI.
5. **Graceful fallback**: if VN mode is off, preserve core mechanics and show reduced visuals.

---

## Phase 1 — Trial foundation (start flow + state)

### Deliverables
- Add trial state module (single source of truth):
  - `idle`
  - `trial_intro`
  - `discussion_pre_debate`
  - `nonstop_intro_cutscene`
  - `nonstop_active`
  - `discussion_post_debate`
  - `mini_game`
  - `trial_result`
- Add a lightweight trial controller with start/stop/transition guards.
- Add marker parser support:
  - `V3C| TRIAL_START`
- Add modal confirmation prompt for marker-triggered start.
- Add data plumbing for per-trial session metadata:
  - case summary
  - equipped skills snapshot
  - truth bullets snapshot

### Acceptance criteria
- Trial can start from a marker and enter `trial_intro`.
- Duplicate markers do not retrigger during the same message/history pass.
- Trial start cancellation leaves system in `idle` with no side effects.

### Suggested tests/checks
- marker parsing unit checks for `TRIAL_START` variants.
- state transition checks (`idle -> trial_intro`, invalid transition rejection).

---

## Phase 2 — Map entry point + Trial Grounds pin

### Deliverables
- Add Trial Grounds location on Hope's Peak floor 1.
- Render a dedicated map pin/button for Trial start.
- Clicking pin opens the same Trial confirmation flow as marker-based starts.
- Optional setting to disable map-based Trial starts.

### Acceptance criteria
- Pin only appears on expected map/floor.
- Clicking pin starts Trial if confirmed.
- Map action and marker action share one code path (no duplicated logic).

### Suggested tests/checks
- render checks for floor/area gating.
- action wiring check (pin click -> controller start request).

---

## Phase 3 — Trial Intro UI shell (menu, skills, case summary)

### Deliverables
- Full-screen trial overlay:
  - Start Trial button
  - Equip Skills access
  - Case Summary panel at bottom
- UI mode switch behavior:
  - if VN mode on: hide main ST chat UI and use extension VN-style shell
  - if VN mode off: keep base chat, show trial shell overlays only
- Enter/exit transitions with SFX hooks.

### Acceptance criteria
- Overlay consistently mounts/unmounts with no orphaned nodes.
- Chat visibility behavior matches VN mode state.
- Trial intro can move to `discussion_pre_debate`.

### Suggested tests/checks
- DOM lifecycle checks for overlay cleanup.
- class toggling checks for visibility mode.

---

## Phase 4 — Discussion phase runtime

### Deliverables
- Discussion renderer for pre/post debate segments.
- Controlled speaker sequencing logic.
- prompt contract for dialogue generation (with optional structured markers):
  - `V3C| TRIAL_DISCUSSION_START`
  - `V3C| TRIAL_DISCUSSION_END`

### Acceptance criteria
- Discussion can run before and after debates.
- Dialogue queue drains in order and can be interrupted by phase change.

### Suggested tests/checks
- queue cancellation on phase switch.
- ordering checks for speaker turn processing.

---

## Phase 5 — Nonstop Debate core loop

### Deliverables
- Nonstop intro cutscene:
  - spinning courtroom effect + banner in VN mode
  - banner-only fallback otherwise
- Bounded round generation (3–8 lines, randomized per round).
- Quote extraction pipeline for floating text rendering.
- Weak point assignment over phrase fragments.
- Truth Bullet shot handling + hit/miss outcomes.
- Loop repeat behavior until successful hit or explicit fail branch.

### Acceptance criteria
- Debate runs in deterministic rounds.
- On hit: generation stops immediately and phase advances.
- On miss/timeout: loop can continue or branch per design.

### Suggested tests/checks
- weak point selection constraints (never empty, always reachable).
- stop-generation guard checks after hit.
- per-round size bounds check (3–8 inclusive).

---

## Phase 6 — Minigame hooks (Hangman's Gambit and beyond)

### Deliverables
- Minigame phase entry API.
- First minigame scaffold (Hangman's Gambit placeholder or MVP).
- Result integration back into trial state machine.

### Acceptance criteria
- Minigame can be entered/exited without corrupting trial state.
- success/failure routes return to the expected trial phase.

---

## Phase 7 — Persistence, balancing, and polish

### Deliverables
- Persist partial trial state safely (chat reload resilience).
- Add configurable trial pacing settings (timers, round size bounds).
- Add diagnostics/debug panel for current trial phase + queue state.
- Final UX polish: SFX/animation tuning and accessibility pass.

### Acceptance criteria
- reload-safe restoration for active trial session.
- configurable pacing values validated and clamped.

---

## Marker specification (proposed)

### Required
- `V3C| TRIAL_START`

### Optional (recommended)
- `V3C| NSD_START`
- `V3C| NSD_END`
- `V3C| WEAK_POINT: <payload>`
- `V3C| TRIAL_DISCUSSION_START`
- `V3C| TRIAL_DISCUSSION_END`

Use optional markers when available; otherwise fallback to robust quote extraction + controller-managed flow.

---

## Initial implementation order
1. Phase 1 (foundation)
2. Phase 2 (map entry)
3. Phase 3 (intro UI shell)
4. Phase 5 (Nonstop Debate MVP)
5. Phase 4 (discussion runtime refinement)
6. Phase 6 (minigame hook)
7. Phase 7 (persistence + polish)

Reason: this yields a playable vertical slice early while preserving architecture quality.
