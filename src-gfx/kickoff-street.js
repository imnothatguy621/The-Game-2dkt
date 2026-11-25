/* Kickoff Rivals: small-sided street football and House Rules.
   STREET  1v1 (3 minutes, CPU keepers), 2v2 and 3v3 cage matches (small goals, no keepers). Played in a walled
           cage, so the ball never goes out. Every restart is a central ball launch.
   HOUSE RULES for friendlies and an 8-team knockout tournament:
     Mystery Ball   each restart brings a different ball: heavy, light, bouncy, rocket or ice
     King of the Hill  keep the ball inside the glowing zone to build a goal multiplier (up to x3)
     No Rules       no throw-ins, corners or goal kicks: the ball bounces off the sides
     Headers & Volleys  only headers and volleys count
     Survival       every time a team scores, it loses a player
     Long Range     goals from outside the box count double */
(function () {
  if (typeof startMatch !== 'function') return;
  const DEF = { PL, PW, GW, GH };
  const MODES = {
    '1v1':{ n:'1v1', keep:[0, 9], PL:16, PW:10, GW:2.5, GH:1.8, len:180, d:'3 minutes · CPU keepers' },
    '2v2':{ n:'2v2 Cage', keep:[9, 6], PL:17, PW:10.5, GW:1.5, GH:1.0, len:240, d:'Small goals · no keepers' },
    '3v3':{ n:'3v3 Cage', keep:[9, 6, 3], PL:21, PW:12.5, GW:1.6, GH:1.05, len:300, d:'Small goals · no keepers' }
  };
  const RULES = {
    mystery:{ n:'Mystery Ball', i:'❓', d:'A different ball after every restart' },
    koth:{ n:'King of the Hill', i:'👑', d:'Hold the ball in the zone to multiply your next goal' },
    norules:{ n:'No Rules', i:'🚫', d:'No throw-ins, corners or goal kicks. Ball bounces off the sides' },
    headvol:{ n:'Headers & Volleys', i:'🦅', d:'Only headers and volleys count' },
    survival:{ n:'Survival', i:'🔥', d:'Score and your team loses a player' },
    long:{ n:'Long Range', i:'🎯', d:'Goals from outside the box count double' }
  };
  const M = { street:null, rule:null };
  window.STREET = M;

  /* ---------------- cage, small goals, hiding the big goals ---------------- */
  scene.updateMatrixWorld(true);
  const BIG = [];
  scene.traverse(o => { if (!o.isMesh || o === ballMesh) return; const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); if (Math.abs(p.x) > PL - .6 && Math.abs(p.x) < PL + 2.8 && Math.abs(p.z) < GW + 1.5 && p.y < GH + 1.6 && !o.isInstancedMesh) BIG.push(o); });
  const CAGE = new THREE.Group(); CAGE.visible = false; scene.add(CAGE);
  function fenceTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.strokeStyle = 'rgba(220,230,240,.85)'; g.lineWidth = 2; g.beginPath();
    for (let i = -64; i < 128; i += 16) { g.moveTo(i, 0); g.lineTo(i + 64, 64); g.moveTo(i + 64, 0); g.lineTo(i, 64); }
    g.stroke(); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const FT = fenceTex();
  function buildCage(m) {
    while (CAGE.children.length) { const c = CAGE.children.pop(); c.geometry && c.geometry.dispose(); }
    const L = m.PL, W = m.PW, H = 4, board = new THREE.MeshStandardMaterial({ color:0x1b2a4a, roughness:.6 });
    const fence = (len) => { const t = FT.clone(); t.needsUpdate = true; t.repeat.set(len / 1.2, H / 1.2); return new THREE.MeshBasicMaterial({ map:t, transparent:true, side:THREE.DoubleSide, depthWrite:false }); };
    const wall = (x, z, len, rotY, gap) => {
      const mk = (cx, cz, l) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(l, .9, .12), board); b.position.set(cx, .45, cz); b.rotation.y = rotY; b.castShadow = b.receiveShadow = true; CAGE.add(b);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(l, H - .9), fence(l)); f.position.set(cx, .9 + (H - .9) / 2, cz); f.rotation.y = rotY; CAGE.add(f);
      };
      if (!gap) mk(x, z, len);
      else { const seg = (len - gap) / 2, o = gap / 2 + seg / 2; if (rotY) { mk(x, z - o, seg); mk(x, z + o, seg); } else { mk(x - o, z, seg); mk(x + o, z, seg); } }
    };
    wall(0, -W - .06, L * 2, 0); wall(0, W + .06, L * 2, 0);
    wall(-L - .06, 0, W * 2, Math.PI / 2, m.GW * 2 + .2); wall(L + .06, 0, W * 2, Math.PI / 2, m.GW * 2 + .2);
    // posts on the corners
    const postM = new THREE.MeshStandardMaterial({ color:0xd7dde5, metalness:.6, roughness:.3 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, H, 8), postM); p.position.set(sx * L, H / 2, sz * W); CAGE.add(p); }
    // small goals with a net box
    const gm = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.35 }), netM = new THREE.MeshBasicMaterial({ map:FT, transparent:true, side:THREE.DoubleSide, depthWrite:false, opacity:.9 });
    for (const s of [-1, 1]) {
      const x = s * m.PL, D = 1.0;
      for (const z of [-m.GW, m.GW]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, m.GH, 10), gm); p.position.set(x, m.GH / 2, z); CAGE.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, m.GW * 2, 10), gm); bar.rotation.x = Math.PI / 2; bar.position.set(x, m.GH, 0); CAGE.add(bar);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(m.GW * 2, m.GH), netM); back.position.set(x + s * D, m.GH / 2, 0); back.rotation.y = Math.PI / 2; CAGE.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(D, m.GW * 2), netM); top.position.set(x + s * D / 2, m.GH, 0); top.rotation.x = Math.PI / 2; CAGE.add(top);
      for (const z of [-m.GW, m.GW]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(D, m.GH), netM); sd.position.set(x + s * D / 2, m.GH / 2, z); CAGE.add(sd); }
    }
    // white lines: outline, halfway line, centre circle
    const lm = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.9 });
    const line = (x, z, w, d) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lm); l.rotation.x = -Math.PI / 2; l.position.set(x, .025, z); CAGE.add(l); };
    line(0, 0, .1, W * 2); line(0, -W + .3, L * 2 - .6, .1); line(0, W - .3, L * 2 - .6, .1);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.7, 48), lm); ring.rotation.x = -Math.PI / 2; ring.position.y = .025; CAGE.add(ring);
    // dark floor tint so the cage reads as its own pitch
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(L * 2, W * 2), new THREE.MeshBasicMaterial({ color:0x0b3d1a, transparent:true, opacity:.25, depthWrite:false })); fl.rotation.x = -Math.PI / 2; fl.position.y = .02; CAGE.add(fl);
  }
  function setDims(d) { PL = d.PL; PW = d.PW; GW = d.GW; GH = d.GH; }

  /* ---------------- starting matches ---------------- */
  const _start = startMatch;
  startMatch = function (cfg) {
    if (cfg && !(typeof XBOT_B64 !== 'undefined' && !XBOT.ready)) {
      M.street = cfg.street ? MODES[cfg.street] : null;
      M.rule = cfg.house || null; M.mult = [1, 1]; M.koth = null; M.ballType = null;
      setDims(M.street || DEF);
      const big = !M.street; BIG.forEach(o => o.visible = big);
      if (M.street) buildCage(M.street); CAGE.visible = !!M.street;
      if (M.street) cfg.len = M.street.len;
    }
    _start(cfg);
    if (M.rule) { const r = RULES[M.rule]; setTimeout(() => toastMsg(`${r.i} House Rule: ${r.n}`), 2400); }
  };
  // keep only the players this mode uses
  const _setup = setupTeams;
  setupTeams = function (cfg) {
    _setup(cfg);
    if (!M.street) return;
    const keep = M.street.keep;
    for (const t of S.teams) {
      const out = t.players.filter(p => !keep.includes(p.i));
      for (const p of out) { scene.remove(p.g.root); if (typeof disposeSkinned === 'function') disposeSkinned(p.g); }
      t.players = keep.map(i => t.players.find(p => p.i === i)).filter(Boolean);
      t.ctrl = t.players.find(p => p.role !== 'GK') || t.players[0];
    }
    S.players = S.teams.flatMap(t => t.players);
  };
  // ball launch instead of kick-off in street games, and Mystery Ball / King of the Hill on every restart
  const _pk = placeKickoff;
  placeKickoff = function (kickTeam) {
    if (!M.street) { _pk(kickTeam); onRestart(); return; }
    const spots = { 2:[[-11, 0]], 3:[[-7, -3], [-7, 3]], 4:[[-9, 0], [-6, -4], [-6, 4]] }[M.street.keep.length + 1] || [[-8, 0]];
    for (const t of S.teams) {
      let k = 0;
      for (const p of t.players) {
        if (p.role === 'GK') p.pos.set(-t.side * (PL - 1.2), 0, 0);
        else { const s = spots[k++ % spots.length]; p.pos.set(t.side * s[0] * PL / 21, 0, s[1] * PW / 12.5); }
        p.vel.set(0, 0, 0); p.face = t.side > 0 ? Math.PI / 2 : -Math.PI / 2; p.slide = p.stun = p.dive = p.celeb = 0;
      }
      setCtrl(t, t.players.find(p => p.role !== 'GK') || t.players[0]);
    }
    ball.owner = null; ball.pos.set(0, 7, 0); ball.vel.set(rnd(-.6, .6), 1.5, rnd(-.6, .6)); ball.shot = null; ball.intended = null; ball.lastTouch = null;
    S.frozen = null; S.setp = null; S.state = 'play';
    banner('BALL LAUNCH', '', 1.2);
    onRestart();
  };

  /* ---------------- walls and goals ---------------- */
  const walls = () => M.street || M.rule === 'norules';
  const _cbr = checkBallRules;
  checkBallRules = function () {
    if (S.state !== 'play') return _cbr();
    const b = ball.pos, v = ball.vel;
    // goal checks with Headers & Volleys / goal-line for small goals
    if (Math.abs(b.x) > PL + BR && Math.abs(b.z) < GW && b.y < GH) {
      if (M.rule === 'headvol' && !/header|volley/.test(ball.kickType || '')) {
        toast('No goal: headers and volleys only!');
        const end = Math.sign(b.x), defT = S.teams.find(t => t.side === -end);
        if (walls()) { b.x = end * (PL - 1); v.set(-end * 3, 1, 0); return; }
        restart('goalkick', defT, end * (PL - 5.5), 0); return;
      }
      if (M.street) { goalScored(S.teams.find(t => t.side === Math.sign(b.x))); return; }
      return _cbr();
    }
    if (!walls()) return _cbr();
    // bounce off the sides and the end walls (but not through the goal mouth)
    if (Math.abs(b.z) > PW - BR) { b.z = Math.sign(b.z) * (PW - BR); v.z = -v.z * .7; v.x *= .9; fx('kick', 3); }
    if (Math.abs(b.x) > PL - BR && !(Math.abs(b.z) < GW && b.y < GH)) { b.x = Math.sign(b.x) * (PL - BR); v.x = -v.x * .7; v.z *= .9; fx('kick', 3); }
  };
  const _step = step;
  step = function (dt) {
    _step(dt);
    if (S.state === 'menu') return;
    if (walls()) for (const p of S.players) { p.pos.x = clamp(p.pos.x, -PL + .3, PL - .3); p.pos.z = clamp(p.pos.z, -PW + .3, PW - .3); }
    if (M.street) {
      // inside a small goal: the net stops it
      const b = ball.pos, v = ball.vel;
      if (Math.abs(b.x) > PL && Math.abs(b.z) < GW + .2) { if (Math.abs(b.x) > PL + .9) { b.x = Math.sign(b.x) * (PL + .9); v.x *= -.15; } if (b.y > GH - BR) { b.y = GH - BR; v.y = -Math.abs(v.y) * .2; } }
    }
    if (M.rule === 'koth' && S.state === 'play') kothTick(dt);
    if (M.rule === 'mystery' && M.ballType) mysteryTick(dt);
  };

  // closer broadcast camera for the small cage
  const _cam = updateCamera, cv = new THREE.Vector3(), lv = new THREE.Vector3();
  updateCamera = function (dt) {
    if (!M.street || S.state === 'replay' || (window.CEL && CEL.on)) { _cam(dt); return; }
    const b = ball.pos;
    cv.set(b.x * .75, 10 + PL * .12, PW + 8 + b.z * .25); lv.set(b.x * .85, 0, b.z * .35);
    const k = 1 - Math.exp(-dt * 3);
    camera.position.lerp(cv, k); camLook.lerp(lv, 1 - Math.exp(-dt * 4)); camera.lookAt(camLook);
    if (Math.abs(camera.fov - 50) > .5) { camera.fov = 50; camera.updateProjectionMatrix(); }
  };
  /* ---------------- kick types (Headers & Volleys, Long Range) ---------------- */
  const _gain = gainBall;
  gainBall = function (p) { const air = ball.pos.y > .45 || Math.abs(ball.vel.y) > 2; _gain(p); if (ball.owner === p) { p.gotAirT = air ? S.clock : -9; } };
  const _kb = kickBall;
  kickBall = function (p, v) {
    let type = 'ground';
    if (ball.owner !== p && ball.pos.y > 1) type = 'header';
    else if (ball.owner !== p && ball.pos.y > .4) type = 'volley';
    else if (p && S.clock - (p.gotAirT || -9) < .35) type = 'volley';
    if (M.rule === 'mystery' && M.ballType) v.multiplyScalar(M.ballType.kick);
    // small goals: shots are struck low enough to go under the bar
    if (M.street && p && Math.sign(v.x) === p.team.side && Math.hypot(v.x, v.z) > 10) {
      const gx = p.team.side * PL, T = Math.abs((gx - ball.pos.x) / (v.x || 1));
      if (T < 2.5) { const h = GH * (.25 + Math.random() * .5); v.y = (h - ball.pos.y + .5 * GRAV * T * T) / T; }
    }
    _kb(p, v);
    ball.kickType = type;
    ball.kickFrom = p ? Math.hypot(p.team.side * PL - ball.pos.x, ball.pos.z) : 0;
  };
  const _goal = goalScored;
  goalScored = function (team) {
    _goal(team);
    let extra = 0;
    if (M.rule === 'long' && ball.lastTouch && ball.lastTouch.team === team && ball.kickFrom > 16.5) { extra += 1; setTimeout(() => toast('LONG RANGE: counts double!'), 600); }
    if (M.rule === 'koth') { const m = M.mult[team.i] || 1; if (m > 1) { extra += m - 1; setTimeout(() => toast(`👑 x${m} goal!`), 600); } M.mult = [1, 1]; }
    if (extra) { team.score += extra; for (let i = 0; i < extra; i++) S.goals.push(Object.assign({}, S.goals[S.goals.length - 1], { bonus:true })); }
    if (M.rule === 'survival') survivalCut(team);
  };
  function survivalCut(team) {
    const pool = team.players.filter(p => p.role !== 'GK' && p !== team.ctrl);
    if (team.players.length <= 4 || !pool.length) return;
    const p = pool.sort((a, b) => d2(b.pos, ball.pos) - d2(a.pos, ball.pos))[0];
    scene.remove(p.g.root); team.players = team.players.filter(q => q !== p); S.players = S.players.filter(q => q !== p);
    setTimeout(() => toast(`🔥 Survival: ${team.def.code} lose ${p.name}. ${team.players.length} left`), 900);
  }

  /* ---------------- Mystery Ball ---------------- */
  const BALLS = [{ n:'Heavy', kick:.85, bounce:.6, lift:0, roll:1, col:0x8a6b4a }, { n:'Light', kick:1.08, bounce:1.1, lift:3.2, roll:1, col:0x9fe8ff },
    { n:'Bouncy', kick:1, bounce:1.45, lift:0, roll:1, col:0xff5fd2 }, { n:'Rocket', kick:1.2, bounce:1, lift:0, roll:1, col:0xff6a2b }, { n:'Ice', kick:1, bounce:.9, lift:0, roll:1.006, col:0xbfe6ff }];
  let lastVy = 0;
  function mysteryTick(dt) {
    const b = ball, t = M.ballType;
    if (b.owner) { lastVy = 0; return; }
    const air = b.pos.y > BR + .02;
    if (air && t.lift) b.vel.y += t.lift * dt;
    if (lastVy < -2 && b.vel.y > 0 && t.bounce !== 1) b.vel.y = Math.min(14, b.vel.y * t.bounce);
    if (!air && t.roll !== 1) { b.vel.x *= t.roll; b.vel.z *= t.roll; }
    lastVy = b.vel.y;
  }
  function onRestart() {
    ballMesh.material.color.set(0xffffff);
    if (M.rule === 'mystery') { M.ballType = BALLS[(Math.random() * BALLS.length) | 0]; ballMesh.material.color.set(M.ballType.col); const bn = M.ballType.n; setTimeout(() => toast(`❓ Mystery Ball: ${bn}!`), 1300); }
    if (M.rule === 'koth') newZone();
  }

  /* ---------------- King of the Hill ---------------- */
  const ZONE = new THREE.Mesh(new THREE.RingGeometry(4.2, 5, 48), new THREE.MeshBasicMaterial({ color:0xffd23f, transparent:true, opacity:.7, depthWrite:false, side:THREE.DoubleSide }));
  const ZFILL = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ color:0xffd23f, transparent:true, opacity:.12, depthWrite:false }));
  ZONE.rotation.x = ZFILL.rotation.x = -Math.PI / 2; ZONE.position.y = .05; ZFILL.position.y = .045; ZONE.visible = ZFILL.visible = false; scene.add(ZONE, ZFILL);
  const kHud = document.createElement('div');
  kHud.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:6;font:900 14px "Segoe UI",system-ui;color:#fff;background:rgba(8,14,28,.8);padding:6px 14px;border-radius:16px;letter-spacing:1px;display:none;pointer-events:none';
  document.body.appendChild(kHud);
  function newZone() { M.koth = { x:rnd(-PL * .55, PL * .55), z:rnd(-PW * .5, PW * .5), charge:[0, 0] }; ZONE.position.x = ZFILL.position.x = M.koth.x; ZONE.position.z = ZFILL.position.z = M.koth.z; ZONE.visible = ZFILL.visible = true; }
  function kothTick(dt) {
    if (!M.koth) newZone();
    const o = ball.owner, k = M.koth;
    if (o && Math.hypot(o.pos.x - k.x, o.pos.z - k.z) < 5) {
      const i = o.team.i; k.charge[i] += dt;
      if (k.charge[i] > 2.5 && M.mult[i] < 3) { M.mult[i]++; k.charge[i] = 0; toast(`👑 ${o.team.def.code} next goal x${M.mult[i]}`); newZone(); }
    }
    ZONE.material.color.set(o ? new THREE.Color(o.team.kit.c1) : 0xffd23f);
    kHud.style.display = 'block';
    kHud.innerHTML = `👑 ${S.teams[0].def.code} x${M.mult[0]} · ${S.teams[1].def.code} x${M.mult[1]}`;
  }
  setInterval(() => { if (M.rule !== 'koth' || S.state === 'menu' || S.state === 'full') { kHud.style.display = 'none'; ZONE.visible = ZFILL.visible = false; } }, 500);

  /* ---------------- menus: street, friendlies, tournament ---------------- */
  const T = { cup:null };
  try { T.cup = JSON.parse(localStorage.getItem('kr_hr') || 'null'); } catch (e) {}
  const saveT = () => { try { localStorage.setItem('kr_hr', JSON.stringify(T.cup)); } catch (e) {} };
  let myClub = (() => { try { return localStorage.getItem('kr_street_club') || null; } catch (e) { return null; } })();
  const clubs = () => LEAGUES.flatMap(L => L.clubs).filter(c => !c.admin);
  const rndOpp = me => { const l = clubs().filter(c => c.id !== me && Math.abs(c.ovr - ALL[me].ovr) < 7); return (l.length ? l : clubs())[(Math.random() * (l.length || clubs().length)) | 0].id; };
  function streetShow() {
    shown('hub');
    const c = myClub && ALL[myClub];
    $('hub').innerHTML = `<div class="card"><div class="hdr"><h2>STREET & HOUSE RULES</h2><button type="button" data-st="home">✕</button></div>
      <p class="mini">Your team: <b>${c ? esc(c.name) : 'not picked'}</b> <button type="button" data-st="club">${c ? 'Change' : 'Pick a club'}</button></p>
      <h3>STREET</h3><div class="rx-grid">${Object.entries(MODES).map(([k, m]) => `<div class="rx-tile"><h4>${m.n}</h4><div class="mini">${m.d} · walled cage · ball launch restarts</div><button class="big" type="button" data-st="street" data-v="${k}" style="margin-top:8px" ${c ? '' : 'disabled'}>PLAY ▶</button></div>`).join('')}</div>
      <h3 style="margin-top:14px">HOUSE RULES FRIENDLY (11v11)</h3><div class="rx-grid">${Object.entries(RULES).map(([k, r]) => `<div class="rx-tile"><h4>${r.i} ${r.n}</h4><div class="mini">${r.d}</div><button type="button" data-st="friendly" data-v="${k}" style="margin-top:8px" ${c ? '' : 'disabled'}>Play</button></div>`).join('')}</div>
      <h3 style="margin-top:14px">HOUSE RULES TOURNAMENT</h3>${cupHTML()}</div>`;
  }
  function cupHTML() {
    const cup = T.cup;
    if (!cup) return `<p class="mini">8-team knockout. Every round has a different House Rule. Win it for 15,000 coins.</p><button class="big" type="button" data-st="cup" ${myClub ? '' : 'disabled'}>START TOURNAMENT</button>`;
    const rnames = ['Quarter-finals', 'Semi-finals', 'Final'];
    const cur = cup.rounds[cup.r], fx = cur && cur.find(m => m.includes(cup.me));
    return `<div class="rx-grid">${cup.rounds.map((rd, ri) => `<div class="rx-tile"><h4>${rnames[ri]} · ${RULES[cup.rules[ri]].i} ${RULES[cup.rules[ri]].n}</h4>${rd.map(m => `<div class="mini" style="${m.includes(cup.me) ? 'color:#ffd23f;font-weight:800' : ''}">${esc(ALL[m[0]].name)} ${m[2] != null ? `<b>${m[2]}-${m[3]}</b>` : 'vs'} ${esc(ALL[m[1]].name)}</div>`).join('')}</div>`).join('')}</div>
      ${cup.done ? `<p><b>${cup.won ? '🏆 You won the tournament! +15,000 coins' : 'Knocked out.'}</b></p><button type="button" data-st="cupnew">New tournament</button>` : fx ? `<div class="cta"><button type="button" data-st="cupsim">Simulate</button><button class="big" type="button" data-st="cupplay">PLAY ${RULES[cup.rules[cup.r]].i} ▶</button></div>` : ''}`;
  }
  function cupNew() {
    const pool = clubs().filter(c => c.id !== myClub).sort((a, b) => b.ovr - a.ovr).slice(0, 20).sort(() => Math.random() - .5).slice(0, 7).map(c => c.id);
    const teams = [myClub].concat(pool).sort(() => Math.random() - .5), keys = Object.keys(RULES).sort(() => Math.random() - .5);
    T.cup = { me:myClub, r:0, rounds:[[0, 1, 2, 3].map(i => [teams[i * 2], teams[i * 2 + 1]])], rules:keys.slice(0, 3), done:false };
    saveT();
  }
  function cupResult(hs, as) {
    const cup = T.cup, rd = cup.rounds[cup.r];
    for (const m of rd) {
      if (m.includes(cup.me)) { m[2] = hs; m[3] = as; } else { const [x, y] = simScore(m[0], m[1]); m[2] = x; m[3] = y; }
      if (m[2] === m[3]) { if (Math.random() < .5) m[2]++; else m[3]++; }       // penalties
    }
    const winners = rd.map(m => m[2] > m[3] ? m[0] : m[1]);
    if (!winners.includes(cup.me)) { cup.done = true; cup.won = false; }
    else if (winners.length === 1) { cup.done = true; cup.won = true; PROFILE.coins += 15000; saveProfile(); }
    else { cup.r++; cup.rounds.push(winners.reduce((a, w, i) => (i % 2 ? a[a.length - 1].push(w) : a.push([w]), a), [])); }
    saveT();
  }
  function playMatch(home, away, extra, done) {
    CUR_MATCH = { kind:'custom', done:res => { done && done(res.hs, res.as); streetShow(); }, quit:streetShow };
    startMatch(Object.assign(cfgFor(home, away, 0, { label:extra.label }), extra));
  }
  $('hub').addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    const a = b.dataset.st, v = b.dataset.v;
    if (a === 'home') showHome();
    else if (a === 'club') pickTeam({ title:'STREET & HOUSE RULES · PICK YOUR TEAM', tabs:'leagues', asUser:true }, id => { myClub = id; try { localStorage.setItem('kr_street_club', id); } catch (er) {} streetShow(); });
    else if (a === 'street') playMatch(myClub, rndOpp(myClub), { street:v, label:`Street · ${MODES[v].n}` });
    else if (a === 'friendly') playMatch(myClub, rndOpp(myClub), { house:v, label:`House Rules · ${RULES[v].n}` });
    else if (a === 'cup' || a === 'cupnew') { cupNew(); streetShow(); }
    else if (a === 'cupsim' || a === 'cupplay') {
      const cup = T.cup, m = cup.rounds[cup.r].find(m => m.includes(cup.me)), myIdx = m[0] === cup.me ? 0 : 1;
      if (a === 'cupsim') { const [x, y] = simScore(m[0], m[1]); cupResult(x, y); streetShow(); return; }
      CUR_MATCH = { kind:'custom', done:res => { cupResult(res.hs, res.as); streetShow(); }, quit:streetShow };
      startMatch(Object.assign(cfgFor(m[0], m[1], myIdx, { label:`House Rules Cup · ${RULES[cup.rules[cup.r]].n}` }), { house:cup.rules[cup.r] }));
    }
  });
  const _tiles = extraTiles;
  extraTiles = function () { return _tiles() + `<button class="tile" type="button" data-m="street" style="background:linear-gradient(135deg,#3a0ca3,#f72585)"><i>🏟</i><b>STREET & HOUSE RULES</b><small>1v1 · 2v2/3v3 cages · tournaments</small></button>`; };
  const _mode = extraMode;
  extraMode = function (m) { if (m === 'street') streetShow(); else _mode(m); };
})();
