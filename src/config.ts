/**
 * Global constants and deployment-safe helpers.
 * See docs/GAME_CONCEPT.md §10.1 (GitHub Pages rules).
 */

/** Internal resolution. Pixel art is scaled up in whole-number steps. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

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
