/* Kickoff Rivals: extras.
   - PLAYER RATINGS and PLAYER OF THE MATCH on the full-time screen (goals, assists, shots, passes, tackles, saves).
   - WEATHER: Clear / Rain / Snow / Random. Rain makes the pitch wet and the ball skid on; snow slows the ball
     down and brings out the orange ball.
   - HOW TO PLAY: every control, including the new moves, in Settings, plus a one-time "What's new" card. */
(function () {
  if (typeof showFullTime !== 'function') return;

  /* ================= ratings ================= */
  const st = p => p.st || (p.st = { g:0, a:0, sh:0, pa:0, tk:0, sv:0 });
  let lastPasser = null;
  const _pt = passTo;
  passTo = function (p, mate, kind) { _pt(p, mate, kind); if (p) { st(p).pa++; lastPasser = p; } };
  const _ptp = passToPoint;
  passToPoint = function (p, tgt, kind) { _ptp(p, tgt, kind); if (p) lastPasser = p; };
  const _tt = tryTackle;
  tryTackle = function (p, c) { const r = _tt(p, c); if (r && p) st(p).tk++; return r; };
  const _gain = gainBall;
  gainBall = function (p) {
    const shot = ball.shot;
    _gain(p);
    if (p && p.role === 'GK' && shot && shot.team !== p.team) st(p).sv++;
    if (ball.owner && lastPasser && ball.owner.team !== lastPasser.team) lastPasser = null;
  };
  const _goal = goalScored;
  goalScored = function (team) {
    const lt = ball.lastTouch, sh = ball.shot;
    _goal(team);
    if (lt && lt.team === team) { st(lt).g++; if (lastPasser && lastPasser !== lt && lastPasser.team === team) st(lastPasser).a++; }
    lastPasser = null;
  };
  // shots
  const _step = step;
  let lastShot = null;
  step = function (dt) { _step(dt); if (ball.shot && ball.shot !== lastShot) { lastShot = ball.shot; if (ball.shot.by) st(ball.shot.by).sh++; } };
  const _start = startMatch;
  startMatch = function (cfg) { lastPasser = null; lastShot = null; const r = _start(cfg); for (const p of S.players) p.st = null; return r; };
  function rate(p) {
    const s = st(p), t = p.team, o = opp(t), res = t.score > o.score ? .4 : t.score < o.score ? -.3 : 0;
    let r = 6 + s.g * 1.0 + s.a * .7 + s.sh * .12 + Math.min(.8, s.pa * .025) + s.tk * .25 + s.sv * .4 + res;
    if (p.role === 'GK' || p.role === 'DEF') r -= o.score * (p.role === 'GK' ? .35 : .15);
    if (p.role === 'GK' && o.score === 0) r += .6;
    return clamp(Math.round(r * 10) / 10, 3.5, 10);
  }
  const css = document.createElement('style');
  css.textContent = `#potm{margin-top:12px;display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap}
  #potm .pm{background:#141c2e;border-left:7px solid var(--c);border-radius:12px;padding:10px 14px;min-width:170px;text-align:left;box-shadow:0 6px 20px rgba(0,0,0,.35)}
  #potm .pm small{display:block;font-size:10px;font-weight:900;letter-spacing:2px;opacity:.8}#potm .pm b{font-size:18px;font-style:italic}#potm .pm i{float:right;font-style:normal;font-weight:900;font-size:22px;color:#ffd23f}
  #potm .rl{font-size:12px;text-align:left;line-height:1.55}#potm .rl span{display:inline-block;min-width:30px;font-weight:900}`;
  document.head.appendChild(css);
  const _ft = showFullTime;
  showFullTime = function (res) {
    _ft(res);
    try {
      const all = S.players.map(p => ({ p, r:rate(p) })).sort((a, b) => b.r - a.r);
      const best = all[0]; if (!best) return;
      const s = st(best.p), c = best.p.team.kit.c1;
      const line = [s.g && `${s.g} goal${s.g > 1 ? 's' : ''}`, s.a && `${s.a} assist${s.a > 1 ? 's' : ''}`, s.sv && `${s.sv} save${s.sv > 1 ? 's' : ''}`, s.tk && `${s.tk} tackle${s.tk > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || `${s.pa} passes`;
      let el = $('potm'); if (!el) { el = document.createElement('div'); el.id = 'potm'; $('statT').after(el); }
      const mine = all.filter(x => x.p.team === S.teams[S.me]).slice(0, 5);
      el.innerHTML = `<div class="pm" style="--c:${c}"><small>PLAYER OF THE MATCH</small><i>${best.r.toFixed(1)}</i><b>${esc(best.p.name)}</b><div class="mini">${esc(best.p.team.def.code)} · ${line}</div></div>
        <div class="rl"><b class="mini">YOUR TOP RATED</b><br>${mine.map(x => `<span style="color:${x.r >= 8 ? '#2fbf71' : x.r >= 6.5 ? '#ffd23f' : '#ff7b7b'}">${x.r.toFixed(1)}</span> ${esc(x.p.name)}`).join('<br>')}</div>`;
    } catch (e) {}
  };

  /* ================= weather ================= */
  const WN = ['CLEAR', 'RAIN', 'SNOW', 'RANDOM'];
  if (SET.weather == null) SET.weather = 0;
  const W = { now:0 };
  const N = 2600, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color:0xaebdd0, transparent:true, opacity:.45, depthWrite:false });
  const RAIN = new THREE.LineSegments(geo, rainMat); RAIN.frustumCulled = false; RAIN.visible = false; scene.add(RAIN);
  const sgeo = new THREE.BufferGeometry(), spos = new Float32Array(N * 3); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const SNOW = new THREE.Points(sgeo, new THREE.PointsMaterial({ color:0xffffff, size:.12, transparent:true, opacity:.9, depthWrite:false })); SNOW.frustumCulled = false; SNOW.visible = false; scene.add(SNOW);
  for (let i = 0; i < N; i++) { const x = rnd(-35, 35), y = rnd(0, 24), z = rnd(-35, 35); pos.set([x, y, z, x + .05, y - .55, z], i * 6); spos.set([x, y, z], i * 3); }
  const PITCH_COL = PITCH.material.color.clone(), PITCH_R = PITCH.material.roughness;
  const sky0 = scene.fog ? scene.fog.color.clone() : null;
  function applyWeather() {
    let w = SET.weather; if (w === 3) w = [0, 0, 1, 2][(Math.random() * 4) | 0];
    W.now = w;
    RAIN.visible = w === 1; SNOW.visible = w === 2;
    PITCH.material.color.copy(PITCH_COL);
    if (w === 1) PITCH.material.color.multiplyScalar(.82);
    if (w === 2) PITCH.material.color.lerp(new THREE.Color(0xe8eef5), .35);
    PITCH.material.roughness = w === 1 ? .55 : PITCH_R;
    ballMesh.material.color.set(w === 2 ? 0xff8a2a : 0xffffff);
    if (scene.fog && sky0) { scene.fog.color.copy(sky0); if (w) scene.fog.color.lerp(new THREE.Color(w === 1 ? 0x6c7684 : 0xc9d3de), .5); }
    rainSound(w === 1);
  }
  const _sm2 = startMatch;
  startMatch = function (cfg) { const r = _sm2(cfg); try { applyWeather(); if (W.now) setTimeout(() => toastMsg(W.now === 1 ? '🌧 Rain tonight: the ball will skid on the wet grass' : '❄ Snow! Orange ball, and it slows down quickly'), 3200); } catch (e) {} return r; };
  // ball behaviour on the ground
  const _bp = ballPhysics;
  ballPhysics = function (dt) {
    const air0 = ball.pos.y > BR + .02, vy0 = ball.vel.y;
    _bp(dt);
    if (!W.now || ball.owner) return;
    const ground = ball.pos.y <= BR + .02 && Math.abs(ball.vel.y) < .5;
    if (ground) { const f = W.now === 1 ? Math.pow(1.18, dt) : Math.pow(.62, dt); ball.vel.x *= f; ball.vel.z *= f; }
    if (air0 && vy0 < -2 && ball.vel.y > 0) { if (W.now === 1) { ball.vel.y *= .75; ball.vel.x *= 1.08; ball.vel.z *= 1.08; } if (W.now === 2) { ball.vel.y *= .6; ball.vel.x *= .8; ball.vel.z *= .8; } }
  };
  let lastT = performance.now();
  (function tick() {
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (!W.now || S.state === 'menu') { if (RAIN.visible || SNOW.visible) { RAIN.visible = SNOW.visible = false; } return; }
    const cx = camera.position.x, cz = camera.position.z;
    if (W.now === 1) {
      RAIN.visible = true;
      for (let i = 0; i < N; i++) { const j = i * 6; pos[j + 1] -= 26 * dt; if (pos[j + 1] < 0) { pos[j] = cx + rnd(-35, 35); pos[j + 2] = cz + rnd(-40, 10); pos[j + 1] = rnd(18, 26); } pos[j + 3] = pos[j] + .05; pos[j + 4] = pos[j + 1] - .55; pos[j + 5] = pos[j + 2]; }
      geo.attributes.position.needsUpdate = true;
    } else {
      SNOW.visible = true;
      for (let i = 0; i < N; i++) { const j = i * 3; spos[j + 1] -= 1.6 * dt; spos[j] += Math.sin(now / 900 + i) * .4 * dt; if (spos[j + 1] < 0) { spos[j] = cx + rnd(-35, 35); spos[j + 2] = cz + rnd(-40, 10); spos[j + 1] = rnd(14, 22); } }
      sgeo.attributes.position.needsUpdate = true;
    }
  })();
  let RS = null;
  function rainSound(on) {
    if (!AU.ctx) return;
    if (!on) { if (RS) { try { RS.stop(); } catch (e) {} RS = null; } return; }
    if (RS) return;
    const ctx = AU.ctx, b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = .035;
    src.connect(f); f.connect(g); g.connect(AU.crowdMaster || ctx.destination); src.start(); RS = src;
  }
  setInterval(() => { if (RS && (S.state === 'menu' || !W.now)) rainSound(false); }, 1000);

  /* ================= settings: weather + how to play ================= */
  const HOW = `<h3>HOW TO PLAY</h3>
    <div class="mini" style="line-height:1.7">
    <b>Move</b> WASD / arrows · <b>Sprint</b> Shift · <b>Pass</b> J · <b>Shoot</b> K or Space (tap = auto power, hold = charge) · <b>Through ball</b> L · <b>Lob / cross</b> I · <b>Switch</b> Q · <b>Press / shield</b> E · <b>Crowd noise</b> M<br><br>
    <b>Shot types</b>: tap shots pick the best one: <i>finesse</i> (curled into the far corner), <i>low driven</i> (near post), <i>power</i>. Hold <b>E</b> while shooting for finesse, <b>Q</b> for low driven. Push the stick up or down to pick a corner.<br>
    <b>Dinked pass</b>: hold <b>Sprint + Lob</b> for a little chip over a defender.<br>
    <b>One-two</b>: after a pass, press <b>Pass</b> again within a second (stick towards the first player or no stick) to play it back into his run.<br>
    <b>Shield</b>: hold <b>E</b> on the ball: you slow down and keep your body between the defender and the ball. Tackles from behind rarely work.<br>
    <b>Headers</b>: be under the ball in the box and your player heads it automatically. Hold <b>Shoot</b> for a harder header; push the stick for a corner.<br>
    <b>Corners</b>: aim at a zone with the stick (near post, penalty spot, far post, edge) and press Lob or Shoot. The camera drops into the box in slow motion: move your attacker into the ball, <b>Q</b> switches attacker, <b>E</b> shrugs off your marker.<br>
    <b>Defending</b>: Pass = tackle, Shoot = slide, hold E = press, Q = switch.<br>
    <b>Replays</b>: any button skips. Touch screens: the on-screen buttons do the same jobs.</div>`;
  const _ss = showSettings;
  showSettings = function () {
    _ss();
    const card = $('settings').querySelector('.card'), rows = card && card.querySelectorAll('.row'); if (!rows || !rows.length) return;
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<span class="lab">WEATHER</span>' + WN.map((n, i) => `<button type="button" class="${i === SET.weather ? 'sel' : ''}" data-weather="${i}">${n[0] + n.slice(1).toLowerCase()}</button>`).join('');
    rows[rows.length - 1].after(row);
    const r2 = document.createElement('div'); r2.className = 'row'; r2.innerHTML = '<span class="lab">CONTROLS</span><button type="button" data-howto="1">📖 How to play</button>'; row.after(r2);
  };
  $('settings').addEventListener('click', e => {
    const b = e.target.closest('button[data-weather],button[data-howto]'); if (!b) return;
    if (b.dataset.weather) { SET.weather = +b.dataset.weather; saveSet(); showSettings(); return; }
    openHow();
  });
  function openHow(extra) {
    const box = document.getElementById('mcx'); if (!box) return;
    box.innerHTML = `<div class="box">${extra || ''}${HOW}<div class="cta" style="margin-top:12px"><button class="big" type="button" data-close>GOT IT</button></div></div>`;
    box.classList.add('on');
  }
  // one-time "what's new" card
  const NEWS = 'kr_news_v5';
  const _home = showHome;
  showHome = function () {
    _home();
    try {
      if (localStorage.getItem(NEWS)) return;
      localStorage.setItem(NEWS, '1');
      setTimeout(() => openHow(`<h3>WHAT'S NEW</h3><div class="mini" style="line-height:1.6;margin-bottom:10px">Shot types, dinks, one-twos, shielding, headers and two-phase corners · Manager Career Deadline Day, deals, coaches, scouting, press conferences · Player Career archetypes and rivalries · Road to Success Evolutions, PlayStyles, challenges, gallery and events · Street 1v1/2v2/3v3 and House Rules · weather and Player of the Match.</div>`), 600);
    } catch (e) {}
  };
  // the home screen was drawn before these modules loaded: draw it again so the new tiles show up
  try { if (S.state === 'menu' && $('home') && !$('home').classList.contains('hide')) showHome(); } catch (e) {}
})();
