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
| Districts (areas) | `src/world/districts/*.ts` | `src/world/district.ts`, `districts/index.ts` |
| Quests (missions, story arcs) | `src/data/quests.json` | `src/systems/quests.ts` |
| Game events | `src/systems/events.ts` (`GameEvent`) | emitted by `GameScene`, `GameState` |

## Add an item

1. Add an entry to `src/data/items.json`:
   ```json
   { "id": "catnip", "category": "treat", "color": "#7ab05a", "start": 0, "dailyRefill": 0, "max": 5 }
   ```
   - `category`: `treat` items appear in the feeding menu automatically.
     `toy`, `key` and `story` are reserved for upcoming mechanics (decoy toys
     against the Rote Bande, quest items).
   - `start`: amount in a new game. `dailyRefill`: Frau Häberle's morning delivery.
2. Add `"item.catnip"` to both language files.
3. Give it out: as a quest reward, as a daily refill, or (later) from a shop or NPC.

## Add a cat

1. Add an entry to `src/data/cats.json`. `district` and `spots` must exist in
   the district definition. `likes`/`dislikes` are item ids. Petting zones are
   `head`, `cheeks`, `chin`, `back`, `belly` and `tail`.
   Add `"requiresFlag": "some-flag"` to keep the cat away until a story moment.
2. Add `"cat.<id>.quirk"` to both language files.
3. For a new coat, add a palette to `COATS` in `src/art/sprites.ts`.
   Orange is reserved for the Rote Bande (concept §4.7).

## Add a district (area)

1. Copy `src/world/districts/marktplatz.ts` to e.g. `neckarfront.ts` and draw
   the map with the legend in `src/world/district.ts`. All rows must have the
   same length. The build checks that every spot, exit and entry is walkable.
2. Register it in `src/world/districts/index.ts`.
3. Add `"spot.<name>"` for each spot to both language files.
4. Connect districts through exits:
   `{ x: 6, y: 28, to: { district: 'neckarfront', entry: 'from-marktplatz' } }`.
   Use `requiresFlag` on the district to lock it until a quest unlocks it.
   *Not wired up yet:* walking through an exit to change districts is the next
   engine step. The data and the save (`state.district`) are ready for it.
5. New tile types: add a tile id and a draw function in `src/art/tiles.ts`,
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
`phase {phase, day}`, `flag {flag}`.

New mechanics such as NPC dialogue, photo mode or the Rote Bande add an event
type there and emit it with `emitGame(...)`. Quests can then use it
immediately, without changes to the quest system.
