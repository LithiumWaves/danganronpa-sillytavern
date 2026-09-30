import { emotionFromSpriteStem, SPECIAL_SPRITES } from "../vfx/spriteNaming.js";
import { normalizeName } from "../social/characterUtils.js";

// Broad mood playlists — not 1:1 with sprite filenames. The extension maps
// each character's latest sprite into one of these buckets and majority-votes.
export const MOOD_SETTING_KEYS = {
    happy: "happyTracks",
    sad: "sadTracks",
    dramatic: "dramaticTracks",
    tense: "tenseTracks",
    angry: "angryTracks",
    romantic: "romanticTracks",
};

export const MOOD_SETTING_KEY_SET = new Set(Object.values(MOOD_SETTING_KEYS));

const EXPRESSION_TO_MOOD = {
    joy: "happy",
    excitement: "happy",
    sadness: "sad",
    grief: "sad",
    realization: "dramatic",
    surprise: "dramatic",
    fear: "tense",
    nervousness: "tense",
    anger: "angry",
    disgust: "angry",
    love: "romantic",
    embarrassment: "romantic",
    // Common SillyTavern filename aliases for the same moods.
    surprised: "dramatic",
    happy: "happy",
    sad: "sad",
    angry: "angry",
    scared: "tense",
};

const IGNORED_EXPRESSIONS = new Set([
    "neutral",
    "dead",
    "mugshot",
    "interjection",
    "death-portrait",
    ...SPECIAL_SPRITES,
]);

const SKIP_NAMES = new Set(["narrator", "monokuma", "assistant", "system"]);

const EVALUATE_DEBOUNCE_MS = 200;

export function formatMoodScanToast(result = {}, labels = {}) {
    const counts = result.counts && typeof result.counts === "object" ? result.counts : {};
    const voteParts = Object.entries(counts)
        .filter(([, n]) => Number(n) > 0)
        .sort((a, b) => (Number(b[1]) - Number(a[1])) || String(a[0]).localeCompare(String(b[0])))
        .map(([mood, n]) => `${String(mood).toUpperCase()} ×${n}`);
    const playing = result.winner
        ? String(result.winner).toUpperCase()
        : (labels[result.settingKey] || "PHASE");
    if (!voteParts.length) return `No mood · Playing ${playing}`;
    return `${voteParts.join(" · ")}\nPlaying ${playing}`;
}

function folderFromSrc(src) {
    if (!src) return "";
    try {
        const parts = new URL(src, location.href).pathname.split("/").filter(Boolean);
        if (parts.length >= 2) return decodeURIComponent(parts[parts.length - 2] || "");
    } catch { /* ignore bad src */ }
    return "";
}

function stemFromSrc(src) {
    if (!src) return "";
    try {
        const fname = decodeURIComponent(new URL(src, location.href).pathname.split("/").pop() || "");
        return fname.replace(/\.[^.]+$/, "");
    } catch { /* ignore bad src */ }
    return "";
}

function shouldSkipName(name) {
    const key = normalizeName(name || "");
    if (!key) return true;
    if (SKIP_NAMES.has(key)) return true;
    return false;
}

function moodFromExpression(label) {
    const emotion = emotionFromSpriteStem(label || "");
    if (!emotion || IGNORED_EXPRESSIONS.has(emotion)) return null;
    return EXPRESSION_TO_MOOD[emotion] || null;
}

function pickWinningMood(moods, currentSettingKey) {
    const counts = new Map();
    for (const mood of moods) {
        if (!mood) continue;
        counts.set(mood, (counts.get(mood) || 0) + 1);
    }
    if (!counts.size) return null;

    let best = 0;
    for (const n of counts.values()) if (n > best) best = n;
    const leaders = [...counts.entries()].filter(([, n]) => n === best).map(([m]) => m);
    if (leaders.length === 1) return leaders[0];

    const currentMood = Object.entries(MOOD_SETTING_KEYS).find(([, key]) => key === currentSettingKey)?.[0];
    if (currentMood && leaders.includes(currentMood)) return currentMood;
    return null;
}

/**
 * @param {object} deps
 * @param {() => boolean} deps.isEnabled
 * @param {() => boolean} deps.isAmbientContext
 * @param {() => string|null} deps.getCurrentBgmSettingKey
 * @param {(key: string) => string[]} deps.getTracks
 * @param {(key: string) => void} deps.playTrackFromSetting
 * @param {() => void} deps.playPhaseTrackCore
 * @param {() => { name: string, img?: HTMLImageElement }[] | null} deps.getGcpScene
 * @param {() => { name: string, expression?: string }[]} deps.getOverworldScene
 */
export function createDynamicSongsController(deps) {
    const lastExpressionByName = new Map();
    let evaluateTimer = null;
    // Manual song-list picks hold until SCAN (or the toggle is flipped).
    let manualHold = false;

    function resolveCharacterName(imgEl, src) {
        const alt = (imgEl?.getAttribute?.("alt") || "").trim();
        const folder = folderFromSrc(src);
        const slots = deps.getGcpScene?.() || [];
        if (folder && slots.length) {
            const folderLc = folder.toLowerCase();
            for (const slot of slots) {
                const slotFolder = folderFromSrc(slot.img?.src);
                if (slotFolder && slotFolder.toLowerCase() === folderLc) return slot.name;
            }
        }
        if (alt && !shouldSkipName(alt)) return alt;
        return folder || "";
    }

    function noteExpression(name, label) {
        if (shouldSkipName(name)) return;
        const emotion = emotionFromSpriteStem(label || "");
        if (!emotion) return;
        lastExpressionByName.set(normalizeName(name), emotion);
    }

    function noteFromImage(imgEl, src) {
        const stem = stemFromSrc(src) || (imgEl?.getAttribute?.("data-expression") || "");
        const name = resolveCharacterName(imgEl, src);
        if (!name || !stem) return;
        noteExpression(name, stem);
    }

    function expressionForCharacter(name, fallbackSrc, fallbackLabel) {
        const key = normalizeName(name || "");
        if (lastExpressionByName.has(key)) return lastExpressionByName.get(key);
        if (fallbackSrc) {
            const fromSrc = emotionFromSpriteStem(stemFromSrc(fallbackSrc));
            if (fromSrc) {
                lastExpressionByName.set(key, fromSrc);
                return fromSrc;
            }
        }
        if (fallbackLabel) {
            const fromLabel = emotionFromSpriteStem(fallbackLabel);
            if (fromLabel) {
                lastExpressionByName.set(key, fromLabel);
                return fromLabel;
            }
        }
        return "";
    }

    function collectSceneExpressions() {
        const gcp = deps.getGcpScene?.();
        if (gcp && Array.isArray(gcp)) {
            return gcp
                .filter((slot) => slot?.name && !shouldSkipName(slot.name))
                .map((slot) => expressionForCharacter(slot.name, slot.img?.src, ""));
        }
        const overworld = deps.getOverworldScene?.() || [];
        return overworld
            .filter((entry) => entry?.name && !shouldSkipName(entry.name))
            .map((entry) => expressionForCharacter(entry.name, "", entry.expression || ""));
    }

    function isPlayingMoodPlaylist() {
        return MOOD_SETTING_KEY_SET.has(deps.getCurrentBgmSettingKey?.());
    }

    function ingestSprite(name, src, fallbackLabel) {
        if (shouldSkipName(name)) return;
        if (src) {
            const stem = stemFromSrc(src);
            if (stem) {
                noteExpression(name, stem);
                return;
            }
        }
        if (fallbackLabel) noteExpression(name, fallbackLabel);
    }

    function scanLiveSprites() {
        const gcp = deps.getGcpScene?.();
        if (Array.isArray(gcp)) {
            for (const slot of gcp) {
                ingestSprite(slot?.name, slot?.img?.src || "", "");
            }
            return;
        }

        const seen = new Set();
        if (typeof document !== "undefined") {
            for (const sprite of document.querySelectorAll(".dangan-ow-sprite")) {
                const name = sprite.dataset?.name || "";
                const img = sprite.querySelector(".dangan-ow-sprite-img");
                ingestSprite(name, img?.src || "", "");
                if (name) seen.add(normalizeName(name));
            }
            for (const img of document.querySelectorAll("img.expression, .expression-holder img, #visual-novel-wrapper img")) {
                const alt = img.getAttribute?.("alt") || "";
                ingestSprite(alt, img.src || "", "");
            }
        }
        const overworld = deps.getOverworldScene?.() || [];
        for (const entry of overworld) {
            const key = normalizeName(entry?.name || "");
            if (!key || seen.has(key)) continue;
            ingestSprite(entry.name, "", entry.expression || "");
        }
    }

    function evaluateAndPlay({ restorePhaseOnMiss = false, forceReplay = false } = {}) {
        return runEvaluate({ restorePhaseOnMiss, forceReplay }).ok;
    }

    function runEvaluate({ restorePhaseOnMiss = false, forceReplay = false } = {}) {
        const empty = { ok: false, winner: null, counts: {}, settingKey: null, fallback: false };
        if (!deps.isEnabled?.()) return empty;
        if (!deps.isAmbientContext?.()) return empty;
        if (manualHold && !forceReplay) return empty;

        const expressions = collectSceneExpressions();
        const moods = expressions.map((label) => moodFromExpression(label)).filter(Boolean);
        const counts = {};
        for (const mood of moods) counts[mood] = (counts[mood] || 0) + 1;
        const currentKey = deps.getCurrentBgmSettingKey?.() || null;
        const winner = pickWinningMood(moods, currentKey);

        const phaseFallback = () => {
            manualHold = false;
            deps.playPhaseTrackCore?.();
            return {
                ok: true,
                winner: null,
                counts,
                settingKey: deps.getPhaseSettingKey?.() || null,
                fallback: true,
            };
        };

        if (!winner) {
            if (forceReplay) return phaseFallback();
            if (restorePhaseOnMiss && isPlayingMoodPlaylist()) return phaseFallback();
            return { ...empty, counts };
        }

        const settingKey = MOOD_SETTING_KEYS[winner];
        const tracks = deps.getTracks?.(settingKey) || [];
        if (!tracks.length) {
            if (forceReplay) return phaseFallback();
            if (restorePhaseOnMiss && isPlayingMoodPlaylist()) return phaseFallback();
            return { ...empty, counts, winner };
        }

        if (currentKey === settingKey && !forceReplay) {
            return { ok: true, winner, counts, settingKey, fallback: false };
        }
        manualHold = false;
        deps.playTrackFromSetting?.(settingKey, { forceDifferent: forceReplay });
        return { ok: true, winner, counts, settingKey, fallback: false };
    }

    function holdManual() {
        manualHold = true;
        clearTimeout(evaluateTimer);
        evaluateTimer = null;
    }

    function rescanAndPlay() {
        scanLiveSprites();
        manualHold = false;
        return runEvaluate({ restorePhaseOnMiss: true, forceReplay: true });
    }

    function scheduleEvaluate({ restorePhaseOnMiss = true } = {}) {
        if (!deps.isEnabled?.()) return;
        clearTimeout(evaluateTimer);
        evaluateTimer = setTimeout(() => {
            evaluateTimer = null;
            evaluateAndPlay({ restorePhaseOnMiss });
        }, EVALUATE_DEBOUNCE_MS);
    }

    function onEnabledChanged(enabled) {
        clearTimeout(evaluateTimer);
        evaluateTimer = null;
        manualHold = false;
        if (enabled) {
            evaluateAndPlay({ restorePhaseOnMiss: false });
            return;
        }
        if (isPlayingMoodPlaylist() && deps.isAmbientContext?.()) {
            deps.playPhaseTrackCore?.();
        }
    }

    return {
        noteFromImage,
        noteExpression,
        evaluateAndPlay,
        scheduleEvaluate,
        onEnabledChanged,
        holdManual,
        rescanAndPlay,
        isMoodSettingKey: (key) => MOOD_SETTING_KEY_SET.has(key),
    };
}
