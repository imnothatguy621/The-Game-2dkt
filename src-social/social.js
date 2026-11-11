/* ================= Shared accounts, friends and lobbies (same code in Kickoff Rivals and Skywarden) =================
   One Supabase account works in both games: same email, same username. Both pages live on the same site,
   so signing in on one also signs you in on the other.
   The page sets window.SOC_ADAPTER before this runs (see the bottom of each game). */
(() => {
  const A = window.SOC_ADAPTER; if (!A) return;
  const allowed = /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.host);
  const GAME_NAMES = { kickoff:'Kickoff Rivals', skywarden:'Skywarden' };
  const OTHER = A.game === 'kickoff' ? 'skywarden' : 'kickoff';
  const URLS = { kickoff:'/', skywarden:'/skywarden' };
  const SOC = window.SOC = { user:null, name:'', sb:null, list:[], invites:[], seen:new Set(), tab:'friends', open:false, lastFriendsT:0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #socBtn{position:fixed;bottom:calc(14px + env(safe-area-inset-bottom));right:calc(14px + env(safe-area-inset-right));z-index:9000;display:flex;align-items:center;gap:7px;
    padding:9px 14px;border-radius:999px;border:1px solid rgba(160,200,255,.35);background:rgba(8,16,30,.82);color:#eaf2ff;font:700 14px system-ui,-apple-system,Segoe UI,sans-serif;
    cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 6px 20px rgba(0,0,0,.35)}
  #socBtn[hidden]{display:none}
  #socBtn .dot{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ff4d6d;color:#fff;font-size:11px;display:grid;place-items:center}
  #socBox{position:fixed;inset:0;z-index:9001;display:grid;place-items:center;background:rgba(2,6,12,.72);padding:12px;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#eaf2ff}
  #socBox[hidden]{display:none}
  #socBox .sc{width:min(460px,96vw);max-height:92vh;overflow:auto;background:#0c1628;border:1px solid #233457;border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  #socBox h2{margin:0;font-size:20px} #socBox p{margin:6px 0;color:#a9b8d6} #socBox .hd{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
  #socBox button{font:inherit;cursor:pointer;border-radius:10px;border:1px solid #2c4170;background:#15233f;color:#eaf2ff;padding:8px 12px}
  #socBox button.pri{background:#2f7cff;border-color:#2f7cff;font-weight:700} #socBox button.ok{background:#1aa865;border-color:#1aa865;font-weight:700}
  #socBox button.no{background:transparent;color:#ff9aa9;border-color:#5a2a35} #socBox button.x{background:transparent;border:0;font-size:20px;padding:2px 8px}
  #socBox button:disabled{opacity:.5;cursor:default}
  #socBox input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid #2c4170;background:#07101f;color:#eaf2ff;font:inherit;margin:6px 0}
  #socBox .tabs{display:flex;gap:6px;margin:10px 0} #socBox .tabs button{flex:1} #socBox .tabs button.on{background:#2f7cff;border-color:#2f7cff}
  #socBox .row{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:12px;background:#111e36;margin:6px 0}
  #socBox .row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
  #socBox .row small{display:block;font-weight:400;color:#8ea0c4;font-size:12px}
  #socBox .st{width:10px;height:10px;border-radius:50%;background:#56627a;flex:none} #socBox .st.on{background:#2ee08a;box-shadow:0 0 8px #2ee08a}
  #socBox .msg{min-height:1.3em;color:#ffd27a;font-size:13px;margin:6px 0} #socBox .big{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px} #socBox .big button{flex:1}
  #socBox .code{font:800 28px ui-monospace,Menlo,monospace;letter-spacing:.15em;color:#7fe8ff}
  #socToast{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);z-index:9002;display:flex;flex-direction:column;gap:8px;width:min(420px,94vw);font:14px system-ui,-apple-system,Segoe UI,sans-serif}
  #socToast .t{background:#0c1628;border:1px solid #2f7cff;color:#eaf2ff;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  #socToast .t .b{display:flex;gap:8px;margin-top:8px} #socToast button{font:inherit;cursor:pointer;border-radius:10px;padding:7px 12px;border:1px solid #2c4170;background:#15233f;color:#eaf2ff}
  #socToast button.ok{background:#1aa865;border-color:#1aa865;font-weight:700}`;
  document.head.appendChild(css);

  /* ---------- elements ---------- */
  const btn = document.createElement('button'); btn.id = 'socBtn'; btn.type = 'button'; btn.hidden = true;
  const box = document.createElement('div'); box.id = 'socBox'; box.hidden = true; box.innerHTML = '<div class="sc" id="socCard"></div>';
  const toasts = document.createElement('div'); toasts.id = 'socToast';
  document.body.append(btn, box, toasts);
  // typing in the panel must not move the player
  for (const ev of ['keydown', 'keyup', 'keypress']) box.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); });
  box.addEventListener('pointerdown', e => e.stopPropagation());
  box.addEventListener('click', e => { if (e.target === box) close(); });
  btn.addEventListener('click', e => { e.stopPropagation(); openPanel(); });
  const card = () => document.getElementById('socCard');
  const msg = t => { SOC._msg = t || ''; const m = box.querySelector('.msg'); if (m) m.textContent = SOC._msg; };

  function toast(html, buttons, ms) {
    const t = document.createElement('div'); t.className = 't'; t.innerHTML = html;
    if (buttons && buttons.length) {
      const b = document.createElement('div'); b.className = 'b';
      for (const [label, fn, cls] of buttons) { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; if (cls) x.className = cls; x.onclick = () => { t.remove(); fn && fn(); }; b.appendChild(x); }
      t.appendChild(b);
    }
    toasts.appendChild(t);
    setTimeout(() => t.remove(), ms || 9000);
    return t;
  }
  SOC.toast = toast;

  /* ---------- Supabase client and session ---------- */
  async function client() {
    if (SOC.sb) return SOC.sb;
    SOC.sb = await A.getClient();
    if (SOC.sb && !SOC._listening) {
      SOC._listening = true;
      SOC.sb.auth.onAuthStateChange((ev, session) => { const u = session ? session.user : null; if ((u && u.id) !== (SOC.user && SOC.user.id)) setUser(u); });
      const { data } = await SOC.sb.auth.getSession();
      setUser(data && data.session ? data.session.user : null);
    }
    return SOC.sb;
  }
  async function setUser(u) {
    SOC.user = u; SOC.name = ''; SOC.list = []; refreshBtn();
    if (!u) { if (SOC.open) render(); return; }
    const { data } = await SOC.sb.from('profiles').select('username').eq('id', u.id).maybeSingle();
    SOC.name = data && data.username || '';
    if (A.onSignedIn) A.onSignedIn(u, SOC.name);
    if (!SOC.name && !A.ownsProfile) { SOC.tab = 'name'; openPanel(); }
    else if (SOC.name && A.game === 'kickoff' && !SOC._greeted) {
      SOC._greeted = true;
      toast(`Signed in as <b>${esc(SOC.name)}</b>. It's the same account in ${GAME_NAMES[OTHER]}.`, null, 5000);
    }
    heartbeat(); loadFriends(); pollInvites(); refreshBtn(); if (SOC.open) render();
  }
  SOC.username = () => SOC.name;

  async function rpc(fn, args) {
    const c = await client(); if (!c) return { error:{ message:'offline' } };
    return c.rpc(fn, args || {});
  }
  async function heartbeat() { if (SOC.user && navigator.onLine !== false && !document.hidden) await rpc('soc_heartbeat', { game:A.game }); }

  /* ---------- friends ---------- */
  async function loadFriends() {
    if (!SOC.user) return;
    const { data, error } = await rpc('soc_friend_list');
    if (!error && Array.isArray(data)) { SOC.list = data; SOC.lastFriendsT = Date.now(); }
    refreshBtn(); if (SOC.open && !['name', 'signin', 'email-old', 'email-new'].includes(SOC.tab)) render();
  }
  SOC.friendsOnline = (game) => SOC.list.filter(f => f.state === 'friend' && f.online && (!game || f.game === game));
  const incoming = () => SOC.list.filter(f => f.state === 'incoming');

  const REQ_TEXT = { sent:'Friend request sent.', accepted:'You are now friends!', already:'You are already friends.', pending:'You already sent a request. Waiting for them.',
    notfound:'No player with that username.', self:"That's you!", slow:'Too many requests. Try again later.', signin:'Sign in first.', bad:'Usernames are 3 to 16 letters, numbers or _.' };
  async function addFriend(name) {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) { msg(REQ_TEXT.bad); return; }
    msg('Sending…');
    const { data, error } = await rpc('soc_friend_request', { target:name });
    msg(error ? 'Could not send: ' + error.message : (REQ_TEXT[data] || data));
    loadFriends();
  }

  /* ---------- invites (lobby) ---------- */
  async function invite(f) {
    if (!f || !f.user_id) return;
    msg('Opening your lobby…');
    let code = A.myRoom();
    if (!code) { close(); code = await A.host(); }
    if (!code) { toast('Could not open a room to invite them to.'); return; }
    const { data, error } = await rpc('soc_send_invite', { target:f.user_id, game:A.game, room:code });
    const ok = !error && data === 'sent';
    toast(ok ? `Invited <b>${esc(f.username)}</b> to your ${GAME_NAMES[A.game]} lobby <b>${esc(code)}</b>.` : `Could not invite ${esc(f.username)}${error ? ': ' + esc(error.message) : data === 'notfriends' ? ': you are not friends yet.' : data === 'slow' ? ': too many invites, wait a minute.' : '.'}`, null, 5000);
    if (SOC.open) render();
  }
  async function pollInvites() {
    if (!SOC.user || document.hidden) return;
    const { data, error } = await rpc('soc_my_invites');
    if (error || !Array.isArray(data)) return;
    for (const iv of data) {
      if (SOC.seen.has(iv.id)) continue; SOC.seen.add(iv.id);
      const where = iv.game === A.game ? '' : ` (opens ${GAME_NAMES[iv.game]})`;
      toast(`🎮 <b>${esc(iv.from_name)}</b> invited you to their <b>${GAME_NAMES[iv.game] || iv.game}</b> lobby${where}.`, [
        ['Join', () => acceptInvite(iv), 'ok'],
        ['No thanks', () => rpc('soc_invite_respond', { iid:iv.id, accept:false })],
      ], 30000);
    }
  }
  async function acceptInvite(iv) {
    await rpc('soc_invite_respond', { iid:iv.id, accept:true });
    if (iv.game === A.game) { close(); A.join(iv.room); }
    else location.href = location.origin + URLS[iv.game] + '?room=' + encodeURIComponent(iv.room);
  }
  async function lobbyMembers(code) {
    const { data } = await rpc('soc_lobby', { game:A.game, room:code });
    return Array.isArray(data) ? data : [];
  }

  /* ---------- sign in (asks about the other game first) ---------- */
  async function sendLink(email) {
    const c = await client(); if (!c) { msg('Sign-in needs the website and an internet connection.'); return; }
    const sb = box.querySelector('[data-s="send"]'); if (sb) sb.disabled = true; msg('Sending…');
    const { error } = await c.auth.signInWithOtp({ email, options:{ emailRedirectTo:location.origin + location.pathname, shouldCreateUser:true } });
    if (sb) sb.disabled = false;
    msg(error ? (/rate|too many/i.test(error.message) ? 'Too many sign-in emails right now. Wait a few minutes and try again.' : 'Could not send the link: ' + error.message)
      : `Link sent to ${email}. Open the email and tap the link; it brings you back here signed in. Check spam if you can't see it.`);
  }
  async function setName(name) {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) { msg(REQ_TEXT.bad); return; }
    msg('Checking that name…');
    const { data, error } = await rpc('soc_set_username', { name });
    if (error) { msg('Could not save: ' + error.message); return; }
    if (data === 'taken') { msg(`"${name}" is taken. Try another.`); return; }
    if (data !== 'ok') { msg(REQ_TEXT[data] || String(data)); return; }
    SOC.name = name; if (A.onSignedIn) A.onSignedIn(SOC.user, name);
    SOC.tab = 'friends'; render(); refreshBtn();
    toast(`Username <b>${esc(name)}</b> saved. Use the same email in ${GAME_NAMES[OTHER]} and it will be you there too.`, null, 6000);
  }

  /* ---------- panel ---------- */
  async function openPanel(tab) {
    if (!allowed) { toast('Friends and accounts work on the website version of the game.'); return; }
    if (A.beforeOpen) A.beforeOpen();
    if (tab) SOC.tab = tab;
    SOC.open = true; box.hidden = false;
    card().innerHTML = '<p>Loading…</p>';
    await client();
    if (!SOC.user) SOC.tab = SOC.tab === 'email-old' || SOC.tab === 'email-new' ? SOC.tab : 'signin';
    else if (!SOC.name && !A.ownsProfile) SOC.tab = 'name';
    else if (SOC.tab === 'signin' || SOC.tab === 'name' || SOC.tab.startsWith('email')) SOC.tab = 'friends';
    render(); if (SOC.user) loadFriends();
  }
  SOC.openPanel = openPanel;
  function close() { SOC.open = false; box.hidden = true; if (A.afterClose) A.afterClose(); }
  SOC.close = close;
  // other parts of the game can start the sign-in from their own buttons
  SOC.signIn = () => { SOC.tab = 'signin'; openPanel(); };

  async function render() {
    const c = card(); if (!c) return;
    const x = '<button class="x" type="button" data-s="close" aria-label="Close">✕</button>';
    const T = SOC.tab;
    if (T === 'signin') {
      c.innerHTML = `<div class="hd"><h2>Sign in</h2>${x}</div>
        <p>One account works in <b>both</b> games: Kickoff Rivals and Skywarden. Same email, same username.</p>
        <p style="color:#eaf2ff;font-weight:700;margin-top:12px">Have you signed in to ${GAME_NAMES[OTHER]} before?</p>
        <div class="big"><button class="pri" type="button" data-s="old">Yes, use that account</button><button type="button" data-s="new">No, I'm new</button></div>`;
    } else if (T === 'email-old' || T === 'email-new') {
      const old = T === 'email-old';
      c.innerHTML = `<div class="hd"><h2>${old ? 'Use your ' + GAME_NAMES[OTHER] + ' account' : 'Make an account'}</h2>${x}</div>
        <p>${old ? `Type the <b>same email</b> you used in ${GAME_NAMES[OTHER]}. Your username and friends come with you.` : `We'll email you a link. Tap it and you're signed in. You can use the same account in ${GAME_NAMES[OTHER]} too.`}</p>
        <form data-s="emailform"><input type="email" required autocomplete="email" placeholder="you@example.com" id="socEmail" aria-label="Email address">
        <div class="msg"></div><div class="big"><button class="pri" type="submit" data-s="send">SEND LINK</button><button type="button" data-s="back">Back</button></div></form>`;
      setTimeout(() => { const i = document.getElementById('socEmail'); i && i.focus(); }, 30);
    } else if (T === 'name') {
      c.innerHTML = `<div class="hd"><h2>Pick a username</h2>${x}</div>
        <p>This is how friends find you, in both games. 3 to 16 letters, numbers or _. Don't use your real name.</p>
        <form data-s="nameform"><input id="socName" maxlength="16" autocomplete="off" placeholder="e.g. GoalMachine_9" aria-label="Username">
        <div class="msg"></div><div class="big"><button class="pri" type="submit">SAVE USERNAME</button></div></form>`;
      setTimeout(() => { const i = document.getElementById('socName'); i && i.focus(); }, 30);
    } else {
      const inc = incoming().length;
      const tabs = `<div class="tabs"><button type="button" data-t="friends" class="${T === 'friends' ? 'on' : ''}">Friends</button><button type="button" data-t="requests" class="${T === 'requests' ? 'on' : ''}">Requests${inc ? ' (' + inc + ')' : ''}</button><button type="button" data-t="lobby" class="${T === 'lobby' ? 'on' : ''}">Lobby</button></div>`;
      const head = `<div class="hd"><div><h2>👥 ${esc(SOC.name || 'Player')}</h2><p style="margin:0;font-size:13px">Signed in · same account in both games · <a href="#" data-s="signout" style="color:#8ea0c4">sign out</a></p></div>${x}</div>${tabs}`;
      let body = '';
      if (T === 'friends') {
        const fr = SOC.list.filter(f => f.state === 'friend').sort((a, b) => (b.online - a.online) || a.username.localeCompare(b.username));
        body = `<form data-s="addform" style="display:flex;gap:8px;align-items:center"><input id="socAdd" maxlength="16" autocomplete="off" placeholder="Add a friend by username" aria-label="Friend's username" style="margin:0"><button class="pri" type="submit">Add</button></form><div class="msg"></div>`
          + (fr.length ? fr.map(f => `<div class="row"><span class="st ${f.online ? 'on' : ''}"></span><span class="nm">${esc(f.username)}<small>${f.online ? 'Online · playing ' + esc(GAME_NAMES[f.game] || 'a game') : 'Offline'}</small></span>`
            + `<button type="button" class="ok" data-inv="${esc(f.user_id)}">Invite</button><button type="button" class="no" data-rm="${f.fid}" title="Remove friend">✕</button></div>`).join('')
            : '<p>No friends yet. Ask a friend for their username and add them above.</p>');
      } else if (T === 'requests') {
        const inn = incoming(), out = SOC.list.filter(f => f.state === 'outgoing');
        body = (inn.length ? inn.map(f => `<div class="row"><span class="nm">${esc(f.username)}<small>wants to be friends</small></span><button type="button" class="ok" data-acc="${f.fid}">Accept</button><button type="button" class="no" data-dec="${f.fid}">Decline</button></div>`).join('') : '<p>No new requests.</p>')
          + (out.length ? '<p style="margin-top:12px">Waiting for them to accept:</p>' + out.map(f => `<div class="row"><span class="nm">${esc(f.username)}</span><button type="button" class="no" data-rm="${f.fid}">Cancel</button></div>`).join('') : '');
      } else if (T === 'lobby') {
        const code = A.myRoom();
        if (!code) body = `<p>You're not in a lobby yet.</p><div class="big"><button class="pri" type="button" data-s="host">CREATE A LOBBY</button></div><p style="font-size:13px">Then invite friends from here or the Friends tab.</p>`;
        else {
          const mem = await lobbyMembers(code), inLobby = A.roomPlayers ? A.roomPlayers() : [];
          const on = SOC.friendsOnline().filter(f => !mem.some(m => m.username === f.username));
          body = `<p>Your ${GAME_NAMES[A.game]} lobby</p><div class="code">${esc(code)}</div>`
            + `<div class="row"><span class="st on"></span><span class="nm">${esc(SOC.name)} <small>you</small></span></div>`
            + inLobby.filter(n => n !== SOC.name).map(n => `<div class="row"><span class="st on"></span><span class="nm">${esc(n)}<small>in the lobby</small></span></div>`).join('')
            + mem.filter(m => !inLobby.includes(m.username)).map(m => `<div class="row"><span class="st ${m.status === 'accepted' ? 'on' : ''}"></span><span class="nm">${esc(m.username)}<small>${m.status === 'accepted' ? 'joining…' : m.status === 'declined' ? 'said no' : 'invited'}</small></span></div>`).join('')
            + (on.length ? '<p style="margin-top:12px">Friends online:</p>' + on.map(f => `<div class="row"><span class="st on"></span><span class="nm">${esc(f.username)}<small>${esc(GAME_NAMES[f.game] || '')}</small></span><button type="button" class="ok" data-inv="${esc(f.user_id)}">Invite</button></div>`).join('') : '<p style="font-size:13px">No other friends online right now.</p>');
        }
      }
      const prev = document.getElementById('socAdd'), keep = prev ? prev.value : '', hadFocus = prev && document.activeElement === prev;
      c.innerHTML = head + body;
      const ni = document.getElementById('socAdd'); if (ni && keep) { ni.value = keep; } if (ni && hadFocus) ni.focus();
      const mm = c.querySelector('.msg'); if (mm) mm.textContent = SOC._msg || '';
      if (T === 'lobby' && A.myRoom()) { clearTimeout(SOC._lt); SOC._lt = setTimeout(() => { if (SOC.open && SOC.tab === 'lobby') render(); }, 5000); }
    }
  }

  box.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.dataset.s;
    if (f === 'emailform') { const v = (document.getElementById('socEmail').value || '').trim(); if (v) sendLink(v); }
    else if (f === 'nameform') setName(document.getElementById('socName').value);
    else if (f === 'addform') { const i = document.getElementById('socAdd'); addFriend(i.value); i.value = ''; }
  });
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-s],[data-t],[data-inv],[data-acc],[data-dec],[data-rm]'); if (!b) return;
    e.preventDefault();
    const s = b.dataset.s;
    if (s === 'close') close();
    else if (s === 'old') {
      // already signed in on this device through the other game? then it's instant
      await client(); if (SOC.user) { SOC.tab = 'friends'; render(); return; }
      SOC.tab = 'email-old'; render();
    }
    else if (s === 'new') { SOC.tab = 'email-new'; render(); }
    else if (s === 'back') { SOC.tab = 'signin'; render(); }
    else if (s === 'signout') { const c = await client(); await c.auth.signOut(); if (A.onSignedOut) A.onSignedOut(); SOC.tab = 'signin'; render(); }
    else if (s === 'host') { close(); const code = await A.host(); if (code) openPanel('lobby'); }
    else if (b.dataset.t) { SOC._msg = ''; SOC.tab = b.dataset.t; render(); if (SOC.tab !== 'lobby') loadFriends(); }
    else if (b.dataset.inv) invite(SOC.list.find(f => f.user_id === b.dataset.inv));
    else if (b.dataset.acc) { await rpc('soc_friend_respond', { fid:+b.dataset.acc, accept:true }); loadFriends(); }
    else if (b.dataset.dec) { await rpc('soc_friend_respond', { fid:+b.dataset.dec, accept:false }); loadFriends(); }
    else if (b.dataset.rm) { const f = SOC.list.find(x => String(x.fid) === b.dataset.rm); if (f && f.state === 'friend' && !confirm(`Remove ${f.username} from your friends?`)) return; await rpc('soc_friend_remove', { fid:+b.dataset.rm }); loadFriends(); }
  });

  /* ---------- the floating button ---------- */
  function refreshBtn() {
    if (A.nameNow && SOC.user) SOC.name = A.nameNow() || SOC.name;
    const vis = allowed && A.visible();
    btn.hidden = !vis || SOC.open;
    if (!vis) return;
    const inc = incoming().length, on = SOC.friendsOnline().length;
    btn.innerHTML = !SOC.user ? '👤 Sign in · Friends' : `👥 Friends${on ? ' · ' + on + ' online' : ''}${inc ? '<span class="dot">' + inc + '</span>' : ''}`;
  }
  SOC.refreshBtn = refreshBtn;

  /* ---------- timers ---------- */
  if (!allowed) return;
  setInterval(refreshBtn, 700);
  setInterval(pollInvites, 5000);
  setInterval(heartbeat, 45000);
  setInterval(() => { if (SOC.user && !document.hidden && (SOC.open || A.visible())) loadFriends(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { heartbeat(); pollInvites(); } });
  // sign in quietly in the background (a session from the other game is picked up here)
  setTimeout(() => client().catch(() => {}), A.game === 'skywarden' ? 2500 : 800);
})();
