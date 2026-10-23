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
