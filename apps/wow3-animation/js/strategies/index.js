import { KaraokeStrategy } from './KaraokeStrategy.js';
import { SubtitleStrategy } from './SubtitleStrategy.js';
import { BlockStrategy } from './BlockStrategy.js';

/**
 * Registry of display mode names to strategy classes.
 * @type {Object<string, typeof import('./DisplayStrategy.js').DisplayStrategy>}
 */
const STRATEGY_MAP = {
  karaoke: KaraokeStrategy,
  subtitle: SubtitleStrategy,
  block: BlockStrategy,
};

/**
 * Available display mode names for UI dropdowns.
 * @type {Array<{value: string, label: string}>}
 */
export const DISPLAY_MODES = [
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'block', label: 'Block' },
];

/**
 * Create a strategy instance for the given display mode.
 * Falls back to KaraokeStrategy for unknown modes.
 * @param {string} mode - 'karaoke' | 'subtitle' | 'block'
 * @returns {import('./DisplayStrategy.js').DisplayStrategy}
 */
export function createStrategy(mode) {
  const StrategyClass = STRATEGY_MAP[mode] || KaraokeStrategy;
  return new StrategyClass();
}
