// trial/trialManager.js

export const TrialPhases = {
    IDLE: 'idle',
    PRE_DEBATE: 'pre_debate',
    NON_STOP_DEBATE: 'non_stop_debate',
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
    let portraitToken = 0;
    let portraitSpeaker = null;
    let portraitEmotion = null;
    let lastHitBullet = null;
    let lastHitWeakPoint = null;
    let rebuttalPromptActive = false;
    let persistentDebateHistory = [];
    let speedModifier = 1.0;
    let keysPressed = new Set();
    let nsdKeyAC = null;
    let perjuryChargeTimer = null;
    let isPerjuryCharged = false;
    let lastHitWasPerjury = false;
    let shotCooldown = false;

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

        if (oldState === TrialPhases.NON_STOP_DEBATE && newState !== TrialPhases.NON_STOP_DEBATE) {
            cleanupNSDListeners();
            document.body.classList.remove('dangan-nsd-active');
        } else if (newState === TrialPhases.NON_STOP_DEBATE && oldState !== TrialPhases.NON_STOP_DEBATE) {
            setupNSDListeners();
            document.body.classList.add('dangan-nsd-active');
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
            updateSpeedModifier();
        }, { signal });

        window.addEventListener('keyup', (e) => {
            keysPressed.delete(e.key);
            updateSpeedModifier();
        }, { signal });

        window.addEventListener('wheel', (e) => {
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;
            const bullets = getTruthBullets();
            if (bullets.length <= 1) return;

            if (e.deltaY > 0) {
                selectedTruthBulletIndex = (selectedTruthBulletIndex + 1) % bullets.length;
            } else {
                selectedTruthBulletIndex = (selectedTruthBulletIndex - 1 + bullets.length) % bullets.length;
            }
            playSfx?.('tbcycle');
            syncUI();
        }, { signal, passive: true });

        // Perjury logic
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
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;
            if (e.button !== 0) return;

            clearTimeout(perjuryChargeTimer);
            
            // If we are over a weak point, handle the shot
            handleShoot(e, isPerjuryCharged);
            
            isPerjuryCharged = false;
            showPerjuryVfx(false);
        }, { signal });

        // Safety: reset on blur
        window.addEventListener('blur', () => {
            keysPressed.clear();
            updateSpeedModifier();
            clearTimeout(perjuryChargeTimer);
            showPerjuryVfx(false);
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
    }

    function updateSpeedModifier() {
        let mod = 1.0;
        // Holding Shift slows down (0.4x)
        if (keysPressed.has('Shift')) {
            mod = 0.4;
        }
        // Holding Escape speeds up (3.0x)
        else if (keysPressed.has('Escape')) {
            mod = 3.0;
        }
        speedModifier = mod;

        // Apply visual effect to background if slowing down
        const overlay = document.getElementById('dangan-nonstop-debate-overlay');
        const cylinder = document.querySelector('.dangan-cylinder-inner');
        
        if (overlay) {
            let btVfx = document.getElementById('dangan-bt-vfx');
            let btAlert = document.getElementById('dangan-bt-alert-overlay');

            if (mod < 1.0) {
                if (cylinder) cylinder.style.borderColor = '#ff00ff';
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
                if (cylinder) cylinder.style.borderColor = 'rgba(0, 255, 255, 0.4)';
                if (btVfx) btVfx.classList.remove('hg-active');
                if (btAlert) btAlert.classList.remove('hg-active');
            }
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
        if (currentState !== TrialPhases.IDLE) {
            if (vnModeController?.setEnabled) {
                vnModeController.setEnabled(true);
            }
            document.body.classList.add('dangan-trial-active');
        } else {
            document.body.classList.remove('dangan-trial-active');
        }

        // Handle Pre-Debate specific body class
        if (currentState === TrialPhases.PRE_DEBATE) {
            document.body.classList.add('dangan-trial-discussion-vn-active');
        } else {
            document.body.classList.remove('dangan-trial-discussion-vn-active');
        }

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
                <button id="dangan-start-nonstop-btn" style="display:none">START NON-STOP DEBATE</button>
            </div>
        `;
        document.body.appendChild(notification);

        // Show button after 5 seconds
        setTimeout(() => {
            const btn = notification.querySelector('#dangan-start-nonstop-btn');
            if (btn) btn.style.display = 'block';
        }, 5000);

        notification.querySelector('#dangan-start-nonstop-btn').onclick = () => {
            notification.remove();
            void startNonStopDebate();
        };
    }

    async function startNonStopDebate() {
        currentDebateSections = Math.floor(Math.random() * (8 - 3 + 1)) + 3;
        showNonStopDebateCutscene();
        
        try {
            // Race the generation against a 25-second timeout to prevent "stuck" cutscene
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Debate generation timed out')), 25000)
            );
            
            preparedDebateSections = await Promise.race([
                buildDebateSections({ sectionsCount: currentDebateSections }),
                timeoutPromise
            ]);
        } catch (e) {
            console.warn('[Dangan][Trial] Debate section generation failed or timed out, falling back:', e);
            preparedDebateSections = null;
        } finally {
            // Set state first so debate UI is ready and background elements are hidden 
            // BEFORE the cutscene overlay starts fading out.
            setState(TrialPhases.NON_STOP_DEBATE);
            await endNonStopDebateCutscene();
        }
    }

    function debugStartNonStopDebateWithLines(lines) {
        const list = Array.isArray(lines) ? lines.map(l => String(l || '').trim()).filter(Boolean) : [];
        if (!list.length) return false;

        const speakers = getChatCardMembers().map(s => s.name).filter(Boolean);
        const speakerPool = speakers.length ? speakers : ['???'];

        persistentDebateHistory = [];
        currentDebateSections = Math.min(8, Math.max(1, list.length));
        preparedDebateSections = list.slice(0, currentDebateSections).map((line, idx) => {
            const speakerName = speakerPool[idx % speakerPool.length];
            const normalized = ensureSingleWeakPointMarker(line);
            
            const spoken = stripSurroundingQuotes(extractDialogueOnly(normalized) || normalized);
            if (spoken) {
                persistentDebateHistory.push(`${speakerName}: ${spoken}`);
            }

            const parts = splitStatementIntoParts(normalized).map(p => ({
                ...p,
                emotion: inferEmotionFromText(p.text),
            }));
            return { speakerName, statement: normalized, parts };
        });

        setState(TrialPhases.NON_STOP_DEBATE);
        return true;
    }

    function setupNonStopDebate() {
        cleanupDebateUI();

        debateOverlay = document.createElement('div');
        debateOverlay.id = 'dangan-nonstop-debate-overlay';
        
        reticleEl = document.createElement('div');
        reticleEl.id = 'dangan-trial-reticle';
        debateOverlay.appendChild(reticleEl);

        debateOverlay.innerHTML += `
            <div class="dangan-trial-top-left">
                <div id="dangan-speaker-name">...</div>
                <div id="dangan-section-count">SECTION 1 / ${currentDebateSections}</div>
            </div>
            <div class="dangan-trial-portrait">
                <img id="dangan-trial-portrait-img" alt="" />
            </div>
            <div class="dangan-trial-bottom-left" id="dangan-truth-bullet-cylinder"></div>
        `;

        document.body.appendChild(debateOverlay);
        portraitImgEl = debateOverlay.querySelector('#dangan-trial-portrait-img');

        debateOverlay.onmousemove = (e) => {
            reticleEl.style.left = `${e.clientX}px`;
            reticleEl.style.top = `${e.clientY}px`;
        };

        debateOverlay.onwheel = (e) => {
            const bullets = getTruthBullets();
            if (bullets.length === 0) return;
            if (e.deltaY > 0) {
                selectedTruthBulletIndex = (selectedTruthBulletIndex + 1) % bullets.length;
            } else {
                selectedTruthBulletIndex = (selectedTruthBulletIndex - 1 + bullets.length) % bullets.length;
            }
            renderCylinder();
        };

        debateOverlay.onclick = (e) => {
            handleShoot(e);
        };

        renderCylinder();
        startDebatePlayback(preparedDebateSections);
    }

    function renderCylinder() {
        const cylinder = document.getElementById('dangan-truth-bullet-cylinder');
        if (!cylinder) return;
        
        const bullets = getTruthBullets();
        const currentBullet = bullets[selectedTruthBulletIndex];
        
        cylinder.innerHTML = `
            <div class="dangan-cylinder-inner">
                <div class="dangan-current-bullet">${currentBullet ? currentBullet.title : 'NO BULLETS'}</div>
            </div>
        `;
    }

    function startDebatePlayback(prepared) {
        debateSectionsActive = buildFallbackSectionsIfNeeded(prepared);
        if (!debateSectionsActive?.length) return;

        debateSectionIndex = 0;
        debatePartIndex = 0;
        playNextChunk();
    }

    function buildFallbackSectionsIfNeeded(prepared) {
        if (Array.isArray(prepared) && prepared.length) return prepared;

        const messages = getRecentMessages();
        if (!messages.length) return null;

        const sections = [];
        for (let i = 0; i < currentDebateSections; i++) {
            const msg = messages[i % messages.length];
            const speakerName = msg.name || '???';
            const chunks = splitIntoChunks(String(msg.text || ''));
            const weakPointIndex = chunks.length ? Math.floor(Math.random() * chunks.length) : 0;
            const parts = chunks.map((t, idx) => ({ text: t, isWeakPoint: idx === weakPointIndex }));
            sections.push({ speakerName, statement: msg.text, parts });
        }
        return sections;
    }

    function getLaneY(partIndex) {
        const base = Math.round((window.innerHeight || 800) * 0.58);
        const offsets = [-70, 0, 70];
        return base + offsets[Math.abs(partIndex) % offsets.length];
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
        const countEl = document.getElementById('dangan-section-count');
        if (speakerEl) speakerEl.textContent = String(speakerName).toUpperCase();
        if (countEl) countEl.textContent = `SECTION ${(debateSectionIndex % currentDebateSections) + 1} / ${currentDebateSections}`;

        const emotion = part?.emotion || inferEmotionFromText(part?.text);
        void updateSpeakerPortrait(speakerName, emotion);

        showStatementChunk({
            text: part.text,
            isWeakPoint: Boolean(part.isWeakPoint),
            laneY: getLaneY(debatePartIndex),
            weakMarkup: part.weakMarkup,
        }).then(() => {
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;
            debatePartIndex++;
            if (debatePartIndex >= parts.length) {
                debatePartIndex = 0;
                debateSectionIndex = (debateSectionIndex + 1) % currentDebateSections;
            }
            playbackTimerId = window.setTimeout(playNextChunk, 120);
        });
    }

    async function updateSpeakerPortrait(speakerName, emotion) {
        if (!portraitImgEl) return;
        const name = String(speakerName || '').trim();
        if (!name) return;
        const emo = String(emotion || '').trim().toLowerCase() || 'neutral';
        if (portraitSpeaker === name && portraitEmotion === emo) return;

        console.log(`[Dangan][Trial] Updating portrait for ${name} with emotion: ${emo}`);
        portraitSpeaker = name;
        portraitEmotion = emo;

        const token = ++portraitToken;

        if (typeof getSpriteUrl !== 'function') {
            portraitImgEl.style.display = 'none';
            return;
        }

        try {
            const url = await getSpriteUrl(name, emo);
            if (token !== portraitToken) return;
            if (!url) {
                portraitImgEl.style.display = 'none';
                return;
            }
            portraitImgEl.src = url;
            portraitImgEl.style.display = 'block';
        } catch {
            if (token !== portraitToken) return;
            portraitImgEl.style.display = 'none';
        }
    }

    function showStatementChunk({ text, isWeakPoint, laneY, weakMarkup }) {
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

        const el = document.createElement('div');
        el.className = 'dangan-floating-statement dangan-statement-single';
        const w = window.innerWidth || 1200;
        el.style.width = `${Math.min(Math.round(w * 0.82), 980)}px`;
        const rawText = stripSurroundingQuotes(String(text || ''));
        const cleanedText = rawText.replace(/\[\[|\]\]/g, '');

        if (isWeakPoint) {
            const escapedText = escapeHtml(rawText);
            const replaced = escapedText.replace(/\[\[\s*([^\]]+?)\s*\]\]/gi, (_m, inner) => {
                const cleaned = stripWeakBrackets(inner);
                return `<span class="dangan-weak-point">${escapeHtml(cleaned)}</span>`;
            });
            // Final fallback to remove any leftover markers that might have escaped the span regex
            el.innerHTML = replaced.replace(/\[\[|\]\]/g, '');
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

        const motionMode = Math.random() < 0.18 ? 'pov' : 'drift';
        const dir = Math.random() < 0.5 ? -1 : 1;
        const driftX = dir * Math.round(w * 0.11);
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

        return new Promise(resolve => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                resolve();
            };

            const frame = (now) => {
                if (cancelled || currentState !== TrialPhases.NON_STOP_DEBATE || statementEl !== el) {
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
                const rot = -10 + dir * 4;
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

    function handleShoot(e, isPerjury = false) {
        if (shotCooldown) return;
        shotCooldown = true;
        setTimeout(() => { shotCooldown = false; }, 400);

        const bullets = getTruthBullets();
        const currentBullet = bullets[selectedTruthBulletIndex] || { title: 'TRUTH BULLET' };

        playSfx?.('shoottb');

        // 1. Direct target check
        const target = e.target;
        if (target instanceof HTMLElement && target.classList.contains('dangan-weak-point')) {
            hitWeakPoint(target, currentBullet, isPerjury);
            return;
        }

        // 2. Element from point check
        const topEl = document.elementFromPoint(e.clientX, e.clientY);
        if (topEl?.classList.contains('dangan-weak-point')) {
            hitWeakPoint(topEl, currentBullet, isPerjury);
            return;
        }

        // 3. Rect based check
        const wp = currentWeakPointInfo?.element;
        if (wp instanceof HTMLElement) {
            const rect = wp.getBoundingClientRect();
            const padding = 34;
            const hit = (
                e.clientX >= rect.left - padding &&
                e.clientX <= rect.right + padding &&
                e.clientY >= rect.top - padding &&
                e.clientY <= rect.bottom + padding
            );
            if (hit) {
                hitWeakPoint(wp, currentBullet, isPerjury);
                return;
            }
        }

        // Miss
        playSfx?.('tbmiss');
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
        
        const overlay = document.createElement('div');
        overlay.id = 'dangan-counter-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 2147483647;
            background: rgba(0, 0, 0, 0.4);
            pointer-events: none; opacity: 0; transition: opacity 0.3s;
        `;
        
        const banner = document.createElement('div');
        banner.className = `dangan-trial-banner banner-${type}`;
        const assetName = type === 'perjury' ? 'perjury.png' : 'counter.png';
        banner.style.backgroundImage = `url("${getAssetUrl(assetName)}")`;
        
        overlay.appendChild(banner);
        document.body.appendChild(overlay);
        
        await new Promise(r => requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            banner.classList.add('active');
            r();
        }));
        
        // Voice line still plays if available
        if (type === 'perjury') {
            playSfx?.(getSfx?.().vic_Monok_01_021 || 'vic_Monok_01_021'); 
        } else {
            playSfx?.(getSfx?.().vic_Monok_01_022 || 'vic_Monok_01_022');
        }
        
        await new Promise(r => setTimeout(r, 1600));
        
        overlay.style.opacity = '0';
        banner.classList.remove('active');
        banner.classList.add('exit');
        
        await new Promise(r => setTimeout(r, 600));
        overlay.remove();
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

        const soft = /([,;:]\s+|\.\.\.\s+|\.\s+|\?\s+|!\s+|\)\s+|\]\]\s+|\bbut\s+|\bhowever\s+|\bthough\s+|\byet\s+|\bso\s+|\bbecause\s+)/i;
        const parts = raw.split(soft).filter(Boolean);
        const normalized = [];
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (soft.test(part) && normalized.length) {
                normalized[normalized.length - 1] += part;
            } else {
                normalized.push(part);
            }
        }
        const text2 = normalized.join('').replace(/\s+/g, ' ').trim();

        const candidates = [];
        const re = /,\s+|;\s+|:\s+|\.\.\.\s+|\.\s+|\?\s+|!\s+|\bbut\s+|\bhowever\s+|\bthough\s+|\byet\s+|\bso\s+|\bbecause\s+/gi;
        let m;
        while ((m = re.exec(text2)) !== null) {
            const idx = m.index + m[0].length;
            if (idx > 10 && idx < text2.length - 10) candidates.push(idx);
        }

        const target = Math.round(text2.length * 0.62);
        let splitAt = -1;
        let bestDist = Infinity;
        for (const idx of candidates) {
            const dist = Math.abs(idx - target);
            if (dist < bestDist) {
                bestDist = dist;
                splitAt = idx;
            }
        }

        if (splitAt === -1 || text2.length < 80) {
            return [text2];
        }

        const a = text2.slice(0, splitAt).trim();
        const b = text2.slice(splitAt).trim();
        if (!a || !b) return [text2];
        return [a, b];
    }

    function cleanupDebateUI() {
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
        if (debateOverlay) {
            debateOverlay.remove();
            debateOverlay = null;
        }
        portraitImgEl = null;
        portraitSpeaker = null;
        portraitToken++;
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
            sections.push({ speakerName, statement, parts });

            const spoken = stripSurroundingQuotes(extractDialogueOnly(statement) || statement);
            if (spoken) {
                const line = `${speakerName}: ${spoken}`;
                debateSoFar.push(line);
                persistentDebateHistory.push(line);
                while (debateSoFar.length > 3) debateSoFar.shift();
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
- Inside the quotes, mark EXACTLY ONE weak point using this format: [[WEAK POINT]].
- The weak point should be short: preferably 1 word, max 3 words.
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

        for (let attempt = 0; attempt < 3; attempt++) {
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
        const raw = String(text || '').trim();
        const existing = raw.match(/\[\[([^\]]+)\]\]/);
        if (existing) {
            const rawWeak = String(existing[1] || '').trim().replace(/\s+/g, ' ');
            const trimmedWeak = shrinkWeakPoint(rawWeak);
            return raw.replace(/\[\[[^\]]+\]\]/, `[[${trimmedWeak}]]`);
        }

        const clean = raw.replace(/\s+/g, ' ').trim();
        if (!clean) return '[[...]]';

        const words = clean.split(' ').filter(Boolean);
        const chosen = pickCompactWeakPoint(words);
        if (!chosen) return `[[${words[0] || '...'}]]`;

        const idx = words.findIndex(w => normalizeLooseToken(w) === normalizeLooseToken(chosen));
        if (idx >= 0) {
            const before = words.slice(0, idx).join(' ');
            const after = words.slice(idx + 1).join(' ');
            return [before, `[[${chosen}]]`, after].filter(Boolean).join(' ');
        }

        return `${clean} [[${chosen}]]`;
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
        const weakMatch = raw.match(/\[\[([^\]]+)\]\]/);
        const weakToken = weakMatch ? String(weakMatch[1] || '').trim().replace(/\s+/g, ' ') : '';
        const weakRegex = weakToken
            ? new RegExp(`\\[\\[\\s*${escapeRegExp(weakToken)}\\s*\\]\\]`, 'i')
            : null;

        const chunks = splitIntoChunks(raw);
        if (!chunks.length) return [];

        if (!weakRegex) {
            const weakPointIndex = chunks.length ? Math.floor(Math.random() * chunks.length) : 0;
            return chunks.map((t, i) => ({ text: t, isWeakPoint: i === weakPointIndex, weakMarkup: '' }));
        }

        return chunks.map((t) => ({
            text: t,
            isWeakPoint: weakRegex.test(t),
            weakMarkup: weakToken,
        }));
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
        if ((groupId == null || groupId === '') && activeCharId != null) {
            const sid = String(activeCharId).trim();
            const allChars = [
                ...chars,
                ...(Array.isArray(window.characters) ? window.characters : []),
            ];
            const found = allChars.find(c => String(c?.id ?? c?.characterId ?? c?.char_id ?? '').trim() === sid);
            const name = String(found?.name || ctx.characterName || ctx.character_name || '').trim();
            if (name && !isGroupMemberMuted(name) && !isAssistantLikeName(name)) return [{ name }];
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
            if (savedState === TrialPhases.NON_STOP_DEBATE) {
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
        debugStartNonStopDebateWithLines,
        onMessageSent,
        getState: () => currentState,
        phases: TrialPhases,
        endTrial,
    };
}
