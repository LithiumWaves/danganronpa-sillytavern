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
        playSfx,
        getSfx,
        characters,
    } = deps;

    let currentState = TrialPhases.IDLE;
    let currentDebateSections = 0;
    let selectedTruthBulletIndex = 0;
    let debateOverlay = null;
    let reticleEl = null;
    let floatingStatements = [];
    let animationFrameId = null;
    let currentSpeaker = null;
    let currentWeakPointInfo = null;

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
            startNonStopDebate();
        };
    }

    function startNonStopDebate() {
        currentDebateSections = Math.floor(Math.random() * (8 - 3 + 1)) + 3;
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
        startFloatingTextLoop();
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

    function startFloatingTextLoop() {
        const messages = getRecentMessages();
        if (messages.length === 0) return;

        let currentSection = 0;
        
        function nextSection() {
            if (currentState !== TrialPhases.NON_STOP_DEBATE) return;

            const msg = messages[Math.floor(Math.random() * messages.length)];
            const speakerName = msg.name || '???';
            document.getElementById('dangan-speaker-name').textContent = speakerName.toUpperCase();
            document.getElementById('dangan-section-count').textContent = `SECTION ${currentSection + 1} / ${currentDebateSections}`;

            const chunks = splitIntoChunks(msg.text);
            const weakPointIndex = Math.floor(Math.random() * chunks.length);
            
            chunks.forEach((chunk, i) => {
                const isWeakPoint = i === weakPointIndex;
                createFloatingStatement(chunk, isWeakPoint, currentSection);
            });

            currentSection = (currentSection + 1) % currentDebateSections;
            
            // Loop back if all sections shown
            setTimeout(nextSection, 4000); 
        }

        nextSection();
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
        floatingStatements.forEach(s => s.element.remove());
        floatingStatements = [];
        if (debateOverlay) {
            debateOverlay.remove();
            debateOverlay = null;
        }
        const notif = document.getElementById('dangan-trial-pre-debate-notif');
        if (notif) notif.remove();
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
