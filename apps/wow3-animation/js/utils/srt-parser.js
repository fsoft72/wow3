/**
 * Parses an SRT subtitle string into an array of cue objects.
 * @param {string} srtText - Raw SRT file content
 * @returns {Array<{index: number, startMs: number, endMs: number, text: string}>}
 */
export function parseSRT(srtText) {
  const cues = [];
  const blocks = srtText.trim().replace(/\r\n/g, '\n').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    const timeParts = lines[1].split('-->');
    if (timeParts.length !== 2) continue;

    const startMs = _parseTimestamp(timeParts[0].trim());
    const endMs = _parseTimestamp(timeParts[1].trim());
    if (startMs === null || endMs === null) continue;

    const text = lines.slice(2).join('\n').trim();
    cues.push({ index, startMs, endMs, text });
  }

  return cues;
}

/**
 * Parse SRT timestamp "hh:mm:ss,fff" to milliseconds.
 * @param {string} ts
 * @returns {number|null}
 */
function _parseTimestamp(ts) {
  const m = ts.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) return null;
  return parseInt(m[1]) * 3600000 + parseInt(m[2]) * 60000 + parseInt(m[3]) * 1000 + parseInt(m[4]);
}

/**
 * Find the active cue index at a given time using binary search.
 * @param {Array<{startMs: number, endMs: number}>} cues - Sorted cues
 * @param {number} timeMs
 * @returns {number} Index of active cue, or -1 if none
 */
export function findActiveCue(cues, timeMs) {
  let lo = 0, hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeMs < cues[mid].startMs) hi = mid - 1;
    else if (timeMs >= cues[mid].endMs) lo = mid + 1;
    else return mid;
  }
  return -1;
}
