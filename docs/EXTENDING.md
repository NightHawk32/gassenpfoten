# Extending the game: items, areas, cats and quests

Content is data. The engine reads registries and never names a specific
cat, item, district or quest. To add content you edit data files and the two
language files (`src/i18n/de.json`, `src/i18n/en.json`). Both must define the
same keys, or the build fails.

Saves are keyed by id (`cats`, `items`, `flags`, `quests`), so new content
needs no save migration. **Don't rename the id of something that has shipped**,
because existing saves refer to it.

## How the pieces connect

```
 game events ──► quests ──► rewards: items, story flags
 (cat-seen,                           │
  cat-fed, …)                         ▼
                      flags unlock districts (requiresFlag),
                      cats (requiresFlag) and later quests (requiresFlag)
```

| What | Data | Code that reads it |
|---|---|---|
| Items | `src/data/items.json` | `src/data/items.ts` |
| Cats | `src/data/cats.json` | `src/data/cats.ts`, `src/entities/Cat.ts` |
| Districts (areas) | `src/world/districts/*.json` | `src/world/district.ts`, `districts/index.ts` |
| Quests (missions, story arcs) | `src/data/quests.json` | `src/systems/quests.ts` |
| Calendar events (Christmas market) | `src/data/events.json` | `src/systems/season.ts` |
| Game events | `src/systems/events.ts` (`GameEvent`) | emitted by `GameScene`, `GameState` |

## Add an item

1. Add an entry to `src/data/items.json`:
   ```json
   { "id": "catnip", "category": "treat", "color": "#7ab05a", "start": 0, "dailyRefill": 0, "max": 5 }
   ```
   - `category`: `treat` items appear in the feeding menu automatically.
     `toy` items distract Rote Bande cats (only `yarn` is used so far).
     `key` and `story` are reserved for quest items.
   - `start`: amount in a new game. `dailyRefill`: Frau Häberle's morning delivery.
2. Add `"item.catnip"` to both language files.
3. Give it out: as a quest reward, as a daily refill, from an NPC (`gift`, or
   `give` on a story line) or sell it in a shop (see below).

### Taler (money)

Taler are not an item: they are a number in the save (`coins`, new games
start with 5) and shown in the HUD and the journal. Players earn them from
quest rewards (`{ "type": "coins", "amount": 10 }`) and from NPCs with
`giftCoins` (Boris Palmer pays 2 a day). They spend them in shops.

## Add a cat

1. Add an entry to `src/data/cats.json`. `district` and `spots` must exist in
   the district definition. `likes`/`dislikes` are item ids. Petting zones are
   `head`, `cheeks`, `chin`, `back`, `belly` and `tail`.
   Add `"requiresFlag": "some-flag"` to keep the cat away until a story moment.
   Optional weather habits:
   ```json
   "weather": { "avoids": ["rain"], "prefers": ["sunny"], "only": ["fog"],
                "spots": { "rain": ["rathaus-arcade"] } }
   ```
   `only` = appears just in that weather, `avoids` = stays away, `prefers` =
   always comes out then, `spots` = different spots in that weather (shelter).
   Weathers: `sunny`, `cloudy`, `rain`, `fog`.
2. Add `"cat.<id>.quirk"` to both language files.
3. Coats live in `COATS` in `src/art/sprites.ts`: a look (`pattern`: plain,
   tabby, tuxedo, spots, calico, socks; plus `longhair`, `mean`) and a palette
   built with `catPalette()`. Cats are drawn procedurally by
   `src/art/catArt.ts` at 32×32 in every mood, so a new coat needs no
   drawing. Orange is reserved for the Rote Bande (concept §4.7).
4. A Rote Bande member gets `"bande": true` (and `"shyness": 0`). It can't be
   fed or petted, patrols its spots, steals bowls it can smell and is
   distracted by `toy` items (the ball of yarn). `"size": 1.35` makes it bigger.
5. Inseparable pairs: `"follows": "puschi"` makes a cat arrive, move, leave
   and flee together with that cat (same district), sitting next to it.
   The leader's phases and weather decide; give the follower the same values
   so the journal shows them correctly.
6. `"companion": true` marks the one cat that follows the player once it is a
   best friend (Bello, a dog-like Maine Coon). It comes along across districts
   and ignores its schedule while following; after petting it, E toggles
   "take along" / "let stay". The choice is saved (`companion` in the save).

### The orange brain cell 🍊🧠

Every cat with the `orange` coat shares one brain cell
(`src/world/brainCell.ts`). The cat holding it behaves normally; the others
now and then freeze for a few seconds (a `…` icon, no walking, no patrolling,
no stealing). Every 7–15 s the cell hops to another orange cat (a small pink
brain flies across) or leaves the district. Very rarely all orange cats freeze
at once ("day trip to Reutlingen"). Interacting with a frozen Bande cat shows a
"loading" message. The journal shows who has the cell right now. A new
orange cat needs nothing extra to take part.

## Add a person (NPC)

Add an entry to `src/data/npcs.json`:

```json
{
  "id": "boatman", "name": "Der Stocherkahnfahrer", "look": "jonas",
  "district": "neckarfront", "spot": "boatman", "phases": ["morning", "afternoon"],
  "greetings": 2, "gift": { "item": "tuna", "amount": 1 },
  "hints": "any", "forecast": false,
  "story": [{ "unlessFlag": "met-boatman", "line": "intro" }]
}
```

- `spot` is a spot name in the district (add it there). The NPC stands on its
  first tile during `phases`.
- `look` is a sprite in `NPC_LOOKS` (`src/art/sprites.ts`): row patches and a
  palette on top of the player figure.
- Talking shows the greeting (`npc.<id>.greet.0 … greetings-1`), the daily
  `gift`, every `story` line `npc.<id>.<line>` whose flag isn't set yet, a hint
  about a cat you haven't befriended (`hints`: `any` or `night` cats) and, with
  `forecast`, the coming weather.
- Talking emits `npc-talked {npc}`, so a quest can say "talk to …" and set the
  flag that ends a story line. A story line with `"ifFlag"` is only said once
  that flag is set, e.g. a "report back" line between two quests.
- `"roam": ["fountain", "rathaus-arcade", …]` makes the NPC stroll between the
  first tiles of these spots instead of standing still (Boris Palmer).
- `"barks": 14` lets the NPC mutter `npc.<id>.bark.0 … 13` in a small bubble
  every 9–16 s while the player is nearby.
- **NPCs that hand out quests:** a story line with `"ifStep": "questId.stepId"`
  is only said while that quest is active and at that step. Boris Palmer
  uses this for his errands: one line for the briefing (`…ask`), one reminder
  while you are busy and one reaction when you report back (`…report`):
  ```json
  { "ifStep": "palmer-kuhn.ask", "line": "kuhn" },
  { "ifStep": "palmer-kuhn.kuhn", "line": "kuhnWait" },
  { "ifStep": "palmer-kuhn.report", "line": "kuhnReport" }
  ```
  The quest itself is `talk to palmer → do something → talk to palmer`.
  `ifFlag`, `unlessFlag` and `ifStep` can be combined; all must hold.
  `"give": { "item": "catnip", "amount": 1 }` hands something over with the line.
- `"giftCoins": 2` hands out Taler once a day (with `gift`, if any), with the
  line `npc.<id>.giftCoins` (`{amount}`).
- **Shops:** `"shop": [{ "item": "catnip", "price": 3 }]` opens a shop menu
  after the conversation (Günni in the Bota). Buying emits
  `item-bought {item, price, npc}`, so a quest can say "buy …".
- `"prop": "placard-leaf"` draws a texture above the NPC's head (demo placards).
- `"demo": true` marks a demonstrator: they ignore `phases` and only show up
  during a demo in their district (see below).

### The vegan demo 📢

Now and then a demo marches across the Marktplatz (`src/systems/demo.ts`).
Like the weather it runs on game time: once per game hour between 09:00 and
18:00 there is a 12 % chance one starts (not before `tutorial-done`), and it
lasts 60–105 game minutes. While it is on in a district that has NPCs with
`"demo": true`, those NPCs march between their `roam` spots chanting their
barks, every cat there runs away (the companion stays), and no cat comes back
until it is over. Emits `demo-seen {area}` once per demo while the player is
there, and `demo-ended {area}`. To let a demo march through another district,
add demonstrators with that `district`.

### Calendar events and snow 🎄

Some things follow the real date, not the in-game clock
(`src/systems/season.ts`). In December:

- **Snow.** Roofs, lawns and wall tops are white, the cobbles get a dusting,
  rain falls as snow (shown as `weather.snow`, toast `toast.weather.snow`) and
  grey skies bring a few flakes. Cats treat snow like rain. The title screen
  snows too.
- **Events** from `src/data/events.json` are on in their `months`:

  ```json
  { "id": "christmas-market", "months": [12], "district": "marktplatz",
    "flag": "christmas-market",
    "props": [{ "type": "stall", "variant": "treats", "x": 9, "y": 10 },
              { "type": "tree", "x": 20, "y": 17 }] }
  ```

  A `stall` blocks its tile and the one to the right, a `tree` one tile; the
  game refuses props on spots, entries, exits or solid ground (checked in
  every month). Stall colours are `STALL_VARIANTS` in `src/art/festive.ts`.
  While the event is on, its `flag` is set (quests can `requiresFlag` it) and
  cats and NPCs with `"event": "<id>"` show up. The first visit to the
  district shows `toast.event.<id>`.

Preview any month by adding `?month=12` (1–12) to the URL.

## Add a district (area)

1. Copy `src/world/districts/marktplatz.json` to e.g. `neckarinsel.json`, set
   `id` and draw the map rows with the legend in `src/world/district.ts`. All
   rows must have the same length. `description` and an exit's `note` are
   remarks for map editors; the game ignores them. When a district is first
   loaded, the game checks that every spot, exit and entry is walkable.
2. Import it in `src/world/districts/index.ts` and add it to `DEFS`. `tsc`
   then checks the file against `DistrictDef`, and the game checks at
   startup that every exit leads to a district and entry that exist.
3. Add `"spot.<name>"` for each spot to both language files.
4. Add `"district.<id>"` (the place name shown in the HUD and journal) to both
   language files.
5. Connect districts through exits:
   `{ "x": 6, "y": 28, "to": { "district": "neckarfront", "entry": "from-marktplatz" } }`.
   Walking onto such an exit fades to the other district and places the
   player at the named entry; add the matching entry (and an exit back) on the
   other side. Put entries a tile or two inside, not on the exit itself.
   Exits with `to` get an arrow. Exits without `to` are alleys where cats come
   and go. Use `requiresFlag` on the district to lock it until a quest sets the
   flag: the arrow stays dim, walking there shows `toast.locked`, and setting
   the flag announces the new place.
6. New tile types: add a tile id and a draw function in `src/art/tiles.ts`,
   then a character in the legend in `district.ts`.

## Add a quest (mission or story arc)

Add an entry to `src/data/quests.json`:

```json
{
  "id": "bakery-help",
  "requires": ["first-friend"],
  "requiresFlag": "met-baker",
  "steps": [
    { "id": "find-brezel", "event": "cat-seen", "match": { "cat": "brezel" } },
    { "id": "feed-three", "event": "cat-fed", "match": { "reaction": "liked" }, "count": 3 },
    { "id": "friends", "event": "cat-level", "match": { "cat": "brezel", "level": 3 } }
  ],
  "rewards": [
    { "type": "item", "item": "wet", "amount": 3 },
    { "type": "flag", "flag": "neckarfront-open" }
  ]
}
```

- A quest starts automatically once every quest in `requires` is done and
  `requiresFlag` (optional) is set.
- A step waits for a game event whose fields match `match`. String values
  must be equal. Numbers mean "at least", so `level: 3` also matches level 4.
- Rewards add items or set flags. Flags are how stories unlock areas, cats
  and further quests.
- Texts: `quest.<id>.title` and `quest.<id>.<stepId>` in both language files.

**Available events** (`GameEvent` in `src/systems/events.ts`):
`cat-seen {cat}`, `cat-fed {cat, item, reaction}`, `cat-petted {cat}`,
`cat-level {cat, level}`, `item-gained {item, amount}`, `area-entered {area}`,
`phase {phase, day}`, `flag {flag}`, `weather {weather}`, `npc-talked {npc}`,
`bande-stole {cat, victim}`, `bande-distracted {cat}`,
`braincell-hop {from, to}` (seen on screen), `braincell-observed {cat}`
(the player looked at a frozen orange cat), `companion {cat}` (Bello started following),
`item-bought {item, price, npc}`, `demo-seen {area}`, `demo-ended {area}`.

Rewards: `{ "type": "item", "item": "tuna", "amount": 2 }`,
`{ "type": "coins", "amount": 6 }` (Taler) and `{ "type": "flag", "flag": "…" }`.

A step about one specific cat (`cat-seen`, `cat-fed` or `cat-petted` with only
`cat` in `match`, or `cat-level`) counts as done right away if the cat's trust
level already shows it, so meeting a cat early never blocks a quest. Steps
that also match an item, a reaction or a count wait for the real event.

New mechanics such as photo mode add an event
type there and emit it with `emitGame(...)`. Quests can then use it
immediately, without changes to the quest system.
