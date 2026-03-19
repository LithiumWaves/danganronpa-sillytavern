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
        getCharacterSourceText,
        getSpriteUrl,
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

        void updateSpeakerPortrait(speakerName);

        showStatementChunk({
            text: part.text,
            isWeakPoint: Boolean(part.isWeakPoint),
            laneY: getLaneY(debatePartIndex),
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

    async function updateSpeakerPortrait(speakerName) {
        if (!portraitImgEl) return;
        const name = String(speakerName || '').trim();
        if (!name) return;
        if (portraitSpeaker === name) return;
        portraitSpeaker = name;

        const token = ++portraitToken;

        if (typeof getSpriteUrl !== 'function') {
            portraitImgEl.style.display = 'none';
            return;
        }

        try {
            const url = await getSpriteUrl(name);
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

    function showStatementChunk({ text, isWeakPoint, laneY }) {
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
        if (isWeakPoint) {
            el.classList.add('dangan-weak-point');
        }
        el.textContent = stripSurroundingQuotes(String(text || ''));
        el.style.top = `${laneY}px`;
        el.style.left = `0px`;
        debateOverlay.appendChild(el);

        if (isWeakPoint) {
            currentWeakPointInfo = { text: el.textContent, element: el };
        }

        const startX = (window.innerWidth || 1200) + 220;
        const endX = -(el.getBoundingClientRect().width + 240);
        const distance = Math.abs(startX - endX);
        const duration = Math.round(Math.max(1800, Math.min(3800, (distance / 0.7))));

        statementEl = el;
        statementAnimation = el.animate(
            [
                { transform: `translateX(${startX}px) skewX(-12deg)`, opacity: 0 },
                { transform: `translateX(${startX - 120}px) skewX(-12deg)`, opacity: 1, offset: 0.08 },
                { transform: `translateX(${endX}px) skewX(-12deg)`, opacity: 1 },
            ],
            { duration, easing: 'linear', fill: 'forwards' }
        );

        return new Promise(resolve => {
            statementAnimation.onfinish = () => {
                if (statementEl === el) {
                    el.remove();
                    statementEl = null;
                    statementAnimation = null;
                    if (currentWeakPointInfo?.element === el) currentWeakPointInfo = null;
                }
                resolve();
            };
            statementAnimation.oncancel = () => resolve();
        });
    }

    function handleShoot(e) {
        const bullets = getTruthBullets();
        const currentBullet = bullets[selectedTruthBulletIndex];
        if (!currentBullet) return;

        const wp = currentWeakPointInfo?.element;
        if (wp instanceof HTMLElement) {
            const rect = wp.getBoundingClientRect();
            const padding = 26;
            const hit = (
                e.clientX >= rect.left - padding &&
                e.clientX <= rect.right + padding &&
                e.clientY >= rect.top - padding &&
                e.clientY <= rect.bottom + padding
            );
            if (!hit) {
                playSfx?.(getSfx?.().miss || 'miss');
                return;
            }

            console.log('[Dangan][Trial] CRITICAL HIT!');
            playSfx?.(getSfx?.().hit || 'hit'); 
            
            // Highlight the hit weak point
            wp.style.color = '#ff0000';
            wp.style.fontSize = '48px';
            wp.style.fontWeight = 'bold';
            
            setTimeout(() => {
                setState(TrialPhases.TRUTH_BULLET_EXPLANATION);
                showExplanationUI(currentBullet, wp.textContent);
            }, 1000);
            return;
        }

        playSfx?.(getSfx?.().miss || 'miss');
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
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;

        const mapped = (chat || readDomChatMessages(30))
            .map(m => ({
                isUser: Boolean(m?.is_user ?? m?.isUser),
                isSystem: Boolean(m?.is_system ?? m?.isSystem),
                name: String(m?.name || m?.ch_name || m?.character_name || m?.sender || (m?.is_user ? 'You' : '???')),
                text: String(m?.mes || m?.text || m?.message || '').trim(),
            }))
            .filter(m => !m.isUser && !m.isSystem)
            .map(m => ({
                name: m.name,
                text: extractDialogueOnly(m.text),
            }))
            .filter(m => m.text);

        return mapped.slice(-10);
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
        for (let i = 0; i < sectionsCount; i++) {
            const speakerName = pickSpeakerWeighted(selectedSpeakers);
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
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;
        const source = chat || readDomChatMessages(40);
        return source
            .filter(m => !m?.is_system && !m?.isSystem)
            .slice(-30)
            .map(m => ({
                isUser: Boolean(m?.is_user ?? m?.isUser),
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

        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, weight: count }))
            .filter(s => !isGroupMemberMuted(s.name));
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

        const sourceText = typeof getCharacterSourceText === 'function'
            ? String(getCharacterSourceText(speakerName) || '').trim()
            : '';

        const prompt = `
You are ${speakerName}.

Write the next spoken line for a Danganronpa-style Non-stop Debate.

Rules:
- Stay fully in character.
- Output ONLY spoken dialogue in double quotes.
- No narration, no actions, no inner thoughts.
- 1–2 sentences, assertive courtroom tone.
- Use facts and implications from the context.
- Inside the quotes, mark EXACTLY ONE clause as a possible weak point using [[WEAK]]...[[/WEAK]].
- No other markup and no speaker labels.

CHARACTER DATA:
${sourceText || 'NO CHARACTER DATA AVAILABLE.'}

RECENT CONTEXT:
${contextLines}

SECTION: ${sectionIndex + 1} / ${sectionsCount}
`.trim();

        if (typeof generateTrialDialogue !== 'function') {
            return ensureSingleWeakPointMarker('...');
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
            if (withWeak) return withWeak;
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
        const hasOpen = /\[\[WEAK\]\]/i.test(raw);
        const hasClose = /\[\[\/WEAK\]\]/i.test(raw);
        if (hasOpen && hasClose) {
            const firstOpen = raw.search(/\[\[WEAK\]\]/i);
            const afterOpen = raw.slice(firstOpen + 8);
            const firstCloseRel = afterOpen.search(/\[\[\/WEAK\]\]/i);
            if (firstCloseRel >= 0) {
                const firstClose = firstOpen + 8 + firstCloseRel;
                const keep = raw.slice(0, firstClose + 9);
                const tail = raw.slice(firstClose + 9).replace(/\[\[WEAK\]\]|\[\[\/WEAK\]\]/gi, '');
                return (keep + tail).replace(/\s+/g, ' ').trim();
            }
        }

        const clean = raw.replace(/\[\[WEAK\]\]|\[\[\/WEAK\]\]/gi, '').replace(/\s+/g, ' ').trim();
        if (!clean) return '[[WEAK]]...[[/WEAK]]';

        const words = clean.split(' ').filter(Boolean);
        if (words.length <= 3) return `[[WEAK]]${clean}[[/WEAK]]`;

        const span = Math.min(8, Math.max(4, Math.floor(words.length / 2)));
        const start = Math.max(0, Math.min(words.length - span, Math.floor(words.length / 3)));
        const weak = words.slice(start, start + span).join(' ');

        const before = words.slice(0, start).join(' ');
        const after = words.slice(start + span).join(' ');

        return [before, `[[WEAK]]${weak}[[/WEAK]]`, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
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
            const text = String(textEl?.innerText || '').trim();
            return {
                isUser,
                isSystem,
                ch_name: chName,
                text,
            };
        });
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
