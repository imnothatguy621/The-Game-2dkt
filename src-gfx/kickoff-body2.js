/* ================= BODY 2: less "wooden mannequin", more footballer =================
   - natural skin tones (the old palette had orange, varnished-wood tones)
   - skin gets a soft warm glow and smoother sheen, like light passing through skin
   - the ball-shaped knee/elbow/shoulder joints are pulled in so they stop bulging out
   - slimmer hips and shorts
   Everything runs in the player shader; the skeleton and animations are untouched. */
(() => {
  if (typeof kitMaterial !== 'function' || typeof SKIN === 'undefined') return;

  // natural skin tones, light to dark
  [0xf0c9aa, 0xdcaa86, 0xbb8866, 0x8e5b3d, 0x5f3c28, 0xf6d6c0, 0xa36e50].forEach((c, i) => { SKIN[i] = c; });

  const VERT = (joints) => `
      {
        vec3 p0 = position;
        // slimmer hips and shorts: pull in towards the body's centre line between the waist and mid-thigh
        float w = smoothstep(.6, .72, p0.y) * (1. - smoothstep(.94, 1.06, p0.y));
        transformed.xz *= 1. - .06 * w;
        ${joints ? `
        // joint balls: sink them into the body so knees, elbows and shoulders stop looking like doll joints
        transformed -= normal * .024;
        ` : ''}
      }`;

  function patch(sh, joints) {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>\nvBind = position;', '#include <begin_vertex>\nvBind = position;' + VERT(joints));
    // remember which pixels are skin, then give skin a gentle warm glow (cheap stand-in for light scattering in skin)
    sh.fragmentShader = sh.fragmentShader
      .replace('float region;', 'float region; float isSkin;')
      .replace('diffuseColor.rgb = col; region = rough;', 'isSkin = (col == cSkin) ? 1. : 0.; if (isSkin > .5) rough = .46; diffuseColor.rgb = col; region = rough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += isSkin * diffuseColor.rgb * vec3(.10, .045, .03);');
  }

  const _kit = kitMaterial;
  kitMaterial = function (opts) {
    let shared = null;
    const make = joints => {
      const m = _kit(opts), ob = m.onBeforeCompile;
      m.onBeforeCompile = sh => { ob(sh); if (joints && shared) Object.assign(sh.uniforms, shared); patch(sh, joints); };
      m.customProgramCacheKey = () => 'kit2' + (joints ? 'j' : 's') + (opts.longSleeve ? 1 : 0);
      return m;
    };
    const m = make(false); shared = m.userData.kit;   // the joint material uses the same colour settings
    m.userData.jointMat = make(true);
    return m;
  };
})();
