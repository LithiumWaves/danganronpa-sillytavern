export function createClassTrialMenuController({ extensionName, extensionSettings, buildExtensionPathCandidates, getTrialSkillEntries, getTrialSkillBrowser, toggleTrialSkillEquip, buyTrialSkill, playSfx, getSfx, onOpen, onClose, getPreparationTracks, getChapterLabel, getDifficultyLabel, cycleDifficulty, onViewSummary, onViewTruthBullets }) {
    let activeAudio = null;
    let selectedSkillId = null;

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function stopTrack() {
        if (!activeAudio) return;
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
    }

    function playTrack() {
        const tracks = typeof getPreparationTracks === "function" ? getPreparationTracks() : [];
        if (!tracks.length) return;

        const path = tracks[Math.floor(Math.random() * tracks.length)];
        if (!path) return;

        if (activeAudio) {
            activeAudio.pause();
            activeAudio = null;
        }

        activeAudio = new Audio(path);
        activeAudio.loop = true;
        activeAudio.volume = 0.42;
        activeAudio.play().catch(() => {});
    }

    function ensureOverlay() {
        let overlay = document.getElementById("dangan-trial-intro-overlay");
        if (overlay) return overlay;

        overlay = document.createElement("section");
        overlay.id = "dangan-trial-intro-overlay";
        overlay.className = "dangan-trial-intro-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-trial-backdrop" aria-hidden="true">
                <div class="dangan-trial-grid"></div>
                <div class="dangan-trial-glow-orb"></div>
                <div class="dangan-trial-revolver">
                    <div class="dangan-trial-revolver-line dangan-trial-revolver-line--1"></div>
                    <div class="dangan-trial-revolver-line dangan-trial-revolver-line--4"></div>
                    <div class="dangan-trial-revolver-line dangan-trial-revolver-line--2"></div>
                    <div class="dangan-trial-revolver-line dangan-trial-revolver-line--3"></div>
                    <div class="dangan-trial-revolver-cyl"></div>
                </div>
            </div>
            <div class="dangan-trial-intro-shell" role="dialog" aria-modal="false" aria-labelledby="dangan-trial-intro-title">
                <div class="dangan-trial-prep-title" id="dangan-trial-intro-title">
                    <span class="dangan-trial-prep-word">Co<span class="alt">urt</span></span>
                    <span class="dangan-trial-prep-word">Pre<span class="alt">paration</span></span>
                </div>
                <div class="dangan-trial-rule"></div>
                <div class="dangan-trial-intro-chapter" id="dangan-trial-intro-chapter"></div>
                <div class="dangan-trial-prep-banner" aria-hidden="true"></div>
                <p class="dangan-trial-intro-desc">Proceed to the courtroom when you're ready.</p>
                <div class="dangan-trial-rule"></div>
                <nav class="dangan-trial-menu">
                    <button type="button" class="dangan-trial-menu-item" id="dangan-trial-intro-skills">
                        <span class="dangan-trial-menu-label">Skills</span>
                    </button>
                    <button type="button" class="dangan-trial-menu-item" id="dangan-trial-intro-summary">
                        <span class="dangan-trial-menu-label">View Summary</span>
                    </button>
                    <button type="button" class="dangan-trial-menu-item" id="dangan-trial-intro-truth">
                        <span class="dangan-trial-menu-label">View Truth Bullets</span>
                    </button>
                    <button type="button" class="dangan-trial-menu-item" id="dangan-trial-intro-difficulty">
                        <span class="dangan-trial-menu-label">Change Difficulty</span>
                        <span class="dangan-trial-menu-value" id="dangan-trial-intro-difficulty-value"></span>
                    </button>
                </nav>
                <div class="dangan-trial-rule"></div>
                <div class="dangan-trial-intro-actions">
                    <button type="button" class="dangan-trial-intro-start" id="dangan-trial-intro-start">Gather Participants</button>
                    <button type="button" class="dangan-trial-intro-cancel" id="dangan-trial-intro-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    function setVisible(visible) {
        const overlay = ensureOverlay();
        overlay.classList.toggle("active", visible);
        overlay.setAttribute("aria-hidden", visible ? "false" : "true");
        overlay.style.display = visible ? "flex" : "none";
        overlay.style.pointerEvents = visible ? "auto" : "none";

        if (visible) {
            playTrack();
            onOpen?.();
            return;
        }

        stopTrack();
        onClose?.();
    }

    // ── Skills modal ────────────────────────────────────────────────────────
    function getSkillBrowserData() {
        if (typeof getTrialSkillBrowser === "function") return getTrialSkillBrowser();
        // Fallback to the owned-only snapshot if the browser API is unavailable.
        const snap = typeof getTrialSkillEntries === "function" ? getTrialSkillEntries() : { skillPoints: 0, skills: [] };
        return {
            skillPoints: Number(snap?.skillPoints || 0),
            trustFragments: 0,
            slotUsed: 0,
            slotTotal: Number(snap?.skillPoints || 0),
            skills: (snap?.skills || []).map(s => ({ ...s, owned: true, canBuy: false, canEquip: !s.equipped })),
        };
    }

    function ensureSkillsOverlay() {
        let overlay = document.getElementById("dangan-trial-skills-overlay");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "dangan-trial-skills-overlay";
        overlay.className = "dangan-trial-skills-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-trial-skills-backdrop" aria-hidden="true">
                <div class="dangan-trial-skills-cylinder"></div>
            </div>
            <div class="dangan-trial-skills-shell" role="dialog" aria-modal="true" aria-labelledby="dts-list-title">
                <button type="button" class="dts-close" id="dts-close" aria-label="Close">&#10005;</button>
                <div class="dts-body">
                    <section class="dts-pane dts-pane-list">
                        <header class="dts-head dts-head-list">
                            <span class="dts-head-title" id="dts-list-title">Skill List</span>
                            <span class="dts-head-count">
                                <span class="dts-trust" title="Trust Fragments"><span class="dts-trust-icon">◈</span><span id="dts-trust">0</span></span>
                                <span class="dts-sp-count" title="Skill Points"><span class="dts-spark">✻</span><span id="dts-sp">000</span></span>
                            </span>
                        </header>
                        <div class="dts-list" id="dts-skill-list"></div>
                    </section>
                    <section class="dts-center">
                        <div class="dts-action" id="dts-action"></div>
                        <div class="dts-stat dts-stat-health">
                            <span class="dts-stat-up" id="dts-health-up">&#9650;UP!</span>
                            <span class="dts-stat-label">Health</span>
                            <span class="dts-stat-pips" id="dts-health-pips"></span>
                        </div>
                        <div class="dts-stat dts-stat-conc">
                            <span class="dts-stat-up" id="dts-conc-up">&#9650;UP!</span>
                            <span class="dts-stat-label">Concentration</span>
                            <span class="dts-stat-pips" id="dts-conc-pips"></span>
                        </div>
                    </section>
                    <section class="dts-pane dts-pane-set">
                        <header class="dts-head dts-head-set">
                            <span class="dts-head-title">Set Skill</span>
                            <span class="dts-head-count"><span class="dts-slot-label">SLOT</span> <span id="dts-slot">0/0</span></span>
                        </header>
                        <div class="dts-list" id="dts-set-list"></div>
                    </section>
                </div>
                <footer class="dts-notice">
                    <span class="dts-notice-tab">Notice</span>
                    <div class="dts-notice-inner">
                        <div class="dts-type-badge">
                            <span class="dts-type-name" id="dts-type-name">—</span>
                            <span class="dts-type-label">Type</span>
                        </div>
                        <div class="dts-notice-text" id="dts-notice-text"></div>
                    </div>
                </footer>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector("#dts-close")?.addEventListener("click", () => closeSkillsModal());
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeSkillsModal();
        });
        // Capture-phase Escape closes this modal without reaching the prep
        // overlay's handler (which would cancel the trial).
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (!overlay.classList.contains("active")) return;
            event.stopPropagation();
            closeSkillsModal();
        }, true);

        // Arrow keys move the selection up/down the Skill List.
        document.addEventListener("keydown", (event) => {
            if (!overlay.classList.contains("active")) return;
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            event.stopPropagation();

            const skills = getSkillBrowserData().skills || [];
            if (!skills.length) return;

            let idx = skills.findIndex(s => s.id === selectedSkillId);
            if (idx < 0) idx = 0;
            idx = event.key === "ArrowDown"
                ? Math.min(idx + 1, skills.length - 1)
                : Math.max(idx - 1, 0);

            const next = skills[idx];
            if (!next || next.id === selectedSkillId) return;

            selectedSkillId = next.id;
            playSfx?.(getSfx?.().hover || getSfx?.().click);
            renderSkillsModal();

            const row = overlay.querySelector(`#dts-skill-list .dts-row[data-skill-id="${(window.CSS && CSS.escape) ? CSS.escape(next.id) : next.id}"]`);
            row?.scrollIntoView({ block: "nearest" });
        }, true);

        return overlay;
    }

    function skillPips(n, full, empty) {
        const v = Math.max(0, Math.min(5, Number(n) || 0));
        return full.repeat(v) + empty.repeat(5 - v);
    }

    function rarityTypeLabel(rarity) {
        const map = { N: "NORMAL", R: "RARE", SR: "SUPER", KEY: "KEY" };
        return map[String(rarity || "N").toUpperCase()] || "SKILL";
    }

    function skillRowHtml(skill) {
        const id = escapeHtml(String(skill?.id || ""));
        const name = escapeHtml(String(skill?.name || "UNKNOWN SKILL"));
        const cost = Number(skill?.skillPointCost || 0);
        const selected = skill?.id === selectedSkillId;
        const check = skill?.equipped ? '<span class="dts-row-check">✓</span>' : '<span class="dts-row-check"></span>';
        const dim = !skill?.equipped && !skill?.canEquip;

        const costHtml = skill?.equipped
            ? `<span class="dts-cost boxed">${cost}</span>`
            : `<span class="dts-cost ${dim ? "dim" : ""}"><span class="dts-spark">✻</span>${cost}</span>`;

        const classes = ["dts-row"];
        if (selected) classes.push("selected");
        if (!skill?.owned) classes.push("locked");
        if (skill?.equipped) classes.push("equipped");

        return `
            <div class="${classes.join(" ")}" data-skill-id="${id}" role="button" tabindex="0">
                ${check}
                <span class="dts-row-name">${name}</span>
                <span class="dts-row-cost">${costHtml}</span>
            </div>
        `;
    }

    function renderSkillsCenter(overlay, selected) {
        const actionWrap = overlay.querySelector("#dts-action");
        const healthPips = overlay.querySelector("#dts-health-pips");
        const concPips = overlay.querySelector("#dts-conc-pips");
        const healthUp = overlay.querySelector("#dts-health-up");
        const concUp = overlay.querySelector("#dts-conc-up");

        if (!selected) {
            if (actionWrap) actionWrap.innerHTML = "";
            if (healthPips) healthPips.textContent = skillPips(0, "♥", "♡");
            if (concPips) concPips.textContent = skillPips(0, "★", "☆");
            if (healthUp) healthUp.style.visibility = "hidden";
            if (concUp) concUp.style.visibility = "hidden";
            return;
        }

        let variant;
        let label;
        let action;
        let disabled = false;
        if (selected.equipped) {
            variant = "remove"; label = "REMOVE!"; action = "unequip";
        } else if (selected.owned) {
            variant = "set"; label = "SET!"; action = "equip"; disabled = !selected.canEquip;
        } else {
            variant = "buy"; label = `BUY ◈${Number(selected.cost || 0)}`; action = "buy"; disabled = !selected.canBuy;
        }

        if (actionWrap) {
            actionWrap.innerHTML = `
                <button type="button" id="dts-action-btn" class="dts-action-btn dts-action-${variant}" data-action="${action}" ${disabled ? "disabled" : ""}>
                    <span class="dts-action-label">${label}</span>
                </button>
            `;
        }

        const health = Number(selected.health || 0);
        const concentration = Number(selected.concentration || 0);
        if (healthPips) healthPips.textContent = skillPips(health, "♥", "♡");
        if (concPips) concPips.textContent = skillPips(concentration, "★", "☆");
        if (healthUp) healthUp.style.visibility = health > 0 ? "visible" : "hidden";
        if (concUp) concUp.style.visibility = concentration > 0 ? "visible" : "hidden";
    }

    function renderSkillsNotice(overlay, selected) {
        const typeName = overlay.querySelector("#dts-type-name");
        const noticeText = overlay.querySelector("#dts-notice-text");
        if (typeName) typeName.textContent = selected ? rarityTypeLabel(selected.rarity) : "—";
        if (noticeText) noticeText.textContent = selected ? String(selected.effect || "No effect description.") : "Select a skill to view its details.";
    }

    function performSkillAction(selected) {
        if (!selected) return;
        let message = "";
        if (!selected.owned) {
            const result = typeof buyTrialSkill === "function" ? buyTrialSkill(selected.id) : { changed: false };
            message = result?.changed ? "Skill purchased." : "Not enough Trust Fragments.";
            if (result?.changed) playSfx?.(getSfx?.().click);
        } else if (selected.equipped) {
            const result = typeof toggleTrialSkillEquip === "function" ? toggleTrialSkillEquip(selected.id) : { changed: false };
            message = result?.changed ? "Skill removed." : "Unable to remove skill.";
            if (result?.changed) playSfx?.(getSfx?.().click);
        } else {
            const result = typeof toggleTrialSkillEquip === "function" ? toggleTrialSkillEquip(selected.id) : { changed: false };
            message = result?.changed ? "Skill set." : "Not enough SP to set this skill.";
            if (result?.changed) playSfx?.(getSfx?.().click);
        }
        renderSkillsModal(message);
    }

    function renderSkillsModal(statusMessage = "") {
        const overlay = ensureSkillsOverlay();
        const listEl = overlay.querySelector("#dts-skill-list");
        const setEl = overlay.querySelector("#dts-set-list");
        const spEl = overlay.querySelector("#dts-sp");
        const trustEl = overlay.querySelector("#dts-trust");
        const slotEl = overlay.querySelector("#dts-slot");
        if (!listEl || !setEl) return;

        const data = getSkillBrowserData();
        const skills = Array.isArray(data.skills) ? data.skills : [];

        let selected = skills.find(s => s.id === selectedSkillId);
        if (!selected) {
            selected = skills.find(s => s.equipped) || skills[0] || null;
            selectedSkillId = selected?.id || null;
        }

        if (spEl) spEl.textContent = String(Number(data.skillPoints || 0));
        if (trustEl) trustEl.textContent = String(Number(data.trustFragments || 0));
        if (slotEl) slotEl.textContent = `${Number(data.slotUsed || 0)}/${Number(data.slotTotal || 0)}`;

        listEl.innerHTML = skills.length
            ? skills.map(skillRowHtml).join("")
            : '<div class="dts-empty">NO SKILLS AVAILABLE YET</div>';

        const equipped = skills.filter(s => s.equipped);
        setEl.innerHTML = equipped.length
            ? equipped.map(skillRowHtml).join("")
            : '<div class="dts-empty">NO SKILLS SET</div>';

        renderSkillsCenter(overlay, selected);
        renderSkillsNotice(overlay, selected);

        overlay.querySelectorAll(".dts-row").forEach((row) => {
            const select = () => {
                if (selectedSkillId === row.dataset.skillId) return;
                selectedSkillId = row.dataset.skillId;
                playSfx?.(getSfx?.().hover || getSfx?.().click);
                renderSkillsModal(statusMessage);
            };
            row.addEventListener("click", select);
            row.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
            });
        });

        overlay.querySelector("#dts-action-btn")?.addEventListener("click", () => performSkillAction(selected));
    }

    function openSkillsModal() {
        const overlay = ensureSkillsOverlay();
        renderSkillsModal();
        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");
        playSfx?.(getSfx?.().click);
    }

    function closeSkillsModal() {
        const overlay = document.getElementById("dangan-trial-skills-overlay");
        if (!overlay) return;
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
    }

    function open() {
        return new Promise((resolve) => {
            const overlay = ensureOverlay();
            const skillsBtn = overlay.querySelector("#dangan-trial-intro-skills");
            const summaryBtn = overlay.querySelector("#dangan-trial-intro-summary");
            const truthBtn = overlay.querySelector("#dangan-trial-intro-truth");
            const difficultyBtn = overlay.querySelector("#dangan-trial-intro-difficulty");
            const difficultyValue = overlay.querySelector("#dangan-trial-intro-difficulty-value");
            const chapterEl = overlay.querySelector("#dangan-trial-intro-chapter");
            const cancelBtn = overlay.querySelector("#dangan-trial-intro-cancel");
            const startBtn = overlay.querySelector("#dangan-trial-intro-start");

            if (chapterEl) {
                const chapterLabel = typeof getChapterLabel === "function" ? getChapterLabel() : "";
                chapterEl.textContent = escapeHtml(String(chapterLabel || ""));
                chapterEl.hidden = !chapterLabel;
            }
            if (difficultyValue) {
                const label = typeof getDifficultyLabel === "function" ? getDifficultyLabel() : "";
                difficultyValue.textContent = String(label || "");
            }

            let settled = false;
            const finish = (accepted) => {
                if (settled) return;
                settled = true;
                overlay.removeEventListener("click", onOverlayClick);
                skillsBtn?.removeEventListener("click", onSkills);
                summaryBtn?.removeEventListener("click", onSummary);
                truthBtn?.removeEventListener("click", onTruth);
                difficultyBtn?.removeEventListener("click", onDifficulty);
                cancelBtn?.removeEventListener("click", onCancel);
                startBtn?.removeEventListener("click", onStart);
                closeSkillsModal();
                document.removeEventListener("keydown", onKeydown);
                setVisible(false);
                resolve(Boolean(accepted));
            };

            const onSkills = () => {
                openSkillsModal();
            };
            const onSummary = () => {
                playSfx?.(getSfx?.().click);
                onViewSummary?.();
            };
            const onTruth = () => {
                playSfx?.(getSfx?.().click);
                onViewTruthBullets?.();
            };
            const onDifficulty = () => {
                const nextLabel = typeof cycleDifficulty === "function" ? cycleDifficulty() : "";
                if (difficultyValue && nextLabel) difficultyValue.textContent = String(nextLabel);
                playSfx?.(getSfx?.().click);
            };
            const onCancel = () => finish(false);
            const onStart = () => finish(true);
            const onOverlayClick = (event) => {
                if (event.target === overlay || event.target.classList.contains("dangan-trial-backdrop")) {
                    finish(false);
                }
            };
            const onKeydown = (event) => {
                if (event.key === "Escape") finish(false);
            };

            setVisible(true);
            overlay.addEventListener("click", onOverlayClick);
            document.addEventListener("keydown", onKeydown);
            skillsBtn?.addEventListener("click", onSkills);
            summaryBtn?.addEventListener("click", onSummary);
            truthBtn?.addEventListener("click", onTruth);
            difficultyBtn?.addEventListener("click", onDifficulty);
            cancelBtn?.addEventListener("click", onCancel);
            startBtn?.addEventListener("click", onStart);
        });
    }

    function close() {
        closeSkillsModal();
        setVisible(false);
    }

    return {
        open,
        close,
    };
}
