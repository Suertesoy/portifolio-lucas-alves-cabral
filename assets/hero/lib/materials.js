// Real-time clover materials and assets, calibrated in checkpoint 02. Shared by the look-dev scene and the
// hero study so every frame uses exactly the same Organic Crystal (A) and Optical Crystal (B).
import * as THREE from 'three';
import { buildCloverGeometry, loadSDF, thicknessTexture, PROFILE, CORE } from './clover-geometry.js';
import { normalMapFrom } from './studio.js';

const MASTER_PX = 1254;

// Overridable parameters (look-dev query params map onto these); defaults are the checkpoint-02 calibration.
export const DEFAULTS = { att: '#c2cfae', attd: 1.0, glow: 0.9, disp: 0.2, vein: 1 };

export function shadowTexture(sdf, { strength = 1, caustic = 0, tint = [255, 250, 232] } = {}) {
  // Art-directed (not simulated) contact shadow + caustic, both derived from the same SDF so the symbol
  // stays consistent even in its shadow. Glass throws a soft shadow with focused light inside it.
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = Math.min(sdf.W - 1, (i + 0.5) / n * sdf.W) | 0, y = Math.min(sdf.H - 1, (j + 0.5) / n * sdf.H) | 0;
    const d = sdf.data[y * sdf.W + x];
    const sh = Math.max(0, Math.min(1, (d + 50) / 100)), ca = Math.max(0, Math.min(1, (d - 30) / 60));
    const shadowA = sh * sh * 55 * strength, causticA = ca * 255 * caustic;
    // composite: caustic light wins where present, otherwise warm-grey shadow
    img.data.set(causticA > shadowA ? [...tint, Math.round(causticA)] : [62, 60, 52, Math.round(shadowA)], (j * n + i) * 4);
  }
  g.putImageData(img, 0, 0);
  g.filter = 'blur(9px)'; g.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- edge refraction ----------
// three.js transmission is screen-space: a refracted ray can only fetch what is inside the frame. At the
// rims real glass refracts the (dark) studio outside the frame — that is what draws crystal edges. This
// extension blends, for grazing angles only, the environment sampled along the REFRACTED direction,
// absorbed by the glass tint in proportion to the longer path length through the rim.
export function addEdgeRefraction(mat, { pow = 2.5, amount = 0.9, absorb = 2.0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEdgePow = { value: pow }; sh.uniforms.uEdgeMix = { value: amount }; sh.uniforms.uEdgeAbsorb = { value: absorb };
    sh.fragmentShader = 'uniform float uEdgePow;\nuniform float uEdgeMix;\nuniform float uEdgeAbsorb;\n' + sh.fragmentShader.replace(
      '#include <transmission_fragment>',
      THREE.ShaderChunk.transmission_fragment.replace('material.transmissionAlpha = mix(', `
      #ifdef USE_ENVMAP
      {
        float edgeK = pow( 1.0 - saturate( dot( n, v ) ), uEdgePow ) * uEdgeMix;
        vec3 rdir = refract( -v, n, 1.0 / material.ior );
        vec3 envR = textureCubeUV( envMap, envMapRotation * rdir, 0.03 ).rgb * envMapIntensity;
        vec3 absorbed = envR * pow( material.attenuationColor, vec3( uEdgeAbsorb ) );
        transmitted.rgb = mix( transmitted.rgb, absorbed, edgeK );
      }
      #endif
      material.transmissionAlpha = mix(`));
  };
  mat.customProgramCacheKey = () => `edge-${pow}-${amount}-${absorb}`;
  return mat;
}

// ---------- materials ----------
// Both studies share the SAME outer shell geometry. Differences are material only:
//   A — sage-tinted glass shell + an inner leaf core carrying the master's veins (leaf encased in glass)
//   B — near-colourless optical glass shell, veins engraved into the reflective layer, no core
export function createMaterials(tex, o = DEFAULTS) {
  o = { ...DEFAULTS, ...o };
  const shellA = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', transmission: 1, thickness: 0.12, thicknessMap: tex.thickness,
    attenuationColor: new THREE.Color(o.att), attenuationDistance: +o.attd,
    ior: 1.5, roughness: 0.0, specularIntensity: 1, specularColor: new THREE.Color('#fff2d2'),
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.0,
  });
  const coreA = new THREE.MeshStandardMaterial({
    map: tex.albedo, roughness: 0.5, metalness: 0,
    // real-time stand-in for light transmitted THROUGH the leaf from the wall behind (three.js transmission
    // can't see one transmissive object through another); calibrated against the master's mean luma
    emissive: new THREE.Color('#ffffff'), emissiveMap: tex.albedo, emissiveIntensity: +o.glow,
  });
  const shellB = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', transmission: 1, thickness: 0.12, thicknessMap: tex.thickness,
    attenuationColor: new THREE.Color('#e4efe1'), attenuationDistance: 1.2,
    ior: 1.52, dispersion: +o.disp, roughness: 0.0, specularIntensity: 1,
    // engraved veins live on the clearcoat (reflection) layer only: they read as engraving in the
    // reflections without bending the light that passes through (relief on the base normal frays
    // refracted letter edges)
    clearcoat: 1, clearcoatRoughness: 0.02, clearcoatNormalMap: tex.veinNormal,
    clearcoatNormalScale: new THREE.Vector2(1, 1).multiplyScalar(+o.vein),
    envMapIntensity: 1.0,
  });
  addEdgeRefraction(shellA, { pow: 1.3, amount: 0.95, absorb: 4.0 });
  addEdgeRefraction(shellB, { pow: 1.6, amount: 0.85, absorb: 0.8 });
  return { shellA, coreA, shellB };
}

const loadTexOnce = (url, srgb) => new Promise((res, rej) => new THREE.TextureLoader().load(url, t => {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; res(t);
}, undefined, () => rej(new Error('texture failed: ' + url))));
export const loadTex = async (url, srgb) => { for (let i = 0; ; i++) try { return await loadTexOnce(url, srgb); } catch (e) { if (i >= 2) throw e; } };

// Fields, geometry and textures of the canonical clover. `textures: false` skips texture loading.
export async function loadClover(root, { textures = true } = {}) {
  const src = root + 'explorations/source/';
  const [sdf, coreSdf, dome, coreDome] = await Promise.all(
    ['clover-sdf', 'clover-core-sdf', 'clover-dome', 'clover-core-dome'].map(n => loadSDF(src + n + '.f32', MASTER_PX, MASTER_PX)));
  const geo = buildCloverGeometry(sdf, PROFILE, dome);
  const coreGeo = buildCloverGeometry(coreSdf, CORE, coreDome);
  if (!textures) return { sdf, geo, coreGeo };
  const [albedo, veinNormal] = await Promise.all([loadTex(src + 'clover-albedo.png', true), normalMapFrom(src + 'clover-veins-ridge.png', 3)]);
  const { tex: thickness, maxThicknessPx } = thicknessTexture(sdf, PROFILE, 512, dome);
  return { sdf, geo, coreGeo, tex: { albedo, veinNormal, thickness }, maxThicknessPx };
}
