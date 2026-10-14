// Checkpoint 12 — Living Grid: the light, editorial counterpart of L A Cabral's grid energy trails.
// Source studied (read-only): PROJETOS/L A CABRAL/SARTEC DIGITAL — script.js "Global grid energy trail effect" (two
// fixed Canvas 2D layers, cursor snapped to grid intersections, an orthogonal chain + short branches that fade out,
// reading zones erased) and styles.css .chapter-grid::before (72 px CSS grid under a radial mask).
//
// What changes here:
//  · The grid is not a texture laid over the page: it is the portfolio's own 12-column editorial grid (the same column
//    edges as .page-grid), completed with rows of the same module, so the hero becomes a modular grid (fields + gutters)
//    whose central gutters cross under the clover. The rows fade out before the hero ends: below it only the columns
//    remain, exactly the page grid.
//  · It is painted inside the hero's WebGL plate (one patched MeshBasicMaterial), not on an extra canvas. The plate is
//    what the B2 glass refracts (three.js transmission renders opaque objects), so the clover really bends the grid,
//    the cursor light and the trails — no second engine, no change to the glass shader.
//  · Ink on paper instead of light on a dark screen: lines and trails multiply the paper towards mineral green (like
//    L A Cabral's light surface, mix-blend-mode: multiply), so they vanish over the black letters by construction.
//  · The L A Cabral chain/branch logic is kept (throttled sampling, Manhattan fill-in, newest-brightest gradient,
//    sin-faded branches, scroll sweeps), adapted to a non-uniform grid (index space) and made calmer.
//  · New: a damped light pool that follows the cursor (and touch), a faint ambient light that drifts when nobody
//    interacts (the mobile alternative), a still light behind the glass, and a very small row parallax on scroll.
import * as THREE from 'three';

const MAX_SEG = 32, MAX_OCC = 6;   // 32 lit segments at most: a trail, not a circuit board (and the cost of the loop)
const hex = h => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);

// art direction (sRGB 0…1, composed like CSS alpha so the columns match .page-grid exactly)
export const LOOK = {
  bg: '#F3F1EC', ink: '#1D201E', mineral: '#3E5A4A', sage: '#8FA58A', paper: '#FAF9F6', mist: '#DCE5D6',   // mist: the light's sage veil
  colAlpha: 0.055,      // = --line-soft, the page grid
  rowAlpha: 0.05,       // rows: the same ink, a touch lighter, under a radial mask
  litAlpha: 0.2,        // extra line ink where the light falls (shifts towards mineral)
  trail: 1,             // trail gain
  lightR: [150, 260],   // cursor light σ (px), from ~375 px to 1440 px wide
  glow: 0.55,           // still light behind the glass (lift towards paper)
  ambient: 0.32,        // drifting light at rest
  parallax: 0.06,       // rows drift by this × scroll (the grid sits deeper than the name)
};
const TRAIL = {
  primaryLife: [1100, 1600], secondaryLife: [600, 950], sample: 40, branch: 90, scroll: 70,
  maxNodes: 60, maxBranches: 24, maxScrollSteps: 4, head: 0.62, tail: 0.2,
};

const PARS = /* glsl */`
#define LIVING_GRID 1
#define LG_MAX_SEG ${MAX_SEG}
#define LG_MAX_OCC ${MAX_OCC}
uniform vec2 uLgRes; uniform float uLgDpr;
uniform vec4 uLgCols;   // x0, field (column width), gutter, column count
uniform vec4 uLgRows;   // anchor (incl. parallax), field, gutter, -
uniform vec4 uLgArea;   // rows from x0 to x1, fade-in from the top, fade-out to the bottom
uniform vec4 uLgMask;   // rows ellipse: centre, radii
uniform vec4 uLgLight;  // cursor light: x, y, sigma, intensity
uniform vec4 uLgAmb;    // ambient light
uniform vec4 uLgGlow;   // light behind the glass
uniform vec4 uLgAlpha;  // columns, rows, lit, trail gain
uniform vec4 uLgOcc[LG_MAX_OCC]; uniform int uLgOccN;
uniform vec4 uLgSeg[LG_MAX_SEG]; uniform vec4 uLgSegA[LG_MAX_SEG]; uniform int uLgSegN;
uniform vec3 uLgBg; uniform vec3 uLgInk; uniform vec3 uLgMineral; uniform vec3 uLgSage; uniform vec3 uLgPaper; uniform vec3 uLgMist;

// With the Living Grid the plate canvas holds final page colours (no CPU inverse) and the main pass skips tone mapping
// for this material, so the paper lands exactly on --bg (the checkpoint-11 plate came out #F0F0F0, a seam at the
// hero's bottom edge). Only the transmission pass — what the glass sees and tone-maps itself — gets the inverse of
// three.js NeutralToneMapping (r170), = hero.js inverseNeutral.
vec3 lgITM( vec3 c ) {
	float np = min( 0.999, max( c.r, max( c.g, c.b ) ) );
	if ( np >= 0.76 ) { float peak = 0.0576 / ( 1.0 - np ) - 0.24 + 0.76, g = 1.0 - 1.0 / ( 0.15 * ( peak - np ) + 1.0 ); c = ( c - g * np ) / ( 1.0 - g ) * peak / np; }
	float mn = min( c.r, min( c.g, c.b ) ), x = mn < 0.04 ? sqrt( max( 0.0, mn ) / 6.25 ) : mn + 0.04;
	return c + ( x - mn );
}
vec3 lgSrgb( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
vec3 lgLin( vec3 c ) { return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) ); }
// a 1 css px line whose left edge is v, snapped to the device grid (crisp at any dpr, like the canvas plate)
float lgEdge( float v ) { return floor( v * uLgDpr + 0.5 ) / uLgDpr; }
float lgDist( float p, float v ) { return abs( p - lgEdge( v ) - 0.5 ); }   // to the line's centre
float lgCovD( float d ) { return clamp( ( 0.5 - d ) * uLgDpr + 0.5, 0.0, 1.0 ); }   // pixel coverage of that line
// modular grid on one axis: each module is a field with a line on both edges, then a gutter. Only three lines can be
// the nearest one: this module's two edges and the next module's first edge. Returns (coverage, distance).
vec2 lgModular( float p, float a0, float field, float gutter, float kMin, float kMax ) {
	float P = field + gutter, k = floor( ( p - a0 ) / P ), d = 1e4;
	if ( k >= kMin && k <= kMax ) { float l = a0 + k * P; d = min( lgDist( p, l ), lgDist( p, l + field - 1.0 ) ); }
	if ( k + 1.0 >= kMin && k + 1.0 <= kMax ) d = min( d, lgDist( p, a0 + ( k + 1.0 ) * P ) );
	return vec2( lgCovD( d ), d );
}
float lgBox( vec2 p, vec4 b ) { vec2 d = max( b.xy - p, p - b.zw ); return length( max( d, 0.0 ) ); }
float lgPool( vec2 p, vec4 L ) { if ( L.w < 1e-3 ) return 0.0; vec2 d = p - L.xy; return L.w * exp( - dot( d, d ) / ( 2.0 * L.z * L.z ) ); }

vec3 lgShade( vec3 lin, vec2 uv ) {
	vec2 p = vec2( uv.x * uLgRes.x, ( 1.0 - uv.y ) * uLgRes.y );
	vec3 s = lgSrgb( lin );   // the plate texel, in page colours
	float paper = smoothstep( 0.35, 0.75, dot( s, vec3( 0.2126, 0.7152, 0.0722 ) ) );
	float edge = 1.0 - smoothstep( 0.8 * uLgRes.y, uLgRes.y, p.y );   // lights die before the hero's bottom edge
	float cur0 = lgPool( p, uLgLight ), amb0 = lgPool( p, uLgAmb );
	// depth: a still light behind the glass lifts the paper (never the ink); the moving lights are a translucent
	// sage veil (multiplied, so the letters stay black; not occluded: a veil does not compete with the text)
	s = mix( s, uLgPaper, clamp( lgPool( p, uLgGlow ), 0.0, 1.0 ) * paper * edge );
	s = mix( s, s * uLgMist / uLgBg, clamp( cur0 * 0.45 + amb0 * 0.25, 0.0, 1.0 ) * edge );
	// the modular grid: columns everywhere (= page grid), rows inside the type area under an elliptic mask
	vec2 cv = lgModular( p.x, uLgCols.x, uLgCols.y, uLgCols.z, 0.0, uLgCols.w - 1.0 );
	vec2 rw = ( p.x >= uLgArea.x && p.x <= uLgArea.y ) ? lgModular( p.y, uLgRows.x, uLgRows.y, uLgRows.z, -1e4, 1e4 ) : vec2( 0.0, 1e4 );
	bool nearLine = min( cv.y, rw.y ) < 7.0;   // ~10 % of the pixels: everything below only matters there
	// reading zones (DOM text over the hero): light and trails step aside, the still grid stays
	float clear = 1.0, lit = 0.0;
	if ( nearLine ) {
		for ( int i = 0; i < LG_MAX_OCC; i ++ ) { if ( i >= uLgOccN ) break; clear = min( clear, smoothstep( 0.0, 22.0, lgBox( p, uLgOcc[ i ] ) ) ); }
		lit = max( cur0, amb0 ) * clear;
	}
	float vfade = smoothstep( 0.0, uLgArea.z, p.y ) * ( 1.0 - smoothstep( uLgRes.y - uLgArea.w, uLgRes.y, p.y ) );
	float rowMask = mix( 1.0, 0.2, smoothstep( 0.3, 1.0, length( ( p - uLgMask.xy ) / uLgMask.zw ) ) );
	float aC = cv.x * ( uLgAlpha.x + lit * uLgAlpha.z );
	float aR = rw.x * ( uLgAlpha.y * rowMask + lit * uLgAlpha.z ) * vfade;
	vec3 lineCol = mix( uLgInk, uLgMineral, clamp( lit * 1.6, 0.0, 1.0 ) );
	s = mix( s, s * lineCol / uLgBg, max( aC, aR ) );   // multiply: ink on paper, invisible on the letters
	// orthogonal trails, only evaluated next to a grid line
	if ( uLgSegN > 0 && nearLine && clear > 0.0 ) {
		float core = 0.0, halo = 0.0;
		for ( int i = 0; i < LG_MAX_SEG; i ++ ) {
			if ( i >= uLgSegN ) break;
			vec4 g = uLgSeg[ i ]; vec2 a = uLgSegA[ i ].xy;
			bool h = abs( g.y - g.w ) < 0.01;
			float across = h ? p.y : p.x, fixedV = h ? g.y : g.x;
			if ( abs( across - fixedV ) > 7.5 ) continue;   // on another line: most segments, for most pixels
			float along = h ? p.x : p.y, s0 = h ? g.x : g.y, s1 = h ? g.z : g.w;
			float outside = max( min( s0, s1 ) - along, along - max( s0, s1 ) );
			if ( outside > 2.0 ) continue;
			float k = mix( a.x, a.y, clamp( ( along - s0 ) / ( s1 - s0 ), 0.0, 1.0 ) ) * ( 1.0 - smoothstep( -0.5, 2.0, outside ) );
			float d = lgDist( across, fixedV );
			core = max( core, max( lgCovD( d ), 0.45 * exp( - d * d / 1.5 ) ) * k );
			halo = max( halo, exp( - d * d / 13.5 ) * k );
		}
		core *= clear * uLgAlpha.w; halo *= clear * uLgAlpha.w;
		s = mix( s, s * uLgSage / uLgBg, halo * 0.6 );
		s = mix( s, s * uLgMineral / uLgBg, core );
	}
	vec3 o = lgLin( clamp( s, 0.0, 1.0 ) );
	#ifdef TONE_MAPPING
	return o;            // main pass: exact page colours (this material's tone mapping is removed below)
	#else
	return lgITM( o );   // transmission pass: the glass tone-maps what it transmits
	#endif
}
`;

class Damp {   // critically damped smoothing (same SmoothDamp as the clover's springs in hero.js)
  constructor(v = 0) { this.v = v; this.vel = 0; }
  step(target, smoothTime, dt) {
    const o = 2 / smoothTime, x = o * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const ch = this.v - target, tmp = (this.vel + o * ch) * dt;
    this.vel = (this.vel - o * tmp) * e; this.v = target + (ch + tmp) * e;
    return this.v;
  }
  snap(v) { this.v = v; this.vel = 0; }
  resting(target, eps = 1e-3) { return Math.abs(this.v - target) < eps && Math.abs(this.vel) < eps; }
}

// map: the plate's CanvasTexture. Returns a material for the plate and the controller that feeds it.
export function createLivingGrid(map, { fail = false } = {}) {
  const v4 = () => new THREE.Vector4();
  const U = {
    uLgRes: { value: new THREE.Vector2(1, 1) }, uLgDpr: { value: 1 },
    uLgCols: { value: v4() }, uLgRows: { value: v4() }, uLgArea: { value: v4() }, uLgMask: { value: new THREE.Vector4(0, 0, 1, 1) },
    uLgLight: { value: new THREE.Vector4(0, 0, 200, 0) }, uLgAmb: { value: new THREE.Vector4(0, 0, 300, 0) }, uLgGlow: { value: new THREE.Vector4(0, 0, 200, 0) },
    uLgAlpha: { value: new THREE.Vector4(LOOK.colAlpha, LOOK.rowAlpha, LOOK.litAlpha, LOOK.trail) },
    uLgOcc: { value: Array.from({ length: MAX_OCC }, v4) }, uLgOccN: { value: 0 },
    uLgSeg: { value: Array.from({ length: MAX_SEG }, v4) }, uLgSegA: { value: Array.from({ length: MAX_SEG }, v4) }, uLgSegN: { value: 0 },
    uLgBg: { value: hex(LOOK.bg) }, uLgInk: { value: hex(LOOK.ink) }, uLgMineral: { value: hex(LOOK.mineral) }, uLgSage: { value: hex(LOOK.sage) }, uLgPaper: { value: hex(LOOK.paper) }, uLgMist: { value: hex(LOOK.mist) },
  };
  const material = new THREE.MeshBasicMaterial({ map });
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    const need = (s, from) => { if (!s.includes(from)) throw new Error('living-grid: shader chunk changed, missing ' + from); return s; };
    sh.fragmentShader = need(need(need(sh.fragmentShader, '#include <map_pars_fragment>'), '#include <map_fragment>'), '#include <tonemapping_fragment>')
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + PARS + (fail ? '\n#error living-grid forced failure (lgfail=1)\n' : ''))
      .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = lgShade( diffuseColor.rgb, vMapUv );')
      .replace('#include <tonemapping_fragment>', '');   // lgShade already outputs final page colours in the main pass
  };
  material.customProgramCacheKey = () => 'living-grid' + (fail ? '-fail' : '');

  // ------------------------------------------------------------ geometry (panel CSS px; y of rows in grid space)
  let L = null, xs = [], ys = [], rowsArea = [0, 0], ready = false;
  function layout(layoutInfo, occluders, dpr) {
    L = layoutInfo;
    const n = L.cols, gut = L.gutter, field = (L.padR - L.padX - (n - 1) * gut) / n, P = field + gut;
    const a0 = L.clover.cy + gut / 2;   // a horizontal gutter centred on the clover, like the central column gutter (also in step())
    xs = []; for (let i = 0; i < n; i++) xs.push(L.padX + i * P, L.padX + i * P + field - 1);
    ys = []; for (let k = Math.floor((-2 * P - a0) / P); a0 + k * P < L.H + 2 * P; k++) ys.push(a0 + k * P, a0 + k * P + field - 1);
    rowsArea = [L.padX, L.padR];
    U.uLgRes.value.set(L.W, L.H); U.uLgDpr.value = dpr;
    U.uLgCols.value.set(L.padX, field, gut, n);
    U.uLgRows.value.set(a0, field, gut, 0);
    U.uLgArea.value.set(L.padX, L.padR + 1, Math.max(60, L.guides[0] * 0.55), L.H * 0.22);
    U.uLgMask.value.set(L.W / 2, L.clover.cy, Math.max(260, 0.5 * (L.padR - L.padX)), Math.max(220, 0.42 * L.H));
    const occ = occluders.slice(0, MAX_OCC);
    occ.forEach((r, i) => U.uLgOcc.value[i].set(r[0] - 24, r[1] - 24, r[2] + 24, r[3] + 24));
    U.uLgOccN.value = occ.length;
    sigma = clamp(LOOK.lightR[0] + (L.W - 375) / (1440 - 375) * (LOOK.lightR[1] - LOOK.lightR[0]), LOOK.lightR[0], LOOK.lightR[1]);
    path = []; branches = []; lastCell = null;   // the grid moved: old trails no longer sit on it
    ready = true;
  }
  const nearest = (arr, v) => { let b = 0; for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i] - v) < Math.abs(arr[b] - v)) b = i; return b; };

  // ------------------------------------------------------------ trails (L A Cabral's chain + branches, index space)
  let path = [], branches = [], lastCell = null, lastSample = 0, lastBranch = 0, lastScroll = 0;
  const pushNode = (i, j, boost = 1, born = performance.now()) => {
    path.push({ i, j, t: born, boost, life: rand(...TRAIL.primaryLife) });
    if (path.length > TRAIL.maxNodes) path.shift();
  };
  const pushBranch = (b, now) => { branches.push({ ...b, born: now, life: rand(...TRAIL.secondaryLife) }); if (branches.length > TRAIL.maxBranches) branches.shift(); };
  function spawnNetwork(i, j, now, boost, force) {
    if (!force) { if (now - lastBranch < TRAIL.branch) return; lastBranch = now; }
    for (const [rank, chance, peak] of [[1, 0.42, 0.16], [2, 0.16, 0.09]]) for (const side of [-1, 1]) {
      const jj = j + side * rank, ii = i + side * rank;
      if (Math.random() < chance && jj >= 0 && jj < ys.length) {   // neighbour row: a short lane, or a rung to it
        if (Math.random() < 0.4) pushBranch({ axis: 'v', line: i, a: ys[j] + 0.5, b: ys[jj] + 0.5, peak: peak * 0.8 * boost }, now);
        else { const c = xs[i] + 0.5 + rand(-9, 9), len = rand(20, 44); pushBranch({ axis: 'h', line: jj, a: c - len / 2, b: c + len / 2, peak: peak * boost }, now); }
      }
      if (Math.random() < chance && ii >= 0 && ii < xs.length) {   // neighbour column
        if (Math.random() < 0.4) pushBranch({ axis: 'h', line: j, a: xs[i] + 0.5, b: xs[ii] + 0.5, peak: peak * 0.8 * boost }, now);
        else { const c = ys[j] + 0.5 + rand(-9, 9), len = rand(20, 44); pushBranch({ axis: 'v', line: ii, a: c - len / 2, b: c + len / 2, peak: peak * boost }, now); }
      }
    }
  }
  function advance(from, to, now) {   // Manhattan fill-in: a jump still reads as one continuous chain
    let { i, j } = from, guard = 0;
    while ((i !== to.i || j !== to.j) && guard++ < TRAIL.maxNodes) { if (i !== to.i) i += Math.sign(to.i - i); else j += Math.sign(to.j - j); pushNode(i, j); }
    spawnNetwork(to.i, to.j, now, 1, false);
  }
  const cellAt = (x, y) => ({ i: nearest(xs, x), j: nearest(ys, y - oy.v) });

  // ------------------------------------------------------------ light + input
  const light = { x: new Damp(), y: new Damp(), i: new Damp() };
  let sigma = 200, present = false, energy = 0, last = null, t = 0, dynamic = true, kind = 'mouse';
  const oy = new Damp();
  function pointer(x, y, k = 'mouse', down = false) {
    if (!ready || !dynamic) return;
    const now = performance.now();
    if (last && !down) { const dt = Math.max(8, now - last.t) / 1000; energy = Math.max(energy, Math.min(1, Math.hypot(x - last.x, y - last.y) / dt / 1100)); }
    if (light.i.v < 0.02) { light.x.snap(x); light.y.snap(y); }   // a fresh light appears where the hand is
    last = { x, y, t: now }; present = true; kind = k; tx = x; ty = y;
    if (down) {   // touch: a small bloom of lanes where the finger lands
      const c = cellAt(x, y); pushNode(c.i, c.j, 0.9); spawnNetwork(c.i, c.j, now, 0.9, true); lastCell = c; lastSample = now; return;
    }
    if (now - lastSample < TRAIL.sample) return;
    const c = cellAt(x, y);
    if (lastCell && c.i === lastCell.i && c.j === lastCell.j) return;
    lastSample = now;
    if (lastCell) advance(lastCell, c, now); else pushNode(c.i, c.j);
    lastCell = c;
  }
  let tx = 0, ty = 0;
  function leave() { present = false; last = null; lastCell = null; }
  function scroll(dy) {   // scrolling under a resting cursor: energy arrives from the scroll direction (L A Cabral)
    if (!ready || !dynamic || !present || kind !== 'mouse') return;
    const now = performance.now();
    if (now - lastScroll < TRAIL.scroll || Math.abs(dy) < 2) return;
    lastScroll = now;
    const c = cellAt(tx, ty), dir = -Math.sign(dy), steps = Math.min(TRAIL.maxScrollSteps, Math.max(1, Math.round(Math.abs(dy) / 60)));
    for (let s = steps; s >= 0; s--) {
      const j = c.j + dir * s; if (j < 0 || j >= ys.length) continue;
      pushNode(c.i, j, 0.82, now - s * 14);
      if (s % 2 === 0) spawnNetwork(c.i, j, now, 0.7, true);
    }
    lastCell = c;
  }

  // ------------------------------------------------------------ per frame
  // opts: { reduced, frozen (adaptive-quality static mode), scrollY (page), dpr }
  function step(dt, { reduced = false, frozen = false, scrollY = 0, dpr = 1 } = {}) {
    if (!ready) return;
    const now = performance.now();
    U.uLgDpr.value = dpr;
    const still = reduced || frozen;
    if (still !== !dynamic) { dynamic = !still; if (still) { path = []; branches = []; present = false; last = null; lastCell = null; } }
    if (!still) t += dt;
    // cursor light: damped position, intensity follows presence + gesture energy, fades out on leave
    energy *= Math.exp(-dt / 0.6);
    const target = present && dynamic ? 0.5 + 0.5 * energy : 0;
    light.x.step(tx, 0.16, dt); light.y.step(ty, 0.16, dt); light.i.step(target, present ? 0.22 : 0.55, dt);
    if (still) light.i.snap(0);
    U.uLgLight.value.set(light.x.v, light.y.v, sigma * (0.9 + 0.2 * energy), Math.max(0, light.i.v));
    // ambient light: drifts slowly over the grid when nobody interacts (the touch-screen alternative); still under reduced motion
    const W = L.W, H = L.H, cy = L.clover.cy, TAU = Math.PI * 2;
    const ax = W / 2 + 0.34 * W * Math.sin(TAU * t / 29), ay = cy + 0.3 * H * Math.sin(TAU * t / 23 + 1.3);
    U.uLgAmb.value.set(still ? W * 0.3 : ax, still ? cy - 0.18 * H : ay, sigma * 1.5, LOOK.ambient * (0.85 + 0.15 * Math.sin(TAU * t / 11)) * (1 - 0.75 * clamp(light.i.v, 0, 1)));
    // light behind the glass, breathing very slowly
    U.uLgGlow.value.set(L.W / 2, cy, L.clover.R * 1.25, LOOK.glow * (0.9 + 0.1 * Math.sin(TAU * t / 13)));
    // rows sit a little deeper than the name: they lag the scroll
    oyTarget = still ? 0 : clamp(scrollY, 0, H) * LOOK.parallax;
    oy.step(oyTarget, 0.25, dt);
    U.uLgRows.value.x = L.clover.cy + L.gutter / 2 + oy.v;
    lightTarget = target;
    // trails → segments (newest first: the cap drops the oldest)
    path = path.filter(n => now - n.t < n.life);
    branches = branches.filter(b => now - b.born < b.life);
    let n = 0;
    const seg = U.uLgSeg.value, segA = U.uLgSegA.value, Y = j => ys[j] + oy.v;
    for (let k = path.length - 1; k > 0 && n < MAX_SEG; k--) {
      const a = path[k - 1], b = path[k];
      if (Math.abs(a.i - b.i) + Math.abs(a.j - b.j) !== 1) continue;   // a seam between unrelated chains
      const boost = (a.boost + b.boost) / 2;
      const fa = clamp(1 - (now - a.t) / a.life, 0, 1) * TRAIL.tail * boost, fb = clamp(1 - (now - b.t) / b.life, 0, 1) * TRAIL.head * boost;
      if (fa <= 0.01 && fb <= 0.01) continue;
      if (a.j === b.j) seg[n].set(xs[a.i] + 0.5, Y(a.j), xs[b.i] + 0.5, Y(b.j)); else seg[n].set(xs[a.i], Y(a.j) + 0.5, xs[b.i], Y(b.j) + 0.5);
      segA[n++].set(fa, fb, 0, 0);
    }
    for (let k = branches.length - 1; k >= 0 && n < MAX_SEG; k--) {
      const b = branches[k], al = Math.sin(Math.PI * (now - b.born) / b.life) * b.peak;
      if (al <= 0.01) continue;
      if (b.axis === 'h') seg[n].set(b.a, Y(b.line), b.b, Y(b.line)); else seg[n].set(xs[b.line], b.a + oy.v, xs[b.line], b.b + oy.v);
      segA[n++].set(al * 0.7, al, 0, 0);
    }
    U.uLgSegN.value = n;
  }
  let lightTarget = 0, oyTarget = 0;
  // frames still needed after the clover itself has settled (reduced motion / static mode stop the hero loop)
  const busy = () => ready && (path.length > 0 || branches.length > 0 || !light.i.resting(lightTarget, 2e-3) || !oy.resting(oyTarget, 0.05));
  const stats = () => ({ on: true, dynamic, trails: path.length, branches: branches.length, segments: U.uLgSegN.value, light: +light.i.v.toFixed(3),
    rowParallaxPx: +oy.v.toFixed(1), columns: xs.length, rows: ys.length, occluders: U.uLgOccN.value });
  return { material, uniforms: U, layout, pointer, leave, scroll, step, busy, stats };
}
