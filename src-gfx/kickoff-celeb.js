/* Kickoff Rivals: goal celebrations.
   The scorer runs to the fans and does one of several celebrations (knee slide, aeroplane, jump-spin,
   backflip, cupped ears, both hands to the sky, a little dance). Teammates sprint over and pile in,
   the other team drops their heads, the keeper sinks to his knees. A cinematic camera follows it,
   with confetti in the team's colours and pyro jets behind the goal. Any button skips. */
(function () {
  if (typeof goalScored !== 'function' || typeof animateSkinned !== 'function') return;

  const TYPES = ['slide', 'plane', 'spin', 'flip', 'ears', 'sky', 'dance'];
  const CEL = { on:false, t:0, dur:6.2, type:'', sc:null, team:null, mates:[], opp:[], st:new Map(), tgt:new THREE.Vector3(), camInit:false };
  window.CEL = CEL; CEL.types = TYPES; CEL.start = t => startCeleb(t);

  /* ---------------- start ---------------- */
  const _goal = goalScored;
  goalScored = function (team) {
    _goal(team);
    try { startCeleb(team); } catch (e) { console.warn('celeb', e); CEL.on = false; }
  };
  function startCeleb(team) {
    const lt = ball.lastTouch;
    let sc = lt && lt.team === team && lt.role !== 'GK' ? lt : null;
    if (!sc) { let best = 1e9; for (const p of team.players) { if (p.role === 'GK') continue; const d = d2(p.pos, ball.pos); if (d < best) { best = d; sc = p; } } }
    if (!sc || !sc.g || !sc.g.skinned) return;
    const side = team.side;
    CEL.on = true; CEL.t = 0; CEL.sc = sc; CEL.team = team; CEL.side = side;
    CEL.type = CEL.force || TYPES[(S.goals.length * 3 + (sc.i || 0) + ((Math.random() * 7) | 0)) % TYPES.length];
    // run towards the nearest corner of the stand behind / beside the goal
    const zs = Math.sign(sc.pos.z || (Math.random() - .5)) || 1;
    CEL.tgt.set(side * (PL - 7 - Math.random() * 6), 0, zs * (PW - 4.5));
    CEL.faceCrowd = Math.atan2(0, zs);   // facing +z or -z, towards that stand
    CEL.st.clear();
    CEL.st.set(sc, { pos:sc.pos.clone(), vel:sc.vel.clone(), role:'sc', face:sc.face });
    CEL.mates = team.players.filter(p => p !== sc && p.role !== 'GK').sort((a, b) => d2(a.pos, sc.pos) - d2(b.pos, sc.pos)).slice(0, 4);
    CEL.mates.forEach((p, i) => CEL.st.set(p, { pos:p.pos.clone(), vel:p.vel.clone(), face:p.face, role:'mate', slot:i, delay:.9 + i * .25 + Math.random() * .3, kind:i % 2 }));
    CEL.opp = opp(team).players;
    CEL.opp.forEach((p, i) => CEL.st.set(p, { pos:p.pos.clone(), vel:p.vel.clone(), face:p.face, role:p.role === 'GK' ? 'gk' : 'opp', kind:i % 3 }));
    CEL.camInit = true; CEL.skip = false; CEL.fx = 0;
    sc.celeb = 0;
    shake = .5;
  }

  /* ---------------- per-step movement ---------------- */
  function moveTo(s, x, z, maxSp, acc, dt) {
    const dx = x - s.pos.x, dz = z - s.pos.z, d = Math.hypot(dx, dz);
    const want = d < .25 ? 0 : Math.min(maxSp, d * 2.2);
    const wx = d > 1e-3 ? dx / d * want : 0, wz = d > 1e-3 ? dz / d * want : 0;
    const ax = wx - s.vel.x, az = wz - s.vel.z, am = Math.hypot(ax, az), m = acc * dt;
    if (am > m) { s.vel.x += ax / am * m; s.vel.z += az / am * m; } else { s.vel.x = wx; s.vel.z = wz; }
    s.pos.x += s.vel.x * dt; s.pos.z += s.vel.z * dt;
    return d;
  }
  function turnTo(s, a, dt, k = 6) { let d = a - s.face; d = Math.atan2(Math.sin(d), Math.cos(d)); s.face += d * Math.min(1, dt * k); }

  const _step = step;
  step = function (dt) {
    if (CEL.on && S.state === 'goal') S.timer = Math.min(S.timer, 2.5);   // hold the replay until the celebration is done
    _step(dt);
    if (!CEL.on) return;
    if (S.state !== 'goal') { endCeleb(); return; }
    CEL.t += dt;
    const F = S.localF && S.localF.p;
    if (CEL.t > .8 && F && (F.pass || F.shoot || F.lob || F.through)) CEL.skip = true;
    if (CEL.t >= CEL.dur || CEL.skip) { endCeleb(); return; }
    if (CEL.t > 1.5 && typeof bannerT !== 'undefined' && bannerT > 0) { bannerT = 0; $('banner').style.opacity = 0; }
    const sc = CEL.sc, s0 = CEL.st.get(sc), T = CEL.tgt;
    // scorer: sprint to the fans, then the celebration itself
    const ty = CEL.type, run = ty === 'plane' ? 7.2 : 8.6;
    if (!s0.arrived) {
      let tx = T.x, tz = T.z;
      if (ty === 'plane') { const k = Math.sin(CEL.t * 2.2) * 3; tx += k; }
      const d = moveTo(s0, tx, tz, run, 18, dt);
      if (ty === 'slide' && d < 7.5 && Math.hypot(s0.vel.x, s0.vel.z) > 4) { s0.arrived = true; s0.slideT = 0; }
      else if (d < 1.2 || CEL.t > 2.6) { s0.arrived = true; s0.slideT = 0; }
      if (Math.hypot(s0.vel.x, s0.vel.z) > .5) turnTo(s0, Math.atan2(s0.vel.x, s0.vel.z), dt, 12);
    } else {
      s0.slideT += dt;
      if (ty === 'slide') { const f = Math.max(0, 1 - dt * 1.6); s0.vel.x *= f; s0.vel.z *= f; s0.pos.x += s0.vel.x * dt; s0.pos.z += s0.vel.z * dt; }
      else { s0.vel.multiplyScalar(Math.max(0, 1 - dt * 7)); s0.pos.addScaledVector(s0.vel, dt); turnTo(s0, CEL.faceCrowd, dt, 3); }
      if (!CEL.fx) { CEL.fx = 1; confetti(s0.pos, CEL.team); pyro(CEL.side); }
    }
    sc.pos.copy(s0.pos); sc.vel.copy(s0.vel); sc.face = s0.face; sc.celeb = 0;
    // teammates: run in and surround him
    CEL.mates.forEach(p => {
      const s = CEL.st.get(p);
      if (CEL.t > s.delay) {
        const a = CEL.faceCrowd + Math.PI + (s.slot - 1.5) * .9, r = 1.05;
        const tx = s0.pos.x + Math.sin(a) * r, tz = s0.pos.z + Math.cos(a) * r;
        const d = moveTo(s, tx, tz, 8.2, 16, dt);
        if (d > .6 && Math.hypot(s.vel.x, s.vel.z) > .5) turnTo(s, Math.atan2(s.vel.x, s.vel.z), dt, 12);
        else turnTo(s, Math.atan2(s0.pos.x - s.pos.x, s0.pos.z - s.pos.z), dt);
        s.near = d < .7;
      } else { s.vel.multiplyScalar(Math.max(0, 1 - dt * 3)); s.pos.addScaledVector(s.vel, dt); }
      p.pos.copy(s.pos); p.vel.copy(s.vel); p.face = s.face; p.celeb = 0;
    });
    // the other team: stop, heads down
    CEL.opp.forEach(p => {
      const s = CEL.st.get(p);
      s.vel.multiplyScalar(Math.max(0, 1 - dt * 2.5)); s.pos.addScaledVector(s.vel, dt);
      p.pos.copy(s.pos); p.vel.copy(s.vel); p.face = s.face;
    });
  };
  function endCeleb() {
    if (!CEL.on) return;
    CEL.on = false;
    if (S.state === 'goal') S.timer = Math.max(S.timer, 2.75);
    for (const p of S.players) { const m = p.g && p.g.model; if (m) { m.rotation.set(0, 0, 0); m.position.set(0, 0, 0); } }
  }

  /* ---------------- poses ---------------- */
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const _anim = animateSkinned;
  animateSkinned = function (p, dt) {
    _anim(p, dt);
    if (!CEL.on || S.state !== 'goal') return;
    const s = CEL.st.get(p); if (!s) return;
    const B = p.g.B, m = p.g.model, t = CEL.t, sp = Math.hypot(p.vel.x, p.vel.z);
    if (s.role === 'sc') scorerPose(p, s, B, m, sp);
    else if (s.role === 'mate') matePose(p, s, B, m, t);
    else if (s.role === 'gk') { if (sp < 1.5) { const k = ease((t - .3) * 1.5); m.position.y = -.47 * k; bt(B, 'LeftLeg', 0, 1.6 * k); bt(B, 'RightLeg', 0, 1.6 * k); bt(B, 'Spine', 0, .5 * k); bt(B, 'Head', 0, .4 * k); bt(B, 'LeftArm', 0, -.3 * k); bt(B, 'RightArm', 0, -.3 * k); } }
    else if (sp < 1.5) {
      const k = ease((t - .4) * 1.5);
      if (s.kind === 0) { bt(B, 'LeftArm', 2, 2.3 * k); bt(B, 'RightArm', 2, -2.3 * k); bt(B, 'LeftForeArm', 1, 2.1 * k); bt(B, 'RightForeArm', 1, -2.1 * k); bt(B, 'Head', 0, .25 * k); }        // hands on head
      else if (s.kind === 1) { bt(B, 'Spine', 0, .55 * k); bt(B, 'Head', 0, .35 * k); bt(B, 'LeftArm', 0, -.6 * k); bt(B, 'RightArm', 0, -.6 * k); bt(B, 'LeftUpLeg', 0, -.25 * k); bt(B, 'RightUpLeg', 0, -.25 * k); bt(B, 'LeftLeg', 0, .4 * k); bt(B, 'RightLeg', 0, .4 * k); m.position.y = -.06 * k; }  // hands on knees
      else { bt(B, 'LeftArm', 2, .55 * k); bt(B, 'RightArm', 2, -.55 * k); bt(B, 'LeftForeArm', 1, 1.4 * k); bt(B, 'RightForeArm', 1, -1.4 * k); bt(B, 'Head', 0, .45 * k); }                               // hands on hips, head down
    }
  };
  function scorerPose(p, s, B, m, sp) {
    const ty = CEL.type, u = s.arrived ? s.slideT : 0, tt = CEL.t;
    if (!s.arrived) {
      if (ty === 'plane') { const bank = Math.cos(tt * 2.2) * .35; bt(B, 'LeftArm', 2, 1.3); bt(B, 'RightArm', 2, -1.3); bt(B, 'Spine', 2, bank); }
      else if (ty === 'sky') { bt(B, 'LeftArm', 2, 2.7); bt(B, 'RightArm', 2, -2.7); bt(B, 'Head', 0, -.35); }
      else { bt(B, 'RightArm', 2, -2.2 + Math.sin(tt * 9) * .2); }                    // fist up while sprinting away
      return;
    }
    switch (ty) {
      case 'slide': {
        const k = ease(u * 4);
        m.position.y = -.5 * k;
        bt(B, 'LeftUpLeg', 0, -.15 * k); bt(B, 'RightUpLeg', 0, -.15 * k); bt(B, 'LeftLeg', 0, 1.7 * k); bt(B, 'RightLeg', 0, 1.7 * k);
        bt(B, 'Spine', 0, -.55 * k); bt(B, 'Spine1', 0, -.25 * k); bt(B, 'Head', 0, -.35 * k);
        bt(B, 'LeftArm', 2, 1.45 * k); bt(B, 'RightArm', 2, -1.45 * k); bt(B, 'LeftArm', 0, -.35 * k); bt(B, 'RightArm', 0, -.35 * k);
        break;
      }
      case 'plane': {
        const k = ease(u * 3);
        bt(B, 'LeftArm', 2, 1.3 + .9 * k); bt(B, 'RightArm', 2, -1.3 - .9 * k); bt(B, 'Head', 0, -.3 * k);
        m.position.y = Math.abs(Math.sin(u * 7)) * .12 * k;
        break;
      }
      case 'spin': {
        const j = clamp(u / .75, 0, 1), air = Math.sin(j * Math.PI);
        m.position.y = air * .75; m.rotation.y = ease(j) * Math.PI * 2;
        const land = ease((u - .75) * 4);
        bt(B, 'LeftUpLeg', 0, -.5 * air); bt(B, 'RightUpLeg', 0, -.2 * air); bt(B, 'LeftLeg', 0, .9 * air);
        bt(B, 'LeftArm', 2, .6 + .4 * land); bt(B, 'RightArm', 2, -.6 - .4 * land); bt(B, 'LeftArm', 0, .35 * land); bt(B, 'RightArm', 0, .35 * land);
        bt(B, 'Spine', 0, -.25 * land); bt(B, 'Head', 0, -.25 * land);
        if (j >= 1) { m.position.y = -.08 * land; bt(B, 'LeftUpLeg', 2, .25 * land); bt(B, 'RightUpLeg', 2, -.25 * land); bt(B, 'LeftLeg', 0, .35 * land); bt(B, 'RightLeg', 0, .35 * land); }
        break;
      }
      case 'flip': {
        const pre = .25, j = clamp((u - pre) / .8, 0, 1), crouch = ease(u / pre) * (1 - ease((u - pre) * 6));
        const a = -ease(j) * Math.PI * 2, h = .95, jump = Math.sin(j * Math.PI) * 1.05;
        m.rotation.x = a; m.position.set(0, h + jump - h * Math.cos(a) - .3 * crouch, -h * Math.sin(a));
        const tuck = Math.sin(j * Math.PI);
        bt(B, 'LeftUpLeg', 0, -1.5 * tuck - .5 * crouch); bt(B, 'RightUpLeg', 0, -1.5 * tuck - .5 * crouch); bt(B, 'LeftLeg', 0, 1.9 * tuck + .9 * crouch); bt(B, 'RightLeg', 0, 1.9 * tuck + .9 * crouch);
        bt(B, 'LeftArm', 2, 2.4 * (1 - tuck) + .6); bt(B, 'RightArm', 2, -2.4 * (1 - tuck) - .6);
        if (j >= 1) { const k = ease((u - pre - .8) * 3); bt(B, 'Spine', 0, -.2 * k); }
        break;
      }
      case 'ears': {
        const k = ease(u * 3), sway = Math.sin(u * 3) * .25;
        bt(B, 'LeftArm', 2, 2.0 * k); bt(B, 'RightArm', 2, -2.0 * k); bt(B, 'LeftForeArm', 1, 2.2 * k); bt(B, 'RightForeArm', 1, -2.2 * k);
        bt(B, 'Spine', 1, sway * k); bt(B, 'Spine', 0, -.15 * k); bt(B, 'Head', 2, sway * .6 * k);
        break;
      }
      case 'sky': {
        const k = ease(u * 3);
        bt(B, 'LeftArm', 2, 2.7); bt(B, 'RightArm', 2, -2.7); bt(B, 'Head', 0, -.55 * k); bt(B, 'Spine', 0, -.25 * k);
        m.position.y = -.04 * k; bt(B, 'LeftLeg', 0, .15 * k); bt(B, 'RightLeg', 0, .15 * k);
        break;
      }
      default: {          // dance
        const k = ease(u * 3), w = u * 7.5;
        m.position.y = Math.abs(Math.sin(w)) * .1 * k - .05 * k;
        bt(B, 'Hips', 2, Math.sin(w) * .18 * k); bt(B, 'Spine', 2, -Math.sin(w) * .22 * k);
        bt(B, 'LeftArm', 2, (1.2 + Math.sin(w) * .9) * k); bt(B, 'RightArm', 2, -(1.2 - Math.sin(w) * .9) * k);
        bt(B, 'LeftForeArm', 1, 1.2 * k); bt(B, 'RightForeArm', 1, -1.2 * k);
        bt(B, 'LeftLeg', 0, (.3 + .3 * Math.max(0, Math.sin(w))) * k); bt(B, 'RightLeg', 0, (.3 + .3 * Math.max(0, -Math.sin(w))) * k);
      }
    }
  }
  function matePose(p, s, B, m, t) {
    if (!s.near) { if (t > s.delay) bt(B, 'RightArm', 2, -1.9); return; }
    s.nt = (s.nt || 0) + 1 / 60;
    const k = ease(s.nt * 3), w = t * 8 + s.slot * 1.7;
    if (s.kind === 0) {           // jumping with arms up
      m.position.y = Math.abs(Math.sin(w)) * .32 * k;
      bt(B, 'LeftArm', 2, 2.5 * k); bt(B, 'RightArm', 2, -2.5 * k);
    } else {                      // hugging in
      bt(B, 'LeftArm', 0, -1.3 * k); bt(B, 'RightArm', 0, -1.3 * k); bt(B, 'LeftArm', 1, -.5 * k); bt(B, 'RightArm', 1, .5 * k);
      bt(B, 'Spine', 0, .25 * k); m.position.y = Math.abs(Math.sin(w * .5)) * .06 * k;
    }
  }

  /* ---------------- camera ---------------- */
  let shake = 0;
  const _cam = updateCamera, cv = new THREE.Vector3(), lv = new THREE.Vector3();
  updateCamera = function (dt) {
    if (!CEL.on || S.state !== 'goal') { _cam(dt); return; }
    const sc = CEL.sc, s0 = CEL.st.get(sc), t = CEL.t;
    if (t < .7) { _cam(dt); applyShake(dt); return; }
    const fa = CEL.faceCrowd, crowded = CEL.mates.some(p => CEL.st.get(p).near);
    // in front of the scorer (between him and the fans), low, slowly orbiting; wider once the team arrives
    const orb = Math.sin(t * .35) * .7 + (s0.arrived ? 0 : -.6);
    const ang = s0.arrived ? fa + orb : Math.atan2(s0.vel.x, s0.vel.z) + orb;
    const dist = crowded ? 7.6 : s0.arrived ? 5.6 : 7, hgt = crowded ? 2.5 : 1.45;
    cv.set(s0.pos.x + Math.sin(ang) * dist, hgt, s0.pos.z + Math.cos(ang) * dist);
    cv.z = clamp(cv.z, -PW - 3.5, PW + 3.5); cv.x = clamp(cv.x, -PL - 3, PL + 3);
    lv.set(s0.pos.x, CEL.type === 'slide' && s0.arrived ? .6 : .95, s0.pos.z);
    if (CEL.camInit) { CEL.camInit = false; }
    const k = 1 - Math.exp(-dt * (s0.arrived ? 2.2 : 3.2));
    camera.position.lerp(cv, k); camLook.lerp(lv, 1 - Math.exp(-dt * 5)); camera.lookAt(camLook);
    applyShake(dt);
  };
  function applyShake(dt) {
    if (shake <= 0) return;
    shake = Math.max(0, shake - dt);
    const a = shake * .12;
    camera.position.x += (Math.random() - .5) * a; camera.position.y += (Math.random() - .5) * a;
  }

  /* ---------------- confetti and pyro ---------------- */
  const NC = 420, cGeo = new THREE.BufferGeometry(), cPos = new Float32Array(NC * 3), cCol = new Float32Array(NC * 3), cVel = new Float32Array(NC * 3), cLife = new Float32Array(NC);
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  const CONF = new THREE.Points(cGeo, new THREE.PointsMaterial({ size:.09, vertexColors:true, transparent:true, opacity:.95, depthWrite:false }));
  CONF.frustumCulled = false; CONF.visible = false; scene.add(CONF);
  function confetti(at, team) {
    const cols = [new THREE.Color(team.kit.c1), new THREE.Color(team.kit.c2 || '#ffffff'), new THREE.Color('#ffd23f'), new THREE.Color('#ffffff')];
    for (let i = 0; i < NC; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3.2;
      cPos[i * 3] = at.x + Math.sin(a) * r * .3; cPos[i * 3 + 1] = 3.5 + Math.random() * 3; cPos[i * 3 + 2] = at.z + Math.cos(a) * r * .3;
      cVel[i * 3] = Math.sin(a) * r; cVel[i * 3 + 1] = 2 + Math.random() * 4; cVel[i * 3 + 2] = Math.cos(a) * r;
      const c = cols[i % cols.length]; cCol[i * 3] = c.r; cCol[i * 3 + 1] = c.g; cCol[i * 3 + 2] = c.b;
      cLife[i] = 4 + Math.random() * 2;
    }
    cGeo.attributes.color.needsUpdate = true; CONF.visible = true;
  }
  const NP = 360, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const PYRO = new THREE.Points(pGeo, new THREE.PointsMaterial({ size:.55, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
  PYRO.frustumCulled = false; PYRO.visible = false; scene.add(PYRO);
  const PY = { t:0, side:1, next:0 };
  function pyro(side) { PY.t = 2.2; PY.side = side; PY.next = 0; PYRO.visible = true; }
  let lastT = performance.now();
  (function tick() {
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (CONF.visible) {
      let alive = 0;
      for (let i = 0; i < NC; i++) {
        if (cLife[i] <= 0) { cPos[i * 3 + 1] = -50; continue; }
        alive++; cLife[i] -= dt;
        const j = i * 3; cVel[j + 1] -= 3.2 * dt; const dr = Math.max(0, 1 - dt * 1.6); cVel[j] *= dr; cVel[j + 2] *= dr; cVel[j + 1] = Math.max(cVel[j + 1], -1.1);
        cPos[j] += (cVel[j] + Math.sin(now / 300 + i) * .5) * dt; cPos[j + 1] += cVel[j + 1] * dt; cPos[j + 2] += (cVel[j + 2] + Math.cos(now / 340 + i) * .5) * dt;
        if (cPos[j + 1] < .02) { cPos[j + 1] = .02; cVel[j] = cVel[j + 2] = 0; }
      }
      cGeo.attributes.position.needsUpdate = true; if (!alive) CONF.visible = false;
    }
    if (PYRO.visible) {
      PY.t -= dt; let alive = 0;
      if (PY.t > 0) {   // emit from four jets on the track behind the goal
        PY.next -= dt;
        for (let e = 0; PY.next <= 0 && e < 12; e++) {
          PY.next += .008;
          let i = (Math.random() * NP) | 0; const jet = (Math.random() * 4) | 0;
          const x = PY.side * (PL + 4.5), z = [-12, -6, 6, 12][jet];
          pPos[i * 3] = x; pPos[i * 3 + 1] = .3; pPos[i * 3 + 2] = z;
          pVel[i * 3] = (Math.random() - .5) * .8; pVel[i * 3 + 1] = 9 + Math.random() * 4; pVel[i * 3 + 2] = (Math.random() - .5) * .8;
          pLife[i] = .55 + Math.random() * .35;
        }
      }
      for (let i = 0; i < NP; i++) {
        const j = i * 3;
        if (pLife[i] <= 0) { pPos[j + 1] = -50; continue; }
        alive++; pLife[i] -= dt; pVel[j + 1] -= 4 * dt;
        pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
        const h = clamp(pLife[i] / .9, 0, 1);
        pCol[j] = 1 * h + .2; pCol[j + 1] = .45 * h * h + .05; pCol[j + 2] = .08 * h;
      }
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
      if (!alive && PY.t <= 0) PYRO.visible = false;
    }
  })();
})();
