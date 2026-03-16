# Nonstop Debate Redesign Blueprint

This redesign treats Nonstop Debate as a small runtime with explicit stages, cancellable generation jobs, and a bounded display queue.

## Why redesign

The previous idea couples generation, extraction, rendering, and weak-point logic too tightly. That makes it hard to interrupt safely when the player shoots a Truth Bullet.

The new approach separates Nonstop Debate into four lanes:

1. **Flow lane**: state transitions and round lifecycle.
2. **Generation lane**: creates candidate lines for upcoming turns.
3. **Rendering lane**: floating text and timing.
4. **Combat lane**: weak-point tagging and Truth Bullet hit resolution.

Each lane communicates through an event bus so any lane can be cancelled immediately when a hit is confirmed.

---

## Runtime model

## 1) Debate session object

Create a per-round session object so everything can be aborted from one place:

```js
{
  trialId,
  debateId,
  phase: "intro_cutscene" | "active" | "break" | "resolved" | "cancelled",
  targetTurns, // random int 3..8
  turnIndex,
  speakers,
  weakPoint: {
    turnId,
    quoteFragment,
    normalizedText,
    matched: false,
  },
  jobs: {
    generationController, // AbortController
    renderTimers: new Set(),
  },
  queue: {
    pendingLines: [],
    visibleLines: [],
  },
}
```

This object lives under trial session state and is replaced each new Nonstop round.

## 2) Deterministic stages per round

A single round always runs in this order:

1. `intro_cutscene` (short, fixed duration)
2. `active` (turn loop)
3. `break` (small cooldown)
4. if no successful hit, start next round at `intro_cutscene`
5. on successful hit, set `resolved` and transition trial phase forward

No other stage transitions are allowed.

## 3) Cancellation rules

All async work must accept a shared `AbortSignal`.

Cancel sources:
- truth bullet hit confirmed
- trial phase changes away from `nonstop_active`
- user exits/cancels trial
- hard timeout or safety guard trip

On cancel:
- abort generation controller
- clear pending render timers
- empty queues
- freeze weak-point checks

---

## Generation contract

## Prompt shape

Ask for exactly one spoken line per turn in strict format:

- `SPEAKER: "quoted dialogue"`
- no narration
- no stage directions
- one quote only

This sharply reduces extraction complexity.

## Turn prefetch strategy

Use low-risk pipelining:

- while displaying turn `n`, generate turn `n+1`
- keep at most **2** buffered lines
- if buffer full, pause generation requests

This preserves responsiveness while preventing runaway background jobs.

## Quote extraction

Extraction should be a pure function:

1. find first quoted segment (`"..."`)
2. fallback to smart quotes (`“...”`)
3. if no quote found, reject line and request a retry (max 2 retries)

Return:

```js
{
  speaker,
  raw,
  quote,
  normalizedQuote,
}
```

---

## Floating text renderer

## Display rules

- each quote spawns one floating text track
- tracks have deterministic lifetime (for example 4.5s) unless interrupted
- max visible tracks (for example 4); oldest expires first

## Weak-point attachment

Weak point is chosen once per round:

- pick one eligible quote after generation (usually not first turn to allow buildup)
- choose fragment length clamp (e.g., 12..42 chars)
- avoid stopword-only fragments

Render weak-point fragment with a distinct style/token ID for hit detection.

---

## Truth Bullet hit resolution

## Hit check pipeline

When player fires:

1. get current targeted floating text token
2. verify token is active and belongs to session `debateId`
3. compare bullet metadata against weak-point claim type (or text semantic rule)
4. emit `NSD_HIT_CONFIRMED` or `NSD_HIT_REJECTED`

## On hit confirmed

- immediately abort generation and rendering timers
- play impact VFX/SFX
- lock UI to result beat
- transition trial controller from `nonstop_active` -> `discussion_post_debate` (or next configured phase)

## On miss

- continue current round unless strike limit reached
- optional penalty: trust/distrust change or short stun window

---

## Suggested module split

- `trial/nonstop/nonstopDebateRuntime.js`
  - owns session object and stage machine
- `trial/nonstop/nonstopGenerator.js`
  - turn prompt + retries + abortable calls
- `trial/nonstop/nonstopQuoteParser.js`
  - extraction and normalization
- `trial/nonstop/nonstopRenderer.js`
  - floating text lifecycle and weak-point visual tagging
- `trial/nonstop/nonstopCombat.js`
  - Truth Bullet collision and hit logic
- `trial/nonstop/nonstopEvents.js`
  - tiny typed event emitter/constants

Keep `trialController.js` as orchestrator only; it should not manage per-turn internals.

---

## Trial controller integration

Use existing phases already present in `trialController`:

- enter `nonstop_intro_cutscene`
- then `nonstop_active`
- on hit: `discussion_post_debate`
- on no hit and round complete: bounce to `nonstop_intro_cutscene` and start next round

The runtime emits intent events, while `trialController` performs the actual phase transition guard checks.

---

## MVP implementation order (practical)

1. **Skeleton runtime + event bus** (no generation yet)
2. **Quote parser + fake line source** (deterministic local data)
3. **Floating text renderer** (with timer cleanup tests)
4. **Weak-point selection + hit/miss plumbing**
5. **Real generation adapter with retries + abort**
6. **Intro cutscene and polish**

This order lets you test combat correctness before model variability is introduced.

---

## Safety guards and telemetry

Add lightweight metrics per round:

- generated turns count
- parse failures
- retries used
- hit latency (ms from weak-point visible to hit)
- cancellation reason

And enforce hard guards:

- max round duration (e.g., 45s)
- max retries per turn (2)
- max buffered turns (2)

If any guard trips, cancel cleanly and fallback to `discussion_post_debate` with a neutral narration line.

---

## Pseudocode (end-to-end)

```js
async function runNonstopRound(ctx) {
  const session = createDebateSession(ctx);
  enterIntroCutscene(session);
  await wait(INTRO_MS, session.signal);

  transitionToActive(session);
  seedWeakPointPlan(session);

  while (!session.done && session.turnIndex < session.targetTurns) {
    const line = await generator.nextTurn(session);
    const parsed = parseQuote(line);
    if (!parsed.ok) continue;

    const token = renderer.spawn(parsed.value, session);
    maybeAttachWeakPoint(token, session);

    prefetchNextTurn(session);
    await renderer.waitTrackWindow(token, session.signal);
  }

  if (session.hitConfirmed) {
    return resolveHit(session);
  }

  enterBreak(session);
  await wait(BREAK_MS, session.signal);
  return repeatOrExit(session);
}
```

