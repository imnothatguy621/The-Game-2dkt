# Skywarden

The whole game is one file: index.html (three.js r128 is built in).

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
