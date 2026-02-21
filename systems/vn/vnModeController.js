export function createVnSystem({ extensionName, saveSettingsDebounced }) {
function trySetVisualNovelToggleInObject(root, enabled, { maxDepth = 8 } = {}) {
    if (!root || typeof root !== "object") return false;

    const queue = [{ node: root, depth: 0 }];
    const visited = new WeakSet();
    let touched = false;

    while (queue.length) {
        const { node, depth } = queue.shift();
        if (!node || typeof node !== "object" || visited.has(node)) continue;
        visited.add(node);

        const label = normalizeTextToken(node.name || node.label || node.title || node.id || node.key || "");
        const isVisualNovelSetting = /visual/.test(label) && /novel|vn/.test(label) && /mode|toggle|enabled|active/.test(label);

        if (isVisualNovelSetting) {
            if (typeof node.enabled === "boolean") { node.enabled = enabled; touched = true; }
            if (typeof node.value === "boolean") { node.value = enabled; touched = true; }
            if (typeof node.active === "boolean") { node.active = enabled; touched = true; }
            if (typeof node.toggled === "boolean") { node.toggled = enabled; touched = true; }
            if (typeof node.isEnabled === "boolean") { node.isEnabled = enabled; touched = true; }
            if (typeof node.isActive === "boolean") { node.isActive = enabled; touched = true; }
            if (typeof node.setValue === "function") { node.setValue(enabled); touched = true; }
            if (typeof node.set === "function") { node.set(enabled); touched = true; }
        }

        if (depth >= maxDepth) continue;

        try {
            for (const value of Object.values(node)) {
                if (value && typeof value === "object") queue.push({ node: value, depth: depth + 1 });
            }
        } catch {
            // skip host objects that throw on traversal
        }
    }

    return touched;
}

function trySetSillyTavernVisualNovelMode(enabled) {
    const ctx = window.SillyTavern?.getContext?.();
    let touched = false;

    const candidates = [
        ctx?.chatCompletionSettings,
        ctx?.chat_completion_settings,
        ctx?.mainApiSettings,
        ctx?.main_api_settings,
        ctx?.settings,
        ctx,
        window.SillyTavern,
    ];

    for (const candidate of candidates) {
        try {
            touched = trySetVisualNovelToggleInObject(candidate, enabled) || touched;
        } catch {
            // ignore malformed hosts
        }
    }

    const domCandidates = Array.from(document.querySelectorAll('label, .menu_button, .inline-drawer-toggle, button, .toggle-item'));
    for (const el of domCandidates) {
        const labelText = normalizeTextToken(el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '');
        if (!(/visual/.test(labelText) && /novel|vn/.test(labelText))) continue;

        const host = el.closest('label, .toggle-item, .settings-item, .menu_button, .inline-drawer-toggle') || el;
        const checkbox = host.querySelector('input[type="checkbox"]') || el.querySelector?.('input[type="checkbox"]');

        if (checkbox) {
            if (checkbox.checked !== enabled) {
                checkbox.click();
                checkbox.dispatchEvent(new Event('input', { bubbles: true }));
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
            touched = true;
            break;
        }

        const isPressed = host.getAttribute('aria-pressed') === 'true';
        if (isPressed !== enabled && typeof host.click === 'function') {
            host.click();
            touched = true;
            break;
        }

        if (isPressed === enabled) {
            touched = true;
            break;
        }
    }

    if (touched) {
        if (typeof ctx?.saveSettingsDebounced === 'function') {
            ctx.saveSettingsDebounced();
        } else {
            saveSettingsDebounced();
        }
    }

    return touched;
}

function createVnModeController() {
    const CHUNK_SIZE = 170;
    const VN_POSITION_KEY = `${extensionName}-vn-box-position`;
    let chunkIndex = 0;
    let messageIndex = 0;
    let monopadOpen = false;
    let moveUnlocked = false;
    let isDragging = false;
    let movedDuringPointer = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let frameStartX = 0;
    let frameStartY = 0;
    let framePosX = null;
    let framePosY = null;
    let transcriptOpen = false;
    let vnEnabled = false;
    let composeCollapsed = false;
    let lastObservedMessageCount = 0;
    let lastObservedLastSignature = '';
    let lastObservedChatScope = '';

    const host = document.createElement('div');
    host.id = 'dangan-vn-overlay';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = `
        <div class="dangan-vn-frame" role="dialog" aria-live="polite" aria-label="Dangan Visual Novel dialogue">
            <div class="dangan-vn-controls">
                <button type="button" class="dangan-vn-control dangan-vn-transcript-toggle" id="dangan-vn-transcript-toggle" aria-label="Open transcript" title="Open transcript">TRANSCRIPT</button>
                <button type="button" class="dangan-vn-control dangan-vn-lock" id="dangan-vn-lock" aria-label="Unlock Visual Novel box movement" title="Unlock Visual Novel box movement">🔒</button>
            </div>
            <div class="dangan-vn-header">
                <div class="dangan-vn-nameplate" id="dangan-vn-name">—</div>
                <div class="dangan-vn-position" id="dangan-vn-position" aria-live="polite">Line 0 / 0</div>
            </div>
            <div class="dangan-vn-text-wrap">
                <div class="dangan-vn-text" id="dangan-vn-text">Visual Novel Mode ready.</div>
            </div>
            <div class="dangan-vn-footer">
                <div class="dangan-vn-progress" aria-hidden="true"><div class="dangan-vn-progress-fill" id="dangan-vn-progress-fill"></div></div>
                <div class="dangan-vn-input">Click text, use ←/→, or Space · Type in SillyTavern input below</div>
                <div class="dangan-vn-nav">
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button" id="dangan-vn-prev" aria-label="Show previous line">◀ Prev</button>
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button" id="dangan-vn-next" aria-label="Show next line">Next ▶</button>
                    <button type="button" class="dangan-vn-control dangan-vn-nav-button dangan-vn-regenerate" id="dangan-vn-regenerate" aria-label="Regenerate current reply">↻ Regenerate</button>
                </div>
            </div>
        </div>
        <div class="dangan-vn-transcript" id="dangan-vn-transcript" aria-hidden="true">
            <div class="dangan-vn-transcript-header">
                <div class="dangan-vn-transcript-title">Class Transcript</div>
                <button type="button" class="dangan-vn-transcript-close" id="dangan-vn-transcript-close" aria-label="Close transcript">✕</button>
            </div>
            <div class="dangan-vn-transcript-body" id="dangan-vn-transcript-body"></div>
        </div>
    `;
    document.body.appendChild(host);

    const frameEl = host.querySelector('.dangan-vn-frame');
    const lockBtnEl = host.querySelector('#dangan-vn-lock');
    const transcriptToggleEl = host.querySelector('#dangan-vn-transcript-toggle');
    const transcriptEl = host.querySelector('#dangan-vn-transcript');
    const transcriptCloseEl = host.querySelector('#dangan-vn-transcript-close');
    const transcriptBodyEl = host.querySelector('#dangan-vn-transcript-body');
    const nameEl = host.querySelector('#dangan-vn-name');
    const positionEl = host.querySelector('#dangan-vn-position');
    const textEl = host.querySelector('#dangan-vn-text');
    const progressFillEl = host.querySelector('#dangan-vn-progress-fill');
    const prevBtnEl = host.querySelector('#dangan-vn-prev');
    const nextBtnEl = host.querySelector('#dangan-vn-next');
    const regenerateBtnEl = host.querySelector('#dangan-vn-regenerate');


    function isElementVisible(el) {
        if (!(el instanceof Element)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getRegenerateControl() {
        const controls = Array.from(document.querySelectorAll('button, .menu_button, [role="button"], a'));
        for (const control of controls) {
            if (!(control instanceof Element)) continue;
            if (control.closest('#dangan-vn-overlay')) continue;
            const label = `${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''} ${control.textContent || ''}`.toLowerCase();
            if (!/\bregenerate\b/.test(label)) continue;
            if (!isElementVisible(control)) continue;
            return control;
        }
        return null;
    }

    function triggerRegenerate() {
        const control = getRegenerateControl();
        if (!control) return false;
        if (typeof control.click === 'function') {
            control.click();
            return true;
        }
        control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
    }

    function updateNavigationState(messages = getMessageEntries()) {
        const total = messages.length;
        const current = total ? Math.min(total, messageIndex + 1) : 0;
        if (positionEl) {
            positionEl.textContent = `Line ${current} / ${total}`;
        }

        const hasPrevious = total > 0 && (chunkIndex > 0 || messageIndex > 0);
        const hasNext = (() => {
            if (!total) return false;
            const currentEntry = messages[Math.min(messageIndex, total - 1)];
            const chunks = splitIntoChunks(stripV3CMarkersFromText(currentEntry?.text || ''));
            const canAdvanceWithinCurrent = chunkIndex + 1 < chunks.length;
            const canAdvanceToNext = messageIndex < total - 1;
            return canAdvanceWithinCurrent || canAdvanceToNext;
        })();

        if (prevBtnEl) prevBtnEl.disabled = !hasPrevious;
        if (nextBtnEl) nextBtnEl.disabled = !hasNext;
        if (regenerateBtnEl) regenerateBtnEl.disabled = !getRegenerateControl();
        if (progressFillEl) {
            const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
            progressFillEl.style.width = `${percent}%`;
        }
    }

    function applyInlineFallbackStyles() {
        Object.assign(host.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2147483646',
            display: 'none',
            alignItems: 'flex-end',
            justifyContent: 'center',
            pointerEvents: 'none',
            background: 'transparent',
        });

        if (frameEl) {
            Object.assign(frameEl.style, {
                width: 'min(980px, calc(100vw - 18px))',
                minHeight: '170px',
                margin: '0 9px 10px',
                borderRadius: '12px',
                border: '1px solid rgba(191, 229, 255, 0.45)',
                background: 'linear-gradient(180deg, rgba(8, 12, 20, 0.96), rgba(6, 9, 14, 0.97))',
                boxShadow: '0 -3px 20px rgba(0, 0, 0, 0.45)',
                color: '#f4f8ff',
                padding: '14px 14px 10px',
                cursor: 'pointer',
                pointerEvents: 'auto',
            });
        }
    }

    function ensureHostAttached() {
        if (host.parentElement !== document.body) {
            document.body.appendChild(host);
        }
    }

    function clampPosition(nextX, nextY) {
        if (!frameEl) return { x: 0, y: 0 };

        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        const rect = frameEl.getBoundingClientRect();
        const maxX = Math.max(0, Math.round(vw - rect.width));
        const maxY = Math.max(0, Math.round(vh - rect.height));

        return {
            x: Math.max(0, Math.min(maxX, Math.round(nextX))),
            y: Math.max(0, Math.min(maxY, Math.round(nextY))),
        };
    }

    function savePosition() {
        if (!Number.isFinite(framePosX) || !Number.isFinite(framePosY)) return;
        try {
            localStorage.setItem(VN_POSITION_KEY, JSON.stringify({ x: framePosX, y: framePosY }));
        } catch {
            // ignore storage failures
        }
    }

    function clearSavedPosition() {
        try {
            localStorage.removeItem(VN_POSITION_KEY);
        } catch {
            // ignore storage failures
        }
    }

    function setFramePosition(nextX, nextY) {
        if (!frameEl) return;
        const { x, y } = clampPosition(nextX, nextY);
        framePosX = x;
        framePosY = y;
        frameEl.classList.add('dangan-vn-custom-pos');
        frameEl.style.left = `${x}px`;
        frameEl.style.top = `${y}px`;
    }

    function resetFramePosition() {
        if (!frameEl) return;
        framePosX = null;
        framePosY = null;
        frameEl.classList.remove('dangan-vn-custom-pos');
        frameEl.style.left = '';
        frameEl.style.top = '';
        clearSavedPosition();
    }

    function restoreSavedPosition() {
        try {
            const raw = localStorage.getItem(VN_POSITION_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return;
            setFramePosition(parsed.x, parsed.y);
        } catch {
            // ignore storage failures
        }
    }

    function setMoveUnlocked(unlocked) {
        moveUnlocked = !!unlocked;
        if (!lockBtnEl) return;
        lockBtnEl.textContent = moveUnlocked ? '🔓' : '🔒';
        lockBtnEl.setAttribute('aria-label', moveUnlocked ? 'Lock Visual Novel box movement' : 'Unlock Visual Novel box movement');
        lockBtnEl.setAttribute('title', moveUnlocked ? 'Lock Visual Novel box movement' : 'Unlock Visual Novel box movement');
        frameEl?.classList.toggle('move-unlocked', moveUnlocked);
    }

    function setTranscriptOpen(open) {
        transcriptOpen = !!open;
        host.classList.toggle('transcript-open', transcriptOpen);
        transcriptEl?.setAttribute('aria-hidden', transcriptOpen ? 'false' : 'true');
        transcriptToggleEl?.setAttribute('aria-expanded', transcriptOpen ? 'true' : 'false');
        if (transcriptOpen) {
            renderTranscript();
        }
    }

    function updateBottomOffset() {
        if (!frameEl) return;

        if (vnEnabled) {
            host.style.setProperty('--dangan-vn-bottom-offset', '0px');
            return;
        }

        const composeEl = document.querySelector('#send_form, #chat_input_container, #send_textarea, #send_textarea_holder, .send_form');
        const composeRect = composeEl?.getBoundingClientRect?.();
        const composeHeight = Number.isFinite(composeRect?.height) ? composeRect.height : 0;
        const offset = Math.max(0, Math.round(composeHeight + 8));
        host.style.setProperty('--dangan-vn-bottom-offset', `${offset}px`);
    }

    function syncMonopadVisibility() {
        const shouldHideFrame = monopadOpen;
        if (!frameEl) return;
        frameEl.style.display = shouldHideFrame ? 'none' : '';
    }

    function getComposeElement() {
        return document.querySelector('#send_form, #chat_input_container, #send_textarea_holder, .send_form');
    }

    function undockTypingSection() {
        const composeEl = getComposeElement();
        if (!composeEl) return;
        const toggleBtn = composeEl.querySelector('.dangan-vn-compose-collapse-toggle');
        toggleBtn?.remove();
        composeCollapsed = false;
        composeEl.classList.remove('dangan-vn-compose-docked');
        composeEl.classList.remove('dangan-vn-compose-collapsed');
        composeEl.style.position = '';
        composeEl.style.left = '';
        composeEl.style.top = '';
        composeEl.style.width = '';
        composeEl.style.maxWidth = '';
        composeEl.style.margin = '';
        composeEl.style.transform = '';
        composeEl.style.zIndex = '';
        document.body.classList.remove('dangan-vn-compose-docked-active');
    }

    function ensureComposeCollapseToggle(composeEl) {
        if (!composeEl) return;

        let toggleBtn = composeEl.querySelector('.dangan-vn-compose-collapse-toggle');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'dangan-vn-compose-collapse-toggle';
            toggleBtn.textContent = '▾';
            toggleBtn.title = 'Collapse typing section';
            toggleBtn.setAttribute('aria-label', 'Collapse typing section');
            composeEl.prepend(toggleBtn);

            toggleBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                composeCollapsed = !composeCollapsed;
                composeEl.classList.toggle('dangan-vn-compose-collapsed', composeCollapsed);
                toggleBtn.textContent = composeCollapsed ? '▸' : '▾';
                toggleBtn.title = composeCollapsed ? 'Expand typing section' : 'Collapse typing section';
                toggleBtn.setAttribute('aria-label', composeCollapsed ? 'Expand typing section' : 'Collapse typing section');
            });
        }
    }

    function dockTypingSection() {
        const composeEl = getComposeElement();
        if (!composeEl) return;

        if (!vnEnabled || monopadOpen || frameEl?.style.display === 'none') {
            undockTypingSection();
            return;
        }

        const frameRect = frameEl?.getBoundingClientRect?.();
        if (!frameRect || !Number.isFinite(frameRect.width)) {
            undockTypingSection();
            return;
        }

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const composeRect = composeEl.getBoundingClientRect();
        const composeHeight = Number.isFinite(composeRect.height) ? composeRect.height : 52;

        const width = Math.max(220, Math.round(frameRect.width));
        const maxLeft = Math.max(0, viewportWidth - width);
        const left = Math.max(0, Math.min(maxLeft, Math.round(frameRect.left)));
        const maxTop = Math.max(0, viewportHeight - composeHeight - 4);
        const top = Math.max(0, Math.min(maxTop, Math.round(frameRect.bottom - 1)));

        ensureComposeCollapseToggle(composeEl);
        composeEl.classList.add('dangan-vn-compose-docked');
        composeEl.classList.toggle('dangan-vn-compose-collapsed', composeCollapsed);
        composeEl.style.position = 'fixed';
        composeEl.style.left = `${left}px`;
        composeEl.style.top = `${top}px`;
        composeEl.style.width = `${width}px`;
        composeEl.style.maxWidth = `${width}px`;
        composeEl.style.margin = '0';
        composeEl.style.transform = 'none';
        composeEl.style.zIndex = '2147483644';
        document.body.classList.add('dangan-vn-compose-docked-active');
    }

    applyInlineFallbackStyles();
    updateBottomOffset();
    syncMonopadVisibility();
    restoreSavedPosition();
    setMoveUnlocked(false);

    const htmlDecodeBuffer = document.createElement('div');
    const toPlainText = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        htmlDecodeBuffer.innerHTML = raw;
        return String(htmlDecodeBuffer.textContent || htmlDecodeBuffer.innerText || '').trim();
    };

    function getContextMessages() {
        const ctx = window.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];

        return chat.map((msg, idx) => {
            const isUser = String(msg?.is_user ?? msg?.isUser ?? '').toLowerCase() === 'true' || msg?.is_user === true || msg?.isUser === true;
            const isSystem = String(msg?.is_system ?? msg?.isSystem ?? msg?.is_system_message ?? '').toLowerCase() === 'true' || msg?.is_system === true || msg?.isSystem === true || msg?.is_system_message === true;
            const name = String(msg?.name || msg?.ch_name || msg?.character_name || msg?.display_name || '').trim();
            const textRaw = msg?.mes ?? msg?.message ?? msg?.content ?? msg?.swipe_info?.[msg?.swipe_id || 0]?.mes ?? '';
            const text = toPlainText(textRaw);

            return {
                key: `ctx-${idx}`,
                isUser,
                isSystem,
                name,
                text,
            };
        }).filter(msg => !msg.isUser && !msg.isSystem && msg.text);
    }

    function getDomMessages() {
        return Array.from(document.querySelectorAll('.mes')).map((msgEl, idx) => {
            const isUser = msgEl.getAttribute('is_user') === 'true';
            const isSystem = msgEl.getAttribute('is_system') === 'true';
            const name = String(msgEl.getAttribute('ch_name') || msgEl.getAttribute('name') || '').trim();
            const text = toPlainText(msgEl.querySelector('.mes_text')?.innerHTML || msgEl.querySelector('.mes_text')?.textContent || '');
            return { key: `dom-${idx}`, isUser, isSystem, name, text };
        }).filter(msg => !msg.isUser && !msg.isSystem && msg.text);
    }

    function getMessageEntries() {
        const byContext = getContextMessages();
        if (byContext.length) return byContext;
        const byDom = getDomMessages();
        if (byDom.length) return byDom;
        return [];
    }

    function getChatScopeSignature() {
        const ctx = window.SillyTavern?.getContext?.();
        const groupId = ctx?.groupId ?? ctx?.group_id ?? '';
        const characterId = ctx?.characterId ?? ctx?.character_id ?? '';
        const chatId = ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatFile ?? '';

        if (groupId !== '' && groupId !== null && groupId !== undefined) {
            return `group:${groupId}`;
        }
        if (characterId !== '' && characterId !== null && characterId !== undefined) {
            return `char:${characterId}`;
        }
        if (chatId) {
            return `chat:${chatId}`;
        }

        return 'scope:unknown';
    }

    function getMessageSignature(entry) {
        if (!entry) return '';
        return `${entry.key || ''}::${entry.name || ''}::${entry.text || ''}`;
    }

    function renderTranscript() {
        if (!transcriptBodyEl) return;

        const entries = getMessageEntries();
        transcriptBodyEl.innerHTML = '';

        if (!entries.length) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'dangan-vn-transcript-empty';
            emptyEl.textContent = 'No transcript entries yet.';
            transcriptBodyEl.appendChild(emptyEl);
            return;
        }

        for (const entry of entries) {
            const row = document.createElement('div');
            row.className = 'dangan-vn-transcript-entry';

            const speaker = document.createElement('div');
            speaker.className = 'dangan-vn-transcript-speaker';
            speaker.textContent = entry.name || 'UNKNOWN';

            const message = document.createElement('div');
            message.className = 'dangan-vn-transcript-message';
            message.textContent = stripV3CMarkersFromText(entry.text || '').replace(/\s+/g, ' ').trim() || '...';

            row.appendChild(speaker);
            row.appendChild(message);
            transcriptBodyEl.appendChild(row);
        }
    }

    function splitIntoChunks(text = '') {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return [];

        const chunks = [];
        let remaining = normalized;
        while (remaining.length > CHUNK_SIZE) {
            let splitAt = remaining.lastIndexOf('.', CHUNK_SIZE);
            if (splitAt < CHUNK_SIZE * 0.45) splitAt = remaining.lastIndexOf(' ', CHUNK_SIZE);
            if (splitAt < 1) splitAt = CHUNK_SIZE;
            chunks.push(remaining.slice(0, splitAt + 1).trim());
            remaining = remaining.slice(splitAt + 1).trim();
        }

        if (remaining) chunks.push(remaining);
        return chunks;
    }

    function pulseText() {
        if (!textEl) return;
        textEl.classList.remove('dangan-vn-text-pulse');
        requestAnimationFrame(() => {
            textEl.classList.add('dangan-vn-text-pulse');
        });
    }


    function renderCurrent() {
        const messages = getMessageEntries();
        if (!messages.length) {
            nameEl.textContent = 'SYSTEM';
            textEl.textContent = 'No character replies available yet. Send a message and wait for a character response.';
            updateNavigationState(messages);
            return;
        }

        messageIndex = Math.max(0, Math.min(messageIndex, messages.length - 1));

        const entry = messages[messageIndex];
        const clean = stripV3CMarkersFromText(entry.text).replace(/\s+/g, ' ').trim();
        const chunks = splitIntoChunks(clean);

        if (!chunks.length) {
            nameEl.textContent = entry.name || 'UNKNOWN';
            textEl.textContent = '...';
            updateNavigationState(messages);
            return;
        }

        chunkIndex = Math.max(0, Math.min(chunkIndex, chunks.length - 1));
        nameEl.textContent = entry.name || 'UNKNOWN';
        textEl.textContent = chunks[chunkIndex];
        updateNavigationState(messages);
        pulseText();
    }

    function advance() {
        const messages = getMessageEntries();
        if (!messages.length) {
            renderCurrent();
            return;
        }

        if (messageIndex >= messages.length - 1) {
            const currentEntry = messages[messages.length - 1];
            const currentChunks = splitIntoChunks(stripV3CMarkersFromText(currentEntry?.text || ''));
            if (chunkIndex >= Math.max(0, currentChunks.length - 1)) {
                return;
            }
        }

        const entry = messages[Math.min(messageIndex, messages.length - 1)];
        const chunks = splitIntoChunks(stripV3CMarkersFromText(entry.text));

        if (chunkIndex + 1 < chunks.length) {
            chunkIndex += 1;
        } else {
            messageIndex = Math.min(messages.length - 1, messageIndex + 1);
            chunkIndex = 0;
        }

        renderCurrent();
    }

    function retreat() {
        const messages = getMessageEntries();
        if (!messages.length) {
            renderCurrent();
            return;
        }

        const entry = messages[Math.min(messageIndex, messages.length - 1)];
        const chunks = splitIntoChunks(stripV3CMarkersFromText(entry.text));

        if (chunkIndex > 0) {
            chunkIndex -= 1;
        } else if (messageIndex > 0) {
            messageIndex -= 1;
            const previousEntry = messages[messageIndex];
            const previousChunks = splitIntoChunks(stripV3CMarkersFromText(previousEntry.text));
            chunkIndex = Math.max(0, previousChunks.length - 1);
        } else if (chunks.length) {
            chunkIndex = 0;
        }

        renderCurrent();
    }

    function jumpToLatest() {
        const messages = getMessageEntries();
        messageIndex = Math.max(0, messages.length - 1);
        const latest = messages[messageIndex];
        const latestChunks = splitIntoChunks(stripV3CMarkersFromText(latest?.text || ''));
        chunkIndex = Math.max(0, latestChunks.length - 1);
        renderCurrent();
    }

    function jumpToLatestFromStart() {
        const messages = getMessageEntries();
        messageIndex = Math.max(0, messages.length - 1);
        chunkIndex = 0;
        renderCurrent();
    }

    lockBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (moveUnlocked) {
            setMoveUnlocked(false);
            if (Number.isFinite(framePosX) && Number.isFinite(framePosY)) {
                savePosition();
            }
            return;
        }

        setMoveUnlocked(true);
    });

    transcriptToggleEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTranscriptOpen(!transcriptOpen);
    });

    transcriptCloseEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTranscriptOpen(false);
    });

    prevBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        retreat();
    });

    nextBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        advance();
    });

    regenerateBtnEl?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        triggerRegenerate();
        updateNavigationState();
    });

    frameEl?.addEventListener('dblclick', (event) => {
        if (!moveUnlocked) return;
        event.preventDefault();
        event.stopPropagation();
        resetFramePosition();
    });

    frameEl?.addEventListener('pointerdown', (event) => {
        if (!moveUnlocked || event.button !== 0 || !frameEl) return;
        const target = event.target;
        if (target instanceof Element && target.closest('.dangan-vn-lock')) return;

        isDragging = true;
        movedDuringPointer = false;
        dragStartX = event.clientX;
        dragStartY = event.clientY;

        const rect = frameEl.getBoundingClientRect();
        frameStartX = Number.isFinite(framePosX) ? framePosX : rect.left;
        frameStartY = Number.isFinite(framePosY) ? framePosY : rect.top;

        frameEl.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    });

    frameEl?.addEventListener('pointermove', (event) => {
        if (!moveUnlocked || !isDragging || !frameEl) return;
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            movedDuringPointer = true;
        }
        setFramePosition(frameStartX + dx, frameStartY + dy);
        dockTypingSection();
        event.preventDefault();
    });

    frameEl?.addEventListener('pointerup', (event) => {
        if (!isDragging) return;
        isDragging = false;
        frameEl?.releasePointerCapture?.(event.pointerId);
        if (movedDuringPointer) {
            savePosition();
        }
    });

    frameEl?.addEventListener('pointercancel', () => {
        isDragging = false;
    });

    frameEl?.addEventListener('click', (event) => {
        if (isDragging || movedDuringPointer) {
            movedDuringPointer = false;
            return;
        }
        const target = event.target;
        if (target instanceof Element && target.closest('.dangan-vn-lock')) return;
        if (target instanceof Element && target.closest('.dangan-vn-transcript-toggle')) return;
        if (target instanceof Element && target.closest('.dangan-vn-nav-button')) return;
        advance();
    });

    window.addEventListener('keydown', (event) => {
        if (!vnEnabled || !host.classList.contains('active')) return;
        const target = event.target;
        const isEditable = target instanceof HTMLElement && (
            target.matches('input, textarea, select') ||
            target.isContentEditable ||
            !!target.closest('[contenteditable="true"]')
        );
        if (isEditable) return;

        if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
            advance();
        } else if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
            retreat();
        } else {
            return;
        }
        event.preventDefault();
    });

    let swipeStartX = null;

    frameEl?.addEventListener('touchstart', (event) => {
        if (!event.touches?.length) return;
        swipeStartX = event.touches[0].clientX;
    }, { passive: true });

    frameEl?.addEventListener('touchend', (event) => {
        if (swipeStartX === null || !event.changedTouches?.length) return;
        const deltaX = event.changedTouches[0].clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(deltaX) < 36) return;
        if (deltaX < 0) {
            advance();
        } else {
            retreat();
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        updateBottomOffset();
        if (Number.isFinite(framePosX) && Number.isFinite(framePosY)) {
            setFramePosition(framePosX, framePosY);
        }
        dockTypingSection();
    });

    const observer = new MutationObserver(() => {
        ensureHostAttached();
        updateBottomOffset();
        syncMonopadVisibility();
        dockTypingSection();
        if (transcriptOpen) {
            renderTranscript();
        }
        if (!host.classList.contains('active')) return;
        const messages = getMessageEntries();
        const currentChatScope = getChatScopeSignature();
        const chatScopeChanged = currentChatScope !== lastObservedChatScope;
        const previousCount = lastObservedMessageCount;
        const hadMessageCountChange = messages.length !== previousCount;
        const previousLastSignature = lastObservedLastSignature;
        const currentLastSignature = getMessageSignature(messages[messages.length - 1]);
        const hadLastSignatureChange = currentLastSignature !== previousLastSignature;
        lastObservedMessageCount = messages.length;
        lastObservedLastSignature = currentLastSignature;
        lastObservedChatScope = currentChatScope;
        if (!messages.length) {
            renderCurrent();
            return;
        }

        const maxIndex = messages.length - 1;
        const wasAtTailBeforeNewMessage = hadMessageCountChange && messageIndex >= Math.max(0, maxIndex - 1);

        if (chatScopeChanged) {
            jumpToLatest();
        } else if (hadMessageCountChange && previousCount === 0 && messages.length > 0) {
            jumpToLatest();
        } else if (!hadMessageCountChange && hadLastSignatureChange) {
            jumpToLatest();
        } else if (hadMessageCountChange && messages.length > previousCount && wasAtTailBeforeNewMessage) {
            renderCurrent();
        } else if (messageIndex >= maxIndex || (wasAtTailBeforeNewMessage && !hadMessageCountChange)) {
            jumpToLatest();
        } else {
            renderCurrent();
        }
    });

    const chatEl = document.getElementById('chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: true });

    const panelEl = document.getElementById('dangan_monopad_panel');
    if (panelEl) {
        const panelObserver = new MutationObserver(() => {
            const panelLooksOpen = panelEl.classList.contains('open') || panelEl.classList.contains('booting') || panelEl.classList.contains('shutting-down');
            monopadOpen = panelLooksOpen;
            syncMonopadVisibility();
        });
        panelObserver.observe(panelEl, { attributes: true, attributeFilter: ['class'] });
    }

    return {
        setEnabled(enabled) {
            const isEnabled = !!enabled;
            vnEnabled = isEnabled;
            ensureHostAttached();

            host.classList.toggle('active', isEnabled);
            host.setAttribute('aria-hidden', isEnabled ? 'false' : 'true');
            host.style.display = isEnabled ? 'flex' : 'none';
            host.style.pointerEvents = 'none';
            updateBottomOffset();
            syncMonopadVisibility();
            dockTypingSection();
            if (!isEnabled) {
                setTranscriptOpen(false);
                undockTypingSection();
            }

            const chatRoot = document.getElementById('chat');
            chatRoot?.classList.toggle('dangan-vn-hidden', isEnabled);

            if (isEnabled) {
                lastObservedMessageCount = getMessageEntries().length;
                const enabledMessages = getMessageEntries();
                lastObservedLastSignature = getMessageSignature(enabledMessages[enabledMessages.length - 1]);
                lastObservedChatScope = getChatScopeSignature();
                jumpToLatest();
            }

            trySetSillyTavernVisualNovelMode(isEnabled);
        },
        refresh() {
            ensureHostAttached();
            updateBottomOffset();
            syncMonopadVisibility();
            dockTypingSection();
            if (transcriptOpen) {
                renderTranscript();
            }
            if (!host.classList.contains('active')) return;
            const currentChatScope = getChatScopeSignature();
            const chatScopeChanged = currentChatScope !== lastObservedChatScope;
            lastObservedChatScope = currentChatScope;
            if (chatScopeChanged) {
                jumpToLatest();
                return;
            }
            renderCurrent();
        },
        setMonopadOpen(isOpen) {
            monopadOpen = !!isOpen;
            syncMonopadVisibility();
            dockTypingSection();
        },
    };
}


    return { createVnModeController };
}
