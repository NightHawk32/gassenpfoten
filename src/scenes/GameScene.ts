import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { STALL_BULBS, STALL_H, TREE_LIGHTS, TREE_W } from '../art/festive';
import { CAT_FRAME } from '../art/sprites';
import { catActive, catDef, CATS, catSpots, treatReaction } from '../data/cats';
import { Cat } from '../entities/Cat';
import { Npc } from '../entities/Npc';
import { Player } from '../entities/Player';
import { NPCS } from '../data/npcs';
import { talk } from '../systems/dialogue';
import { t, type TextKey } from '../i18n/i18n';
import { daylight, type DayPhase } from '../systems/clock';
import { bus, emitGame, EV, type GameEvent, type InteractPrompt, type PetResult } from '../systems/events';
import { gameState, LEVEL } from '../systems/gameState';
import { quests } from '../systems/quests';
import { isTouchDevice } from '../systems/viewport';
import { activeEvents, eventActive, isSnowSeason, weatherName } from '../systems/season';
import type { Weather } from '../systems/weather';
import type { District, Exit } from '../world/district';
import { WeatherFx } from '../world/weatherFx';
import { BrainCell, type BrainCellEvent } from '../world/brainCell';
import { districtDef, districtsUnlockedBy, getDistrict } from '../world/districts';
import { toTile, type Point } from '../world/grid';

/** How close (px) the player must be to feed or pet a cat. */
const INTERACT_RANGE = 24;
/** How far (px) the player must step back from the bowl before the cat comes. */
const BOWL_DISTANCE = 30;
/** Cats count as "seen" within this distance (px). */
const SEE_RANGE = 6 * TILE_SIZE;
/** In fog you only spot cats that are close. */
const SEE_RANGE_FOG = 3 * TILE_SIZE;
const FAST_FORWARD = 60;
const AUTOSAVE_SECONDS = 10;
/** Chance that a cat shows up in one of its phases (after the first meeting). */
const PRESENCE_CHANCE = 0.85;
const FADE_MS = 350;

/** The controls hint is shown once per page load, not on every district change. */
let controlsShown = false;
/** Calendar events (Christmas market) are announced once per page load. */
const eventsAnnounced = new Set<string>();

interface Bowl {
  img: Phaser.GameObjects.Image;
  item: string;
  cat: Cat;
  /** A Rote Bande cat on its way to steal it. */
  thief?: Cat;
}

/** Something the player can interact with. */
type Target = { kind: 'cat'; cat: Cat } | { kind: 'npc'; npc: Npc };

/** Rote Bande (concept §4.7): how far (px) they smell a bowl, how fast they run to it. */
const BANDE_SMELL = 12 * TILE_SIZE;
const BANDE_SPEED = 52;
/** Shy cats near a Bande cat get nervous. */
const BANDE_SCARE = 2.5 * TILE_SIZE;
/** Seconds a ball of yarn keeps a Bande cat busy. */
const YARN_SECONDS = 45;
const BANDE_PATROL: [number, number] = [8, 16];
/** NPCs with `barks` mutter something now and then when the player is this close (px). */
const BARK_RANGE = 7 * TILE_SIZE;
const BARK_EVERY: [number, number] = [9, 16];
const BUFFERING_LINES = 4;

/**
 * The walkable world: one district with its cats, the player, the in-game
 * clock and day/night lighting. UI lives in HudScene, petting in PetScene.
 */
export class GameScene extends Phaser.Scene {
  private district!: District;
  private player!: Player;
  private cats: Cat[] = [];
  private npcs: Npc[] = [];
  private talking = false;
  private approachNpc: Npc | null = null;
  /** Rote Bande: patrol timers and yarn balls they are playing with. */
  private patrol = new Map<Cat, number>();
  private yarn = new Map<Cat, { img: Phaser.GameObjects.Image; time: number }>();
  private brainCell!: BrainCell;
  private barks = new Map<Npc, { timer: number; last: number }>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private darkness!: Phaser.GameObjects.Rectangle;
  private lampGlows: Phaser.GameObjects.Image[] = [];
  private windowLights: { pane: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Image; offHour: number }[] = [];
  private phase!: DayPhase;
  private weather!: Weather;
  private weatherFx!: WeatherFx;
  private fast = false;
  private sneakToggle = false;
  private saveTimer = 0;
  private bowl: Bowl | null = null;
  private menuCat: Cat | null = null;
  private approachCat: Cat | null = null;
  private promptKey = '';
  private pointerHeld = false;
  private repathTimer = 0;
  private stepBackHintShown = false;
  /** Set once the player has stepped off every exit tile, so arriving next to an exit doesn't bounce them back. */
  private exitArmed = false;
  private travelling = false;
  /** A demo is marching through this district right now (src/systems/demo.ts). */
  private demoOn = false;
  /** The NPC in the current conversation (their shop opens afterwards). */
  private talkingTo: Npc | null = null;

  constructor() {
    super('Game');
  }

  create(): void {
    const state = gameState();
    this.district = getDistrict(state.district);
    this.cats = [];
    this.npcs = [];
    this.talking = false;
    this.approachNpc = null;
    this.patrol = new Map();
    this.yarn = new Map();
    this.barks = new Map();
    this.lampGlows = [];
    this.windowLights = [];
    this.bowl = null;
    this.menuCat = null;
    this.approachCat = null;
    this.promptKey = '';
    this.pointerHeld = false;
    this.exitArmed = false;
    this.travelling = false;
    this.demoOn = false;
    this.talkingTo = null;

    this.buildWorld();

    const entries = this.district.def.entries;
    this.player = new Player(this, this.district.grid, entries[state.entry] ?? entries.start);

    this.cats = CATS.filter(
      (c) =>
        c.district === this.district.def.id &&
        (!c.requiresFlag || state.hasFlag(c.requiresFlag)) &&
        (!c.event || eventActive(c.event)),
    ).map((def) => new Cat(this, def, this.district.grid, this.district.def.exits));

    // Cats that belong to the current phase and weather are already there when you arrive.
    this.phase = state.clock.phase;
    state.weather.update(state.clock.toJSON());
    this.weather = state.weather.current;
    // The best friend (and its inseparable partner) comes along from wherever it lives.
    const companions = this.companionIds().map((id) => {
      let cat = this.cats.find((c) => c.def.id === id);
      if (!cat) {
        cat = new Cat(this, catDef(id), this.district.grid, this.district.def.exits);
        this.cats.push(cat);
      }
      return cat;
    });
    const near = toTile(this.player);
    companions.forEach((cat, i) => {
      cat.appearAt(this.besideTile(i ? this.besideTile(near) : near));
      cat.companionOf = this.player;
    });

    // During a demo the square is empty (checkDemo() brings the demonstrators on the first frame).
    const demoHere = this.demoDistrict() && state.demo.active(state.clock.toJSON());
    for (const cat of this.cats) {
      if (cat.companionOf || this.leaderOf(cat) || demoHere || !catActive(cat.def, this.phase, this.weather)) continue;
      const spot = this.randomSpot(cat);
      cat.appearAt(spot);
      this.followerOf(cat)?.appearAt(this.besideTile(spot));
    }
    this.brainCell = new BrainCell(this, this.cats, (e) => this.onBrainCell(e));
    this.npcs = NPCS.filter((n) => n.district === this.district.def.id && (!n.event || eventActive(n.event))).map((def) => {
      const spotOf = (name: string) => {
        const spot = this.district.def.spots[name]?.[0];
        if (!spot) throw new Error(`NPC "${def.id}": no spot "${name}" in district "${this.district.def.id}"`);
        return spot;
      };
      const npc = new Npc(this, def, spotOf(def.spot), this.district.grid, (def.roam ?? []).map(spotOf));
      npc.setPresent(def.phases.includes(this.phase), true);
      return npc;
    });
    this.weatherFx = new WeatherFx(this, this.district.width * TILE_SIZE, this.district.height * TILE_SIZE, this.weather);

    this.setupCamera();
    this.setupInput();
    this.setupBus();

    // Calendar events set their flag, so quests that need them can start.
    for (const ev of activeEvents()) if (ev.flag) state.setFlag(ev.flag);
    quests.start();
    emitGame({ type: 'area-entered', area: this.district.def.id });

    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    bus.emit(EV.PROMPT, null);
    if (!controlsShown) {
      controlsShown = true;
      this.time.delayedCall(600, () => bus.emit(EV.TOAST, t(isTouchDevice() ? 'toast.controls.touch' : 'toast.controls')));
    } else {
      bus.emit(EV.TOAST, t(`district.${this.district.def.id}` as TextKey));
    }
    for (const ev of activeEvents(this.district.def.id)) {
      if (eventsAnnounced.has(ev.id)) continue;
      eventsAnnounced.add(ev.id);
      this.time.delayedCall(1800, () => bus.emit(EV.TOAST, t(`toast.event.${ev.id}` as TextKey)));
    }
    this.cameras.main.fadeIn(FADE_MS, 20, 16, 24);

    const save = () => gameState().save();
    const onHidden = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', save);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', save);
    });
  }

  // ------------------------------------------------------------------ setup

  private buildWorld(): void {
    const d = this.district;
    const map = this.make.tilemap({ data: d.tiles, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    map.createLayer(0, tileset, 0, 0)!.setDepth(-1);

    for (const p of d.lamps) {
      const x = p.x * TILE_SIZE + TILE_SIZE / 2;
      const bottom = (p.y + 1) * TILE_SIZE;
      this.add.image(x, bottom, 'lamp').setOrigin(0.5, 1).setDepth(bottom);
      this.lampGlows.push(
        this.add
          .image(x, bottom - 28, 'glow')
          .setTint(0xffd58a)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(1.25)
          .setDepth(10001)
          .setAlpha(0),
      );
    }
    for (const p of d.trees) {
      const bottom = (p.y + 1) * TILE_SIZE;
      this.add.image(p.x * TILE_SIZE + TILE_SIZE / 2, bottom, 'tree').setOrigin(0.5, 1).setDepth(bottom);
    }
    for (const p of d.benches) {
      this.add.image(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2, 'bench').setDepth((p.y + 1) * TILE_SIZE);
    }
    for (const p of d.windows) {
      const x = p.x * TILE_SIZE;
      const y = p.y * TILE_SIZE;
      // Pseudo-random but stable: some windows stay dark, others go dark late.
      const hash = (p.x * 73 + p.y * 151) % 10;
      this.windowLights.push({
        pane: this.add.rectangle(x + 5, y + 4, 6, 7, 0xffcf6a).setOrigin(0).setDepth(10001).setAlpha(0),
        glow: this.add
          .image(x + 8, y + 8, 'glow')
          .setTint(0xffb84a)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.6)
          .setDepth(10001)
          .setAlpha(0),
        offHour: hash < 3 ? -1 : 21 + (hash % 5), // -1: never lit
      });
    }

    if (isSnowSeason()) this.drawSnowCover();
    this.placeEventProps();

    for (const exit of d.def.exits) {
      if (!exit.to) continue;
      const c = { x: exit.x * TILE_SIZE + TILE_SIZE / 2, y: exit.y * TILE_SIZE + TILE_SIZE / 2 };
      // Point outwards, towards the nearest map edge.
      const angle =
        exit.y <= 1 ? 0 : exit.y >= d.height - 2 ? Math.PI : exit.x <= 1 ? -Math.PI / 2 : Math.PI / 2;
      const open = this.isOpen(exit);
      const arrow = this.add
        .image(c.x, c.y, 'exit-arrow')
        .setRotation(angle)
        .setDepth(c.y - 8)
        .setAlpha(open ? 0.9 : 0.35);
      const dx = Math.sin(angle) * 2;
      const dy = -Math.cos(angle) * 2;
      this.tweens.add({ targets: arrow, x: c.x + dx, y: c.y + dy, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      arrow.setData('exit', exit);
    }

    this.darkness = this.add
      .rectangle(-TILE_SIZE * 20, -TILE_SIZE * 20, (d.width + 40) * TILE_SIZE, (d.height + 40) * TILE_SIZE, 0x0a0e28)
      .setOrigin(0)
      .setDepth(10000)
      .setAlpha(0);
  }

  /** Market stalls and the tree of calendar events, with fairy lights that glow at night. */
  private placeEventProps(): void {
    const light = (x: number, y: number, color: number) => {
      const glow = this.add
        .image(x, y, 'glow')
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.16)
        .setDepth(10001)
        .setAlpha(0);
      this.lampGlows.push(glow);
      // Twinkle: the size pulses, so the lighting pass keeps control of the alpha.
      this.tweens.add({
        targets: glow,
        scale: 0.24,
        duration: Phaser.Math.Between(500, 1100),
        delay: Phaser.Math.Between(0, 900),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    };
    for (const ev of activeEvents(this.district.def.id)) {
      for (const prop of ev.props) {
        const bottom = (prop.y + 1) * TILE_SIZE;
        if (prop.type === 'stall') {
          const left = prop.x * TILE_SIZE;
          this.add.image(left, bottom, `stall-${prop.variant ?? 'treats'}`).setOrigin(0, 1).setDepth(bottom);
          for (const b of STALL_BULBS) light(left + b.x + 0.5, bottom - STALL_H + b.y + 0.5, b.color);
        } else {
          const cx = prop.x * TILE_SIZE + TILE_SIZE / 2;
          const img = this.add.image(cx, bottom, 'xmas-tree').setOrigin(0.5, 1).setDepth(bottom);
          for (const l of TREE_LIGHTS) light(cx - TREE_W / 2 + l.x + 0.5, bottom - img.height + l.y + 0.5, l.color);
        }
      }
    }
  }

  /**
   * Snow on roofs, lawns, hedges and walls, and trampled patches on the
   * cobbles (December, see src/systems/season.ts). Drawn once on top of the
   * tiles and below everything that stands on them.
   */
  private drawSnowCover(): void {
    const { map } = this.district.def;
    const g = this.add.graphics().setDepth(-0.5);
    const T = TILE_SIZE;
    const rnd = (x: number, y: number, i: number) => {
      const n = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const WHITE = 0xf2f6fc;
    const SHADE = 0xc8d6ea;
    const ROOFS = 'RcPq';
    const LAWN = 'gTeX';
    const GROUND = '.s,mjbLBA';
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const ch = map[y][x];
        const px = x * T;
        const py = y * T;
        if (ROOFS.includes(ch)) {
          const edge = map[y + 1]?.[x] !== ch;
          g.fillStyle(WHITE, 1).fillRect(px, py, T, edge ? 10 : T);
          g.fillStyle(SHADE, 1).fillRect(px + Math.floor(rnd(x, y, 1) * 12), py + Math.floor(rnd(x, y, 2) * 8) + 1, 3, 1);
          if (edge) {
            g.fillStyle(SHADE, 1).fillRect(px, py + 10, T, 1);
            for (const ix of [2, 7, 12]) if (rnd(x, y, ix) < 0.6) g.fillStyle(0xdfeaf6, 1).fillRect(px + ix, py + 11, 1, 1 + Math.floor(rnd(x, y, ix + 1) * 3));
          }
        } else if (LAWN.includes(ch)) {
          g.fillStyle(WHITE, 1).fillRect(px, py, T, ch === 'X' ? 9 : T);
          for (let i = 0; i < 3; i++) {
            g.fillStyle(SHADE, 1).fillRect(px + Math.floor(rnd(x, y, i) * 13), py + Math.floor(rnd(x, y, i + 5) * 13), 3, 1);
          }
        } else if (GROUND.includes(ch) && ch !== 'A') {
          // Trampled: a thin dusting with a drift here and there.
          g.fillStyle(WHITE, 0.16).fillRect(px, py, T, T);
          const count = rnd(x, y, 9) < 0.45 ? 1 + Math.floor(rnd(x, y, 8) * 2) : 0;
          for (let i = 0; i < count; i++) {
            const w = 4 + Math.floor(rnd(x, y, i * 2) * 6);
            const h = 2 + Math.floor(rnd(x, y, i * 2 + 1) * 2);
            g.fillStyle(WHITE, 0.6).fillRect(px + Math.floor(rnd(x, y, i + 20) * (T - w)), py + Math.floor(rnd(x, y, i + 30) * (T - h)), w, h);
          }
        } else if ('oMNY'.includes(ch) && map[y - 1]?.[x] !== ch) {
          // Rims and wall tops.
          g.fillStyle(WHITE, 1).fillRect(px, py, T, 4);
          g.fillStyle(SHADE, 1).fillRect(px, py + 4, T, 1);
        }
      }
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#141018');
    cam.startFollow(this.player.sprite, true, 0.2, 0.2);
    this.layoutCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutCamera, this));
  }

  /** Whole-number zoom showing roughly 20×11 tiles; centres the map if it is smaller than the view. */
  private layoutCamera(): void {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    cam.setSize(w, h);
    const zoom = Math.max(1, Math.round(Math.min(w, h) / 180));
    cam.setZoom(zoom);
    const mapW = this.district.width * TILE_SIZE;
    const mapH = this.district.height * TILE_SIZE;
    const viewW = w / zoom;
    const viewH = h / zoom;
    const bx = viewW > mapW ? (mapW - viewW) / 2 : 0;
    const by = viewH > mapH ? (mapH - viewH) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mapW, viewW), Math.max(mapH, viewH));
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ENTER,SPACE,SHIFT,T') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-E', () => this.interact());
    kb.on('keydown-ENTER', () => this.interact());
    kb.on('keydown-SPACE', () => this.interact());

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.talking) {
        bus.emit(EV.DIALOGUE_NEXT);
        return;
      }
      const cat = over.map((o) => o.getData('cat') as Cat | undefined).find((c) => c && c.present);
      if (cat) {
        this.tapCat(cat);
        return;
      }
      const npc = over.map((o) => o.getData('npc') as Npc | undefined).find((n) => n && n.here);
      if (npc) {
        this.tapNpc(npc);
        return;
      }
      this.pointerHeld = true;
      this.approachCat = null;
      this.approachNpc = null;
      this.walkToPointer(pointer);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerHeld || !pointer.isDown || this.repathTimer > 0) return;
      this.repathTimer = 0.2;
      this.walkToPointer(pointer);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.pointerHeld = false));
  }

  private setupBus(): void {
    const handlers: [string, (...args: never[]) => void][] = [
      [EV.INTERACT, () => this.interact()],
      [EV.TREAT_CHOSEN, (item: string | null) => this.placeBowl(item)],
      [EV.SNEAK, (on: boolean) => (this.sneakToggle = on)],
      [EV.FAST, (on: boolean) => (this.fast = on)],
      [EV.PET_DONE, (result: PetResult, catId: string) => this.onPetDone(result, catId)],
      [EV.GAME, (e: GameEvent) => this.onGameEvent(e)],
      [
        EV.DIALOGUE_DONE,
        () => {
          this.talking = false;
          for (const npc of this.npcs) npc.hold = false;
          const seller = this.talkingTo;
          this.talkingTo = null;
          if (seller?.def.shop && seller.here) bus.emit(EV.SHOP, seller.def.id);
        },
      ],
    ];
    for (const [ev, fn] of handlers) bus.on(ev, fn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [ev, fn] of handlers) bus.off(ev, fn);
    });
  }

  // ------------------------------------------------------------------ loop

  update(_time: number, deltaMs: number): void {
    if (this.travelling) return;
    const dt = Math.min(deltaMs, 100) / 1000;
    const state = gameState();

    const fast = this.fast || this.keys.T.isDown;
    state.clock.update(deltaMs * (fast ? FAST_FORWARD : 1));
    this.checkPhase();
    this.checkWeather();
    this.checkDemo();
    this.weatherFx.update(dt, this.weather);
    if (state.dailyRefill()) bus.emit(EV.TOAST, t('toast.refill'));

    this.repathTimer = Math.max(0, this.repathTimer - dt);
    this.player.sneaking = this.sneakToggle || this.keys.SHIFT.isDown;
    this.player.update(dt, this.talking ? { x: 0, y: 0 } : this.keyboardDir());

    if (this.approachCat) {
      const c = this.approachCat;
      if (!c.approachable) this.approachCat = null;
      else if (this.distTo(c) <= INTERACT_RANGE) {
        this.player.stop();
        this.approachCat = null;
        this.interactWith({ kind: 'cat', cat: c });
      }
    }
    if (this.approachNpc) {
      const n = this.approachNpc;
      if (!n.here) this.approachNpc = null;
      else if (this.distTo(n) <= INTERACT_RANGE) {
        this.player.stop();
        this.approachNpc = null;
        this.talkTo(n);
      }
    }
    this.updateBande(dt);
    this.brainCell.update(dt);

    for (const cat of this.cats) {
      const event = cat.update(dt, this.player, state.cat(cat.def.id).level);
      if (event === 'fled') this.onFled(cat);
      if (event === 'ate') this.onAte(cat);
      if (event === 'gone') this.onGone(cat);
      this.checkSeen(cat);
    }
    this.keepPairsTogether();
    this.updateNpcs(dt);

    const b = this.bowl;
    if (b && b.cat.state === 'waiting') {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.img.x, b.img.y);
      if (d >= BOWL_DISTANCE) b.cat.goToBowl({ x: b.img.x, y: b.img.y });
    }

    this.checkExit();
    this.updatePrompt();
    this.updateLighting();

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_SECONDS) {
      this.saveTimer = 0;
      state.save();
    }
  }

  private keyboardDir(): Point {
    const k = this.keys;
    return {
      x: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
      y: (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0),
    };
  }

  private checkPhase(): void {
    const clock = gameState().clock;
    const phase = clock.phase;
    if (phase === this.phase) return;
    this.phase = phase;
    emitGame({ type: 'phase', phase, day: clock.day });

    this.updatePresence(null);
    for (const npc of this.npcs) if (!npc.def.demo) npc.setPresent(npc.def.phases.includes(phase));
  }

  private checkWeather(): void {
    const state = gameState();
    if (!state.weather.update(state.clock.toJSON())) return;
    const before = this.weather;
    this.weather = state.weather.current;
    emitGame({ type: 'weather', weather: this.weather });
    bus.emit(EV.TOAST, t(`toast.weather.${weatherName(this.weather)}` as TextKey));
    this.updatePresence(before);
  }

  /**
   * After a change of phase or weather: cats leave, arrive, or move to their
   * weather spot (e.g. under the arcades when it rains).
   */
  private updatePresence(weatherBefore: Weather | null): void {
    for (const cat of this.cats) {
      // Followers (Fetzi) do whatever their leader (Puschi) does; companions stay with the player;
      // ex-companions from other districts have nowhere to go here.
      if (this.leaderOf(cat) || cat.companionOf || cat.def.district !== this.district.def.id) continue;
      const follower = this.followerOf(cat);
      const active = !this.demoOn && catActive(cat.def, this.phase, this.weather);
      if (cat.state === 'idle' && !active) {
        cat.leave(false);
      } else if (!cat.present && active) {
        const firstMeeting = gameState().cat(cat.def.id).level === LEVEL.UNKNOWN;
        const prefers = cat.def.weather?.prefers?.includes(this.weather);
        if (firstMeeting || prefers || Math.random() < PRESENCE_CHANCE) {
          const spot = this.randomSpot(cat);
          cat.arrive(spot);
          if (follower && !follower.present) follower.arrive(this.besideTile(spot));
        }
      } else if (cat.state === 'idle' && weatherBefore) {
        const old = catSpots(cat.def, weatherBefore).join();
        if (old !== catSpots(cat.def, this.weather).join()) {
          const spot = this.randomSpot(cat);
          cat.moveTo(spot);
          if (follower?.state === 'idle') follower.moveTo(this.besideTile(spot));
        }
      }
    }
  }

  // ------------------------------------------------------------------ demo

  /** Does a demo march through this district (are there demonstrators here)? */
  private demoDistrict(): boolean {
    return NPCS.some((n) => n.demo && n.district === this.district.def.id);
  }

  /** Starts or ends the demo here: demonstrators march in and every cat runs for it. */
  private checkDemo(): void {
    const state = gameState();
    const now = state.clock.toJSON();
    state.demo.update(now, state.hasFlag('tutorial-done'));
    const on = this.demoDistrict() && state.demo.active(now);
    if (on === this.demoOn) return;
    this.demoOn = on;
    const area = this.district.def.id;
    for (const npc of this.npcs) if (npc.def.demo) npc.setPresent(on);
    if (on) {
      bus.emit(EV.TOAST, t('toast.demo.start'));
      for (const cat of this.cats) {
        if (cat.companionOf || cat.state === 'absent' || cat.state === 'leaving' || cat.state === 'fleeing') continue;
        if (cat.state === 'petting') continue;
        if (this.bowl?.cat === cat) this.removeBowl();
        // Not all at once: one after the other as the chanting reaches them.
        this.time.delayedCall(Phaser.Math.Between(0, 1500), () => {
          if (this.demoOn && cat.present && cat.state !== 'leaving' && cat.state !== 'fleeing' && cat.state !== 'petting') {
            cat.leave(true);
          }
        });
      }
      emitGame({ type: 'demo-seen', area });
    } else {
      bus.emit(EV.TOAST, t('toast.demo.end'));
      this.updatePresence(null);
      emitGame({ type: 'demo-ended', area });
    }
  }

  // ------------------------------------------------------------------ inseparable pairs (Puschi & Fetzi)

  /** The cat this one follows, if it is in this district. */
  private leaderOf(cat: Cat): Cat | undefined {
    return cat.def.follows ? this.cats.find((c) => c.def.id === cat.def.follows) : undefined;
  }

  private followerOf(cat: Cat): Cat | undefined {
    return this.cats.find((c) => c.def.follows === cat.def.id);
  }

  /** If one of a pair leaves (fed up, scared, bedtime …), the other goes along. */
  private keepPairsTogether(): void {
    const gone = (c: Cat) => c.state === 'absent' || c.state === 'leaving' || c.state === 'fleeing';
    for (const follower of this.cats) {
      const leader = this.leaderOf(follower);
      if (!leader) continue;
      if (gone(leader) && !gone(follower)) follower.leave(leader.state === 'fleeing');
      else if (gone(follower) && !gone(leader)) leader.leave(follower.state === 'fleeing');
    }
  }

  /** A walkable tile next to `tile`, so a pair sits side by side. */
  private besideTile(tile: Point): Point {
    const grid = this.district.grid;
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [dx, dy] of options) {
      if (!grid.isSolid(tile.x + dx, tile.y + dy)) return { x: tile.x + dx, y: tile.y + dy };
    }
    return tile;
  }

  // ------------------------------------------------------------------ companion (best friend following you)

  /** The companion (only cats with `companion: true`) plus an inseparable partner, if it has one. */
  private companionIds(): string[] {
    const id = gameState().companion;
    if (!id || !catDef(id).companion) return [];
    const partner = catDef(id).follows ?? CATS.find((c) => c.follows === id)?.id;
    return partner ? [id, partner] : [id];
  }

  private setCompanion(cat: Cat | null): void {
    const state = gameState();
    // The previous companion stays here (or wanders home if it lives elsewhere).
    for (const old of this.cats.filter((c) => c.companionOf)) {
      old.companionOf = null;
      if (old.def.district !== this.district.def.id && old.state === 'idle') old.leave(false);
    }
    state.setCompanion(cat?.def.id ?? null);
    if (!cat) return;
    for (const id of this.companionIds()) {
      const c = this.cats.find((x) => x.def.id === id);
      if (c) c.companionOf = this.player;
    }
    cat.showIcon('icon-heart', 2);
    cat.emote(CAT_FRAME.happy, 1.5);
    emitGame({ type: 'companion', cat: cat.def.id });
  }

  // ------------------------------------------------------------------ people

  private updateNpcs(dt: number): void {
    for (const npc of this.npcs) {
      npc.update(dt);
      const count = npc.def.barks ?? 0;
      if (!count || !npc.here || npc.hold || npc.muttering || this.talking) continue;
      const bark = this.barks.get(npc) ?? { timer: 3, last: -1 };
      this.barks.set(npc, bark);
      bark.timer -= dt;
      if (bark.timer > 0) continue;
      bark.timer = Phaser.Math.FloatBetween(...BARK_EVERY);
      if (this.distTo(npc) > BARK_RANGE || !this.cameras.main.worldView.contains(npc.x, npc.y)) continue;
      let index = Phaser.Math.Between(0, count - 1);
      if (index === bark.last && count > 1) index = (index + 1) % count;
      bark.last = index;
      npc.mutter(t(`npc.${npc.def.id}.bark.${index}` as TextKey));
    }
  }

  // ------------------------------------------------------------------ the orange brain cell

  private onBrainCell(e: BrainCellEvent): void {
    const state = gameState();
    if (e.type === 'hop') {
      emitGame({ type: 'braincell-hop', from: e.from.def.id, to: e.to.def.id });
      if (!state.hasFlag('braincell-seen')) {
        state.setFlag('braincell-seen');
        bus.emit(EV.TOAST, t('toast.braincell.first', { from: e.from.def.name, to: e.to.def.name }));
      }
    } else if (e.type === 'froze') {
      if (this.bowl?.thief === e.cat) bus.emit(EV.TOAST, t('toast.braincell.thief', { name: e.cat.def.name }));
    } else {
      bus.emit(EV.TOAST, t('toast.braincell.outage'));
    }
  }

  private observeFrozen(cat: Cat): void {
    const holder = this.brainCell.current;
    const line = Phaser.Math.Between(0, BUFFERING_LINES - 1);
    bus.emit(
      EV.TOAST,
      t(`toast.buffering.${line}` as TextKey, { name: cat.def.name, holder: holder?.def.name ?? t('braincell.nowhere') }),
    );
    emitGame({ type: 'braincell-observed', cat: cat.def.id });
  }

  private checkSeen(cat: Cat): void {
    if (!cat.present || cat.state === 'fleeing') return;
    const state = gameState();
    if (state.cat(cat.def.id).level !== LEVEL.UNKNOWN) return;
    const range = this.weather === 'fog' ? SEE_RANGE_FOG : SEE_RANGE;
    if (this.distTo(cat) > range || !this.cameras.main.worldView.contains(cat.x, cat.y)) return;
    state.raiseLevel(cat.def.id, LEVEL.SEEN);
    cat.showIcon('icon-question', 2);
    cat.emote(CAT_FRAME.curious, 2);
    bus.emit(EV.TOAST, t(cat.def.bande ? 'toast.newBande' : 'toast.newCat', { name: cat.def.name }));
    emitGame({ type: 'cat-seen', cat: cat.def.id });
  }

  // ------------------------------------------------------------------ interaction

  /** The nearest cat or person within reach. */
  private nearestTarget(): Target | null {
    let best: Target | null = null;
    let bestD = INTERACT_RANGE;
    for (const cat of this.cats) {
      const d = this.distTo(cat);
      if (cat.approachable && d <= bestD) {
        best = { kind: 'cat', cat };
        bestD = d;
      }
    }
    for (const npc of this.npcs) {
      const d = this.distTo(npc);
      if (npc.here && d <= bestD) {
        best = { kind: 'npc', npc };
        bestD = d;
      }
    }
    return best;
  }

  private actionFor(target: Target): InteractPrompt['action'] {
    if (target.kind === 'npc') return 'talk';
    const cat = target.cat;
    if (cat.def.bande && cat.frozen) return 'buffering';
    if (cat.def.bande) return !this.yarn.has(cat) && gameState().itemCount('yarn') > 0 ? 'distract' : 'bande';
    if (cat.pettedThisVisit) {
      if (!cat.def.companion || gameState().cat(cat.def.id).level < LEVEL.BEST_FRIEND) return 'content';
      return cat.companionOf ? 'stay' : 'follow';
    }
    if (cat.fedThisVisit || gameState().cat(cat.def.id).level >= LEVEL.FRIEND) return 'pet';
    return 'feed';
  }

  private updatePrompt(): void {
    const target = this.talking ? null : this.nearestTarget();
    let prompt: InteractPrompt | null = null;
    if (target?.kind === 'cat') prompt = { targetId: target.cat.def.id, name: target.cat.def.name, action: this.actionFor(target) };
    if (target?.kind === 'npc') prompt = { targetId: target.npc.def.id, name: target.npc.def.name, action: 'talk' };
    const key = prompt ? `${prompt.targetId}:${prompt.action}` : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (!target) this.menuCat = null;
    bus.emit(EV.PROMPT, prompt);
  }

  private interact(): void {
    if (this.talking) {
      bus.emit(EV.DIALOGUE_NEXT);
      return;
    }
    const target = this.nearestTarget();
    if (target) this.interactWith(target);
  }

  private interactWith(target: Target): void {
    if (target.kind === 'npc') {
      this.talkTo(target.npc);
      return;
    }
    const cat = target.cat;
    switch (this.actionFor(target)) {
      case 'content':
        bus.emit(EV.TOAST, t('toast.content', { name: cat.def.name }));
        break;
      case 'pet':
        this.startPetting(cat);
        break;
      case 'feed':
        this.menuCat = cat;
        bus.emit(EV.TREAT_MENU, cat.def.id);
        break;
      case 'distract':
        this.distract(cat);
        break;
      case 'bande':
        bus.emit(EV.TOAST, t('toast.bande', { name: cat.def.name }));
        break;
      case 'buffering':
        this.observeFrozen(cat);
        break;
      case 'follow':
        this.setCompanion(cat);
        bus.emit(EV.TOAST, t('toast.follow', { name: cat.def.name }));
        break;
      case 'stay':
        this.setCompanion(null);
        bus.emit(EV.TOAST, t('toast.stay', { name: cat.def.name }));
        break;
    }
  }

  private tapCat(cat: Cat): void {
    if (!cat.approachable) return;
    if (this.distTo(cat) <= INTERACT_RANGE + 4) {
      this.player.stop();
      this.interactWith({ kind: 'cat', cat });
    } else if (this.player.walkTo(cat.sprite)) {
      this.approachCat = cat;
      this.approachNpc = null;
    }
  }

  private tapNpc(npc: Npc): void {
    if (this.distTo(npc) <= INTERACT_RANGE + 4) {
      this.player.stop();
      this.talkTo(npc);
    } else if (this.player.walkTo(npc.sprite)) {
      this.approachNpc = npc;
      this.approachCat = null;
    }
  }

  private talkTo(npc: Npc): void {
    this.talking = true;
    this.talkingTo = npc;
    this.player.stop();
    npc.hold = true;
    npc.face(this.player);
    bus.emit(EV.PROMPT, null);
    this.promptKey = '';
    bus.emit(EV.DIALOGUE, talk(npc.def));
    emitGame({ type: 'npc-talked', npc: npc.def.id });
  }

  // ------------------------------------------------------------------ Rote Bande

  private updateBande(dt: number): void {
    for (const cat of this.cats) {
      if (!cat.def.bande || !cat.present) continue;

      const yarn = this.yarn.get(cat);
      if (yarn) {
        // Batting the yarn around.
        yarn.time -= dt;
        if (cat.state === 'idle' && Math.random() < dt * 1.5) cat.emote(Math.random() < 0.5 ? CAT_FRAME.happy : CAT_FRAME.tail, 0.5);
        if (yarn.time <= 0) {
          yarn.img.destroy();
          this.yarn.delete(cat);
        }
        continue;
      }

      // Shy cats don't like the Bande around.
      for (const other of this.cats) {
        if (other.def.bande || other.companionOf || other.state !== 'idle' || other.def.shyness < 3) continue;
        if (Phaser.Math.Distance.Between(cat.x, cat.y, other.x, other.y) < BANDE_SCARE) other.alert += dt * 0.25;
      }

      // Patrol between their spots (unless the brain cell is elsewhere).
      if (cat.state !== 'idle' || cat.frozen) continue;
      const timer = (this.patrol.get(cat) ?? Phaser.Math.FloatBetween(...BANDE_PATROL)) - dt;
      this.patrol.set(cat, timer);
      if (timer <= 0) {
        this.patrol.delete(cat);
        cat.moveTo(this.randomSpot(cat));
      }
    }
  }

  /** A Bande cat close enough smells the bowl and runs for it. */
  private sendThief(bowl: Bowl): void {
    let thief: Cat | null = null;
    let best = BANDE_SMELL;
    for (const cat of this.cats) {
      if (!cat.def.bande || cat.frozen || this.yarn.has(cat) || (cat.state !== 'idle' && cat.state !== 'arriving')) continue;
      const d = Phaser.Math.Distance.Between(cat.x, cat.y, bowl.img.x, bowl.img.y);
      if (d < best) {
        thief = cat;
        best = d;
      }
    }
    if (!thief) return;
    bowl.thief = thief;
    thief.showIcon('icon-alert', 1.5);
    thief.goToBowl({ x: bowl.img.x, y: bowl.img.y }, BANDE_SPEED);
    bus.emit(EV.TOAST, t('toast.bandeComing', { name: thief.def.name }));
  }

  private steal(thief: Cat): void {
    const bowl = this.bowl!;
    const victim = bowl.cat;
    this.removeBowl();
    thief.emote(CAT_FRAME.happy, 1.5);
    bus.emit(EV.TOAST, t('toast.bandeStole', { thief: thief.def.name, name: victim.def.name }));
    if (victim.present && victim.state !== 'leaving' && victim.state !== 'fleeing') {
      victim.emote(CAT_FRAME.alert, 0.8);
      this.time.delayedCall(700, () => victim.present && victim.state !== 'leaving' && victim.leave(true));
    }
    emitGame({ type: 'bande-stole', cat: thief.def.id, victim: victim.def.id });
  }

  private distract(cat: Cat): void {
    if (!gameState().useItem('yarn')) return;
    // Roll the yarn a little past the cat; it pounces and stays busy.
    const x = cat.x + (this.player.x < cat.x ? 10 : -10);
    const y = cat.y + 2;
    const img = this.add.image(x, y, 'yarn').setDepth(y);
    this.tweens.add({ targets: img, angle: 360, duration: 900, repeat: -1 });
    this.yarn.set(cat, { img, time: YARN_SECONDS });
    if (this.bowl?.thief === cat) this.bowl.thief = undefined;
    cat.emote(CAT_FRAME.curious, 0.8);
    bus.emit(EV.TOAST, t('toast.distracted', { name: cat.def.name }));
    emitGame({ type: 'bande-distracted', cat: cat.def.id });
  }

  private walkToPointer(pointer: Phaser.Input.Pointer): void {
    const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    this.player.walkTo({ x: p.x, y: p.y });
  }

  private placeBowl(item: string | null): void {
    const cat = this.menuCat;
    this.menuCat = null;
    if (!item || !cat || !cat.approachable || this.bowl) return;
    const state = gameState();
    if (!state.useItem(item)) {
      bus.emit(EV.TOAST, t('toast.noTreat', { item: t(`item.${item}` as TextKey) }));
      return;
    }
    // Put the bowl down between the player and the cat, a bit closer to the cat.
    const x = Phaser.Math.Linear(this.player.x, cat.x, 0.6);
    const y = Phaser.Math.Linear(this.player.y, cat.y, 0.6) + 2;
    const img = this.add.image(Math.round(x), Math.round(y), `bowl-${item}`).setOrigin(0.5, 0.75).setDepth(y - 1);
    this.bowl = { img, item, cat };
    cat.waitForBowl();
    this.sendThief(this.bowl);
    if (!this.stepBackHintShown) {
      this.stepBackHintShown = true;
      bus.emit(EV.TOAST, t('toast.stepBack', { name: cat.def.name }));
    }
  }

  private removeBowl(): void {
    this.bowl?.img.destroy();
    this.bowl = null;
  }

  private onAte(cat: Cat): void {
    const bowl = this.bowl;
    if (cat.def.bande) {
      if (bowl && bowl.thief === cat) this.steal(cat);
      return;
    }
    if (!bowl || bowl.cat !== cat) return;
    this.removeBowl();
    const state = gameState();
    const id = cat.def.id;
    const reaction = treatReaction(cat.def, bowl.item);
    const params = { name: cat.def.name, item: t(`item.${bowl.item}` as TextKey) };

    if (reaction === 'disliked') {
      bus.emit(EV.TOAST, t('toast.disliked', params));
      cat.emote(CAT_FRAME.annoyed, 1.2);
      this.time.delayedCall(1200, () => cat.state === 'idle' && !cat.companionOf && cat.leave(false));
    } else {
      cat.fedThisVisit = true;
      if (reaction === 'liked') {
        cat.showIcon('icon-heart', 2);
        cat.emote(CAT_FRAME.happy, 2);
      }
      bus.emit(EV.TOAST, t(reaction === 'liked' ? 'toast.liked' : 'toast.neutral', params));
      if (state.raiseLevel(id, LEVEL.FED)) this.toastLevel(cat);
      if (state.addBond(id, reaction === 'liked' ? 2 : 1)) this.toastLevel(cat);
    }
    emitGame({ type: 'cat-fed', cat: id, item: bowl.item, reaction });
  }

  private onFled(cat: Cat): void {
    if (this.bowl?.cat === cat) this.removeBowl();
    bus.emit(EV.TOAST, t('toast.fled', { name: cat.def.name }));
  }

  private onGone(cat: Cat): void {
    if (this.bowl?.cat === cat) this.removeBowl();
  }

  private startPetting(cat: Cat): void {
    cat.state = 'petting';
    bus.emit(EV.PROMPT, null);
    this.promptKey = '';
    this.player.stop();
    this.scene.pause();
    this.scene.launch('Pet', { catId: cat.def.id });
  }

  private onPetDone(result: PetResult, catId: string): void {
    const cat = this.cats.find((c) => c.def.id === catId);
    if (!cat) return;
    const state = gameState();
    if (result === 'happy') {
      cat.state = 'idle';
      cat.pettedThisVisit = true;
      cat.showIcon('icon-heart', 2.5);
      // Content: lies down for a nap (sleeps properly at night).
      cat.emote(CAT_FRAME.happy, 2);
      cat.rest(this.phase === 'night');
      if (state.raiseLevel(catId, LEVEL.FRIEND)) this.toastLevel(cat);
      if (state.addBond(catId, 2)) this.toastLevel(cat);
      emitGame({ type: 'cat-petted', cat: catId });
    } else if (result === 'left' && !cat.companionOf) {
      cat.leave(false);
    } else {
      cat.state = 'idle';
    }
    state.save();
  }

  private toastLevel(cat: Cat): void {
    const state = gameState();
    const level = state.cat(cat.def.id).level;
    bus.emit(EV.TOAST, t('toast.level', { name: cat.def.name, level: t(`level.${level}` as TextKey) }));
    // Bello, once a best friend, comes along.
    if (level >= LEVEL.BEST_FRIEND && cat.def.companion && !state.companion) {
      this.setCompanion(cat);
      bus.emit(EV.TOAST, t('toast.bestFriend', { name: cat.def.name }));
    }
  }

  // ------------------------------------------------------------------ travel

  private isOpen(exit: Exit): boolean {
    const flag = exit.to && districtDef(exit.to.district).requiresFlag;
    return !flag || gameState().hasFlag(flag);
  }

  /** Walking onto an exit that leads somewhere changes the district. */
  private checkExit(): void {
    const tile = toTile(this.player);
    const exit = this.district.def.exits.find((e) => e.to && e.x === tile.x && e.y === tile.y);
    if (!exit) {
      this.exitArmed = true;
      return;
    }
    if (!this.exitArmed) return;
    this.exitArmed = false;
    if (!this.isOpen(exit)) {
      bus.emit(EV.TOAST, t('toast.locked', { place: t(`district.${exit.to!.district}` as TextKey) }));
      return;
    }
    this.travel(exit.to!.district, exit.to!.entry);
  }

  private travel(district: string, entry: string): void {
    this.travelling = true;
    this.player.stop();
    this.removeBowl();
    bus.emit(EV.PROMPT, null);
    const state = gameState();
    state.travel(district, entry);
    state.save();
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
    cam.fadeOut(FADE_MS, 20, 16, 24);
  }

  private onGameEvent(e: GameEvent): void {
    if (e.type !== 'flag') return;
    for (const d of districtsUnlockedBy(e.flag)) {
      bus.emit(EV.TOAST, t('toast.unlocked', { place: t(`district.${d.id}` as TextKey) }));
    }
    // Exit arrows to newly opened districts light up.
    for (const obj of this.children.list) {
      const exit = obj.getData?.('exit') as Exit | undefined;
      if (exit) (obj as Phaser.GameObjects.Image).setAlpha(this.isOpen(exit) ? 0.9 : 0.35);
    }
  }

  // ------------------------------------------------------------------ helpers

  private randomSpot(cat: Cat): Point {
    const spots = catSpots(cat.def, this.weather).flatMap((s) => this.district.def.spots[s] ?? []);
    if (!spots.length) throw new Error(`Cat "${cat.def.id}" has no spots in district "${this.district.def.id}"`);
    return Phaser.Utils.Array.GetRandom(spots);
  }

  private distTo(p: Point): number {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
  }

  private updateLighting(): void {
    const clock = gameState().clock;
    const light = daylight(clock.minuteOfDay);
    const night = (1 - light) * 0.78;
    this.darkness.setAlpha(Math.min(0.85, night + this.weatherFx.dimming * (1 - night)));

    const lamps = Phaser.Math.Clamp((0.65 - light) / 0.4, 0, 1);
    for (const g of this.lampGlows) g.setAlpha(lamps * 0.55);

    const hour = clock.hour;
    for (const w of this.windowLights) {
      const lateNight = hour >= 1 && hour < 5;
      const on = w.offHour >= 0 && light < 0.7 && !lateNight && (hour < 5 || hour < w.offHour);
      const a = on ? Phaser.Math.Clamp((0.7 - light) / 0.4, 0, 1) : 0;
      w.pane.setAlpha(a * 0.9);
      w.glow.setAlpha(a * 0.6);
    }
  }
}

