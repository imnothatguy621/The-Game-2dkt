// Skywarden assistant: turns what the pilot says into a short in-character reply and, when it fits, one game command.
// Needs an ANTHROPIC_API_KEY environment variable in the Vercel project. Without it the game uses its built-in replies.
const COMMANDS = ['status', 'scan', 'suit up', 'call suit', 'eject', 'drones', 'weather clear', 'weather rain', 'weather storm', 'day', 'night',
  'supersonic', 'flares', 'sentry', 'goliath', 'repair', 'helmet', 'face', 'power weapons', 'power thrust', 'power shields', 'power balanced',
  'race', 'photo', 'star map', 'space', 'warp halo', 'warp vesper', 'warp kryos', 'warp thalassa', 'warp noctis', 'launch', 'roll', 'shield', 'burst',
  'pilots', 'pilots off', 'hunters', 'hunters off', 'first person', 'third person'];
const hits = new Map();
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error:'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error:'assistant not configured' }); return; }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x', now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < 60000); if (h.length >= 20) { res.status(429).json({ error:'slow down' }); return; }
  h.push(now); hits.set(ip, h);
  const b = req.body || {}, text = String(b.text || '').slice(0, 300), ai = b.ai === 'VELA' ? 'VELA' : 'ORIN';
  const hist = Array.isArray(b.hist) ? b.hist.slice(-6) : [];
  const system = `You are ${ai}, the onboard AI of an armoured flight suit in Skywarden, an original video game. You are British: dry, warm, quick, understated wit, impeccable manners, British spelling. Never claim to be any character from films or comics.
Reply in one or two short spoken sentences, under 40 words. You can see the game state below.
If the pilot asks you to do something the game supports, also choose exactly one command from this list: ${COMMANDS.join(', ')}. You can also name a suit (e.g. "kestrel") as the command.
Answer ONLY with JSON: {"reply":"...","command":"..." or null}.`;
  const messages = [];
  for (const m of hist) { if (m && m.u && m.a) { messages.push({ role:'user', content:String(m.u).slice(0, 200) }); messages.push({ role:'assistant', content:JSON.stringify({ reply:String(m.a).slice(0, 300), command:null }) }); } }
  messages.push({ role:'user', content:`Game state: ${JSON.stringify(b.ctx || {}).slice(0, 800)}\nPilot says: ${text}` });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body:JSON.stringify({ model:process.env.ASSISTANT_MODEL || 'claude-haiku-4-5', max_tokens:180, system, messages }) });
    if (!r.ok) { res.status(502).json({ error:'upstream ' + r.status }); return; }
    const j = await r.json(), out = (j.content || []).map(c => c.text || '').join('');
    let reply = out, command = null;
    try { const m = out.match(/\{[\s\S]*\}/); if (m) { const o = JSON.parse(m[0]); reply = o.reply || ''; command = o.command || null; } } catch (e) {}
    if (command && !COMMANDS.includes(command) && !/^[a-z]{3,14}$/.test(command)) command = null;
    res.status(200).json({ reply:String(reply).slice(0, 400), command });
  } catch (e) { res.status(500).json({ error:'failed' }); }
};
