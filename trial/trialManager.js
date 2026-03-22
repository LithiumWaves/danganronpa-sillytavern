// trial/trialManager.js

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
        getSpriteUrl,
        playSfx,
        getSfx,
        characters,
        playDebatesTrack,
        stopDebatesTrack,
        playPanicTrack,
        suppressVisualizer,
        unsuppressVisualizer,
        onStartHangmansGambit,
        onStartPanicTalkAction,
        onStartVotingTime,
        onStartMassPanicDebate,
        getEquippedSkillsSnapshot,
    } = deps;

    function getAssetUrl(name) {
        const base = extensionFolderPath || `scripts/extensions/third-party/${extensionName}`;
        return `${base}/assets/classtrial/${name}`;
    }

    let currentState = TrialPhases.IDLE;
    let currentDebateSections = 0;
    let selectedTruthBulletIndex = 0;
    let debateOverlay = null;
    let reticleEl = null;
    let cutsceneOverlay = null;
    let statementEl = null;
    let statementAnimation = null;
    let playbackTimerId = null;
    let currentSpeaker = null;
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
    let characterEmotions = new Map();
    let lastHitBullet = null;
    let lastHitWeakPoint = null;
    let rebuttalPromptActive = false;
    let persistentDebateHistory = [];
    let speedModifier = 1.0;
    let revolverAngle  = 0;
    let revolverTarget = 0;
    let revolverSpinRaf = null;
    let seatingDebugMode = 'circle'; // 'circle' | 'line'
    let lastSeatingDebugSpeaker = null;
    let btCharge = 1.0;
    let btConcentrateActive = false;
    let btConcentrateRaf = null;
    let btLastTs = null;
    const BT_DRAIN_RATE    = 1 / 4;  // full drain in 4 s
    const BT_RECHARGE_RATE = 1 / 8;  // full refill in 8 s
    let nsdActiveBullets = null;  // filtered bullet list for the current NSD; null = use full list
    let adjacentHideTimer = null;
    let keysPressed = new Set();
    let shiftLeftPressed = false;
    let btSlowmoAudio = null;
    let ffAudio = null;
    let nsdKeyAC = null;
    let perjuryChargeTimer = null;
    let isPerjuryCharged = false;
    let lastHitWasPerjury = false;
    let shotCooldown = false;
    let activeWhiteNoiseEls = [];
    let hoveredWhiteNoise = null;
    let lastCursorX = 0;
    let lastCursorY = 0;
    let wnSpaceHeld = false;
    let wnSpaceTapTimer = null;
    let wnSpaceRepeatTimer = null;

    // ── Mass Panic Debate state ───────────────────────────────────────────────
    let mpdScenarios        = null;
    let mpdLockActive       = false;
    let mpdFreeColumn       = -1;
    let mpdChainBreakCount  = 0;
    let mpdWeakPointEl      = null;
    let mpdLockTimer        = null;
    let mpdColEls           = [null, null, null];
    let mpdColAnims         = [null, null, null];
    let mpdRHeld            = false;
    let mpdRTapTimer        = null;
    let mpdRRepeatTimer     = null;
    const MPD_CHAIN_BREAKS_NEEDED      = 8;
    const MPD_LOCK_CHANCE_PER_SCENARIO = 0.35;
    let mpdSkillBetaBlock       = false;
    let mpdSkillSeatingPlanCopy = false;

    function isDebateActive() {
        return currentState === TrialPhases.NON_STOP_DEBATE || currentState === TrialPhases.MASS_PANIC_DEBATE;
    }

    function parseMpdScenarios(rawScenarios) {
        return rawScenarios.map(s => {
            let weakSpotColumn = -1;
            const texts = (s.texts || []).map((t, col) => {
                const hasWeak = /\[\[.*?\]\]/.test(String(t.text || ''));
                if (hasWeak && weakSpotColumn === -1) weakSpotColumn = col;
                return { text: String(t.text || ''), speaker: String(t.speaker || ''), whiteNoise: t.whiteNoise || null, isWeakPoint: hasWeak };
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
        if (wasDebate && !isDebate) {
            cleanupNSDListeners();
        } else if (isDebate && !wasDebate) {
            setupNSDListeners();
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
            if (e.code === 'ShiftLeft') shiftLeftPressed = true;
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
            if (currentState === TrialPhases.NON_STOP_DEBATE ||
                (currentState === TrialPhases.MASS_PANIC_DEBATE && mpdSkillSeatingPlanCopy)) {
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
                    const bullets = getDebateBullets();
                    if (bullets.length > 1) {
                        if (e.key === 'ArrowDown') {
                            selectedTruthBulletIndex = (selectedTruthBulletIndex + 1) % bullets.length;
                            revolverTarget += 40;
                        } else {
                            selectedTruthBulletIndex = (selectedTruthBulletIndex - 1 + bullets.length) % bullets.length;
                            revolverTarget -= 40;
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
            if (e.code === 'ShiftLeft') shiftLeftPressed = false;
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

            if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
                // Block shots at locked columns
                const col = Math.max(0, Math.min(2, Math.floor((e.clientX / window.innerWidth) * 3)));
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
            shiftLeftPressed = false;
            updateSpeedModifier();
            clearTimeout(perjuryChargeTimer);
            showPerjuryVfx(false);
        }, { signal });

        // White noise hover tracking via rect check (pointer-events: none on elements)
        window.addEventListener('mousemove', (e) => {
            lastCursorX = e.clientX;
            lastCursorY = e.clientY;
            if (!isDebateActive() || !activeWhiteNoiseEls.length) {
                if (hoveredWhiteNoise) { hoveredWhiteNoise.classList.remove('hovered'); hoveredWhiteNoise = null; }
                return;
            }
            const cx = e.clientX, cy = e.clientY;
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
        }, { signal });
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

    function cleanupNSDListeners() {
        if (nsdKeyAC) {
            nsdKeyAC.abort();
            nsdKeyAC = null;
        }
        keysPressed.clear();
        speedModifier = 1.0;
        clearWnSpaceTimers();
        clearMpdRTimers();
    }

    function applyCartridgeTheme(mod) {
        const cylinderImg = document.getElementById('dangan-cylinder-img');
        document.querySelectorAll('.dangan-bullet-cartridge').forEach(c => {
            if (mod > 1.0) {
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
        if (cylinderImg) {
            if (mod > 1.0) {
                cylinderImg.style.filter = 'sepia(1) hue-rotate(10deg) saturate(8) brightness(1.4) drop-shadow(0 0 18px rgba(255,220,0,0.9)) drop-shadow(0 0 45px rgba(255,180,0,0.6))';
                if (indexEl) { indexEl.style.color = '#ffd700'; indexEl.style.textShadow = '0 0 12px rgba(255,220,0,0.9), 0 0 30px rgba(255,180,0,0.6), 2px 2px 4px rgba(0,0,0,0.9)'; }
            } else if (mod < 1.0) {
                cylinderImg.style.filter = 'sepia(1) hue-rotate(285deg) saturate(8) brightness(1.3) drop-shadow(0 0 18px rgba(255,0,200,0.9)) drop-shadow(0 0 45px rgba(255,0,200,0.6))';
                if (indexEl) { indexEl.style.color = '#ff00cc'; indexEl.style.textShadow = '0 0 12px rgba(255,0,200,0.9), 0 0 30px rgba(255,0,200,0.6), 2px 2px 4px rgba(0,0,0,0.9)'; }
            } else {
                cylinderImg.style.filter = '';
                if (indexEl) { indexEl.style.color = ''; indexEl.style.textShadow = ''; }
            }
        }
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

    function updateConcentrateBar() {
        const fill = document.getElementById('dangan-concentrate-bar-fill');
        if (!fill) return;
        fill.style.width = `${btCharge * 100}%`;
        fill.classList.toggle('nsd-bt-active',    btConcentrateActive);
        fill.classList.toggle('nsd-bt-depleted',  btCharge <= 0.01);
    }

    function startConcentrateLoop() {
        btLastTs = null;
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
            updateConcentrateBar();
            btConcentrateRaf = requestAnimationFrame(tick);
        }
        btConcentrateRaf = requestAnimationFrame(tick);
    }

    function syncPrompt() {
        const ctx = window.SillyTavern?.getContext?.();
        const setPrompt = ctx?.setExtensionPrompt || window.setExtensionPrompt;
        if (typeof setPrompt !== 'function') return;

        const key = getTrialPersistenceKey();

        if (currentState === TrialPhases.IDLE) {
            setPrompt('dangan_debate_history', '', 0, 0, false, 'system');
            setPrompt('dangan_rebuttal_judgment', '', 0, 0, false, 'system');
            return;
        }

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
                break;
            case TrialPhases.PRE_DEBATE:
                cleanupDebateUI();
                showPreDebateNotification();
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

    function showPreDebateNotification() {
        if (document.getElementById('dangan-trial-pre-debate-notif')) return;

        const notification = document.createElement('div');
        notification.id = 'dangan-trial-pre-debate-notif';
        notification.className = 'dangan-trial-notification';
        notification.innerHTML = `
            <div class="dangan-trial-notif-content">
                <span>Discussion is ongoing...</span>
                <button id="dangan-start-nonstop-btn"   class="dangan-trial-start-btn" style="display:none">START NON-STOP DEBATE</button>
                <button id="dangan-start-mpdebate-btn" class="dangan-trial-start-btn" style="display:none">START MASS PANIC DEBATE</button>
                <button id="dangan-start-hangman-btn"  class="dangan-trial-start-btn" style="display:none">START HANGMAN'S GAMBIT</button>
                <button id="dangan-start-pta-btn"      class="dangan-trial-start-btn" style="display:none">START PANIC TALK ACTION</button>
                <button id="dangan-start-voting-btn"   class="dangan-trial-start-btn" style="display:none">START VOTING TIME</button>
            </div>
        `;
        document.body.appendChild(notification);

        // Show buttons after 5 seconds
        setTimeout(() => {
            notification.querySelectorAll('.dangan-trial-start-btn').forEach(btn => btn.style.display = 'block');
        }, 5000);

        notification.querySelector('#dangan-start-nonstop-btn').onclick = () => {
            notification.remove();
            void startNonStopDebate();
        };
        notification.querySelector('#dangan-start-mpdebate-btn').onclick = () => {
            notification.remove();
            onStartMassPanicDebate?.();
        };
        notification.querySelector('#dangan-start-hangman-btn').onclick = () => {
            notification.remove();
            onStartHangmansGambit?.();
        };
        notification.querySelector('#dangan-start-pta-btn').onclick = () => {
            notification.remove();
            onStartPanicTalkAction?.();
        };
        notification.querySelector('#dangan-start-voting-btn').onclick = () => {
            notification.remove();
            onStartVotingTime?.();
        };
    }

    async function startNonStopDebate() {
        // Clear previous sections to avoid stale data
        preparedDebateSections = null;
        debateSectionsActive = null;
        debateSeatingPlan = null;
        
        currentDebateSections = Math.floor(Math.random() * (8 - 3 + 1)) + 3;
        showNonStopDebateCutscene();
        
        try {
            console.log(`[Dangan][Trial] Starting generation for ${currentDebateSections} sections...`);
            const sections = await buildDebateSections({ sectionsCount: currentDebateSections });
            
            if (Array.isArray(sections) && sections.length > 0) {
                preparedDebateSections = sections;
                console.log(`[Dangan][Trial] Generation successful: ${sections.length} sections.`);
            } else {
                console.warn('[Dangan][Trial] Generation returned empty or invalid sections.');
            }
        } catch (e) {
            console.warn('[Dangan][Trial] Debate section generation failed:', e);
        } finally {
            // Transition to debate phase before finishing cutscene
            setState(TrialPhases.NON_STOP_DEBATE);
            await endNonStopDebateCutscene();
        }
    }

    function debugStartNonStopDebateWithLines(lines) {
        const list = Array.isArray(lines) ? lines.map(l => {
            if (l && typeof l === 'object') {
                return {
                    text: String(l.text || '').trim(),
                    speaker: String(l.speaker || '').trim(),
                    whiteNoise: String(l.whiteNoise || '').trim() || null,
                };
            }
            return { text: String(l || '').trim(), speaker: '', whiteNoise: null };
        }).filter(e => e.text) : [];
        if (!list.length) return false;

        const speakers = getChatCardMembers().map(s => s.name).filter(Boolean).filter(n => !isCharacterDead(n));
        const speakerPool = speakers.length ? speakers : ['???'];

        persistentDebateHistory = [];
        debateSeatingPlan = null;
        currentDebateSections = Math.min(24, Math.max(1, list.length));
        preparedDebateSections = list.slice(0, currentDebateSections).map(({ text, speaker, whiteNoise }) => {
            // If an explicit speaker is dead, pick a living one instead
            const speakerName = (speaker && !isCharacterDead(speaker))
                ? speaker
                : speakerPool[Math.floor(Math.random() * speakerPool.length)];
            const normalized = ensureSingleWeakPointMarker(text);

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
        // Walk oldest→newest so the last message per character wins
        for (const msg of chat) {
            const name = String(msg.name || '').trim();
            const text = String(msg.mes  || '').trim();
            if (!name || !text || msg.is_user || msg.is_system) continue;
            result.set(name, inferEmotionFromText(text));
        }
        return result;
    }

    const NSD_UI_SELECTORS = ['#top-bar', '#top-settings-holder', '#sheld', '#right-nav-panel', '#dangan-vn-overlay'];
    const nsdHiddenEls = new Map(); // selector → original display value

    function fadeOutChatUI() {
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
    const BASE_PORTRAIT_PX = 720;
    const AVG_HEIGHT_CM    = 170;
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
        };
        set(portraitImgEl,   centerName);
        set(portraitLeftEl,  leftName);
        set(portraitRightEl, rightName);
    }

    function normalizeSeatName(name) {
        return String(name || '').trim().toLowerCase();
    }

    function firstToken(name) {
        return normalizeSeatName(name).split(/\s+/)[0] || '';
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
        for (let i = unique.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        // Monokuma always sits at seat 0
        const monokumaIdx = unique.findIndex(n => normalizeSeatName(n) === 'monokuma');
        if (monokumaIdx > 0) {
            const [monokuma] = unique.splice(monokumaIdx, 1);
            unique.unshift(monokuma);
        }
        return unique;
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
            playPanicTrack?.();
        } else {
            playDebatesTrack?.();
        }
        suppressVisualizer?.();

        if (!debateSeatingPlan?.length) {
            const isMpd = currentState === TrialPhases.MASS_PANIC_DEBATE;
            const groupMembers = getChatCardMembers().map(m => m.name).filter(Boolean)
                .filter(n => !isMpd || !isCharacterDead(n));
            let speakerNames;
            if (groupMembers.length) {
                speakerNames = groupMembers;
            } else if (isMpd) {
                speakerNames = [...new Set(
                    (mpdScenarios || []).flatMap(s => (s.texts || []).map(t => t.speaker)).filter(Boolean)
                )];
            } else {
                speakerNames = (preparedDebateSections || []).map(s => s.speakerName).filter(Boolean);
            }
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
                <div id="dangan-concentrate-bar-wrap">
                    <div id="dangan-concentrate-bar-label">CONCENTRATE</div>
                    <div id="dangan-concentrate-bar-track">
                        <div id="dangan-concentrate-bar-fill"></div>
                    </div>
                </div>
            </div>
            <div class="dangan-trial-portrait-stage">
                <div class="dangan-portrait-slot dangan-portrait-neighbor-slot dangan-portrait-left-slot">
                    <img id="dangan-portrait-left-img" alt="" />
                </div>
                <div class="dangan-portrait-slot dangan-portrait-center-slot">
                    <img id="dangan-trial-portrait-img" alt="" />
                </div>
                <div class="dangan-portrait-slot dangan-portrait-neighbor-slot dangan-portrait-right-slot">
                    <img id="dangan-portrait-right-img" alt="" />
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
            // Fall back to living seating-plan members when scenario speakers are blank
            if (!col0Name && !col1Name && !col2Name && debateSeatingPlan?.length) {
                const living = debateSeatingPlan.filter(n => !isCharacterDead(n));
                col0Name = living[0] || null;
                col1Name = living[1] || null;
                col2Name = living[2] || null;
            }
            applyPortraitHeights(col1Name, col0Name, col2Name);
            const tok = ++portraitToken;
            const loadImg = async (el, name) => {
                if (!el || !name) return;
                try {
                    const dead = isCharacterDead(name);
                    let url = null, grayscale = false;
                    if (dead) {
                        url = await getSpriteUrl(name, 'dead').catch(() => null);
                        if (!url) { url = await getSpriteUrl(name, 'neutral'); grayscale = true; }
                    } else {
                        url = await getSpriteUrl(name, 'neutral');
                    }
                    if (tok !== portraitToken || !url || !el) return;
                    el.src = url;
                    el.style.display = 'block';
                    el.style.filter = grayscale ? 'grayscale(1) brightness(0.6)' : '';
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
                try {
                    const dead = isCharacterDead(name);
                    let url = null;
                    let grayscale = false;
                    if (dead) {
                        url = await getSpriteUrl(name, 'dead').catch(() => null);
                        if (!url) { url = await getSpriteUrl(name, emo); grayscale = true; }
                    } else {
                        url = await getSpriteUrl(name, emo);
                    }
                    if (tok !== portraitToken || !url || !el) return;
                    el.src = url;
                    el.style.display = 'block';
                    el.style.filter = grayscale ? 'grayscale(1) brightness(0.6)' : '';
                } catch {}
            };
            applyPortraitHeights(firstName, firstLeft, firstRight);
            loadImg(portraitImgEl,   firstName, firstEmo);
            loadImg(portraitLeftEl,  firstLeft,  leftEmo);
            loadImg(portraitRightEl, firstRight, rightEmo);
        }

        debateOverlay.onmousemove = (e) => {
            reticleEl.style.left = `${e.clientX}px`;
            reticleEl.style.top = `${e.clientY}px`;
        };

        debateOverlay.onwheel = (e) => { e.preventDefault(); };

        debateOverlay.onclick = (e) => {
            handleShoot(e);
        };

        // Select relevant bullets for this NSD based on section count
        const bulletCap = nsdBulletCount(currentDebateSections);
        nsdActiveBullets = selectNsdBullets(preparedDebateSections || [], bulletCap);
        selectedTruthBulletIndex = 0;

        renderCylinder();
        if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
            updateSectionDots(1, mpdScenarios?.length || 1);
            injectMpdOverlayElements();
        } else {
            updateSectionDots(1, currentDebateSections);
        }
        startConcentrateLoop();

        playNsdPreIntro().then(() => showBulletIntroScreen()).then(() => {
            if (currentState === TrialPhases.MASS_PANIC_DEBATE) {
                startMassPanicDebatePlayback();
            } else {
                startDebatePlayback(preparedDebateSections);
            }
        });
    }

    function playNsdPreIntro() {
        return new Promise((resolve) => {
            const src = getAssetUrl('nonstop-pre-intro.webm');

            if (debateOverlay) debateOverlay.classList.add('nsd-pre-intro');

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
                function tick() {
                    introCylAngle = (introCylAngle + 20 / 60) % 7200;
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
                        <img id="dangan-bullet-intro-cyl-img"
                             src="${extensionFolderPath}/assets/images/minigames/revolver-cylinder.png" alt=""/>
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
                '#dangan-seating-debug',
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

        const bullets = getDebateBullets();
        const n = bullets.length;
        const cur = bullets[selectedTruthBulletIndex];
        const above = bullets[((selectedTruthBulletIndex - 1) + n) % n];
        const below = bullets[(selectedTruthBulletIndex + 1) % n];

        const bulletNumber = String(selectedTruthBulletIndex + 1).padStart(2, '0');

        container.innerHTML = `
            <div class="dangan-cylinder-wrap">
                <img id="dangan-cylinder-img" class="dangan-cylinder-img"
                     src="${extensionFolderPath}/assets/images/minigames/revolver-cylinder.png" alt=""/>
                <div class="dangan-cylinder-index">${bulletNumber}</div>
            </div>
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
        if (!revolverSpinRaf) startRevolverSpin();
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
        const BASE_SPIN = 20 / 60;
        const LERP = 0.1;
        function tick() {
            const mod = speedModifier > 1.0 ? 2.0 : speedModifier < 1.0 ? 0.5 : 1.0;
            revolverTarget += BASE_SPIN * mod;
            revolverAngle += (revolverTarget - revolverAngle) * LERP;
            const img = document.getElementById('dangan-cylinder-img');
            if (!img) { revolverSpinRaf = null; return; }
            img.style.transform = `skewX(8deg) skewY(14deg) rotate(${revolverAngle}deg)`;
            revolverSpinRaf = requestAnimationFrame(tick);
        }
        revolverSpinRaf = requestAnimationFrame(tick);
    }

    function startDebatePlayback(prepared) {
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
        if (!mpdScenarios?.length) return;
        const speakerEl = debateOverlay?.querySelector('#dangan-speaker-name');
        if (speakerEl) speakerEl.textContent = 'INAUDIBLE';

        // Snapshot equipped skills for this debate run
        const equipped = typeof getEquippedSkillsSnapshot === 'function' ? getEquippedSkillsSnapshot() : [];
        mpdSkillBetaBlock       = equipped.includes('shop_skill_beta_block');
        mpdSkillSeatingPlanCopy = equipped.includes('shop_skill_seating_plan_copy');

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
    function showMpdStatementInColumn(col, { text, isWeakPoint, whiteNoise }) {
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

        const rawText    = stripSurroundingQuotes(String(text || ''));
        const cleanedText = rawText.replace(/\[\[|\]\]/g, '');

        if (isWeakPoint) {
            let html = '', lastIndex = 0;
            const wpRegex = /\[\[\s*([^\]]+?)\s*\]\]/gi;
            let match;
            while ((match = wpRegex.exec(rawText)) !== null) {
                html += escapeHtml(rawText.slice(lastIndex, match.index));
                html += `<span class="dangan-weak-point mpd-weak-point">${escapeHtml(stripWeakBrackets(match[1]))}</span>`;
                lastIndex = match.index + match[0].length;
            }
            html += escapeHtml(rawText.slice(lastIndex));
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
                spawnWhiteNoise(whiteNoise, startX, startY, wnPattern.offsets ? wnPattern.offsets(i) : null);
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

                const dt    = now - lastNow;
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

                el.style.left    = `${x}px`;
                el.style.top     = `${y}px`;
                el.style.opacity = String(opacity);
                const shake  = isScreaming ? (Math.sin(now / 28) * 2.2) : 0;
                const shakeY = isScreaming ? (Math.cos(now / 24) * 1.6) : 0;
                el.style.transform = `translate(calc(-50% + ${shake}px), calc(-50% + ${shakeY}px)) rotate(${rot}deg) skewX(${skew}deg) scale(${scale})`;

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

    function updateMpdPortraits(scenario) {
        if (typeof getSpriteUrl !== 'function') return;
        let col0Name = String(scenario.texts?.[0]?.speaker || '').trim() || null;
        let col1Name = String(scenario.texts?.[1]?.speaker || '').trim() || null;
        let col2Name = String(scenario.texts?.[2]?.speaker || '').trim() || null;

        // When scenario speakers are blank (e.g. test scenarios), distribute
        // living seating-plan members across the three columns.
        if (!col0Name && !col1Name && !col2Name && debateSeatingPlan?.length) {
            const living = debateSeatingPlan.filter(n => !isCharacterDead(n));
            col0Name = living[0] || null;
            col1Name = living[1] || null;
            col2Name = living[2] || null;
        }

        applyPortraitHeights(col1Name, col0Name, col2Name);
        const tok = ++portraitToken;
        const loadImg = async (el, name) => {
            if (!el || !name) return;
            try {
                const dead = isCharacterDead(name);
                let url = null, grayscale = false;
                if (dead) {
                    url = await getSpriteUrl(name, 'dead').catch(() => null);
                    if (!url) { url = await getSpriteUrl(name, 'neutral'); grayscale = true; }
                } else {
                    url = await getSpriteUrl(name, 'neutral');
                }
                if (tok !== portraitToken || !url || !el) return;
                el.src = url; el.style.display = 'block';
                el.style.filter = grayscale ? 'grayscale(1) brightness(0.6)' : '';
            } catch {}
        };
        loadImg(portraitLeftEl,  col0Name);
        loadImg(portraitImgEl,   col1Name);
        loadImg(portraitRightEl, col2Name);
    }

    function mpdTriggerLock() {
        if (mpdLockActive || currentState !== TrialPhases.MASS_PANIC_DEBATE) return;
        mpdLockActive      = true;
        mpdFreeColumn      = Math.floor(Math.random() * 3);
        mpdChainBreakCount = 0;
        mpdUpdateChainOverlays();
        mpdUpdateChainCounter();
        playSfx?.('chain_trigger');
    }

    function mpdBreakLock() {
        mpdLockActive      = false;
        mpdFreeColumn      = -1;
        mpdChainBreakCount = 0;
        mpdUpdateChainOverlays();
        mpdUpdateChainCounter();
        playSfx?.('chain_broken');
        for (let c = 0; c < 3; c++) {
            const colEl = debateOverlay?.querySelector(`#mpd-col-${c}`);
            if (!colEl) continue;
            colEl.classList.add('mpd-chain-break-flash');
            setTimeout(() => colEl.classList.remove('mpd-chain-break-flash'), 450);
        }
    }

    function mpdUpdateChainOverlays() {
        for (let c = 0; c < 3; c++) {
            const chain = debateOverlay?.querySelector(`#mpd-chain-${c}`);
            if (!chain) continue;
            chain.classList.toggle('active', mpdLockActive && c !== mpdFreeColumn);
        }
        if (reticleEl) reticleEl.dataset.locked = mpdLockActive ? '1' : '0';
    }

    function mpdUpdateChainCounter() {
        const counter = debateOverlay?.querySelector('#mpd-chain-counter');
        if (!counter) return;
        // Without Beta Block the counter is never shown
        if (!mpdSkillBetaBlock) { counter.style.display = 'none'; return; }
        if (!mpdLockActive) {
            // Beta Block pre-lock: show the full break count in the centre column
            const cw = window.innerWidth / 3;
            counter.style.left    = `${cw * 1.5}px`;
            counter.style.display = 'block';
            counter.textContent   = String(MPD_CHAIN_BREAKS_NEEDED);
            return;
        }
        const cw = window.innerWidth / 3;
        const cx = mpdFreeColumn * cw + cw / 2;
        counter.style.left    = `${cx}px`;
        counter.style.display = 'block';
        counter.textContent   = String(MPD_CHAIN_BREAKS_NEEDED - mpdChainBreakCount);
    }

    function mpdOnRPress() {
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
            if (mpdChainBreakCount >= MPD_CHAIN_BREAKS_NEEDED) mpdBreakLock();
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
        void updateDebatePortraits(speakerName, emotion);
        updateSeatingDebug(speakerName);

        showStatementChunk({
            text: part.text,
            isWeakPoint: Boolean(part.isWeakPoint),
            laneY: getLaneY(debatePartIndex),
            weakMarkup: part.weakMarkup,
            whiteNoise: part.isWeakPoint ? (section.whiteNoise || null) : null,
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

        const { left: leftName, right: rightName } = getSeatingNeighbors(name);
        const token = ++portraitToken;

        if (typeof getSpriteUrl !== 'function') {
            [portraitImgEl, portraitLeftEl, portraitRightEl].forEach(el => { if (el) el.style.display = 'none'; });
            return;
        }

        const updateImg = async (el, charName, emoLabel) => {
            if (!el) return;
            if (!charName) { el.style.display = 'none'; return; }
            try {
                const dead = isCharacterDead(charName);
                let url = null;
                let grayscale = false;
                if (dead) {
                    url = await getSpriteUrl(charName, 'dead').catch(() => null);
                    if (!url) {
                        url = await getSpriteUrl(charName, emoLabel);
                        grayscale = true;
                    }
                } else {
                    url = await getSpriteUrl(charName, emoLabel);
                }
                if (token !== portraitToken) return;
                if (!url) { el.style.display = 'none'; return; }
                el.src = url;
                el.style.display = 'block';
                el.style.filter = grayscale ? 'grayscale(1) brightness(0.6)' : '';
            } catch {
                if (token !== portraitToken) return;
                el.style.display = 'none';
            }
        };

        const updates = [updateImg(portraitImgEl, name, emo)];
        if (speakerChanged) {
            const leftEmo  = characterEmotions.get(leftName)  || 'neutral';
            const rightEmo = characterEmotions.get(rightName) || 'neutral';
            applyPortraitHeights(name, leftName, rightName);
            updates.push(updateImg(portraitLeftEl,  leftName,  leftEmo));
            updates.push(updateImg(portraitRightEl, rightName, rightEmo));
        }
        await Promise.all(updates);
    }

    function showStatementChunk({ text, isWeakPoint, laneY, weakMarkup, whiteNoise }) {
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
        const rawText = stripSurroundingQuotes(String(text || ''));
        const cleanedText = rawText.replace(/\[\[|\]\]/g, '');

        if (isWeakPoint) {
            // Walk the raw text, escape each plain segment once, wrap weak spans once.
            // Never call escapeHtml twice on the same content (avoids &amp;amp; etc.).
            let html = '';
            let lastIndex = 0;
            const wpRegex = /\[\[\s*([^\]]+?)\s*\]\]/gi;
            let match;
            while ((match = wpRegex.exec(rawText)) !== null) {
                html += escapeHtml(rawText.slice(lastIndex, match.index));
                html += `<span class="dangan-weak-point">${escapeHtml(stripWeakBrackets(match[1]))}</span>`;
                lastIndex = match.index + match[0].length;
            }
            html += escapeHtml(rawText.slice(lastIndex));
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
                spawnWhiteNoise(whiteNoise, startX, startY, wnPattern.offsets ? wnPattern.offsets(i) : null);
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

                // Variable time step based on speedModifier
                const dt = now - lastNow;
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

                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                el.style.opacity = String(opacity);
                const shake = isScreaming ? (Math.sin(now / 28) * 2.2) : 0;
                const shakeY = isScreaming ? (Math.cos(now / 24) * 1.6) : 0;
                el.style.transform = `translate(calc(-50% + ${shake}px), calc(-50% + ${shakeY}px)) rotate(${rot}deg) skewX(${skew}deg) scale(${scale})`;

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
        playSfx?.('wn_shooting');
        showWnPressFlash();
        showWnBurst(lastCursorX, lastCursorY);
        if (hoveredWhiteNoise) hitWhiteNoise(hoveredWhiteNoise);
    }

    function showWnBurst(x, y) {
        const burst = document.createElement('div');
        burst.className = 'dangan-wn-burst';
        burst.style.left = `${x}px`;
        burst.style.top  = `${y}px`;
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 400);
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

        el.style.left    = `${startX}px`;
        el.style.top     = `${startY}px`;
        el.style.opacity = '0';
        el.style.transform = `translate(-50%, -50%) rotate(${rotStart}deg)`;

        document.body.appendChild(el);
        activeWhiteNoiseEls.push(el);

        let lastNow = performance.now();
        let elapsed = 0;
        let rafId   = 0;

        const frame = (now) => {
            if (!document.body.contains(el)) return;
            if (!isDebateActive()) {
                el.remove();
                activeWhiteNoiseEls = activeWhiteNoiseEls.filter(n => n !== el);
                if (hoveredWhiteNoise === el) hoveredWhiteNoise = null;
                return;
            }
            const dt = now - lastNow;
            elapsed += dt * speedModifier;
            lastNow = now;

            const p = Math.min(1, elapsed / duration);
            const x = startX + driftX * p;
            const y = startY + driftY * p;
            const rot = rotStart + (elapsed / 1000) * rotSpeed;

            let opacity = 1;
            if (p < 0.08) opacity = p / 0.08;
            else if (p > 0.88) opacity = Math.max(0, (1 - p) / 0.12);

            el.style.left      = `${x}px`;
            el.style.top       = `${y}px`;
            el.style.opacity   = String(opacity);
            el.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;

            if (p >= 1) {
                el.remove();
                activeWhiteNoiseEls = activeWhiteNoiseEls.filter(n => n !== el);
                if (hoveredWhiteNoise === el) hoveredWhiteNoise = null;
                return;
            }
            rafId = requestAnimationFrame(frame);
        };
        rafId = requestAnimationFrame(frame);
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

    function fireProjectile(bulletTitle, targetX, targetY, isPerjury) {
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

        function finish(hitEl) {
            if (done) return;
            done = true;
            el.remove();
            if (hitEl) {
                const bullets = getDebateBullets();
                const currentBullet = bullets[selectedTruthBulletIndex] || { title: 'TRUTH BULLET' };
                playSfx?.('weak_spot_hit');
                hitWeakPoint(hitEl, currentBullet, isPerjury);
            } else {
                playSfx?.('tbmiss');
                if (isPointOnDebateText(targetX, targetY)) {
                    playSfx?.('rejected_shot');
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

            // left/top pin the first character (transform-origin: left center).
            // rotate(angle) lays the text along the trajectory so the body trails
            // toward the bottom-right off-screen and the first char leads to target.
            el.style.left      = `${x}px`;
            el.style.top       = `${y}px`;
            el.style.transform = `translateY(-50%) rotate(${angle.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
            el.style.opacity   = alpha.toFixed(3);

            if (raw < 1) {
                requestAnimationFrame(step);
            } else {
                // Animation complete — check if the original click was on a weak point
                const hitWp = resolveWeakPointAtClick(targetX, targetY);
                finish(hitWp);
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
        shotCooldown = true;

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
        showShotEffect(e.clientX, e.clientY);
        fireProjectile(currentBullet.title, e.clientX, e.clientY, isPerjury);
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

        // 3. Show COUNTER or PERJURY banner
        const bannerType = isPerjury ? 'perjury' : 'counter';
        showTrialBanner(bannerType).then(() => {
            setState(TrialPhases.TRUTH_BULLET_EXPLANATION);
            showExplanationUI(currentBullet, wp.textContent);
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

    async function showTrialBanner(type) {
        playSfx?.('countersfx');

        const assetName = type === 'perjury' ? 'perjury.png' : 'counter.png';
        const imgSrc    = getAssetUrl(assetName);

        // Prefill bar sweeps in from centre
        const prefill = document.createElement('div');
        prefill.style.cssText = 'position:fixed;top:calc(33.33% - 10px);left:0;right:0;height:calc(33.34% + 20px);z-index:2147483646;background:#000;pointer-events:none;transform:scaleX(0);transform-origin:center;transition:transform 0.045s ease-out;';
        document.body.appendChild(prefill);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        prefill.style.transform = 'scaleX(1)';
        await new Promise(r => setTimeout(r, 55));

        // Banner slides in from the left
        const bannerWrap = document.createElement('div');
        bannerWrap.style.cssText = 'position:fixed;top:33.33%;left:0;right:0;height:33.34%;z-index:2147483647;pointer-events:none;overflow:hidden;';
        const inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;top:0;bottom:0;right:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:right 0.325s cubic-bezier(0.22,0.61,0.36,1);';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = type;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center;display:block;';
        inner.appendChild(img);
        bannerWrap.appendChild(inner);
        document.body.appendChild(bannerWrap);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        inner.style.right = '0%';

        // Voice line
        if (type === 'perjury') {
            playSfx?.(getSfx?.().vic_Monok_01_021 || 'vic_Monok_01_021');
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

    function showExplanationUI(bullet, refutedText) {
        lastHitBullet = bullet;
        lastHitWeakPoint = refutedText;

        const notification = document.createElement('div');
        notification.id = 'dangan-trial-rebuttal-notif';
        notification.className = 'dangan-trial-notification rebuttal-active';
        notification.innerHTML = `
            <div class="dangan-trial-notif-content">
                <div class="rebuttal-header">REBUTTAL PHASE</div>
                <div class="rebuttal-info">
                    Using <strong>${bullet.title}</strong> to refute <em>"${refutedText}"</em>.
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
        if (debateOverlay) {
            debateOverlay.remove();
            debateOverlay = null;
        }
        // Also clear any lingering statements / white noise from the body
        document.querySelectorAll('.dangan-floating-statement').forEach(el => el.remove());
        clearAllWhiteNoise();
        hoveredWhiteNoise = null;
        clearWnSpaceTimers();
        
        stopDebatesTrack?.();
        unsuppressVisualizer?.();
        nsdActiveBullets = null;
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

        portraitImgEl = null;
        portraitLeftEl = null;
        portraitRightEl = null;
        portraitSpeaker = null;
        portraitToken++;
        const vnWrapper = document.querySelector('#visual-novel-wrapper');
        if (vnWrapper) vnWrapper.style.visibility = '';
        fadeInChatUI();
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

    async function buildDebateSections({ sectionsCount }) {
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
                
                const section = { speakerName, statement, parts };
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
        const raw = String(statement || '').trim().replace(/\s+/g, ' ');
        if (!raw) return [];

        const weakMatch = raw.match(/\[\[([^\]]+)\]\]/);
        const weakToken = weakMatch ? String(weakMatch[1] || '').trim().replace(/\s+/g, ' ') : '';

        return [{
            text: raw,
            isWeakPoint: Boolean(weakToken),
            weakMarkup: weakToken,
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

    function isAssistantLikeName(name) {
        const n = normalizeLooseName(name);
        if (!n) return false;
        return n === 'assistant' || n === 'sillytavern' || n === 'system';
    }

    function isSpeakerCandidateChar(char, ctx) {
        if (!char) return false;
        if (char.is_user === true || char.isUser === true) return false;
        if (char.is_assistant === true || char.isAssistant === true) return false;
        if (char.is_system === true || char.isSystem === true) return false;
        if (char.is_narrator === true || char.isNarrator === true) return false;
        if (char.disabled === true || char.is_disabled === true) return false;
        if (char.enabled === false || char.isEnabled === false) return false;

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
        setState(TrialPhases.IDLE);
        
        // Clear from extension settings (per chat/group)
        if (typeof saveSettingsDebounced === 'function') {
            const key = getTrialPersistenceKey();
            if (extensionSettings[extensionName].trials && extensionSettings[extensionName].trials[key]) {
                extensionSettings[extensionName].trials[key].currentTrialState = TrialPhases.IDLE;
                extensionSettings[extensionName].trials[key].persistentDebateHistory = [];
                saveSettingsDebounced();
            }
        }
    }

    function initFromPersistentState() {
        const key = getTrialPersistenceKey();
        const saved = extensionSettings[extensionName]?.trials?.[key];
        
        const savedState = saved?.currentTrialState;
        const savedHistory = saved?.persistentDebateHistory;

        if (Array.isArray(savedHistory)) {
            persistentDebateHistory = savedHistory;
        }

        if (savedState && savedState !== TrialPhases.IDLE) {
            console.log(`[Dangan][Trial] Restoring trial state for ${key}: ${savedState}`);
            // Transition back to the saved state. 
            // Returning to PRE_DEBATE is safer after a refresh for stability.
            if (savedState === TrialPhases.NON_STOP_DEBATE || savedState === TrialPhases.MASS_PANIC_DEBATE) {
                setState(TrialPhases.PRE_DEBATE);
            } else {
                setState(savedState);
            }
        }
    }

    // Call init on manager creation
    setTimeout(initFromPersistentState, 500);

    return {
        start: () => {
            setState(TrialPhases.PRE_DEBATE);
        },
        stop: () => {
            endTrial();
        },
        startMassPanicDebate: (rawScenarios) => {
            mpdScenarios = parseMpdScenarios(rawScenarios || []);
            setState(TrialPhases.MASS_PANIC_DEBATE);
        },
        debugStartNonStopDebateWithLines,
        onMessageSent,
        getState: () => currentState,
        phases: TrialPhases,
        endTrial,
    };
}
