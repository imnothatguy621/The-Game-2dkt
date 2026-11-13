# Puts the shared friends/lobby code into both games. Safe to run again.
import os, re
D = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(D)
rd = lambda f: open(os.path.join(D, f)).read()
def once(s, old, new, label):
    if new in s: return s
    assert s.count(old) == 1, (label, s.count(old))
    return s.replace(old, new)
def inject(s, js, tag='SOCIAL'):
    block = '<!--' + tag + '-START-->\n<script>\n' + js + '\n</script>\n<!--' + tag + '-END-->\n'
    s = re.sub(r'<!--' + tag + r'-START-->.*?<!--' + tag + r'-END-->\n', '', s, flags=re.S)
    i = s.rfind('</body>'); return s[:i] + block + s[i:]

# Kickoff Rivals
p = os.path.join(R, 'index.html'); s = open(p).read()
s = once(s, "auth:{ persistSession:false }, realtime:", "auth:{ persistSession:false, storageKey:'kr-net-anon' }, realtime:", 'netclient')
s = once(s, "async function hostRoom() {\n  netLeave();\n  const code = newCode();", "async function hostRoom(fixed) {\n  netLeave();\n  const code = /^[A-Z0-9]{4}$/.test(fixed || '') ? fixed : newCode();", 'hostroom')
s = once(s, "NET.role = 'host'; clearInterval(NET.wait);", "NET.role = 'host'; clearInterval(NET.wait); NET.peerName = String(p.name || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);", 'peername')
s = once(s, "label:'Online 1v1 · Room ' + code };", "label:'Online 1v1 · ' + ((window.SOC && SOC.username()) || 'Host') + ' vs ' + (NET.peerName || 'Guest') };", 'label')
s = once(s, "netSend('join', { team:NET.team, op:ALL[NET.team].admin && ADMIN })", "netSend('join', { team:NET.team, op:ALL[NET.team].admin && ADMIN, name:(window.SOC && SOC.username()) || '' })", 'hello')
s = once(s, "function netLeave() { clearInterval(NET.hb);", "function netLeave() { NET.peerName = ''; clearInterval(NET.hb);", 'leave')
s = once(s, "const boots = '#' + (look ? BOOTS[look.boot] : BOOTS[(Math.random() * 5) | 0])", "const boots = '#' + (look ? BOOTS[look.boot] : BOOTS[(Math.random() * BOOTS.length) | 0])", 'bootsrand')
s = once(s, "hairStyle:look ? (look.style || 0) : (Math.random() * 4) | 0 });", "hairStyle:look ? (look.style || 0) : (Math.random() * 6) | 0 });", 'hair6')
s = inject(s, open(os.path.join(R, 'src-gfx', 'kickoff-body2.js')).read(), 'BODY2')
s = inject(s, open(os.path.join(R, 'src-gfx', 'kickoff-gfx2.js')).read(), 'GFX2')
s = once(s, "model.traverse(o => { if (o.isSkinnedMesh) { o.material = mat;", "model.traverse(o => { if (o.isSkinnedMesh) { o.material = (/Joints/.test(o.name) && mat.userData.jointMat) || mat;", 'jointmat')
s = once(s, "const human = F && p === t.ctrl, ax = want[0] - p.vel.x,", "const human = F && p === t.ctrl; if (typeof movePhys === 'function') movePhys(p, want, human, dt); else { const ax = want[0] - p.vel.x,", 'movephys1')
s = once(s, "maxA = (human ? 34 : 16) * dt;\n      if (am > maxA) { p.vel.x += ax / am * maxA; p.vel.z += az / am * maxA; } else { p.vel.x = want[0]; p.vel.z = want[1]; }", "maxA = (human ? 34 : 16) * dt;\n      if (am > maxA) { p.vel.x += ax / am * maxA; p.vel.z += az / am * maxA; } else { p.vel.x = want[0]; p.vel.z = want[1]; } }", 'movephys2')
s = inject(s, open(os.path.join(R, 'src-gfx', 'kickoff-phys.js')).read(), 'PHYS')
s = inject(s, rd('kickoff.js') + '\n' + rd('social.js'))
open(p, 'w').write(s)

# Skywarden
p = os.path.join(R, 'skywarden.html'); s = open(p).read()
s = once(s, "window.__SW = { SA,", "window.__SWS = { ACCT, PROF, acctInit, openOnline, netHost, netJoin, netLeave, NET, G, resume };\nwindow.__SW = { SA,", 'export')
s = once(s, "function acctSignIn() {\n  if (!ACCT.sb) return;", "function acctSignIn() {\n  if (window.SOC && window.SOC.signIn) { if (G.state === 'play') pause && pause(); window.SOC.signIn(); return; }\n  if (!ACCT.sb) return;", 'signin')
s = inject(s, rd('skywarden.js') + '\n' + rd('social.js'))
open(p, 'w').write(s)
print('ok')
