/* Kickoff Rivals: TV-style replays.
   Goals get a three-angle broadcast replay (broadcast cam, super slow-mo player cam, goal cam) with a
   stinger wipe, a glowing ball tracer, a shot-stats card (speed, distance, xG) and a match-stats panel
   afterwards. Big chances (saved, off the post, just wide) get a shorter two-angle replay at the next
   stoppage. Any button, key or tap skips. Settings has REPLAYS: All / Goals / Off. */
(function () {
  if (typeof startReplay !== 'function' || typeof REC === 'undefined') return;

  /* ---------------- shot tracking ---------------- */
  const SHOT = { last:null };
  function xgOf(x, z, side) {
    const gx = side * PL, dx = Math.abs(gx - x), dz = z, d = Math.hypot(dx, dz);
    const ang = Math.max(0, Math.atan2(2 * GW * dx, dx * dx + dz * dz - GW * GW));
    return clamp(1 / (1 + Math.exp(-(-1.75 + 2.4 * ang - .05 * d))), .01, .95);
  }
  let lastShotObj = null;
  const _rec = recTick;
  recTick = function (dt) {
    const before = REC.buf.length;
    _rec(dt);
    if (REC.buf.length === before && REC.buf.length < REC.max) return;
    const f = REC.buf[REC.buf.length - 1];
    if (ball.shot && ball.shot !== lastShotObj) {
      lastShotObj = ball.shot;
      const p = ball.shot.by, t = ball.shot.team, side = t.side;
      const xg = xgOf(ball.pos.x, ball.pos.z, side);
      t.xg = (t.xg || 0) + xg;
      f.shot = SHOT.last = { pi:S.players.indexOf(p), name:p.name, num:p.num, team:t.i, side, xg,
        speed:Math.round(ball.vel.length() * 3.6), dist:Math.hypot(side * PL - ball.pos.x, ball.pos.z),
        clock:S.clock, post:false, outcome:'', used:false, minute:Math.max(1, Math.ceil(minute())) };
    }
    if (!ball.shot) lastShotObj = null;
  };
  // REC frames shift out of the buffer; find the shot frame by identity
  const shotIndex = sh => { for (let i = REC.buf.length - 1; i >= 0; i--) if (REC.buf[i].shot === sh) return i; return -1; };

  const _fx = playFx;
  playFx = function (type, a, b, c) { if (type === 'post' && SHOT.last && S.clock - SHOT.last.clock < 3) SHOT.last.post = true; return _fx(type, a, b, c); };

  /* ---------------- settings ---------------- */
  const REPN = ['ALL', 'GOALS', 'OFF'];
  if (SET.replays == null) SET.replays = 0;
  const _ss = showSettings;
  showSettings = function () {
    _ss();
    const card = $('settings').querySelector('.card'), rows = card && card.querySelectorAll('.row');
    if (!rows || rows.length < 5) return;
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<span class="lab">REPLAYS</span>' + REPN.map((n, i) => `<button type="button" class="${i === SET.replays ? 'sel' : ''}" data-replays="${i}">${n === 'ALL' ? 'Goals + chances' : n === 'GOALS' ? 'Goals only' : 'Off'}</button>`).join('');
    rows[rows.length - 2].after(row);
  };
  $('settings').addEventListener('click', e => { const b = e.target.closest('button[data-replays]'); if (!b) return; SET.replays = +b.dataset.replays; saveSet(); showSettings(); });

  /* ---------------- overlay (DOM) ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  #ktv{position:fixed;inset:0;pointer-events:none;z-index:7;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#fff}
  #ktv .sting{position:absolute;inset:0;overflow:hidden;opacity:0}
  #ktv .sting i{position:absolute;top:-20%;height:140%;width:38%;transform:skewX(-18deg) translateX(-160vw)}
  #ktv .sting.go{opacity:1}
  #ktv .sting.go i{animation:ktvWipe .78s cubic-bezier(.7,0,.3,1) forwards}
  #ktv .sting.go i:nth-child(2){animation-delay:.06s} #ktv .sting.go i:nth-child(3){animation-delay:.12s}
  #ktv .sting .logo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.6);opacity:0;font-weight:900;font-style:italic;font-size:min(11vw,88px);letter-spacing:4px;text-shadow:0 6px 30px rgba(0,0,0,.5)}
  #ktv .sting .logo small{display:block;font-size:.22em;letter-spacing:.5em;text-align:center;opacity:.85;margin-top:-4px}
  #ktv .sting.go .logo{animation:ktvLogo .78s ease forwards}
  @keyframes ktvWipe{0%{transform:skewX(-18deg) translateX(-160vw)}45%,55%{transform:skewX(-18deg) translateX(40vw)}100%{transform:skewX(-18deg) translateX(220vw)}}
  @keyframes ktvLogo{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}35%,65%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15)}}
  #ktv .bug{position:absolute;top:14px;right:118px;display:flex;align-items:stretch;opacity:0;transform:translateY(-10px);transition:.3s;border-radius:7px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.35)}
  #ktv .bug.on{opacity:1;transform:none}
  #ktv .bug b{background:#e11d2e;padding:7px 12px;font-weight:900;font-style:italic;letter-spacing:2px;display:flex;align-items:center;gap:7px}
  #ktv .bug b:before{content:"";width:8px;height:8px;border-radius:50%;background:#fff;animation:ktvBlink 1s infinite}
  #ktv .bug span{background:rgba(8,14,28,.82);backdrop-filter:blur(8px);padding:7px 12px;font-weight:700;font-size:13px;letter-spacing:1.5px;display:flex;align-items:center}
  #ktv .bug em{background:rgba(255,255,255,.12);padding:7px 10px;font-style:normal;font-size:11px;letter-spacing:1px;display:flex;align-items:center;opacity:.9}
  @keyframes ktvBlink{50%{opacity:.25}}
  #ktv .card{position:absolute;left:24px;bottom:96px;width:min(420px,calc(100vw - 48px));background:rgba(8,14,28,.84);backdrop-filter:blur(10px);border-radius:12px;overflow:hidden;opacity:0;transform:translateX(-30px);transition:.4s cubic-bezier(.2,.8,.2,1);box-shadow:0 10px 40px rgba(0,0,0,.4)}
  #ktv .card.on{opacity:1;transform:none}
  #ktv .card .hd{display:flex;align-items:center;gap:12px;padding:12px 16px 10px;border-left:6px solid var(--tc,#fff)}
  #ktv .card .no{font-size:30px;font-weight:900;font-style:italic;color:var(--tc,#fff);min-width:44px;text-shadow:0 2px 0 rgba(0,0,0,.4)}
  #ktv .card .nm{font-weight:900;font-size:19px;letter-spacing:.5px;text-transform:uppercase}
  #ktv .card .tg{font-size:11px;font-weight:800;letter-spacing:2px;opacity:.75;margin-top:2px}
  #ktv .card .tag{margin-left:auto;font-size:11px;font-weight:900;letter-spacing:1.5px;padding:5px 9px;border-radius:5px;background:var(--tc,#fff);color:var(--tx,#000)}
  #ktv .card .st{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,.1)}
  #ktv .card .st div{padding:9px 14px}
  #ktv .card .st div+div{border-left:1px solid rgba(255,255,255,.1)}
  #ktv .card .st small{display:block;font-size:10px;font-weight:800;letter-spacing:1.6px;opacity:.6}
  #ktv .card .st b{font-size:22px;font-weight:900;font-style:italic}
  #ktv .card .st b u{text-decoration:none;font-size:12px;font-style:normal;opacity:.7;margin-left:2px}
  #ktv .card .pw{height:5px;background:rgba(255,255,255,.12)}
  #ktv .card .pw i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--tc,#fff),#ffd23f);transition:width 1.1s cubic-bezier(.2,.8,.2,1)}
  #ktv .stats{position:absolute;right:24px;top:50%;width:min(380px,calc(100vw - 48px));transform:translate(30px,-50%);opacity:0;transition:.45s cubic-bezier(.2,.8,.2,1);background:rgba(8,14,28,.86);backdrop-filter:blur(10px);border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.45)}
  #ktv .stats.on{opacity:1;transform:translate(0,-50%)}
  #ktv .stats .top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;font-weight:900;font-style:italic;font-size:20px;background:rgba(255,255,255,.05)}
  #ktv .stats .top span{font-size:11px;font-style:normal;letter-spacing:2.5px;opacity:.7}
  #ktv .stats .r{padding:8px 16px 9px}
  #ktv .stats .r .l{display:flex;justify-content:space-between;font-weight:900;font-size:15px}
  #ktv .stats .r .l small{font-size:10px;font-weight:800;letter-spacing:1.8px;opacity:.65;align-self:center}
  #ktv .stats .bar{display:flex;gap:4px;height:6px;margin-top:5px}
  #ktv .stats .bar i{display:block;height:100%;border-radius:3px;width:0;transition:width .9s cubic-bezier(.2,.8,.2,1)}
  #ktv .stats .bar i:first-child{margin-left:auto}
  #ktv .stats .bar>div{flex:1;display:flex;background:rgba(255,255,255,.08);border-radius:3px}
  #ktv .skip{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);font-size:12px;font-weight:700;letter-spacing:1.5px;opacity:0;transition:.3s;background:rgba(0,0,0,.35);padding:6px 12px;border-radius:20px}
  #ktv .skip.on{opacity:.75}
  body.ktv-on #who,body.ktv-on #radar,body.ktv-on #banner,body.ktv-on #toast{opacity:0!important;transition:opacity .2s}
  @media (max-width:700px){#ktv .card{bottom:150px;left:12px}#ktv .bug{right:70px;top:10px}#ktv .bug em{display:none}#ktv .stats{right:12px}}`;
  document.head.appendChild(css);
  const UI = document.createElement('div'); UI.id = 'ktv';
  UI.innerHTML = `<div class="sting"><i></i><i></i><i></i><div class="logo">REPLAY<small>KICKOFF TV</small></div></div>
    <div class="bug"><b>REPLAY</b><span class="ang"></span><em class="spd"></em></div>
    <div class="card"></div><div class="stats"></div><div class="skip">TAP OR PRESS ANY BUTTON TO SKIP</div>`;
  document.body.appendChild(UI);
  const q = s => UI.querySelector(s);
  const hex = c => '#' + new THREE.Color(c).getHexString();
  const textOn = c => { const k = new THREE.Color(c); return (k.r * .3 + k.g * .59 + k.b * .11) > .55 ? '#000' : '#fff'; };
  function sting(cols) {
    const s = q('.sting'), bars = s.querySelectorAll('i');
    bars[0].style.background = cols[0]; bars[1].style.background = '#fff'; bars[2].style.background = cols[1];
    s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
    clearTimeout(sting.t); sting.t = setTimeout(() => s.classList.remove('go'), 900);
  }
  function teamCols(ti) { const t = S.teams[ti] || S.teams[0]; return [hex(t.kit.c1), hex(t.kit.c2 || '#111')]; }

  function showCard(sh, kind) {
    const t = S.teams[sh.team], c = hex(t.kit.c1), el = q('.card');
    const tag = kind === 'goal' ? `GOAL · ${sh.minute}'` : sh.post ? 'OFF THE POST' : sh.outcome === 'saved' ? 'GREAT SAVE' : 'BIG CHANCE';
    el.style.setProperty('--tc', c); el.style.setProperty('--tx', textOn(c));
    el.innerHTML = `<div class="hd"><div class="no">${sh.num || ''}</div><div><div class="nm">${esc(sh.name || '')}</div><div class="tg">${esc(t.def.name)}</div></div><div class="tag">${tag}</div></div>
      <div class="st"><div><small>SHOT SPEED</small><b>${sh.speed}<u>km/h</u></b></div><div><small>DISTANCE</small><b>${sh.dist.toFixed(1)}<u>m</u></b></div><div><small>xG</small><b>${sh.xg.toFixed(2)}</b></div></div>
      <div class="pw"><i></i></div>`;
    el.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => { const i = el.querySelector('.pw i'); if (i) i.style.width = clamp((sh.speed - 40) / 90, .08, 1) * 100 + '%'; }));
  }
  function showStats() {
    const [h, a] = S.teams, el = q('.stats'), ch = hex(h.kit.c1), ca = hex(a.kit.c1);
    const tp = (h.poss + a.poss) || 1, ph = Math.round(h.poss / tp * 100);
    const rows = [['POSSESSION', ph + '%', (100 - ph) + '%', ph, 100 - ph], ['SHOTS', h.shots, a.shots, h.shots, a.shots], ['ON TARGET', h.onT, a.onT, h.onT, a.onT],
      ['EXPECTED GOALS (xG)', (h.xg || 0).toFixed(2), (a.xg || 0).toFixed(2), h.xg || 0, a.xg || 0], ['PASSES', h.passes, a.passes, h.passes, a.passes]];
    el.innerHTML = `<div class="top"><b style="color:${ch}">${h.def.code}</b> ${h.score} - ${a.score} <b style="color:${ca}">${a.def.code}</b><span>MATCH STATS · ${Math.max(1, Math.ceil(minute()))}'</span></div>` +
      rows.map(r => { const tot = (+r[3] + +r[4]) || 1; return `<div class="r"><div class="l"><span>${r[1]}</span><small>${r[0]}</small><span>${r[2]}</span></div><div class="bar"><div><i data-w="${r[3] / tot * 100}" style="background:${ch}"></i></div><div><i data-w="${r[4] / tot * 100}" style="background:${ca}"></i></div></div></div>`; }).join('');
    el.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('i[data-w]').forEach(i => i.style.width = i.dataset.w + '%')));
    clearTimeout(showStats.t); showStats.t = setTimeout(() => el.classList.remove('on'), 3300);
  }
  function hideAll() { ['.bug', '.card', '.skip'].forEach(s => q(s).classList.remove('on')); }

  /* ---------------- 3D: ball tracer and spotlight ring ---------------- */
  let TRACE = null;
  const traceMat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.85, blending:THREE.AdditiveBlending, depthWrite:false });
  const RING = new THREE.Mesh(new THREE.RingGeometry(.55, .72, 48), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.75, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
  RING.rotation.x = -Math.PI / 2; RING.position.y = .03; RING.visible = false; RING.renderOrder = 4; scene.add(RING);
  function buildTrace(i0, i1, col) {
    dropTrace();
    const pts = [];
    for (let i = i0; i <= i1; i++) { const b = REC.buf[i].b; const v = new THREE.Vector3(b[0], Math.max(b[1], .06), b[2]); if (!pts.length || pts[pts.length - 1].distanceTo(v) > .05) pts.push(v); }
    if (pts.length < 3) return;
    const segs = Math.min(400, pts.length * 3), geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, .05, 6, false);
    traceMat.color.set(col);
    TRACE = new THREE.Mesh(geo, traceMat); TRACE.frustumCulled = false; TRACE.renderOrder = 4; TRACE.userData = { i0, i1, segs, n:geo.index.count };
    geo.setDrawRange(0, 0); scene.add(TRACE);
  }
  function dropTrace() { if (TRACE) { scene.remove(TRACE); TRACE.geometry.dispose(); TRACE = null; } }
  function updTrace(i) {
    if (!TRACE) return;
    const u = TRACE.userData, k = clamp((i - u.i0) / Math.max(1, u.i1 - u.i0), 0, 1);
    TRACE.geometry.setDrawRange(0, Math.floor(u.segs * k) * 6 * 6);
  }

  /* ---------------- replay director ---------------- */
  const D = { segs:[], s:0, kind:'', sh:null, snap:null, shotI:-1, endT:0 };
  const ANG = { bc:'BROADCAST CAM', pl:'PLAYER CAM', gl:'GOAL CAM', hi:'TACTICAL CAM' };
  function plan(kind, sh, si, endI) {
    const n = REC.buf.length - 1;
    si = si < 0 ? Math.max(0, endI - 25) : si;
    const segs = [];
    if (kind === 'goal') {
      segs.push({ cam:'bc', a:Math.max(0, si - 80), b:Math.min(n, endI + 10), sp:.8 });
      segs.push({ cam:'pl', a:Math.max(0, si - 20), b:Math.min(n, si + 16), sp:.3, slow:true });
      segs.push({ cam:'gl', a:Math.max(0, si - 4), b:Math.min(n, endI + 24), sp:.5 });
    } else {
      segs.push({ cam:'bc', a:Math.max(0, si - 60), b:Math.min(n, endI + 6), sp:.8 });
      segs.push({ cam:Math.random() < .5 ? 'pl' : 'gl', a:Math.max(0, si - 16), b:Math.min(n, endI + 4), sp:.38, slow:true });
    }
    return segs.filter(s => s.b - s.a > 8);
  }
  function snapshot() {
    return { b:{ pos:ball.pos.clone(), vel:ball.vel.clone(), owner:ball.owner, spin:ball.spin, w:ball.w ? Object.assign({}, ball.w) : null, kn:ball.kn, shot:ball.shot, lastTouch:ball.lastTouch, intended:ball.intended },
      p:S.players.map(p => ({ pos:p.pos.clone(), vel:p.vel.clone(), face:p.face, kickAnim:p.kickAnim, slide:p.slide, dive:p.dive, diveDir:p.diveDir, celeb:p.celeb })),
      r:{ pos:ref.pos.clone(), vel:ref.vel.clone(), face:ref.face }, state:S.state, timer:S.timer, cam:camera.position.clone(), look:camLook.clone() };
  }
  function restore(s) {
    Object.assign(ball, { owner:s.b.owner, spin:s.b.spin, w:s.b.w, kn:s.b.kn, shot:s.b.shot, lastTouch:s.b.lastTouch, intended:s.b.intended });
    ball.pos.copy(s.b.pos); ball.vel.copy(s.b.vel);
    S.players.forEach((p, i) => { const o = s.p[i]; if (!o) return; p.pos.copy(o.pos); p.vel.copy(o.vel); p.face = o.face; p.kickAnim = o.kickAnim; p.slide = o.slide; p.dive = o.dive; p.diveDir = o.diveDir; p.celeb = o.celeb; });
    ref.pos.copy(s.r.pos); ref.vel.copy(s.r.vel); ref.face = s.r.face;
    S.state = s.state; S.timer = s.timer; camera.position.copy(s.cam); camLook.copy(s.look);
  }
  function begin(kind, sh, endI) {
    if (REC.buf.length < 60 || (S.net && (kind !== 'goal' || S.net.role === 'guest'))) return false;
    const si = sh ? shotIndex(sh) : -1;
    const segs = plan(kind, sh, si, endI);
    if (!segs.length) return false;
    D.segs = segs; D.s = 0; D.kind = kind; D.sh = sh; D.shotI = si; D.endI = endI;
    D.snap = kind === 'goal' ? null : snapshot(); D.fov = camera.fov;
    if (sh) sh.used = true;
    REP.side = sh ? sh.side : (Math.sign(ball.pos.x) || 1);
    REP.save = { pos:ball.pos.clone() };
    const cols = teamCols(sh ? sh.team : 0);
    sting(cols);
    S.state = 'replay'; REP.on = true; D.wait = .38; D.cardShown = false;
    document.body.classList.add('ktv-on'); $('banner').style.opacity = 0; if (typeof bannerT !== 'undefined') bannerT = 0;
    if (si >= 0) buildTrace(si, Math.min(REC.buf.length - 1, endI + 24), cols[0] === '#ffffff' ? '#ffd23f' : cols[0]);
    startSeg();
    fx('replay', 1);
    return true;
  }
  function startSeg() {
    const g = D.segs[D.s]; REP.start = g.a; REP.end = g.b; REP.i = g.a; REP.speed = g.sp;
    q('.ang').textContent = ANG[g.cam]; q('.spd').textContent = g.slow ? 'SUPER SLOW-MO' : 'ANGLE ' + (D.s + 1) + '/' + D.segs.length;
    D.camInit = true;
    if (D.s > 0) sting(teamCols(D.sh ? D.sh.team : 0));
    D.wait = D.s > 0 ? .3 : D.wait;
  }
  function finish() {
    REP.on = false; dropTrace(); RING.visible = false; hideAll(); document.body.classList.remove('ktv-on'); if (D.fov) { camera.fov = D.fov; camera.updateProjectionMatrix(); }
    sting(teamCols(D.sh ? D.sh.team : 0));
    fx('replay', 0);
    if (D.kind === 'goal') { REC.buf.length = 0; S.state = 'goal'; S.timer = .9; showStats(); }
    else { restore(D.snap); D.snap = null; }
  }

  startReplay = function () {
    S.replayed = true;
    if (SET.replays === 2) return false;
    const goalIdx = REC.buf.length - 1 - Math.round(2.8 * 30);
    const sh = SHOT.last && S.clock - SHOT.last.clock < 6 && shotIndex(SHOT.last) >= 0 ? SHOT.last : null;
    return begin('goal', sh, Math.max(0, goalIdx));
  };
  replayTick = function (dt) {
    if (!REP.on) return;
    const skip = S.localF && (S.localF.p.pass || S.localF.p.shoot || S.localF.p.lob || S.localF.p.through);
    if (skip || D.skip) { D.skip = false; finish(); return; }
    if (D.wait > 0) { D.wait -= dt; if (D.wait <= 0) { q('.bug').classList.add('on'); q('.skip').classList.add('on'); } }
    REP.i += dt * 30 * REP.speed;
    if (REP.i >= REP.end) { if (++D.s >= D.segs.length) { finish(); return; } startSeg(); }
    const i0 = Math.floor(REP.i), k = REP.i - i0;
    applyFrame(REC.buf[i0], k, REC.buf[Math.min(REP.end, i0 + 1)]);
    updTrace(REP.i);
    if (D.sh && !D.cardShown && D.shotI >= 0 && REP.i >= D.shotI + 3 && D.s === 0) { D.cardShown = true; showCard(D.sh, D.kind); }
  };
  const _end = endReplay;
  endReplay = function () { if (REP.on) finish(); else _end(); };

  const tmpV = new THREE.Vector3();
  replayCam = function (dt) {
    const g = D.segs[D.s]; if (!g) return;
    const b = ball.pos, side = REP.side, gx = side * PL;
    const sp = D.sh && S.players[D.sh.pi], prog = (REP.i - g.a) / Math.max(1, g.b - g.a);
    let cam, look, fov = 50;
    if (g.cam === 'bc') { cam = new V3(b.x - side * 6, 9.5, b.z * .35 + 21); look = new V3(b.x + side * 2, .6, b.z * .7); fov = 40; }
    else if (g.cam === 'pl' && sp) {
      const toG = tmpV.set(gx - sp.pos.x, 0, -sp.pos.z).normalize(), orbit = (prog - .5) * 1.1;
      const c = Math.cos(orbit), s = Math.sin(orbit), bx = -toG.x * c + toG.z * s, bz = -toG.x * s - toG.z * c;
      cam = new V3(sp.pos.x + bx * 3.4, 1.35, sp.pos.z + bz * 3.4); look = new V3(sp.pos.x * .6 + b.x * .4, 1, sp.pos.z * .6 + b.z * .4); fov = 42;
      RING.visible = true; RING.position.set(sp.pos.x, .03, sp.pos.z); RING.material.color.set(teamCols(D.sh.team)[0]);
    } else { cam = new V3(gx + side * 1.75, 1.15, clamp(b.z * .2, -1.6, 1.6)); look = new V3(b.x, Math.max(.7, b.y * .7), b.z * .8); fov = 62; RING.visible = false; }   // net cam: inside the goal, looking out through the net
    if (g.cam !== 'pl') RING.visible = false;
    if (D.camInit) { camera.position.copy(cam); camLook.copy(look); D.camInit = false; }
    camera.position.lerp(cam, 1 - Math.exp(-dt * 4)); camLook.lerp(look, 1 - Math.exp(-dt * 7)); camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > .1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  };
  // put the gameplay field of view back after a replay
  const _ub = replayBadge;
  replayBadge = function (on) { _ub(on); const el = $('repBadge'); if (el) el.style.display = 'none'; };
  UI.addEventListener('pointerdown', () => { if (REP.on) D.skip = true; });
  addEventListener('keydown', e => { if (REP.on && !e.repeat && e.code !== 'KeyM') D.skip = true; });
  addEventListener('pointerdown', () => { if (REP.on) D.skip = true; });

  /* ---------------- big-chance replays at the next stoppage ---------------- */
  const _restart = restart;
  restart = function (kind, team, x, z) {
    _restart(kind, team, x, z);
    const sh = SHOT.last;
    if (SET.replays !== 0 || !sh || sh.used || S.net || S.clock - sh.clock > 4.5) return;
    if (kind !== 'goalkick' && kind !== 'corner') return;
    sh.outcome = kind === 'corner' ? 'saved' : 'wide';
    if (!(sh.post || sh.xg >= .14 || (kind === 'corner' && sh.xg >= .08))) return;
    if (S.clock - (D.lastChance || -99) < 25) return;
    D.lastChance = S.clock;
    setTimeout(() => { if (S.state === 'setpiece') begin('chance', sh, REC.buf.length - 1); }, 50);
  };
  // keeper catches a big chance cleanly
  const _step = step;
  step = function (dt) {
    _step(dt);
    const sh = SHOT.last, o = ball.owner;
    if (SET.replays !== 0 || !sh || sh.used || S.net || S.state !== 'play' || !o || o.role !== 'GK' || o.team.i === sh.team) return;
    if (S.clock - sh.clock > 3 || sh.xg < .16 || S.clock - (D.lastChance || -99) < 25) return;
    if (!o.hold || o.hold < .5) return;
    sh.outcome = 'saved'; D.lastChance = S.clock;
    begin('chance', sh, REC.buf.length - 1);
  };
})();
