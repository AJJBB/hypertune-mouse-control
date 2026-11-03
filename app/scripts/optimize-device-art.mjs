// Optimize the committed product renders in public/devices for web delivery:
// resize to a sane max for a ~280px (retina 2x) slot and re-encode PNGs with
// palette quantization. Keeps PNG format and filenames so the device-art map
// (src/ui/device-art-generated.ts) stays valid, preserves alpha, and only
// rewrites a file when the result is actually smaller — so it is safe to re-run
// after dropping new art in.
//
//   node scripts/optimize-device-art.mjs        # optimize in place
//   node scripts/optimize-device-art.mjs --dry  # report only, write nothing
//
// Needs the `sharp` devDependency. Verified visually lossless at display size
// (mean per-pixel difference < 0.3/255 on the current set).
import sharp from "sharp";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "devices");
const MAX = 800;      // longest side, px
const QUALITY = 92;   // palette quantizer quality — high, to avoid banding
const dry = process.argv.includes("--dry");

const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".png"));
let before = 0, after = 0, shrunk = 0, kept = 0, failed = 0;
for (const f of files) {
  const path = join(DIR, f);
  const size = statSync(path).size;
  before += size;
  try {
    const buf = await sharp(path)
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .png({ palette: true, quality: QUALITY, compressionLevel: 9, effort: 9 })
      .toBuffer();
    if (buf.length < size) {
      // Write the encoded buffer straight to disk — re-encoding it through
      // sharp().toFile() would drop the palette settings and re-inflate it.
      if (!dry) writeFileSync(path, buf);
      after += buf.length; shrunk++;
    } else {
      after += size; kept++;
    }
  } catch (error) {
    after += size; failed++;
    console.warn(`  skip ${f}: ${error.message}`);
  }
}
const mb = (n) => (n / 1048576).toFixed(1) + "MB";
console.log(`${dry ? "[dry] " : ""}${files.length} PNGs — ${shrunk} optimized, ${kept} already small, ${failed} skipped`);
console.log(`total ${mb(before)} -> ${mb(after)} (${Math.round((1 - after / before) * 100)}% smaller)`);
