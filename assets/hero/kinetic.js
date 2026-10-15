// Checkpoint 15 — Kinetic Clover & Scroll Choreography. Approved in the local lab (15B) and shipped as the Home's
// default hero behaviour in checkpoint 15C (hero.js imports it; the parameters below are the approved values).
//
// Two systems share the clover's orientation without fighting over it:
//  A. Kinetic field (desktop, mouse): the cursor transmits angular impulse. A deliberate crossing of the clover's core
//     gives a flip about the screen axis perpendicular to the gesture (coasts, can complete whole turns, then settles on
//     the hero pose); a tangential / circular path near the clover drags its in-plane spin (sign of r × v), accumulating
//     with coupling and caps. Both channels: angular velocity + damping + a settle spring that only engages once the
//     object has slowed down (glass has mass). The 4 identical leaves make a quarter turn the same pose, so the spin
//     always settles on the nearest quarter and never "unwinds".
//  B. Scroll choreography (desktop + mobile): a scroll-progress timeline takes the clover from the hero pose to the
//     portrait: detach (flip + quarter spin, decelerating), travel (to the face, shrinking), reveal (it becomes a colour
//     lens over the grey portrait, then dissolves into a clover-shaped colour bloom that recedes into the toggle state).
//
// Hand-over: k = 1 − smoothstep(0, 0.1, p) is the kinetic system's influence (hover, idle, impulse, spin, drag). New
// gestures are only read while p < 0.02; as soon as the page scrolls the kinetic state is "released" (critically damped
// settle, no coasting), so the timeline takes over from an at-rest pose with no jump. Back at the top, k returns to 1.
//
// One clover, one WebGL context: the hero canvas keeps its size and stays attached to the page, but becomes a window
// that slides down with the clover (CSS translateY, set in the same frame as the WebGL draw). The camera keeps its
// projection centre on the reader's viewport (view offset) and the plate is compensated so it stays pixel-locked: the
// name never swims against the DOM. Below the hero the glass refracts an "underlay" drawn only in the transmission
// pass: the page colour, the page columns and the portrait — in colour — at the portrait's exact page position.
import * as THREE from 'three';

const TAU = Math.PI * 2, DEG = Math.PI / 180, QUARTER = Math.PI / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smoother = x => { x = clamp(x, 0, 1); return x * x * x * (x * (6 * x - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const wrapQuarter = a => a - Math.round(a / QUARTER) * QUARTER;   // 4 identical leaves: a quarter turn is the same pose
const wrapPi = a => a - Math.round(a / TAU) * TAU;

export const FLAGS = { impulse: 'Impulso central', torque: 'Torque tangencial', scroll: 'Rotação pelo scroll', travel: 'Deslocamento até a foto', reveal: 'Revelação' };
export function readFlags(q) {
  const off = new Set((q.get('off') || '').split(',').map(s => s.trim()).filter(Boolean)), f = {};
  for (const k of Object.keys(FLAGS)) f[k] = !off.has(k);
  f.rm = q.get('rm') === '1'; f.dbg = q.get('dbg') === '1'; f.lab = q.get('lab') === '1';
  try { if (q.get('cfg')) applyConfig(JSON.parse(q.get('cfg'))); } catch (e) { console.warn('kinetic: cfg ignored', e.message); }
  return f;
}

// ------------------------------------------------------------------------------------------------ A. kinetic field
export const FIELD = {
  core: 0.5,                 // crossing: the cursor's segment passes within core × R of the centre
  entry: 1.12,               // … having been outside entry × R
  entryMs: 450,              // … at most this long before (a deliberate pass, not a wander that ends on the clover)
  vMin: 8,                   // R/s: below this a crossing transmits nothing (ck15C, approved: only a deliberate, fast pass)
  gain: 3,                   // rad/s of flip per R/s above vMin (ck15C, approved)
  wMax: 13,                  // rad/s cap (≈ 2 turns/s)
  vertical: 0.28,            // share kept by vertical crossings (the nav ↔ CTA path runs vertically through the clover)
  ring: [0.45, 0.8, 1.5, 2.15],   // torque annulus (× R): fades in, full, full, fades out
  tangential: [0.5, 0.88],   // |sin(r, v)|: only tangential motion turns the clover in its plane
  couple: 14,                // 1/s: how fast the spin follows the cursor's angular rate (× weight) (ck15C, approved)
  spinGain: 1,
  spinMax: 9,                // rad/s
  dead: 220,                 // px/s: slower hover is not a gesture
  coast: 0.2,                // 1/s damping while coasting (ck15C, approved: long, light inertia)
  w0: 4.2, zeta: 0.85,       // settle spring (same feel as the drag of checkpoint 09)
  engage: [1, 4],            // rad/s: above 4 it coasts freely, below 1 the spring holds it
  release: { w0: 7.5, zeta: 1 },   // the scroll took over: quick, critically damped, no coasting
};

export function createKineticField(F = FIELD) {
  const w = new THREE.Vector3(), qK = new THREE.Quaternion(), dq = new THREE.Quaternion(), rv = new THREE.Vector3(), ax = new THREE.Vector3();
  let phi = 0, wPhi = 0, last = null, vx = 0, vy = 0, outsideAt = -1e9, armed = true;
  const hist = [];   // recent samples: speed = displacement over ~80 ms (robust to irregular event timing)
  const log = { impulses: 0, torqueSamples: 0, last: null, lastTorque: null, turnedDeg: 0, spunDeg: 0 };   // turned/spun: total rotation travelled (evaluation)
  const trail = [];   // debug overlay + tests: recent samples
  const gains = (speed, release) => {
    if (release) { const { w0, zeta } = F.release; return [w0 * w0, 2 * zeta * w0]; }
    const eng = 1 - smooth(F.engage[0], F.engage[1], speed);
    return [F.w0 * F.w0 * eng, F.coast + eng * (2 * F.zeta * F.w0 - F.coast)];
  };
  function pointer(x, y, now, c, o) {
    const R = Math.max(1, c.R), rx = x - c.x, ry = c.y - y, d = Math.hypot(rx, ry) / R;   // y up
    if (!last || now - last.t > 120) { last = { x, y, t: now }; vx = vy = 0; hist.length = 0; hist.push(last); if (d > F.entry) { outsideAt = now; armed = true; } return; }
    const dt = clamp((now - last.t) / 1000, 0.004, 0.05), x0 = last.x, y0 = last.y;
    last = { x, y, t: now }; hist.push(last);
    while (hist.length > 2 && now - hist[1].t >= 80) hist.shift();
    const a = hist[0], span = Math.max(0.008, (now - a.t) / 1000);
    vx = (x - a.x) / span; vy = (a.y - y) / span;
    const speed = Math.hypot(vx, vy);
    if (o.blocked) { armed = false; outsideAt = -1e9; return; }   // over the nav, a CTA or a link: not a gesture on the clover
    if (d > F.entry) { outsideAt = now; armed = true; }
    let kind = 'move', weight = 0;
    // A. crossing: fires when the cursor passes its closest point to the centre (a traversal, not a stop on the clover);
    // centrality comes from the line's distance, so it does not depend on how the browser samples the motion
    if (o.impulse && armed && now - outsideAt < F.entryMs) {
      const sx = x - x0, sy = y - y0, L2 = sx * sx + sy * sy;
      const u = L2 > 0 ? ((c.x - x0) * sx + (c.y - y0) * sy) / L2 : -1;
      const cd = L2 > 0 ? Math.abs(sx * (c.y - y0) - sy * (c.x - x0)) / Math.sqrt(L2) / R : Infinity;
      if (u >= 0 && u <= 1 && cd < F.core) {
        armed = false;   // one impulse per pass
        const sR = speed / R;
        if (sR > F.vMin) {
          const dx = vx / speed, dy = vy / speed, hz = Math.abs(dx);
          const mag = Math.min(F.wMax, (sR - F.vMin) * F.gain) * (0.65 + 0.35 * (1 - cd / F.core)) * (F.vertical + (1 - F.vertical) * smooth(0.45, 0.85, hz));
          ax.set(-dy, dx, 0);   // ẑ × v: the near face follows the hand
          w.addScaledVector(ax, mag); if (w.length() > F.wMax) w.setLength(F.wMax);
          log.impulses++; log.last = { mag: +mag.toFixed(2), dir: [+dx.toFixed(2), +dy.toFixed(2)], speedR: +sR.toFixed(2), centrality: +(1 - cd / F.core).toFixed(2) };
          kind = 'impulse'; weight = mag / F.wMax;
        } else kind = 'slow-cross';
      }
    }
    // B. torque: tangential motion around the visual centre drags the in-plane spin (sign of the cross product)
    if (o.torque && speed > F.dead) {
      const cross = rx * vy - ry * vx, rr = rx * rx + ry * ry;
      const tang = Math.abs(cross) / (Math.sqrt(rr) * speed + 1e-6), [a0, a1, a2, a3] = F.ring;
      const wt = smooth(a0, a1, d) * (1 - smooth(a2, a3, d)) * smooth(F.tangential[0], F.tangential[1], tang);
      if (wt > 0.01) {
        const target = clamp(cross / rr * F.spinGain * o.normalSign, -F.spinMax, F.spinMax);
        wPhi += (target - wPhi) * (1 - Math.exp(-F.couple * wt * dt));
        log.torqueSamples++; log.lastTorque = { sign: Math.sign(cross), rate: +(cross / rr).toFixed(2), weight: +wt.toFixed(2) };
        if (kind === 'move') { kind = cross > 0 ? 'torque-ccw' : 'torque-cw'; weight = wt; }
      }
    }
    trail.push({ x, y, t: now, kind, weight });
    while (trail.length > 90) trail.shift();
  }
  function leave() { last = null; }
  function kill() { w.set(0, 0, 0); wPhi = 0; }   // grabbed: a hand stops the spin
  function step(dt, release = false) {
    for (let i = 0, n = Math.ceil(dt / (1 / 120)), h = dt / n; i < n; i++) {
      if (qK.w < 0) qK.set(-qK.x, -qK.y, -qK.z, -qK.w);   // same rotation, shortest arc: a whole turn lands on the pose
      const s = Math.sqrt(Math.max(0, 1 - qK.w * qK.w)), ang = 2 * Math.acos(Math.min(1, qK.w));
      if (s > 1e-7) rv.set(qK.x, qK.y, qK.z).multiplyScalar(ang / s); else rv.set(0, 0, 0);
      const [k, c] = gains(w.length(), release);
      w.x += (-k * rv.x - c * w.x) * h; w.y += (-k * rv.y - c * w.y) * h; w.z += (-k * rv.z - c * w.z) * h;
      const wl = w.length();
      if (wl > 1e-9) { dq.setFromAxisAngle(ax.copy(w).divideScalar(wl), wl * h); qK.premultiply(dq).normalize(); log.turnedDeg += wl * h / DEG; }
      phi = wrapQuarter(phi);
      const [ks, cs] = gains(Math.abs(wPhi), release);
      wPhi += (-ks * phi - cs * wPhi) * h; phi += wPhi * h; log.spunDeg += wPhi * h / DEG;
    }
    phi = wrapQuarter(phi);
    if (resting(1e-4)) { qK.identity(); w.set(0, 0, 0); phi = 0; wPhi = 0; }
  }
  function resting(eps = 1e-4) { return w.lengthSq() < eps * eps * 100 && Math.abs(qK.w) > 1 - eps * eps && Math.abs(phi) < eps && Math.abs(wPhi) < eps * 10; }
  return {
    pointer, leave, kill, step, resting, qK, log, trail,
    get phi() { return phi; }, get omega() { return w.length(); }, get spinRate() { return wPhi; },
    get angleDeg() { return 2 * Math.acos(Math.min(1, Math.abs(qK.w))) / DEG; },
  };
}

// ------------------------------------------------------------------------------------------------ B. choreography
export const CHOREO = {
  focus: 0.5,            // the portrait's anchor reaches this viewport height when the travel ends
  anchor: [0.53, 0.42],  // the face in the portrait box (object-fit: contain, bottom-aligned) (ck15C, approved)
  lensR: 0.27,           // clover radius over the face, × portrait width
  lift: 0,               // × vh: optional rise with the exiting hero before the descent (ck15C, approved: none)
  flipAxis: [0.24, 1, 0.16],   // mostly vertical, leaning: face → edge → back → edge → face, with a slight precession
  lens: { pitch: 10 * DEG, yaw: -14 * DEG, spin: 45 * DEG },   // over the portrait: almost frontal, the symbol reads as a lens
  revealSpan: 0.45,      // × vh of scroll after the arrival: dissolve, bloom, hold, recede (ck15C, approved)
  smoothTime: 0.1,       // s: scroll smoothing (no scroll-jacking: only the drawing eases, the page scrolls natively) (ck15C)
  pad: 36,               // px kept around the clover inside the canvas window
  // ck15B lab parameters; values approved in checkpoint 15C
  turns: 1,              // whole flips along the timeline (whole numbers: the arrival pose stays the lens pose)
  quarters: 1,           // quarter turns in the clover's plane along the timeline
  rotEnd: 0.4,           // progress at which the rotation is done (ck15C, approved: the turn happens while leaving the hero)
  delay: 0,              // × vh of scroll before the clover leaves the hero pose
  revealOpacity: 1,      // strength of the colour bloom over the portrait
};
// rotation progress F(p): starts immediately, decelerates, done at p = 0.92 (a short ramp avoids a kick at p = 0;
// exponent 1.1, not steeper: a quick flick of the page must not spin the clover faster than the eye follows)
const N_LUT = 512, LUT_F = new Float32Array(N_LUT + 1);
let lutEnd = -1;
function LUT(p) {
  const end = clamp(CHOREO.rotEnd, 0.3, 1);
  if (end !== lutEnd) {   // rebuilt only when the lab changes rotEnd
    lutEnd = end;
    const rate = u => (u >= end ? 0 : smooth(0, 0.07, u) * Math.pow(1 - u / end, 1.1));
    LUT_F[0] = 0; for (let i = 1; i <= N_LUT; i++) LUT_F[i] = LUT_F[i - 1] + rate((i - 0.5) / N_LUT) / N_LUT;
    for (let i = 0; i <= N_LUT; i++) LUT_F[i] /= LUT_F[N_LUT];
  }
  const x = clamp(p, 0, 1) * N_LUT, i = Math.min(N_LUT - 1, x | 0); return lerp(LUT_F[i], LUT_F[i + 1], x - i);
}

// ------------------------------------------------------------------------------------------------ ck15B: lab parameters
// Only real parameters of the two systems, with ranges that keep the behaviour sane. layout: true → needs a relayout.
// Shared through ?cfg={"key":value,…} (only the values that differ from the defaults).
export const PARAMS = [
  { group: 'Campo cinético (desktop)', key: 'gain', obj: FIELD, label: 'Impulso da travessia', min: 0, max: 3, step: 0.05 },
  { key: 'vMin', obj: FIELD, label: 'Velocidade mínima da travessia (R/s)', min: 1, max: 8, step: 0.1 },
  { key: 'couple', obj: FIELD, label: 'Sensibilidade do torque', min: 0, max: 14, step: 0.1 },
  { key: 'spinGain', obj: FIELD, label: 'Ganho do giro no plano', min: 0, max: 2, step: 0.05 },
  { key: 'coast', obj: FIELD, label: 'Resistência ao girar livre (1/s)', min: 0.2, max: 4, step: 0.05 },
  { key: 'wMax', obj: FIELD, label: 'Limite do giro da travessia (rad/s)', min: 2, max: 20, step: 0.5 },
  { key: 'spinMax', obj: FIELD, label: 'Limite do giro no plano (rad/s)', min: 2, max: 16, step: 0.5 },
  { group: 'Coreografia do scroll', key: 'turns', obj: CHOREO, label: 'Voltas completas (flip)', min: 0, max: 3, step: 1 },
  { key: 'quarters', obj: CHOREO, label: 'Quartos de volta no plano', min: 0, max: 4, step: 1 },
  { key: 'rotEnd', obj: CHOREO, label: 'Fim da rotação (progresso 0–1)', min: 0.4, max: 1, step: 0.01 },
  { key: 'delay', obj: CHOREO, label: 'Atraso para sair do Hero (× altura da tela)', min: 0, max: 0.4, step: 0.01 },
  { key: 'lift', obj: CHOREO, label: 'Subida inicial (× altura da tela)', min: 0, max: 0.3, step: 0.01 },
  { key: 'smoothTime', obj: CHOREO, label: 'Suavização do scroll (s)', min: 0.03, max: 0.35, step: 0.01 },
  { group: 'Chegada na fotografia', key: 'lensR', obj: CHOREO, label: 'Tamanho na chegada (× largura da foto)', min: 0.12, max: 0.5, step: 0.01, layout: true },
  { key: 'ax', obj: CHOREO.anchor, idx: 0, label: 'Ponto de chegada — horizontal', min: 0.1, max: 0.9, step: 0.01, layout: true },
  { key: 'ay', obj: CHOREO.anchor, idx: 1, label: 'Ponto de chegada — vertical', min: 0.1, max: 0.9, step: 0.01, layout: true },
  { key: 'focus', obj: CHOREO, label: 'Altura da chegada na tela (0 topo – 1 base)', min: 0.3, max: 0.7, step: 0.01, layout: true },
  { group: 'Revelação', key: 'revealSpan', obj: CHOREO, label: 'Duração da revelação (× altura da tela)', min: 0.3, max: 1.6, step: 0.05, layout: true },
  { key: 'revealOpacity', obj: CHOREO, label: 'Intensidade da cor', min: 0, max: 1, step: 0.05 },
];
const pget = d => (d.idx != null ? d.obj[d.idx] : d.obj[d.key]);
const pset = (d, v) => { if (d.idx != null) d.obj[d.idx] = v; else d.obj[d.key] = v; };
export const DEFAULTS = Object.fromEntries(PARAMS.map(d => [d.key, pget(d)]));
export const paramValue = key => { const d = PARAMS.find(x => x.key === key); return d ? pget(d) : undefined; };
export function getConfig(onlyChanged = false) {
  const o = {}; for (const d of PARAMS) { const v = pget(d); if (!onlyChanged || v !== DEFAULTS[d.key]) o[d.key] = v; } return o;
}
export function setParam(key, v) {   // clamped to the safe range; returns the descriptor (or null)
  const d = PARAMS.find(x => x.key === key); if (!d || !Number.isFinite(+v)) return null;
  pset(d, clamp(+v, d.min, d.max)); return d;
}
export function applyConfig(cfg) { let layout = false; for (const [k, v] of Object.entries(cfg || {})) { const d = setParam(k, v); if (d && d.layout) layout = true; } return layout; }
export const PRESETS = {
  'Original': { flags: { impulse: false, torque: false, scroll: false, travel: false, reveal: false }, cfg: {} },
  'Cinético': { flags: { impulse: true, torque: true, scroll: true, travel: true, reveal: true }, cfg: {} },
  'Experimental': { flags: { impulse: true, torque: true, scroll: true, travel: true, reveal: true },
    cfg: { gain: 1.8, couple: 8, coast: 0.6, turns: 2, quarters: 2, rotEnd: 0.8, delay: 0.08, lift: 0.14, lensR: 0.34, revealSpan: 1.1 } },
};

// The inverse of three.js NeutralToneMapping (r170) — same function as living-grid.js lgITM: what the glass transmits is
// tone-mapped by the glass, so its sources are stored pre-inverted and land on the page colours.
const ITM = `
vec3 kxITM( vec3 c ) {
	float np = min( 0.999, max( c.r, max( c.g, c.b ) ) );
	if ( np >= 0.76 ) { float peak = 0.0576 / ( 1.0 - np ) - 0.24 + 0.76, g = 1.0 - 1.0 / ( 0.15 * ( peak - np ) + 1.0 ); c = ( c - g * np ) / ( 1.0 - g ) * peak / np; }
	float mn = min( c.r, min( c.g, c.b ) ), x = mn < 0.04 ? sqrt( max( 0.0, mn ) / 6.25 ) : mn + 0.04;
	return c + ( x - mn );
}`;

const CSS = `
.kx-on .hb { overflow: visible; }
.kx-on .hb-canvas { z-index: 1; pointer-events: none; will-change: transform; }
.kx-input { position: absolute; inset: 0; z-index: 1; touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.kx-input.grab { cursor: grab; } .kx-input.grabbing { cursor: grabbing; }
.kx-on .person .sec-head, .kx-on .statement, .kx-on .person-body, .kx-on .facts { position: relative; z-index: 2; }
.kx-reveal { position: absolute; left: 0; top: 0; width: 100%; aspect-ratio: 4 / 5; pointer-events: none; opacity: 0; background: var(--bg); isolation: isolate;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; border-radius: 2px; }
.kx-reveal img { width: 100%; height: 100%; filter: none !important; }
/* ck15C: while the clover travels and reveals, the timeline owns the portrait's colour — the hover preview waits (the
   toggle still wins: a portrait the visitor switched to colour stays in colour) */
.js .person-photo.kx-hold:not(.is-color):hover img { filter: grayscale(1) sepia(.12) brightness(1.02) contrast(1.02); }
`;

// ctx: { renderer, scene, camera, group, plate, shadow, glass, panel, canvas, clover, PLATE_Z, K, D, R_MAX, flags }
export function createExperiment(ctx) {
  const { scene, camera, plate, shadow, glass, panel, canvas, clover, PLATE_Z, K, D, R_MAX, flags } = ctx;
  const root = document.documentElement, style = document.createElement('style');
  style.textContent = CSS; document.head.appendChild(style);
  root.classList.add('kx-on');

  // glass fade (premultiplied "over"), patched on top of the approved material: optics untouched, alpha only
  const fadeU = { value: 1 };
  const prevCompile = glass.mat.onBeforeCompile;
  glass.mat.onBeforeCompile = (sh, r) => {
    prevCompile(sh, r);
    sh.uniforms.uKxFade = fadeU;
    if (!sh.fragmentShader.includes('#include <dithering_fragment>')) throw new Error('kinetic: dithering chunk missing');
    sh.fragmentShader = 'uniform float uKxFade;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor = vec4( gl_FragColor.rgb, 1.0 ) * uKxFade;');
  };
  glass.mat.customProgramCacheKey = () => 'hero-b2-optical-kx';
  Object.assign(glass.mat, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation });
  glass.mat.needsUpdate = true;
  const shadowOpacity = shadow.material.opacity;

  // underlay: seen only by the glass. The transmission pass (no TONE_MAPPING define) gets the page colours pre-inverted;
  // the main pass writes ≈(0,0,0,0) without blending = the transparent clear (a bare discard leaves no shader output;
  // an exact constant 0 lets the D3D compiler fold the tone curve into a "division by zero" warning)
  const uCanvas = document.createElement('canvas'), uTex = new THREE.CanvasTexture(uCanvas);
  uTex.colorSpace = THREE.SRGBColorSpace; uTex.anisotropy = 4;
  const uMat = new THREE.MeshBasicMaterial({ map: uTex, blending: THREE.NoBlending });
  uMat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + ITM)
      .replace('#include <map_fragment>', '#include <map_fragment>\n\t#ifdef TONE_MAPPING\n\tdiffuseColor = vec4( diffuseColor.rgb * 1e-6, 0.0 );\n\t#else\n\tdiffuseColor.rgb = kxITM( diffuseColor.rgb );\n\t#endif');
  };
  uMat.customProgramCacheKey = () => 'kx-underlay';
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), uMat);
  under.position.z = PLATE_Z; under.visible = false; scene.add(under);

  // portrait: colour overlay for the bloom (same image URL: no new asset, no new download)
  const fig = document.getElementById('person-photo'), photo = fig && fig.querySelector('img');
  let overlay = null, overlayImg = null;
  if (photo) {
    fig.classList.add('in');   // its reveal transform would misalign the colour copies while it plays
    overlay = document.createElement('div'); overlay.className = 'kx-reveal'; overlay.setAttribute('aria-hidden', 'true');
    overlayImg = photo.cloneNode(); overlayImg.removeAttribute('data-i18n'); overlayImg.removeAttribute('data-i18n-attr'); overlayImg.alt = ''; overlayImg.removeAttribute('width'); overlayImg.removeAttribute('height');
    overlay.appendChild(overlayImg); photo.after(overlay);
  }
  const photoImage = new Image(); let photoReady = false;
  if (photo) { photoImage.decoding = 'async'; photoImage.src = photo.currentSrc || photo.src; photoImage.decode().then(() => { photoReady = true; paintUnderlay(); }).catch(() => {}); }

  // clover silhouette mask (the real symmetric SDF), with the lens pose's in-plane angle baked in
  const CORE = 0.82;   // core disc radius, × half the clover height (the gaps between these leaves run deep: ~80 % of the radius)
  const BB = { top: 163, bottom: 1090 }, BBH = BB.bottom - BB.top + 1;   // = hero.js heightWorld: the clover's height in the field
  const MASK_SPAN = 1.12;   // > 2 × R_MAX: the circumscribed circle of the clover
  const mask = (() => {
    const M = 512, cv = document.createElement('canvas'); cv.width = cv.height = M;   // spans MASK_SPAN × the clover height: the turned leaves stay inside
    const g = cv.getContext('2d'), img = g.createImageData(M, M), { data, W } = clover.sdf;
    const cx = W / 2, cy = (BB.top + BB.bottom) / 2, sc = MASK_SPAN * BBH / M, a = -CHOREO.lens.spin, ca = Math.cos(a), sa = Math.sin(a);
    const at = (x, y) => { x = clamp(x, 0, W - 2); y = clamp(y, 0, W - 2); const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
      return (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + W] * (1 - fx) + data[i + W + 1] * fx) * fy; };
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const u = (i + 0.5 - M / 2) * sc, v = (j + 0.5 - M / 2) * sc;   // rotate the sampling grid: the silhouette turns by +a on screen
      const d = at(cx + ca * u + sa * v, cy - sa * u + ca * v);
      img.data[(j * M + i) * 4 + 3] = Math.round(255 * clamp(0.5 + d / sc, 0, 1));
    }
    g.putImageData(img, 0, 0);
    // narrowest boundary radius (the notches between leaves), as a fraction of half the clover height
    let rMin = Infinity;
    for (let k = 0; k < 720; k++) {
      const th = k / 720 * TAU; let r = 0;
      while (r < BBH && at(cx + Math.cos(th) * r, cy + Math.sin(th) * r) > 0) r += 1;
      rMin = Math.min(rMin, r);
    }
    return { url: cv.toDataURL('image/png'), notch: rMin / (BBH / 2) };
  })();
  // two mask layers, united: the clover silhouette + a disc that grows from its centre (fills the deep notches, so the
  // bloom never leaves a grey cross over the face; the radial-gradient is rewritten while the bloom plays)
  // set once: per frame only --kx-rho, mask-size and mask-position change (no 50 KB data URL re-parsed on every frame)
  if (overlay) overlay.style.webkitMaskImage = overlay.style.maskImage = `url(${mask.url}), radial-gradient(circle at var(--kx-ax) var(--kx-ay), #000 var(--kx-rho, 0px), transparent calc(var(--kx-rho, 0px) + 28px))`;

  // ---------------------------------------------------------------------------------------- geometry (panel CSS px)
  const G = { ok: false };
  let layouts = 0;
  let L = null, PXW = 0.001, toWorld = null, dprU = 1;
  const offsetPage = el => { let x = 0, y = 0; for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };
  function layout(Lin = L, pxw = PXW, tw = toWorld) {   // no arguments: relayout with the last ones (lab)
    if (!Lin) return;
    L = Lin; PXW = pxw; toWorld = tw;
    const vh = innerHeight, [, heroTop] = offsetPage(panel);
    G.vh = vh; G.W = L.W; G.H = L.H; G.heroTop = heroTop; G.ok = !!photo;
    if (photo) {
      const [px, py] = offsetPage(photo), pw = photo.offsetWidth, ph = photo.offsetHeight;
      G.P = { x: px, y: py - heroTop, w: pw, h: ph };
      G.A = { x: px + CHOREO.anchor[0] * pw, y: py - heroTop + CHOREO.anchor[1] * ph };
      G.hArr = (CHOREO.lensR * pw) / R_MAX;
      G.sEnd = Math.max(0.5 * vh, G.A.y - CHOREO.focus * vh);   // scroll (from the hero top) at which the clover reaches the face
      G.rSpan = CHOREO.revealSpan * vh;
      G.arc = Math.abs(G.A.x - L.clover.cx) < 0.1 * L.W ? -0.07 * L.W : 0;   // single column: a gentle lateral arc instead of a straight drop
      // bloom: the clover silhouette grows until its notches pass the portrait's farthest corner
      const ax = G.A.x - px, ay = G.A.y - G.P.y, far = Math.max(...[[0, 0], [pw, 0], [0, ph], [pw, ph]].map(([cx, cy]) => Math.hypot(cx - ax, cy - ay)));
      G.mask0 = G.hArr; G.mask1 = Math.max(1.2 * G.hArr, 1.05 * far / (0.5 * CORE));   // bloom ends when the core disc passes the farthest corner
      if (overlay) { overlay.style.setProperty('--kx-ax', ax.toFixed(1) + 'px'); overlay.style.setProperty('--kx-ay', ay.toFixed(1) + 'px'); }
      G.uTop = L.H; G.uBottom = Math.max(G.A.y, G.P.y + ph) + vh;
    }
    dprU = Math.min(2, window.devicePixelRatio || 1); layouts++;   // the lens magnifies what it sees: keep the portrait sharp
    paintUnderlay();
  }
  function paintUnderlay() {
    if (!G.ok || !L) return;
    const W = G.W, Hh = G.uBottom - G.uTop, sc = Math.min(dprU, 4096 / W, 4096 / Hh);
    const cw0 = Math.round(W * sc), ch0 = Math.round(Hh * sc);
    if (cw0 !== uCanvas.width || ch0 !== uCanvas.height) { uTex.dispose(); uCanvas.width = cw0; uCanvas.height = ch0; }   // new size: new GPU storage
    const g = uCanvas.getContext('2d'), cs = getComputedStyle(root), col = n => cs.getPropertyValue(n).trim();
    g.setTransform(sc, 0, 0, sc, 0, 0);
    g.fillStyle = getComputedStyle(document.body).backgroundColor; g.fillRect(0, 0, W, Hh);
    // the page columns (= .page-grid), so the glass bends the same grid below the hero
    g.strokeStyle = col('--line-soft') || 'rgba(29,32,30,0.055)'; g.lineWidth = 1;
    const colW = (L.padR - L.padX - (L.cols - 1) * L.gutter) / L.cols;
    for (let i = 0; i < L.cols; i++) for (const x0 of [L.padX + i * (colW + L.gutter), L.padX + i * (colW + L.gutter) + colW - 1]) {
      const x = Math.round(x0) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke();
    }
    // the portrait as the page shows it (gradient backdrop + multiply), in colour unless the reveal is off
    const P = G.P, y0 = P.y - G.uTop, grad = g.createLinearGradient(0, y0, 0, y0 + P.h);
    grad.addColorStop(0, col('--sage-soft') || '#DCE3D6'); grad.addColorStop(1, col('--bg-2') || '#EAE7E0');
    g.fillStyle = grad; g.fillRect(P.x, y0, P.w, P.h);
    if (photoReady) {
      const ir = photoImage.naturalWidth / photoImage.naturalHeight, br = P.w / P.h;
      const dw = ir < br ? P.h * ir : P.w, dh = ir < br ? P.h : P.w / ir;   // object-fit: contain; object-position: 50% 100%
      g.save(); g.beginPath(); g.rect(P.x, y0, P.w, P.h); g.clip();
      g.globalCompositeOperation = 'multiply';
      if (!flags.reveal) g.filter = 'grayscale(1) sepia(.12) brightness(1.02) contrast(1.02)';
      g.drawImage(photoImage, P.x + (P.w - dw) / 2, y0 + P.h - dh, dw, dh);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    uTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------- scroll state
  const st = { s: 0, sS: 0, vel: 0, snapped: false, p: 0, r: 0, k: 1, release: false, t: 0, live: true, fade: 1, phase: 'hero' };
  const enabled = () => G.ok && !ctx.reduced() && (flags.scroll || flags.travel);
  function scroll(dt) {
    const sRaw = window.scrollY - G.heroTop, on = enabled();
    st.s = sRaw;
    if (!on) { st.sS = 0; st.vel = 0; }
    else if (!st.snapped || Math.abs(sRaw - st.sS) > 1.5 * G.vh) { st.sS = sRaw; st.vel = 0; st.snapped = true; }   // first frame / restored / jump
    else {   // critically damped follow (same SmoothDamp as hero.js Spring)
      const o = 2 / CHOREO.smoothTime, x = o * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), ch = st.sS - sRaw, tmp = (st.vel + o * ch) * dt;
      st.vel = (st.vel - o * tmp) * e; st.sS = sRaw + (ch + tmp) * e;
    }
    const sS = Math.max(0, st.sS);
    const d = Math.min(CHOREO.delay * G.vh, 0.8 * G.sEnd);   // the clover keeps its hero pose for the first d px
    st.p = on ? clamp((sS - d) / (G.sEnd - d), 0, 1) : 0;
    st.r = on && flags.travel ? clamp((sS - G.sEnd) / G.rSpan, 0, 1) : 0;
    st.k = 1 - smooth(0, 0.1, st.p);
    st.release = st.p > 0.003;
    st.phase = st.p <= 0 ? 'hero' : st.p < 0.3 ? 'detach' : st.p < 1 ? 'travel' : st.r < 1 ? 'reveal' : 'done';
    // keep drawing while the clover can be on screen, or the eased scroll has not caught up
    st.live = on && (sRaw < G.sEnd + G.rSpan + 40 || Math.abs(st.sS - sRaw) > 0.5);
    return st;
  }

  // ---------------------------------------------------------------------------------------- pose along the timeline
  const qFlip = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
  const qLens = new THREE.Quaternion().setFromEuler(new THREE.Euler(CHOREO.lens.pitch, CHOREO.lens.yaw, CHOREO.lens.spin));
  const FLIP = new THREE.Vector3(...CHOREO.flipAxis).normalize(), Z = new THREE.Vector3(0, 0, 1);
  function orient(q) {   // q: the hero orientation (kinetic layers already weighted by k) → the choreographed one
    if (!enabled() || st.p <= 0) return q;
    const F = flags.scroll ? LUT(st.p) : 0, b = flags.travel ? smooth(0.5, 1, st.p) : 0;
    qTmp.copy(q).slerp(qLens, b);
    qSpin.setFromAxisAngle(Z, QUARTER * Math.round(CHOREO.quarters) * F);
    qFlip.setFromAxisAngle(FLIP, TAU * Math.round(CHOREO.turns) * F);
    return q.copy(qFlip).multiply(qTmp).multiply(qSpin);
  }
  // base: the hero position/size (panel px). Returns the drawn position/size and the optical/fade parameters.
  const out = { x: 0, y: 0, h: 0, fade: 1, lensK: 1, shadowK: 1 };
  function place(base) {
    Object.assign(out, base, { fade: 1, lensK: 1, shadowK: 1 });
    if (!enabled() || !flags.travel) { st.fade = 1; return out; }
    const p = st.p, r = st.r, vh = G.vh;
    // viewport-space design, page-space result (y = viewport + eased scroll): the canvas is page-attached, so the
    // clover never depends on the instantaneous scroll offset, only on the eased progress
    const vy0 = base.y, fv = G.A.y - G.sEnd, ey = smooth(0.3, 1, p), hump = Math.sin(Math.PI * clamp(p / 0.75, 0, 1)) ** 2;
    const vy = vy0 + (fv - vy0) * ey - CHOREO.lift * vh * hump;
    const ex = smoother((p - 0.08) / 0.84);
    out.x = base.x + (G.A.x - base.x) * ex + G.arc * Math.sin(Math.PI * ex);
    out.y = p >= 1 ? G.A.y : vy + p * G.sEnd;
    const es = smooth(0.02, 0.8, p);   // most of the shrinking happens during the travel, not on arrival
    out.h = lerp(base.h, G.hArr, es) * (1 - 0.08 * smooth(0, 0.3, r));
    out.fade = 1 - smooth(0.05, 0.32, r);
    out.lensK = 1 - smooth(0, 0.25, r);
    out.shadowK = 1 - smooth(0.02, 0.25, p);
    st.fade = out.fade;
    return out;
  }

  // ---------------------------------------------------------------------------------------- per frame: window, camera, plate, underlay, bloom
  const FOV0 = camera.fov;
  let lastT = -1, lastMask = '', lastHold = false;
  const cw = new THREE.Vector2();
  function frame(cl, dpr) {   // cl: drawn clover {x, y, h} (panel px)
    const on = enabled() && flags.travel, H = G.H, W = G.W;
    // 1. the canvas window: page rows [t, t + H], following the clover; it never leaves the visible part of the plate uncovered
    let t = 0;
    if (on) {
      const R = cl.h * R_MAX, need = cl.y + R + CHOREO.pad - H, top = Math.max(0, st.s);
      t = Math.max(0, need);
      if (top < H) t = Math.min(t, top);
      t = Math.round(t * dpr) / dpr;   // whole device pixels: the plate's type stays crisp
    }
    if (t !== lastT) { canvas.style.transform = t ? `translate3d(0, ${t}px, 0)` : ''; lastT = t; }
    st.t = t;
    // 2. camera: projection centre follows the reader (on axis while the clover travels), the frustum shows the window
    const cy = H / 2 + (on ? clamp(st.sS, 0, G.sEnd + G.rSpan) : 0);
    const [wx, wy] = toWorld(W / 2, cy); cw.set(wx, wy);
    camera.position.set(wx, wy, D);
    const half = Math.max(cy - t, t + H - cy), fullH = 2 * half;
    if (Math.abs(cy - t - H / 2) < 1e-3) { camera.clearViewOffset(); camera.fov = FOV0; camera.aspect = W / H; }
    else {
      camera.fov = 2 * Math.atan(half * PXW / D) / DEG; camera.aspect = W / fullH;
      camera.setViewOffset(W, fullH, 0, half - (cy - t), W, H);
    }
    camera.updateProjectionMatrix();
    // 3. plate pixel-locked under a moving projection centre: P = K·s + (1 − K)·C
    plate.position.set((1 - K) * cw.x, (1 - K) * cw.y, PLATE_Z);
    const viewTop = st.s, R = cl.h * R_MAX;
    plate.visible = !on || viewTop < H + 2 || cl.y - R < H;
    // 4. underlay (transmission only): below the hero, while the clover may be over it
    under.visible = on && cl.y + R > H - 2;
    if (under.visible) {
      const uh = G.uBottom - G.uTop, [ux, uy] = toWorld(W / 2, (G.uTop + G.uBottom) / 2);
      under.position.set(K * ux + (1 - K) * cw.x, K * uy + (1 - K) * cw.y, PLATE_Z);
      under.scale.set(K * W * PXW, K * uh * PXW, 1);
    }
    shadow.material.opacity = shadowOpacity * (on ? cl.shadowK : 1);
    fadeU.value = on ? cl.fade : 1;
    glass.set.lens(Math.max(0.001, ctx.lens * (on ? cl.lensK : 1)));
    // 5. the bloom: a clover-shaped colour window over the grey portrait, then it recedes (the toggle state returns)
    if (overlay) {
      const r = st.r, o = on && flags.reveal ? CHOREO.revealOpacity * smooth(0, 0.08, r) * (1 - smooth(0.82, 1, r)) : 0;
      let css = 'o0';
      if (o > 0.001) {
        const S = G.mask0 * Math.pow(G.mask1 / G.mask0, smooth(0.06, 0.6, r)), ax = G.A.x - G.P.x, ay = G.A.y - G.P.y;
        const rho = 0.5 * S * CORE * smooth(0.02, 0.22, r), Sm = S * MASK_SPAN;
        css = `${o.toFixed(3)}|${S.toFixed(1)}|${rho.toFixed(1)}`;
        if (css !== lastMask) {
          overlay.style.opacity = o.toFixed(3);
          overlay.style.setProperty('--kx-rho', rho.toFixed(1) + 'px');
          overlay.style.webkitMaskSize = overlay.style.maskSize = `${Sm.toFixed(1)}px ${Sm.toFixed(1)}px, 100% 100%`;
          overlay.style.webkitMaskPosition = overlay.style.maskPosition = `${(ax - Sm / 2).toFixed(1)}px ${(ay - Sm / 2).toFixed(1)}px, 0 0`;
        }
      } else if (lastMask !== 'o0') overlay.style.opacity = '0';
      lastMask = css;
    }
    // 6. colour priority: from the moment the page leaves the hero until the reveal is over (both scroll directions),
    // the hover preview does not colour the portrait ahead of the clover; outside that window it behaves as always
    const hold = on && flags.reveal && st.p > 0 && st.r < 1;
    if (fig && hold !== lastHold) { fig.classList.toggle('kx-hold', hold); lastHold = hold; }
  }
  // compile the underlay's two programs and upload its texture at start, not mid-scroll (first use was a ~80 ms hitch)
  function prewarm(renderer) { const v = under.visible; under.visible = true; renderer.render(scene, camera); under.visible = v; }
  function off() {   // WebGL lost: back to the static page
    root.classList.remove('kx-on'); canvas.style.transform = '';
    if (overlay) overlay.style.opacity = '0';
    if (fig) fig.classList.remove('kx-hold');
  }
  function stats() {
    return { p: +st.p.toFixed(4), r: +st.r.toFixed(4), k: +st.k.toFixed(3), phase: st.phase, s: Math.round(st.s), sS: +st.sS.toFixed(1), t: st.t, live: st.live, fade: +st.fade.toFixed(3),
      sEnd: Math.round(G.sEnd || 0), rSpan: Math.round(G.rSpan || 0), anchor: G.A ? [Math.round(G.A.x), Math.round(G.A.y)] : null, hArr: Math.round(G.hArr || 0),
      flags: { ...flags }, underlay: [uCanvas.width, uCanvas.height], notch: +mask.notch.toFixed(3), plateVisible: plate.visible, underVisible: under.visible,
      overlayOpacity: overlay ? +(overlay.style.opacity || 0) : null, hold: lastHold, rotF: +LUT(st.p).toFixed(5), anchorFrac: [...CHOREO.anchor], layouts };
  }
  // the render loop may run while the hero is off screen: only while the clover can still be seen (or is catching up)
  const wants = () => enabled() && flags.travel && (window.scrollY - G.heroTop < G.sEnd + G.rSpan + 40 || st.live);
  return { st, G, layout, scroll, orient, place, frame, off, stats, wants, prewarm, repaint: paintUnderlay, enabled };
}

// the hero's input surface when the canvas no longer takes pointer events (it now also covers the portrait)
export function inputLayer(panel, canvas) {
  const el = document.createElement('div'); el.className = 'kx-input'; el.setAttribute('aria-hidden', 'true');
  canvas.after(el);
  return el;
}
