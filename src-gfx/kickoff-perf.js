/* Kickoff Rivals: smoother frame rate and a better-behaved ball.
   - Dynamic resolution: if the game drops below ~52 fps during a match, the render resolution steps down a little
     (never below 1x), and steps back up when there is headroom. Keeps the game at full speed on any laptop.
   - The game slows down when frames take too long (each frame is capped), so holding 60 fps also keeps the game speed right.
   - Ball sub-steps: a fast ball moves in smaller steps, so it can't skip through a post, the bar or the net.
   - Ball spin you can see: rolling uses true roll-without-slipping, flights use the real spin axis (no double spinning). */
(function () {
  /* ---------------- dynamic resolution ---------------- */
  const PERF = window.PERF = { on: true, pr: null, max: null, min: 1, log: [] };
  let acc = 0, frames = 0, good = 0, lastT = performance.now();
  const _present = present;
  present = function (sc, cam) {
    _present(sc, cam);
    const now = performance.now(), dt = now - lastT; lastT = now;
    if (!PERF.on || document.hidden || dt > 1000) return;
    const inMatch = S.state === 'play' || S.state === 'setpiece' || S.state === 'kickoff' || S.state === 'replay' || S.state === 'goal';
    if (!inMatch) return;
    acc += dt; frames++;
    if (acc < 1500) return;
    const fps = frames * 1000 / acc; acc = 0; frames = 0;
    if (PERF.max == null) { PERF.max = renderer.getPixelRatio(); PERF.pr = PERF.max; }
    let next = PERF.pr;
    if (fps < 52 && PERF.pr > PERF.min) { next = Math.max(PERF.min, PERF.pr - (fps < 40 ? .35 : .2)); good = 0; }
    else if (fps > 58) { if (++good >= 3 && PERF.pr < PERF.max) { next = Math.min(PERF.max, PERF.pr + .15); good = 0; } }
    else good = 0;
    if (Math.abs(next - PERF.pr) > .01) {
      PERF.pr = next; PERF.log.push(fps.toFixed(0) + 'fps→' + next.toFixed(2));
      renderer.setPixelRatio(next); resize(); if (typeof gfxResize === 'function') gfxResize();
    }
  };
  // a new quality setting resets the ceiling
  if (typeof applyQuality === 'function') { const _aq = applyQuality; applyQuality = function (q) { _aq(q); PERF.max = null; PERF.pr = null; good = 0; }; }

  /* ---------------- ball sub-steps ---------------- */
  const _bp = ballPhysics;
  ballPhysics = function (dt) {
    const b = ball;
    if (b.owner || PERF.sub === false) return _bp(dt);
    const sp = b.vel.length(), n = Math.min(4, Math.ceil(sp * dt / .22));
    if (n <= 1) return _bp(dt);
    for (let i = 0; i < n; i++) { _bp(dt / n); if (b.owner) break; }
  };

  /* ---------------- ball spin you can see ---------------- */
  const AX = new THREE.Vector3(), VIS = { x: 0, y: 0, z: 0 };
  window.ballSpinVis = function (dt) {
    if (typeof ballMesh === 'undefined') return;
    const b = ball, v = b.vel, onGround = b.owner || (b.pos.y <= BR + .03 && Math.abs(v.y) < .5);
    let wx, wy, wz;
    if (onGround) { wx = v.z / BR; wy = 0; wz = -v.x / BR; }                         // rolling without slipping: ω = (up × v) / r
    else if (b.w) { wx = b.w.x; wy = b.w.y; wz = b.w.z; }                          // in flight: the real spin vector
    else { const d = Math.pow(.8, dt); wx = VIS.x * d; wy = VIS.y * d; wz = VIS.z * d; }   // keeps the spin it left the boot with
    VIS.x = wx; VIS.y = wy; VIS.z = wz;
    const wl = Math.hypot(wx, wy, wz);
    if (wl > .3) ballMesh.rotateOnWorldAxis(AX.set(wx / wl, wy / wl, wz / wl), Math.min(wl, 45) * dt);
    if (b.kn) ballMesh.rotation.y += .4 * dt;
  };
})();
