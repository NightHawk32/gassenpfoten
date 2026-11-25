import Phaser from 'phaser';
import { catTextureKey } from '../art/sprites';
import { CATS, isOrange } from '../data/cats';
import { brainCellHolder } from '../world/brainCell';
import { ITEMS, itemsOfCategory } from '../data/items';
import { onLanguageChange, t, toggleLanguage, type TextKey } from '../i18n/i18n';
import type { DialogueLine } from '../systems/dialogue';
import { bus, EV, type InteractPrompt } from '../systems/events';
import { gameState, LEVEL } from '../systems/gameState';
import { QUESTS, questTitle, quests, stepText } from '../systems/quests';
import { isTouchDevice, pixelScale, uiScale } from '../systems/viewport';
import type { Weather } from '../systems/weather';
import { makeButton, toggleFullscreen, type Button } from '../ui/button';

const TOAST_SECONDS = 4.5;
const WEATHER_ICON: Record<Weather, string> = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', fog: '🌫️' };
const MAX_TOASTS = 3;

/**
 * Screen-space UI on top of the world: clock, current objective, buttons,
 * interaction prompt, treat menu, messages and the cat journal.
 */
export class HudScene extends Phaser.Scene {
  private s = 1;
  private clockText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private journalBtn!: Button;
  private langBtn!: Button;
  private fullBtn?: Button;
  private sneakBtn!: Button;
  private fastBtn!: Button;
  private promptBtn!: Button;
  private prompt: InteractPrompt | null = null;
  private sneakOn = false;
  private toasts: { obj: Phaser.GameObjects.Text; age: number }[] = [];
  private menu: { title: Phaser.GameObjects.Text; items: string[]; buttons: Button[]; cancel: Button } | null = null;
  private journal: Phaser.GameObjects.Container | null = null;
  private dialogue: {
    lines: DialogueLine[];
    index: number;
    box: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.Text;
    body: Phaser.GameObjects.Text;
    more: Phaser.GameObjects.Text;
  } | null = null;
  private journalScroll = { y: 0, max: 0, dragY: null as number | null };

  constructor() {
    super('Hud');
  }

  create(): void {
    this.buttons = [];
    this.toasts = [];
    this.menu = null;
    this.journal = null;
    this.dialogue = null;

    const textStyle = { fontFamily: 'Georgia, serif', color: '#fff6d5', backgroundColor: '#1d2433aa' };
    this.clockText = this.add.text(0, 0, '', { ...textStyle, fontFamily: 'monospace' });
    this.objectiveText = this.add.text(0, 0, '', { ...textStyle, color: '#f2d8a7' });

    this.journalBtn = this.addButton(makeButton(this, () => t('hud.journal'), () => this.toggleJournal()));
    this.langBtn = this.addButton(makeButton(this, () => t('language'), () => toggleLanguage()));
    if (document.fullscreenEnabled) {
      this.fullBtn = this.addButton(
        makeButton(this, () => t(document.fullscreenElement ? 'fullscreen.exit' : 'fullscreen.enter'), toggleFullscreen),
      );
    }
    this.sneakBtn = this.addButton(
      makeButton(this, () => t('hud.sneak'), () => {
        this.sneakOn = !this.sneakOn;
        this.sneakBtn.setActive(this.sneakOn);
        bus.emit(EV.SNEAK, this.sneakOn);
      }),
    );
    this.fastBtn = this.addButton(makeButton(this, () => t('hud.fast'), undefined, (down) => bus.emit(EV.FAST, down)));
    this.promptBtn = this.addButton(makeButton(this, () => this.promptLabel(), () => bus.emit(EV.INTERACT)));
    this.promptBtn.obj.setVisible(false);

    const kb = this.input.keyboard!;
    kb.on('keydown-J', () => this.toggleJournal());
    kb.on('keydown-L', () => toggleLanguage());
    kb.on('keydown-ESC', () => {
      if (this.journal) this.toggleJournal();
      else if (this.menu) this.chooseTreat(null);
      else if (this.dialogue) this.closeDialogue();
    });
    kb.on('keydown', (e: KeyboardEvent) => {
      // 1–4 pick a treat in the menu.
      const item = this.menu?.items[Number(e.key) - 1];
      if (item && gameState().itemCount(item) > 0) this.chooseTreat(item);
    });

    const handlers: [string, (...args: never[]) => void][] = [
      [EV.TOAST, (text: string) => this.toast(text)],
      [EV.PROMPT, (p: InteractPrompt | null) => this.setPrompt(p)],
      [EV.TREAT_MENU, (catId: string) => this.openMenu(catId)],
      [EV.QUESTS_CHANGED, () => this.updateObjective()],
      [EV.DIALOGUE, (lines: DialogueLine[]) => this.openDialogue(lines)],
      [EV.DIALOGUE_NEXT, () => this.nextLine()],
    ];
    for (const [ev, fn] of handlers) bus.on(ev, fn);
    const offLang = onLanguageChange(() => this.refreshTexts());
    const onFullscreen = () => this.fullBtn?.refresh();
    document.addEventListener('fullscreenchange', onFullscreen);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [ev, fn] of handlers) bus.off(ev, fn);
      offLang();
      document.removeEventListener('fullscreenchange', onFullscreen);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });

    this.updateObjective();
    this.layout();
  }

  update(_time: number, deltaMs: number): void {
    this.updateClock();

    const dt = deltaMs / 1000;
    for (const toast of this.toasts) {
      toast.age += dt;
      toast.obj.setAlpha(Phaser.Math.Clamp((TOAST_SECONDS - toast.age) / 0.6, 0, 1));
    }
    const expired = this.toasts.filter((x) => x.age >= TOAST_SECONDS);
    if (expired.length) {
      expired.forEach((x) => x.obj.destroy());
      this.toasts = this.toasts.filter((x) => x.age < TOAST_SECONDS);
      this.layoutToasts();
    }
  }

  // ------------------------------------------------------------------ layout

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const s = (this.s = uiScale(w, h));
    const m = Math.round(8 * s);

    this.cameras.main.setSize(w, h);
    for (const b of this.buttons) b.style(s);
    this.promptBtn.style(s, 15);

    this.updateClock();
    this.clockText.setFontSize(Math.round(12 * s));
    this.objectiveText.setFontSize(Math.round(11 * s));

    // Top-right buttons in a row. If they don't fit beside the clock (portrait
    // phones), they get the first row and the clock moves below them.
    const topButtons = [this.fullBtn, this.langBtn, this.journalBtn].filter((b): b is Button => !!b);
    const rowW = topButtons.reduce((sum, b) => sum + b.obj.width + m, 0);
    const narrow = m + this.clockText.width + m + rowW > w;
    let x = w - m;
    for (const b of topButtons) {
      b.obj.setOrigin(1, 0).setPosition(x, m);
      x -= b.obj.width + m;
    }
    const clockY = narrow ? m * 2 + topButtons[0].obj.height : m;
    this.clockText.setPosition(m, clockY);
    this.objectiveText
      .setWordWrapWidth(narrow ? w - m * 2 : Math.min(w * 0.6, 320 * s), true)
      .setPosition(m, clockY + this.clockText.height + Math.round(4 * s));

    this.sneakBtn.obj.setOrigin(0, 1).setPosition(m, h - m);
    this.fastBtn.obj.setOrigin(1, 1).setPosition(w - m, h - m);
    this.promptBtn.obj.setOrigin(0.5, 1).setPosition(w / 2, h - m - this.sneakBtn.obj.height - m);

    this.layoutToasts();
    if (this.menu) this.layoutMenu();
    if (this.dialogue) this.layoutDialogue();
    if (this.journal) {
      this.closeJournal();
      this.openJournal();
    }
  }

  private layoutToasts(): void {
    const w = this.scale.width;
    const s = this.s;
    let y = Math.round(this.scale.height * 0.2);
    for (const { obj } of this.toasts) {
      obj
        .setFontSize(Math.round(12 * s))
        .setPadding(Math.round(8 * s), Math.round(4 * s), Math.round(8 * s), Math.round(4 * s))
        .setWordWrapWidth(Math.min(w * 0.9, 460 * s), true)
        .setPosition(w / 2, y);
      y += obj.height + Math.round(4 * s);
    }
  }

  private updateClock(): void {
    const clock = gameState().clock;
    const state = gameState();
    const place = t(`district.${state.district}` as TextKey);
    const w = state.weather.current;
    const icon = w === 'sunny' && clock.phase === 'night' ? '🌙' : WEATHER_ICON[w];
    this.clockText.setText(
      ` ${place} · ${t('day')} ${clock.day} · ${clock.timeString} · ${t(`phase.${clock.phase}` as TextKey)} · ${icon} `,
    );
  }

  // ------------------------------------------------------------------ prompt & objective

  private promptLabel(): string {
    const p = this.prompt;
    if (!p) return '';
    const touch = isTouchDevice() ? '.touch' : '';
    const plain = p.action === 'content' || p.action === 'bande' || p.action === 'buffering';
    return t(`prompt.${p.action}${plain ? '' : touch}` as TextKey, { name: p.name });
  }

  private setPrompt(p: InteractPrompt | null): void {
    this.prompt = p;
    if (!p && this.menu) this.chooseTreat(null);
    this.promptBtn.refresh();
    this.promptBtn.obj.setVisible(!!p && !this.menu && !this.dialogue);
  }

  private updateObjective(): void {
    const text = quests.currentObjective();
    this.objectiveText.setText(text ? ` 📜 ${text} ` : '').setVisible(!!text);
  }

  // ------------------------------------------------------------------ dialogue

  private openDialogue(lines: DialogueLine[]): void {
    this.closeDialogue(false);
    if (!lines.length) return;
    const style = { fontFamily: 'Georgia, serif', color: '#fff6d5' };
    const box = this.add.rectangle(0, 0, 1, 1, 0x241c2c, 0.95).setOrigin(0.5, 1).setDepth(45).setInteractive();
    box.on(Phaser.Input.Events.POINTER_DOWN, () => this.nextLine());
    const name = this.add.text(0, 0, '', { ...style, color: '#f2d8a7' }).setDepth(46);
    const body = this.add.text(0, 0, '', style).setDepth(46);
    const more = this.add.text(0, 0, '▼', { ...style, color: '#f2d8a7' }).setOrigin(1, 1).setDepth(46);
    this.tweens.add({ targets: more, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.dialogue = { lines, index: 0, box, name, body, more };
    this.promptBtn.obj.setVisible(false);
    this.layoutDialogue();
  }

  private layoutDialogue(): void {
    const d = this.dialogue;
    if (!d) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const s = this.s;
    const pad = Math.round(12 * s);
    const boxW = Math.min(w * 0.94, 520 * s);
    const line = d.lines[d.index];
    d.name.setText(line.name).setFontSize(Math.round(13 * s));
    d.body.setText(line.text).setFontSize(Math.round(13 * s)).setWordWrapWidth(boxW - pad * 2, true);
    d.more.setText(d.index < d.lines.length - 1 ? '▼' : '✕').setFontSize(Math.round(12 * s));
    const boxH = pad * 2 + d.name.height + Math.round(4 * s) + d.body.height + Math.round(6 * s);
    const bottom = h - Math.round(8 * s) - this.sneakBtn.obj.height - Math.round(10 * s);
    const left = w / 2 - boxW / 2;
    d.box.setStrokeStyle(Math.max(1, s), 0xf2d8a7).setSize(boxW, boxH).setPosition(w / 2, bottom);
    d.box.input?.hitArea.setTo(0, 0, boxW, boxH);
    d.name.setPosition(left + pad, bottom - boxH + pad);
    d.body.setPosition(left + pad, d.name.y + d.name.height + Math.round(4 * s));
    d.more.setPosition(left + boxW - pad, bottom - Math.round(6 * s));
  }

  private nextLine(): void {
    const d = this.dialogue;
    if (!d) return;
    if (d.index < d.lines.length - 1) {
      d.index++;
      this.layoutDialogue();
    } else {
      this.closeDialogue();
    }
  }

  private closeDialogue(notify = true): void {
    const d = this.dialogue;
    if (!d) return;
    [d.box, d.name, d.body, d.more].forEach((o) => o.destroy());
    this.dialogue = null;
    this.promptBtn.obj.setVisible(!!this.prompt && !this.menu);
    if (notify) bus.emit(EV.DIALOGUE_DONE);
  }

  // ------------------------------------------------------------------ messages

  private toast(text: string): void {
    const obj = this.add
      .text(0, 0, text, { fontFamily: 'Georgia, serif', color: '#fff6d5', backgroundColor: '#1d2433dd', align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(50);
    this.toasts.push({ obj, age: 0 });
    while (this.toasts.length > MAX_TOASTS) this.toasts.shift()!.obj.destroy();
    this.layoutToasts();
  }

  // ------------------------------------------------------------------ treat menu

  private openMenu(catId: string): void {
    if (this.menu) return;
    const cat = CATS.find((c) => c.id === catId);
    if (!cat) return;
    const state = gameState();
    const title = this.add
      .text(0, 0, t('menu.title', { name: cat.name }), { fontFamily: 'Georgia, serif', color: '#fff6d5', backgroundColor: '#1d2433dd' })
      .setOrigin(0.5, 1)
      .setDepth(40);
    const treats = itemsOfCategory('treat');
    const buttons = treats.map((item, i) => {
      const count = state.itemCount(item.id);
      const b = makeButton(this, () => `${i + 1}  ${t(`item.${item.id}` as TextKey)} ×${count}`, () => this.chooseTreat(item.id));
      b.setEnabled(count > 0);
      b.obj.setDepth(40);
      return b;
    });
    const cancel = makeButton(this, () => t('menu.cancel'), () => this.chooseTreat(null));
    cancel.obj.setDepth(40);
    this.menu = { title, items: treats.map((i) => i.id), buttons, cancel };
    this.promptBtn.obj.setVisible(false);
    this.layoutMenu();
  }

  private layoutMenu(): void {
    if (!this.menu) return;
    const { title, buttons, cancel } = this.menu;
    const w = this.scale.width;
    const h = this.scale.height;
    const s = this.s;
    const gap = Math.round(6 * s);
    [...buttons, cancel].forEach((b) => b.style(s, 13));
    title.setFontSize(Math.round(13 * s)).setPadding(Math.round(8 * s), Math.round(4 * s), Math.round(8 * s), Math.round(4 * s));

    // As many columns as fit; usually 2×2 on phones, 4 in a row on wide screens.
    const bw = Math.max(...buttons.map((b) => b.obj.width));
    const bh = buttons[0].obj.height;
    const cols = Math.max(1, Math.min(buttons.length, Math.floor((w * 0.95 + gap) / (bw + gap))));
    const rows = Math.ceil(buttons.length / cols);
    const totalW = cols * bw + (cols - 1) * gap;
    const bottom = h - Math.round(8 * s) - this.sneakBtn.obj.height - gap * 2 - cancel.obj.height;
    const top = bottom - rows * bh - (rows - 1) * gap;
    buttons.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      b.obj.setFixedSize(bw, 0).setOrigin(0, 0).setPosition(w / 2 - totalW / 2 + col * (bw + gap), top + row * (bh + gap));
    });
    cancel.obj.setOrigin(0.5, 0).setPosition(w / 2, bottom + gap);
    title.setPosition(w / 2, top - gap);
  }

  private chooseTreat(item: string | null): void {
    if (!this.menu) return;
    this.menu.title.destroy();
    [...this.menu.buttons, this.menu.cancel].forEach((b) => b.obj.destroy());
    this.menu = null;
    this.promptBtn.obj.setVisible(!!this.prompt);
    bus.emit(EV.TREAT_CHOSEN, item);
  }

  // ------------------------------------------------------------------ journal

  private toggleJournal(): void {
    if (this.journal) {
      this.closeJournal();
      if (this.scene.isPaused('Game') && !this.scene.isActive('Pet')) this.scene.resume('Game');
    } else {
      if (this.scene.isActive('Pet')) return;
      this.scene.pause('Game');
      this.journalScroll.y = 0;
      this.openJournal();
    }
  }

  private closeJournal(): void {
    this.journal?.destroy(true);
    this.journal = null;
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onJournalWheel, this);
  }

  /** Builds the cat journal (Katzenbuch): cats, quests and the bag. */
  private openJournal(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const s = this.s;
    const px = pixelScale(w, h);
    const pad = Math.round(14 * s);
    const panelW = Math.min(w * 0.94, 560 * s);
    const panelH = h * 0.9;
    const left = (w - panelW) / 2;
    const top = (h - panelH) / 2;
    const textW = panelW - pad * 2;
    const state = gameState();

    const root = this.add.container(0, 0).setDepth(60);
    const blocker = this.add.rectangle(0, 0, w, h, 0x000000, 0.5).setOrigin(0).setInteractive();
    const panel = this.add.rectangle(left, top, panelW, panelH, 0x241c2c, 0.97).setOrigin(0).setStrokeStyle(Math.max(1, s), 0xf2d8a7);
    root.add([blocker, panel]);

    const content = this.add.container(left + pad, top + pad);
    const text = (str: string, size: number, color = '#fff6d5', indent = 0) => {
      const obj = this.add
        .text(indent, y, str, { fontFamily: 'Georgia, serif', color, wordWrap: { width: textW - indent, useAdvancedWrap: true } })
        .setFontSize(Math.round(size * s));
      content.add(obj);
      y += obj.height + Math.round(3 * s);
      return obj;
    };
    let y = 0;

    text(t('journal.title'), 20, '#fff6d5');
    y += Math.round(4 * s);

    // Cats
    const iconSize = 16 * px * 2;
    for (const cat of CATS) {
      const p = state.cat(cat.id);
      const known = p.level > LEVEL.UNKNOWN;
      const icon = this.add.image(0, y, catTextureKey(cat.coat), 0).setOrigin(0).setScale(px);
      if (!known) icon.setTintFill(0x0d0a12);
      content.add(icon);
      const startY = y;
      const indent = iconSize + Math.round(10 * s);
      const hearts = '♥'.repeat(p.level) + '♡'.repeat(LEVEL.BEST_FRIEND - p.level);
      const along = state.companion === cat.id ? `  ${t('journal.companion')}` : '';
      const status = cat.bande ? t('journal.bande') : `${hearts}  ${t(`level.${p.level}` as TextKey)}${along}`;
      text(`${known ? cat.name : '???'}   ${status}`, 14, cat.bande ? '#f0a060' : '#f2d8a7', indent);
      if (!known) {
        text(t('journal.unknown'), 11, '#c9c3d6', indent);
      } else {
        const list = (keys: string[], prefix: string) => keys.map((k) => t(`${prefix}.${k}` as TextKey)).join(', ');
        text(t(`cat.${cat.id}.quirk` as TextKey), 11, '#c9c3d6', indent);
        text(
          t('journal.where', { place: t(`district.${cat.district}` as TextKey), spots: list(cat.spots, 'spot') }),
          11,
          '#c9c3d6',
          indent,
        );
        text(t('journal.when', { phases: list(cat.phases, 'phase') }), 11, '#c9c3d6', indent);
        const habits = (['only', 'prefers', 'avoids'] as const)
          .filter((k) => cat.weather?.[k]?.length)
          .map((k) => t(`journal.weather.${k}`, { list: list(cat.weather![k]!, 'weather') }));
        if (habits.length) text(t('journal.weather', { text: habits.join(' · ') }), 11, '#c9c3d6', indent);
        if (p.level >= LEVEL.FED && !cat.bande) {
          text(t('journal.likes', { likes: list(cat.likes, 'item'), dislikes: list(cat.dislikes, 'item') }), 11, '#c9c3d6', indent);
        }
        if (isOrange(cat)) text(t('journal.braincell', { holder: brainCellHolder() ?? t('braincell.nowhere') }), 11, '#f0a060', indent);
        if (p.knownSpots.length) text(t('journal.spots', { zones: list(p.knownSpots, 'zone') }), 11, '#c9c3d6', indent);
      }
      y = Math.max(y, startY + iconSize) + Math.round(10 * s);
    }

    // Quests
    text(t('journal.quests'), 16, '#fff6d5');
    for (const def of QUESTS) {
      const qp = state.quest(def.id);
      if (!qp) continue;
      if (qp.done) text(`✓ ${questTitle(def)}`, 11, '#8d86a0', Math.round(8 * s));
      else {
        text(`📜 ${questTitle(def)}`, 12, '#f2d8a7', Math.round(8 * s));
        text(stepText(def, def.steps[qp.step]), 11, '#c9c3d6', Math.round(24 * s));
      }
    }
    y += Math.round(8 * s);

    // Bag
    text(t('journal.bag'), 16, '#fff6d5');
    const bag = ITEMS.filter((i) => state.itemCount(i.id) > 0)
      .map((i) => `${t(`item.${i.id}` as TextKey)} ×${state.itemCount(i.id)}`)
      .join(' · ');
    text(bag || t('journal.bagEmpty'), 11, '#c9c3d6', Math.round(8 * s));

    // Scrollable area with a mask; the close button stays on top.
    const close = makeButton(this, () => t('journal.close'), () => this.toggleJournal());
    close.style(s);
    close.obj.setOrigin(1, 1).setPosition(left + panelW - pad / 2, top + panelH - pad / 2);
    const viewH = panelH - pad * 2 - close.obj.height;
    const maskShape = this.make.graphics({}, false).fillRect(left, top + pad, panelW, viewH);
    content.setMask(maskShape.createGeometryMask());
    root.add([content, close.obj]);

    this.journal = root;
    this.journalScroll.max = Math.max(0, y - viewH);
    this.journalScroll.y = Math.min(this.journalScroll.y, this.journalScroll.max);
    // "More below" hint while the list is scrolled less than all the way.
    const more = this.add
      .text(left + panelW / 2, top + pad + viewH, '▼', { fontFamily: 'Georgia, serif', color: '#f2d8a7' })
      .setFontSize(Math.round(14 * s))
      .setOrigin(0.5, 0);
    root.add(more);
    const apply = () => {
      content.setY(top + pad - this.journalScroll.y);
      more.setVisible(this.journalScroll.y < this.journalScroll.max - 1);
    };
    apply();

    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onJournalWheel, this);
    blocker.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => (this.journalScroll.dragY = p.y));
    blocker.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.journalScroll.dragY === null || !p.isDown) return;
      this.scrollJournal(this.journalScroll.dragY - p.y);
      this.journalScroll.dragY = p.y;
    });
    blocker.on(Phaser.Input.Events.POINTER_UP, () => (this.journalScroll.dragY = null));
    root.setData('apply', apply);
  }

  private onJournalWheel(_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    this.scrollJournal(dy);
  }

  private scrollJournal(dy: number): void {
    if (!this.journal) return;
    this.journalScroll.y = Phaser.Math.Clamp(this.journalScroll.y + dy, 0, this.journalScroll.max);
    (this.journal.getData('apply') as () => void)();
  }

  // ------------------------------------------------------------------ helpers

  private addButton(b: Button): Button {
    this.buttons.push(b);
    return b;
  }

  private refreshTexts(): void {
    for (const b of this.buttons) b.refresh();
    this.updateObjective();
    this.layout();
  }
}
