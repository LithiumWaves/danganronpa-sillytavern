const MONOKUMA_MARKER_REGEX = /V3C\s*[|｜]\s*(DAY(?:\s*[_\-]?\s*)ANNOUN|NIGHT(?:\s*[_\-]?\s*)ANNOUN|BDA|BODY(?:\s*[_\-]?\s*)DISCOVERY)\b/gi;

const MARKER_TYPES = {
    DAY_ANNOUN: {
        chime: "dingdongbingbong.mp3",
        voice: "daytime_announ.mp3",
        label: "DAYTIME ANNOUNCEMENT",
        transcript: "Good morning, everyone! It is now 7 a.m. and nighttime is officialy over! Time to rise and shine! Get ready to greet another beee-yutiful day!",
        transcriptByLang: {
            EN: "Ahem! This is an announcement from the Ultimate Academy! Rise and shine, kiddos! It's another gorgeous day for a killing game! So get out there, embrace your homicidal urges, and have a fabulous day!",
            JP: "Good morning, everyone! It is now 7 a.m. and nighttime is officialy over! Time to rise and shine! Get ready to greet another beee-yutiful day!",
        },
    },
    NIGHT_ANNOUN: {
        chime: "dingdongbingbong.mp3",
        voice: "nighttime_announ.mp3",
        label: "NIGHTTIME ANNOUNCEMENT",
        transcript: "Mm, ahem, this is a school announcement. It is now 10 p.m. As such, it is officially nighttime. Soon the doors to the dining hall will be locked, and entry at that point is strictly prohibited. Okay then... sweet dreams, everyone! Good night, sleep tight, don't let the bed bugs bite...",
        transcriptByLang: {
            EN: "Ahem! This is an announcement from the Ultimate Academy! The time is now 10:00 p.m. Nighttime has officially begun. Killers, this is your chance to strike! Victims, you have my condolences! Will you sleep like a baby tonight? Or sleep with the fishes? Either way, sweet dreams!",
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
    ERROR: {
        chime: "dingdongbingbong.mp3",
        voice: "error.mp3",
        gif: "error.gif",
        label: "SYSTEM ERROR",
        transcript: "ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR",
    },
    NO_INPUT: {
        chime: "dingdongbingbong.mp3",
        voice: "static.mp3",
        gif: "static.gif",
        label: "NO INPUT",
        transcript: "No Input Detected - Please contact your systems administrator.",
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

export function createMonokumaAnnouncementController({ extensionFolderPath, shouldPlayAudio = () => true, getVolume = () => 0.65, getLanguage = () => "EN", onBefore = null, getCustomOverrides = null } = {}) {
    let uiMounted = false;
    let queue = Promise.resolve();

    const audioByLang = {
        EN: {
            DAY_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            NIGHT_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            BDA_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/bda_bell.mp3`),
            DAY_ANNOUN_VOICE: [
                new Audio(`${extensionFolderPath}/assets/monokuma/morn1.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/morn2.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/morn3.wav`),
            ],
            NIGHT_ANNOUN_VOICE: [
                new Audio(`${extensionFolderPath}/assets/monokuma/night1.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/night2.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/night3.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/night4.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/night5.wav`),
            ],
            BDA_VOICE: [
                new Audio(`${extensionFolderPath}/assets/monokuma/vic_Monok_01_022.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/vic_Monok_80_023.wav`),
                new Audio(`${extensionFolderPath}/assets/monokuma/vic_Monok_01_024.wav`),
            ],
            BODY_DISCOVERY_VOICE: new Audio(`${extensionFolderPath}/assets/sfx/etc/despairnoise.mp3`),
            ERROR_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            ERROR_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/error.mp3`),
            NO_INPUT_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            NO_INPUT_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/static.mp3`),
        },
        JP: {
            DAY_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            NIGHT_ANNOUN_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            BDA_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/bda_bell.mp3`),
            DAY_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/daytime_announ.mp3`),
            NIGHT_ANNOUN_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/nighttime_announ.mp3`),
            BDA_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/bda_announ.mp3`),
            BODY_DISCOVERY_VOICE: new Audio(`${extensionFolderPath}/assets/sfx/etc/despairnoise.mp3`),
            ERROR_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            ERROR_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/error.mp3`),
            NO_INPUT_CHIME: new Audio(`${extensionFolderPath}/assets/monokuma/dingdongbingbong.mp3`),
            NO_INPUT_VOICE: new Audio(`${extensionFolderPath}/assets/monokuma/static.mp3`),
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
                z-index: 2147483648;
                pointer-events: none;
                opacity: 0;
                /* Horizontal oval vignette — solid black edges, fully transparent centre */
                background: radial-gradient(ellipse 65% 50% at 50% 50%,
                    transparent 0%,
                    transparent 35%,
                    rgba(0,0,0,0.60) 60%,
                    rgba(0,0,0,0.88) 78%,
                    #000 100%
                );
                transition: opacity 180ms linear;
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
                opacity: 0.55;
                mix-blend-mode: screen;
                animation: danganBodyStatic 90ms steps(3, end) infinite;
            }

            .dangan-body-discovery-vignette {
                position: absolute;
                inset: 0;
                background: radial-gradient(ellipse 65% 50% at 50% 50%,
                    transparent 0%,
                    transparent 35%,
                    rgba(0,0,0,0.60) 60%,
                    rgba(0,0,0,0.88) 78%,
                    #000 100%
                );
                pointer-events: none;
            }

            @keyframes danganBodyStatic {
                0%   { transform: translate3d(-2%, 1%, 0)  rotate(0deg); }
                25%  { transform: translate3d(1%, -2%, 0)  rotate(0.3deg); }
                50%  { transform: translate3d(2%, 2%, 0)   rotate(-0.25deg); }
                75%  { transform: translate3d(-1%, -1%, 0) rotate(0.25deg); }
                100% { transform: translate3d(1%, 0%, 0)   rotate(-0.2deg); }
            }

            @keyframes danganBgJitter {
                0%   { translate: 0px    0px; }
                20%  { translate: -2px   1px; }
                40%  { translate:  1.5px -1.5px; }
                60%  { translate: -1px  -1px; }
                80%  { translate:  2px   1.5px; }
                100% { translate:  0px   0px; }
            }
        `;

        overlay = document.createElement("div");
        overlay.id = "dangan-body-discovery-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="dangan-body-discovery-static"></div>
            <div class="dangan-body-discovery-vignette"></div>
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
                z-index: 2147483648;
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
                color: #fff;
                padding: 12px 14px;
                letter-spacing: 1px;
                position: relative;
                overflow: hidden;
            }

            .mono-announ-sting::before {
                content: '';
                position: absolute;
                inset: 0;
                right: -30px;
                background: repeating-linear-gradient(
                    45deg,
                    #000 0,
                    #000 10px,
                    #9b0909 10px,
                    #9b0909 20px
                );
                animation: monoStingScroll 1.4s linear infinite;
            }

            .mono-announ-sting-text {
                position: relative;
                z-index: 1;
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

            @keyframes monoStingScroll {
                from { transform: translateX(0); }
                to   { transform: translateX(-28.28px); }
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
            <div class="mono-announ-sting"><span class="mono-announ-sting-text">♪ DING DONG, BING BONG ♪</span></div>
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

    async function runCinematicBodyDiscovery(cinematic) {
        const overlay = mountBodyDiscoveryOverlay();
        if (!overlay) return;

        // ── Hide ST UI for the duration of the cinematic ─────────────────────
        const BDA_UI_SELECTORS = [
            '#top-bar', '#top-settings-holder',
            '#left-nav-panel', '#right-nav-panel',
            '#sheld', '#chat', '#send_form', '#rightSendForm',
            '#expression-wrapper',
            '#dangan-vn-overlay', '#dangan-group-chat-stage',
            '#dangan-trial-pre-debate-notif', '#dangan_monopad_button', '#dangan-level-bar',
        ];
        const bdaHiddenEls = new Map();

        function bdaFadeOutUI() {
            for (const sel of BDA_UI_SELECTORS) {
                const el = document.querySelector(sel);
                if (!el) continue;
                bdaHiddenEls.set(sel, el.style.display || '');
                // Use setProperty with !important so CSS-class rules can't override us.
                // No transition — the BDA overlay has no solid background, so any fade
                // delay leaves UI visible through the semi-transparent noise layer.
                el.style.setProperty('transition', 'none', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
            }
            const vnWrapper = document.querySelector('#visual-novel-wrapper');
            if (vnWrapper) vnWrapper.style.visibility = 'hidden';
        }

        function bdaFadeInUI() {
            for (const sel of BDA_UI_SELECTORS) {
                const el = document.querySelector(sel);
                if (!el) continue;
                el.style.display = bdaHiddenEls.get(sel) ?? '';
                el.style.removeProperty('pointer-events');
                // Start at 0 then kick off the transition on the next two frames so the
                // browser registers a from-state before animating to the natural opacity.
                el.style.setProperty('opacity', '0', 'important');
                el.style.removeProperty('transition');
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    el.style.setProperty('transition', 'opacity 0.4s ease', 'important');
                    el.style.removeProperty('opacity');
                    // Clean up our transition override once it's done
                    el.addEventListener('transitionend', () => el.style.removeProperty('transition'), { once: true });
                }));
            }
            bdaHiddenEls.clear();
            const vnWrapper = document.querySelector('#visual-novel-wrapper');
            if (vnWrapper) vnWrapper.style.visibility = '';
        }

        bdaFadeOutUI();

        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");

        const voiceTrack = getAudio().BODY_DISCOVERY_VOICE;
        const trackDurationMs = Number.isFinite(voiceTrack?.duration) && voiceTrack.duration > 0
            ? Math.round(voiceTrack.duration * 1000)
            : 10000;

        const bg1 = document.getElementById("bg1");
        const savedTransition = bg1 ? bg1.style.transition : "";
        const savedTransform  = bg1 ? bg1.style.transform  : "";
        const savedAnimation  = bg1 ? bg1.style.animation  : "";
        const savedFilter     = bg1 ? bg1.style.filter     : "";
        const staticEl = overlay.querySelector(".dangan-body-discovery-static");
        const timers = [];

        // Black mask — covers bg1 during BG switches to hide ST's transition frames
        let bgMaskEl = document.getElementById("bda-bg-switch-mask");
        if (!bgMaskEl) {
            bgMaskEl = document.createElement("div");
            bgMaskEl.id = "bda-bg-switch-mask";
            bgMaskEl.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;z-index:2147483630;background:#000";
            document.body.appendChild(bgMaskEl);
        }

        // Colorize overlay — sits between bg1 and the vignette overlay
        let colorizeEl = document.getElementById("bda-playback-colorize");
        if (!colorizeEl) {
            colorizeEl = document.createElement("div");
            colorizeEl.id = "bda-playback-colorize";
            colorizeEl.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;z-index:2147483640;transition:opacity 200ms";
            document.body.appendChild(colorizeEl);
        }

        function applySegEffects(seg) {
            if (!bg1) return;
            const filters = [];
            const hue = seg?.hueShift ?? 0;
            if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
            if (seg?.imgFilter === "grayscale") filters.push("grayscale(1)");
            else if (seg?.imgFilter === "sepia") filters.push("sepia(1)");
            bg1.style.filter = filters.join(" ");
            const color = seg?.colorize || "";
            const opacity = seg?.colorizeOpacity ?? 0.4;
            if (color) {
                colorizeEl.style.background = color;
                colorizeEl.style.opacity = String(opacity);
            } else {
                colorizeEl.style.opacity = "0";
            }
        }

        const sortedSegs = [...(cinematic.bgSegments || [])].sort((a, b) => a.startFrac - b.startFrac);
        const sortedPins = [...(cinematic.pins || [])].sort((a, b) => a.timeFrac - b.timeFrac);

        // ── BG switching via setTimeout (fade handled per-frame in RAF) ─────────
        for (const seg of sortedSegs) {
            const startMs = Math.round(seg.startFrac * trackDurationMs);

            if (seg.bgFile) {
                timers.push(setTimeout(() => {
                    const lower = seg.bgFile.toLowerCase();
                    const els = Array.from(document.querySelectorAll(".bg_example"));
                    const match = els.find(el => el.getAttribute("bgfile")?.toLowerCase().includes(lower));
                    if (match instanceof HTMLElement) {
                        // Instantly show black mask so ST's cross-fade frames are hidden
                        bgMaskEl.style.transition = "none";
                        bgMaskEl.style.opacity = "1";
                        match.click();
                        applySegEffects(seg);
                        // After two paint frames (bg swap is rendered under the mask),
                        // fade the mask out — the RAF then handles bg1 opacity from here
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            bgMaskEl.style.transition = "opacity 150ms linear";
                            bgMaskEl.style.opacity = "0";
                        }));
                    }
                }, startMs));
            }
        }

        // ── Helpers: identical logic to the editor's applyPinAnimation ────────

        function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

        function pinAtElapsed(ms) {
            for (const pin of sortedPins) {
                const start = (pin.timeFrac ?? 0) * trackDurationMs;
                const end   = start + Math.max(100, pin.focusDurationMs ?? 800);
                if (ms >= start && ms <= end) return pin;
            }
            return null;
        }

        function segAtElapsed(ms) {
            return sortedSegs.filter(s => s.startFrac * trackDurationMs <= ms).at(-1) ?? null;
        }

        function applyTransform(pin, t) {
            if (!bg1) return;
            const pinB = pin.connectTo ? sortedPins.find(p => p.id === pin.connectTo) ?? null : null;

            if (pinB) {
                // Connected: interpolate position A → B, zoom A.baseZoom → A.zoom
                let ix, iy;
                if ((pin.pathType ?? "direct") === "smooth") {
                    const mx = (pin.xFrac + pinB.xFrac) / 2;
                    const my = (pin.yFrac + pinB.yFrac) / 2;
                    const dx = pinB.xFrac - pin.xFrac, dy = pinB.yFrac - pin.yFrac;
                    const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
                    const cpx = mx + (-dy / len) * len * 0.35;
                    const cpy = my + ( dx / len) * len * 0.35;
                    ix = (1-t)*(1-t)*pin.xFrac + 2*(1-t)*t*cpx + t*t*pinB.xFrac;
                    iy = (1-t)*(1-t)*pin.yFrac + 2*(1-t)*t*cpy + t*t*pinB.yFrac;
                } else {
                    ix = pin.xFrac + (pinB.xFrac - pin.xFrac) * t;
                    iy = pin.yFrac + (pinB.yFrac - pin.yFrac) * t;
                }
                const scale = (pin.baseZoom ?? 1.0) + ((pin.zoom ?? 1.3) - (pin.baseZoom ?? 1.0)) * t;
                bg1.style.transition = "none";
                bg1.style.transform  = `scale(${scale.toFixed(3)}) translate(${((0.5 - ix) * 100).toFixed(2)}%, ${((0.5 - iy) * 100).toFixed(2)}%)`;
            } else {
                // Unconnected: hold at pin position, zoom only
                const scale = (pin.baseZoom ?? 1.0) + ((pin.zoom ?? 1.3) - (pin.baseZoom ?? 1.0)) * t;
                bg1.style.transition = "none";
                bg1.style.transform  = `scale(${scale.toFixed(3)}) translate(${((0.5 - pin.xFrac) * 100).toFixed(2)}%, ${((0.5 - pin.yFrac) * 100).toFixed(2)}%)`;
            }
        }

        // ── Single RAF loop drives camera + shake + static ────────────────────
        let rafId = null;
        let lastPinId  = undefined; // undefined = never applied
        let lastSegId  = undefined;

        function tick() {
            if (!voiceTrack || voiceTrack.paused || voiceTrack.ended) return;

            const elapsed = Number.isFinite(voiceTrack.duration) && voiceTrack.duration > 0
                ? voiceTrack.currentTime * 1000
                : 0;

            const activeSeg = segAtElapsed(elapsed);
            const activePin = pinAtElapsed(elapsed);

            // Update effects when active seg changes
            if (activeSeg?.id !== lastSegId) {
                applySegEffects(activeSeg);
            }

            if (activePin?.id !== lastPinId || activeSeg?.id !== lastSegId) {
                lastPinId = activePin?.id ?? null;
                lastSegId = activeSeg?.id ?? null;
            }

            // Per-frame fade opacity (mirrors CG preview logic)
            if (bg1 && activeSeg) {
                const segStartMs = activeSeg.startFrac * trackDurationMs;
                const segEndMs   = activeSeg.endFrac   * trackDurationMs;
                const segElapsed = elapsed - segStartMs;
                const segRemain  = segEndMs - elapsed;
                const fadeInMs   = activeSeg.fadeIn  ?? 0;
                const fadeOutMs  = activeSeg.fadeOut ?? 0;
                let opacity = 1;
                if (fadeInMs  > 0 && segElapsed < fadeInMs)  opacity = Math.min(opacity, segElapsed / fadeInMs);
                if (fadeOutMs > 0 && segRemain  < fadeOutMs) opacity = Math.min(opacity, segRemain  / fadeOutMs);
                bg1.style.opacity = String(clamp01(opacity));
            } else if (bg1) {
                bg1.style.opacity = "";
            }

            // Camera transform
            if (activePin) {
                const startMs = (activePin.timeFrac ?? 0) * trackDurationMs;
                const durMs   = Math.max(1, activePin.focusDurationMs ?? 800);
                applyTransform(activePin, clamp01((elapsed - startMs) / durMs));
            } else if (bg1 && lastPinId !== undefined && lastPinId !== null) {
                // Just left a pin — reset smoothly
                lastPinId = null;
                bg1.style.transition = "transform 0.4s ease-out";
                bg1.style.transform  = "scale(1) translate(0%, 0%)";
            }

            // Shake
            if (bg1) {
                const shakeAmt = activePin?.shake ?? 0;
                if (shakeAmt > 0) {
                    const speed = Math.round(40 + (1 - shakeAmt) * 60);
                    bg1.style.animation = `danganBgJitter ${speed}ms steps(3, end) infinite`;
                } else {
                    bg1.style.animation = savedAnimation;
                }
            }

            // Static opacity
            if (staticEl) {
                staticEl.style.opacity = String(activePin?.staticOpacity ?? 0);
            }

            rafId = requestAnimationFrame(tick);
        }

        voiceTrack.addEventListener("play", () => { rafId = requestAnimationFrame(tick); }, { once: true });

        await playTrack(voiceTrack, { fallbackMs: trackDurationMs + 600 });

        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        timers.forEach(id => clearTimeout(id));

        bgMaskEl.style.transition = "none";
        bgMaskEl.style.opacity = "0";
        colorizeEl.style.opacity = "0";
        if (bg1) {
            bg1.style.opacity    = "";
            bg1.style.animation  = savedAnimation;
            bg1.style.filter     = savedFilter;
            bg1.style.transition = "transform 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
            bg1.style.transform  = "scale(1) translate(0%, 0%)";
            await delay(1200);
            bg1.style.transition = savedTransition;
            bg1.style.transform  = savedTransform;
        }

        if (staticEl) staticEl.style.opacity = "";
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");

        bdaFadeInUI();
    }

    async function runBodyDiscoverySequence({ cinematic = null } = {}) {
        if (cinematic) {
            await runCinematicBodyDiscovery(cinematic);
            return;
        }

        const overlay = mountBodyDiscoveryOverlay();
        if (!overlay) return;

        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");

        const voiceTrack = getAudio().BODY_DISCOVERY_VOICE;
        const trackDurationMs = Number.isFinite(voiceTrack?.duration) && voiceTrack.duration > 0
            ? Math.round(voiceTrack.duration * 1000)
            : 8000;
        const fallbackMs = Math.max(2500, trackDurationMs + 600);

        // ── Background zoom effect ──────────────────────────────
        const bg1 = document.getElementById('bg1');
        const savedTransition = bg1 ? bg1.style.transition : '';
        const savedTransform  = bg1 ? bg1.style.transform  : '';
        const savedAnimation  = bg1 ? bg1.style.animation  : '';
        const rand = (lo, hi) => lo + Math.random() * (hi - lo);
        const zoomTimers = [];

        if (bg1) {
            const ease       = '0.42, 0, 0.58, 1';
            const dur        = '0.5s';
            const panWindow  = Math.max(500, trackDurationMs - 2000);
            const count      = 6 + Math.floor(Math.random() * 7); // 6–12 base slots

            // Start jitter immediately (from first point)
            bg1.style.animation = 'danganBgJitter 75ms steps(3, end) infinite';

            // Stop jitter at panWindow ms (when last zoom point fires, before zoom-out)
            zoomTimers.push(setTimeout(() => {
                bg1.style.animation = savedAnimation;
            }, panWindow));

            // Build a small pool of cluster zoom levels (1.05–1.25) so points can share depths
            const zoomClusterCount = 3 + Math.floor(Math.random() * 3); // 3–5 clusters
            const zoomPool = Array.from({ length: zoomClusterCount }, () =>
                (1.05 + Math.random() * 0.95).toFixed(3) // 1.050–2.000
            );
            const pickZoom = () => zoomPool[Math.floor(Math.random() * zoomPool.length)];

            const schedulePan = (timeMs, zoom) => {
                const x = rand(-18, 18).toFixed(1);
                const y = rand(-14, 14).toFixed(1);
                zoomTimers.push(setTimeout(() => {
                    bg1.style.transition = `transform ${dur} cubic-bezier(${ease})`;
                    bg1.style.transform  = `scale(${zoom}) translate(${x}%, ${y}%)`;
                }, timeMs));
            };

            for (let i = 0; i < count; i++) {
                const baseMs = i === 0 ? 0 : Math.round((i / (count - 1)) * panWindow);

                // ~35% of slots (never the first) become a quick cluster — all share one zoom level
                if (i > 0 && Math.random() < 0.35) {
                    const clusterZoom = pickZoom();
                    const clusterSize = 2 + Math.floor(Math.random() * 2); // 2–3 rapid pans
                    for (let c = 0; c < clusterSize; c++) {
                        schedulePan(baseMs + c * (60 + Math.floor(Math.random() * 120)), clusterZoom);
                    }
                } else {
                    schedulePan(baseMs, pickZoom());
                }
            }
        }

        await playTrack(voiceTrack, { fallbackMs });

        // Zoom out to centre, then restore
        if (bg1) {
            bg1.style.animation  = savedAnimation;
            bg1.style.transition = 'transform 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            bg1.style.transform  = 'scale(1) translate(0%, 0%)';
            await delay(1200);
            bg1.style.transition = savedTransition;
            bg1.style.transform  = savedTransform;
        }

        zoomTimers.forEach(id => clearTimeout(id));

        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
    }

    async function runAnnouncement(type, options = {}) {
        const config = MARKER_TYPES[type];
        if (!config) return;

        if (typeof onBefore === "function") await onBefore();

        const lang = String(getLanguage() || "JP").toUpperCase();
        const resolvedTranscript = config.transcriptByLang?.[lang] ?? config.transcript;

        const overrides = typeof getCustomOverrides === 'function' ? (getCustomOverrides(type) ?? {}) : {};

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
            await runBodyDiscoverySequence({ cinematic: options.cinematic ?? null });
            return;
        }

        const screenImg = screen.querySelector("img");
        if (screenImg) {
            if (overrides.image) {
                screenImg.src = overrides.image;
            } else {
                screenImg.src = config.gif
                    ? `${extensionFolderPath}/assets/monokuma/${config.gif}`
                    : `${extensionFolderPath}/assets/monokuma/mono_announ.png`;
            }
        }

        const finalTranscript = overrides.text || resolvedTranscript;

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

        let voiceTracks;
        if (overrides.voice) {
            const customAudio = new Audio(overrides.voice);
            customAudio.preload = 'auto';
            voiceTracks = [customAudio];
        } else {
            const voiceEntry = getAudio()[`${type}_VOICE`];
            voiceTracks = Array.isArray(voiceEntry) ? voiceEntry : [voiceEntry];
        }
        const totalVoiceDurationMs = voiceTracks.reduce((sum, t) => {
            return sum + (Number.isFinite(t?.duration) ? Math.round(t.duration * 1000) : 0);
        }, 0);
        const voiceDurationMs = totalVoiceDurationMs > 0
            ? Math.max(2200, totalVoiceDurationMs)
            : Math.max(2200, Math.round((finalTranscript?.length || 60) * 45));

        async function playVoiceTracks() {
            for (const track of voiceTracks) {
                await playTrack(track);
            }
        }

        const dialogueDurationMs = lang === "EN" ? Math.round(voiceDurationMs * 0.75) : voiceDurationMs;

        screen.classList.add("speaking");
        await Promise.all([
            playVoiceTracks(),
            revealDialogue(dialogue, finalTranscript, dialogueDurationMs),
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
        trigger(type, options = {}) {
            const safeType = normalizeMarkerType(type);
            if (!MARKER_TYPES[safeType]) return;
            queue = queue.then(() => runAnnouncement(safeType, options)).catch(() => {});
        },
        triggerAsync(type, options = {}) {
            const safeType = normalizeMarkerType(type);
            if (!MARKER_TYPES[safeType]) return Promise.resolve();
            const p = queue.then(() => runAnnouncement(safeType, options)).catch(() => {});
            queue = p;
            return p;
        },
    };
}
