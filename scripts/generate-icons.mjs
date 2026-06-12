import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const masterPath = join(root, 'assets/icon-master.png');
const outDir = join(root, 'public/icon');
const sizes = [16, 32, 48, 128, 256];

if (!existsSync(masterPath)) {
  console.error(`Missing ${masterPath}. Add a square PNG master (1024+ recommended), then run bun run icons.`);
  process.exit(1);
}

const pngOpts = { compressionLevel: 6, effort: 10, palette: false };

function keepArtPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;

  if (r > 230 && g > 230 && b > 230) return false;
  if (max < 55 && sat < 25) return false;
  if (sat > 80 && r > 150 && b < 120) return true;
  if (sat >= 15 && sat <= 45 && min >= 100 && r >= 120 && r <= 210) return true;
  return false;
}

/** Drop the baked-in dark tile and light matte corners — keep shield artwork only. */
async function frameOnly(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    if (!keepArtPixel(pixels[o], pixels[o + 1], pixels[o + 2])) {
      pixels[o + 3] = 0;
    }
  }

  return sharp(pixels, { raw: { width, height, channels } }).png(pngOpts).toBuffer();
}

async function writeIcon(frameBuffer, size) {
  const out = join(outDir, `${size}.png`);
  const intermediate = size <= 16 ? 64 : size <= 32 ? 128 : size <= 48 ? 256 : null;

  let pipeline = sharp(frameBuffer);
  if (intermediate) {
    const mid = await pipeline.resize(intermediate, intermediate, { kernel: sharp.kernel.lanczos3 }).toBuffer();
    pipeline = sharp(mid);
  }
  await pipeline.resize(size, size, { kernel: sharp.kernel.lanczos3 }).png(pngOpts).toFile(out);
  console.log(`wrote ${out}`);
}

const framed = await frameOnly(masterPath);

for (const size of sizes) {
  await writeIcon(framed, size);
}
