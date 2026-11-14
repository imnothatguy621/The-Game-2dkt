# Kickoff Rivals

The main game is one file: index.html, an original 11-a-side football game (three.js r128 is built in). It's made for phones and tablets first.

Backup: skywarden.html is the previous game, Skywarden, kept as is. To switch back, rename skywarden.html to index.html.

## Deploy on Vercel
1. Put index.html (and optionally vercel.json) at the TOP LEVEL of your GitHub repo.
   Delete any old copies, the old vendor/ folder and any other .html game files.
2. Vercel > Project > Settings > Build & Deployment:
   - Framework Preset: Other
   - Build Command: (empty)  Output Directory: (empty)  Root Directory: (empty)
3. Redeploy, then hard-refresh the site (Ctrl+Shift+R / Cmd+Shift+R).

If something still fails, a red box at the bottom of the page says why.

## Online play
Open the pause menu (or press 7, or "PLAY ONLINE" on the title screen). One person presses **Create room** and shares the 5-letter code or the invite link (`yoursite.vercel.app/?room=CODE`); friends type the code and press **Join**. Up to 8 pilots.
Players connect directly to each other (WebRTC via the free PeerJS service), so no server or account is needed. The host picks **Free roam** or **PvP battle** and can start **races together**. Press Enter to chat.

## Solar system
Fly straight up out of any planet (or keep climbing above 5 km on Earth) and you come out in open space. Hold boost to cruise between worlds; fly into a planet's atmosphere to drop straight onto its surface. Press 4 any time for the quick-jump star map.
New worlds: CINDER (volcanic moon of the gas giant Tempest) and AURELIA (ringed world).

## Checking your deploy
The title screen shows the build date under the online button. If your site doesn't show the newest date, the new index.html wasn't uploaded to the top level of the repo.

## Voice assistant (ORIN / VELA)
Hold the 0 key (or tap TALK) and speak. Works in Chrome, Edge and Safari. The assistant uses a British voice from your browser.
Out of the box it answers with built-in replies and runs game commands. For free conversation at no cost, open the pause menu and turn on "On-device AI": a small language model (Llama 3.2 1B, or Qwen 2.5 0.5B on lighter devices) downloads once and runs on your own GPU via WebLLM. It needs WebGPU (Chrome or Edge, or Safari 26). Optionally, add an
`ANTHROPIC_API_KEY` environment variable to the Vercel project (Settings → Environment Variables) and redeploy;
`api/assistant.js` then answers through Claude (model `claude-haiku-4-5`, override with `ASSISTANT_MODEL`). It is rate-limited
to 20 requests a minute per visitor.

## Quests and frames
Everyone starts with SPARROW. Eight people around the map (gold marker over their heads) give quests; each quest earns a frame,
and better frames mean harder quests. Press G near someone to talk, minus (−) for the quest journal. The final frame, SINGULARITY,
is won in a last battle over the city for Ada Wren at the Suit Library; its gauntlet starts empty, and each of the five shard powers is unlocked in its own trial. Admins (control-panel code) have every frame unlocked.

## Offline play
Open the site once with a connection. The menu then shows "offline ready" and the game runs with no internet from then on,
including after closing the browser. You can also install it as an app (browser menu → Install / Add to Home Screen).
Online multiplayer and the optional Claude backend still need a connection; the on-device AI works offline once its model has downloaded.

## Accounts (email sign-in via Supabase)
"Sign in with email" (a one-click link) on the menu and pause screen saves earned frames, quests, shards and add-ons to a `profiles` table
in Supabase (row-level security: each player can only read and write their own row). Progress from the device and the account
are merged on sign-in. Google must be enabled under Supabase → Authentication → Sign In / Providers, with
https://the-game-2kdt.vercel.app set as the Site URL and allowed redirect.

## Friends, lobbies and one account for both games
Kickoff Rivals (index.html) and Skywarden (skywarden.html) share one Supabase account: same email, same username.
Signing in on one page signs you in on the other (same site). The 👥 Friends button (bottom right of the menus) lets players
add friends by username, accept requests, see who's online and in which game, and invite friends into their lobby.
An invite to the other game opens that game and joins the room.
Kickoff's Online screen also has FIND MATCH: it pairs you with anyone else searching; if nobody shows up in 15 seconds you
play a bot with a made-up username (marked 🤖). Kickoff progress (careers, Road to Success, coins, settings) is saved to the account.

Code lives in src-social/ (social.js is shared, kickoff.js and skywarden.js connect it to each game). After editing, run
`python3 src-social/build.py` to put it into both pages. Database setup: run src-social/friends.sql once in Supabase → SQL Editor.

## Credits

- Ball flight physics (quadratic air drag and the Magnus effect from a 3D spin vector) are based on the model in
  **Johan Forslund**'s [football-physics](https://github.com/johanforslund/football-physics).
- 3D engine: [three.js](https://threejs.org) (MIT).
