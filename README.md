# Skywarden

An original 3D armored-flight sandbox that runs in the browser. It's a static site with no build step.

## Deploy on Vercel
1. Put `index.html`, the `vendor/` folder and `vercel.json` at the **root** of your GitHub repo.
2. In Vercel: **Add New → Project →** pick the repo.
3. Framework Preset: **Other**. Build Command: leave **empty**. Output Directory: leave **empty** (or `.`).
4. Deploy.

## Run locally
Run `npx serve .` (or `python3 -m http.server`) in this folder, then open the address it prints.
Opening `index.html` by double-clicking also works.
