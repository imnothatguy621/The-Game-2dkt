/* Kickoff Rivals: Manager Career upgrades.
   - Transfer Deadline Day: a 20-hour countdown (twice a season) with rival clubs in bidding wars, up to
     4 negotiations at once, bids for your own players, and a big reveal showcase for star signings.
   - Deal structures: pay up front or in 2/3 instalments, add a title bonus, a fee cut if the board target
     is missed, include one of your players in a swap, or sign him now and loan him back for the season.
     Selling: add a buy-back clause.
   - Six growth profiles (Early Bloomer, Late Bloomer, Steady, Explosive, Peaked, Dynamic potential).
   - Up to 12 coaches who improve development, sharpen potential forecasts and retrain players in new positions.
   - Four-region scouting network and a Youth Academy whose capacity grows with experience.
   - Press conferences only around big moments, which change squad morale and Dynamic OVR.
   - Unexpected events (injuries, sponsors, unhappy stars), Practice Arena friendlies, and settings for all of it. */
(function () {
  if (typeof mcShow !== 'function') return;

  /* ---------------- helpers ---------------- */
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const pick = a => a[(Math.random() * a.length) | 0];
  const ord = n => n + (['st', 'nd', 'rd'][((n + 90) % 100 - 10) % 10 - 1] || 'th');
  const PROFILES = {
    early:{ n:'Early Bloomer', c:'#2fbf71', d:'Grows fast as a teenager, levels off by 25' },
    late:{ n:'Late Bloomer', c:'#2f80ed', d:'Slow start, big jumps from 23 to 27' },
    steady:{ n:'Steady', c:'#9aa5b1', d:'Small, reliable gains every season' },
    explosive:{ n:'Explosive', c:'#ff6b2b', d:'Unpredictable: can jump 7 in a season' },
    peaked:{ n:'Peaked', c:'#b07cff', d:'At his best now; declines after 27' },
    dynamic:{ n:'Dynamic', c:'#ffd23f', d:'Potential rises or falls with how the team does' }
  };
  const AREAS = { GK:['GK'], Defence:['CB', 'LB', 'RB', 'CDM'], Midfield:['CM', 'CAM', 'CDM'], Attack:['ST', 'LW', 'RW', 'CAM'] };
  const SPECS = ['GK', 'Defence', 'Midfield', 'Attack', 'Fitness', 'Youth', 'Analysis', 'Set Pieces'];
  const REGIONS = ['Europe', 'South America', 'Africa', 'Asia'];
  const POSLIST = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
  function X() {
    if (!MC) return null;
    if (!MC.x) MC.x = { morale:0, form:[], coaches:[], coachPool:null, scouts:{ Europe:1, 'South America':0, Africa:0, Asia:0 }, youth:[], academyXP:0, dues:[], bonuses:[], buyback:[], loanBack:[], train:[],
      settings:{ press:'big', events:true, dd:true }, log:[], dd:null, ddDone:{}, press:null };
    return MC.x;
  }
  function dev(p) {
    if (p.age == null) p.age = p.youth ? 16 : 20 + Math.floor(hash(p.name + (p.pid || '')) * 11);
    if (!p.gp) {
      const r = hash('g' + p.name + p.uid), a = p.age;
      p.gp = a <= 20 ? (r < .3 ? 'early' : r < .5 ? 'explosive' : r < .7 ? 'late' : r < .85 ? 'dynamic' : 'steady')
        : a >= 30 ? (r < .6 ? 'peaked' : 'steady') : ['steady', 'late', 'dynamic', 'peaked', 'explosive', 'early'][(r * 6) | 0];
    }
    if (p.pot == null) { const room = Math.max(0, 27 - p.age) * (p.gp === 'peaked' ? 0 : p.gp === 'steady' ? .9 : 1.5) + hash('p' + p.uid) * 6; p.pot = Math.min(MAX_OVR, Math.round(p.ovr + room)); }
    return p;
  }
  function forecast(p) {
    const x = X(), an = x.coaches.filter(c => c.spec === 'Analysis').reduce((a, c) => a + c.stars, 0);
    const w = Math.max(0, 8 - an * 2 - Math.floor(x.coaches.length / 3));
    if (!w) return String(p.pot);
    const lo = Math.max(p.ovr, p.pot - Math.ceil(w * hash('f' + p.uid))), hi = Math.min(MAX_OVR, lo + w);
    return lo + '–' + hi;
  }
  const coachBoost = pos => { const x = X(); let b = 0; for (const c of x.coaches) if (AREAS[c.spec] && AREAS[c.spec].includes(pos)) b += c.stars * .25; return Math.min(1.6, b); };
  function newCoach() { const stars = 1 + Math.floor(Math.pow(Math.random(), 1.6) * 5); return { id:'c' + Math.random().toString(36).slice(2, 7), name:pick(GIVEN) + ' ' + pick(SURN), spec:pick(SPECS), stars, wage:stars * 2 }; }
  const academyCap = () => { const x = X(); return 3 + Math.floor(x.academyXP / 3) + x.coaches.filter(c => c.spec === 'Youth').reduce((a, c) => a + Math.ceil(c.stars / 2), 0); };
  function logIt(m) { const x = X(); x.log.unshift(m); x.log.length = Math.min(x.log.length, 8); }

  /* ---------------- styles and overlay ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  #mcx{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(3,7,16,.72);backdrop-filter:blur(6px);font-family:"Segoe UI",system-ui,sans-serif;color:#fff}
  #mcx.on{display:flex}
  #mcx .box{background:linear-gradient(160deg,#141c2e,#0b1020);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px 20px;width:min(560px,94vw);max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  #mcx h3{margin:0 0 4px;font-size:20px;font-weight:900;font-style:italic;letter-spacing:.5px}
  #mcx .opt{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}#mcx .opt button.sel{background:#ffd23f;color:#111}
  #mcx label{display:block;font-size:11px;font-weight:800;letter-spacing:1.6px;opacity:.7;margin-top:8px}
  #mcx .q{font-size:17px;line-height:1.4;margin:10px 0 14px}#mcx .ans{display:grid;gap:8px}#mcx .ans button{text-align:left;padding:10px 12px}
  #mcx .meter{height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin:6px 0}#mcx .meter i{display:block;height:100%;background:linear-gradient(90deg,#ff5d5d,#ffd23f,#2fbf71)}
  .mcx-gp{display:inline-block;font-size:10px;font-weight:900;letter-spacing:1px;padding:2px 7px;border-radius:10px;color:#111}
  .mcx-list{display:grid;gap:6px;margin-top:8px}.mcx-row{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border-radius:10px;padding:8px 10px;flex-wrap:wrap}
  .mcx-row b.o{font-size:20px;font-style:italic;min-width:34px}.mcx-row .grow{flex:1;min-width:120px}.mcx-row .mini{opacity:.75}
  .mcx-dd{background:linear-gradient(120deg,#5b0f1a,#1b2340);border-radius:12px;padding:12px 14px;margin:10px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .mcx-dd .clk{font:900 34px/1 "Segoe UI",system-ui;font-variant-numeric:tabular-nums;letter-spacing:1px;color:#ffd23f}
  .mcx-tag{font-size:10px;font-weight:900;letter-spacing:1.2px;padding:3px 7px;border-radius:6px;background:rgba(255,255,255,.12)}
  #mcReveal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(circle at 50% 45%,var(--c1),#000 70%);color:#fff;font-family:"Segoe UI",system-ui,sans-serif;overflow:hidden;cursor:pointer}
  #mcReveal.on{display:flex}
  #mcReveal .beam{position:absolute;top:-20%;left:50%;width:46vw;height:140%;transform:translateX(-50%);background:linear-gradient(180deg,rgba(255,255,255,.35),transparent 70%);clip-path:polygon(40% 0,60% 0,100% 100%,0 100%);animation:rvBeam 2.4s ease-in-out infinite alternate}
  #mcReveal .hw{font:900 italic min(13vw,110px)/1 "Segoe UI",system-ui;letter-spacing:2px;text-shadow:0 8px 40px rgba(0,0,0,.6);opacity:0;animation:rvIn .8s .3s forwards}
  #mcReveal .cardw{transform:perspective(800px) rotateY(180deg) scale(.6);opacity:0;animation:rvCard 1.3s 1s cubic-bezier(.2,.9,.2,1) forwards;margin:16px 0}
  #mcReveal .cardw .pcard{transform:scale(1.6);transform-origin:center}
  #mcReveal .sub{opacity:0;animation:rvIn .6s 2.2s forwards;font-weight:800;letter-spacing:2px;text-align:center}
  #mcReveal .sub small{display:block;opacity:.7;margin-top:6px;font-size:12px;letter-spacing:3px}
  @keyframes rvIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  @keyframes rvCard{to{opacity:1;transform:perspective(800px) rotateY(0) scale(1)}}
  @keyframes rvBeam{from{opacity:.4}to{opacity:.9}}`;
  document.head.appendChild(css);
  const OV = document.createElement('div'); OV.id = 'mcx'; document.body.appendChild(OV);
  const RV = document.createElement('div'); RV.id = 'mcReveal'; document.body.appendChild(RV);
  RV.addEventListener('click', () => RV.classList.remove('on'));
  const modal = h => { OV.innerHTML = `<div class="box">${h}</div>`; OV.classList.add('on'); };
  const closeModal = () => OV.classList.remove('on');
  function reveal(p, from, fee) {
    const k = ALL[MC.club].kit;
    RV.style.setProperty('--c1', k[0]);
    RV.innerHTML = `<div class="beam"></div><div class="hw">HERE WE GO!</div><div class="cardw">${cardHTML(p)}</div>
      <div class="sub">${esc(p.name.toUpperCase())} JOINS ${esc(ALL[MC.club].name.toUpperCase())}<small>FROM ${esc(from)} · €${fee}M · TAP TO CONTINUE</small></div>`;
    RV.classList.add('on');
    if (typeof playFx === 'function') try { fx('whistle'); } catch (e) {}
  }

  /* ---------------- negotiations ---------------- */
  let NEG = null;
  function sellerOf(p) { return typeof p.club === 'string' && ALL[p.club] ? ALL[p.club].name : 'his club'; }
  function negotiate(pid, ddMode) {
    const p = PDB_BY_ID[pid], v = valueM(p.ovr);
    NEG = { pid, v, fee:v, inst:1, bonus:false, cut:false, swap:null, loanBack:false, dd:ddMode };
    drawNeg();
  }
  function negValue() {
    const n = NEG; let worth = n.fee;
    if (n.inst === 2) worth *= .95; if (n.inst === 3) worth *= .9;
    if (n.bonus) worth += n.v * .1;
    if (n.cut) worth -= n.v * .08;
    if (n.swap) { const s = MC.players.find(q => q.uid === n.swap); if (s) worth += valueM(s.ovr) * .8; }
    if (n.loanBack) worth += n.v * .12;
    return worth;
  }
  function drawNeg() {
    const n = NEG, p = PDB_BY_ID[n.pid], x = X();
    const cash = n.fee / (n.loanBack ? 1 : 1);
    const chance = clamp((negValue() / n.v - .82) / .3, 0, 1);
    const bench = MC.players.filter(q => !MC.xi.includes(q.uid)).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
    const btn = (k, v, l) => `<button type="button" data-ng="${k}" data-v="${v}" class="${String(n[k]) === String(v) ? 'sel' : ''}">${l}</button>`;
    modal(`<h3>${n.dd ? 'DEADLINE DAY BID' : 'TRANSFER OFFER'} · ${esc(p.name)}</h3><div class="mini">${esc(sellerOf(p))} value him at <b>€${n.v}M</b>${n.dd ? ' · rival clubs may bid too' : ''}</div>
      <div style="display:flex;gap:14px;align-items:center;margin-top:8px">${cardHTML(mkPlayer(p, p.ovr, { uid:'neg' }))}<div style="flex:1">
      <label>FEE</label><div class="opt"><button type="button" data-ng="fee" data-v="-2">−2</button><b style="font-size:22px;min-width:70px;text-align:center">€${n.fee}M</b><button type="button" data-ng="fee" data-v="2">+2</button></div>
      <label>PAYMENT</label><div class="opt">${btn('inst', 1, 'Up front')}${btn('inst', 2, '2 instalments')}${btn('inst', 3, '3 instalments')}</div></div></div>
      <label>ADD-ONS</label><div class="opt">${btn('bonus', !n.bonus, (n.bonus ? '✓ ' : '') + 'Title bonus +€' + Math.round(n.v * .15) + 'M')}${btn('cut', !n.cut, (n.cut ? '✓ ' : '') + 'Fee −15% if board target missed')}${btn('loanBack', !n.loanBack, (n.loanBack ? '✓ ' : '') + 'Loan him back to them this season')}</div>
      <label>PLAYER EXCHANGE</label><div class="opt">${btn('swap', 'none', 'No swap')}${bench.map(q => btn('swap', q.uid, esc(shortName(q.name)) + ' ' + q.ovr)).join('')}</div>
      <label>CHANCE THEY ACCEPT</label><div class="meter"><i style="width:${Math.round(chance * 100)}%"></i></div>
      <div class="mini">Now: €${n.inst > 1 ? Math.ceil(n.fee / n.inst) : n.fee}M${n.inst > 1 ? ` · then €${Math.ceil(n.fee / n.inst)}M at the end of each of the next ${n.inst - 1} season${n.inst > 2 ? 's' : ''}` : ''} · Budget €${MC.budget}M</div>
      <div class="cta" style="margin-top:12px"><button type="button" data-ng="cancel">Walk away</button><button class="big" type="button" data-ng="offer">${n.dd ? 'PLACE BID' : 'SUBMIT OFFER'}</button></div>`);
  }
  function completeSigning(p, fee, deal, from) {
    const x = X(), np = dev(mkPlayer(p, p.ovr));
    const now = deal.inst > 1 ? Math.ceil(fee / deal.inst) : fee;
    MC.budget -= now;
    for (let i = 1; i < deal.inst; i++) x.dues.push({ amt:Math.ceil(fee / deal.inst), season:MC.seasonNo + i, who:p.name });
    if (deal.bonus) x.bonuses.push({ amt:Math.round(valueM(p.ovr) * .15), kind:'title', season:MC.seasonNo, who:p.name });
    if (deal.cut) x.bonuses.push({ amt:-Math.round(fee * .15), kind:'target', season:MC.seasonNo, who:p.name });
    if (deal.swap) { const s = MC.players.find(q => q.uid === deal.swap); if (s) { MC.players = MC.players.filter(q => q !== s); MC.xi = MC.xi.filter(u => u !== s.uid); logIt(`${s.name} went the other way in the ${p.name} deal`); } }
    if (deal.loanBack) { np.loanedTo = from; np.loanUntil = MC.seasonNo; x.loanBack.push(np.uid); }
    MC.players.push(np);
    if (MC.xi.length < 11) autoXI(MC);
    logIt(`Signed ${p.name} for €${fee}M${deal.inst > 1 ? ' in ' + deal.inst + ' instalments' : ''}${deal.loanBack ? ' (loaned back)' : ''}`);
    saveMC();
    if (p.ovr >= 83) { reveal(np, from, fee); pressMoment('signing', p.name); }
    else toastMsg(`Signed ${p.name}`);
  }
  OV.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ng && NEG) {
      const k = b.dataset.ng, v = b.dataset.v;
      if (k === 'cancel') { NEG = null; closeModal(); return; }
      if (k === 'fee') NEG.fee = Math.max(1, NEG.fee + +v);
      else if (k === 'inst') NEG.inst = +v;
      else if (k === 'swap') NEG.swap = v === 'none' ? null : v;
      else if (k === 'bonus' || k === 'cut' || k === 'loanBack') NEG[k] = v === 'true';
      else if (k === 'offer') {
        const p = PDB_BY_ID[NEG.pid], n = NEG, now = n.inst > 1 ? Math.ceil(n.fee / n.inst) : n.fee;
        if (MC.budget < now) { toastMsg('Not enough budget for the first payment'); return; }
        if (n.dd) { ddAddTarget(p, n); NEG = null; closeModal(); mcShow('dd'); return; }
        const chance = clamp((negValue() / n.v - .82) / .3, 0, 1);
        if (Math.random() < chance) { NEG = null; closeModal(); completeSigning(p, n.fee, n, sellerOf(p)); mcShow('market'); }
        else { toastMsg(`${sellerOf(p)} rejected the offer. Improve it.`); NEG.fee += 0; drawNeg(); }
        return;
      }
      drawNeg(); return;
    }
    if (b.dataset.sell) {
      const p = MC.players.find(q => q.uid === b.dataset.sell); if (!p) { closeModal(); return; }
      const v = Math.round(valueM(p.ovr) * .8), clause = b.dataset.c === '1';
      const got = clause ? Math.round(v * .85) : v;
      MC.budget += got; MC.players = MC.players.filter(q => q !== p); MC.xi = MC.xi.filter(u => u !== p.uid);
      if (clause) X().buyback.push({ p:Object.assign({}, p), price:Math.round(valueM(p.ovr) * 1.3), until:MC.seasonNo + 2 });
      if (MC.xi.length < 11) autoXI(MC);
      logIt(`Sold ${p.name} for €${got}M${clause ? ' with a buy-back clause' : ''}`); saveMC(); closeModal(); toastMsg(`Sold ${p.name} for €${got}M`); mcShow('squad'); return;
    }
    if (b.dataset.pr && X().press) { answerPress(+b.dataset.pr); return; }
    if (b.dataset.close != null) { closeModal(); return; }
  });
  // buying from the market opens a negotiation; selling offers a buy-back clause
  $('hub').addEventListener('click', e => {
    if (!MC) return;
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const h2 = $('hub').querySelector('.hdr h2'); if (!h2 || !/^MANAGER/.test(h2.textContent)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    negotiate(b.dataset.buy, !!(X().dd && X().dd.on));
  }, true);
  document.addEventListener('click', e => {
    if (!MC || !MC.sell || !SQ || SQ.state !== MC) return;
    const bn = e.target.closest('[data-bench]'); if (!bn) return;
    e.stopImmediatePropagation();
    const p = MC.players.find(x => x.uid === bn.dataset.bench); if (!p) return;
    const v = Math.round(valueM(p.ovr) * .8);
    modal(`<h3>SELL ${esc(p.name)}?</h3><div class="mini">Clubs will pay about €${v}M.</div>
      <div class="ans" style="margin-top:12px"><button type="button" data-sell="${p.uid}" data-c="0">Sell for €${v}M</button>
      <button type="button" data-sell="${p.uid}" data-c="1">Sell for €${Math.round(v * .85)}M with a buy-back clause (re-sign him for €${Math.round(valueM(p.ovr) * 1.3)}M in the next 2 seasons)</button>
      <button type="button" data-close>Keep him</button></div>`);
  }, true);

  /* ---------------- Deadline Day ---------------- */
  const DD_LEN = 20 * 60;           // game minutes
  function ddStart(window_) {
    const x = X(); if (!x.settings.dd) return;
    x.dd = { on:true, win:window_, left:DD_LEN, targets:[], incoming:[], lastHour:20 };
    logIt(`${window_ === 'summer' ? 'Summer' : 'Winter'} Deadline Day has started`);
    saveMC();
  }
  function ddAddTarget(p, n) {
    const x = X(), d = x.dd;
    if (d.targets.filter(t => t.st === 'open').length >= 4) { toastMsg('You can run 4 negotiations at once'); return; }
    const rivals = LEAGUES.flatMap(L => L.clubs).filter(c => c.id !== MC.club && c.id !== p.club && !c.admin);
    const hot = p.ovr >= 82 || Math.random() < .55;
    d.targets.push({ pid:p.id, my:n.fee, deal:{ inst:n.inst, bonus:n.bonus, cut:n.cut, swap:n.swap, loanBack:n.loanBack }, ask:n.v, rival:hot ? { club:pick(rivals).id, bid:Math.round(n.v * (.85 + Math.random() * .2)) } : null, st:'open' });
    saveMC(); toastMsg(`Bid placed for ${p.name}`);
  }
  function ddHour() {
    const x = X(), d = x.dd;
    for (const t of d.targets) {
      if (t.st !== 'open' || !t.rival) continue;
      if (t.rival.bid <= t.my * (1.0 + Math.random() * .05) && Math.random() < .55) { t.rival.bid = Math.round(Math.max(t.rival.bid, t.my) * (1.04 + Math.random() * .08)); t.news = `${ALL[t.rival.club].name} raised to €${t.rival.bid}M`; }
      if (t.rival.bid > t.ask * 1.6 && Math.random() < .3) { t.news = `${ALL[t.rival.club].name} pulled out`; t.rival = null; }
    }
    if (Math.random() < .3 && d.incoming.length < 3) {
      const mine = MC.players.filter(q => !q.loanedTo).sort((a, b) => b.ovr - a.ovr).slice(0, 12), q = pick(mine);
      if (q) { const c = pick(LEAGUES.flatMap(L => L.clubs).filter(c => c.id !== MC.club && !c.admin)); d.incoming.push({ uid:q.uid, club:c.id, fee:Math.round(valueM(q.ovr) * (.8 + Math.random() * .5)) }); }
    }
  }
  function ddEnd() {
    const x = X(), d = x.dd; d.on = false;
    let signed = 0;
    for (const t of d.targets) {
      if (t.st !== 'open') continue;
      const p = PDB_BY_ID[t.pid], worth = t.my * (t.deal.inst === 3 ? .9 : t.deal.inst === 2 ? .95 : 1) + (t.deal.loanBack ? t.ask * .12 : 0);
      const beat = !t.rival || t.my >= t.rival.bid, ok = worth >= t.ask * (.88 + Math.random() * .12);
      const now = t.deal.inst > 1 ? Math.ceil(t.my / t.deal.inst) : t.my;
      if (beat && ok && MC.budget >= now) { t.st = 'won'; signed++; setTimeout(() => completeSigning(p, t.my, t.deal, sellerOf(p)), 400 * signed); }
      else { t.st = 'lost'; logIt(`Missed out on ${p.name}${t.rival && !beat ? ' to ' + ALL[t.rival.club].name : ''}`); }
    }
    d.incoming = [];
    logIt(`Deadline Day closed: ${signed} signing${signed === 1 ? '' : 's'}`);
    saveMC();
  }
  // the clock runs while the Deadline Day screen is open: 1 real second = 4 minutes
  setInterval(() => {
    if (!MC || !MC.x || !MC.x.dd || !MC.x.dd.on || MC.tab !== 'dd' || $('hub').offsetParent === null || !document.querySelector('.mcx-dd')) return;
    advanceDD(4);
  }, 1000);
  function advanceDD(mins) {
    const d = X().dd; if (!d || !d.on) return;
    const before = Math.ceil(d.left / 60);
    d.left = Math.max(0, d.left - mins);
    const after = Math.ceil(d.left / 60);
    for (let h = before; h > after; h--) ddHour();
    if (d.left <= 0) { ddEnd(); mcShow('dd'); return; }
    const clk = document.querySelector('.mcx-dd .clk'); if (clk) clk.textContent = ddClock(d.left);
    if (before !== after) mcShow('dd');
  }
  const ddClock = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');

  /* ---------------- press conferences ---------------- */
  const PRESS = {
    big:['Big game coming up against {o}. Can your team win it?', 'Everyone says {o} are favourites. Do you agree?'],
    lose:['That is {n} defeats in a row. Is your job safe?', 'The fans are frustrated. What do you say to them?'],
    win:['{n} wins in a row! Can anyone stop you?', 'Is this the best form of your career?'],
    title:['Champions! What does this title mean to you?'],
    signing:['{w} is your new star. What will he bring?'],
    season:['The season is over. Were you happy with it?'],
    week:['How is the squad feeling this week?']
  };
  const ANSWERS = [['Confident', 'I believe in this group. Big things are coming.', 2, 'Players fired up'], ['Calm', 'We stay focused and keep working.', 1, 'Squad settled'], ['Deflect', 'No comment. Ask me after the next game.', 0, 'Nothing changes'], ['Critical', 'Some players need to do more.', -1, 'Some players upset, others react']];
  function pressMoment(kind, ctx) {
    const x = X(), f = x.settings.press;
    if (f === 'off' || x.press) return;
    if (f === 'big' && kind === 'week') return;
    x.press = { q:pick(PRESS[kind] || PRESS.week).replace('{o}', ctx || '').replace('{n}', ctx || '').replace('{w}', ctx || ''), kind };
    saveMC();
  }
  function showPress() {
    const x = X();
    modal(`<h3>PRESS CONFERENCE</h3><div class="mini">Your answer changes squad morale and Dynamic OVR.</div><div class="q">“${esc(x.press.q)}”</div>
      <div class="ans">${ANSWERS.map((a, i) => `<button type="button" data-pr="${i}"><b>${a[0]}:</b> ${a[1]} <span class="mini">· ${a[3]}</span></button>`).join('')}</div>`);
  }
  function answerPress(i) {
    const x = X(), a = ANSWERS[i];
    let m = a[2];
    if (x.press.kind === 'lose' && i === 0) m = Math.random() < .5 ? 2 : -1;          // bold claims can backfire
    if (i === 3) m = Math.random() < .5 ? 1 : -2;
    x.morale = clamp(x.morale + m, -3, 3); logIt(`Press: ${a[0].toLowerCase()} answer, morale ${x.morale >= 0 ? '+' : ''}${x.morale}`);
    x.press = null; saveMC(); closeModal(); mcShow(MC.tab);
  }
  // Dynamic OVR: morale nudges the team's strength in simulated matches
  const _xi = xiOvr;
  xiOvr = function (state) { const v = _xi(state); return state === MC && MC && MC.x ? v + Math.round(MC.x.morale) : v; };

  /* ---------------- unexpected events ---------------- */
  function randomEvent() {
    const x = X(); if (!x.settings.events || Math.random() > .2) return;
    const fit = x.coaches.filter(c => c.spec === 'Fitness').reduce((a, c) => a + c.stars, 0);
    const r = Math.random();
    if (r < .35 - fit * .04) {
      const xi = MC.players.filter(p => MC.xi.includes(p.uid)), p = pick(xi);
      if (p) { p.inj = 2 + ((Math.random() * 3) | 0); const tmp = { players:MC.players.filter(q => !q.inj && !q.loanedTo), xi:[] }; if (tmp.players.length >= 11) { autoXI(tmp); MC.xi = tmp.xi; } logIt(`🤕 ${p.name} injured for ${p.inj} matches`); }
    } else if (r < .55) { const amt = 3 + ((Math.random() * 6) | 0); MC.budget += amt; logIt(`💰 New sponsor deal: +€${amt}M`); }
    else if (r < .72) { const p = pick(MC.players.filter(q => q.ovr >= 80)); if (p) { x.morale = clamp(x.morale - 1, -3, 3); logIt(`😠 ${p.name} is unhappy with his role. Morale −1`); } }
    else if (r < .86) { if (x.youth.length < academyCap()) { const y = youthProspect(pick(REGIONS), 2); x.youth.push(y); logIt(`⭐ Wonderkid ${y.name} walked into your academy`); } }
    else { x.morale = clamp(x.morale + 1, -3, 3); logIt('📈 A training-ground video went viral. Morale +1'); }
  }

  /* ---------------- scouting and youth ---------------- */
  function youthProspect(region, lvl) {
    const y = prospect(pick(POSLIST), 46 + lvl * 3, 55 + lvl * 4); y.youth = true; y.age = 15 + ((Math.random() * 3) | 0); y.region = region;
    y.gp = pick(['early', 'explosive', 'late', 'dynamic', 'steady']); y.pot = Math.min(MAX_OVR, Math.round(66 + Math.random() * (10 + lvl * 6) + (y.gp === 'explosive' ? 4 : 0)));
    return y;
  }
  function scoutTick() {
    const x = X();
    for (const r of REGIONS) {
      const lvl = x.scouts[r] || 0;
      if (lvl && Math.random() < lvl * .12) {
        if (x.youth.length >= academyCap()) { if (Math.random() < .3) logIt(`🔭 ${r} scouts found a talent, but the academy is full`); continue; }
        const y = youthProspect(r, lvl); x.youth.push(y); logIt(`🔭 ${r} scouts found ${y.name} (${y.pos}, ${y.age}) · POT ${forecast(dev(y))}`);
      }
    }
  }

  /* ---------------- season flow ---------------- */
  const _after = mcAfter;
  mcAfter = function (hs, as) {
    const x = X(), S2 = MC.season, rd = S2.rounds[S2.round], fxm = rd.find(f => f.includes(MC.club)), myIdx = fxm[0] === MC.club ? 0 : 1;
    const opp = fxm[1 - myIdx], my = myIdx === 0 ? hs : as, th = myIdx === 0 ? as : hs, res = my > th ? 'W' : my < th ? 'L' : 'D';
    _after(hs, as);
    x.form.push(res); x.form = x.form.slice(-6);
    x.morale = clamp(x.morale * .7 + (res === 'W' ? .7 : res === 'L' ? -.7 : 0), -3, 3);
    for (const p of MC.players) { if (p.inj) { p.inj--; if (!p.inj) logIt(`✅ ${p.name} is fit again`); } if (p.youth) p.apps = (p.apps || 0) + (MC.xi.includes(p.uid) ? 1 : 0); }
    for (const t of x.train) { t.left--; if (t.left <= 0) { const p = MC.players.find(q => q.uid === t.uid); if (p) { logIt(`🎓 ${p.name} can now play ${t.pos}`); p.pos = t.pos; p.ovr = Math.max(40, p.ovr - 1); } } }
    x.train = x.train.filter(t => t.left > 0);
    scoutTick(); randomEvent();
    const streak = k => { let n = 0; for (let i = x.form.length - 1; i >= 0 && x.form[i] === k; i--) n++; return n; };
    const ranked = S2.ids.slice().sort((a, b) => ALL[b].ovr - ALL[a].ovr);
    const nextRd = S2.rounds[S2.round], nxt = nextRd && nextRd.find(f => f.includes(MC.club));
    if (S2.round >= S2.rounds.length) seasonEnd();
    else {
      if (streak('L') >= 3) pressMoment('lose', streak('L'));
      else if (streak('W') >= 4) pressMoment('win', streak('W'));
      else if (nxt) { const o = nxt[0] === MC.club ? nxt[1] : nxt[0]; if (ranked.indexOf(o) <= 2) pressMoment('big', ALL[o].name); else pressMoment('week'); }
      if (S2.round === Math.floor(S2.rounds.length / 2) && !x.ddDone['w' + MC.seasonNo]) { x.ddDone['w' + MC.seasonNo] = 1; ddStart('winter'); }
    }
    saveMC();
  };
  function grow(p, finish, target) {
    dev(p); p.age++;
    const a = p.age, g = p.gp, play = MC.xi.includes(p.uid) ? 1 : 0;
    let d;
    if (g === 'early') d = a <= 21 ? 3 + Math.random() * 3 : a <= 25 ? 1 : a >= 29 ? -2 : 0;
    else if (g === 'late') d = a <= 22 ? 1 : a <= 27 ? 2 + Math.random() * 3 : a >= 31 ? -2 : 0;
    else if (g === 'steady') d = a <= 28 ? 1 + Math.random() * 1.5 : -1;
    else if (g === 'explosive') d = a <= 24 ? Math.random() * 7.5 : a >= 30 ? -2 : Math.random() * 2;
    else if (g === 'peaked') d = a >= 27 ? -1 - Math.random() * 2 : 0;
    else { p.pot = clamp(Math.round(p.pot + (target - finish) * 1.2), p.ovr, MAX_OVR); d = a <= 27 ? 1 + Math.random() * 3 : -1; }
    if (d > 0) d += coachBoost(p.pos) + play * .6 + (p.youth ? X().coaches.filter(c => c.spec === 'Youth').reduce((s, c) => s + c.stars * .2, 0) : 0);
    const before = p.ovr;
    p.ovr = Math.round(d > 0 ? Math.min(p.pot, p.ovr + d) : Math.max(40, p.ovr + d));
    if (a >= 33 && Math.random() < .4) p.retiring = true;
    return p.ovr - before;
  }
  function seasonEnd() {
    const x = X(), S2 = MC.season, pos = sortTable(S2.table, S2.ids).indexOf(MC.club) + 1;
    const ups = [];
    for (const p of MC.players) { const d = grow(p, pos, S2.target); if (Math.abs(d) >= 2) ups.push(`${shortName(p.name)} ${d > 0 ? '+' : ''}${d}`); }
    for (const y of x.youth) grow(y, pos, S2.target);
    if (ups.length) logIt('📊 Development: ' + ups.slice(0, 5).join(', '));
    // add-ons and instalments
    for (const b of x.bonuses) { if (b.season !== MC.seasonNo) continue; if (b.kind === 'title' && pos === 1) { MC.budget -= b.amt; logIt(`Paid €${b.amt}M title bonus for ${b.who}`); } if (b.kind === 'target' && pos > S2.target) { MC.budget -= b.amt; logIt(`Board target missed: €${-b.amt}M back on the ${b.who} deal`); } }
    x.bonuses = x.bonuses.filter(b => b.season > MC.seasonNo);
    for (const p of MC.players) if (p.loanedTo && p.loanUntil <= MC.seasonNo) { logIt(`${p.name} is back from his loan`); delete p.loanedTo; }
    const wages = x.coaches.reduce((a, c) => a + c.wage, 0); if (wages) { MC.budget -= wages; logIt(`Coaching staff wages: €${wages}M`); }
    x.academyXP += x.youth.length ? 1 : 0;
    x.coachPool = null;
    pressMoment(pos === 1 ? 'title' : 'season');
    saveMC();
  }
  const _sms = mcStartSeason;
  mcStartSeason = function () {
    _sms();
    const x = X(); if (!x) return;
    for (const d of x.dues) if (d.season === MC.seasonNo) { MC.budget -= d.amt; logIt(`Instalment paid: €${d.amt}M for ${d.who}`); }
    x.dues = x.dues.filter(d => d.season > MC.seasonNo);
    x.buyback = x.buyback.filter(b => b.until >= MC.seasonNo);
    const ret = MC.players.filter(p => p.retiring); if (ret.length) { MC.players = MC.players.filter(p => !p.retiring); MC.xi = MC.xi.filter(u => !ret.some(p => p.uid === u)); if (MC.xi.length < 11) autoXI(MC); logIt('👋 Retired: ' + ret.map(p => p.name).join(', ')); }
    if (!x.ddDone['s' + MC.seasonNo]) { x.ddDone['s' + MC.seasonNo] = 1; ddStart('summer'); }
  };

  /* ---------------- practice arena ---------------- */
  function practice() {
    const S2 = MC.season, opp = pick(S2.ids.filter(id => id !== MC.club));
    CUR_MATCH = { kind:'custom', done:() => { toastMsg('Practice over: nothing counts'); mcShow('home'); }, quit:() => mcShow('home') };
    startMatch(Object.assign(cfgFor(MC.club, opp, 0, { label:'Practice Arena · friendly' }), { squads:[xiSquad(MC), null] }));
  }

  /* ---------------- screens ---------------- */
  const TABS = [['dd', '⏱ Deadline Day'], ['dev', 'Development'], ['staff', 'Coaches'], ['scout', 'Scouting & Youth'], ['set', 'Settings']];
  const _show = mcShow;
  mcShow = function (tab) {
    if (!MC) return _show(tab);
    const x = X();
    MC.players.forEach(dev);
    if (tab) MC.tab = tab;
    const mine = TABS.some(t => t[0] === MC.tab);
    _show(mine ? 'home' : MC.tab);
    if (mine) MC.tab = tab || MC.tab;
    const card = $('hub').querySelector('.card'); if (!card) return;
    const tabsEl = card.querySelector('.tabs');
    if (tabsEl) {
      tabsEl.querySelectorAll('button[data-mt]').forEach(b => b.classList.toggle('sel', !mine && b.dataset.mt === MC.tab));
      const reset = tabsEl.querySelector('[data-mc="reset"]');
      for (const [id, n] of TABS) { if (id === 'dd' && !(x.dd && x.dd.on)) continue; const b = document.createElement('button'); b.type = 'button'; b.dataset.mx = 'tab'; b.dataset.v = id; b.textContent = n; if (id === MC.tab) b.classList.add('sel'); tabsEl.insertBefore(b, reset); }
    }
    if (mine) {
      while (tabsEl && tabsEl.nextSibling) tabsEl.nextSibling.remove();
      const host = document.createElement('div'); host.innerHTML = screen(MC.tab); card.appendChild(host);
    } else if (MC.tab === 'home') {
      const host = document.createElement('div'); host.innerHTML = homeExtras(); card.querySelector('.tabs').after(host);
      const cta = card.querySelector('.cta'); if (cta) cta.insertAdjacentHTML('afterbegin', '<button type="button" data-mx="practice">Practice Arena</button>');
    } else if (MC.tab === 'market') {
      const bb = x.buyback.filter(b => b.until >= MC.seasonNo);
      if (bb.length) card.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">BUY-BACK CLAUSES</h3><div class="mcx-list">${bb.map((b, i) => `<div class="mcx-row"><b class="o">${b.p.ovr}</b><div class="grow"><b>${esc(b.p.name)}</b> <span class="mini">${b.p.pos} · until season ${b.until}</span></div><button type="button" data-mx="buyback" data-v="${i}">Re-sign €${b.price}M</button></div>`).join('')}</div>`);
      if (x.dd && x.dd.on) card.insertAdjacentHTML('afterbegin', `<div class="mcx-dd"><b>DEADLINE DAY IS LIVE</b><span class="mini">Tapping a player places a bid in the Deadline Day race.</span><button type="button" data-mx="tab" data-v="dd">Open the countdown</button></div>`);
    }
    if (x.press && !OV.classList.contains('on')) setTimeout(showPress, 250);
  };
  function homeExtras() {
    const x = X(), injured = MC.players.filter(p => p.inj);
    const loans = MC.players.filter(p => p.loanedTo);
    const dues = x.dues.reduce((a, d) => a + d.amt, 0);
    return `${x.dd && x.dd.on ? `<div class="mcx-dd"><div><div class="mini">TRANSFER DEADLINE DAY</div><div class="clk">${ddClock(x.dd.left)}</div></div><div class="grow" style="flex:1">${x.dd.targets.filter(t => t.st === 'open').length} live bids · ${x.dd.incoming.length} offers for your players</div><button class="big" type="button" data-mx="tab" data-v="dd">GO TO DEADLINE DAY</button></div>` : ''}
      <div class="res" style="margin-top:8px"><span>Morale <b>${x.morale > 0 ? '+' : ''}${x.morale.toFixed(1)}</b></span><span>Dynamic OVR <b>${xiOvr(MC)}</b></span><span>Form <b>${x.form.join(' ') || '–'}</b></span><span>Owed <b>€${dues}M</b></span></div>
      ${injured.length || loans.length ? `<p class="mini">${injured.map(p => `🤕 ${esc(p.name)} (${p.inj})`).join(' · ')}${loans.length ? ' · On loan back: ' + loans.map(p => esc(p.name)).join(', ') : ''}</p>` : ''}
      ${x.log.length ? `<div class="mcx-list" style="margin-bottom:8px">${x.log.slice(0, 4).map(l => `<div class="mcx-row mini">${esc(l)}</div>`).join('')}</div>` : ''}`;
  }
  function screen(t) {
    const x = X();
    if (t === 'dd') {
      const d = x.dd;
      if (!d || !d.on) return '<p class="mini">Deadline Day opens at the start of each season and halfway through it.</p>';
      return `<div class="mcx-dd"><div><div class="mini">${d.win === 'summer' ? 'SUMMER' : 'WINTER'} DEADLINE DAY · TIME LEFT</div><div class="clk">${ddClock(d.left)}</div></div><div style="flex:1" class="mini">The clock runs while this screen is open. Rival clubs raise their bids every hour. Highest offer at 00:00 wins.</div>
        <button type="button" data-mx="skip">Skip 2 hours</button><button type="button" data-mt="market">+ New bid</button></div>
        <h3>YOUR BIDS (${d.targets.filter(t => t.st === 'open').length}/4)</h3><div class="mcx-list">${d.targets.map((tg, i) => { const p = PDB_BY_ID[tg.pid]; return `<div class="mcx-row"><b class="o">${p.ovr}</b><div class="grow"><b>${esc(p.name)}</b> <span class="mini">${p.pos} · asking €${tg.ask}M</span><div class="mini">You: <b>€${tg.my}M</b>${tg.rival ? ` · ${esc(ALL[tg.rival.club].name)}: <b style="color:${tg.rival.bid > tg.my ? '#ff6b6b' : '#7ee787'}">€${tg.rival.bid}M</b>` : ' · no rivals'}${tg.news ? ' · ' + esc(tg.news) : ''}</div></div>
          ${tg.st === 'open' ? `<button type="button" data-mx="raise" data-v="${i}">Raise +10%</button><button type="button" data-mx="drop" data-v="${i}">Withdraw</button>` : `<span class="mcx-tag">${tg.st === 'won' ? '✅ SIGNED' : '❌ ' + tg.st.toUpperCase()}</span>`}</div>`; }).join('') || '<p class="mini">No bids yet. Go to Transfers and tap a player.</p>'}</div>
        <h3 style="margin-top:12px">OFFERS FOR YOUR PLAYERS</h3><div class="mcx-list">${d.incoming.map((o, i) => { const p = MC.players.find(q => q.uid === o.uid); if (!p) return ''; return `<div class="mcx-row"><b class="o">${p.ovr}</b><div class="grow"><b>${esc(p.name)}</b> <span class="mini">${esc(ALL[o.club].name)} offer €${o.fee}M</span></div><button type="button" data-mx="acc" data-v="${i}">Accept</button><button type="button" data-mx="rej" data-v="${i}">Reject</button></div>`; }).join('') || '<p class="mini">No offers yet.</p>'}</div>`;
    }
    if (t === 'dev') {
      const ps = MC.players.slice().sort((a, b) => (MC.xi.includes(b.uid) - MC.xi.includes(a.uid)) || b.ovr - a.ovr);
      return `<p class="mini">Each player follows one of six growth profiles. Coaches in his area help him grow, and Analysis coaches make the potential forecast exact.</p>
        <div class="opt" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${Object.values(PROFILES).map(g => `<span class="mcx-gp" style="background:${g.c}" title="${g.d}">${g.n}</span>`).join('')}</div>
        <div class="mcx-list">${ps.map(p => { const g = PROFILES[p.gp]; const tr = x.train.find(t => t.uid === p.uid); return `<div class="mcx-row"><b class="o">${p.ovr}</b><div class="grow"><b>${esc(p.name)}</b> <span class="mini">${p.pos} · age ${p.age}${p.inj ? ' · 🤕' : ''}${tr ? ` · training ${tr.pos} (${tr.left})` : ''}</span><div class="mini">Potential <b>${forecast(p)}</b> · <span class="mcx-gp" style="background:${g.c}">${g.n}</span> ${g.d}</div></div>
          <select data-mx="train" data-v="${p.uid}" style="background:#1b2340;color:#fff;border-radius:6px;padding:4px"><option value="">Train new position…</option>${POSLIST.filter(q => q !== p.pos).map(q => `<option value="${q}">${q}</option>`).join('')}</select></div>`; }).join('')}</div>`;
    }
    if (t === 'staff') {
      if (!x.coachPool) x.coachPool = Array.from({ length:6 }, newCoach);
      return `<p class="mini">Hire up to 12 coaches. Wages are paid at the end of each season. Position coaches speed up growth, Analysis narrows potential forecasts, Fitness prevents injuries, Youth grows your academy. Position retraining (Development tab) needs a coach for that area.</p>
        <h3>YOUR STAFF (${x.coaches.length}/12)</h3><div class="mcx-list">${x.coaches.map((c, i) => `<div class="mcx-row"><div class="grow"><b>${esc(c.name)}</b> <span class="mini">${c.spec} coach</span><div>${'★'.repeat(c.stars)}<span style="opacity:.3">${'★'.repeat(5 - c.stars)}</span></div></div><span class="mini">€${c.wage}M/season</span><button type="button" data-mx="fire" data-v="${i}">Release</button></div>`).join('') || '<p class="mini">No coaches yet.</p>'}</div>
        <h3 style="margin-top:12px">AVAILABLE</h3><div class="mcx-list">${x.coachPool.map((c, i) => `<div class="mcx-row"><div class="grow"><b>${esc(c.name)}</b> <span class="mini">${c.spec} coach</span><div>${'★'.repeat(c.stars)}<span style="opacity:.3">${'★'.repeat(5 - c.stars)}</span></div></div><span class="mini">€${c.wage}M/season</span><button type="button" data-mx="hire" data-v="${i}">Hire</button></div>`).join('')}</div>`;
    }
    if (t === 'scout') {
      const cost = l => [3, 6, 10][l] || 0;
      return `<p class="mini">Upgrade your scouting network in each region (4 levels). Better scouts find better youngsters more often. Academy capacity: <b>${x.youth.length}/${academyCap()}</b> (grows with academy experience and Youth coaches).</p>
        <div class="mcx-list">${REGIONS.map(r => { const l = x.scouts[r] || 0; return `<div class="mcx-row"><div class="grow"><b>${r}</b><div class="mini">${['No scouts', 'Regional scout', 'National network', 'Elite network'][l]}</div></div><div>${'●'.repeat(l)}<span style="opacity:.3">${'●'.repeat(3 - l)}</span></div>${l < 3 ? `<button type="button" data-mx="scout" data-v="${r}">Upgrade €${cost(l)}M</button>` : '<span class="mcx-tag">MAX</span>'}</div>`; }).join('')}</div>
        <h3 style="margin-top:12px">YOUTH ACADEMY</h3><div class="mcx-list">${x.youth.map((y, i) => `<div class="mcx-row"><b class="o">${y.ovr}</b><div class="grow"><b>${esc(y.name)}</b> <span class="mini">${y.pos} · age ${y.age} · ${y.region}</span><div class="mini">Potential <b>${forecast(dev(y))}</b> · ${PROFILES[y.gp].n}</div></div><button type="button" data-mx="promote" data-v="${i}">Promote</button><button type="button" data-mx="release" data-v="${i}">Release</button></div>`).join('') || '<p class="mini">No youngsters yet. Scouts report after every matchday.</p>'}</div>`;
    }
    if (t === 'set') {
      const o = (k, v, l) => `<button type="button" data-mx="set" data-k="${k}" data-v="${v}" class="${String(x.settings[k]) === String(v) ? 'sel' : ''}">${l}</button>`;
      return `<div class="row" style="margin:8px 0"><span class="lab" style="min-width:160px">PRESS CONFERENCES</span>${o('press', 'off', 'Off')}${o('press', 'big', 'Big moments')}${o('press', 'often', 'Every week')}</div>
        <div class="row" style="margin:8px 0"><span class="lab" style="min-width:160px">UNEXPECTED EVENTS</span>${o('events', true, 'On')}${o('events', false, 'Off')}</div>
        <div class="row" style="margin:8px 0"><span class="lab" style="min-width:160px">DEADLINE DAY</span>${o('dd', true, 'On')}${o('dd', false, 'Off (instant transfers)')}</div>
        <h3 style="margin-top:12px">CLUB NEWS</h3><div class="mcx-list">${x.log.map(l => `<div class="mcx-row mini">${esc(l)}</div>`).join('') || '<p class="mini">Nothing yet.</p>'}</div>`;
    }
    return '';
  }

  /* ---------------- clicks ---------------- */
  $('hub').addEventListener('change', e => {
    const s = e.target.closest('select[data-mx="train"]'); if (!s || !MC || !s.value) return;
    const x = X(), p = MC.players.find(q => q.uid === s.dataset.v), area = Object.keys(AREAS).find(a => AREAS[a].includes(s.value));
    if (!x.coaches.some(c => c.spec === area)) { toastMsg(`Hire a ${area} coach first`); s.value = ''; return; }
    if (x.train.length >= 7) { toastMsg('Up to 7 players can retrain at once'); s.value = ''; return; }
    x.train = x.train.filter(t => t.uid !== p.uid); x.train.push({ uid:p.uid, pos:s.value, left:6 });
    saveMC(); toastMsg(`${p.name} starts training as a ${s.value} (6 matches)`); mcShow('dev');
  });
  $('hub').addEventListener('click', e => {
    const b = e.target.closest('[data-mx]'); if (!b || !MC || b.tagName === 'SELECT') return;
    const x = X(), a = b.dataset.mx, v = b.dataset.v;
    if (a === 'tab') { mcShow(v); return; }
    if (a === 'practice') { practice(); return; }
    if (a === 'skip') { advanceDD(120); return; }
    const d = x.dd;
    if (a === 'raise' && d) { const t = d.targets[+v]; t.my = Math.round(t.my * 1.1) || t.my + 1; saveMC(); mcShow('dd'); return; }
    if (a === 'drop' && d) { d.targets[+v].st = 'withdrawn'; saveMC(); mcShow('dd'); return; }
    if ((a === 'acc' || a === 'rej') && d) {
      const o = d.incoming[+v]; d.incoming.splice(+v, 1);
      if (a === 'acc') { const p = MC.players.find(q => q.uid === o.uid); if (p) { MC.budget += o.fee; MC.players = MC.players.filter(q => q !== p); MC.xi = MC.xi.filter(u => u !== p.uid); if (MC.xi.length < 11) autoXI(MC); logIt(`Sold ${p.name} to ${ALL[o.club].name} for €${o.fee}M`); } }
      saveMC(); mcShow('dd'); return;
    }
    if (a === 'hire') { if (x.coaches.length >= 12) { toastMsg('Your staff is full (12)'); return; } const c = x.coachPool.splice(+v, 1)[0]; x.coaches.push(c); logIt(`Hired ${c.name} (${c.spec}, ${c.stars}★)`); saveMC(); mcShow('staff'); return; }
    if (a === 'fire') { const c = x.coaches.splice(+v, 1)[0]; logIt(`Released ${c.name}`); saveMC(); mcShow('staff'); return; }
    if (a === 'scout') { const l = x.scouts[v] || 0, cost = [3, 6, 10][l]; if (MC.budget < cost) { toastMsg('Not enough budget'); return; } MC.budget -= cost; x.scouts[v] = l + 1; saveMC(); mcShow('scout'); return; }
    if (a === 'promote') { const y = x.youth.splice(+v, 1)[0]; MC.players.push(y); x.academyXP += 1; logIt(`🎓 ${y.name} promoted to the first team`); saveMC(); mcShow('scout'); return; }
    if (a === 'release') { x.youth.splice(+v, 1); saveMC(); mcShow('scout'); return; }
    if (a === 'buyback') { const bb = x.buyback[+v]; if (MC.budget < bb.price) { toastMsg('Not enough budget'); return; } MC.budget -= bb.price; x.buyback.splice(+v, 1); const p = Object.assign({}, bb.p, { uid:'u' + (UID++) }); MC.players.push(p); logIt(`Activated the buy-back clause: ${p.name} is back`); saveMC(); mcShow('market'); return; }
    if (a === 'set') { const k = b.dataset.k; x.settings[k] = v === 'true' ? true : v === 'false' ? false : v; saveMC(); mcShow('set'); return; }
  });
})();
