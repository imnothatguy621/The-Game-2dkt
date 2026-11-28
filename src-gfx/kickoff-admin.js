/* Kickoff Rivals: admin tools for the game's owner.
   Turned on automatically when you sign in with an admin account (the server checks the email; see admin.sql).
   - Hacks: mod money, super team, unbeatable keeper, sleepy opponents, instant goal (G key), win now, max squads.
   - Dashboard: every player with an account, what they're playing, and their stats in both games. */
(function () {
  const isAdm = () => !!window.KR_ADMIN;
  const H = (() => { try { return Object.assign({ money:false, sup:false, wall:false, sleepy:false }, JSON.parse(localStorage.getItem('kr_hacks') || '{}')); } catch (e) { return { money:false, sup:false, wall:false, sleepy:false }; } })();
  const saveH = () => { try { localStorage.setItem('kr_hacks', JSON.stringify(H)); } catch (e) {} };
  const BIG_COINS = 999999999, BIG_BUDGET = 999999999;
  const on = k => isAdm() && H[k];

  // admin accounts also get the admin teams (same as the old admin code)
  window.addEventListener('kr-admin', e => {
    const a = !!e.detail;
    if (a) ADMIN = true; else { let code = null; try { code = localStorage.getItem('kr_admin'); } catch (er) {} if (!code) ADMIN = false; }
    if (!$('home').classList.contains('hide')) showHome();
    if (a) toastMsg('👑 Admin account: hacks and dashboard unlocked');
    if (a && /[?&]admin=1/.test(location.search)) { history.replaceState(null, '', location.pathname); setTimeout(() => openAdmin('players'), 300); }
  });

  /* ---------------- mod money ---------------- */
  function moneyTick() {
    if (!isAdm()) return;
    if (H.money) {
      if (H.saved == null) { H.saved = { coins:PROFILE.coins, budget:(typeof MC !== 'undefined' && MC) ? MC.budget : null }; saveH(); }
      if (PROFILE.coins < BIG_COINS) { PROFILE.coins = BIG_COINS; saveProfile(); }
      if ((typeof MC !== 'undefined' && MC) && MC.budget < BIG_BUDGET) { MC.budget = BIG_BUDGET; saveMC(); }
    } else if (H.saved) {
      // money mode off: put the real amounts back (plus nothing you earned is lost: we keep whichever is lower than the mod amount)
      if (PROFILE.coins >= BIG_COINS && H.saved.coins != null) { PROFILE.coins = H.saved.coins; saveProfile(); }
      if ((typeof MC !== 'undefined' && MC) && MC.budget >= BIG_BUDGET && H.saved.budget != null) { MC.budget = H.saved.budget; saveMC(); }
      H.saved = null; saveH();
    }
  }
  setInterval(moneyTick, 1000);

  /* ---------------- match hacks ---------------- */
  const _sm = startMatch;
  startMatch = function (cfg) {
    const r = _sm(cfg);
    try {
      // Soccer Aid (the admin all-star team, everyone rated 999) plays like it: faster, deadlier, a wall in goal
      if (S.teams) for (const t of S.teams) if (t.def && t.def.id === 'c-sai') { t.K.spd *= 1.3; t.K.shot *= 1.35; t.K.acc = .995; t.K.gk = Math.max(t.K.gk, 4); t.K.tackle += .6; t.players.forEach(p => p.spd *= 1.3); }
      if (isAdm() && S.teams) for (const t of S.teams) {
        const mine = isHuman(t);
        if (mine && H.sup) { t.K.spd *= 1.3; t.K.shot *= 1.25; t.K.acc = .99; t.K.tackle += .5; t.players.forEach(p => p.spd *= 1.3); }
        if (mine && H.wall) t.K.gk = 6;
        if (!mine && H.sleepy) { t.K.spd *= .65; t.K.gk = .15; t.K.tackle *= .4; t.K.think = (t.K.think || .3) * 3; t.players.forEach(p => p.spd *= .65); }
      }
    } catch (e) { console.warn('hacks', e); }
    return r;
  };
  function myTeam() { return S.teams && S.teams.find(t => isHuman(t)); }
  function instantGoal() {
    const t = myTeam(); if (!t || !['play', 'setpiece', 'kickoff'].includes(S.state)) return;
    const s = t.side; ball.owner = null; ball.pos.set(PL * s + s * .6, .5, 0); ball.vel.set(s * 4, 0, 0); ball.lastTouch = t.players[t.players.length - 1];
    goalScored(t);
  }
  function winNow() {
    const t = myTeam(); if (!t || !['play', 'setpiece', 'kickoff', 'goal', 'replay'].includes(S.state)) return;
    if (S.state === 'replay') { try { if (typeof REP !== 'undefined') REP.on = false; } catch (e) {} }
    const o = opp(t); while (t.score <= o.score) t.score++;
    endMatch();
  }
  addEventListener('keydown', e => {
    if (!isAdm() || e.repeat || /INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if (e.code === 'KeyG' && e.shiftKey) { instantGoal(); e.preventDefault(); }
    if (e.code === 'KeyW' && e.shiftKey) { winNow(); e.preventDefault(); }
  }, true);
  function maxSquads() {
    let n = 0;
    if ((typeof RTS !== 'undefined' && RTS) && RTS.players) { RTS.players.forEach(p => p.ovr = MAX_OVR); n += RTS.players.length; saveRTS(); }
    if ((typeof MC !== 'undefined' && MC) && MC.players) { MC.players.forEach(p => p.ovr = MAX_OVR); n += MC.players.length; saveMC(); }
    if (typeof PC !== 'undefined' && PC) { PC.ovr = MAX_OVR; savePC(); n++; }
    toastMsg(n ? `🃏 ${n} players set to ${MAX_OVR}` : 'No squads yet: start Road to Success, Manager Career or Player Career first');
  }

  /* ---------------- admin panel ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  #admBox{position:fixed;inset:0;z-index:8995;display:grid;place-items:center;background:rgba(2,6,12,.78);padding:10px;color:#eaf2ff;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
  #admBox[hidden]{display:none}
  #admBox .ac{width:min(1100px,98vw);max-height:94vh;overflow:auto;background:#0c1628;border:1px solid #233457;border-radius:16px;padding:16px}
  #admBox .hd{display:flex;align-items:center;gap:10px;justify-content:space-between} #admBox h2{margin:0;font:900 italic 22px system-ui}
  #admBox button{font:inherit;cursor:pointer;border-radius:9px;border:1px solid #2c4170;background:#15233f;color:#eaf2ff;padding:7px 12px}
  #admBox .atabs{display:flex;gap:6px;margin:10px 0;flex-wrap:wrap;position:static} #admBox .atabs button.on{background:#ffd23f;color:#111;border-color:#ffd23f;font-weight:800}
  #admBox .hk{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
  #admBox .h{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:#111e36;border:1px solid #1d2c4d}
  #admBox .h.on{border-color:#2ee08a;box-shadow:inset 0 0 0 1px #2ee08a} #admBox .h b{display:block} #admBox .h small{color:#8ea0c4}
  #admBox .h .sw{margin-left:auto;min-width:54px} #admBox .h.on .sw{background:#1aa865;border-color:#1aa865}
  #admBox .kp{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}
  #admBox .kp div{background:#111e36;border-radius:12px;padding:10px;text-align:center} #admBox .kp b{display:block;font-size:24px;color:#ffd23f}
  #admBox table{width:100%;border-collapse:collapse;font-size:12.5px} #admBox th,#admBox td{padding:6px 7px;border-bottom:1px solid #1b2a48;text-align:left;white-space:nowrap}
  #admBox th{position:sticky;top:0;background:#0c1628;color:#8ea0c4;cursor:pointer} #admBox tr.pl{cursor:pointer} #admBox tr.pl:hover{background:#13213d}
  #admBox .dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#56627a} #admBox .dot.on{background:#2ee08a;box-shadow:0 0 6px #2ee08a}
  #admBox input{padding:8px 10px;border-radius:9px;border:1px solid #2c4170;background:#07101f;color:#eaf2ff;font:inherit;width:240px}
  #admBox pre{white-space:pre-wrap;background:#07101f;border-radius:10px;padding:10px;font-size:12px;max-height:50vh;overflow:auto}
  #admBox .note{color:#8ea0c4;font-size:12px}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'admBox'; box.hidden = true; box.innerHTML = '<div class="ac" id="admCard"></div>';
  document.body.appendChild(box);
  for (const ev of ['keydown', 'keyup', 'pointerdown']) box.addEventListener(ev, e => e.stopPropagation());
  box.addEventListener('click', e => { if (e.target === box) box.hidden = true; });

  const A = { tab:'hacks', rows:null, err:'', q:'', sort:'seen', loading:false, sel:null };
  const HACKS = [
    ['money', '💰 Mod money', `Coins ${fmt(BIG_COINS)} and Manager budget €${fmt(BIG_BUDGET)}M. Turning it off puts your real money back.`],
    ['sup', '⚡ Super team', 'Your team is 30% faster, shoots harder and never misplaces a pass.'],
    ['wall', '🧱 Unbeatable keeper', 'Your keeper saves almost everything.'],
    ['sleepy', '😴 Sleepy opponents', 'The other team is slow, confused and their keeper barely moves.']
  ];
  const ago = d => { if (!d) return '—'; const s = (Date.now() - new Date(d)) / 1000; return s < 90 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
  const n0 = v => v == null || v === '' ? '—' : typeof v === 'number' ? fmt(Math.round(v)) : esc(String(v));
  const clubName = id => id && typeof ALL !== 'undefined' && ALL[id] ? ALL[id].name : (id || '—');

  async function loadPlayers() {
    A.loading = true; A.err = ''; render();
    try {
      const c = window.SOC && (SOC.sb || await SOC_ADAPTER.getClient());
      if (!c) throw new Error('Not connected');
      const { data, error } = await c.rpc('soc_admin_players');
      if (error) throw error;
      A.rows = data || []; A.at = Date.now();
    } catch (e) { A.err = e.message === 'not allowed' ? 'The server says this account is not an admin.' : 'Could not load players: ' + (e.message || e); }
    A.loading = false; render();
  }
  function overview() {
    const r = A.rows || [], day = Date.now() - 864e5, week = Date.now() - 7 * 864e5;
    const online = r.filter(x => x.online), today = r.filter(x => x.last_seen && new Date(x.last_seen) > day);
    const newWeek = r.filter(x => x.joined && new Date(x.joined) > week);
    const kick = r.filter(x => x.kickoff_saved || x.rts || x.mc), sky = r.filter(x => x.sky);
    const coins = r.reduce((a, x) => a + (+x.coins || 0), 0);
    const tops = r.map(x => ({ n:x.username, v:Math.max(+(x.rts && x.rts.top) || 0, +(x.mc && x.mc.top) || 0) })).filter(x => x.v).sort((a, b) => b.v - a.v).slice(0, 5);
    return `<div class="kp"><div><b>${r.length}</b>players with accounts</div><div><b>${online.length}</b>online now</div><div><b>${today.length}</b>played in the last 24h</div><div><b>${newWeek.length}</b>new this week</div>
      <div><b>${online.filter(x => x.game === 'kickoff').length}</b>in Kickoff now</div><div><b>${online.filter(x => x.game === 'skywarden').length}</b>in Skywarden now</div><div><b>${kick.length}</b>have Kickoff saves</div><div><b>${sky.length}</b>have Skywarden saves</div>
      <div><b>${fmt(Math.round(coins))}</b>coins across all players</div></div>
      <h3 style="margin:14px 0 6px">Highest-rated players owned</h3>${tops.length ? tops.map((t, i) => `<div>${i + 1}. <b>${esc(t.n)}</b> · ${t.v} OVR</div>`).join('') : '<p class="note">No squads saved yet.</p>'}
      <h3 style="margin:14px 0 6px">Online now</h3>${online.length ? online.map(x => `<div><span class="dot on"></span> <b>${esc(x.username)}</b> · ${x.game === 'skywarden' ? 'Skywarden' : 'Kickoff Rivals'}</div>`).join('') : '<p class="note">Nobody is online right now.</p>'}`;
  }
  function table() {
    const q = A.q.toLowerCase();
    let r = (A.rows || []).filter(x => !q || (x.username || '').toLowerCase().includes(q) || (x.email || '').toLowerCase().includes(q));
    const key = { seen:x => -new Date(x.last_seen || x.last_sign_in || 0), name:x => (x.username || '').toLowerCase(), joined:x => -new Date(x.joined || 0), coins:x => -(+x.coins || 0), top:x => -Math.max(+(x.rts && x.rts.top) || 0, +(x.mc && x.mc.top) || 0) }[A.sort];
    r = r.slice().sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input id="admQ" placeholder="Search username or email" value="${esc(A.q)}"><span class="note">${r.length} shown · click a player for everything saved</span></div>
      <div style="overflow:auto;max-height:62vh"><table><thead><tr><th data-s="seen"></th><th data-s="name">Username</th><th>Email</th><th data-s="joined">Joined</th><th data-s="seen">Last seen</th><th>Playing</th><th data-s="coins">Coins</th><th>Road to Success</th><th>Manager Career</th><th>Player Career</th><th data-s="top">Best OVR</th><th>Skywarden</th></tr></thead><tbody>
      ${r.map(x => `<tr class="pl" data-u="${esc(x.user_id)}"><td><span class="dot ${x.online ? 'on' : ''}"></span></td><td><b>${esc(x.username)}</b></td><td>${esc(x.email || '—')}</td><td>${ago(x.joined)}</td><td>${ago(x.last_seen || x.last_sign_in)}</td>
        <td>${x.online ? (x.game === 'skywarden' ? 'Skywarden' : 'Kickoff') : '—'}</td><td>${n0(x.coins)}</td>
        <td>${x.rts ? `${esc(clubName(x.rts.club))} · Div ${n0((x.rts.div || 0) + 1)} · ${n0(x.rts.wins)}W ${n0(x.rts.draws)}D ${n0(x.rts.losses)}L` : '—'}</td>
        <td>${x.mc ? `${esc(clubName(x.mc.club))} · S${n0(x.mc.season)} · €${n0(x.mc.budget)}M · ${n0(x.mc.trophies)}🏆` : '—'}</td>
        <td>${x.pc ? `${esc(x.pc.name || '')} · ${n0(x.pc.ovr)} · ${n0(x.pc.goals)} goals` : '—'}</td>
        <td>${n0(Math.max(+(x.rts && x.rts.top) || 0, +(x.mc && x.mc.top) || 0) || null)}</td>
        <td>${x.sky ? `${n0(x.sky.quests)} quests · ${n0(x.sky.credits)} cr` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function detail() {
    const x = (A.rows || []).find(r => r.user_id === A.sel); if (!x) { A.sel = null; return table(); }
    return `<button type="button" data-a="back">← All players</button><h3>${esc(x.username)} <span class="note">${esc(x.email || '')}</span></h3>
      <p class="note">Joined ${x.joined ? new Date(x.joined).toLocaleString() : '—'} · last seen ${ago(x.last_seen || x.last_sign_in)} · Kickoff save ${x.kickoff_saved ? ago(x.kickoff_saved) : 'none'}</p>
      <pre>${esc(JSON.stringify({ coins:x.coins, xp:x.xp, roadToSuccess:x.rts, managerCareer:x.mc, playerCareer:x.pc, skywarden:x.sky }, null, 2))}</pre>`;
  }
  function render() {
    const c = document.getElementById('admCard'); if (!c) return;
    if (!isAdm()) { c.innerHTML = '<div class="hd"><h2>👑 Admin</h2><button type="button" data-a="close">✕</button></div><p>Sign in with an admin account to use this.</p>'; return; }
    const tabs = [['hacks', '🛠 Hacks'], ['players', '👥 Players'], ['overview', '📊 Overview']];
    let body = '';
    if (A.tab === 'hacks') body = `<div class="hk">${HACKS.map(([k, n, d]) => `<div class="h ${H[k] ? 'on' : ''}"><div><b>${n}</b><small>${d}</small></div><button type="button" class="sw" data-h="${k}">${H[k] ? 'ON' : 'OFF'}</button></div>`).join('')}</div>
      <h3 style="margin:16px 0 6px">One-off hacks</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" data-a="goal">⚽ Score a goal now (Shift+G)</button><button type="button" data-a="win">🏆 Win this match now (Shift+W)</button><button type="button" data-a="max">🃏 Set all my squads to ${MAX_OVR}</button></div>
      <p class="note" style="margin-top:12px">Match hacks start from your next match. They only work on admin accounts, and only on your own device.</p>`;
    else if (A.loading && !A.rows) body = '<p>Loading players…</p>';
    else if (A.err) body = `<p style="color:#ff9aa9">${esc(A.err)}</p><button type="button" data-a="reload">Try again</button>`;
    else if (!A.rows) { body = '<p>Loading players…</p>'; setTimeout(loadPlayers, 0); }
    else body = A.tab === 'overview' ? overview() : A.sel ? detail() : table();
    c.innerHTML = `<div class="hd"><h2>👑 Admin</h2><div style="display:flex;gap:8px;align-items:center">${A.tab !== 'hacks' ? `<span class="note">${A.at ? 'updated ' + ago(A.at) : ''}</span><button type="button" data-a="reload">↻ Refresh</button>` : ''}<button type="button" data-a="close">✕</button></div></div>
      <div class="atabs">${tabs.map(([k, n]) => `<button type="button" data-t="${k}" class="${A.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
    const qi = document.getElementById('admQ'); if (qi) { qi.oninput = () => { A.q = qi.value; const pos = qi.selectionStart; render(); const n = document.getElementById('admQ'); n.focus(); n.setSelectionRange(pos, pos); }; }
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-a],[data-t],[data-h],[data-s],tr.pl'); if (!b) return;
    if (b.dataset.t) { A.tab = b.dataset.t; A.sel = null; render(); }
    else if (b.dataset.h) { H[b.dataset.h] = !H[b.dataset.h]; saveH(); moneyTick(); render(); }
    else if (b.dataset.s) { A.sort = b.dataset.s; render(); }
    else if (b.matches('tr.pl')) { A.sel = b.dataset.u; render(); }
    else {
      const a = b.dataset.a;
      if (a === 'close') box.hidden = true;
      else if (a === 'reload') loadPlayers();
      else if (a === 'back') { A.sel = null; render(); }
      else if (a === 'goal') { box.hidden = true; instantGoal(); }
      else if (a === 'win') { box.hidden = true; winNow(); }
      else if (a === 'max') maxSquads();
    }
  });
  function openAdmin(tab) { if (tab) A.tab = tab; box.hidden = false; render(); if (A.tab !== 'hacks' && (!A.at || Date.now() - A.at > 30000)) loadPlayers(); }
  // auto-refresh the player list while it's open
  setInterval(() => { if (!box.hidden && A.tab !== 'hacks' && !A.sel && isAdm()) loadPlayers(); }, 30000);

  // 👑 button on the home screen and in the pause menu
  const _home = showHome;
  showHome = function () {
    _home();
    if (!isAdm()) return;
    const hdr = $('home').querySelector('.hdr'); if (!hdr || hdr.querySelector('[data-adm]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.adm = '1'; b.textContent = '👑 Admin'; b.style.marginLeft = '8px';
    b.onclick = e => { e.stopPropagation(); openAdmin(); };
    const set = hdr.querySelector('[data-m="settings"]'); if (set) set.insertAdjacentElement('afterend', b); else hdr.appendChild(b);
  };
  setInterval(() => {
    const p = $('pause'); if (!p || p.classList.contains('hide') || !isAdm() || p.querySelector('[data-adm]')) return;
    const host = p.querySelector('.card') || p;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.adm = '1'; b.textContent = '👑 Admin hacks'; b.onclick = e => { e.stopPropagation(); openAdmin('hacks'); };
    host.appendChild(b);
  }, 700);
  window.KRADMIN = { open:openAdmin, H, instantGoal, winNow, maxSquads, loadPlayers };
})();
