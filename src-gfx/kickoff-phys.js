/* Kickoff Rivals: realistic ball flight, bounces, player momentum, and a crowd-noise switch.
   Ball in the air now has proper air drag, topspin dip on driven shots, backspin float on lofted balls
   and a knuckle wobble on some hard, spinless shots. Every lofted kick is re-aimed so it still reaches
   the same spot (and a shot still crosses the goal line at the same height and time) the AI planned for,
   so passing and shooting accuracy stay the same while the flight looks real. */
(function () {
  if (typeof ballPhysics !== 'function' || typeof kickBall !== 'function') return;

  const DRAG = .0062;      // quadratic air drag per (m/s) of speed, per second (about half of a real ball, for playability)
  const MAG = .055;        // vertical Magnus push from topspin / backspin
  const SIM_DT = 1 / 120;

  /* ---------- one air step, used both for the real ball and for aiming ---------- */
  function extraAir(v, b, dt) {
    const hs = Math.hypot(v.x, v.z), sp = Math.hypot(hs, v.y);
    const f = Math.max(0, 1 - DRAG * sp * dt);
    v.x *= f; v.y *= f; v.z *= f;
    if (b.top) { v.y -= b.top * hs * MAG * dt; b.top *= Math.pow(.75, dt); if (Math.abs(b.top) < .01) b.top = 0; }
    if (b.kn && hs > 4) {
      b.kt = (b.kt || 0) + dt;
      const px = -v.z / hs, pz = v.x / hs;
      const side = Math.sin(b.kt * 10.5 + b.kph) * b.kn * hs * .05, up = Math.cos(b.kt * 7.7 + b.kph * 1.9) * b.kn * hs * .035;
      v.x += px * side * dt; v.z += pz * side * dt; v.y += up * dt;
      b.kn *= Math.pow(.55, dt); if (b.kn < .02) b.kn = 0;
    }
  }
  // same air model as the game (gravity, light drag, curl) plus optionally the new forces
  function sim(v0, p0, spin, extra, stop) {
    const v = { x:v0.x, y:v0.y, z:v0.z }, p = { x:p0.x, y:p0.y, z:p0.z };
    const b = { top:extra ? extra.top : 0, kn:extra ? extra.kn : 0, kph:extra ? extra.kph : 0, kt:0 };
    let s = spin, t = 0;
    for (let i = 0; i < 900; i++) {
      if (extra) extraAir(v, b, SIM_DT);
      v.y -= GRAV * SIM_DT; const f = 1 - .05 * SIM_DT; v.x *= f; v.y *= f; v.z *= f;
      if (s) { const hs = Math.hypot(v.x, v.z); if (hs > 3) { const px = -v.z / hs, pz = v.x / hs; v.x += px * s * hs * .12 * SIM_DT; v.z += pz * s * hs * .12 * SIM_DT; } s *= Math.pow(.35, SIM_DT); if (Math.abs(s) < .02) s = 0; }
      const ox = p.x; p.x += v.x * SIM_DT; p.y += v.y * SIM_DT; p.z += v.z * SIM_DT; t += SIM_DT;
      const r = stop(p, v, ox); if (r) { if (r === 2) { const k = (Math.abs(p.x) - stop.gx) / (Math.abs(p.x - ox) || 1); p.x -= v.x * SIM_DT * k; p.y -= v.y * SIM_DT * k; p.z -= v.z * SIM_DT * k; t -= SIM_DT * k; } return { p, t, how:r }; }
    }
    return { p, t, how:0 };
  }

  /* ---------- re-aim a lofted kick so the new physics lands where the old one would ---------- */
  function reAim() {
    const b = ball, v = b.vel, P = b.pos;
    b.top = 0; b.kn = 0; b.kt = 0;
    if (b.owner || v.y < 1.2) return;
    const hs = Math.hypot(v.x, v.z); if (hs < 1) return;
    const extra = { top:0, kn:0, kph:Math.random() * 6.3 };
    let stop, gx = 0;
    const shot = b.shot && Math.sign(v.x) === b.shot.team.side;
    if (shot) {
      gx = PL;
      stop = (p, vv) => (Math.abs(p.x) >= PL && Math.sign(p.x) === Math.sign(v.x)) ? 2 : (p.y < BR && vv.y < 0) ? 1 : 0; stop.gx = PL;
      if (hs > 24 && Math.abs(b.spin || 0) < .25 && Math.random() < .35) extra.kn = .9 + Math.random() * .5;   // knuckleball
      else extra.top = clamp((hs - 13) * .06, 0, 1.0) * (v.y < 6 ? 1 : .5);                              // driven shots dip
    } else {
      stop = (p, vv) => (p.y < BR && vv.y < 0) ? 1 : 0;
      extra.top = v.y > 4 ? -.3 : .2;                                                                       // lofted balls float, chips skid
    }
    const old = sim(v, P, b.spin || 0, null, stop);
    if (!old.how || old.t < .15) return;
    const D0 = Math.hypot(old.p.x - P.x, old.p.z - P.z);
    let k = 1, vy = v.y, ang = 0;
    for (let it = 0; it < 10; it++) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const tv = { x:(v.x * c - v.z * s) * k, y:vy, z:(v.x * s + v.z * c) * k };
      const r = sim(tv, P, b.spin || 0, extra, stop);
      if (shot && r.how === 2 && old.how === 2) {
        k *= clamp(r.t / old.t, .85, 1.2);
        vy += (old.p.y - r.p.y) / Math.max(r.t, .1);
      } else {
        const D1 = Math.hypot(r.p.x - P.x, r.p.z - P.z) || 1;
        k *= clamp(D0 / D1, .8, 1.25);
        vy += clamp((old.t - r.t) * GRAV * .5, -3, 3);
      }
      // keep the direction: rotate so the ball ends up on the same line as before
      const a0 = Math.atan2(old.p.z - P.z, old.p.x - P.x), a1 = Math.atan2(r.p.z - P.z, r.p.x - P.x);
      let da = a0 - a1; da = Math.atan2(Math.sin(da), Math.cos(da)); ang += clamp(da, -.08, .08);
      k = clamp(k, .75, 1.6);
    }
    const c = Math.cos(ang), s = Math.sin(ang);
    v.set((v.x * c - v.z * s) * k, vy, (v.x * s + v.z * c) * k);
    b.top = extra.top; b.kn = extra.kn; b.kph = extra.kph;
    if (b.shot) b.shot.maxV = v.length();
  }

  /* ---------- kicks and ball physics ---------- */
  const oldKick = kickBall;
  kickBall = function (p, v) { oldKick(p, v); ball.top = 0; ball.kn = 0; ball._aim = true; };
  const oldBall = ballPhysics;
  ballPhysics = function (dt) {
    const b = ball; if (window.PHYS_OFF && PHYS_OFF.ball) { b._aim = false; return oldBall(dt); }
    if (b._aim) { b._aim = false; reAim(); }
    if (b.owner) { b.top = b.kn = 0; return oldBall(dt); }
    const v = b.vel, P = b.pos, air = P.y > BR + .01 || v.y > .01;
    if (air) extraAir(v, b, dt);
    const vyIn = v.y, hsIn = Math.hypot(v.x, v.z);
    oldBall(dt);
    // bounce: impact-speed dependent restitution, spin makes it skid on or check up
    if (air && vyIn < -1.6 && v.y > 0 && P.y <= BR + .001) {
      const imp = -vyIn, e = clamp(.66 - imp * .012, .42, .62);
      v.y = imp * e;
      const grip = clamp(.86 + (b.top || 0) * .08, .74, .95), hs = Math.hypot(v.x, v.z);
      if (hs > 0 && hsIn > 0) { const k = hsIn * grip / hs; v.x *= k; v.z *= k; }
      b.top = (b.top || 0) * .35; b.kn = 0;
      if (imp > 3.2) playFx('bounce', imp);
    }
    // rolling ball: no knuckle or lift once it is on the turf
    if (P.y <= BR + .001 && v.y === 0) { b.kn = 0; b.top *= Math.pow(.2, dt); }
    // spin the ball mesh with its spin (side spin around the vertical, top spin around the travel axis)
    if (typeof ballMesh !== 'undefined') {
      if (b.spin) ballMesh.rotation.y += b.spin * 18 * dt;
      if (b.top && hsIn > 1) { ballMesh.rotateOnWorldAxis(AXIS.set(-v.z, 0, v.x).normalize(), b.top * 22 * dt); }
      if (b.kn) ballMesh.rotation.y += .4 * dt;
    }
  };
  const AXIS = new THREE.Vector3();

  /* ---------- players: momentum, harder to turn at full sprint, quicker to brake ---------- */
  window.PHYS_OFF = window.PHYS_OFF || {};
  window.movePhys = function (p, want, human, dt) {
    // AI keeps its tuned movement; momentum is for the player you control
    if (PHYS_OFF.move || !human) { const ax = want[0] - p.vel.x, az = want[1] - p.vel.z, am = Math.hypot(ax, az), maxA = (human ? 34 : 16) * dt; if (am > maxA) { p.vel.x += ax / am * maxA; p.vel.z += az / am * maxA; } else { p.vel.x = want[0]; p.vel.z = want[1]; } return; }
    const base = human ? 31 : 16, vx = p.vel.x, vz = p.vel.z, s = Math.hypot(vx, vz);
    let ax = want[0] - vx, az = want[1] - vz;
    if (s < .6) { const am = Math.hypot(ax, az), m = base * 1.1 * dt; if (am > m) { ax *= m / am; az *= m / am; } p.vel.x += ax; p.vel.z += az; return; }
    const ux = vx / s, uz = vz / s, al = ax * ux + az * uz;
    let lx = ax - ux * al, lz = az - uz * al;
    const sk = clamp(s / 9, 0, 1);
    const aMax = (al > 0 ? base * (1.05 - .45 * sk) : base * 1.35) * dt;           // easing into top speed, sharp braking
    const lMax = base * (1.2 - .5 * sk) * dt;                                      // wide turns at full sprint
    const a = clamp(al, -aMax, aMax), lm = Math.hypot(lx, lz);
    if (lm > lMax) { lx *= lMax / lm; lz *= lMax / lm; }
    p.vel.x += ux * a + lx; p.vel.z += uz * a + lz;
  };

  /* ---------- shoulder-to-shoulder: bodies push and trade momentum ---------- */
  const oldSep = separate;
  separate = function () {
    const P = S.players; if (PHYS_OFF.sep) return oldSep();
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], c = P[j], dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < .72 && d > 1e-4) {
        const nx = dx / d, nz = dz / d, rv = (c.vel.x - a.vel.x) * nx + (c.vel.z - a.vel.z) * nz;
        if (rv < 0) {
          const j2 = -rv * .5 * .3, fa = S.frozen === a ? 0 : ball.owner === a ? .4 : 1, fc = S.frozen === c ? 0 : ball.owner === c ? .4 : 1;   // the man on the ball holds his line better
          a.vel.x -= nx * j2 * fa; a.vel.z -= nz * j2 * fa; c.vel.x += nx * j2 * fc; c.vel.z += nz * j2 * fc;
        }
      }
    }
    oldSep();
  };

  /* ---------- sound: ball bounce thud, and the crowd / background noise switch ---------- */
  const oldFx = playFx;
  playFx = function (type, a, b, c) {
    if (type !== 'bounce') return oldFx(type, a, b, c);
    const ctx = AU.ctx; if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(55, t + .09);
    g.gain.setValueAtTime(clamp(a / 40, .03, .16), t); g.gain.exponentialRampToValueAtTime(.001, t + .11);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .12);
  };
  const CROWD_LV = [1, .4, 0], CROWD_N = ['ON', 'LOW', 'OFF'];
  if (SET.crowd == null) SET.crowd = 0;
  function applyCrowd() { if (AU.crowdMaster) AU.crowdMaster.gain.setTargetAtTime(CROWD_LV[SET.crowd] || 0, AU.ctx.currentTime, .05); }
  const oldInit = audioInit;
  audioInit = function () {
    oldInit();
    if (AU.ctx && AU.crowd && !AU.crowdMaster) {
      try {
        AU.crowdMaster = AU.ctx.createGain(); AU.crowdMaster.gain.value = CROWD_LV[SET.crowd];
        AU.crowd.disconnect(); AU.crowd.connect(AU.crowdMaster); AU.crowdMaster.connect(AU.ctx.destination);
      } catch (e) {}
    }
  };
  window.setCrowd = function (i) { SET.crowd = ((i % 3) + 3) % 3; saveSet(); applyCrowd(); };
  const oldSettings = showSettings;
  showSettings = function () {
    oldSettings();
    const card = $('settings').querySelector('.card'), rows = card && card.querySelectorAll('.row');
    if (!rows || !rows.length) return;
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<span class="lab">CROWD NOISE</span>' + CROWD_N.map((n, i) => `<button type="button" class="${i === SET.crowd ? 'sel' : ''}" data-crowd="${i}">${n}</button>`).join('');
    rows[3].after(row);
    const keys = card.querySelector('.keys'); if (keys && !/M<\/b>/.test(keys.innerHTML)) keys.insertAdjacentHTML('beforeend', '<div><b>M</b> crowd noise on / low / off</div>');
  };
  $('settings').addEventListener('click', e => {
    const b = e.target.closest('button[data-crowd]'); if (!b) return;
    audioInit(); setCrowd(+b.dataset.crowd); showSettings();
  });
  addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || (e.target && e.target.tagName === 'INPUT')) return;
    audioInit(); setCrowd(SET.crowd + 1);
    if (S.state !== 'menu') toast('Crowd noise: ' + CROWD_N[SET.crowd]);
  });
})();
