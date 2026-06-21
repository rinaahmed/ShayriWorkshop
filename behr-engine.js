'use strict';

// Recomputes totalMatras and pattern from a syllable array returned by Claude.
// Claude is trusted for syllabification; arithmetic is always recomputed here
// so a Claude miscounting error can never affect the displayed totals.
function computePattern(syllables) {
  const totalMatras = syllables.reduce((sum, s) => sum + (Number(s.matras) || 1), 0);
  const pattern     = syllables.map(s => s.type === 'L' ? 'L' : 'S').join('-');
  return { totalMatras, pattern };
}
