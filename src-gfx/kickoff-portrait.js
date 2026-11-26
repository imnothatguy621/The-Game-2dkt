/* Kickoff Rivals: player portraits on cards.
   Every player now has a fixed look worked out from his name (skin tone, hair colour and style, boots, face details),
   so he looks the same in every match. The card portrait is a render of that same 3D player from the game:
   no outside photos, it's all the game's own artwork. */
(function () {
  if (typeof buildSkinned !== 'function' || typeof cardHTML !== 'function') return;

  // fixed look from a name (FNV-1a hash)
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  window.lookFor = function (name) {
    const h = hash(String(name || '').toLowerCase().trim()), h2 = hash('x' + name);
    return { skin: h % SKIN.length, hair: (h >>> 4) % HAIR.length, style: (h >>> 9) % 6, boot: (h >>> 13) % BOOTS.length, seed: (h2 % 10007) / 10007 };
  };

  /* ---------- offscreen portrait studio ---------- */
  const W = 160, H = 200;
  let studio = null;
  function setup() {
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x3a3a48, .75));
    const key = new THREE.DirectionalLight(0xfff2e2, 1.25); key.position.set(1.2, 2.4, 2.2); sc.add(key); sc.add(key.target); key.target.position.set(0, 1.55, 0);
    const rim = new THREE.DirectionalLight(0xbcd4ff, .7); rim.position.set(-1.6, 2, -1.4); sc.add(rim);
    const cam = new THREE.PerspectiveCamera(17.5, W / H, .1, 20);
    cam.position.set(.3, 1.6, 1.5); cam.lookAt(0, 1.52, 0);
    const rt = new THREE.WebGLRenderTarget(W, H, { format: THREE.RGBAFormat });
    rt.texture.encoding = THREE.sRGBEncoding;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    studio = { sc, cam, rt, cv, ctx: cv.getContext('2d'), buf: new Uint8Array(W * H * 4) };
  }
  const NEUTRAL = { c1: '#1d2433', c2: '#3a4560', pat: 'solid', sh: '#1d2433', so: '#1d2433', gk: '#f08a1a', gk2: '#111111' };
  function kitFor() {
    try { if (typeof RTS !== 'undefined' && RTS && RTS.club && ALL[RTS.club]) return kitOf(ALL[RTS.club]); } catch (e) {}
    return NEUTRAL;
  }
  function render(name, gk, kit) {
    if (!studio) setup();
    const { sc, cam, rt, cv, ctx, buf } = studio;
    const g = buildSkinned(kit, '', gk, false, lookFor(name), sc, name);
    g.root.rotation.y = -.22;
    g.root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });   // no ground shadow blob
    g.A.idle.time = .4; g.mixer.update(1e-4);
    g.root.updateMatrixWorld(true);
    const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevSh = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA); renderer.shadowMap.autoUpdate = prevSh;
    sc.remove(g.root); try { disposeSkinned(g); } catch (e) {}
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);   // flip: GL rows start at the bottom
    ctx.clearRect(0, 0, W, H); ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  /* ---------- cache + queue (one portrait at a time, so menus never stutter) ---------- */
  const CACHE = new Map(), QUEUE = [], WANT = new Set();
  const keyOf = (p, kit) => (p.pos === 'GK' ? 'g|' : 'o|') + kit.c1 + kit.c2 + '|' + p.name;
  function pump() {
    if (!QUEUE.length) return;
    if (!XBOT.ready || (S.state === 'play' && !S.paused)) { setTimeout(pump, 400); return; }
    const job = QUEUE.shift(); WANT.delete(job.k);
    if (!CACHE.has(job.k)) {
      try { CACHE.set(job.k, render(job.name, job.gk, job.kit)); } catch (e) { CACHE.set(job.k, ''); console.warn('portrait', e); }
      if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value);
      const url = CACHE.get(job.k);
      if (url) document.querySelectorAll('img.pface').forEach(i => { if (i.dataset.pk === job.k) { i.src = url; i.classList.add('on'); } });
    }
    setTimeout(pump, 30);
  }
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const escA = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  const _card = cardHTML;
  cardHTML = function (p, opts) {
    let h = _card(p, opts);
    if (!p || !p.name || (opts && opts.back) || !/class="sil"/.test(h)) return h;
    const kit = kitFor(), k = keyOf(p, kit), url = CACHE.get(k);
    if (url == null && !WANT.has(k)) { WANT.add(k); QUEUE.push({ k, name: p.name, gk: p.pos === 'GK', kit }); if (QUEUE.length === 1) setTimeout(pump, 0); }
    return h.replace('<span class="sil"></span>', `<span class="sil"></span><img class="pface${url ? ' on' : ''}" alt="" data-pk="${escA(k)}" src="${url || BLANK}">`);
  };

  const css = document.createElement('style');
  css.textContent = `.pcard .pface{position:absolute;left:50%;top:17%;width:70%;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity .25s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));
    -webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 96%);mask-image:linear-gradient(to bottom,#000 72%,transparent 96%)}
  .pcard .pface.on{opacity:1} .pcard:has(.pface.on) .sil{display:none} .pcard .o,.pcard .ps,.pcard .nt,.pcard .nm,.pcard .psb,.pcard .fit,.pcard .dupe{z-index:1}`;
  document.head.appendChild(css);
  window.PORTRAIT = { render, CACHE };
})();
