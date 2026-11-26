/* Kickoff Rivals: research-based mechanics.
   Sources:
   - Keeper timing: a keeper needs ~0.6 s to reach a side and ~1 s for a top corner (van der Kamp et al., German J. Exercise & Sport Research 2018).
   - Keeper positioning: stand on the bisector of the shooting angle, coming off the line to narrow it
     (Barańska & Eckes 2020; González-Jarrín et al., Applied Sciences 2025).
   - A defender between shooter and keeper hides the shot (StatsBomb pressure / sightline analyses).
   - Shooting pressure: defenders within ~5 yards, from in front or the side, hurt shots; pressure from behind barely does (StatsBomb, "Closing Down").
   - Fatigue: high-intensity running drops 35-45% by the last 15 min and ~12% after an intense 5 min spell (Mohr, Krustrup & Bangsbo 2003);
     sprint performance drops ~3%; shots after exercise are ~25% less accurate and ~4% slower (Russell et al. 2011).
   - Peak match sprint speeds ~29-32 km/h, reached from a rolling start (Djaoui et al. 2017; peak-speed studies 2024).
   - Counter-pressing: win the ball back within ~5 s of losing it, then drop into a compact block (FIFA Training Centre; Bauer & Anzer 2021).
   - Passing: choose passes by "time to intercept" like Spearman's pitch-control model. */
(function () {
  if (typeof aiGK !== 'function' || typeof shoot !== 'function') return;
  const R = window.REAL = { on: true, react: .04, screen: .1, block: 1, cpress: 1, smartPass: 1 };
  const prog = () => clamp((typeof minute === 'function' ? minute() : 0) / 90, 0, 1);

  /* ================= stamina & fatigue ================= */
  // p.sta: short-term energy (sprints drain it, jogging refills it). p.fit: whole-match freshness.
  const staOf = p => (p.sta == null ? 1 : p.sta);
  R.fit = p => clamp(1 - .14 * Math.pow(prog(), 1.4) * (1.25 - .5 * (p.team.K.acc || .6)), .82, 1);
  R.form = p => .5 * staOf(p) + .5 * (R.fit(p) - .82) / .18;            // 0 = exhausted, 1 = fresh
  const _up = updatePlayer;
  updatePlayer = function (p, dt) {
    _up(p, dt);
    if (S.state === 'half' || S.state === 'kickoff' && S.clock < .2) { p.sta = 1; return; }
    if (S.state !== 'play' && S.state !== 'setpiece') { p.sta = Math.min(1, staOf(p) + dt * .08); return; }
    const v = Math.hypot(p.vel.x, p.vel.z), eff = 1.15 - .35 * (p.team.K.acc || .6);   // fitter (better) players tire slower
    let s = staOf(p);
    if (v > 5.8) s -= dt * .085 * (v - 5.8) / 2.6 * eff * (p.role === 'GK' ? .4 : 1);
    else if (v < 4.2) s += dt * .06;
    else s += dt * .015;
    p.sta = clamp(s, 0, 1);
  };
  // speed: tired players lose top-end speed (sprints), not jogging speed; whole-match fatigue costs ~3% sprint speed
  const _mp = window.movePhys;
  window.movePhys = function (p, want, human, dt) {
    if (R.on && want && p.role !== 'GK') {
      let m = Math.hypot(want[0], want[1]);
      const t = p.team, urgent = ball.owner === p || ball.intended === p || t.chaser === p || t.cover === p || p.goRun > 0;
      if (!human && !urgent && staOf(p) < .3 && m > 5.4) { want[0] *= 5.4 / m; want[1] *= 5.4 / m; m = 5.4; }   // pacing: recover on non-urgent runs
      if (m > 5.5) { const cap = (5.5 + (m - 5.5) * (.62 + .38 * staOf(p))) * (.97 + .03 * (R.fit(p) - .82) / .18); want[0] *= cap / m; want[1] *= cap / m; }
    }
    return _mp(p, want, human, dt);
  };

  /* ================= shooting ================= */
  // pressure from defenders within ~4.6 m; from in front hurts most, from behind barely
  R.pressure = function (p) {
    const s = p.team.side, gx = PL * s; let pr = 0;
    const fx = gx - p.pos.x, fz = -p.pos.z, fl = Math.hypot(fx, fz) || 1;
    for (const q of opp(p.team).players) {
      if (q.role === 'GK') continue;
      const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 4.6) continue;
      const cos = (dx * fx + dz * fz) / (d * fl || 1);                       // 1 = between shooter and goal
      pr += (1 - d / 4.6) * (cos > .5 ? 1 : cos > -.3 ? .7 : .25);
    }
    return Math.min(pr, 1.3);
  };
  shoot = function (p, power, aimZ) {
    const t = p.team, s = t.side, gx = PL * s;
    const hum = isHuman(t), acc = hum ? Math.max(t.K.acc, .8) : t.K.acc;
    const gkp = opp(t).players.find(q => q.role === 'GK') || opp(t).players[0], gkZ = gkp.pos.z;
    let tz = aimZ == null ? -Math.sign(ball.pos.z || rnd(-1, 1)) * GW * .62 : aimZ * GW * .86;
    if (hum) tz = aimZ != null && Math.abs(aimZ) > .6 ? Math.sign(aimZ) * GW * .74 : (Math.abs(gkZ) > .25 ? -Math.sign(gkZ) : -Math.sign(ball.pos.z || rnd(-1, 1))) * GW * .74;
    const dist = Math.hypot(gx - ball.pos.x, ball.pos.z), form = R.form(p);
    const tired = 1 + .25 * (1 - form);                                       // up to 25% less accurate when exhausted
    const err = (.25 + power * power * 1.3 + R.pressure(p) * .8 + dist * .03) * (1.5 - acc * .75) * tired;
    tz += rnd(-1, 1) * err * (hum ? .5 : 1);
    const h = hum ? .95 + Math.pow(power, 1.2) * 1.2 + rnd(-.1, .1) : .25 + Math.pow(power, 1.6) * 2.95 + rnd(-.25, .25) * (1.4 - acc) * tired;
    const speed = (15 + power * 18) * t.K.shot * (hum ? 1.05 : 1) * (.96 + .04 * form);   // ~4% slower when tired
    const curl = Math.abs(tz) > 1.4 && dist > 11 ? Math.sign(tz) : 0; tz += curl * .85;
    const dx = gx - ball.pos.x, dz = tz - ball.pos.z, d = Math.hypot(dx, dz) || 1, T = d / speed;
    const vy = (h - ball.pos.y + .5 * GRAV * T * T) / T;
    kickBall(p, new V3(dx / d * speed, vy, dz / d * speed));
    ball.spin = -curl * clamp(speed * .055, .4, 1.5) * Math.sign(dx);
    ball.shot = { team: t, by: p };
    t.shots++; if (Math.abs(tz) < GW && h < GH) t.onT++;
    S.excite = Math.max(S.excite, .8);
  };

  /* ================= goalkeeping ================= */
  // spot on the bisector of the shooting angle, `depth` metres off the line
  R.bisector = function (t, bx, bz, depth) {
    const s = t.side, gx = -PL * s;
    const u1x = gx - bx, u1z = -GW - bz, l1 = Math.hypot(u1x, u1z) || 1, u2x = gx - bx, u2z = GW - bz, l2 = Math.hypot(u2x, u2z) || 1;
    let dx = u1x / l1 + u2x / l2, dz = u1z / l1 + u2z / l2; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    if (Math.abs(dx) < .15) dx = -s * .15;
    const k = (gx - bx) / dx, qz = bz + dz * k;                               // where the bisector meets the goal line
    return [gx - dx * depth, clamp(qz - dz * depth, -GW + .45, GW - .45)];
  };
  const screened = (k, shooter) => {
    for (const q of S.players) {
      if (q === k || q === shooter) continue;
      if (distSeg(q.pos, ball.pos, k.pos) < .7 && d2(q.pos, k.pos) > 2 && d2(q.pos, ball.pos) > 1.2) return true;
    }
    return false;
  };
  const _gk = aiGK;
  aiGK = function (p, dt) {
    if (!R.on || ball.owner === p || S.frozen) return _gk(p, dt);
    const t = p.team, s = t.side, gx = -PL * s;
    // reaction time: a keeper can't move to a shot the instant it's struck
    if (ball.shot && ball.shot.team !== t && ball.shot !== p.seenShot) {
      p.seenShot = ball.shot;
      p.react = clamp(R.react - (t.K.gk - 1) * .08, 0, .3) + (screened(p, ball.shot.by) ? R.screen : 0);
      if (isHuman(opp(t))) p.react *= 1.1;
    }
    if (p.react > 0) { p.react -= dt; const st = p.setPos || [p.pos.x, p.pos.z]; return steer(p, st[0], st[1], 3, .3); }
    const r = _gk(p, dt);
    const inBox = Math.abs(ball.pos.x - gx) < 16.5 && Math.abs(ball.pos.z) < 20, db = d2(p.pos, ball.pos);
    const incoming = !ball.owner && ball.vel.x * s < -4, loose = !ball.owner && inBox && (ball.vel.length() < 9 || db < 4);
    if (incoming || loose || p.dive > 0) return r;
    const o = ball.owner, dG = Math.hypot(gx - ball.pos.x, ball.pos.z);
    let depth;
    if (o && o.team !== t && inBox && db < 10) depth = clamp(dG * .42, 1.5, 5.5);   // one-on-one: come out along the bisector
    else depth = clamp(.9 + (32 - dG) * .055, .9, 2.4);                            // narrow the angle as the ball gets closer
    const [tx, tz] = R.bisector(t, ball.pos.x, ball.pos.z, depth);
    p.setPos = [tx, tz];
    return steer(p, tx, tz, o && o.team !== t && inBox && db < 10 ? 6.5 : 6, .4);
  };

  /* ================= team AI ================= */
  // who has the ball, and when each team last lost it (for the 5-second counter-press)
  let lastPoss = null;
  const _step = step;
  step = function (dt) {
    const po = ball.owner ? ball.owner.team : null;
    if (po && lastPoss && po !== lastPoss) lastPoss.lostAt = S.clock;
    if (po) lastPoss = po;
    if (S.state === 'kickoff' || S.state === 'goal') { lastPoss = null; S.teams && S.teams.forEach(t => t.lostAt = -99); }
    return _step(dt);
  };
  const counterPress = t => R.on && R.cpress && t.lostAt != null && S.clock - t.lostAt < 5;

  // shape: compact block out of possession, wider in possession
  const _ft = formTarget;
  formTarget = function (p) {
    const r = _ft(p);
    if (!R.on || !R.block || S.frozen || p.role === 'GK') return r;
    const t = p.team, s = t.side, b = ball.pos;
    const poss = ball.owner ? ball.owner.team === t : null;
    if (poss === false && !counterPress(t)) {
      r[1] = clamp(b.z * .38 + (r[1] - b.z * .22) * .7, -PW + 2, PW - 2);        // shift across to the ball side, narrower
      const anchor = b.x - s * 13;                                                // block sits goal-side of the ball
      r[0] = r[0] + (anchor - r[0]) * .14;
    } else if (poss === true) r[1] = clamp(r[1] * 1.08, -PW + 1.5, PW - 1.5);
    return r;
  };
  const _ai = aiPlayer;
  aiPlayer = function (p, dt) {
    const t = p.team, o = ball.owner;
    if (R.on && o && o.team !== t && p.role !== 'GK' && t.chaser !== p && !S.frozen && counterPress(t) && (b => (b.x * t.side) > -PL * .45)(ball.pos)) {
      // second presser: the closest player (after the chaser) blocks the easy pass for 5 seconds
      let second = null, sd = 1e9;
      for (const q of t.players) { if (q.role === 'GK' || q === t.chaser) continue; const d = d2(q.pos, o.pos); if (d < sd) { sd = d; second = q; } }
      if (second === p && sd < 16 && !(isHuman(t) && t.ctrl === p)) {
        const s = t.side, side = o.pos.z > 0 ? -1 : 1;
        return steer(p, o.pos.x - s * 1.5, o.pos.z + side * 2.2, 8.2 * p.spd, .3);
      }
    }
    return _ai(p, dt);
  };

  // passing by time to intercept (Spearman-style): will any defender get to the ball's path first?
  const REACT = .3;
  R.passSafety = function (p, tgt, lob) {
    const d = Math.hypot(tgt.x - ball.pos.x, tgt.z - ball.pos.z) || 1;
    const v0 = lob ? clamp(7 + d * .5, 10, 25) : groundSpeedFor(d, 4.5), vAvg = lob ? v0 : (v0 + 4.5) / 2;
    let safe = 9;
    for (const q of opp(p.team).players) {
      const ax = tgt.x - ball.pos.x, az = tgt.z - ball.pos.z;
      let f = clamp(((q.pos.x - ball.pos.x) * ax + (q.pos.z - ball.pos.z) * az) / (d * d), 0, 1);
      if (lob) f = 1;                                                          // a lob can only be won where it lands
      const px = ball.pos.x + ax * f, pz = ball.pos.z + az * f;
      const tq = REACT + Math.max(0, Math.hypot(px - q.pos.x, pz - q.pos.z) - .9) / (7.5 * (q.spd || 1));
      safe = Math.min(safe, tq - f * d / vAvg);
    }
    return safe;
  };
  bestPass = function (p, mode) {
    const t = p.team, s = t.side; let best = null, bs = -1e9;
    const noise = 1.2 * clamp((t.K.think || .3) / .3, .5, 1.6);
    for (const m of t.players) {
      if (m === p || m.role === 'GK') continue;
      const d = d2(p.pos, m.pos); if (d < 5 || d > (mode === 'long' ? 50 : 36)) continue;
      const lob = mode === 'long';
      const tgt = m.pos.clone().addScaledVector(m.vel, lob ? .9 : .55);
      const safe = R.passSafety(p, tgt, lob);
      if (safe < -.15 && mode !== 'long') continue;
      let free = 99; for (const q of opp(t).players) free = Math.min(free, d2(q.pos, m.pos));
      const fwd = (m.pos.x - p.pos.x) * s;
      const sc = fwd * (mode === 'safe' ? .15 : .6) + clamp(safe, -1, 1.5) * 4 + Math.min(free, 8) * .45 - d * .06 + rnd(0, noise);
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  };

  /* ================= HUD: stamina bar for your player ================= */
  const who = document.getElementById('who');
  if (who && !document.getElementById('staBar')) {
    who.insertAdjacentHTML('beforeend', '<div id="staWrap" style="height:4px;margin-top:5px;border-radius:2px;background:rgba(255,255,255,.15);overflow:hidden"><i id="staBar" style="display:block;height:100%;width:100%;background:#3ddc84;transition:width .2s"></i></div>');
    setInterval(() => {
      const bar = document.getElementById('staBar'); if (!bar || !S.teams) return;
      const t = S.teams.find(x => isHuman(x)), p = t && t.ctrl; if (!p) return;
      const f = clamp(R.form(p), 0, 1); bar.style.width = Math.round(f * 100) + '%';
      bar.style.background = f > .6 ? '#3ddc84' : f > .3 ? '#ffd23f' : '#ff5a5f';
    }, 200);
  }
})();
