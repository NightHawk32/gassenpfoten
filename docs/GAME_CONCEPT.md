# Gassenpfoten – The Cats of Tübingen: Game Concept

> Status: **Draft v0.5** (2026-11-23). Open decisions are marked **[OPEN]** and collected in §12.

---

## 1. Elevator pitch

A calm, cozy browser game set in **Tübingen**. You walk through the Altstadt, along the Neckar and up the hills to **find, feed and pet the neighbourhood cats**. Which cats are out depends on the **time of day and the weather**. Along the way you meet locals who give hints, trade treats and tell stories.

One threat interrupts the calm: the **orange cats**. They are mean, they steal your treats, scare off shy cats and generally cause trouble.

**Pillars**
1. **Calm.** You can't die or fail, and nothing rushes you. Losing something only costs a few treats or a wasted walk.
2. **Observation is rewarded.** You learn where, when and in what weather each cat appears.
3. **A real place.** Tübingen should feel recognisable: cobblestones, steep alleys, the Neckarfront, Stocherkähne.
4. **Cosy mischief.** The orange cats add friction and humour, never stress.

---

## 2. Player fantasy and target audience

- **Fantasy:** "I know every cat in this town, and they all know me."
- **Audience:** casual players who like cozy games (*Neko Atsume*, *Stardew Valley*, *A Short Hike*, *Little Kitty, Big City*), cat lovers, and people who know Tübingen.
- **Session length:** 5–20 minutes. You should be able to take one walk and stop.
- **Platform:** desktop and mobile browser.

---

## 3. Core loop

```
 ┌─────────────► EXPLORE  (walk through a district, look and listen)
 │                  │
 │                  ▼
 │               FIND  a cat (it depends on location, time and weather)
 │                  │
 │                  ▼
 │               APPROACH carefully (read body language, don't spook it)
 │                  │
 │                  ▼
 │               FEED  (choose the right treat)  ──► trust ↑
 │                  │
 │                  ▼
 │               PET   (find its favourite spot)  ──► trust ↑↑, journal entry
 │                  │
 │                  ▼
 └──── REWARD: cat journal page, photo, new hints, coins, new areas or items
```

**Meta loop:** fill the **Katzenbuch** (cat journal), raise each cat's **trust level** and unlock districts, items and the stories of the people you meet.

---

## 4. Mechanics

### 4.1 Finding cats
Each cat has a **spawn profile**:

| Property | Example |
|---|---|
| Home locations | Stiftskirche steps, Hölderlinturm garden |
| Active times | dawn, evening, night |
| Weather preference | likes sun, hides from rain |
| Season | only in summer, or winter only by the bakery's warm vent |
| Shyness | 1–5 (how carefully you have to approach) |
| Requirement | e.g. trust ≥ 2 with another cat, or a hint from an NPC |

Hints that a cat is nearby: a **tail sticking out**, a **meow** (positional audio), **paw prints** in snow or mud, a rustling bush.

### 4.2 Time of day
- **Decided: accelerated in-game clock.** 1 game day ≈ 24 real minutes (1 real minute = 1 game hour). The clock keeps running only while you play. Saving stores the in-game time, so you continue where you left off.
- Sleeping at the home base skips to the next morning, so you can deliberately wait for a particular phase.
- Phases: *Morgendämmerung* (dawn), *Vormittag* (morning), *Mittag* (midday), *Nachmittag* (afternoon), *Abend* (evening), *Nacht* (night).
- Real cats are most active at **dawn and dusk**, so those phases have the most cats. Midday heat is for sleeping cats in the shade.
- Lighting changes across the day: street lamps come on and windows light up.

### 4.3 Weather
| Weather | Effect on cats | Mood |
|---|---|---|
| ☀️ Sunny | sunbathing on walls and steps, easy to find | bright, birdsong |
| ⛅ Cloudy | normal distribution | neutral |
| 🌧️ Rain | shelter under arcades, archways, the Fruchtschranne roof, cars; fewer cats, but rare "rain cats" | rain sounds, puddles |
| 🌫️ Fog (on the Neckar) | mysterious cats appear, visibility drops | quiet, muffled |
| ❄️ Snow | paw prints make tracking possible; cats near warm spots (bakery, cellar windows) | very cozy |
| 🔥 Heat | cats in the shade, by the Neckar, under the Platanenallee | cicadas, slow pace |

- **Decided: simulated weather.** A small weather model with plausible transitions (e.g. sunny → cloudy → rain → fog the next morning), weighted by season (snow only in winter, heat only in summer). Weather changes at most every few game hours. Rare weather such as fog or snow can be forecast by NPCs ("Tomorrow there'll be fog on the Neckar, gell?").

### 4.4 Feeding
- Inventory of **treats**: dry food, wet food, tuna, chicken, catnip, a milk alternative (no cow's milk, for realism).
- Each cat has **likes and dislikes**. The right treat gives a big trust gain, a neutral one a small gain, a disliked one makes the cat leave.
- Get treats at the **pet shop** or from **NPCs**, or find them now and then (with small rewards for daily walks).
- Feeding is a short calm action: put the bowl down, step back, wait.

### 4.5 Petting
- After feeding, you can approach and pet the cat.
- **Body language system:** tail position, ears, eyes (slow blinking means trust), purring and vibration on mobile.
- Each cat has favourite spots (chin, cheeks, head) and **no-go spots** (belly!). Find them by trial and by reading the signals.
- Done well: purring, a heart animation, trust up, and the cat may **follow you briefly** or show you a new place.
- Done badly: the cat walks away. There is no other penalty; you can try again tomorrow.

### 4.6 Trust levels (per cat)
| Level | Name | Unlocks |
|---|---|---|
| 0 | Unknown | silhouette in the journal |
| 1 | Seen | name, location hint |
| 2 | Fed | likes and dislikes |
| 3 | Friend | petting spots, photo mode |
| 4 | Best friend | cat greets you, shows secret spots, can "visit" your home base |

### 4.7 The orange cats 🍊 (antagonists)
In this world, **orange cats are evil and mean**: in a funny, cozy way, never violent.

- **The Rote Bande** (red gang), led by a large orange tomcat (name **[OPEN]**, e.g. *Baron von Möhre*), with a few henchcats.
- **What they do:**
  - **steal treats** from bowls you put down, or from your bag;
  - **scare away** shy cats when they appear nearby;
  - **block paths** by lying across a narrow alley and refusing to move;
  - **fake friendliness**: they purr, then swipe at you or knock something over;
  - **mess up** NPC gardens and market stalls, which can become a small quest.
- **Counterplay** (always non-violent):
  - distraction with a **decoy treat** or a toy;
  - avoiding them, since they have routines and routes you can learn;
  - help from certain NPCs (e.g. the market woman who knows their tricks);
  - sneaking: approaching quietly so they don't notice you.
- **Decided: the Rote Bande stays mean, with one exception.** Late in the game a small orange kitten, **Klementine**, appears. At first everyone (players and NPCs) assumes it is part of the gang. In fact it was pushed out by the Bande for being too nice. Befriending Klementine is a late-game story arc, and NPCs react to it with surprise ("An orange one? That's friendly? Ha noi!"). Klementine is the only orange cat that can visit the home base.

### 4.8 Meeting people
NPCs make the town feel alive and serve as a **hint system**.

| Character (draft) | Location | Role |
|---|---|---|
| **Frau Häberle**, retired, feeds the strays | Altstadt / Haaggasse | tutorial, knows every cat, sells home-cooked treats |
| **Jonas**, student, philosophy, 14th semester | Neckarmauer, Stocherkahn | gives cryptic tips about night cats; dry humour |
| **Stocherkahn boatman** | Neckar, Hölderlinturm | ferry to the Neckarinsel, river cats |
| **Baker** | near the Marktplatz | warm spot in winter, gives you a pretzel (*Brezel*); trades treats for errands |
| **Pet shop owner** | Mühlstraße area | shop, upgrades (better bag, camera) |
| **Market woman** | Marktplatz (market days) | anti-orange-cat expert |
| **Night watchman / tour guide** | Schloss Hohentübingen | night tours, ghost-cat legend |

- Dialogue is short and friendly, with a little Swabian colour (*"Ha noi!"*, *"Gell?"*).
- **Decided: bilingual German / English, switchable** in the settings. All text lives in language files (i18n) from day one. Swabian phrases stay as they are in the English version, as local colour.
- NPCs have **small story arcs** that unlock through cat progress.

---

### 4.9 Player character
- **Decided: customisable.** At the start you choose name, look (skin tone, hairstyle and colour, clothing, accessories such as a scarf, beanie or glasses) and preferred pronouns (DE/EN).
- Story framing (proposal): you have just moved to Tübingen into a small attic flat in the Altstadt. On the first evening a cat sits on your windowsill. That is the tutorial.
- Unlockable clothing (e.g. a cat-ear beanie, a Stocherkahn captain's hat, a rain cape) as rewards. Purely cosmetic.

## 5. World: Tübingen

The town is built as **stylised districts** connected by paths. It is recognisable, but not a 1:1 map.

| District | Highlights | Typical cats |
|---|---|---|
| **Altstadt & Marktplatz** (start) | Rathaus, Stiftskirche, steep alleys, market days | sociable everyday cats, Rote Bande HQ |
| **Neckarfront** | Hölderlinturm, Neckarmauer, Stocherkähne | sunbathers, river cats |
| **Neckarinsel & Platanenallee** | plane trees, benches, fog | fog and shade cats |
| **Schlossberg / Hohentübingen** | castle, view, cellars | night cats, the "ghost cat" (rare) |
| **Ammertal & Ammerkanal** | small canal, back gardens | shy cats |
| **Botanischer Garten** (unlockable) | greenhouses | warmth-loving cats in winter |
| **Österberg / vineyards** (unlockable) | slopes, view | rare cats at sunrise |
| **Französisches Viertel / Südstadt** (later) | courtyards, cafés | modern "WG cats" (flat-share cats) |

**Seasonal events (optional):** Stocherkahnrennen (summer), chocolART chocolate festival (December, with a hot-chocolate stall), Christmas market, autumn leaves on the Neckar.

---

## 6. Progression and goals

- **Main goal:** befriend every cat in Tübingen (e.g. 30–40 cats in v1.0).
- **Side goals:** NPC stories, photo album, "outwit the Rote Bande" mini-quests.
- **Gentle soft gating:** new districts open through trust progress or NPC events, never through time pressure.
- **No energy system, no ads, no monetisation.**

---

## 7. Controls and UX
- **Desktop:** WASD or arrow keys / mouse click to move; E or click to interact.
- **Mobile:** tap to walk; tap and hold to pet; swipe along the cat to stroke.
- UI: minimal, with a **cat journal**, inventory and map. A clock and weather icon sit in a corner.
- **Photo mode:** take a photo of a cat, saved to the journal.

---

## 8. Art and audio direction
- **Decided: 2D pixel art, top-down** (with slight ¾ perspective for buildings, as in Stardew Valley). Proposed tile size 16×16 px, scaled up in whole-number steps.
- Palette: warm, soft; half-timbered houses, red roofs, green Neckar.
- **Audio:** soft lo-fi / acoustic music for each time of day; ambient sound (church bells of the Stiftskirche, river, rain, birds, Stocherkahn poles in the water).
- Cats: distinct silhouettes, fur patterns and personalities (tabby, black, tuxedo, calico, grey, white…). **Orange is reserved for the Rote Bande.**

---

## 9. Example cats (seed content)

| Name | Look | Where / when | Likes | Quirk |
|---|---|---|---|---|
| **Hölderlin** | grey, long fur | Hölderlinturm garden, afternoons, sun | tuna | stares melancholically at the Neckar |
| **Mina** | tuxedo | Stiftskirche steps, mornings | chicken | sociable tutorial cat |
| **Schatten** | black | Schlossberg, night, fog | catnip | very shy (5/5) |
| **Brezel** | brown tabby | bakery, winter mornings | wet food | sits on the warm vent |
| **Kahn** | white with spots | on a moored Stocherkahn, summer evenings | fish treats | sometimes "rides along" |
| **Professor** | old, grey tabby | university area, rain (under arcades) | dry food | ignores you until trust 2 |
| **Baron von Möhre** 🍊 | big, orange | everywhere, always | *your* treats | Rote Bande boss |

---

## 10. Technical concept (first proposal)

| Topic | Proposal |
|---|---|
| Engine | **Phaser 3** (2D, mature, good for tilemaps) **or** PixiJS with custom logic |
| Language | **TypeScript** |
| Build | **Vite** |
| Maps | **Tiled** editor (tilemaps exported as JSON) |
| Data | cats, NPCs and spawn rules as **JSON / data files**, so content can grow without code changes |
| Save | `localStorage` / IndexedDB, plus export/import of the save file |
| Weather | simulated (Markov-style state machine, weighted by season) |
| Time | in-game clock, 1 real minute = 1 game hour |
| i18n | language files `de.json` / `en.json` from the start |
| Hosting | **Decided: GitHub Pages** (repo goes public at release, see §10.1) |
| Offline | PWA later, so it can be installed on a phone |

### 10.1 Deployment target: GitHub Pages
The game has to run as a **purely static site** on `https://nighthawk32.github.io/gassenpfoten/`. These rules apply from the first line of code:

| Rule | Why / how |
|---|---|
| **Static only, no backend** | Pages serves files only. No server, no database, no API keys. Saves, weather and time all stay on the client. |
| **Subpath-safe** | The game lives under `/gassenpfoten/`, not `/`. Set Vite's `base: '/gassenpfoten/'`, and load every asset through the base URL (`import.meta.env.BASE_URL`), never through absolute `/assets/...` paths. |
| **No client-side routes** | There are no history-API URLs like `/journal`, which would return 404 on Pages. Everything is one page; screens are game scenes. If routes are ever needed, use hash routing (`#/journal`). |
| **Case-sensitive file names** | Pages is case-sensitive, Windows is not. Convention: all asset files are `lower-kebab-case`. |
| **Unique save keys** | `localStorage` is shared by every project under `nighthawk32.github.io`. Prefix all keys, e.g. `gassenpfoten:save:v1`, and version the save format. |
| **Build via GitHub Actions** | A workflow runs `npm ci && npm run build` and deploys `dist/` with `actions/deploy-pages` on push to `main`. There is no `gh-pages` branch, and no build output is committed. |
| **Reasonable size** | Pages limits: site ≤ 1 GB, soft bandwidth limit 100 GB/month. Use pixel-art sprite atlases and compressed audio (OGG/MP3, see §8). |
| **Public-repo-ready** | Before going public: no secrets in the history, a `LICENSE` file, and **only assets we are allowed to publish** (own work, or CC0 / CC-BY with credits in `CREDITS.md`). Track every asset's licence from day one. |
| **Works offline later** | A PWA service worker (M4) must use the `/gassenpfoten/` scope. |

**Local check:** `npm run build && npm run preview` serves the build under the same `/gassenpfoten/` base, so path problems show up before deployment.

**Spawn logic (sketch):**
```
for each cat in district:
    if time_phase ∉ cat.active_times: skip
    weight = cat.base_weight
           × weather_modifier(cat, current_weather)
           × season_modifier(cat, current_season)
           × (rote_bande_nearby ? cat.shyness_penalty : 1)
    roll against weight → place at one of cat.home_spots
```

---

## 11. Scope and milestones

| Milestone | Content |
|---|---|
| **M0: Concept** | this document, repo setup |
| **M0.5: Pipeline** | Vite + TS + Phaser scaffold, GitHub Actions build, `base` path set; deployable placeholder page |
| **M1: Prototype** | one district (Marktplatz), movement, 3 cats, feeding and petting, day/night cycle |
| **M2: Vertical slice** | Altstadt + Neckarfront, weather system, 8 cats, 2 NPCs, Rote Bande basics, journal, saving |
| **M3: Alpha** | all core districts, 20+ cats, NPC stories, sound |
| **M4: 1.0** | 30–40 cats, seasons, polish, mobile, PWA |

---

## 12. Open questions

~~1. Clock~~ → in-game clock · ~~2. Weather~~ → simulated · ~~3. Art style~~ → pixel art · ~~4. Perspective~~ → top-down · ~~5. Language~~ → DE/EN switchable

~~6. Orange cats~~ → stay evil, one exception (Klementine)
7. **Name of the orange boss.**
~~8. Player character~~ → customisable
9. **Home base:** a small flat or WG room where befriended cats can visit?
~~10. Hosting~~ → GitHub Pages (repo goes public at release)
~~11. Name~~ → **Gassenpfoten – The Cats of Tübingen** (DE subtitle: *Die Katzen von Tübingen*)
