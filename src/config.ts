/**
 * Global constants and deployment-safe helpers.
 * See docs/GAME_CONCEPT.md §10.1 (GitHub Pages rules).
 */

/**
 * Reference layout size (landscape). The canvas itself always has the real
 * pixel size of the screen (see src/systems/viewport.ts); layouts scale from
 * this size with uiScale(), pixel art with the whole-number pixelScale().
 */
export const DESIGN_WIDTH = 640;
export const DESIGN_HEIGHT = 360;

/** Upper limit for the device pixel ratio used for rendering (performance on 3× phones). */
export const MAX_PIXEL_RATIO = 2;

/** Tile size in pixels (concept §8). */
export const TILE_SIZE = 16;

/**
 * Prefix for every localStorage key. nighthawk32.github.io is shared by all
 * Pages projects of the account, so keys must be namespaced.
 */
export const STORAGE_PREFIX = 'gassenpfoten:';

/** Save-format version. Bump it and add a migration when the format changes. */
export const SAVE_VERSION = 1;

/**
 * Builds the URL of a file in /public. Works under '/' (dev) as well as under
 * '/gassenpfoten/' (GitHub Pages). Never hard-code '/assets/...' in code.
 *
 * @example assetUrl('assets/sprites/cat-placeholder.png')
 */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
