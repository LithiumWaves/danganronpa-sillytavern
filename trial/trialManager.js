// trial/trialManager.js

import { attachCursorSway } from "../vfx/cursorSway.js";

export const TrialPhases = {
    IDLE: 'idle',
    PRE_DEBATE: 'pre_debate',
    NON_STOP_DEBATE: 'non_stop_debate',
    MASS_PANIC_DEBATE: 'mass_panic_debate',
    TRUTH_BULLET_EXPLANATION: 'truth_bullet_explanation',
};

export function createTrialManager(deps) {
    const {
        extensionName,
        extensionSettings,
        extensionFolderPath,
        saveSettingsDebounced,
        vnModeController,
        getTruthBullets,
        generateTrialDialogue,
        getCharacterSourceText,
        getEmotionFont,
        onTrialStateChange,
        getSpriteUrl,
        playSfx,
        getSfx,
        characters,
        playDebatesTrack,
        stopDebatesTrack,
        playPanicTrack,
        playTrialGeneralTrack,
        suppressVisualizer,
        unsuppressVisualizer,
        onStartHangmansGambit,
        onStartPanicTalkAction,
        onStartInterjection,
        onStartVotingTime,
        onStartQuestionTime,
        onStartQuestionTruth,
        onStartChoosing,
        onStartMassPanicDebate,
        onStartRebuttalShowdown,
        onStartPunishmentTime,
        onStartScrumDebate,
        onStartMindMine,
        getEquippedSkillsSnapshot,
        attachDraggablePositioning,
        applyCustomUiPosition,
        awardXp,
        xpRewards,
        getLecternUrl,
        getCustomGameMasterName,
        getCharacterDisplayName,
        deductMonocoins,
        showMinigameLoadingState,
    } = deps;

    function getAssetUrl(name) {
        const base = extensionFolderPath || `scripts/extensions/third-party/${extensionName}`;
        return `${base}/assets/classtrial/${name}`;
    }

    let currentState = TrialPhases.IDLE;
    let trialActive  = false;  // true only while a trial is in progress; false after /end-trial
    let currentDebateSections = 0;
    let selectedTruthBulletIndex = 0;
    let debateOverlay = null;
    let reticleEl = null;
    let detachReticleSway = null;
    let cutsceneOverlay = null;
    let statementEl = null;
    let statementAnimation = null;
    let playbackTimerId = null;
    let currentSpeaker = null;
    // Reference to the open CG name panel's text node (or null when no CG
    // overlay is visible). updateGroupChatSpeaker writes through this so
    // the CG label follows Prev/Next navigation.
    let cgNameTextEl = null;
    let currentWeakPointInfo = null;
    let preparedDebateSections = null;
    let debateSectionsActive = null;
    let debateSectionIndex = 0;
    let debatePartIndex = 0;
    let portraitImgEl = null;
    let portraitLeftEl = null;
    let portraitRightEl = null;
    let portraitToken = 0;
    let portraitSpeaker = null;
    let portraitEmotion = null;
    let debateSeatingPlan = null;
    let paradeController  = null;
    let characterEmotions  = new Map();
    let characterSpriteUrls = new Map(); // name → last successfully-resolved portrait URL
    let lastHitBullet = null;
    let lastHitWeakPoint = null;
    let rebuttalPromptActive = false;
    let persistentDebateHistory = [];
    let trialContext = { topic: '', goal: '', suspects: [] };
    // suspects: [{ name: string, chance: number }]  (chance is 0–100)
    let speedModifier = 1.0;
    let revolverAngle  = 0;
    let revolverTarget = 0;
    let revolverSpinRaf = null;
    let seatingDebugMode = 'circle'; // 'circle' | 'line'
    let lastSeatingDebugSpeaker = null;
    let btCharge = 1.0;
    const NSD_HEALTH_MAX = 3;
    const NSD_BREAK_PENALTY = 50;
    // Shared by NSD and MPD: both phases use the same on-screen timer, the same
    // floor, and the same LLM-extensible override field on their scenario arrays.
    const DEBATE_TIMER_MIN_MS = 120_000;        // 2-minute floor for NSD and MPD timers
    let debateTimerDurationMs = DEBATE_TIMER_MIN_MS;
    let debateTimerStartTs = 0;

    // Set the debate time limit. Floor-clamped to DEBATE_TIMER_MIN_MS so the timer is
    // never shorter than two minutes; LLM-supplied scenarios may request more.
    function setDebateTimeLimit(ms) {
        const requested = Number(ms);
        debateTimerDurationMs = Math.max(DEBATE_TIMER_MIN_MS, Number.isFinite(requested) ? requested : 0);
    }

    function updateDebateTimer(nowMs) {
        const remaining = Math.max(0, debateTimerDurationMs - (nowMs - debateTimerStartTs));
        const el = document.getElementById('dangan-nsd-timer');
        if (el) {
            const mins   = Math.floor(remaining / 60000);
            const secs   = Math.floor((remaining % 60000) / 1000);
            const millis = Math.floor(remaining % 1000);
            el.textContent =
                String(mins).padStart(2, '0') + ':' +
                String(secs).padStart(2, '0') + ':' +
                String(millis).padStart(3, '0');
            el.classList.toggle('hg-urgent', remaining < 10000);
        }
        if (remaining <= 0 && !nsdBreakTriggered) {
            nsdBreakTriggered = true;
            // Treat timeout as full damage — wipe HP, flash/shake/SFX,
            // then break. nsdBreakTriggered gate ensures the monocoin
            // deduction inside triggerNsdBreak only ever fires once.
            nsdHealth = 0;
            const heartsEl = document.getElementById('dangan-nsd-hearts');
            if (heartsEl) heartsEl.style.setProperty('--gauge-pct', `${NSD_HP_TO_GAUGE[0]}%`);
            triggerNsdDamageFx();
            triggerNsdBreak();
        }
    }
    // Discrete HP → gauge-pct mapping. Steps are aligned to the heart positions
    // in hearts.svg so each remaining HP shows a fully-on heart and the gauge
    // only reads as fully empty when HP is exactly 0.
    const NSD_HP_TO_GAUGE = [0, 35, 75, 100];
    let nsdHealth = NSD_HEALTH_MAX;
    let nsdBreakTriggered = false;

    function deductNsdHealth() {
        if (nsdHealth <= 0) return;
        nsdHealth = Math.max(0, nsdHealth - 1);
        const el = document.getElementById('dangan-nsd-hearts');
        if (el) el.style.setProperty('--gauge-pct', `${NSD_HP_TO_GAUGE[nsdHealth]}%`);
        triggerNsdDamageFx();
        if (nsdHealth === 0 && !nsdBreakTriggered) {
            nsdBreakTriggered = true;
            triggerNsdBreak();
        }
    }

    function triggerNsdDamageFx() {
        playSfx?.('wn_damage');
        let flash = document.getElementById('dangan-nsd-damage-flash');
        if (!flash) {
            flash = document.createElement('div');
            flash.id = 'dangan-nsd-damage-flash';
            document.body.appendChild(flash);
        }
        flash.classList.remove('flash');
        requestAnimationFrame(() => {
            flash.classList.add('flash');
            window.setTimeout(() => flash.classList.remove('flash'), 200);
        });

        document.body.classList.remove('dangan-nsd-shaking');
        void document.body.offsetWidth;
        document.body.classList.add('dangan-nsd-shaking');
        window.setTimeout(() => {
            document.body.classList.remove('dangan-nsd-shaking');
        }, 1000);
    }

    function triggerNsdBreak() {
        try { deductMonocoins?.(NSD_BREAK_PENALTY, 'Debate break (health depleted)'); } catch {}
        window.setTimeout(() => {
            if (isDebateActive()) {
                setState(TrialPhases.PRE_DEBATE);
            }
        }, 600);
    }
    let btConcentrateActive = false;
    let btConcentrateRaf = null;
    let btLastTs = null;
    const BT_DRAIN_RATE    = 1 / 4;  // full drain in 4 s
    const BT_RECHARGE_RATE = 1 / 8;  // full refill in 8 s
    let nsdActiveBullets = null;  // filtered bullet list for the current NSD; null = use full list
    let adjacentHideTimer = null;
    let keysPressed = new Set();
    let shiftLeftPressed  = false;
    let shiftRightPressed = false;
    let absorbTarget      = null;   // weak-point element being charged for absorption
    let absorbTimerId     = null;   // 3-second charge timeout
    let absorbStartTime   = null;   // charge start (ms)
    let absorbRafId       = null;   // RAF for progress ring
    let tempBullet        = null;   // current absorbed temporary truth bullet
    let scanningAudio     = null;   // looping scanning-shot.wav during charge
    let lieHeld           = false;  // Enter key held for lie-scan mode
    let lieAbsorbTarget   = null;
    let lieAbsorbTimerId  = null;
    let lieAbsorbStartTime = null;
    let lieAbsorbRafId    = null;
    let lieScanningAudio  = null;
    let lieGenerationPromise = null; // kicked off at scan start, awaited at completion
    let nsdLieLoading = false;       // true while awaiting the generated lie
    let nsdIntroPlaying = false;     // true during pre-intro + bullet intro — blocks fires

    function showLieLoadingState() {
        const activeCartridge = document.querySelector('.dangan-bullet-cartridge--active');
        if (!activeCartridge) return;
        activeCartridge.classList.add('lie-loading');
        const nameEl = activeCartridge.querySelector('.dangan-bullet-cartridge-name');
        if (nameEl) {
            nameEl.innerHTML = `<span class="lie-loading-dots"><span></span><span></span><span></span></span>`;
        }
    }
    let btSlowmoAudio = null;
    let ffAudio = null;
    let nsdKeyAC = null;
    let perjuryChargeTimer = null;
    let isPerjuryCharged = false;
    let lastHitWasPerjury = false;
    let shotCooldown = false;
    let gcpStage        = null;       // #dangan-group-chat-stage element
    let gcpSlots        = [];        // array of { name, el, img }
    let gcpIndexMap     = new Map(); // normalizedName → gcpSlots index (filtered subset)
    let gcpCurrentFloat = 0;         // fractional center index (animated)
    let gcpAnimRafId    = null;      // RAF id for scroll animation
    let gcpInitializing = false;     // true while initGroupChatPortraits is awaiting sprites
    // Subscribers that need to re-render whenever the GCP slot order changes
    // (Trial Panel's seating list, Controls Panel's seating list, etc.).
    const gcpSeatingListRenderers = new Set();
    const notifyGcpSeatingListRenderers = () => gcpSeatingListRenderers.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    let gcpLastCamIdx   = null;      // slot index for which we last fired the camera shot
    let gcpBgLoopEl     = null;      // repeating background overlay for seamless circular pan
    let gcpBgImgWidth   = 0;         // rendered px width of background image at current viewport height
    let gcpBgCurrentPx  = 0;        // current background-position-x in pixels (for wrap detection)
    let nsdShiftParadeStop = null;   // stop fn for in-progress speaker-shift parade (NSD only)
    let lastCamShot = null;
    const CAM_SHOTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

    // Shared white-noise animation pool — one RAF loop drives all active elements.
    let wnAnimPool  = [];
    let wnPoolRafId = null;
    let activeWhiteNoiseEls = [];
    let hoveredWhiteNoise = null;
    let lastCursorX = 0;
    let lastCursorY = 0;
    let wnSpaceHeld = false;
    let wnSpaceTapTimer = null;
    let wnSpaceRepeatTimer = null;

    // Characters who are muted (disabled) but have a dead.png — seated but never speak.
    const silencedSeats = new Set();

    function isSilenced(name) {
        return silencedSeats.has(normalizeSeatName(String(name || '')));
    }

    function isMonokuma(name) {
        const key = normalizeSeatName(name);
        if (key === 'monokuma') return true;
        // When the user has selected a custom Game Master, the chosen character
        // takes Monokuma's role — every Monokuma-ness check below (sprite
        // resolution, solo speaker layout, antagonist filters) should fire for
        // them too.
        const custom = typeof getCustomGameMasterName === 'function'
            ? getCustomGameMasterName()
            : null;
        if (custom && normalizeSeatName(custom) === key) return true;
        return false;
    }

    // ── Mass Panic Debate state ───────────────────────────────────────────────
    let mpdScenarios        = null;
    let mpdLockActive       = false;
    let mpdFreeColumn       = -1;
    let mpdChainBreakCount  = 0;
    let mpdWeakPointEl      = null;
    let mpdLockTimer        = null;
    let mpdColEls           = [null, null, null];
    let mpdColAnims         = [null, null, null];
    let mpdColumnSpeakers   = [null, null, null];
    let mpdRHeld            = false;
    let mpdRTapTimer        = null;
    let mpdRRepeatTimer     = null;
    // Breaks needed scales with debate size: ≤3 → 3 (SM), ≤6 → 5 (MD), ≤9 → 6 (LG), >9 → 8 (XL)
    function mpdBreaksNeeded() {
        const n = mpdScenarios?.length ?? 0;
        if (n <= 3) return 3;
        if (n <= 6) return 5;
        if (n <= 9) return 6;
        return 8;
    }
    const MPD_LOCK_CHANCE_PER_SCENARIO = 0.35;
    let mpdSkillBetaBlock       = false;
    let mpdSkillSeatingPlanCopy = false;

    function isDebateActive() {
        return currentState === TrialPhases.NON_STOP_DEBATE || currentState === TrialPhases.MASS_PANIC_DEBATE;
    }

    // Normalise a whiteNoise value to a non-empty string array, or null.
    // Accepts: null | undefined | "" | "single string" | ["a", "b", ...]
    function normalizeWhiteNoise(wn) {
        if (!wn) return null;
        const arr = Array.isArray(wn)
            ? wn.map(s => String(s || '').trim()).filter(Boolean)
            : [String(wn).trim()].filter(Boolean);
        return arr.length ? arr : null;
    }

    function parseMpdScenarios(rawScenarios) {
        return rawScenarios
            .filter(s => (s.texts || []).every(t => {
                const speaker = String(t.speaker || '').trim();
                return !speaker || !isCharacterDead(speaker);
            }))
            .map(s => {
                let weakSpotColumn = -1;
                const texts = (s.texts || []).map((t, col) => {
                    const hasWeak = /\[\[.*?\]\]/.test(String(t.text || ''));
                    if (hasWeak && weakSpotColumn === -1) weakSpotColumn = col;
                    return { text: String(t.text || ''), speaker: String(t.speaker || ''), whiteNoise: normalizeWhiteNoise(t.whiteNoise), isWeakPoint: hasWeak };
                });
                if (weakSpotColumn === -1 && texts.length) {
                    weakSpotColumn = Math.floor(Math.random() * texts.length);
                    texts[weakSpotColumn] = { ...texts[weakSpotColumn], isWeakPoint: true };
                }
                return { texts, weakSpotColumn };
            });
    }

    function getTrialPersistenceKey() {
        const ctx = window.SillyTavern?.getContext?.();
        const groupId = ctx?.groupId ?? ctx?.group_id ?? '';
        const chatId = ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatFile ?? '';
        const characterId = ctx?.characterId ?? ctx?.character_id ?? '';

        if (groupId) return `group_${groupId}`;
        if (chatId) return `chat_${chatId}`;
        if (characterId) return `char_${characterId}`;
        return 'default';
    }

    function setState(newState) {
        console.log(`[Dangan][Trial] State change: ${currentState} -> ${newState}`);
        const oldState = currentState;
        currentState = newState;
        try { onTrialStateChange?.(newState, oldState); } catch {}
        
        // Persist state to extension settings (per chat/group)
        if (typeof saveSettingsDebounced === 'function') {
            const key = getTrialPersistenceKey();
            if (!extensionSettings[extensionName].trials) {
                extensionSettings[extensionName].trials = {};
            }
            if (!extensionSettings[extensionName].trials[key]) {
                extensionSettings[extensionName].trials[key] = {};
            }
            
            extensionSettings[extensionName].trials[key].currentTrialState = newState;
            extensionSettings[extensionName].trials[key].persistentDebateHistory = persistentDebateHistory;
            saveSettingsDebounced();
        }

        const wasDebate = oldState === TrialPhases.NON_STOP_DEBATE || oldState === TrialPhases.MASS_PANIC_DEBATE;
        const isDebate  = newState === TrialPhases.NON_STOP_DEBATE || newState === TrialPhases.MASS_PANIC_DEBATE;
        const isNsd     = newState === TrialPhases.NON_STOP_DEBATE;
        document.body.classList.toggle('dangan-nsd-running', isNsd);
        if (wasDebate && !isDebate) {
            cleanupNSDListeners();
        } else if (isDebate && !wasDebate) {
            setupNSDListeners();
        }

        // Hide GCP only during actual debate overlays (NSD/MPD); keep visible during
        // IDLE, PRE_DEBATE, TRUTH_BULLET_EXPLANATION, etc.
        const gcpVisible    = newState !== TrialPhases.NON_STOP_DEBATE && newState !== TrialPhases.MASS_PANIC_DEBATE;
        const gcpWasVisible = oldState !== TrialPhases.NON_STOP_DEBATE && oldState !== TrialPhases.MASS_PANIC_DEBATE;
        if (gcpVisible !== gcpWasVisible) {
            setGroupChatPortraitsVisible(gcpVisible);
        }

        syncUI();
        syncPrompt();
    }

    function setupNSDListeners() {
        if (nsdKeyAC) nsdKeyAC.abort();
        nsdKeyAC = new AbortController();
        const signal = nsdKeyAC.signal;

        window.addEventListener('keydown', (e) => {
            keysPressed.add(e.key);
            if (e.code === 'ShiftLeft')  { shiftLeftPressed  = true; }
            if (e.code === 'ShiftRight') { shiftRightPressed = true; reticleEl?.classList.add('absorb-mode'); }
            if (e.key === 'Enter' && isDebateActive()) {
                e.preventDefault();
                if (!lieHeld) { lieHeld = true; reticleEl?.classList.add('lie-mode'); }
            }
            updateSpeedModifier();

            if (e.key === ' ' && currentState === TrialPhases.NON_STOP_DEBATE) {
                e.preventDefault();
                if (!wnSpaceHeld) {
                    wnSpaceHeld = true;
                    doWnSpaceFire();
                    // After tap window, begin 0.5s hold repeat
                    wnSpaceTapTimer = setTimeout(() => {
                        if (wnSpaceHeld) {
                            wnSpaceRepeatTimer = setInterval(() => {
                                if (wnSpaceHeld) doWnSpaceFire();
                            }, 500);
                        }
                    }, 250);
                }
            }

            if (e.key === ' ' && currentState === TrialPhases.MASS_PANIC_DEBATE) {
                e.preventDefault();
                if (!mpdRHeld) {
                    mpdRHeld = true;
                    mpdOnRPress();
                    mpdRTapTimer = setTimeout(() => {
                        if (mpdRHeld) {
                            mpdRRepeatTimer = setInterval(() => {
                                if (mpdRHeld) mpdOnRPress();
                            }, 500);
                        }
                    }, 250);
                }
            }
            if ((currentState === TrialPhases.NON_STOP_DEBATE || currentState === TrialPhases.MASS_PANIC_DEBATE) &&
                mpdSkillSeatingPlanCopy) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    seatingDebugMode = seatingDebugMode === 'circle' ? 'line' : 'circle';
                    const speaker = currentState === TrialPhases.MASS_PANIC_DEBATE ? '' : lastSeatingDebugSpeaker;
                    if (speaker != null) updateSeatingDebug(speaker);
                }
            }
            if (isDebateActive()) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const bullets  = getDebateBullets();
                    if (bullets.length > 1) {
                        const prevIdx    = selectedTruthBulletIndex;
                        const prevBullet = bullets[prevIdx];
                        if (e.key === 'ArrowDown') {
                            selectedTruthBulletIndex = (selectedTruthBulletIndex + 1) % bullets.length;
                            revolverTarget += 40;
                        } else {
                            selectedTruthBulletIndex = (selectedTruthBulletIndex - 1 + bullets.length) % bullets.length;
                            revolverTarget -= 40;
                        }
                        // Consume the temporary bullet the moment the player scrolls away from it
                        if (prevBullet?.isTemporary) {
                            const newBullets = bullets.filter(b => !b.isTemporary);
                            nsdActiveBullets = newBullets;
                            tempBullet       = null;
                            // If the removed entry was before the new selection, shift index down by 1
                            if (prevIdx < selectedTruthBulletIndex) selectedTruthBulletIndex--;
                            selectedTruthBulletIndex = Math.max(0, Math.min(selectedTruthBulletIndex, newBullets.length - 1));
                        }
                        playSfx?.('tbcycle');
                        renderCylinder();
                        showAdjacentBullets();
                    }
                }
            }
        }, { signal });

        window.addEventListener('keyup', (e) => {
            keysPressed.delete(e.key);
            if (e.code === 'ShiftLeft')  { shiftLeftPressed  = false; }
            if (e.code === 'ShiftRight') { shiftRightPressed = false; reticleEl?.classList.remove('absorb-mode'); cancelAbsorb(); }
            if (e.key === 'Enter') { lieHeld = false; reticleEl?.classList.remove('lie-mode'); cancelLieAbsorb(); }
            updateSpeedModifier();
            if (e.key === ' ') { clearWnSpaceTimers(); clearMpdRTimers(); }
        }, { signal });

        window.addEventListener('wheel', (e) => {
            if (!isDebateActive()) return;
            e.preventDefault();
        }, { signal, passive: false });

        // Perjury logic (NSD only)
        window.addEventListener('mousedown', (e) => {
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;
            if (nsdIntroPlaying) return;
            if (e.button !== 0) return; // Left click only

            clearTimeout(perjuryChargeTimer);
            isPerjuryCharged = false;

            perjuryChargeTimer = setTimeout(() => {
                isPerjuryCharged = true;
                console.log('[Dangan][Trial] PERJURY CHARGED!');
                playSfx?.(getSfx?.().mode_switch || 'mode_switch');
                showPerjuryVfx(true);
            }, 1200); // 1.2s to charge
        }, { signal });

        window.addEventListener('mouseup', (e) => {
            if (!isDebateActive()) return;
            if (e.button !== 0) return;

            clearTimeout(perjuryChargeTimer);

            // Use the swayed reticle position (lastCursorX/Y) rather than the raw OS
            // mouse position so the Truth Bullet fires at where the player can see
            // the reticle pointing, not at the hidden OS pointer.
            if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
                // Block shots at locked columns
                const col = Math.max(0, Math.min(2, Math.floor((lastCursorX / window.innerWidth) * 3)));
                if (mpdLockActive && col !== mpdFreeColumn) {
                    mpdShowBlockedFeedback(col);
                    return;
                }
                handleShoot(e, false);
            } else {
                // If we are over a weak point, handle the shot
                handleShoot(e, isPerjuryCharged);
                isPerjuryCharged = false;
                showPerjuryVfx(false);
            }
        }, { signal });

        // Safety: reset on blur
        window.addEventListener('blur', () => {
            keysPressed.clear();
            shiftLeftPressed  = false;
            shiftRightPressed = false;
            reticleEl?.classList.remove('absorb-mode');
            reticleEl?.classList.remove('lie-mode');
            cancelAbsorb();
            lieHeld = false;
            cancelLieAbsorb();
            updateSpeedModifier();
            clearTimeout(perjuryChargeTimer);
            showPerjuryVfx(false);
        }, { signal });

        // White noise hover tracking via rect check (pointer-events: none on elements).
        // When the cursor-sway reticle is active, lastCursorX/Y is driven by its onFrame
        // callback (swayed position), and updateWhiteNoiseHover runs from that callback;
        // here we only update lastCursorX/Y as a fallback while the reticle isn't attached.
        window.addEventListener('mousemove', (e) => {
            if (!detachReticleSway) {
                lastCursorX = e.clientX;
                lastCursorY = e.clientY;
                updateWhiteNoiseHover(e.clientX, e.clientY);
            }
        }, { signal });
    }

    function updateWhiteNoiseHover(cx, cy) {
        if (!isDebateActive() || !activeWhiteNoiseEls.length) {
            if (hoveredWhiteNoise) { hoveredWhiteNoise.classList.remove('hovered'); hoveredWhiteNoise = null; }
            return;
        }
        let found = null;
        for (const el of activeWhiteNoiseEls) {
            if (!document.body.contains(el) || el.classList.contains('breaking')) continue;
            const r = el.getBoundingClientRect();
            if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { found = el; break; }
        }
        if (found !== hoveredWhiteNoise) {
            hoveredWhiteNoise?.classList.remove('hovered');
            found?.classList.add('hovered');
            hoveredWhiteNoise = found;
        }
    }

    function showPerjuryVfx(active) {
        const reticle = document.getElementById('dangan-trial-reticle');
        if (reticle) {
            if (active) {
                reticle.classList.add('perjury-charging');
            } else {
                reticle.classList.remove('perjury-charging');
            }
        }

        let vfx = document.getElementById('dangan-perjury-charge-vfx');
        if (!vfx && active) {
            vfx = document.createElement('div');
            vfx.id = 'dangan-perjury-charge-vfx';
            document.body.appendChild(vfx);
        }
        if (vfx) vfx.classList.toggle('charging', active);
    }

    // ── Weak-point absorption ─────────────────────────────────────────────────

    function startAbsorb(wpEl) {
        if (nsdIntroPlaying) return;
        if (absorbTarget === wpEl) return;
        cancelAbsorb();
        absorbTarget    = wpEl;
        absorbStartTime = Date.now();
        reticleEl?.classList.add('absorb-charging');
        tickAbsorbProgress();
        absorbTimerId = setTimeout(completeAbsorb, 3000);
        // Loop scanning audio for the duration of the charge
        scanningAudio = new Audio(`${extensionFolderPath}/assets/sfx/trial/scanning-shot.wav`);
        scanningAudio.loop = true;
        scanningAudio.play().catch(() => {});
    }

    function cancelAbsorb() {
        clearTimeout(absorbTimerId); absorbTimerId = null;
        if (absorbRafId) { cancelAnimationFrame(absorbRafId); absorbRafId = null; }
        if (scanningAudio) { scanningAudio.pause(); scanningAudio = null; }
        absorbTarget    = null;
        absorbStartTime = null;
        reticleEl?.classList.remove('absorb-charging');
        reticleEl?.style.removeProperty('--absorb-progress');
    }

    function tickAbsorbProgress() {
        if (!absorbStartTime) return;
        const progress = Math.min(1, (Date.now() - absorbStartTime) / 3000);
        reticleEl?.style.setProperty('--absorb-progress', String(progress));
        if (progress < 1) absorbRafId = requestAnimationFrame(tickAbsorbProgress);
    }

    function showAbsorbFlash() {
        let el = document.getElementById('dangan-absorb-flash');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dangan-absorb-flash';
            document.body.appendChild(el);
        }
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }

    function completeAbsorb() {
        const wpEl = absorbTarget;
        // Stop scanning audio before cancelAbsorb clears it
        if (scanningAudio) { scanningAudio.pause(); scanningAudio = null; }
        cancelAbsorb();
        if (!wpEl?.isConnected) return;
        // Play completion sound
        new Audio(`${extensionFolderPath}/assets/sfx/trial/scanned-shot.wav`).play().catch(() => {});
        showAbsorbFlash();

        // Block if the weak point is in a locked MPD column
        if (currentState === TrialPhases.MASS_PANIC_DEBATE && mpdLockActive) {
            const rect    = wpEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const col     = Math.max(0, Math.min(2, Math.floor((centerX / window.innerWidth) * 3)));
            if (col !== mpdFreeColumn) return;
        }

        // Strip [[…]] markup to get the plain weak-point text
        const rawText  = (wpEl.textContent || '').replace(/^\[+|\]+$/g, '').trim() || 'ABSORBED TRUTH';
        tempBullet     = { title: rawText, text: rawText, isTemporary: true };

        // Inject at the end of the active bullet list
        const current       = getDebateBullets();
        nsdActiveBullets    = [...current, tempBullet];
        selectedTruthBulletIndex = nsdActiveBullets.length - 1;

        playSfx?.('tbcycle');
        renderCylinder();
        showAdjacentBullets();

        // Neutralise the absorbed weak-point visually
        wpEl.classList.remove('dangan-weak-point', 'mpd-weak-point');
        wpEl.style.cssText = '';
    }

    // ── Lie-scan absorption ────────────────────────────────────────────────────

    function startLieAbsorb(wpEl) {
        if (nsdIntroPlaying) return;
        if (lieAbsorbTarget === wpEl) return;
        cancelLieAbsorb();
        lieAbsorbTarget    = wpEl;
        lieAbsorbStartTime = Date.now();
        reticleEl?.classList.add('lie-absorb-charging');
        tickLieAbsorbProgress();
        lieAbsorbTimerId = setTimeout(() => void completeLieAbsorb(), 3000);
        lieScanningAudio = new Audio(`${extensionFolderPath}/assets/sfx/trial/scanning-lie.wav`);
        lieScanningAudio.loop = true;
        lieScanningAudio.play().catch(() => {});
        // Kick off generation immediately so it's ready by the time the charge completes
        const weakText = (wpEl.textContent || '').replace(/^\[+|\]+$/g, '').trim() || 'unknown claim';
        lieGenerationPromise = generateLieFromWeakPoint(weakText);
    }

    function cancelLieAbsorb() {
        clearTimeout(lieAbsorbTimerId); lieAbsorbTimerId = null;
        if (lieAbsorbRafId) { cancelAnimationFrame(lieAbsorbRafId); lieAbsorbRafId = null; }
        if (lieScanningAudio) { lieScanningAudio.pause(); lieScanningAudio = null; }
        lieAbsorbTarget      = null;
        lieAbsorbStartTime   = null;
        lieGenerationPromise = null;
        reticleEl?.classList.remove('lie-absorb-charging');
        reticleEl?.style.removeProperty('--lie-progress');
    }

    function tickLieAbsorbProgress() {
        if (!lieAbsorbStartTime) return;
        const progress = Math.min(1, (Date.now() - lieAbsorbStartTime) / 3000);
        reticleEl?.style.setProperty('--lie-progress', String(progress));
        if (progress < 1) lieAbsorbRafId = requestAnimationFrame(tickLieAbsorbProgress);
    }

    async function completeLieAbsorb() {
        const wpEl = lieAbsorbTarget;
        if (lieScanningAudio) { lieScanningAudio.pause(); lieScanningAudio = null; }
        cancelLieAbsorb();
        if (!wpEl?.isConnected) return;

        // Block if the weak point is in a locked MPD column
        if (currentState === TrialPhases.MASS_PANIC_DEBATE && mpdLockActive) {
            const rect    = wpEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const col     = Math.max(0, Math.min(2, Math.floor((centerX / window.innerWidth) * 3)));
            if (col !== mpdFreeColumn) return;
        }

        new Audio(`${extensionFolderPath}/assets/sfx/trial/scanned-lie.wav`).play().catch(() => {});
        showAbsorbFlash();

        // Lock fires + recolor the active cartridge purple with pulsing dots
        // while we wait for the model to return the lie text.
        nsdLieLoading = true;
        showLieLoadingState();

        const lieText = await (lieGenerationPromise ?? generateLieFromWeakPoint(
            (wpEl.textContent || '').replace(/^\[+|\]+$/g, '').trim() || 'unknown claim'
        ));

        nsdLieLoading = false;
        tempBullet = { title: lieText, text: lieText, isTemporary: true, isLie: true };
        document.body.classList.add('dangan-nsd-lie-armed');

        const current = getDebateBullets();
        nsdActiveBullets = [...current, tempBullet];
        selectedTruthBulletIndex = nsdActiveBullets.length - 1;

        playSfx?.('tbcycle');
        renderCylinder();
        showAdjacentBullets();

        wpEl.classList.remove('dangan-weak-point', 'mpd-weak-point');
        wpEl.style.cssText = '';
    }

    async function generateLieFromWeakPoint(weakPointText) {
        if (typeof generateTrialDialogue !== 'function') return 'Nothing of note.';
        const prompt = `You are writing fabricated evidence for a Danganronpa-style Non-stop Debate.

The player scanned a weak point and wants a LIE that directly contradicts it.

ORIGINAL WEAK POINT: "${weakPointText}"

Write a single short sentence (5–12 words) that is a plausible-sounding lie directly contradicting the original claim. Output ONLY the sentence — no quotes, no explanation, no speaker labels.

Example:
ORIGINAL: "The security footage clearly shows the door was locked all night."
OUTPUT: The door was secretly unlocked from the inside.`.trim();

        try {
            const out = String(
                await generateTrialDialogue(prompt, { maxTokens: 60, temperature: 0.85 }) || ''
            ).trim();
            return out.replace(/^["'"'`]|["'"'`]$/g, '').trim() || 'Nothing of note.';
        } catch {
            return 'Nothing of note.';
        }
    }

    function cleanupNSDListeners() {
        if (nsdKeyAC) {
            nsdKeyAC.abort();
            nsdKeyAC = null;
        }
        keysPressed.clear();
        shiftRightPressed = false;
        cancelAbsorb();
        lieHeld = false;
        cancelLieAbsorb();
        speedModifier = 1.0;
        clearWnSpaceTimers();
        clearMpdRTimers();
    }

    function applyCartridgeTheme(mod) {
        const bullets = getDebateBullets();
        const cur = bullets[selectedTruthBulletIndex];
        const isLieBullet = Boolean(cur?.isLie);

        const cylinderImg = document.getElementById('dangan-cylinder-img');
        document.querySelectorAll('.dangan-bullet-cartridge').forEach(c => {
            if (isLieBullet) {
                c.style.background   = 'linear-gradient(90deg, rgba(40,0,60,0.97) 0%, rgba(100,0,160,0.98) 22%, rgba(160,0,230,0.99) 55%, rgba(140,0,200,0.98) 80%, rgba(100,0,160,0.97) 100%)';
                c.style.boxShadow    = 'inset 0 2px 0 rgba(200,100,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 18px rgba(160,0,255,0.45), 4px 8px 28px rgba(0,0,0,0.75)';
                c.style.borderColor  = 'rgba(160,0,255,0.4)';
            } else if (mod > 1.0) {
                c.style.background   = 'linear-gradient(90deg, rgba(60,38,0,0.97) 0%, rgba(160,110,0,0.98) 22%, rgba(220,175,0,0.99) 55%, rgba(205,158,0,0.98) 80%, rgba(170,120,0,0.97) 100%)';
                c.style.boxShadow    = 'inset 0 2px 0 rgba(255,240,180,0.18), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 18px rgba(255,220,0,0.45), 4px 8px 28px rgba(0,0,0,0.75)';
                c.style.borderColor  = 'rgba(255,220,0,0.4)';
            } else if (mod < 1.0) {
                c.style.background   = 'linear-gradient(90deg, rgba(50,0,38,0.97) 0%, rgba(145,0,110,0.98) 22%, rgba(210,0,170,0.99) 55%, rgba(195,0,155,0.98) 80%, rgba(155,0,120,0.97) 100%)';
                c.style.boxShadow    = 'inset 0 2px 0 rgba(255,180,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 18px rgba(255,0,200,0.45), 4px 8px 28px rgba(0,0,0,0.75)';
                c.style.borderColor  = 'rgba(255,0,200,0.4)';
            } else {
                c.style.background   = '';
                c.style.boxShadow    = '';
                c.style.borderColor  = '';
            }
        });
        const indexEl = document.querySelector('.dangan-cylinder-index');
        // Match the line-overlay filter to whichever state the cylinder is in.
        // The cylinder img keeps its own filter (above); these are softer
        // variants on the same hue so the rings read as decoration, not
        // foreground. Cleared back to '' restores the CSS default cyan.
        const cylWrap = document.querySelector('.dangan-cylinder-wrap');
        if (cylinderImg) {
            if (isLieBullet) {
                cylinderImg.style.filter = 'sepia(1) hue-rotate(270deg) saturate(10) brightness(1.3) drop-shadow(0 0 18px rgba(160,0,255,0.9)) drop-shadow(0 0 45px rgba(160,0,255,0.6))';
                if (indexEl) { indexEl.style.color = '#aa00ff'; indexEl.style.textShadow = '0 0 12px rgba(160,0,255,0.9), 0 0 30px rgba(160,0,255,0.6), 2px 2px 4px rgba(0,0,0,0.9)'; }
                cylWrap?.style.setProperty('--cyl-line-filter', 'sepia(1) hue-rotate(270deg) saturate(10) brightness(1.3) drop-shadow(0 0 12px rgba(160,0,255,0.55))');
            } else if (mod > 1.0) {
                cylinderImg.style.filter = 'sepia(1) hue-rotate(10deg) saturate(8) brightness(1.4) drop-shadow(0 0 18px rgba(255,220,0,0.9)) drop-shadow(0 0 45px rgba(255,180,0,0.6))';
                if (indexEl) { indexEl.style.color = '#ffd700'; indexEl.style.textShadow = '0 0 12px rgba(255,220,0,0.9), 0 0 30px rgba(255,180,0,0.6), 2px 2px 4px rgba(0,0,0,0.9)'; }
                cylWrap?.style.setProperty('--cyl-line-filter', 'sepia(1) hue-rotate(10deg) saturate(8) brightness(1.4) drop-shadow(0 0 12px rgba(255,220,0,0.55))');
            } else if (mod < 1.0) {
                cylinderImg.style.filter = 'sepia(1) hue-rotate(285deg) saturate(8) brightness(1.3) drop-shadow(0 0 18px rgba(255,0,200,0.9)) drop-shadow(0 0 45px rgba(255,0,200,0.6))';
                if (indexEl) { indexEl.style.color = '#ff00cc'; indexEl.style.textShadow = '0 0 12px rgba(255,0,200,0.9), 0 0 30px rgba(255,0,200,0.6), 2px 2px 4px rgba(0,0,0,0.9)'; }
                cylWrap?.style.setProperty('--cyl-line-filter', 'sepia(1) hue-rotate(285deg) saturate(8) brightness(1.3) drop-shadow(0 0 12px rgba(255,0,200,0.55))');
            } else {
                cylinderImg.style.filter = '';
                if (indexEl) { indexEl.style.color = ''; indexEl.style.textShadow = ''; }
                cylWrap?.style.removeProperty('--cyl-line-filter');
            }
        }

        // Hue-shift the blue chrome bars to match the cartridge theme:
        // slow-mo → pink, fast-forward → yellow, normal → no filter.
        const blueChromeFilter =
            mod > 1.0 ? 'hue-rotate(220deg) saturate(1.5) brightness(1.05)' :
            mod < 1.0 ? 'hue-rotate(135deg) saturate(1.5) brightness(1.05)' :
            '';
        document.querySelectorAll('.dangan-tb-bar-bg, #dangan-nsd-status-bar').forEach(el => {
            el.style.filter = blueChromeFilter;
        });
        // Top-left speaker-scenario-bar lives on a pseudo-element, so push
        // the value through a CSS custom property instead.
        const topLeftEl = document.querySelector('.dangan-trial-top-left');
        if (topLeftEl) topLeftEl.style.setProperty('--speaker-bar-filter', blueChromeFilter || 'none');
    }

    function updateSpeedModifier() {
        let mod = 1.0;
        // Holding Shift slows down (0.4x) — only while charge remains
        if (shiftLeftPressed && btCharge > 0.01) {
            mod = 0.4;
        }
        // Holding Escape speeds up (16.0x)
        else if (keysPressed.has('Escape')) {
            mod = 16.0;
        }
        const wasFastForward = speedModifier > 1.0;
        speedModifier = mod;
        const isFastForward  = mod > 1.0;

        if (isFastForward && !wasFastForward) {
            if (!ffAudio) {
                ffAudio = new Audio(`${extensionFolderPath}/assets/sfx/trial/fast-forward.mp3`);
                ffAudio.loop = true;
                ffAudio.play().catch(() => {});
            }
        } else if (!isFastForward && wasFastForward) {
            if (ffAudio) { ffAudio.pause(); ffAudio.currentTime = 0; ffAudio = null; }
        }

        const overlay     = document.getElementById('dangan-nonstop-debate-overlay');
        const cylinderImg = document.getElementById('dangan-cylinder-img');
        const slOverlay   = document.getElementById('dangan-nsd-speedlines');

        if (overlay) {
            let btVfx   = document.getElementById('dangan-bt-vfx');
            let btAlert = document.getElementById('dangan-bt-alert-overlay');

            applyCartridgeTheme(mod);
            if (mod > 1.0) {
                if (slOverlay) slOverlay.classList.add('nsd-sl-active');
                if (btVfx)   btVfx.classList.remove('hg-active');
                if (btAlert) btAlert.classList.remove('hg-active');
            } else if (mod < 1.0) {
                if (slOverlay) slOverlay.classList.remove('nsd-sl-active');
                if (!btVfx) {
                    btVfx = document.createElement('div');
                    btVfx.id = 'dangan-bt-vfx';
                    overlay.appendChild(btVfx);
                }
                if (!btAlert) {
                    btAlert = document.createElement('div');
                    btAlert.id = 'dangan-bt-alert-overlay';
                    const alertBox = `<div class="hg-alert-box"><div class="hg-alert-word">ALERT</div><div class="hg-alert-concentrating">CONCENTRATING</div></div>`;
                    const alertRowContent = alertBox.repeat(36);
                    btAlert.innerHTML = Array.from({ length: 14 }, (_, i) =>
                        `<div class="hg-alert-row hg-alert-row-${i % 2 === 0 ? 'l' : 'r'}">${alertRowContent}</div>`
                    ).join('');
                    overlay.appendChild(btAlert);
                }
                requestAnimationFrame(() => {
                    btVfx.classList.add('hg-active');
                    btAlert.classList.add('hg-active');
                });
            } else {
                if (slOverlay) slOverlay.classList.remove('nsd-sl-active');
                if (btVfx)   btVfx.classList.remove('hg-active');
                if (btAlert) btAlert.classList.remove('hg-active');
            }
        }
    }

    function startConcentrateLoop() {
        btLastTs = null;
        // Cache element once — avoids a DOM query every frame
        const fill = document.getElementById('dangan-concentrate-stars');
        function tick(ts) {
            if (!btLastTs) btLastTs = ts;
            const dt = Math.min((ts - btLastTs) / 1000, 0.1);
            btLastTs = ts;

            const wantSlow = shiftLeftPressed;
            const wasActive = btConcentrateActive;
            if (wantSlow && btCharge > 0) {
                btConcentrateActive = true;
                btCharge = Math.max(0, btCharge - BT_DRAIN_RATE * dt);
                if (btCharge <= 0) {
                    btConcentrateActive = false;
                    updateSpeedModifier(); // force re-evaluate: charge gone, mod → 1.0
                }
            } else {
                btConcentrateActive = false;
                if (btCharge < 1) btCharge = Math.min(1, btCharge + BT_RECHARGE_RATE * dt);
            }
            // Start/stop slowmo audio on transition
            if (btConcentrateActive && !wasActive) {
                if (!btSlowmoAudio) {
                    btSlowmoAudio = new Audio(`${extensionFolderPath}/assets/sfx/minigames/slowmo.wav`);
                    btSlowmoAudio.loop = true;
                    btSlowmoAudio.play().catch(() => {});
                }
            } else if (!btConcentrateActive && wasActive) {
                if (btSlowmoAudio) {
                    btSlowmoAudio.pause();
                    btSlowmoAudio.currentTime = 0;
                    btSlowmoAudio = null;
                }
            }
            // Drive the green→black gradient via a CSS variable so the
            // stars-shaped mask reveals less green as btCharge drains.
            if (fill) {
                fill.style.setProperty('--gauge-pct', `${btCharge * 100}%`);
                fill.classList.toggle('nsd-bt-active',   btConcentrateActive);
                fill.classList.toggle('nsd-bt-depleted', btCharge <= 0.01);
            }
            // Time limit — runs in both NSD and MPD
            if (isDebateActive()) {
                updateDebateTimer(ts);
            }
            btConcentrateRaf = requestAnimationFrame(tick);
        }
        btConcentrateRaf = requestAnimationFrame(tick);
    }

    let trialSpeakerObserver = null;
    let trialSpeakerLastName = '';
    let trialSpeakerToken = 0;
    let inputResizeObserver = null;
    let inputWindowResizeHandler = null;
    let inputPollIntervalId = null;

    function isPlaceholderSpeakerName(name) {
        const v = String(name || '').trim().toUpperCase();
        return !v || v === '—' || v === '-' || v === 'SYSTEM' || v === 'UNKNOWN';
    }

    async function refreshTrialSpeakerSticker(rawName) {
        const sticker = document.getElementById('dangan-trial-speaker-sticker');
        if (!sticker) return;
        const name = String(rawName || '').trim();

        if (isPlaceholderSpeakerName(name)) {
            sticker.classList.remove('visible');
            sticker.querySelector('.dgn-speaker-img').style.backgroundImage = '';
            trialSpeakerLastName = '';
            return;
        }

        if (name === trialSpeakerLastName) return;
        trialSpeakerLastName = name;
        const myToken = ++trialSpeakerToken;

        // Mask un-introduced characters as "???" so the trial UI honours the
        // global introduction state. Sprite resolution below still uses the
        // real name so the correct portrait + mugshot loads regardless.
        const displayName = typeof getCharacterDisplayName === 'function'
            ? getCharacterDisplayName(name)
            : name;
        sticker.querySelector('.dgn-speaker-name').textContent = displayName;
        sticker.classList.add('visible');

        try {
            // 'mugshot' isn't in ST's registered emotion list, so getSpriteUrl
            // can't find it — even when the file exists. Probe the direct
            // /characters/<name>/mugshot.png path first, then fall back to neutral.
            const mugshotUrl = `/characters/${encodeURIComponent(name)}/mugshot.png`;
            const mugshotExists = await new Promise(resolve => {
                const probe = new Image();
                probe.onload = () => resolve(true);
                probe.onerror = () => resolve(false);
                probe.src = mugshotUrl;
            });
            const url = mugshotExists
                ? mugshotUrl
                : await getCharSpriteUrl(name, 'neutral').catch(() => null);
            if (myToken !== trialSpeakerToken) return;
            const imgEl = sticker.querySelector('.dgn-speaker-img');
            imgEl.style.backgroundImage = url ? `url("${url.replace(/"/g, '\\"')}")` : '';
        } catch {}
    }

    function getChapterBadgeText() {
        const idx = Number(extensionSettings?.[extensionName]?.chapterIndex ?? 0);
        if (idx <= 0) return '0';
        if (idx >= 10) return 'X';
        return String(idx);
    }

    function refreshTrialBadge() {
        const numEl = document.querySelector('#dangan-trial-badge .dgn-badge-num');
        if (numEl) numEl.textContent = getChapterBadgeText();
    }

    function mountTrialAesthetic() {
        // Trials only happen inside group chats. If we're on the Assistant /
        // welcome screen or a single-character chat, don't mount the aesthetic
        // even if trialActive is true for some other group's persisted state.
        if (!isGroupChat()) return;
        document.body.classList.add('dangan-trial-active');
        applyTrialTheme(getCurrentTrialTheme());

        if (!document.getElementById('dangan-trial-frame')) {
            const frame = document.createElement('div');
            frame.id = 'dangan-trial-frame';
            frame.setAttribute('aria-hidden', 'true');
            const base = extensionFolderPath || `scripts/extensions/third-party/${extensionName}`;
            frame.innerHTML = `<img class="dgn-frame-img" src="${base}/assets/classtrial/frame-overlay.png" alt="" draggable="false" />`;
            document.body.appendChild(frame);
        }

        // BGM accordion header — wraps the existing #dangan-bgm-display so it can collapse.
        installBgmAccordion();

        if (!document.getElementById('dangan-trial-badge')) {
            const badge = document.createElement('div');
            badge.id = 'dangan-trial-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = `
                <div class="dgn-badge-num-wrap">
                    <div class="dgn-badge-moon"></div>
                    <div class="dgn-badge-num">${getChapterBadgeText()}</div>
                </div>
                <div class="dgn-badge-label">Class<br>Trial</div>
            `;
            document.body.appendChild(badge);
        }

        if (!document.getElementById('dangan-trial-speaker-sticker')) {
            const sticker = document.createElement('div');
            sticker.id = 'dangan-trial-speaker-sticker';
            sticker.setAttribute('aria-hidden', 'true');
            sticker.innerHTML = `
                <div class="dgn-speaker-img" aria-hidden="true"></div>
                <div class="dgn-speaker-name"></div>
            `;
            document.body.appendChild(sticker);
        }

        // Subscribe to VN nameplate updates so the sticker follows the active speaker.
        const speakerNameEl = document.getElementById('dangan-vn-name');
        if (speakerNameEl && !trialSpeakerObserver) {
            trialSpeakerObserver = new MutationObserver(() => {
                refreshTrialSpeakerSticker(speakerNameEl.textContent);
            });
            trialSpeakerObserver.observe(speakerNameEl, { childList: true, characterData: true, subtree: true });
            refreshTrialSpeakerSticker(speakerNameEl.textContent);
        }

        // Track the actual top edge of #send_form (relative to the viewport
        // bottom) and expose it as --dgn-input-height. The VN dialogue frame's
        // bottom uses this var, so on any viewport size the dialogue sits flush
        // on top of the input — no detachment, no overlap.
        const sendForm = document.getElementById('send_form');
        if (sendForm && !inputResizeObserver && typeof ResizeObserver === 'function') {
            let lastValue = -1;
            const updateInputHeight = () => {
                const rect = sendForm.getBoundingClientRect();
                const distFromBottom = Math.max(0, Math.round(window.innerHeight - rect.top));
                if (distFromBottom > 0 && distFromBottom !== lastValue) {
                    lastValue = distFromBottom;
                    document.documentElement.style.setProperty('--dgn-input-height', `${distFromBottom}px`);
                }
            };
            inputResizeObserver = new ResizeObserver(updateInputHeight);
            inputResizeObserver.observe(sendForm);
            inputWindowResizeHandler = updateInputHeight;
            window.addEventListener('resize', inputWindowResizeHandler);
            // ResizeObserver only fires on size changes — not on position changes.
            // ST's flex layout can move #send_form vertically without resizing it
            // (e.g. on chat scroll, sidebar toggles, attachment drawer). Poll so
            // the dialogue's bottom stays glued to the input's actual top edge.
            inputPollIntervalId = setInterval(updateInputHeight, 250);
            // Defer the first measurement until after the browser has applied
            // the body class change and re-laid out — otherwise rect.top can
            // reflect the pre-trial #sheld height (overworld 100px cap) and the
            // dialogue ends up pinned to a stale offset until the user resizes.
            // Two rAFs: first lets style recalc commit, second lets layout commit.
            requestAnimationFrame(() => requestAnimationFrame(updateInputHeight));
        }
    }

    function unmountTrialAesthetic() {
        document.body.classList.remove('dangan-trial-active');
        for (const t of TRIAL_THEMES) document.body.classList.remove(`dangan-trial-theme-${t}`);
        document.getElementById('dangan-trial-frame')?.remove();
        document.getElementById('dangan-trial-badge')?.remove();
        document.getElementById('dangan-trial-speaker-sticker')?.remove();
        uninstallBgmAccordion();
        if (trialSpeakerObserver) {
            trialSpeakerObserver.disconnect();
            trialSpeakerObserver = null;
        }
        if (inputResizeObserver) {
            inputResizeObserver.disconnect();
            inputResizeObserver = null;
        }
        if (inputWindowResizeHandler) {
            window.removeEventListener('resize', inputWindowResizeHandler);
            inputWindowResizeHandler = null;
        }
        if (inputPollIntervalId) {
            clearInterval(inputPollIntervalId);
            inputPollIntervalId = null;
        }
        document.documentElement.style.removeProperty('--dgn-input-height');
        trialSpeakerLastName = '';
    }

    const TRIAL_THEMES = [
        'pink-concerto',
        'silver-rock',
        'spring-metal',
        'crimson-jazz',
        'sapphire-elegy',
        'violet-waltz',
        'gold-beat',
        'emerald-blues',
        'scarlet-tango',
    ];

    function getCurrentTrialTheme() {
        const t = String(extensionSettings?.[extensionName]?.trialUiTheme || 'pink-concerto').toLowerCase();
        return TRIAL_THEMES.includes(t) ? t : 'pink-concerto';
    }

    function applyTrialTheme(theme) {
        const next = TRIAL_THEMES.includes(theme) ? theme : 'pink-concerto';
        for (const t of TRIAL_THEMES) {
            document.body.classList.toggle(`dangan-trial-theme-${t}`, t === next);
        }
        if (extensionSettings?.[extensionName]) {
            extensionSettings[extensionName].trialUiTheme = next;
            if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
        }
    }

    function installBgmAccordion() {
        const bgm = document.getElementById('dangan-bgm-display');
        if (!bgm) {
            // Visualizer hasn't mounted yet — try again shortly
            setTimeout(installBgmAccordion, 250);
            return;
        }
        if (document.getElementById('dangan-bgm-panel')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'dangan-bgm-panel';
        wrapper.className = 'dgn-side-panel collapsed';

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'dgn-side-panel-header';
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-controls', 'dangan-bgm-display');
        header.innerHTML = `<span>CONTROLS PANEL</span><span class="dgn-side-panel-chev" aria-hidden="true">▾</span>`;
        header.addEventListener('click', () => {
            const collapsed = wrapper.classList.toggle('collapsed');
            header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        });

        // Theme selector — sits below the music controls.
        const fxSection = document.createElement('div');
        fxSection.id = 'dangan-fx-theme-section';
        fxSection.className = 'dgn-fx-section';
        const currentTheme = getCurrentTrialTheme();
        fxSection.innerHTML = `
            <div class="dgn-fx-divider" aria-hidden="true"></div>
            <div class="dgn-fx-theme-row">
                <label for="dgn-fx-theme-select" class="dgn-fx-theme-label">UI Theme</label>
                <select id="dgn-fx-theme-select" class="dgn-fx-theme-select">
                    <option value="pink-concerto">Pink Concerto</option>
                    <option value="silver-rock">Silver Rock</option>
                    <option value="spring-metal">Spring Metal</option>
                    <option value="crimson-jazz">Crimson Jazz</option>
                    <option value="sapphire-elegy">Sapphire Elegy</option>
                    <option value="violet-waltz">Violet Waltz</option>
                    <option value="gold-beat">Gold Beat</option>
                    <option value="emerald-blues">Emerald Blues</option>
                    <option value="scarlet-tango">Scarlet Tango</option>
                </select>
            </div>
            <div class="dgn-fx-divider" aria-hidden="true"></div>
            <div class="dgn-fx-seating-row">
                <div class="dgn-fx-seating-header">
                    <span class="dgn-fx-seating-label">Seating Plan</span>
                    <div class="dgn-fx-seating-actions">
                        <button type="button" id="dgn-fx-seating-edit"  class="dgn-fx-seating-btn">Edit</button>
                        <button type="button" id="dgn-fx-seating-save"  class="dgn-fx-seating-btn" style="display:none">Save</button>
                        <button type="button" id="dgn-fx-seating-reset" class="dgn-fx-seating-btn dgn-fx-seating-btn-danger">Reset</button>
                    </div>
                </div>
                <div id="dgn-fx-seating-list" class="dgn-fx-seating-circle"></div>
                <div class="dgn-fx-seating-hint" id="dgn-fx-seating-hint" style="display:none">Click two seats to swap, then Save.</div>
            </div>
            <div class="dgn-fx-divider" aria-hidden="true"></div>
            <div class="dgn-fx-commands-row">
                <button type="button" id="dgn-fx-commands-btn" class="dgn-fx-commands-btn">View Commands</button>
            </div>
        `;

        // Slot the bgm-display inside the wrapper as its body, and the theme
        // selector below it.
        bgm.parentNode.insertBefore(wrapper, bgm);
        wrapper.appendChild(header);
        wrapper.appendChild(bgm);
        wrapper.appendChild(fxSection);

        const select = fxSection.querySelector('select');
        select.value = currentTheme;
        select.addEventListener('change', (e) => applyTrialTheme(e.target.value));

        fxSection.querySelector('#dgn-fx-commands-btn').addEventListener('click', showCommandsModal);

        // ── Seating Plan section (circular diagram + edit/save) ─────────
        const seatingListEl  = fxSection.querySelector('#dgn-fx-seating-list');
        const editBtn        = fxSection.querySelector('#dgn-fx-seating-edit');
        const saveBtn        = fxSection.querySelector('#dgn-fx-seating-save');
        const resetBtn       = fxSection.querySelector('#dgn-fx-seating-reset');
        const hintEl         = fxSection.querySelector('#dgn-fx-seating-hint');

        // Edit-mode state — when editing, the live renderer freezes and
        // user clicks swap seats. Save persists; cancel/Edit toggle reverts.
        let editing = false;
        let editPlan = [];          // working copy while editing
        let editPlanOriginal = [];  // snapshot taken on entering edit mode (for diff highlighting)
        let editSelectedIdx = -1;   // first-click anchor for swap

        function gatherCurrentNames() {
            const names = gcpSlots.map(s => s.name).filter(n => n && !isMonokuma(n));
            const playerName = getPlayerName?.();
            if (playerName && !names.some(n => normalizeSeatName(n) === normalizeSeatName(playerName))) {
                names.push(playerName);
            }
            return names;
        }

        function renderCircle(names, speakerIdx) {
            seatingListEl.innerHTML = '';
            if (!names.length) {
                seatingListEl.classList.add('dgn-fx-seating-empty');
                seatingListEl.innerHTML = '<span class="dangan-seating-plan-empty">Waiting for chat…</span>';
                return;
            }
            seatingListEl.classList.remove('dgn-fx-seating-empty');
            const n = names.length;

            // Centre display: empty by default; only shows the hovered
            // seat's number + name. Mouseleave on a chip clears it.
            const centre = document.createElement('div');
            centre.className = 'dgn-fx-seating-centre';
            const centreNum  = document.createElement('div');
            centreNum.className = 'dgn-fx-seating-centre-num';
            const centreName = document.createElement('div');
            centreName.className = 'dgn-fx-seating-centre-name';
            centre.appendChild(centreNum);
            centre.appendChild(centreName);
            seatingListEl.appendChild(centre);

            const showCentre = (idx) => {
                if (idx >= 0 && idx < n) {
                    const nm = String(names[idx] || '').trim();
                    const parts = nm.split(/\s+/);
                    const firstName = parts.shift() || nm;
                    const lastName  = parts.join(' ');
                    centreNum.textContent  = `${idx + 1}`;
                    centreName.textContent = lastName ? `${firstName}\n${lastName}` : firstName;
                    centre.style.visibility = 'visible';
                    const origAtIdx = editing ? editPlanOriginal[idx] : null;
                    const isChanged = editing && origAtIdx && normalizeSeatName(names[idx]) !== normalizeSeatName(origAtIdx);
                    const isDead    = !!(isCharacterDead && isCharacterDead(nm));
                    centre.classList.toggle('dgn-fx-seating-centre-changed',      isChanged && !isDead);
                    centre.classList.toggle('dgn-fx-seating-centre-changed-dead', isChanged && isDead);
                } else {
                    centre.style.visibility = 'hidden';
                    centre.classList.remove('dgn-fx-seating-centre-changed', 'dgn-fx-seating-centre-changed-dead');
                }
            };
            showCentre(-1);

            for (let i = 0; i < n; i++) {
                const name = names[i];
                // Single seat: render at centre. Otherwise: distribute
                // evenly clockwise starting from the top.
                let leftPct = 50;
                let topPct  = 50;
                if (n > 1) {
                    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
                    leftPct = 50 + Math.cos(angle) * 38;
                    topPct  = 50 + Math.sin(angle) * 38;
                }
                const chip = document.createElement('div');
                chip.className = 'dgn-fx-seating-chip';
                chip.dataset.idx = String(i);
                chip.style.left = `${leftPct}%`;
                chip.style.top  = `${topPct}%`;
                const isSpeaker = !editing && i === speakerIdx;
                const isDead    = isCharacterDead?.(name);
                const origAtI   = editing ? editPlanOriginal[i] : null;
                const isChanged = editing && origAtI && normalizeSeatName(name) !== normalizeSeatName(origAtI);
                if (isSpeaker) chip.classList.add('dgn-fx-seating-chip-speaker');
                else if (isDead) chip.classList.add('dgn-fx-seating-chip-dead');
                if (isChanged) chip.classList.add(isDead ? 'dgn-fx-seating-chip-changed-dead' : 'dgn-fx-seating-chip-changed');
                if (editing && i === editSelectedIdx) chip.classList.add('dgn-fx-seating-chip-selected');

                const badge = document.createElement('div');
                badge.className = 'dgn-fx-seating-badge';
                badge.textContent = String(i + 1);
                chip.appendChild(badge);

                chip.addEventListener('mouseenter', () => showCentre(i));
                chip.addEventListener('mouseleave', () => showCentre(-1));

                if (editing) {
                    chip.addEventListener('click', () => handleEditClick(i));
                }
                seatingListEl.appendChild(chip);
            }
        }

        function handleEditClick(idx) {
            if (!editing) return;
            if (editSelectedIdx === -1) {
                editSelectedIdx = idx;
                renderCircle(editPlan, -1);
                return;
            }
            if (editSelectedIdx === idx) {
                editSelectedIdx = -1;
                renderCircle(editPlan, -1);
                return;
            }
            [editPlan[editSelectedIdx], editPlan[idx]] = [editPlan[idx], editPlan[editSelectedIdx]];
            editSelectedIdx = -1;
            renderCircle(editPlan, -1);
        }

        const renderControlsSeating = () => {
            if (!seatingListEl) return;
            if (editing) return; // freeze while user is editing
            const names = gatherCurrentNames();
            const speakerIdx = gcpSlots.length ? Math.round(gcpCurrentFloat) : -1;
            renderCircle(names, speakerIdx);
        };
        gcpSeatingListRenderers.add(renderControlsSeating);
        renderControlsSeating();

        editBtn?.addEventListener('click', () => {
            if (editing) {
                // Cancel
                editing = false;
                editSelectedIdx = -1;
                editPlan = [];
                editBtn.textContent = 'Edit';
                editBtn.classList.remove('dgn-fx-seating-btn-active');
                if (saveBtn) saveBtn.style.display = 'none';
                if (hintEl)  hintEl.style.display  = 'none';
                renderControlsSeating();
            } else {
                editPlan = gatherCurrentNames();
                if (!editPlan.length) return;
                editPlanOriginal = editPlan.slice();
                editing = true;
                editSelectedIdx = -1;
                editBtn.textContent = 'Cancel';
                editBtn.classList.add('dgn-fx-seating-btn-active');
                if (saveBtn) saveBtn.style.display = '';
                if (hintEl)  hintEl.style.display  = '';
                renderCircle(editPlan, -1);
            }
        });

        saveBtn?.addEventListener('click', () => {
            if (!editing) return;
            saveSavedSeatingPlan(editPlan);
            editing = false;
            editSelectedIdx = -1;
            editBtn.textContent = 'Edit';
            editBtn.classList.remove('dgn-fx-seating-btn-active');
            if (saveBtn) saveBtn.style.display = 'none';
            if (hintEl)  hintEl.style.display  = 'none';
            // Force the GCP carousel to rebuild with the new order. Clearing
            // debateSeatingPlan makes getOrBuildSeatingPlan reconsult
            // buildSeatingPlan, which now reads the freshly saved plan.
            debateSeatingPlan = null;
            try {
                destroyGroupChatPortraits();
                initGroupChatPortraits();
            } catch (e) { console.warn('[Dangan][Seating] rebuild failed:', e); }
            // The rebuild will repopulate gcpSlots and fire the renderers
            // asynchronously — render once now from the saved order so
            // the diagram updates immediately.
            renderCircle(editPlan.slice(), -1);
        });

        resetBtn?.addEventListener('click', () => {
            saveSavedSeatingPlan(null);
            if (editing) {
                editing = false;
                editSelectedIdx = -1;
                editBtn.textContent = 'Edit';
                editBtn.classList.remove('dgn-fx-seating-btn-active');
                if (saveBtn) saveBtn.style.display = 'none';
                if (hintEl)  hintEl.style.display  = 'none';
            }
            debateSeatingPlan = null;
            try {
                destroyGroupChatPortraits();
                initGroupChatPortraits();
            } catch (e) { console.warn('[Dangan][Seating] rebuild failed:', e); }
            renderControlsSeating();
        });

        // If the FX accordion ever leaves the DOM (rare, but possible if
        // the BGM display is torn down), unsubscribe so we don't render
        // into a detached node forever.
        const wrapperObserver = new MutationObserver(() => {
            if (!document.body.contains(wrapper)) {
                gcpSeatingListRenderers.delete(renderControlsSeating);
                wrapperObserver.disconnect();
            }
        });
        wrapperObserver.observe(document.body, { childList: true, subtree: true });
    }

    const TRIAL_COMMANDS = [
        {
            heading: 'Cinematics & Chapters',
            items: [
                { cmd: '/bodydiscovery', desc: 'Plays the body discovery static/shake vignette, then the Body Discovery announcement, then triggers Investigation mode and switches to the Investigation theme.', opts: ['bg — Background image to switch to under the static effect (partial name match)', 'cinematic — Name of a configured Body Discovery cinematic to play instead of the default sequence'] },
                { cmd: '/punishmenttime', desc: 'Plays the execution cinematic for the named character, then marks them as dead in the Monopad roster.', opts: ['name (required) — Character name; must match both a configured execution cinematic and a registered character'] },
                { cmd: '/introduce', desc: 'Shows a 4-second character introduction screen for the current SillyTavern speaker.', opts: ['ultimate — Override the Ultimate title shown on the card (auto-detected from lorebook by default)'] },
                { cmd: '/nextchapter', desc: 'Advances the Chapter counter one step (PROLOGUE → CHAPTER 1 → … → CHAPTER 9).' },
                { cmd: '/epiloguechapter', desc: 'Sets the Chapter display to EPILOGUE.' },
                { cmd: '/passtime', desc: 'Triggers the nighttime announcement, shows a Night Time Start banner, and switches to the Night theme.' },
                { cmd: '/gotosleep', desc: 'Advances to the next day, plays the daytime announcement, shows a Free Time Start banner, and switches to the Day theme.' },
            ],
        },
        {
            heading: 'Class Trial',
            items: [
                { cmd: '/startclasstrial', desc: 'Begin a Class Trial in the current group chat. Converts the chat into a Class Trial chat.' },
                { cmd: '/endtrial', desc: 'Immediately ends the current Class Trial and clears all persistent trial state.' },
                { cmd: '/setclasstrialgoal', desc: 'Sets the overall objective text shown in the Trial Context panel.', opts: ['(unnamed, required) — The goal text, e.g. /setclasstrialgoal Who killed Byakuya?'] },
                { cmd: '/givetruthbullet', desc: 'Manually adds a Truth Bullet to the Monopad. Add an image via the Truth Bullet Monopad tab afterwards.', opts: ['name (required) — Truth Bullet title; quote if it contains spaces', '(unnamed, required) — The Truth Bullet description'] },
                { cmd: '/suspectchoosing', desc: 'Opens the character selection screen to single out a suspect. Arrow keys to navigate, Enter to confirm.' },
                { cmd: '/votingtime', desc: 'Spins the class trial vote roulette. A correct guess awards XP; an incorrect one triggers failure.', opts: ['guess (required) — The character that was voted for (partial name match)', 'result — The actual blackened character (omit to pick randomly)'] },
            ],
        },
        {
            heading: 'Minigames',
            items: [
                { cmd: '/nonstopdebate', desc: 'Force-starts a Non-Stop Debate with manually provided lines. Each line supports [[weak spot]] and ((agreement)) markup.', opts: ['s1-q … s8-q (at least one required) — Dialogue lines for sections 1–8', '(unnamed) — Shorthand for a single-line debate'] },
                { cmd: '/masspanicdebate', desc: 'Starts a Mass Panic Debate with up to 8 scenarios. Each scenario requires all three columns; mark the weak spot in one column with [[brackets]].', opts: ['sc1-c1-q … sc8-c3-q (at least one full scenario) — Dialogue text', 'sc1-c1-speaker … sc8-c3-speaker — Speaker name per column'] },
                { cmd: '/interjection', desc: 'Plays the rebuttal interjection cinematic, switches BGM to “New Classmates of the Dead”, then the interjector replies.', opts: ['character — Character name for the interjection sprite (defaults to last speaker)'] },
                { cmd: '/rebuttalshowdown', desc: 'Starts a Rebuttal Showdown — cut through scrolling statements, then land the correct Truth Blade on the weak point.', opts: ['opponent — Opponent character name (defaults to last speaker)', 'player — Player character name (defaults to Prome player profile)', 's1-q … sN-q — Statement phrases (auto-split into chunks)'] },
                { cmd: '/scrumdebate', desc: 'Starts a Scrum Debate. The group splits into two teams; debunk each opposing claim with the correct Truth Bullet, then win the final tug-of-war.' },
                { cmd: '/panictalkaction', desc: 'Starts a Panic Talk Action boss-fight against the current speaker. At least one dialog line is required.', opts: ['dialogA … dialogK (at least one) — Up to 11 dialogue lines', 'enemyHp / playerHp — Starting HP (default 100)', 'phases — Number of phases 1–3 (default 3)', 'nSolution / sSolution / eSolution / wSolution — Direction prompt answer words', 'finalSolution — Final answer (shown uppercased)', 'finalSolutionQuote — Quote line accompanying the final solution', 'bg — Background image (partial name match)'] },
                { cmd: '/hangmansgambit', desc: 'Starts a Hangman’s Gambit — letters scroll across the screen; stock a letter, match it against the current target position to reveal it.', opts: ['question (required) — Title or prompt', 'answer (required) — Word or phrase to unscramble', 'time — Time limit in seconds (default 60)', 'health — Health points (default 3)', 'difficulty — 1–5 (default 2)'] },
                { cmd: '/questiontime', desc: 'Timed four-answer multiple choice question. Correct answer triggers GOT IT and awards XP.', opts: ['title (required) — Question text', 'time (required) — Time limit in seconds', 'a1 … a4 (required) — Four answer options', 'correct (required) — Index 1–4 of the correct answer'] },
                { cmd: '/questiontruth', desc: 'Displays the Truth Bullet list and asks the player to pick the correct one. Correct answer awards Monocoins and GOT IT.', opts: ['question (required) — Statement or prompt', 'answer (required) — Title of the correct Truth Bullet (exact match)', 'time — Optional time limit in seconds'] },
            ],
        },
    ];

    function showCommandsModal() {
        if (document.getElementById('dgn-commands-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'dgn-commands-modal';
        modal.className = 'dgn-commands-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const sections = TRIAL_COMMANDS.map(group => {
            const items = group.items.map(it => {
                const opts = it.opts && it.opts.length
                    ? `<ul class="dgn-cmd-opts">${it.opts.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`
                    : '';
                return `
                    <div class="dgn-cmd-item">
                        <div class="dgn-cmd-name"><code>${escapeHtml(it.cmd)}</code></div>
                        <div class="dgn-cmd-desc">${escapeHtml(it.desc)}</div>
                        ${opts}
                    </div>
                `;
            }).join('');
            return `
                <section class="dgn-cmd-group">
                    <h3 class="dgn-cmd-group-title">${escapeHtml(group.heading)}</h3>
                    ${items}
                </section>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="dgn-commands-backdrop"></div>
            <div class="dgn-commands-card" role="document">
                <div class="dgn-commands-header">
                    <span>Slash Commands</span>
                    <button type="button" class="dgn-commands-close" aria-label="Close">✕</button>
                </div>
                <div class="dgn-commands-body">${sections}</div>
            </div>
        `;

        const close = () => {
            modal.remove();
            document.removeEventListener('keydown', onKeydown);
        };
        const onKeydown = (e) => { if (e.key === 'Escape') close(); };

        modal.querySelector('.dgn-commands-close').addEventListener('click', close);
        modal.querySelector('.dgn-commands-backdrop').addEventListener('click', close);
        document.addEventListener('keydown', onKeydown);

        document.body.appendChild(modal);
    }

    function uninstallBgmAccordion() {
        const wrapper = document.getElementById('dangan-bgm-panel');
        const bgm = document.getElementById('dangan-bgm-display');
        if (wrapper && bgm) {
            // Move bgm-display back out of the wrapper before removing it
            wrapper.parentNode.insertBefore(bgm, wrapper);
            wrapper.remove();
        }
    }

    function syncPrompt() {
        const ctx = window.SillyTavern?.getContext?.();
        const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
        if (typeof setPrompt !== 'function') return;

        const key = getTrialPersistenceKey();

        if (currentState === TrialPhases.IDLE) {
            setPrompt('dangan_debate_history', '', 0, 0, false, 'system');
            setPrompt('dangan_rebuttal_judgment', '', 0, 0, false, 'system');
            setPrompt('dangan_monokuma_rules', '', 0, 0, false, 'system');
            return;
        }

        // Monokuma observes but does not initiate — inject a standing rule whenever trial is active
        setPrompt('dangan_monokuma_rules',
            '[CLASS TRIAL RULE] Monokuma is present in the courtroom as an observer and referee, but he does NOT speak or interject spontaneously. He only responds if directly addressed or asked a question. He never participates in Non-stop Debates, Mass Panic Debates, Rebuttal Showdowns, or Scrum Debates.',
            0, 2, true, 'system');

        // Always save persistent history to settings for page refreshes (per chat/group)
        if (typeof saveSettingsDebounced === 'function') {
            if (!extensionSettings[extensionName].trials) {
                extensionSettings[extensionName].trials = {};
            }
            if (!extensionSettings[extensionName].trials[key]) {
                extensionSettings[extensionName].trials[key] = {};
            }
            extensionSettings[extensionName].trials[key].persistentDebateHistory = persistentDebateHistory;
            extensionSettings[extensionName].trials[key].currentTrialState = currentState;
            saveSettingsDebounced();
        }

        if (persistentDebateHistory.length > 0) {
            const historyText = persistentDebateHistory.map(line => `- ${line}`).join('\n');
            const prompt = `
### DANGANRONPA DEBATE CONTEXT
The characters recently had a fast-paced Non-stop Debate. Use the following lines as context for your next response:
${historyText}
### END DEBATE CONTEXT
`.trim();
            // Depth 0 means inject at the very end of the prompt (most recent context)
            // is_system: true
            setPrompt('dangan_debate_history', prompt, 0, 1, true, 'system');
        }
    }

    function syncUI() {
        console.log(`[Dangan][Trial] syncUI: state=${currentState}`);

        switch (currentState) {
            case TrialPhases.IDLE:
                cleanupDebateUI();
                if (trialActive && isGroupChat()) {
                    // Resume general trial BGM after debates end; delay to let stopDebatesTrack fade out first.
                    // Re-check both guards inside the callback — chat may change before the timer fires.
                    setTimeout(() => { if (trialActive && isGroupChat()) playTrialGeneralTrack?.(); }, 750);
                }
                if (isGroupChat() && trialActive) showPreDebateNotification();
                if (isGroupChat() && trialActive) showContextPanel();
                break;
            case TrialPhases.PRE_DEBATE:
                cleanupDebateUI();
                // Resume/start general trial BGM when chatting between debates.
                // Only play in a group chat — trials never occur outside one.
                // Re-check both guards inside the callback: chat may change before the timer fires.
                if (trialActive && isGroupChat()) {
                    setTimeout(() => { if (trialActive && isGroupChat()) playTrialGeneralTrack?.(); }, 750);
                }
                if (isGroupChat()) showPreDebateNotification();
                if (isGroupChat()) showContextPanel();
                break;
            case TrialPhases.NON_STOP_DEBATE:
                setupNonStopDebate();
                break;
            case TrialPhases.MASS_PANIC_DEBATE:
                setupNonStopDebate();
                break;
            case TrialPhases.TRUTH_BULLET_EXPLANATION:
                cleanupDebateUI();
                // Show rebuttal UI if bullet hit
                if (lastHitBullet && lastHitWeakPoint) {
                    showExplanationUI(lastHitBullet, lastHitWeakPoint);
                }
                break;
        }
    }

    function updateControlPanelTopic() {
        const label = document.querySelector('#dangan-trial-pre-debate-notif .dangan-trial-topic-label');
        if (!label) return;
        label.textContent = trialContext.topic
            ? `Debating: ${trialContext.topic}`
            : 'TRIAL PANEL';
    }

    function updateContextPanel() {
        const hosts = [
            document.getElementById('dangan-trial-context-panel'),
            document.getElementById('dangan-trial-pre-debate-notif'),
        ].filter(Boolean);
        if (!hosts.length) return;

        for (const host of hosts) {
            const goalEl     = host.querySelector('.dangan-context-goal');
            const suspectsEl = host.querySelector('.dangan-context-suspects');

            if (goalEl) {
                const goalText = trialContext.goal || '';
                goalEl.textContent = goalText || (host.id === 'dangan-trial-context-panel' ? '—' : '');
            }

            if (!suspectsEl) continue;

            if (host.classList.contains('dgn-suspects-grid') || suspectsEl.classList.contains('dgn-suspects-grid')) {
                if (!trialContext.suspects.length) {
                    suspectsEl.innerHTML = '<div class="dgn-suspects-empty">No suspects identified</div>';
                } else {
                    suspectsEl.innerHTML = trialContext.suspects.slice(0, 3).map(s => {
                        const pct = Math.max(0, Math.min(100, Number(s.chance) || 0));
                        const portraitSrc = `/characters/${encodeURIComponent(s.name)}.png`;
                        return `
                            <div class="dgn-suspect-cell" data-suspect-name="${escapeHtml(s.name)}">
                                <div class="dgn-suspect-portrait" aria-hidden="true">
                                    <img src="${portraitSrc}" alt="" onerror="this.style.opacity=0">
                                </div>
                                <div class="dgn-suspect-name">${escapeHtml(s.name)}</div>
                                <div class="dgn-suspect-pct">${pct}%</div>
                            </div>`;
                    }).join('');
                }
                continue;
            }

            // Legacy left-side panel (kept for compat)
            if (!trialContext.suspects.length) {
                suspectsEl.innerHTML = '<span class="dangan-context-no-suspects">No suspects identified</span>';
            } else {
                suspectsEl.innerHTML = trialContext.suspects.slice(0, 3).map(s => `
                    <div class="dangan-context-suspect-row">
                        <span class="dangan-context-suspect-name">${s.name}</span>
                        <div class="dangan-context-suspect-bar-wrap">
                            <div class="dangan-context-suspect-bar" style="width:${Math.max(0, Math.min(100, s.chance))}%"></div>
                        </div>
                        <span class="dangan-context-suspect-pct">${s.chance}%</span>
                    </div>`).join('');
            }
        }
    }


    function showContextPanel() {
        if (document.getElementById('dangan-trial-context-panel')) {
            updateContextPanel();
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'dangan-trial-context-panel';
        panel.className = 'dangan-trial-notification dangan-context-panel';
        panel.innerHTML = `
            <div class="dangan-trial-notif-content">
                <div class="dangan-trial-notif-drag-handle">
                    <span class="dangan-trial-notif-drag-icon">⠿</span>
                    <span>Trial Context</span>
                    <button class="dangan-trial-collapse-btn" title="Collapse panel">▼</button>
                </div>
                <div class="dangan-trial-notif-body dangan-context-body">
                    <div class="dangan-context-section">
                        <span class="dangan-trial-group-label">Trial Goal</span>
                        <span class="dangan-context-goal">—</span>
                    </div>
                    <div class="dangan-context-section">
                        <div class="dangan-context-suspects-header">
                            <span class="dangan-trial-group-label">Suspects</span>
                            <button class="dangan-suspect-refresh-btn" title="Refresh suspect analysis">↻</button>
                        </div>
                        <div class="dangan-context-suspects"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        applyCustomUiPosition?.(panel, 'dangan-trial-context-pos');
        attachDraggablePositioning?.(panel, {
            storageKey: 'dangan-trial-context-pos',
            handleSelector: '.dangan-trial-notif-drag-handle',
        });

        const collapseBtn = panel.querySelector('.dangan-trial-collapse-btn');
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = panel.classList.toggle('collapsed');
            collapseBtn.textContent = isCollapsed ? '▲' : '▼';
            collapseBtn.title = isCollapsed ? 'Expand panel' : 'Collapse panel';
        });

        updateContextPanel();
    }

    function saveTrialContext() {
        if (typeof saveSettingsDebounced !== 'function') return;
        const key = getTrialPersistenceKey();
        if (!extensionSettings[extensionName].trials)      extensionSettings[extensionName].trials      = {};
        if (!extensionSettings[extensionName].trials[key]) extensionSettings[extensionName].trials[key] = {};
        extensionSettings[extensionName].trials[key].trialTopic = trialContext.topic;
        extensionSettings[extensionName].trials[key].trialGoal  = trialContext.goal;
        saveSettingsDebounced();
    }

    function setTrialContext(topic, goal, suspects) {
        if (topic    !== undefined) trialContext.topic    = topic    || '';
        if (goal     !== undefined) trialContext.goal     = goal     || '';
        if (suspects !== undefined) trialContext.suspects = Array.isArray(suspects) ? suspects.slice(0, 3) : [];
        saveTrialContext();
        updateControlPanelTopic();
        updateContextPanel();
    }

    function showPreDebateNotification() {
        if (document.getElementById('dangan-trial-pre-debate-notif')) return;

        const equippedNow = typeof getEquippedSkillsSnapshot === 'function' ? getEquippedSkillsSnapshot() : [];
        const hasSeatingPlanCopy = equippedNow.includes('shop_skill_seating_plan_copy');

        const notification = document.createElement('div');
        notification.id = 'dangan-trial-pre-debate-notif';
        notification.className = 'dangan-trial-notification dgn-side-panel collapsed';
        notification.innerHTML = `
            <div class="dangan-trial-notif-content">
                <div class="dangan-trial-notif-drag-handle dgn-side-panel-header">
                    <span class="dangan-trial-notif-drag-icon">⠿</span>
                    <span class="dangan-trial-topic-label">${trialContext.topic ? `Debating: ${trialContext.topic}` : 'TRIAL PANEL'}</span>
                    <span class="dgn-side-panel-chev" aria-hidden="true">▾</span>
                </div>
                <div class="dangan-trial-notif-body">
                    <div class="dgn-trial-section dgn-trial-section--goal">
                        <h3 class="dgn-trial-section-title">Goal</h3>
                        <div class="dgn-trial-goal-text dangan-context-goal"></div>
                    </div>
                    <div class="dgn-trial-section dgn-trial-section--suspects">
                        <div class="dgn-suspects-header">
                            <h3 class="dgn-trial-section-title" style="margin:0">Suspects</h3>
                            <button class="dangan-suspect-refresh-btn" title="Refresh suspect analysis">↻</button>
                        </div>
                        <div class="dgn-suspects-grid dangan-context-suspects"></div>
                    </div>
                    <div class="dgn-trial-section dgn-trial-section--controls">
                        <h3 class="dgn-trial-section-title">Controls</h3>
                        <div class="dgn-controls-loading" aria-live="polite" aria-label="Loading controls">
                            <span></span><span></span><span></span>
                        </div>
                        <div class="dgn-controls-grid dangan-trial-btn-group--minigames">
                            <button id="dangan-start-nonstop-btn"  class="dangan-trial-start-btn" style="display:none">Start Non-Stop Debate</button>
                            <button id="dangan-start-hangman-btn"  class="dangan-trial-start-btn" style="display:none">Start Hangman's Gambit</button>
                            <button id="dangan-start-mpdebate-btn" class="dangan-trial-start-btn" style="display:none">Start Mass Panic Debate</button>
                            <button id="dangan-start-rebuttal-btn" class="dangan-trial-start-btn" style="display:none">Start Rebuttal Showdown</button>
                            <button id="dangan-start-scrum-btn"    class="dangan-trial-start-btn" style="display:none">Start Scrum Debate</button>
                            <button id="dangan-start-mindmine-btn" class="dangan-trial-start-btn" style="display:none">Start Mind Mine</button>
                            <button id="dangan-start-pta-btn"      class="dangan-trial-start-btn" style="display:none">Start Panic Talk Action</button>
                            <button id="dangan-start-qtime-btn"    class="dangan-trial-start-btn" style="display:none">Start Question Time</button>
                            <button id="dangan-start-qtruth-btn"   class="dangan-trial-start-btn" style="display:none">Start Question Truth</button>
                            <button id="dangan-start-interject-btn"  class="dangan-trial-start-btn" style="display:none">Trigger an Interjection</button>
                            <button id="dangan-start-choosing-btn"   class="dangan-trial-start-btn" style="display:none">Start Choosing Time</button>
                            <button id="dangan-start-voting-btn"     class="dangan-trial-start-btn" style="display:none">Start Voting Time</button>
                            <button id="dangan-start-punishment-btn" class="dangan-trial-start-btn" style="display:none">Start Punishment Time</button>
                            <button id="dangan-start-showcg-btn"     class="dangan-trial-start-btn" style="display:none">Show CG</button>
                        </div>
                    </div>
                    ${isGroupChat() ? `
                    <div class="dgn-trial-section dangan-trial-btn-group--seating"${hasSeatingPlanCopy ? '' : ' style="display:none"'}>
                        <div class="dangan-seating-plan-section">
                            <div class="dangan-seating-plan-header">
                                <span>SEATING PLAN</span>
                                <div class="dangan-seating-plan-actions">
                                    <button id="dangan-seating-shuffle-btn" class="dangan-seating-action-btn">SHUFFLE</button>
                                    <button id="dangan-seating-reset-btn"   class="dangan-seating-action-btn dangan-seating-reset-btn">RESET</button>
                                </div>
                            </div>
                            <div id="dangan-seating-plan-list" class="dangan-seating-plan-list"></div>
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(notification);

        // Trial panel is non-draggable — it locks to the top-right corner via CSS.
        // Clear any stale inline position that a previous draggable session may
        // have written so the CSS top:0/right:0 takes effect cleanly.
        notification.style.left = '';
        notification.style.top = '';
        notification.style.right = '';
        notification.style.bottom = '';

        // Collapse / expand toggle — click anywhere on the header, but
        // suppress when the user is mid-drag (drag.js fires no click).
        const headerEl = notification.querySelector('.dgn-side-panel-header');
        headerEl.addEventListener('click', () => {
            notification.classList.toggle('collapsed');
        });

        function renderSeatingList(plan) {
            const listEl = notification.querySelector('#dangan-seating-plan-list');
            if (!listEl) return;

            // If GCP is active, use its slot order as the source of truth (matches what the user
            // sees on screen). GCP excludes muted characters; buildFreshPlan includes muted-with-dead
            // chars for debate purposes, which would cause seat numbers to diverge from the GCP.
            // GCP slots are the source of truth when active; fall back to the provided plan.
            // Either way, the player (Prome user sprite) is never a gcpSlot — append manually.
            let displayPlan = (gcpSlots.length
                ? gcpSlots.map(s => s.name)
                : (plan ? [...plan] : []))
                .filter(n => !isMonokuma(n));
            const playerName = getPlayerName();
            if (playerName && !displayPlan.some(n => normalizeSeatName(n) === normalizeSeatName(playerName))) {
                displayPlan.push(playerName);
            }

            if (!displayPlan.length) {
                listEl.innerHTML = '<span class="dangan-seating-plan-empty">Auto-generated on debate start</span>';
                return;
            }
            const speakerIdx = gcpSlots.length ? Math.round(gcpCurrentFloat) : -1;
            listEl.innerHTML = displayPlan.map((name, i) => {
                const first = (name.split(' ')[0] || name).substring(0, 10);
                const isSpeaker = i === speakerIdx;
                const isDead    = isCharacterDead(name);
                const cls = isSpeaker ? ' dangan-seating-speaker-chip' : isDead ? ' dangan-seating-dead-chip' : '';
                return `<span class="dangan-seating-plan-chip${cls}"><span class="seat-num">${i + 1}.</span>${first}</span>`;
            }).join('');
        }

        let seatingRenderer = null;
        if (isGroupChat()) {
            async function buildFreshPlan() {
                silencedSeats.clear();
                const allMembers = getChatCardMembers().map(m => m.name).filter(Boolean);
                const seated = [];
                for (const name of allMembers) {
                    if (isCharacterMuted(name)) {
                        const deadUrl = await getSpriteUrl(name, 'dead').catch(() => null);
                        if (deadUrl) {
                            seated.push(name);
                            silencedSeats.add(normalizeSeatName(name));
                        }
                        // no dead.png → exclude entirely
                    } else {
                        seated.push(name);
                    }
                }
                const playerName = getPlayerName();
                if (playerName) seated.push(playerName);
                debateSeatingPlan = buildSeatingPlan(seated);
                return debateSeatingPlan;
            }

            // Register a live callback so GCP rebuilds automatically refresh the list.
            // Cleared when the notification is removed (panel closed or debate starts).
            seatingRenderer = () => renderSeatingList(null);
            gcpSeatingListRenderers.add(seatingRenderer);

            // Initial display: if GCP is already active use its slot order directly.
            // Still run buildFreshPlan to populate silencedSeats for the upcoming debate,
            // but don't wait on it for the render — renderSeatingList reads gcpSlots itself.
            if (gcpSlots.length) {
                buildFreshPlan(); // side-effect: populates silencedSeats
                renderSeatingList(null);
            } else {
                buildFreshPlan().then(plan => renderSeatingList(plan));
            }

            notification.querySelector('#dangan-seating-shuffle-btn').onclick = () => {
                debateSeatingPlan = buildSeatingPlan(debateSeatingPlan?.length ? [...debateSeatingPlan] : []);
                renderSeatingList(debateSeatingPlan);
            };
            notification.querySelector('#dangan-seating-reset-btn').onclick = () => {
                buildFreshPlan().then(plan => renderSeatingList(plan));
            };
        }

        // Clear the live seating renderer when the panel is removed
        const notifObserver = new MutationObserver(() => {
            if (!document.body.contains(notification)) {
                if (seatingRenderer) gcpSeatingListRenderers.delete(seatingRenderer);
                notifObserver.disconnect();
            }
        });
        notifObserver.observe(document.body, { childList: true, subtree: true });

        // Show debate buttons after 5 seconds
        setTimeout(() => {
            notification.querySelectorAll('.dangan-trial-start-btn').forEach(btn => btn.style.display = 'block');
            notification.querySelector('.dgn-trial-section--controls')?.classList.add('loaded');
        }, 5000);

        notification.querySelector('#dangan-start-nonstop-btn').onclick = () => {
            notification.remove();
            void startNonStopDebate();
        };
        notification.querySelector('#dangan-start-mpdebate-btn').onclick = () => {
            notification.remove();
            void startMassPanicDebateGenerated();
        };
        notification.querySelector('#dangan-start-hangman-btn').onclick = () => {
            notification.remove();
            onStartHangmansGambit?.();
        };
        notification.querySelector('#dangan-start-pta-btn').onclick = () => {
            notification.remove();
            onStartPanicTalkAction?.();
        };
        notification.querySelector('#dangan-start-interject-btn').onclick = () => {
            notification.remove();
            const _ctx  = window.SillyTavern?.getContext?.();
            const _chat = Array.isArray(_ctx?.chat) ? _ctx.chat : [];
            const _last = [..._chat].reverse().find(m => !m.is_user && !m.is_system && m.name);
            const characterName = _last ? String(_last.name || '').trim() || null : null;
            onStartInterjection?.({ characterName });
        };
        notification.querySelector('#dangan-start-rebuttal-btn').onclick = () => {
            notification.remove();
            const _ctx  = window.SillyTavern?.getContext?.();
            const _chat = Array.isArray(_ctx?.chat) ? _ctx.chat : [];
            const _last = [..._chat].reverse().find(m => !m.is_user && !m.is_system && m.name);
            const opponentName = _last ? String(_last.name || '').trim() || null : null;
            onStartRebuttalShowdown?.({ opponentName, playerName: getPlayerName() });
        };
        notification.querySelector('#dangan-start-voting-btn').onclick = () => {
            notification.remove();
            onStartVotingTime?.();
        };
        notification.querySelector('#dangan-start-punishment-btn').onclick = () => {
            notification.remove();
            const speakerName = gcpSlots[Math.round(gcpCurrentFloat)]?.name ?? null;
            onStartPunishmentTime?.({ characterName: speakerName });
        };
        notification.querySelector('#dangan-start-qtime-btn').onclick = () => {
            notification.remove();
            onStartQuestionTime?.();
        };
        notification.querySelector('#dangan-start-qtruth-btn').onclick = () => {
            notification.remove();
            onStartQuestionTruth?.();
        };
        notification.querySelector('#dangan-start-scrum-btn').onclick = () => {
            notification.remove();
            onStartScrumDebate?.();
        };
        notification.querySelector('#dangan-start-mindmine-btn').onclick = () => {
            notification.remove();
            onStartMindMine?.();
        };
        notification.querySelector('#dangan-start-choosing-btn').onclick = async () => {
            notification.remove();
            const characters = await Promise.all(gcpSlots.map(async s => ({
                name:     s.name,
                // characterSpriteUrls is keyed by normalised name and first token to survive
                // NSD speaker-name abbreviations ("Sonia" vs "Sonia Nevermind")
                src:      characterSpriteUrls.get(normalizeSeatName(s.name))
                       || characterSpriteUrls.get(firstToken(s.name))
                       || await getCharSpriteUrl(s.name, characterEmotions.get(s.name) || 'neutral').catch(() => null)
                       || s.img?.src
                       || null,
                height:   parseInt(s.el?.style.height) || 720,
                hasHorse: needsGymnasticsHorse(s.name),
            })));
            onStartChoosing?.({ characters, startIdx: Math.round(gcpCurrentFloat) });
        };
        notification.querySelector('#dangan-start-showcg-btn').onclick = () => {
            showCgPicker();
        };

        // Render goal/suspects into the merged panel
        updateContextPanel();

        // Inline-edit the goal text on click. Enter saves, Escape reverts.
        const goalEl = notification.querySelector('.dangan-context-goal');
        if (goalEl) {
            goalEl.setAttribute('contenteditable', 'plaintext-only');
            goalEl.setAttribute('spellcheck', 'false');
            goalEl.title = 'Click to edit goal';
            goalEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    goalEl.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    goalEl.textContent = trialContext.goal || '';
                    goalEl.blur();
                }
            });
            goalEl.addEventListener('blur', () => {
                const next = goalEl.textContent.trim();
                if (next !== (trialContext.goal || '')) {
                    setTrialContext(undefined, next, undefined);
                }
            });
        }
    }

    function showCgPicker() {
        document.getElementById('dangan-cg-picker')?.remove();

        const bgs = Array.from(document.querySelectorAll('.bg_example'));
        if (!bgs.length) return;

        const items = bgs.map(el => {
            const bgfile   = el.getAttribute('bgfile') || '';
            const label    = bgfile.split('/').pop().replace(/\.[^.]+$/, '') || bgfile;
            // SillyTavern's thumbnail can be an <img>, a div with a CSS
            // background-image, or an inline style — handle all three.
            const imgEl    = el.querySelector('.bg_example_img, img');
            let thumb = 'none';
            if (imgEl) {
                if (imgEl.tagName === 'IMG' && imgEl.src) {
                    thumb = `url("${imgEl.src}")`;
                } else {
                    const cs = window.getComputedStyle(imgEl);
                    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
                        thumb = cs.backgroundImage;
                    } else if (imgEl.style.backgroundImage) {
                        thumb = imgEl.style.backgroundImage;
                    }
                }
            }
            const isCustom = el.getAttribute('custom') === 'true';
            const cssUrl   = el.dataset?.url
                          || el.getAttribute('data-url')
                          || (thumb && thumb !== 'none' ? thumb : null)
                          || (isCustom ? `url("${bgfile}")` : `url("backgrounds/${encodeURIComponent(bgfile)}")`);
            // No thumb resolvable? Fall back to the fullsize URL so the cell
            // at least renders the background instead of an empty rectangle.
            if (thumb === 'none' && cssUrl) thumb = cssUrl;
            return { label, thumb, cssUrl };
        }).filter(item => item.cssUrl);

        if (!items.length) return;

        let selectedFilter = null; // null | 'sepia' | 'grayscale'

        // ── Build shell (no grid items yet) ──────────────────────────────────
        const picker = document.createElement('div');
        picker.id = 'dangan-cg-picker';

        const inner = document.createElement('div');
        inner.className = 'dangan-cg-picker-inner';

        // Header
        const header = document.createElement('div');
        header.className = 'dangan-cg-picker-header';
        header.innerHTML = `<span class="dangan-cg-picker-title">CHOOSE CG</span>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dangan-cg-picker-close';
        closeBtn.textContent = '✕';
        closeBtn.onclick = () => picker.remove();
        header.appendChild(closeBtn);

        // Filter toggles
        const filterRow = document.createElement('div');
        filterRow.className = 'dangan-cg-picker-filters';
        ['sepia', 'grayscale'].forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'dangan-cg-filter-btn';
            btn.textContent = f.toUpperCase();
            btn.dataset.filter = f;
            btn.onclick = () => {
                if (selectedFilter === f) {
                    selectedFilter = null;
                    btn.classList.remove('active');
                } else {
                    selectedFilter = f;
                    filterRow.querySelectorAll('.dangan-cg-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            };
            filterRow.appendChild(btn);
        });

        // Search
        const searchRow = document.createElement('div');
        searchRow.className = 'dangan-cg-picker-search-row';
        const searchInput = document.createElement('input');
        searchInput.className = 'dangan-cg-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Search backgrounds…';
        searchRow.appendChild(searchInput);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'dangan-cg-picker-grid';

        inner.appendChild(header);
        inner.appendChild(filterRow);
        inner.appendChild(searchRow);
        inner.appendChild(grid);
        picker.appendChild(inner);
        document.body.appendChild(picker);

        // ── Render grid items ─────────────────────────────────────────────────
        // Items are created programmatically so backgroundImage is set via .style
        // (not innerHTML) — avoids quote-in-attribute corruption of the URL string.
        function renderItems() {
            grid.innerHTML = '';
            const query = searchInput.value.trim().toLowerCase();
            const visible = query ? items.filter(it => it.label.toLowerCase().includes(query)) : items;
            if (!visible.length) {
                const empty = document.createElement('div');
                empty.className = 'dangan-cg-no-results';
                empty.textContent = 'No backgrounds found';
                grid.appendChild(empty);
                return;
            }
            visible.forEach(item => {
                const cell = document.createElement('div');
                cell.className = 'dangan-cg-pick-item';

                const thumb = document.createElement('div');
                thumb.className = 'dangan-cg-pick-thumb';
                if (item.thumb && item.thumb !== 'none') thumb.style.backgroundImage = item.thumb;

                const lbl = document.createElement('span');
                lbl.className = 'dangan-cg-pick-label';
                lbl.textContent = item.label;

                cell.appendChild(thumb);
                cell.appendChild(lbl);
                cell.onclick = () => { picker.remove(); showCgOverlay(item.cssUrl, selectedFilter); };
                grid.appendChild(cell);
            });
        }

        renderItems();
        searchInput.addEventListener('input', renderItems);

        picker.addEventListener('click', e => { if (e.target === picker) picker.remove(); });
    }

    function showCgOverlay(bgCssUrl, filter = null) {
        document.getElementById('dangan-cg-overlay')?.remove();
        document.querySelector('.dangan-cg-dismiss-btn')?.remove();
        document.querySelector('.dangan-cg-name-panel')?.remove();

        // SillyTavern chrome + extension widgets need to remain visible and
        // clickable above the CG (which lives at z:2147483646). Each element
        // gets its z-index bumped to 2147483647; if it has no positioning,
        // we also force `position: relative` so z-index actually applies.
        // Originals are saved and restored on cleanup.
        const ABOVE_CG = [
            '#top-bar',
            '#top-settings-holder',
            '#sheld',                  // chat sheld (chat list + messages)
            '#chat',                   // chat messages container
            '#send_form',              // text input area
            '#form_sheld',             // form wrapper around the text input
            '#dangan-hud-topright',
            '#dangan-bgm-display',
            '#dangan-bgm-panel',       // FX Panel (BGM + theme selector)
            '#dangan-vn-overlay',
            '#dangan-trial-pre-debate-notif',
            '#dangan-trial-context-panel',
        ];
        // SillyTavern stylesheets use !important on z-index for some of
        // these elements (#top-bar, #top-settings-holder, #sheld), so a
        // plain inline style loses. Apply with `important` and preserve
        // the original priority so restoration is clean.
        const saved = ABOVE_CG.flatMap(sel =>
            Array.from(document.querySelectorAll(sel)).map(el => {
                const origZ      = el.style.getPropertyValue('z-index');
                const origZPri   = el.style.getPropertyPriority('z-index');
                const origPos    = el.style.getPropertyValue('position');
                const origPosPri = el.style.getPropertyPriority('position');
                const cs = getComputedStyle(el);
                el.style.setProperty('z-index', '2147483647', 'important');
                if (cs.position === 'static') el.style.setProperty('position', 'relative', 'important');
                return { el, origZ, origZPri, origPos, origPosPri };
            })
        );

        // Dismiss button must be a direct body child so its stacking context
        // sits at z:2147483647, above the boosted UI elements that would otherwise
        // swallow clicks if the button were nested inside the overlay (z:2147483646).
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'dangan-cg-dismiss-btn';
        dismissBtn.textContent = '✕ DISMISS';

        // Speaker-name panel — pinned to the left of the viewport, framed in
        // pta-panel.png. Carries the current GCP speaker over and follows
        // Prev/Next message navigation via cgNameTextEl, which is updated
        // by updateGroupChatSpeaker whenever the highlighted speaker changes.
        const initialName = currentSpeaker || gcpSlots[Math.round(gcpCurrentFloat)]?.name || '';
        const namePanel = document.createElement('div');
        namePanel.className = 'dangan-cg-name-panel';
        namePanel.innerHTML = `<span class="dangan-cg-name-text"></span>`;
        const nameTextEl = namePanel.querySelector('.dangan-cg-name-text');
        // Custom setter — also toggles the hide class so an empty name
        // collapses the panel cleanly via .dangan-cg-name-panel-empty.
        const applyName = (value) => {
            const name = String(value || '').trim();
            nameTextEl.textContent = name;
            namePanel.classList.toggle('dangan-cg-name-panel-empty', !name);
        };
        applyName(initialName);
        cgNameTextEl = {
            set textContent(value) { applyName(value); },
            get textContent() { return nameTextEl.textContent; },
        };

        const FADE_OUT_MS = 450;
        let dismissing = false;
        const cleanup = () => {
            if (dismissing) return;
            dismissing = true;
            overlay.classList.add('dangan-cg-fading-out');
            dismissBtn.classList.add('dangan-cg-fading-out');
            namePanel.classList.add('dangan-cg-fading-out');
            setTimeout(() => {
                overlay.remove();
                dismissBtn.remove();
                namePanel.remove();
                cgNameTextEl = null;
                saved.forEach(({ el, origZ, origZPri, origPos, origPosPri }) => {
                    if (origZ)   el.style.setProperty('z-index',  origZ,   origZPri);
                    else         el.style.removeProperty('z-index');
                    if (origPos) el.style.setProperty('position', origPos, origPosPri);
                    else         el.style.removeProperty('position');
                });
            }, FADE_OUT_MS);
        };
        dismissBtn.onclick = cleanup;

        const overlay = document.createElement('div');
        overlay.id = 'dangan-cg-overlay';
        overlay.style.backgroundImage = bgCssUrl;
        if (filter === 'sepia')     overlay.classList.add('dangan-cg-sepia');
        if (filter === 'grayscale') overlay.classList.add('dangan-cg-grayscale');

        document.body.appendChild(overlay);
        document.body.appendChild(namePanel);
        document.body.appendChild(dismissBtn);
    }

    async function startNonStopDebate() {
        const count = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
        const loadingEl = showMinigameLoadingState?.('Loading Non-Stop Debate', { command: '/nonstopdebate' });
        loadingEl?.setProgress?.(0);
        try {
            const sections = await buildDebateSections({
                sectionsCount: count,
                onProgress: (frac) => loadingEl?.setProgress?.(frac),
            });
            if (Array.isArray(sections) && sections.length > 0) {
                const lines = sections.map(s => ({ text: s.statement, speaker: s.speakerName, whiteNoise: s.whiteNoise }));
                debugStartNonStopDebateWithLines(lines);
            } else {
                console.warn('[Dangan][Trial] Generation returned empty sections.');
            }
        } catch (e) {
            console.warn('[Dangan][Trial] Debate section generation failed:', e);
        } finally {
            loadingEl?.hide?.();
        }
    }

    async function startMassPanicDebateGenerated() {
        const count = Math.floor(Math.random() * (6 - 4 + 1)) + 4;
        const loadingEl = showMinigameLoadingState?.('Loading Mass Panic Debate', { command: '/masspanicdebate' });
        loadingEl?.setProgress?.(0);
        try {
            const scenarios = await buildMpdScenarios({
                scenarioCount: count,
                onProgress: (frac) => loadingEl?.setProgress?.(frac),
            });
            if (Array.isArray(scenarios) && scenarios.length > 0) {
                mpdScenarios = parseMpdScenarios(scenarios);
                setState(TrialPhases.MASS_PANIC_DEBATE);
            } else {
                console.warn('[Dangan][Trial] MPD generation returned empty scenarios.');
            }
        } catch (e) {
            console.warn('[Dangan][Trial] MPD generation failed:', e);
        } finally {
            loadingEl?.hide?.();
        }
    }

    function debugStartNonStopDebateWithLines(lines) {
        const list = Array.isArray(lines) ? lines.map(l => {
            if (l && typeof l === 'object') {
                return {
                    text: String(l.text || '').trim(),
                    speaker: String(l.speaker || '').trim(),
                    whiteNoise: normalizeWhiteNoise(l.whiteNoise),
                };
            }
            return { text: String(l || '').trim(), speaker: '', whiteNoise: null };
        }).filter(e => e.text) : [];
        if (!list.length) return false;

        const speakers = getChatCardMembers().map(s => s.name).filter(Boolean).filter(n => !isCharacterDead(n) && !isCharacterMissing(n) && !isSilenced(n) && !isMonokuma(n));
        const speakerPool = speakers.length ? speakers : ['???'];

        persistentDebateHistory = [];
        debateSeatingPlan = null;
        currentDebateSections = Math.min(24, Math.max(1, list.length));
        preparedDebateSections = list.slice(0, currentDebateSections).map(({ text, speaker, whiteNoise }) => {
            // If an explicit speaker is dead or is Monokuma, pick a living one instead
            const speakerName = (speaker && !isCharacterDead(speaker) && !isCharacterMissing(speaker) && !isMonokuma(speaker))
                ? speaker
                : speakerPool[Math.floor(Math.random() * speakerPool.length)];
            const isAgree  = /\(\([^)]+\)\)/.test(text);
            const normalized = isAgree ? text : ensureSingleWeakPointMarker(text);

            const spoken = stripSurroundingQuotes(extractDialogueOnly(normalized) || normalized);
            if (spoken) {
                persistentDebateHistory.push(`${speakerName}: ${spoken}`);
            }

            const parts = splitStatementIntoParts(normalized).map(p => ({
                ...p,
                emotion: inferEmotionFromText(p.text),
            }));
            return { speakerName, statement: normalized, parts, whiteNoise: whiteNoise || null };
        });

        setState(TrialPhases.NON_STOP_DEBATE);
        return true;
    }

    function buildInitialEmotions() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        const result = new Map();
        // Walk oldest→newest so the last message per character wins.
        // Prefer ST's stored extra.expression (set by the expression module) over text inference.
        for (const msg of chat) {
            const name = String(msg.name || '').trim();
            if (!name || msg.is_user || msg.is_system) continue;
            const stored = typeof msg.extra?.expression === 'string' ? msg.extra.expression.trim() : '';
            if (stored) {
                result.set(name, stored);
            } else {
                const text = String(msg.mes || '').trim();
                if (text) result.set(name, inferEmotionFromText(text));
            }
        }
        return result;
    }

    const NSD_UI_SELECTORS = ['#top-bar', '#top-settings-holder', '#sheld', '#right-nav-panel', '#dangan-vn-overlay'];
    const nsdHiddenEls = new Map(); // selector → original display value

    function fadeOutChatUI() {
        document.body.classList.add('dangan-minigame-active');
        for (const sel of NSD_UI_SELECTORS) {
            const el = document.querySelector(sel);
            if (!el) continue;
            nsdHiddenEls.set(sel, el.style.display || '');
            el.style.transition = 'opacity 0.4s ease';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            setTimeout(() => { if (el) el.style.display = 'none'; }, 420);
        }
    }

    function fadeInChatUI() {
        document.body.classList.remove('dangan-minigame-active');
        for (const sel of NSD_UI_SELECTORS) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const orig = nsdHiddenEls.get(sel) ?? '';
            el.style.display = orig;
            el.style.opacity = '0';
            el.style.pointerEvents = '';
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = 'opacity 0.4s ease';
                el.style.opacity = '';
            }));
        }
        nsdHiddenEls.clear();
    }

    // Canonical character heights (cm) keyed by first name and surname, lowercase.
    // These take priority over any dynamic parsing.
    const KNOWN_HEIGHTS_CM = new Map([
        ['monokuma',  75],
        ['saionji', 130],  ['hiyoko',   130],
        ['hanamura', 133], ['teruteru', 133],
        ['kuzuryu',  157], ['fuyuhiko', 157],
        ['nanami',   160], ['chiaki',   160],
        ['mioda',    164], ['ibuki',    164],
        ['koizumi',  165], ['mahiru',   165],
        ['tsumiki',  165], ['mikan',    165],
        ['soda',     172], ['kazuichi', 172],
        ['pekoyama', 172], ['peko',     172],
        ['nevermind',174], ['sonia',    174],
        ['owari',    176], ['akane',    176],
        ['hinata',   179], ['hajime',   179],
        ['komaeda',  180], ['nagito',   180],
        ['tanaka',   182], ['gundham',  182],
        ['togami',   185], ['byakuya',  185],
        ['nidai',    198], ['nekomaru', 198],
    ]);

    // Parse a cm value out of any freeform height string
    function parseHeightCm(raw) {
        if (!raw) return null;
        const s = String(raw).trim();
        const cmMatch = s.match(/(\d+(?:\.\d+)?)\s*cm/i);
        if (cmMatch) return parseFloat(cmMatch[1]);
        const ftInMatch = s.match(/(\d+)\s*(?:ft|'|′|feet)\s*(\d+)?\s*(?:in|"|″)?/i);
        if (ftInMatch) {
            const ft = parseInt(ftInMatch[1]) || 0;
            const inches = parseInt(ftInMatch[2]) || 0;
            return Math.round(ft * 30.48 + inches * 2.54);
        }
        return null;
    }

    // Returns the filtered bullet list for the current NSD, or the full list if no filter is set.
    function getDebateBullets() {
        return nsdActiveBullets ?? getTruthBullets();
    }

    // Determines how many bullets to show based on section count.
    function nsdBulletCount(sectionCount) {
        if (sectionCount <= 5)  return 3;
        if (sectionCount <= 11) return 5;
        if (sectionCount <= 17) return 7;
        return Infinity; // full list
    }

    const STOP_WORDS = new Set([
        'a','an','the','and','or','but','in','on','at','to','for','of','is','it',
        'was','be','as','by','with','that','this','are','from','has','have','had',
        'i','he','she','they','we','you','my','his','her','their','our','your',
        'so','do','did','not','no','if','can','will','just','up','out','about',
    ]);

    // Score each bullet for relevance to the given NSD sections, return top `count`.
    function selectNsdBullets(sections, count) {
        const all = getTruthBullets();
        if (!all.length) return [];
        if (!isFinite(count)) return [...all]; // XL: skip filtering entirely

        // Build a word-frequency map from all section text
        const corpus = new Map();
        const weakWords = new Set();

        for (const sec of sections) {
            const raw = String(sec.statement || '');
            // Extract weak point text ([[...]]) with higher weight
            const wpMatches = raw.matchAll(/\[\[([^\]]+)\]\]/g);
            for (const m of wpMatches) {
                for (const w of tokenize(m[1])) weakWords.add(w);
            }
            // All statement words
            for (const w of tokenize(raw)) {
                corpus.set(w, (corpus.get(w) || 0) + 1);
            }
        }

        function tokenize(text) {
            return String(text).toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
        }

        function scoreBullet(b) {
            let score = 0;
            for (const w of tokenize(b.title)) {
                if (weakWords.has(w)) score += 5;
                else if (corpus.has(w)) score += 2 * corpus.get(w);
            }
            for (const w of tokenize(b.description || '')) {
                if (weakWords.has(w)) score += 2;
                else if (corpus.has(w)) score += corpus.get(w);
            }
            return score;
        }

        return [...all]
            .map(b => ({ b, score: scoreBullet(b) }))
            .sort((a, z) => z.score - a.score)
            .slice(0, count)
            .map(x => x.b);
    }

    function getCharacterHeightCm(name) {
        if (!name) return null;
        const needle      = String(name).trim().toLowerCase();
        const needleFirst = needle.split(/\s+/)[0];

        // ── 0. Canonical table — check every token of the name ────────
        for (const token of needle.split(/\s+/)) {
            if (KNOWN_HEIGHTS_CM.has(token)) return KNOWN_HEIGHTS_CM.get(token);
        }

        // ── 1. Extension characters Map (social profile) ──────────────
        if (typeof characters?.entries === 'function') {
            for (const [k, v] of characters) {
                const vName = String(v?.name || '').trim().toLowerCase();
                const vFirst = vName.split(/\s+/)[0];
                if (k === needle || vName === needle || vFirst === needleFirst) {
                    const raw = String(v?.social?.profile?.height || '').trim();
                    if (raw && raw !== 'unknown') {
                        const cm = parseHeightCm(raw);
                        if (cm) return cm;
                    }
                    break;
                }
            }
        }

        // ── 2. SillyTavern context characters (parse from description) ─
        const ctx = window.SillyTavern?.getContext?.();
        const ctxChars = Array.isArray(ctx?.characters) ? ctx.characters : [];
        for (const c of ctxChars) {
            const cName  = String(c?.name || '').trim().toLowerCase();
            const cFirst = cName.split(/\s+/)[0];
            if (cName !== needle && cFirst !== needleFirst) continue;
            // Search description, personality, scenario, mes_example fields
            const blob = [c.description, c.personality, c.scenario, c.mes_example]
                .map(f => String(f || '')).join(' ');
            const cm = parseHeightCm(blob);
            if (cm) return cm;
        }

        // ── 3. getCharacterSourceText fallback ─────────────────────────
        if (typeof getCharacterSourceText === 'function') {
            const src = String(getCharacterSourceText(name) || '');
            if (src) {
                const cm = parseHeightCm(src);
                if (cm) return cm;
            }
        }

        return null;
    }

    // Returns slot height in px proportional to character height.
    // Reference: 170 cm → BASE_PORTRAIT_PX. Range kept wide (0.55 – 1.45×)
    // so extreme heights (e.g. 130 cm vs 198 cm) look visually distinct.
    const BASE_PORTRAIT_PX         = 720;
    const AVG_HEIGHT_CM            = 170;
    const GYMNASTICS_HORSE_MAX_CM  = 145;  // characters below this height get the gymnastics horse

    function needsGymnasticsHorse(name) {
        const cm = getCharacterHeightCm(name);
        return cm !== null && cm < GYMNASTICS_HORSE_MAX_CM;
    }

    function portraitSlotHeightPx(name) {
        const cm = getCharacterHeightCm(name);
        if (!cm) return BASE_PORTRAIT_PX;
        const scale = Math.min(1.45, Math.max(0.55, cm / AVG_HEIGHT_CM));
        return Math.round(BASE_PORTRAIT_PX * scale);
    }

    function applyPortraitHeights(centerName, leftName, rightName) {
        const set = (imgEl, charName) => {
            const slot = imgEl?.parentElement;
            if (!slot) return;
            slot.style.height = `${portraitSlotHeightPx(charName)}px`;
            const hasHorse = needsGymnasticsHorse(charName);
            const horse = slot.querySelector('.dangan-portrait-horse');
            if (horse) horse.style.setProperty('display', hasHorse ? 'block' : 'none', 'important');
            slot.classList.toggle('has-horse', hasHorse);
        };
        set(portraitImgEl,   centerName);
        set(portraitLeftEl,  leftName);
        set(portraitRightEl, rightName);
    }

    function startSeatingParade() {
        if (!debateOverlay || !debateSeatingPlan?.length) return null;
        if (typeof getSpriteUrl !== 'function') return null;

        const SPEED       = 880;                                // px/s
        const CHAR_SLOT_W = Math.round(window.innerWidth / 3); // matches main-view portrait spacing
        const SPAWN_SECS  = (CHAR_SLOT_W + 180) / SPEED;       // seconds between spawns (+180px gap)
        // Left edge of the screen's center slot — where the target must rest
        const TARGET_X    = CHAR_SLOT_W;                       // == innerWidth/3
        const MAX_ROT_DEG = 45;                                // cylinder warp max angle at screen edges
        const W2          = window.innerWidth / 2;

        // Returns the full CSS transform string for a slot at position x
        function slotTransform(x) {
            const centerX = x + CHAR_SLOT_W / 2;
            const dist    = (centerX - W2) / W2;              // –1 … +1 across the screen
            const rotY    = (-dist * MAX_ROT_DEG).toFixed(1);
            return `translateX(${x}px) rotateY(${rotY}deg)`;
        }

        // Resolve the first speaker so the parade can decelerate onto them
        let targetName;
        if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
            // Try centre-column speaker; fall back to seating plan index 1 (mirrors updateMpdPortraits)
            targetName = String(mpdScenarios?.[0]?.texts?.[1]?.speaker || '').trim() || null;
            if (!targetName && debateSeatingPlan?.length) {
                const living = debateSeatingPlan.filter(n => !isCharacterDead(n) && !isSilenced(n));
                targetName = living[1] || living[0] || null;
            }
        } else {
            targetName = String(preparedDebateSections?.[0]?.speakerName || '').trim() || null;
        }
        const targetSeatIdx = targetName ? findSeatIndex(targetName) : -1;

        // Pre-fetch sprites for the two left-wrap neighbours of seating[0]
        // (they scroll past just before seating[0] reappears in the loop)
        const n = debateSeatingPlan.length;
        if (n >= 2) {
            const prefetch = n >= 3
                ? [debateSeatingPlan[n - 2], debateSeatingPlan[n - 1]]
                : [debateSeatingPlan[n - 1]];
            prefetch.forEach(name => getCharSpriteUrl(name, 'neutral').catch(() => {}));
        }

        debateOverlay.classList.add('nsd-parade-active');
        const container = document.createElement('div');
        container.id = 'dangan-nsd-parade';
        debateOverlay.appendChild(container);

        let stopped        = false;
        let frozen         = false;
        let spawnIdx       = 0;
        let lastTs         = null;
        let sinceSpawn     = SPAWN_SECS; // fire a spawn on the first tick
        let rafId          = null;
        const active       = [];
        let targetEntry    = null;
        let decelStartDist = null;

        async function spawnNext() {
            if (stopped || frozen) return;
            const idx  = spawnIdx % n;
            const name = debateSeatingPlan[idx];
            spawnIdx++;
            if (isCharacterMissing(name)) return;
            const hpx    = portraitSlotHeightPx(name);
            const startX = window.innerWidth + CHAR_SLOT_W;

            const el = document.createElement('div');
            el.className = 'nsd-parade-slot';
            el.style.cssText = `width:${CHAR_SLOT_W}px;height:${hpx}px;`;
            el.style.transform = slotTransform(startX);
            if (needsGymnasticsHorse(name)) {
                el.classList.add('has-horse');
                const horse = document.createElement('img');
                horse.className = 'nsd-parade-horse';
                horse.src = getAssetUrl('gymnastics-horse.png');
                el.appendChild(horse);
            }
            const img = document.createElement('img');
            el.appendChild(img);
            const lectern0 = document.createElement('img');
            lectern0.className = 'nsd-parade-lectern';
            lectern0.src = (getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'));
            el.appendChild(lectern0);
            container.appendChild(el);

            const entry = { el, x: startX };
            active.push(entry);

            // Tag this entry as the deceleration target (first occurrence)
            if (!targetEntry && targetSeatIdx >= 0 && idx === targetSeatIdx) {
                targetEntry    = entry;
                decelStartDist = startX - TARGET_X; // total distance to decelerate over
            }

            try {
                const dead = isCharacterDead(name) || isSilenced(name);
                let url = null;
                if (dead) {
                    url = await getCharSpriteUrl(name, 'dead').catch(() => null)
                       || await getCharSpriteUrl(name, 'neutral').catch(() => null);
                    if (url) img.classList.add('nsd-parade-dead');
                } else {
                    url = await getCharSpriteUrl(name, 'neutral').catch(() => null);
                }
                if (url && !stopped) img.src = url;
            } catch {}
        }

        function tick(ts) {
            if (stopped) return;
            const rawDt = lastTs != null ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
            lastTs = ts;

            // ── Deceleration / freeze logic ───────────────────────────────
            let effectiveSpeed = SPEED;
            if (targetEntry && !frozen) {
                const dist = targetEntry.x - TARGET_X;
                if (dist <= 0) {
                    // Snap all sprites so the target lands exactly on TARGET_X
                    const snap = TARGET_X - targetEntry.x;
                    for (const s of active) {
                        s.x += snap;
                        s.el.style.transform = slotTransform(s.x);
                    }
                    frozen = true;
                    rafId  = null;
                    return; // stay frozen until stop() is called
                }
                // easeOutSqrt: speed tapers proportionally to sqrt(remaining fraction)
                const frac = Math.min(1, dist / decelStartDist);
                effectiveSpeed = Math.max(30, SPEED * Math.sqrt(frac));
            }

            // ── Move sprites ──────────────────────────────────────────────
            const dt = rawDt;
            for (let i = active.length - 1; i >= 0; i--) {
                const s = active[i];
                s.x -= effectiveSpeed * dt;
                s.el.style.transform = slotTransform(s.x);
                if (s.x < -CHAR_SLOT_W - 50) {
                    s.el.remove();
                    active.splice(i, 1);
                }
            }

            // ── Spawn — continue until frozen ─────────────────────────────
            sinceSpawn += dt;
            if (sinceSpawn >= SPAWN_SECS) {
                sinceSpawn = 0;
                spawnNext();
            }

            rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);
        return {
            stop() {
                stopped = true;
                if (rafId) cancelAnimationFrame(rafId);
                // Reveal portrait stage immediately, then fade parade out over 0.5s
                debateOverlay?.classList.remove('nsd-parade-active');
                container.style.transition = 'opacity 0.5s ease-out';
                container.style.opacity    = '0';
                setTimeout(() => container.remove(), 500);
            },
        };
    }

    // Quick parade animation played when the NSD speaker shifts to a new character.
    // fromSpeakerName must be the PREVIOUS speaker (captured before portraitSpeaker is updated).
    // Picks the shorter arc around the seating ring: forward = right-to-left, backward = left-to-right.
    // targetEmotion is the speaking emotion for the new speaker; other characters use characterEmotions.
    function startSpeakerShiftParade(fromSpeakerName, targetSpeakerName, targetEmotion) {
        if (!debateOverlay || !debateSeatingPlan?.length) return;
        if (typeof getSpriteUrl !== 'function') return;

        // Cancel any in-progress shift parade before starting a new one
        nsdShiftParadeStop?.();
        nsdShiftParadeStop = null;

        const SPEED       = 7200;                               // px/s — completes within ~0.5 seconds
        const CHAR_SLOT_W = Math.round(window.innerWidth / 3);
        const SPAWN_SECS  = (CHAR_SLOT_W + 180) / SPEED;
        const TARGET_X    = CHAR_SLOT_W;                        // left edge of the centre slot
        const MAX_ROT_DEG = 45;
        const W2          = window.innerWidth / 2;

        function slotTransform(x) {
            const centerX = x + CHAR_SLOT_W / 2;
            const dist    = (centerX - W2) / W2;
            return `translateX(${x}px) rotateY(${(-dist * MAX_ROT_DEG).toFixed(1)}deg)`;
        }

        const n              = debateSeatingPlan.length;
        const targetSeatIdx  = findSeatIndex(targetSpeakerName);
        const currentSeatIdx = fromSpeakerName ? findSeatIndex(fromSpeakerName) : -1;

        // Choose the shorter arc: forward (right→left) or backward (left→right)
        const forwardSteps  = currentSeatIdx >= 0 && targetSeatIdx >= 0
            ? (targetSeatIdx - currentSeatIdx + n) % n
            : 1;
        const backwardSteps = n - forwardSteps;
        // scrollForward: slots enter from right, slide left (seats increment)
        // scrollBackward: slots enter from left, slide right (seats decrement)
        const scrollForward = forwardSteps <= backwardSteps;

        // First seat to spawn is the one immediately after/before the current speaker
        let spawnIdx = currentSeatIdx >= 0
            ? scrollForward
                ? (currentSeatIdx + 1 + n) % n
                : (currentSeatIdx - 1 + n) % n
            : 0;
        // Spawn at most (arc length + 2) slots; extra 2 keep the screen filled while target decelerates.
        // When this limit is reached we just stop spawning — the RAF continues until the target freezes.
        const MAX_SPAWNS = (scrollForward ? forwardSteps : backwardSteps) + 2;
        let spawnCount   = 0;

        // Safety fallback: if the target was never found within a reasonable time, bail out
        let fallbackTimer = setTimeout(() => cleanup(true), (MAX_SPAWNS * SPAWN_SECS + 3) * 1000);

        // Slots start just off the screen edge (tight margin so travel distance fits ~1 s)
        const startX = scrollForward ? window.innerWidth + 10 : -(CHAR_SLOT_W + 10);

        // Build container first — we need to plant the current speaker's slot BEFORE hiding
        // the portrait stage so there is no visual pop.
        const container = document.createElement('div');
        container.id = 'dangan-nsd-shift-parade';
        container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:12;overflow:hidden;perspective:1200px;';
        debateOverlay.appendChild(container);

        let stopped        = false;
        let frozen         = false;
        let lastTs         = null;
        let sinceSpawn     = SPAWN_SECS; // fire a spawn immediately on first tick
        let rafId          = null;
        const active       = [];
        let targetEntry    = null;
        let decelStartDist = null;

        // Plant the current speaker's slot at center using the already-loaded portrait image.
        // This covers the portrait stage seamlessly before we hide it, so there is no pop.
        if (fromSpeakerName) {
            const hpx = portraitSlotHeightPx(fromSpeakerName);
            const el  = document.createElement('div');
            el.className     = 'nsd-parade-slot';
            el.style.cssText = `width:${CHAR_SLOT_W}px;height:${hpx}px;`;
            el.style.transform = slotTransform(TARGET_X);
            if (needsGymnasticsHorse(fromSpeakerName)) {
                el.classList.add('has-horse');
                const horse = document.createElement('img');
                horse.className = 'nsd-parade-horse';
                horse.src = getAssetUrl('gymnastics-horse.png');
                el.appendChild(horse);
            }
            const img = document.createElement('img');
            // Re-use the already-loaded src — no async needed, no flicker
            if (portraitImgEl?.src) img.src = portraitImgEl.src;
            el.appendChild(img);
            const lectern1 = document.createElement('img');
            lectern1.className = 'nsd-parade-lectern';
            lectern1.src = (getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'));
            el.appendChild(lectern1);
            container.appendChild(el);
            active.push({ el, x: TARGET_X });
        }

        // Portrait stage is now covered — safe to hide it without a visible pop
        debateOverlay.classList.add('nsd-parade-active');

        function cleanup(fade) {
            if (stopped) return;
            stopped = true;
            clearTimeout(fallbackTimer);
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            debateOverlay?.classList.remove('nsd-parade-active');
            if (fade) {
                container.style.transition = 'opacity 0.1s ease-out';
                container.style.opacity    = '0';
                setTimeout(() => container.remove(), 100);
            } else {
                container.remove();
            }
        }

        nsdShiftParadeStop = cleanup;

        async function spawnNext() {
            if (stopped || frozen) return;
            if (spawnCount >= MAX_SPAWNS) return; // stop spawning; RAF still runs until target freezes
            spawnCount++;

            const idx  = ((spawnIdx % n) + n) % n;
            spawnIdx   = scrollForward ? (spawnIdx + 1) : (spawnIdx - 1);
            const name = debateSeatingPlan[idx];
            if (isCharacterMissing(name)) return;

            const hpx = portraitSlotHeightPx(name);
            const el  = document.createElement('div');
            el.className = 'nsd-parade-slot';
            el.style.cssText = `width:${CHAR_SLOT_W}px;height:${hpx}px;`;
            el.style.transform = slotTransform(startX);
            if (needsGymnasticsHorse(name)) {
                el.classList.add('has-horse');
                const horse = document.createElement('img');
                horse.className = 'nsd-parade-horse';
                horse.src = getAssetUrl('gymnastics-horse.png');
                el.appendChild(horse);
            }
            const img = document.createElement('img');
            el.appendChild(img);
            const lectern2 = document.createElement('img');
            lectern2.className = 'nsd-parade-lectern';
            lectern2.src = (getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'));
            el.appendChild(lectern2);
            container.appendChild(el);

            const entry = { el, x: startX };
            active.push(entry);

            if (!targetEntry && targetSeatIdx >= 0 && idx === targetSeatIdx) {
                targetEntry    = entry;
                decelStartDist = scrollForward
                    ? startX - TARGET_X      // forward: large positive, shrinks as slot moves left
                    : TARGET_X - startX;     // backward: large positive, shrinks as slot moves right
            }

            try {
                const dead = isCharacterDead(name) || isSilenced(name);
                // Use the target's active speaking emotion; others use their last-seen emotion
                const emo  = (idx === targetSeatIdx)
                    ? (targetEmotion || 'neutral')
                    : (characterEmotions.get(name) || 'neutral');
                let url = null;
                if (dead) {
                    url = await getCharSpriteUrl(name, 'dead').catch(() => null);
                    if (url) img.classList.add('nsd-parade-dead');
                } else {
                    url = await getCharSpriteUrl(name, emo).catch(() => null);
                }
                if (url && !stopped) img.src = url;
            } catch {}
        }

        function tick(ts) {
            if (stopped) return;
            const rawDt = lastTs != null ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
            lastTs = ts;

            let effectiveSpeed = SPEED;
            if (targetEntry && !frozen) {
                // dist = remaining distance to TARGET_X (always positive while approaching)
                const dist = scrollForward
                    ? targetEntry.x - TARGET_X
                    : TARGET_X - targetEntry.x;
                if (dist <= 0) {
                    // Snap everything so target lands exactly at TARGET_X
                    const snap = TARGET_X - targetEntry.x;
                    for (const s of active) {
                        s.x += snap;
                        s.el.style.transform = slotTransform(s.x);
                    }
                    frozen = true;
                    rafId  = null;
                    // Brief hold, then fade out to reveal the updated portraits underneath
                    setTimeout(() => cleanup(true), 40);
                    return;
                }
                // easeOutSqrt: fast start, decelerate proportionally to sqrt(remaining fraction)
                const frac = Math.min(1, dist / decelStartDist);
                effectiveSpeed = Math.max(60, SPEED * Math.sqrt(frac));
            }

            const dt = rawDt;
            for (let i = active.length - 1; i >= 0; i--) {
                const s = active[i];
                if (scrollForward) {
                    s.x -= effectiveSpeed * dt;
                    if (s.x < -CHAR_SLOT_W - 50) { s.el.remove(); active.splice(i, 1); continue; }
                } else {
                    s.x += effectiveSpeed * dt;
                    if (s.x > window.innerWidth + 50) { s.el.remove(); active.splice(i, 1); continue; }
                }
                s.el.style.transform = slotTransform(s.x);
            }

            sinceSpawn += dt;
            if (sinceSpawn >= SPAWN_SECS) {
                sinceSpawn = 0;
                spawnNext();
            }

            rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);
    }

    function normalizeSeatName(name) {
        return String(name || '').trim().toLowerCase();
    }

    function firstToken(name) {
        return normalizeSeatName(name).split(/\s+/)[0] || '';
    }

    // Returns the player's name when the Prome VN Extension is active, otherwise null.
    // Used by getCharSpriteUrl to resolve the player's sprite via Prome's sprite pack.
    function getPlayerName() {
        if (!getPromeInfo()) return null;
        const ctx = window.SillyTavern?.getContext?.();
        return ctx?.name1 || ctx?.user_name || ctx?.userName || ctx?.personaName || null;
    }

    function showMonokumaOverlay(emo) {
        let overlay = document.getElementById('dangan-monokuma-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dangan-monokuma-overlay';
            const img = document.createElement('img');
            img.alt = 'Monokuma';
            overlay.appendChild(img);
            document.body.appendChild(overlay);
            void overlay.offsetWidth; // flush so opacity:0 is committed before transition fires
        }
        const img = overlay.querySelector('img');
        if (img) {
            getCharSpriteUrl('Monokuma', emo || 'neutral')
                .then(url => { if (url && img) img.src = url; })
                .catch(() => {});
        }
        if (trialActive) applyCamShot(overlay, gcpBgLoopEl);
        document.body.classList.add('dangan-mono-speaker');
    }

    function hideMonokumaOverlay() {
        document.body.classList.remove('dangan-mono-speaker');
        // Don't remove the element — keep it for re-use and so the fade-out transition plays.
    }

    function getMonokumaStaticUrl(emo) {
        const base = extensionFolderPath || `scripts/extensions/third-party/${extensionName}`;
        const emoMap = {
            angry: 'monokuma_angry', rage: 'monokuma_angry', furious: 'monokuma_angry',
            cheerful: 'monokuma_cheerful', happy: 'monokuma_cheerful', joy: 'monokuma_whimsyjoy',
            laughing: 'monokuma_laugh', laugh: 'monokuma_laugh', amused: 'monokuma_laugh',
            confused: 'monokuma_confused', surprised: 'monokuma_confused',
            sad: 'monokuma_sad', crying: 'monokuma_sad',
            nervous: 'monokuma_sweating', anxious: 'monokuma_sweating', sweating: 'monokuma_sweating',
            thinking: 'monokuma_eto', smug: 'monokuma_tadam',
        };
        const file = emoMap[String(emo || '').toLowerCase()] || 'monokuma_idle';
        return `${base}/assets/monokuma/${file}.png`;
    }

    // Sprite resolver that transparently handles the player character.
    // getSpriteUrl uses the SillyTavern sprite API and has no knowledge of the
    // Prome VN Extension's sprite pack, so the player's name would always return null.
    // This wrapper intercepts the player and returns the Prome path directly.
    async function getCharSpriteUrl(name, emo) {
        if (typeof getSpriteUrl !== 'function') return null;
        const promeInfo = getPromeInfo();
        if (promeInfo) {
            const playerName = getPlayerName();
            if (playerName) {
                // Only an EXACT (case-insensitive, trimmed) match swaps in the
                // Prome user sprite — the old code also matched by first token
                // so a persona named "Hajime" would override a separate
                // "Hajime Hinata" NPC's sprite in group chats. The exact match
                // still handles the legitimate case where the player's persona
                // name is unique (e.g. "Dawn") and Prome carries the actual
                // sprite identity via promeInfo.spritePack.
                if (normalizeSeatName(name) === normalizeSeatName(playerName)) {
                    return getSpriteUrl(promeInfo.spritePack, emo);
                }
            }
        }
        if (isCharacterDead(name)) return getSpriteUrl(name, 'dead');
        // Monokuma: try standard sprites first, fall back to bundled emotion sprite.
        // When a custom Game Master is configured the chosen character takes
        // Monokuma's place — route the sprite lookup through their name so
        // ST's sprite system returns their pack, and skip the bundled fallback
        // (the user explicitly opted out of Monokuma art).
        if (isMonokuma(name)) {
            const custom = typeof getCustomGameMasterName === 'function'
                ? getCustomGameMasterName()
                : null;
            if (custom) {
                const url = await getSpriteUrl(custom, emo).catch(() => null);
                return url; // null is fine — caller hides the slot when no sprite found
            }
            const url = await getSpriteUrl(name, emo).catch(() => null);
            return url ?? getMonokumaStaticUrl(emo);
        }
        return getSpriteUrl(name, emo);
    }

    // ── Saved seating plan (per-chat user override) ─────────────────────
    function loadSavedSeatingPlan() {
        const key = getTrialPersistenceKey();
        const arr = extensionSettings?.[extensionName]?.trials?.[key]?.savedSeatingPlan;
        return Array.isArray(arr) && arr.length ? arr.slice() : null;
    }
    function saveSavedSeatingPlan(plan) {
        if (typeof saveSettingsDebounced !== 'function') return;
        const key = getTrialPersistenceKey();
        if (!extensionSettings[extensionName].trials)      extensionSettings[extensionName].trials      = {};
        if (!extensionSettings[extensionName].trials[key]) extensionSettings[extensionName].trials[key] = {};
        if (!Array.isArray(plan) || plan.length === 0) {
            delete extensionSettings[extensionName].trials[key].savedSeatingPlan;
        } else {
            extensionSettings[extensionName].trials[key].savedSeatingPlan = plan.slice();
        }
        saveSettingsDebounced();
    }

    function buildSeatingPlan(names) {
        // Deduplicate by normalized full name first, then by first-name token.
        // This catches both exact duplicates ("Nagito" / "nagito") and
        // partial-name duplicates ("Nagito" / "Nagito Komaeda") that arise when
        // getChatCardMembers() returns the same character in different name forms.
        const seenFull  = new Map(); // full-normalized → original
        const seenFirst = new Set(); // first-token → already added

        for (const n of names) {
            const trimmed = String(n || '').trim();
            if (!trimmed) continue;
            const fullKey  = normalizeSeatName(trimmed);
            const firstKey = firstToken(trimmed);
            if (seenFull.has(fullKey) || seenFirst.has(firstKey)) continue;
            seenFull.set(fullKey, trimmed);
            seenFirst.add(firstKey);
        }
        const unique = Array.from(seenFull.values());

        // User override: if the player has saved a seating plan for this
        // chat, project it onto the current name set. Drop characters no
        // longer present; append any new arrivals at the end. Monokuma
        // is always forced to seat 0.
        const saved = loadSavedSeatingPlan();
        if (saved && saved.length) {
            const byKey = new Map(unique.map(n => [normalizeSeatName(n), n]));
            const used = new Set();
            const ordered = [];
            for (const s of saved) {
                const k = normalizeSeatName(s);
                if (byKey.has(k) && !used.has(k)) {
                    ordered.push(byKey.get(k));
                    used.add(k);
                }
            }
            for (const n of unique) {
                const k = normalizeSeatName(n);
                if (!used.has(k)) ordered.push(n);
            }
            const monoIdx = ordered.findIndex(n => normalizeSeatName(n) === 'monokuma');
            if (monoIdx > 0) {
                const [m] = ordered.splice(monoIdx, 1);
                ordered.unshift(m);
            }
            return ordered;
        }

        // No saved plan — shuffle randomly, Monokuma still anchored at 0.
        for (let i = unique.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        const monokumaIdx = unique.findIndex(n => normalizeSeatName(n) === 'monokuma');
        if (monokumaIdx > 0) {
            const [monokuma] = unique.splice(monokumaIdx, 1);
            unique.unshift(monokuma);
        }
        return unique;
    }

    // Returns debateSeatingPlan, building it from the current group members if not yet set.
    function getOrBuildSeatingPlan() {
        if (!isGroupChat()) return debateSeatingPlan || [];
        if (debateSeatingPlan?.length) return debateSeatingPlan;
        const members = getChatCardMembers()
            .map(m => m.name)
            .filter(Boolean)
            .filter(n => !isCharacterMuted(n) || isCharacterDead(n));
        const playerName = getPlayerName();
        if (playerName) members.push(playerName);
        if (members.length) debateSeatingPlan = buildSeatingPlan(members);
        return debateSeatingPlan || [];
    }

    function findSeatIndex(speakerName) {
        if (!debateSeatingPlan?.length) return -1;
        const needle      = normalizeSeatName(speakerName);
        const needleFirst = firstToken(speakerName);
        // Try exact normalized match first, fall back to first-name token match
        let idx = debateSeatingPlan.findIndex(n => normalizeSeatName(n) === needle);
        if (idx === -1) {
            idx = debateSeatingPlan.findIndex(n => firstToken(n) === needleFirst);
        }
        return idx;
    }

    function getSeatingNeighbors(speakerName) {
        if (!debateSeatingPlan?.length) return { left: null, right: null };
        const idx = findSeatIndex(speakerName);
        if (idx === -1) return { left: null, right: null };
        const len = debateSeatingPlan.length;
        return {
            left:  len > 1 ? debateSeatingPlan[(idx - 1 + len) % len] : null,
            right: len > 1 ? debateSeatingPlan[(idx + 1) % len]        : null,
        };
    }

    function setupNonStopDebate() {
        // Save MPD scenarios across cleanupDebateUI (which resets them)
        const savedMpdScenarios = mpdScenarios;
        cleanupDebateUI();
        mpdScenarios = savedMpdScenarios;

        if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
            document.body.classList.add('dangan-mpd-active');
            playPanicTrack?.();
        } else {
            playDebatesTrack?.();
        }
        suppressVisualizer?.();
        document.getElementById('dangan-chapter-label')?.style.setProperty('display', 'none');
        document.getElementById('dangan-trial-context-panel')?.style.setProperty('display', 'none');

        if (!debateSeatingPlan?.length && isGroupChat()) {
            const isMpd = currentState === TrialPhases.MASS_PANIC_DEBATE;
            const groupMembers = getChatCardMembers().map(m => m.name).filter(Boolean)
                .filter(n => (!isCharacterMuted(n) || isCharacterDead(n)) && !isMonokuma(n));
            let speakerNames;
            if (groupMembers.length) {
                speakerNames = groupMembers;
            } else if (isMpd) {
                speakerNames = [...new Set(
                    (mpdScenarios || []).flatMap(s => (s.texts || []).map(t => t.speaker)).filter(Boolean)
                )].filter(n => !isMonokuma(n));
            } else {
                speakerNames = (preparedDebateSections || []).map(s => s.speakerName).filter(Boolean).filter(n => !isMonokuma(n));
            }
            const playerName = getPlayerName();
            if (playerName) speakerNames.push(playerName);
            debateSeatingPlan = buildSeatingPlan(speakerNames);
            console.log('[Dangan][Trial] Seating plan generated:', debateSeatingPlan);
        } else {
            console.log('[Dangan][Trial] Seating plan reused:', debateSeatingPlan);
        }

        characterEmotions = buildInitialEmotions();

        debateOverlay = document.createElement('div');
        debateOverlay.id = 'dangan-nonstop-debate-overlay';

        reticleEl = document.createElement('div');
        reticleEl.id = 'dangan-trial-reticle';

        // Build speedlines overlay
        const slOverlay = document.createElement('div');
        slOverlay.id = 'dangan-nsd-speedlines';
        for (let i = 0; i < 22; i++) {
            const line = document.createElement('div');
            line.className = 'nsd-speedline';
            line.style.setProperty('--sl-h',     `${1 + Math.round(Math.random() * 2)}px`);
            line.style.setProperty('--sl-w',     `${80 + Math.round(Math.random() * 340)}px`);
            line.style.setProperty('--sl-dur',   `${(0.12 + Math.random() * 0.18).toFixed(2)}s`);
            line.style.setProperty('--sl-delay', `-${(Math.random() * 0.3).toFixed(2)}s`);
            line.style.top = `${Math.round(Math.random() * 100)}%`;
            slOverlay.appendChild(line);
        }
        debateOverlay.appendChild(slOverlay);

        const debateContent = document.createElement('div');
        debateContent.innerHTML = `
            <div class="dangan-trial-top-left">
                <div id="dangan-speaker-name">...</div>
                <div id="dangan-section-dots"></div>
            </div>
            <div class="dangan-trial-portrait-stage">
                <div class="dangan-portrait-slot dangan-portrait-neighbor-slot dangan-portrait-left-slot">
                    <img class="dangan-portrait-horse" src="${getAssetUrl('gymnastics-horse.png')}" alt="" />
                    <img id="dangan-portrait-left-img" alt="" />
                    <img class="dangan-portrait-lectern" src="${(getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'))}" alt="" />
                </div>
                <div class="dangan-portrait-slot dangan-portrait-center-slot">
                    <img class="dangan-portrait-horse" src="${getAssetUrl('gymnastics-horse.png')}" alt="" />
                    <img id="dangan-trial-portrait-img" alt="" />
                    <img class="dangan-portrait-lectern" src="${(getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'))}" alt="" />
                </div>
                <div class="dangan-portrait-slot dangan-portrait-neighbor-slot dangan-portrait-right-slot">
                    <img class="dangan-portrait-horse" src="${getAssetUrl('gymnastics-horse.png')}" alt="" />
                    <img id="dangan-portrait-right-img" alt="" />
                    <img class="dangan-portrait-lectern" src="${(getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'))}" alt="" />
                </div>
            </div>
            <div class="dangan-trial-bottom-left" id="dangan-truth-bullet-cylinder"></div>
            <div id="dangan-seating-debug"></div>
        `;
        debateOverlay.appendChild(reticleEl);
        while (debateContent.firstChild) debateOverlay.appendChild(debateContent.firstChild);

        const shotFlashEl = document.createElement('div');
        shotFlashEl.id = 'dangan-nsd-shot-flash';
        debateOverlay.appendChild(shotFlashEl);

        const wnFlashEl = document.createElement('div');
        wnFlashEl.id = 'dangan-wn-press-flash';
        debateOverlay.appendChild(wnFlashEl);

        // Status bar PNG — sits BEHIND the hearts and stars gauges.
        const statusBar = document.createElement('img');
        statusBar.id = 'dangan-nsd-status-bar';
        statusBar.src = `${extensionFolderPath}/assets/classtrial/status-bar.png`;
        statusBar.alt = '';
        statusBar.draggable = false;
        debateOverlay.appendChild(statusBar);

        // Concentrate stars — top-right gauge that drains right→left, green→black.
        // The black layer is just a masked silhouette underneath. The green
        // layer wraps a masked inner div so the parent's drop-shadow filter
        // runs AFTER the mask shapes it into stars (CSS paint order is
        // filter → mask, so we need the mask on the child and filter on the
        // parent for the glow to actually trace the star outlines).
        const starsGauge = document.createElement('div');
        starsGauge.id = 'dangan-concentrate-stars';
        starsGauge.innerHTML = `
            <div class="stars-bg"></div>
            <div class="stars-fg-wrap">
                <div class="stars-fg"></div>
            </div>
        `;
        const starsUrl = `${extensionFolderPath}/assets/classtrial/stars.svg`;
        const starsMaskUrl = `url("${starsUrl}")`;
        for (const sel of ['.stars-bg', '.stars-fg']) {
            const el = starsGauge.querySelector(sel);
            el.style.webkitMaskImage = starsMaskUrl;
            el.style.maskImage       = starsMaskUrl;
        }
        starsGauge.style.setProperty('--gauge-pct', '100%');
        debateOverlay.appendChild(starsGauge);

        // Hearts health gauge — sits above the stars, drains left per WN hit.
        nsdHealth = NSD_HEALTH_MAX;
        nsdBreakTriggered = false;

        // Decide the debate time limit. Default is the 2-minute floor; scenarios may
        // request more by setting a numeric `timeLimitMs` on the prepared sections /
        // MPD scenarios array.
        const isMpdNow = currentState === TrialPhases.MASS_PANIC_DEBATE;
        const requestedLimit = isMpdNow
            ? (mpdScenarios?.timeLimitMs ?? null)
            : (preparedDebateSections?.timeLimitMs ?? null);
        setDebateTimeLimit(requestedLimit ?? DEBATE_TIMER_MIN_MS);
        debateTimerStartTs = performance.now();

        // NSD time-limit timer (bottom-left). Uses Hangman's Gambit font/colors.
        const timerWrap = document.createElement('div');
        timerWrap.id = 'dangan-nsd-timer-wrap';
        timerWrap.innerHTML = `
            <img class="dangan-nsd-timer-bar-bg" src="${extensionFolderPath}/assets/classtrial/timer-bar.png" alt="" draggable="false"/>
            <div id="dangan-nsd-timer">02:00:000</div>
        `;
        debateOverlay.appendChild(timerWrap);
        const heartsGauge = document.createElement('div');
        heartsGauge.id = 'dangan-nsd-hearts';
        heartsGauge.innerHTML = `
            <div class="hearts-bg"></div>
            <div class="hearts-fg-wrap">
                <div class="hearts-fg"></div>
            </div>
        `;
        const heartsUrl = `${extensionFolderPath}/assets/classtrial/hearts.svg`;
        const heartsMaskUrl = `url("${heartsUrl}")`;
        for (const sel of ['.hearts-bg', '.hearts-fg']) {
            const el = heartsGauge.querySelector(sel);
            el.style.webkitMaskImage = heartsMaskUrl;
            el.style.maskImage       = heartsMaskUrl;
        }
        heartsGauge.style.setProperty('--gauge-pct', '100%');
        debateOverlay.appendChild(heartsGauge);

        document.body.appendChild(debateOverlay);
        fadeOutChatUI();
        portraitImgEl  = debateOverlay.querySelector('#dangan-trial-portrait-img');
        portraitLeftEl = debateOverlay.querySelector('#dangan-portrait-left-img');
        portraitRightEl = debateOverlay.querySelector('#dangan-portrait-right-img');

        const vnWrapper = document.querySelector('#visual-novel-wrapper');
        if (vnWrapper) vnWrapper.style.visibility = 'hidden';

        // Pre-fetch all three portraits for the first section before playback starts.
        // We lock in portraitSpeaker/portraitEmotion so playNextChunk's first call to
        // updateDebatePortraits returns early (same speaker+emotion) and doesn't race
        // with or cancel these fetches.
        const firstSection = preparedDebateSections?.[0];
        if (currentState === TrialPhases.MASS_PANIC_DEBATE && mpdScenarios?.length && typeof getSpriteUrl === 'function') {
            // MPD: col0 → left portrait, col1 → center, col2 → right
            const firstScenario = mpdScenarios[0];
            let col0Name = String(firstScenario.texts?.[0]?.speaker || '').trim() || null;
            let col1Name = String(firstScenario.texts?.[1]?.speaker || '').trim() || null;
            let col2Name = String(firstScenario.texts?.[2]?.speaker || '').trim() || null;
            // Ensure the player character never appears as a column speaker
            const _pn = getPlayerName();
            const _isPlayer = (n) => !!(_pn && n && (
                normalizeSeatName(n) === normalizeSeatName(_pn) || firstToken(n) === firstToken(_pn)
            ));
            if (_isPlayer(col0Name)) col0Name = null;
            if (_isPlayer(col1Name)) col1Name = null;
            if (_isPlayer(col2Name)) col2Name = null;
            // Fall back to living seating-plan members when scenario speakers are blank
            if (!col0Name && !col1Name && !col2Name && debateSeatingPlan?.length) {
                const living = debateSeatingPlan.filter(n => !isCharacterDead(n) && !isSilenced(n) && !_isPlayer(n));
                col0Name = living[0] || null;
                col1Name = living[1] || null;
                col2Name = living[2] || null;
            }
            // Lock speakers in for the entire debate
            mpdColumnSpeakers = [col0Name, col1Name, col2Name];
            applyPortraitHeights(col1Name, col0Name, col2Name);
            const tok = ++portraitToken;
            const loadImg = async (el, name) => {
                if (!el || !name) return;
                if (isCharacterMissing(name)) { el.style.display = 'none'; return; }
                try {
                    const url = await getCharSpriteUrl(name, 'neutral').catch(() => null);
                    if (tok !== portraitToken || !url || !el) return;
                    el.src = url;
                    el.style.display = 'block';
                    el.style.filter = '';
                } catch {}
            };
            loadImg(portraitLeftEl,  col0Name);
            loadImg(portraitImgEl,   col1Name);
            loadImg(portraitRightEl, col2Name);
        } else if (firstSection?.speakerName && typeof getSpriteUrl === 'function') {
            const firstName = String(firstSection.speakerName).trim();
            const firstEmo  = firstSection.parts?.[0]?.emotion || 'neutral';
            const { left: firstLeft, right: firstRight } = getSeatingNeighbors(firstName);
            const leftEmo  = characterEmotions.get(firstLeft)  || 'neutral';
            const rightEmo = characterEmotions.get(firstRight) || 'neutral';

            portraitSpeaker = firstName;
            portraitEmotion = firstEmo;
            const tok = ++portraitToken;

            const loadImg = async (el, name, emo) => {
                if (!el || !name) return;
                if (isCharacterMissing(name)) { el.style.display = 'none'; return; }
                try {
                    const url = await getCharSpriteUrl(name, emo).catch(() => null);
                    if (tok !== portraitToken || !url || !el) return;
                    el.src = url;
                    el.style.display = 'block';
                    el.style.filter = '';
                } catch {}
            };
            applyPortraitHeights(firstName, firstLeft, firstRight);
            loadImg(portraitImgEl,   firstName, firstEmo);
            loadImg(portraitLeftEl,  firstLeft,  leftEmo);
            loadImg(portraitRightEl, firstRight, rightEmo);
        }

        // Reticle position is driven by attachCursorSway (mouse position + sway offset).
        // Absorb hit-detection uses the SWAYED reticle position (where the visible
        // cursor is), not the raw OS mouse position, so the player can absorb the
        // weak point under the reticle even when the sway offsets it from the mouse.
        detachReticleSway?.();
        detachReticleSway = attachCursorSway(reticleEl, debateOverlay, {
            onFrame: (sx, sy) => {
                // The swayed reticle position is the cursor for all gameplay logic:
                // White-noise hover, space-fire burst origin, MPD column selection,
                // and click hit-detection all read from lastCursorX/Y, so making it
                // the swayed position routes everything through the visible cursor.
                lastCursorX = sx;
                lastCursorY = sy;
                updateWhiteNoiseHover(sx, sy);
            },
        });
        debateOverlay.onmousemove = () => {
            const pos = detachReticleSway?.getPosition?.();
            if (!pos) return;
            if (shiftRightPressed && isDebateActive()) {
                const hit  = document.elementFromPoint(pos.x, pos.y);
                const wpEl = hit?.closest?.('.dangan-weak-point');
                if (wpEl) startAbsorb(wpEl);
                else      cancelAbsorb();
            }
            if (lieHeld && isDebateActive()) {
                const hit  = document.elementFromPoint(pos.x, pos.y);
                const wpEl = hit?.closest?.('.dangan-weak-point');
                if (wpEl) startLieAbsorb(wpEl);
                else      cancelLieAbsorb();
            }
        };

        debateOverlay.onwheel = (e) => { e.preventDefault(); };

        debateOverlay.onclick = (e) => {
            handleShoot(e);
        };

        // Select relevant bullets for this NSD based on section count
        const bulletCap = nsdBulletCount(currentDebateSections);
        nsdActiveBullets = selectNsdBullets(preparedDebateSections || [], bulletCap);
        selectedTruthBulletIndex = 0;

        // Snapshot equipped skills for this entire debate run (covers both NSD and MPD)
        const equipped = typeof getEquippedSkillsSnapshot === 'function' ? getEquippedSkillsSnapshot() : [];
        mpdSkillSeatingPlanCopy = equipped.includes('shop_skill_seating_plan_copy');
        mpdSkillBetaBlock       = equipped.includes('shop_skill_beta_block');

        // Seating debug is hidden by default; only revealed when SEATING PLAN COPY is equipped
        const seatingDbgEl = debateOverlay.querySelector('#dangan-seating-debug');
        if (seatingDbgEl) seatingDbgEl.style.display = 'none';

        renderCylinder();
        if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
            updateSectionDots(1, mpdScenarios?.length || 1);
            injectMpdOverlayElements();
        } else {
            updateSectionDots(1, currentDebateSections);
        }
        startConcentrateLoop();

        nsdIntroPlaying = true;
        playNsdPreIntro().then(() => showBulletIntroScreen()).then(() => {
            nsdIntroPlaying = false;
            if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
                startMassPanicDebatePlayback();
            } else {
                // Reveal seating debug for NSD if skill is equipped
                if (mpdSkillSeatingPlanCopy) {
                    const dbgEl = debateOverlay?.querySelector('#dangan-seating-debug');
                    if (dbgEl) dbgEl.style.display = '';
                    updateSeatingDebug('');
                }
                startDebatePlayback(preparedDebateSections);
            }
        });
    }

    function playNsdPreIntro() {
        return new Promise((resolve) => {
            const src = getAssetUrl('nonstop-pre-intro.webm');

            if (debateOverlay) debateOverlay.classList.add('nsd-pre-intro');
            paradeController = startSeatingParade();

            const overlay = document.createElement('div');
            overlay.id = 'dangan-nsd-pre-intro';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 2147483647;
                background: transparent; display: flex;
                align-items: center; justify-content: center;
            `;

            const isMpdIntro = currentState === TrialPhases.MASS_PANIC_DEBATE;
            const tint = document.createElement('div');
            tint.style.cssText = `position: absolute; inset: 0; pointer-events: none;
                background: ${isMpdIntro ? 'rgba(180,0,0,0.35)' : 'rgba(0,100,200,0.35)'};`;

            const video = document.createElement('video');
            video.src = src;
            video.autoplay = true;
            video.playsInline = true;
            video.style.cssText = 'position: relative; width: 100%; height: 100%; object-fit: contain;';

            let done = false;
            function finish() {
                if (done) return;
                done = true;
                video.pause();
                overlay.remove();
                if (debateOverlay) debateOverlay.classList.remove('nsd-pre-intro');
                resolve();
            }

            video.addEventListener('ended', finish);
            video.addEventListener('error', finish);
            overlay.addEventListener('click', e => e.stopPropagation());
            document.addEventListener('keydown', finish, { once: true });

            overlay.appendChild(tint);
            overlay.appendChild(video);
            document.body.appendChild(overlay);

            video.play().catch(finish);
        });
    }

    function showBulletIntroScreen() {
        return new Promise((resolve) => {
            const bullets = getDebateBullets();
            if (!bullets.length) { resolve(); return; }

            let introIdx = selectedTruthBulletIndex;
            let resolved = false;
            let introCylRaf = null;
            let introCylAngle = 0;

            const introEl = document.createElement('div');
            introEl.id = 'dangan-bullet-intro';

            function startIntroCylSpin() {
                if (introCylRaf) return;
                let lastTs = null;
                function tick(now) {
                    const dt = lastTs !== null ? Math.min((now - lastTs) / 1000, 0.1) : 1 / 60;
                    lastTs = now;
                    introCylAngle = (introCylAngle + 20 * dt) % 7200;
                    const img = introEl.querySelector('#dangan-bullet-intro-cyl-img');
                    if (!img) { introCylRaf = null; return; }
                    img.style.transform = `rotate(${introCylAngle}deg)`;
                    introCylRaf = requestAnimationFrame(tick);
                }
                introCylRaf = requestAnimationFrame(tick);
            }

            function stopIntroCylSpin() {
                if (introCylRaf) { cancelAnimationFrame(introCylRaf); introCylRaf = null; }
            }

            // Full-list model: all bullets rendered; active item centered vertically; ">" X offsets by distance
            const INTRO_ACTIVE_X    = 200; // X for the active (tip)
            const INTRO_RETRACTED_X = 150; // X while mid-animation (= dist 1 position)
            const INTRO_STEP_X      = 50;  // px reduction per step away from active
            const SLOT_HEIGHT       = 68;  // item height (54) + gap (14)

            function introItemX(i, activeIdx) {
                const dist = Math.abs(i - activeIdx);
                return Math.max(0, INTRO_ACTIVE_X - dist * INTRO_STEP_X);
            }

            let introAnimTimers = [];
            function clearIntroAnim() {
                introAnimTimers.forEach(clearTimeout);
                introAnimTimers = [];
            }

            function scrollListToActive(idx, animate) {
                const listEl = introEl.querySelector('#dangan-bullet-intro-list');
                if (!listEl) return;
                const containerH = introEl.offsetHeight || window.innerHeight;
                const offsetY = (containerH / 2) - (idx * SLOT_HEIGHT + SLOT_HEIGHT / 2);
                listEl.style.transition = animate ? 'transform 0.14s ease' : 'none';
                listEl.style.transform = `translateY(${offsetY}px)`;
            }

            function renderIntro() {
                const listHtml = bullets.map((b, i) => {
                    const x = introItemX(i, introIdx);
                    return `<div class="dangan-bullet-intro-item${i === introIdx ? ' active' : ''}"
                                 data-idx="${i}" style="--i:${i}; translate:${x}px 0">
                                <span>${b.title || 'Unknown'}</span>
                            </div>`;
                }).join('');

                introEl.innerHTML = `
                    <div id="dangan-bullet-intro-cylinder">
                        <img class="dangan-cyl-line dangan-cyl-line--1" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-1.webp" alt=""/>
                        <img class="dangan-cyl-line dangan-cyl-line--4" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-4.webp" alt=""/>
                        <img class="dangan-cyl-line dangan-cyl-line--2" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-2.webp" alt=""/>
                        <img class="dangan-cyl-line dangan-cyl-line--3" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-3.webp" alt=""/>
                        <img id="dangan-bullet-intro-cyl-img"
                             src="${extensionFolderPath}/assets/images/minigames/danganronpa-2x2-revolver-cylinder.webp" alt=""/>
                    </div>
                    <div id="dangan-bullet-intro-list">${listHtml}</div>
                `;

                scrollListToActive(introIdx, false);
                startIntroCylSpin();
            }

            // direction: +1 = navigate down, -1 = navigate up, 0 = instant (no animation)
            // 3-phase: retract active → update all X offsets + scroll → load new active
            function setActiveItem(idx, direction = 0) {
                clearIntroAnim();
                const items = [...introEl.querySelectorAll('.dangan-bullet-intro-item')];
                const curActive = items.find(el => el.classList.contains('active'));

                if (direction === 0) {
                    items.forEach((item, i) => {
                        item.classList.toggle('active', i === idx);
                        item.style.transition = '';
                        item.style.translate = `${introItemX(i, idx)}px 0`;
                    });
                    scrollListToActive(idx, false);
                    return;
                }

                // Phase 1 — retract current active
                if (curActive) {
                    curActive.classList.remove('active');
                    curActive.style.transition = 'translate 0.12s ease-in';
                    curActive.style.translate = `${INTRO_RETRACTED_X}px 0`;
                }

                // Phase 2 — update X offsets for all items + scroll list to new active
                introAnimTimers.push(setTimeout(() => {
                    items.forEach((item, i) => {
                        const x = i === idx ? INTRO_RETRACTED_X : introItemX(i, idx);
                        item.style.transition = 'translate 0.14s ease';
                        item.style.translate = `${x}px 0`;
                    });
                    scrollListToActive(idx, true);

                    // Phase 3 — extend new active
                    introAnimTimers.push(setTimeout(() => {
                        if (items[idx]) {
                            items[idx].classList.add('active');
                            items[idx].style.transition = 'translate 0.12s ease-out';
                            items[idx].style.translate = `${INTRO_ACTIVE_X}px 0`;
                        }
                    }, 155));
                }, 130));
            }

            function doConfirm() {
                if (resolved) return;
                resolved = true;
                clearIntroAnim();
                document.removeEventListener('keydown', onIntroKey);
                clearTimeout(autoTimer);
                stopIntroCylSpin();
                selectedTruthBulletIndex = introIdx;
                renderCylinder();
                introEl.style.transition = 'opacity 0.35s ease';
                introEl.style.opacity = '0';
                setTimeout(() => {
                    introEl.remove();
                    // Fade in HUD elements after intro is gone
                    introHiddenEls.forEach(el => {
                        el.style.display = el.dataset.introDisplay ?? '';
                        delete el.dataset.introDisplay;
                        el.style.opacity = '0';
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            el.style.transition = 'opacity 0.3s ease';
                            el.style.opacity = '';
                        }));
                    });
                    setTimeout(() => {
                        introHiddenEls.forEach(el => { el.style.transition = ''; });
                    }, 320);
                    resolve();
                }, 370);
            }

            function onIntroKey(e) {
                // Block these keys entirely during the intro — stop them reaching the NSD listener
                if (e.key === 'Tab' || e.key === 'Escape' || e.code === 'ShiftLeft') {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    introIdx = (introIdx - 1 + bullets.length) % bullets.length;
                    setActiveItem(introIdx, -1);
                    playSfx?.('tbcycle');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    introIdx = (introIdx + 1) % bullets.length;
                    setActiveItem(introIdx, +1);
                    playSfx?.('tbcycle');
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    doConfirm();
                }
            }

            // Hide NSD HUD elements that shouldn't show during the intro
            const introHiddenEls = [
                '.dangan-trial-top-left',
                '.dangan-trial-bottom-left',
                '#dangan-concentrate-stars',
                '#dangan-nsd-hearts',
                '#dangan-nsd-status-bar',
                '#dangan-nsd-timer-wrap',
            ].map(sel => debateOverlay?.querySelector(sel)).filter(Boolean);
            introHiddenEls.forEach(el => { el.dataset.introDisplay = el.style.display; el.style.display = 'none'; });

            renderIntro();

            if (debateOverlay) debateOverlay.appendChild(introEl);
            else document.body.appendChild(introEl);

            // Prevent clicks on the intro from firing truth bullets on the overlay behind it
            introEl.addEventListener('click', e => e.stopPropagation());

            introEl.style.opacity = '0';
            requestAnimationFrame(() => requestAnimationFrame(() => {
                introEl.style.transition = 'opacity 0.3s ease';
                introEl.style.opacity = '1';
            }));

            document.addEventListener('keydown', onIntroKey);
            const autoTimer = setTimeout(() => doConfirm(), 6000);
        });
    }

    function renderCylinder() {
        const container = document.getElementById('dangan-truth-bullet-cylinder');
        if (!container) return;

        // Cancel any running spin RAF before replacing innerHTML — the old img element
        // will be destroyed, and the RAF closure holds a stale reference to it.
        if (revolverSpinRaf) { cancelAnimationFrame(revolverSpinRaf); revolverSpinRaf = null; }

        const bullets = getDebateBullets();
        const n = bullets.length;
        const cur = bullets[selectedTruthBulletIndex];
        const above = bullets[((selectedTruthBulletIndex - 1) + n) % n];
        const below = bullets[(selectedTruthBulletIndex + 1) % n];

        const bulletNumber = cur?.isTemporary ? 'XX' : String(selectedTruthBulletIndex + 1).padStart(2, '0');

        container.innerHTML = `
            <div class="dangan-cylinder-wrap">
                <img class="dangan-cyl-line dangan-cyl-line--1" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-1.webp" alt=""/>
                <img class="dangan-cyl-line dangan-cyl-line--4" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-4.webp" alt=""/>
                <img class="dangan-cyl-line dangan-cyl-line--2" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-2.webp" alt=""/>
                <img class="dangan-cyl-line dangan-cyl-line--3" src="${extensionFolderPath}/assets/images/minigames/cylinder-lines-3.webp" alt=""/>
                <img id="dangan-cylinder-img" class="dangan-cylinder-img"
                     src="${extensionFolderPath}/assets/images/minigames/danganronpa-2x2-revolver-cylinder.webp" alt=""/>
                <div class="dangan-cylinder-index">${bulletNumber}</div>
            </div>
            <img class="dangan-tb-bar-bg" src="${extensionFolderPath}/assets/classtrial/truth-bullets-bar.png" alt="" draggable="false"/>
            <div class="dangan-bullet-cartridge dangan-bullet-cartridge--adj dangan-bullet-cartridge--above">
                <span class="dangan-bullet-cartridge-name">${above?.title || ''}</span>
            </div>
            <div class="dangan-bullet-cartridge dangan-bullet-cartridge--active">
                <span class="dangan-bullet-cartridge-name">${cur?.title || 'NO BULLETS'}</span>
            </div>
            <div class="dangan-bullet-cartridge dangan-bullet-cartridge--adj dangan-bullet-cartridge--below">
                <span class="dangan-bullet-cartridge-name">${below?.title || ''}</span>
            </div>
        `;

        applyCartridgeTheme(speedModifier);
        startRevolverSpin();
    }

    function showAdjacentBullets() {
        clearTimeout(adjacentHideTimer);
        document.querySelectorAll('.dangan-bullet-cartridge--adj').forEach(el => {
            el.style.transition = 'opacity 0.15s ease';
            el.style.opacity = '1';
        });
        adjacentHideTimer = setTimeout(() => {
            document.querySelectorAll('.dangan-bullet-cartridge--adj').forEach(el => {
                el.style.transition = 'opacity 0.4s ease';
                el.style.opacity = '0';
            });
        }, 1500);
    }

    function startRevolverSpin() {
        const BASE_SPIN_DEG_S = 20; // degrees per second at normal speed
        let lastTs = null;
        const img = document.getElementById('dangan-cylinder-img'); // cache once
        if (!img) return;
        function tick(now) {
            if (!img.isConnected) { revolverSpinRaf = null; return; }
            const dt  = lastTs !== null ? Math.min((now - lastTs) / 1000, 0.1) : 1 / 60;
            lastTs = now;
            const mod = speedModifier > 1.0 ? 2.0 : speedModifier < 1.0 ? 0.5 : 1.0;
            revolverTarget += BASE_SPIN_DEG_S * mod * dt;
            // Frame-rate-independent lerp: equivalent to 0.1 per frame at 60 fps
            revolverAngle += (revolverTarget - revolverAngle) * (1 - Math.pow(0.9, dt * 60));
            img.style.transform = `skewX(8deg) skewY(14deg) rotate(${revolverAngle}deg)`;
            revolverSpinRaf = requestAnimationFrame(tick);
        }
        revolverSpinRaf = requestAnimationFrame(tick);
    }

    function startDebatePlayback(prepared) {
        paradeController?.stop();
        paradeController = null;
        if (playbackTimerId) window.clearTimeout(playbackTimerId);
        playbackTimerId = null;

        debateSectionsActive = buildFallbackSectionsIfNeeded(prepared);
        if (!debateSectionsActive?.length) return;

        debateSectionIndex = 0;
        debatePartIndex = 0;
        playNextChunk();
    }

    // ── Mass Panic Debate playback ────────────────────────────────────────────

    function injectMpdOverlayElements() {
        if (!debateOverlay) return;
        debateOverlay.classList.add('mpd-active');
        for (let col = 0; col < 3; col++) {
            const colEl = document.createElement('div');
            colEl.id        = `mpd-col-${col}`;
            colEl.className = 'mpd-column';
            colEl.style.left = `${(col * 100 / 3).toFixed(4)}%`;
            const chain = document.createElement('div');
            chain.id        = `mpd-chain-${col}`;
            chain.className = 'mpd-chain-overlay';
            colEl.appendChild(chain);
            debateOverlay.appendChild(colEl);
        }
        for (let i = 1; i < 3; i++) {
            const div = document.createElement('div');
            div.className = 'mpd-col-divider';
            div.style.left = `${(i * 100 / 3).toFixed(4)}%`;
            debateOverlay.appendChild(div);
        }
        const crimson = document.createElement('div');
        crimson.id = 'mpd-crimson';
        debateOverlay.appendChild(crimson);

        const counter = document.createElement('div');
        counter.id = 'mpd-chain-counter';
        debateOverlay.appendChild(counter);

        const seatingDbgEl = debateOverlay.querySelector('#dangan-seating-debug');
        if (seatingDbgEl) seatingDbgEl.style.display = 'none';

        const speakerEl = debateOverlay.querySelector('#dangan-speaker-name');
        if (speakerEl) speakerEl.textContent = 'INAUDIBLE';
    }

    async function startMassPanicDebatePlayback() {
        paradeController?.stop();
        paradeController = null;
        if (!mpdScenarios?.length) return;
        const speakerEl = debateOverlay?.querySelector('#dangan-speaker-name');
        if (speakerEl) speakerEl.textContent = 'INAUDIBLE';

        // Seating Plan Copy — reveal debug seating circle and allow Tab
        if (mpdSkillSeatingPlanCopy) {
            const seatingDbgEl = debateOverlay?.querySelector('#dangan-seating-debug');
            if (seatingDbgEl) seatingDbgEl.style.display = '';
            debateOverlay?.classList.add('mpd-seating-copy');
            updateSeatingDebug('');
        }

        // Beta Block — pre-show the chain counter with the full break count
        if (mpdSkillBetaBlock) mpdUpdateChainCounter();
        const total = mpdScenarios.length;
        let i = 0;
        while (currentState === TrialPhases.MASS_PANIC_DEBATE) {
            updateSectionDots((i % total) + 1, total);
            await mpdPlayScenario(mpdScenarios[i % total]);
            if (currentState !== TrialPhases.MASS_PANIC_DEBATE) break;
            await new Promise(r => setTimeout(r, 850));
            i++;
        }
    }

    async function mpdPlayScenario(scenario) {
        // Cancel any running column animations
        for (let c = 0; c < 3; c++) {
            try { mpdColAnims[c]?.cancel(); } catch {}
            mpdColAnims[c] = null;
            mpdColEls[c]?.remove();
            mpdColEls[c] = null;
        }
        mpdWeakPointEl = null;
        debateOverlay?.querySelectorAll('.mpd-statement').forEach(el => el.remove());

        if (mpdLockTimer) { clearTimeout(mpdLockTimer); mpdLockTimer = null; }
        if (Math.random() < MPD_LOCK_CHANCE_PER_SCENARIO) {
            const delay = Math.random() * 2200 + 600;
            mpdLockTimer = setTimeout(() => mpdTriggerLock(), delay);
        }

        updateMpdPortraits(scenario);

        const promises = (scenario.texts || []).slice(0, 3).map((textData, col) =>
            showMpdStatementInColumn(col, textData)
        );
        await Promise.all(promises);

        if (mpdLockTimer) { clearTimeout(mpdLockTimer); mpdLockTimer = null; }
        if (mpdLockActive) mpdBreakLock();
    }

    // Column-scoped copy of showStatementChunk — positions statement in column `col`,
    // uses per-column element/animation tracking, same NSD visual flair throughout.
    function showMpdStatementInColumn(col, { text, isWeakPoint, whiteNoise, speaker, emotion }) {
        if (!debateOverlay) return Promise.resolve();

        // Cancel any existing animation in this column
        if (mpdColAnims[col]) {
            try { mpdColAnims[col].cancel(); } catch {}
            mpdColAnims[col] = null;
        }
        if (mpdColEls[col]) {
            mpdColEls[col].remove();
            mpdColEls[col] = null;
        }

        const w  = window.innerWidth  || 1200;
        const h  = window.innerHeight || 800;
        const cw = Math.floor(w / 3);

        const el = document.createElement('div');
        el.className = 'dangan-floating-statement mpd-statement';
        el.style.width = `${Math.round(cw * 0.82)}px`;
        if (speaker) el.dataset.speakerName = String(speaker);
        const emoFont = getEmotionFont?.(emotion, speaker);
        if (emoFont) el.style.fontFamily = emoFont;

        const rawText    = stripSurroundingQuotes(String(text || ''));
        const hasAgreeText = /\(\([^)]+\)\)/.test(rawText);
        const cleanedText = rawText.replace(/\[\[|\]\]/g, '').replace(/\(\(|\)\)/g, '');

        if (isWeakPoint || hasAgreeText) {
            let html = '', lastIndex = 0;
            // Mutual exclusivity: if agree marker present, strip any weak point brackets first
            let renderText = rawText;
            if (hasAgreeText && /\[\[[^\]]+\]\]/.test(renderText)) {
                renderText = renderText.replace(/\[\[\s*([^\]]+?)\s*\]\]/g, '$1');
            }
            const tokenRegex = /\[\[\s*([^\]]+?)\s*\]\]|\(\(\s*([^)]+?)\s*\)\)/gi;
            let match;
            while ((match = tokenRegex.exec(renderText)) !== null) {
                html += escapeHtml(renderText.slice(lastIndex, match.index));
                if (match[1] !== undefined) {
                    html += `<span class="dangan-weak-point mpd-weak-point">${escapeHtml(match[1].trim())}</span>`;
                } else {
                    html += `<span class="dangan-agree-text">${escapeHtml(match[2].trim())}</span>`;
                }
                lastIndex = match.index + match[0].length;
            }
            html += escapeHtml(renderText.slice(lastIndex));
            el.innerHTML = html;
        } else {
            el.textContent = cleanedText;
        }

        debateOverlay.appendChild(el);
        mpdColEls[col] = el;

        if (isWeakPoint) {
            const wp = el.querySelector('.mpd-weak-point');
            mpdWeakPointEl = wp ?? el;
        }

        // ── Column-centred positioning (mirrors showStatementChunk) ──────────
        const colCenterX = col * cw + Math.round(cw / 2);
        const centerY    = Math.round(h * 0.50);
        const laneY      = h * (0.30 + Math.random() * 0.38);
        const startX     = colCenterX + Math.round(Math.random() * 24 - 12);
        const startY     = centerY + Math.round(Math.random() * 36 - 18) + Math.round((laneY - centerY) * 0.15);

        // ── White noise (same patterns, scaled to column width) ───────────────
        const WN_PATTERNS = [
            {
                name: 'random',
                count: () => Math.floor(Math.random() * 5) + 1,
                offsets: null,
                noRotation: false,
            },
            {
                name: 'asterisk',
                count: () => 3,
                offsets: (i) => {
                    const angle = (i * 120 - 90) * (Math.PI / 180);
                    const r = 80;
                    return { x: Math.round(Math.cos(angle) * r), y: Math.round(Math.sin(angle) * r) };
                },
                noRotation: true,
            },
        ];

        const wnPattern  = (isWeakPoint && whiteNoise)
            ? WN_PATTERNS[Math.floor(Math.random() * WN_PATTERNS.length)]
            : null;

        const motionMode = Math.random() < 0.18 ? 'pov' : 'drift';
        const dir        = Math.random() < 0.5 ? -1 : 1;
        const driftX     = dir * Math.round(cw * 0.11);
        const rotStart   = wnPattern?.noRotation ? 0 : (Math.random() * 24 - 12);
        const rotSpeed   = wnPattern?.noRotation ? 0 : (Math.random() * 14 - 7);
        const endX       = startX + driftX;
        const endY       = startY + (motionMode === 'drift' ? Math.round(Math.random() * 16 - 8) : Math.round(Math.random() * 10 - 5));
        const duration   = motionMode === 'drift'
            ? (6600 + Math.floor(Math.random() * 1500))
            : (1800 + Math.floor(Math.random() * 450));

        let rafId     = 0;
        let cancelled = false;
        let lastNow   = performance.now();
        let elapsed   = 0;
        const isScreaming = isAllCapsLine(el.textContent);

        if (wnPattern) {
            const count = wnPattern.count();
            for (let i = 0; i < count; i++) {
                const wnText = whiteNoise[i % whiteNoise.length];
                spawnWhiteNoise(wnText, startX, startY, wnPattern.offsets ? wnPattern.offsets(i) : null);
            }
        }

        return new Promise(resolve => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                if (mpdColEls[col] === el)   mpdColEls[col]   = null;
                if (mpdColAnims[col] === anim) mpdColAnims[col] = null;
                resolve();
            };

            const frame = (now) => {
                if (cancelled || currentState !== TrialPhases.MASS_PANIC_DEBATE || mpdColEls[col] !== el) {
                    finish(); return;
                }

                const dt    = Math.min(now - lastNow, 100);
                const delta = dt * speedModifier;
                lastNow  = now;
                elapsed += delta;

                const p     = Math.max(0, Math.min(1, elapsed / duration));
                const x     = startX + (endX - startX) * p;
                const y     = startY + (endY - startY) * p;
                const peak  = 1 - Math.abs(p - 0.5) * 2;
                const rot   = rotStart + (elapsed / 1000) * rotSpeed;
                const skew  = dir * -10;
                const scale = motionMode === 'pov' ? (0.92 + 0.28 * peak) : 1;

                let opacity = 1;
                if (p < 0.12) opacity = p / 0.12;
                else if (p > 0.86) opacity = Math.max(0, (1 - p) / 0.14);

                el.style.opacity = String(opacity);
                const shake  = isScreaming ? (Math.sin(now / 28) * 2.2) : 0;
                const shakeY = isScreaming ? (Math.cos(now / 24) * 1.6) : 0;
                el.style.transform = `translate(${x + shake}px, ${y + shakeY}px) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;

                if (p >= 1) {
                    el.remove();
                    finish(); return;
                }
                rafId = requestAnimationFrame(frame);
            };

            const anim = {
                cancel: () => {
                    cancelled = true;
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = 0;
                    el.remove();
                    finish();
                },
            };
            mpdColAnims[col] = anim;
            rafId = requestAnimationFrame(frame);
        });
    }

    function updateMpdPortraits(_scenario) {
        if (typeof getSpriteUrl !== 'function') return;
        // Speakers are locked in at debate start — never re-read from scenario
        const [col0Name, col1Name, col2Name] = mpdColumnSpeakers;
        applyPortraitHeights(col1Name, col0Name, col2Name);
        const tok = ++portraitToken;
        const loadImg = async (el, name) => {
            if (!el || !name) return;
            if (isCharacterMissing(name)) { el.style.display = 'none'; return; }
            try {
                const emo = isCharacterDead(name) || isSilenced(name) ? 'dead' : 'anger';
                let url = await getCharSpriteUrl(name, emo).catch(() => null);
                if (!url && emo === 'anger') url = await getCharSpriteUrl(name, 'neutral').catch(() => null);
                if (tok !== portraitToken || !url || !el) return;
                el.src = url; el.style.display = 'block';
                el.style.filter = '';
            } catch {}
        };
        loadImg(portraitLeftEl,  col0Name);
        loadImg(portraitImgEl,   col1Name);
        loadImg(portraitRightEl, col2Name);
    }

    async function mpdSwapColumnEmotion(col, emotion) {
        if (typeof getSpriteUrl !== 'function') return;
        const name = mpdColumnSpeakers[col];
        if (!name || isCharacterDead(name) || isSilenced(name)) return;
        const els = [portraitLeftEl, portraitImgEl, portraitRightEl];
        const el = els[col];
        if (!el) return;
        const tok = ++portraitToken;
        const url = await getCharSpriteUrl(name, emotion).catch(() => null)
            ?? await getCharSpriteUrl(name, 'neutral').catch(() => null);
        if (tok !== portraitToken || !url || !el) return;
        el.src = url;
    }

    function mpdTriggerLock() {
        if (mpdLockActive || currentState !== TrialPhases.MASS_PANIC_DEBATE) return;
        mpdLockActive      = true;
        mpdFreeColumn      = Math.floor(Math.random() * 3);
        mpdChainBreakCount = 0;
        mpdUpdateChainOverlays();
        mpdUpdateChainCounter();
        new Audio(`${extensionFolderPath}/assets/sfx/trial/locking-column.wav`).play().catch(() => {});
        playSfx?.('chain_trigger');
        void mpdSwapColumnEmotion(mpdFreeColumn, 'disgust');

        // Column lock VFX: zoom+shake portrait img of the free (shootable) column
        const _focusEls = [portraitLeftEl, portraitImgEl, portraitRightEl];
        if (_focusEls[mpdFreeColumn]) _focusEls[mpdFreeColumn].classList.add('mpd-col-focus');

        // Speed-lines radiating from centre of the free column
        const _colDiv = debateOverlay?.querySelector(`#mpd-col-${mpdFreeColumn}`);
        if (_colDiv) {
            const slWrap = document.createElement('div');
            slWrap.className = 'mpd-col-speedlines';
            for (let i = 0; i < 36; i++) {
                const sl = document.createElement('div');
                sl.className = 'mpd-col-speedline';
                sl.style.setProperty('--sl-angle', `${(i / 36 * 360).toFixed(1)}deg`);
                sl.style.setProperty('--sl-h',     `${1 + Math.round(Math.random() * 2)}px`);
                sl.style.setProperty('--sl-gap',   `${(14 + Math.random() * 10).toFixed(0)}%`);
                sl.style.setProperty('--sl-delay', `${(Math.random() * 0.45).toFixed(2)}s`);
                slWrap.appendChild(sl);
            }
            _colDiv.appendChild(slWrap);
        }
    }

    function mpdBreakLock() {
        mpdLockActive      = false;
        mpdFreeColumn      = -1;
        mpdChainBreakCount = 0;
        mpdUpdateChainOverlays();
        mpdUpdateChainCounter();
        playSfx?.('chain_broken');

        // Clean up column lock VFX
        debateOverlay?.querySelectorAll('.mpd-col-focus').forEach(el => el.classList.remove('mpd-col-focus'));
        debateOverlay?.querySelectorAll('.mpd-col-speedlines').forEach(el => el.remove());
        for (let c = 0; c < 3; c++) {
            const colEl = debateOverlay?.querySelector(`#mpd-col-${c}`);
            if (!colEl) continue;
            colEl.classList.add('mpd-chain-break-flash');
            setTimeout(() => colEl.classList.remove('mpd-chain-break-flash'), 450);
            void mpdSwapColumnEmotion(c, 'anger');
        }
    }

    function mpdUpdateChainOverlays() {
        const portraitSlots = [
            debateOverlay?.querySelector('.dangan-portrait-left-slot'),
            debateOverlay?.querySelector('.dangan-portrait-center-slot'),
            debateOverlay?.querySelector('.dangan-portrait-right-slot'),
        ];
        for (let c = 0; c < 3; c++) {
            const chain = debateOverlay?.querySelector(`#mpd-chain-${c}`);
            if (!chain) continue;
            const locked = mpdLockActive && c !== mpdFreeColumn;
            chain.classList.toggle('active', locked);
            portraitSlots[c]?.classList.toggle('mpd-locked', locked);
            const colEl = debateOverlay?.querySelector(`#mpd-col-${c}`);
            colEl?.classList.toggle('mpd-key-col', mpdLockActive && c === mpdFreeColumn);
        }
        if (reticleEl) reticleEl.dataset.locked = mpdLockActive ? '1' : '0';
    }

    function mpdUpdateChainCounter() {
        const counter = debateOverlay?.querySelector('#mpd-chain-counter');
        if (!counter) return;
        // Without Beta Block, or when no lock is active, never show the counter
        if (!mpdSkillBetaBlock || !mpdLockActive) { counter.style.display = 'none'; return; }
        // Lock is active: show remaining breaks needed above the free column
        const cw = window.innerWidth / 3;
        const cx = mpdFreeColumn * cw + cw / 2;
        counter.style.left    = `${cx}px`;
        counter.style.display = 'block';
        counter.textContent   = String(mpdBreaksNeeded() - mpdChainBreakCount);
    }

    function mpdOnRPress() {
        if (nsdIntroPlaying) return;
        if (mpdLockActive) {
            const col = Math.max(0, Math.min(2, Math.floor((lastCursorX / window.innerWidth) * 3)));
            if (col !== mpdFreeColumn) {
                // Cursor is in a locked column — block and give feedback
                mpdShowBlockedFeedback(col);
                return;
            }
            // Cursor in the free column — fire WN and count chain break
            playSfx?.('wn_shooting');
            showWnPressFlash();
            showWnBurst(lastCursorX, lastCursorY);
            if (hoveredWhiteNoise) hitWhiteNoise(hoveredWhiteNoise);
            mpdChainBreakCount++;
            mpdUpdateChainCounter();
            if (mpdChainBreakCount >= mpdBreaksNeeded()) mpdBreakLock();
        } else {
            // No lock — fire normally
            playSfx?.('wn_shooting');
            showWnPressFlash();
            showWnBurst(lastCursorX, lastCursorY);
            if (hoveredWhiteNoise) hitWhiteNoise(hoveredWhiteNoise);
        }
    }

    function clearMpdRTimers() {
        clearTimeout(mpdRTapTimer);
        clearInterval(mpdRRepeatTimer);
        mpdRTapTimer   = null;
        mpdRRepeatTimer = null;
        mpdRHeld        = false;
    }

    function mpdShowBlockedFeedback(col) {
        const chain = debateOverlay?.querySelector(`#mpd-chain-${col}`);
        if (!chain) return;
        chain.classList.add('mpd-blocked-flash');
        setTimeout(() => chain.classList.remove('mpd-blocked-flash'), 280);
    }

    // ── End Mass Panic Debate ─────────────────────────────────────────────────

    function buildFallbackSectionsIfNeeded(prepared) {
        if (Array.isArray(prepared) && prepared.length) return prepared;

        console.warn('[Dangan][Trial] No generated debate lines found, using fallback placeholder.');
        
        // Return a single section with a generic line instead of regular chat history
        const fallbackText = 'Dialogue generation [[failed]]... Check your API connection or logs.';
        const chunks = splitIntoChunks(fallbackText);
        
        const sections = [{
            speakerName: 'System',
            statement: fallbackText,
            parts: chunks.map(t => {
                const hasMarker = t.includes('[[') && t.includes(']]');
                return {
                    text: t.replace(/\[\[|\]\]/g, ''),
                    isWeakPoint: hasMarker,
                    weakMarkup: hasMarker ? t.match(/\[\[(.*?)\]\]/)?.[1] : null,
                };
            })
        }];
        return sections;
    }

    function getLaneY(partIndex) {
        const base = Math.round((window.innerHeight || 800) * 0.58);
        const offsets = [-70, 0, 70];
        return base + offsets[Math.abs(partIndex) % offsets.length];
    }

    function updateSectionDots(current, total) {
        const el = document.getElementById('dangan-section-dots');
        if (!el) return;
        el.innerHTML = '';
        for (let i = 1; i <= total; i++) {
            const dot = document.createElement('span');
            dot.className = 'dangan-section-dot' + (i === current ? ' dangan-section-dot-active' : '');
            el.appendChild(dot);
        }
    }

    function updateSeatingDebug(speakerName) {
        const el = document.getElementById('dangan-seating-debug');
        if (!el || !debateSeatingPlan?.length) return;
        lastSeatingDebugSpeaker = speakerName;

        const plan = debateSeatingPlan;
        const n    = plan.length;
        const si   = findSeatIndex(speakerName);
        const li   = si >= 0 ? (si - 1 + n) % n : -1;
        const ri   = si >= 0 ? (si + 1) % n     : -1;

        const dotStyle = (i) => {
            if (i === si) return { dot: '#00ffff', txt: '#00ffff', r: 5, bold: 'bold' };
            if (i === li || i === ri) return { dot: '#ff69b4', txt: '#ff85c2', r: 4, bold: 'bold' };
            return { dot: 'rgba(100,180,100,0.35)', txt: 'rgba(160,220,160,0.45)', r: 2.5, bold: 'normal' };
        };

        const label = (name) => (name.split(' ')[0] || name).substring(0, 8);

        if (seatingDebugMode === 'circle') {
            const size = 340, cx = 170, cy = 170, rDot = 100, rTxt = 118;
            const parts = [
                `<circle cx="${cx}" cy="${cy}" r="${rDot}" fill="none" stroke="rgba(0,255,255,0.12)" stroke-width="1" stroke-dasharray="3 3"/>`,
            ];
            for (let i = 0; i < n; i++) {
                const angle = (2 * Math.PI * i / n) - Math.PI / 2;
                const dx = Math.cos(angle), dy = Math.sin(angle);
                const dotX = (cx + rDot * dx).toFixed(1);
                const dotY = (cy + rDot * dy).toFixed(1);
                const txtX = (cx + rTxt * dx).toFixed(1);
                const txtY = (cy + rTxt * dy).toFixed(1);
                const s = dotStyle(i);
                parts.push(`<circle cx="${dotX}" cy="${dotY}" r="${s.r}" fill="${s.dot}"/>`);
                parts.push(`<text x="${txtX}" y="${txtY}" text-anchor="middle" dominant-baseline="middle" fill="${s.txt}" font-size="7.5" font-family="monospace" font-weight="${s.bold}">${label(plan[i])}</text>`);
            }
            el.innerHTML = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
        } else {
            // Flat line mode
            const dotSpacing = 56;
            const dotCY = 14;
            const txtY  = 26;
            const svgW  = Math.max(dotSpacing * n + 8, 60);
            const svgH  = 42;
            const parts = [
                `<line x1="14" y1="${dotCY}" x2="${svgW - 14}" y2="${dotCY}" stroke="rgba(0,255,255,0.12)" stroke-width="1" stroke-dasharray="3 3"/>`,
            ];
            for (let i = 0; i < n; i++) {
                const cx = 14 + i * dotSpacing;
                const s  = dotStyle(i);
                parts.push(`<circle cx="${cx}" cy="${dotCY}" r="${s.r}" fill="${s.dot}"/>`);
                parts.push(`<text x="${cx}" y="${txtY}" text-anchor="middle" dominant-baseline="hanging" fill="${s.txt}" font-size="7" font-family="monospace" font-weight="${s.bold}">${label(plan[i])}</text>`);
            }
            el.innerHTML = `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
        }
    }

    function playNextChunk() {
        if (currentState !== TrialPhases.NON_STOP_DEBATE) return;
        if (!debateSectionsActive?.length) return;

        const section = debateSectionsActive[debateSectionIndex % debateSectionsActive.length];
        const speakerName = section?.speakerName || '???';
        const parts = Array.isArray(section?.parts) ? section.parts : [];
        if (!parts.length) return;

        const part = parts[debatePartIndex % parts.length];

        const speakerEl = document.getElementById('dangan-speaker-name');
        if (speakerEl) speakerEl.textContent = String(speakerName).split(' ')[0].toUpperCase();
        updateSectionDots((debateSectionIndex % currentDebateSections) + 1, currentDebateSections);

        const emotion = part?.emotion || inferEmotionFromText(part?.text);
        const prevSpeaker = portraitSpeaker; // capture before updateDebatePortraits sets it
        void updateDebatePortraits(speakerName, emotion);
        updateSeatingDebug(speakerName);

        // Parade-scroll to the new speaker on section change (NSD only, not MPD)
        if (prevSpeaker !== null && prevSpeaker !== speakerName) {
            startSpeakerShiftParade(prevSpeaker, speakerName, emotion);
        }

        showStatementChunk({
            text: part.text,
            isWeakPoint: Boolean(part.isWeakPoint),
            laneY: getLaneY(debatePartIndex),
            weakMarkup: part.weakMarkup,
            whiteNoise: part.isWeakPoint ? (section.whiteNoise || null) : null,
            speakerName,
            emotion,
        }).then(() => {
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;
            debatePartIndex++;
            if (debatePartIndex >= parts.length) {
                debatePartIndex = 0;
                debateSectionIndex = (debateSectionIndex + 1) % currentDebateSections;
            }
            playbackTimerId = window.setTimeout(playNextChunk, 1200);
        });
    }

    const REALIZATION_SHOTS = ['b', 'd', 'e'];
    let realizationShotIdx = 0;

    const EMOTION_FX = {
        realization: (elements) => {
            const flash = document.createElement('div');
            flash.className = 'dangan-emotion-flash-white';
            document.body.appendChild(flash);
            flash.addEventListener('animationend', () => flash.remove(), { once: true });
            const shot = REALIZATION_SHOTS[realizationShotIdx % REALIZATION_SHOTS.length];
            realizationShotIdx++;
            applySpecificCamShot(shot, ...elements);
        },
    };

    function triggerEmotionFx(emotion, ...elements) {
        EMOTION_FX[emotion?.toLowerCase?.()]?.(elements);
    }

    function applySpecificCamShot(shot, ...elements) {
        const valid = elements.filter(Boolean);
        if (!valid.length) return;
        console.log(`[Dangan][Trial] camera shot: ${String(shot || '').toUpperCase()}`);
        for (const el of valid) for (const s of CAM_SHOTS) el.classList.remove(`dangan-portrait-cam-${s}`);
        void valid[0].offsetWidth;
        for (const el of valid) el.classList.add(`dangan-portrait-cam-${shot}`);
    }

    function applyCamShot(...elements) {
        // Random shot, but never the same letter twice in a row.
        let shot;
        if (CAM_SHOTS.length <= 1) {
            shot = CAM_SHOTS[0];
        } else {
            do {
                shot = CAM_SHOTS[Math.floor(Math.random() * CAM_SHOTS.length)];
            } while (shot === lastCamShot);
        }
        lastCamShot = shot;
        applySpecificCamShot(shot, ...elements);
    }

    async function updateDebatePortraits(speakerName, emotion) {
        const name = String(speakerName || '').trim();
        if (!name) return;
        const emo = String(emotion || '').trim().toLowerCase() || 'neutral';

        const speakerChanged = portraitSpeaker !== name;
        if (!speakerChanged && portraitEmotion === emo) return;

        // Persist outgoing speaker's last emotion before switching
        if (speakerChanged && portraitSpeaker) {
            characterEmotions.set(portraitSpeaker, portraitEmotion || 'neutral');
        }

        portraitSpeaker = name;
        portraitEmotion = emo;

        const mono = isMonokuma(name);
        const { left: leftName, right: rightName } = getSeatingNeighbors(name);
        // Monokuma appears solo: no neighbours, no lectern
        const effectiveLeft  = mono ? null : leftName;
        const effectiveRight = mono ? null : rightName;
        const token = ++portraitToken;

        if (speakerChanged) {
            const centerLectern = debateOverlay?.querySelector('.dangan-portrait-center-slot .dangan-portrait-lectern');
            if (centerLectern) centerLectern.style.display = mono ? 'none' : '';
        }

        if (typeof getSpriteUrl !== 'function') {
            [portraitImgEl, portraitLeftEl, portraitRightEl].forEach(el => { if (el) el.style.display = 'none'; });
            return;
        }

        const updateImg = async (el, charName, emoLabel) => {
            if (!el) return;
            if (!charName) { el.style.display = 'none'; return; }
            if (isCharacterMissing(charName)) { el.style.display = 'none'; return; }
            try {
                const dead = isCharacterDead(charName) || isSilenced(charName);
                let url = null;
                const grayscale = false;
                if (dead) {
                    url = await getCharSpriteUrl(charName, 'dead').catch(() => null);
                } else {
                    url = await getCharSpriteUrl(charName, emoLabel);
                }
                if (token !== portraitToken) return;
                if (!url) { el.style.display = 'none'; return; }
                el.src = url;
                el.style.display = 'block';
                el.style.filter = grayscale ? 'grayscale(1) brightness(0.6)' : '';
                // Store under both normalized full-name and first-token so lookups succeed
                // even when the NSD speaker name ("Sonia") differs from the GCP slot name ("Sonia Nevermind")
                characterSpriteUrls.set(normalizeSeatName(charName), url);
                characterSpriteUrls.set(firstToken(charName), url);
            } catch {
                if (token !== portraitToken) return;
                el.style.display = 'none';
            }
        };

        const updates = [updateImg(portraitImgEl, name, emo)];
        const sceneEls = [
            debateOverlay?.querySelector('.dangan-trial-portrait-stage'),
            debateOverlay?.querySelector('#dangan-nsd-speedlines'),
        ];
        if (speakerChanged) {
            applyCamShot(...sceneEls);
            const leftEmo  = characterEmotions.get(effectiveLeft)  || 'neutral';
            const rightEmo = characterEmotions.get(effectiveRight) || 'neutral';
            applyPortraitHeights(name, effectiveLeft, effectiveRight);
            updates.push(updateImg(portraitLeftEl,  effectiveLeft,  leftEmo));
            updates.push(updateImg(portraitRightEl, effectiveRight, rightEmo));
        }
        triggerEmotionFx(emo, ...sceneEls);
        await Promise.all(updates);
    }

    function showStatementChunk({ text, isWeakPoint, laneY, weakMarkup, whiteNoise, speakerName, emotion }) {
        if (!debateOverlay) return Promise.resolve();

        if (playbackTimerId) window.clearTimeout(playbackTimerId);
        playbackTimerId = null;

        if (statementAnimation) {
            try { statementAnimation.cancel(); } catch {}
            statementAnimation = null;
        }
        if (statementEl) {
            statementEl.remove();
            statementEl = null;
        }
        currentWeakPointInfo = null;
        clearAllWhiteNoise();

        const el = document.createElement('div');
        el.className = 'dangan-floating-statement dangan-statement-single';
        const w = window.innerWidth || 1200;
        el.style.width = `${Math.min(Math.round(w * 0.82), 980)}px`;
        if (speakerName) el.dataset.speakerName = String(speakerName);
        const emoFont = getEmotionFont?.(emotion, speakerName);
        if (emoFont) el.style.fontFamily = emoFont;
        const rawText = stripSurroundingQuotes(String(text || ''));
        const hasAgreeText = /\(\([^)]+\)\)/.test(rawText);
        const cleanedText = rawText.replace(/\[\[|\]\]/g, '').replace(/\(\(|\)\)/g, '');

        if (isWeakPoint || hasAgreeText) {
            // Walk the raw text, escape each plain segment once, wrap weak spans once.
            // Never call escapeHtml twice on the same content (avoids &amp;amp; etc.).
            let html = '';
            let lastIndex = 0;
            // Mutual exclusivity: if agree marker present, strip any weak point brackets first
            let renderText = rawText;
            if (hasAgreeText && /\[\[[^\]]+\]\]/.test(renderText)) {
                renderText = renderText.replace(/\[\[\s*([^\]]+?)\s*\]\]/g, '$1');
            }
            const tokenRegex = /\[\[\s*([^\]]+?)\s*\]\]|\(\(\s*([^)]+?)\s*\)\)/gi;
            let match;
            while ((match = tokenRegex.exec(renderText)) !== null) {
                html += escapeHtml(renderText.slice(lastIndex, match.index));
                if (match[1] !== undefined) {
                    html += `<span class="dangan-weak-point">${escapeHtml(match[1].trim())}</span>`;
                } else {
                    html += `<span class="dangan-agree-text">${escapeHtml(match[2].trim())}</span>`;
                }
                lastIndex = match.index + match[0].length;
            }
            html += escapeHtml(renderText.slice(lastIndex));
            el.innerHTML = html;
        } else {
            el.textContent = cleanedText;
        }
        debateOverlay.appendChild(el);

        if (isWeakPoint) {
            const wp = el.querySelector('.dangan-weak-point');
            currentWeakPointInfo = wp
                ? { text: wp.textContent, element: wp }
                : { text: el.textContent, element: el };
        }

        statementEl = el;
        const h = window.innerHeight || 800;
        const baseY = Number.isFinite(laneY) ? laneY : Math.round(h * 0.52);

        const centerX = Math.round(w * 0.52);
        const centerY = Math.round(h * 0.50);
        const startX = centerX + Math.round(Math.random() * 40 - 20);
        const startY = centerY + Math.round(Math.random() * 36 - 18) + Math.round((baseY - centerY) * 0.15);

        // ── White noise pattern selection ───────────────────────────
        const WN_PATTERNS = [
            {
                name: 'random',
                count: () => Math.floor(Math.random() * 9) + 1,
                offsets: null,
                noRotation: false,
            },
            {
                // 3 nodes evenly spaced in a triangle/asterisk around the weak spot
                name: 'asterisk',
                count: () => 3,
                offsets: (i) => {
                    const angle = (i * 120 - 90) * (Math.PI / 180);
                    const r = 110;
                    return { x: Math.round(Math.cos(angle) * r), y: Math.round(Math.sin(angle) * r) };
                },
                noRotation: true,
            },
            {
                // 4 nodes in a 2×2 grid centred on the statement
                name: 'grid',
                count: () => 4,
                offsets: (i) => ({
                    x: (i % 2 === 0 ? -1 : 1) * 130,
                    y: (i < 2 ? -1 : 1) * 55,
                }),
                noRotation: true,
            },
        ];

        const wnPattern = (isWeakPoint && whiteNoise)
            ? WN_PATTERNS[Math.floor(Math.random() * WN_PATTERNS.length)]
            : null;

        const motionMode = Math.random() < 0.18 ? 'pov' : 'drift';
        const dir = Math.random() < 0.5 ? -1 : 1;
        const driftX = dir * Math.round(w * 0.11);
        // Suppress rotation for structured patterns so WN placement reads clearly
        const rotStart = wnPattern?.noRotation ? 0 : (Math.random() * 24 - 12);
        const rotSpeed = wnPattern?.noRotation ? 0 : (Math.random() * 14 - 7);
        const endX = startX + driftX;
        const endY = startY + (motionMode === 'drift' ? Math.round(Math.random() * 16 - 8) : Math.round(Math.random() * 10 - 5));

        const duration = motionMode === 'drift'
            ? (6600 + Math.floor(Math.random() * 1500))
            : (1800 + Math.floor(Math.random() * 450));
        let rafId = 0;
        let cancelled = false;
        let lastNow = performance.now();
        let elapsed = 0;
        const isScreaming = isAllCapsLine(el.textContent);

        if (wnPattern) {
            const count = wnPattern.count();
            for (let i = 0; i < count; i++) {
                const wnText = whiteNoise[i % whiteNoise.length];
                spawnWhiteNoise(wnText, startX, startY, wnPattern.offsets ? wnPattern.offsets(i) : null);
            }
        }

        return new Promise(resolve => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                resolve();
            };

            const frame = (now) => {
                if (cancelled || !isDebateActive() || statementEl !== el) {
                    finish();
                    return;
                }

                // Variable time step based on speedModifier (capped to prevent tab-switch jumps)
                const dt = Math.min(now - lastNow, 100);
                const delta = dt * speedModifier;
                lastNow = now;
                elapsed += delta;

                const p = Math.max(0, Math.min(1, elapsed / duration));

                const x = startX + (endX - startX) * p;
                const y = startY + (endY - startY) * p;

                const peak = 1 - Math.abs(p - 0.5) * 2;
                const rot  = rotStart + (elapsed / 1000) * rotSpeed;
                const skew = dir * -10;

                const scale = motionMode === 'pov'
                    ? (0.92 + 0.28 * peak)
                    : 1;

                let opacity = 1;
                if (p < 0.12) opacity = p / 0.12;
                else if (p > 0.86) opacity = Math.max(0, (1 - p) / 0.14);

                el.style.opacity = String(opacity);
                const shake = isScreaming ? (Math.sin(now / 28) * 2.2) : 0;
                const shakeY = isScreaming ? (Math.cos(now / 24) * 1.6) : 0;
                el.style.transform = `translate(${x + shake}px, ${y + shakeY}px) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;

                if (p >= 1) {
                    el.remove();
                    if (statementEl === el) {
                        statementEl = null;
                        statementAnimation = null;
                        if (currentWeakPointInfo?.element === el) currentWeakPointInfo = null;
                    }
                    finish();
                    return;
                }

                rafId = requestAnimationFrame(frame);
            };

            statementAnimation = {
                cancel: () => {
                    cancelled = true;
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = 0;
                    finish();
                },
            };

            rafId = requestAnimationFrame(frame);
        });
    }

    function isAllCapsLine(text) {
        const raw = String(text || '');
        const letters = raw.replace(/[^A-Za-z]/g, '');
        if (letters.length < 6) return false;
        const upper = letters.replace(/[^A-Z]/g, '').length;
        return upper / letters.length >= 0.85;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeRegExp(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function stripWeakBrackets(value) {
        const t = String(value || '').trim();
        if (t.startsWith('[[') && t.endsWith(']]') && t.length >= 4) return t.slice(2, -2).trim();
        return t.replace(/\[\[|\]\]/g, '').trim();
    }

    function inferEmotionFromText(text) {
        const t = String(text || '').toLowerCase();
        if (!t.trim()) return 'neutral';
        
        // Map to common SillyTavern Expression labels: 
        // joy, sadness, anger, surprise, disgust, fear
        
        // Anger/Aggression
        if (isAllCapsLine(text) || /!{2,}/.test(t) || /shut up|liar|wrong|impossible|dammit|bastard/i.test(t)) return 'anger';
        
        // Surprise/Shock
        if (/\?{2,}/.test(t) || /what|how|really|wait|no way|impossible/i.test(t)) return 'surprise';
        
        // Sadness/Doubt
        if (/\.\.\./.test(t) || /sorry|sad|unfortunate|helpless|forgive/i.test(t)) return 'sadness';
        
        // Thinking/Logic (often maps to neutral or surprise in ST, but let's try 'thinking' as a fallback)
        if (/\?/.test(t) || /maybe|perhaps|consider|evidence|think|logic/i.test(t)) return 'surprise';
        
        // Joy/Excitement
        if (/haha|great|wonderful|correct|exactly|yes/i.test(t)) return 'joy';

        return 'neutral';
    }

    function clearAllWhiteNoise() {
        for (const el of activeWhiteNoiseEls) el.remove();
        activeWhiteNoiseEls = [];
    }

    function splitIntoThirds(str) {
        const len = str.length;
        const a = Math.ceil(len / 3);
        const b = Math.ceil((len * 2) / 3);
        return [str.slice(0, a), str.slice(a, b), str.slice(b)];
    }

    function clearWnSpaceTimers() {
        clearTimeout(wnSpaceTapTimer);
        clearInterval(wnSpaceRepeatTimer);
        wnSpaceTapTimer = null;
        wnSpaceRepeatTimer = null;
        wnSpaceHeld = false;
    }

    function doWnSpaceFire() {
        if (nsdIntroPlaying) return;
        playSfx?.('wn_shooting');
        showWnPressFlash();
        showWnBurst(lastCursorX, lastCursorY);
        if (hoveredWhiteNoise) hitWhiteNoise(hoveredWhiteNoise);
    }

    // Pre-allocated pool of burst elements.  Rapid Space spam previously
    // created/destroyed a DOM node + compositor layer on every press, which
    // dominated the per-press cost.  We keep N pool elements parented to the
    // body, hidden when idle (the .fire-burst class drives the animation
    // and ends at opacity 0).  Each press grabs the next slot round-robin
    // and restarts the animation by toggling the class.
    const WN_BURST_POOL_SIZE = 8;
    const wnBurstPool = [];
    let wnBurstPoolIdx = 0;

    function ensureWnBurstPool() {
        while (wnBurstPool.length < WN_BURST_POOL_SIZE) {
            const burst = document.createElement('div');
            burst.className = 'dangan-wn-burst';
            document.body.appendChild(burst);
            wnBurstPool.push(burst);
        }
    }

    function showWnBurst(x, y) {
        ensureWnBurstPool();
        const burst = wnBurstPool[wnBurstPoolIdx];
        wnBurstPoolIdx = (wnBurstPoolIdx + 1) % WN_BURST_POOL_SIZE;
        burst.style.left = `${x}px`;
        burst.style.top  = `${y}px`;
        // Restart the CSS animation by removing then re-adding .fire-burst.
        burst.classList.remove('fire-burst');
        // eslint-disable-next-line no-unused-expressions
        void burst.offsetWidth;
        burst.classList.add('fire-burst');
    }

    function showWnPressFlash() {
        const el = document.getElementById('dangan-wn-press-flash');
        if (!el) return;
        el.classList.remove('flash');
        void el.offsetWidth; // reflow to restart animation
        el.classList.add('flash');
    }

    function hitWhiteNoise(el) {
        if (!el || !document.body.contains(el) || el.classList.contains('breaking')) return;
        const thirds = el._wnThirds;
        if (!thirds) return;
        const hit = (el._wnHits = (el._wnHits || 0) + 1);

        // Restart flash animation via reflow
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');

        playSfx?.('wn_damage');

        if (hit >= 3) {
            el.classList.remove('hovered');
            el.classList.add('breaking');
            if (hoveredWhiteNoise === el) hoveredWhiteNoise = null;
            setTimeout(() => {
                el.remove();
                activeWhiteNoiseEls = activeWhiteNoiseEls.filter(n => n !== el);
            }, 340);
        } else {
            // Replace text with remaining thirds
            el.textContent = thirds.slice(hit).join('');
            el.classList.remove('hit-1', 'hit-2');
            el.classList.add(`hit-${hit}`);
        }
    }

    // Single shared RAF loop drives all white-noise elements — eliminates N concurrent loops.
    function runWnPool(now) {
        let i = wnAnimPool.length;
        while (i--) {
            const it = wnAnimPool[i];
            if (!document.body.contains(it.el)) { wnAnimPool.splice(i, 1); continue; }
            if (!isDebateActive()) {
                it.el.remove();
                activeWhiteNoiseEls = activeWhiteNoiseEls.filter(n => n !== it.el);
                if (hoveredWhiteNoise === it.el) hoveredWhiteNoise = null;
                wnAnimPool.splice(i, 1); continue;
            }
            const dt = Math.min(now - it.lastNow, 100);
            it.elapsed += dt * speedModifier;
            it.lastNow = now;
            const p   = Math.min(1, it.elapsed / it.duration);
            const x   = it.startX + it.driftX * p;
            const y   = it.startY + it.driftY * p;
            const rot = it.rotStart + (it.elapsed / 1000) * it.rotSpeed;
            let opacity = 1;
            if (p < 0.08) opacity = p / 0.08;
            else if (p > 0.88) opacity = Math.max(0, (1 - p) / 0.12);
            it.el.style.opacity   = String(opacity);
            it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rot}deg)`;
            if (p >= 1) {
                it.el.remove();
                activeWhiteNoiseEls = activeWhiteNoiseEls.filter(n => n !== it.el);
                if (hoveredWhiteNoise === it.el) hoveredWhiteNoise = null;
                wnAnimPool.splice(i, 1);
            }
        }
        wnPoolRafId = wnAnimPool.length ? requestAnimationFrame(runWnPool) : null;
    }

    function spawnWhiteNoise(text, nearX, nearY, fixedOffset = null) {
        if (!text || !isDebateActive()) return;
        const el = document.createElement('div');
        el.className = 'dangan-white-noise';
        el._wnThirds = splitIntoThirds(String(text));
        el._wnHits   = 0;
        el.textContent = String(text);

        const w = window.innerWidth  || 1200;
        const h = window.innerHeight || 800;
        const offsetX = fixedOffset != null ? fixedOffset.x : Math.round(Math.random() * 280 - 140);
        const offsetY = fixedOffset != null ? fixedOffset.y : Math.round(Math.random() * 80  - 40);
        const startX  = Math.max(120, Math.min(w - 120, nearX + offsetX));
        const startY  = Math.max(80,  Math.min(h - 80,  nearY + offsetY));
        const dir     = Math.random() < 0.5 ? -1 : 1;
        const driftX  = dir * Math.round(w * 0.09);
        const driftY  = Math.round(Math.random() * 20 - 10);
        const duration = 7500 + Math.floor(Math.random() * 2000);
        const rotStart = Math.random() * 16 - 8;
        const rotSpeed = Math.random() * 8 - 4;

        // Use transform-only positioning — no left/top changes (GPU composited).
        el.style.opacity   = '0';
        el.style.transform = `translate(${startX}px, ${startY}px) translate(-50%, -50%) rotate(${rotStart}deg)`;

        document.body.appendChild(el);
        activeWhiteNoiseEls.push(el);

        wnAnimPool.push({ el, startX, startY, driftX, driftY, duration, rotStart, rotSpeed, lastNow: performance.now(), elapsed: 0 });
        if (!wnPoolRafId) wnPoolRafId = requestAnimationFrame(runWnPool);
    }

    function resolveWeakPointAtClick(cx, cy) {
        const isMpd = currentState === TrialPhases.MASS_PANIC_DEBATE;
        const trackedWp = isMpd ? mpdWeakPointEl : currentWeakPointInfo?.element;

        // 1. Check whether any white noise is currently covering the weak point
        if (trackedWp instanceof HTMLElement && activeWhiteNoiseEls.length > 0) {
            const wpRect = trackedWp.getBoundingClientRect();
            for (const noise of activeWhiteNoiseEls) {
                if (!document.body.contains(noise) || noise.classList.contains('breaking')) continue;
                const nr = noise.getBoundingClientRect();
                if (nr.left < wpRect.right && nr.right > wpRect.left &&
                    nr.top  < wpRect.bottom && nr.bottom > wpRect.top) {
                    return null; // blocked by white noise
                }
            }
        }

        // Helper: is a weak-point element in a locked MPD column?
        const isMpdWpLocked = (wpEl) => {
            if (!isMpd || !mpdLockActive || !(wpEl instanceof HTMLElement)) return false;
            const wpRect = wpEl.getBoundingClientRect();
            const wpCenterX = wpRect.left + wpRect.width / 2;
            const wpCol = Math.max(0, Math.min(2, Math.floor((wpCenterX / window.innerWidth) * 3)));
            return wpCol !== mpdFreeColumn;
        };

        // 2. Element directly under the click
        const topEl = document.elementFromPoint(cx, cy);
        if (topEl?.classList.contains('dangan-weak-point')) {
            if (isMpdWpLocked(topEl)) return null;
            return topEl;
        }

        // 3. Rect-based check against the tracked weak point (with padding)
        if (trackedWp instanceof HTMLElement && trackedWp.classList.contains('dangan-weak-point')) {
            if (isMpdWpLocked(trackedWp)) return null;
            const rect    = trackedWp.getBoundingClientRect();
            const padding = 20;
            if (
                cx >= rect.left   - padding &&
                cx <= rect.right  + padding &&
                cy >= rect.top    - padding &&
                cy <= rect.bottom + padding
            ) return trackedWp;
        }

        return null;
    }

    function showShotEffect(x, y) {
        const burst = document.createElement('div');
        burst.className = 'dangan-nsd-shot-burst';
        burst.style.left = `${x}px`;
        burst.style.top  = `${y}px`;
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 400);

        const flash = document.getElementById('dangan-nsd-shot-flash');
        if (flash) {
            flash.classList.remove('flash');
            requestAnimationFrame(() => {
                flash.classList.add('flash');
                setTimeout(() => flash.classList.remove('flash'), 200);
            });
        }
    }

    function fireProjectile(bulletTitle, targetX, targetY, isPerjury, firedBullet) {
        const el = document.createElement('div');
        el.className = 'dangan-nsd-projectile';
        el.textContent = bulletTitle;
        document.body.appendChild(el);

        // Start: first character off-screen at the bottom-right corner.
        // The full atan2 angle (~-140° to -160°) then points the body further
        // lower-right (off-screen) while the first character leads toward the target.
        const startX   = window.innerWidth  + 120;
        const startY   = window.innerHeight + 120;
        const duration = 520; // ms

        // atan2 gives ~-150° (pointing upper-left), but that makes the text read
        // backwards. Adding 180° flips the strip so the first character is the tip
        // and the body trails lower-right in a readable left-to-right orientation.
        const angle = Math.atan2(targetY - startY, targetX - startX) * (180 / Math.PI) + 180;

        let startTime = null;
        let done      = false;

        function finish(hitWp, hitAgree) {
            if (done) return;
            done = true;
            el.remove();
            const currentBullet = firedBullet || getDebateBullets()[selectedTruthBulletIndex] || { title: 'TRUTH BULLET' };
            if (hitWp) {
                playSfx?.('weak_spot_hit');
                hitWeakPoint(hitWp, currentBullet, isPerjury);
                // Successful hit — leave shotCooldown locked so spam-clicks
                // can't fire further bullets until the next debate setup.
                return;
            } else if (hitAgree) {
                playSfx?.('weak_spot_hit');
                hitAgreeText(hitAgree, currentBullet);
                return;
            } else {
                playSfx?.('tbmiss');
                if (isPointOnDebateText(targetX, targetY)) {
                    playSfx?.('rejected_shot');
                }
                // Lie missed the weak spot — drop the inversion overlay.
                if (currentBullet?.isLie) {
                    document.body.classList.remove('dangan-nsd-lie-armed');
                }
            }
            shotCooldown = false;
        }

        function step(time) {
            if (done) return;
            if (!startTime) startTime = time;

            const raw  = Math.min((time - startTime) / duration, 1);
            // ease-out cubic: fast start, decelerates
            const t    = 1 - Math.pow(1 - raw, 3);

            // `left` is the first character's X — it moves from right edge to targetX
            const x     = startX + (targetX - startX) * t;
            const y     = startY + (targetY - startY) * t;
            const scale = 2.6 - t * 2.5;   // 2.6 → 0.1
            const alpha = raw > 0.72 ? 1 - (raw - 0.72) / 0.28 : 1;

            // Pure-transform positioning (GPU composited, no layout per frame).
            // translate(x,y) moves the left edge to (x,y); translateY(-50%) centers vertically.
            el.style.transform = `translate(${x}px, ${y}px) translateY(-50%) rotate(${angle.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity   = alpha.toFixed(3);

            if (raw < 1) {
                requestAnimationFrame(step);
            } else {
                // Animation complete — check if the original click was on a weak point or agree text
                const hitWp    = resolveWeakPointAtClick(targetX, targetY);
                const hitAgree = !hitWp ? resolveAgreeTextAtClick(targetX, targetY) : null;
                finish(hitWp, hitAgree);
            }
        }

        requestAnimationFrame(step);
    }

    // Returns true only when (cx, cy) overlaps actual rendered text in an
    // active statement or white-noise element — not the empty parts of their divs.
    function isPointOnDebateText(cx, cy) {
        const checkEl = (el) => {
            if (!el || !document.body.contains(el)) return false;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const r of range.getClientRects()) {
                    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return true;
                }
            }
            return false;
        };

        // White noise elements (pointer-events: none, can't use elementFromPoint)
        for (const wn of activeWhiteNoiseEls) {
            if (wn?.classList.contains('breaking')) continue;
            if (checkEl(wn)) return true;
        }

        // Active statement elements (NSD: statementEl; MPD: mpdColEls)
        const stmts = [statementEl, ...mpdColEls];
        for (const s of stmts) {
            if (checkEl(s)) return true;
        }

        return false;
    }

    function handleShoot(e, isPerjury = false) {
        if (shotCooldown) return;
        if (nsdIntroPlaying) return; // block fires until the debate intro fully finishes
        if (nsdLieLoading) return; // block fires while the lie is generating
        shotCooldown = true;

        // Health: deduct one point if the user fired a Truth Bullet while
        // hovering on a White Noise (NSD + MPD). Re-check rects at click time
        // since white noise drifts via RAF — a stationary cursor with a WN
        // drifting onto it won't have hoveredWhiteNoise updated by mousemove.
        if (isDebateActive()) {
            let wnAtClick = hoveredWhiteNoise;
            if (!wnAtClick && activeWhiteNoiseEls.length) {
                // Hit-test at the swayed reticle position (where the visible cursor is)
                // rather than the raw OS mouse position passed in via `e`.
                const cx = lastCursorX, cy = lastCursorY;
                for (const el of activeWhiteNoiseEls) {
                    if (!document.body.contains(el) || el.classList.contains('breaking')) continue;
                    const r = el.getBoundingClientRect();
                    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
                        wnAtClick = el;
                        break;
                    }
                }
            }
            if (wnAtClick) deductNsdHealth();
        }

        const bullets = getDebateBullets();
        const currentBullet = bullets[selectedTruthBulletIndex] || { title: 'TRUTH BULLET' };

        playSfx?.('shoottb');
        playSfx?.('tb_shot');
        const tbSpentEl = getSfx?.()?.tb_spent;
        if (tbSpentEl) {
            tbSpentEl.currentTime = 0;
            const onShot = getSfx?.()?.tb_shot;
            if (onShot) {
                onShot.addEventListener('ended', () => playSfx?.('tb_spent'), { once: true });
            } else {
                playSfx?.('tb_spent');
            }
        }
        // Visual effects originate at the swayed reticle position, matching the
        // hit-test logic above so the projectile and muzzle flash line up with
        // where the visible cursor is pointing.
        showShotEffect(lastCursorX, lastCursorY);

        // Consume the temporary bullet immediately on fire (regardless of hit/miss)
        if (currentBullet.isTemporary) {
            nsdActiveBullets         = bullets.filter(b => !b.isTemporary);
            tempBullet               = null;
            selectedTruthBulletIndex = 0;
            renderCylinder();
        }

        fireProjectile(currentBullet.title, lastCursorX, lastCursorY, isPerjury, currentBullet);
        // shotCooldown is reset inside finish() when the projectile resolves
    }

    function hitWeakPoint(wp, currentBullet, isPerjury = false) {
        console.log(`[Dangan][Trial] CRITICAL HIT! (Perjury: ${isPerjury})`);
        lastHitWasPerjury = isPerjury;
        
        const rect = wp.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;
        
        playSfx?.(getSfx?.().hit || 'hit');
        
        // 2. Burst effect on the statement chunk
        const parentStatement = wp.closest('.dangan-floating-statement');
        if (parentStatement) {
            createBurstEffect(targetX, targetY);
            parentStatement.style.transition = 'all 0.2s ease-out';
            parentStatement.style.transform += ' scale(1.4)';
            parentStatement.style.filter = 'brightness(3) blur(5px)';
            parentStatement.style.opacity = '0';
            setTimeout(() => parentStatement.remove(), 250);
        }

        // 3. Award XP for completing the debate
        const isMpd = currentState === TrialPhases.MASS_PANIC_DEBATE;
        const xpKey = isMpd ? 'massPanicDebate' : 'nonStopDebate';
        const xpAmount = xpRewards?.[xpKey] ?? (isMpd ? 18 : 15);
        awardXp?.(xpAmount, isMpd ? 'mass panic debate completed' : 'non-stop debate completed');

        // 4. Show COUNTER, PERJURY, or LIE banner
        const bannerType = (isPerjury || currentBullet?.isLie) ? 'perjury' : 'counter';
        showTrialBanner(bannerType).then(() => {
            setState(TrialPhases.TRUTH_BULLET_EXPLANATION);
            showExplanationUI(currentBullet, wp.textContent);
        });
    }

    function resolveAgreeTextAtClick(cx, cy) {
        // 1. Direct element check
        const topEl = document.elementFromPoint(cx, cy);
        if (topEl?.classList.contains('dangan-agree-text')) return topEl;
        const closest = topEl?.closest?.('.dangan-agree-text');
        if (closest) return closest;

        // 2. Rect-based fallback across all visible agree spans
        const padding = 20;
        for (const el of document.querySelectorAll('.dangan-agree-text')) {
            const rect = el.getBoundingClientRect();
            if (
                cx >= rect.left   - padding &&
                cx <= rect.right  + padding &&
                cy >= rect.top    - padding &&
                cy <= rect.bottom + padding
            ) return el;
        }
        return null;
    }

    function hitAgreeText(agreeEl, currentBullet) {
        const rect    = agreeEl.getBoundingClientRect();
        const targetX = rect.left + rect.width  / 2;
        const targetY = rect.top  + rect.height / 2;

        playSfx?.(getSfx?.().hit || 'hit');

        const parentStatement = agreeEl.closest('.dangan-floating-statement');
        if (parentStatement) {
            createBurstEffect(targetX, targetY);
            parentStatement.style.transition = 'all 0.2s ease-out';
            parentStatement.style.transform += ' scale(1.4)';
            parentStatement.style.filter = 'brightness(3) blur(5px)';
            parentStatement.style.opacity = '0';
            setTimeout(() => parentStatement.remove(), 250);
        }

        const isMpd    = currentState === TrialPhases.MASS_PANIC_DEBATE;
        const xpKey    = isMpd ? 'massPanicDebate' : 'nonStopDebate';
        const xpAmount = xpRewards?.[xpKey] ?? (isMpd ? 18 : 15);
        awardXp?.(xpAmount, isMpd ? 'mass panic debate completed' : 'non-stop debate completed');

        const speakerName = parentStatement?.dataset?.speakerName
            || gcpSlots[Math.round(gcpCurrentFloat)]?.name
            || null;
        showTrialBanner('consent', { speakerName }).then(() => {
            setState(TrialPhases.TRUTH_BULLET_EXPLANATION);
            showExplanationUI(currentBullet, agreeEl.textContent, 'agree');
        });
    }

    function createBurstEffect(x, y) {
        // Ensure we create enough fragments and they are added to the body
        const fragmentCount = 35;
        for (let i = 0; i < fragmentCount; i++) {
            const frag = document.createElement('div');
            frag.className = 'dangan-burst-fragment';
            frag.style.left = `${x}px`;
            frag.style.top = `${y}px`;
            // Randomize size slightly
            const size = 4 + Math.random() * 8;
            frag.style.width = `${size}px`;
            frag.style.height = `${size}px`;
            document.body.appendChild(frag);
            
            const angle = Math.random() * Math.PI * 2;
            const dist = 120 + Math.random() * 300;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;
            const rot = Math.random() * 720;
            
            frag.animate([
                { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0) rotate(${rot}deg)`, opacity: 0 }
            ], {
                duration: 700 + Math.random() * 500,
                easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)'
            }).onfinish = () => frag.remove();
        }
    }

    async function showTrialBanner(type, { speakerName = null } = {}) {
        playSfx?.('countersfx');

        const assetName = type === 'perjury' ? 'perjury.png' : type === 'consent' ? 'consent.png' : 'counter.png';
        const imgSrc    = getAssetUrl(assetName);

        // Prefill bar sweeps in from centre
        const prefill = document.createElement('div');
        const prefillArea = type === 'perjury'
            ? 'top:calc(23.33% - 10px);left:0px;right:0px;height:calc(50.34% + 20px);'
            : type === 'consent'
            ? 'top:calc(19.33% - 10px + 150px);left:0px;right:0px;height:calc(53.34% + 20px);'
            : type === 'counter'
            ? 'top:0;left:0px;right:0px;height:100%;'
            : 'top:calc(33.33% - 10px);left:0;right:0;height:calc(33.34% + 20px);';
        prefill.style.cssText = `position:fixed;${prefillArea}z-index:2147483646;background:#000;pointer-events:none;transform:scaleX(0);transform-origin:center;transition:transform 0.045s ease-out;`;
        if (type !== 'counter') {
            document.body.appendChild(prefill);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            prefill.style.transform = 'scaleX(1)';
            await new Promise(r => setTimeout(r, 55));
        }

        // Banner slides in from the left
        const bannerWrap = document.createElement('div');
        const bannerArea = type === 'perjury'
            ? 'top:23.33%;left:0px;right:0px;height:50%;overflow:hidden;'
            : type === 'consent'
            ? 'top:calc(19.33% + 150px);left:0px;right:0px;height:53.34%;overflow:initial;'
            : type === 'counter'
            ? 'top:0;left:0px;right:0px;height:100%;overflow:hidden;'
            : 'top:33.33%;left:0;right:0;height:33.34%;overflow:hidden;';
        bannerWrap.style.cssText = `position:fixed;${bannerArea}z-index:2147483647;pointer-events:none;`;
        const inner = document.createElement('div');
        const innerStyle = type === 'consent'
            ? 'position:absolute;top:-280px;bottom:-100px;right:100%;width:100%;height:fit-content;display:flex;align-items:center;justify-content:center;overflow:visible;transition:right 0.325s cubic-bezier(0.22,0.61,0.36,1);'
            : type === 'counter'
            ? 'position:absolute;top:0px;bottom:0px;right:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:right 0.325s cubic-bezier(0.22,0.61,0.36,1);'
            : 'position:absolute;top:0;bottom:0;right:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:right 0.325s cubic-bezier(0.22,0.61,0.36,1);';
        inner.style.cssText = innerStyle;
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = type;
        img.style.cssText = type === 'consent'
            ? 'width:100%;height:100%;object-fit:fill;object-position:center center;display:block;'
            : type === 'counter'
            ? 'width:100%;height:100%;object-fit:cover;object-position:center center;display:block;'
            : `width:100%;height:100%;object-fit:${type === 'perjury' ? 'cover' : 'contain'};object-position:center;display:block;`;
        inner.appendChild(img);

        // Perjury banner: overlay player's remorse.png sprite, bottom half clipped
        if (type === 'perjury') {
            const promeInfo = getPromeInfo();
            if (promeInfo?.spritePack) {
                const remorsUrl = await getSpriteUrl(promeInfo.spritePack, 'remorse').catch(() => null);
                if (remorsUrl) {
                    const spriteEl = document.createElement('img');
                    spriteEl.src = remorsUrl;
                    spriteEl.alt = '';
                    spriteEl.style.cssText = 'position:absolute;bottom:-850px;left:50%;transform:translateX(-50%);height:300%;width:auto;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(rgba(255,255,255,1) 0px 0px 50px);';
                    inner.appendChild(spriteEl);
                }
            }
        }

        // Consent banner: speaker sprite slides in from right (lands left), player sprite from left (lands right)
        let consentSpeakerEl = null;
        let consentPlayerEl  = null;
        if (type === 'consent') {
            const promeInfo = getPromeInfo();
            // clip-path clips the bottom half of each sprite independently
            const spriteStyle = 'position:absolute;top:0;height:200%;width:auto;object-fit:contain;object-position:top center;pointer-events:none;z-index:1;-webkit-mask-image:linear-gradient(to bottom,black 30%,transparent 55%);mask-image:linear-gradient(to bottom,black 30%,transparent 55%);filter:drop-shadow(0 0 18px rgba(0,200,255,0.7));transition:transform 0.45s cubic-bezier(0.22,0.61,0.36,1);';

            if (speakerName && typeof getSpriteUrl === 'function') {
                const speakerUrl = await getSpriteUrl(speakerName, 'approval').catch(() => null);
                if (speakerUrl) {
                    consentSpeakerEl = document.createElement('img');
                    consentSpeakerEl.src = speakerUrl;
                    consentSpeakerEl.alt = '';
                    consentSpeakerEl.style.cssText = spriteStyle + 'left:5%;transform:translateX(200%);';
                }
            }

            if (promeInfo?.spritePack) {
                const approvalUrl = await getSpriteUrl(promeInfo.spritePack, 'approval').catch(() => null);
                if (approvalUrl) {
                    consentPlayerEl = document.createElement('img');
                    consentPlayerEl.src = approvalUrl;
                    consentPlayerEl.alt = '';
                    consentPlayerEl.style.cssText = spriteStyle + 'right:5%;transform:translateX(-200%);';
                }
            }
        }

        // inner (banner image) first, then sprites on top
        bannerWrap.appendChild(inner);
        if (consentSpeakerEl) bannerWrap.appendChild(consentSpeakerEl);
        if (consentPlayerEl)  bannerWrap.appendChild(consentPlayerEl);
        document.body.appendChild(bannerWrap);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        inner.style.right = '0%';
        if (consentSpeakerEl) consentSpeakerEl.style.transform = 'translateX(0)';
        if (consentPlayerEl)  consentPlayerEl.style.transform  = 'translateX(0)';

        // Voice line
        if (type === 'perjury') {
            playSfx?.(getSfx?.().vic_Monok_01_021 || 'vic_Monok_01_021');
        } else if (type === 'consent') {
            playSfx?.(getSfx?.().vic_Monok_01_022 || 'vic_Monok_01_022');
        } else {
            playSfx?.(getSfx?.().vic_Monok_01_022 || 'vic_Monok_01_022');
        }

        await new Promise(r => setTimeout(r, 1800));

        // Fade out counter banner + prefill
        bannerWrap.style.transition = 'opacity 0.5s ease';
        bannerWrap.style.opacity    = '0';
        prefill.style.transition    = 'opacity 0.5s ease';
        prefill.style.opacity       = '0';
        await new Promise(r => setTimeout(r, 520));
        bannerWrap.remove();
        prefill.remove();

        // ── BREAK transition (copied from PTA endGame win) ──────────
        const breakOverlay = document.createElement('div');
        breakOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);opacity:0;transition:opacity 0.3s ease;pointer-events:none;';
        const breakText = document.createElement('div');
        breakText.textContent = 'BREAK';
        const isMpdBreak = currentState === TrialPhases.MASS_PANIC_DEBATE;
        breakText.style.cssText = isMpdBreak
            ? 'font-size:56px;letter-spacing:8px;color:#ff2222;text-shadow:0 0 30px rgba(255,34,34,0.8),0 0 60px rgba(255,34,34,0.4);font-family:Orbitron,sans-serif;font-weight:900;'
            : 'font-size:56px;letter-spacing:8px;color:#22aaff;text-shadow:0 0 30px rgba(34,170,255,0.8),0 0 60px rgba(34,170,255,0.4);font-family:Orbitron,sans-serif;font-weight:900;';
        breakOverlay.appendChild(breakText);
        document.body.appendChild(breakOverlay);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        breakOverlay.style.opacity = '1';
        await new Promise(r => setTimeout(r, 1200));

        breakOverlay.style.transition = 'opacity 0.5s ease';
        breakOverlay.style.opacity    = '0';
        await new Promise(r => setTimeout(r, 520));
        breakOverlay.remove();
    }

    function showExplanationUI(bullet, refutedText, mode = 'refute') {
        lastHitBullet = bullet;
        lastHitWeakPoint = refutedText;

        const verb = mode === 'agree' ? 'agree with' : bullet?.isLie ? 'lie about' : 'refute';

        const notification = document.createElement('div');
        notification.id = 'dangan-trial-rebuttal-notif';
        notification.className = 'dangan-trial-notification rebuttal-active';
        notification.innerHTML = `
            <div class="dangan-trial-notif-content">
                <div class="rebuttal-header">REBUTTAL PHASE</div>
                <div class="rebuttal-info">
                    Using <strong>${bullet.title}</strong> to ${verb} <em>"${refutedText}"</em>.
                </div>
                <div class="rebuttal-prompt">Explain your reasoning in the chat...</div>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Focus chat input
        const chatInput = document.querySelector('#send_textarea, #chat_input');
        if (chatInput) chatInput.focus();
    }

    function onMessageSent(text) {
        console.log(`[Dangan][Trial] onMessageSent: state=${currentState}, rebuttalPromptActive=${rebuttalPromptActive}`);
        
        if (currentState !== TrialPhases.TRUTH_BULLET_EXPLANATION) {
            if (rebuttalPromptActive) {
                console.log('[Dangan][Trial] Clearing stale rebuttal prompt.');
                const ctx = window.SillyTavern?.getContext?.();
                const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
                if (typeof setPrompt === 'function') {
                    setPrompt('dangan_rebuttal_judgment', '', 0, 0, false, 'system');
                }
                rebuttalPromptActive = false;
            }
            return;
        }

        console.log(`[Dangan][Trial] Processing rebuttal explanation... (Perjury: ${lastHitWasPerjury})`);
        const notif = document.getElementById('dangan-trial-rebuttal-notif');
        if (notif) notif.remove();

        const ctx = window.SillyTavern?.getContext?.();
        const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
        
        if (typeof setPrompt === 'function') {
            const perjuryNote = lastHitWasPerjury 
                ? "\n[IMPORTANT: This is a PERJURY (LIE). The user is lying to refute the claim. Characters should react to the boldness or the deception if they suspect it, or be misled if the lie is convincing.]" 
                : "";

            const prompt = `
[SYSTEM: TRIAL REBUTTAL JUDGMENT]
The user is attempting to refute the claim: "${lastHitWeakPoint}"
Using the Truth Bullet: "${lastHitBullet.title}" ${lastHitWasPerjury ? '(AS A LIE)' : ''}
User's reasoning: "${text}"
${perjuryNote}

JUDGMENT RULES:
1. Evaluate if the reasoning and the Truth Bullet logically contradict the claim.
2. If it was a PERJURY, judge if the lie is clever or necessary to move the trial forward.
3. If it makes sense, react with characters being impressed, shocked by the contradiction, or moving the trial forward.
4. If it does NOT make sense, react with characters being skeptical, confused, or asking for better proof.
5. Keep the Danganronpa trial momentum and stay in character.
6. The next character response should act as a judge or witness reacting to this specific rebuttal.
`.trim();
            console.log('[Dangan][Trial] Injecting rebuttal judgment prompt.');
            // Depth 0, position 1 (after history), is_system true
            setPrompt('dangan_rebuttal_judgment', prompt, 0, 1, true, 'system');
            rebuttalPromptActive = true;
        }

        setTimeout(() => {
            console.log('[Dangan][Trial] Transitioning back to PRE_DEBATE');
            setState(TrialPhases.PRE_DEBATE);
        }, 800);
    }

    function getRecentMessages() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;

        const ctxMessages = chat ? mapContextChatMessages(chat) : [];
        const domMessages = ctxMessages.length ? [] : mapDomMessages(readDomChatMessages(30));
        const source = (ctxMessages.length ? ctxMessages : domMessages)
            .filter(m => !m.isUser && !m.isSystem && m.text);

        const mapped = source
            .map(m => {
                const dialogueOnly = extractDialogueOnly(m.text);
                return {
                    name: m.name,
                    text: dialogueOnly || m.text,
                };
            })
            .filter(m => m.name && m.text);

        return mapped.slice(-12);
    }

    function splitIntoChunks(text) {
        const raw = String(text || '').replace(/\s+/g, ' ').trim();
        if (!raw) return [];

        // Split by major punctuation, including weak point markers
        // We want to keep the punctuation with the preceding chunk
        const reSplit = /([,;:]\s+|\.\.\.\s+|\.\s+|\?\s+|!\s+|\)\s+|\]\]\s*)/g;
        const reTest  = /^([,;:]\s+|\.\.\.\s+|\.\s+|\?\s+|!\s+|\)\s+|\]\]\s*)$/;
        const parts = raw.split(reSplit).filter(Boolean);

        const chunks = [];
        let current = '';

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (reTest.test(p)) {
                // It's a punctuation/marker, attach to current
                current += p;
                if (current.trim().length > 15) { // Minimum chunk size to avoid tiny fragments
                    chunks.push(current.trim());
                    current = '';
                }
            } else {
                current += p;
            }
        }
        if (current.trim()) chunks.push(current.trim());

        // If a chunk is still too long (> 65 chars), try to split by conjunctions
        const finalChunks = [];
        const softSplit = /(\bbut\s+|\bhowever\s+|\bthough\s+|\byet\s+|\bso\s+|\bbecause\s+)/i;
        
        for (let chunk of chunks) {
            if (chunk.length > 65) {
                const subParts = chunk.split(softSplit).filter(Boolean);
                let subCurrent = '';
                for (let sp of subParts) {
                    if (softSplit.test(sp)) {
                        subCurrent += sp;
                        finalChunks.push(subCurrent.trim());
                        subCurrent = '';
                    } else {
                        subCurrent += sp;
                    }
                }
                if (subCurrent.trim()) finalChunks.push(subCurrent.trim());
            } else {
                finalChunks.push(chunk);
            }
        }

        return finalChunks.filter(c => c.length > 0);
    }

    function cleanupDebateUI() {
        // Fresh debate session — release the per-hit shot lock so the player
        // can fire again in the next round.
        shotCooldown = false;
        nsdIntroPlaying = false;
        document.body.classList.remove('dangan-nsd-lie-armed');
        if (playbackTimerId) {
            window.clearTimeout(playbackTimerId);
            playbackTimerId = null;
        }
        if (statementAnimation) {
            try { statementAnimation.cancel(); } catch {}
            statementAnimation = null;
        }
        if (statementEl) {
            statementEl.remove();
            statementEl = null;
        }
        if (detachReticleSway) {
            try { detachReticleSway(); } catch {}
            detachReticleSway = null;
        }
        if (debateOverlay) {
            debateOverlay.remove();
            debateOverlay = null;
        }
        // Also clear any lingering statements / white noise from the body
        document.querySelectorAll('.dangan-floating-statement').forEach(el => el.remove());
        clearAllWhiteNoise();
        hoveredWhiteNoise = null;
        clearWnSpaceTimers();
        
        document.body.classList.remove('dangan-mpd-active');
        stopDebatesTrack?.();
        unsuppressVisualizer?.();
        document.getElementById('dangan-chapter-label')?.style.removeProperty('display');
        document.getElementById('dangan-trial-context-panel')?.style.removeProperty('display');
        nsdActiveBullets  = null;
        tempBullet        = null;
        shiftRightPressed = false;
        if (scanningAudio) { scanningAudio.pause(); scanningAudio = null; }
        cancelAbsorb();
        // MPD cleanup
        if (mpdLockTimer) { clearTimeout(mpdLockTimer); mpdLockTimer = null; }
        clearMpdRTimers();
        for (let c = 0; c < 3; c++) {
            try { mpdColAnims[c]?.cancel(); } catch {}
            mpdColAnims[c] = null;
            mpdColEls[c]?.remove();
            mpdColEls[c] = null;
        }
        mpdScenarios            = null;
        mpdColumnSpeakers       = [null, null, null];
        mpdLockActive           = false;
        mpdFreeColumn           = -1;
        mpdChainBreakCount      = 0;
        mpdWeakPointEl          = null;
        mpdSkillBetaBlock       = false;
        mpdSkillSeatingPlanCopy = false;
        clearTimeout(adjacentHideTimer); adjacentHideTimer = null;
        if (revolverSpinRaf) { cancelAnimationFrame(revolverSpinRaf); revolverSpinRaf = null; }
        revolverAngle = 0;
        revolverTarget = 0;
        if (btConcentrateRaf) { cancelAnimationFrame(btConcentrateRaf); btConcentrateRaf = null; }
        btCharge = 1.0;
        btConcentrateActive = false;
        btLastTs = null;
        shiftLeftPressed = false;
        if (btSlowmoAudio) { btSlowmoAudio.pause(); btSlowmoAudio.currentTime = 0; btSlowmoAudio = null; }
        if (ffAudio) { ffAudio.pause(); ffAudio.currentTime = 0; ffAudio = null; }
        seatingDebugMode = 'circle';
        lastSeatingDebugSpeaker = null;

        paradeController?.stop();
        paradeController = null;
        nsdShiftParadeStop?.();
        nsdShiftParadeStop = null;
        // Snapshot final portrait URLs before they're invalidated by the token increment.
        // The last active speaker's updateDebatePortraits call may still be awaiting getSpriteUrl
        // when cleanupDebateUI runs, causing the token check to abort the cache write.
        // Reading .src from the live elements captures whatever the browser already loaded.
        if (portraitSpeaker) {
            const cSrc = portraitImgEl?.src;
            const lSrc = portraitLeftEl?.src;
            const rSrc = portraitRightEl?.src;
            if (cSrc) {
                characterSpriteUrls.set(normalizeSeatName(portraitSpeaker), cSrc);
                characterSpriteUrls.set(firstToken(portraitSpeaker), cSrc);
            }
            const { left: lName, right: rName } = getSeatingNeighbors(portraitSpeaker);
            if (lSrc && lName) {
                characterSpriteUrls.set(normalizeSeatName(lName), lSrc);
                characterSpriteUrls.set(firstToken(lName), lSrc);
            }
            if (rSrc && rName) {
                characterSpriteUrls.set(normalizeSeatName(rName), rSrc);
                characterSpriteUrls.set(firstToken(rName), rSrc);
            }
        }
        portraitImgEl = null;
        portraitLeftEl = null;
        portraitRightEl = null;
        const lastDebateSpeaker = portraitSpeaker;
        portraitSpeaker = null;
        portraitToken++;
        const vnWrapper = document.querySelector('#visual-novel-wrapper');
        if (vnWrapper) vnWrapper.style.visibility = '';
        fadeInChatUI();
        // Snap GCP to the last debate speaker so chat view resumes on them
        if (lastDebateSpeaker) {
            const snapIdx = findSeatIndex(lastDebateSpeaker);
            if (snapIdx >= 0) gcpPositionSlots(snapIdx);
        }
        characterEmotions = new Map();
        if (cutsceneOverlay) {
            cutsceneOverlay.remove();
            cutsceneOverlay = null;
        }
        const notif = document.getElementById('dangan-trial-pre-debate-notif');
        if (notif) notif.remove();
        
        const rebuttalNotif = document.getElementById('dangan-trial-rebuttal-notif');
        if (rebuttalNotif) rebuttalNotif.remove();
    }

    function showNonStopDebateCutscene() {
        if (cutsceneOverlay) return;
        cutsceneOverlay = document.createElement('div');
        cutsceneOverlay.id = 'dangan-nonstop-cutscene';
        cutsceneOverlay.innerHTML = `
            <div class="dangan-cutscene-camera">
                <div class="dangan-cutscene-bg"></div>
            </div>
            <div class="dangan-cutscene-banner">
                <div class="dangan-cutscene-banner-inner">NON-STOP DEBATE</div>
            </div>
        `;
        document.body.appendChild(cutsceneOverlay);
    }

    function endNonStopDebateCutscene() {
        if (!cutsceneOverlay) return Promise.resolve();
        return new Promise(resolve => {
            cutsceneOverlay.classList.add('dangan-cutscene-end');
            window.setTimeout(() => {
                if (cutsceneOverlay) {
                    cutsceneOverlay.remove();
                    cutsceneOverlay = null;
                }
                resolve();
            }, 520);
        });
    }

    async function buildDebateSections({ sectionsCount, onProgress }) {
        const context = getContextMessagesForTrial();
        const speakers = pickSpeakersFromContext(context);
        const usableSpeakers = speakers.length ? speakers : [{ name: '???', weight: 1 }];

        const poolSize = Math.min(
            usableSpeakers.length,
            Math.max(2, Math.min(5, Math.round(sectionsCount / 2)))
        );
        const selectedSpeakers = sampleWeightedWithoutReplacement(usableSpeakers, poolSize);
        if (!selectedSpeakers.length) return null;

        const sections = [];
        const debateSoFar = [];
        
        // Reset persistent history for the new debate
        persistentDebateHistory = [];

        for (let i = 0; i < sectionsCount; i++) {
            const speakerName = pickSpeakerWeighted(selectedSpeakers);
            const debateSoFarText = debateSoFar.length
                ? debateSoFar.map(line => `- ${line}`).join('\n')
                : '';
            
            try {
                const statement = await generateSectionStatement({
                    speakerName,
                    debateSoFarText,
                    context,
                    sectionIndex: i,
                    sectionsCount,
                });
                
                const parts = splitStatementIntoParts(statement).map(p => ({
                    ...p,
                    emotion: inferEmotionFromText(p.text),
                }));
                
                const bystanderNames = selectedSpeakers
                    .map(s => s.name)
                    .filter(n => n !== speakerName);
                const whiteNoiseReactions = await generateWhiteNoiseReactions(statement, bystanderNames);
                const section = { speakerName, statement, parts, whiteNoise: whiteNoiseReactions };
                sections.push(section);
                
                // Update shared debate state for next section's context
                const spoken = stripSurroundingQuotes(extractDialogueOnly(statement) || statement);
                if (spoken) {
                    const line = `${speakerName}: ${spoken}`;
                    debateSoFar.push(line);
                    persistentDebateHistory.push(line);
                    while (debateSoFar.length > 3) debateSoFar.shift();
                }

                // If this is part of startNonStopDebate, this global state allows partial debate starting if an error happens
                preparedDebateSections = sections;
            } catch (e) {
                console.error(`[Dangan][Trial] Error generating section ${i + 1}:`, e);
            }
            try { onProgress?.((i + 1) / sectionsCount); } catch {}
        }
        
        // Sync prompt immediately after building sections
        syncPrompt();
        
        return sections;
    }

    function getContextMessagesForTrial() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;
        const ctxMessages = chat ? mapContextChatMessages(chat) : [];
        const domMessages = ctxMessages.length ? [] : mapDomMessages(readDomChatMessages(40));
        const source = (ctxMessages.length ? ctxMessages : domMessages)
            .filter(m => !m.isSystem && m.text)
            .slice(-30);

        return source
            .map(m => ({
                isUser: m.isUser,
                name: m.name,
                text: m.text,
            }))
            .filter(m => m.text);
    }

    function pickSpeakersFromContext(context) {
        const members = getChatCardMembers();
        console.log(`[Dangan][Trial] Speaker candidates from group:`, members.map(m => m.name));

        if (members.length) {
            const counts = new Map();
            for (const m of context) {
                if (m.isUser) continue;
                const rawName = String(m.name || '').trim();
                if (!rawName) continue;
                const key = normalizeLooseName(rawName);
                counts.set(key, (counts.get(key) || 0) + 1);
            }

            const weighted = members.map(member => {
                const key = normalizeLooseName(member.name);
                const count = counts.get(key) || 0;
                return { name: member.name, weight: Math.max(1, count) };
            });

            const hasRealCounts = weighted.some(s => (counts.get(normalizeLooseName(s.name)) || 0) > 0);
            const pool = hasRealCounts
                ? weighted.filter(s => (counts.get(normalizeLooseName(s.name)) || 0) > 0)
                : weighted;

            const finalSpeakers = pool
                .filter(s => !isGroupMemberMuted(s.name))
                .filter(s => !isCharacterDead(s.name))
                .sort((a, b) => b.weight - a.weight);
            
            console.log(`[Dangan][Trial] Final speaker pool:`, finalSpeakers.map(s => s.name));
            return finalSpeakers;
        }

        const counts = new Map();
        for (const m of context) {
            if (m.isUser) continue;
            const name = String(m.name || '').trim();
            if (!name) continue;
            counts.set(name, (counts.get(name) || 0) + 1);
        }

        const fallbackSpeakers = Array.from(counts.entries())
            .filter(([name]) => !isCharacterDead(name))
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, weight: count }));
        
        console.log(`[Dangan][Trial] Fallback speaker pool (from history):`, fallbackSpeakers.map(s => s.name));
        return fallbackSpeakers;
    }

    function pickSpeakerWeighted(speakers) {
        const total = speakers.reduce((sum, s) => sum + (s.weight || 1), 0);
        let r = Math.random() * total;
        for (const s of speakers) {
            r -= (s.weight || 1);
            if (r <= 0) return s.name;
        }
        return speakers[0]?.name || '???';
    }

    async function generateSectionStatement({ speakerName, debateSoFarText, context, sectionIndex, sectionsCount }) {
        const contextLines = context
            .slice(-14)
            .map(m => `${m.isUser ? 'YOU' : m.name}: ${m.text}`)
            .join('\n');

        const sourceText = typeof getCharacterSourceText === 'function'
            ? String(getCharacterSourceText(speakerName) || '').trim()
            : '';

        // Capture current debate state for persistent context injection
        const debateMarker = `[NSD_SECTION_${sectionIndex + 1}_OF_${sectionsCount}]`;
        
        const prompt = `
You are ${speakerName}.

Write the next spoken line for a Danganronpa-style Non-stop Debate.

Rules:
- Stay fully in character.
- Output ONLY spoken dialogue in double quotes.
- No narration, no actions, no inner thoughts.
- 1–2 sentences.
- Use facts and implications from the context.
- Your line should respond naturally to what others have said so far.
- Inside the quotes, you MUST mark EXACTLY ONE weak point (a contradiction or key claim) using [[WEAK POINT]] format.
- Example: "The [[locked door]] proves that the killer must still be inside this very room!"
- The weak point should be short: 1-3 words.
- No other markup and no speaker labels.

MARKER: ${debateMarker}

CHARACTER DATA:
${sourceText || 'NO CHARACTER DATA AVAILABLE.'}

DEBATE SO FAR (most recent lines):
${debateSoFarText || 'NONE'}

RECENT CONTEXT:
${contextLines}

SECTION: ${sectionIndex + 1} / ${sectionsCount}
`.trim();

        if (typeof generateTrialDialogue !== 'function') {
            return ensureSingleWeakPointMarker('...');
        }

        // Inject the debate context into the global session prompt so the AI "sees" it during generation
        const ctx = window.SillyTavern?.getContext?.();
        const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
        if (typeof setPrompt === 'function') {
            const historyPrompt = `[DANGANRONPA DEBATE HISTORY]\n${debateSoFarText || 'Debate just started.'}`;
            setPrompt('dangan_debate_history', historyPrompt, 1, 0, false, 'system');
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            const out = String(
                await generateTrialDialogue(prompt, {
                    maxTokens: 160,
                    temperature: 0.75 + attempt * 0.1,
                }) || ''
            ).trim();

            const dialogueOnly = extractDialogueOnly(out);
            const candidate = dialogueOnly || sanitizeDialogueFallback(out);
            if (!candidate) continue;

            const normalized = sanitizeDebateLine(`"${candidate}"`);
            const withWeak = ensureSingleWeakPointMarker(normalized);
            if (withWeak && withWeak !== '...') return withWeak;
        }

        return ensureSingleWeakPointMarker('...');
    }

    // Generate 4 short bystander reactions to a debate statement.
    // Returns a string[] or null if generation is unavailable or fails.
    async function generateWhiteNoiseReactions(statement, bystanderNames) {
        if (typeof generateTrialDialogue !== 'function') return null;

        const nameList = bystanderNames.length
            ? bystanderNames.slice(0, 6).join(', ')
            : 'the other students';

        const prompt = `You are generating background crowd noise for a Danganronpa-style class trial.
The following statement was just made:
"${stripSurroundingQuotes(statement)}"

Write exactly 4 short, raw reactions from ${nameList} watching the debate.
Rules:
- Each reaction is 2–7 words. No names, no punctuation beyond ! ? ... or —
- Make them varied: shocked, dismissive, panicked, muttering, angry, etc.
- Output EXACTLY 4 lines, one reaction per line. Nothing else.`.trim();

        try {
            const out = String(
                await generateTrialDialogue(prompt, { maxTokens: 80, temperature: 0.9 }) || ''
            ).trim();

            const lines = out
                .split('\n')
                .map(l => l.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim())
                .filter(l => l.length >= 2 && l.length <= 60);

            return lines.length >= 2 ? lines.slice(0, 6) : null;
        } catch {
            return null;
        }
    }

    // Build an array of Mass Panic Debate scenarios via the same LLM pipeline
    // we use for NSD. Each scenario is { texts: [{text, speaker, whiteNoise?}, x3] }
    // with one column wrapped in [[…]] to mark the weak point.
    async function buildMpdScenarios({ scenarioCount, onProgress }) {
        const context = getContextMessagesForTrial();
        const speakers = pickSpeakersFromContext(context);
        const usableSpeakers = speakers.filter(s => s && s.name) ;
        if (usableSpeakers.length < 3) return null;

        const poolSize = Math.min(usableSpeakers.length, Math.max(3, Math.min(8, scenarioCount + 2)));
        const speakerPool = sampleWeightedWithoutReplacement(usableSpeakers, poolSize);
        if (speakerPool.length < 3) return null;

        // Reset persistent history for the new debate
        persistentDebateHistory = [];
        const scenarios = [];
        const debateSoFar = [];

        for (let i = 0; i < scenarioCount; i++) {
            // Pick 3 distinct speakers for this scenario, weighted by pool weight
            const pickPool = speakerPool.slice();
            const speakerTrio = [];
            for (let p = 0; p < 3 && pickPool.length; p++) {
                const total = pickPool.reduce((sum, s) => sum + (s.weight || 1), 0);
                let r = Math.random() * total;
                let chosenIdx = 0;
                for (let j = 0; j < pickPool.length; j++) {
                    r -= (pickPool[j].weight || 1);
                    if (r <= 0) { chosenIdx = j; break; }
                }
                speakerTrio.push(pickPool[chosenIdx]);
                pickPool.splice(chosenIdx, 1);
            }
            if (speakerTrio.length < 3) break;

            const weakColumn = Math.floor(Math.random() * 3);
            const debateSoFarText = debateSoFar.length
                ? debateSoFar.map(line => `- ${line}`).join('\n')
                : '';

            try {
                const lines = await generateMpdScenarioStatements({
                    speakerTrio,
                    weakColumn,
                    debateSoFarText,
                    context,
                    scenarioIndex: i,
                    scenarioCount,
                });
                if (!lines || lines.length !== 3) {
                    console.warn(`[Dangan][Trial] MPD scenario ${i + 1} returned ${lines?.length || 0} lines — skipping.`);
                    continue;
                }

                const texts = lines.map((text, col) => ({
                    text,
                    speaker: speakerTrio[col].name,
                    isWeakPoint: col === weakColumn,
                    emotion: inferEmotionFromText(text),
                }));

                // White-noise reactions for the weak-point column only.
                const weakText = lines[weakColumn];
                const bystanderNames = speakerPool
                    .map(s => s.name)
                    .filter(n => !speakerTrio.find(t => t.name === n));
                const whiteNoise = await generateWhiteNoiseReactions(weakText, bystanderNames);
                if (whiteNoise) texts[weakColumn].whiteNoise = whiteNoise;

                scenarios.push({ texts });

                // Push spoken dialogue to debate history (sans the [[…]] markers).
                lines.forEach((text, col) => {
                    const stripped = String(text || '').replace(/\[\[/g, '').replace(/\]\]/g, '');
                    const spoken = stripSurroundingQuotes(extractDialogueOnly(stripped) || stripped);
                    if (spoken) {
                        const line = `${speakerTrio[col].name}: ${spoken}`;
                        debateSoFar.push(line);
                        persistentDebateHistory.push(line);
                    }
                });
                while (debateSoFar.length > 6) debateSoFar.shift();
            } catch (e) {
                console.error(`[Dangan][Trial] Error generating MPD scenario ${i + 1}:`, e);
            }
            try { onProgress?.((i + 1) / scenarioCount); } catch {}
        }

        syncPrompt();
        return scenarios;
    }

    // One LLM call → 3 simultaneous shouted lines for an MPD scenario; the
    // weakColumn slot gets wrapped in [[…]] so it's flagged as the weak spot.
    async function generateMpdScenarioStatements({ speakerTrio, weakColumn, debateSoFarText, context, scenarioIndex, scenarioCount }) {
        const contextLines = context
            .slice(-12)
            .map(m => `${m.isUser ? 'YOU' : m.name}: ${m.text}`)
            .join('\n');

        const speakerList = speakerTrio
            .map((s, i) => `Column ${i + 1}: ${s.name}${i === weakColumn ? '  ← WEAK-POINT speaker' : ''}`)
            .join('\n');

        const prompt = `
You are scripting a Danganronpa-style Mass Panic Debate. Three students shout over each other simultaneously — one of them lets slip the weak point that drives the debate.

SCENARIO ${scenarioIndex + 1} / ${scenarioCount}

SPEAKERS (left → right column order):
${speakerList}

Rules:
- Output EXACTLY 3 lines, one per column in order, no labels, no numbering, no blank lines.
- Each line is a single spoken sentence (6–18 words), in double quotes.
- Stay in character for each speaker. Lines should feel like they're being shouted simultaneously — overlapping accusations, panic, deflection.
- Column ${weakColumn + 1}'s line is the WEAK POINT. Wrap its FULL sentence (inside the quotes) in [[double brackets]]. Example: "[[The locked door proves the killer is still in this room!]]"
- The other two lines must NOT contain [[…]] markers.
- No narration, no actions, no inner thoughts, no speaker labels.

DEBATE SO FAR (most recent lines):
${debateSoFarText || 'NONE'}

RECENT CHAT CONTEXT:
${contextLines}
`.trim();

        if (typeof generateTrialDialogue !== 'function') return null;

        for (let attempt = 0; attempt < 2; attempt++) {
            const out = String(
                await generateTrialDialogue(prompt, {
                    maxTokens: 220,
                    temperature: 0.78 + attempt * 0.08,
                }) || ''
            ).trim();

            const rawLines = out
                .split('\n')
                .map(l => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^\s*[-*•]\s*/, '').trim())
                .filter(l => l.length > 0)
                .slice(0, 3);
            if (rawLines.length !== 3) continue;

            // Ensure exactly one [[…]] and it's on the weak-point line.
            const stripMarkers = (s) => s.replace(/\[\[/g, '').replace(/\]\]/g, '');
            const finalLines = rawLines.map((line, i) => {
                let body = stripMarkers(line);
                // Pull text out of surrounding quotes for inner wrapping, then re-quote.
                const inner = extractDialogueOnly(body) || stripSurroundingQuotes(body);
                if (!inner) return null;
                if (i === weakColumn) return `"[[${inner.replace(/^\[\[|\]\]$/g, '')}]]"`;
                return `"${inner}"`;
            });

            if (finalLines.every(Boolean)) return finalLines;
        }

        return null;
    }

    function sanitizeDebateLine(text) {
        let t = String(text || '').replace(/\r?\n+/g, ' ').trim();
        t = t.replace(/^[^a-zA-Z0-9]*[A-Za-z0-9 _-]{1,32}:\s*/, '');
        t = extractDialogueOnly(t) || t;
        return stripSurroundingQuotes(t);
    }

    function ensureSingleWeakPointMarker(text) {
        let raw = String(text || '').trim();
        
        // 1. Try to fix common AI mistakes with the format
        raw = raw.replace(/\[\[?([^\]]+)\]?\]/g, '[[$1]]'); // Fix single brackets
        raw = raw.replace(/\*\*([^*]+)\*\*/g, '[[$1]]'); // Use bold text as weak points if marker missing
        
        // 2. Check for existing valid marker — preserve it exactly as written
        const existing = raw.match(/\[\[([^\]]+)\]\]/);
        if (existing) {
            const rawWeak = String(existing[1] || '').trim().replace(/\s+/g, ' ');
            return raw.replace(/\[\[[^\]]+\]\]/, `[[${rawWeak}]]`);
        }

        // 3. Fallback: Force mark a word if no marker found
        const clean = raw.replace(/\s+/g, ' ').trim();
        if (!clean || clean === '...') return '[[...]]';

        const words = clean.split(' ').filter(Boolean);
        const chosen = pickCompactWeakPoint(words);
        if (!chosen) return `[[${words[0] || '...'}]]`;

        // Look for the word in the original text to replace it with [[ ]]
        // Use regex for case-insensitive whole word replacement
        const escapedChosen = escapeRegExp(chosen);
        const re = new RegExp(`\\b${escapedChosen}\\b`, 'i');
        if (re.test(clean)) {
            return clean.replace(re, `[[${chosen}]]`);
        }

        // Ultimate fallback
        return `[[${chosen}]] ${clean.replace(new RegExp(escapedChosen, 'gi'), '').trim()}`;
    }

    function normalizeLooseToken(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/^[^\w]+|[^\w]+$/g, '')
            .trim();
    }

    function shrinkWeakPoint(text) {
        const raw = String(text || '').trim().replace(/\s+/g, ' ');
        if (!raw) return '...';
        const words = raw.split(' ').filter(Boolean);
        if (words.length <= 3) return raw;
        return pickCompactWeakPoint(words);
    }

    function pickCompactWeakPoint(words) {
        const stop = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for', 'from', 'with',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'that', 'this', 'these', 'those',
            'i', 'you', 'we', 'they', 'he', 'she', 'him', 'her', 'them', 'my', 'your', 'our', 'their',
        ]);

        const cleaned = words
            .map(w => String(w || '').replace(/^[^\w]+|[^\w]+$/g, ''))
            .filter(Boolean);

        const candidates = cleaned
            .filter(w => w.length >= 4 && !stop.has(w.toLowerCase()))
            .sort((a, b) => b.length - a.length);

        return candidates[0] || cleaned[0] || '...';
    }

    function splitStatementIntoParts(statement) {
        let raw = String(statement || '').trim().replace(/\s+/g, ' ');
        if (!raw) return [];

        // Mutual exclusivity: if both markers are present, agree wins — strip weak point brackets
        if (/\[\[[^\]]+\]\]/.test(raw) && /\(\([^)]+\)\)/.test(raw)) {
            raw = raw.replace(/\[\[\s*([^\]]+?)\s*\]\]/g, '$1');
        }

        const weakMatch = raw.match(/\[\[([^\]]+)\]\]/);
        const weakToken = weakMatch ? String(weakMatch[1] || '').trim().replace(/\s+/g, ' ') : '';
        const hasAgree  = /\(\([^)]+\)\)/.test(raw);

        return [{
            text: raw,
            isWeakPoint: Boolean(weakToken),
            weakMarkup: weakToken,
            hasAgree,
        }];
    }

    function extractDialogueOnly(text) {
        const raw = String(text || '');
        const matches = [];

        const pushMatches = (re) => {
            let m;
            while ((m = re.exec(raw)) !== null) {
                if (m[1]) matches.push(m[1]);
            }
        };

        pushMatches(/"([^"]+)"/g);
        pushMatches(/“([^”]+)”/g);

        const combined = matches.map(s => s.trim()).filter(Boolean).join(' ');
        return combined.trim();
    }

    function sanitizeDialogueFallback(text) {
        const raw = String(text || '').trim();
        if (!raw) return '';

        const firstLine = raw.split(/\r?\n/).map(l => l.trim()).find(Boolean) || '';
        if (!firstLine) return '';

        const stripped = firstLine
            .replace(/^[A-Za-z0-9 _-]{1,32}:\s*/, '')
            .replace(/^\*+|\*+$/g, '')
            .replace(/^\(+|\)+$/g, '')
            .replace(/^\[+|\]+$/g, '')
            .trim();

        if (!stripped) return '';

        const maybeNarration = /^(narration|thoughts?|action|inner|system)\b/i.test(stripped);
        if (maybeNarration) return '';

        return stripped;
    }

    function stripSurroundingQuotes(text) {
        const t = String(text || '').trim();
        return t
            .replace(/^["“]+/, '')
            .replace(/["”]+$/, '')
            .trim();
    }

    function readDomChatMessages(limit = 30) {
        const nodes = Array.from(document.querySelectorAll('.mes')).slice(-limit);
        return nodes.map(node => {
            const textEl = node.querySelector('.mes_text');
            const chName = node.getAttribute('ch_name') || node.getAttribute('name') || '';
            const isUser = node.getAttribute('is_user') === 'true';
            const isSystem = node.getAttribute('is_system') === 'true';
            const text = String(textEl?.innerHTML || textEl?.textContent || '').trim();
            return {
                isUser,
                isSystem,
                ch_name: chName,
                text,
            };
        });
    }

    const htmlDecodeBuffer = document.createElement('div');
    function toPlainText(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        htmlDecodeBuffer.innerHTML = raw;
        return String(htmlDecodeBuffer.textContent || htmlDecodeBuffer.innerText || '').trim();
    }

    function mapContextChatMessages(chat) {
        return chat.map((msg) => {
            const isUser =
                String(msg?.is_user ?? msg?.isUser ?? '').toLowerCase() === 'true' ||
                msg?.is_user === true ||
                msg?.isUser === true;
            const isSystem =
                String(msg?.is_system ?? msg?.isSystem ?? msg?.is_system_message ?? '').toLowerCase() === 'true' ||
                msg?.is_system === true ||
                msg?.isSystem === true ||
                msg?.is_system_message === true;
            const name = String(msg?.name || msg?.ch_name || msg?.character_name || msg?.display_name || '').trim();
            const textRaw = msg?.mes ?? msg?.message ?? msg?.content ?? msg?.swipe_info?.[msg?.swipe_id || 0]?.mes ?? '';
            const text = toPlainText(textRaw);
            return { isUser, isSystem, name, text };
        }).filter(m => m.text);
    }

    function mapDomMessages(domMessages) {
        return domMessages.map(m => ({
            isUser: Boolean(m?.isUser),
            isSystem: Boolean(m?.isSystem),
            name: String(m?.ch_name || '').trim(),
            text: toPlainText(m?.text || ''),
        })).filter(m => m.text);
    }

    function normalizeLooseName(name) {
        return String(name || '').trim().toLowerCase();
    }

    function isGroupMemberMuted(name) {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return false;
        const groupId = ctx.groupId ?? ctx.group_id;
        if (groupId == null || groupId === '') return false;

        const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
        const target = normalizeLooseName(name);
        const ch = chars.find(c => normalizeLooseName(c?.name) === target);
        if (!ch) return false;

        if (ch.muted === true) return true;
        if (ch.is_muted === true) return true;
        if (ch.isMuted === true) return true;
        if (ch.mute === true) return true;
        if (ch.disabled === true) return true;
        if (ch.is_disabled === true) return true;
        if (ch.enabled === false) return true;
        if (ch.isEnabled === false) return true;

        return false;
    }

    // Returns true if the character has "Temporarily disable automatic replies" toggled on.
    // Reads the live DOM — most reliable since ST toggles .disabled on .group_member immediately.
    function isCharacterDead(name) {
        const needle      = normalizeLooseName(name);
        const needleFirst = needle.split(/\s+/)[0];

        // Primary: check the extension's own characters Map (set via social panel)
        if (characters instanceof Map) {
            for (const char of characters.values()) {
                if (!char.dead) continue;
                const memberName  = normalizeLooseName(String(char.name || ''));
                const memberFirst = memberName.split(/\s+/)[0];
                if (memberName === needle || memberFirst === needleFirst) return true;
            }
        }

        // Fallback: SillyTavern disabled group-member DOM element
        const disabled = document.querySelectorAll('.group_member.disabled .ch_name');
        for (const el of disabled) {
            const memberName  = normalizeLooseName(el.textContent?.trim() || '');
            const memberFirst = memberName.split(/\s+/)[0];
            if (memberName === needle || memberFirst === needleFirst) return true;
        }
        return false;
    }

    function isCharacterMissing(name) {
        const needle      = normalizeLooseName(name);
        const needleFirst = needle.split(/\s+/)[0];
        if (characters instanceof Map) {
            for (const char of characters.values()) {
                if (!char.missing) continue;
                const memberName  = normalizeLooseName(String(char.name || ''));
                const memberFirst = memberName.split(/\s+/)[0];
                if (memberName === needle || memberFirst === needleFirst) return true;
            }
        }
        return false;
    }

    function getChatCardMembers() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return [];

        const groupId = ctx.groupId ?? ctx.group_id;
        const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
        
        // Strategy 1: Characters directly in the context (unmuted candidates)
        const ctxCandidates = chars
            .filter(c => isSpeakerCandidateChar(c, ctx))
            .map(c => String(c?.name || '').trim())
            .filter(n => n && !isAssistantLikeName(n));

        // Strategy 2: Intersection of DOM and context (active speakers)
        const domNames = getActiveChatMemberNamesFromDom();
        if (domNames.length && ctxCandidates.length) {
            const domSet = new Set(domNames.map(normalizeLooseName));
            const intersected = ctxCandidates.filter(n => domSet.has(normalizeLooseName(n)));
            if (intersected.length) {
                return Array.from(new Set(intersected))
                    .map(name => ({ name }));
            }
        }

        // Strategy 3: Group metadata
        const groupNames = getActiveGroupMemberNames(ctx);
        if (groupId != null && groupId !== '' && groupNames.length) {
            const filteredGroup = groupNames.filter(n => !isGroupMemberMuted(n) && !isAssistantLikeName(n));
            if (filteredGroup.length) {
                return Array.from(new Set(filteredGroup))
                    .map(name => ({ name }));
            }
        }

        // Strategy 4: Fallback to any unmuted character in the current context
        if (ctxCandidates.length) {
            return Array.from(new Set(ctxCandidates))
                .map(name => ({ name }));
        }

        // Strategy 5: Single character chat fallback
        const activeCharId = ctx.characterId ?? ctx.character_id ?? ctx.charaId ?? ctx.char_id;
        if (activeCharId != null) {
            const sid = String(activeCharId).trim();
            const allChars = [
                ...chars,
                ...(Array.isArray(window.characters) ? window.characters : []),
            ];
            const found = allChars.find(c => String(c?.id ?? c?.characterId ?? c?.char_id ?? '').trim() === sid);
            const name = String(found?.name || ctx.characterName || ctx.character_name || '').trim();
            if (name && !isGroupMemberMuted(name) && !isAssistantLikeName(name)) return [{ name }];
        }

        // Strategy 6: Absolute fallback - if we still have nothing, take anyone from ctx.characters
        if (chars.length) {
            const first = chars.find(c => !isAssistantLikeName(c?.name));
            if (first?.name) return [{ name: first.name }];
        }

        return [];
    }

    function getActiveGroupMemberNames(ctx) {
        const names = new Set();
        const groupId = ctx.groupId ?? ctx.group_id;
        if (groupId == null || groupId === '') return [];

        const meta = window.chat_metadata || ctx.chat_metadata || ctx.chatMetadata || null;
        const sources = [
            ctx.group,
            ctx.groupChat,
            ctx.group_chat,
            meta?.group_chat,
            meta?.groupChat,
            window.groupChat,
            window.group_chat,
            window.group,
            window.groups,
            window.group_chats,
            window.groupChats,
        ];

        const allChars = [
            ...(Array.isArray(ctx.characters) ? ctx.characters : []),
            ...(Array.isArray(window.characters) ? window.characters : []),
        ];

        const addName = (n) => {
            const name = String(n || '').trim();
            if (name) names.add(name);
        };

        const resolveFromId = (id) => {
            const sid = String(id || '').trim();
            if (!sid) return;
            const found = allChars.find(c =>
                String(c?.id ?? c?.characterId ?? c?.char_id ?? c?.chara_id ?? c?.member_id ?? '').trim() === sid
            );
            if (found?.name) addName(found.name);
        };

        const matchesGroup = (obj) => {
            if (!obj || groupId == null) return true;
            const gid = String(groupId).trim();
            const oid = obj?.groupId ?? obj?.group_id ?? obj?.id ?? obj?.chat_id ?? obj?.groupChatId ?? obj?.group_chat_id;
            if (oid == null) return true;
            return String(oid).trim() === gid;
        };

        const pullFromAny = (obj) => {
            if (!obj) return;

            if (typeof obj === 'number') {
                resolveFromId(obj);
                return;
            }
            if (typeof obj === 'string') {
                addName(obj);
                return;
            }

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    if (item && typeof item === 'object' && !matchesGroup(item)) continue;
                    pullFromAny(item);
                }
                return;
            }

            if (obj && typeof obj === 'object' && !matchesGroup(obj)) return;

            const gid = String(groupId).trim();
            if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, gid)) {
                pullFromAny(obj[gid]);
                return;
            }

            const maybeMembers = obj.members
                || obj.member_list
                || obj.characters
                || obj.participants
                || obj.group_members
                || obj.memberIds
                || obj.member_ids
                || obj.characterIds
                || obj.character_ids;
            if (Array.isArray(maybeMembers)) {
                for (const item of maybeMembers) pullFromAny(item);
                return;
            }

            const id = obj.id ?? obj.characterId ?? obj.char_id ?? obj.member_id;
            const name = obj.name ?? obj.ch_name ?? obj.character_name ?? obj.display_name;
            if (name) addName(name);
            else if (id != null) resolveFromId(id);
        };

        for (const s of sources) {
            if (s && typeof s === 'object' && !Array.isArray(s)) {
                const gid = String(groupId).trim();
                if (Object.prototype.hasOwnProperty.call(s, gid)) {
                    pullFromAny(s[gid]);
                    continue;
                }
            }
            if (Array.isArray(s)) {
                const gid = String(groupId).trim();
                const matched = s.find(item => item && typeof item === 'object' && matchesGroup(item) && String(item?.id ?? item?.groupId ?? item?.group_id ?? '').trim() === gid);
                if (matched) {
                    pullFromAny(matched);
                    continue;
                }
            }
            pullFromAny(s);
        }

        return Array.from(names);
    }

    function getActiveChatMemberNamesFromDom() {
        const names = new Set();
        const selectors = [
            '[data-character-name]',
            '[data-ch-name]',
            '[data-name]',
            '.group_member_name',
            '.group-member-name',
            '.group_member .name',
            '.group-member .name',
            '.member .name',
            '.member-name',
            '.char_name',
            '.character_name',
        ];

        for (const sel of selectors) {
            const nodes = Array.from(document.querySelectorAll(sel));
            for (const node of nodes) {
                const attrName =
                    node.getAttribute?.('data-character-name') ||
                    node.getAttribute?.('data-ch-name') ||
                    node.getAttribute?.('data-name') ||
                    '';
                const text = String(attrName || node.textContent || '').trim();
                if (text && text.length <= 64) names.add(text);
            }
        }

        return Array.from(names);
    }

    function isGroupChat() {
        const ctx = window.SillyTavern?.getContext?.();
        const groupId = ctx?.groupId ?? ctx?.group_id;
        return groupId != null && groupId !== '';
    }

    function isAssistantLikeName(name) {
        const n = normalizeLooseName(name);
        if (!n) return false;
        return n === 'assistant' || n === 'sillytavern' || n === 'system' || n === 'narrator'
            || n === 'prome user sprite (do not click)';
    }

    function getPromeInfo() {
        const prome = extensionSettings?.['Prome-VN-Extension'];
        if (!prome?.enableUserSprite || !prome?.userSprite) return null;
        return { spritePack: prome.userSprite };
    }

    function isSpeakerCandidateChar(char, ctx) {
        if (!char) return false;
        if (char.is_user === true || char.isUser === true) return false;
        if (char.is_assistant === true || char.isAssistant === true) return false;
        if (char.is_system === true || char.isSystem === true) return false;
        if (char.is_narrator === true || char.isNarrator === true) return false;
        if (char.disabled === true || char.is_disabled === true) return false;
        if (char.enabled === false || char.isEnabled === false) return false;
        // Exclude Prome VN Extension dummy character
        if (String(char.avatar || '').trim() === 'prome-user') return false;

        const name = String(char.name || '').trim();
        if (!name) return false;
        if (isAssistantLikeName(name)) return false;
        if (isGroupMemberMuted(name)) return false;

        const assistantId = ctx?.assistantId ?? ctx?.assistant_id ?? ctx?.assistantCharacterId ?? ctx?.assistant_character_id;
        if (assistantId != null) {
            const cid = String(char?.id ?? char?.characterId ?? char?.char_id ?? '').trim();
            if (cid && String(assistantId).trim() === cid) return false;
        }

        return true;
    }

    function sampleWeightedWithoutReplacement(items, count) {
        const pool = items.map(it => ({ ...it, weight: Number(it.weight) || 1 })).filter(it => it.name);
        const picked = [];
        while (picked.length < count && pool.length) {
            const total = pool.reduce((sum, it) => sum + it.weight, 0);
            let r = Math.random() * total;
            let idx = 0;
            for (; idx < pool.length; idx++) {
                r -= pool[idx].weight;
                if (r <= 0) break;
            }
            const chosen = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
            picked.push({ name: chosen.name, weight: chosen.weight });
        }
        return picked;
    }

    function endTrial() {
        console.log('[Dangan][Trial] Ending trial and clearing persistent state.');
        persistentDebateHistory = [];
        trialActive      = false;
        debateSeatingPlan = null;
        unmountTrialAesthetic();
        destroyGroupChatPortraits();
        document.getElementById('dangan-trial-pre-debate-notif')?.remove();
        document.getElementById('dangan-trial-context-panel')?.remove();
        trialContext = { topic: '', goal: '', suspects: [] };
        setState(TrialPhases.IDLE);

        // Clear from extension settings (per chat/group)
        if (typeof saveSettingsDebounced === 'function') {
            const key = getTrialPersistenceKey();
            if (extensionSettings[extensionName].trials && extensionSettings[extensionName].trials[key]) {
                extensionSettings[extensionName].trials[key].currentTrialState = TrialPhases.IDLE;
                extensionSettings[extensionName].trials[key].persistentDebateHistory = [];
                extensionSettings[extensionName].trials[key].trialTopic = '';
                extensionSettings[extensionName].trials[key].trialGoal  = '';
                saveSettingsDebounced();
            }
        }
    }

    function initFromPersistentState() {
        const key = getTrialPersistenceKey();
        const saved = extensionSettings[extensionName]?.trials?.[key];

        const savedState = saved?.currentTrialState;
        const savedHistory = saved?.persistentDebateHistory;

        // Always reset — prevents stale trialActive from a previous chat leaking in
        trialActive = false;
        unmountTrialAesthetic();
        currentState = TrialPhases.IDLE;
        persistentDebateHistory = [];
        trialContext = { topic: '', goal: '', suspects: [] };

        if (Array.isArray(savedHistory)) {
            persistentDebateHistory = savedHistory;
        }

        if (saved?.trialTopic) trialContext.topic = saved.trialTopic;
        if (saved?.trialGoal)  trialContext.goal  = saved.trialGoal;

        if (savedState && savedState !== TrialPhases.IDLE) {
            trialActive = true;
            mountTrialAesthetic();
            console.log(`[Dangan][Trial] Restoring trial state for ${key}: ${savedState}`);
            // Transition back to the saved state.
            // Returning to PRE_DEBATE is safer after a refresh for stability.
            if (savedState === TrialPhases.NON_STOP_DEBATE
             || savedState === TrialPhases.MASS_PANIC_DEBATE
             || savedState === TrialPhases.TRUTH_BULLET_EXPLANATION) {
                setState(TrialPhases.PRE_DEBATE);
            } else {
                setState(savedState);
            }
        } else {
            // IDLE state — still sync UI so the panel appears if we're in a group chat
            syncUI();
        }
    }

    // Call init on manager creation
    setTimeout(initFromPersistentState, 500);

    // Safety poll: keep the trial aesthetic in sync even when CHAT_CHANGED
    // doesn't fire (e.g. navigating to/from the Assistant chat).
    setInterval(() => {
        const shouldShow = trialActive && isGroupChat();
        const isShown = document.body.classList.contains('dangan-trial-active');
        if (isShown && !shouldShow) {
            unmountTrialAesthetic();
        } else if (!isShown && shouldShow) {
            mountTrialAesthetic();
        }
    }, 1500);

    // ── Group Chat Portrait Stage ─────────────────────────────────────────────

    // Returns true when the named character is muted (disabled) in the current ST group.
    function isCharacterMuted(charName) {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return false;
        const groupId = ctx.groupId ?? ctx.group_id;
        if (!groupId) return false;
        const allGroups = ctx.groups ?? window.groups ?? [];
        const group = Array.isArray(allGroups) ? allGroups.find(g => g.id === groupId) : null;
        if (!group?.disabled_members?.length) return false;
        const chars = Array.isArray(ctx.characters) ? ctx.characters
                    : Array.isArray(window.characters) ? window.characters : [];
        const stChar = chars.find(c => normalizeSeatName(String(c?.name || '')) === normalizeSeatName(charName));
        return stChar ? group.disabled_members.includes(stChar.avatar) : false;
    }

    const GCP_GAP        = 60;   // gap between characters
    const GCP_MAX_ROT    = 20;   // maximum rotation of
    const GCP_ANIM_SPEED = 14;   // peak slots per second
    const GCP_MIN_SPEED  = 0.8;  // floor speed (slots/s) near target

    function gcpSlotW() { return Math.round(window.innerWidth / 3); }

    function gcpSlotTransform(x) {
        const sw   = gcpSlotW();
        const w2   = window.innerWidth / 2;
        const dist = (x + sw / 2 - w2) / w2;
        return `translateX(${x}px) rotateY(${(-dist * GCP_MAX_ROT).toFixed(1)}deg)`;
    }

    // Circular shortest-path difference: how many slots is slot i from the center?
    function gcpCircularDiff(i, centerIdx) {
        const n = gcpSlots.length;
        if (n <= 1) return i - centerIdx;
        let d = i - centerIdx;
        if (d >  n / 2) d -= n;
        if (d < -n / 2) d += n;
        return d;
    }

    // Create a full-screen background overlay that tiles the current #bg1 image
    // horizontally so the panorama can loop seamlessly as the carousel wraps.
    function gcpBuildBgLoop() {
        const bg1 = document.getElementById('bg1');
        if (!bg1 || gcpBgLoopEl) return;
        const bgImg = bg1.style.backgroundImage || getComputedStyle(bg1).backgroundImage;
        if (!bgImg || bgImg === 'none') return;

        gcpBgLoopEl = document.createElement('div');
        gcpBgLoopEl.id = 'dangan-gcp-bg-loop';
        gcpBgLoopEl.style.backgroundImage = bgImg;
        gcpBgCurrentPx = 0;
        document.body.insertBefore(gcpBgLoopEl, bg1.nextSibling);

        // Probe image natural size → rendered width at current viewport height → pixel offsets
        const urlMatch = bgImg.match(/url\(["']?([^"')]+)["']?\)/);
        if (urlMatch) {
            const probe = new Image();
            probe.onload = () => {
                if (!gcpBgLoopEl) return;
                gcpBgImgWidth = Math.ceil(probe.naturalWidth * window.innerHeight / probe.naturalHeight);
                // Set explicit pixel background-size so the browser tiles at exactly
                // the same interval as our pan math — eliminates sub-pixel seam gaps.
                gcpBgLoopEl.style.backgroundSize = `${gcpBgImgWidth}px 100%`;
                gcpPanBackground(Math.round(gcpCurrentFloat), false);
            };
            probe.src = urlMatch[1];
        }
    }

    // Pan the background overlay.  animate=false snaps immediately; animate=true transitions.
    function gcpPanBackground(idx, animate = true) {
        const bg = gcpBgLoopEl;
        if (!bg) return;
        const n = gcpSlots.length;
        if (n <= 1) return;

        if (gcpBgImgWidth > 0) {
            const pxPerSlot = gcpBgImgWidth / n;
            const targetPx  = -(idx * pxPerSlot);

            // Wrap detection: if the short circular path crosses the image seam,
            // snap the element to an equivalent tile position, then animate the
            // short distance so the jump is invisible.
            if (animate && Math.abs(targetPx - gcpBgCurrentPx) > gcpBgImgWidth / 2) {
                const snapPx = gcpBgCurrentPx + (targetPx > gcpBgCurrentPx ? gcpBgImgWidth : -gcpBgImgWidth);
                bg.classList.remove('dangan-gcp-pan');
                bg.style.backgroundPositionX = `${snapPx.toFixed(1)}px`;
                void bg.offsetWidth; // flush style to suppress transition on snap
                gcpBgCurrentPx = snapPx;
            }

            bg.classList.toggle('dangan-gcp-pan', animate);
            bg.style.backgroundPositionX = `${targetPx.toFixed(1)}px`;
            gcpBgCurrentPx = targetPx;
        } else {
            // Percentage fallback before probe image loads
            const pct = (idx / Math.max(1, n - 1)) * 100;
            bg.classList.toggle('dangan-gcp-pan', animate);
            bg.style.backgroundPositionX = `${pct.toFixed(2)}%`;
        }
    }

    // Immediately position all slots at the given center index (suppresses CSS transition).
    function gcpPositionSlots(centerFloat) {
        if (!gcpSlots.length) return;
        const sw    = gcpSlotW();
        const total = sw + GCP_GAP;
        const cx    = window.innerWidth / 2 - sw / 2;
        gcpSlots.forEach((slot, i) => {
            slot.el.style.transition = 'none';
            slot.el.style.transform  = gcpSlotTransform(cx + gcpCircularDiff(i, centerFloat) * total);
        });
        gcpCurrentFloat = centerFloat;
        gcpPanBackground(Math.round(centerFloat), false);
    }

    // Returns the names of members currently in this group chat.
    // Uses multiple strategies so we get the actual group members — not the full roster.
    function getGroupChatMemberNames() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return [];
        if (!ctx.groupId && !ctx.group_id) return [];

        const allChars = [
            ...(Array.isArray(ctx.characters)    ? ctx.characters    : []),
            ...(Array.isArray(window.characters) ? window.characters : []),
        ];

        const nameFromAvatar = (avatar) => {
            if (!avatar) return null;
            const ch = allChars.find(c => c?.avatar === avatar);
            return ch?.name ? String(ch.name).trim() : null;
        };

        // Strategy 1 — Prome VN Extension expression holders.
        // Prome populates #visual-novel-wrapper with exactly the current group's members
        // and stamps each holder with data-avatar="CharacterName.png".
        // window.groups is not a global in SillyTavern 1.16, so this is the most
        // reliable way to enumerate the current group without the full character roster.
        const promeHolders = document.querySelectorAll('#visual-novel-wrapper [data-avatar]');
        if (promeHolders.length) {
            const names = [];
            const seen  = new Set();
            for (const el of promeHolders) {
                const avatar = el.getAttribute('data-avatar');
                if (!avatar || avatar === 'prome-user' || seen.has(avatar)) continue;
                seen.add(avatar);
                const name = nameFromAvatar(avatar);
                if (name) names.push(name);
            }
            if (names.length) return names;
        }

        // Strategy 2 — groups list from context or global (ctx.groups is available even
        // when window.groups is module-internal in ST 1.16).
        const groupId  = String(ctx.groupId ?? ctx.group_id ?? '').trim();
        const allGroups = [
            ...(Array.isArray(ctx.groups)          ? ctx.groups          : []),
            ...(Array.isArray(window.groups)        ? window.groups       : []),
            ...(Array.isArray(window.group_chats)   ? window.group_chats  : []),
            ...(Array.isArray(window.groupChats)    ? window.groupChats   : []),
        ];
        const group = allGroups.find(g => String(g?.id ?? '').trim() === groupId);
        if (group) {
            const names = (Array.isArray(group.members) ? group.members : [])
                .map(nameFromAvatar).filter(Boolean);
            if (names.length) return names;
        }

        // Strategy 3 — ST context group object.
        const ctxGroup = ctx.group ?? ctx.groupChat ?? ctx.group_chat;
        if (ctxGroup && Array.isArray(ctxGroup.members)) {
            const names = ctxGroup.members.map(nameFromAvatar).filter(Boolean);
            if (names.length) return names;
        }

        // Strategy 4 — scan chat history for unique senders.
        // Characters who have spoken are definitely group members regardless of
        // how many Prome holders have been populated.
        if (Array.isArray(ctx.chat) && ctx.chat.length) {
            const names = [...new Set(
                ctx.chat
                    .filter(m => !m.is_user && m.name)
                    .map(m => String(m.name).trim())
                    .filter(Boolean)
            )];
            if (names.length) return names;
        }

        return [];
    }

    // Flat layout for non-trial group chats: all sprites visible at once, side by side.
    // Slot width shrinks to fit all n characters across the viewport with no overlap.
    // Height scaling is applied via transform:scale on the img (immune to CSS cascade /
    // flex percentage resolution quirks), growing each character upward from their feet.
    function gcpPositionSlotsFlat() {
        const n  = gcpSlots.length;
        if (!n) return;
        // Each slot gets an equal share of the viewport; capped at the carousel width
        // for single-character chats.
        const sw = n > 1 ? Math.floor(window.innerWidth / n) : gcpSlotW();
        // Left edge of the leftmost slot, so the group is centred.
        const cx = window.innerWidth / 2 - (n * sw) / 2;

        // Half-sprite-mode horizontal-fit clamp. The default scale is 3 (see
        // style.css), but in a group chat the per-character share of the
        // viewport is much narrower, so a 3× sprite spills into neighbouring
        // slots and off-screen at the edges. Compute the largest scale that
        // keeps a typical-aspect (≈0.5 width:height) sprite within its
        // horizontal share. Solo (n=1) gets the FULL viewport — gcpSlotW()
        // returns innerWidth/3 for solo (carousel-compatible) but the sprite
        // has no neighbour to overlap, so we ignore sw and use innerWidth.
        //
        // Also cap slot height so the TALLEST character in the group still
        // fits vertically. scaleWrap scales each sprite by heightPx /
        // BASE_PORTRAIT_PX with origin center-bottom; tall characters
        // (Sonia, Gundham) come out at 1.15-1.25×, and at slot height 85vh
        // that pushes the visual top above the viewport — heads clip. The
        // safe slot height is innerHeight / maxWrapScale, then capped at 85vh
        // so short-character groups still get the lift-the-half-sprite effect.
        if (gcpStage) {
            const ASPECT_GUESS = 0.5;
            const spriteWidthAtBaseHeight = ASPECT_GUESS * BASE_PORTRAIT_PX;
            const perCharWidth = window.innerWidth / Math.max(1, n);
            // Cap at 2× — 3× was clipping characters whose sprite art has
            // empty space above their head (visible canvas portion ends up
            // off-screen). 2× shows the top 50% of the source which always
            // covers head + upper torso. Multi-character chats still scale
            // down further when perCharWidth / spriteWidthAtBaseHeight < 2.
            const halfFitScale = Math.max(1, Math.min(2, perCharWidth / spriteWidthAtBaseHeight));
            gcpStage.style.setProperty('--gcp-half-scale', halfFitScale.toFixed(3));

            // scaleWrap on each slot scales by (heightPx / BASE_PORTRAIT_PX)
            // with origin center-bottom. Visual top of a slot ends up at
            //   slot.bottom_y - maxWrapScale * ACCESSORY_FACTOR * slot.height
            // because Danganronpa sprite art routinely has accessories
            // (Sonia's pigtails, Gundham's hair antenna, Ibuki's horns,
            // Nagito's messy hair) extending well above the geometric head
            // pixel, drawn right up to the top of the source PNG with no
            // transparent padding. The 1.5 factor reserves room for that
            // overshoot without having to measure each sprite individually.
            // TOP_MARGIN_PX adds a fixed buffer so the tallest accessory
            // lands at least that many pixels below the viewport top.
            const TOP_MARGIN_PX = 120;
            const ACCESSORY_FACTOR = 1.5;
            const maxWrapScale = Math.max(
                1,
                ...gcpSlots.map(s => (s.heightPx || BASE_PORTRAIT_PX) / BASE_PORTRAIT_PX),
            );
            const targetSlotPx = Math.floor(0.65 * window.innerHeight);
            const safeSlotPx = Math.floor(
                (window.innerHeight - TOP_MARGIN_PX) / (maxWrapScale * ACCESSORY_FACTOR),
            );
            gcpStage.style.setProperty(
                '--gcp-half-slot-height',
                `${Math.min(targetSlotPx, safeSlotPx)}px`,
            );
        }

        gcpSlots.forEach((slot, i) => {
            const scale = (slot.heightPx || BASE_PORTRAIT_PX) / BASE_PORTRAIT_PX;
            const x     = cx + i * sw;

            slot.el.style.width      = `${sw}px`;
            slot.el.style.height     = `${BASE_PORTRAIT_PX}px`;
            slot.el.style.transition = 'none';
            slot.el.style.transform  = gcpSlotTransform(x);

            // Scale via the scaleWrap so VFX animation classes on img never
            // override the character's base proportional size.
            slot.scaleWrap.style.transformOrigin = 'center bottom';
            slot.scaleWrap.style.transform       = `scale(${scale.toFixed(3)})`;
        });
        gcpCurrentFloat = (n - 1) / 2;
    }

    // Scroll to targetIdx using a JS RAF loop so all slots move as a unit.
    // Every frame derives each slot's position from a single animated offset value,
    // which eliminates the "stuck neighbor" artifact that independent per-slot CSS
    // transitions produce (neighbors would reach the edge and stall while the center
    // was still animating in from off-screen).
    //
    // Off-path slots (those that would travel the long way around the ring) are placed
    // off-screen on the correct side at the start of the animation so they flow in from
    // outside rather than teleporting mid-scroll.  gcpCircularDiff is only called once
    // per slot at setup time — never during the tick — which prevents the discontinuity
    // that occurs when centerFloat crosses the n/2 ring boundary.
    function gcpScrollTo(targetIdx) {
        if (gcpCurrentFloat === targetIdx) return;
        if (gcpAnimRafId) { cancelAnimationFrame(gcpAnimRafId); gcpAnimRafId = null; }
        if (!gcpSlots.length) return;

        const startFloat  = gcpCurrentFloat;
        const travelDelta = gcpCircularDiff(targetIdx, Math.round(startFloat));
        if (travelDelta === 0) { gcpCurrentFloat = targetIdx; return; }

        const DURATION  = 1700; // ms — same feel as old CSS transition
        const startTime = performance.now();
        const easeOut   = t => 1 - Math.pow(1 - t, 3);

        const sw    = gcpSlotW();
        const total = sw + GCP_GAP;
        const cx    = window.innerWidth / 2 - sw / 2;

        // Pre-compute each slot's starting diff (in slot-widths from center).
        // On-path slots use their actual fractional start position.
        // Off-path slots are placed one full ring further in the scroll direction so they
        // enter from off-screen on the correct side instead of teleporting.
        const startDiffs = gcpSlots.map((_, i) => {
            const endDiff   = gcpCircularDiff(i, targetIdx);
            const startDiff = gcpCircularDiff(i, startFloat);
            // On-path: plain subtraction lands exactly on endDiff (no ring wrap needed).
            return (startDiff - travelDelta === endDiff) ? startDiff : endDiff + travelDelta;
        });

        let lastRoundedIdx = Math.round(startFloat);

        function tick(now) {
            const rawT   = Math.min(1, (now - startTime) / DURATION);
            const offset = travelDelta * easeOut(rawT);

            gcpSlots.forEach((slot, i) => {
                slot.el.style.transition = 'none';
                slot.el.style.transform  = gcpSlotTransform(cx + (startDiffs[i] - offset) * total);
            });
            gcpCurrentFloat = startFloat + travelDelta * easeOut(rawT);

            const roundedIdx = Math.round(gcpCurrentFloat);
            if (roundedIdx !== lastRoundedIdx) {
                lastRoundedIdx = roundedIdx;
                notifyGcpSeatingListRenderers();
            }

            if (rawT < 1) {
                gcpAnimRafId = requestAnimationFrame(tick);
                return;
            }

            // Snap to exact integer positions and restore CSS transitions.
            gcpAnimRafId = null;
            gcpCurrentFloat = targetIdx;
            gcpSlots.forEach((slot, i) => {
                slot.el.style.transform  = gcpSlotTransform(cx + gcpCircularDiff(i, targetIdx) * total);
                slot.el.style.transition = '';
            });
            notifyGcpSeatingListRenderers();
        }

        // Fire camera, background pan, and seating list immediately so the UI
        // responds at once rather than waiting for the animation to finish.
        if (trialActive && targetIdx !== gcpLastCamIdx) {
            gcpLastCamIdx = targetIdx;
            applyCamShot(gcpStage, gcpBgLoopEl);
        }
        gcpPanBackground(targetIdx, true);
        notifyGcpSeatingListRenderers();

        gcpAnimRafId = requestAnimationFrame(tick);
    }

    // GCP-local index lookup — gcpSlots is a filtered subset of debateSeatingPlan.
    function gcpFindIdx(name) {
        const key   = normalizeSeatName(name);
        const exact = gcpIndexMap.get(key);
        if (exact !== undefined) return exact;
        // First-token fallback
        const first = firstToken(name);
        for (const [k, v] of gcpIndexMap) {
            if (firstToken(k) === first) return v;
        }
        return -1;
    }

    // Builds one DOM slot and registers it in gcpIndexMap at the given index.
    // Sync already-loaded Prome expression imgs into GCP slots that have no sprite yet.
    // Called after the stage is built to catch expressions that fired before we were ready.
    function gcpSyncFromPromeExpressions() {
        if (!gcpSlots.length) return;
        // Query both the standard VN wrapper and any Prome [data-avatar] portrait holders.
        // The latter covers the common case where Prome fires expressions into named containers
        // (e.g. <div data-avatar="akane-owari"><img class="expression" ...>).
        document.querySelectorAll(
            '#visual-novel-wrapper img.expression, #expression-holder img.expression, [data-avatar] img.expression'
        ).forEach(imgEl => {
            const srcAttr = imgEl.getAttribute?.('src');
            if (!srcAttr) return;
            const src = imgEl.src;
            if (!src || src === location.href) return;
            if (imgEl.closest?.('#expression-prome-user')) return;
            // Prefer the data-avatar attribute (most reliable Prome identifier); fall back to URL folder.
            const dataAvatar = imgEl.closest?.('[data-avatar]')?.getAttribute?.('data-avatar');
            const folderHint = dataAvatar
                ? dataAvatar.toLowerCase().replace(/[-_]/g, ' ').trim()
                : (() => {
                    try {
                        const parts = new URL(src, location.href).pathname.split('/').filter(Boolean);
                        if (parts.length < 2) return null;
                        return decodeURIComponent(parts[parts.length - 2]).toLowerCase().replace(/[-_]/g, ' ').trim();
                    } catch { return null; }
                })();
            if (!folderHint) return;
            const folderFirst = firstToken(folderHint);
            for (const slot of gcpSlots) {
                if (slot.isDead || slot.isPlayer || slot.isMissing) continue;
                // Only fill slots with no src yet — don't override successfully loaded sprites
                if (slot.img?.getAttribute?.('src')) continue;
                const slotName = normalizeSeatName(slot.name);
                if (slotName === folderHint || (folderFirst === folderHint && firstToken(slot.name) === folderFirst)) {
                    if (!slot.el.classList.contains('gcp-dead')) slot.img.src = src;
                    break;
                }
            }
        });
    }

    function gcpMakeSlot(name, url, isDead, idx, isMissing = false) {
        const sw = gcpSlotW();
        const el = document.createElement('div');
        el.className = 'dangan-gcp-slot';
        el.style.cssText = `width:${sw}px;height:${portraitSlotHeightPx(name)}px;`;
        if (isDead) el.classList.add('gcp-dead');
        if (isMissing) el.classList.add('gcp-missing');
        if (trialActive && isGroupChat() && needsGymnasticsHorse(name)) {
            el.classList.add('has-horse');
            const horse = document.createElement('img');
            horse.className = 'dangan-gcp-horse';
            horse.src = getAssetUrl('gymnastics-horse.png');
            horse.alt = '';
            el.appendChild(horse);
        }
        const img = document.createElement('img');
        img.alt = name;
        if (url && !isMissing) img.src = url;
        if (isMissing) img.style.display = 'none';
        // scaleWrap isolates the height-proportional scale transform so that VFX
        // animation classes added to img never override the character's base scale.
        const scaleWrap = document.createElement('div');
        scaleWrap.className = 'dangan-gcp-scale-wrap';
        scaleWrap.appendChild(img);
        el.appendChild(scaleWrap);
        if (trialActive && isGroupChat()) {
            const lectern = document.createElement('img');
            lectern.className = 'dangan-gcp-lectern';
            lectern.src = (getLecternUrl ? getLecternUrl() : getAssetUrl('lectern.webp'));
            lectern.alt = '';
            el.appendChild(lectern);
        }
        gcpStage.appendChild(el);
        gcpIndexMap.set(normalizeSeatName(name), idx);
        return { name, el, img, scaleWrap, heightPx: portraitSlotHeightPx(name), isDead: !!isDead, isMissing: !!isMissing };
    }

    async function initGroupChatPortraits() {
        if (gcpStage || gcpInitializing) return;
        gcpInitializing = true;
        const ctx = window.SillyTavern?.getContext?.();
        const isGroup = !!ctx?.groupId;

        gcpStage = document.createElement('div');
        gcpStage.id = 'dangan-group-chat-stage';
        // If rebuilt while an actual debate (NSD/MPD) is running, keep it hidden to avoid
        // duplicating the debate overlay. Other non-IDLE states (TRUTH_BULLET_EXPLANATION
        // etc.) still want the carousel visible underneath.
        if (currentState === TrialPhases.NON_STOP_DEBATE || currentState === TrialPhases.MASS_PANIC_DEBATE) {
            gcpStage.style.display = 'none';
        }
        document.body.appendChild(gcpStage);
        document.body.classList.add('dangan-gcp-active');
        const initVisible = currentState !== TrialPhases.NON_STOP_DEBATE && currentState !== TrialPhases.MASS_PANIC_DEBATE;
        document.body.classList.toggle('dangan-gcp-visible', initVisible);
        gcpIndexMap = new Map();
        const stageRef = gcpStage; // capture ref to detect if destroyed mid-await


        try {
            if (isGroup) {
                // ── Group chat: sprite strip ──
                // Trial: use the cached/built seating plan (all characters, carousel).
                // Non-trial: read directly from window.groups so we only load the actual
                // members of this specific group, not the full character roster.
                const plan = trialActive ? getOrBuildSeatingPlan() : getGroupChatMemberNames();
                if (!plan.length) { gcpStage.remove(); gcpStage = null; document.body.classList.remove('dangan-gcp-active'); return; }

                // Resolve sprite URLs upfront; exclude muted-without-dead from the plan.
                console.log(`[Dangan][GCP] Building stage — plan (${plan.length}):`, plan);
                const resolved = await Promise.all(plan.map(async name => {
                    const muted   = isCharacterMuted(name);
                    const dead    = isCharacterDead(name);
                    const missing = isCharacterMissing(name);
                    if (missing) {
                        console.log(`[Dangan][GCP] "${name}" missing → no sprite`);
                        return { name, url: null, isDead: false, isMissing: true };
                    }
                    if (muted || dead) {
                        const deadUrl = await getSpriteUrl(name, 'dead').catch(() => null);
                        if (muted && !deadUrl) { console.log(`[Dangan][GCP] "${name}" muted+no dead sprite → excluded`); return null; }
                        const url = deadUrl ?? await getSpriteUrl(name, 'neutral').catch(() => null);
                        console.log(`[Dangan][GCP] "${name}" (dead=${dead}, muted=${muted}) → ${url ?? 'null'}`);
                        return { name, url, isDead: dead };
                    }
                    let url = await getSpriteUrl(name, 'neutral').catch(() => null);
                    if (!url && isMonokuma(name)) {
                        // Try the custom Game Master's sprite first when configured;
                        // fall back to bundled Monokuma art only in default mode.
                        const custom = typeof getCustomGameMasterName === 'function'
                            ? getCustomGameMasterName()
                            : null;
                        if (custom) {
                            url = await getSpriteUrl(custom, 'neutral').catch(() => null);
                        } else {
                            url = getMonokumaStaticUrl('neutral');
                        }
                    }
                    console.log(`[Dangan][GCP] "${name}" → ${url ?? 'null'}`);
                    return { name, url, isDead: false };
                }));

                // If destroyed by a concurrent call while we were awaiting sprites, abort.
                if (gcpStage !== stageRef) return;

                gcpSlots = resolved.filter(r => r && !isMonokuma(r.name)).map(({ name, url, isDead, isMissing }, i) =>
                    gcpMakeSlot(name, url, isDead, i, isMissing));

                // Mark the player's slot (Prome VN Extension) so it uses the Prome sprite.
                // Only shown during Class Trials — non-trial group chats don't show the player.
                // If the player is already in gcpSlots as a group member, update that slot in-place
                // rather than pushing a duplicate.
                const promeInfo = trialActive ? getPromeInfo() : null;
                if (promeInfo) {
                    const playerName  = ctx.name1 || ctx.user_name || ctx.userName || ctx.personaName || 'Player';
                    const playerKey   = normalizeSeatName(playerName);
                    const playerFirst = firstToken(playerName);
                    const playerUrl   = await getSpriteUrl(promeInfo.spritePack, 'neutral').catch(() => null);
                    if (gcpStage !== stageRef) return;
                    // Also match by Prome sprite pack name — the player may be using a
                    // character's sprites (e.g. "Gundham Tanaka") while their persona name
                    // differs (e.g. "Dawn"), which would otherwise create a duplicate slot.
                    // Sprite packs often use hyphenated folder names ("gundham-tanaka"),
                    // so normalise hyphens/underscores to spaces before token-matching.
                    const spritePackNorm = promeInfo.spritePack.replace(/[-_]/g, ' ');
                    const spriteKey      = normalizeSeatName(spritePackNorm);
                    const spriteFirst    = firstToken(spritePackNorm);
                    const existingIdx = gcpSlots.findIndex(
                        s => normalizeSeatName(s.name) === playerKey || firstToken(s.name) === playerFirst
                          || normalizeSeatName(s.name) === spriteKey  || firstToken(s.name) === spriteFirst
                    );
                    if (existingIdx >= 0) {
                        // Player already has a slot — just flag it and switch to Prome sprite
                        gcpSlots[existingIdx].isPlayer = true;
                        gcpSlots[existingIdx].img.src  = playerUrl;
                    } else {
                        // Player isn't in the group yet — add a fresh slot
                        const playerSlot = gcpMakeSlot(playerName, playerUrl, false, gcpSlots.length);
                        playerSlot.isPlayer = true;
                        gcpSlots.push(playerSlot);
                    }
                }

                // Apply last-known expressions from chat history so sprites don't all start neutral
                const initialEmotions = buildInitialEmotions();
                await Promise.all(gcpSlots.map(async slot => {
                    if (slot.isDead || slot.isPlayer || slot.isMissing) return;
                    const emotion = initialEmotions.get(slot.name);
                    if (!emotion || emotion === 'neutral') return;
                    const url = await getSpriteUrl(slot.name, emotion).catch(() => null);
                    if (url && gcpStage === stageRef) slot.img.src = url;
                }));

                // Snap to last speaker without animation. If the last message was the
                // human player's, target the isPlayer slot directly — its name in
                // gcpIndexMap can be the underlying character's, so a persona-name
                // lookup would miss it.
                const lastMsg = [...(ctx?.chat || [])].reverse().find(m => !m.is_system && m.name);
                let rawIdx = -1;
                if (lastMsg?.is_user) {
                    rawIdx = gcpSlots.findIndex(s => s.isPlayer);
                }
                if (rawIdx < 0 && lastMsg?.name) {
                    rawIdx = gcpFindIdx(lastMsg.name);
                }
                const initIdx = rawIdx >= 0 ? rawIdx : Math.round(Math.max(0, Math.min(gcpCurrentFloat, gcpSlots.length - 1)));
                if (trialActive) {
                    gcpBuildBgLoop();
                    gcpPositionSlots(initIdx);
                    gcpSyncFromPromeExpressions();
                    // Delayed second sync: Prome may still be resolving expression imgs when we first build.
                    setTimeout(() => gcpSyncFromPromeExpressions(), 600);
                } else {
                    gcpPositionSlotsFlat();
                    gcpSyncFromPromeExpressions();
                    setTimeout(() => gcpSyncFromPromeExpressions(), 600);
                    // Apply initial dim: highlight last speaker, dim everyone else.
                    // When the player spoke last, dim by slot identity (the player slot
                    // may have an NPC's name in gcpIndexMap, so a name compare misses it).
                    if (rawIdx >= 0) {
                        const speakerSlot = gcpSlots[rawIdx];
                        for (const slot of gcpSlots) {
                            slot.el.classList.toggle('dangan-gcp-dim', slot !== speakerSlot);
                        }
                    } else if (lastMsg?.name) {
                        const speakerKey = normalizeSeatName(lastMsg.name);
                        for (const slot of gcpSlots) {
                            slot.el.classList.toggle('dangan-gcp-dim', normalizeSeatName(slot.name) !== speakerKey);
                        }
                    }
                    // Safety net: Prome may still be populating holders when we first build.
                    // Watch #visual-novel-wrapper for new [data-avatar] insertions and rebuild
                    // if the count grows beyond what we loaded.
                    const vnWrapper = document.getElementById('visual-novel-wrapper');
                    if (vnWrapper) {
                        const builtCount = gcpSlots.length;
                        const observer = new MutationObserver(() => {
                            const promeCount = vnWrapper.querySelectorAll(
                                '[data-avatar]:not([data-avatar="prome-user"])'
                            ).length;
                            if (promeCount > builtCount) {
                                observer.disconnect();
                                const savedFloat = gcpCurrentFloat;
                                destroyGroupChatPortraits();
                                gcpCurrentFloat = savedFloat;
                                initGroupChatPortraits();
                            }
                        });
                        observer.observe(vnWrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-avatar'] });
                        // Disconnect after 8 s — Prome will have finished by then.
                        setTimeout(() => observer.disconnect(), 8000);
                    }
                }

            } else {
                // ── One-on-one chat: single centered sprite, height-scaled ──
                // Use ctx.characterId — the most reliable source for 1-on-1 chats.
                const charIdx = ctx?.characterId;
                const name = (Array.isArray(ctx?.characters) && charIdx !== undefined)
                    ? ctx.characters[charIdx]?.name
                    : null;
                if (!name) { gcpStage.remove(); gcpStage = null; document.body.classList.remove('dangan-gcp-active'); return; }

                const url = await getSpriteUrl(name, 'neutral').catch(() => null);
                if (gcpStage !== stageRef) return;
                gcpSlots = [gcpMakeSlot(name, url, false, 0)];
                gcpPositionSlots(0); // slot 0 centered, rotY = 0 (no cylinder warp)
                gcpSyncFromPromeExpressions();
            }
        } finally {
            gcpInitializing = false;
        }
        // Notify Trial Controls seating list to re-render with the freshly built gcpSlots
        notifyGcpSeatingListRenderers();
    }

    function updateGroupChatSpeaker(speakerName) {
        currentSpeaker = speakerName || null;
        // Keep the CG label in sync with whichever message is highlighted.
        if (cgNameTextEl) cgNameTextEl.textContent = currentSpeaker || '';

        // ── Monokuma: always handled via overlay, never via carousel ──────────
        if (isMonokuma(speakerName)) {
            const monoEmo = characterEmotions.get(speakerName) || characterEmotions.get('Monokuma') || 'neutral';
            showMonokumaOverlay(monoEmo);
            // Kick off GCP init in the background so the carousel is ready when
            // another character speaks next.
            if (!gcpStage) initGroupChatPortraits();
            return;
        }

        // Any non-Monokuma speaker: dismiss the overlay and restore the carousel.
        hideMonokumaOverlay();

        if (!gcpStage) {
            initGroupChatPortraits().then(() => {
                const idx = gcpFindIdx(speakerName);
                if (idx >= 0 && trialActive) gcpScrollTo(idx);
            });
            return;
        }

        const isGroup = !!(window.SillyTavern?.getContext?.()?.groupId);

        if (!isGroup) {
            // 1-on-1: update slot 0's sprite if the name differs (no scrolling needed)
            const slot = gcpSlots[0];
            if (!slot) return;
            if (normalizeSeatName(slot.name) !== normalizeSeatName(speakerName)) {
                slot.name = speakerName;
                slot.el.style.height = `${portraitSlotHeightPx(speakerName)}px`;
                gcpIndexMap = new Map([[normalizeSeatName(speakerName), 0]]);
                getSpriteUrl(speakerName, 'neutral')
                    .then(url => { if (url) slot.img.src = url; })
                    .catch(() => {});
            }
            return;
        }

        // Detect whether the speaker is the human player.
        // In a non-trial group chat the player has no slot in gcpIndexMap (slots are only
        // created for trials), so a normal name-lookup would return -1 and trigger a
        // needless rebuild that leaves all sprites undimmed.
        const pCtx = window.SillyTavern?.getContext?.();
        const pName = pCtx?.name1 || pCtx?.user_name || pCtx?.userName || pCtx?.personaName || '';
        const speakerIsPlayer = !!(pName && normalizeSeatName(speakerName) === normalizeSeatName(pName));

        if (speakerIsPlayer) {
            if (!trialActive) {
                // Non-trial: no player slot — dim every character slot to show nobody is speaking.
                for (const slot of gcpSlots) {
                    slot.el.classList.add('dangan-gcp-dim');
                }
                return;
            }
            // Trial: the player slot is marked with isPlayer; look it up by flag to avoid
            // persona-name vs character-name mismatches tripping the rebuild path.
            const playerSlotIdx = gcpSlots.findIndex(s => s.isPlayer);
            if (playerSlotIdx >= 0) {
                gcpScrollTo(playerSlotIdx);
                return;
            }
            // Player slot not yet in stage — fall through to normal lookup / rebuild.
        }

        // Group chat: scroll to speaker (trial) or rebuild if missing from filtered plan
        let idx = gcpFindIdx(speakerName);
        if (idx < 0) {
            const savedFloat = gcpCurrentFloat;
            if (trialActive) debateSeatingPlan = null;
            destroyGroupChatPortraits();
            gcpCurrentFloat = savedFloat;
            initGroupChatPortraits().then(() => {
                const newIdx = gcpFindIdx(speakerName);
                if (newIdx >= 0 && trialActive) gcpScrollTo(newIdx);
            });
            return;
        }

        if (trialActive) {
            gcpScrollTo(idx);
        } else {
            // Non-trial: no scrolling, but track the speaker index so that
            // getGcpImgForExpressionSrc's folder-match fallback (gcpCurrentFloat)
            // always points to the active speaker — making /emote work correctly.
            gcpCurrentFloat = idx;
            // Dim every slot except the current speaker to highlight who is talking.
            const speakerKey = normalizeSeatName(speakerName);
            for (const slot of gcpSlots) {
                slot.el.classList.toggle('dangan-gcp-dim', normalizeSeatName(slot.name) !== speakerKey);
            }
        }

        // Ensure every dead/silenced slot shows its dead sprite.
        // getSpriteUrl may fail at init time (sprite list not yet cached) so we retry lazily here.
        for (const slot of gcpSlots) {
            if (slot.isPlayer) continue;
            if (isCharacterDead(slot.name) || isSilenced(slot.name)) {
                getCharSpriteUrl(slot.name, 'dead')
                    .then(url => { if (url && slot.img) slot.img.src = url; })
                    .catch(() => {});
                if (!slot.el.classList.contains('gcp-dead')) slot.el.classList.add('gcp-dead');
            }
        }

        // Retry sprite load for the current speaker if their slot has no src yet.
        // This covers the common case where getSpriteUrl returned null at init time.
        const speakerSlot = gcpSlots[Math.round(gcpCurrentFloat)];
        if (speakerSlot && !speakerSlot.isDead && !speakerSlot.isPlayer && !speakerSlot.isMissing && !speakerSlot.img?.getAttribute?.('src')) {
            getCharSpriteUrl(speakerSlot.name, characterEmotions.get(speakerSlot.name) || 'neutral')
                .then(url => { if (url && speakerSlot.img && !speakerSlot.img.getAttribute('src')) speakerSlot.img.src = url; })
                .catch(() => {});
        }
    }

    function setGroupChatPortraitsVisible(visible) {
        if (gcpStage) gcpStage.style.display = visible ? '' : 'none';
        document.body.classList.toggle('dangan-gcp-visible', !!visible);
    }

    function destroyGroupChatPortraits() {
        hideMonokumaOverlay();
        document.getElementById('dangan-monokuma-overlay')?.remove();
        gcpInitializing = false; // unblock any init that was racing
        gcpLastCamIdx   = null;
        if (gcpAnimRafId) { cancelAnimationFrame(gcpAnimRafId); gcpAnimRafId = null; }
        gcpStage?.remove();
        gcpStage      = null;
        gcpSlots      = [];
        gcpIndexMap   = new Map();
        gcpBgLoopEl?.remove();
        gcpBgLoopEl   = null;
        gcpBgImgWidth = 0;
        gcpBgCurrentPx = 0;
        document.body.classList.remove('dangan-gcp-active', 'dangan-gcp-visible');
    }

    // Apply a CSS class to the Effects overlay and targeted character slots.
    // scope: 'speaker' → active speaker slot only | 'all' → every visible slot
    return {
        start: () => {
            trialActive = true;
            mountTrialAesthetic();
            setState(TrialPhases.PRE_DEBATE);
        },
        stop: () => {
            endTrial();
        },
        onChatChanged: () => {
            // Remove the existing panel so it can rebuild with fresh members/context
            document.getElementById('dangan-trial-pre-debate-notif')?.remove();
            document.getElementById('dangan-trial-context-panel')?.remove();
            // Reload persistent state for the new chat — resets trialActive and currentState
            // so lecterns/horses don't bleed in from a previous trial chat
            initFromPersistentState();
        },
        startMassPanicDebate: (rawScenarios) => {
            mpdScenarios = parseMpdScenarios(rawScenarios || []);
            setState(TrialPhases.MASS_PANIC_DEBATE);
        },
        debugStartNonStopDebateWithLines,
        onMessageSent,
        getState: () => currentState,
        refreshTrialBadge,
        // Call this when an external activity (interjection, PTA, minigame, etc.) has
        // finished so the controls panel is restored. No-op if a debate is still running.
        resumeAfterActivity: () => {
            if (!trialActive) return;
            if (currentState === TrialPhases.NON_STOP_DEBATE || currentState === TrialPhases.MASS_PANIC_DEBATE) return;
            setState(TrialPhases.PRE_DEBATE);
        },
        phases: TrialPhases,
        setTrialContext,
        getTrialContext: () => ({ ...trialContext, suspects: trialContext.suspects.slice() }),
        endTrial,
        initGroupChatPortraits,
        updateGroupChatSpeaker,
        setGroupChatPortraitsVisible,
        destroyGroupChatPortraits,
        showCounterBanner: () => showTrialBanner('counter'),
        getGcpInfo: async () => ({
            characters: await Promise.all(gcpSlots.map(async s => ({
                name:     s.name,
                src:      characterSpriteUrls.get(normalizeSeatName(s.name))
                       || characterSpriteUrls.get(firstToken(s.name))
                       || await getCharSpriteUrl(s.name, characterEmotions.get(s.name) || 'neutral').catch(() => null)
                       || s.img?.src
                       || null,
                height:   parseInt(s.el?.style.height) || 720,
                hasHorse: needsGymnasticsHorse(s.name),
            }))),
            currentIndex: Math.round(gcpCurrentFloat),
        }),
        getGcpSpeakerImg:  () => gcpSlots[Math.round(gcpCurrentFloat)]?.img  ?? null,
        getGcpSpeakerName: () => gcpSlots[Math.round(gcpCurrentFloat)]?.name ?? null,
        getGcpPlayerImg:   () => gcpSlots.find(s => s.isPlayer)?.img ?? null,
        // Re-runs the flat (non-trial) GCP layout so the dynamic CSS var
        // --gcp-half-slot-height gets recomputed. Used when the user toggles
        // half-sprite mode mid-chat — otherwise the slot height var stays
        // unset and the CSS fallback kicks in.
        recomputeGcpFlatLayout: () => {
            if (gcpStage && gcpSlots.length && !trialActive) gcpPositionSlotsFlat();
        },
        // Match an expression image src to the specific GCP slot whose sprite folder
        // matches the incoming URL. This routes /emote and AI expression changes to
        // the right character in a group chat rather than blindly updating whoever is
        // currently centered. Falls back to the current speaker if no folder match.
        getGcpImgForExpressionSrc: (src) => {
            if (!gcpSlots.length) return null;
            try {
                const parts = new URL(src, location.href).pathname.split('/').filter(Boolean);
                if (parts.length >= 2) {
                    // Raw folder for URL-to-URL comparison (Pass 1); normalized for name comparison (Pass 2).
                    const srcFolderRaw  = decodeURIComponent(parts[parts.length - 2]).toLowerCase();
                    // Monokuma is handled via overlay; route his expression to the overlay img
                    // so it updates there instead of falling through to a carousel slot.
                    if (srcFolderRaw === 'monokuma') {
                        return document.getElementById('dangan-monokuma-overlay')?.querySelector('img') ?? null;
                    }
                    // Normalize hyphens/underscores to spaces so "akane-owari" matches slot name "akane owari"
                    const srcFolder     = srcFolderRaw.replace(/[-_]/g, ' ').trim();
                    // Pass 1: folder-match using the slot's existing src URL (works once sprites are loaded)
                    for (const slot of gcpSlots) {
                        if (slot.isDead || !slot.img?.src) continue;
                        try {
                            const slotParts = new URL(slot.img.src, location.href).pathname.split('/').filter(Boolean);
                            if (slotParts.length >= 2) {
                                const slotFolder = decodeURIComponent(slotParts[slotParts.length - 2]).toLowerCase();
                                if (slotFolder === srcFolderRaw) return slot.img;
                            }
                        } catch { /* ignore bad slot src */ }
                    }
                    // Pass 2: name-match for slots that have no src yet (sprites not pre-loaded via getSpriteUrl).
                    // Hyphens/underscores already normalized above; compare against the lowercased seat name.
                    const srcFirst = firstToken(srcFolder);
                    for (const slot of gcpSlots) {
                        if (slot.isDead || slot.isMissing) continue;
                        const slotName = normalizeSeatName(slot.name);
                        if (slotName === srcFolder) return slot.img;
                        // First-token fallback: only when srcFolder is a single word (e.g. "akane"),
                        // to avoid ambiguous matches between characters with the same first name.
                        if (srcFirst === srcFolder && firstToken(slot.name) === srcFirst) return slot.img;
                    }
                }
            } catch { /* ignore bad src */ }
            // Fallback: current centered speaker
            return gcpSlots[Math.round(gcpCurrentFloat)]?.img ?? null;
        },
        markCharacterExecuted: async (characterName) => {
            if (!characterName) return;
            const key = normalizeSeatName(characterName);
            const slot = gcpSlots.find(s => normalizeSeatName(s.name) === key);
            if (slot) {
                slot.isDead = true;
                slot.el.classList.add('gcp-dead');
                const deadUrl = await getSpriteUrl(characterName, 'dead').catch(() => null);
                if (deadUrl) slot.img.src = deadUrl;
            }
            notifyGcpSeatingListRenderers();
        },
    };
}
