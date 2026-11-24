# Gassenpfoten – The Cats of Tübingen 🐾

*Die Katzen von Tübingen*

A calm, cozy browser game set in Tübingen: find, feed and pet the neighbourhood cats. Watch out for the orange ones.

- 📄 Game concept: [docs/GAME_CONCEPT.md](docs/GAME_CONCEPT.md)
- 🎨 Asset licences: [CREDITS.md](CREDITS.md)
- 🧩 Adding items, areas, cats and quests: [docs/EXTENDING.md](docs/EXTENDING.md)
- Status: **M2 – vertical slice, in progress**: Marktplatz and Neckarfront (unlocked after the first quest), 5 cats, feeding, petting, day/night, cat journal, quests

## Development

Requires **Node.js ≥ 20.19** (22 LTS recommended).

```bash
npm install          # first time; commit the generated package-lock.json
npm run dev          # dev server → http://localhost:5173/gassenpfoten/
npm run build        # asset-name check + typecheck + production build → dist/
npm run preview      # serve dist/ exactly as GitHub Pages will (under /gassenpfoten/)
```

Controls: **WASD/arrows** or click/tap to walk · **E** (or tap a cat) to feed and pet · **Shift** or 🐾 to sneak · **J** cat journal · **L** language · hold **T** or ⏩ to fast-forward time.

The canvas always renders at the screen's real pixel resolution (capped at 2× device pixel ratio) and adapts to landscape and portrait, so the game runs on phones. Lay out scenes from `this.scale.width/height` with `uiScale()` / `pixelScale()` from `src/systems/viewport.ts` and re-layout on the scale `resize` event. In dev builds, `window.__dev` gives console access to the game, the event bus and the game state. To test on a phone in the same Wi-Fi: `npm run dev -- --host`.

### Project layout
```
index.html              entry page
vite.config.ts          base path '/gassenpfoten/' (GitHub Pages)
src/
  main.ts               Phaser game setup
  config.ts             constants, assetUrl() helper, storage prefix
  scenes/               Boot, Title, Game (world), Hud (UI), Pet (petting close-up)
  entities/             Player, Cat
  world/                district builder, grid + pathfinding, districts/ registry
  data/                 cats.json, items.json, quests.json (content)
  systems/              clock, save state, quests, event bus, viewport, storage
  art/                  procedural placeholder sprites and tiles
  ui/                   shared buttons
  i18n/                 de.json / en.json + t() helper
public/assets/          game assets (lower-kebab-case, licence in CREDITS.md)
scripts/                build helpers
docs/                   design documents
```

### Rules that keep GitHub Pages working (concept §10.1)
1. Load assets in code only via `assetUrl('assets/…')`, never via `'/assets/…'`.
2. Asset names in `public/` are **lower-kebab-case** (the build enforces this).
3. No client-side routes, no backend, no secrets.
4. `localStorage` only through `src/systems/storage.ts` (keys are prefixed `gassenpfoten:`).
5. Every new asset gets a line in `CREDITS.md`.

## Deployment (GitHub Pages)

The workflow `.github/workflows/deploy.yml` builds on every push and pull request.
The **deploy** step is switched off until Pages is available (a public repo, or a paid plan for private ones):

1. Make the repository public (*Settings → General → Danger Zone*). Check `CREDITS.md` first.
2. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
3. *Settings → Secrets and variables → Actions → Variables:* add `PAGES_ENABLED` = `true`.
4. Push to `main` or run the workflow manually → <https://nighthawk32.github.io/gassenpfoten/>
