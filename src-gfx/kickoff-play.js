/* Kickoff Rivals: on-pitch gameplay upgrades.
   SHOT TYPES  finesse (curled to the far post), low driven (near post) and power shots. Tap shots pick the
               right one for the situation; on keyboard hold E for finesse or Q for low driven.
   DINKED PASS sprint + lob: a short chipped pass that floats just over a lunging defender.
   THROUGH BALL looks for the gap: aims where your runner gets there before any defender.
   VISION      passes played behind your body (more than ~100° from where you face) are less accurate.
   ONE-TWO     after a pass your player keeps running; pass straight back within a second and it's played
               into his run.
   SHIELDING   hold E (press) on the ball: slow down, put your body between the defender and the ball.
   DUELS       tackles from behind and into a shielding player rarely win the ball.
   HEADERS     players now head the ball: attackers at goal, defenders clear it, midfielders knock it on.
   CORNERS     two-phase corners: pick a zone (near post, penalty spot, far post, edge of the box), then the
               camera drops into the box in slow motion while the ball is in the air: move your attacker,
               Q to switch attacker, E to shrug off your marker, and he heads it when it arrives. */
(function () {
  if (typeof humanAction !== 'function' || typeof shoot !== 'function') return;
  const KEY = k => !!(IN.keys && IN.keys[k]);
  const _kb = kickBall;
  kickBall = function (p, v) { const l = v.length(); if (l > 36) v.multiplyScalar(36 / l); _kb(p, v); };   // nobody kicks harder than ~130 km/h
  const hint = document.createElement('div');
  hint.id = 'cornerHint';
  hint.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);background:rgba(8,14,28,.82);color:#fff;font:800 12px/1.4 "Segoe UI",system-ui,sans-serif;letter-spacing:1.4px;padding:8px 14px;border-radius:20px;pointer-events:none;z-index:6;opacity:0;transition:opacity .25s;text-align:center;white-space:nowrap';
  document.body.appendChild(hint);
  const showHint = h => { hint.innerHTML = h || ''; hint.style.opacity = h ? 1 : 0; };

  /* ================= shot types ================= */
  function shotType(p, F) {
    if (window.__shotType) return window.__shotType;
    if (F && F.h && F.h.press) return 'finesse';
    if (KEY('KeyQ')) return 'low';
    const gx = PL * p.team.side, d = Math.hypot(gx - ball.pos.x, ball.pos.z), az = Math.abs(ball.pos.z);
    if (d < 13 && az > 3.5) return 'low';
    if (d > 13 && d < 27 && az > 2.5) return 'finesse';
    return 'power';
  }
  function typedShot(p, power, F, type) {
    const t = p.team, s = t.side, gx = PL * s, sz = Math.sign(ball.pos.z || rnd(-1, 1));
    const dist = Math.hypot(gx - ball.pos.x, ball.pos.z), [, pr] = nearestOpp(p);
    const aim = F && F.m > .2 && Math.abs(F.z) > .6 ? Math.sign(F.z) : null;
    let tz, h, speed, err, curl = 0;
    if (type === 'finesse') {
      tz = (aim || -sz) * GW * .78;
      speed = (15 + power * 10) * t.K.shot;
      h = 1.05 + power * .7;
      err = (.3 + (pr < 1.5 ? .6 : 0) + Math.max(0, dist - 24) * .09) * (1.4 - Math.max(t.K.acc, .8) * .6);
      curl = Math.sign(tz);
    } else {
      const gkz = opp(t).players.find(q => q.role === 'GK'), away = gkz && Math.abs(gkz.pos.z) > .25 ? -Math.sign(gkz.pos.z) : sz;
      tz = (aim || away) * GW * .74;                                   // low and hard into the side the keeper has left
      speed = (18 + power * 13) * t.K.shot;
      h = .28 + power * .25;
      err = (.25 + (pr < 1.5 ? .6 : 0) + Math.max(0, dist - 14) * .08) * (1.4 - Math.max(t.K.acc, .8) * .6);
    }
    tz += rnd(-1, 1) * err;
    if (curl) tz += curl * 1.25;                                     // aim outside the post and bend it back in
    const dx = gx - ball.pos.x, dz = tz - ball.pos.z, d = Math.hypot(dx, dz) || 1, T = d / speed;
    const vy = (h - ball.pos.y + .5 * GRAV * T * T) / T;
    kickBall(p, new V3(dx / d * speed, vy, dz / d * speed));
    if (curl) ball.spin = -curl * clamp(speed * .075, .7, 1.7) * Math.sign(dx);
    ball.shot = { team:t, by:p };
    t.shots++; if (Math.abs(tz - curl * 1.25) < GW && h < GH) t.onT++;
    S.excite = Math.max(S.excite, .8);
    flashLabel(type === 'finesse' ? 'FINESSE' : 'LOW DRIVEN');
  }
  const lab = document.createElement('div');
  lab.style.cssText = 'position:fixed;left:50%;top:30%;transform:translateX(-50%);font:900 italic 15px "Segoe UI",system-ui,sans-serif;letter-spacing:3px;color:#ffd23f;text-shadow:0 2px 8px rgba(0,0,0,.6);opacity:0;transition:opacity .2s;pointer-events:none;z-index:6';
  document.body.appendChild(lab);
  function flashLabel(t) { lab.textContent = t; lab.style.opacity = 1; clearTimeout(lab.t); lab.t = setTimeout(() => lab.style.opacity = 0, 700); }

  /* ================= passing ================= */
  function smartThrough(p, mate) {
    const s = p.team.side, opps = opp(p.team).players;
    let best = null, bs = -1e9;
    for (const lead of [4, 6, 8, 10, 13]) for (const lat of [-5, -2.5, 0, 2.5, 5]) {
      const x = mate.pos.x + s * lead + mate.vel.x * .3, z = mate.pos.z + lat + mate.vel.z * .3;
      if (Math.abs(x) > PL - 2.5 || Math.abs(z) > PW - 1.5) continue;
      const mT = Math.hypot(x - mate.pos.x, z - mate.pos.z) / (8.5 * mate.spd), bT = Math.hypot(x - ball.pos.x, z - ball.pos.z) / 15 + .2;
      let oT = 9; for (const o of opps) oT = Math.min(oT, Math.hypot(x - o.pos.x, z - o.pos.z) / (o.role === 'GK' ? 7 : 8.2));
      const sc = (oT - Math.max(mT, bT)) * 2 + lead * .08 - Math.abs(lat) * .05 - Math.abs(z) * .02;
      if (sc > bs) { bs = sc; best = new V3(x, 0, z); }
    }
    return bs > -1.2 ? best : null;
  }
  const _passTo = passTo;
  passTo = function (p, mate, kind) {
    const hum = isHuman(p.team);
    if (kind === 'through' && mate) {
      const tgt = smartThrough(p, mate);
      if (tgt) {
        if (hum) visionErr(p, tgt);
        passToPoint(p, tgt, 'through'); ball.intended = mate; p.team.passes++;
        if (hum && mate.role !== 'GK') { setCtrl(p.team, mate); giveGo(p, mate); }
        return;
      }
    }
    if (hum && kind !== 'lob') {
      const tgt = mate.pos.clone().addScaledVector(mate.vel, .55); clampField(tgt);
      const e = visionErr(p, tgt);
      if (e) { passToPoint(p, tgt, kind === 'through' ? 'through' : 'ground'); ball.intended = mate; p.team.passes++; if (mate.role !== 'GK') setCtrl(p.team, mate); giveGo(p, mate); return; }
    }
    _passTo(p, mate, kind);
    if (hum && mate && mate.role !== 'GK') giveGo(p, mate);
  };
  // passes played behind your body go astray a little
  function visionErr(p, tgt) {
    const f = faceVec(p), dx = tgt.x - p.pos.x, dz = tgt.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
    const ang = Math.acos(clamp((f.x * dx + f.z * dz) / d, -1, 1)) * 180 / Math.PI;
    if (ang < 100) return 0;
    const e = (ang - 100) / 80 * (1 + d * .06);
    tgt.x += rnd(-1, 1) * e; tgt.z += rnd(-1, 1) * e; clampField(tgt);
    return e;
  }
  function dink(p, tgt, mate) {
    const dx = tgt.x - ball.pos.x, dz = tgt.z - ball.pos.z, d = Math.hypot(dx, dz) || 1;
    const T = clamp(.55 + d * .035, .7, 1.25), vh = d / T;
    kickBall(p, new V3(dx / d * vh, GRAV * T / 2 + .3, dz / d * vh));
    if (mate) { ball.intended = mate; p.team.passes++; if (mate.role !== 'GK') { setCtrl(p.team, mate); giveGo(p, mate); } }
    flashLabel('DINK');
  }

  /* ================= one-twos ================= */
  function giveGo(p, mate) { p.goRun = 1.8; p.team.give = { from:p, to:mate, t:S.clock, recv:0 }; }
  const _gain = gainBall;
  gainBall = function (p) {
    _gain(p);
    const g = p.team && p.team.give;
    if (g && g.to === p && ball.owner === p) g.recv = S.clock;
    if (ball.owner === p) p.goRun = 0;
  };

  /* ================= human actions ================= */
  const corner = () => S.setp && S.setp.kind === 'corner';
  const _ha = humanAction;
  humanAction = function (p, type, power, F) {
    F = F || EMPTY_F;
    if (corner() && S.frozen === p && (type === 'lob' || type === 'through' || type === 'shoot')) { cornerCross(p, F); return; }
    if (type === 'shoot') { const st = shotType(p, F); if (st === 'power') return _ha(p, type, power, F); typedShot(p, power, F, st); return; }
    if (type === 'lob' && F.h && F.h.sprint && !corner()) {
      const dir = F.m > .2 ? new V3(F.x, 0, F.z) : faceVec(p);
      const mate = pickMateInDir(p, dir);
      if (mate && d2(mate.pos, p.pos) < 26) { const tgt = mate.pos.clone().addScaledVector(mate.vel, .8); clampField(tgt); dink(p, tgt, mate); }
      else dink(p, clampField(p.pos.clone().addScaledVector(dir, 12)), null);
      return;
    }
    // one-two: pass straight back to the player who just gave it to you, into his run
    const g = p.team.give;
    if (type === 'pass' && g && g.to === p && g.recv && S.clock - g.recv < 1.1 && g.from !== p) {
      const back = g.from, dir = F.m > .2 ? new V3(F.x, 0, F.z) : null;
      const toB = new V3(back.pos.x - p.pos.x, 0, back.pos.z - p.pos.z).normalize();
      if (!dir || dir.dot(toB) > .3) {
        const tgt = back.pos.clone().addScaledVector(back.vel, .75); clampField(tgt);
        passToPoint(p, tgt, 'through'); ball.intended = back; p.team.passes++; setCtrl(p.team, back);
        p.team.give = null; flashLabel('ONE-TWO'); return;
      }
    }
    _ha(p, type, power, F);
  };

  /* ================= movement: one-two runs, shielding ================= */
  const _hc = humanControl;
  humanControl = function (p, dt, F) {
    const w = _hc(p, dt, F);
    const own = ball.owner === p;
    p.shield = own && F && F.h && F.h.press && !S.frozen; if (p.shield) p.shieldT = S.clock;
    if (p.shield) {
      const [o, od] = nearestOpp(p);
      if (o && od < 3.5 && F.m < .25) { const a = Math.atan2(p.pos.x - o.pos.x, p.pos.z - o.pos.z); let da = a - p.face; da = Math.atan2(Math.sin(da), Math.cos(da)); p.face += da * Math.min(1, dt * 8); }
      if (w) { w[0] *= .5; w[1] *= .5; }
    }
    return w;
  };
  const _ai = aiPlayer;
  aiPlayer = function (p, dt) {
    const c = S.cP2 || cornerSetup();
    if (c) { const r = cornerMove(p, c); if (r) return r; }
    if (p.goRun > 0 && (!ball.owner || ball.owner.team === p.team)) {
      p.goRun -= dt;
      const s = p.team.side, tx = clamp(p.pos.x + s * 9, -PL + 3, PL - 3), tz = p.pos.z * .85;
      return steer(p, tx, tz, 9 * p.spd, .3);
    }
    p.goRun = 0;
    return _ai(p, dt);
  };

  /* ================= fairer duels ================= */
  const _tt = tryTackle;
  tryTackle = function (p, chance) {
    const o = ball.owner;
    if (o && o.team !== p.team) {
      const fx_ = Math.sin(o.face), fz_ = Math.cos(o.face), bx = p.pos.x - o.pos.x, bz = p.pos.z - o.pos.z, bl = Math.hypot(bx, bz) || 1;
      const behind = (fx_ * bx + fz_ * bz) / bl < -.3;
      if (behind) chance *= .4;                                   // no more winning it by running into his back
      if (o.shield && S.clock - (o.shieldT || -9) < .15) chance *= .45;
    }
    return _tt(p, chance);
  };

  /* ================= headers ================= */
  function header(p) {
    const t = p.team, s = t.side, gx = PL * s, og = -PL * s;
    const inOppBox = Math.abs(ball.pos.x - gx) < 18 && Math.abs(ball.pos.z) < 21;
    const inOwnBox = Math.abs(ball.pos.x - og) < 20 && Math.abs(ball.pos.z) < 24;
    const hum = isHuman(t) && p === t.ctrl, F = hum ? frameFor(t) : null;
    if (inOppBox) {
      const gk = opp(t).players[0], away = Math.abs(gk.pos.z) > .3 ? -Math.sign(gk.pos.z) : (Math.random() < .5 ? -1 : 1);
      const aimed = hum && F && F.m > .2 && Math.abs(F.z) > .5 ? Math.sign(F.z) : away;
      const acc = hum ? .8 : t.K.acc;
      const tz = aimed * GW * (.45 + Math.random() * .4) + rnd(-1, 1) * (1.3 - acc) * 2.2;
      const th = hum ? .25 + Math.random() * 1.1 : .3 + Math.random() * 1.6, speed = (hum ? (F && F.h.shoot ? 18 : 15.5) : 14) * (.9 + Math.random() * .2);
      const dx = gx - ball.pos.x, dz = tz - ball.pos.z, d = Math.hypot(dx, dz) || 1, T = d / speed;
      kickBall(p, new V3(dx / d * speed, (th - ball.pos.y + .5 * GRAV * T * T) / T, dz / d * speed));
      ball.shot = { team:t, by:p }; t.shots++; if (Math.abs(tz) < GW) t.onT++;
      S.excite = Math.max(S.excite, .85); flashLabel('HEADER');
    } else if (inOwnBox) {
      kickBall(p, new V3(s * rnd(10, 14), rnd(5.5, 7.5), rnd(-7, 7)));          // clear it upfield
    } else {
      // knock it on to a teammate in front, or flick it on
      let m = null, bd = 1e9; for (const q of t.players) { if (q === p || q.role === 'GK') continue; const dx = (q.pos.x - p.pos.x) * s; const d = d2(q.pos, p.pos); if (dx > -2 && d > 4 && d < 22 && d < bd) { bd = d; m = q; } }
      const tgt = m ? m.pos.clone() : p.pos.clone().add(new V3(s * 10, 0, 0));
      const dx = tgt.x - ball.pos.x, dz = tgt.z - ball.pos.z, d = Math.hypot(dx, dz) || 1, sp = clamp(d * .9, 7, 13), T = d / sp;
      kickBall(p, new V3(dx / d * sp, GRAV * T * .35, dz / d * sp));
      if (m) ball.intended = m;
    }
    p.headT = .45; p.kickCd = .3;
  }
  let lastKickT = -1;
  function tryHeaders() {
    const b = ball, P = b.pos;
    if (b.owner || S.state !== 'play' || P.y < 1.0 || P.y > 2.5) return;
    if (b.kickT !== lastKickT) { lastKickT = b.kickT; for (const p of S.players) p._hd = undefined; }
    let best = null, bd = .85;
    for (const p of S.players) {
      if (p.role === 'GK' || p.stun > 0 || p.kickCd > 0 || p.slide > 0) continue;
      if (p === b.lastTouch && S.clock - (b.kickT || 0) < .35) continue;
      const d = Math.hypot(P.x - p.pos.x, P.z - p.pos.z); if (d > bd) continue;
      // decide once per flight whether he goes for it (the intended receiver can still bring it down instead)
      if (p._hd === undefined) {
        const t = p.team, inOpp = Math.abs(P.x - PL * t.side) < 18 && Math.abs(P.z) < 21, hum = isHuman(t) && p === t.ctrl;
        p._hd = hum ? (inOpp || P.y > 1.4) : Math.random() < (inOpp ? .8 : p === b.intended ? .15 : .55);
      }
      if (!p._hd) continue;
      // aerial duel: the closest to the ball wins, with a bit of luck
      const sc = d - Math.random() * .25;
      if (sc < bd) { bd = sc; best = p; }
    }
    if (best) header(best);
  }
  const _cp = checkPickup;
  checkPickup = function () { tryHeaders(); _cp(); };
  // jump for headers
  if (typeof animateSkinned === 'function') {
    const _as = animateSkinned;
    animateSkinned = function (p, dt) {
      _as(p, dt);
      if (!(p.headT > 0)) return;
      p.headT -= dt;
      const k = Math.sin(clamp(1 - p.headT / .45, 0, 1) * Math.PI), B = p.g.B, m = p.g.model;
      m.position.y = Math.max(m.position.y, k * .42);
      bt(B, 'Head', 0, -.5 * k + .9 * k * k); bt(B, 'Spine', 0, -.3 * k);
      bt(B, 'LeftArm', 2, .9 * k); bt(B, 'RightArm', 2, -.9 * k);
      bt(B, 'LeftLeg', 0, .9 * k); bt(B, 'RightLeg', 0, .6 * k);
    };
  }

  /* ================= two-phase corners ================= */
  const RING = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.45, 40), new THREE.MeshBasicMaterial({ color:0xffd23f, transparent:true, opacity:.85, depthWrite:false, side:THREE.DoubleSide }));
  RING.rotation.x = -Math.PI / 2; RING.position.y = .04; RING.visible = false; RING.renderOrder = 3; scene.add(RING);
  const ZN = ['NEAR POST', 'PENALTY SPOT', 'FAR POST', 'EDGE OF BOX'];
  function zones(t) {
    const s = t.side, sz = Math.sign(ball.pos.z) || 1;
    return [new V3(s * (PL - 5.5), 0, sz * 2.6), new V3(s * (PL - 11), 0, 0), new V3(s * (PL - 6.5), 0, -sz * 3.4), new V3(s * (PL - 18), 0, -sz * 2)];
  }
  function pickZone(p, F) {
    const zs = zones(p.team);
    if (!F || F.m < .3) return 1;
    let best = 1, bd = -2;
    for (let i = 0; i < zs.length; i++) { const dx = zs[i].x - ball.pos.x, dz = zs[i].z - ball.pos.z, d = Math.hypot(dx, dz) || 1; const dot = (dx * F.x + dz * F.z) / d; if (dot > bd) { bd = dot; best = i; } }
    return best;
  }
  function cornerSetup() {
    if (!corner() || !S.frozen) return null;
    return { setup:true, team:S.setp.team || S.frozen.team, taker:S.frozen, zone:S.cZone != null ? zones(S.frozen.team)[S.cZone] : zones(S.frozen.team)[1] };
  }
  // box positions for the attacking team and man-marking for the defenders, before and during the cross
  function cornerMove(p, c) {
    if (p.role === 'GK' || p === c.taker) return null;
    const t = c.team, s = t.side;
    if (p.team === t) {
      const att = t.players.filter(q => q.role !== 'GK' && q !== c.taker).sort((a, b) => (b.pos.x - a.pos.x) * s).slice(0, 5);
      const i = att.indexOf(p); if (i < 0) return null;
      const spots = c.setup ? [[-14, 0], [-10, -4], [-9, 4], [-7, -1], [-19, 1]] : [[0, 0], [2, -2], [-2, 2], [1.5, 2.5], [-6, -2]];
      const base = c.setup ? new V3(s * PL, 0, 0) : c.zone;
      const x = c.setup ? base.x + s * spots[i][0] : base.x + s * spots[i][0], z = base.z + spots[i][1];
      return steer(p, x, z, (c.setup ? 6 : 8.2) * p.spd, .4);
    }
    // defending team: mark the nearest attacker, goal-side
    let m = null, bd = 1e9;
    for (const q of t.players) { if (q.role === 'GK' || q === c.taker) continue; const d = d2(q.pos, p.pos); if (Math.abs(q.pos.x - s * PL) < 20 && d < bd) { bd = d; m = q; } }
    if (!m) return null;
    if (m.avoidT > 0) return steer(p, p.pos.x, p.pos.z, 1);       // shrugged off: he loses a step
    return steer(p, m.pos.x + s * .7, m.pos.z * .92, 7.6 * p.spd, .2);
  }
  function cornerCross(p, F) {
    const t = p.team, zi = pickZone(p, F), z = zones(t)[zi].clone();
    z.x += rnd(-.8, .8); z.z += rnd(-.8, .8);
    const dx = z.x - ball.pos.x, dz = z.z - ball.pos.z, d = Math.hypot(dx, dz) || 1;
    const T = clamp(.7 + d * .045, 1.0, 1.75), vh = d / T, vy = (1.75 + .5 * GRAV * T * T - ball.pos.y) / T;   // arrives at head height
    kickBall(p, new V3(dx / d * vh, vy, dz / d * vh));
    let best = null, bd = 1e9; for (const q of t.players) { if (q === p || q.role === 'GK') continue; const dd = d2(q.pos, z); if (dd < bd) { bd = dd; best = q; } }
    if (best) setCtrl(t, best);
    S.cP2 = { team:t, taker:p, zone:z, t:0, T, avoid:false };
    RING.position.set(z.x, .04, z.z); RING.visible = true;
  }
  function cornerTick(dt) {
    const c = S.cP2;
    // phase 1: choosing the zone
    if (!c) {
      const cs = cornerSetup();
      if (cs && isHuman(cs.taker.team) && cs.taker.team.ctrl === cs.taker) {
        const F = frameFor(cs.taker.team); S.cZone = pickZone(cs.taker, F);
        const z = zones(cs.taker.team)[S.cZone]; RING.position.set(z.x, .04, z.z); RING.visible = true;
        RING.material.opacity = .55 + .3 * Math.sin(S.clock * 6);
        showHint(`CORNER · aim with the stick: <b style="color:#ffd23f">${ZN[S.cZone]}</b> · LOB / SHOOT to cross · PASS for a short one`);
      } else if (!S.cP2) { RING.visible = false; S.cZone = null; if (hint.dataset.k !== 'x') showHint(''); }
      return;
    }
    c.t += dt;
    const t = c.team, p = t.ctrl, F = isHuman(t) ? frameFor(t) : null;
    if (F && p && p.role !== 'GK') {
      if (F.p.switch) {                                             // next attacker in the box
        const att = t.players.filter(q => q.role !== 'GK' && q !== c.taker && Math.abs(q.pos.x - t.side * PL) < 20).sort((a, b) => d2(a.pos, c.zone) - d2(b.pos, c.zone));
        const i = att.indexOf(p); if (att.length) setCtrl(t, att[(i + 1) % att.length]);
      }
      if (F.p.press && !c.avoid) {                                  // shrug off the marker
        c.avoid = true; p.avoidT = .8;
        const [o, od] = nearestOpp(p); if (o && od < 2.6) { o.stun = .5; o.vel.multiplyScalar(.2); }
        p.vel.addScaledVector(new V3(c.zone.x - p.pos.x, 0, c.zone.z - p.pos.z).normalize(), 3);
        flashLabel('SHRUGGED OFF');
      }
    }
    for (const q of t.players) if (q.avoidT > 0) q.avoidT -= dt;
    if (F) showHint(`<b style="color:#ffd23f">${ZN[S.cZone != null ? S.cZone : 1]}</b> · move into the ball · Q switch · E shrug off marker${c.avoid ? ' ✓' : ''}`);
    if (ball.owner || c.t > c.T + .7 || (ball.pos.y < .6 && c.t > c.T * .6) || S.state !== 'play') { S.cP2 = null; RING.visible = false; showHint(''); }
  }

  /* ================= time, camera, fewer deflections ================= */
  const _step = step;
  step = function (dt) {
    const slow = S.cP2 && S.cP2.t < S.cP2.T * .85 && S.state === 'play';
    _step(slow ? dt * .5 : dt);
    if (S.state === 'play' || S.state === 'setpiece') cornerTick(slow ? dt * .5 : dt); else if (S.cP2 || RING.visible) { S.cP2 = null; RING.visible = false; showHint(''); }
  };
  const _cam = updateCamera, cv = new THREE.Vector3(), lv = new THREE.Vector3();
  updateCamera = function (dt) {
    const c = S.cP2;
    if (!c || !isHuman(c.team) || S.state !== 'play') { _cam(dt); return; }
    const s = c.team.side, sz = Math.sign(c.taker.pos.z) || 1;
    cv.set(s * (PL - 25), 9, c.zone.z * .4 - sz * 6); lv.set(s * (PL - 6), 1, c.zone.z * .5);
    const k = 1 - Math.exp(-dt * 3);
    camera.position.lerp(cv, k); camLook.lerp(lv, 1 - Math.exp(-dt * 5)); camera.lookAt(camLook);
  };
  // reset per match
  const _sm = startMatch;
  startMatch = function (cfg) { S.cP2 = null; S.cZone = null; RING.visible = false; showHint(''); return _sm(cfg); };
})();
