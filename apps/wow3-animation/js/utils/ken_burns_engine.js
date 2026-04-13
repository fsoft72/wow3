/**
 * Ken Burns effect computation engine.
 * Pure module: no DOM, no side effects.
 * All functions operate on the kenBurns config shape:
 *   {
 *     zoom:  null | { preset: 'in'|'out',           intensity: number },  // 0.05–0.5
 *     pan:   null | { preset: 'lr'|'rl'|'tb'|'bt', intensity: number },  // 2–20 (%)
 *     bokeh: null | { preset: 'in'|'out',           intensity: number }   // 2–20 (px)
 *   }
 */

/**
 * Compute CSS transform and filter strings at a given playback progress.
 * @param {object|null} kenBurns - clip.kenBurns
 * @param {number} t - progress [0, 1]
 * @returns {{ transform: string, filter: string }}
 */
export function computeKenBurns(kenBurns, t) {
  if (!kenBurns) return { transform: '', filter: '' };

  const parts = [];
  let blur = 0;

  const { zoom, pan, bokeh } = kenBurns;

  if (zoom) {
    const intensity = zoom.intensity ?? 0.2;
    const scale = zoom.preset === 'in'
      ? 1 + intensity * t
      : 1 + intensity * (1 - t);
    parts.push(`scale(${scale.toFixed(4)})`);
  }

  if (pan) {
    const intensity = pan.intensity ?? 8;
    const half = intensity / 2;
    switch (pan.preset) {
      case 'lr': parts.push(`translateX(${(-half + intensity * t).toFixed(2)}%)`); break;
      case 'rl': parts.push(`translateX(${(half - intensity * t).toFixed(2)}%)`); break;
      case 'tb': parts.push(`translateY(${(-half + intensity * t).toFixed(2)}%)`); break;
      case 'bt': parts.push(`translateY(${(half - intensity * t).toFixed(2)}%)`); break;
    }
  }

  if (bokeh) {
    const intensity = bokeh.intensity ?? 10;
    blur = bokeh.preset === 'in'
      ? intensity * (1 - t)
      : intensity * t;
  }

  return {
    transform: parts.length ? parts.join(' ') : '',
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : ''
  };
}

/**
 * Generate WAAPI-compatible keyframes covering the full clip duration.
 * @param {object|null} kenBurns - clip.kenBurns
 * @returns {Array<{transform: string, filter: string, offset: number}>}
 */
export function kenBurnsToKeyframes(kenBurns) {
  if (!kenBurns) return [];
  const STEPS = 12;
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    const { transform, filter } = computeKenBurns(kenBurns, t);
    return {
      transform: transform || 'none',
      filter: filter || 'none',
      offset: t
    };
  });
}
