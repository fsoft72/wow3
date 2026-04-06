/**
 * Formats milliseconds as hh:mm:ss.fff
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const frac = String(Math.floor(ms % 1000)).padStart(3, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${frac}`;
}

/**
 * Parse "hh:mm:ss.fff" or "mm:ss.fff" or "ss.fff" or "ss" to ms.
 * @param {string} str
 * @returns {number|null}
 */
export function parseTime(str) {
  const parts = str.split(':');
  let totalS = 0;
  if (parts.length === 3) {
    totalS = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    totalS = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    totalS = parseFloat(parts[0]);
  }
  if (isNaN(totalS)) return null;
  return Math.round(totalS * 1000);
}
