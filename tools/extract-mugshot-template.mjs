#!/usr/bin/env node
// One-time build step: convert assets/templates/mugshot-template.xcf into the
// web-usable PNGs the runtime mugshot generator composites with. Pure Node
// stdlib (only `zlib`) — no GIMP / ImageMagick / npm packages. Run once and
// commit the outputs; the shipped extension only ever loads the PNGs.
//
//   node tools/extract-mugshot-template.mjs
//
// Outputs (next to the template):
//   mugshot-bg.png       (280x404) — the "background" layer (opaque speckle)
//   mugshot-texture.png  (281x405) — the "texture-overlay" layer (offset -1,-1)
//   mugshot-mask.png     (280x404) — derived from "overlay-space": opaque white
//                                    inside the angled card window, transparent
//                                    outside. Used at runtime as a destination-in
//                                    clip so the mugshot is the angled card only.
//
// The "character-sprite" layer in the XCF is just a placeholder showing where a
// neutral sprite sits; it is ignored here (the runtime supplies the real sprite).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(here, '..', 'assets', 'templates');
const xcfPath = join(templatesDir, 'mugshot-template.xcf');

// ── XCF parsing ──────────────────────────────────────────────────────────────
const buf = readFileSync(xcfPath);
const version = parseInt(buf.toString('latin1', 9, 13).replace(/\D/g, ''), 10);
if (version < 11) {
    // 64-bit file pointers arrived at v11; this template is v11. Bail loudly
    // rather than silently misread older files.
    throw new Error(`Expected XCF version >= 11, got v${version}`);
}

let p = 14;
const u32 = () => { const v = buf.readUInt32BE(p); p += 4; return v; };
const ptr = () => { const v = Number(buf.readBigUInt64BE(p)); p += 8; return v; };

const imgW = u32(), imgH = u32();
u32(); // base type
u32(); // precision
// Skip image properties (each: type u32, length u32, payload).
while (true) { const t = u32(); const len = u32(); if (t === 0) break; p += len; }
// Layer pointer list, terminated by a 0 pointer.
const layerPtrs = [];
while (true) { const lp = ptr(); if (lp === 0) break; layerPtrs.push(lp); }

// GIMP XCF per-tile RLE: each 64x64 tile stores its `bpp` channel planes
// contiguously, each plane RLE-compressed independently. Opcode boundaries are
// 126 / 127 / 128 (per xcftools pixels.c); runs are clamped to the remaining
// plane size so malformed data can never overrun the tile buffer.
function decodeLayer(layerPtr) {
    let q = layerPtr;
    const r32 = () => { const v = buf.readUInt32BE(q); q += 4; return v; };
    const ri32 = () => { const v = buf.readInt32BE(q); q += 4; return v; };
    const rptr = () => { const v = Number(buf.readBigUInt64BE(q)); q += 8; return v; };

    const lw = r32(), lh = r32();
    r32(); // layer type
    const nameLen = r32();
    const name = buf.toString('utf8', q, q + nameLen - 1); q += nameLen;
    let offX = 0, offY = 0;
    while (true) {
        const t = r32(); const len = r32(); const save = q;
        if (t === 0) break;
        if (t === 15) { offX = ri32(); offY = ri32(); } // PROP_OFFSETS
        q = save + len;
    }
    const hierPtr = rptr(); rptr(); // hierarchy ptr, layer-mask ptr

    q = hierPtr;
    r32(); r32(); // hierarchy width/height
    const bpp = r32();
    const levelPtr = rptr(); // first (full-resolution) level only

    q = levelPtr;
    r32(); r32(); // level width/height
    const tilePtrs = [];
    while (true) { const tp = rptr(); if (tp === 0) break; tilePtrs.push(tp); }

    const px = Buffer.alloc(lw * lh * bpp);
    const tilesPerRow = Math.ceil(lw / 64);
    tilePtrs.forEach((tp, idx) => {
        const tx = (idx % tilesPerRow) * 64;
        const ty = Math.floor(idx / tilesPerRow) * 64;
        const tw = Math.min(64, lw - tx);
        const th = Math.min(64, lh - ty);
        const size = tw * th;
        let off = tp;
        for (let c = 0; c < bpp; c++) {
            const plane = Buffer.alloc(size);
            let o = 0;
            while (o < size) {
                const n = buf[off++];
                if (n <= 126) {                       // run of (n+1) identical bytes
                    const count = Math.min(n + 1, size - o);
                    const v = buf[off++]; plane.fill(v, o, o + count); o += count;
                } else if (n === 127) {               // long identical run (16-bit BE length)
                    const count = Math.min((buf[off++] << 8) | buf[off++], size - o);
                    const v = buf[off++]; plane.fill(v, o, o + count); o += count;
                } else if (n === 128) {               // long verbatim run (16-bit BE length)
                    const count = Math.min((buf[off++] << 8) | buf[off++], size - o);
                    buf.copy(plane, o, off, off + count); off += count; o += count;
                } else {                              // 129..255: verbatim run of (256-n)
                    const count = Math.min(256 - n, size - o);
                    buf.copy(plane, o, off, off + count); off += count; o += count;
                }
            }
            for (let yy = 0; yy < th; yy++) {
                for (let xx = 0; xx < tw; xx++) {
                    px[((ty + yy) * lw + (tx + xx)) * bpp + c] = plane[yy * tw + xx];
                }
            }
        }
    });

    // Normalise to RGBA8.
    let rgba = px;
    if (bpp === 3) {
        rgba = Buffer.alloc(lw * lh * 4);
        for (let i = 0; i < lw * lh; i++) {
            rgba[i * 4] = px[i * 3]; rgba[i * 4 + 1] = px[i * 3 + 1];
            rgba[i * 4 + 2] = px[i * 3 + 2]; rgba[i * 4 + 3] = 255;
        }
    }
    return { name, lw, lh, offX, offY, rgba };
}

// ── PNG encoding (RGBA8, stdlib zlib) ────────────────────────────────────────
const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
const crc32 = (b) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
};
const pngChunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'latin1');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
};
const encodePNG = (w, h, rgba) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
    const raw = Buffer.alloc(h * (1 + w * 4));
    for (let y = 0; y < h; y++) {
        raw[y * (1 + w * 4)] = 0; // filter: none
        rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
    }
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
};

// ── Extract + write ──────────────────────────────────────────────────────────
const layers = Object.fromEntries(layerPtrs.map(decodeLayer).map(l => [l.name, l]));

const need = ['background', 'texture-overlay', 'overlay-space'];
for (const n of need) {
    if (!layers[n]) throw new Error(`Template is missing expected layer "${n}"`);
}

const bg = layers['background'];
const tex = layers['texture-overlay'];
const ov = layers['overlay-space'];

// Mask: the angled card window is the TRANSPARENT region of overlay-space (the
// magenta chroma guide is opaque). Emit opaque white inside the window,
// transparent outside, so the runtime can clip with destination-in.
const mask = Buffer.alloc(ov.lw * ov.lh * 4);
for (let i = 0; i < ov.lw * ov.lh; i++) {
    const inside = ov.rgba[i * 4 + 3] < 128; // overlay-space transparent => card window
    mask[i * 4] = 255; mask[i * 4 + 1] = 255; mask[i * 4 + 2] = 255;
    mask[i * 4 + 3] = inside ? 255 : 0;
}

const outputs = [
    ['mugshot-bg.png', bg.lw, bg.lh, bg.rgba],
    ['mugshot-texture.png', tex.lw, tex.lh, tex.rgba],
    ['mugshot-mask.png', ov.lw, ov.lh, mask],
];
for (const [file, w, h, data] of outputs) {
    const dest = join(templatesDir, file);
    writeFileSync(dest, encodePNG(w, h, data));
    console.log(`wrote ${file}  (${w}x${h})`);
}
console.log(`\nTemplate ${imgW}x${imgH}; texture offset ${tex.offX},${tex.offY} (drawn at that offset at runtime).`);
