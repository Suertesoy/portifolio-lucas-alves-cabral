// Canonical clover geometry: an "inflated" closed volume built from the master's signed distance field.
// Front view is the traced silhouette by construction; depth comes from a single height profile shared by
// every study, so A/B materials and 1/2 compositions all use exactly the same mesh.
// Height = rim bead from the exact SDF (crisp silhouette) + dome from a SMOOTHED distance field (no crease
// along the medial axis, which otherwise folds each leaf and splits its reflections in two).
import * as THREE from 'three';

// Outer glass shell — the canonical geometry shared by every study.
export const PROFILE = {
  rimRadius: 24,     // px — thick rounded glass bead along every edge (the master's liquid-glass rim)
  domeHeight: 16,    // px — extra swell toward the middle of each leaf (this is what makes it a lens)
  domeFalloff: 60,   // px — how quickly the dome rises
  backScale: 0.8,    // back side is slightly flatter than the front
  inset: 0,          // px — offset of the iso-line used as surface (0 = traced silhouette)
  cell: 2,           // px — marching-squares grid resolution (finer → regular rim bead in refraction)
};
// Inner leaf core (Organic Crystal only): clover-core-sdf.f32 is already the silhouette inset by 8 px
// (stem removed), so no further inset here. A thin slab inside the shell.
export const CORE = { rimRadius: 5, domeHeight: 4, domeFalloff: 60, backScale: 1, inset: 0, cell: 2 };

// the local render server occasionally drops a request under parallel loads; retry before failing
export async function fetchRetry(url, tries = 3) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; }
    catch (e) { if (i >= tries - 1) throw e; await new Promise(res => setTimeout(res, 150 * (i + 1))); }
  }
}

export async function loadSDF(url, W, H) {
  const buf = await (await fetchRetry(url)).arrayBuffer();
  return { data: new Float32Array(buf), W, H };
}

function sampler({ data, W, H }, inset = 0) {
  return (x, y) => {
    x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
    return (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + W] * (1 - fx) + data[i + W + 1] * fx) * fy - inset;
  };
}

// Height (px) for inset distance d (exact SDF) and smoothed dome distance D, with ∂h/∂d and ∂h/∂D.
// Without a dome field D = d (the original, creased profile).
export function height(d, p = PROFILE, D = d) {
  if (d <= 0) return [0, Infinity, 0];
  const R = p.rimRadius;
  let h, dd;
  if (d < R) { const s = Math.sqrt(d * (2 * R - d)); h = s; dd = (R - d) / Math.max(s, 1e-4); }
  else { h = R; dd = 0; }
  // dome fades in over the rim so front and back still meet exactly at the silhouette
  const t = Math.min(1, d / R), fade = t * t * (3 - 2 * t), dfade = d < R ? 6 * t * (1 - t) / R : 0;
  const e = Math.exp(-Math.max(0, D) / p.domeFalloff), dome = p.domeHeight * (1 - e);
  h += dome * fade;
  dd += dome * dfade;
  const dD = (p.domeHeight / p.domeFalloff) * e * fade;
  return [h, dd, dD];
}

// Thickness map texture (front+back, normalised) for MeshPhysicalMaterial.thicknessMap (green channel).
export function thicknessTexture(sdf, p = PROFILE, size = 512, dome = null) {
  const s = sampler(sdf, p.inset), sD = dome ? sampler(dome) : s, out = new Uint8Array(size * size * 4);
  let max = 0;
  const vals = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5) / size * sdf.W, y = (j + 0.5) / size * sdf.H;
    const t = height(s(x, y), p, sD(x, y))[0] * (1 + p.backScale);
    vals[j * size + i] = t; max = Math.max(max, t);
  }
  for (let k = 0; k < size * size; k++) { const v = Math.round(255 * vals[k] / max); out.set([v, v, v, 255], k * 4); }
  const tex = new THREE.DataTexture(out, size, size); tex.flipY = true; tex.needsUpdate = true;
  return { tex, maxThicknessPx: max };
}

export function buildCloverGeometry(sdf, p = PROFILE, dome = null) {
  const { W, H } = sdf, s = sampler(sdf, p.inset), sD = dome ? sampler(dome) : s, cell = p.cell;
  const S = 2 / W;                 // world units per px (master width → 2 units)
  const cx = W / 2, cy = H / 2;    // keep the master's own framing: image centre = world origin
  const nx = Math.floor((W - 1) / cell) + 1, ny = Math.floor((H - 1) / cell) + 1;

  const pos = [], nor = [], uv = [], idx = [];
  const grad = (x, y) => { const gx = (s(x + 1, y) - s(x - 1, y)) / 2, gy = (s(x, y + 1) - s(x, y - 1)) / 2, l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l]; };
  const addVert = (x, y, side) => { // side: +1 front, −1 back, 0 rim
    const d = s(x, y), [g0, g1] = grad(x, y);
    let z = 0, n;
    if (side === 0) n = [-g0, g1, 0];
    else {
      const [h, dd, dD] = height(d, p, sD(x, y)), k = side > 0 ? 1 : p.backScale;
      z = side * h * k;
      // ∇h = ∂h/∂d·∇d + ∂h/∂D·∇D   (∇D is not unit length: it is a blurred field)
      const Dx = (sD(x + 1, y) - sD(x - 1, y)) / 2, Dy = (sD(x, y + 1) - sD(x, y - 1)) / 2;
      const hx = Math.min(dd, 1e4) * g0 + dD * Dx, hy = Math.min(dd, 1e4) * g1 + dD * Dy;
      n = [-hx * k, hy * k, side];             // image y is down, world y is up
    }
    const l = Math.hypot(...n) || 1;
    pos.push((x - cx) * S, -(y - cy) * S, z * S);
    nor.push(n[0] / l, n[1] / l, n[2] / l);
    uv.push(x / W, 1 - y / H);
    return pos.length / 3 - 1;
  };

  const val = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[j * nx + i] = s(i * cell, j * cell);
  const front = new Int32Array(nx * ny).fill(-1), back = new Int32Array(nx * ny).fill(-1), rim = new Map();
  const corner = (i, j, side) => {
    const k = j * nx + i, arr = side > 0 ? front : back;
    if (arr[k] < 0) arr[k] = addVert(i * cell, j * cell, side);
    return arr[k];
  };
  const crossing = (i0, j0, i1, j1) => {
    const key = i0 < i1 || j0 < j1 ? `${i0},${j0},${i1},${j1}` : `${i1},${j1},${i0},${j0}`;
    if (!rim.has(key)) {
      const a = val[j0 * nx + i0], b = val[j1 * nx + i1], t = a / (a - b);
      rim.set(key, addVert((i0 + (i1 - i0) * t) * cell, (j0 + (j1 - j0) * t) * cell, 0));
    }
    return rim.get(key);
  };

  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
    const inside = c.map(([a, b]) => val[b * nx + a] > 0);
    const count = inside.filter(Boolean).length;
    if (!count) continue;
    const polys = [];
    const saddle = count === 2 && inside[0] === inside[2];
    const centre = c.reduce((acc, [a, b]) => acc + val[b * nx + a], 0) / 4;
    if (saddle && centre <= 0) {
      for (let k = 0; k < 4; k++) if (inside[k]) {
        const pk = (k + 3) % 4, nk = (k + 1) % 4;
        polys.push([{ e: [c[pk], c[k]] }, { c: c[k] }, { e: [c[k], c[nk]] }]);
      }
    } else {
      const poly = [];
      for (let k = 0; k < 4; k++) {
        const nk = (k + 1) % 4;
        if (inside[k]) poly.push({ c: c[k] });
        if (inside[k] !== inside[nk]) poly.push({ e: [c[k], c[nk]] });
      }
      polys.push(poly);
    }
    for (const poly of polys) for (const side of [1, -1]) {
      const v = poly.map(q => (q.c ? corner(q.c[0], q.c[1], side) : crossing(q.e[0][0], q.e[0][1], q.e[1][0], q.e[1][1])));
      // image-space walk is clockwise on screen (y down) → counter-clockwise in world (y up) is the reverse
      for (let k = 1; k + 1 < v.length; k++) side > 0 ? idx.push(v[0], v[k + 1], v[k]) : idx.push(v[0], v[k], v[k + 1]);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData = { triangles: idx.length / 3, vertices: pos.length / 3, worldPerPx: S };
  return g;
}
