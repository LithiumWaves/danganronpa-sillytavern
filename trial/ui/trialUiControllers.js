let trialController;
let sfx;
let getMonopadSetting;
let extension_settings;
let extensionName;
let buildExtensionPathCandidates;
let vnModeController;

export function configureTrialUiControllerDeps(deps = {}) {
  trialController = deps.trialController;
  sfx = deps.sfx;
  getMonopadSetting = deps.getMonopadSetting;
  extension_settings = deps.extension_settings;
  extensionName = deps.extensionName;
  buildExtensionPathCandidates = deps.buildExtensionPathCandidates;
  vnModeController = deps.vnModeController;
}

export function updateTrialUiControllerDeps(deps = {}) {
  if ('trialController' in deps) trialController = deps.trialController;
  if ('sfx' in deps) sfx = deps.sfx;
  if ('getMonopadSetting' in deps) getMonopadSetting = deps.getMonopadSetting;
  if ('vnModeController' in deps) vnModeController = deps.vnModeController;
}

function createTrialIntroOstController() {
    const candidateTracks = buildExtensionPathCandidates()
        .map(basePath => `${basePath}/assets/classtrial/trialunderground.mp3`);

    let activeAudio = null;
    let activeTrackIndex = -1;

    function moveToNextTrack() {
        if (!activeAudio) return;
        if (activeTrackIndex >= candidateTracks.length - 1) return;
        activeTrackIndex += 1;
        activeAudio.src = candidateTracks[activeTrackIndex];
        activeAudio.load();
    }

    function stop() {
        if (!activeAudio) return;
        activeAudio.pause();
        activeAudio.currentTime = 0;
    }

    function play() {
        if (!extension_settings[extensionName]?.monopadSounds) return;
        if (!candidateTracks.length) return;

        if (!activeAudio) {
            activeTrackIndex = 0;
            activeAudio = new Audio(candidateTracks[activeTrackIndex]);
            activeAudio.loop = true;
            activeAudio.preload = "auto";
            activeAudio.volume = 0.42;

            activeAudio.addEventListener("error", () => {
                const previousIndex = activeTrackIndex;
                moveToNextTrack();
                if (previousIndex === activeTrackIndex) {
                    console.warn("[Dangan][Trial] Could not load trialunderground.mp3 from any extension path candidate.");
                    return;
                }
                activeAudio.play().catch(() => {});
            });
        }

        activeAudio.play().catch(() => {});
    }

    return {
        play,
        stop,
    };
}

function ensureTrialIntroOverlay() {
    let overlay = document.getElementById("dangan-trial-intro-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("section");
    overlay.id = "dangan-trial-intro-overlay";
    overlay.className = "dangan-trial-intro-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="dangan-trial-backdrop" aria-hidden="true">
            <div class="dangan-trial-grid"></div>
            <div class="dangan-trial-cylinder"></div>
            <div class="dangan-trial-cylinder dangan-trial-cylinder-alt"></div>
            <div class="dangan-trial-glow-orb"></div>
        </div>
        <div class="dangan-trial-intro-shell" role="dialog" aria-modal="false" aria-labelledby="dangan-trial-intro-title">
            <header class="dangan-trial-intro-header">
                <div class="dangan-trial-prep-label">Court Preparation</div>
                <h2 id="dangan-trial-intro-title">Class Trial</h2>
                <p>Sharpen your Truth Bullets and ready your opening statement.</p>
            </header>
            <section class="dangan-trial-case-summary" aria-live="polite">
                <div class="dangan-trial-case-summary-label">Case Summary</div>
                <p id="dangan-trial-case-summary-text">Case summary pending.</p>
            </section>
            <div class="dangan-trial-intro-actions">
                <button type="button" class="dangan-trial-intro-skills" id="dangan-trial-intro-skills">Equip Skills</button>
                <button type="button" class="dangan-trial-intro-cancel" id="dangan-trial-intro-cancel">Withdraw</button>
                <button type="button" class="dangan-trial-intro-start" id="dangan-trial-intro-start">Begin Class Trial</button>
            </div>
        </div>
    `;

    const startBtn = overlay.querySelector("#dangan-trial-intro-start");
    startBtn?.addEventListener("click", () => {
        if (!trialController) return;
        const result = trialController.transitionTo?.(trialController.phases.DISCUSSION_PRE_DEBATE, "trial_intro_start");
        if (!result?.ok) {
            console.info("[Dangan][Trial] Could not enter discussion_pre_debate from trial_intro.");
        }
        trialIntroUiController?.sync?.();
    });

    const skillsBtn = overlay.querySelector("#dangan-trial-intro-skills");
    skillsBtn?.addEventListener("click", () => {
        const panel = document.getElementById("dangan_monopad_panel");
        if (panel && !panel.classList.contains("open")) {
            document.getElementById("dangan_monopad_button")?.click();
        }
        setActiveMonopadTab("skills");
        itemsPanelController?.renderSkillsItemsPanel?.();
    });

    const cancelBtn = overlay.querySelector("#dangan-trial-intro-cancel");
    cancelBtn?.addEventListener("click", () => {
        trialController?.cancelTrial?.();
        trialIntroUiController?.sync?.();
    });

    document.body.appendChild(overlay);
    return overlay;
}

function createTrialDiscussionController() {
    const queue = [];
    let lastPhase = null;
    let pollId = null;
    let markerScopedDiscussionActive = false;
    let forcedVnDuringDiscussion = false;

    function clearQueue() {
        queue.length = 0;
    }

    function isDiscussionPhase(phase) {
        return phase === trialController?.phases?.DISCUSSION_PRE_DEBATE || phase === trialController?.phases?.DISCUSSION_POST_DEBATE;
    }

    function phaseLabel(phase) {
        if (phase === trialController?.phases?.DISCUSSION_PRE_DEBATE) return "Pre-Debate Discussion";
        if (phase === trialController?.phases?.DISCUSSION_POST_DEBATE) return "Post-Debate Discussion";
        return "Discussion";
    }

    function ensureVnTrialLabel() {
        const frame = document.querySelector('#dangan-vn-overlay .dangan-vn-frame');
        if (!frame) return null;

        let phaseEl = frame.querySelector('#dangan-trial-discussion-phase-inline');
        if (!phaseEl) {
            phaseEl = document.createElement('div');
            phaseEl.id = 'dangan-trial-discussion-phase-inline';
            phaseEl.className = 'dangan-trial-discussion-phase-inline';
            frame.insertBefore(phaseEl, frame.firstChild);
        }

        return phaseEl;
    }

    function renderLine(entry, phase) {
        const phaseEl = ensureVnTrialLabel();
        if (phaseEl) phaseEl.textContent = phaseLabel(phase).toUpperCase();

        const nameEl = document.getElementById('dangan-vn-name');
        const textEl = document.getElementById('dangan-vn-text');
        if (nameEl) nameEl.textContent = String(entry?.speaker || 'UNKNOWN').toUpperCase();
        if (textEl) textEl.textContent = String(entry?.line || '...');
    }

    function enqueue(entries = [], phase = null) {
        if (!Array.isArray(entries) || !entries.length) return;

        // Do not auto-scroll through queued lines; keep VN behavior stable by showing only the latest line.
        const latestEntry = entries[entries.length - 1];
        queue.length = 0;
        queue.push(latestEntry);
        renderLine(latestEntry, phase);
    }

    function extractDiscussionEntries(rawText, fallbackSpeaker = "UNKNOWN") {
        const text = String(rawText || "");
        if (!text.trim()) return [];

        const cleaned = stripV3CMarkersFromText(text);
        if (!cleaned.trim()) return [];

        return cleaned
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => ({ speaker: fallbackSpeaker, line }));
    }

    function setDiscussionVisualState(active, phase = null) {
        document.body.classList.toggle('dangan-trial-discussion-vn-active', active);
        const phaseEl = ensureVnTrialLabel();
        if (phaseEl) {
            phaseEl.style.display = active ? 'block' : 'none';
            if (active) phaseEl.textContent = phaseLabel(phase).toUpperCase();
        }

        if (active) {
            if (vnModeController) {
                vnModeController.setEnabled?.(true);
                forcedVnDuringDiscussion = true;
            }
        } else {
            if (forcedVnDuringDiscussion && vnModeController) {
                vnModeController.setEnabled?.(!!getMonopadSetting('vnModeEnabled'));
            }
            forcedVnDuringDiscussion = false;
        }
    }

    function ingestMessage({ messageSignature = "", rawText = "", speaker = "UNKNOWN" } = {}) {
        if (!trialController) return;
        const phase = trialController.getState?.()?.phase;
        if (!isDiscussionPhase(phase)) return;

        const { startMarkers, endMarkers } = parseTrialDiscussionMarkers(rawText);
        const hasStart = startMarkers.length > 0;
        const hasEnd = endMarkers.length > 0;

        if (hasStart) markerScopedDiscussionActive = true;

        const markerSignature = `TRIAL_DISCUSSION||${messageSignature}||${hasStart}||${hasEnd}`;
        if (processedTrialDiscussionSignatures.has(markerSignature)) return;
        processedTrialDiscussionSignatures.add(markerSignature);

        const shouldEnqueueFallback = !hasStart && !hasEnd && !markerScopedDiscussionActive;
        const shouldEnqueueScoped = markerScopedDiscussionActive || hasStart;

        if (shouldEnqueueFallback || shouldEnqueueScoped) {
            enqueue(extractDiscussionEntries(rawText, speaker), phase);
        }

        if (hasEnd) {
            markerScopedDiscussionActive = false;
            if (phase === trialController?.phases?.DISCUSSION_PRE_DEBATE) {
                trialController?.transitionTo?.(trialController.phases.NONSTOP_INTRO_CUTSCENE, 'discussion_segment_complete');
                nonstopDebateController?.sync?.();
            }
        }
    }

    function sync() {
        if (!trialController) {
            setDiscussionVisualState(false);
            clearQueue();
            lastPhase = null;
            markerScopedDiscussionActive = false;
            return;
        }

        const phase = trialController.getState?.()?.phase;
        const inDiscussion = isDiscussionPhase(phase);
        setDiscussionVisualState(inDiscussion, phase);

        if (!inDiscussion) {
            clearQueue();
            markerScopedDiscussionActive = false;
        }

        lastPhase = phase;
    }

    function startAutoSync() {
        if (pollId) return;
        const tick = () => {
            const phase = trialController?.getState?.()?.phase || null;
            if (phase !== lastPhase) {
                sync();
            }
        };
        pollId = window.setInterval(tick, 250);
    }

    return {
        sync,
        startAutoSync,
        ingestMessage,
    };
}


function createNonstopDebateController() {
    let introTimer = null;
    let phaseTimer = null;
    let roundToken = 0;
    let weakPointCounter = 0;
    let restoredVnAfterNsd = false;
    let lastObservedPhase = null;

    function ensureOverlay() {
        let overlay = document.getElementById('dangan-nsd-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('section');
        overlay.id = 'dangan-nsd-overlay';
        overlay.className = 'dangan-nsd-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="dangan-nsd-cutscene" id="dangan-nsd-cutscene">
                <div class="dangan-nsd-ring"></div>
                <div class="dangan-nsd-banner">NONSTOP DEBATE</div>
            </div>
            <div class="dangan-nsd-active" id="dangan-nsd-active">
                <div class="dangan-nsd-round-label" id="dangan-nsd-round-label">Round 1 · Replies: 0/0</div>
                <div class="dangan-nsd-floating-layer" id="dangan-nsd-floating-layer"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    function clearTimers() {
        if (introTimer) {
            clearTimeout(introTimer);
            introTimer = null;
        }
        if (phaseTimer) {
            clearTimeout(phaseTimer);
            phaseTimer = null;
        }
    }

    function clearFloating() {
        const overlay = ensureOverlay();
        const layer = overlay.querySelector('#dangan-nsd-floating-layer');
        if (layer) layer.innerHTML = '';
    }

    function extractQuotedSegments(text) {
        const raw = String(text || '');
        const segments = [];
        let start = -1;

        for (let i = 0; i < raw.length; i += 1) {
            const ch = raw[i];
            if (ch !== '"') continue;

            if (start === -1) {
                start = i + 1;
                continue;
            }

            const segment = raw.slice(start, i).trim();
            if (segment && segment.indexOf('\n') === -1 && segment.indexOf('\r') === -1) {
                segments.push(segment);
            }
            start = -1;
        }

        return segments;
    }

    function extractField(text, key) {
        const escapedKey = String(key || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escapedKey}\\s*:\\s*(.+)$`, 'im');
        return String(text.match(regex)?.[1] || '').trim();
    }

    function splitWords(value) {
        return String(value || '')
            .replaceAll('\n', ' ')
            .replaceAll('\r', ' ')
            .split(' ')
            .map(word => word.trim())
            .filter(Boolean);
    }

    function splitLines(value) {
        return String(value || '')
            .replaceAll('\r', '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
    }

    function chooseWeakPointRange(dialogue) {
        const words = splitWords(dialogue);
        if (!words.length) return { start: 0, end: 0 };
        const span = Math.max(1, Math.min(3, Math.floor(words.length / 3)));
        const start = Math.floor(Math.random() * Math.max(1, words.length - span + 1));
        return { start, end: Math.min(words.length - 1, start + span - 1) };
    }

    async function generateDebateReply() {
        const ctx = window.SillyTavern?.getContext?.();
        const prompt = `
TASK:
Write one short Class Trial line from one character.
Return EXACTLY this format:
speaker: <name>
line: "<one dialogue line, max 24 words>"

Rules:
- One single quoted dialogue line.
- No narration.
- No markdown.
- Keep momentum for Nonstop Debate pressure.
`.trim();

        if (ctx?.generateRaw) {
            const result = await ctx.generateRaw({
                prompt,
                max_tokens: 90,
                temperature: 0.8,
                top_p: 0.95,
                stop: ['USER:', 'ASSISTANT:']
            });
            return String(result || '').trim();
        }

        const fallback = await generateIsolated(`${prompt}
Use short analytical output only.`, { allowDialogue: true });
        return String(fallback || '').trim();
    }

    function renderFloatingLine({ speaker, dialogue, replyIndex, replyTotal, weakPointId, weakRange }) {
        const overlay = ensureOverlay();
        const labelEl = overlay.querySelector('#dangan-nsd-round-label');
        const layer = overlay.querySelector('#dangan-nsd-floating-layer');
        if (!layer) return;

        if (labelEl) labelEl.textContent = `Round 1 · Replies: ${replyIndex}/${replyTotal}`;

        const words = splitWords(dialogue);
        const weakStart = weakRange?.start ?? -1;
        const weakEnd = weakRange?.end ?? -1;

        const phrase = document.createElement('div');
        phrase.className = 'dangan-nsd-floating-line';

        const speakerEl = document.createElement('span');
        speakerEl.className = 'dangan-nsd-floating-speaker';
        speakerEl.textContent = `${String(speaker || 'UNKNOWN').toUpperCase()}:`;
        phrase.appendChild(speakerEl);

        const quoteEl = document.createElement('span');
        quoteEl.className = 'dangan-nsd-floating-quote';
        quoteEl.append(' "');

        words.forEach((word, idx) => {
            if (idx > 0) quoteEl.append(' ');
            if (idx >= weakStart && idx <= weakEnd) {
                const weak = document.createElement('button');
                weak.type = 'button';
                weak.className = 'dangan-nsd-weak-point';
                weak.textContent = word;
                weak.dataset.weakPointId = String(weakPointId);
                weak.addEventListener('click', () => {
                    window.fireTruthBulletAtWeakPoint?.(weakPointId);
                });
                quoteEl.appendChild(weak);
            } else {
                quoteEl.append(word);
            }
        });

        quoteEl.append('"');
        phrase.appendChild(quoteEl);

        const driftX = (Math.random() * 38 - 19).toFixed(2);
        phrase.style.setProperty('--nsd-drift-x', `${driftX}px`);
        phrase.style.setProperty('--nsd-order', String(replyIndex));
        layer.appendChild(phrase);

        // Keep only recent floating lines visible.
        const lines = Array.from(layer.querySelectorAll('.dangan-nsd-floating-line'));
        if (lines.length > 6) {
            lines.slice(0, lines.length - 6).forEach(el => el.remove());
        }
    }

    function hideOverlay() {
        const overlay = ensureOverlay();
        overlay.classList.remove('active', 'phase-cutscene', 'phase-active');
        overlay.setAttribute('aria-hidden', 'true');
        clearTimers();
        clearFloating();
        roundToken += 1;
        lastObservedPhase = null;

        document.body.classList.remove('dangan-trial-nsd-active');
        if (!restoredVnAfterNsd && vnModeController) {
            vnModeController.setEnabled?.(!!getMonopadSetting('vnModeEnabled'));
        }
        restoredVnAfterNsd = false;
    }

    function startActiveSection(token) {
        if (token !== roundToken) return;
        const state = trialController?.getState?.();
        if (state?.phase !== trialController?.phases?.NONSTOP_ACTIVE) return;

        const overlay = ensureOverlay();
        overlay.classList.add('active', 'phase-active');
        overlay.classList.remove('phase-cutscene');
        overlay.setAttribute('aria-hidden', 'false');

        // During NSD active, hide VN box and use floating text only.
        document.body.classList.add('dangan-trial-nsd-active');
        if (vnModeController) {
            vnModeController.setEnabled?.(false);
            restoredVnAfterNsd = true;
        }

        clearFloating();

        const replyTotal = Math.floor(Math.random() * 6) + 3; // 3..8
        let replyIndex = 0;
        let stopped = false;

        const runNext = async (currentPromise = null) => {
            if (stopped || token !== roundToken) return;
            if (trialController?.getState?.()?.phase !== trialController?.phases?.NONSTOP_ACTIVE) return;

            const replyPromise = currentPromise || generateDebateReply();
            const nextPromise = generateDebateReply();
            const rawReply = await replyPromise.catch(() => '');

            if (stopped || token !== roundToken) return;

            const speaker = extractField(rawReply, 'speaker') || 'UNKNOWN';
            const quotes = extractQuotedSegments(rawReply);
            const dialogue = quotes[0] || splitLines(rawReply)[0] || '...';

            replyIndex += 1;
            weakPointCounter += 1;
            const weakRange = chooseWeakPointRange(dialogue);
            const weakPointId = `weak_${token}_${weakPointCounter}`;

            renderFloatingLine({
                speaker,
                dialogue,
                replyIndex,
                replyTotal,
                weakPointId,
                weakRange,
            });

            if (replyIndex >= replyTotal) {
                // End of this NSD section: interrupt further generation and take a short break, then repeat.
                phaseTimer = window.setTimeout(() => {
                    if (token !== roundToken) return;
                    runSectionLoop(token);
                }, 1100);
                return;
            }

            phaseTimer = window.setTimeout(() => {
                runNext(nextPromise);
            }, 950);
        };

        runNext();

        window.fireTruthBulletAtWeakPoint = (shotWeakPointId) => {
            if (token !== roundToken) return { hit: false, reason: 'stale' };
            if (!shotWeakPointId) return { hit: false, reason: 'invalid' };
            stopped = true;
            clearTimers();
            trialController?.transitionTo?.(trialController.phases.DISCUSSION_POST_DEBATE, 'nsd_hit');
            sync();
            return { hit: true, weakPointId: shotWeakPointId };
        };
    }

    function runSectionLoop(token) {
        if (token !== roundToken) return;
        const phase = trialController?.getState?.()?.phase;
        if (phase !== trialController?.phases?.NONSTOP_ACTIVE) return;
        startActiveSection(token);
    }

    function beginCutscene() {
        const state = trialController?.getState?.();
        if (state?.phase !== trialController?.phases?.NONSTOP_INTRO_CUTSCENE) return;

        const overlay = ensureOverlay();
        overlay.classList.add('active', 'phase-cutscene');
        overlay.classList.remove('phase-active');
        overlay.setAttribute('aria-hidden', 'false');

        clearTimers();
        const token = ++roundToken;
        introTimer = window.setTimeout(() => {
            const stillCutscene = trialController?.getState?.()?.phase === trialController?.phases?.NONSTOP_INTRO_CUTSCENE;
            if (!stillCutscene || token !== roundToken) return;
            trialController?.transitionTo?.(trialController.phases.NONSTOP_ACTIVE, 'nsd_cutscene_complete');
            sync();
        }, 2100);
    }

    function sync() {
        const phase = trialController?.getState?.()?.phase;

        if (phase === trialController?.phases?.NONSTOP_INTRO_CUTSCENE) {
            if (lastObservedPhase !== phase) {
                lastObservedPhase = phase;
                beginCutscene();
            }
            return;
        }

        if (phase === trialController?.phases?.NONSTOP_ACTIVE) {
            if (lastObservedPhase !== phase) {
                lastObservedPhase = phase;
                const token = ++roundToken;
                startActiveSection(token);
            }
            return;
        }

        hideOverlay();
    }

    // Backward compatibility no-op for older hooks.
    window.fireTruthBulletAtPhrase = () => ({ hit: false, reason: 'use_weak_point' });

    return {
        sync,
    };
}


function createTrialIntroUiController() {
    let isVisible = false;
    let lastPhase = null;
    let pollId = null;

    function applyViewportSafeLayout(overlay) {
        if (!overlay) return;

        const shell = overlay.querySelector('.dangan-trial-intro-shell');
        const visualViewport = window.visualViewport;
        const viewportHeight = Math.max(320, Math.round(visualViewport?.height || window.innerHeight || 0));
        const viewportWidth = Math.max(280, window.innerWidth || 0);
        const viewportOffsetTop = Math.max(0, Math.round(visualViewport?.offsetTop || 0));
        const isMobile = viewportWidth <= 700;

        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '2147483647';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = isMobile ? 'flex-end' : 'center';
        overlay.style.boxSizing = 'border-box';

        if (!shell) return;

        shell.style.boxSizing = 'border-box';
        shell.style.overflow = 'auto';

        if (isMobile) {
            const topPadding = Math.max(10, viewportOffsetTop + 10);
            const sidePadding = 8;
            const bottomPadding = 10;

            overlay.style.padding = `${topPadding}px ${sidePadding}px ${bottomPadding}px`;

            const maxHeight = Math.max(220, viewportHeight - topPadding - bottomPadding);
            shell.style.width = `${Math.max(280, Math.min(540, viewportWidth - 16))}px`;
            shell.style.minHeight = '0';
            shell.style.maxHeight = `${maxHeight}px`;
            shell.style.height = 'auto';
            shell.style.margin = '0 auto';
            shell.style.borderRadius = '12px';
        } else {
            overlay.style.padding = '';
            shell.style.minHeight = '';
            shell.style.maxHeight = `${Math.max(220, viewportHeight - 16)}px`;
            shell.style.height = '';
            shell.style.width = '';
            shell.style.margin = '';
            shell.style.borderRadius = '';
        }
    }

    function setVisible(nextVisible) {
        const overlay = ensureTrialIntroOverlay();
        overlay.classList.toggle("active", nextVisible);
        overlay.setAttribute("aria-hidden", nextVisible ? "false" : "true");
        overlay.style.display = nextVisible ? 'flex' : 'none';
        overlay.style.pointerEvents = nextVisible ? 'auto' : 'none';

        const vnModeOn = !!getMonopadSetting("vnModeEnabled");
        document.body.classList.toggle("dangan-trial-vn-chat-hidden", nextVisible && vnModeOn);

        if (nextVisible) {
            applyViewportSafeLayout(overlay);
        }

        if (nextVisible && !isVisible) {
            trialIntroOstController?.play?.();
        } else if (!nextVisible && isVisible) {
            trialIntroOstController?.stop?.();
        }

        isVisible = nextVisible;
    }

    function sync() {
        if (!trialController) {
            setVisible(false);
            lastPhase = null;
            return;
        }

        const trialState = trialController.getState?.();
        const phase = trialState?.phase || null;
        lastPhase = phase;
        const isTrialIntro = phase === trialController.phases?.TRIAL_INTRO;
        const overlay = ensureTrialIntroOverlay();
        const summaryEl = overlay.querySelector("#dangan-trial-case-summary-text");
        if (summaryEl) {
            summaryEl.textContent = String(trialState?.session?.caseSummary || "Case summary pending.");
        }

        setVisible(isTrialIntro);
    }

    function startAutoSync() {
        if (pollId) return;

        const tick = () => {
            if (!trialController) {
                if (lastPhase !== null) sync();
                return;
            }
            const phase = trialController.getState?.()?.phase || null;
            if (phase !== lastPhase) {
                sync();
                return;
            }

            if (isVisible) {
                applyViewportSafeLayout(document.getElementById('dangan-trial-intro-overlay'));
            }
        };

        pollId = window.setInterval(tick, 250);
        document.addEventListener("visibilitychange", tick);
        window.addEventListener('resize', tick);
        window.addEventListener('orientationchange', tick);
    }

    return {
        sync,
        startAutoSync,
    };
}


export { createTrialIntroOstController, createTrialDiscussionController, createNonstopDebateController, createTrialIntroUiController };
