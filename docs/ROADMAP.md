# Roadmap: closing the gap with DR1, DR2 and V3

## Context
The user approved a roadmap (A–L) to close the gap with DR1, DR2 and V3. The phases marked
done below are built and pushed to `title-screen`, one commit per phase. This file keeps the full detail of each phase, so it
survives a `/clear`.

## Status
| Phase | What | Status |
|---|---|---|
| A | Case twists | ✅ Done |
| B | The three-witness rule | ✅ Done |
| C | Examine during daily life | ✅ Done |
| D | Motives as objects and conditions, foiled murders | ✅ Done |
| E | Rooms that close at night | ✅ Done |
| F | Group events in daily life | ✅ Done |
| G | Mysteries through the whole game (Flashback Lights optional) | ✅ Done |
| H | Exploring a newly unlocked floor | ✅ Done |
| I | Intermissions: Monokuma Theater, mastermind cutaways | ⬜ To do |
| J | Rules with real punishment | ✅ Done |
| K | A scripted prologue | ⬜ To do |
| L | Evidence readout | ✅ Done |

### Decisions from the user
- Planned murders can be foiled. If the deadline passes, the motive's penalty happens.
- The truth of the world is drafted by the AI and editable behind a spoiler gate.
- **Light rules:** Monokuma scolds and threatens.
- **Grave rules:** a Mukuro-style execution in the roleplay: a pink blood splash, the
  character marked dead. `/punishmenttime` doesn't play.
- Side modes (casino, Island Mode) are out of scope.
- Flashback Lights (Phase G) are optional: a setting, so the world's secrets can come only
  from exploration and Monokuma.

### Standing rules
- Nothing immersion-breaking goes into the chat.
- The UI never overlaps existing buttons.
- Every prompt can be edited in EDIT AI INSTRUCTIONS.
- There are debug commands for everything.
- Old saves keep working.
- One commit per phase, pushed to `title-screen`.
- Tests are plain `node *.test.mjs`.

### What A–C added (to build on)
- **`core/case/caseFile.js`:**
  - shapes: `CASE_SHAPES`, `caseBlackened`, `caseSecretHolders`, `secretRolesOf`,
    `getSecondVictim`, `getCaseBody(cf, index)`;
  - witnesses: `noteBodySeen`, `isAnnounceable`, `buildBodyAnnouncementBullet`.
- **`core/case/dailyExamine.js`:** daily spots, coins and hidden Monokumas, with the
  story key `dailyExamine`.
- **index.js:**
  - case flow: `bodySeen`, `maybeAnnounceBody`, `noteBodyWitnesses`;
  - examine: `loadDailySpots`, `examineLookDaily`, `canExamineHere`;
  - `/case shape|witnesses`, `/examine coins`.

---

## Phase D: Motives as objects, conditions and foiled murders (#3) — ✅ done
Built as planned, with these differences: the motive stays inside `caseFile.motive`; the
player's motive item isn't stored in the inventory but shown in Key Items through
`getExtraKeyItems` while the case is open; the planner's motive kind comes from
Settings > Gameplay > Motive kinds; `/case kind <kind>` replans with a new motive. Helpers:
`nextMurderSlot`, `shouldFoil`, `foilAttempt`, `isDeadlinePassed`, `avertCase`,
`getMotiveItem`, `isAfflicted`, `isCaseOver` (`core/case/caseFile.js`); index.js
`foilCaseAttempt`, `handleMotiveDeadline`, `deliverMotiveItem`.

**Motive kind**:
- `motive.kind` is `announcement | object | condition`. `motive.penalty` is what Monokuma
  does if the deadline passes with no murder.
- Both are generated with the plan and editable in EDIT MOTIVE (`truth/motiveEditor.js`,
  still spoiler-free).

**object** (DVDs, secrets envelopes, V3 motive videos):
- Each living student gets a personal item with hidden contents
  (`motive.items: { name: { title, contents } }`).
- The player's goes into Key Items (`inventory.keyItems`, `items/itemsPanel.js`), with
  its contents readable.
- Each character's item is only in their own prompt note.
- The planner may make an item evidence ("Leon's DVD was in the trash"). A key item
  can become a Truth Bullet once the body is found.

**condition** (Despair Disease, hunger):
- `motive.afflicted: [names]` with an effect.
- Each afflicted speaker gets an `[AFFLICTED]` note; everyone else gets a general note.
- It lifts when the case closes.

**Foiling:**
- At the murder slot (`maybeCommitMurder`), if the killer or the victim is one of the
  player's followers, or in the player's room, the attempt is foiled:
  - `attempts += 1`;
  - the murder moves to the next slot, as long as that's on or before the deadline;
  - the killer's note says the attempt failed;
  - a debug toast.
- **Deadline passes with no murder:**
  - Monokuma's penalty announcement (a monitor announcement with `motive.penalty`);
  - a one-time `[MONOKUMA'S PENALTY]` note;
  - the case closes as `averted` (a new status), so a new motive can come.
- **The V3 time limit** ("everyone dies if nobody kills"): the player is asked to confirm
  whether to play it out or have Monokuma relent with a new motive. There are no mass
  deaths without consent.

**Debug:** `/case foil`, `/case deadline`.

## Phase E: Rooms that close at night (#6) — ✅ done
Built with these differences: the night lock is separate from `isPinLocked` (that stays the
chapter lock, so the case planner still lists the rooms): `isPinClosedNow`,
`listNightClosedPins`, `getFloorHubFor` on the map controller, and
`getConnectionsForLocationId(id, { includeClosed })` flags closed connections with `closed`.
`isClosedAtNight(pin)` (`map/defaultPins.js`) applies the Hope's Peak defaults by pin id.
Only the player needs moving out at the night announcement (`leaveRoomClosedAtNight`); the
night shuffle already skips closed rooms. `moveCharactersTo(names, roomId)` was added to the
overworld for Phase F.

- Pins get `closedAtNight`:
  - a CLOSED AT NIGHT toggle in the pin editor (`map/mapPanel.js`);
  - Hope's Peak defaults: the dining hall/cafeteria and kitchen.
- `isConnectionLocked`/`isPinLocked` lock them while it's night. Move To and the minimap
  say "Closed at night".
- Night spawns and routines skip them (`listSpawnableRoomIds`, `applyRoutines`).
- Someone still inside at the night announcement is moved out to the floor hub, with a
  VN aside.
- The case planner gets "Rooms locked at night: …" for alibis. The rules prompt names them.
- **Debug:** `/rooms closed`.

## Phase F: Group events in daily life (#7) — ✅ done
Built with these differences: `core/events/groupEvents.js` holds the pure helpers
(`parseEventMarkers`, `eventFromMarker`, `addGroupEvent`, `eventsForSlot`, `finishPastEvents`,
`eventAttendees`, `buildEventTodayNote`, `describeEventsForCase`); the note goes out on its own
prompt key (`dangan_group_events`, synced with the marker prompts) rather than inside the
room context prompt, and also tells everyone what's planned. The marker takes an optional
fifth part, the invitees (default everyone). A public murder's gathering names `eventId` and
takes the event's room and slot. Extra debug: `/events propose|gather|attend|cancel|open|clear`.

- New story key: `groupEvents: [{ id, title, host, roomId, day, time, attendees, status }]`.
- **How events start:**
  - A classmate proposes one in the roleplay with `V3C| EVENT: Title | room | Day N
    day|night | Host`. It's in the daily life markers block and is parsed once the reply
    has finished.
  - An optional morning hidden call has classmates propose events: **Classmates plan
    events** (off / sometimes).
  - The player can use PLAN EVENT in the Phase HUD menu.
- **The event's slot:**
  - The overworld moves the attendees into the room (the followers path).
  - An `[EVENT TODAY]` note goes to replies in that room.
  - An Events list in the Social tab has attend/cancel.
- `buildCaseGenerationPrompt` gets the upcoming events. A public murder's gathering can
  be one of them.
- **Debug:** `/events`, `/events add …`.

## Phase G: Mysteries that run through the whole game (#4) — ✅ done
Built with these differences:
- Flashback Lights are a setting (**Flashback Lights**, on by default). Off, flashback secrets
  are hidden in rooms and found by exploring (`revealWay`).
- Until Phase I's intermissions exist, Monokuma's secrets come out at a chapter's start, over
  the monitors (`onChapterStartForWorld`, run after the new-floor announcement).
- One WORLD button in the Truth tab holds both the spoiler-free list and the gated editor
  (`truth/worldTruthEditor.js`), so there's no separate `secretsView.js`.
- A secret file's spot in its room is picked the first time the room is examined in its
  chapter (`findSecretAtSpot`); with daily examine off, walking in finds it.
- The MARK AS MASTERMIND stamp only reveals the final truth once the final chapter has come.
- The final trial: `startFinalTrial` sets `worldTruth.finalTrial = "active"`, `caseTruthFor`
  sends `buildWorldTruthBlock`, the vote's answer is the mastermind, and `finishFinalTrial`
  reveals the final secrets, opens the HOPE / DESPAIR screen (`trial/finalTrial.js`), writes the
  ending into the chapter journal and plays Happy or Sad tracks. Leaving the trial before the
  vote resets it.
- Extra debug: `/world chapter [n]`, `/world flashback`, `/world final`, `/world ending [name]`,
  `/world clear`.
- New story key: `worldTruth: { mastermind, goal, outsideWorld, secrets: [{ id, title,
  text, chapter, source: monokuma|exploration|flashback|final, revealed }] }`.
- Drafted by one hidden call (the cast, the lorebook, the map) at New Game or on demand.
- Edited in a spoiler-gated **Secrets of the World** editor (Truth tab WORLD button,
  following the Case File editor pattern).
- **Reveals:**
  - **Exploration:** secret files hidden in daily examine spots (Phase C's `dailyExamine`)
    and on newly unlocked floors.
  - **Flashback Light:** a key item handed out at chapter start. It plays a white-flash
    memory scene in the VN box.
  - **Monokuma:** reveals during the intermissions (Phase I).
- **Revealed secrets** show in a spoiler-free Secrets list (Truth tab) and go in a
  `[WHAT EVERYONE NOW KNOWS]` prompt block.
- **Mastermind:**
  - The MARK AS MASTERMIND stamp is linked: stamping the right person reveals the final
    secret.
  - The mastermind gets a subtle `[SECRET FOR X ONLY]` note across chapters.
- **Final trial:**
  - START FINAL TRIAL (chapter ≥ setting `finalChapter`, or EPILOGUE), with no victim.
  - The trial context comes from the world truth (`trialManager.setTrialContext`), and a
    `purpose: "world"` variant of `buildTrialTruthBlock`.
  - The vote names the mastermind.
  - It ends with a **HOPE / DESPAIR** choice screen, which writes the ending to the
    chapter journal and plays the ending track.
- **Debug:** `/world status`, `/world reveal [id]`, `/world draft`.

## Phase H: Exploring a newly unlocked floor — ✅ done
Built as planned: `core/explore/floorExplore.js` (story key `floorExplore`), the map
controller's `listFloorUnlocks`, `openFloorsForChapter` on a chapter increase (an announcement
over the monitors, label "A NEW AREA IS OPEN"), and the hint in the Phase HUD menu. Debug:
`/newfloors [open <chapter>|clear]`.
- When a floor unlocks at a chapter change (`setCurrentChapterIndex`), Monokuma's
  announcement mentions it.
- An EXPLORE checklist of its rooms shows in the Phase HUD hint until each room has been
  entered once. It's not a gate.

## Phase I: Intermissions — Monokuma Theater and mastermind cutaways
- **Between chapters** (on `/nextchapter`, after a trial closes; setting on):
  - **Monokuma Theater:** a curtain stage, Monokuma's sprite, and a short monologue from
    the chapter journal (a hidden call, editable prompt).
  - **Mastermind cutaway:** a silhouette scene with lines from `worldTruth`. The name is
    never shown, and nothing goes in the chat.
- **Optional:** a short theater piece at each Night Time announcement (off by default).
- **Debug:** `/theater`.

## Phase J: Rules with real punishment — ✅ done
Built as planned: `RULE_SEVERITY`, `setRuleSeverity`, `ruleByNumber`, `buildRuleBreakNote`
(`core/rules/schoolRules.js`; old saves read `default-5` as grave), `vfx/bloodSplash.js`, and
`onSchoolRuleBroken(name, ruleNumber)` in index.js. The one-time note is kept per save
(`ruleBreakNote`) on its own prompt key and spent once a reply carrying it renders. A grave
punishment turned down at the confirm becomes a final warning.
- Rules get `severity: light | grave`:
  - a toggle in the RULES view (`truth/schoolRulesView.js`);
  - the defaults: violence against Monokuma or the cameras is grave;
  - `RULE_ADD` rules are light, unless `| grave`.
- The marker becomes `V3C| RULE_BREAK: Name | rule number`.
- **Light:** Monokuma comes on stage, plus a one-time `[RULE BROKEN]` note: scold and
  threaten.
- **Grave:**
  - first, a confirm (setting **Confirm grave punishments**, on);
  - then a full-screen pink blood splash (`vfx/bloodSplash.js`, CSS + sfx);
  - the character is marked dead (the Social DEAD stamp path);
  - Monokuma's next reply narrates it, Mukuro style.
- **When the player breaks a grave rule:** a light punishment with a final warning. The
  game never kills the player.
- **Debug:** `/rules break <name> [n]`.

## Phase K: A scripted prologue
- An optional Prologue in NEW GAME and `/prologue`. The per-save `prologue: { step }`
  runs the steps, each as a HUD hint plus a hidden note:
  1. **Waking up** in a classroom: a VN aside.
  2. **Meeting everyone:** done once all are introduced (`introducedCharacters`).
  3. **The gym orientation:** a Monokuma host speech (the `/trigger` path), with the
     regulations.
  4. **Getting the Monopad:** it glows, then opens to RULES. A HUD action moves to
     Chapter 1.
- **Debug:** `/prologue step <n>`, `/prologue skip`.

## Phase L: Evidence readout (optional) — ✅ done
Built as planned: `countFoundClues` (`core/case/caseFile.js`), shown by `bodyFoundSuffix` in
the phase readout.
- A Gameplay setting, **Show key evidence found** (off).
- During an investigation, the Phase HUD adds "EVIDENCE x/y" (the plan's clues that are
  found; emergent clues aren't counted).

---

## Files (main ones)
- **New:**
  - `core/world/worldTruth.js` (+ test), `truth/worldTruthEditor.js`,
    `truth/secretsView.js`, `trial/finalTrial.js`;
  - `core/events/groupEvents.js` (+ test), `social/eventsView.js`;
  - `vfx/bloodSplash.js`, `monokuma/theater.js`, `core/prologue/prologue.js`.
- **Changed:**
  - case: `core/case/*`, `truth/caseFileEditor.js`, `truth/motiveEditor.js`;
  - map and overworld: `map/mapPanel.js`, `overworld/overworldScene.js`;
  - rules: `core/rules/schoolRules.js`, `truth/schoolRulesView.js`;
  - shared: `index.js`, `core/constants.js`, `core/saves/saveStore.js`, `monopad.html`,
    `README.md`.

## Verification
- **Every phase:** unit tests for its pure helpers, `node` on all `*.test.mjs`,
  `node --check index.js`, and headless screenshots of new overlays.
- **Hand-checks for the user:**
  - `/case foil`, then let the deadline pass → the penalty;
  - the dining hall locks at night;
  - a `V3C| EVENT` gathers people;
  - `/world draft`, then a Flashback Light reveals a secret;
  - `/theater`;
  - `/rules break X 5` → a confirm, then the blood splash and X marked dead;
  - `/prologue`.
