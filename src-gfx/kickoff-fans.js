/* Kickoff Rivals: a crowd that reacts.
   - Mexican wave that rolls round the whole stadium in quiet spells (and when a team is cruising)
   - "Ooooh!": the whole ground rises off their seats for near misses, saves and shots off the woodwork
   - "Olé!": fans chant and bounce together on every pass of a long passing move
   - Scarves held up above heads at kick-off, after goals and at full time
   - The fans in front of a celebrating scorer go wild
   - Very rarely, a pitch invader runs on during a stoppage and the stewards chase him off */
(function () {
  if (typeof crowd === 'undefined' || !crowd.length || typeof U === 'undefined') return;

  const FU = { hot:{ value:new THREE.Vector4(0, 0, 0, 30) }, stand:{ value:0 }, sync:{ value:0 }, wave:{ value:-10 }, scarf:{ value:0 } };
  function fanShader(mat, kind) {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uTime:U.time, uEx:U.ex, uHot:FU.hot, uStand:FU.stand, uSync:FU.sync, uWave:FU.wave, uScarf:FU.scarf });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uEx, uStand, uSync, uWave, uScarf; uniform vec4 uHot;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 ip = instanceMatrix[3];
        vec4 wp = modelMatrix * vec4(ip.xyz, 1.0);
        float ph = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
        float hot = uHot.z * (1.0 - smoothstep(uHot.w * .45, uHot.w, distance(wp.xz, uHot.xy)));
        float ex = max(uEx, hot);
        float jump = max(0.0, sin(uTime * (4.0 + ex * 6.0) + ph));
        float lift = jump * (0.03 + ex * 0.34) + uStand * (.2 + .06 * sin(ph)) + uSync * max(0.0, sin(uTime * 6.5)) * .16;
        float wv = 0.0;
        if (uWave > -5.0) { float ang = atan(wp.z, wp.x * .62); float d = mod(ang - uWave + 3.14159, 6.28318) - 3.14159; wv = exp(-d * d * 12.0); lift += wv * .5; }
        ${kind === 0 ? 'if (position.y > 0.0) transformed.y += wv * .32;' : ''}
        ${kind === 1 ? 'lift += wv * .32;' : ''}
        ${kind === 2 ? 'float sc = max(uScarf, hot * .9) * (.85 + .15 * sin(ph * 3.0)); transformed *= sc; transformed.y += sin(uTime * 7.0 + ph + position.x * 5.0) * .05 * sc; lift += wv * .32;' : ''}
        transformed.y += lift;
      #endif`);
    };
    mat.customProgramCacheKey = () => 'fans' + kind;
    mat.needsUpdate = true;
  }

  /* ---------------- scarves (one per fan, in that fan's colours) ---------------- */
  const SCARF = new THREE.BoxGeometry(.72, .13, .02);
  for (const c of crowd) {
    const body = c.m, n = body.count; if (!n) continue;
    fanShader(body.material, 0); if (c.head) fanShader(c.head.material, 1);
    const sc = new THREE.InstancedMesh(SCARF, new THREE.MeshLambertMaterial({ color:0xffffff }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { body.getMatrixAt(i, m); m.elements[13] += .76; m.elements[12] += (Math.random() - .5) * .06; sc.setMatrixAt(i, m); sc.setColorAt(i, new THREE.Color(1, 1, 1)); }
    sc.count = n; sc.instanceMatrix.needsUpdate = true; sc.frustumCulled = false;
    fanShader(sc.material, 2); body.parent.add(sc); c.scarf = sc;
  }
  function copyScarfColours() {
    for (const c of crowd) { if (!c.scarf || !c.m.instanceColor) continue; c.scarf.instanceColor.array.set(c.m.instanceColor.array.subarray(0, c.scarf.count * 3)); c.scarf.instanceColor.needsUpdate = true; }
  }
  const _paint = paintCrowd;
  paintCrowd = function (hc, ac) { _paint(hc, ac); copyScarfColours(); };
  copyScarfColours();

  /* ---------------- crowd sounds (respect the CROWD NOISE setting) ---------------- */
  function dest() { if (!AU.ctx || SET.crowd === 2) return null; return AU.crowdMaster || AU.ctx.destination; }
  let NOISE = null;
  function noise() { if (NOISE) return NOISE; const ctx = AU.ctx, b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return NOISE = b; }
  function ooh() {
    const o = dest(); if (!o) return; const ctx = AU.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .25); g.gain.exponentialRampToValueAtTime(.001, t + 1.7);
    for (const [f0, f1] of [[480, 330], [900, 700]]) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + 1.4); src.connect(f); f.connect(g); }
    g.connect(o); src.start(t); src.stop(t + 1.8);
  }
  // a crowd singing "O-LÉ": detuned voices through vowel formants
  function ole() {
    const o = dest(); if (!o) return; const ctx = AU.ctx, t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .08); g.gain.setValueAtTime(.09, t + .38); g.gain.linearRampToValueAtTime(.11, t + .5); g.gain.exponentialRampToValueAtTime(.001, t + 1.2);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
    f1.frequency.setValueAtTime(520, t); f1.frequency.setValueAtTime(420, t + .42); f2.frequency.setValueAtTime(860, t); f2.frequency.setValueAtTime(1950, t + .42);
    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(f1); mix.connect(f2); f1.connect(g); f2.connect(g); g.connect(o);
    for (let v = 0; v < 9; v++) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; const base = 170 * Math.pow(2, (Math.random() - .5) * .12) * (v % 3 === 0 ? .5 : 1);
      osc.frequency.setValueAtTime(base, t); osc.frequency.setValueAtTime(base * 1.26, t + .42);
      osc.connect(mix); osc.start(t + Math.random() * .05); osc.stop(t + 1.25);
    }
  }
  function swell(dur) {
    const o = dest(); if (!o) return; const ctx = AU.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 4; k++) { g.gain.linearRampToValueAtTime(.09, t + k * dur / 4 + dur / 8); g.gain.linearRampToValueAtTime(.03, t + (k + 1) * dur / 4); }
    g.gain.linearRampToValueAtTime(0, t + dur + .3);
    src.connect(f); f.connect(g); g.connect(o); src.start(t); src.stop(t + dur + .4);
  }

  /* ---------------- floating chant text ---------------- */
  const css = document.createElement('style');
  css.textContent = `#oleTxt{position:fixed;left:50%;top:22%;transform:translate(-50%,-50%) scale(.7);font:900 italic min(12vw,92px)/1 "Segoe UI",system-ui,sans-serif;letter-spacing:3px;color:#fff;opacity:0;pointer-events:none;z-index:6;text-shadow:0 6px 24px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.6);transition:none}
  #oleTxt.go{animation:oleGo 1.15s ease-out forwards}#oleTxt small{display:block;text-align:center;font-size:.2em;letter-spacing:.4em;margin-top:6px;opacity:.85}
  @keyframes oleGo{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}70%{opacity:.95;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}`;
  document.head.appendChild(css);
  const TXT = document.createElement('div'); TXT.id = 'oleTxt'; document.body.appendChild(TXT);
  function chantText(txt, sub, col) {
    TXT.innerHTML = txt + (sub ? `<small>${sub}</small>` : ''); TXT.style.color = col || '#fff';
    TXT.classList.remove('go'); void TXT.offsetWidth; TXT.classList.add('go');
  }

  /* ---------------- reactions ---------------- */
  const R = { stand:0, sync:0, wave:-1, lastWave:0, streak:0, sTeam:null, lastPass:[0, 0], lastOle:-9, shotT:-99, crossZ:null, inv:null, invDone:false };
  function gasp() { if (R.stand > .3) return; R.stand = 2.1; ooh(); S.excite = Math.max(S.excite, .6); }
  // toast is a const in the game, so listen through fx instead
  const _fx = fx;
  fx = function (type, a, b, c) { if (type === 'toast' && typeof a === 'string' && /save|post|bar|blocked/i.test(a)) gasp(); return _fx(type, a, b, c); };
  const _restart = restart;
  restart = function (kind, team, x, z) {
    const close = S.clock - R.shotT < 3.5 && R.crossZ != null && Math.abs(R.crossZ) < GW + 2.2;
    _restart(kind, team, x, z);
    if ((kind === 'goalkick' || kind === 'corner') && close) gasp();
    R.streak = 0; R.crossZ = null;
    maybeInvader(kind);
  };
  const _start = startMatch;
  startMatch = function (cfg) { R.invDone = Math.random() > .3; R.lastWave = 0; R.streak = 0; R.wave = -1; killInvader(); return _start(cfg); };
  const _celStart = goalScored;
  goalScored = function (team) { _celStart(team); R.streak = 0; FU.hot.value.set(team.side * (PL + 8), 0, 0, 30); R.hot = 1.2; };

  const _step = step;
  step = function (dt) {
    _step(dt);
    if (S.state === 'menu') return;
    // shot tracking for near misses
    if (ball.shot) { R.shotT = S.clock; if (R.crossZ == null && Math.abs(ball.pos.x) > PL) R.crossZ = ball.pos.z; }
    // passing streaks → olé
    if (S.state === 'play') {
      for (const t of S.teams) {
        if (t.passes > (R.lastPass[t.i] || 0)) {
          if (R.sTeam === t) R.streak++; else { R.sTeam = t; R.streak = 1; }
          if (R.streak >= 6 && S.clock - R.lastOle > 1.2) { R.lastOle = S.clock; R.sync = 1.1; ole(); chantText('OLÉ!', R.streak + ' PASSES', '#' + new THREE.Color(t.kit.c1).getHexString()); }
        }
        R.lastPass[t.i] = t.passes;
      }
      if (ball.owner && R.sTeam && ball.owner.team !== R.sTeam) R.streak = 0;
      // Mexican wave in quiet spells, or when one team is well ahead
      const lead = Math.abs(S.teams[0].score - S.teams[1].score);
      if (R.wave < 0 && S.excite < .35 && S.clock - R.lastWave > (lead >= 2 ? 35 : 70) && Math.abs(ball.pos.x) < 25 && Math.random() < dt * .05) {
        R.wave = 0; R.lastWave = S.clock; swell(11); if (Math.random() < .5) fx('toast', 'Mexican wave!');
      }
    } else for (const t of S.teams) R.lastPass[t.i] = t.passes;
    if (R.inv) invaderTick(dt);
  };

  /* ---------------- per-frame uniforms ---------------- */
  let last = performance.now(), scarf = 0;
  (function tick() {
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    if (S.paused) return;
    R.stand = Math.max(0, R.stand - dt); R.sync = Math.max(0, R.sync - dt);
    FU.stand.value = Math.min(1, R.stand * 1.4) * (R.stand > 0 ? 1 : 0);
    FU.sync.value = Math.min(1, R.sync * 2);
    if (R.wave >= 0) { R.wave += dt; const front = -Math.PI + R.wave * .62; FU.wave.value = front; if (front > Math.PI + .6) { R.wave = -1; FU.wave.value = -10; } }
    // fans in front of the celebration go wild
    if (window.CEL && CEL.on && CEL.st) { const s0 = CEL.st.get(CEL.sc); if (s0) FU.hot.value.set(s0.pos.x, Math.sign(s0.pos.z || 1) * (PW + 12), 1, 32); }
    else if (R.hot > 0) { R.hot -= dt; } else FU.hot.value.z = Math.max(0, FU.hot.value.z - dt);
    if (S.state === 'goal' && !(window.CEL && CEL.on)) FU.hot.value.z = Math.min(1, FU.hot.value.z + dt * 3);
    // scarves up at kick-off, after a goal and at full time
    const want = S.state === 'kickoff' || S.state === 'goal' || S.state === 'full' || (S.state === 'play' && S.clock < 3) ? 1 : 0;
    scarf += (want - scarf) * Math.min(1, dt * 2.5); FU.scarf.value = scarf < .02 ? 0 : scarf;
  })();

  /* ---------------- the pitch invader ---------------- */
  function figure(shirt, hiVis) {
    const g = new THREE.Group(), mat = c => new THREE.MeshLambertMaterial({ color:c });
    const top = mat(shirt), legs = mat(hiVis ? 0x1d2433 : 0x2b3a67), skin = mat(SKIN[(Math.random() * SKIN.length) | 0]);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.44, .62, .26), top); torso.position.y = 1.2; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), skin); head.position.y = 1.66; g.add(head);
    const limb = (w, h, m, x, y) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const l = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m); l.position.y = -h / 2; piv.add(l); g.add(piv); return piv; };
    g.userData = { lL:limb(.15, .86, legs, -.11, .88), lR:limb(.15, .86, legs, .11, .88), aL:limb(.1, .6, hiVis ? top : skin, -.29, 1.48), aR:limb(.1, .6, hiVis ? top : skin, .29, 1.48), ph:Math.random() * 6 };
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function pose(g, sp, t, armsUp) {
    const u = g.userData, w = t * (4 + sp * 1.3) + u.ph, a = Math.min(1, sp / 6) * .9;
    u.lL.rotation.x = Math.sin(w) * a; u.lR.rotation.x = -Math.sin(w) * a;
    if (armsUp) { u.aL.rotation.z = -2.7 + Math.sin(t * 9) * .2; u.aR.rotation.z = 2.7 - Math.sin(t * 9) * .2; u.aL.rotation.x = u.aR.rotation.x = 0; }
    else { u.aL.rotation.z = u.aR.rotation.z = 0; u.aL.rotation.x = -Math.sin(w) * a; u.aR.rotation.x = Math.sin(w) * a; }
    g.children[0].rotation.x = sp > 3 ? .18 : 0;
  }
  function maybeInvader(kind) {
    if (R.invDone || R.inv || S.net || (kind !== 'throw' && kind !== 'goalkick')) return;
    const m = minute(); if (m < 20 || m > 82 || Math.random() > .35) return;
    R.invDone = true;
    const zs = ball.pos.z > 0 ? -1 : 1, x0 = clamp(ball.pos.x + (Math.random() - .5) * 16, -PL + 15, PL - 15);
    const shirt = new THREE.Color(S.teams[Math.random() < .6 ? 0 : 1].kit.c1);
    const inv = figure(shirt, false), st1 = figure(0xd7ff1a, true), st2 = figure(0xd7ff1a, true);
    inv.position.set(x0, 0, zs * (PW + 2.5)); st1.position.set(x0 - 7, 0, zs * (PW + 3.2)); st2.position.set(x0 + 8, 0, zs * (PW + 3.4));
    scene.add(inv, st1, st2);
    R.inv = { inv, st:[st1, st2], t:0, zs, x0, phase:'run', tgt:new THREE.Vector3(x0 + (Math.random() - .5) * 6, 0, -zs * 4), caughtT:0 };
    fx('toast', 'Pitch invader!'); S.excite = Math.max(S.excite, .7); swell(3);
  }
  function killInvader() { if (!R.inv) return; scene.remove(R.inv.inv, ...R.inv.st); R.inv = null; }
  const mv = (g, x, z, sp, dt) => { const dx = x - g.position.x, dz = z - g.position.z, d = Math.hypot(dx, dz); if (d < .05) return 0; const s = Math.min(sp, d / dt); g.position.x += dx / d * s * dt; g.position.z += dz / d * s * dt; g.rotation.y = Math.atan2(dx, dz); return s; };
  function invaderTick(dt) {
    const I = R.inv; I.t += dt;
    if (S.setp) S.setp.t = Math.min(S.setp.t, .2);          // the game waits while he's on the pitch
    if (S.state !== 'setpiece' && I.phase !== 'off') I.phase = 'off';
    const g = I.inv;
    if (I.phase === 'run') {
      // zig-zag towards the middle, arms up, dodging
      const zz = Math.sin(I.t * 1.7) * 3;
      const s = mv(g, I.tgt.x + zz, I.tgt.z, 6.8, dt); pose(g, s, I.t, true);
      I.st.forEach((st, k) => { const sp = mv(st, g.position.x + (k ? 1 : -1) * .7, g.position.z, 5.6 + I.t * .25, dt); pose(st, sp, I.t, false); });
      if (I.t > 1.5 && I.st.some(st => st.position.distanceTo(g.position) < 1.1)) { I.phase = 'caught'; I.caughtT = 0; fx('toast', 'Stewards got him!'); swell(2.5); }
      if (I.t > 9) { I.phase = 'caught'; I.caughtT = 0; }
    } else if (I.phase === 'caught' || I.phase === 'off') {
      I.caughtT += dt;
      const ex = g.position.x, ez = I.zs * (PW + 6);
      const s = mv(g, ex, ez, I.phase === 'off' ? 6 : 2.2, dt); pose(g, s, I.t, false);
      g.rotation.y += Math.PI;                               // dragged off backwards
      I.st.forEach((st, k) => { const sp = mv(st, g.position.x + (k ? .55 : -.55), g.position.z - I.zs * .3, I.phase === 'off' ? 6 : 2.2, dt); pose(st, sp, I.t, false); st.userData.aL.rotation.x = st.userData.aR.rotation.x = -1.2; });
      if (Math.abs(g.position.z) > PW + 5.5) killInvader();
    }
  }
})();
