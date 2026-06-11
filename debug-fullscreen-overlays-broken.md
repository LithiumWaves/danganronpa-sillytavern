[OPEN] Debug Session: fullscreen-overlays-broken

## Symptoms
- Fullscreen overlays (presentation + minigames) do not appear or do not function.
- Reported affected: Hangman’s Gambit, Question Time, Question Truth.

## Expected
- Starting these minigames should open a fullscreen overlay UI and accept input.

## Environment
- OS: Windows
- Host: SillyTavern extension (danganronpa-extension)
- Browser: (pending)
- ST version: (pending)
- Extension build: (pending)

## Hypotheses (falsifiable)
1) Overlay DOM is created but hidden behind another layer due to z-index / stacking context regression (evidence: overlay exists in DOM but not visible; computed z-index lower than frame/other overlays).
2) Overlay creation is never reached because the start callbacks (onStartHangmansGambit / onStartQuestionTime / onStartQuestionTruth) are undefined or throwing (evidence: click handler fires but throws / returns early; logs show missing deps).
3) Overlay is created then immediately removed by cleanup logic or state transitions (evidence: overlay appears briefly or logs show cleanup after creation).
4) CSS selectors changed in SillyTavern, so the overlay attaches to/queries elements that no longer exist, breaking initialization (evidence: null selectors during setup).
5) A global “trial active / overlay suppression” gate blocks the minigame overlays when VN/trial mode is active (evidence: branch condition prevents showing overlay).

## Evidence to Collect
- Button click → handler entry
- Dependency wiring present for each minigame callback
- Overlay root element creation + insertion + computed z-index
- Any thrown exceptions during overlay init

## Evidence (Collected)
- 2026-06-11: Question Time via Controls Panel
  - Trial panel button handler fired: `hasCallback: true`
  - Trial callback entered, but `questionTimeController: false`
  - Loading overlay created: `loadingEl: true`
  - `questionTimeController?.run(...)` returned `undefined` (`hasRunResult: false`)

## Interim Conclusion
- Hypothesis 2 is strongly supported: fullscreen minigame controllers are not initialized (controller variables are null), so overlay `.run()` is never called.
- Next: determine why controller initialization never runs or crashes (capture global errors + controller-init entry probe).

## Notes
- No business logic changes allowed before we collect runtime evidence (instrumentation first).
