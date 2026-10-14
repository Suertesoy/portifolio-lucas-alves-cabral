// Checkpoint 09 — B2 Optical Crystal, tuned for the typographic Hero (LUCAS / clover / CABRAL).
// Starts from the checkpoint-02 B shell (prototype/materials.js: same IOR, clearcoat veins, edge refraction) and
// changes only how the glass treats what is behind it:
//
//  1. Depth refraction. three.js offsets the transmission sample by `thickness` along the refracted ray, so the
//     shift is tiny everywhere: ≈0 on the flat leaf tops and ≈0 at the rim (where the thickness map is 0). That is
//     why the letters barely moved in checkpoint 08. Here the refracted ray travels an optical depth `uDepth` behind
//     the glass before it meets the letters, so the shift scales with how steep the surface is, like a real lens.
//     `uDepth` is proportional to the clover size (same look at every viewport); `uLens` is the art-directed gain
//     (1 = one refracting surface, ≈2 = biconvex). The shift is 0 at the silhouette and fades in across the rim
//     bead (`uEdgeFade`, on the thickness map), and `uMaxShift` soft-clamps it (tanh): letters enter the glass
//     unbroken and bend inside it. No white bands and no mirrored band at the rim.
//  2. Ink-aware engraving. The engraved veins live on the clearcoat. Over the dark letters, their reflections read
//     as light scratches across the type. The glass now samples the plate behind each fragment (blurred mip of the
//     transmission buffer) and lowers the vein relief where there is ink (`uInkVein` = relief kept over ink).
//  3. Sage accent (`uSage`, 0…1). It tints only the rim (the refracted environment at grazing angles) and, more
//     faintly, the thick centre through Beer absorption. The body stays colourless (Optical, not Organic).
//  4. Chromatic dispersion becomes visible because of (1). The three IORs now land on different points, so the
//     letter edges get a thin prismatic fringe where the lens is steepest (kept low: strong fringes look cheap).
import * as THREE from 'three';

const pars = THREE.ShaderChunk.transmission_pars_fragment;
const transmission = THREE.ShaderChunk.transmission_fragment;
const ccMaps = THREE.ShaderChunk.clearcoat_normal_fragment_maps;

function mustReplace(src, from, to, all = false) {
  if (!src.includes(from)) throw new Error('optical-glass: shader chunk changed, missing: ' + from.slice(0, 60));
  return all ? src.split(from).join(to) : src.replace(from, to);
}

// (1) The refracted ray, extended to the plate. `thickness` keeps its three.js meaning only for absorption.
const LENS_RAY = `
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		if ( uLens <= 0.0 ) return normalize( refractionVector ) * thickness * modelScale;   // checkpoint-08 behaviour
		vec3 d = - v;                                                // view ray (camera → fragment)
		vec3 r = normalize( d + ( normalize( refractionVector ) - d ) * uLens );
		// lateral offset of the bent ray after the optical depth uDepth (art-directed: proportional to the clover size,
		// so the lens looks the same at every viewport)
		vec3 shift = ( r / max( - r.z, 0.05 ) - d / max( - d.z, 0.05 ) ) * uDepth;
		// continuity at the silhouette: no shift on the rim bead (thickness map ≈ 0…0.5 there), full shift on the dome.
		// Letters enter the glass unbroken and bend inside it, instead of jumping (white bands) or mirroring at the rim.
		shift *= smoothstep( uEdgeFade.x, uEdgeFade.y, thickness / uThickness0 ) * smoothstep( 0.15, 0.6, abs( dot( normalize( n ), v ) ) );
		float L = length( shift );
		shift *= uMaxShift * tanh( L / uMaxShift ) / max( L, 1e-6 );
		vec3 hitStraight = d * ( max( vWorldPosition.z - uPlateZ, 0.0 ) / max( - d.z, 0.05 ) );   // the plate seen without glass
		return hitStraight + shift;
	}
	float lensPath( const in float thickness, const in mat4 modelMatrix ) { return thickness * length( vec3( modelMatrix[ 0 ].xyz ) ); }
`;

function patchedPars() {
  let s = pars;
  const a = s.indexOf('vec3 getVolumeTransmissionRay('), b = s.indexOf('float applyIorToRoughness(');
  if (a < 0 || b < 0) throw new Error('optical-glass: transmission_pars_fragment layout changed');
  s = s.slice(0, a) + LENS_RAY + '\n\t' + s.slice(b);
  // absorption follows the glass thickness, not the (now much longer) ray to the plate
  s = mustReplace(s, 'volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )',
    'volumeAttenuation( lensPath( thickness, modelMatrix ), attenuationColor, attenuationDistance )', true);
  return s;
}

// (2) Vein relief modulated by the ink behind the fragment.
const INK_VEINS = mustReplace(ccMaps, 'clearcoatMapN.xy *= clearcoatNormalScale;', `
	float inkL = dot( textureLod( transmissionSamplerMap, gl_FragCoord.xy / transmissionSamplerSize, 3.0 ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	float ink = 1.0 - smoothstep( 0.06, 0.5, inkL );
	clearcoatMapN.xy *= clearcoatNormalScale * mix( 1.0, uInkVein, ink );`);

// (3) Edge refraction of checkpoint 02 (materials.js addEdgeRefraction) + the sage rim tint.
const EDGE = mustReplace(transmission, 'material.transmissionAlpha = mix(', `
	#ifdef USE_ENVMAP
	{
		float edgeK = pow( 1.0 - saturate( dot( n, v ) ), uEdgePow ) * uEdgeMix;
		vec3 rdir = refract( -v, n, 1.0 / material.ior );
		vec3 envR = textureCubeUV( envMap, envMapRotation * rdir, 0.03 ).rgb * envMapIntensity;
		vec3 rimTint = mix( material.attenuationColor, uSageColor, uSage );
		vec3 absorbed = envR * pow( rimTint, vec3( uEdgeAbsorb ) );
		transmitted.rgb = mix( transmitted.rgb, absorbed, edgeK );
	}
	#endif
	material.transmissionAlpha = mix(`);

export const OPTICS = {
  lens: 0.8,          // refraction gain (0 = checkpoint-08 three.js thickness offset)
  depth: 0.7,         // optical depth of the letters behind the glass, × clover height
  maxShift: 0.14,     // soft limit of the shift, × clover height
  edgeFade: [0.42, 0.8],   // thickness-map range over which the shift fades in from the rim
  inkVein: 0.18,      // fraction of vein relief kept over the letters
  sage: 0.45,         // rim + centre accent
  dispersion: 1.4,
};
const CLEAR = new THREE.Color('#e4efe1'), SAGE_ATT = new THREE.Color('#c9d9c2');

export function createOpticalGlass(tex, o = {}) {
  o = { ...OPTICS, ...o };
  const U = {
    uLens: { value: o.lens }, uEdgeFade: { value: new THREE.Vector2(...o.edgeFade) }, uThickness0: { value: 0.16 }, uDepth: { value: 0.6 }, uPlateZ: { value: -0.6 }, uMaxShift: { value: 0.08 }, uInkVein: { value: o.inkVein },
    uSage: { value: o.sage }, uSageColor: { value: new THREE.Color('#7f9b78') },
    uEdgePow: { value: 1.6 }, uEdgeMix: { value: 0.85 }, uEdgeAbsorb: { value: 0.8 },   // = materials.js (B)
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', transmission: 1, thickness: 0.16, thicknessMap: tex.thickness,
    attenuationColor: CLEAR.clone(), attenuationDistance: 0.6,
    ior: 1.52, dispersion: o.dispersion, roughness: 0.0, specularIntensity: 1,
    clearcoat: 1, clearcoatRoughness: 0.02, clearcoatNormalMap: tex.veinNormal, clearcoatNormalScale: new THREE.Vector2(1, 1),
    envMapIntensity: 1.0,
  });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = 'uniform float uLens;\nuniform vec2 uEdgeFade;\nuniform float uThickness0;\nuniform float uDepth;\nuniform float uPlateZ;\nuniform float uMaxShift;\nuniform float uInkVein;\nuniform float uSage;\nuniform vec3 uSageColor;\n'
      + 'uniform float uEdgePow;\nuniform float uEdgeMix;\nuniform float uEdgeAbsorb;\n'
      + mustReplace(mustReplace(mustReplace(sh.fragmentShader,
        '#include <transmission_pars_fragment>', patchedPars()),
        '#include <clearcoat_normal_fragment_maps>', INK_VEINS),
        '#include <transmission_fragment>', EDGE);
  };
  mat.customProgramCacheKey = () => 'hero-b2-optical';

  const set = {
    lens: v => { U.uLens.value = v; },
    // called every frame with the clover height in world units: the optics scale with the sculpture
    scale: hWorld => { U.uDepth.value = o.depth * hWorld; U.uMaxShift.value = o.maxShift * hWorld; },
    inkVein: v => { U.uInkVein.value = v; },
    plateZ: v => { U.uPlateZ.value = v; },
    // the centre accent is Beer absorption: a faintly sage attenuation colour, visible only where the lens is thick
    sage: v => { U.uSage.value = v; mat.attenuationColor.copy(CLEAR).lerp(SAGE_ATT, v); },
  };
  set.sage(o.sage);
  return { mat, uniforms: U, set };
}
