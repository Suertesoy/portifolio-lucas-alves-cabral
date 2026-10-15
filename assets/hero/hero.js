// Home hero — B2 Optical Crystal clover between LUCAS / CABRAL (checkpoint 10: local integration of the approved
// lab, assets/identity/explorations/hero-b2/, checkpoints 09–09C).
// Approved configuration: composition "Justa", clover at 150 % (capped on small screens), optics 0.3, base pose
// yaw −56° / pitch 20° / spin 30° (the 09C print pose, refined in checkpoint 11), motion orbiting that pose (never frontal).
// The name is painted on a plate inside WebGL so the glass really refracts it; the h1 carries it for assistive tech
// and becomes the visible name without WebGL. Everything else in the panel (status, intro, CTAs) is DOM.
// Checkpoint 12: the plate also carries the Living Grid (living-grid.js) — modular grid, cursor light and orthogonal
// trails painted in the plate's shader, so the glass refracts them. If it cannot start, the plate falls back to the
// checkpoint-11 column grid.
// Query (evaluation only): nogl=1 (simulate no WebGL)  gov=0 (no adaptive quality)  pose=yaw,pitch,spin (degrees)
//   hbposter=1 renders the clover alone on white, centred, still: source of data/poster.png (no-WebGL fallback)
//   lg=0 (checkpoint-11 plate, no Living Grid)  lgfail=1 (force the Living Grid shader to fail → automatic fallback)
//   lgguides=1 (keep the type guides under the Living Grid)  fields=raw (load the unpacked 3 MB fields, for A/B)
// Checkpoint 15 (approved and shipped in 15C): kinetic.js — the kinetic field (cursor impulse + tangential torque) and
//   the scroll choreography from the hero to the portrait — is the default behaviour (EXP is on unless hbposter=1).
//   Evaluation only: off=impulse,torque,scroll,travel,reveal (disable parts)  rm=1 (simulated reduced motion)
//   cfg={...} (lab parameters). The lab panel (lab=1, dbg=1: kinetic-lab.js) is a local tool: it loads only on a local
//   host and is not part of the published site.
import * as THREE from 'three';
import * as KINETIC from './kinetic.js';
import { pmremEnvironment, normalMapFrom } from './lib/studio.js';
import { buildCloverGeometry, thicknessTexture, fetchRetry, PROFILE } from './lib/clover-geometry.js';
import { shadowTexture } from './lib/materials.js';
import { createOpticalGlass } from './optical-glass.js';
import { createLivingGrid } from './living-grid.js';
import { unpackDeltaPlanes, gunzip } from './lib/field-pack.js';

const q = new URLSearchParams(location.search);
const DATA = new URL('./data/', import.meta.url).href;
const panel = document.getElementById('hb'), canvas = document.getElementById('hb-canvas');
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hero = window.__hero = { status: 'loading', stats: {} };
const status = s => { hero.status = s; };
const POSTER = q.get('hbposter') === '1';
const EXP = !POSTER;   // ck15C: the kinetic hero is the default (the poster render keeps the still clover)
let KX = null, KXF = null, kx = null;   // ck15 module, its flags, the running experiment (EXP only)
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);   // the lab never loads on the public site

// ---------------------------------------------------------------- approved configuration
const CONFIG = { gap: 0.14, reach: 0.68, scale: 1.5, lens: 0.3, sage: 0.45 };
// 09C approved pose (yaw −60° / pitch 16° / spin 28°), refined in checkpoint 11 — see HERO_POSE
const HERO_POSE = { yaw: -56 * DEG, pitch: 20 * DEG, spin: 30 * DEG };   // ck11: 09C −60/16/28 → −56/20/30 (four leaves read more distinctly, hub visible; face-to-view 61° → 58°)
const POSE = (() => {
  const v = (q.get('pose') || '').split(',').map(Number);
  return v.length === 3 && v.every(Number.isFinite) ? { yaw: v[0] * DEG, pitch: v[1] * DEG, spin: v[2] * DEG } : { ...HERO_POSE };
})();
const MOTION = {
  base: POSE,
  yawBand: [34 * DEG, 70 * DEG],   // |yaw| stays here except during a drag: never frontal (flat), never edge-on
  idle: { pitch: 2.5 * DEG, yaw: 5 * DEG, spin: 5 * DEG, pitchT: 11, yawT: 15, spinT: 19, floatPx: 5, floatT: 7.5 },
  hover: { yawGain: 1.3, pitch: 9 * DEG, twist: 11 * DEG, smooth: 0.32, parallaxPx: [10, 6] },
  wobble: { freq: 1.1, zeta: 0.6, gain: 3.2, max: 6 * DEG },
  drag: { turnPx: [520, 1150], vMax: 3.2 * Math.PI, pitchMax: 60 * DEG, w0: 4.4, zeta: 0.86, coast: 1.4 },
  reduced: { yawMax: 45 * DEG, pitchMax: 25 * DEG, back: 0.28 },
  scrollMax: 6 * DEG,
};
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => mqReduce.matches || !!(KXF && KXF.rm);

// ---------------------------------------------------------------- layout (panel CSS px)
const R_MAX = 0.538;   // circumscribed radius / bbox height of the clover
const CAP = 0.727;     // Inter Tight cap height / em
const NAME = { weight: 700, tracking: -0.05, lines: ['LUCAS', 'CABRAL'] };
const mctx = document.createElement('canvas').getContext('2d');
const hasLS = 'letterSpacing' in mctx;
function textWidth(g, t, size) {
  g.font = `${NAME.weight} ${size}px "Inter Tight"`;
  if (hasLS) { g.letterSpacing = `${NAME.tracking * size}px`; const w = g.measureText(t).width; g.letterSpacing = '0px'; return w - NAME.tracking * size; }
  let w = 0; for (const ch of t) w += g.measureText(ch).width + NAME.tracking * size; return w - NAME.tracking * size;
}
function drawText(g, t, x, y, size) {
  g.font = `${NAME.weight} ${size}px "Inter Tight"`;
  if (hasLS) { g.letterSpacing = `${NAME.tracking * size}px`; g.fillText(t, x, y); g.letterSpacing = '0px'; return; }
  for (const ch of t) { g.fillText(ch, x, y); x += g.measureText(ch).width + NAME.tracking * size; }
}
function measure() {   // the name lives between the top row and the intro/CTA block, inside the page's column grid
  const pr = panel.getBoundingClientRect(), topEl = panel.querySelector('.hb-top'), top = topEl.getBoundingClientRect(), bottom = panel.querySelector('.hb-bottom').getBoundingClientRect();
  const cs = getComputedStyle(topEl), pg = document.querySelector('.page-grid .wrap'), root = getComputedStyle(document.documentElement);
  const grid = { left: top.left - pr.left + parseFloat(cs.paddingLeft), right: top.right - pr.left - parseFloat(cs.paddingRight),
    gutter: pg ? parseFloat(getComputedStyle(pg).columnGap) || 24 : 24, cols: parseInt(root.getPropertyValue('--cols')) || 12 };
  return { W: pr.width, H: pr.height, zoneTop: top.bottom - pr.top + 14, zoneBottom: bottom.top - pr.top - 14, grid };
}
function computeLayout({ W, H, zoneTop, zoneBottom, grid }) {
  const kw = NAME.lines.map(t => textWidth(mctx, t, 100) / 100), k = Math.max(...kw);
  const wide = W >= 820, padX = grid.left, cw = grid.right - grid.left;
  const font = Math.max(24, Math.min(cw * (wide ? 0.92 : 1) / k, (zoneBottom - zoneTop) / (2 * CAP + CONFIG.gap)));
  const cap = CAP * font, gap = CONFIG.gap * font, blockH = 2 * cap + gap;
  const top = zoneTop + Math.max(0, zoneBottom - zoneTop - blockH) * 0.5;
  const b1 = top + cap, cap2 = b1 + gap, b2 = cap2 + cap, cy = (b1 + cap2) / 2;
  const lines = NAME.lines.map((t, i) => { const w = kw[i] * font; return { t, x: (W - w) / 2, w, baseline: i ? b2 : b1, capTop: (i ? b2 : b1) - cap }; });
  const RBase = gap / 2 + CONFIG.reach * cap;
  // the circumscribed circle (so a turning clover never clips) stays inside the panel; on narrow screens it also
  // stays clear of the intro block and ≤ 0.42 W so most of each word remains outside the glass
  const Rcap = wide ? Math.min(cw / 2, cy - zoneTop + 30, zoneBottom - cy + 30) : Math.min(0.42 * W, cy - zoneTop + 44, zoneBottom - cy + 44);
  const R = Math.max(RBase, Math.min(RBase * CONFIG.scale, Rcap));
  return { W, H, wide, font, cap, gap, lines, guides: [lines[0].capTop, b1, cap2, b2], padX, padR: grid.right, cols: grid.cols, gutter: grid.gutter,
    s: wide ? W / 1140 : W / 360, clover: { cx: W / 2, cy, R, h: R / R_MAX, RBase, hBase: RBase / R_MAX, scale: R / RBase } };
}

// ---------------------------------------------------------------- plate
// Inverse of three.js NeutralToneMapping (r170): the plate is painted in final page colours, pre-distorted so it
// lands on them after the renderer's tone curve (same pipeline as the light seen through the glass).
function inverseNeutral(r8, g8, b8) {
  const toLin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const toSrgb = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
  const START = 0.76, DD = 0.24, DESAT = 0.15;
  let c = [toLin(r8 / 255), toLin(g8 / 255), toLin(b8 / 255)];
  const np = Math.min(0.999, Math.max(...c));
  if (np >= START) { const peak = DD * DD / (1 - np) - DD + START, gm = 1 - 1 / (DESAT * (peak - np) + 1); c = c.map(v => ((v - gm * np) / (1 - gm)) * peak / np); }
  const mn = Math.min(...c), x = mn < 0.04 ? Math.sqrt(Math.max(0, mn) / 6.25) : mn + 0.04, off = x - mn;
  return c.map(v => Math.round(255 * clamp(toSrgb(v + off), 0, 1)));
}
const invCache = new Map();
function inverseToneMapCanvas(cv) {
  const g = cv.getContext('2d'), img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let v = invCache.get(key); if (!v) { v = inverseNeutral(d[i], d[i + 1], d[i + 2]); invCache.set(key, v); }
    d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2];
  }
  g.putImageData(img, 0, 0);
}
const css = () => {
  const p = getComputedStyle(panel), root = getComputedStyle(document.documentElement);
  return { bg: p.backgroundColor, ink: root.getPropertyValue('--ink').trim() || '#0C1B10' };
};
const plateCanvas = document.createElement('canvas');
function paintPlate(L, dpr, { columns = true, guides = true, inverse = true } = {}) {   // columns off: the Living Grid paints them
  const { W, H } = L, col = css();
  plateCanvas.width = Math.min(4096, Math.round(W * dpr)); plateCanvas.height = Math.min(4096, Math.round(H * dpr));
  const g = plateCanvas.getContext('2d', { willReadFrequently: true });
  g.setTransform(plateCanvas.width / W, 0, 0, plateCanvas.height / H, 0, 0);
  g.fillStyle = POSTER ? '#FFFFFF' : col.bg; g.fillRect(0, 0, W, H);
  if (POSTER) { g.setTransform(1, 0, 0, 1, 0, 0); return; }   // white is neutral under mix-blend-mode: multiply
  // editorial column grid + type guides, extremely subtle (the glass bends them too)
  g.strokeStyle = 'rgba(29,32,30,0.055)';   // = --line-soft g.lineWidth = 1;
  const colW = (L.padR - L.padX - (L.cols - 1) * L.gutter) / L.cols;
  if (columns) for (let i = 0; i < L.cols; i++) for (const x0 of [L.padX + i * (colW + L.gutter), L.padX + i * (colW + L.gutter) + colW - 1]) {
    const x = Math.round(x0) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  if (guides) for (const y of L.guides) { g.beginPath(); g.moveTo(L.padX, Math.round(y) + 0.5); g.lineTo(L.padR, Math.round(y) + 0.5); g.stroke(); }
  g.fillStyle = col.ink;
  for (const l of L.lines) drawText(g, l.t, l.x, l.baseline, L.font);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (inverse) inverseToneMapCanvas(plateCanvas);   // the Living Grid shader does this per pass instead
}

// ---------------------------------------------------------------- motion primitives
class Spring {   // critically damped smoothing (SmoothDamp)
  constructor(v = 0) { this.v = v; this.vel = 0; }
  step(target, smoothTime, dt) {
    const o = 2 / smoothTime, x = o * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const ch = this.v - target, tmp = (this.vel + o * ch) * dt;
    this.vel = (this.vel - o * tmp) * e; this.v = target + (ch + tmp) * e;
    return this.v;
  }
  snap(v) { this.v = v; this.vel = 0; }
  resting(target, eps = 1e-4) { return Math.abs(this.v - target) < eps && Math.abs(this.vel) < eps; }
}
class Osc {      // under-damped oscillator around 0 (the small settle after a quick cursor gesture)
  constructor(freq, zeta) { this.w = TAU * freq; this.z = zeta; this.x = 0; this.v = 0; }
  kick(dv, max) { this.v = clamp(this.v + dv, -max * this.w, max * this.w); }
  step(dt) { this.v += (-this.w * this.w * this.x - 2 * this.z * this.w * this.v) * dt; this.x += this.v * dt; }
  rest() { return Math.abs(this.x) < 1e-4 && Math.abs(this.v) < 1e-3; }
  reset() { this.x = this.v = 0; }
}

// ---------------------------------------------------------------- boot
const gl2 = (() => { if (q.get('nogl') === '1') return false; try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

async function main() {
  await Promise.all([document.fonts.load('700 100px "Inter Tight"'), document.fonts.ready]);
  if (!gl2) return fallback('no-webgl2');
  if (EXP) { KX = KINETIC; KXF = KX.readFlags(q); }
  try { (await initScene()).start(); } catch (e) { console.error(e); fallback('init-error: ' + e.message); }
}

// No WebGL (or a lost context): the h1 becomes the visible name and the clover a pre-rendered still.
function fallback(reason) {
  hero.stats.fallback = reason;
  if (kx) kx.off();
  panel.classList.add('hb-no-webgl');
  const place = () => {
    const L = computeLayout(measure()), c = L.clover;
    L.lines.forEach((l, i) => Object.assign(document.getElementById(`hb-name-${i + 1}`).style,
      { left: l.x + 'px', top: l.baseline - 0.97 * L.font + 'px', fontSize: L.font + 'px' }));
    const p = document.getElementById('hb-poster'), size = c.h / 0.86;   // the still frames the clover at 86 % of its height
    Object.assign(p.style, { width: size + 'px', height: size + 'px', left: c.cx - size / 2 + 'px', top: c.cy - size / 2 + 'px' });
    // the Living Grid's modular grid as a still CSS surface (home.css .hb-no-webgl::before/::after)
    const field = (L.padR - L.padX - (L.cols - 1) * L.gutter) / L.cols, P = field + L.gutter, a0 = c.cy + L.gutter / 2;
    for (const [k, v] of Object.entries({ x0: L.padX, x1: L.padR, field, gut: L.gutter, ay: ((a0 % P) + P) % P, cy: c.cy })) panel.style.setProperty('--lg-' + k, v + 'px');
    hero.stats.layout = { font: Math.round(L.font), cloverR: Math.round(c.R) };
  };
  place();
  new ResizeObserver(place).observe(panel);
  status('done');
}

async function loadI16(name, W) {   // Int16 fields (distance in px × 64), see tools/export in checkpoint 10
  // ck14: the packed field (lossless, ~10× smaller: 6 MB → 0.6 MB for both); the raw .i16 only without DecompressionStream
  let i16 = null;
  if (typeof DecompressionStream === 'function' && q.get('fields') !== 'raw') {   // fields=raw: evaluation only
    try { i16 = unpackDeltaPlanes(await gunzip(await (await fetchRetry(DATA + name + '.i16d.gz')).arrayBuffer()), W); }
    catch (e) { console.warn('hero: packed field unavailable, loading raw', e.message); }
  }
  const packed = !!i16 && i16.length === W * W;
  if (!packed) i16 = new Int16Array(await (await fetchRetry(DATA + name + '.i16')).arrayBuffer());
  hero.stats.fields = (hero.stats.fields || []).concat(`${name}:${packed ? 'packed' : 'raw'}`);
  const data = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) data[i] = i16[i] / 64;
  return { data, W, H: W };
}
async function loadClover(cell) {
  const PX = 1254;
  const [sdf, dome] = await Promise.all([loadI16('clover-sdf', PX), loadI16('clover-dome', PX)]);
  const profile = { ...PROFILE, cell, domeHeight: 40, domeFalloff: 200 };   // B2 lens profile (checkpoint 09)
  const geo = buildCloverGeometry(sdf, profile, dome);
  let veinNormal;
  for (let i = 0; ; i++) try { veinNormal = await normalMapFrom(DATA + 'clover-veins-ridge.png', 3); break; } catch (e) { if (i >= 2) throw new Error('vein map failed to load'); }
  const { tex: thickness } = thicknessTexture(sdf, profile, 512, dome);
  return { sdf, geo, tex: { veinNormal, thickness }, heightWorld: (1090 - 163 + 1) * 2 / PX };
}

async function initScene() {
  const clover = await loadClover(3);
  const glass = createOpticalGlass(clover.tex, { lens: CONFIG.lens, sage: CONFIG.sage });
  // EXP: a transparent canvas — below the hero it only carries the clover over the page
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', ...(EXP ? { alpha: true } : {}) });
  if (EXP) renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('context-lost'); });

  const FOV = 22, D = 1 / Math.tan(FOV / 2 * DEG);   // frame height = 2 world units at z = 0
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, D);
  const PLATE_Z = -0.6, K = (D - PLATE_Z) / D;
  glass.set.plateZ(PLATE_Z);

  const scene = new THREE.Scene();
  scene.environment = pmremEnvironment(renderer);
  const key = new THREE.DirectionalLight('#fff6e8', 1.6); key.position.set(4, 5, 4); scene.add(key);
  const plateTex = new THREE.CanvasTexture(plateCanvas); plateTex.colorSpace = THREE.SRGBColorSpace; plateTex.anisotropy = 4;
  const plainPlate = new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: !POSTER });
  // Living Grid: a patched plate material + its controller; any failure leaves the checkpoint-11 plate
  let grid = null;
  if (!POSTER && q.get('lg') !== '0') {
    try { grid = createLivingGrid(plateTex, { fail: q.get('lgfail') === '1' }); }
    catch (e) { console.warn('living grid off:', e.message); hero.stats.grid = { on: false, reason: e.message }; }
  } else hero.stats.grid = { on: false, reason: POSTER ? 'poster' : 'lg=0' };
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), grid ? grid.material : plainPlate);
  plate.position.z = PLATE_Z; scene.add(plate);
  const plateLook = () => ({ columns: !grid, guides: !grid || q.get('lgguides') === '1', inverse: !grid });
  function dropGrid(reason) {   // shader did not compile (or similar): back to the plain plate, same frame budget as before
    if (!grid) return;
    grid = null; plate.material = plainPlate; hero.stats.grid = { on: false, reason };
    if (L) { paintPlate(L, Math.min(2, window.devicePixelRatio || 1), plateLook()); plateTex.needsUpdate = true; requestRender(); }
  }
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    // the plate compiles twice (main pass + transmission pass): any Living Grid program failing → drop it, quietly
    if (/LIVING_GRID/.test(gl.getShaderSource(fs) || '')) { console.warn('living grid off: shader did not compile'); return dropGrid('shader-error'); }
    console.error('THREE.WebGLProgram: Shader Error', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
  };
  const group = new THREE.Group();
  group.add(new THREE.Mesh(clover.geo, glass.mat)); scene.add(group);
  // planar-projected contact shadow, following the real 3D orientation
  const LX = -0.09, LY = 0.125, Z0 = PLATE_Z + 0.002;
  const PROJ = new THREE.Matrix4().set(1, 0, -LX, LX * Z0, 0, 1, -LY, LY * Z0, 0, 0, 0, Z0, 0, 0, 0, 1);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({
    map: shadowTexture(clover.sdf, { strength: 0.5, caustic: 0.07 }), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 }));
  shadow.matrixAutoUpdate = false; shadow.renderOrder = -1; scene.add(shadow);

  // ck15 experiment: kinetic field + scroll choreography; the hero's input moves to its own layer (the canvas now
  // also covers the portrait and must not take its clicks)
  const field = EXP ? KX.createKineticField() : null;
  if (EXP) kx = KX.createExperiment({ renderer, scene, camera, group, plate, shadow, glass, panel, canvas, clover, PLATE_Z, K, D, R_MAX, flags: KXF, reduced, lens: CONFIG.lens });
  const input = EXP ? KX.inputLayer(panel, canvas) : canvas;
  let lab = null;   // ck15 evaluation panel / gesture overlay (lab=1, dbg=1)
  if (EXP && LOCAL && (KXF.lab || KXF.dbg)) import('./kinetic-lab.js').catch(() => null).then(m => m && m.createLab && (lab = m.createLab({ flags: KXF, field, kx, panel, onChange: k => { if (k === 'reveal') kx.repaint(); requestRender(); } })));

  // ---------------------------------------------------------- layout
  let L, PXW = 0.001;
  const toWorld = (x, y) => [(x - L.W / 2) * PXW, -(y - L.H / 2) * PXW];
  function layout() {
    L = computeLayout(measure());
    if (POSTER) { const m = Math.min(L.W, L.H) * 0.86; Object.assign(L.clover, { cx: L.W / 2, cy: L.H / 2, h: m, hBase: m / L.clover.scale }); }
    const { W, H } = L;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    PXW = 2 / H;
    plate.scale.set(2 * K * W / H, 2 * K, 1);
    const pw = plateCanvas.width, ph = plateCanvas.height;
    paintPlate(L, Math.min(2, window.devicePixelRatio || 1), plateLook());
    if (plateCanvas.width !== pw || plateCanvas.height !== ph) plateTex.dispose();   // ck15C: new size → new GPU storage (was a GL_INVALID_VALUE on resize)
    plateTex.needsUpdate = true;
    const pr = panel.getBoundingClientRect();
    // reading zones over the plate (DOM text): the grid's light and trails step aside there
    const top0 = pr.top + window.scrollY;   // the nav is fixed: map it onto the panel as seen at the top of the page
    const occ = [...panel.querySelectorAll('.hb-top > .micro, .hb-intro, .hb-fig, .hb-ctas'), document.querySelector('.nav-row')].filter(Boolean)
      .map(el => [el.getBoundingClientRect(), el.closest('.nav') ? top0 : pr.top]).filter(([r]) => r.width && r.height)
      .map(([r, y0]) => [r.left - pr.left, r.top - y0, r.right - pr.left, r.bottom - y0]);
    if (grid) grid.layout(L, occ, renderer.getPixelRatio());
    if (kx) kx.layout(L, PXW, toWorld);
    hero.stats.layout = { font: Math.round(L.font), cloverR: Math.round(L.clover.R), cloverScale: +L.clover.scale.toFixed(2),
      clover: [Math.round(L.clover.cx), Math.round(L.clover.cy)], cloverPage: [Math.round(pr.left + L.clover.cx), Math.round(pr.top + scrollY + L.clover.cy)],
      lines: L.lines.map(l => ({ t: l.t, x: Math.round(l.x), w: Math.round(l.w), capTop: Math.round(l.capTop), baseline: Math.round(l.baseline) })) };
    requestRender();
  }

  // ---------------------------------------------------------- motion state
  const pos = { x: new Spring(), y: new Spring(), h: new Spring(), hb: new Spring() };   // hb: unscaled size (optics)
  const hover = { x: new Spring(), y: new Spring(), z: new Spring(), tx: 0, ty: 0 };      // Δyaw, Δpitch, twist
  const wob = { yaw: new Osc(MOTION.wobble.freq, MOTION.wobble.zeta), pitch: new Osc(MOTION.wobble.freq, MOTION.wobble.zeta) };
  const user = { yaw: 0, pitch: 0, pitchRaw: 0, vy: 0, vp: 0, dragging: false, back: { yaw: new Spring(), pitch: new Spring() } };
  const scrollP = new Spring();
  let t = 0, scrollKick = 0, placedOnce = false, flips = 0;
  const qRest = new THREE.Quaternion(), qUser = new THREE.Quaternion(), eRest = new THREE.Euler(), eUser = new THREE.Euler(0, 0, 0, 'YXZ');
  hero.api = { flick: v => { if (!reduced()) { user.vy = clamp(v, -MOTION.drag.vMax, MOTION.drag.vMax); requestRender(); } } };

  // ---------------------------------------------------------- input
  const cloverScreen = () => ({ x: pos.x.v, y: pos.y.v, R: pos.h.v * R_MAX });
  const turnPx = () => clamp(0.8 * L.W, ...MOTION.drag.turnPx);
  const hintUsed = () => panel.classList.add('hb-hint-used');
  let lastMove = null, drag = null;
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;   // hover orientation is a mouse affordance
    const r = panel.getBoundingClientRect();
    const inside = e.clientY >= r.top && e.clientY <= r.bottom;   // the whole width counts (margins included), as in the lab
    const x = e.clientX - r.left, y = e.clientY - r.top, c = cloverScreen();
    if (!drag) input.classList.toggle('grab', inside && Math.hypot(x - c.x, y - c.y) < c.R * 1.15);
    if (!inside) { if (grid) grid.leave(); if (field) field.leave(); if (hover.tx || hover.ty) { hover.tx = hover.ty = 0; lastMove = null; requestRender(); } return; }
    if (grid && !reduced()) grid.pointer(x, y, 'mouse');   // one gesture, two responses: the clover turns, the grid lights up
    hover.tx = (x - c.x) / (0.5 * L.W); hover.ty = (y - c.y) / (0.5 * L.H);
    const now = performance.now();
    // ck15 kinetic field: read only at the top of the page, never during a drag; links/buttons/nav are not gestures
    const nearField = field && Math.hypot(x - c.x, y - c.y) < c.R * 2.15;
    if (field && !reduced() && !user.dragging && kx.st.p < 0.02) {
      field.pointer(x, y, now, c, { blocked: !!(e.target && e.target.closest && e.target.closest('a, button, .nav, .kx-lab')),
        normalSign: Math.sign(nrm.set(0, 0, 1).applyQuaternion(group.quaternion).z) || 1, impulse: KXF.impulse, torque: KXF.torque });
    }
    if (lastMove && !user.dragging && !reduced() && !nearField) {   // quick gestures leave a small damped settle (glass has mass)
      const dt = Math.max(8, now - lastMove.t) / 1000, W = MOTION.wobble;
      wob.yaw.kick((x - lastMove.x) / L.W / dt * W.gain * 0.016, W.max);
      wob.pitch.kick((y - lastMove.y) / L.H / dt * W.gain * 0.016, W.max);
    }
    lastMove = { x, y, t: now };
    requestRender();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { if (grid) grid.leave(); hover.tx = hover.ty = 0; lastMove = null; requestRender(); });
  // touch / pen on the hero: the light follows the finger (vertical swipes still scroll: pointercancel ends it)
  const gridTouch = (e, down) => {
    if (!grid || e.pointerType === 'mouse' || reduced()) return;
    const r = panel.getBoundingClientRect(); grid.pointer(e.clientX - r.left, e.clientY - r.top, 'touch', down); requestRender();
  };
  input.addEventListener('pointerdown', e => gridTouch(e, true));
  input.addEventListener('pointermove', e => gridTouch(e, false));
  for (const ev of ['pointerup', 'pointercancel']) input.addEventListener(ev, e => { if (grid && e.pointerType !== 'mouse') { grid.leave(); requestRender(); } });

  // drag: mouse starts on the clover; touch starts anywhere on the hero but only claims horizontal gestures
  // (the canvas has touch-action: pan-y, so vertical swipes keep scrolling the page)
  input.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (kx && kx.st.p > 0.02) return;   // ck15: the scroll timeline owns the clover once the page has moved
    const r = panel.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, c = cloverScreen(), mouse = e.pointerType === 'mouse';
    if (mouse && Math.hypot(x - c.x, y - c.y) > c.R * 1.15) return;
    drag = { id: e.pointerId, mouse, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, samples: [] };
    if (mouse) { e.preventDefault(); begin(e); }
  });
  function begin(e) {
    drag.active = true; user.dragging = true; user.vy = user.vp = 0; user.pitchRaw = user.pitch;
    if (field) field.kill();   // grabbing the glass stops its spin
    try { input.setPointerCapture(e.pointerId); } catch {}
    input.classList.add('grabbing'); hintUsed(); requestRender();
  }
  input.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      const tx = e.clientX - drag.x0, ty = e.clientY - drag.y0;
      if (Math.abs(tx) > 8 && Math.abs(tx) > Math.abs(ty) * 1.2) begin(e);
      else { if (Math.abs(ty) > 12) drag = null; return; }
    }
    const k = TAU / turnPx(), dx = e.clientX - drag.x, dy = drag.mouse ? e.clientY - drag.y : 0;
    drag.x = e.clientX; drag.y = e.clientY;
    if (reduced()) {   // direct manipulation only, within a small range
      const R = MOTION.reduced;
      user.yaw = clamp(user.yaw + dx * k * 0.5, -R.yawMax, R.yawMax);
      user.pitch = clamp(user.pitch + dy * k * 0.5, -R.pitchMax, R.pitchMax);
    } else {
      user.yaw += dx * k;
      user.pitchRaw += dy * k;
      user.pitch = MOTION.drag.pitchMax * Math.tanh(user.pitchRaw / MOTION.drag.pitchMax);   // rubber band
    }
    const now = performance.now();
    drag.samples.push({ t: now, yaw: user.yaw, pitch: user.pitch });
    while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
    requestRender();
  });
  function release(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (drag.active) {
      const s = drag.samples, a = s[0], b = s[s.length - 1], now = performance.now();
      const dt = a && b && b.t > a.t ? (b.t - a.t) / 1000 : 0, fresh = b && now - b.t < 60;   // a drag that stopped before release does not fling
      user.vy = !reduced() && dt && fresh ? clamp((b.yaw - a.yaw) / dt, -MOTION.drag.vMax, MOTION.drag.vMax) : 0;
      user.vp = !reduced() && dt && fresh ? clamp((b.pitch - a.pitch) / dt, -MOTION.drag.vMax / 2, MOTION.drag.vMax / 2) : 0;
      user.back.yaw.snap(user.yaw); user.back.pitch.snap(user.pitch);
      user.dragging = false;
      input.classList.remove('grabbing');
    }
    drag = null; requestRender();
  }
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) input.addEventListener(ev, release);
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastY; lastY = window.scrollY;
    if (kx) { if (!reduced() && inView && grid) grid.scroll(dy); requestRender(); return; }   // ck15: the timeline replaces the scroll tilt
    if (!reduced() && inView) { scrollKick = clamp(scrollKick - dy * 0.0012, -MOTION.scrollMax, MOTION.scrollMax); if (grid) grid.scroll(dy); requestRender(); }
  }, { passive: true });

  // ---------------------------------------------------------- loop (renders only while the hero is visible)
  let raf = 0, last = 0, inView = true, staticMode = false;
  const perf = { frames: 0, since: 0, fps: 0, intervals: [], govFrames: 0, total: 0 };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; requestRender(); }).observe(panel);
  document.addEventListener('visibilitychange', () => { last = 0; requestRender(); });
  mqReduce.addEventListener('change', requestRender);

  const idling = () => !reduced() && !staticMode && !POSTER;
  const hoverTarget = () => {
    if (reduced() || user.dragging || staticMode) return { x: 0, y: 0, z: 0 };
    const H = MOTION.hover, b = MOTION.base.yaw, sg = Math.sign(b) || 1, k = Math.tanh(H.yawGain * hover.tx);
    const toFront = Math.max(0, Math.abs(b) - MOTION.yawBand[0]), toEdge = Math.max(0, MOTION.yawBand[1] - Math.abs(b));
    return { x: k * (k * sg < 0 ? toFront : toEdge), y: H.pitch * Math.tanh(1.3 * hover.ty), z: H.twist * Math.tanh(1.2 * hover.tx) };
  };
  function settling() {
    const c = L.clover, ht = hoverTarget();
    return user.dragging || !pos.x.resting(c.cx, 0.05) || !pos.y.resting(c.cy, 0.05) || !pos.h.resting(c.h, 0.05)
      || Math.abs(user.yaw) > 1e-4 || Math.abs(user.pitch) > 1e-4 || Math.abs(user.vy) > 1e-4 || Math.abs(user.vp) > 1e-4
      || !wob.yaw.rest() || !wob.pitch.rest() || !hover.x.resting(ht.x, 1e-4) || !hover.y.resting(ht.y, 1e-4) || !hover.z.resting(ht.z, 1e-4)
      || Math.abs(scrollP.v) > 1e-4 || Math.abs(scrollKick) > 1e-4 || (grid && grid.busy()) || (field && !field.resting());
  }
  const visible = () => inView || !!(kx && kx.wants());   // ck15: the clover can be on screen below the hero
  function requestRender() { if (L && !raf && visible() && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    update(dt);
    renderer.render(scene, camera);
    if (lab) lab.draw(cloverScreen());
    meter(now, dt);
    const keep = (idling() || settling()) && visible() && !document.hidden;
    if (keep) raf = requestAnimationFrame(frame); else { last = 0; meter(now, dt, true); }
    if (!panel.classList.contains('hb-ready')) { panel.classList.add('hb-ready'); status('done'); }
  }

  const nrm = new THREE.Vector3();
  const fieldStats = () => field && { omega: +field.omega.toFixed(3), angleDeg: +field.angleDeg.toFixed(1), spinRate: +field.spinRate.toFixed(3), phiDeg: +(field.phi / DEG).toFixed(2),
    turnedDeg: Math.round(field.log.turnedDeg), spunDeg: Math.round(field.log.spunDeg), impulses: field.log.impulses, torqueSamples: field.log.torqueSamples, last: field.log.last, lastTorque: field.log.lastTorque, resting: field.resting() };
  const flatness = () => Math.acos(Math.min(1, Math.abs(nrm.set(0, 0, 1).applyQuaternion(group.quaternion).z))) / DEG;
  const smoothBand = x => (x <= 0.15 ? 0.15 * Math.exp((x - 0.15) / 0.15) : x >= 0.85 ? 1 - 0.15 * Math.exp((0.85 - x) / 0.15) : x);
  const wrapPi = a => a - Math.round(a / TAU) * TAU;
  function stepUser(dt, release = false) {
    const Dg = MOTION.drag;
    if (user.dragging) return;
    // ck15: once the page scrolls, a drag/flick still in flight is released (whole turns dropped: same pose)
    if (release && !user.released) { user.yaw = wrapPi(user.yaw); user.back.yaw.snap(user.yaw); user.back.pitch.snap(user.pitch); }
    user.released = release;
    if (reduced() || staticMode || release) {   // quick, critically damped return; no coasting
      user.yaw = user.back.yaw.step(0, MOTION.reduced.back, dt); user.pitch = user.back.pitch.step(0, MOTION.reduced.back, dt);
      user.vy = user.vp = 0; user.pitchRaw = user.pitch;
      if (Math.abs(user.yaw) < 1e-4 && Math.abs(user.pitch) < 1e-4) { user.yaw = user.pitch = 0; user.back.yaw.snap(0); user.back.pitch.snap(0); }
      return;
    }
    // a fast flick coasts, then a spring settles it on the nearest whole turn: it always lands back on the hero pose
    for (let i = 0, n = Math.ceil(dt / 0.008), h = dt / n; i < n; i++) {
      const rest = Math.round(user.yaw / TAU) * TAU, engage = 1 - smooth(1.2, 4.5, Math.abs(user.vy));
      const k = Dg.w0 * Dg.w0 * engage, c = Dg.coast + engage * (2 * Dg.zeta * Dg.w0 - Dg.coast);
      user.vy += (-k * (user.yaw - rest) - c * user.vy) * h; user.yaw += user.vy * h;
      user.vp += (-Dg.w0 * Dg.w0 * user.pitch - 2 * Dg.zeta * Dg.w0 * user.vp) * h; user.pitch += user.vp * h;
    }
    user.pitchRaw = user.pitch;
    const rest = Math.round(user.yaw / TAU) * TAU;
    if (Math.abs(user.yaw - rest) < 2e-4 && Math.abs(user.vy) < 2e-3) { if (rest) flips += Math.round(rest / TAU); user.yaw = 0; user.vy = 0; }
    if (Math.abs(user.pitch) < 2e-4 && Math.abs(user.vp) < 2e-3) { user.pitch = 0; user.vp = 0; }
  }
  function update(dt) {
    const c = L.clover, rm = reduced(), motionOn = !rm && !staticMode;
    const S = kx ? kx.scroll(dt) : null, k = S ? S.k : 1;   // ck15: scroll progress; k = influence of the kinetic layers (1 at the top)
    if (!motionOn || !placedOnce) { pos.x.snap(c.cx); pos.y.snap(c.cy); pos.h.snap(c.h); pos.hb.snap(c.hBase); placedOnce = true; }
    else { pos.x.step(c.cx, 0.5, dt); pos.y.step(c.cy, 0.5, dt); pos.h.step(c.h, 0.5, dt); pos.hb.step(c.hBase, 0.5, dt); }
    if (idling()) { t += dt; scrollKick *= Math.exp(-dt / 0.5); }
    if (motionOn) {
      const ht = hoverTarget(), S = MOTION.hover.smooth;
      hover.x.step(ht.x, S, dt); hover.y.step(ht.y, S, dt); hover.z.step(ht.z, S, dt);
      wob.yaw.step(dt); wob.pitch.step(dt);
      scrollP.step(scrollKick, 0.35, dt);
    } else { hover.x.snap(0); hover.y.snap(0); hover.z.snap(0); wob.yaw.reset(); wob.pitch.reset(); scrollP.snap(0); scrollKick = 0; }
    stepUser(dt, !!(S && S.release));
    if (field) field.step(dt, !motionOn || S.release);

    // (k = 1 without the experiment: every product below is the checkpoint-14 expression)
    const I = MOTION.idle, B = MOTION.base, wave = (a, T) => (rm ? 0 : a * k * Math.sin(TAU * t / T));
    const restPitch = B.pitch + clamp(wave(I.pitch, I.pitchT) + (hover.y.v + wob.pitch.x + scrollP.v) * k, -18 * DEG, 18 * DEG);
    const sg = Math.sign(B.yaw) || 1, [y0, y1] = MOTION.yawBand;
    const u = Math.abs(B.yaw) + sg * (wave(I.yaw, I.yawT) + (hover.x.v + wob.yaw.x) * k);
    const restYaw = sg * (y0 + (y1 - y0) * smoothBand((u - y0) / (y1 - y0)));
    // ck15: the free-spin layers (cursor spin/impulse, drag) are not scaled by k — their angles wrap (whole/quarter turns),
    // so a scaled wrap would jump; once the page scrolls they are released instead (critically damped, ~0.6 s)
    const restSpin = B.spin + wave(I.spin, I.spinT) + hover.z.v * k + (field ? field.phi : 0);
    qRest.setFromEuler(eRest.set(restPitch, restYaw, restSpin));
    qUser.setFromEuler(eUser.set(user.pitch, user.yaw, 0, 'YXZ'));   // drag acts in screen space, after the rest pose
    if (field) qUser.multiply(field.qK);                               // ck15: cursor impulse, also in screen space
    group.quaternion.multiplyQuaternions(qUser, qRest);
    if (kx) kx.orient(group.quaternion);                                       // ck15: the scroll timeline
    hero.stats.pose = { pitchDeg: +(restPitch / DEG).toFixed(2), yawDeg: +(restYaw / DEG).toFixed(2), spinDeg: +(restSpin / DEG).toFixed(2), flatness: +flatness().toFixed(1) };

    if (POSTER) { group.position.set(0, 0, 0); }
    const floatPx = rm || POSTER ? 0 : I.floatPx * L.s * Math.sin(TAU * t / I.floatT), par = MOTION.hover.parallaxPx, m = motionOn ? k : 0;
    let cl = { x: pos.x.v + Math.tanh(hover.tx) * par[0] * L.s * m, y: pos.y.v + Math.tanh(hover.ty) * par[1] * L.s * m + floatPx * k, h: pos.h.v };
    if (kx) cl = kx.place(cl);   // ck15: along the timeline (panel px; below the hero once it travels)
    const [wx, wy] = toWorld(cl.x, cl.y);
    group.position.set(wx, wy, 0);
    group.scale.setScalar(cl.h * PXW / clover.heightWorld);
    glass.set.scale(pos.hb.v * (cl.h / pos.h.v) * PXW);   // optical depth from the base size: the 150 % clover is not a stronger lens
    group.updateMatrixWorld();
    shadow.matrix.multiplyMatrices(PROJ, group.matrixWorld); shadow.matrixWorldNeedsUpdate = true;
    scene.environmentRotation.set(hover.y.v * 0.25 * k, (hover.x.v * 0.5 + hover.z.v * 0.4 - user.yaw * 0.15) * k, 0);
    if (kx) { kx.frame(cl, renderer.getPixelRatio()); hero.stats.kx = { ...kx.stats(), field: fieldStats() }; }
    if (grid) { grid.step(dt, { reduced: rm, frozen: staticMode, scrollY: window.scrollY, dpr: renderer.getPixelRatio() }); hero.stats.grid = grid.stats(); }
  }

  function meter(now, dt, stopped = false) {
    perf.frames++; perf.total++;
    perf.intervals.push(dt * 1000); if (perf.intervals.length > 120) perf.intervals.shift();
    if (!perf.since) perf.since = now;
    if (stopped) { perf.frames = 0; perf.since = 0; perf.intervals.length = 0; perf.govFrames = 0; }
    else if (now - perf.since >= 500) { perf.fps = Math.round(perf.frames * 1000 / (now - perf.since)); perf.frames = 0; perf.since = now; }
    // adaptive quality: lower the pixel ratio when frames are slow (cost ∝ dpr²); static as a last resort
    if (!stopped && q.get('gov') !== '0' && ++perf.govFrames > 60 && perf.intervals.length >= 45) {
      const mean = perf.intervals.slice(-45).reduce((a, b) => a + b, 0) / 45;
      if (mean > 24 && dpr > 1) {
        dpr = Math.max(1, Math.min(dpr - 0.25, Math.floor(dpr * Math.sqrt(18 / mean) * 4) / 4));
        renderer.setPixelRatio(dpr); renderer.setSize(L.W, L.H, false); perf.govFrames = 0; perf.intervals.length = 0;
        hero.stats.governor = (hero.stats.governor || []).concat(`dpr→${dpr}`);
      } else if (mean > 45 && dpr <= 1) { staticMode = true; hero.stats.governor = (hero.stats.governor || []).concat('static'); }
    }
    Object.assign(hero.stats, {
      fps: perf.fps, frames: perf.total, frameMs: perf.intervals.length ? +(perf.intervals.reduce((a, b) => a + b, 0) / perf.intervals.length).toFixed(2) : null,
      dpr, staticMode, reduced: reduced(), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      user: { yawDeg: +(user.yaw / DEG).toFixed(2), pitchDeg: +(user.pitch / DEG).toFixed(2), dragging: user.dragging, flips },
      quaternion: group.quaternion.toArray().map(v => +v.toFixed(4)),
    });
  }

  let lt = 0;
  new ResizeObserver(() => { clearTimeout(lt); lt = setTimeout(layout, 90); }).observe(panel);
  if (kx) {   // ck15: the portrait moves when the page below reflows (fonts, lazy media) without the hero resizing
    let lt2 = 0; const relayout = () => { clearTimeout(lt2); lt2 = setTimeout(() => { if (L) { kx.layout(L, PXW, toWorld); requestRender(); } }, 120); };
    new ResizeObserver(relayout).observe(document.body); window.addEventListener('load', relayout);
  }
  layout();
  renderer.compile(scene, camera);
  if (kx) kx.prewarm(renderer);
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  hero.stats.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  return { start: requestRender };
}

main();
