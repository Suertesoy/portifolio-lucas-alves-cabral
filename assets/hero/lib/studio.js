// Shared studio for the real-time and the path-traced renders, so both are lit by the same light.
// "Dark field": graphite room, long soft strips, black cards. Clear glass on a light background is only
// defined by what it reflects; dark surroundings with a few bright strips draw readable crystal edges.
import * as THREE from 'three';

export const ROOM = { color: '#3b3d39', intensity: 1 };
// feather: fraction of each half-size over which the panel fades to 0 — soft-edged boxes give soft,
// gradated reflections on glass instead of hard-edged white wedges.
export const PANELS = [
  { w: 8, h: 5, color: '#fff8ec', intensity: 9.0, pos: [7, 7, 6], feather: 0.7 },      // key soft box, top right (master's light)
  { w: 1.6, h: 14, color: '#ffffff', intensity: 6.0, pos: [-8, 0, -1.5], feather: 0.5 },  // tall strip left, slightly behind → edge light only (no broad face reflection)
  { w: 1.0, h: 12, color: '#fff3dc', intensity: 4.0, pos: [8.5, -1, -1.5], feather: 0.5 },// thin strip right, slightly behind → second edge light
  { w: 12, h: 8, color: '#fff6e6', intensity: 1.4, pos: [0, 12, 2], feather: 0.8 },    // overhead fill
  { w: 6, h: 3, color: '#fffaf2', intensity: 3.5, pos: [2.5, 4.5, 9], feather: 0.8 },  // beauty light near the lens axis → broad sheen on the leaf domes
  { w: 16, h: 4, color: '#efe4cc', intensity: 0.9, pos: [0, -8, 6], feather: 0.6 },    // warm floor bounce (front)
  { w: 8, h: 14, color: '#000000', intensity: 0, pos: [-6, -1, -9], feather: 0 },    // black cards behind/sides
  { w: 8, h: 14, color: '#000000', intensity: 0, pos: [7, -2, -8], feather: 0 },
];

// Panel falloff in local coordinates (a, b ∈ [-1, 1]); shared by both renderers.
export function panelFalloff(a, b, feather) {
  if (!feather) return 1;
  const f = x => { const t = Math.min(1, Math.max(0, (1 - Math.abs(x)) / feather)); return t * t * (3 - 2 * t); };
  return f(a) * f(b);
}
function falloffTexture(feather, n = 128) {
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = Math.round(255 * panelFalloff((i + 0.5) / n * 2 - 1, (j + 0.5) / n * 2 - 1, feather));
    data.set([v, v, v, 255], (j * n + i) * 4);
  }
  const t = new THREE.DataTexture(data, n, n); t.needsUpdate = true; t.magFilter = t.minFilter = THREE.LinearFilter;
  return t;
}

// Real-time: PMREM of a mesh scene built from the panel list.
export function pmremEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: ROOM.color, side: THREE.BackSide })));
  for (const p of PANELS) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide,
      ...(p.feather ? { map: falloffTexture(p.feather), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } : {}) }));
    m.position.set(...p.pos); m.lookAt(0, 0, 0); env.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.012).texture;
  pmrem.dispose();
  return tex;
}

// Path tracing: the same studio evaluated analytically into an equirect HDR (ray from the origin vs each
// panel rectangle, nearest hit wins), so the path tracer can importance-sample the soft boxes.
// panelBoost: physical light sources are far brighter than the room; glass reflects ~4%, so soft boxes must
// be strong enough for that 4% to read as a highlight against a bright wall.
export function equirectEnvironment(width = 1024, { panelBoost = 1 } = {}) {
  const height = width / 2, data = new Float32Array(width * height * 4);
  const room = new THREE.Color(ROOM.color);   // linear
  const rects = PANELS.map(p => {
    const c = new THREE.Vector3(...p.pos), n = c.clone().negate().normalize();
    const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    return { c, n, u, v, hw: p.w / 2, hh: p.h / 2, feather: p.feather, rad: new THREE.Color(p.color).multiplyScalar(p.intensity * panelBoost) };
  });
  const d = new THREE.Vector3(), hit = new THREE.Vector3();
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    // inverse of three.js equirectUv(): u = atan(z, x)/2π + 0.5, v = asin(y)/π + 0.5 (row 0 = v 0, flipY off)
    const a = ((i + 0.5) / width - 0.5) * Math.PI * 2, e = ((j + 0.5) / height - 0.5) * Math.PI;
    d.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
    // feathered panels add light over the room (like the additive real-time panels); black cards occlude
    let r0 = room.r, g0 = room.g, b0 = room.b, bestCard = Infinity;
    for (const r of rects) {
      const den = d.dot(r.n); if (den >= -1e-6) continue;      // panel faces the origin
      const t = r.c.dot(r.n) / den; if (t <= 0) continue;
      hit.copy(d).multiplyScalar(t).sub(r.c);
      const a = hit.dot(r.u) / r.hw, b = hit.dot(r.v) / r.hh;
      if (Math.abs(a) > 1 || Math.abs(b) > 1) continue;
      if (!r.feather) { if (t < bestCard) { bestCard = t; r0 = r.rad.r; g0 = r.rad.g; b0 = r.rad.b; } continue; }
      const w = panelFalloff(a, b, r.feather);
      r0 += r.rad.r * w; g0 += r.rad.g * w; b0 += r.rad.b * w;
    }
    const k = (j * width + i) * 4;
    data[k] = r0; data[k + 1] = g0; data[k + 2] = b0; data[k + 3] = 1;
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Backdrop / optical test plate (what the glass refracts).
// type: name + caption (optical test plate); grid: the hero's ambient grid (on by default with type)
export function backdropTexture({ type = false, grid = type } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 2048;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(1200, 760, 100, 1024, 1024, 1500);
  grd.addColorStop(0, '#F8F6F1'); grd.addColorStop(1, '#E9E5DC');
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 2048);
  if (grid) {
    g.strokeStyle = 'rgba(29,32,30,0.10)'; g.lineWidth = 2;
    for (let x = 0; x <= 2048; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 2048); g.stroke(); }
    for (let y = 0; y <= 2048; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke(); }
  }
  if (type) {
    g.fillStyle = '#1D201E';
    g.font = '700 400px "Inter Tight"'; g.textBaseline = 'alphabetic';
    // letter-spacing via manual tracking (-0.04em)
    const line = (txt, x, y) => { let cx = x; for (const ch of txt) { g.fillText(ch, cx, y); cx += g.measureText(ch).width - 16; } };
    line('LUCAS', 150, 900);
    line('CABRAL', 150, 1300);
    g.font = '500 44px "Inter Tight"';
    g.fillText('Product Designer & Design Engineer — optical test plate', 156, 1420);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// Tangent-space normal map from a height image (engraved veins for Optical Crystal).
export async function normalMapFrom(url, strength) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const n = 1024, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n);
  const src = g.getImageData(0, 0, n, n).data, out = g.createImageData(n, n);
  const h = (x, y) => src[((Math.min(n - 1, Math.max(0, y))) * n + Math.min(n - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // engraved: veins are grooves → negative height
    const dx = -(h(x + 1, y) - h(x - 1, y)) * strength, dy = -(h(x, y + 1) - h(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    out.data.set([(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (y * n + x) * 4);
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

