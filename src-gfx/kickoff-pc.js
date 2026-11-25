/* Kickoff Rivals: Player Career archetypes and rivalries.
   - Pick one of 13 archetype classes. It levels up with your match ratings and unlocks signature perks
     that change how your player plays (speed, finishing, passing, tackling, heading...).
   - Each season an AI-picked teammate becomes your rival with a goal or rating objective over the next
     few matches. Win the rivalry for personality points and an OVR boost. */
(function () {
  if (typeof pcShow !== 'function') return;
  // each perk: [text, effect, amount]. Effects: spd, shot, pass, tackle, resist, head, rating
  const P_ = (t, k, v) => [t, k, v];
  const ARCH = {
    finisher:{ n:'Finisher', i:'🎯', d:'Lives in the box. Clinical in front of goal.', perks:[P_('Composed: +5% shot power', 'shot', .05), P_('Predator: +12% header power', 'head', .12), P_('Clinical: +6% more shot power', 'shot', .06)] },
    speedster:{ n:'Speedster', i:'⚡', d:'Burns defenders for pace.', perks:[P_('Quick step: +4% speed', 'spd', .04), P_('Rapid: +4% more speed', 'spd', .04), P_('Afterburner: +4% more speed', 'spd', .04)] },
    magician:{ n:'Magician', i:'🪄', d:'Close control and tricks in tight spaces.', perks:[P_('Silky: 15% harder to tackle', 'resist', .15), P_('Press proven: 15% more', 'resist', .15), P_('Quick feet: +3% speed', 'spd', .03)] },
    maestro:{ n:'Maestro', i:'🎼', d:'Runs the game with passing.', perks:[P_('Pinged passes: +6% pass speed', 'pass', .06), P_('Laser: +6% more pass speed', 'pass', .06), P_('Composure: 10% harder to tackle', 'resist', .1)] },
    engine:{ n:'Engine', i:'🔋', d:'Box-to-box. Never stops running.', perks:[P_('Relentless: +3% speed', 'spd', .03), P_('Ball winner: +15% tackle success', 'tackle', .15), P_('Everywhere: +3% more speed', 'spd', .03)] },
    wall:{ n:'The Wall', i:'🧱', d:'Nobody gets past.', perks:[P_('Anticipate: +15% tackle success', 'tackle', .15), P_('Aerial: +12% header power', 'head', .12), P_('Bruiser: +15% more tackle success', 'tackle', .15)] },
    playmaker:{ n:'Playmaker', i:'🧠', d:'Creates chances from deep.', perks:[P_('Vision: +6% pass speed', 'pass', .06), P_('Press resistant: 10% harder to tackle', 'resist', .1), P_('Maestro touch: +6% more pass speed', 'pass', .06)] },
    target:{ n:'Target Man', i:'🗼', d:'Strong in the air, holds the ball up.', perks:[P_('Hold-up: 15% harder to tackle', 'resist', .15), P_('Air raid: +15% header power', 'head', .15), P_('Power: +5% shot power', 'shot', .05)] },
    wing:{ n:'Wing Wizard', i:'🌪', d:'Beats men on the outside and delivers.', perks:[P_('Quick feet: +4% speed', 'spd', .04), P_('Whipped: +6% pass speed', 'pass', .06), P_('Elusive: 10% harder to tackle', 'resist', .1)] },
    rocket:{ n:'Rocket', i:'🚀', d:'Shoots from anywhere.', perks:[P_('Power: +6% shot power', 'shot', .06), P_('Thunder: +6% more shot power', 'shot', .06), P_('Strong: 10% harder to tackle', 'resist', .1)] },
    captain:{ n:'Captain', i:'©', d:'Leads by example.', perks:[P_('Leader: +0.3 rating every match', 'rating', .3), P_('Commanding: +10% tackle success', 'tackle', .1), P_('Inspire: +0.3 more rating', 'rating', .3)] },
    anchor:{ n:'Anchor', i:'⚓', d:'Shields the defence, breaks up play.', perks:[P_('Interceptor: +15% tackle success', 'tackle', .15), P_('Calm: 10% harder to tackle', 'resist', .1), P_('Ball winner: +15% more tackle success', 'tackle', .15)] },
    sweeper:{ n:'Sweeper', i:'🧹', d:'Covers everything behind the line.', perks:[P_('Recovery pace: +4% speed', 'spd', .04), P_('Last man: +15% tackle success', 'tackle', .15), P_('Clearance: +15% header power', 'head', .15)] }
  };
  const eff = (k) => { if (!PC || !PC.arch) return 0; const on = perksOn(); return ARCH[PC.arch].perks.reduce((a, pk, i) => a + (on[i] && pk[1] === k ? pk[2] : 0), 0); };
  const effP = (p, k) => p && p.perks ? p.perks.e[k] || 0 : 0;
  const XP_LVL = [0, 3, 7, 12, 18, 25, 33];
  const lvl = () => { let l = 0; for (let i = 0; i < XP_LVL.length; i++) if ((PC.ax || 0) >= XP_LVL[i]) l = i; return l; };
  const perksOn = () => { const l = lvl(); return [l >= 1, l >= 3, l >= 5]; };

  /* ---------------- perks in matches ---------------- */
  const _start = startMatch;
  startMatch = function (cfg) {
    const r = _start(cfg);
    try {
      if (!PC || !PC.arch || !cfg || !/Player Career/.test(cfg.label || '')) return r;
      const me = S.players.find(p => p.name === PC.name); if (!me) return r;
      const e = {}; for (const k of ['spd', 'shot', 'pass', 'tackle', 'resist', 'head']) e[k] = eff(k);
      me.spd *= 1 + e.spd; me.perks = { a:PC.arch, e };
    } catch (err) {}
    return r;
  };
  const _tt = tryTackle;
  tryTackle = function (p, chance) {
    const o = ball.owner;
    chance *= 1 + effP(p, 'tackle');
    if (o && o.team !== p.team) chance *= 1 - effP(o, 'resist');
    return _tt(p, chance);
  };
  const _kb = kickBall;
  kickBall = function (p, v) {
    if (p && p.perks) {
      const toGoal = Math.sign(v.x) === p.team.side && Math.abs(v.x) > 12;
      if (ball.owner === p) v.multiplyScalar(1 + (toGoal && v.length() > 15 ? effP(p, 'shot') : effP(p, 'pass')));
      else if (ball.pos.y > 1) v.multiplyScalar(1 + effP(p, 'head'));
    }
    _kb(p, v);
  };

  /* ---------------- rating, XP and rivalries ---------------- */
  const RIVAL_GOALS = { ST:1, LW:.7, RW:.7, CAM:.6, CM:.35, CDM:.15, LB:.1, RB:.1, CB:.08 };
  function newRival() {
    const club = ALL[PC.club], sq = autoSquad(club).map((q, i) => Object.assign({ pos:SLOT_POS[i] }, q)).filter(q => q.name !== PC.name);
    const near = sq.filter(q => q.pos && (q.pos === PC.pos || (/W|ST|CAM/.test(PC.pos) && /W|ST|CAM/.test(q.pos)) || (/CB|B$|CDM/.test(PC.pos) && /CB|B$|CDM/.test(q.pos))));
    const r = (near.length ? near : sq)[(Math.random() * (near.length || sq.length)) | 0];
    if (!r) return null;
    const goals = /ST|W|CAM/.test(PC.pos);
    return { name:r.name, pos:r.pos || 'CM', ovr:r.ovr || 75, kind:goals ? 'goals' : 'rating', left:5, me:0, them:0, total:5 };
  }
  const _after = pcAfter;
  pcAfter = function (hs, as, myGoals, myIdx) {
    const msg = _after(hs, as, myGoals, myIdx);
    const S2 = PC.season, rating = S2.ratings[S2.ratings.length - 1] || 6;
    if (PC.arch) {
      const l0 = lvl(); PC.ax = (PC.ax || 0) + Math.max(.5, (rating + eff('rating') - 5.5));
      if (lvl() > l0) setTimeout(() => toastMsg(`${ARCH[PC.arch].i} ${ARCH[PC.arch].n} level ${lvl()}!${[1, 3, 5].includes(lvl()) ? ' New perk unlocked' : ''}`), 1400);
    }
    if (!PC.rival && S2.round < S2.rounds.length - 2) PC.rival = newRival();
    const R = PC.rival;
    if (R && R.left > 0) {
      R.left--;
      if (R.kind === 'goals') { R.me += myGoals; R.them += poisson((RIVAL_GOALS[R.pos] || .3) * (R.ovr / 85)); }
      else { R.me += rating; R.them += clamp(6.4 + (R.ovr - 75) * .04 + rnd(-.9, .9), 5, 9.5); }
      if (R.left === 0) {
        const won = R.me > R.them;
        PC.personality = (PC.personality || 0) + (won ? 3 : 1);
        if (won) PC.ovr = Math.min(MAX_OVR, PC.ovr + .6);
        PC.rivalHist = (PC.rivalHist || []).concat([{ name:R.name, won }]).slice(-6);
        setTimeout(() => toastMsg(won ? `🏆 You won the rivalry with ${R.name}! +3 personality, +0.6 OVR` : `${R.name} won the rivalry this time. +1 personality`), 2600);
        PC.rival = null;
      }
    }
    savePC();
    return msg;
  };

  /* ---------------- screens ---------------- */
  const css = document.createElement('style');
  css.textContent = `.pcx{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:700px){.pcx{grid-template-columns:1fr}}
  .pcx>div{background:rgba(255,255,255,.05);border-radius:12px;padding:12px 14px}.pcx h4{margin:0 0 6px;font-size:12px;letter-spacing:2px;opacity:.75}
  .pcx .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin:6px 0}.pcx .bar i{display:block;height:100%;background:linear-gradient(90deg,#2f80ed,#ffd23f)}
  .pcx .pk{font-size:12px;margin:3px 0}.pcx .pk.off{opacity:.35}.arch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px}
  .arch-grid button{text-align:left;padding:10px;line-height:1.3;white-space:normal}.arch-grid button b{display:block;font-size:15px}`;
  document.head.appendChild(css);
  const _show = pcShow;
  pcShow = function () {
    _show();
    if (!PC || PC.offers || !PC.season) return;
    const card = $('hub').querySelector('.card'); if (!card) return;
    const host = document.createElement('div'); host.className = 'pcx';
    if (!PC.arch) {
      host.style.display = 'block';
      host.innerHTML = `<div><h4>CHOOSE YOUR ARCHETYPE</h4><div class="mini">Your class levels up with your match ratings and unlocks three signature perks.</div><div class="arch-grid">${Object.entries(ARCH).map(([k, a]) => `<button type="button" data-arch="${k}"><b>${a.i} ${a.n}</b><span class="mini">${a.d}</span></button>`).join('')}</div></div>`;
    } else {
      const a = ARCH[PC.arch], l = lvl(), on = perksOn(), next = XP_LVL[l + 1], R = PC.rival;
      host.innerHTML = `<div><h4>ARCHETYPE</h4><b style="font-size:18px">${a.i} ${a.n}</b> <span class="mini">· level ${l}</span><div class="bar"><i style="width:${next ? Math.round(((PC.ax || 0) - XP_LVL[l]) / (next - XP_LVL[l]) * 100) : 100}%"></i></div>
        ${a.perks.map((p, i) => `<div class="pk ${on[i] ? '' : 'off'}">${on[i] ? '✅' : '🔒'} ${p[0]} <span class="mini">${on[i] ? '' : '(level ' + [1, 3, 5][i] + ')'}</span></div>`).join('')}</div>
        <div><h4>TEAMMATE RIVALRY</h4>${R ? `<b>vs ${esc(R.name)}</b> <span class="mini">${R.pos}</span><div class="mini" style="margin:4px 0">${R.kind === 'goals' ? 'Score more goals' : 'Get a higher total match rating'} over ${R.total} matches · ${R.left} left</div>
          <div style="display:flex;justify-content:space-between;font-weight:900;font-size:20px"><span>You ${R.kind === 'goals' ? R.me : R.me.toFixed(1)}</span><span style="opacity:.7">${R.kind === 'goals' ? R.them : R.them.toFixed(1)} ${esc(shortName(R.name))}</span></div>`
          : '<div class="mini">A new rival is picked after your next match.</div>'}
          <div class="mini" style="margin-top:6px">Personality points <b>${PC.personality || 0}</b>${(PC.rivalHist || []).length ? ' · ' + PC.rivalHist.map(h => (h.won ? '✅ ' : '❌ ') + esc(shortName(h.name))).join(' ') : ''}</div></div>`;
    }
    card.appendChild(host);
  };
  $('hub').addEventListener('click', e => {
    const b = e.target.closest('[data-arch]'); if (!b || !PC) return;
    PC.arch = b.dataset.arch; PC.ax = 0; savePC(); toastMsg(`You are now a ${ARCH[PC.arch].n}`); pcShow();
  });
})();
