const MONOKUMA_MARKER_REGEX = /V3C\s*[|｜]\s*(DAY(?:\s*[_\-]?\s*)ANNOUN|NIGHT(?:\s*[_\-]?\s*)ANNOUN|BDA)\b/gi;

const MARKER_TYPES = {
    DAY_ANNOUN: {
        chime: "dingdongbingbong.mp3",
        voice: "daytime_announ.mp3",
        label: "DAYTIME ANNOUNCEMENT",
        transcript: "Good morning, everyone! It is now 7 a.m. and nighttime is officialy over! Time to rise and shine! Get ready to greet another beee-yutiful day!",
    },
    NIGHT_ANNOUN: {
        chime: "dingdongbingbong.mp3",
        voice: "nighttime_announ.mp3",
        label: "NIGHTTIME ANNOUNCEMENT",
        transcript: "Mm, ahem, this is a school announcement. It is now 10 p.m. As such, it is officially nighttime. Soon the doors to the dining hall will be locked, and entry at that point is strictly prohibited. Okay then... sweet dreams, everyone! Good night, sleep tight, don't let the bed bugs bite...",
    },
    BDA: {
        chime: "bda_bell.mp3",
        voice: "bda_announ.mp3",
        label: "BODY DISCOVERY ANNOUNCEMENT",
        transcript: "A body has been discovered! Now then, after a certain amount of time has passed, the class trial will begin!",
    },
};

function normalizeMarkerType(rawType = "") {
    const token = String(rawType || "")
        .toUpperCase()
        .replace(/[\s\-]+/g, "_");

    if (token === "DAYANNOUN") return "DAY_ANNOUN";
    if (token === "NIGHTANNOUN") return "NIGHT_ANNOUN";
    return token;
}

export function parseMonokumaAnnouncementMarkers(rawText = "") {
    const text = String(rawText || "");
    MONOKUMA_MARKER_REGEX.lastIndex = 0;

    const markers = [];
    let match;
    while ((match = MONOKUMA_MARKER_REGEX.exec(text)) !== null) {
        const type = normalizeMarkerType(match[1]);
        if (!MARKER_TYPES[type]) continue;
        markers.push({
            type,
            marker: match[0],
            index: match.index,
        });
    }

    return markers;
}

export function createMonokumaAnnouncementController({ extensionFolderPath, shouldPlayAudio = () => true } = {}) {
    let uiMounted = false;
    let queue = Promise.resolve();

    const audio = {
        DAY_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
        NIGHT_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
        BDA_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/bda_bell.mp3`),
        DAY_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/daytime_announ.mp3`),
        NIGHT_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/nighttime_announ.mp3`),
        BDA_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/bda_announ.mp3`),
    };

    Object.values(audio).forEach(track => {
        track.preload = "auto";
    });

    function getRoot() {
        return document.getElementById("monokuma-announcement-root");
    }

    function mountUi() {
        if (uiMounted) return;
        uiMounted = true;

        const style = document.createElement("style");
        style.id = "monokuma-announcement-style";
        style.textContent = `
            #monokuma-announcement-root {
                position: fixed;
                right: 24px;
                bottom: 20px;
                z-index: 23000;
                pointer-events: none;
                width: min(320px, 42vw);
                font-family: "Orbitron", "Rajdhani", sans-serif;
            }

            .mono-announ-sting {
                opacity: 0;
                transform: translateX(30px) scale(0.94);
                border: 2px solid #fff;
                box-shadow: 0 0 22px rgba(255, 65, 65, 0.5);
                background: repeating-linear-gradient(
                    45deg,
                    #000 0,
                    #000 10px,
                    #9b0909 10px,
                    #9b0909 20px
                );
                color: #fff;
                padding: 12px 14px;
                letter-spacing: 1px;
            }

            .mono-announ-sting.active {
                opacity: 1;
                animation: monoStingIn 0.4s ease-out forwards, monoStingPulse 0.5s ease-in-out 0.45s 3;
            }

            .mono-announ-monitor {
                margin-top: 10px;
                background: #151515;
                border: 3px solid #888;
                border-radius: 8px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
                overflow: hidden;
                opacity: 0;
                transform: translateY(18px) scale(0.96);
            }

            .mono-announ-monitor.on {
                opacity: 1;
                transform: translateY(0) scale(1);
                transition: opacity 220ms ease, transform 220ms ease;
            }

            .mono-announ-screen {
                aspect-ratio: 4 / 3;
                background: #000;
                position: relative;
                overflow: hidden;
            }

            .mono-announ-tv-glow {
                position: absolute;
                inset: 0;
                background: radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 62%);
                opacity: 0;
            }

            .mono-announ-screen.turning-on .mono-announ-tv-glow {
                animation: monoTvGlow 0.32s ease-out;
            }

            .mono-announ-screen.turning-off .mono-announ-tv-glow {
                animation: monoTvOffGlow 0.2s ease-in;
            }

            .mono-announ-screen img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                opacity: 0;
                filter: contrast(1.2) saturate(1.1);
            }

            .mono-announ-screen.ready img {
                opacity: 1;
                transition: opacity 170ms linear;
            }

            .mono-announ-screen.turning-off img {
                opacity: 0;
                transform: scaleY(0.05);
                filter: brightness(3.2) contrast(1.4);
                transition: transform 180ms ease-in, opacity 120ms linear;
            }

            .mono-announ-dialogue {
                position: absolute;
                left: 8px;
                right: 8px;
                bottom: 8px;
                background: rgba(0, 0, 0, 0.62);
                border: 1px solid rgba(255, 255, 255, 0.36);
                border-radius: 6px;
                color: #f5f5f5;
                font-size: 10px;
                line-height: 1.35;
                padding: 7px 8px;
                letter-spacing: 0.03em;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
                opacity: 0;
                transform: translateY(4px);
                transition: opacity 120ms ease, transform 120ms ease;
                max-height: 42%;
                overflow: hidden;
            }

            .mono-announ-screen.speaking .mono-announ-dialogue {
                opacity: 1;
                transform: translateY(0);
            }

            .mono-announ-scanline {
                position: absolute;
                inset: 0;
                background: repeating-linear-gradient(180deg, rgba(255,255,255,0.1) 0 1px, rgba(0,0,0,0) 2px 4px);
                mix-blend-mode: screen;
                opacity: 0.3;
                pointer-events: none;
            }

            .mono-announ-label {
                background: #0a0a0a;
                color: #f6f6f6;
                font-size: 11px;
                padding: 8px 10px;
                text-align: center;
                letter-spacing: 1.4px;
                border-top: 1px solid #3d3d3d;
            }

            @keyframes monoStingIn {
                from { opacity: 0; transform: translateX(30px) scale(0.94); }
                to { opacity: 1; transform: translateX(0) scale(1); }
            }

            @keyframes monoStingPulse {
                0%, 100% { filter: brightness(1); }
                50% { filter: brightness(1.35); }
            }

            @keyframes monoTvGlow {
                from { opacity: 0.9; }
                to { opacity: 0; }
            }

            @keyframes monoTvOffGlow {
                from { opacity: 0; }
                35% { opacity: 1; }
                to { opacity: 0; }
            }
        `;

        const root = document.createElement("div");
        root.id = "monokuma-announcement-root";
        root.innerHTML = `
            <div class="mono-announ-sting">♪ DING DONG, BING BONG ♪</div>
            <div class="mono-announ-monitor" role="status" aria-live="polite">
                <div class="mono-announ-screen">
                    <div class="mono-announ-tv-glow"></div>
                    <img src="${extensionFolderPath}/assets/monokuma/mono_announ.png" alt="Monokuma announcement monitor" />
                    <div class="mono-announ-dialogue" aria-live="off"></div>
                    <div class="mono-announ-scanline"></div>
                </div>
                <div class="mono-announ-label">MONOKUMA COMMUNICATION SYSTEM</div>
            </div>
        `;

        document.head.appendChild(style);
        document.body.appendChild(root);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function playTrack(track) {
        if (!track || !shouldPlayAudio()) return Promise.resolve();

        track.currentTime = 0;
        track.volume = 0.65;

        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                track.removeEventListener("ended", finish);
                track.removeEventListener("error", finish);
                resolve();
            };

            track.addEventListener("ended", finish, { once: true });
            track.addEventListener("error", finish, { once: true });
            track.play().catch(finish);
            setTimeout(finish, Math.max(1500, (track.duration || 0) * 1000 + 500));
        });
    }

    function playTvTurnOnEffect() {
        if (!shouldPlayAudio()) return;
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;

        const ctx = new AudioContextCtor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        osc.onended = () => {
            ctx.close().catch(() => {});
        };
    }

    function playTvTurnOffEffect() {
        if (!shouldPlayAudio()) return;
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;

        const ctx = new AudioContextCtor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.14);

        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        osc.onended = () => {
            ctx.close().catch(() => {});
        };
    }


    function revealDialogue(dialogueEl, text, durationMs = 4500) {
        if (!dialogueEl) return Promise.resolve();

        const fullText = String(text || "").trim();
        if (!fullText) {
            dialogueEl.textContent = "";
            return Promise.resolve();
        }

        const totalDuration = Math.max(2200, Number(durationMs) || 4500);
        const chars = Array.from(fullText);
        const stepMs = Math.max(14, Math.floor(totalDuration / Math.max(1, chars.length)));

        return new Promise(resolve => {
            let index = 0;
            dialogueEl.textContent = "";

            const timer = setInterval(() => {
                index += 1;
                dialogueEl.textContent = chars.slice(0, index).join("");

                if (index >= chars.length) {
                    clearInterval(timer);
                    resolve();
                }
            }, stepMs);
        });
    }

    async function runAnnouncement(type) {
        const config = MARKER_TYPES[type];
        if (!config) return;

        mountUi();
        const root = getRoot();
        if (!root) return;

        const sting = root.querySelector(".mono-announ-sting");
        const monitor = root.querySelector(".mono-announ-monitor");
        const screen = root.querySelector(".mono-announ-screen");
        const label = root.querySelector(".mono-announ-label");
        const dialogue = root.querySelector(".mono-announ-dialogue");

        if (!sting || !monitor || !screen || !label || !dialogue) return;

        label.textContent = config.label;
        sting.classList.remove("active");
        monitor.classList.remove("on");
        screen.classList.remove("turning-on", "ready", "turning-off", "speaking");
        dialogue.textContent = "";

        void sting.offsetWidth;
        sting.classList.add("active");

        await playTrack(audio[`${type}_CHIME`]);
        await delay(140);

        monitor.classList.add("on");
        screen.classList.add("turning-on");
        playTvTurnOnEffect();

        await delay(180);
        screen.classList.add("ready");

        const voiceTrack = audio[`${type}_VOICE`];
        const voiceDurationMs = Number.isFinite(voiceTrack?.duration)
            ? Math.max(2200, Math.round(voiceTrack.duration * 1000))
            : Math.max(2200, Math.round((config.transcript?.length || 60) * 45));

        screen.classList.add("speaking");
        await Promise.all([
            playTrack(voiceTrack),
            revealDialogue(dialogue, config.transcript, voiceDurationMs),
        ]);

        await delay(220);
        screen.classList.remove("turning-on", "ready", "speaking");
        screen.classList.add("turning-off");
        playTvTurnOffEffect();

        await delay(230);
        sting.classList.remove("active");
        monitor.classList.remove("on");
        screen.classList.remove("turning-off");
    }

    return {
        trigger(type) {
            const safeType = normalizeMarkerType(type);
            if (!MARKER_TYPES[safeType]) return;
            queue = queue.then(() => runAnnouncement(safeType)).catch(() => {});
        },
    };
}
