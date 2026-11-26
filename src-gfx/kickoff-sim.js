/* Kickoff Rivals: a proper match simulator, plus the "play at your own risk" disclaimer.
   How the big simulators work, and what this copies:
   - Each team gets separate ATTACK and DEFENCE strengths (from its forwards/midfield and defence/keeper),
     instead of one overall number.
   - Attack vs the other side's defence gives each team's expected goals (xG); goals follow a Poisson model.
   - The match is played out minute by minute as a series of chances, each with its own xG, so you get real
     scorers, minutes and shot counts.
   - Score effects: a team that is behind pushes forward (more chances), a team ahead sits deeper.
   - A small home advantage.
   Used for every "Simulate" button (Road to Success, careers, leagues, cups, events, tournaments).
   Road to Success also gets: your difficulty setting for played matches, a comeback assist after defeats
   (next opponent a bit weaker), and a win-chance preview. */
(function () {
  if (typeof simScore !== 'function') return;
  const AVG = 1.35, K = .045, HOME = .12;
  const LINES = { GK:0, DEF:[1, 2, 3, 4], MID:[5, 6, 7], ATT:[8, 9, 10] };
  // squad (11 entries with ovr, slot order = formation) → attack / defence strength
  function strengths(sq, ovr) {
    if (!sq || sq.length < 11) return { att:ovr, def:ovr, names:null };
    const o = i => (sq[i] && sq[i].ovr) || ovr, avg = a => a.reduce((s, i) => s + o(i), 0) / a.length;
    return { att:avg(LINES.ATT) * .6 + avg(LINES.MID) * .4, def:avg(LINES.DEF) * .55 + o(0) * .25 + avg(LINES.MID) * .2, names:sq.map(p => p && p.name) };
  }
  function pickScorer(sq) {
    if (!sq) return null;
    const w = [0, .3, .3, .5, .5, 1.1, 1.3, 1.1, 2.4, 3.2, 2.4], tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; for (let i = 0; i < 11; i++) { r -= w[i]; if (r <= 0) return sq[i] && sq[i].name; }
    return sq[9] && sq[9].name;
  }
  // the engine
  window.simMatch = function (A, B, opt) {
    opt = opt || {};
    const sa = strengths(A.sq, A.ovr), sb = strengths(B.sq, B.ovr);
    let xgA = AVG * Math.exp(K * (sa.att - sb.def)) * (opt.neutral ? 1 : Math.exp(HOME / 2)), xgB = AVG * Math.exp(K * (sb.att - sa.def)) * (opt.neutral ? 1 : Math.exp(-HOME / 2));
    xgA = clamp(xgA, .15, 5.5); xgB = clamp(xgB, .15, 5.5);
    const r = { hs:0, as:0, xgA:0, xgB:0, shA:0, shB:0, ev:[] };
    // about 12 chances per team per 90 at average strength; each chance's quality is drawn so the totals match xG
    for (let m = 1; m <= 90; m++) {
      const diff = r.hs - r.as, pushA = diff < 0 ? 1.18 : diff > 0 ? .88 : 1, pushB = diff > 0 ? 1.18 : diff < 0 ? .88 : 1;
      for (const [side, xg, push] of [[0, xgA, pushA], [1, xgB, pushB]]) {
        const chances = xg / .11;                                 // average chance ≈ 0.11 xG
        if (Math.random() < chances / 90 * push) {
          const q = clamp(-Math.log(1 - Math.random()) * .11, .02, .85);
          if (side === 0) { r.shA++; r.xgA += q; } else { r.shB++; r.xgB += q; }
          if (Math.random() < q) {
            if (side === 0) r.hs++; else r.as++;
            r.ev.push({ m, side, who:pickScorer(side === 0 ? A.sq : B.sq), xg:q });
          }
        }
      }
    }
    r.poss = Math.round(clamp(50 + (sa.att + sa.def - sb.att - sb.def) * .35, 30, 70));
    return r;
  };
  window.winChance = function (A, B, opt) { let w = 0, d = 0; for (let i = 0; i < 400; i++) { const r = simMatch(A, B, opt); if (r.hs > r.as) w++; else if (r.hs === r.as) d++; } return { w:w / 400, d:d / 400, l:1 - (w + d) / 400 }; };
  const squadOf = id => { try { return id && ALL[id] ? autoSquad(ALL[id]) : null; } catch (e) { return null; } };
  simScore = function (a, b) { const r = simMatch({ ovr:ALL[a].ovr, sq:squadOf(a) }, { ovr:ALL[b].ovr, sq:squadOf(b) }); return [r.hs, r.as]; };

  /* ---------------- watching a simulation: it takes a few seconds and can't be spammed ---------------- */
  let LOCK = false;
  window.SIMLOCK = () => LOCK;
  function watch(title, A, B, r, done) {
    const box = document.getElementById('mcx'); if (!box) { done(); return; }
    LOCK = true;
    box.innerHTML = `<div class="box"><h3>${esc(title)}</h3><div style="display:flex;justify-content:space-between;align-items:center;font:900 italic 30px 'Segoe UI',system-ui;margin:8px 0"><span>${esc(A.code)}</span><span id="simSc">0 - 0</span><span>${esc(B.code)}</span></div>
      <div style="height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden"><i id="simBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#2f80ed,#ffd23f)"></i></div><div class="mini" id="simMin" style="margin-top:6px">0'</div><div id="simEv" class="mcx-list"></div></div>`;
    box.classList.add('on');
    const t0 = performance.now(), DUR = 3200; let shown = 0;
    (function tick() {
      const k = Math.min(1, (performance.now() - t0) / DUR), m = Math.round(k * 90);
      const bar = document.getElementById('simBar');
      if (bar) { bar.style.width = k * 100 + '%'; document.getElementById('simMin').textContent = m + "'"; }
      while (bar && shown < r.ev.length && r.ev[shown].m <= m) { const e = r.ev[shown++]; document.getElementById('simEv').insertAdjacentHTML('beforeend', `<div class="mcx-row" style="justify-content:${e.side ? 'flex-end' : 'flex-start'}"><b>${e.m}'</b> ⚽ ${esc(e.who || '')}</div>`); const hs = r.ev.slice(0, shown).filter(x => !x.side).length; document.getElementById('simSc').textContent = `${hs} - ${shown - hs}`; }
      if (k < 1) requestAnimationFrame(tick); else { LOCK = false; done(); }
    })();
  }
  // block double taps on every other Simulate button too
  let lastSim = 0;
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (LOCK) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    // any other Simulate button (events, Player Career, tournaments): at most one every 3 seconds
    if (/simulat/i.test(b.textContent) || b.dataset.r === 'sim') { const now = performance.now(); if (now - lastSim < 3000) { e.stopImmediatePropagation(); e.preventDefault(); toastMsg('Slow down: one simulation at a time'); return; } lastSim = now; }
  }, true);

  /* ---------------- match report ---------------- */
  function report(title, A, B, r) {
    const box = document.getElementById('mcx'); if (!box) return;
    const ev = r.ev.map(e => `<div class="mcx-row" style="justify-content:${e.side ? 'flex-end' : 'flex-start'}"><b>${e.m}'</b> ⚽ ${esc(e.who || '')} <span class="mini">(${e.xg.toFixed(2)} xG)</span></div>`).join('') || '<p class="mini">No goals.</p>';
    box.innerHTML = `<div class="box"><h3>${esc(title)}</h3>
      <div style="display:flex;justify-content:space-between;align-items:center;font:900 italic 30px 'Segoe UI',system-ui;margin:8px 0"><span>${esc(A.code)}</span><span>${r.hs} - ${r.as}</span><span>${esc(B.code)}</span></div>
      <div class="mcx-list">${ev}</div>
      <div class="res" style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center"><span>xG <b>${r.xgA.toFixed(1)} - ${r.xgB.toFixed(1)}</b></span><span>Shots <b>${r.shA} - ${r.shB}</b></span><span>Possession <b>${r.poss}% - ${100 - r.poss}%</b></span></div>
      <div class="cta" style="margin-top:12px"><button class="big" type="button" data-close>OK</button></div></div>`;
    box.classList.add('on');
  }

  /* ---------------- Road to Success ---------------- */
  const _rp = rtsPlay;
  rtsPlay = function (sim) {
    const me = rtsDef(), oppSq = rtsOpponent();
    const assist = Math.min(10, (RTS.slump || 0) * 4);
    if (assist) { oppSq.forEach(p => p.ovr = Math.max(45, p.ovr - assist)); ALL['rts-opp'].ovr -= assist; }
    if (sim) {
      if (LOCK) return;
      const A = { ovr:xiOvr(RTS), sq:xiSquad(RTS), code:me.code }, B = { ovr:ALL['rts-opp'].ovr, sq:oppSq, code:ALL['rts-opp'].code };
      const r = simMatch(A, B);
      watch(`Simulating · ${DIVS[RTS.div]}`, A, B, r, () => {
        const c0 = PROFILE.coins, m = rtsResult(r.hs, r.as), gain = PROFILE.coins - c0;
        const cut = Math.floor(gain / 2); PROFILE.coins -= cut; saveRTS();           // simulated matches pay half
        rtsShow('home'); report(`Simulated · ${DIVS[RTS.div]}`, A, B, r); setTimeout(() => toastMsg(m.replace(/\+[\d,]+ coins/, `+${fmt(gain - cut)} coins (half for simulating)`)), 50);
      });
      return;
    }
    CUR_MATCH = { kind:'custom', done:res => { const m = rtsResult(res.hs, res.as); rtsShow('home'); setTimeout(() => toastMsg(m), 50); }, quit:() => rtsShow('home') };
    startMatch({ home:'rts-me', away:'rts-opp', ctl:['local', 'ai'], me:0, op:[false, false], diff:SET.diff, len:LENS[SET.len].s, squads:[xiSquad(RTS), oppSq], label:`Road to Success · ${DIVS[RTS.div]}` });
  };
  // comeback assist: each defeat makes the next opponent 4 OVR weaker (up to 10), a win resets it
  const _res = rtsResult;
  rtsResult = function (hs, as) { if (hs > as) RTS.slump = 0; else if (hs < as) RTS.slump = Math.min(3, (RTS.slump || 0) + 1); return _res(hs, as); };
  // win-chance preview on the Road to Success season screen
  const _show = rtsShow;
  rtsShow = function (tab) {
    _show(tab);
    try {
      if (!RTS || RTS.tab !== 'home') return;
      const card = $('hub').querySelector('.card'), tier = card && card.querySelector('.tier'); if (!tier) return;
      const mine = xiOvr(RTS), opp = Math.round(divOvr(RTS.div)) - Math.min(10, (RTS.slump || 0) * 4), sq = xiSquad(RTS);
      const wc = winChance({ ovr:mine, sq }, { ovr:opp, sq:null });
      tier.insertAdjacentHTML('beforeend', `<div class="mini" style="margin-top:6px">Your XI <b>${mine}</b> vs about <b>${opp}</b>${RTS.slump ? ` <span style="color:#7ee787">(comeback assist −${Math.min(10, RTS.slump * 4)})</span>` : ''} · Simulated win chance <b>${Math.round(wc.w * 100)}%</b>, draw ${Math.round(wc.d * 100)}%</div>`);
    } catch (e) {}
  };

  /* ---------------- careers use the same engine ---------------- */
  const _mp = mcPlay;
  mcPlay = function (sim) {
    if (!sim) return _mp(sim);
    const S2 = MC.season, fxm = S2.rounds[S2.round].find(f => f.includes(MC.club)), myIdx = fxm[0] === MC.club ? 0 : 1, oid = fxm[1 - myIdx];
    const mine = { ovr:xiOvr(MC), sq:xiSquad(MC), code:ALL[MC.club].code }, them = { ovr:ALL[oid].ovr, sq:squadOf(oid), code:ALL[oid].code };
    if (LOCK) return;
    const r = myIdx === 0 ? simMatch(mine, them) : simMatch(them, mine), H = myIdx === 0 ? mine : them, Aw = myIdx === 0 ? them : mine;
    watch(`Simulating · Matchday ${S2.round + 1}`, H, Aw, r, () => { mcAfter(r.hs, r.as); mcShow('home'); report('Full time', H, Aw, r); });
  };

  /* ---------------- disclaimer + terms ---------------- */
  const DISC = '⚠️ <b>Play at your own risk.</b> If you get caught playing (in class, at school, at work or past bedtime), the creator is <b>not responsible</b>. The game may also have bugs or lose progress. By playing you agree to the <a href="#" id="tosLink">Terms &amp; Conditions</a>.';
  const TOS = [
    ['1. Getting caught', 'If you play Kickoff Rivals somewhere you are not supposed to (in class, at school, at work, during homework time or after bedtime) and you get caught, that is on you. The creator is not responsible for detentions, confiscated devices, grounding, lost screen time or anything else that happens.'],
    ['2. Bugs and saves', 'The game is a work in progress. It can have bugs and glitches, and saved progress (coins, cards, clubs, careers) is stored in your browser and can be lost if you clear your browser data or switch devices. The creator is not responsible for lost progress.'],
    ['3. No real money', 'Coins, packs and cards in the game are fake and have no real-world value. They cannot be bought, sold or exchanged for real money.'],
    ['4. Play fair online', 'Be respectful in online and social features. No cheating, spamming, abusive names or messages. The creator can reset or remove accounts that break this.'],
    ['5. Admin code', 'The admin code is for the creator and testers. Using it on a shared or online save is at your own risk.'],
    ['6. Not official', 'Kickoff Rivals is a fan-made game. It is not affiliated with or endorsed by EA Sports, FIFA, any league, club or player. All players, teams and names are made up.'],
    ['7. Credits', 'Ball physics inspired by Johan Forslund\'s football-physics project and the Physics World article on the physics of football. Built with three.js.'],
    ['8. Take breaks', 'Look after yourself: take breaks, rest your eyes and do not let the game get in the way of school, sleep or friends.'],
    ['9. Changes', 'These terms can change as the game is updated. Playing the game means you accept the latest version.']
  ];
  function showTOS() {
    const box = document.getElementById('mcx'); if (!box) return;
    box.innerHTML = `<div class="box" style="max-width:560px"><h3>📜 Terms &amp; Conditions</h3><p class="mini">Last updated: November 2026</p>
      <div style="max-height:55vh;overflow:auto;text-align:left;font-size:13px;line-height:1.5;padding-right:4px">${TOS.map(([h, t]) => `<p style="margin:10px 0 2px"><b>${h}</b></p><p style="margin:0;opacity:.85">${t}</p>`).join('')}</div>
      <div class="cta" style="margin-top:12px"><button class="big" type="button" id="tosOk">I agree</button></div></div>`;
    box.classList.add('on');
    document.getElementById('tosOk').onclick = () => { try { localStorage.setItem('kr_tos', '1'); } catch (e) {} box.classList.remove('on'); };
  }
  window.showTOS = showTOS;
  document.addEventListener('click', e => { if (e.target && e.target.id === 'tosLink') { e.preventDefault(); showTOS(); } });
  const dcss = document.createElement('style');
  dcss.textContent = '#discl{max-width:640px;margin:12px auto 0;font-size:11px;line-height:1.5;opacity:.7;text-align:center}#discl a{color:#ffd23f}';
  document.head.appendChild(dcss);
  const put = card => { if (!card) return; const o = card.querySelector('#discl'); if (o) o.remove(); card.insertAdjacentHTML('beforeend', `<p id="discl">${DISC}</p>`); };
  const _home = showHome;
  showHome = function () { _home(); put($('home') && $('home').querySelector('.card')); };
  const _ss = showSettings;
  showSettings = function () { _ss(); put($('settings').querySelector('.card')); };
  let agreed = false; try { agreed = localStorage.getItem('kr_tos') === '1'; } catch (e) {}
  if (!agreed) { const tryTOS = () => { const b = document.getElementById('mcx'); if (b && !b.classList.contains('on') && S.state === 'menu') showTOS(); else setTimeout(tryTOS, 2000); }; setTimeout(tryTOS, 1500); }
  try { if (S.state === 'menu' && $('home') && !$('home').classList.contains('hide')) showHome(); } catch (e) {}
})();
