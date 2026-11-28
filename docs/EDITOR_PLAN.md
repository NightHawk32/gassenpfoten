# Content editor – plan

Goal: edit cats, NPCs, quests, items, texts and maps in a browser instead of
by hand in JSON, without breaking references between them.

Status: **step 0 is done** (maps are JSON). Everything below is planned.

## Decision: a local editor, not a server

The editor runs only on the developer's machine, inside the Vite dev server
(`npm run dev` → `http://localhost:5173/gassenpfoten/editor/`). Saving writes
the JSON files in `src/` directly. Changes then go through git, a PR to
`main` and the normal GitHub Pages deploy, like any other change.

- No hosting, accounts, database or cost. The live game stays a static site.
- Nothing of the editor ships to players: the Vite plugin uses
  `apply: 'serve'`, and the editor page is not part of the production build.
- Rejected for now: a real backend (game would load content at runtime and
  stop working when the server is down) and a git-based web CMS (Decap CMS or
  similar). The CMS remains an option later if testers or co-writers should
  edit without a local setup. It would edit the same JSON files, so nothing
  here is wasted.

## Files the editor reads and writes

| Content | File | Notes |
|---|---|---|
| Maps | `src/world/districts/<id>.json` | rows, spots, exits, entries; new files must also be added to `districts/index.ts` |
| Cats | `src/data/cats.json` | |
| NPCs | `src/data/npcs.json` | greetings/barks/story are text keys |
| Quests | `src/data/quests.json` | |
| Items | `src/data/items.json` | |
| Texts | `src/i18n/de.json`, `src/i18n/en.json` | must keep identical keys |

Formatting on save must match the files today so diffs stay small:
`JSON.stringify(data, null, 2)` + newline for the data and language files.
District files use the compact style (one map row per line, points as
`{ "x": 1, "y": 2 }` on one line); use one shared formatter for them.

## Step 0 – maps to JSON (done)

- `marktplatz`, `neckarfront`, `bota` moved from `.ts` to `.json`, data
  verified unchanged. `description` and exit `note` replace the old code
  comments.
- `districts/index.ts` imports the JSON. `tsc` checks each file against
  `DistrictDef`; at startup the game checks that exits lead to existing
  districts and entries.

## Step 1 – editor shell and save API

- Vite plugin `scripts/editor-plugin.ts` (dev only) with a small API:
  - `GET  /__editor/content` → all files above in one JSON object.
  - `PUT  /__editor/file` `{ path, data }` → validate, format, write. Only
    the whitelisted paths above (plus new `src/world/districts/*.json`),
    nothing else on disk.
- Editor page `editor/index.html` + `src/editor/main.ts`: a list of sections
  (Maps, Cats, NPCs, Quests, Items, Texts) and a detail view per entry.
- Plain TypeScript + DOM forms, no new UI framework. The page reuses the game's
  types (`CatDef`, `NpcDef`, `DistrictDef`, quest types) so forms and checks
  follow the same definitions.
- Unsaved-changes marker and a "discard" button; save one file at a time.

## Step 2 – checks (shared by editor and build)

One module `src/content/validate.ts` that returns a list of problems
(`{ file, path, message }`). The editor shows them live; a new
`npm run check:content` runs it in CI before `tsc`, so broken content can't
deploy even when edited by hand.

- Ids unique per type; ids are lowercase-kebab.
- References exist: cat/NPC `district` and `spots` (incl. weather spots),
  cat `likes`/`dislikes` and shop items → items, quest step `match` targets
  (cat, npc, item, district), `requires` → quests, `ifStep` →
  `quest.step`, flags set somewhere vs. flags required somewhere, exits →
  district + entry.
- Text keys used by data exist in **both** language files; warn about
  unused keys.
- Maps: rows same length, spots/exits/entries walkable (reuse
  `buildDistrict`'s rules), every exit with `to` has a way back.

## Step 3 – forms for cats, NPCs, items, quests

- Dropdowns instead of free-text ids for every reference (district, spot,
  item, quest, step, cat, NPC, coat, look, day phase, weather).
- Text fields edit the German and English text side by side; new entries get
  keys generated from their id (`cat.<id>.…`, `npc.<id>.…`).
- Previews drawn with the game's own art code (`registerSprites`): the cat's
  coat, the NPC's look and placard.
- Quests: ordered list of steps with add/remove/reorder; rewards editor
  (coins, items, flags). Show which other quests depend on the one being
  edited.
- Rename id: update all references across files in one save (with a
  confirmation listing the files touched).

## Step 4 – map editor

- Canvas showing the district with the real tiles (`registerTiles` +
  `buildDistrict`), zoomable, grid toggle.
- Palette of legend characters (from `district.ts`), paint/fill/rectangle
  tools, undo/redo.
- Layers to place and drag spots, exits (with target dropdowns) and entries;
  overlay of which cats/NPCs use each spot.
- Walkability overlay; live errors from step 2.
- "New district": size, id, name keys; adds the import to
  `districts/index.ts`.
- Move the legend from the comment in `district.ts` into data (char → tile,
  walkable, label) so the palette and the engine share one source.

## Step 5 – try it in the game

- "Play here" button: opens the game in a new tab in the selected district
  (and optionally with a quest at a chosen step) via the dev-only
  `window.__dev` handle, using the unsaved content from the editor.

## Later / open

- Git-based web CMS for non-developers (see decision above).
- Tiled editor import, if hand-painting in our own editor isn't enough.
- Dialogue tree view for NPC story lines (`ifFlag`/`ifStep`/`give`).

## Rough effort

Step 1+2: one session. Step 3: one to two. Step 4: one to two. Step 5: small.
