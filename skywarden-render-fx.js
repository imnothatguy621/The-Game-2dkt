// Skywarden render FX module (extracted from skywarden.html; three.js r128)
// Lives inside the game's main script, after the world, HUD and gameplay code.

/* =====================================================================
   RENDER FX — post-processing, atmosphere, materials, VFX juice
   ===================================================================== */

/* ---------- 1. Final grade pass: speed blur, chromatic aberration, lift/gamma/gain, vignette, grain ---------- */
const GradeShader = {
  uniforms:{
    tDiffuse:{ value:null }, uTime:{ value:0 }, uRes:{ value:new THREE.Vector2(1, 1) },
    uLift:{ value:new V3(.01, .015, .03) }, uGamma:{ value:new V3(1, 1, 1) }, uGain:{ value:new V3(1.02, 1, .98) },
    uSat:{ value:1.08 }, uVig:{ value:.32 }, uGrain:{ value:.035 }, uCA:{ value:.0015 }, uSpeed:{ value:0 },
    uTint:{ value:new V3(1, .2, .25) }, uTintAmt:{ value:0 }
  },
  vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader:[
    'uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes;',
    'uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain; uniform float uSat; uniform float uVig; uniform float uGrain; uniform float uCA; uniform float uSpeed;',
    'uniform vec3 uTint; uniform float uTintAmt; varying vec2 vUv;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'vec3 sampleCA(vec2 uv, vec2 c, float ca){ return vec3(texture2D(tDiffuse, uv + c * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ca).b); }',
    'void main(){',
    '  vec2 c = vUv - 0.5; float r2 = dot(c, c);',
    '  float ca = uCA * (0.4 + r2 * 3.0);',
    '  vec3 col = sampleCA(vUv, c, ca);',
    '  if (uSpeed > 0.01) {',            // radial speed blur, strongest at the edges
    '    vec3 acc = col; float w = 1.0;',
    '    for (int i = 1; i < 7; i++) { float k = float(i) / 6.0; vec2 uv = 0.5 + c * (1.0 - uSpeed * 0.06 * k * (0.3 + r2 * 4.0)); acc += sampleCA(uv, c, ca) * (1.0 - k * 0.5); w += 1.0 - k * 0.5; }',
    '    col = acc / w;',
    '  }',
    '  col = max(col * uGain + uLift * (1.0 - col), 0.0);',
    '  col = pow(col, 1.0 / uGamma);',
    '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(vec3(l), col, uSat);',
    '  col = mix(col, col * uTint + uTint * 0.15, uTintAmt);',
    '  float vig = smoothstep(0.32, 0.95, length(c * vec2(1.1, 1.0)));',
    '  col *= 1.0 - uVig * vig;',
    '  col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n')
};
let gradePass = null;
const GRADES = {
  earthNight:{ lift:[.012, .018, .038], gamma:[1, 1, 1.02], gain:[1.03, 1.0, .97], sat:1.1, vig:.34, grain:.035 },
  earthDay:{ lift:[.01, .01, .015], gamma:[1.02, 1, .99], gain:[1.05, 1.02, .97], sat:1.06, vig:.22, grain:.02 },
  halo:{ lift:[.008, .01, .03], gamma:[1, 1, 1.03], gain:[1.02, 1.0, 1.02], sat:1.05, vig:.42, grain:.03 },
  vesper:{ lift:[.035, .015, .0], gamma:[1.02, 1, .96], gain:[1.08, 1.0, .9], sat:1.12, vig:.3, grain:.04 },
  thalassa:{ lift:[.0, .02, .03], gamma:[1, 1.01, 1.02], gain:[.98, 1.03, 1.05], sat:1.12, vig:.22, grain:.02 },
  kryos:{ lift:[.02, .03, .05], gamma:[.98, 1, 1.04], gain:[.96, 1.0, 1.08], sat:.92, vig:.24, grain:.025 },
  noctis:{ lift:[.03, .0, .05], gamma:[1, .98, 1.04], gain:[1.04, .96, 1.08], sat:1.2, vig:.42, grain:.045 }
};
function gradeTarget() { return WORLD_ID === 'earth' ? (ENV.day ? GRADES.earthDay : GRADES.earthNight) : (GRADES[WORLD_ID] || GRADES.earthNight); }
function setupGrade() {
  if (!composer || !THREE.ShaderPass) return;
  try {
    // multisampled scene target so the post chain keeps proper anti-aliasing (WebGL2)
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
      const rt = new THREE.WebGLMultisampleRenderTarget(innerWidth, innerHeight, { format:THREE.RGBAFormat });
      rt.samples = isTouch ? 2 : 4;
      const passes = composer.passes.slice();
      composer = new THREE.EffectComposer(renderer, rt);
      passes.forEach(p_ => composer.addPass(p_));
    }
    gradePass = new THREE.ShaderPass(GradeShader);
    composer.addPass(gradePass);
  } catch (e) { gradePass = null; }
}
setupGrade();
const _g = { lift:new V3(), gamma:new V3(), gain:new V3() };
function updateGrade(rdt) {
  if (!gradePass) return;
  const u = gradePass.uniforms, tg = gradeTarget(), k = Math.min(1, rdt * 2);
  u.uLift.value.lerp(_g.lift.set(...tg.lift), k); u.uGamma.value.lerp(_g.gamma.set(...tg.gamma), k); u.uGain.value.lerp(_g.gain.set(...tg.gain), k);
  u.uSat.value = lerp(u.uSat.value, tg.sat, k); u.uVig.value = lerp(u.uVig.value, tg.vig + (G.gForce > 6 ? .2 : 0), k); u.uGrain.value = tg.grain;
  u.uTime.value = G.time; u.uRes.value.set(innerWidth, innerHeight);
  const spd = G.state === 'play' ? P.vel.length() : 0;
  const speedK = Math.max(smooth(230, 470, spd), G.warp ? .9 : 0, P.launchBoost > 0 ? .5 : 0);
  u.uSpeed.value = reduceMotion ? 0 : lerp(u.uSpeed.value, speedK, Math.min(1, rdt * 6));
  u.uCA.value = .0012 + Math.min(G.shake, 1.5) * .006 + speedK * .004 + (G.glitchT > 0 ? .02 : 0);
  // red pulse on damage, cool flash on warp
  G.dmgFlash = Math.max(0, (G.dmgFlash || 0) - rdt * 3);
  if (G.warp) { u.uTint.value.set(.75, .9, 1.3); u.uTintAmt.value = .25 * speedK; }
  else { u.uTint.value.set(1.25, .35, .35); u.uTintAmt.value = G.dmgFlash * .35; }
}

/* ---------- 2. Ground ambient occlusion on building facades ---------- */
function addGroundAO(mat, height) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAOy;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAOy = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAOy;')
      .replace('#include <tonemapping_fragment>', `gl_FragColor.rgb *= mix(0.42, 1.0, smoothstep(0.0, ${height.toFixed(1)}, vAOy));\n#include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey = () => 'groundAO' + height;
  mat.needsUpdate = true;
}
bMats.forEach(m => addGroundAO(m, 12));
addGroundAO(concreteMat, 4);

/* ---------- 3. Fresnel rim light + breathing glow on armor and drones ---------- */
function addRim(mat, color, strength = .45, power = 2.6) {
  const uRim = { value:new THREE.Color(color).multiplyScalar(strength) };
  mat.userData.rim = uRim;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uRim = uRim;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{ float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), ${power.toFixed(2)}); totalEmissiveRadiance += uRim * fr; }`);
  };
  mat.customProgramCacheKey = () => 'rim' + power.toFixed(2) + (mat.isMeshPhysicalMaterial ? 'p' : 's');
  mat.needsUpdate = true;
}
function rimRig(rig, color) {
  for (const p_ of rig.pieces) { addRim(p_.M.p, color, .5); addRim(p_.M.s, color, .3); addRim(p_.M.a, color, .25); }
  if (rig.glowMat) rig.glowBase = rig.glowMat.color.clone();
}
function breatheRig(rig, dt) {
  if (!rig || !rig.glowMat || !rig.glowBase || rig.suit.neon) return;
  const k = .82 + .18 * Math.sin(G.time * 2.4) + (beamOn || P.overT > 0 ? .25 : 0);
  rig.glowMat.color.copy(rig.glowBase).multiplyScalar(k);
}

/* ---------- 4. Atmospheric particles wrapped around the camera (GPU only) ---------- */
const ATM = (() => {
  const N = 1800, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); seed[i] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false,
    uniforms:{ uCam:{ value:new V3() }, uBox:{ value:140 }, uTime:{ value:0 }, uWind:{ value:new V3() }, uC1:{ value:new THREE.Color() }, uC2:{ value:new THREE.Color() }, uSize:{ value:3 }, uAlpha:{ value:.5 }, uTw:{ value:0 }, uPR:{ value:1 } },
    vertexShader:[
      'attribute float seed; uniform vec3 uCam; uniform float uBox; uniform float uTime; uniform vec3 uWind; uniform float uSize; uniform float uTw; uniform float uPR;',
      'varying float vA; varying float vS;',
      'void main(){',
      '  vec3 p = position * uBox + uWind * uTime * (0.6 + seed * 0.8);',
      '  p.x += sin(uTime * 0.7 + seed * 40.0) * 2.0; p.z += cos(uTime * 0.6 + seed * 31.0) * 2.0;',
      '  p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  float d = length(p - uCam);',
      '  vA = (1.0 - smoothstep(uBox * 0.25, uBox * 0.5, d)) * smoothstep(4.0, 14.0, d) * mix(1.0, 0.5 + 0.5 * sin(uTime * 3.0 + seed * 60.0), uTw);',
      '  vS = seed;',
      '  gl_PointSize = min(uSize * uPR * (0.6 + seed) * (220.0 / -mv.z), 9.0 * uPR);',
      '  gl_Position = projectionMatrix * mv;',
      '}'].join('\n'),
    fragmentShader:[
      'uniform vec3 uC1; uniform vec3 uC2; uniform float uAlpha; varying float vA; varying float vS;',
      'void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r);',
      '  gl_FragColor = vec4(mix(uC1, uC2, step(0.5, vS)) * a * vA * uAlpha, 1.0); }'].join('\n')
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, mat };
})();
const ATM_PRESETS = {
  earthNight:{ c1:0xffd9a0, c2:0x9fd8ff, size:2.2, alpha:.35, wind:[1.5, .4, .8], tw:.6 },
  earthDay:{ c1:0xfff4dc, c2:0xd0dce8, size:2, alpha:.18, wind:[2, .2, 1], tw:0 },
  halo:{ c1:0xbfd8ff, c2:0xffffff, size:1.6, alpha:.5, wind:[0, 0, 0], tw:.8 },
  vesper:{ c1:0xb0703f, c2:0xd8a070, size:2.6, alpha:.22, wind:[18, 1, 9], tw:0 },
  thalassa:{ c1:0xe8f8ff, c2:0xbfeaff, size:2.6, alpha:.2, wind:[4, .5, 2], tw:0 },
  kryos:{ c1:0xffffff, c2:0xd8eeff, size:3.2, alpha:.55, wind:[3, -7, 1.5], tw:.2 },
  noctis:{ c1:0x6bffd8, c2:0xff4fd8, size:2.8, alpha:.7, wind:[.3, 1.2, .2], tw:1 }
};
const _ac = new THREE.Color();
function updateAtmos(rdt) {
  const key = WORLD_ID === 'earth' ? (ENV.day ? 'earthDay' : 'earthNight') : WORLD_ID;
  const pr = ATM_PRESETS[key] || ATM_PRESETS.earthNight, u = ATM.mat.uniforms;
  u.uCam.value.copy(camera.position); u.uTime.value = G.time;
  u.uC1.value.lerp(_ac.setHex(pr.c1), Math.min(1, rdt * 2)); u.uC2.value.lerp(_ac.setHex(pr.c2), Math.min(1, rdt * 2));
  u.uWind.value.set(...pr.wind); u.uSize.value = pr.size; u.uTw.value = pr.tw; u.uPR.value = renderer.getPixelRatio();
  const highFade = WORLD_ID === 'earth' ? 1 - smooth(500, 1400, camera.position.y) : WD().space ? 1 : 1 - smooth(1200, 2600, camera.position.y);
  u.uAlpha.value = pr.alpha * highFade;
}

/* ---------- 5. Animated water normals ---------- */
const waterUniforms = { uTime:{ value:0 } };
function animateWater(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = waterUniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWp;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec2 w = vWp.xz; float a = sin(w.x * .09 + uTime * 1.3) * .5 + sin(w.y * .12 - uTime * 1.1) * .5 + sin((w.x + w.y) * .21 + uTime * 2.1) * .3;
        float b = cos(w.y * .08 + uTime * 1.2) * .5 + cos((w.x - w.y) * .17 - uTime * 1.7) * .4;
        normal = normalize(normal + (viewMatrix * vec4(a * .09, 0.0, b * .09, 0.0)).xyz); }`);
  };
  mat.customProgramCacheKey = () => 'water';
  mat.needsUpdate = true;
}
scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial && o.material.transparent && o.material.color.getHex() === 0x123247) animateWater(o.material); });

/* ---------- 6. Contact shadows (soft blobs) ---------- */
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(.5, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
const blobs = [0, 1].map(() => { const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3 })); m.renderOrder = 2; scene.add(m); return m; });
function placeBlob(m, pos, size, maxH) {
  const fy = floorAt(pos.x, pos.z, pos.y), h = pos.y - fy - 1.8;
  if (!(h < maxH) || !isFinite(fy) || fy < -1e6) { m.visible = false; return; }
  m.visible = true; m.position.set(pos.x, fy + .06, pos.z);
  const s = size * (1 + h * .08); m.scale.set(s, 1, s); m.material.opacity = clamp(1 - h / maxH, 0, 1);
}

/* ---------- 7. Glowing projectiles + ribbon trails ---------- */
const glowMats = {};
function glowMat(c) { return glowMats[c] || (glowMats[c] = new THREE.MeshBasicMaterial({ color:new THREE.Color(c).multiplyScalar(1.6), transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false })); }
const coreMatW = new THREE.MeshBasicMaterial({ color:0xffffff, toneMapped:false });
const boltCoreGeo = new THREE.CylinderGeometry(.05, .05, 1, 5); boltCoreGeo.rotateX(Math.PI / 2);
const trails = [];
class Trail {
  constructor(color, width, n = 28, life = .35) {
    this.n = n; this.pts = []; this.w = width; this.life = life; this.color = new THREE.Color(color); this.alive = true;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.col = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, toneMapped:false }));
    this.mesh.frustumCulled = false; scene.add(this.mesh); trails.push(this);
  }
  push(p, on = true) { if (on) this.pts.unshift({ p:p.clone(), t:0 }); if (this.pts.length > this.n) this.pts.length = this.n; }
  update(dt) {
    for (const q of this.pts) q.t += dt;
    while (this.pts.length && this.pts[this.pts.length - 1].t > this.life) this.pts.pop();
    const n = this.pts.length;
    camera.getWorldDirection(t3);
    for (let i = 0; i < this.n; i++) {
      const j = i * 6;
      if (i >= n || n < 2) { this.pos.fill(0, j, j + 6); this.col.fill(0, j, j + 6); continue; }
      const a = this.pts[i].p, b = this.pts[Math.min(n - 1, i + 1)].p, c = this.pts[Math.max(0, i - 1)].p;
      t1.copy(c).sub(b); if (t1.lengthSq() < 1e-6) t1.set(0, 0, 1);
      t2.crossVectors(t1, t3).normalize();
      const f = 1 - this.pts[i].t / this.life, w = this.w * (1 - i / this.n) * (.4 + .6 * f);
      this.pos[j] = a.x + t2.x * w; this.pos[j + 1] = a.y + t2.y * w; this.pos[j + 2] = a.z + t2.z * w;
      this.pos[j + 3] = a.x - t2.x * w; this.pos[j + 4] = a.y - t2.y * w; this.pos[j + 5] = a.z - t2.z * w;
      const k = f * (1 - i / this.n);
      for (const o of [0, 3]) { this.col[j + o] = this.color.r * k; this.col[j + o + 1] = this.color.g * k; this.col[j + o + 2] = this.color.b * k; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.alive = false; scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
const playerTrails = { L:null, R:null, hL:null, hR:null };
function updatePlayerTrails(dt) {
  const r = AR();
  if (!playerTrails.L) { playerTrails.L = new Trail(0xffffff, .2, 40, .45); playerTrails.R = new Trail(0xffffff, .2, 40, .45); playerTrails.hL = new Trail(0x8a9aa8, .08, 30, .6); playerTrails.hR = new Trail(0x8a9aa8, .08, 30, .6); }
  const spd = P.vel.length(), flying = G.state === 'play' && P.mode === 'suited' && !P.walking && !P.camo && !P.heavy;
  const s = AS();
  playerTrails.L.color.setHex(s.glow).multiplyScalar(.3); playerTrails.R.color.setHex(s.glow).multiplyScalar(.3);
  const fl = r.bootFlames.length >= 2 ? r.bootFlames : [];
  if (fl.length) { fl[0].getWorldPosition(t4); playerTrails.L.push(t4, flying && spd > 35); fl[1].getWorldPosition(t4); playerTrails.R.push(t4, flying && spd > 35); }
  playerTrails.L.w = playerTrails.R.w = .1 + clamp(spd / 300, 0, 1) * .32;
  const vapor = flying && ((P.gForce || 0) > 4.5 || spd > 330);
  r.palms[0].getWorldPosition(t4); playerTrails.hL.push(t4, vapor); r.palms[1].getWorldPosition(t4); playerTrails.hR.push(t4, vapor);
}
function updateTrails(dt) {
  for (let i = trails.length - 1; i >= 0; i--) { const tr = trails[i]; tr.update(dt); if (tr.owner && (tr.owner.dead || (!missiles.includes(tr.owner) && !eMissiles.includes(tr.owner))) && !tr.pts.length) { tr.dispose(); trails.splice(i, 1); } }
}

/* ---------- 8. Explosions: fireball, shockwave ring, embers, debris ---------- */
const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 40, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.6, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const fireTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.25, 'rgba(255,210,120,.95)'); gr.addColorStop(.55, 'rgba(255,110,40,.6)'); gr.addColorStop(1, 'rgba(120,30,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const fxPool = [];
function fxSprite(tex, pos, color, s0, s1, life, additive = true) {
  let f = fxPool.find(q => !q.on);
  if (!f) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false, toneMapped:false })); scene.add(sp); f = { sp }; fxPool.push(f); }
  f.on = true; f.t = 0; f.life = life; f.s0 = s0; f.s1 = s1;
  f.sp.material.map = tex; f.sp.material.color.set(color); f.sp.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending; f.sp.material.needsUpdate = true;
  f.sp.position.copy(pos); f.sp.visible = true; f.sp.scale.setScalar(s0);
  return f;
}
function updateFxSprites(dt) {
  for (const f of fxPool) {
    if (!f.on) continue;
    f.t += dt; const k = f.t / f.life;
    if (k >= 1) { f.on = false; f.sp.visible = false; continue; }
    const e = 1 - Math.pow(1 - k, 3);
    f.sp.scale.setScalar(lerp(f.s0, f.s1, e)); f.sp.material.opacity = 1 - k * k;
  }
}
function fxExplosion(p, size, color) {
  fxSprite(fireTex, p, 0xffffff, size * 3, size * 14, .45 + size * .1);
  fxSprite(fireTex, p, color, size * 5, size * 20, .7 + size * .15);
  fxSprite(ringTex, p, 0xfff2dc, size * 2, size * 42, .5);
  for (let i = 0; i < 18 * size; i++) { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s_ = Math.sqrt(1 - u * u), v = rand(30, 70) * size; emit(PS, p, Math.cos(th) * s_ * v, u * v + 10, Math.sin(th) * s_ * v, Math.random() < .5 ? 0xffc060 : 0xff7a2a, rand(.6, 1.4)); }
  if (size >= 1) for (let i = 0; i < Math.min(8, size * 3); i++) { const c = new THREE.Mesh(box(rand(.2, .6), rand(.2, .5), rand(.2, .6)), std(0x2a2c30, .6, .6)); c.position.copy(p); scene.add(c); debris.push({ g:c, vel:new V3(rand(-20, 20), rand(6, 22), rand(-20, 20)).multiplyScalar(size * .6), spin:new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), life:5 }); }
  const d = P.pos.distanceTo(p); if (d < 260) G.dmgFlash = Math.max(G.dmgFlash || 0, 0);
}

/* ---------- 9. Muzzle light, hit markers, score popups, hit-stop, smooth shake ---------- */
const muzzleLight = new THREE.PointLight(0xffffff, 0, 14); scene.add(muzzleLight);
function muzzleFlash(pos, color) { muzzleLight.position.copy(pos); muzzleLight.color.setHex(color); muzzleLight.intensity = 3; G.spread = Math.min(1, (G.spread || 0) + .25); }
const popups = [];
function scorePopup(pos, text, color) { popups.push({ p:pos.clone(), text, color:color || '#ffb547', t:0 }); if (popups.length > 14) popups.shift(); }
function hitMarker(kill) { G.hitMark = kill ? .28 : .14; G.hitKill = kill; }
function smoothShake() {
  if (!(G.shake > 0) || reduceMotion) return;
  const tr = Math.min(G.shake, 1.6), k = tr * tr * .55, t = G.time * 24;
  camera.position.x += (vnoise(t, 1.3) - .5) * 2 * k; camera.position.y += (vnoise(t, 7.1) - .5) * 2 * k; camera.position.z += (vnoise(t, 4.4) - .5) * k;
  camera.rotateZ((vnoise(t * .7, 13.7) - .5) * .07 * k);
}
/* camera transitions between third person and helmet view */
const camFrom = { p:new V3(), q:new THREE.Quaternion(), t:1 };
function beginCamBlend() { camFrom.p.copy(camera.position); camFrom.q.copy(camera.quaternion); camFrom.t = 0; }
const _bq = new THREE.Quaternion();
function applyCamBlend(dt) {
  if (camFrom.t >= 1) return;
  camFrom.t = Math.min(1, camFrom.t + dt / .38);
  const e = 1 - Math.pow(1 - camFrom.t, 3);
  camera.position.lerpVectors(camFrom.p, camera.position, e);
  _bq.copy(camFrom.q).slerp(camera.quaternion, e); camera.quaternion.copy(_bq);
}

/* ---------- 10. HUD canvas: vector crosshair, hit markers, popups ---------- */
function drawCrosshair(col) {
  if (G.state !== 'play' || P.mode !== 'suited' || P.montage) return;
  const cx = innerWidth / 2, cy = innerHeight / 2, sp = 10 + (G.spread || 0) * 14;
  hx.save(); hx.lineCap = 'round'; hx.shadowColor = col; hx.shadowBlur = 8;
  hx.strokeStyle = col; hx.lineWidth = 2; hx.globalAlpha = .95;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { hx.beginPath(); hx.moveTo(cx + dx * sp, cy + dy * sp); hx.lineTo(cx + dx * (sp + 9), cy + dy * (sp + 9)); hx.stroke(); }
  hx.globalAlpha = .6; hx.lineWidth = 1.2; hx.beginPath(); hx.arc(cx, cy, sp + 16, -Math.PI * .2, Math.PI * .2); hx.stroke(); hx.beginPath(); hx.arc(cx, cy, sp + 16, Math.PI * .8, Math.PI * 1.2); hx.stroke();
  hx.globalAlpha = 1; hx.fillStyle = '#fff'; hx.beginPath(); hx.arc(cx, cy, 1.6, 0, Math.PI * 2); hx.fill();
  if (G.hitMark > 0) {
    const k = G.hitMark / (G.hitKill ? .28 : .14), c2 = G.hitKill ? '#ff4d5e' : '#ffffff', r0 = 7, r1 = 15 + (1 - k) * 4;
    hx.strokeStyle = c2; hx.shadowColor = c2; hx.lineWidth = G.hitKill ? 3 : 2; hx.globalAlpha = k;
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { hx.beginPath(); hx.moveTo(cx + dx * r0, cy + dy * r0); hx.lineTo(cx + dx * r1, cy + dy * r1); hx.stroke(); }
  }
  hx.restore();
}
function drawPopups(dt) {
  hx.save(); hx.textAlign = 'center'; hx.font = '700 15px Oxanium, sans-serif'; hx.shadowColor = 'rgba(0,0,0,.8)'; hx.shadowBlur = 6;
  for (let i = popups.length - 1; i >= 0; i--) {
    const q = popups[i]; q.t += dt; if (q.t > 1.3) { popups.splice(i, 1); continue; }
    const pr = project(t4.copy(q.p).add(t2.set(0, q.t * 8, 0))); if (!pr.on) continue;
    hx.globalAlpha = 1 - smooth(.8, 1.3, q.t); hx.fillStyle = q.color;
    const s = 1 + Math.max(0, .25 - q.t) * 2; hx.save(); hx.translate(pr.x, pr.y); hx.scale(s, s); hx.fillText(q.text, 0, 0); hx.restore();
  }
  hx.restore();
}

/* ---------- 11. Per-frame driver ---------- */
function fxUpdate(rdt) {
  G.spread = Math.max(0, (G.spread || 0) - rdt * 2.2);
  G.hitMark = Math.max(0, (G.hitMark || 0) - rdt);
  G.hitStop = Math.max(0, (G.hitStop || 0) - rdt);
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - rdt * 30);
  waterUniforms.uTime.value = G.time;
  updateAtmos(rdt);
  updateFxSprites(rdt);
  if (P.rig) breatheRig(P.rig, rdt);
  if (G.state === 'play') {
    updatePlayerTrails(rdt);
    placeBlob(blobs[0], P.pos, P.heavy ? 9 : P.mode === 'suited' ? 3.4 : 2.4, 40);
    if (W.rig && W.state !== 'down') placeBlob(blobs[1], W.pos, 3.2, 30); else blobs[1].visible = false;
  } else { blobs.forEach(b => b.visible = false); }
  updateTrails(rdt);
}
