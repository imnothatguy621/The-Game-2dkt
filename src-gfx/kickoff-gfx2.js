/* ================= GFX 2: broadcast-style grass, richer lighting per time of day, stadium depth,
   floodlight beams, camera flashes in the crowd, and a sharpening pass ================= */
(() => {
  if (typeof PITCH === 'undefined' || typeof GSET === 'undefined') return;
  const HQ = GSET.q >= 2;

  /* ---------- 1. pitch: mowing pattern, natural colour variation, wear, softer lines ---------- */
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function pitchTexture2() {
    const W = MOBILE ? 2048 : 4096, k = W / 105, H = Math.round(68 * k);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    // lengthwise mowing stripes (matches the sheen bands in the grass shader)
    const bands = 18;
    for (let i = 0; i < bands; i++) { g.fillStyle = i % 2 ? '#3a772d' : '#468838'; g.fillRect(i * W / bands, 0, W / bands + 1, H); }
    // crosscut: lighter/darker bands the other way give the classic checkerboard
    for (let j = 0; j < 10; j++) { g.fillStyle = j % 2 ? 'rgba(255,255,230,.045)' : 'rgba(0,20,0,.05)'; g.fillRect(0, j * H / 10, W, H / 10 + 1); }
    // patchy colour and dry/worn spots, worked out at low resolution and blended over the stripes
    const VW = MOBILE ? 512 : 1024, VH = Math.round(VW * 68 / 105), sv = 105 / VW;
    const vm = document.createElement('canvas'), vd = document.createElement('canvas'); vm.width = vd.width = VW; vm.height = vd.height = VH;
    const mi = vm.getContext('2d').createImageData(VW, VH), di = vd.getContext('2d').createImageData(VW, VH), md = mi.data, dd2 = di.data;
    const wear = [[-(PL - 5), 0, 9, .8], [PL - 5, 0, 9, .8], [-(PL - 1.5), 0, 4.5, .9], [PL - 1.5, 0, 4.5, .9], [0, 0, 6, .35], [-(PL - 11), 0, 2.2, .5], [PL - 11, 0, 2.2, .5]];
    for (let py = 0; py < VH; py++) {
      const z = py * sv - PW;
      for (let px = 0; px < VW; px++) {
        const x = px * sv - PL, i = (py * VW + px) * 4;
        const n1 = vnoise(x * .09, z * .09), n2 = vnoise(x * .45 + 31, z * .45 + 17), n3 = vnoise(x * 2.2 + 7, z * 2.2 + 3);
        const f = Math.min(255, 255 * (.68 + n1 * .22 + n2 * .08 + n3 * .07));
        md[i] = md[i + 1] = md[i + 2] = f; md[i + 3] = 255;
        let dry = Math.max(0, n1 * .7 + n2 * .3 - .62) * 1.6;
        for (const [wx, wz, r, st] of wear) { const q = Math.hypot(x - wx, (z - wz) * (r > 5 ? 1.3 : 1)); if (q < r) dry += (1 - q / r) * st * (.55 + n2 * .7); }
        dd2[i] = 122; dd2[i + 1] = 108; dd2[i + 2] = 66; dd2[i + 3] = Math.min(1, dry) * 130;
      }
    }
    vm.getContext('2d').putImageData(mi, 0, 0); vd.getContext('2d').putImageData(di, 0, 0);
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'multiply'; g.drawImage(vm, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.drawImage(vd, 0, 0, W, H);
    // markings: slightly soft, painted-on-grass white
    const X = x => (x + PL) * k, Z = z => (z + PW) * k;
    g.save(); g.shadowColor = 'rgba(255,255,255,.35)'; g.shadowBlur = k * .06;
    g.strokeStyle = 'rgba(244,247,240,.9)'; g.lineWidth = .12 * k; g.fillStyle = 'rgba(244,247,240,.9)';
    const lw = g.lineWidth / 2;
    g.strokeRect(X(-PL) + lw, Z(-PW) + lw, 105 * k - lw * 2, 68 * k - lw * 2);
    g.beginPath(); g.moveTo(X(0), Z(-PW)); g.lineTo(X(0), Z(PW)); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), 9.15 * k, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), .2 * k, 0, Math.PI * 2); g.fill();
    for (const sd of [-1, 1]) {
      const gx = sd * PL;
      const box = (dp, w) => { const x0 = sd < 0 ? X(gx) : X(gx - dp); g.strokeRect(x0, Z(-w / 2), dp * k, w * k); };
      box(16.5, 40.32); box(5.5, 18.32);
      const ps = gx - sd * 11; g.beginPath(); g.arc(X(ps), Z(0), .2 * k, 0, Math.PI * 2); g.fill();
      g.beginPath(); const a = Math.acos(5.5 / 9.15);
      if (sd < 0) g.arc(X(ps), Z(0), 9.15 * k, -a, a); else g.arc(X(ps), Z(0), 9.15 * k, Math.PI - a, Math.PI + a); g.stroke();
      for (const cz of [-1, 1]) { g.beginPath(); if (sd < 0) g.arc(X(gx), Z(cz * PW), 1 * k, cz < 0 ? 0 : -Math.PI / 2, cz < 0 ? Math.PI / 2 : 0); else g.arc(X(gx), Z(cz * PW), 1 * k, cz < 0 ? Math.PI / 2 : Math.PI, cz < 0 ? Math.PI : Math.PI * 1.5); g.stroke(); }
    }
    g.restore();
    const t = new THREE.CanvasTexture(cv); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.encoding = THREE.sRGBEncoding; return t;
  }
  try {
    const old = PITCH.material.map; PITCH.material.map = pitchTexture2(); if (old) old.dispose();
    PITCH.material.color.setScalar(.95); PITCH.material.roughness = .88; PITCH.material.needsUpdate = true;
    OUTER.material.color.set(0x1f4a1b);
    // the surround grass and the dark track sat a few cm under the pitch; in the post-processing
    // buffer that showed up as flickering horizontal lines far away, so give them real gaps
    OUTER.position.y = -0.25;
    scene.children.forEach(o => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 220 && o.geometry.parameters.height === 180) o.position.y = -0.8; });
    PITCH.material.polygonOffset = true; PITCH.material.polygonOffsetFactor = -2; PITCH.material.polygonOffsetUnits = -2;
  } catch (e) { console.warn('pitch2', e); }

  /* close-up grass blades, clumps, colour patches and worn goalmouths; blades fade out with distance */
  function grassUpgrade(mat, isPitch) {
    const ob = mat.onBeforeCompile;
    mat.extensions = Object.assign(mat.extensions || {}, { derivatives:true });
    mat.onBeforeCompile = function (sh, r) {
      ob.call(this, sh, r);
      sh.uniforms.uPL = { value:PL };
      sh.fragmentShader = sh.fragmentShader.replace('uniform sampler2D uDetail;', 'uniform sampler2D uDetail; uniform float uPL;\n' + `
        float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('diffuseColor.rgb *= mix(0.8, 1.16, det);', `diffuseColor.rgb *= mix(0.8, 1.16, det);
      {
        vec2 q = vWPos.xz; float dist = length(cameraPosition - vWPos);
        // large soft colour patches: a little yellower here, a little bluer there
        float pa = gn(q * .09) * .6 + gn(q * .31) * .4;
        diffuseColor.rgb *= mix(vec3(1.05, 1.03, .9), vec3(.93, 1., 1.05), pa);
        // mid-scale clumps, still visible from the broadcast camera
        float cl = gn(q * 2.3) * .55 + gn(q * 5.7) * .45;
        diffuseColor.rgb *= mix(1., .9 + .2 * cl, 1. - smoothstep(25., 70., dist));
        // single blades, stretched along the view so they read as standing grass
        vec2 vdir = normalize(vd.xz + vec2(1e-4)), side = vec2(-vdir.y, vdir.x);
        vec2 bq = vec2(dot(q, side) * 95., dot(q, vdir) * 13.);
        vec2 bq2 = vec2(dot(q, side) * 36., dot(q, vdir) * 6.);
        // only draw blades the screen can actually resolve (no shimmer when the camera moves)
        float fp1 = max(fwidth(bq.x), fwidth(bq.y) * 1.5), fp2 = max(fwidth(bq2.x), fwidth(bq2.y) * 1.5);
        float bl = gh(floor(bq)), tip = fract(bq.y);
        float blade1 = mix(.72, 1.22, bl) * mix(.88, 1.07, tip);
        float blade2 = mix(.84, 1.12, gh(floor(bq2)));
        diffuseColor.rgb *= mix(1., blade1, 1. - smoothstep(.6, 1.3, fp1));
        diffuseColor.rgb *= mix(1., blade2, 1. - smoothstep(.6, 1.3, fp2));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, .8), (1. - smoothstep(.6, 1.3, fp1)) * step(.82, bl) * tip * .6);   // sun-bleached tips
        ${isPitch ? `
        // worn turf in the goalmouths, the penalty spots and the centre spot
        float ax = abs(q.x);
        float wear = exp(-pow((ax - (uPL - 3.)) / 2.6, 2.) - pow(q.y / 3.4, 2.)) * .9
                   + exp(-pow((ax - (uPL - 11.)) / 1.1, 2.) - pow(q.y / 1.1, 2.)) * .5
                   + exp(-dot(q, q) / 1.6) * .45;
        wear *= .55 + .7 * gn(q * 3.1);
        vec3 worn = vec3(dot(diffuseColor.rgb, vec3(.33))) * vec3(1.18, 1.02, .66);
        diffuseColor.rgb = mix(diffuseColor.rgb, worn, clamp(wear, 0., .75));` : ''}
      }`);
    };
    mat.needsUpdate = true;
  }
  try { grassUpgrade(PITCH.material, true); grassUpgrade(OUTER.material, false); } catch (e) { console.warn('grass', e); }

  // stop striped self-shadowing on the grass when seen from high up
  sun.shadow.bias = -.0005; if ('normalBias' in sun.shadow) sun.shadow.normalBias = .02;

  /* ---------- 2. richer lighting and colour grade for each time of day ---------- */
  Object.assign(TOD_PRESETS[0], { hemi:[0xb8c8ff, 0x0c180a, .17], sunI:1.38, fillI:.34, exposure:.86, bloom:.45, tint:[.95, 1, 1.07], sat:1.05, con:1.12 });
  Object.assign(TOD_PRESETS[1], { hemi:[0xffcaa0, 0x2a3218, .38], sunI:1.9, fillI:.16, exposure:.9, bloom:.36, tint:[1.08, .99, .9], sat:1.03, con:1.1 });
  Object.assign(TOD_PRESETS[2], { skyTop:0x2160c8, skyHor:0xa8cdf2, fog:0xa9c8e6, hemi:[0xdcecff, 0x3a4a26, .4], sunI:2.15, fillI:.12, exposure:.72, bloom:.1, tint:[1.03, 1, .96], sat:1.0, con:1.14 });

  /* ---------- 3. sharpening + tuned grade (rebuilt into the existing post pipeline) ---------- */
  GradeShader.uniforms.uSharp = { value:GSET.q >= 2 ? .3 : .18 };
  GradeShader.uniforms.uTexel = { value:new THREE.Vector2(1 / 1280, 1 / 720) };
  GradeShader.fragmentShader = GradeShader.fragmentShader
    .replace('uniform float uExposure,', 'uniform vec2 uTexel; uniform float uSharp; uniform float uExposure,')
    .replace('vec3 c = texture2D(tDiffuse, vUv).rgb;', `vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 bl = (texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.)).rgb
               + texture2D(tDiffuse, vUv + vec2(0., uTexel.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., uTexel.y)).rgb) * .25;
      c = max(c + (c - bl) * uSharp, 0.);`);
  const _present = present;
  present = function (sc, cam) {
    if (POST.on && POST.composer && POST.grade && POST.grade.uniforms.uTexel) { const rt = POST.composer.renderTarget1; POST.grade.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height); }
    _present(sc, cam);
  };
  const _applyTOD = applyTOD;
  applyTOD = function (tod) {
    _applyTOD(tod);
    const P = TOD_PRESETS[tod];
    if (POST.grade) { POST.grade.uniforms.uSat.value = P.sat || 1; POST.grade.uniforms.uContrast.value = P.con || 1.07; }
    BEAMS.forEach(b => { b.visible = HQ && P.glows; b.material.uniforms.uI.value = tod === 0 ? .03 : .014; });
    FLASH.pts.visible = P.glows;
    if (typeof CLOUDS !== 'undefined' && CLOUDS) { CLOUDS.material.color.set(CLOUD_TINT[tod][0]); CLOUDS.material.opacity = CLOUD_TINT[tod][1]; }
  };

  /* ---------- 4. floodlight beams ---------- */
  const BEAMS = [];
  const beamMat = () => new THREE.ShaderMaterial({
    uniforms:{ uCol:{ value:new THREE.Color(0xfff4dc) }, uI:{ value:.08 } },
    vertexShader:`varying float vA; varying vec3 vN, vV;
      void main(){ vA = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader:`uniform vec3 uCol; uniform float uI; varying float vA; varying vec3 vN, vV;
      void main(){ float rim = abs(dot(normalize(vN), normalize(vV))); float a = pow(vA, 2.2) * smoothstep(.05, .45, vA) * rim * rim * uI; gl_FragColor = vec4(uCol * a, 1.); }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false,
  });
  if (HQ) for (const s of GLOWS) {
    const from = s.position, to = new V3(from.x * .55, 0, from.z * .35), len = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(1.2, 11, len, 20, 1, true); geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, beamMat()); m.position.copy(from);
    m.quaternion.setFromUnitVectors(new V3(0, -1, 0), to.clone().sub(from).normalize());
    m.renderOrder = 3; m.frustumCulled = false; scene.add(m); BEAMS.push(m);
  }

  /* ---------- 5. crowd: deeper colours, darker under the roof, camera flashes ---------- */
  const _paint = paintCrowd;
  paintCrowd = function (hc, ac) {
    _paint(hc, ac);
    const c = new THREE.Color(), hsl = {}, m = new THREE.Matrix4(), v = new V3();
    for (const gr of crowd) {
      const im = gr.m; if (!im.instanceColor) continue;
      for (let i = 0; i < im.count; i++) {
        im.getColorAt(i, c); c.getHSL(hsl);
        im.getMatrixAt(i, m); v.setFromMatrixPosition(m);
        const shade = 1 - Math.min(1, Math.max(0, (v.y - 6) / 22)) * .4;
        c.setHSL(hsl.h, hsl.s * .6, hsl.l * .7 * shade); im.setColorAt(i, c);
      }
      im.instanceColor.needsUpdate = true;
    }
  };
  const FLASH = (() => {
    const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), life = new Float32Array(N), m = new THREE.Matrix4(), v = new V3();
    scene.updateMatrixWorld(true);
    let k = 0;
    for (let tries = 0; tries < N * 6 && k < N; tries++) {
      const gr = crowd[(Math.random() * crowd.length) | 0]; if (!gr || !gr.m.count) continue;
      gr.m.getMatrixAt((Math.random() * gr.m.count) | 0, m); v.setFromMatrixPosition(m).applyMatrix4(gr.m.matrixWorld);
      pos.set([v.x, v.y + .5, v.z], k * 3); k++;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setDrawRange(0, k);
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d');
    const gg = g.createRadialGradient(16, 16, 0, 16, 16, 16); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(.3, 'rgba(220,235,255,.5)'); gg.addColorStop(1, 'rgba(220,235,255,0)'); g.fillStyle = gg; g.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size:2.2, map:new THREE.CanvasTexture(cv), vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false }));
    pts.frustumCulled = false; scene.add(pts);
    return { pts, col, life, n:k, geo };
  })();
  const _gfxTick = gfxTick;
  gfxTick = function (dt, tt) {
    _gfxTick(dt, tt);
    if (!FLASH.pts.visible) return;
    const rate = (S.state === 'goal' ? 40 : S.state === 'menu' ? 2 : 3 + S.excite * 14) * dt;
    for (let n = rate + Math.random(); n >= 1; n--) FLASH.life[(Math.random() * FLASH.n) | 0] = .09;
    for (let i = 0; i < FLASH.n; i++) { const l = FLASH.life[i] = Math.max(0, FLASH.life[i] - dt); const b = l > 0 ? 1.4 : 0; FLASH.col[i * 3] = FLASH.col[i * 3 + 1] = FLASH.col[i * 3 + 2] = b; }
    FLASH.geo.attributes.color.needsUpdate = true;
  };


  /* ---------- 6. corner stands instead of bare blocks ---------- */
  try {
    scene.children.filter(o => o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 22 && o.geometry.parameters.height === 30).forEach(o => { o.visible = false; });
    for (const sx of [-1, 1]) {
      const grp = new THREE.Group();
      const top = tier(grp, 30, MOBILE ? 18 : 28, .9, 0, .62, .84, 0x23324f, .9);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(36, .5, 30), new THREE.MeshLambertMaterial({ color:0x161b25 })); roof.position.set(0, top + 6, 10); grp.add(roof);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(32, .35, .2), new THREE.MeshBasicMaterial({ color:0xfffbe8 })); strip.position.set(0, top + 4.7, -3); grp.add(strip);
      grp.position.set(sx * (PL + 13), 0, -(PW + 13)); grp.rotation.y = Math.atan2(sx, -1);
      scene.add(grp);
    }
  } catch (e) { console.warn('corners', e); }

  /* ---------- 7. clouds in the sky ---------- */
  const CLOUDS = (() => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 1024, y = 150 + Math.pow(Math.random(), .7) * 200, r = 20 + Math.random() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${.1 + Math.random() * .14})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(2.6, .55); g.translate(-x, -y); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping;
    const m = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map:t, transparent:true, depthWrite:false, side:THREE.BackSide, fog:false }));
    m.renderOrder = -1; scene.add(m); return m;
  })();
  const CLOUD_TINT = [[0x1b2a48, .35], [0xffb894, .95], [0xffffff, .9]];

  // rebuild the post pipeline with the new grade, then apply the time of day again
  applyQuality(GSET.q);
  paintCrowd('#5ab4f0', '#d8262f');
})();
