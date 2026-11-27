/* Kickoff Rivals: Manager Career, season 2.
   - Fast sims are back: Quick sim (instant), ×5, or straight to the end of the season. A sim run stops when
     something happens that needs your decision.
   - Ratings go up to 999. Cards above 140 get new looks (Galactic, Celestial, Divine, Infinity, and a 999 card).
     In a played match the extra rating levels off so players don't run at light speed; in simulations it all counts.
   - Scout Packs bought with your transfer budget, from €15M scouts up to the €1.5T Infinity Pack.
   - Training Lab (pay to raise any player's OVR) and a Stadium you upgrade for more match-day income.
   - Prize money for every match, a Kickoff Cup (4 knockout rounds through the season) and 3 board
     objectives each season with rewards.
   - 20 random events: takeovers, contract demands, bids for your stars, mystery agents, wonderkids,
     derby fever, leaks, floods, free agents, a meteor shower... many of them make you choose. */
(function () {
  if (typeof mcShow !== 'function' || !window.simMatch) return;

  const pick = a => a[(Math.random() * a.length) | 0], rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const money = n => { n = Math.round(n); const a = Math.abs(n); return (n < 0 ? '-€' : '€') + (a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'T' : a >= 1000 ? (a / 1000).toFixed(a >= 1e4 ? 0 : 1) + 'B' : a + 'M'); };
  const OV = () => document.getElementById('mcx');
  const modal = h => { const o = OV(); if (!o) return; o.innerHTML = `<div class="box">${h}</div>`; o.classList.add('on'); };
  const closeM = () => { const o = OV(); if (o) o.classList.remove('on'); };
  const squadOf = id => { try { return autoSquad(ALL[id]); } catch (e) { return null; } };
  const xi = () => xiOvr(MC);
  const xiPlayers = () => MC.players.filter(p => MC.xi.includes(p.uid));
  const log = m => { if (MC.x && MC.x.log) { MC.x.log.unshift(m); MC.x.log.length = Math.min(MC.x.log.length, 8); } };
  const morale = d => { if (MC.x) MC.x.morale = clamp((MC.x.morale || 0) + d, -3, 3); };
  const capOvr = o => Math.max(40, Math.min(MAX_OVR, Math.round(o)));
  function G() {
    if (!MC) return null;
    if (!MC.g) MC.g = { stadium:1, obj:null, st:null, cup:null, pend:null, last:[], flags:{} };
    if (!MC.g.st) MC.g.st = { gf:0, ga:0, cs:0, streak:0, best:0, unb:0, bestUnb:0, big:0 };
    return MC.g;
  }
  const income = res => { const v = xi(); return Math.round((res === 'W' ? 1 : res === 'D' ? .5 : .25) * (3 + v * .05 + valueM(v) * .01)); };
  const homeIncome = () => Math.round(G().stadium * (1.5 + valueM(xi()) * .002));

  /* ================= board objectives ================= */
  const OBJ = {
    streak:{ make:() => { const n = pick([3, 4, 5]); return { t:`Win ${n} league matches in a row`, n }; }, ok:(o, s) => s.best >= o.n },
    goals:{ make:() => { const n = Math.round(MC.season.rounds.length * pick([1.5, 1.9, 2.3])); return { t:`Score ${n} league goals`, n }; }, ok:(o, s) => s.gf >= o.n },
    cs:{ make:() => { const n = pick([5, 7, 9]); return { t:`Keep ${n} clean sheets`, n }; }, ok:(o, s) => s.cs >= o.n },
    unb:{ make:() => { const n = pick([6, 8, 10]); return { t:`Go ${n} league matches unbeaten`, n }; }, ok:(o, s) => s.bestUnb >= o.n },
    star:{ make:() => { const n = Math.max(80, Math.round(xi() + pick([4, 8, 14]))); return { t:`Have a player rated ${n}+`, n }; }, ok:o => MC.players.some(p => p.ovr >= o.n) },
    cup:{ make:() => ({ t:'Reach the Kickoff Cup semi-finals', n:2 }), ok:o => G().cup && G().cup.round >= o.n },
    big:{ make:() => { const n = pick([3, 4, 5]); return { t:`Win a match by ${n}+ goals`, n }; }, ok:(o, s) => s.big >= o.n }
  };
  function newObjectives() {
    const ids = Object.keys(OBJ).sort(() => Math.random() - .5).slice(0, 3);
    return ids.map(id => Object.assign({ id, done:false, prize:Math.round(8 + xi() * .3 + valueM(xi()) * .06) }, OBJ[id].make()));
  }
  function checkObjectives() {
    const g = G(); if (!g.obj) return;
    for (const o of g.obj) if (!o.done && OBJ[o.id] && OBJ[o.id].ok(o, g.st)) { o.done = true; MC.budget += o.prize; log(`🎯 Objective done: ${o.t} (+${money(o.prize)})`); toastMsg(`🎯 Objective complete! +${money(o.prize)}`); }
  }

  /* ================= Kickoff Cup ================= */
  const CUP_RD = ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
  function newCup() { const n = MC.season.rounds.length; return { round:0, out:false, won:false, due:false, opp:null, at:[.2, .45, .7, .9].map(f => Math.max(1, Math.floor(n * f))) }; }
  function cupOpponent(r) {
    const pool = LEAGUES.flatMap(L => L.clubs).filter(c => c.id !== MC.club && !c.admin && !c.nation);
    const want = ALL[MC.club].ovr - 4 + r * 3;
    const near = pool.slice().sort((a, b) => Math.abs(a.ovr - want) - Math.abs(b.ovr - want)).slice(0, 8);
    return pick(near).id;
  }
  function cupCheckDue() {
    const c = G().cup; if (!c || c.out || c.won || c.due) return;
    if (MC.season.round >= c.at[c.round]) { c.due = true; c.opp = cupOpponent(c.round); log(`🏆 Kickoff Cup ${CUP_RD[c.round]}: you drew ${ALL[c.opp].name}`); }
  }
  function cupResult(my, th) {
    const c = G().cup, opp = c.opp; let win = my > th, pens = '';
    if (my === th) { const p = clamp(.5 + (xi() - ALL[opp].ovr) * .01, .2, .8); win = Math.random() < p; pens = win ? ' (won on penalties)' : ' (lost on penalties)'; }
    c.due = false; c.opp = null;
    const prize = Math.round((c.round + 1) * (5 + xi() * .1 + valueM(xi()) * .02));
    if (win) {
      MC.budget += prize; c.round++;
      if (c.round >= 4) { c.won = true; MC.trophies.push(`Kickoff Cup S${MC.seasonNo}`); morale(1); log(`🏆 KICKOFF CUP WINNERS! +${money(prize)}`); toastMsg('🏆 You won the Kickoff Cup!'); }
      else { log(`✅ Cup: beat ${ALL[opp].name} ${my}-${th}${pens}. Into the ${CUP_RD[c.round]} (+${money(prize)})`); toastMsg(`Cup: through to the ${CUP_RD[c.round]}!`); }
    } else { c.out = true; morale(-.5); log(`❌ Knocked out of the cup by ${ALL[opp].name} ${my}-${th}${pens}`); toastMsg('Knocked out of the cup'); }
    checkObjectives(); saveMC();
  }
  function cupSim() {
    const c = G().cup, mine = { ovr:xi(), sq:xiSquad(MC) }, them = { ovr:ALL[c.opp].ovr + c.round * 2, sq:squadOf(c.opp) };
    const r = simMatch(mine, them, { neutral:c.round === 3 });
    G().last.unshift(`🏆 ${ALL[MC.club].code} ${r.hs}-${r.as} ${ALL[c.opp].code}`); G().last.length = Math.min(G().last.length, 6);
    cupResult(r.hs, r.as);
  }
  function cupPlay() {
    const c = G().cup;
    CUR_MATCH = { kind:'custom', done:res => { cupResult(res.hs, res.as); mcShow('home'); }, quit:() => mcShow('home') };
    startMatch(Object.assign(cfgFor(MC.club, c.opp, 0, { label:`Kickoff Cup · ${CUP_RD[c.round]}` }), { squads:[xiSquad(MC), null] }));
  }

  /* ================= random events ================= */
  const best = () => xiPlayers().sort((a, b) => b.ovr - a.ovr)[0];
  const rndXI = () => pick(xiPlayers());
  const bench = () => MC.players.filter(p => !MC.xi.includes(p.uid) && !p.loanedTo);
  function removePlayer(p) { MC.players = MC.players.filter(q => q !== p); MC.xi = MC.xi.filter(u => u !== p.uid); if (MC.xi.length < 11) autoXI(MC); }
  function newcomer(ovr, pos) { const p = prospect(pos || pick(SLOT_POS), 60, 60); p.ovr = capOvr(ovr); p.age = rint(19, 29); return p; }
  const EV = {
    takeover:{ w:1, choice:true, make:() => ({ amt:Math.round(40 + xi() * 1.5 + valueM(xi()) * .3) }),
      title:'💼 Takeover bid', text:d => `A billionaire group wants to buy the club and offers <b>${money(d.amt)}</b> for transfers. They'll also raise the board's target by one place.`,
      opts:[['Accept the money', d => { MC.budget += d.amt; MC.season.target = Math.max(1, MC.season.target - 1); log(`💼 Takeover: +${money(d.amt)}, board target raised`); }], ['Stay independent', () => { morale(1); log('💼 Rejected the takeover. Fans love it, morale +1'); }]] },
    contract:{ w:3, choice:true, need:() => !!best(), make:() => { const p = best(); return { uid:p.uid, name:p.name, fee:Math.round(Math.min(valueM(p.ovr) * .08, 60 + p.ovr * 3)) }; },
      title:'✍️ Contract demand', text:d => `<b>${esc(d.name)}</b> wants a new contract worth <b>${money(d.fee)}</b>, or he'll sulk.`,
      opts:[['Pay him', d => { if (MC.budget < d.fee) { morale(-1); log(`✍️ Couldn't afford ${d.name}'s demands. Morale −1`); return; } MC.budget -= d.fee; morale(.5); log(`✍️ ${d.name} signed a new deal (${money(d.fee)})`); }], ['Refuse', d => { morale(-1); log(`✍️ Refused ${d.name}'s demands. Morale −1`); }]] },
    bid:{ w:3, choice:true, need:() => xiPlayers().length > 0, make:() => { const p = rndXI(); const club = pick(LEAGUES.flatMap(L => L.clubs).filter(c => c.id !== MC.club && !c.nation)); return { uid:p.uid, name:p.name, ovr:p.ovr, club:club.name, fee:Math.round(valueM(p.ovr) * (1.3 + Math.random() * .5)) }; },
      title:'📞 Transfer bid', text:d => `${esc(d.club)} bid <b>${money(d.fee)}</b> for <b>${esc(d.name)}</b> (${d.ovr}). That's well over his value.`,
      opts:[['Sell', d => { const p = MC.players.find(q => q.uid === d.uid); if (p) { removePlayer(p); MC.budget += d.fee; log(`📞 Sold ${d.name} to ${d.club} for ${money(d.fee)}`); } }], ['Not for sale', d => { morale(.5); log(`📞 Turned down ${d.club}'s bid for ${d.name}`); }]] },
    wonderkid:{ w:2, choice:true, make:() => ({ cost:rint(4, 10), pos:pick(SLOT_POS) }),
      title:'⭐ Wonderkid on trial', text:d => `A 16-year-old ${d.pos} impressed in a trial. His family wants a <b>${money(d.cost)}</b> signing-on fee. Nobody knows how good he'll get.`,
      opts:[['Sign him', d => { if (MC.budget < d.cost) { log('⭐ Not enough budget for the wonderkid'); return; } MC.budget -= d.cost; const y = newcomer(rint(55, 66), d.pos); y.age = 16; y.youth = true; y.gp = pick(['early', 'explosive', 'late']); y.pot = capOvr(xi() + rint(5, 30)); MC.players.push(y); log(`⭐ Signed wonderkid ${y.name}`); }], ['Pass', () => log('⭐ Passed on the wonderkid')]] },
    agent:{ w:2, choice:true, make:() => ({ cost:Math.round(8 + xi() * .3 + valueM(xi()) * .15) }),
      title:'🕶 Mystery agent', text:d => `A shady agent offers a "secret superstar" for <b>${money(d.cost)}</b>. No scouting reports, no refunds.`,
      opts:[['Take the gamble', d => { if (MC.budget < d.cost) { log('🕶 Not enough budget for the agent'); return; } MC.budget -= d.cost; const good = Math.random() < .55; const p = newcomer(xi() + (good ? rint(5, 20) : -rint(10, 25))); MC.players.push(p); log(good ? `🕶 Jackpot! ${p.name} (${p.ovr}) is the real deal` : `🕶 Scammed: ${p.name} is only ${p.ovr}`); toastMsg(good ? '🕶 The gamble paid off!' : '🕶 That was a dud...'); }], ['Walk away', () => log('🕶 Ignored the mystery agent')]] },
    training:{ w:2, choice:true, make:() => ({}),
      title:'🏋️ Brutal training camp', text:() => 'The fitness coach wants a week of double sessions. It could make the squad sharper, or break someone.',
      opts:[['Push them hard', () => { if (Math.random() < .4) { const hurt = xiPlayers().sort(() => Math.random() - .5).slice(0, 2); hurt.forEach(p => p.inj = rint(2, 3)); log('🏋️ Two players got injured in training: ' + hurt.map(p => p.name).join(', ')); } else { const up = xiPlayers().sort(() => Math.random() - .5).slice(0, 3); up.forEach(p => p.ovr = capOvr(p.ovr + 2)); log('🏋️ The camp worked: ' + up.map(p => p.name).join(', ') + ' +2'); } }], ['Rest instead', () => { morale(-.3); log('🏋️ Skipped the camp'); }]] },
    derby:{ w:2, make:() => ({}), auto:() => { G().flags.derby = true; log('🔥 Derby fever! The next league match pays triple prize money'); toastMsg('🔥 Derby fever: next match pays ×3'); } },
    kit:{ w:2, choice:true, make:() => ({ amt:Math.round(6 + xi() * .1 + valueM(xi()) * .05) }),
      title:'👕 Garish kit deal', text:d => `A sponsor will pay <b>${money(d.amt)}</b> if you play in a neon-pink third kit. The players hate it.`,
      opts:[['Take the money', d => { MC.budget += d.amt; morale(-.3); log(`👕 Neon kit deal: +${money(d.amt)}`); }], ['Say no', () => { morale(.3); log('👕 Turned down the neon kit') }]] },
    protest:{ w:1, choice:true, make:() => ({ amt:Math.round(4 + valueM(xi()) * .02) }),
      title:'📢 Fan protest', text:d => `Fans are protesting ticket prices. Cutting them would cost about <b>${money(d.amt)}</b>.`,
      opts:[['Cut prices', d => { MC.budget -= d.amt; morale(1); log('📢 Cut ticket prices. Morale +1'); }], ['Ignore them', () => { morale(-1); log('📢 Ignored the protest. Morale −1'); }]] },
    legend:{ w:1, need:() => MC.x && MC.x.coaches && MC.x.coaches.length < 12, make:() => ({}), auto:() => { const c = { id:'c' + Date.now(), name:pick(GIVEN) + ' ' + pick(SURN), spec:pick(['Attack', 'Midfield', 'Defence', 'Fitness', 'Youth']), stars:5, wage:0 }; MC.x.coaches.push(c); log(`🐐 Club legend ${c.name} joined as a 5★ ${c.spec} coach, for free!`); } },
    lottery:{ w:2, make:() => ({}), auto:() => { const a = Math.round(2 + valueM(xi()) * .03); MC.budget += a; log(`🎟 The club lottery raised ${money(a)}`); } },
    potm:{ w:3, need:() => xiPlayers().length > 0, make:() => ({}), auto:() => { const p = rndXI(); p.ovr = capOvr(p.ovr + 2); morale(.5); log(`🏅 ${p.name} is Player of the Month: +2 OVR`); } },
    leak:{ w:1, choice:true, make:() => ({ cost:Math.round(5 + valueM(xi()) * .02) }),
      title:'📰 Tactics leaked', text:d => 'A newspaper printed your team talk and tactics. Your next opponent knows everything.',
      opts:[['Sue the paper', d => { MC.budget -= d.cost; log(`📰 Sued the newspaper (${money(d.cost)})`); }], ['Ignore it', () => { G().flags.leak = true; log('📰 Next opponent knows your tactics (+5 OVR for them)'); }]] },
    freeagent:{ w:1, choice:true, make:() => { const o = capOvr(xi() + rint(8, 16)); return { ovr:o, pos:pick(SLOT_POS), fee:Math.round(valueM(o) * .3) }; },
      title:'🆓 Superstar free agent', text:d => `A ${d.ovr}-rated ${d.pos} is a free agent. His signing-on fee is <b>${money(d.fee)}</b>.`,
      opts:[['Sign him', d => { if (MC.budget < d.fee) { log('🆓 Not enough budget for the free agent'); return; } MC.budget -= d.fee; const p = newcomer(d.ovr, d.pos); MC.players.push(p); log(`🆓 Signed ${p.name} (${p.ovr})`); }], ['Pass', () => log('🆓 Passed on the free agent')]] },
    meteor:{ w:.4, need:() => MC.players.length > 0, make:() => ({}), auto:() => { const p = pick(MC.players), up = rint(20, 60); p.ovr = capOvr(p.ovr + up); log(`☄️ A meteor shower lit up the training ground. ${p.name} feels different: +${up} OVR!`); toastMsg(`☄️ ${p.name} +${up} OVR!`); } },
    flood:{ w:1, choice:true, make:() => ({ cost:Math.round(5 + valueM(xi()) * .03) }),
      title:'🌧 Stadium flooded', text:d => `A storm flooded the stadium. Repairs cost <b>${money(d.cost)}</b>, or you play the next 3 home games elsewhere (no match-day income).`,
      opts:[['Pay for repairs', d => { MC.budget -= d.cost; log(`🌧 Repaired the stadium (${money(d.cost)})`); }], ['Play elsewhere', () => { G().flags.away = 3; log('🌧 Next 3 home games moved: no match-day income'); }]] },
    mystery:{ w:1, make:() => ({}), auto:() => { const pk = MPACKS[clamp(Math.floor((xi() - 70) / 12), 0, MPACKS.length - 2)]; const c = pk.f(); addMC([c]); log(`🎁 A sponsor sent a free ${pk.n}: ${c.name} (${c.ovr})`); toastMsg(`🎁 Free ${pk.n}: ${c.name} ${c.ovr}`); } },
    viral:{ w:1, need:() => bench().length > 0, make:() => ({}), auto:() => { const p = pick(bench()); p.ovr = capOvr(p.ovr + 4); morale(.3); log(`📱 ${p.name}'s skills video went viral. Confidence +4 OVR`); } },
    swap:{ w:1, choice:true, need:() => bench().length > 0, make:() => { const p = pick(bench()), club = pick(LEAGUES.flatMap(L => L.clubs).filter(c => c.id !== MC.club && !c.nation)); return { uid:p.uid, name:p.name, ovr:p.ovr, club:club.name, theirs:capOvr(p.ovr + rint(3, 8)), pos:p.pos }; },
      title:'🔄 Swap offer', text:d => `${esc(d.club)} want <b>${esc(d.name)}</b> (${d.ovr}) and offer their ${d.pos}, rated <b>${d.theirs}</b>, in a straight swap.`,
      opts:[['Do the swap', d => { const p = MC.players.find(q => q.uid === d.uid); if (!p) return; removePlayer(p); const n = newcomer(d.theirs, d.pos); MC.players.push(n); log(`🔄 Swapped ${d.name} for ${n.name} (${n.ovr})`); }], ['No thanks', () => log('🔄 Turned down the swap')]] },
    injurycrisis:{ w:1.5, need:() => xiPlayers().length > 0, make:() => ({}), auto:() => { const fit = MC.x ? MC.x.coaches.filter(c => c.spec === 'Fitness').reduce((a, c) => a + c.stars, 0) : 0; if (Math.random() < fit * .08) { log('💪 Your Fitness coaches stopped an injury'); return; } const p = rndXI(); p.inj = rint(1, 3); log(`🤕 ${p.name} picked up a knock (${p.inj} matches)`); } }
  };
  function rollEvent() {
    if (!MC.x || MC.x.settings.events === false || G().pend || Math.random() > .33) return;
    const list = Object.entries(EV).filter(([, e]) => !e.need || e.need());
    let r = Math.random() * list.reduce((a, [, e]) => a + e.w, 0), id = list[0][0];
    for (const [k, e] of list) { r -= e.w; if (r <= 0) { id = k; break; } }
    const e = EV[id], d = e.make();
    if (e.auto) { e.auto(d); return; }
    G().pend = { id, d };
  }
  function showEvent() {
    const g = G(), pe = g && g.pend; if (!pe || !EV[pe.id]) { if (g) g.pend = null; return false; }
    const o = OV(); if (!o || o.classList.contains('on')) return false;
    const e = EV[pe.id];
    modal(`<h3>${e.title}</h3><p class="q">${e.text(pe.d)}</p><div class="ans">${e.opts.map((op, i) => `<button type="button" data-mge="${i}">${op[0]}</button>`).join('')}</div><p class="mini" style="margin-top:10px">Budget ${money(MC.budget)}</p>`);
    return true;
  }

  /* ================= scout packs ================= */
  function boosted(lo, hi, rar, rlo, rhi) { const p = realPick(rlo || 86, rhi || 93); p.ovr = capOvr(rint(lo, hi)); p.hero = true; if (rar) p.rar = rar; return p; }
  const MPACKS = [
    { id:'scout', n:'Scout Pack', c:15, d:'1 player · 75-84', f:() => realPick(75, 84) },
    { id:'gold', n:'Gold Scout', c:45, d:'1 player · 83-89', f:() => realPick(83, 89) },
    { id:'elite', n:'Elite Scout', c:110, d:'1 star · 88-94', f:() => realPick(88, 94) },
    { id:'icon', n:'Icon Pack', c:2000, d:'1 boosted icon · 100-125', f:() => boosted(100, 125) },
    { id:'cosmic', n:'Cosmic Pack', c:40000, d:'130-160', f:() => boosted(130, 160, 'cosmic') },
    { id:'galactic', n:'Galactic Pack', c:90000, d:'160-250', f:() => boosted(160, 250, 'galactic') },
    { id:'celestial', n:'Celestial Pack', c:250000, d:'250-450', f:() => boosted(250, 450, 'celestial') },
    { id:'divine', n:'Divine Pack', c:650000, d:'450-700', f:() => boosted(450, 700, 'divine') },
    { id:'infinity', n:'Infinity Pack', c:1500000, d:'700-999 · 5% chance of a 999', f:() => { const p = boosted(700, 998, 'infinity'); if (Math.random() < .05) p.ovr = 999; return p; } }
  ];
  function addMC(cards) {
    for (const c of cards) {
      const dup = c.pid && MC.players.find(p => p.pid === c.pid);
      if (dup) { dup.ovr = capOvr(Math.max(dup.ovr + 2, c.ovr)); if (c.rar) dup.rar = c.rar; }
      else MC.players.push(c);
    }
  }
  function buyPack(id) {
    const P = MPACKS.find(p => p.id === id); if (!P) return;
    if (MC.budget < P.c) { toastMsg('Not enough budget'); return; }
    MC.budget -= P.c; const cards = [P.f()]; addMC(cards); log(`🎁 ${P.n}: ${cards[0].name} (${cards[0].ovr})`); saveMC();
    revealCards(cards, [''], () => showTab('packs'));
  }

  /* ================= training lab & stadium ================= */
  const labCost = o => Math.max(2, Math.ceil((valueM(o + 1) - valueM(o)) * .6));
  const stadCost = () => Math.round(25 * G().stadium * G().stadium * (1 + valueM(xi()) * .002));
  function train(uid, n) {
    const p = MC.players.find(q => q.uid === uid); if (!p) return;
    let done = 0;
    for (let i = 0; i < n && p.ovr < MAX_OVR; i++) { const c = labCost(p.ovr); if (MC.budget < c) break; MC.budget -= c; p.ovr++; done++; }
    if (!done) toastMsg('Not enough budget'); else { if (p.pot != null && p.pot < p.ovr) p.pot = p.ovr; log(`🧪 Lab: ${p.name} +${done} → ${p.ovr}`); }
    saveMC(); showTab('lab');
  }

  /* ================= fast sims ================= */
  function nextFixture() { const S2 = MC.season, rd = S2.rounds[S2.round]; return rd && rd.find(f => f.includes(MC.club)); }
  function quickSim() {
    const g = G();
    if (g.cup && g.cup.due) { cupSim(); return true; }
    const fxm = nextFixture(); if (!fxm) return false;
    const myIdx = fxm[0] === MC.club ? 0 : 1, oid = fxm[1 - myIdx];
    const mine = { ovr:xi(), sq:xiSquad(MC) }, them = { ovr:ALL[oid].ovr + (g.flags.leak ? 5 : 0), sq:squadOf(oid) };
    g.flags.leak = false;
    const r = myIdx === 0 ? simMatch(mine, them) : simMatch(them, mine);
    mcAfter(r.hs, r.as);
    return true;
  }
  function runSims(n) {
    const g = G(); let k = 0;
    while (k < n) {
      if (!nextFixture() && !(g.cup && g.cup.due)) break;
      if (!quickSim()) break; k++;
      if (g.pend) break;                                       // something needs your decision
    }
    saveMC(); mcShow('home');
    const last = g.last[0];
    if (k > 1) toastMsg(`⚡ Simulated ${k} matches${g.pend ? ' · something happened!' : ''}`); else if (last) toastMsg(last);
  }

  /* ================= hooks into the season ================= */
  const _after = mcAfter;
  mcAfter = function (hs, as) {
    const g = G(), S2 = MC.season, rd = S2.rounds[S2.round], fxm = rd && rd.find(f => f.includes(MC.club));
    if (!fxm) return _after(hs, as);
    const myIdx = fxm[0] === MC.club ? 0 : 1, my = myIdx ? as : hs, th = myIdx ? hs : as, res = my > th ? 'W' : my < th ? 'L' : 'D';
    _after(hs, as);
    const st = g.st;
    st.gf += my; st.ga += th; if (!th) st.cs++;
    st.streak = res === 'W' ? st.streak + 1 : 0; st.best = Math.max(st.best, st.streak);
    st.unb = res === 'L' ? 0 : st.unb + 1; st.bestUnb = Math.max(st.bestUnb, st.unb);
    if (my - th > st.big) st.big = my - th;
    let pay = income(res);
    if (g.flags.derby) { pay *= 3; g.flags.derby = false; }
    if (myIdx === 0) { if (g.flags.away > 0) g.flags.away--; else pay += homeIncome(); }
    MC.budget += pay;
    g.last.unshift(`${ALL[fxm[0]].code} ${hs}-${as} ${ALL[fxm[1]].code} · ${res} · +${money(pay)}`); g.last.length = Math.min(g.last.length, 6);
    checkObjectives(); cupCheckDue(); rollEvent();
    saveMC();
  };
  const _sms = mcStartSeason;
  mcStartSeason = function () { _sms(); if (!MC) return; const g = G(); g.obj = newObjectives(); g.st = null; G(); g.cup = newCup(); g.flags = {}; };

  /* ================= screens ================= */
  const TABS2 = [['packs', '🎁 Packs'], ['lab', '🧪 Lab & Stadium']];
  function showTab(id) { MC.gtab = id; mcShow(); }
  function packsScreen() {
    return `<p class="mini">Spend your transfer budget on Scout Packs. Duplicates upgrade the player you already have. Budget <b>${money(MC.budget)}</b></p>
      <div class="packs">${MPACKS.map((p, i) => `<button type="button" class="pack mp${i}" data-mg="pack" data-v="${p.id}" ${MC.budget < p.c ? 'disabled' : ''}><b>${p.n}</b><span>${p.d}</span><i>${money(p.c)}</i></button>`).join('')}</div>`;
  }
  function labScreen() {
    const g = G(), ps = MC.players.slice().sort((a, b) => (MC.xi.includes(b.uid) - MC.xi.includes(a.uid)) || b.ovr - a.ovr);
    return `<div class="mcx-dd" style="background:linear-gradient(120deg,#1d3b2a,#1b2340)"><div class="grow" style="flex:1"><b>🏟 STADIUM · LEVEL ${g.stadium}/10</b><div class="mini">Each home league match earns ${money(homeIncome())} on top of prize money.${g.flags.away ? ` Flooded: ${g.flags.away} home games elsewhere.` : ''}</div></div>
      ${g.stadium < 10 ? `<button type="button" data-mg="stad" ${MC.budget < stadCost() ? 'disabled' : ''}>Upgrade · ${money(stadCost())}</button>` : '<span class="mcx-tag">MAXED</span>'}</div>
      <p class="mini">Training Lab: pay to raise a player's OVR, all the way to ${MAX_OVR}. Higher ratings cost more. Budget <b>${money(MC.budget)}</b></p>
      <div class="mcx-list">${ps.map(p => `<div class="mcx-row"><b class="o">${p.ovr}</b><div class="grow"><b>${esc(p.name)}</b> <span class="mini">${p.pos}${MC.xi.includes(p.uid) ? ' · XI' : ''}</span><div class="mini">+1 costs ${money(labCost(p.ovr))}</div></div>
        <button type="button" data-mg="train" data-v="${p.uid}" data-n="1" ${p.ovr >= MAX_OVR ? 'disabled' : ''}>+1</button><button type="button" data-mg="train" data-v="${p.uid}" data-n="10" ${p.ovr >= MAX_OVR ? 'disabled' : ''}>+10</button><button type="button" data-mg="train" data-v="${p.uid}" data-n="100" ${p.ovr >= MAX_OVR ? 'disabled' : ''}>+100</button></div>`).join('')}</div>`;
  }
  function homePanel() {
    const g = G(), c = g.cup;
    const objs = (g.obj || []).map(o => `<div class="mcx-row mini"><span>${o.done ? '✅' : '🎯'}</span><div class="grow">${esc(o.t)}</div><b>${money(o.prize)}</b></div>`).join('');
    const cupLine = !c ? '' : c.won ? '🏆 Kickoff Cup winners!' : c.out ? '❌ Out of the Kickoff Cup' : c.due ? `🏆 Kickoff Cup ${CUP_RD[c.round]} vs <b>${esc(ALL[c.opp].name)}</b> (${ALL[c.opp].ovr})` : `🏆 Kickoff Cup: ${CUP_RD[c.round]} after matchday ${c.at[c.round]}`;
    return `<div class="mcx-list" style="margin:8px 0">${objs}<div class="mcx-row mini"><div class="grow">${cupLine}</div><span>🏟 Lv ${g.stadium}</span></div>
      ${g.last.length ? `<div class="mcx-row mini" style="display:block">${g.last.slice(0, 3).map(esc).join('<br>')}</div>` : ''}</div>`;
  }
  const _show = mcShow;
  mcShow = function (tab) {
    if (!MC) return _show(tab);
    if (tab) MC.gtab = null;
    const g = G(); if (!g.obj && MC.season) g.obj = newObjectives(); if (!g.cup && MC.season) g.cup = newCup();
    const mine = MC.gtab && TABS2.some(t => t[0] === MC.gtab);
    _show(mine ? 'home' : tab);
    const card = $('hub').querySelector('.card'); if (!card) return;
    // nicer money in the header
    const w = card.querySelector('.wallet'); if (w) w.textContent = money(MC.budget);
    const tabsEl = card.querySelector('.tabs');
    if (tabsEl) {
      const reset = tabsEl.querySelector('[data-mc="reset"]');
      for (const [id, n] of TABS2) { const b = document.createElement('button'); b.type = 'button'; b.dataset.mg = 'tab'; b.dataset.v = id; b.textContent = n; if (mine && id === MC.gtab) b.classList.add('sel'); tabsEl.insertBefore(b, reset); }
      if (mine) tabsEl.querySelectorAll('button[data-mt],button[data-mx="tab"]').forEach(b => b.classList.remove('sel'));
    }
    if (mine) {
      while (tabsEl && tabsEl.nextSibling) tabsEl.nextSibling.remove();
      const host = document.createElement('div'); host.innerHTML = MC.gtab === 'packs' ? packsScreen() : labScreen(); card.appendChild(host);
    } else if (MC.tab === 'home') {
      const cta = card.querySelector('.cta');
      if (cta) {
        const sim = cta.querySelector('[data-mc="sim"]'); if (sim) sim.remove();
        if (g.cup && g.cup.due) {
          cta.querySelectorAll('[data-mc="play"]').forEach(b => b.remove());
          cta.insertAdjacentHTML('beforeend', `<button type="button" data-mg="q" data-n="1">⚡ Quick cup tie</button><button class="big" type="button" data-mg="cupplay">PLAY CUP TIE ▶</button>`);
        } else cta.insertAdjacentHTML('afterbegin', '<button type="button" data-mg="q" data-n="1">⚡ Quick sim</button><button type="button" data-mg="q" data-n="5">⚡ ×5</button><button type="button" data-mg="q" data-n="99">⏩ To season end</button>');
      }
      const res = card.querySelector('.res'); if (res) res.insertAdjacentHTML('beforebegin', homePanel());
      card.querySelectorAll('.res span').forEach(sp => { if (/^Budget/.test(sp.textContent)) { const b = sp.querySelector('b'); if (b) b.textContent = money(MC.budget); } });
    }
    if (g.pend) setTimeout(showEvent, 60);
  };

  /* ================= clicks ================= */
  $('hub').addEventListener('click', e => {
    if (!MC) return;
    if (e.target.closest('button[data-mt],button[data-mx="tab"]')) MC.gtab = null;
    const b = e.target.closest('[data-mg]'); if (!b) return;
    const a = b.dataset.mg, v = b.dataset.v;
    if (a === 'tab') showTab(v);
    else if (a === 'q') runSims(+b.dataset.n);
    else if (a === 'cupplay') cupPlay();
    else if (a === 'pack') buyPack(v);
    else if (a === 'train') train(v, +b.dataset.n);
    else if (a === 'stad') { const c = stadCost(); if (MC.budget < c || G().stadium >= 10) return; MC.budget -= c; G().stadium++; log(`🏟 Stadium upgraded to level ${G().stadium}`); saveMC(); showTab('lab'); }
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('#mcx [data-mge]'); if (!b || !MC) return;
    const g = G(), pe = g.pend; if (!pe) return;
    const e2 = EV[pe.id]; g.pend = null;
    try { e2.opts[+b.dataset.mge][1](pe.d); } catch (err) { console.warn(err); }
    closeM(); saveMC(); mcShow();
  });

  /* ================= card looks above 140, and higher-tier Road to Success packs ================= */
  const css = document.createElement('style');
  css.textContent = `
  .pcard.t8{background:linear-gradient(160deg,#fff6d8,#ffd23f 35%,#ff8a00 70%,#fff);color:#3a2200;border-color:#fff;box-shadow:0 0 20px rgba(255,210,63,.85)}
  .pcard.t9{background:radial-gradient(circle at 30% 20%,#fff,#ffb3f0 25%,#9b4dff 60%,#1a0040);color:#fff;border-color:#ffd6ff;box-shadow:0 0 22px rgba(200,120,255,.9);text-shadow:0 1px 3px #000}
  .pcard.t10{background:linear-gradient(135deg,#000,#1a1a1a 40%,#ff004c 50%,#1a1a1a 60%,#000);background-size:300% 300%;color:#fff;border-color:#ff004c;box-shadow:0 0 24px rgba(255,0,76,.9);animation:galx 2.4s linear infinite;text-shadow:0 1px 3px #000}
  .pcard.t11{background:conic-gradient(from 0deg,#fff,#ffd23f,#ff2d7a,#00e5ff,#fff,#7cff4d,#fff);background-size:200% 200%;color:#000;border:2px solid #fff;box-shadow:0 0 30px #fff,0 0 60px rgba(255,210,63,.8);animation:galx 1.6s linear infinite}
  .pcard.t11 .o{text-shadow:0 0 8px #fff}
  .pack.mp0{background:linear-gradient(135deg,#6b7480,#c3cad3);color:#111}.pack.mp1{background:linear-gradient(135deg,#a07a10,#ffd23f);color:#111}.pack.mp2{background:linear-gradient(135deg,#2a1a6b,#8a5cff)}
  .pack.mp3{background:linear-gradient(135deg,#5a0f0f,#ff6b6b)}.pack.mp4{background:linear-gradient(160deg,#0b1a5c,#5a2bd6 45%,#00d4ff)}.pack.mp5{background:conic-gradient(from 0deg,#ff2d7a,#ffd23f,#2fff9b,#00b3ff,#b14dff,#ff2d7a)}
  .pack.mp6{background:linear-gradient(160deg,#ffd23f,#ff8a00);color:#2a1600}.pack.mp7{background:radial-gradient(circle at 30% 20%,#ffb3f0,#9b4dff 55%,#1a0040)}.pack.mp8{background:linear-gradient(135deg,#000,#ff004c 50%,#000);border:2px solid #fff}
  .pack.p8{background:linear-gradient(160deg,#ffd23f,#ff8a00);color:#2a1600}.pack.p9{background:radial-gradient(circle at 30% 20%,#ffb3f0,#9b4dff 55%,#1a0040)}.pack.p10{background:linear-gradient(135deg,#000,#ff004c 50%,#000);border:2px solid #fff}`;
  document.head.appendChild(css);
  if (typeof PACKS !== 'undefined' && !PACKS.some(p => p.id === 'celestial')) {
    const up = (lo, hi, rar) => { const p = realPick(89, 95); p.ovr = Math.min(MAX_OVR, rint(lo, hi)); p.hero = true; p.rar = rar; return [p]; };
    PACKS.push({ id:'celestial', n:'Celestial Pack', cost:1000000, desc:'1 celestial card (200-300) with a PlayStyle+', open:() => up(200, 300, 'celestial') });
    PACKS.push({ id:'divine', n:'Divine Pack', cost:3000000, desc:'1 divine card (300-600) with a PlayStyle+', open:() => up(300, 600, 'divine') });
    PACKS.push({ id:'infinity', n:'Infinity Pack', cost:8000000, desc:'1 infinity card (600-999) · 5% chance of a 999', open:() => { const c = up(600, 998, 'infinity'); if (Math.random() < .05) c[0].ovr = 999; return c; } });
  }
  window.MGR = { G, runSims, EV, MPACKS, showEvent, quickSim };
})();
