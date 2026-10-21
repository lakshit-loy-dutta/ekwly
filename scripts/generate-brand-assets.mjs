import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const svgDir = path.join(rootDir, 'brand-kit', 'svg');
fs.mkdirSync(svgDir, { recursive: true });

// Locked v3 Geometry Path (T = 13.90, H = 85.50, W = 76.50, g = 4.00, s = 8.50, R_out = 12, R_in = 7, rTip = 6)
const E_PATH =
  'M 23.75 7.25 L 82.25 7.25 A 6.00 6.00 0 0 1 88.25 13.25 L 88.25 15.15 A 6.00 6.00 0 0 1 82.25 21.15 L 36.13 21.15 A 7.00 7.00 0 0 0 29.13 28.15 L 29.13 36.05 A 7.00 7.00 0 0 0 36.13 43.05 L 62.15 43.05 A 6.00 6.00 0 0 1 68.15 49.05 L 68.15 50.95 A 6.00 6.00 0 0 1 62.15 56.95 L 36.13 56.95 A 7.00 7.00 0 0 0 29.13 63.95 L 29.13 71.85 A 7.00 7.00 0 0 0 36.13 78.85 L 82.25 78.85 A 6.00 6.00 0 0 1 88.25 84.85 L 88.25 86.75 A 6.00 6.00 0 0 1 82.25 92.75 L 23.75 92.75 A 12.00 12.00 0 0 1 11.75 80.75 L 11.75 19.25 A 12.00 12.00 0 0 1 23.75 7.25 Z';

const KWLY_PATHS = [
  '<path d="M 14 12 L 14 74" />',
  '<path d="M 46 34 L 18 53 L 48 74" />',
  '<path d="M 70 34 L 83 74 L 99 44 L 115 74 L 128 34" />',
  '<path d="M 152 12 L 152 65 Q 152 74 162 74" />',
  '<path d="M 182 34 L 200 68" />',
  '<path d="M 220 34 L 195 83 Q 190 91 179 89" />',
].join('');

function buildIconSvg({ eFill, eqTop, eqBot, boxed = false }) {
  const bg = boxed
    ? [
        '<defs>',
        '<linearGradient id="bgG" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">',
        '<stop offset="0%" stop-color="#071226"/>',
        '<stop offset="100%" stop-color="#0F2342"/>',
        '</linearGradient>',
        '</defs>',
        '<rect x="0" y="0" width="100" height="100" rx="24" fill="url(#bgG)"/>',
      ].join('')
    : '';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024" fill="none">',
    bg,
    `<path d="${E_PATH}" fill="${eFill}" />`,
    `<rect x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill="${eqTop}" />`,
    `<rect x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill="${eqBot}" />`,
    '</svg>',
  ].join('');
}

// ViewBox expanded to 354 x 114 (width 2124 x height 684) so the 'y' descender (Y=109.8) is never clipped
function buildWordmarkSvg({ eFill, kwlyStroke, eqTop, eqBot }) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 354 114" width="2124" height="684" fill="none">',
    `<path d="${E_PATH}" fill="${eFill}" />`,
    `<rect x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill="${eqTop}" />`,
    `<rect x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill="${eqBot}" />`,
    `<g transform="translate(91.25, 4.09) scale(1.09)" stroke="${kwlyStroke}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">`,
    KWLY_PATHS,
    '</g>',
    '</svg>',
  ].join('');
}

// All 3 Studio v3 Animated SVGs (with transform-box: fill-box; transform-origin: left center;)
const animatedLockInSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" fill="none">',
  '<style>',
  '@keyframes animLockInTop { 0% { transform: translateX(26px) scaleX(0.5); opacity: 0; } 45% { transform: translateX(-2.5px) scaleX(1.06); opacity: 1; } 65% { transform: translateX(1.5px) scaleX(0.97); } 80%, 100% { transform: translateX(0) scaleX(1); opacity: 1; } }',
  '@keyframes animLockInBot { 0%, 12% { transform: translateX(26px) scaleX(0.5); opacity: 0; } 55% { transform: translateX(-2.5px) scaleX(1.06); opacity: 1; } 75% { transform: translateX(1.5px) scaleX(0.97); } 90%, 100% { transform: translateX(0) scaleX(1); opacity: 1; } }',
  '.eq-bar-top { transform-origin: left center; transform-box: fill-box; animation: animLockInTop 1s cubic-bezier(0.22, 1, 0.36, 1) infinite; }',
  '.eq-bar-bot { transform-origin: left center; transform-box: fill-box; animation: animLockInBot 1s cubic-bezier(0.22, 1, 0.36, 1) infinite; }',
  '</style>',
  '<rect width="100" height="100" rx="24" fill="#071226" />',
  `<path d="${E_PATH}" fill="#FFFFFF" />`,
  '<rect class="eq-bar-top" x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill="#0080FF" />',
  '<rect class="eq-bar-bot" x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill="#38BDF8" />',
  '</svg>',
].join('');

const animatedEqualizerSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" fill="none">',
  '<style>',
  '@keyframes animEqualizerTop { 0%, 100% { transform: translateX(0) scaleX(1); } 45% { transform: translateX(5px) scaleX(0.72); } 80% { transform: translateX(-1.5px) scaleX(1.08); } }',
  '@keyframes animEqualizerBot { 0%, 100% { transform: translateX(0) scaleX(1); } 45% { transform: translateX(-2px) scaleX(1.1); } 80% { transform: translateX(6px) scaleX(0.7); } }',
  '.eq-bar-top { transform-origin: left center; transform-box: fill-box; animation: animEqualizerTop 1s cubic-bezier(0.45, 0, 0.55, 1) infinite; }',
  '.eq-bar-bot { transform-origin: left center; transform-box: fill-box; animation: animEqualizerBot 1s cubic-bezier(0.45, 0, 0.55, 1) infinite; }',
  '</style>',
  '<rect width="100" height="100" rx="24" fill="#071226" />',
  `<path d="${E_PATH}" fill="#FFFFFF" />`,
  '<rect class="eq-bar-top" x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill="#0080FF" />',
  '<rect class="eq-bar-bot" x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill="#38BDF8" />',
  '</svg>',
].join('');

const animatedScanSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" fill="none">',
  '<style>',
  '@keyframes animLaser { 0%, 100% { transform: translateY(12px); opacity: 0.2; } 50% { transform: translateY(86px); opacity: 1; } }',
  '.laser-beam { animation: animLaser 1.2s ease-in-out infinite; }',
  '</style>',
  '<rect width="100" height="100" rx="24" fill="#071226" />',
  `<path d="${E_PATH}" fill="#FFFFFF" />`,
  '<rect x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill="#0080FF" />',
  '<rect x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill="#38BDF8" />',
  '<rect class="laser-beam" x="8" y="0" width="84" height="3.5" rx="1.75" fill="#38BDF8" />',
  '</svg>',
].join('');

// 1. Generate all Static & Animated SVG Variants
const appBadgeSvg = buildIconSvg({
  eFill: '#FFFFFF',
  eqTop: '#0080FF',
  eqBot: '#38BDF8',
  boxed: true,
});
const iconDarkSvg = buildIconSvg({
  eFill: '#FFFFFF',
  eqTop: '#0080FF',
  eqBot: '#38BDF8',
  boxed: false,
});
const iconLightSvg = buildIconSvg({
  eFill: '#050914',
  eqTop: '#0080FF',
  eqBot: '#38BDF8',
  boxed: false,
});
const monoWhiteSvg = buildIconSvg({
  eFill: '#FFFFFF',
  eqTop: '#FFFFFF',
  eqBot: '#FFFFFF',
  boxed: false,
});
const monoBlackSvg = buildIconSvg({
  eFill: '#050914',
  eqTop: '#050914',
  eqBot: '#050914',
  boxed: false,
});
const wordmarkDarkSvg = buildWordmarkSvg({
  eFill: '#FFFFFF',
  kwlyStroke: '#93C5FD',
  eqTop: '#0080FF',
  eqBot: '#38BDF8',
});
const wordmarkLightSvg = buildWordmarkSvg({
  eFill: '#050914',
  kwlyStroke: '#0284C7',
  eqTop: '#0080FF',
  eqBot: '#38BDF8',
});
const wordmarkMonoWhiteSvg = buildWordmarkSvg({
  eFill: '#FFFFFF',
  kwlyStroke: '#FFFFFF',
  eqTop: '#FFFFFF',
  eqBot: '#FFFFFF',
});
const wordmarkMonoBlackSvg = buildWordmarkSvg({
  eFill: '#050914',
  kwlyStroke: '#050914',
  eqTop: '#050914',
  eqBot: '#050914',
});

// Write all 12 SVGs to disk
fs.writeFileSync(path.join(rootDir, 'public', 'icon.svg'), appBadgeSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-icon-app-badge.svg'), appBadgeSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-icon-dark.svg'), iconDarkSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-icon-light.svg'), iconLightSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-icon-mono-white.svg'), monoWhiteSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-icon-mono-black.svg'), monoBlackSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-wordmark-dark.svg'), wordmarkDarkSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-wordmark-light.svg'), wordmarkLightSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-wordmark-mono-white.svg'), wordmarkMonoWhiteSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-wordmark-mono-black.svg'), wordmarkMonoBlackSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-loader-lockin.svg'), animatedLockInSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-loader-equalizer.svg'), animatedEqualizerSvg, 'utf8');
fs.writeFileSync(path.join(svgDir, 'ekwly-loader-scan.svg'), animatedScanSvg, 'utf8');

// 2. Build JSON payload for the Browser PNG, Multi-Size .ICO & 3-Animation WebM Exporter
const exportPayload = {
  ePath: E_PATH,
  badgeSvg: appBadgeSvg,
  assets: [
    {
      name: 'icon-192.png',
      label: 'PWA Icon (192x192 -> public/)',
      w: 192,
      h: 192,
      svg: appBadgeSvg,
    },
    {
      name: 'icon-512.png',
      label: 'PWA & Play Store Icon (512x512 -> public/)',
      w: 512,
      h: 512,
      svg: appBadgeSvg,
    },
    {
      name: 'apple-touch-icon.png',
      label: 'iOS Home Screen Icon (180x180 -> public/)',
      w: 180,
      h: 180,
      svg: appBadgeSvg,
    },
    {
      name: 'ekwly-icon-1024.png',
      label: 'Master App Icon (1024x1024)',
      w: 1024,
      h: 1024,
      svg: appBadgeSvg,
    },
    {
      name: 'ekwly-wordmark-dark.png',
      label: 'Wordmark Dark (2124x684 — Full y Descender)',
      w: 2124,
      h: 684,
      svg: wordmarkDarkSvg,
    },
    {
      name: 'ekwly-wordmark-light.png',
      label: 'Wordmark Light (2124x684 — Full y Descender)',
      w: 2124,
      h: 684,
      svg: wordmarkLightSvg,
    },
    {
      name: 'ekwly-mono-white.png',
      label: 'Monochrome White Stamp (1024x1024)',
      w: 1024,
      h: 1024,
      svg: monoWhiteSvg,
    },
    {
      name: 'ekwly-mono-black.png',
      label: 'Monochrome Black Stamp (1024x1024)',
      w: 1024,
      h: 1024,
      svg: monoBlackSvg,
    },
  ],
};

const exporterHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Ekwly Brand Asset Exporter (ICO, PNGs & All 3 Studio Animations)</title>
  <style>
    body { background: #050914; color: #f8fafc; font-family: system-ui, sans-serif; padding: 32px; max-width: 1180px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    h2 { font-size: 1.1rem; color: #38bdf8; margin: 32px 0 12px 0; border-bottom: 1px solid #1e2d44; padding-bottom: 8px; }
    p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px; }
    .hero-bar { background: #0f1724; border: 1px solid #0080ff; border-radius: 16px; padding: 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
    .hero-btns button { width: auto; padding: 12px 20px; font-size: 0.85rem; }
    .btn-emerald { background: #10b981; }
    .btn-emerald:hover { background: #059669; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #0f1724; border: 1px solid #1e2d44; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
    button { width: 100%; padding: 11px 16px; border-radius: 10px; border: none; background: #0080ff; color: #fff; font-weight: 700; cursor: pointer; font-size: 0.82rem; }
    button:hover { background: #0066cc; }
    .tag { font-size: 0.72rem; font-weight: 700; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }
    canvas { max-width: 100%; height: auto; border-radius: 12px; border: 1px dashed #1e2d44; }
  </style>
</head>
<body>
  <h1>Ekwly Brand Identity & PWA Icon Exporter</h1>
  <p>Generate your multi-resolution <code>favicon.ico</code> (16x16, 32x32, 48x48 packed), PWA PNGs, and 60fps animations.</p>

  <div class="hero-bar">
    <div>
      <strong style="font-size: 1rem; color: #fff;">Quick PWA Public Folder Export</strong>
      <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">
        Downloads <code>favicon.ico</code> (16+32+48 packed), <code>icon-192.png</code>, <code>icon-512.png</code>, and <code>apple-touch-icon.png</code> to drop into your <code>public/</code> folder.
      </div>
    </div>
    <div class="hero-btns">
      <button id="btn-ico" class="btn-emerald">Download favicon.ico (16+32+48)</button>
      <button id="btn-all-pwa">Download All 4 public/ Icons</button>
    </div>
  </div>

  <h2>1. Static PNG Logos & Wordmarks</h2>
  <div class="grid" id="export-grid"></div>

  <h2>2. Studio v3 Animated Loaders (Exact Keyframe Physics — 512x512 60fps)</h2>
  <div class="grid" id="anim-grid"></div>

  <script>
    const EXPORT_DATA = __EXPORT_PAYLOAD__;
    const grid = document.getElementById('export-grid');
    const animGrid = document.getElementById('anim-grid');

    // Helper: Render SVG string to a PNG Uint8Array at a given size
    function renderSvgToPngBytes(svgString, size) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          canvas.toBlob(async (pngBlob) => {
            const buf = await pngBlob.arrayBuffer();
            resolve(new Uint8Array(buf));
          }, 'image/png');
        };
        img.src = url;
      });
    }

    // Packs multiple PNG byte arrays (16x16, 32x32, 48x48) into a binary Windows .ICO container
    async function generateMultiSizeFaviconIco() {
      const sizes = [16, 32, 48];
      const pngBuffers = await Promise.all(
        sizes.map((s) => renderSvgToPngBytes(EXPORT_DATA.badgeSvg, s))
      );

      const count = sizes.length;
      const headerSize = 6 + count * 16;
      const totalSize = headerSize + pngBuffers.reduce((acc, b) => acc + b.byteLength, 0);
      const ico = new Uint8Array(totalSize);
      const view = new DataView(ico.buffer);

      // ICONDIR Header (6 bytes)
      view.setUint16(0, 0, true);     // Reserved (0)
      view.setUint16(2, 1, true);     // Type (1 = ICO)
      view.setUint16(4, count, true); // Number of images (3)

      let dataOffset = headerSize;
      for (let i = 0; i < count; i++) {
        const size = sizes[i];
        const png = pngBuffers[i];
        const dirOffset = 6 + i * 16;

        ico[dirOffset + 0] = size === 256 ? 0 : size; // Width
        ico[dirOffset + 1] = size === 256 ? 0 : size; // Height
        ico[dirOffset + 2] = 0;                       // Color palette (0)
        ico[dirOffset + 3] = 0;                       // Reserved (0)
        view.setUint16(dirOffset + 4, 1, true);       // Color planes (1)
        view.setUint16(dirOffset + 6, 32, true);      // Bits per pixel (32-bit RGBA)
        view.setUint32(dirOffset + 8, png.byteLength, true); // Image byte size
        view.setUint32(dirOffset + 12, dataOffset, true);    // Offset to PNG data

        ico.set(png, dataOffset);
        dataOffset += png.byteLength;
      }

      const blob = new Blob([ico], { type: 'image/x-icon' });
      const a = document.createElement('a');
      a.download = 'favicon.ico';
      a.href = URL.createObjectURL(blob);
      a.click();
    }

    document.getElementById('btn-ico').onclick = generateMultiSizeFaviconIco;

    const canvasMap = {};

    // 1. Render Static PNG Cards
    EXPORT_DATA.assets.forEach((asset) => {
      const card = document.createElement('div');
      card.className = 'card';
      const canvas = document.createElement('canvas');
      canvas.width = asset.w;
      canvas.height = asset.h;
      const ctx = canvas.getContext('2d');
      canvasMap[asset.name] = canvas;

      const img = new Image();
      const blob = new Blob([asset.svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        ctx.drawImage(img, 0, 0, asset.w, asset.h);
        URL.revokeObjectURL(url);
      };
      img.src = url;

      const btn = document.createElement('button');
      btn.textContent = 'Download ' + asset.name;
      btn.onclick = () => {
        const a = document.createElement('a');
        a.download = asset.name;
        a.href = canvas.toDataURL('image/png');
        a.click();
      };

      card.innerHTML = '<span class="tag">' + asset.label + '</span>';
      card.appendChild(canvas);
      card.appendChild(btn);
      grid.appendChild(card);
    });

    document.getElementById('btn-all-pwa').onclick = async () => {
      await generateMultiSizeFaviconIco();
      ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].forEach((name, idx) => {
        setTimeout(() => {
          const c = canvasMap[name];
          if (!c) return;
          const a = document.createElement('a');
          a.download = name;
          a.href = c.toDataURL('image/png');
          a.click();
        }, (idx + 1) * 250);
      });
    };

    // 2. Exact Cubic-Bezier & Multi-Keyframe Solver Matching CSS @keyframes in Studio v3
    function cubicBezier(x1, y1, x2, y2, t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let u = t;
      for (let i = 0; i < 6; i++) {
        const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
        const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
        if (Math.abs(dx) < 1e-6) break;
        u -= x / dx;
      }
      return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
    }

    function interpolateKeyframes(keyframes, progress, bezier) {
      for (let i = 0; i < keyframes.length - 1; i++) {
        const k0 = keyframes[i];
        const k1 = keyframes[i + 1];
        if (progress >= k0.p && progress <= k1.p) {
          const span = k1.p - k0.p;
          const localT = span === 0 ? 1 : (progress - k0.p) / span;
          const eased = cubicBezier(bezier[0], bezier[1], bezier[2], bezier[3], localT);
          return {
            tx: k0.tx + (k1.tx - k0.tx) * eased,
            sx: k0.sx + (k1.sx - k0.sx) * eased,
            op: k0.op + (k1.op - k0.op) * eased,
          };
        }
      }
      const last = keyframes[keyframes.length - 1];
      return { tx: last.tx, sx: last.sx, op: last.op };
    }

    const LOCKIN_TOP_KF = [
      { p: 0.00, tx: 26.0, sx: 0.50, op: 0.0 },
      { p: 0.45, tx: -2.5, sx: 1.06, op: 1.0 },
      { p: 0.65, tx: 1.5,  sx: 0.97, op: 1.0 },
      { p: 0.80, tx: 0.0,  sx: 1.00, op: 1.0 },
      { p: 1.00, tx: 0.0,  sx: 1.00, op: 1.0 },
    ];
    const LOCKIN_BOT_KF = [
      { p: 0.00, tx: 26.0, sx: 0.50, op: 0.0 },
      { p: 0.12, tx: 26.0, sx: 0.50, op: 0.0 },
      { p: 0.55, tx: -2.5, sx: 1.06, op: 1.0 },
      { p: 0.75, tx: 1.5,  sx: 0.97, op: 1.0 },
      { p: 0.90, tx: 0.0,  sx: 1.00, op: 1.0 },
      { p: 1.00, tx: 0.0,  sx: 1.00, op: 1.0 },
    ];

    const EQUALIZER_TOP_KF = [
      { p: 0.00, tx: 0.0,  sx: 1.00, op: 1.0 },
      { p: 0.45, tx: 5.0,  sx: 0.72, op: 1.0 },
      { p: 0.80, tx: -1.5, sx: 1.08, op: 1.0 },
      { p: 1.00, tx: 0.0,  sx: 1.00, op: 1.0 },
    ];
    const EQUALIZER_BOT_KF = [
      { p: 0.00, tx: 0.0,  sx: 1.00, op: 1.0 },
      { p: 0.45, tx: -2.0, sx: 1.10, op: 1.0 },
      { p: 0.80, tx: 6.0,  sx: 0.70, op: 1.0 },
      { p: 1.00, tx: 0.0,  sx: 1.00, op: 1.0 },
    ];

    const SCAN_LASER_KF = [
      { p: 0.00, tx: 12.0, sx: 1.0, op: 0.2 },
      { p: 0.50, tx: 86.0, sx: 1.0, op: 1.0 },
      { p: 1.00, tx: 12.0, sx: 1.0, op: 0.2 },
    ];

    const ANIMATIONS = [
      { id: 'lockin', label: '1. Magnetic Lock-In (1.0s)', duration: 1.0, file: 'ekwly-loader-lockin.webm' },
      { id: 'equalizer', label: '2. Counter-Phase Equalizer (1.0s)', duration: 1.0, file: 'ekwly-loader-equalizer.webm' },
      { id: 'scan', label: '3. AI Laser Scan (1.2s)', duration: 1.2, file: 'ekwly-loader-scan.webm' },
    ];

    const ePath2D = new Path2D(EXPORT_DATA.ePath);

    function drawTransformedBar(ctx, yTop, color, state) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, state.op));
      ctx.translate(37.63 + state.tx, yTop + 6.95);
      ctx.scale(state.sx, 1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(0, -6.95, 40.63, 13.90, 6);
      ctx.fill();
      ctx.restore();
    }

    ANIMATIONS.forEach((anim) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<span class="tag">' + anim.label + '</span>';

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      function renderFrame(nowMs) {
        const p = ((nowMs / 1000) % anim.duration) / anim.duration;
        ctx.clearRect(0, 0, 512, 512);
        ctx.save();
        ctx.scale(5.12, 5.12);

        ctx.fillStyle = '#071226';
        ctx.beginPath();
        ctx.roundRect(0, 0, 100, 100, 24);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fill(ePath2D);

        if (anim.id === 'lockin') {
          const topSt = interpolateKeyframes(LOCKIN_TOP_KF, p, [0.22, 1, 0.36, 1]);
          const botSt = interpolateKeyframes(LOCKIN_BOT_KF, p, [0.22, 1, 0.36, 1]);
          drawTransformedBar(ctx, 25.15, '#0080FF', topSt);
          drawTransformedBar(ctx, 60.95, '#38BDF8', botSt);
        } else if (anim.id === 'equalizer') {
          const topSt = interpolateKeyframes(EQUALIZER_TOP_KF, p, [0.45, 0, 0.55, 1]);
          const botSt = interpolateKeyframes(EQUALIZER_BOT_KF, p, [0.45, 0, 0.55, 1]);
          drawTransformedBar(ctx, 25.15, '#0080FF', topSt);
          drawTransformedBar(ctx, 60.95, '#38BDF8', botSt);
        } else if (anim.id === 'scan') {
          drawTransformedBar(ctx, 25.15, '#0080FF', { tx: 0, sx: 1, op: 1 });
          drawTransformedBar(ctx, 60.95, '#38BDF8', { tx: 0, sx: 1, op: 1 });
          const laserSt = interpolateKeyframes(SCAN_LASER_KF, p, [0.42, 0, 0.58, 1]);
          ctx.save();
          ctx.globalAlpha = laserSt.op;
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.roundRect(8, laserSt.tx, 84, 3.5, 1.75);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();
        requestAnimationFrame(renderFrame);
      }
      requestAnimationFrame(renderFrame);

      const recBtn = document.createElement('button');
      recBtn.textContent = 'Record ' + anim.file + ' (2 Cycles)';
      recBtn.onclick = () => {
        const stream = canvas.captureStream(60);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const a = document.createElement('a');
          a.download = anim.file;
          a.href = URL.createObjectURL(blob);
          a.click();
          recBtn.textContent = 'Record ' + anim.file + ' (2 Cycles)';
        };
        recBtn.textContent = 'Recording 60fps loop...';
        recorder.start();
        setTimeout(() => recorder.stop(), anim.duration * 2000);
      };

      card.appendChild(canvas);
      card.appendChild(recBtn);
      animGrid.appendChild(card);
    });
  </script>
</body>
</html>`.replace('__EXPORT_PAYLOAD__', JSON.stringify(exportPayload));

fs.writeFileSync(path.join(rootDir, 'brand-kit', 'export-png-and-gif.html'), exporterHtml, 'utf8');
console.log('✅ Generated 13 SVG brand files (including all 3 animations & unclipped wordmarks)');
console.log(
  '✅ Generated ICO + PNG + 3-Animation WebM exporter at brand-kit/export-png-and-gif.html'
);
