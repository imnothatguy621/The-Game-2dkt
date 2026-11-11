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
