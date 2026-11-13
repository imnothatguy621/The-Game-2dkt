/* ================= BODY 2: realistic players =================
   Runs on top of the new Blender-made body. Everything is drawn in the player shader:
   - natural skin tones with a soft glow and fine skin detail
   - real faces: eye whites, coloured irises, pupils, eyelids, eyebrows, nose shading, lips, ears, some beards
   - six hair styles with real volume (the hair sits on top of the head, not painted flat):
     0 short crop · 1 quiff · 2 buzz cut · 3 bald · 4 curly · 5 long with a bun
   - hair strands and shine, curls for curly hair
   - boots with soles, a side stripe and laces, in many more colours
   - fine fabric weave on shirts, shorts and socks (fades out with distance so it never flickers)
   The skeleton and animations are untouched. */
(() => {
  if (typeof kitMaterial !== 'function' || typeof SKIN === 'undefined') return;

  // natural skin tones, light to dark
  [0xe9bf9f, 0xd6a27e, 0xb98463, 0x8e5b3d, 0x5f3c28, 0xecc6aa, 0xa36e50].forEach((c, i) => { SKIN[i] = c; });
  // natural hair colours (black, browns, blond, ginger)
  [0x15100c, 0x3b2615, 0x5a3a20, 0xc9a25e, 0x0b0b0b, 0x8a3a1a, 0x2a1b10].forEach((c, i) => { HAIR[i] = c; });
  // many more boot colours: the first five are the classics, then bright modern ones
  if (BOOTS.length < 12) BOOTS.push(0xff7a00, 0x7b3fe4, 0x00c2c7, 0xd4af37, 0xc6ff00, 0xff2d7a, 0x0a2a6b, 0x9aa5b1);

  const HAIRFN = `
    float hairMask(vec3 p, float st, float sd) {
      if ((st > 2.5 && st < 3.5) || p.y < 1.5) return 0.;
      vec2 d = normalize(p.xz + vec2(1e-4, 1e-4));
      float fz = d.y, side = abs(d.x);
      float front = st < .5 ? 1.748 : st < 1.5 ? 1.736 : st < 2.5 ? 1.752 : st < 4.5 ? 1.734 : 1.742;
      float back  = st < .5 ? 1.632 : st < 1.5 ? 1.605 : st < 2.5 ? 1.638 : st < 4.5 ? 1.600 : 1.530;
      float line = mix(back, front, smoothstep(-.55, .85, fz));
      line += smoothstep(.55, .95, side) * step(0., fz) * .012;          // temples
      line += sin(atan(p.x, p.z) * 11. + sd * 40.) * .0035;               // natural uneven edge
      if (p.z > (st > 4.5 ? .02 : -.04)) line = max(line, mix(line, 1.696, smoothstep(.45, .8, side)));   // keep ears and cheeks clear
      return smoothstep(line - .0025, line + .0025, p.y);
    }`;

  const VERT = (joints) => `
      {
        vec3 p0 = position;
        // slightly slimmer hips and shorts
        float w = smoothstep(.6, .72, p0.y) * (1. - smoothstep(.94, 1.06, p0.y));
        transformed.xz *= 1. - .06 * w;
        // hair volume: push the hair out from the scalp
        float hm = hairMask(p0, hairStyle, pSeed);
        if (hm > 0.) {
          float st = hairStyle, vol;
          if (st < .5) vol = .007;
          else if (st < 1.5) vol = .009 + .02 * smoothstep(1.71, 1.79, p0.y) * smoothstep(-.02, .1, p0.z);   // quiff
          else if (st < 2.5) vol = .0015;
          else if (st < 4.5) vol = .02 + .007 * abs(sin(p0.x * 120. + sin(p0.y * 90.)) * sin(p0.y * 120. + sin(p0.z * 90.)));  // curly
          else vol = .009 + .035 * max(0., 1. - length(p0 - vec3(0., 1.775, -.085)) / .055);            // bun
          transformed += normalize(normal) * hm * vol;
        }
        ${joints ? 'transformed -= normal * .024;' : ''}
      }`;

  const HEAD = `
        else {
          col = cSkin; sk = 1.;
          float s1 = fract(pSeed * 7.13), s2 = fract(pSeed * 13.71), s3 = fract(pSeed * 3.31), s4 = fract(pSeed * 21.9);
          float hm = hairMask(p, hairStyle, pSeed);
          if (hm > .5) {
            float ang = atan(p.x, p.z);
            float flow = ang * 60. + p.y * 40. + sin(ang * 7. + p.y * 30. + s1 * 9.) * 3.;
            float clumps = sin(ang * 23. + sin(p.y * 47.) * 1.5 + s1 * 5.) * .5 + .5;
            float strands = mix(sin(flow * 2.3) * .5 + .5, clumps, .55) * (.75 + .25 * sin(flow * 7.1 + p.y * 300.));
            vec3 cq = p * 210.;
            float curls = 1. - abs(sin(cq.x + sin(cq.y * .9) * 1.6) * sin(cq.y + sin(cq.z * 1.1) * 1.6) * sin(cq.z + sin(cq.x) * 1.6));
            curls = .35 + .65 * curls;
            float t = (hairStyle > 3.5 && hairStyle < 4.5) ? curls : strands;
            col = cHair * (.66 + .5 * t); rough = .6 + .3 * (1. - t); sk = 0.;
            if (hairStyle > 1.5 && hairStyle < 2.5) {
              float dots = fract(sin(dot(floor(p * 1400.), vec3(12.99, 78.23, 37.71))) * 43758.55);
              col = mix(cSkin * .55, cHair, .78 + .2 * dots); rough = .75;
            }
          } else {
            float frontF = smoothstep(.06, .1, p.z);
            // fine skin detail (smooth, fades out with distance)
            float fwS = fwidth(p.y) * 1500.;
            float pore = sin(p.x * 2300.) * sin(p.y * 2100. + 1.7) * sin(p.z * 2500. + 4.1);
            col *= 1. + .03 * pore * (1. - smoothstep(.3, 1., fwS));
            // ears at the sides of the head
            float ear = 1. - smoothstep(.8, 1., length(vec2((p.y - 1.668) / .03, (p.z - .004) / .02)));
            col *= 1. - .1 * ear * smoothstep(.068, .078, ax);
            if (p.z > -.03) {
              // eyes
              float ex = ax - .033, ey = p.y - 1.682;
              float e = length(vec2(ex, ey * 1.65));
              vec3 iris = s2 < .55 ? vec3(.10, .045, .02) : s2 < .75 ? vec3(.16, .09, .03) : s2 < .9 ? vec3(.12, .2, .09) : vec3(.12, .22, .38);
              col *= 1. - .14 * (1. - smoothstep(.011, .019, e));                       // soft shadow around the eye
              if (e < .0118) {
                vec3 ec = vec3(.78, .76, .72);                                            // eye white
                ec = mix(iris * (1.15 - e * 45.), ec, smoothstep(.0068, .0078, e));       // iris
                ec = mix(vec3(.01), ec, smoothstep(.0028, .0036, e));                     // pupil
                ec = mix(ec, vec3(.92), 1. - smoothstep(.0009, .0015, length(vec2(ex + .0022, ey - .0024)))); // catchlight
                ec = mix(ec, cSkin * .42, smoothstep(.0028, .0042, ey) * smoothstep(.0076, .0092, e));      // upper eyelid
                col = mix(ec, col, smoothstep(.0108, .0122, e));
                rough = .2; sk = 0.;
              }
              // eyebrows (soft edged, thinner towards the outside)
              float by = 1.7035 - ex * ex * 6. + (ax - .02) * .02;
              float th = .0044 - smoothstep(.035, .058, ax) * .0022;
              float brow = (1. - smoothstep(th * .55, th, abs(p.y - by))) * smoothstep(.011, .016, ax) * (1. - smoothstep(.052, .06, ax));
              if (brow > 0.) {
                vec3 bc = (hairStyle > 2.5 && hairStyle < 3.5) ? vec3(.05, .035, .025) : cHair * .78;
                col = mix(col, bc, brow * .9); if (brow > .5) sk = 0.;
              }
              // nose: shading down both sides of the nose, soft nostrils
              float nb = smoothstep(1.622, 1.634, p.y) * (1. - smoothstep(1.666, 1.68, p.y));
              nb *= smoothstep(1.636, 1.652, p.y) * .6 + .4 * smoothstep(1.622, 1.636, p.y) * (1. - smoothstep(1.645, 1.66, p.y));
              col *= 1. - .12 * nb * smoothstep(.003, .011, ax) * (1. - smoothstep(.011, .026, ax));
              col *= 1. - .4 * (1. - smoothstep(.0018, .0034, length(vec2(ax - .0072, (p.y - 1.6305) * 1.4))));
              col *= 1. + .05 * nb * (1. - smoothstep(0., .005, ax));                   // highlight down the bridge
              // lips: soft shape, slightly fuller lower lip, mouth line
              float lipW = 1. - smoothstep(.016, .025, ax);
              float lTop = 1.6118 - ax * ax * 4.5 + .0012 * exp(-pow(ax / .004, 2.)) * -1.;   // cupid's bow dip in the middle
              float lBot = 1.5995 + ax * ax * 6.;
              float lipM = lipW * smoothstep(lBot - .0012, lBot + .0012, p.y) * (1. - smoothstep(lTop - .0012, lTop + .0012, p.y));
              vec3 lip = cSkin * vec3(.97, .8, .79) * (p.y > 1.6068 ? .8 : .92);
              col = mix(col, lip, lipM * .9);
              col *= 1. - .6 * exp(-pow((p.y - 1.6066) / .0009, 2.)) * (1. - smoothstep(.014, .023, ax));
              col *= 1. - .08 * (1. - smoothstep(0., .006, abs(p.y - 1.596))) * lipW;      // shadow under the lip
              if (lipM > .4) rough = .35;
              // cheek colour
              col = mix(col, col * vec3(1.05, .95, .93), .14 * max(0., 1. - length(vec2(ax - .046, p.y - 1.648)) / .02));
              // beards on some players: light stubble or a short beard, never covering the lips
              if (s3 > .62 && (hairStyle < 2.5 || hairStyle > 3.5)) {
                float bTop = 1.6 + min(ax * ax * 14., .045);         // beard line rises towards the sideburns, slightly ragged
                float bm = (1. - smoothstep(bTop - .014, bTop + .012, p.y)) * smoothstep(1.552, 1.575, p.y);
                bm *= .75 + .25 * smoothstep(1.6, 1.575, p.y);                          // thicker on the chin than the cheeks
                bm = max(bm, .8 * exp(-pow((p.y - 1.6205) / .005, 2.)) * exp(-pow(ax / .02, 4.)) * step(.5, s4)); // soft moustache
                bm *= 1. - lipM;
                bm *= smoothstep(-.03, .05, p.z - ax * .25);                          // fade out softly towards the ears
                vec3 hq = floor(p * 1500.);
                float hn = fract(sin(dot(hq, vec3(12.99, 78.23, 37.71))) * 43758.55);
                float fwB = fwidth(p.y) * 1500.;
                hn = mix(hn, .5, smoothstep(.3, 1., fwB));                          // no grain at a distance
                col = mix(col, mix(col * .5, cHair * .6, .6), bm * (s4 > .7 ? .6 : .38) * (.5 + .5 * hn));
              }
            }
          }
        }
        diffuseColor.rgb = col; region = rough;`;

  const BOOT = `if (p.y < .095) {
          col = cBoots; rough = .28;
          float lum = dot(cBoots, vec3(.3, .59, .11));
          vec3 accent = lum > .45 ? vec3(.03) : vec3(.92);
          if (abs(p.y - .046 - p.z * .22) < .0065 && abs(p.z) < .1) col = mix(cBoots, accent, .9);   // side stripe
          if (p.z > .045 && p.y > .055 && fract(p.z * 140.) < .35) col = mix(col, vec3(.9), .55);       // laces
          if (p.y < .017) { col = lum > .45 ? vec3(.04) : vec3(.88); rough = .75; }                   // sole
        }`;

  function patch(sh, joints, seedU) {
    sh.uniforms.pSeed = seedU;
    sh.vertexShader = sh.vertexShader
      .replace('varying vec3 vBind;', 'varying vec3 vBind; uniform float hairStyle; uniform float pSeed;' + HAIRFN)
      .replace('#include <begin_vertex>\nvBind = position;', '#include <begin_vertex>\nvBind = position;' + VERT(joints));
    let f = sh.fragmentShader
      .replace('float region;', 'float region; float isSkin; float sk; uniform float pSeed;' + HAIRFN)
      .replace('vec3 col = cSkin; float rough = .58;', 'vec3 col = cSkin; float rough = .58; sk = 0.;')
      .replace('if (p.y < .095) { col = cBoots; rough = .25; }', BOOT);
    f = f.replace(/else \{\s*col = cSkin;\s*\/\/ hair: top and back of the head[\s\S]*?diffuseColor\.rgb = col; region = rough;/, HEAD);
    // skin glow + fine fabric weave that fades out with distance
    f = f.replace('diffuseColor.rgb = col; region = rough;', `
        isSkin = max(sk, (col == cSkin) ? 1. : 0.);
        if (isSkin > .5) rough = .46;
        else if (p.y > .1 && p.y < 1.62) {
          float fw = fwidth(p.y) * 900.;
          float weave = (sin(p.y * 2400.) * sin(atan(p.x, p.z) * 380. + p.x * 900.)) * .5 + .5;
          col *= mix(1., .93 + .1 * weave, 1. - smoothstep(.4, 1.2, fw));
        }
        diffuseColor.rgb = col; region = rough;`);
    sh.fragmentShader = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += isSkin * diffuseColor.rgb * vec3(.06, .028, .02);');
  }

  const _kit = kitMaterial;
  kitMaterial = function (opts) {
    const seedU = { value:Math.random() };
    let shared = null;
    const make = joints => {
      const m = _kit(opts), ob = m.onBeforeCompile;
      m.extensions = { derivatives:true };
      m.onBeforeCompile = sh => { ob(sh); if (joints && shared) Object.assign(sh.uniforms, shared); patch(sh, joints, seedU); };
      m.customProgramCacheKey = () => 'kit3' + (joints ? 'j' : 's') + (opts.longSleeve ? 1 : 0);
      return m;
    };
    const m = make(false); shared = m.userData.kit;
    m.userData.jointMat = make(true);
    return m;
  };
})();
