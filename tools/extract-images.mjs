// Extracts the exhibit / answer screenshots embedded in AZ-104_dump.pdf.
//
// Two things come out of this pass:
//   web/public/img/*.webp   the images themselves
//   data/images.json        per PDF page: each image's file, size and vertical extent,
//                           plus the vertical position of every QUESTION / Answer(s) marker
//
// The vertical positions matter because a question and its worked answer frequently share
// a page; parse-dump.mjs uses them to tell an exhibit apart from an answer key.
import { getDocument, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'web', 'public', 'img');
const PDF = path.join(ROOT, 'AZ-104_dump.pdf');
const MAX_W = 1400;
const WEBP_QUALITY = 90;
// An image repeated on more than this many pages is page furniture, not content.
const BOILERPLATE_PAGES = 3;

const KIND_GRAYSCALE_1BPP = 1, KIND_RGB_24BPP = 2, KIND_RGBA_32BPP = 3;

function toRGBA(img) {
  const { width: w, height: h, kind, data } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  if (kind === KIND_RGBA_32BPP) {
    out.set(data.subarray(0, out.length));
  } else if (kind === KIND_RGB_24BPP) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      out[i * 4] = data[j]; out[i * 4 + 1] = data[j + 1]; out[i * 4 + 2] = data[j + 2]; out[i * 4 + 3] = 255;
    }
  } else if (kind === KIND_GRAYSCALE_1BPP) {
    const rowBytes = (w + 7) >> 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const i = (y * w + x) * 4;
        out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
      }
    }
  } else {
    return null;
  }
  return out;
}

async function getObj(page, name) {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs;
  return await Promise.race([
    new Promise((res) => store.get(name, res)),
    new Promise((res) => setTimeout(() => res(null), 5000)),
  ]);
}

/** Replays the operator list's transform stack to find where each image lands on the page. */
function imagePlacements(ops, baseTransform) {
  const placements = [];
  const stack = [];
  let ctm = baseTransform.slice();
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() || baseTransform.slice();
    else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      // Images are painted into the unit square, so the CTM's corners are the bounding box.
      const ys = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => Util.applyTransform([x, y], ctm)[1]);
      placements.push({ name: args[0], top: Math.min(...ys), bottom: Math.max(...ys) });
    }
  }
  return placements;
}

const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(PDF)) }).promise;
console.log(`PDF: ${doc.numPages} pages`);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });

// Pass 1 — decode every candidate image, note where it sits, hash it for dedup.
const perPage = new Map();
const hashPages = new Map();
const anchors = {};

for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();
  const placements = imagePlacements(ops, vp.transform);

  // Locate the structural markers on this page. Text items can be split mid-line, so
  // rebuild lines by vertical position before matching.
  const text = await page.getTextContent();
  const byLine = new Map();
  for (const item of text.items) {
    if (!item.str) continue;
    const [, , , , x, y] = Util.transform(vp.transform, item.transform);
    const key = Math.round(y);
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push({ x, str: item.str });
  }
  const marks = [];
  for (const [y, parts] of byLine) {
    const line = parts.sort((a, b) => a.x - b.x).map((p) => p.str).join('');
    const q = line.match(/QUESTION:\s*(\d+)/);
    if (q) marks.push({ kind: 'question', id: Number(q[1]), y });
    else if (/Answer\(s\):/.test(line)) marks.push({ kind: 'answer', y });
  }
  if (marks.length) anchors[n] = marks.sort((a, b) => a.y - b.y);

  if (!placements.length) { page.cleanup(); continue; }

  let rendered = false;
  const found = [];
  for (const pl of placements) {
    if (typeof pl.name !== 'string') continue;
    let obj = await getObj(page, pl.name);
    if (!obj && !rendered) {
      // A few images only materialise once the page is actually rasterised.
      const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      rendered = true;
      obj = await getObj(page, pl.name);
    }
    if (!obj || !obj.data || !obj.width || !obj.height) continue;
    if (obj.width < 120 || obj.height < 40) continue; // icons, rules, bullets
    const rgba = toRGBA(obj);
    if (!rgba) continue;
    const hash = crypto.createHash('sha1').update(Buffer.from(rgba.buffer)).digest('hex').slice(0, 12);
    found.push({ hash, w: obj.width, h: obj.height, top: pl.top, bottom: pl.bottom, rgba });
    if (!hashPages.has(hash)) hashPages.set(hash, new Set());
    hashPages.get(hash).add(n);
  }
  if (found.length) perPage.set(n, found);
  page.cleanup();
  if (n % 100 === 0) process.stdout.write(`  ...page ${n}\n`);
}

// Pass 2 — write the keepers, downscaled and WebP-encoded.
const written = new Map();
const index = {};
let skipped = 0;
for (const [n, imgs] of [...perPage.entries()].sort((a, b) => a[0] - b[0])) {
  const entries = [];
  for (const img of imgs.sort((a, b) => a.top - b.top)) {
    if (hashPages.get(img.hash).size > BOILERPLATE_PAGES) { skipped++; continue; }
    let rec = written.get(img.hash);
    if (!rec) {
      const scale = Math.min(1, MAX_W / img.w);
      const w = Math.round(img.w * scale), h = Math.round(img.h * scale);
      const file = `p${n}_${img.hash}.webp`;
      const dest = path.join(OUT_DIR, file);
      if (!fs.existsSync(dest)) {
        const src = createCanvas(img.w, img.h);
        const sctx = src.getContext('2d');
        const id = sctx.createImageData(img.w, img.h);
        id.data.set(img.rgba);
        sctx.putImageData(id, 0, 0);
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(src, 0, 0, w, h);
        fs.writeFileSync(dest, await c.encode('webp', WEBP_QUALITY));
      }
      rec = { file, w, h };
      written.set(img.hash, rec);
    }
    entries.push({ ...rec, top: Math.round(img.top), bottom: Math.round(img.bottom) });
  }
  if (entries.length) index[n] = entries;
}

fs.writeFileSync(
  path.join(ROOT, 'data', 'images.json'),
  JSON.stringify({ pages: index, marks: anchors }, null, 1),
);
console.log(`Wrote ${written.size} images across ${Object.keys(index).length} pages (skipped ${skipped} boilerplate refs).`);

// Drop any PNG/WebP left over from a previous run with different settings.
const keep = new Set([...written.values()].map((r) => r.file));
for (const f of fs.readdirSync(OUT_DIR)) {
  if (!keep.has(f)) { fs.rmSync(path.join(OUT_DIR, f)); console.log(`  removed stale ${f}`); }
}
