// VN text box styles: the original box and recreations of each game's
// dialogue box. The look lives in styles/systems/vn/skins.css, keyed off
// <body data-dangan-vn-skin>; the pictures are rendered from it.

export const VN_SKIN_CHOICES = Object.freeze([
    { value: "current", label: "Classic", game: "The original Monopad box", image: "images/ui/textbox/current.webp" },
    { value: "thh", label: "Trigger Happy Havoc", game: "Danganronpa 1", image: "images/ui/textbox/thh.webp" },
    { value: "sdr2", label: "Goodbye Despair", game: "Danganronpa 2", image: "images/ui/textbox/sdr2.webp" },
    { value: "v3", label: "Killing Harmony", game: "Danganronpa V3", image: "images/ui/textbox/v3.webp" },
]);

export const VN_SKINS = Object.freeze(VN_SKIN_CHOICES.map((c) => c.value));

export function normalizeVnSkin(value) {
    return VN_SKINS.includes(value) ? value : "current";
}

// Investigation / Free Time / Nighttime banners. "match" uses the text box
// style; the rest pick a game's banner regardless of the text box. Styled in
// styles/systems/phase/banners.css, keyed off <body data-dangan-banner-style>.
export const PHASE_BANNER_CHOICES = Object.freeze([
    { value: "match", label: "Match text box", game: "Follows the text box style" },
    { value: "current", label: "Classic", game: "The original Monopad banner", image: "images/ui/phase-banner/current.webp" },
    { value: "thh", label: "Trigger Happy Havoc", game: "Danganronpa 1", image: "images/ui/phase-banner/thh.webp" },
    { value: "sdr2", label: "Goodbye Despair", game: "Danganronpa 2", image: "images/ui/phase-banner/sdr2.webp" },
    { value: "v3", label: "Killing Harmony", game: "Danganronpa V3", image: "images/ui/phase-banner/v3.webp" },
]);

export function normalizePhaseBannerStyle(value) {
    return PHASE_BANNER_CHOICES.some((c) => c.value === value) ? value : "match";
}

// The banner that actually shows: a game's, or the text box's for "match".
export function resolvePhaseBannerStyle(style, vnSkin) {
    const picked = normalizePhaseBannerStyle(style);
    return picked === "match" ? normalizeVnSkin(vnSkin) : picked;
}
