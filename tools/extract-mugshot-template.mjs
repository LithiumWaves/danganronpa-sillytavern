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
// Generalised: `node tools/extract-mugshot-template.mjs [template.xcf] [out-prefix]`.
// Defaults reproduce the original mugshot behaviour. Used for the death-portrait
// template too (death-portrait-template.xcf → death-portrait-{bg,texture,mask}.png).
const TEMPLATE_FILE = process.argv[2] || 'mugshot-template.xcf';
const OUT_PREFIX    = process.argv[3] || 'mugshot';
const xcfPath = join(templatesDir, TEMPLATE_FILE);

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

console.log(`Template ${TEMPLATE_FILE} (${imgW}x${imgH}) — layers:`);
for (const [n, l] of Object.entries(layers)) {
    console.log(`  "${n}"  ${l.lw}x${l.lh} @ (${l.offX},${l.offY})  bpp-rgba`);
}

// Dump mode: write every layer to PNG (canvas-sized, placed at its offset) for
// visual inspection, then exit. `node … <tpl.xcf> <prefix> --dump`.
if (process.argv.includes('--dump')) {
    for (const [n, l] of Object.entries(layers)) {
        const canvas = Buffer.alloc(imgW * imgH * 4); // transparent
        for (let y = 0; y < l.lh; y++) {
            for (let x = 0; x < l.lw; x++) {
                const cx = x + l.offX, cy = y + l.offY;
                if (cx < 0 || cy < 0 || cx >= imgW || cy >= imgH) continue;
                const si = (y * l.lw + x) * 4, di = (cy * imgW + cx) * 4;
                canvas[di] = l.rgba[si]; canvas[di + 1] = l.rgba[si + 1];
                canvas[di + 2] = l.rgba[si + 2]; canvas[di + 3] = l.rgba[si + 3];
            }
        }
        const safe = n.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const file = `${OUT_PREFIX}-DUMP-${safe}.png`;
        writeFileSync(join(templatesDir, file), encodePNG(imgW, imgH, canvas));
        console.log(`  dumped ${file}`);
    }
    process.exit(0);
}

const hasMugshot = ['background', 'texture-overlay', 'overlay-space'].every(n => layers[n]);
const hasDeath = layers['Stand'] && layers['Cross'];

let outputs, summary;

if (hasMugshot) {
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
    outputs = [
        [`${OUT_PREFIX}-bg.png`, bg.lw, bg.lh, bg.rgba],
        [`${OUT_PREFIX}-texture.png`, tex.lw, tex.lh, tex.rgba],
        [`${OUT_PREFIX}-mask.png`, ov.lw, ov.lh, mask],
    ];
    summary = `Mugshot template ${imgW}x${imgH}; texture offset ${tex.offX},${tex.offY} (drawn at that offset at runtime).`;
} else if (hasDeath) {
    // Death-portrait template: an ornate picture frame on a stand ("Stand") with a
    // pink X mark ("Cross"). The character sprite sits in the frame's window; the
    // window is the transparent region ENCLOSED by the opaque frame. Distinguish it
    // from the transparent area OUTSIDE the frame (and around the pole) with a flood
    // fill seeded from the canvas border — anything border-reachable is "outside";
    // unreached transparent pixels are the window. Both layers are full-canvas at 0,0.
    const stand = layers['Stand'];
    const cross = layers['Cross'];
    const W = imgW, H = imgH;
    const isT = (i) => stand.rgba[i * 4 + 3] < 128; // transparent frame pixel
    const outside = new Uint8Array(W * H);
    const stack = [];
    const seed = (i) => { if (isT(i) && !outside[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + (W - 1)); }
    while (stack.length) {
        const i = stack.pop(); const x = i % W, y = (i / W) | 0;
        if (x + 1 < W) seed(i + 1);
        if (x - 1 >= 0) seed(i - 1);
        if (y + 1 < H) seed(i + W);
        if (y - 1 >= 0) seed(i - W);
    }
    const mask = Buffer.alloc(W * H * 4);
    let winMinX = W, winMinY = H, winMaxX = 0, winMaxY = 0, winFound = false;
    for (let i = 0; i < W * H; i++) {
        const inWindow = isT(i) && !outside[i];
        mask[i * 4] = 255; mask[i * 4 + 1] = 255; mask[i * 4 + 2] = 255;
        mask[i * 4 + 3] = inWindow ? 255 : 0;
        if (inWindow) {
            const x = i % W, y = (i / W) | 0;
            winFound = true;
            if (x < winMinX) winMinX = x; if (x > winMaxX) winMaxX = x;
            if (y < winMinY) winMinY = y; if (y > winMaxY) winMaxY = y;
        }
    }
    outputs = [
        [`${OUT_PREFIX}-stand.png`, stand.lw, stand.lh, stand.rgba],
        [`${OUT_PREFIX}-cross.png`, cross.lw, cross.lh, cross.rgba],
        [`${OUT_PREFIX}-mask.png`, W, H, mask],
    ];
    summary = winFound
        ? `Death-portrait template ${imgW}x${imgH}; window bbox x=${winMinX} y=${winMinY} w=${winMaxX - winMinX + 1} h=${winMaxY - winMinY + 1}.`
        : `Death-portrait template ${imgW}x${imgH}; WARNING: no enclosed window found (frame border may have a gap).`;
} else {
    throw new Error(`Unrecognised template; layers: ${Object.keys(layers).map(n => `"${n}"`).join(', ')}`);
}

for (const [file, w, h, data] of outputs) {
    const dest = join(templatesDir, file);
    writeFileSync(dest, encodePNG(w, h, data));
    console.log(`wrote ${file}  (${w}x${h})`);
}
console.log(`\n${summary}`);
