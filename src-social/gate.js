/* ================= Sign-in gate (shared by Kickoff Rivals and Skywarden) =================
   You sign in before playing, with the same account in both games, so progress always follows the account.
   If the account server can't be reached (no internet, or the server is waking up), you can still play
   offline; progress is kept on the device and goes to your account the next time you sign in.
   Admin accounts are recognised by the server (admins table) and get window.KR_ADMIN = true. */
(() => {
  const A = window.SOC_ADAPTER, SOC = window.SOC;
  if (!A || !SOC) return;
  const host = location.hostname;
  const allowed = /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(host);
  const dev = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host);           // local testing stays open
  if (!allowed || dev) return;
  const GAME = A.game === 'kickoff' ? 'Kickoff Rivals' : 'Skywarden';
  const OTHER = A.game === 'kickoff' ? 'Skywarden' : 'Kickoff Rivals';

  const css = document.createElement('style');
  css.textContent = `
  #krGate{position:fixed;inset:0;z-index:8990;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 30%,#13284d,#050a14 70%);color:#eaf2ff;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
  #krGate[hidden]{display:none}
  #krGate .gc{width:min(440px,94vw);text-align:center;background:rgba(12,22,40,.9);border:1px solid #233457;border-radius:20px;padding:26px 22px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  #krGate h1{margin:0 0 4px;font:900 italic 30px system-ui,sans-serif;letter-spacing:.02em} #krGate h1 em{color:#ffd23f;font-style:inherit}
  #krGate p{margin:8px 0;color:#a9b8d6} #krGate .why{font-size:13px}
  #krGate button{font:inherit;cursor:pointer;border-radius:12px;border:1px solid #2c4170;background:#15233f;color:#eaf2ff;padding:11px 16px;width:100%;margin-top:10px}
  #krGate button.pri{background:#2f7cff;border-color:#2f7cff;font-weight:800;font-size:17px}
  #krGate .off{display:none} #krGate.offline .off{display:block}
  #krGate .st{min-height:1.4em;font-size:13px;color:#ffd27a}
  #krGate.wait button,#krGate.wait .why,#krGate.wait .off{visibility:hidden}`;
  document.head.appendChild(css);
  const g = document.createElement('div'); g.id = 'krGate'; g.className = 'wait';
  g.innerHTML = `<div class="gc"><h1>${A.game === 'kickoff' ? 'KICKOFF <em>RIVALS</em>' : 'SKY<em>WARDEN</em>'}</h1>
    <p><b>Sign in to play.</b> One free account works in both ${GAME} and ${OTHER}, and your progress is saved to it.</p>
    <button type="button" class="pri" data-g="in">Sign in or create an account</button>
    <p class="why">No password: we email you a sign-in link.</p>
    <p class="st" id="krGateSt"></p>
    <div class="off"><p>We can't reach the account server right now.</p><button type="button" data-g="off">Play offline for now</button><button type="button" data-g="retry">Try again</button></div></div>`;
  document.body.appendChild(g);
  const st = t => { const e = document.getElementById('krGateSt'); if (e) e.textContent = t || ''; };
  let offline = sessionStorage.getItem('kr_gate_off') === '1', admChecked = null;

  const signedIn = () => !!SOC.user && (A.ownsProfile || !!SOC.username());
  function update() {
    const need = !offline && !signedIn();
    g.hidden = !need;
    if (need && SOC.user && !SOC.username() && !A.ownsProfile && !SOC.open) SOC.openPanel('name');
    if (SOC.user && admChecked !== SOC.user.id) checkAdmin();
    if (!SOC.user && window.KR_ADMIN) { window.KR_ADMIN = false; admChecked = null; dispatchEvent(new CustomEvent('kr-admin', { detail:false })); }
  }
  async function checkAdmin() {
    const u = SOC.user; admChecked = u.id;
    try {
      const c = SOC.sb || await A.getClient(); const { data, error } = await c.rpc('soc_is_admin');
      const on = !error && data === true;
      if (on !== !!window.KR_ADMIN) { window.KR_ADMIN = on; dispatchEvent(new CustomEvent('kr-admin', { detail:on })); }
    } catch (e) { admChecked = null; }
  }
  // is the account server reachable? (it may be asleep or the device offline)
  async function reachable() {
    if (navigator.onLine === false) return false;
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch('https://drfazxushjlsmumphpkb.supabase.co/auth/v1/health', { headers:{ apikey:'sb_publishable_pX_ztQJ49PakWIihig4m1g_exzN71Ie' }, signal:ctl.signal });
      clearTimeout(to); return r.ok;
    } catch (e) { return false; }
  }
  async function probe() {
    const ok = await reachable();
    g.classList.toggle('offline', !ok);
    if (ok && !g.classList.contains('wait')) st('');
  }
  g.addEventListener('click', async e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    if (b.dataset.g === 'in') SOC.openPanel('signin');
    else if (b.dataset.g === 'off') { offline = true; sessionStorage.setItem('kr_gate_off', '1'); update(); SOC.toast('Playing offline. Progress stays on this device and goes to your account when you sign in.', null, 6000); }
    else if (b.dataset.g === 'retry') probe();
  });
  for (const ev of ['keydown', 'keyup', 'pointerdown']) g.addEventListener(ev, e => e.stopPropagation());
  setInterval(update, 500);
  update(); setTimeout(probe, 600);
  // don't flash the sign-in buttons at people who are already signed in: wait for the saved session first
  st('Checking your account…');
  const t0 = Date.now(), ready = setInterval(() => { if ((SOC.sb && Date.now() - t0 > 1200) || Date.now() - t0 > 6000) { clearInterval(ready); g.classList.remove('wait'); if (!g.classList.contains('offline')) st(''); } }, 200);
  // once you're back online and signed in, the offline pass ends
  setInterval(() => { if (offline && SOC.user) { offline = false; sessionStorage.removeItem('kr_gate_off'); } }, 3000);
  window.KR_GATE = { update, probe, isOpen:() => !g.hidden };
})();
