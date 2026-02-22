export function createClassTrialMenuController({ extensionName, extensionSettings, buildExtensionPathCandidates }) {
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
                <div class="dangan-trial-intro-actions">
                    <button type="button" class="dangan-trial-intro-cancel" id="dangan-trial-intro-cancel">Not Yet</button>
                    <button type="button" class="dangan-trial-intro-start" id="dangan-trial-intro-start">Begin Class Trial</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector("#dangan-trial-intro-cancel");
        const startBtn = overlay.querySelector("#dangan-trial-intro-start");

        cancelBtn?.addEventListener("click", () => close());
        startBtn?.addEventListener("click", () => close());
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay || event.target.classList.contains("dangan-trial-backdrop")) {
                close();
            }
        });

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
            return;
        }

        stopTrack();
    }

    function open() {
        setVisible(true);
    }

    function close() {
        setVisible(false);
    }

    return {
        open,
        close,
    };
}
