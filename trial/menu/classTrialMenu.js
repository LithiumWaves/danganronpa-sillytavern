export function createClassTrialMenuController({ extensionName, extensionSettings, buildExtensionPathCandidates, getTrialSkillEntries, toggleTrialSkillEquip, playSfx, getSfx, onOpen, onClose }) {
    const candidateTracks = buildExtensionPathCandidates()
        .map(basePath => `${basePath}/assets/classtrial/trialunderground.mp3`);

    let activeAudio = null;
    let activeTrackIndex = -1;

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function moveToNextTrack() {
        if (!activeAudio) return;
        if (activeTrackIndex >= candidateTracks.length - 1) return;
        activeTrackIndex += 1;
        activeAudio.src = candidateTracks[activeTrackIndex];
        activeAudio.load();
    }

    function stopTrack() {
        if (!activeAudio) return;
        activeAudio.pause();
        activeAudio.currentTime = 0;
    }

    function playTrack() {
        if (!extensionSettings?.[extensionName]?.monopadSounds) return;
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
                if (previousIndex === activeTrackIndex) return;
                activeAudio.play().catch(() => {});
            });
        }

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
                <div class="dangan-trial-cylinder"></div>
                <div class="dangan-trial-cylinder dangan-trial-cylinder-alt"></div>
                <div class="dangan-trial-glow-orb"></div>
            </div>
            <div class="dangan-trial-intro-shell" role="dialog" aria-modal="false" aria-labelledby="dangan-trial-intro-title">
                <header class="dangan-trial-intro-header">
                    <div class="dangan-trial-prep-label">COURT PREPARATION</div>
                    <h2 id="dangan-trial-intro-title">Class Trial</h2>
                    <p>Proceed to the underground courtroom when you're ready.</p>
                </header>
                <div id="dangan-trial-skill-manager" class="dangan-trial-skill-manager" hidden>
                    <div class="dangan-trial-skill-manager-head">
                        <span>Skill Loadout</span>
                        <span id="dangan-trial-skill-points">SP: 0</span>
                    </div>
                    <div id="dangan-trial-skill-list" class="dangan-trial-skill-list"></div>
                    <div id="dangan-trial-skill-status" class="dangan-trial-skill-status" aria-live="polite"></div>
                </div>
                <div class="dangan-trial-intro-actions">
                    <button type="button" class="dangan-trial-intro-skills" id="dangan-trial-intro-skills" aria-expanded="false">Manage Skill Loadout</button>
                    <button type="button" class="dangan-trial-intro-cancel" id="dangan-trial-intro-cancel">Cancel</button>
                    <button type="button" class="dangan-trial-intro-start" id="dangan-trial-intro-start">Begin Class Trial</button>
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

    function renderTrialSkillManager(overlay, statusMessage = "") {
        const manager = overlay.querySelector("#dangan-trial-skill-manager");
        const pointsEl = overlay.querySelector("#dangan-trial-skill-points");
        const listEl = overlay.querySelector("#dangan-trial-skill-list");
        const statusEl = overlay.querySelector("#dangan-trial-skill-status");
        if (!manager || !pointsEl || !listEl || !statusEl) return;

        const snapshot = typeof getTrialSkillEntries === "function"
            ? getTrialSkillEntries()
            : { skillPoints: 0, skills: [] };

        const availablePoints = Number(snapshot?.skillPoints || 0);
        pointsEl.textContent = `SP: ${availablePoints}`;
        statusEl.textContent = String(statusMessage || "");

        if (!Array.isArray(snapshot?.skills) || !snapshot.skills.length) {
            listEl.innerHTML = '<div class="dangan-trial-skill-empty">No owned skills available.</div>';
            return;
        }

        listEl.innerHTML = snapshot.skills.map(skill => {
            const equipped = Boolean(skill?.equipped);
            const cost = Number(skill?.skillPointCost || 0);
            const canAfford = equipped || availablePoints >= cost;
            const label = equipped ? "UNEQUIP" : "EQUIP";
            const effect = escapeHtml(String(skill?.effect || "No effect description."));
            return `
                <div class="dangan-trial-skill-row" data-skill-id="${escapeHtml(String(skill?.id || ""))}">
                    <div class="dangan-trial-skill-main">
                        <div class="dangan-trial-skill-name">${escapeHtml(String(skill?.name || "UNKNOWN SKILL").toUpperCase())}</div>
                        <div class="dangan-trial-skill-meta">${escapeHtml(String(skill?.rarity || "N"))}&nbsp;·&nbsp;COST ${cost} SP</div>
                        <div class="dangan-trial-skill-effect">${effect}</div>
                    </div>
                    <button type="button" class="dangan-trial-skill-toggle ${equipped ? "equipped" : ""}" data-action="toggle" ${canAfford ? "" : "disabled"}>${label}</button>
                </div>
            `;
        }).join("");

        listEl.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
            btn.addEventListener("click", (event) => {
                const skillId = event.currentTarget.closest(".dangan-trial-skill-row")?.dataset?.skillId;
                if (!skillId || typeof toggleTrialSkillEquip !== "function") return;
                const result = toggleTrialSkillEquip(skillId);
                if (result?.changed) {
                    playSfx?.(getSfx?.().click);
                }

                const nextMessage = result?.changed
                    ? (result?.equipped ? "Skill equipped." : "Skill unequipped.")
                    : "Unable to update skill loadout. Check SP and ownership.";

                renderTrialSkillManager(overlay, nextMessage);
            });
        });
    }

    function open() {
        return new Promise((resolve) => {
            const overlay = ensureOverlay();
            const manager = overlay.querySelector("#dangan-trial-skill-manager");
            const skillsBtn = overlay.querySelector("#dangan-trial-intro-skills");
            const cancelBtn = overlay.querySelector("#dangan-trial-intro-cancel");
            const startBtn = overlay.querySelector("#dangan-trial-intro-start");

            let settled = false;
            const finish = (accepted) => {
                if (settled) return;
                settled = true;
                overlay.removeEventListener("click", onOverlayClick);
                skillsBtn?.removeEventListener("click", onSkills);
                cancelBtn?.removeEventListener("click", onCancel);
                startBtn?.removeEventListener("click", onStart);
                if (manager) manager.hidden = true;
                skillsBtn?.setAttribute("aria-expanded", "false");
                document.removeEventListener("keydown", onKeydown);
                setVisible(false);
                resolve(Boolean(accepted));
            };

            const onSkills = () => {
                if (!manager) return;
                manager.hidden = !manager.hidden;
                skillsBtn?.setAttribute("aria-expanded", manager.hidden ? "false" : "true");
                if (!manager.hidden) {
                    renderTrialSkillManager(overlay);
                }
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
            skillsBtn?.setAttribute("aria-expanded", "false");
            const statusEl = overlay.querySelector("#dangan-trial-skill-status");
            if (statusEl) statusEl.textContent = "";
            skillsBtn?.addEventListener("click", onSkills);
            cancelBtn?.addEventListener("click", onCancel);
            startBtn?.addEventListener("click", onStart);
        });
    }

    function close() {
        const overlay = document.getElementById("dangan-trial-intro-overlay");
        if (overlay) {
            const manager = overlay.querySelector("#dangan-trial-skill-manager");
            if (manager) manager.hidden = true;
        }
        setVisible(false);
    }

    return {
        open,
        close,
    };
}
