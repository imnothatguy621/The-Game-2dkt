/* Kickoff Rivals: real goal nets and a solid ball.
   NETS: every net panel is a springy cloth (a wave simulation on its grid, pinned at the frame).
   The ball pushes into it, the mesh bulges around the ball as a cone, the net soaks up the ball's
   speed and springs it back, and ripples run across the panel. Balls going wide hit the side netting
   from the outside, and lobs that land on the roof make it sag and roll off.
   DEFLECTIONS: the ball is a solid object. A fast ball that hits a player's body (shins, chest, back,
   head) bounces off him at an angle instead of passing through or being trapped dead. */
(function () {
  if (typeof NETS === 'undefined' || !NETS.length || typeof ballPhysics !== 'function') return;
  window.NETPHYS = true;

  /* ---------------- net panels ---------------- */
  scene.updateMatrixWorld(true);
  const PANELS = NETS.map(m => {
    const g = m.geometry, P = g.parameters, nx = P.widthSegments + 1, ny = P.heightSegments + 1;
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
    const nW = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
    const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), sx = Math.sign(c.x);
    const inside = new THREE.Vector3(sx * (PL + 1), .9, 0);
    const out = Math.sign(nW.dot(c.clone().sub(inside))) || 1;         // +1 if local +z points out of the goal
    const pos = g.attributes.position, base = new Float32Array(pos.count);
    const lx = new Float32Array(pos.count), ly = new Float32Array(pos.count), pin = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      base[i] = pos.getZ(i); lx[i] = pos.getX(i); ly[i] = pos.getY(i);
      const ix = i % nx, iy = (i / nx) | 0; pin[i] = ix === 0 || iy === 0 || ix === nx - 1 || iy === ny - 1 ? 1 : 0;
    }
    // the bottom edge of the back net lies loose on the grass: let it move a little
    return { m, g, nx, ny, w:P.width, h:P.height, inv, nW, out, sx, base, lx, ly, pin,
      d:new Float32Array(pos.count), u:new Float32Array(pos.count), side:0, awake:0 };
  });
  const LB = new THREE.Vector3();
  const KN = 150, CN = 22, MAXPEN = .9, FRIC = 3.5;

  // ball against every panel: soft catch from inside, side-netting from outside, roof sag from above
  function netForces(dt) {
    const b = ball, P = b.pos, v = b.vel;
    if (b.owner || Math.abs(P.x) < PL - 1.2) { for (const p of PANELS) p.side = 0; return; }
    for (const p of PANELS) {
      if (Math.sign(P.x) !== p.sx) { p.side = 0; continue; }
      LB.copy(P).applyMatrix4(p.inv);
      const inB = Math.abs(LB.x) < p.w / 2 + BR * .5 && Math.abs(LB.y) < p.h / 2 + BR * .5;
      const h = LB.z * p.out;                                   // + outside the goal, - inside
      if (!inB) { p.side = 0; p.contact = 0; continue; }
      if (!p.side) p.side = h < 0 ? -1 : 1;
      const pen = p.side < 0 ? h + BR : BR - h;
      if (pen <= 0) { p.contact = 0; continue; }
      const n = p.nW, s = p.out * (p.side < 0 ? 1 : -1);      // direction the ball is pushing the net
      const nx = n.x * s, ny = n.y * s, nz = n.z * s;
      let vn = v.x * nx + v.y * ny + v.z * nz;
      // spring + heavy damping, solved implicitly so it stays stable at any frame rate
      const vn2 = (vn - KN * pen * dt) / (1 + CN * dt);
      let dv = vn2 - vn;
      if (pen > MAXPEN) {                                         // net at full stretch: stop dead
        const k = pen - MAXPEN; P.x -= nx * k; P.y -= ny * k; P.z -= nz * k;
        if (vn2 > 0) dv = -vn - vn * .12;
      }
      v.x += nx * dv; v.y += ny * dv; v.z += nz * dv;
      // the mesh grabs the ball: tangential friction
      const vn3 = v.x * nx + v.y * ny + v.z * nz, f = Math.max(0, 1 - FRIC * dt);
      v.x = nx * vn3 + (v.x - nx * vn3) * f; v.y = ny * vn3 + (v.y - ny * vn3) * f; v.z = nz * vn3 + (v.z - nz * vn3) * f;
      if (b.w) { b.w.x *= f; b.w.y *= f; b.w.z *= f; }
      b.spin *= f;
      if (!p.contact && Math.abs(vn) > 4) { if (typeof playFx === 'function') playFx('netswish', Math.abs(vn)); if (p.side > 0 && b.shot) toast('Side netting!'); }
      p.contact = 1;
    }
  }

  /* ---------------- ball physics: soft net instead of the old hard walls ---------------- */
  const _bp = ballPhysics;
  ballPhysics = function (dt) {
    _bp(dt);
    if (ball.owner) return;
    const n = 3, h = dt / n;
    for (let i = 0; i < n; i++) netForces(h);
    // safety: once in the goal, never let the ball leave through a gap between panels
    const P = ball.pos, v = ball.vel, ax = Math.abs(P.x), sx = Math.sign(P.x);
    if (ax < PL - .5) ball.inGoal = false;
    else if (ax > PL && ax < PL + .6 && Math.abs(P.z) < GW && P.y < GH) ball.inGoal = true;
    if (ball.inGoal && ax > PL) {
      const lim = GW + MAXPEN * .8;
      if (ax > PL + 2.2 + MAXPEN) { P.x = sx * (PL + 2.2 + MAXPEN); if (v.x * sx > 0) v.x *= -.1; }
      if (Math.abs(P.z) > lim) { P.z = Math.sign(P.z) * lim; if (v.z * P.z > 0) v.z *= -.1; }
      if (P.y > GH + MAXPEN * .8) { P.y = GH + MAXPEN * .8; if (v.y > 0) v.y *= -.1; }
    }
  };

  /* ---------------- cloth simulation (also runs during replays) ---------------- */
  const TN = 560, KS = 30, DMP = 6;     // wave speed²/grid², spring back to rest, damping
  function netTick(dt) {
    dt = Math.min(dt, 1 / 30);
    const P = ball.pos, near = Math.abs(P.x) > PL - 2.5;
    for (const p of PANELS) {
      if (Math.sign(P.x) !== p.sx && !p.awake) continue;
      if (!near && !p.awake) continue;
      const { d, u, pin, lx, ly, nx } = p, cnt = d.length;
      // ball pressing in: cone-shaped bulge around the contact point
      LB.copy(P).applyMatrix4(p.inv);
      const h = LB.z * p.out, inB = Math.abs(LB.x) < p.w / 2 + .3 && Math.abs(LB.y) < p.h / 2 + .3;
      let press = 0, sgn = 1;
      if (inB) { const side = p.side || (h < 0 ? -1 : 1); press = side < 0 ? h + BR : BR - h; sgn = side < 0 ? 1 : -1; }
      // wave equation on the grid, two half steps
      for (let it = 0; it < 2; it++) {
        const sdt = dt / 2;
        for (let i = 0; i < cnt; i++) {
          if (pin[i]) { d[i] = 0; u[i] = 0; continue; }
          const lap = d[i - 1] + d[i + 1] + d[i - nx] + d[i + nx] - 4 * d[i];
          u[i] += (TN * lap - KS * d[i] - DMP * u[i]) * sdt;
        }
        for (let i = 0; i < cnt; i++) if (!pin[i]) d[i] += u[i] * sdt;
      }
      let mx = 0;
      if (press > 0) {
        for (let i = 0; i < cnt; i++) {
          if (pin[i]) continue;
          const lat = Math.hypot(lx[i] - LB.x, ly[i] - LB.y);
          if (lat > 1.6) continue;
          const tgt = (Math.min(press, MAXPEN) - lat * .5) * sgn;
          if (sgn > 0 ? d[i] < tgt : d[i] > tgt) { u[i] = (tgt - d[i]) / Math.max(dt, .008) * .5; d[i] = tgt; }
        }
      }
      const pos = p.g.attributes.position, base = p.base;
      for (let i = 0; i < cnt; i++) { const v = clamp(d[i], -.6, .9); pos.array[i * 3 + 2] = base[i] + v * p.out; if (Math.abs(d[i]) > mx) mx = Math.abs(d[i]); if (Math.abs(u[i]) > mx) mx = Math.abs(u[i]); }
      pos.needsUpdate = true;
      p.awake = mx > 2e-4 || press > 0 ? 1 : 0;
      if (!p.awake) { d.fill(0); u.fill(0); for (let i = 0; i < cnt; i++) pos.array[i * 3 + 2] = base[i]; pos.needsUpdate = true; }
    }
  }
  // replace the old fake ripple; a goal just gives the net a shake on top of the real bulge
  rippleTick = function (dt) { netTick(dt); };
  netImpulse = function (x, y, z) {
    for (const p of PANELS) {
      if (Math.sign(x) !== p.sx) continue;
      LB.set(x, y, z).applyMatrix4(p.inv);
      for (let i = 0; i < p.d.length; i++) { if (p.pin[i]) continue; const r = Math.hypot(p.lx[i] - LB.x, p.ly[i] - LB.y); p.u[i] += 1.6 * Math.exp(-r * 1.6); }
      p.awake = 1;
    }
  };

  /* ---------------- a solid ball: deflections off players ---------------- */
  let kickId = 0;
  const _kick = kickBall;
  kickBall = function (p, v) { _kick(p, v); kickId++; ball.kickT = S.clock; ball.defl = null; };
  const BODY_R = .3;
  function deflect() {
    const b = ball, P = b.pos, v = b.vel;
    if (b.owner || S.state !== 'play') return;
    const sp = v.length(); if (sp < 6) return;
    for (const p of S.players) {
      if (p.role === 'GK' || p.stun > 0) continue;
      if (p === b.lastTouch && S.clock - (b.kickT || 0) < .35) continue;
      if (p === b.intended) continue;
      if (P.y > 1.95) continue;
      const dx = P.x - p.pos.x, dz = P.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.05 || d < 1e-4) continue;
      const rvx = v.x - p.vel.x, rvz = v.z - p.vel.z, nx = dx / d, nz = dz / d, vn = rvx * nx + rvz * nz;
      if (vn > 0) continue;
      // decide once per kick: does this ball bounce off him, or can he control it like before?
      if (p._dk !== kickId) {
        p._dk = kickId;
        const opp = b.lastTouch && b.lastTouch.team !== p.team;
        const hi = P.y > .85, fast = sp > 14;
        p._defl = hi ? true : Math.random() < (fast ? (opp ? .55 : .3) : (opp ? .25 : .12));
      }
      if (!p._defl) continue;
      p.kickCd = Math.max(p.kickCd || 0, .05);                                   // he can't trap this one
      const r = (P.y < .7 ? .62 : BODY_R + BR);                                  // legs reach further than the body
      if (d > r) continue;
      // bounce off his body
      const e = .28 + Math.random() * .25;
      v.x -= (1 + e) * vn * nx; v.z -= (1 + e) * vn * nz;
      const tx = -nz, tz = nx, sk = (Math.random() - .5) * .45 * sp;          // a bit of chaos: you never know where a deflection goes
      v.x += tx * sk; v.z += tz * sk;
      if (P.y < .6) v.y += Math.random() * Math.min(5, sp * .22);              // off the shin: loops up
      else if (P.y > 1.55) v.y = Math.abs(v.y) * .4 + 1.5;                      // off the head
      else v.y *= .4;
      v.multiplyScalar(.82);
      P.x = p.pos.x + nx * (r + .02); P.z = p.pos.z + nz * (r + .02);
      b.spin = (Math.random() - .5) * 1.2; b.kn = 0;
      b.w = { x:(Math.random() - .5) * 40, y:(Math.random() - .5) * 60, z:(Math.random() - .5) * 40 };
      b.lastTouch = p; b.intended = null; b.defl = p;
      p.kickCd = Math.max(p.kickCd || 0, .28);
      p.stun = Math.max(p.stun || 0, sp > 20 ? .35 : .15);
      if (typeof playFx === 'function') playFx('bounce', Math.min(30, sp * 1.4));
      if (b.shot && b.shot.team !== p.team) toast('Deflected!'); else if (sp > 15) toast('Blocked!');
      S.excite = Math.max(S.excite, .5);
      return;
    }
  }
  const _cp = checkPickup;
  checkPickup = function () { deflect(); _cp(); };

  /* ---------------- net swish sound ---------------- */
  const _fx = playFx;
  playFx = function (type, a, b, c) {
    if (type !== 'netswish') return _fx(type, a, b, c);
    const ctx = AU.ctx; if (!ctx) return;
    const t = ctx.currentTime, len = .35, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = .7;
    g.gain.value = clamp(a / 60, .04, .22);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  };
})();
