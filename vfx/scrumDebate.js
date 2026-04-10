const SD_ID = "dangan-sd-overlay";
const SD_STYLE = "dangan-sd-style";

export const SCRUM_DEBATE_DEFAULT_SCENARIO = {
    title: "SCRUM DEBATE",
    opposingTheory: "The culprit acted alone.",
    playerTheory: "The culprit had an accomplice.",
    rounds: [
        {
            statement: "Only one set of footprints left the scene, so [[nobody helped the blackened]].",
            correctKey: "footprints-fabricated",
            mashTarget: 12,
            rebuttals: [
                { key: "camera-angles", text: "The camera angle missed the service corridor and can’t prove a solo escape." },
                { key: "footprints-fabricated", text: "The prints were staged after the fact with a spare shoe from the costume room." },
                { key: "voice-heard", text: "A second voice was heard during the blackout near the back entrance." },
            ],
        },
        {
            statement: "The toolbox key never changed hands, meaning [[only one person accessed the trap mechanism]].",
            correctKey: "duplicate-key",
            mashTarget: 13,
            rebuttals: [
                { key: "duplicate-key", text: "A duplicate key was made from soap impressions found in the bath area." },
                { key: "blood-pattern", text: "The blood spatter angle suggests the victim was already kneeling." },
                { key: "speaker-timing", text: "The argument timing does not match the witness testimony." },
            ],
        },
        {
            statement: "No one besides the culprit could alter the alibi board, so [[the timeline cannot be forged]].",
            correctKey: "eraser-dust",
            mashTarget: 14,
            rebuttals: [
                { key: "eraser-dust", text: "Eraser dust was under two seats, proving at least two people edited the board." },
                { key: "door-latch", text: "The latch was jammed from the outside using wire." },
                { key: "bottle-fragments", text: "The bottle fragments were planted from another floor." },
            ],
        },
        {
            statement: "The message was sent from one account at one time, so [[there was no coordinated cover-up]].",
            correctKey: "scheduled-send",
            mashTarget: 15,
            rebuttals: [
                { key: "wristwatch", text: "The stopped wristwatch pins the death earlier than that message." },
                { key: "scheduled-send", text: "The message was pre-scheduled while the accomplice handled the live distraction." },
                { key: "missing-glove", text: "A missing glove proves someone cleaned fingerprints after the murder." },
            ],
        },
    ],
};

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildStyles() {
    return `
#${SD_ID} {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    background:
        radial-gradient(circle at 20% 20%, rgba(255, 80, 80, 0.14), transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(80, 170, 255, 0.16), transparent 55%),
        rgba(7, 8, 18, 0.96);
    color: #f2f5ff;
    font-family: "Orbitron", "Arial", sans-serif;
    opacity: 0;
    transition: opacity 220ms ease;
    pointer-events: none;
}
#${SD_ID}.sd-on {
    opacity: 1;
    pointer-events: auto;
}
.sd-shell {
    position: absolute;
    inset: min(6vh, 48px) min(5vw, 72px);
    border: 1px solid rgba(110, 200, 255, 0.35);
    background: rgba(3, 8, 18, 0.82);
    box-shadow: 0 0 30px rgba(45, 120, 255, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.sd-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.14);
    letter-spacing: 0.1em;
    background: rgba(6, 14, 30, 0.9);
}
.sd-title {
    font-size: clamp(18px, 2.8vh, 30px);
    font-weight: 800;
    color: #ffd54f;
    text-shadow: 0 0 10px rgba(255, 198, 90, 0.55);
}
.sd-round {
    font-size: clamp(11px, 1.5vh, 15px);
    opacity: 0.85;
}
.sd-health {
    display: flex;
    gap: 6px;
}
.sd-heart {
    color: #ff6a7a;
    text-shadow: 0 0 9px rgba(255, 70, 110, 0.9);
    transition: opacity 180ms ease;
}
.sd-heart.sd-lost {
    opacity: 0.2;
}
.sd-theories {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 10px 20px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: clamp(12px, 1.55vh, 16px);
}
.sd-theory {
    flex: 1;
    padding: 10px 12px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
}
.sd-theory-opposition {
    border-color: rgba(255, 75, 95, 0.42);
}
.sd-theory-player {
    border-color: rgba(66, 208, 255, 0.45);
}
.sd-main {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 16px;
    min-height: 0;
    flex: 1;
    padding: 16px 20px 14px;
}
.sd-statement-box,
.sd-rebuttal-box {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.18);
    min-height: 0;
}
.sd-label {
    padding: 10px 12px;
    font-size: clamp(10px, 1.25vh, 12px);
    letter-spacing: 0.12em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(210, 225, 255, 0.9);
}
.sd-statement {
    padding: 16px 16px 18px;
    font-size: clamp(15px, 1.85vh, 21px);
    line-height: 1.45;
    color: #f9fbff;
}
.sd-key-hidden {
    color: transparent;
    text-shadow: none;
    background: rgba(200, 220, 255, 0.28);
    border-radius: 2px;
    padding: 0 6px;
}
.sd-key-revealed {
    color: #fff17d;
    text-shadow: 0 0 8px rgba(255, 230, 90, 0.6);
}
.sd-rebuttals {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.sd-option {
    border: 1px solid rgba(110, 205, 255, 0.34);
    background: rgba(7, 18, 40, 0.62);
    color: #d9ecff;
    text-align: left;
    padding: 10px 12px;
    font-size: clamp(12px, 1.45vh, 15px);
    cursor: pointer;
}
.sd-option:hover {
    border-color: rgba(139, 224, 255, 0.85);
    background: rgba(10, 33, 70, 0.75);
}
.sd-option:disabled {
    opacity: 0.5;
    cursor: default;
}
.sd-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 20px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.sd-status {
    font-size: clamp(11px, 1.35vh, 14px);
    letter-spacing: 0.06em;
    min-height: 1.4em;
}
.sd-mash-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}
.sd-mash-button {
    border: 1px solid rgba(255, 190, 90, 0.7);
    background: rgba(85, 45, 0, 0.45);
    color: #ffd38a;
    padding: 9px 14px;
    letter-spacing: 0.08em;
    font-weight: 700;
    cursor: pointer;
}
.sd-mash-button:disabled {
    opacity: 0.4;
    cursor: default;
}
.sd-meter {
    width: 180px;
    height: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
}
.sd-meter-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #ffae54, #ffe06f);
}
.sd-shake {
    animation: sdShake 230ms linear 1;
}
@keyframes sdShake {
    0% { transform: translateX(0); }
    20% { transform: translateX(-7px); }
    40% { transform: translateX(7px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
    100% { transform: translateX(0); }
}
`;
}

function getRoundKeyPhrase(statement) {
    const match = String(statement || "").match(/\[\[(.+?)\]\]/);
    return match ? match[1] : "";
}

function renderStatement(statement, revealed) {
    const raw = String(statement || "");
    return raw.replace(/\[\[(.+?)\]\]/g, (_full, key) => {
        const cls = revealed ? "sd-key-revealed" : "sd-key-hidden";
        const text = revealed ? escapeHtml(key) : "KEY POINT";
        return `<span class="${cls}">${text}</span>`;
    });
}

export function createScrumDebateController({ extensionFolderPath = "", awardMonocoins = null, deductMonocoins = null } = {}) {
    function destroy() {
        document.getElementById(SD_ID)?.remove();
        document.getElementById(SD_STYLE)?.remove();
    }

    function playSfx(relative) {
        if (!extensionFolderPath) return;
        new Audio(`${extensionFolderPath}/${relative}`).play().catch(() => {});
    }

    async function run({ scenario = SCRUM_DEBATE_DEFAULT_SCENARIO } = {}) {
        destroy();
        const rounds = Array.isArray(scenario?.rounds) ? scenario.rounds : [];
        if (!rounds.length) return false;

        const styleEl = document.createElement("style");
        styleEl.id = SD_STYLE;
        styleEl.textContent = buildStyles();
        document.head.appendChild(styleEl);

        const overlay = document.createElement("div");
        overlay.id = SD_ID;
        overlay.innerHTML = `
            <div class="sd-shell">
                <div class="sd-header">
                    <div class="sd-title">${escapeHtml(scenario.title || "SCRUM DEBATE")}</div>
                    <div class="sd-round" id="sd-round">ROUND 1 / ${rounds.length}</div>
                    <div class="sd-health" id="sd-health"></div>
                </div>
                <div class="sd-theories">
                    <div class="sd-theory sd-theory-opposition"><strong>Opposing Team:</strong> ${escapeHtml(scenario.opposingTheory || "Theory A")}</div>
                    <div class="sd-theory sd-theory-player"><strong>Your Team:</strong> ${escapeHtml(scenario.playerTheory || "Theory B")}</div>
                </div>
                <div class="sd-main">
                    <div class="sd-statement-box">
                        <div class="sd-label">OPPOSING STATEMENT</div>
                        <div class="sd-statement" id="sd-statement"></div>
                    </div>
                    <div class="sd-rebuttal-box">
                        <div class="sd-label">SELECT REBUTTAL</div>
                        <div class="sd-rebuttals" id="sd-rebuttals"></div>
                    </div>
                </div>
                <div class="sd-footer">
                    <div class="sd-status" id="sd-status"></div>
                    <div class="sd-mash-wrap">
                        <button class="sd-mash-button" id="sd-mash-btn" disabled>MASH</button>
                        <div class="sd-meter"><div class="sd-meter-fill" id="sd-meter-fill"></div></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("sd-on")));

        return new Promise((resolve) => {
            let roundIndex = 0;
            let health = 3;
            let resolved = false;
            let mashCleanup = null;

            const shellEl = overlay.querySelector(".sd-shell");
            const roundEl = overlay.querySelector("#sd-round");
            const healthEl = overlay.querySelector("#sd-health");
            const statementEl = overlay.querySelector("#sd-statement");
            const rebuttalsEl = overlay.querySelector("#sd-rebuttals");
            const statusEl = overlay.querySelector("#sd-status");
            const mashBtn = overlay.querySelector("#sd-mash-btn");
            const meterFillEl = overlay.querySelector("#sd-meter-fill");

            function renderHealth() {
                healthEl.innerHTML = Array.from({ length: 3 }, (_, i) => (
                    `<span class="sd-heart ${i >= health ? "sd-lost" : ""}">❤</span>`
                )).join("");
            }

            function teardown(result) {
                if (resolved) return;
                resolved = true;
                if (typeof mashCleanup === "function") mashCleanup();
                overlay.classList.remove("sd-on");
                setTimeout(destroy, 250);
                resolve(result);
            }

            function failRound(reason) {
                playSfx("assets/monokuma/incorrect-answer.wav");
                deductMonocoins?.(5, reason);
                health = Math.max(0, health - 1);
                renderHealth();
                shellEl.classList.add("sd-shake");
                setTimeout(() => shellEl.classList.remove("sd-shake"), 240);
                if (health <= 0) {
                    statusEl.textContent = "Debate lost. Your side could not break through.";
                    setTimeout(() => teardown(false), 550);
                    return;
                }
                statusEl.textContent = "Wrong match. Regroup and rebut correctly.";
                setTimeout(renderRound, 300);
            }

            function startMashPhase(round) {
                const target = Math.max(8, Number(round?.mashTarget) || 12);
                const deadlineMs = 2600;
                let count = 0;
                const startTs = performance.now();
                mashBtn.disabled = false;
                statusEl.textContent = `Key point exposed. Mash to overpower! (${target})`;

                function syncMeter() {
                    const ratio = Math.max(0, Math.min(1, count / target));
                    meterFillEl.style.width = `${Math.round(ratio * 100)}%`;
                }

                function stop(success) {
                    mashBtn.disabled = true;
                    document.removeEventListener("keydown", onKey);
                    mashBtn.removeEventListener("click", onMash);
                    if (ticker) cancelAnimationFrame(ticker);
                    mashCleanup = null;
                    if (success) {
                        playSfx("assets/sfx/minigames/submission.wav");
                        roundIndex += 1;
                        if (roundIndex >= rounds.length) {
                            statusEl.textContent = "Debate won. Consensus reached.";
                            awardMonocoins?.(10, "scrum debate completed");
                            setTimeout(() => teardown(true), 650);
                            return;
                        }
                        statusEl.textContent = "Rebuttal accepted. Next clash incoming.";
                        setTimeout(renderRound, 280);
                        return;
                    }
                    failRound("scrum debate mash failed");
                }

                function onMash() {
                    if (resolved) return;
                    count += 1;
                    syncMeter();
                    if (count >= target) stop(true);
                }

                function onKey(e) {
                    if (e.key !== " " && e.key !== "Enter") return;
                    e.preventDefault();
                    onMash();
                }

                let ticker = null;
                function tick(ts) {
                    if (resolved) return;
                    const elapsed = ts - startTs;
                    if (elapsed >= deadlineMs) {
                        stop(count >= target);
                        return;
                    }
                    ticker = requestAnimationFrame(tick);
                }

                mashBtn.addEventListener("click", onMash);
                document.addEventListener("keydown", onKey);
                ticker = requestAnimationFrame(tick);
                mashCleanup = () => {
                    mashBtn.disabled = true;
                    document.removeEventListener("keydown", onKey);
                    mashBtn.removeEventListener("click", onMash);
                    if (ticker) cancelAnimationFrame(ticker);
                };
            }

            function renderRound() {
                if (resolved) return;
                if (typeof mashCleanup === "function") mashCleanup();
                mashBtn.disabled = true;
                meterFillEl.style.width = "0%";

                const round = rounds[roundIndex];
                roundEl.textContent = `ROUND ${roundIndex + 1} / ${rounds.length}`;
                statementEl.innerHTML = renderStatement(round.statement, false);
                statusEl.textContent = "Find the matching rebuttal to expose the key point.";

                const options = Array.isArray(round.rebuttals) ? round.rebuttals.slice() : [];
                rebuttalsEl.innerHTML = options.map((opt, idx) => (
                    `<button class="sd-option" data-idx="${idx}">${escapeHtml(opt.text || "")}</button>`
                )).join("");

                const buttons = [...rebuttalsEl.querySelectorAll(".sd-option")];
                buttons.forEach((btn) => {
                    btn.addEventListener("click", () => {
                        if (resolved) return;
                        const idx = Number(btn.dataset.idx);
                        const pick = options[idx];
                        const isCorrect = pick?.key && pick.key === round.correctKey;
                        if (!isCorrect) {
                            failRound("scrum debate wrong rebuttal");
                            return;
                        }
                        playSfx("assets/sfx/trial/weak-spot-hit.wav");
                        buttons.forEach(b => { b.disabled = true; });
                        statementEl.innerHTML = renderStatement(round.statement, true);
                        const keyPhrase = getRoundKeyPhrase(round.statement);
                        statusEl.textContent = keyPhrase
                            ? `Key point revealed: "${keyPhrase}". Finish the clash.`
                            : "Key point revealed. Finish the clash.";
                        startMashPhase(round);
                    });
                });
            }

            renderHealth();
            renderRound();
        });
    }

    return { run, destroy };
}
