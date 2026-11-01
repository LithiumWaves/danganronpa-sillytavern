// Trust ceremony looks. Both share the markup and the animation in
// trustAnimations.js: styles/systems/trust/ceremony.css is the Persona-style
// base, and ceremony-dr.css restyles it while the overlay carries
// data-style="danganronpa". The pictures are screenshots of each.

export const TRUST_CEREMONY_STYLE_CHOICES = Object.freeze([
    { value: "danganronpa", label: "Danganronpa", note: "Halftone, glitch cut-in, stamped letters", image: "images/ui/trust-ceremony/danganronpa.webp" },
    { value: "persona", label: "Persona", note: "Slanted slabs, cut-out letters", image: "images/ui/trust-ceremony/persona.webp" },
]);

const STYLES = TRUST_CEREMONY_STYLE_CHOICES.map((c) => c.value);

export function normalizeTrustCeremonyStyle(value) {
    return STYLES.includes(value) ? value : "danganronpa";
}
