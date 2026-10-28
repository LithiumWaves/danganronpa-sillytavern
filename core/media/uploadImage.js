// Images players add (Truth Bullet pictures, custom map floors) are stored as
// files in SillyTavern's user/images folder instead of as base64 inside the
// settings, which every save would otherwise copy.

export const IMAGE_FOLDER = "danganronpa";

// Formats SillyTavern's /api/images/upload accepts for images.
const MIME_FORMATS = Object.freeze({
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
});

let getHeaders = () => ({ "Content-Type": "application/json" });

export function configureImageUploads({ getRequestHeaders } = {}) {
    if (typeof getRequestHeaders === "function") getHeaders = getRequestHeaders;
}

export function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
}

// "data:image/png;base64,AAAA" → { format: "png", base64: "AAAA" }, or null
// for anything SillyTavern won't store as an image.
export function parseDataUrl(dataUrl) {
    if (!isDataUrl(dataUrl)) return null;
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match || !match[2]) return null;
    const format = MIME_FORMATS[match[1].toLowerCase()];
    if (!format || !match[3]) return null;
    return { format, base64: match[3] };
}

function makeFilename(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Uploads a data URL and returns its server path (/user/images/…), or null
// if it couldn't be stored — callers then keep the data URL.
export async function uploadDataUrlImage(dataUrl, { folder = IMAGE_FOLDER, prefix = "image", fetchImpl = globalThis.fetch } = {}) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed || typeof fetchImpl !== "function") return null;
    try {
        const response = await fetchImpl("/api/images/upload", {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
                image: parsed.base64,
                format: parsed.format,
                ch_name: folder,
                filename: makeFilename(prefix),
            }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return typeof data?.path === "string" && data.path ? data.path : null;
    } catch (e) {
        console.warn("[Dangan][Images] upload failed:", e);
        return null;
    }
}

// Replaces data-URL `image` fields on a list of objects with uploaded paths.
// `cache` maps data URL → path so the same picture is stored once per pass.
// Returns how many were replaced.
export async function uploadImagesIn(items, { upload = uploadDataUrlImage, cache = new Map(), prefix = "image", field = "image" } = {}) {
    let replaced = 0;
    for (const item of Array.isArray(items) ? items : []) {
        const value = item?.[field];
        if (!isDataUrl(value)) continue;
        let path = cache.get(value);
        if (!path) {
            path = await upload(value, { prefix });
            if (path) cache.set(value, path);
        }
        if (path) {
            item[field] = path;
            replaced += 1;
        }
    }
    return replaced;
}

// For exports: turns a stored image path back into a data URL so the file
// carries the picture to another install.
export async function fetchAsDataUrl(url, { fetchImpl = globalThis.fetch } = {}) {
    if (!url || isDataUrl(url) || typeof fetchImpl !== "function") return url;
    try {
        const response = await fetchImpl(url);
        if (!response.ok) return url;
        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || url));
            reader.onerror = () => resolve(url);
            reader.readAsDataURL(blob);
        });
    } catch {
        return url;
    }
}
