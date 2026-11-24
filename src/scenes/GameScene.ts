import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { CATS, treatReaction } from '../data/cats';
import { Cat } from '../entities/Cat';
import { Player } from '../entities/Player';
import { t, type TextKey } from '../i18n/i18n';
import { daylight, type DayPhase } from '../systems/clock';
import { bus, emitGame, EV, type InteractPrompt, type PetResult } from '../systems/events';
import { gameState, LEVEL } from '../systems/gameState';
import { quests } from '../systems/quests';
import { isTouchDevice } from '../systems/viewport';
import type { District } from '../world/district';
import { getDistrict } from '../world/districts';
import type { Point } from '../world/grid';

/** How close (px) the player must be to feed or pet a cat. */
const INTERACT_RANGE = 24;
/** How far (px) the player must step back from the bowl before the cat comes. */
const BOWL_DISTANCE = 30;
/** Cats count as "seen" within this distance (px). */
const SEE_RANGE = 6 * TILE_SIZE;
const FAST_FORWARD = 60;
const AUTOSAVE_SECONDS = 10;
/** Chance that a cat shows up in one of its phases (after the first meeting). */
const PRESENCE_CHANCE = 0.85;

interface Bowl {
  img: Phaser.GameObjects.Image;
  item: string;
  cat: Cat;
}

/**
 * The walkable world: one district with its cats, the player, the in-game
 * clock and day/night lighting. UI lives in HudScene, petting in PetScene.
 */
export class GameScene extends Phaser.Scene {
  private district!: District;
  private player!: Player;
  private cats: Cat[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private darkness!: Phaser.GameObjects.Rectangle;
  private lampGlows: Phaser.GameObjects.Image[] = [];
  private windowLights: { pane: Phaser.GameObjects.Rectangle; glow: Phaser.GameObjects.Image; offHour: number }[] = [];
  private phase!: DayPhase;
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

  constructor() {
    super('Game');
  }

  create(): void {
    const state = gameState();
    this.district = getDistrict(state.district);
    this.cats = [];
    this.lampGlows = [];
    this.windowLights = [];
    this.bowl = null;

    this.buildWorld();

    const start = this.district.def.entries.start;
    this.player = new Player(this, this.district.grid, start);

    this.cats = CATS.filter(
      (c) => c.district === this.district.def.id && (!c.requiresFlag || state.hasFlag(c.requiresFlag)),
    ).map((def) => new Cat(this, def, this.district.grid, this.district.def.exits));

    // Cats that belong to the current phase are already there when you arrive.
    this.phase = state.clock.phase;
    for (const cat of this.cats) {
      if (cat.def.phases.includes(this.phase)) cat.appearAt(this.randomSpot(cat));
    }

    this.setupCamera();
    this.setupInput();
    this.setupBus();

    quests.start();
    emitGame({ type: 'area-entered', area: this.district.def.id });

    this.scene.launch('Hud');
    this.time.delayedCall(600, () => bus.emit(EV.TOAST, t(isTouchDevice() ? 'toast.controls.touch' : 'toast.controls')));

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
      const cat = over.map((o) => o.getData('cat') as Cat | undefined).find((c) => c && c.present);
      if (cat) {
        this.tapCat(cat);
        return;
      }
      this.pointerHeld = true;
      this.approachCat = null;
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
    ];
    for (const [ev, fn] of handlers) bus.on(ev, fn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [ev, fn] of handlers) bus.off(ev, fn);
    });
  }

  // ------------------------------------------------------------------ loop

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    const state = gameState();

    const fast = this.fast || this.keys.T.isDown;
    state.clock.update(deltaMs * (fast ? FAST_FORWARD : 1));
    this.checkPhase();
    if (state.dailyRefill()) bus.emit(EV.TOAST, t('toast.refill'));

    this.repathTimer = Math.max(0, this.repathTimer - dt);
    this.player.sneaking = this.sneakToggle || this.keys.SHIFT.isDown;
    this.player.update(dt, this.keyboardDir());

    if (this.approachCat) {
      const c = this.approachCat;
      if (!c.approachable) this.approachCat = null;
      else if (this.distTo(c) <= INTERACT_RANGE) {
        this.player.stop();
        this.approachCat = null;
        this.interactWith(c);
      }
    }

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

    for (const cat of this.cats) {
      const active = cat.def.phases.includes(phase);
      if (cat.state === 'idle' && !active) {
        cat.leave(false);
      } else if (!cat.present && active) {
        const firstMeeting = gameState().cat(cat.def.id).level === LEVEL.UNKNOWN;
        if (firstMeeting || Math.random() < PRESENCE_CHANCE) cat.arrive(this.randomSpot(cat));
      }
    }
  }

  private checkSeen(cat: Cat): void {
    if (!cat.present || cat.state === 'fleeing') return;
    const state = gameState();
    if (state.cat(cat.def.id).level !== LEVEL.UNKNOWN) return;
    if (this.distTo(cat) > SEE_RANGE || !this.cameras.main.worldView.contains(cat.x, cat.y)) return;
    state.raiseLevel(cat.def.id, LEVEL.SEEN);
    cat.showIcon('icon-question', 2);
    bus.emit(EV.TOAST, t('toast.newCat', { name: cat.def.name }));
    emitGame({ type: 'cat-seen', cat: cat.def.id });
  }

  // ------------------------------------------------------------------ interaction

  private nearestApproachableCat(): Cat | null {
    let best: Cat | null = null;
    let bestD = INTERACT_RANGE;
    for (const cat of this.cats) {
      const d = this.distTo(cat);
      if (cat.approachable && d <= bestD) {
        best = cat;
        bestD = d;
      }
    }
    return best;
  }

  private actionFor(cat: Cat): InteractPrompt['action'] {
    if (cat.pettedThisVisit) return 'content';
    if (cat.fedThisVisit || gameState().cat(cat.def.id).level >= LEVEL.FRIEND) return 'pet';
    return 'feed';
  }

  private updatePrompt(): void {
    const cat = this.nearestApproachableCat();
    const prompt: InteractPrompt | null = cat ? { catId: cat.def.id, catName: cat.def.name, action: this.actionFor(cat) } : null;
    const key = prompt ? `${prompt.catId}:${prompt.action}` : '';
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (!cat) this.menuCat = null;
    bus.emit(EV.PROMPT, prompt);
  }

  private interact(): void {
    const cat = this.nearestApproachableCat();
    if (cat) this.interactWith(cat);
  }

  private interactWith(cat: Cat): void {
    switch (this.actionFor(cat)) {
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
    }
  }

  private tapCat(cat: Cat): void {
    if (!cat.approachable) return;
    if (this.distTo(cat) <= INTERACT_RANGE + 4) {
      this.player.stop();
      this.interactWith(cat);
    } else if (this.player.walkTo(cat.sprite)) {
      this.approachCat = cat;
    }
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
    if (!bowl || bowl.cat !== cat) return;
    this.removeBowl();
    const state = gameState();
    const id = cat.def.id;
    const reaction = treatReaction(cat.def, bowl.item);
    const params = { name: cat.def.name, item: t(`item.${bowl.item}` as TextKey) };

    if (reaction === 'disliked') {
      bus.emit(EV.TOAST, t('toast.disliked', params));
      cat.leave(false);
    } else {
      cat.fedThisVisit = true;
      if (reaction === 'liked') cat.showIcon('icon-heart', 2);
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

  // ------------------------------------------------------------------ helpers

  private randomSpot(cat: Cat): Point {
    const spots = cat.def.spots.flatMap((s) => this.district.def.spots[s] ?? []);
    if (!spots.length) throw new Error(`Cat "${cat.def.id}" has no spots in district "${this.district.def.id}"`);
    return Phaser.Utils.Array.GetRandom(spots);
  }

  private distTo(p: Point): number {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
  }

  private updateLighting(): void {
    const clock = gameState().clock;
    const light = daylight(clock.minuteOfDay);
    this.darkness.setAlpha((1 - light) * 0.78);

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

