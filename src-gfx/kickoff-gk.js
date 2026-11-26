/* Kickoff Rivals: goalkeepers dive the right way and keep watching the ball.
   - When a dive starts, the keeper squares up to the ball and dives to the side the shot is heading.
   - His facing is locked for the dive, so running sideways can't twist the dive the wrong way.
   - Outside a dive (including after a missed save) he turns to keep his eyes on the ball. */
(function () {
  if (typeof aiGK !== 'function') return;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // how far a world point is to the keeper's right (local +x of his body)
  const side = (p, wx, wz) => (wx - p.pos.x) * Math.cos(p.face) - (wz - p.pos.z) * Math.sin(p.face);

  const _ai = aiGK;
  aiGK = function (p, dt) {
    const was = p.dive > 0;
    const r = _ai(p, dt);
    if (p.dive > 0 && !was) {
      const s = p.team.side, gx = -PL * s;
      const tt = Math.abs(ball.vel.x) > .5 ? Math.max(0, (gx - ball.pos.x) / ball.vel.x) : 0;
      const pz = ball.pos.z + ball.vel.z * tt;
      // square up to the ball, then dive towards where it crosses the line
      p.face = Math.atan2(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);
      p.diveFace = p.face; p.diveZ = pz;
      p.diveDir = Math.sign(side(p, gx, pz)) || (pz > p.pos.z ? -s : s);
    }
    return r;
  };

  window.gkFace = function (p, dt) {
    if (ball.owner === p || S.frozen === p || p.slide > 0) return false;
    if (p === p.team.ctrl && typeof isHuman === 'function' && isHuman(p.team)) return false;
    if (p.dive > 0 && p.diveFace != null) { p.face = p.diveFace; return true; }
    p.diveFace = null;
    const want = Math.atan2(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);
    p.face += wrap(want - p.face) * Math.min(1, dt * (p.stun > 0 ? 4 : 9));
    return true;
  };
})();
