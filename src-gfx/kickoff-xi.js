/* Kickoff Rivals: a proper "Auto pick best XI".
   The old picker filled slots one at a time (striker first), so a top centre-back could be wasted up front,
   and empty slots were filled with whoever came first in the list. This one solves the whole team at once
   (Hungarian algorithm) to get the highest possible team rating, i.e. the best sum of rating + position fit. */
(function () {
  if (typeof bestXI !== 'function' || typeof SLOT_POS === 'undefined') return;

  // n rows (slots) <= m cols (players); maximises total score. Classic O(n^2 m) Hungarian.
  function assign(score, n, m) {
    const INF = 1e18, u = new Float64Array(n + 1), v = new Float64Array(m + 1), p = new Int32Array(m + 1), way = new Int32Array(m + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0; const minv = new Float64Array(m + 1).fill(INF), used = new Uint8Array(m + 1);
      do {
        used[j0] = 1; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = -score[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const res = new Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
    return res;
  }
  // what a player is worth in a slot (the same number the team rating uses), with a tiny nudge towards natural positions
  const val = (pl, slot) => pl.ovr + posFit(pl.pos, SLOT_POS[slot]) + (pl.pos === SLOT_POS[slot] ? 1.5 : 0);

  bestXI = function (pool) {
    const players = (pool || []).filter(Boolean), xi = [];
    if (!players.length) return xi;
    const n = SLOT_POS.length;
    // pad with dummies so there are always at least as many columns as slots
    const m = Math.max(players.length, n), score = [];
    for (let s = 0; s < n; s++) { const row = []; for (let j = 0; j < m; j++) row.push(j < players.length ? val(players[j], s) : -500); score.push(row); }
    const res = assign(score, n, m);
    for (let s = 0; s < n; s++) { const j = res[s]; if (j >= 0 && j < players.length && score[s][j] > 50) xi[s] = players[j]; }
    return xi;
  };

  autoXI = function (state) {
    const fit = state.players.filter(p => !(p.inj > 0) && !p.loanedTo);          // injured or loaned-out players don't start
    const avail = fit.length >= 11 ? fit : state.players;
    const pool = avail.map(p => Object.assign({}, p, { id: p.uid }));
    const xi = bestXI(pool), used = new Set(xi.filter(Boolean).map(p => p.uid));
    state.xi = SLOT_POS.map((pos, i) => {
      if (xi[i]) return xi[i].uid;
      // a slot nobody fits well: still use the best remaining player for it
      let best = null, bs = -1e9;
      for (const p of avail) { if (used.has(p.uid)) continue; const v = val(p, i); if (v > bs) { bs = v; best = p; } }
      if (best) { used.add(best.uid); return best.uid; }
      return state.xi && state.xi[i];
    });
  };
})();
