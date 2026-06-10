export function createOpenRouterSettingsManager({ extensionName, extension_settings, saveSettingsDebounced, defaultSettings }) {
    let runtimeOpenRouterApiKey = "";

    function loadSettings() {
        extension_settings[extensionName] ||= {};
        extension_settings[extensionName] = {
            ...defaultSettings,
            ...extension_settings[extensionName]
        };

        extension_settings[extensionName].giftJudgements ||= {};
        const legacyWhiteNoiseToggle = extension_settings[extensionName].whiteNoiseGenerationEnabled;
        if (!["default", "main", "openrouter"].includes(extension_settings[extensionName].whiteNoiseLineSource)) {
            if (legacyWhiteNoiseToggle === false) {
                extension_settings[extensionName].whiteNoiseLineSource = "default";
            } else {
                extension_settings[extensionName].whiteNoiseLineSource =
                    extension_settings[extensionName].generationProvider === "openrouter" ? "openrouter" : "main";
            }
            saveSettingsDebounced();
        }

        const storedLegacyKey = String(extension_settings[extensionName].openrouterApiKey || "").trim();
        const shouldRemember = !!extension_settings[extensionName].openrouterRememberApiKey;
        setRuntimeOpenRouterApiKey(storedLegacyKey);

        if (!shouldRemember && storedLegacyKey) {
            delete extension_settings[extensionName].openrouterApiKey;
            saveSettingsDebounced();
        }
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
