export function createOpenRouterSettingsManager({ extensionName, extension_settings, saveSettingsDebounced, defaultSettings }) {
    let runtimeOpenRouterApiKey = "";

    function loadSettings() {
        const existingSettings = extension_settings[extensionName] || {};
        const hadWhiteNoiseLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "whiteNoiseLineSource");
        const hadNsdLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "nsdLineSource");
        const hadMpdLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "mpdLineSource");
        const hadHangmansGambitLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "hangmansGambitLineSource");
        const hadQuestionTimeLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "questionTimeLineSource");
        const hadQuestionTruthLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "questionTruthLineSource");
        const hadArgumentArmamentLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "argumentArmamentLineSource");
        const hadScrumDebateLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "scrumDebateLineSource");
        const hadMindMineLineSource = Object.prototype.hasOwnProperty.call(existingSettings, "mindMineLineSource");
        extension_settings[extensionName] ||= {};
        extension_settings[extensionName] = {
            ...defaultSettings,
            ...existingSettings
        };

        extension_settings[extensionName].giftJudgements ||= {};
        const generationProvider = extension_settings[extensionName].generationProvider === "openrouter" ? "openrouter" : "main";
        const legacyWhiteNoiseToggle = existingSettings.whiteNoiseGenerationEnabled;
        let settingsChanged = false;

        if (!hadWhiteNoiseLineSource || !["default", "main", "openrouter"].includes(extension_settings[extensionName].whiteNoiseLineSource)) {
            extension_settings[extensionName].whiteNoiseLineSource =
                legacyWhiteNoiseToggle === false ? "default" : generationProvider;
            settingsChanged = true;
        }

        if (!hadNsdLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].nsdLineSource)) {
            extension_settings[extensionName].nsdLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadMpdLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].mpdLineSource)) {
            extension_settings[extensionName].mpdLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadHangmansGambitLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].hangmansGambitLineSource)) {
            extension_settings[extensionName].hangmansGambitLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadQuestionTimeLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].questionTimeLineSource)) {
            extension_settings[extensionName].questionTimeLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadQuestionTruthLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].questionTruthLineSource)) {
            extension_settings[extensionName].questionTruthLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadArgumentArmamentLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].argumentArmamentLineSource)) {
            extension_settings[extensionName].argumentArmamentLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadScrumDebateLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].scrumDebateLineSource)) {
            extension_settings[extensionName].scrumDebateLineSource = generationProvider;
            settingsChanged = true;
        }

        if (!hadMindMineLineSource || !["main", "openrouter"].includes(extension_settings[extensionName].mindMineLineSource)) {
            extension_settings[extensionName].mindMineLineSource = generationProvider;
            settingsChanged = true;
        }

        const storedLegacyKey = String(extension_settings[extensionName].openrouterApiKey || "").trim();
        const shouldRemember = !!extension_settings[extensionName].openrouterRememberApiKey;
        setRuntimeOpenRouterApiKey(storedLegacyKey);

        if (!shouldRemember && storedLegacyKey) {
            delete extension_settings[extensionName].openrouterApiKey;
            settingsChanged = true;
        }

        if (settingsChanged) saveSettingsDebounced();
    }

    function getMonopadSetting(key) {
        return extension_settings[extensionName]?.[key];
    }

    function setMonopadSetting(key, value) {
        extension_settings[extensionName][key] = value;
        saveSettingsDebounced();
    }

    function getOpenRouterApiKey() {
        if (runtimeOpenRouterApiKey) return runtimeOpenRouterApiKey;

        if (!getMonopadSetting("openrouterRememberApiKey")) {
            return "";
        }

        const key = getMonopadSetting("openrouterApiKey");
        return typeof key === "string" ? key.trim() : "";
    }

    function getRuntimeOpenRouterApiKey() {
        return runtimeOpenRouterApiKey;
    }

    function setRuntimeOpenRouterApiKey(value) {
        runtimeOpenRouterApiKey = String(value || "").trim();
    }

    function persistOpenRouterApiKeyIfAllowed() {
        const shouldRemember = !!getMonopadSetting("openrouterRememberApiKey");
        if (shouldRemember) {
            setMonopadSetting("openrouterApiKey", runtimeOpenRouterApiKey);
            return;
        }

        if (extension_settings[extensionName].openrouterApiKey) {
            delete extension_settings[extensionName].openrouterApiKey;
            saveSettingsDebounced();
        }
    }

    function isOpenRouterGenerationEnabled() {
        return getMonopadSetting("generationProvider") === "openrouter";
    }

    async function generateWithOpenRouter(prompt, { maxTokens = 300, temperature = 0.25, topP = 0.9, stop = ["USER:", "ASSISTANT:", "###"] } = {}) {
        const apiKey = getOpenRouterApiKey();
        if (!apiKey) {
            throw new Error("OpenRouter is selected but no API key is configured in Monopad settings.");
        }

        const model = String(getMonopadSetting("openrouterModel") || defaultSettings.openrouterModel).trim() || defaultSettings.openrouterModel;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": window.location?.origin || "https://sillytavern.app",
                "X-Title": "Danganronpa Monopad"
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                stop
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter request failed (${response.status}): ${errorText.slice(0, 240)}`);
        }

        const data = await response.json();
        return String(data?.choices?.[0]?.message?.content || "").trim();
    }

    async function testOpenRouterConnection() {
        const apiKey = getOpenRouterApiKey();
        if (!apiKey) {
            throw new Error("Missing OpenRouter API key.");
        }

        const model = String(getMonopadSetting("openrouterModel") || defaultSettings.openrouterModel).trim() || defaultSettings.openrouterModel;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": window.location?.origin || "https://sillytavern.app",
                "X-Title": "Danganronpa Monopad"
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: "Reply with exactly: PONG" }],
                max_tokens: 8,
                temperature: 0
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Connection test failed (${response.status}): ${errorText.slice(0, 180)}`);
        }

        return "Connection succeeded";
    }

    return {
        loadSettings,
        getMonopadSetting,
        setMonopadSetting,
        getRuntimeOpenRouterApiKey,
        setRuntimeOpenRouterApiKey,
        persistOpenRouterApiKeyIfAllowed,
        isOpenRouterGenerationEnabled,
        generateWithOpenRouter,
        testOpenRouterConnection,
    };
}
