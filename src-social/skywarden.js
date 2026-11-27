/* ================= Skywarden: friends and lobbies on the shared account ================= */
(() => {
  const W = window.__SWS; if (!W) return;
  const wait = (fn, ms) => new Promise(res => { const t0 = Date.now(); const k = () => { if (fn()) res(true); else if (Date.now() - t0 > ms) res(false); else setTimeout(k, 150); }; k(); });
  const panelOpen = () => { const p = document.getElementById('npanel'); return p && !p.hidden; };
  async function toOnline() {
    W.openOnline();
    await wait(() => (W.G.state === 'play' || W.G.state === 'paused') && panelOpen(), 15000);
  }
  window.SOC_ADAPTER = {
    game:'skywarden',
    ownsProfile:true,
    nameNow:() => W.PROF.username,
    async getClient() {
      if (!W.ACCT.sb) W.acctInit();
      await wait(() => W.ACCT.sb, 12000);
      return W.ACCT.sb;
    },
    visible:() => W.G.state === 'menu' || (W.G.state === 'paused' && !panelOpen()),
    myRoom:() => W.NET.on ? W.NET.code : '',
    roomPlayers:() => [...W.NET.players.values()].map(p => p.name).filter(Boolean),
    async host() {
      if (W.NET.on) return W.NET.code;
      await toOnline(); W.netHost();
      await wait(() => W.NET.on || W.NET.err, 15000);
      return W.NET.on ? W.NET.code : '';
    },
    async join(code) {
      if (W.NET.on) W.netLeave('Leaving to join your friend.');
      await toOnline(); W.netJoin(code);
    },
  };
})();
/* ================= Skywarden: admin extras (admin accounts only, checked by the server) ================= */
(() => {
  const K = 'sw_hacks';
  const H = (() => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } })();
  const save = () => { try { localStorage.setItem(K, JSON.stringify(H)); } catch (e) {} };
  const BIG = 9999999;
  let btn = null;
  function tick() {
    if (!window.KR_ADMIN || typeof CR === 'undefined') return;
    if (H.money) { if (H.saved == null) { H.saved = CR.bal; save(); } if (CR.bal < BIG) CR.bal = BIG; }
    else if (H.saved != null) { if (CR.bal >= BIG) CR.bal = H.saved; H.saved = null; save(); }
  }
  setInterval(tick, 1000);
  function draw() {
    if (!btn) {
      btn = document.createElement('div'); btn.id = 'swAdm';
      btn.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom));z-index:9000;display:flex;gap:6px;font:700 13px system-ui,sans-serif';
      document.body.appendChild(btn);
      btn.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
        if (b.dataset.k === 'money') { H.money = !H.money; save(); tick(); draw(); }
        else if (b.dataset.k === 'dash') location.href = '/?admin=1';
      });
      for (const ev of ['pointerdown', 'keydown']) btn.addEventListener(ev, e => e.stopPropagation());
    }
    btn.hidden = !window.KR_ADMIN;
    const st = 'padding:8px 12px;border-radius:999px;border:1px solid #ffd23f;background:rgba(8,16,30,.85);color:#ffd23f;cursor:pointer';
    btn.innerHTML = `<button type="button" data-k="money" style="${st}${H.money ? ';background:#ffd23f;color:#111' : ''}">💰 Mod credits: ${H.money ? 'ON' : 'OFF'}</button><button type="button" data-k="dash" style="${st}">👑 Admin dashboard</button>`;
  }
  addEventListener('kr-admin', draw);
})();
