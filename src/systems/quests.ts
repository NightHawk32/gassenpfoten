import raw from '../data/quests.json';
import { t, type TextKey } from '../i18n/i18n';
import { bus, EV, type GameEvent, type GameEventType } from './events';
import { gameState } from './gameState';

/**
 * Quests (missions / story arcs) as data. A quest is a list of steps; each
 * step waits for a game event (src/systems/events.ts) that matches its
 * fields. Quests start automatically once all quests in `requires` are done
 * and `requiresFlag` is set. Rewards give items or set story flags; flags in
 * turn unlock districts, cats or later quests. See docs/EXTENDING.md.
 *
 * Texts: quest.<id>.title and quest.<id>.<stepId> in the language files.
 */
export interface QuestStep {
  id: string;
  event: GameEventType;
  /** Event fields that must match. Numbers mean "at least" (e.g. level ≥ 3). */
  match?: Record<string, string | number>;
  /** How many matching events are needed (default 1). */
  count?: number;
}

export type QuestReward = { type: 'item'; item: string; amount: number } | { type: 'flag'; flag: string };

export interface QuestDef {
  id: string;
  requires?: string[];
  requiresFlag?: string;
  steps: QuestStep[];
  rewards?: QuestReward[];
}

export const QUESTS: QuestDef[] = raw as QuestDef[];

function matches(step: QuestStep, event: GameEvent): boolean {
  if (step.event !== event.type) return false;
  const fields = event as unknown as Record<string, unknown>;
  return Object.entries(step.match ?? {}).every(([key, want]) =>
    typeof want === 'number' ? Number(fields[key]) >= want : fields[key] === want,
  );
}

export const questTitle = (q: QuestDef) => t(`quest.${q.id}.title` as TextKey);
export const stepText = (q: QuestDef, step: QuestStep) => t(`quest.${q.id}.${step.id}` as TextKey);

class QuestSystem {
  private started = false;

  /** Subscribes to game events. Safe to call more than once. */
  start(): void {
    if (this.started) return;
    this.started = true;
    bus.on(EV.GAME, (e: GameEvent) => this.onEvent(e));
    this.unlockNew(false);
  }

  /** Active (started, not finished) quests in definition order. */
  active(): { def: QuestDef; step: QuestStep; count: number }[] {
    const state = gameState();
    return QUESTS.flatMap((def) => {
      const p = state.quest(def.id);
      if (!p || p.done) return [];
      return [{ def, step: def.steps[p.step], count: p.count }];
    });
  }

  /** Text for the HUD: the first active quest's current step. */
  currentObjective(): string | null {
    const first = this.active()[0];
    if (!first) return null;
    const need = first.step.count ?? 1;
    const progress = need > 1 ? ` (${first.count}/${need})` : '';
    return stepText(first.def, first.step) + progress;
  }

  private onEvent(event: GameEvent): void {
    const state = gameState();
    let changed = false;
    for (const { def, step } of this.active()) {
      if (!matches(step, event)) continue;
      const p = state.quest(def.id)!;
      p.count++;
      changed = true;
      if (p.count < (step.count ?? 1)) continue;
      p.step++;
      p.count = 0;
      if (p.step >= def.steps.length) this.complete(def);
    }
    if (changed) this.unlockNew(true);
    if (changed) bus.emit(EV.QUESTS_CHANGED);
  }

  private complete(def: QuestDef): void {
    const state = gameState();
    state.quest(def.id)!.done = true;
    bus.emit(EV.TOAST, t('quest.done', { title: questTitle(def) }));
    for (const r of def.rewards ?? []) {
      if (r.type === 'item') {
        const added = state.addItem(r.item, r.amount);
        if (added) bus.emit(EV.TOAST, t('quest.reward', { amount: added, item: t(`item.${r.item}` as TextKey) }));
      } else {
        state.setFlag(r.flag);
      }
    }
  }

  /** Starts every quest whose requirements are now met. */
  private unlockNew(announce: boolean): void {
    const state = gameState();
    let any = false;
    for (const def of QUESTS) {
      if (state.quest(def.id)) continue;
      if (def.requiresFlag && !state.hasFlag(def.requiresFlag)) continue;
      if (!(def.requires ?? []).every((id) => state.quest(id)?.done)) continue;
      state.startQuest(def.id);
      any = true;
      if (announce) bus.emit(EV.TOAST, t('quest.new', { title: questTitle(def) }));
    }
    if (any) bus.emit(EV.QUESTS_CHANGED);
  }
}

export const quests = new QuestSystem();
