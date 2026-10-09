// Regenerates the site's logo files from brand/Logo_final.zip.
//   node scripts/brand-assets.mjs
// Needs `unzip` on PATH. sharp and svgo come with Astro's dependencies.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { optimize } from 'svgo';

const ROOT = new URL('..', import.meta.url).pathname;
const ZIP = join(ROOT, 'brand/Logo_final.zip');
const PUBLIC = join(ROOT, 'public');

// Logo palette, as used in the SVG fills
const NAVY = '#111318';
const BONE = '#f2f0eb';
const NAVY_RGB = { r: 17, g: 19, b: 24, alpha: 1 };

const tmp = mkdtempSync(join(tmpdir(), 'dmt-logo-'));
execFileSync('unzip', ['-oq', ZIP, '-d', tmp]);
const src = (name) => readFileSync(join(tmp, 'Dark Matter Trading - Density Wave logo', name), 'utf8');

const svgo = (svg) => optimize(svg, { multipass: true }).data;

// Crop the viewBox to the drawn content plus a margin (fraction of the larger side).
async function tightViewBox(svg, margin, square = false) {
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
  const scale = 10; // px per SVG unit
  const { info } = await sharp(Buffer.from(svg), { density: 72 * scale })
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  let x = vb[0] - info.trimOffsetLeft / scale;
  let y = vb[1] - info.trimOffsetTop / scale;
  let w = info.width / scale;
  let h = info.height / scale;
  const m = Math.max(w, h) * margin;
  x -= m; y -= m; w += 2 * m; h += 2 * m;
  if (square) {
    const s = Math.max(w, h);
    x -= (s - w) / 2; y -= (s - h) / 2; w = h = s;
  }
  const box = [x, y, w, h].map((v) => +v.toFixed(2)).join(' ');
  return svg
    .replace(/viewBox="[^"]+"/, `viewBox="${box}"`)
    .replace(/\s(width|height)="[^"]+"/g, '');
}

// Horizontal logo: the "light on black" colours, background rects removed.
const horizontal = svgo(
  src('full logo horizontal - light on black.svg').replace(
    /<path[^>]*fill="rgb\(6\.669617%, 7\.449341%, 9\.408569%\)"[^>]*\/>/g,
    '',
  ),
);
const logo = await tightViewBox(horizontal, 0.01);
writeFileSync(join(PUBLIC, 'brand/logo-horizontal.svg'), logo);

// Symbol: the transparent "light" file is already in the bright colours.
const symbol = await tightViewBox(svgo(src('Transparent (for designers)/symbol - light.svg')), 0.02);
writeFileSync(join(PUBLIC, 'brand/symbol.svg'), symbol);

// Favicon: square, rings dark on light browser chrome and light on dark chrome.
const squareSymbol = await tightViewBox(svgo(src('Transparent (for designers)/symbol - light.svg')), 0.02, true);
const favicon = squareSymbol
  .replaceAll(`stroke="${BONE}"`, 'class="r"')
  .replace(
    /(<svg[^>]*>)/,
    `$1<style>.r{stroke:${NAVY}}@media (prefers-color-scheme:dark){.r{stroke:${BONE}}}</style>`,
  );
if (!favicon.includes('class="r"')) throw new Error('favicon: ring stroke colour not found');
writeFileSync(join(PUBLIC, 'favicon.svg'), favicon);

// Raster icons on a navy tile, for browsers and home screens that don't take SVG.
async function tile(svg, size, fill) {
  const inner = Math.round(size * fill);
  const mark = await sharp(Buffer.from(svg), { density: 1200 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: NAVY_RGB } })
    .composite([{ input: mark, gravity: 'center' }])
    .png();
}
const lightSquare = squareSymbol; // stroke stays bone
await (await tile(lightSquare, 32, 1)).toFile(join(PUBLIC, 'favicon-32.png'));
await (await tile(lightSquare, 180, 0.8)).toFile(join(PUBLIC, 'apple-touch-icon.png'));

// Link-preview image, 1200x630.
const ogLogo = await sharp(Buffer.from(logo), { density: 600 }).resize({ width: 800 }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: NAVY_RGB } })
  .composite([{ input: ogLogo, gravity: 'center' }])
  .png()
  .toFile(join(PUBLIC, 'brand/og-image.png'));

rmSync(tmp, { recursive: true, force: true });
console.log('brand assets written to public/');
