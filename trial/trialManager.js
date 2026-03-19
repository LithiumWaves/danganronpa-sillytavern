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
        saveSettingsDebounced,
        vnModeController,
        getTruthBullets,
        generateTrialDialogue,
        playSfx,
        getSfx,
        characters,
    } = deps;

    let currentState = TrialPhases.IDLE;
    let currentDebateSections = 0;
    let selectedTruthBulletIndex = 0;
    let debateOverlay = null;
    let reticleEl = null;
    let cutsceneOverlay = null;
    let floatingStatements = [];
    let animationFrameId = null;
    let sectionTimerId = null;
    let currentSpeaker = null;
    let currentWeakPointInfo = null;
    let preparedDebateSections = null;

    function setState(newState) {
        console.log(`[Dangan][Trial] State change: ${currentState} -> ${newState}`);
        currentState = newState;
        syncUI();
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
            preparedDebateSections = await buildDebateSections({
                sectionsCount: currentDebateSections,
            });
        } catch (e) {
            console.warn('[Dangan][Trial] Debate section generation failed, falling back:', e);
            preparedDebateSections = null;
        }
        await endNonStopDebateCutscene();
        setState(TrialPhases.NON_STOP_DEBATE);
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
            <div class="dangan-trial-bottom-left" id="dangan-truth-bullet-cylinder"></div>
        `;

        document.body.appendChild(debateOverlay);

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
        startFloatingTextLoop(preparedDebateSections);
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

    function startFloatingTextLoop(debateSections) {
        const fallbackMessages = getRecentMessages();
        const sections =
            Array.isArray(debateSections) && debateSections.length
                ? debateSections
                : null;

        let currentSectionIndex = 0;

        const tick = () => {
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;

            if (sections) {
                const section = sections[currentSectionIndex % sections.length];
                const speakerName = section.speakerName || '???';
                document.getElementById('dangan-speaker-name').textContent = String(speakerName).toUpperCase();
                document.getElementById('dangan-section-count').textContent = `SECTION ${(currentSectionIndex % currentDebateSections) + 1} / ${currentDebateSections}`;

                section.parts.forEach(part => {
                    createFloatingStatement(part.text, Boolean(part.isWeakPoint), currentSectionIndex);
                });

                currentSectionIndex = (currentSectionIndex + 1) % currentDebateSections;
            } else if (fallbackMessages.length) {
                const msg = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
                const speakerName = msg.name || '???';
                document.getElementById('dangan-speaker-name').textContent = speakerName.toUpperCase();
                document.getElementById('dangan-section-count').textContent = `SECTION ${(currentSectionIndex % currentDebateSections) + 1} / ${currentDebateSections}`;

                const chunks = splitIntoChunks(msg.text);
                const weakPointIndex = Math.floor(Math.random() * chunks.length);

                chunks.forEach((chunk, i) => {
                    createFloatingStatement(chunk, i === weakPointIndex, currentSectionIndex);
                });

                currentSectionIndex = (currentSectionIndex + 1) % currentDebateSections;
            }

            sectionTimerId = window.setTimeout(tick, 4000);
        };

        tick();
        animateFloatingText();
    }

    function createFloatingStatement(text, isWeakPoint, sectionIndex) {
        const el = document.createElement('div');
        el.className = 'dangan-floating-statement';
        if (isWeakPoint) {
            el.classList.add('dangan-weak-point');
            currentWeakPointInfo = { text, element: el };
        }
        el.textContent = text;
        
        // Random start position
        const startX = window.innerWidth + 100;
        const startY = 100 + Math.random() * (window.innerHeight - 300);
        
        el.style.left = `${startX}px`;
        el.style.top = `${startY}px`;
        
        debateOverlay.appendChild(el);
        
        floatingStatements.push({
            element: el,
            x: startX,
            y: startY,
            speed: 2 + Math.random() * 2,
            isWeakPoint
        });
    }

    function animateFloatingText() {
        if (currentState !== TrialPhases.NON_STOP_DEBATE) return;

        floatingStatements.forEach((stmt, index) => {
            stmt.x -= stmt.speed;
            stmt.element.style.left = `${stmt.x}px`;
            
            // Remove if off screen
            if (stmt.x < -1000) {
                stmt.element.remove();
                floatingStatements.splice(index, 1);
            }
        });

        animationFrameId = requestAnimationFrame(animateFloatingText);
    }

    function handleShoot(e) {
        const bullets = getTruthBullets();
        const currentBullet = bullets[selectedTruthBulletIndex];
        if (!currentBullet) return;

        // Check if we hit a weak point
        const hitWeakPoint = floatingStatements.find(stmt => {
            if (!stmt.isWeakPoint) return false;
            const rect = stmt.element.getBoundingClientRect();
            const padding = 20; // Extra hit area
            return (
                e.clientX >= rect.left - padding &&
                e.clientX <= rect.right + padding &&
                e.clientY >= rect.top - padding &&
                e.clientY <= rect.bottom + padding
            );
        });

        if (hitWeakPoint) {
            console.log('[Dangan][Trial] CRITICAL HIT!');
            playSfx?.(getSfx?.().hit || 'hit'); 
            
            // Highlight the hit weak point
            hitWeakPoint.element.style.color = '#ff0000';
            hitWeakPoint.element.style.fontSize = '48px';
            hitWeakPoint.element.style.fontWeight = 'bold';
            
            setTimeout(() => {
                setState(TrialPhases.TRUTH_BULLET_EXPLANATION);
                showExplanationUI(currentBullet, hitWeakPoint.element.textContent);
            }, 1000);
        } else {
            console.log('[Dangan][Trial] Miss...');
            playSfx?.(getSfx?.().miss || 'miss');
        }
    }

    function showExplanationUI(bullet, refutedText) {
        const overlay = document.createElement('div');
        overlay.id = 'dangan-explanation-overlay';
        overlay.className = 'dangan-trial-overlay explanation';
        overlay.innerHTML = `
            <div class="dangan-explanation-box">
                <div class="dangan-explanation-header">REBUTTAL PHASE</div>
                <div class="dangan-explanation-refuted">"${refutedText}"</div>
                <div class="dangan-explanation-vs">VS</div>
                <div class="dangan-explanation-bullet">${bullet.title}</div>
                <div class="dangan-explanation-prompt">Provide your argument to refute the claim:</div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Focus chat input
        const chatInput = document.querySelector('#send_textarea, #chat_input');
        if (chatInput) chatInput.focus();
    }

    function onMessageSent(text) {
        if (currentState !== TrialPhases.TRUTH_BULLET_EXPLANATION) return;

        // Here we could add logic to tell the AI to validate the refutation.
        // For now, we just transition back to pre-debate after the message is sent.
        console.log('[Dangan][Trial] Argument sent, transitioning back to Pre-Debate');
        
        const explanationOverlay = document.getElementById('dangan-explanation-overlay');
        if (explanationOverlay) explanationOverlay.remove();
        
        setTimeout(() => {
            setState(TrialPhases.PRE_DEBATE);
        }, 2000); // Wait for AI response
    }

    function getRecentMessages() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        return chat.filter(m => !m.is_user && !m.is_system).slice(-10);
    }

    function splitIntoChunks(text) {
        const words = text.split(' ');
        const chunks = [];
        for (let i = 0; i < words.length; i += 5) {
            chunks.push(words.slice(i, i + 5).join(' '));
        }
        return chunks;
    }

    function cleanupDebateUI() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (sectionTimerId) window.clearTimeout(sectionTimerId);
        sectionTimerId = null;
        floatingStatements.forEach(s => s.element.remove());
        floatingStatements = [];
        if (debateOverlay) {
            debateOverlay.remove();
            debateOverlay = null;
        }
        if (cutsceneOverlay) {
            cutsceneOverlay.remove();
            cutsceneOverlay = null;
        }
        const notif = document.getElementById('dangan-trial-pre-debate-notif');
        if (notif) notif.remove();
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
        if (!speakers.length) return null;

        const sections = [];
        for (let i = 0; i < sectionsCount; i++) {
            const speakerName = pickSpeakerWeighted(speakers);
            const statement = await generateSectionStatement({
                speakerName,
                context,
                sectionIndex: i,
                sectionsCount,
            });
            const parts = splitStatementIntoParts(statement);
            sections.push({ speakerName, statement, parts });
        }
        return sections;
    }

    function getContextMessagesForTrial() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        return chat
            .filter(m => !m?.is_system)
            .slice(-30)
            .map(m => ({
                isUser: Boolean(m?.is_user),
                name: String(m?.name || m?.ch_name || m?.character_name || m?.sender || (m?.is_user ? 'You' : '???')),
                text: String(m?.mes || m?.text || m?.message || '').trim(),
            }))
            .filter(m => m.text);
    }

    function pickSpeakersFromContext(context) {
        const counts = new Map();
        for (const m of context) {
            if (m.isUser) continue;
            const name = String(m.name || '').trim();
            if (!name) continue;
            counts.set(name, (counts.get(name) || 0) + 1);
        }
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const picked = sorted.slice(0, 4).map(([name, count]) => ({ name, weight: count }));
        return picked;
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

    async function generateSectionStatement({ speakerName, context, sectionIndex, sectionsCount }) {
        const contextLines = context
            .slice(-14)
            .map(m => `${m.isUser ? 'YOU' : m.name}: ${m.text}`)
            .join('\n');

        const prompt = `
You are writing a Danganronpa-style Non-stop Debate statement.

Rules:
- Output ONLY the statement text.
- 1–2 sentences, assertive, courtroom tone.
- Use facts and implications from the context.
- Mark EXACTLY ONE clause as a possible weak point using [[WEAK]]...[[/WEAK]].
- No other markup, no speaker labels.

CONTEXT:
${contextLines}

SPEAKER: ${speakerName}
SECTION: ${sectionIndex + 1} / ${sectionsCount}
`.trim();

        if (typeof generateTrialDialogue === 'function') {
            const out = String(await generateTrialDialogue(prompt, { maxTokens: 140, temperature: 0.7 }) || '').trim();
            if (out) return sanitizeDebateLine(out);
        }

        const fallback = buildFallbackStatement({ speakerName, context });
        return fallback;
    }

    function sanitizeDebateLine(text) {
        let t = String(text || '').replace(/\r?\n+/g, ' ').trim();
        t = t.replace(/^[^a-zA-Z0-9]*[A-Za-z0-9 _-]{1,32}:\s*/, '');
        return t;
    }

    function buildFallbackStatement({ speakerName, context }) {
        const hints = context
            .filter(m => !m.isUser)
            .slice(-6)
            .map(m => m.text)
            .join(' ')
            .split(/\s+/)
            .filter(w => w.length >= 6)
            .slice(0, 18)
            .join(' ');

        const core = hints || 'The timeline does not match what we established.';
        return `Listen up—${core}. [[WEAK]]That still doesn’t prove your alibi holds up.[[/WEAK]]`;
    }

    function splitStatementIntoParts(statement) {
        const raw = String(statement || '').trim();
        const weakMatch = raw.match(/\[\[WEAK\]\]([\s\S]*?)\[\[\/WEAK\]\]/i);
        let clean = raw.replace(/\[\[WEAK\]\]|\[\[\/WEAK\]\]/gi, '').trim();
        clean = clean.replace(/\s+/g, ' ');

        if (weakMatch && weakMatch[1]) {
            const weakText = weakMatch[1].trim().replace(/\s+/g, ' ');
            const beforeAfter = clean.split(weakText);
            if (beforeAfter.length >= 2) {
                const before = beforeAfter[0].trim();
                const after = beforeAfter.slice(1).join(weakText).trim();
                const parts = [];
                if (before) parts.push(...splitIntoChunks(before).map(t => ({ text: t, isWeakPoint: false })));
                parts.push({ text: weakText, isWeakPoint: true });
                if (after) parts.push(...splitIntoChunks(after).map(t => ({ text: t, isWeakPoint: false })));
                return parts.filter(p => p.text);
            }
        }

        const chunks = splitIntoChunks(clean);
        const weakPointIndex = chunks.length ? Math.floor(Math.random() * chunks.length) : 0;
        return chunks.map((t, i) => ({ text: t, isWeakPoint: i === weakPointIndex }));
    }

    return {
        start: () => {
            setState(TrialPhases.PRE_DEBATE);
        },
        stop: () => {
            setState(TrialPhases.IDLE);
        },
        onMessageSent,
        getState: () => currentState,
        phases: TrialPhases,
    };
}
