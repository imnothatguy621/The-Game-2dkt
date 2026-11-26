/* Kickoff Rivals: Road to Success upgrades.
   - EVOLUTIONS: upgrade paths for eligible players. Preview every step and the finished card before you
     commit. Steps are completed by playing, winning and scoring; the last step lets you pick 1 of 3 PlayStyle+.
   - PLAYSTYLES: up to 3 PlayStyle+ per player. They work in matches (speed, shot power, pass speed, tackling,
     press resistance, headers) and scale with the player's rating so they help without overpowering.
     The PlayStyles Lab shows every PlayStyle and who has it.
   - CHALLENGES: score-based challenges: hand in any bench cards (duplicates count) to fill a points bar,
     in as many trips as you like. Classic challenges with requirements are still there.
   - GALLERY: themed sets graded D to S as you collect. Grades earn Gallery Tokens, which turn your cards
     into Holographic, Pristine Holographic or 3D items.
   - EVENTS: single-player campaigns against themed AI opponents with Easy / Normal / Hard difficulty,
     coin rewards after every match and Event Tokens to spend in the event shop. */
(function () {
  if (typeof rtsShow !== 'function') return;
  const X = () => { if (!RTS) return null; if (!RTS.x) RTS.x = { evo:[], evoDone:{}, ps:{}, sbc:{}, seen:{}, gal:{}, gtok:0, hol:{}, ev:{}, etok:0 }; return RTS.x; };
  const pick = a => a[(Math.random() * a.length) | 0];
  const GRP = { ATT:['ST', 'LW', 'RW', 'CAM'], MID:['CM', 'CAM', 'CDM'], DEF:['CB', 'LB', 'RB', 'CDM'], ANY:null };

  /* ---------------- PlayStyles ---------------- */
  const PS = {
    finesse:{ n:'Finesse Shot+', k:'shot', v:.05, d:'Curled and placed shots fly faster' },
    power:{ n:'Power Shot+', k:'shot', v:.08, d:'Much harder shots' },
    rapid:{ n:'Rapid+', k:'spd', v:.05, d:'Faster running' },
    quick:{ n:'Quick Step+', k:'spd', v:.03, d:'Quicker over short bursts' },
    incisive:{ n:'Incisive Pass+', k:'pass', v:.07, d:'Zipped passes that are harder to cut out' },
    tiki:{ n:'Tiki Taka+', k:'pass', v:.04, d:'Snappy short passing' },
    anticipate:{ n:'Anticipate+', k:'tackle', v:.15, d:'Wins more tackles' },
    intercept:{ n:'Intercept+', k:'tackle', v:.1, d:'Reads play and steals the ball' },
    bruiser:{ n:'Bruiser+', k:'resist', v:.1, d:'Shrugs off challenges' },
    press:{ n:'Press Proven+', k:'resist', v:.15, d:'Very hard to tackle' },
    aerial:{ n:'Aerial+', k:'head', v:.15, d:'Powerful headers' },
    trivela:{ n:'Trivela+', k:'shot', v:.06, d:'Outside-of-the-boot strikes with extra pace' },
    chip:{ n:'Chip Shot+', k:'shot', v:.04, d:'Cleaner, quicker shots' },
    longball:{ n:'Long Ball Pass+', k:'pass', v:.08, d:'Raking long passes' },
    whipped:{ n:'Whipped Pass+', k:'pass', v:.05, d:'Fast, curling crosses' },
    firsttouch:{ n:'First Touch+', k:'resist', v:.12, d:'Kills the ball dead, hard to dispossess' },
    technical:{ n:'Technical+', k:'resist', v:.1, d:'Tight close control' },
    jockey:{ n:'Jockey+', k:'tackle', v:.12, d:'Stays on his feet and nicks the ball' },
    slide:{ n:'Slide Tackle+', k:'tackle', v:.1, d:'Clean sliding challenges' },
    relentless:{ n:'Relentless+', k:'spd', v:.03, d:'Never stops running' },
    acrobatic:{ n:'Acrobatic+', k:'head', v:.1, d:'Spectacular headers and volleys' },
    gamechanger:{ n:'Game Changer++', k:'shot', v:.1, d:'Rare: the biggest shot power boost', rare:true }
  };
  const psFor = p => (X().ps[p.uid] || []);
  // in matches: playstyles act like perks, scaled by the player's rating
  const _start = startMatch;
  startMatch = function (cfg) {
    const r = _start(cfg);
    try {
      if (!RTS || !cfg || !/Road to Success|Event ·/.test(cfg.label || '')) return r;
      const x = X(), mine = S.teams[0];
      for (const p of mine.players) {
        const card = RTS.players.find(q => shortName(q.name) === p.name || q.name === p.name); if (!card) continue;
        const list = psFor(card); if (!list.length) continue;
        const e = { spd:0, shot:0, pass:0, tackle:0, resist:0, head:0 }, sc = .6 + Math.min(110, card.ovr) / 250;
        for (const id of list) { const s = PS[id]; if (s) e[s.k] += s.v * sc; }
        p.spd *= 1 + e.spd; p.perks = { a:'ps', e };
      }
    } catch (err) {}
    return r;
  };

  /* ---------------- Evolutions ---------------- */
  const EVOS = [
    { id:'speed', n:'Speed Merchant', grp:'ATT', max:82, steps:[{ o:'play', n:2, ovr:1 }, { o:'win', n:2, ovr:1, ps:'rapid' }, { o:'goals', n:5, ovr:1, choose:['quick', 'finesse', 'incisive'] }] },
    { id:'wall', n:'Wall Builder', grp:'DEF', max:82, steps:[{ o:'play', n:2, ovr:1 }, { o:'win', n:2, ovr:1, ps:'anticipate' }, { o:'win', n:3, ovr:2, choose:['aerial', 'intercept', 'bruiser'] }] },
    { id:'maestro', n:'Maestro Path', grp:'MID', max:81, steps:[{ o:'play', n:2, ovr:1, ps:'tiki' }, { o:'goals', n:4, ovr:1 }, { o:'win', n:3, ovr:2, choose:['incisive', 'press', 'finesse'] }] },
    { id:'late', n:'Late Bloomer', grp:'ANY', max:75, steps:[{ o:'play', n:3, ovr:2 }, { o:'play', n:3, ovr:2 }, { o:'win', n:3, ovr:2, choose:['rapid', 'power', 'anticipate'] }] },
    { id:'goal', n:'Goal Machine', grp:'ATT', max:84, steps:[{ o:'goals', n:4, ovr:1 }, { o:'goals', n:8, ovr:1, ps:'power' }, { o:'win', n:4, ovr:2, choose:['finesse', 'aerial', 'bruiser'] }] },
    { id:'engine', n:'Box-to-Box Engine', grp:'MID', max:83, steps:[{ o:'play', n:3, ovr:1, ps:'intercept' }, { o:'win', n:3, ovr:1 }, { o:'play', n:4, ovr:1, choose:['rapid', 'press', 'tiki'] }] }
  ];
  const OBJ = { play:'Play {n} games with him in your XI', win:'Win {n} games with him in your XI', goals:'Your team scores {n} goals with him in the XI' };
  const eligible = (e, p) => p.ovr <= e.max && (!GRP[e.grp] || GRP[e.grp].includes(p.pos)) && !X().evo.some(a => a.uid === p.uid) && !(X().evoDone[e.id] || []).includes(p.uid);
  function evoPreview(e, p) {
    const fin = Object.assign({}, p, { uid:'prev', ovr:Math.min(MAX_OVR, p.ovr + e.steps.reduce((a, s) => a + s.ovr, 0)) });
    return `<h3>${e.n} · ${esc(p.name)}</h3><div class="mini">Full path. Nothing changes until you commit.</div>
      <div style="display:flex;gap:18px;align-items:center;margin:10px 0;flex-wrap:wrap">${cardHTML(p)}<b style="font-size:26px">→</b>${cardHTML(fin)}</div>
      <div class="mcx-list">${e.steps.map((s, i) => `<div class="mcx-row"><b class="o">${i + 1}</b><div class="grow"><b>${OBJ[s.o].replace('{n}', s.n)}</b><div class="mini">Reward: +${s.ovr} OVR${s.ps ? ' · ' + PS[s.ps].n : ''}${s.choose ? ' · choose 1 of: ' + s.choose.map(k => PS[k].n).join(', ') : ''}</div></div></div>`).join('')}</div>
      <div class="cta" style="margin-top:12px"><button type="button" data-rx="close">Back</button><button class="big" type="button" data-rx="commit" data-e="${e.id}" data-u="${p.uid}">COMMIT</button></div>`;
  }
  function evoReward(a) {
    const x = X(), e = EVOS.find(v => v.id === a.id), s = e.steps[a.step], p = RTS.players.find(q => q.uid === a.uid);
    if (!p) return;
    p.ovr = Math.min(MAX_OVR, p.ovr + s.ovr);
    if (s.ps) addPS(p, s.ps);
    if (s.choose) { a.choosing = s.choose; return; }
    a.step++; a.prog = 0;
    toastMsg(`🧬 ${shortName(p.name)}: step ${a.step} done (+${s.ovr} OVR)`);
    if (a.step >= e.steps.length) finishEvo(a);
  }
  function finishEvo(a) { const x = X(); x.evo = x.evo.filter(v => v !== a); (x.evoDone[a.id] = x.evoDone[a.id] || []).push(a.uid); }
  function addPS(p, id) { const x = X(), l = x.ps[p.uid] = x.ps[p.uid] || []; if (l.includes(id)) return; if (l.length >= 3) l.shift(); l.push(id); }

  /* ---------------- results: evolutions, events ---------------- */
  const _res = rtsResult;
  rtsResult = function (hs, as) {
    const msg = _res(hs, as);
    evoTick(hs, as);
    saveRTS();
    return msg;
  };
  function evoTick(hs, as) {
    const x = X(); if (!x) return;
    for (const a of x.evo.slice()) {
      if (a.choosing || !RTS.xi.includes(a.uid)) continue;
      const e = EVOS.find(v => v.id === a.id), s = e.steps[a.step];
      a.prog += s.o === 'play' ? 1 : s.o === 'win' ? (hs > as ? 1 : 0) : hs;
      if (a.prog >= s.n) evoReward(a);
    }
  }

  /* ---------------- Challenges ---------------- */
  const SBC = [
    { id:'s1', n:'Squad Clear-out', kind:'score', need:600, reward:{ coins:3000 }, d:'Any cards count' },
    { id:'s2', n:'Silver Stars', kind:'score', need:1500, reward:{ pack:'gold' }, d:'Silver and better cards score more' },
    { id:'s3', n:'Gold Rush', kind:'score', need:4000, reward:{ pack:'elite' }, d:'Big points for gold cards' },
    { id:'c1', n:'Three of a Kind', kind:'classic', d:'Hand in 3 players from the same position group, each 75+', check:l => l.length === 3 && l.every(p => p.ovr >= 75) && Object.values(GRP).some(g => g && l.every(p => g.includes(p.pos))), reward:{ pack:'gold' } },
    { id:'c2', n:'High Rollers', kind:'classic', d:'Hand in 2 players rated 85+', check:l => l.length === 2 && l.every(p => p.ovr >= 85), reward:{ pack:'elite' } }
  ];
  const cardPts = p => Math.round(Math.pow(Math.max(1, p.ovr - 55), 1.55));
  let SEL = new Set();

  /* ---------------- Gallery ---------------- */
  function sets() {
    const out = [
      { id:'bronze', n:'Bronze Collection', ids:PDB.filter(p => p.ovr < 70).map(p => p.id) },
      { id:'silver', n:'Silver Collection', ids:PDB.filter(p => p.ovr >= 70 && p.ovr < 80).map(p => p.id) },
      { id:'gold', n:'Gold Collection', ids:PDB.filter(p => p.ovr >= 80 && p.ovr < 90).map(p => p.id) },
      { id:'elite', n:'Elite 90+', ids:PDB.filter(p => p.ovr >= 90).map(p => p.id) }
    ];
    for (const L of LEAGUES) { const cl = new Set(L.clubs.map(c => c.id)); out.push({ id:'L' + L.id, n:L.name + ' Stars', ids:PDB.filter(p => cl.has(p.club) && p.ovr >= 80).map(p => p.id) }); }
    return out.filter(s => s.ids.length);
  }
  const GRADES = [['D', .02], ['C', .1], ['B', .25], ['A', .45], ['S', .7]];
  const gradeOf = f => { let g = '–'; for (const [n, t] of GRADES) if (f >= t) g = n; return g; };
  // new top rarities come with PlayStyle+ already on them
  function giveRarityPS(p) {
    if (!p || !p.rar || (X().ps[p.uid] || []).length) return;
    const pool = Object.keys(PS).filter(k => !PS[k].rare), n = p.rar === 'galactic' ? 2 : 1;
    for (let i = 0; i < n; i++) addPS(p, pool[(Math.random() * pool.length) | 0]);
    if (p.rar === 'galactic' && Math.random() < .25) addPS(p, 'gamechanger');
  }
  function markSeen() { const x = X(); for (const p of RTS.players) if (p.pid) x.seen[p.pid] = 1; }
  function galleryCheck() {
    const x = X(); let gained = 0;
    for (const s of sets()) {
      const f = s.ids.filter(id => x.seen[id]).length / s.ids.length, g = gradeOf(f), prev = x.gal[s.id] || '–';
      const rank = c => ['–', 'D', 'C', 'B', 'A', 'S'].indexOf(c);
      if (rank(g) > rank(prev)) { gained += rank(g) - rank(prev); x.gal[s.id] = g; }
    }
    if (gained) { x.gtok += gained; toastMsg(`🖼 Gallery grade up! +${gained} Gallery Token${gained > 1 ? 's' : ''}`); }
  }
  const _add = addCards;
  addCards = function (state, cards) { const n = _add(state, cards); if (state === RTS) { for (const c of cards) { const own = RTS.players.find(q => q.pid === c.pid && q.ovr === c.ovr && q.rar === c.rar) || RTS.players.find(q => q.uid === c.uid); if (own) { own.rar = own.rar || c.rar; giveRarityPS(own); } } markSeen(); galleryCheck(); saveRTS(); } return n; };
  // holographic and 3D cosmetics on cards
  const _card = cardHTML;
  cardHTML = function (p, opts) {
    let h = _card(p, opts);
    const x = RTS && RTS.x, st = x && p && x.hol[p.uid];
    if (st) h = h.replace('class="pcard ', `class="pcard ${st} `);
    const n = x && p && (x.ps[p.uid] || []).length;
    if (n) h = h.replace('<span class="o">', `<span class="psb" title="${x.ps[p.uid].map(k => PS[k] && PS[k].n).join(', ')}">${'◆'.repeat(n)}</span><span class="o">`);
    return h;
  };

  /* ---------------- Events ---------------- */
  const EVENTS = [
    { id:'derby', n:'Derby Week', i:'🔥', d:'Three local rivals from your club\'s league', opps:() => { const L = LEAGUES.find(L => L.clubs.some(c => c.id === RTS.club)) || LEAGUES[0]; return L.clubs.filter(c => c.id !== RTS.club && !c.admin).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(c => c.id); } },
    { id:'giants', n:'Giant Killers', i:'🗿', d:'The strongest clubs in Europe', opps:() => LEAGUES.flatMap(L => L.clubs).filter(c => !c.admin).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(c => c.id) },
    { id:'nations', n:'International Break', i:'🌍', d:'Three top national teams', opps:() => Object.values(ALL).filter(c => c.nation && !c.admin).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(c => c.id) },
    { id:'boot', n:'Golden Boot Rush', i:'👟', d:'Win by 2+ goals to clear a stage', margin:2, opps:() => LEAGUES.flatMap(L => L.clubs).filter(c => !c.admin && c.ovr < 84).sort(() => Math.random() - .5).slice(0, 3).map(c => c.id) }
  ];
  const DIFF_EV = [{ n:'Easy', d:0, m:1, t:1 }, { n:'Normal', d:1, m:1.5, t:2 }, { n:'Hard', d:2, m:2.2, t:3 }];
  function evState(e) { const x = X(); if (!x.ev[e.id]) x.ev[e.id] = { stage:0, opps:e.opps(), diff:1 }; return x.ev[e.id]; }
  function playEvent(e, sim) {
    const st = evState(e), opp = st.opps[st.stage], D = DIFF_EV[st.diff];
    if (!opp) return;
    rtsDef();
    const done = (hs, as) => {
      const win = hs - as >= (e.margin || 1), coins = Math.round((win ? 500 : hs === as ? 200 : 100) * D.m) + hs * 50;
      PROFILE.coins += coins; let msg = `+${fmt(coins)} coins`;
      if (win) { st.stage++; X().etok += D.t; msg += ` · +${D.t} Event Token${D.t > 1 ? 's' : ''}`; if (st.stage >= st.opps.length) { msg += ` · ${e.n} complete! +5,000`; PROFILE.coins += 5000; st.stage = 0; st.opps = e.opps(); st.clears = (st.clears || 0) + 1; } }
      evoTick(hs, as); saveRTS(); rtsShow('events'); setTimeout(() => toastMsg(`${ALL['rts-me'].code} ${hs}-${as} ${ALL[opp].code} · ${msg}`), 60);
    };
    if (sim) { const a = xiOvr(RTS), b = ALL[opp].ovr + DIFFS[D.d].d; done(poisson(1.35 * Math.exp((a - b) * .055)), poisson(1.35 * Math.exp((b - a) * .055))); return; }
    CUR_MATCH = { kind:'custom', done:res => done(res.hs, res.as), quit:() => rtsShow('events') };
    startMatch({ home:'rts-me', away:opp, ctl:['local', 'ai'], me:0, op:[false, false], diff:D.d, len:LENS[SET.len].s, squads:[xiSquad(RTS), null], label:`Event · ${e.n}` });
  }
  const SHOP = [{ id:'gold', n:'Gold Pack', cost:3 }, { id:'elite', n:'Elite Pack', cost:7 }, { id:'pick', n:'Player Pick: 1 of 3 (84-90)', cost:10 }];

  /* ---------------- screens ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  #hub .card .tabs{flex-wrap:wrap}
  .pcard.t6{background:linear-gradient(160deg,#0b1a5c,#5a2bd6 45%,#00d4ff);color:#fff;border-color:#9ff3ff;box-shadow:0 0 14px rgba(0,212,255,.55)}
  .pcard.t7{background:conic-gradient(from 0deg,#ff2d7a,#ffd23f,#2fff9b,#00b3ff,#b14dff,#ff2d7a);background-size:200% 200%;color:#fff;border-color:#fff;box-shadow:0 0 18px rgba(255,255,255,.75);text-shadow:0 1px 3px rgba(0,0,0,.8);animation:galx 3s linear infinite}
  @keyframes galx{from{filter:hue-rotate(0)}to{filter:hue-rotate(360deg)}}
  .pcard .psb{position:absolute;top:4px;left:50%;transform:translateX(-50%);font-size:8px;letter-spacing:1px;color:#00e5ff;text-shadow:0 0 4px #00e5ff}
  .pcard.holo,.pcard.pristine,.pcard.d3{overflow:hidden}
  .pcard.holo:after,.pcard.pristine:after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,transparent 20%,rgba(255,255,255,.55) 35%,rgba(120,220,255,.45) 42%,rgba(255,120,240,.4) 50%,transparent 65%);background-size:250% 100%;mix-blend-mode:overlay;animation:holo 2.6s linear infinite}
  .pcard.pristine{box-shadow:0 0 0 2px #fff,0 0 18px 4px rgba(140,230,255,.8)}
  .pcard.pristine:after{background:linear-gradient(115deg,transparent 20%,rgba(255,255,255,.45) 32%,rgba(110,230,255,.4) 40%,rgba(255,110,230,.35) 48%,rgba(255,240,120,.35) 56%,transparent 68%);background-size:220% 100%;mix-blend-mode:overlay;animation-duration:1.8s}
  .pcard.holo>span,.pcard.pristine>span{position:relative;z-index:1}
  .pcard.d3{transform-style:preserve-3d;animation:d3 4s ease-in-out infinite}
  @keyframes holo{from{background-position:150% 0}to{background-position:-100% 0}}
  @keyframes d3{0%,100%{transform:perspective(500px) rotateY(-14deg) rotateX(4deg)}50%{transform:perspective(500px) rotateY(14deg) rotateX(-4deg)}}
  .rx-sel{outline:3px solid #ffd23f;border-radius:12px}
  .rx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:10px}
  .rx-tile{background:rgba(255,255,255,.05);border-radius:12px;padding:12px}.rx-tile h4{margin:0 0 4px;font-size:15px}
  .rx-grade{font:900 italic 30px/1 "Segoe UI",system-ui;float:right}`;
  document.head.appendChild(css);
  const TABS = [['evo', '🧬 Evolutions'], ['lab', 'PlayStyles Lab'], ['sbc', 'Challenges'], ['gallery', '🖼 Gallery'], ['events', '🎯 Events']];
  const _show = rtsShow;
  rtsShow = function (tab) {
    if (!RTS) return _show(tab);
    const x = X(); markSeen();
    if (tab) RTS.tab = tab;
    const mine = TABS.some(t => t[0] === RTS.tab), keep = RTS.tab;
    _show(mine ? 'home' : RTS.tab);
    RTS.tab = keep;
    const card = $('hub').querySelector('.card'); if (!card) return;
    const tabsEl = card.querySelector('.tabs');
    if (tabsEl) {
      if (mine) tabsEl.querySelectorAll('[data-rt]').forEach(b => b.classList.remove('sel'));
      const reset = tabsEl.querySelector('[data-r="reset"]');
      for (const [id, n] of TABS) { const b = document.createElement('button'); b.type = 'button'; b.dataset.rx = 'tab'; b.dataset.v = id; b.textContent = n; if (id === RTS.tab) b.classList.add('sel'); tabsEl.insertBefore(b, reset); }
    }
    if (mine) { while (tabsEl.nextSibling) tabsEl.nextSibling.remove(); const h = document.createElement('div'); h.innerHTML = screen(RTS.tab); card.appendChild(h); }
    const ch = x.evo.find(a => a.choosing); if (ch) chooseModal(ch);
  };
  function screen(t) {
    const x = X();
    if (t === 'evo') {
      return `<p class="mini">Pick an Evolution and an eligible player, check the full path, then commit. Up to 3 at once. Progress counts in Road to Success and Events matches while he is in your XI.</p>
        ${x.evo.length ? `<h3>ACTIVE</h3><div class="mcx-list">${x.evo.map(a => { const e = EVOS.find(v => v.id === a.id), p = RTS.players.find(q => q.uid === a.uid), s = e.steps[a.step]; if (!p) return ''; return `<div class="mcx-row">${cardHTML(p)}<div class="grow"><b>${e.n}</b> <span class="mini">step ${a.step + 1}/${e.steps.length}</span><div class="mini">${OBJ[s.o].replace('{n}', s.n)}: <b>${a.prog}/${s.n}</b>${RTS.xi.includes(a.uid) ? '' : ' · ⚠ put him in your XI'}</div><div class="meter" style="height:7px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${Math.min(100, a.prog / s.n * 100)}%;background:linear-gradient(90deg,#2f80ed,#00e5ff)"></i></div></div></div>`; }).join('')}</div>` : ''}
        <div class="rx-grid">${EVOS.map(e => { const el = RTS.players.filter(p => eligible(e, p)).sort((a, b) => b.ovr - a.ovr).slice(0, 8); return `<div class="rx-tile"><h4>${e.n}</h4><div class="mini">${e.grp === 'ANY' ? 'Any position' : GRP[e.grp].join('/')} · ${e.max} OVR or lower · ${e.steps.length} steps · +${e.steps.reduce((a, s) => a + s.ovr, 0)} OVR</div>
          <div class="mini" style="margin:6px 0">${el.length ? 'Eligible: ' : 'No eligible players right now'}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${el.map(p => `<button type="button" data-rx="preview" data-e="${e.id}" data-u="${p.uid}" ${x.evo.length >= 3 ? 'disabled' : ''}>${esc(shortName(p.name))} ${p.ovr}</button>`).join('')}</div></div>`; }).join('')}</div>`;
    }
    if (t === 'lab') {
      const ws = RTS.players.slice().sort((a, b) => b.ovr - a.ovr);
      return `<p class="mini">PlayStyles work in matches and scale with a player's rating, so they add to his stats without taking over. Each player can hold up to 3 PlayStyle+ (shown as ◆ on his card); a 4th replaces his oldest. Earn them from Evolutions, Cosmic and Galactic cards, or the Workshop.</p>
        <div class="rx-tile" style="margin:8px 0"><h4>🛠 PLAYSTYLE+ WORKSHOP · 25,000 coins</h4><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
          <select id="wsP" style="background:#1b2340;color:#fff;border-radius:6px;padding:6px">${ws.map(p => `<option value="${p.uid}">${esc(p.name)} ${p.ovr} (${psFor(p).length}/3)</option>`).join('')}</select>
          <select id="wsS" style="background:#1b2340;color:#fff;border-radius:6px;padding:6px">${Object.entries(PS).filter(([, v]) => !v.rare).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('')}</select>
          <button type="button" data-rx="workshop" ${PROFILE.coins < 25000 ? 'disabled' : ''}>Add PlayStyle+</button><span class="mini">Coins: ${fmt(PROFILE.coins)}</span></div></div>
        <div class="rx-grid">${Object.entries(PS).map(([k, s]) => { const who = RTS.players.filter(p => psFor(p).includes(k)); return `<div class="rx-tile"><h4>${s.n}</h4><div class="mini">${s.d} · +${Math.round(s.v * 100)}% ${({ spd:'speed', shot:'shot power', pass:'pass speed', tackle:'tackle success', resist:'harder to tackle', head:'header power' })[s.k]} at 90 OVR</div><div class="mini" style="margin-top:6px">${who.length ? who.map(p => esc(shortName(p.name))).join(', ') : 'Nobody yet'}</div></div>`; }).join('')}</div>`;
    }
    if (t === 'sbc') {
      const bench = RTS.players.filter(p => !RTS.xi.includes(p.uid)).sort((a, b) => b.ovr - a.ovr);
      const selPts = [...SEL].reduce((a, u) => { const p = RTS.players.find(q => q.uid === u); return a + (p ? cardPts(p) : 0); }, 0);
      return `<p class="mini">Tap bench cards to select them (selected: ${SEL.size}, worth ${selPts} pts), then hand them in to a challenge. Score challenges fill a bar: hand in a few at a time. Your XI is never used.</p>
        <div class="rx-grid">${SBC.map(c => { const st = x.sbc[c.id] || { pts:0, done:0 }; return `<div class="rx-tile"><h4>${c.n}${st.done ? ` <span class="mcx-tag">DONE ×${st.done}</span>` : ''}</h4><div class="mini">${c.d} · Reward: ${c.reward.coins ? '🪙 ' + fmt(c.reward.coins) : PACKS.find(p => p.id === c.reward.pack).n}</div>
          ${c.kind === 'score' ? `<div style="height:9px;background:rgba(255,255,255,.1);border-radius:5px;overflow:hidden;margin:8px 0"><i style="display:block;height:100%;width:${Math.min(100, st.pts / c.need * 100)}%;background:linear-gradient(90deg,#2fbf71,#ffd23f)"></i></div><div class="mini">${st.pts} / ${c.need} pts</div>` : ''}
          <button type="button" data-rx="submit" data-v="${c.id}" ${SEL.size ? '' : 'disabled'} style="margin-top:8px">Hand in ${SEL.size} card${SEL.size === 1 ? '' : 's'}</button></div>`; }).join('')}</div>
        <h3 style="margin-top:12px">YOUR BENCH</h3><div class="cardrow">${bench.map(p => `<div data-rxsel="${p.uid}" class="${SEL.has(p.uid) ? 'rx-sel' : ''}" style="text-align:center">${cardHTML(p)}<span class="mini">${cardPts(p)} pts</span></div>`).join('') || '<p class="mini">No bench players.</p>'}</div>`;
    }
    if (t === 'gallery') {
      const own = RTS.players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 30);
      return `<p class="mini">Every real player you collect is added to these sets. Grades go D → C → B → A → S, and each new grade gives a Gallery Token. Spend tokens on cosmetics: <b>Holographic</b> (1), <b>3D item</b> (2), <b>Pristine Holographic</b> (3). Tokens: <b>${x.gtok}</b></p>
        <div class="rx-grid">${sets().map(s => { const have = s.ids.filter(id => x.seen[id]).length, f = have / s.ids.length, g = gradeOf(f); return `<div class="rx-tile"><span class="rx-grade" style="color:${{ S:'#ffd23f', A:'#2fbf71', B:'#2f80ed', C:'#b07cff', D:'#9aa5b1' }[g] || '#555'}">${g}</span><h4>${esc(s.n)}</h4><div class="mini">${have} / ${s.ids.length} collected · next grade at ${Math.round(((GRADES.find(([, t]) => t > f) || [, 1])[1]) * 100)}%</div></div>`; }).join('')}</div>
        <h3 style="margin-top:12px">COSMETICS</h3><div class="cardrow">${own.map(p => `<div style="text-align:center">${cardHTML(p)}<div style="display:flex;gap:3px;justify-content:center;margin-top:4px"><button type="button" data-rx="cos" data-u="${p.uid}" data-v="holo" ${x.gtok < 1 ? 'disabled' : ''} title="Holographic">H·1</button><button type="button" data-rx="cos" data-u="${p.uid}" data-v="d3" ${x.gtok < 2 ? 'disabled' : ''} title="3D item">3D·2</button><button type="button" data-rx="cos" data-u="${p.uid}" data-v="pristine" ${x.gtok < 3 ? 'disabled' : ''} title="Pristine">P·3</button></div></div>`).join('')}</div>`;
    }
    if (t === 'events') {
      return `<p class="mini">Single-player events against themed opponents. Pick a difficulty: harder means more coins and Event Tokens. Event Tokens: <b>${x.etok}</b></p>
        <div class="rx-grid">${EVENTS.map(e => { const st = evState(e), opp = ALL[st.opps[st.stage]]; return `<div class="rx-tile"><h4>${e.i} ${e.n}</h4><div class="mini">${e.d}${st.clears ? ` · cleared ×${st.clears}` : ''}</div>
          <div class="mini" style="margin:6px 0">Stage ${st.stage + 1}/${st.opps.length}: <b>${opp ? esc(opp.name) : '?'}</b> (${opp ? opp.ovr : '?'} OVR)</div>
          <div style="display:flex;gap:4px;margin-bottom:6px">${DIFF_EV.map((d, i) => `<button type="button" data-rx="diff" data-e="${e.id}" data-v="${i}" class="${st.diff === i ? 'sel' : ''}">${d.n}</button>`).join('')}</div>
          <button type="button" data-rx="evsim" data-e="${e.id}">Simulate</button> <button class="big" type="button" data-rx="evplay" data-e="${e.id}">PLAY ▶</button></div>`; }).join('')}</div>
        <h3 style="margin-top:12px">EVENT SHOP</h3><div class="mcx-list">${SHOP.map(s => `<div class="mcx-row"><div class="grow"><b>${s.n}</b></div><button type="button" data-rx="shop" data-v="${s.id}" ${x.etok < s.cost ? 'disabled' : ''}>${s.cost} tokens</button></div>`).join('')}</div>`;
    }
    return '';
  }
  function chooseModal(a) {
    const box = document.getElementById('mcx'); if (!box) return;
    const p = RTS.players.find(q => q.uid === a.uid);
    box.innerHTML = `<div class="box"><h3>EVOLUTION COMPLETE · ${esc(p ? p.name : '')}</h3><div class="mini">Choose one PlayStyle+ to finish the Evolution.</div>
      <div class="ans" style="margin-top:12px">${a.choosing.map(k => `<button type="button" data-rxch="${k}"><b>${PS[k].n}</b> <span class="mini">· ${PS[k].d}</span></button>`).join('')}</div></div>`;
    box.classList.add('on');
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-rxch]'); if (!c || !RTS) return;
    const x = X(), a = x.evo.find(v => v.choosing); if (!a) return;
    const p = RTS.players.find(q => q.uid === a.uid); if (p) addPS(p, c.dataset.rxch);
    a.choosing = null; a.step++; finishEvo(a); saveRTS();
    document.getElementById('mcx').classList.remove('on');
    toastMsg(`🧬 ${p ? shortName(p.name) : ''} gets ${PS[c.dataset.rxch].n}! Evolution complete`); rtsShow('evo');
  });
  $('hub').addEventListener('click', e => {
    if (!RTS) return;
    const sel = e.target.closest('[data-rxsel]');
    if (sel) { const u = sel.dataset.rxsel; SEL.has(u) ? SEL.delete(u) : SEL.add(u); rtsShow('sbc'); return; }
    const b = e.target.closest('[data-rx]'); if (!b) return;
    const x = X(), a = b.dataset.rx, v = b.dataset.v, box = document.getElementById('mcx');
    if (a === 'tab') { rtsShow(v); return; }
    if (a === 'preview') { const ev = EVOS.find(q => q.id === b.dataset.e), p = RTS.players.find(q => q.uid === b.dataset.u); box.innerHTML = `<div class="box">${evoPreview(ev, p)}</div>`; box.classList.add('on'); return; }
    if (a === 'diff') { evState(EVENTS.find(q => q.id === b.dataset.e)).diff = +v; saveRTS(); rtsShow('events'); return; }
    if (a === 'evplay' || a === 'evsim') { playEvent(EVENTS.find(q => q.id === b.dataset.e), a === 'evsim'); return; }
    if (a === 'shop') {
      const s = SHOP.find(q => q.id === v); if (x.etok < s.cost) return; x.etok -= s.cost;
      let cards;
      if (v === 'pick') { const ex = new Set(RTS.players.map(p => p.pid)); const opts = [0, 1, 2].map(() => realPick(84, 90, ex)); box.innerHTML = `<div class="box"><h3>PLAYER PICK</h3><div class="mini">Choose one.</div><div class="cardrow" style="justify-content:center;margin-top:10px">${opts.map((p, i) => `<div data-rxpick="${i}" style="cursor:pointer">${cardHTML(p)}</div>`).join('')}</div></div>`; box.classList.add('on'); box._opts = opts; saveRTS(); return; }
      cards = PACKS.find(p => p.id === v).open(); const notes = addCards(RTS, cards); saveRTS(); revealCards(cards, notes, () => rtsShow('events')); return;
    }
    if (a === 'workshop') {
      const p = RTS.players.find(q => q.uid === document.getElementById('wsP').value), k = document.getElementById('wsS').value;
      if (!p || PROFILE.coins < 25000) return;
      if (psFor(p).includes(k)) { toastMsg(`${shortName(p.name)} already has ${PS[k].n}`); return; }
      PROFILE.coins -= 25000; addPS(p, k); saveRTS(); toastMsg(`🛠 ${shortName(p.name)} learned ${PS[k].n}`); rtsShow('lab'); return;
    }
    if (a === 'cos') { const cost = { holo:1, d3:2, pristine:3 }[v]; if (x.gtok < cost) return; x.gtok -= cost; x.hol[b.dataset.u] = v; saveRTS(); rtsShow('gallery'); return; }
    if (a === 'submit') {
      const c = SBC.find(q => q.id === v), list = [...SEL].map(u => RTS.players.find(p => p.uid === u)).filter(Boolean).filter(p => !RTS.xi.includes(p.uid));
      if (!list.length) return;
      const st = x.sbc[c.id] = x.sbc[c.id] || { pts:0, done:0 };
      if (c.kind === 'classic' && !c.check(list)) { toastMsg('These cards do not meet the requirements'); return; }
      RTS.players = RTS.players.filter(p => !list.includes(p)); SEL = new Set();
      let done = c.kind === 'classic';
      if (c.kind === 'score') { st.pts += list.reduce((s, p) => s + cardPts(p), 0); if (st.pts >= c.need) { st.pts -= c.need; done = true; } }
      if (done) {
        st.done++;
        if (c.reward.coins) { PROFILE.coins += c.reward.coins; toastMsg(`✅ ${c.n} complete! +${fmt(c.reward.coins)} coins`); saveRTS(); rtsShow('sbc'); }
        else { const cards = PACKS.find(p => p.id === c.reward.pack).open(), notes = addCards(RTS, cards); saveRTS(); revealCards(cards, notes, () => rtsShow('sbc')); }
      } else { toastMsg(`+${list.reduce((s, p) => s + cardPts(p), 0)} pts handed in`); saveRTS(); rtsShow('sbc'); }
      return;
    }
  });
  document.addEventListener('click', e => {
    const box = document.getElementById('mcx'); if (!box || !RTS) return;
    const pk = e.target.closest('[data-rxpick]');
    if (pk && box._opts) { const p = box._opts[+pk.dataset.rxpick]; box._opts = null; const notes = addCards(RTS, [p]); saveRTS(); box.classList.remove('on'); revealCards([p], notes, () => rtsShow('events')); return; }
    const b = e.target.closest('[data-rx]'); if (!b || !box.contains(b)) return;
    if (b.dataset.rx === 'close') { box.classList.remove('on'); return; }
    if (b.dataset.rx === 'commit') {
      const x = X(); if (x.evo.length >= 3) { toastMsg('3 Evolutions at once is the max'); return; }
      x.evo.push({ id:b.dataset.e, uid:b.dataset.u, step:0, prog:0 }); saveRTS(); box.classList.remove('on'); toastMsg('🧬 Evolution started'); rtsShow('evo');
    }
  });
})();
