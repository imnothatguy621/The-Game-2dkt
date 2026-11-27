/* Kickoff Rivals: tracking cameras.
   The match camera now follows the play instead of just the ball: it leads into space in the direction the
   ball is moving, keeps your controlled player in shot, zooms in when the ball is near a box and pulls out on
   long balls, and stays steady when the ball is played across the pitch.
   Styles (🎥 button or the C key): Broadcast, Tele Broadcast, Dynamic, Player Cam (behind your player).
   Replays sometimes add a BODYCAM angle seen through the scorer's or the keeper's eyes (handled in the replay module). */
(function () {
  if (typeof updateCamera !== 'function') return;
  const STYLES = ['BROADCAST', 'TELE BROADCAST', 'DYNAMIC', 'PLAYER CAM'];
  if (SET.camStyle == null) SET.camStyle = 0;
  S.cam = SET.camStyle;
  const tgt = new THREE.Vector3(), look = new THREE.Vector3(), lead = new THREE.Vector3(), focus = new THREE.Vector3();
  let fovNow = camera.fov, init = true, pcFace = 0;
  function attackDir() { const me = S.teams[S.me]; return me ? me.side : 1; }
  function track(dt) {
    const b = ball.pos, v = ball.vel, me = S.teams[S.me], ctrl = me && me.ctrl;
    // lead the ball: where it is going, damped so long balls don't whip the camera
    const sp = Math.hypot(v.x, v.z), leadT = clamp(sp / 30, 0, .9);
    lead.set(clamp(v.x * leadT, -12, 12), 0, clamp(v.z * leadT * .6, -6, 6));
    if (ball.owner) lead.x += ball.owner.team.side * 4;           // show the space in front of the man on the ball
    focus.set(b.x + lead.x, 0, b.z + lead.z);
    // keep your player in shot: pull the focus a little towards him when he's far from the ball
    if (ctrl && ctrl !== ball.owner) { const dx = ctrl.pos.x - b.x, dz = ctrl.pos.z - b.z, d = Math.hypot(dx, dz); if (d > 6 && d < 40) { const k = .18 * clamp((d - 6) / 20, 0, 1); focus.x += dx * k; focus.z += dz * k; } }
    focus.x = clamp(focus.x, -PL + 5, PL - 5); focus.z = clamp(focus.z, -PW + 3, PW - 3);
    const nearBox = clamp((Math.abs(focus.x) - (PL - 26)) / 14, 0, 1);       // 0 in midfield, 1 at the box
    const st = S.cam % 4;
    let fov = 50;
    if (st === 0) { tgt.set(focus.x * .95, 17 - nearBox * 2.5, focus.z * .4 + 40 - nearBox * 4); look.set(focus.x * .97, 0, focus.z * .6 - 1); fov = 26 - nearBox * 2 + Math.min(4, sp * .1); }   // real TV: far away on a long lens, so players look big and the pitch isn't stretched
    else if (st === 1) { tgt.set(focus.x * .92, 26, focus.z * .3 + 52); look.set(focus.x * .95, 0, focus.z * .5 - 2); fov = 34 - nearBox * 3; }
    else if (st === 2) {
      const ad = attackDir();
      tgt.set(focus.x - ad * 7, 8 - nearBox * 1.5, focus.z * .6 + 17); look.set(focus.x + ad * 3, .5, focus.z * .7);
      fov = 44 - nearBox * 5;
    } else {
      // behind your player, facing the way your team attacks, swinging a little with his movement
      const p = ctrl || ball.owner; if (!p) return false;
      const ad = attackDir(), want = Math.atan2(ad * .9 + p.vel.x * .04, p.vel.z * .05);
      let d = want - pcFace; d = Math.atan2(Math.sin(d), Math.cos(d)); pcFace += d * Math.min(1, dt * 2.5);
      const fx = Math.sin(pcFace), fz = Math.cos(pcFace);
      tgt.set(p.pos.x - fx * 9, 4.2, p.pos.z - fz * 9); look.set(p.pos.x + fx * 8 + (b.x - p.pos.x) * .35, 1, p.pos.z + fz * 8 + (b.z - p.pos.z) * .35);
      fov = 50;
    }
    if (camera.aspect < 1.3) fov *= 1.3;          // portrait / narrow screens see a bit more
    if (init) { camera.position.copy(tgt); camLook.copy(look); init = false; }
    const kp = 1 - Math.exp(-dt * (st === 3 ? 4 : 2.4)), kl = 1 - Math.exp(-dt * (st === 3 ? 6 : 3.6));
    camera.position.lerp(tgt, kp); camLook.lerp(look, kl); camera.lookAt(camLook);
    fovNow += (fov - fovNow) * Math.min(1, dt * 1.5);
    if (Math.abs(camera.fov - fovNow) > .05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
    if (typeof sun !== 'undefined') sun.target.position.set(camLook.x * .3, 0, 0);
    return true;
  }
  const _cam = updateCamera;
  updateCamera = function (dt) {
    const special = S.state === 'replay' || S.state === 'goal' || S.state === 'menu' || (window.CEL && CEL.on) || S.cP2 || (window.STREET && STREET.street);
    if (special || !track(dt)) { if (!special) init = true; _cam(dt); return; }
  };
  // reset the field of view when another camera (replays, celebrations) took over
  let lastSpecial = false;
  setInterval(() => { const sp = S.state === 'replay' || S.state === 'goal'; if (lastSpecial && !sp) fovNow = camera.fov; lastSpecial = sp; }, 200);
  function setStyle(i) { S.cam = SET.camStyle = ((i % 4) + 4) % 4; saveSet(); toastMsg('🎥 ' + STYLES[S.cam]); }
  $('camBtn').onclick = () => setStyle(S.cam + 1);
  addEventListener('keydown', e => { if (e.code === 'KeyC' && !e.repeat && !(e.target && e.target.tagName === 'INPUT') && S.state !== 'menu') setStyle(S.cam + 1); });
  const _start = startMatch;
  startMatch = function (cfg) { const r = _start(cfg); S.cam = SET.camStyle; init = true; return r; };
  // settings row
  const _ss = showSettings;
  showSettings = function () {
    _ss();
    const card = $('settings').querySelector('.card'), rows = card && card.querySelectorAll('.row'); if (!rows || !rows.length) return;
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<span class="lab">CAMERA</span>' + STYLES.map((n, i) => `<button type="button" class="${i === SET.camStyle ? 'sel' : ''}" data-camst="${i}">${n[0] + n.slice(1).toLowerCase()}</button>`).join('');
    rows[2] ? rows[2].after(row) : rows[rows.length - 1].after(row);
  };
  $('settings').addEventListener('click', e => { const b = e.target.closest('button[data-camst]'); if (!b) return; SET.camStyle = +b.dataset.camst; S.cam = SET.camStyle; saveSet(); showSettings(); });
})();
