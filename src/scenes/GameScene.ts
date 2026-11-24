import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { CAT_FRAME } from '../art/sprites';
import { catActive, CATS, catSpots, treatReaction } from '../data/cats';
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
import type { Weather } from '../systems/weather';
import type { District, Exit } from '../world/district';
import { WeatherFx } from '../world/weatherFx';
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
    this.lampGlows = [];
    this.windowLights = [];
    this.bowl = null;
    this.menuCat = null;
    this.approachCat = null;
    this.promptKey = '';
    this.pointerHeld = false;
    this.exitArmed = false;
    this.travelling = false;

    this.buildWorld();

    const entries = this.district.def.entries;
    this.player = new Player(this, this.district.grid, entries[state.entry] ?? entries.start);

    this.cats = CATS.filter(
      (c) => c.district === this.district.def.id && (!c.requiresFlag || state.hasFlag(c.requiresFlag)),
    ).map((def) => new Cat(this, def, this.district.grid, this.district.def.exits));

    // Cats that belong to the current phase and weather are already there when you arrive.
    this.phase = state.clock.phase;
    state.weather.update(state.clock.toJSON());
    this.weather = state.weather.current;
    for (const cat of this.cats) {
      if (catActive(cat.def, this.phase, this.weather)) cat.appearAt(this.randomSpot(cat));
    }
    this.npcs = NPCS.filter((n) => n.district === this.district.def.id).map((def) => {
      const spot = this.district.def.spots[def.spot]?.[0];
      if (!spot) throw new Error(`NPC "${def.id}": no spot "${def.spot}" in district "${this.district.def.id}"`);
      const npc = new Npc(this, def, spot);
      npc.setPresent(def.phases.includes(this.phase), true);
      return npc;
    });
    this.weatherFx = new WeatherFx(this, this.district.width * TILE_SIZE, this.district.height * TILE_SIZE, this.weather);

    this.setupCamera();
    this.setupInput();
    this.setupBus();

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
      [EV.DIALOGUE_DONE, () => (this.talking = false)],
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

    for (const cat of this.cats) {
      const event = cat.update(dt, this.player, state.cat(cat.def.id).level);
      if (event === 'fled') this.onFled(cat);
      if (event === 'ate') this.onAte(cat);
      if (event === 'gone') this.onGone(cat);
      this.checkSeen(cat);
    }

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
    for (const npc of this.npcs) npc.setPresent(npc.def.phases.includes(phase));
  }

  private checkWeather(): void {
    const state = gameState();
    if (!state.weather.update(state.clock.toJSON())) return;
    const before = this.weather;
    this.weather = state.weather.current;
    emitGame({ type: 'weather', weather: this.weather });
    bus.emit(EV.TOAST, t(`toast.weather.${this.weather}` as TextKey));
    this.updatePresence(before);
  }

  /**
   * After a change of phase or weather: cats leave, arrive, or move to their
   * weather spot (e.g. under the arcades when it rains).
   */
  private updatePresence(weatherBefore: Weather | null): void {
    for (const cat of this.cats) {
      const active = catActive(cat.def, this.phase, this.weather);
      if (cat.state === 'idle' && !active) {
        cat.leave(false);
      } else if (!cat.present && active) {
        const firstMeeting = gameState().cat(cat.def.id).level === LEVEL.UNKNOWN;
        const prefers = cat.def.weather?.prefers?.includes(this.weather);
        if (firstMeeting || prefers || Math.random() < PRESENCE_CHANCE) cat.arrive(this.randomSpot(cat));
      } else if (cat.state === 'idle' && weatherBefore) {
        const old = catSpots(cat.def, weatherBefore).join();
        if (old !== catSpots(cat.def, this.weather).join()) cat.moveTo(this.randomSpot(cat));
      }
    }
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
    if (cat.def.bande) return !this.yarn.has(cat) && gameState().itemCount('yarn') > 0 ? 'distract' : 'bande';
    if (cat.pettedThisVisit) return 'content';
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
    this.player.stop();
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
        if (other.def.bande || other.state !== 'idle' || other.def.shyness < 3) continue;
        if (Phaser.Math.Distance.Between(cat.x, cat.y, other.x, other.y) < BANDE_SCARE) other.alert += dt * 0.25;
      }

      // Patrol between their spots.
      if (cat.state !== 'idle') continue;
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
      if (!cat.def.bande || this.yarn.has(cat) || (cat.state !== 'idle' && cat.state !== 'arriving')) continue;
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
      this.time.delayedCall(1200, () => cat.state === 'idle' && cat.leave(false));
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
    } else if (result === 'left') {
      cat.leave(false);
    } else {
      cat.state = 'idle';
    }
    state.save();
  }

  private toastLevel(cat: Cat): void {
    const level = gameState().cat(cat.def.id).level;
    bus.emit(EV.TOAST, t('toast.level', { name: cat.def.name, level: t(`level.${level}` as TextKey) }));
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

