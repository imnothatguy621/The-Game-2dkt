/* ================= Kickoff Rivals: accounts, friends, lobbies, matchmaking with bot fill ================= */
(() => {
  const SAVE_KEYS = ['kr_profile', 'kr_career', 'kr_rts', 'kr_pc', 'kr_mc', 'kr_set'];
  let acct = null;
  const pickAsync = title => new Promise(res => pickTeam({ title, tabs:'all', asUser:true }, id => res(id)));
  const inRoom = () => ['host-wait', 'host', 'guest-wait', 'guest'].includes(NET.role) ? NET.code : '';

  window.SOC_ADAPTER = {
    game:'kickoff',
    async getClient() {
      if (acct) return acct;
      await loadSupabase();
      acct = window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
      if (/access_token|code=/.test(location.hash + location.search)) setTimeout(() => history.replaceState(null, '', location.pathname), 1500);
      return acct;
    },
    visible:() => S.state === 'menu' && (!$('home').classList.contains('hide') || !$('online').classList.contains('hide')),
    myRoom:inRoom,
    roomPlayers:() => NET.peerName ? [NET.peerName] : [],
    async host() {
      if (inRoom() && NET.role === 'host-wait') return NET.code;
      if (S.net) netLeave(); if (S.state !== 'menu') toMenuState();
      const id = NET.team && ALL[NET.team] ? NET.team : await pickAsync('LOBBY · PICK YOUR TEAM');
      showOnline(id); await hostRoom();
      return NET.role === 'host-wait' ? NET.code : '';
    },
    async join(code) {
      if (S.net) netLeave(); if (S.state !== 'menu') toMenuState();
      const id = await pickAsync(`JOIN ${code} · PICK YOUR TEAM`);
      showOnline(id); joinRoom(code);
    },
    onSignedIn(u) { cloudPull(u); },
    onSignedOut() { try { localStorage.removeItem('kr_sync_t'); } catch (e) {} },
  };

  /* ---------- cloud save: career, Road to Success, coins and settings follow your account ---------- */
  const snap = () => { const d = {}; for (const k of SAVE_KEYS) { const v = localStorage.getItem(k); if (v != null) d[k] = v; } return d; };
  let lastPush = '';
  async function cloudPull(u) {
    if (!acct) return;
    const { data, error } = await acct.from('profiles').select('kickoff').eq('id', u.id).maybeSingle();
    if (error) return;
    const cloud = data && data.kickoff, lt = +localStorage.getItem('kr_sync_t') || 0, sameUser = localStorage.getItem('kr_sync_uid') === u.id;
    const hasLocal = !!localStorage.getItem('kr_profile') || !!localStorage.getItem('kr_career') || !!localStorage.getItem('kr_rts');
    if (cloud && cloud.d && (cloud.t > lt || !sameUser)) {
      const keepLocal = !sameUser && hasLocal && !confirm('Your account has saved Kickoff progress.\n\nOK = load the progress from your account\nCancel = keep the progress on this device (it will be saved to your account)');
      if (!keepLocal) {
        for (const k of SAVE_KEYS) { if (cloud.d[k] != null) localStorage.setItem(k, cloud.d[k]); else localStorage.removeItem(k); }
        localStorage.setItem('kr_sync_t', cloud.t); localStorage.setItem('kr_sync_uid', u.id);
        const reload = () => { if (S.state === 'menu') location.reload(); else setTimeout(reload, 2000); };
        SOC.toast('Loading your saved progress…', null, 3000); setTimeout(reload, 800);
        return;
      }
    }
    localStorage.setItem('kr_sync_uid', u.id);
    lastPush = ''; cloudPush();
  }
  async function cloudPush() {
    if (!acct || !SOC.user || navigator.onLine === false || localStorage.getItem('kr_sync_uid') !== SOC.user.id) return;
    const d = snap(), js = JSON.stringify(d); if (js === lastPush) return;
    const t = Date.now();
    const { data, error } = await acct.rpc('soc_save_kickoff', { data:{ t, d } });
    if (!error && data === 'ok') { lastPush = js; localStorage.setItem('kr_sync_t', t); }
  }
  setInterval(cloudPush, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cloudPush(); });

  /* ---------- online screen: find a match, or play a bot if nobody's around ---------- */
  const ADJ = ['Swift', 'Golden', 'Rapid', 'Silent', 'Turbo', 'Royal', 'Lucky', 'Iron', 'Neon', 'Shadow', 'Blaze', 'Frosty', 'Cosmic', 'Wild', 'Mega', 'Super', 'Hyper', 'Clever', 'Brave', 'Sneaky'];
  const NOUN = ['Striker', 'Keeper', 'Winger', 'Falcon', 'Tiger', 'Rocket', 'Panda', 'Wizard', 'Ninja', 'Dribbler', 'Volley', 'Header', 'Comet', 'Lion', 'Shark', 'Fox', 'Captain', 'Maestro', 'Cobra', 'Boots'];
  const pick = a => a[(Math.random() * a.length) | 0];
  const fakeName = () => { const r = Math.random(); const n = pick(ADJ) + (r < .5 ? pick(NOUN) : '_' + pick(NOUN)); return (n + (Math.random() < .7 ? ((Math.random() * 99) | 0) : '')).slice(0, 16); };

  const MM = { ch:null, timer:null, tick:null, done:true, me:'' };
  function stopMM() { MM.done = true; clearTimeout(MM.timer); clearInterval(MM.tick); if (MM.ch) { try { MM.ch.untrack(); NET.client.removeChannel(MM.ch); } catch (e) {} } MM.ch = null; }
  const mmBox = () => document.getElementById('mmBox');
  const mmSay = h => { const b = mmBox(); if (b) b.innerHTML = h; };

  async function findMatch() {
    stopMM(); netLeave();
    const team = NET.team; MM.done = false; MM.me = Math.random().toString(36).slice(2, 10);
    const until = Date.now() + 15000; let left = 15;
    const searching = () => mmSay(`<b>LOOKING FOR PLAYERS…</b><span class="mini">If nobody's around in ${left}s you'll play a bot.</span><button type="button" data-o="mmcancel">Cancel</button>`);
    searching();
    try {
      const c = await netClient();
      const ch = c.channel('kr-matchmaking', { config:{ presence:{ key:MM.me }, broadcast:{ self:false } } });
      MM.ch = ch;
      ch.on('broadcast', { event:'pair' }, ({ payload:p }) => {
        if (MM.done || !p || p.to !== MM.me) return;
        MM.done = true; stopMM(); mmSay(`<b>MATCH FOUND!</b><span class="mini">Joining ${esc(p.name || 'a player')}…</span>`);
        NET.team = team; joinRoom(p.code);
      });
      ch.on('presence', { event:'sync' }, () => {
        if (MM.done) return;
        const st = ch.presenceState(), ids = Object.keys(st).filter(k => st[k] && st[k][0] && st[k][0].s).sort();
        const i = ids.indexOf(MM.me); if (i < 0 || i % 2 === 1 || !ids[i + 1]) return;
        MM.done = true; const code = newCode(), other = st[ids[i + 1]][0];
        ch.send({ type:'broadcast', event:'pair', payload:{ to:ids[i + 1], code, name:SOC.username() || '' } });
        mmSay(`<b>MATCH FOUND!</b><span class="mini">vs ${esc(other.n || 'a player')}. Opening the room…</span>`);
        setTimeout(() => { stopMM(); NET.team = team; hostRoom(code); }, 400);
      });
      await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('timeout')), 8000); ch.subscribe(s => { if (s === 'SUBSCRIBED') { clearTimeout(to); res(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(to); rej(new Error(s)); } }); });
      if (MM.done) return;
      await ch.track({ s:1, n:SOC.username() || '', t:Date.now() });
    } catch (e) { /* offline or server busy: just play a bot */ left = 0; }
    if (MM.done) return;
    if (left <= 0) { stopMM(); botMatch(team); return; }
    MM.tick = setInterval(() => { if (MM.done) return; left = Math.ceil((until - Date.now()) / 1000); if (left <= 0) { stopMM(); botMatch(team); } else searching(); }, 1000);
  }

  function botMatch(team) {
    const mine = ALL[team], pool = Object.values(ALL).filter(d => d && /^[cn]-/.test(d.id) && d.id !== team && !d.admin && !!d.nation === !!mine.nation && Math.abs(d.ovr - mine.ovr) <= 6);
    const opp = (pool.length ? pick(pool) : Object.values(ALL).find(d => /^[cn]-/.test(d.id) && d.id !== team && !d.admin)).id;
    const name = fakeName();
    mmSay(`<b>NOBODY NEARBY. PLAYING A BOT</b><span class="mini">vs <b>${esc(name)}</b> 🤖 · ${esc(ALL[opp].name)}</span>`);
    setTimeout(() => {
      if ($('online').classList.contains('hide')) return;
      CUR_MATCH = { kind:'quick', mine:team, theirs:opp };
      startMatch(cfgFor(team, opp, 0, { label:`Online · vs ${name} 🤖 bot` }));
    }, 1800);
  }

  const _showOnline = showOnline;
  showOnline = function (team) {
    stopMM(); _showOnline(team);
    const cols = $('online').querySelector('.cols'); if (!cols) return;
    const on = SOC.user ? SOC.friendsOnline() : [];
    const box = document.createElement('div');
    box.innerHTML = `<div class="fix" id="mmBox" style="grid-template-columns:1fr;text-align:center;margin-bottom:10px"><b>FIND A MATCH</b><span class="mini">Play anyone who's looking right now. If nobody's around, you play a bot.</span><button class="big" type="button" data-o="find">FIND MATCH</button></div>
      <div class="fix" style="grid-template-columns:1fr;text-align:center;margin-bottom:10px"><b>PLAY WITH FRIENDS</b><span class="mini">${!SOC.user ? 'Sign in to add friends and invite them.' : on.length ? on.length + ' friend' + (on.length > 1 ? 's' : '') + ' online: ' + on.slice(0, 3).map(f => esc(f.username)).join(', ') : 'No friends online right now.'}</span><button type="button" data-o="friends">${SOC.user ? '👥 Friends & lobby' : '👤 Sign in'}</button></div>`;
    cols.parentNode.insertBefore(box, cols);
  };
  $('online').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const o = b.dataset.o;
    if (o === 'find') { e.stopImmediatePropagation(); findMatch(); }
    else if (o === 'mmcancel') { e.stopImmediatePropagation(); stopMM(); showOnline(NET.team); }
    else if (o === 'friends') { e.stopImmediatePropagation(); SOC.openPanel(SOC.user ? 'lobby' : 'signin'); }
    else if (o === 'back' || o === 'create' || o === 'join') stopMM();
  }, true);

  /* ---------- invite links: /?room=CODE ---------- */
  try {
    const q = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (q.length === 4) { history.replaceState(null, '', location.pathname); setTimeout(() => window.SOC_ADAPTER.join(q), 300); }
  } catch (e) {}
})();
