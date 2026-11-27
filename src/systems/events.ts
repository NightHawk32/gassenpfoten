import Phaser from 'phaser';

/**
 * Event bus between the world (GameScene), the HUD, the petting overlay and
 * the quest system. Scenes must remove their listeners on shutdown.
 */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  /** (text: string) short message for the player */
  TOAST: 'toast',
  /** (prompt: InteractPrompt | null) what the player can do right now */
  PROMPT: 'prompt',
  /** () the player pressed the interact button */
  INTERACT: 'interact',
  /** (catId: string) open the treat menu for this cat */
  TREAT_MENU: 'treat-menu',
  /** (itemId: string | null) chosen treat, or null for cancel */
  TREAT_CHOSEN: 'treat-chosen',
  /** (on: boolean) */
  SNEAK: 'sneak',
  /** (on: boolean) fast-forward time */
  FAST: 'fast',
  /** (result: PetResult, catId: string) petting finished */
  PET_DONE: 'pet-done',
  /** (event: GameEvent) something happened in the game world; quests listen to this */
  GAME: 'game',
  /** () quest list or progress changed */
  QUESTS_CHANGED: 'quests-changed',
  /** (lines: DialogueLine[]) show a conversation */
  DIALOGUE: 'dialogue',
  /** () next line (or close on the last one) */
  DIALOGUE_NEXT: 'dialogue-next',
  /** () the conversation was closed */
  DIALOGUE_DONE: 'dialogue-done',
  /** (npcId: string) open this NPC's shop */
  SHOP: 'shop',
} as const;

/** What the player can do with the nearest cat or person. */
export interface InteractPrompt {
  targetId: string;
  name: string;
  action: 'feed' | 'pet' | 'content' | 'talk' | 'bande' | 'distract' | 'buffering' | 'follow' | 'stay';
}

export type PetResult = 'happy' | 'left' | 'cancel';

/**
 * Things that happen in the world. Quest steps match on `type` and the other
 * fields (see src/systems/quests.ts). Add new types here when new mechanics
 * come in (e.g. 'npc-talked', 'photo-taken', 'bande-outwitted').
 */
export type GameEvent =
  | { type: 'cat-seen'; cat: string }
  | { type: 'cat-fed'; cat: string; item: string; reaction: 'liked' | 'neutral' | 'disliked' }
  | { type: 'cat-petted'; cat: string }
  | { type: 'cat-level'; cat: string; level: number }
  | { type: 'item-gained'; item: string; amount: number }
  | { type: 'area-entered'; area: string }
  | { type: 'phase'; phase: string; day: number }
  | { type: 'flag'; flag: string }
  | { type: 'weather'; weather: string }
  | { type: 'npc-talked'; npc: string }
  | { type: 'bande-stole'; cat: string; victim: string }
  | { type: 'bande-distracted'; cat: string }
  /** The orange brain cell jumped between two cats in view (src/world/brainCell.ts). */
  | { type: 'braincell-hop'; from: string; to: string }
  /** The player took a closer look at an orange cat that froze mid-thought. */
  | { type: 'braincell-observed'; cat: string }
  /** A best friend started following the player. */
  | { type: 'companion'; cat: string }
  /** Bought from an NPC's shop for Taler. */
  | { type: 'item-bought'; item: string; price: number; npc: string }
  /** The player is on the square while a demo marches through (once per demo). */
  | { type: 'demo-seen'; area: string }
  /** The demo has moved on; the cats come back. */
  | { type: 'demo-ended'; area: string };

export type GameEventType = GameEvent['type'];

export function emitGame(event: GameEvent): void {
  bus.emit(EV.GAME, event);
}
