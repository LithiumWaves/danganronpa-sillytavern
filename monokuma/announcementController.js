const MONOKUMA_MARKER_REGEX = /V3C\s*[|｜]\s*(DAY(?:\s*[_\-]?\s*)ANNOUN|NIGHT(?:\s*[_\-]?\s*)ANNOUN|BDA|BODY(?:\s*[_\-]?\s*)DISCOVERY)\b/gi;

const MARKER_TYPES = {
    DAY_ANNOUN: {
        chime: "dingdongbingbong.mp3",
        voice: "daytime_announ.mp3",
        label: "DAYTIME ANNOUNCEMENT",
        transcript: "Good morning, everyone! It is now 7 a.m. and nighttime is officialy over! Time to rise and shine! Get ready to greet another beee-yutiful day!",
        transcriptByLang: {
            EN: "Good morning, everyone! It is now 7 a.m. and nighttime is officially over! Time to rise and shine! Get ready to greet another beee-autiful day you reprobates!",
            JP: "Good morning, everyone! It is now 7 a.m. and nighttime is officialy over! Time to rise and shine! Get ready to greet another beee-yutiful day!",
        },
    },
    NIGHT_ANNOUN: {
        chime: "dingdongbingbong.mp3",
        voice: "nighttime_announ.mp3",
        label: "NIGHTTIME ANNOUNCEMENT",
        transcript: "Mm, ahem, this is a school announcement. It is now 10 p.m. As such, it is officially nighttime. Soon the doors to the dining hall will be locked, and entry at that point is strictly prohibited. Okay then... sweet dreams, everyone! Good night, sleep tight, don't let the bed bugs bite...",
        transcriptByLang: {
            EN: "Mm, ahem, this is a school announcement. It is now 10 p.m. As such, it is officially nighttime. Soon the doors to the dining hall will be locked, and entry at that point is strictly prohibited. Okay then... sweet dreams, everyone! Good night, sleep tight, don't let the bed bugs bite... much..!",
            JP: "Mm, ahem, this is a school announcement. It is now 10 p.m. As such, it is officially nighttime. Soon the doors to the dining hall will be locked, and entry at that point is strictly prohibited. Okay then... sweet dreams, everyone! Good night, sleep tight, don't let the bed bugs bite...",
        },
    },
    BDA: {
        chime: "bda_bell.mp3",
        voice: "bda_announ.mp3",
        label: "BODY DISCOVERY ANNOUNCEMENT",
        transcript: "A body has been discovered! Now then, after a certain amount of time has passed, the class trial will begin!",
        transcriptByLang: {
            EN: "A body has been discovered! After a certain amount of time, a class trial will be held! Ahahahahahaha..!! The killing game just keeps going and going!",
            JP: "A body has been discovered! Now then, after a certain amount of time has passed, the class trial will begin!",
        },
    },
    BODY_DISCOVERY: {
        voice: "despairnoise.mp3",
        label: "BODY DISCOVERY",
        transcript: "A body has been discovered...",
    },
};

function normalizeMarkerType(rawType = "") {
    const token = String(rawType || "")
        .toUpperCase()
        .replace(/[\s\-]+/g, "_");

    if (token === "DAYANNOUN") return "DAY_ANNOUN";
    if (token === "NIGHTANNOUN") return "NIGHT_ANNOUN";
    if (token === "BODYDISCOVERY") return "BODY_DISCOVERY";
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

export function createMonokumaAnnouncementController({ extensionFolderPath, shouldPlayAudio = () => true, getVolume = () => 0.65, getLanguage = () => "EN" } = {}) {
    let uiMounted = false;
    let queue = Promise.resolve();

    const audioByLang = {
        EN: {
            DAY_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            NIGHT_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            BDA_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/bda_bell.mp3`),
            DAY_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/daytime_announ.mp3`),
            NIGHT_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/nighttime_announ.mp3`),
            BDA_VOICE: [
                new Audio(`${extensionFolderPath}/assets/monokuma/vic_Monok_01_022.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/vic_Monok_80_023.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/vic_Monok_01_024.wav`),
            ],
            BODY_DISCOVERY_VOICE: new Audio(`${extensionFolderPath}/assets/sfx/etc/despairnoise.mp3`),
        },
        JP: {
            DAY_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            NIGHT_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            BDA_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/bda_bell.mp3`),
            DAY_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/daytime_announ.mp3`),
            NIGHT_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/nighttime_announ.mp3`),
            BDA_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/bda_announ.mp3`),
            BODY_DISCOVERY_VOICE: new Audio(`${extensionFolderPath}/assets/sfx/etc/despairnoise.mp3`),
        },
    };

    Object.values(audioByLang).forEach(set =>
        Object.values(set).forEach(entry => {
            const tracks = Array.isArray(entry) ? entry : [entry];
            tracks.forEach(track => { track.preload = "auto"; });
        })
    );

    function getAudio() {
        const lang = String(getLanguage() || "EN").toUpperCase();
        return audioByLang[lang] ?? audioByLang.EN;
    }

    function getRoot() {
        return document.getElementById("monokuma-announcement-root");
    }

    function getBodyDiscoveryOverlay() {
        return document.getElementById("dangan-body-discovery-overlay");
    }

    function mountBodyDiscoveryOverlay() {
        let overlay = getBodyDiscoveryOverlay();
        if (overlay) return overlay;

        const style = document.createElement("style");
        style.id = "dangan-body-discovery-style";
        style.textContent = `
            #dangan-body-discovery-overlay {
                position: fixed;
                inset: 0;
                z-index: 24000;
                pointer-events: none;
                opacity: 0;
                background: radial-gradient(circle at center, rgba(38, 38, 38, 0.95) 0%, rgba(0, 0, 0, 0.98) 72%);
                transition: opacity 120ms linear;
            }

            #dangan-body-discovery-overlay.active {
                opacity: 1;
            }

            .dangan-body-discovery-static {
                position: absolute;
                inset: -35%;
                background-image:
                    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.38) 0 1px, transparent 1px),
                    radial-gradient(circle at 74% 61%, rgba(255,255,255,0.24) 0 1px, transparent 1px),
                    radial-gradient(circle at 49% 77%, rgba(255,255,255,0.34) 0 1px, transparent 1px);
                background-size: 5px 5px, 6px 6px, 4px 4px;
                opacity: 0.78;
                mix-blend-mode: screen;
                animation: danganBodyStatic 90ms steps(3, end) infinite;
            }

            .dangan-body-discovery-shake {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: danganBodyShake 120ms steps(2, end) infinite;
            }

            .dangan-body-discovery-card {
                padding: 16px 20px;
                border: 2px solid rgba(255,255,255,0.75);
                background: rgba(0,0,0,0.58);
                color: #fff;
                letter-spacing: 0.2em;
                font-family: "Orbitron", "Rajdhani", sans-serif;
                font-size: clamp(18px, 2.2vw, 34px);
                text-transform: uppercase;
                text-shadow: 0 2px 18px rgba(255,255,255,0.35);
            }

            @keyframes danganBodyStatic {
                0% { transform: translate3d(-2%, 1%, 0) rotate(0deg); }
                25% { transform: translate3d(1%, -2%, 0) rotate(0.3deg); }
                50% { transform: translate3d(2%, 2%, 0) rotate(-0.25deg); }
                75% { transform: translate3d(-1%, -1%, 0) rotate(0.25deg); }
                100% { transform: translate3d(1%, 0%, 0) rotate(-0.2deg); }
            }

            @keyframes danganBodyShake {
                0% { transform: translate(0, 0); }
                25% { transform: translate(-8px, 4px); }
                50% { transform: translate(8px, -5px); }
                75% { transform: translate(-7px, -3px); }
                100% { transform: translate(6px, 4px); }
            }

            @media (max-width: 900px) and (orientation: portrait) {
                .dangan-body-discovery-static {
                    inset: -18%;
                }

                .dangan-body-discovery-shake {
                    padding: max(8px, env(safe-area-inset-top)) 12px max(8px, env(safe-area-inset-bottom));
                    box-sizing: border-box;
                    animation: danganBodyShakeMobile 120ms steps(2, end) infinite;
                }

                .dangan-body-discovery-card {
                    width: min(100%, 420px);
                    padding: 12px 14px;
                    letter-spacing: 0.12em;
                    font-size: clamp(16px, 5.5vw, 24px);
                    text-align: center;
                }
            }

            @keyframes danganBodyShakeMobile {
                0% { transform: translate(0, 0); }
                25% { transform: translate(-4px, 2px); }
                50% { transform: translate(4px, -3px); }
                75% { transform: translate(-3px, -2px); }
                100% { transform: translate(3px, 2px); }
            }
        `;

        overlay = document.createElement("div");
        overlay.id = "dangan-body-discovery-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-body-discovery-static"></div>
            <div class="dangan-body-discovery-shake">
                <div class="dangan-body-discovery-card" role="status" aria-live="polite">BODY DISCOVERED</div>
            </div>
        `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);
        return overlay;
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

            @media (max-width: 900px) and (orientation: portrait) {
                #monokuma-announcement-root {
                    right: 50%;
                    top: max(12px, env(safe-area-inset-top));
                    bottom: auto;
                    transform: translateX(50%);
                    width: min(280px, calc(100vw - 18px));
                }

                .mono-announ-sting {
                    padding: 9px 11px;
                    font-size: 11px;
                    letter-spacing: 0.8px;
                }

                .mono-announ-monitor {
                    margin-top: 8px;
                    border-width: 2px;
                    border-radius: 7px;
                }

                .mono-announ-dialogue {
                    left: 6px;
                    right: 6px;
                    bottom: 6px;
                    font-size: 9px;
                    line-height: 1.3;
                    padding: 6px;
                    max-height: 34%;
                }

                .mono-announ-label {
                    font-size: 10px;
                    padding: 7px 8px;
                    letter-spacing: 1px;
                }
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

    function playTrack(track, { fallbackMs = null } = {}) {
        if (!track || !shouldPlayAudio()) return Promise.resolve();

        track.currentTime = 0;
        track.volume = Math.min(1, Math.max(0, getVolume()));

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
            const computedFallback = Number.isFinite(fallbackMs) && fallbackMs > 0
                ? fallbackMs
                : Math.max(1500, (track.duration || 0) * 1000 + 500);
            setTimeout(finish, computedFallback);
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

    async function runBodyDiscoverySequence() {
        const overlay = mountBodyDiscoveryOverlay();
        if (!overlay) return;

        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");

        const voiceTrack = getAudio().BODY_DISCOVERY_VOICE;
        const fallbackMs = Number.isFinite(voiceTrack?.duration)
            ? Math.max(2500, Math.round(voiceTrack.duration * 1000) + 600)
            : 30000;

        await playTrack(voiceTrack, { fallbackMs });

        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
    }

    async function runAnnouncement(type) {
        const config = MARKER_TYPES[type];
        if (!config) return;

        const lang = String(getLanguage() || "JP").toUpperCase();
        const resolvedTranscript = config.transcriptByLang?.[lang] ?? config.transcript;

        mountUi();
        const root = getRoot();
        if (!root) return;

        const sting = root.querySelector(".mono-announ-sting");
        const monitor = root.querySelector(".mono-announ-monitor");
        const screen = root.querySelector(".mono-announ-screen");
        const label = root.querySelector(".mono-announ-label");
        const dialogue = root.querySelector(".mono-announ-dialogue");

        if (!sting || !monitor || !screen || !label || !dialogue) return;

        if (type === "BODY_DISCOVERY") {
            await runBodyDiscoverySequence();
            return;
        }

        label.textContent = config.label;
        sting.classList.remove("active");
        monitor.classList.remove("on");
        screen.classList.remove("turning-on", "ready", "turning-off", "speaking");
        dialogue.textContent = "";

        void sting.offsetWidth;
        sting.classList.add("active");

        await playTrack(getAudio()[`${type}_CHIME`]);
        await delay(140);

        monitor.classList.add("on");
        screen.classList.add("turning-on");
        playTvTurnOnEffect();

        await delay(180);
        screen.classList.add("ready");

        const voiceEntry = getAudio()[`${type}_VOICE`];
        const voiceTracks = Array.isArray(voiceEntry) ? voiceEntry : [voiceEntry];
        const totalVoiceDurationMs = voiceTracks.reduce((sum, t) => {
            return sum + (Number.isFinite(t?.duration) ? Math.round(t.duration * 1000) : 0);
        }, 0);
        const voiceDurationMs = totalVoiceDurationMs > 0
            ? Math.max(2200, totalVoiceDurationMs)
            : Math.max(2200, Math.round((resolvedTranscript?.length || 60) * 45));

        async function playVoiceTracks() {
            for (const track of voiceTracks) {
                await playTrack(track);
            }
        }

        const dialogueDurationMs = lang === "EN" ? Math.round(voiceDurationMs * 0.75) : voiceDurationMs;

        screen.classList.add("speaking");
        await Promise.all([
            playVoiceTracks(),
            revealDialogue(dialogue, resolvedTranscript, dialogueDurationMs),
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
