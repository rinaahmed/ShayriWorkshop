'use strict';

// ── Unicode ranges ────────────────────────────────────────────────────────────

const URDU_CONSONANTS = new Set([
  'ب','پ','ت','ٹ','ث','ج','چ','ح',
  'خ','د','ڈ','ذ','ر','ڑ','ز','ژ',
  'س','ش','ص','ض','ط','ظ','ع','غ',
  'ف','ق','ک','گ','ل','م','ن','ں',
  'و','ہ','ھ','ی','ے','ء','ؤ','ئ',
]);

// ا و ی ے آ — long vowel letters
const LONG_VOWEL_LETTERS = new Set(['ا','و','ی','ے','آ']);

// ◌َ ◌ِ ◌ُ — short vowel diacritics (zabar, zer, pesh)
const SHORT_MARKS = new Set(['َ','ِ','ُ']);

// ◌ْ — sukun (explicit no-vowel)
const SUKUN = 'ْ';

// ◌ّ — shadda (consonant doubling)
const SHADDA = 'ّ';

// Noon ghunna
const NOON_GHUNNA = 'ں';

// Zero-width non-joiner / zero-width joiner — skip
const ZW = new Set(['‌', '‍', '​', '﻿']);

// ── Tokeniser ─────────────────────────────────────────────────────────────────

// Returns array of Urdu words from a line, stripping punctuation & spaces.
function tokeniseWords(line) {
  // Split on whitespace and punctuation that isn't part of Urdu script
  return line
    .split(/[\s،؛؟۔،؟!,.;:()\[\]"']+/)
    .map(w => w.replace(/[؀-؅؉؊،؛؟۔]/g, '').trim())
    .filter(w => w.length > 0 && /[؀-ۿ]/.test(w));
}

// ── Syllabifier ───────────────────────────────────────────────────────────────

// Given a single Urdu word, return an array of syllable strings.
// Strategy: each syllable = onset consonant(s) + nucleus vowel + optional coda.
function syllabifyWord(word) {
  // Expand chars — skip zero-width joiners
  const chars = [...word].filter(c => !ZW.has(c));
  const syllables = [];
  let current = '';
  let i = 0;

  while (i < chars.length) {
    const c = chars[i];

    if (LONG_VOWEL_LETTERS.has(c)) {
      // Word-initial bare alif is a vowel carrier — attach to current or start new
      current += c;
      i++;
      // Peek: if next char is a consonant or end, close syllable
      syllables.push(current);
      current = '';
    } else if (URDU_CONSONANTS.has(c)) {
      const next = chars[i + 1];
      const nextnext = chars[i + 2];

      if (SHORT_MARKS.has(next)) {
        // Consonant + short vowel mark → open syllable
        current += c + next;
        i += 2;
        // Check for coda consonant (closed syllable)
        const afterMark = chars[i];
        if (afterMark && URDU_CONSONANTS.has(afterMark) &&
            !SHORT_MARKS.has(chars[i + 1]) && !LONG_VOWEL_LETTERS.has(chars[i + 1]) &&
            chars[i + 1] !== undefined && URDU_CONSONANTS.has(chars[i + 1])) {
          // Two consonants follow — coda is first one
          current += afterMark;
          i++;
        }
        syllables.push(current);
        current = '';
      } else if (next === SUKUN) {
        // Consonant + sukun → coda of previous syllable or isolated CVC
        if (current.length) {
          current += c + SUKUN;
          syllables.push(current);
          current = '';
        } else {
          current += c + SUKUN;
        }
        i += 2;
      } else if (next === SHADDA) {
        // Shadda: current consonant doubles — ends previous, starts next
        if (current.length) { syllables.push(current); current = ''; }
        current += c + SHADDA;
        i += 2;
      } else if (LONG_VOWEL_LETTERS.has(next)) {
        // Consonant + long vowel letter → CV̄ syllable
        current += c + next;
        i += 2;
        syllables.push(current);
        current = '';
      } else if (!next || !URDU_CONSONANTS.has(next) && !SHORT_MARKS.has(next) && !LONG_VOWEL_LETTERS.has(next)) {
        // Bare consonant at end or before boundary
        current += c;
        i++;
        syllables.push(current);
        current = '';
      } else {
        // Two or more consonants: keep going (cluster onset)
        current += c;
        i++;
      }
    } else {
      // Diacritic or other — attach to current
      current += c;
      i++;
    }
  }

  if (current.length) syllables.push(current);

  // Filter empty strings
  return syllables.filter(s => s.length > 0);
}

// ── Weight each syllable ──────────────────────────────────────────────────────

function hasLongVowel(syll) {
  return [...syll].some(c => LONG_VOWEL_LETTERS.has(c));
}

function isClosed(syll) {
  // Closed = ends in a consonant (optionally followed by sukun/shadda diacritics)
  const clean = [...syll].filter(c => !ZW.has(c));
  if (!clean.length) return false;
  const last = clean[clean.length - 1];
  // Sukun or shadda at end = consonant cluster = closed
  if (last === SUKUN || last === SHADDA) return true;
  // Noon ghunna at end = Long (nasalised end)
  if (last === NOON_GHUNNA) return true;
  if (URDU_CONSONANTS.has(last)) return true;
  return false;
}

function isWordFinalYe(syll, isWordFinal) {
  // Choti ye (ے ے) at word end = Short by elision convention
  if (!isWordFinal) return false;
  const last = [...syll].filter(c => !ZW.has(c)).pop();
  return last === 'ے'; // ے
}

// Returns: { type: 'S'|'L', matras: 1|2, uncertain: bool }
function weighSyllable(syll, isWordFinal) {
  if (isWordFinalYe(syll, isWordFinal)) {
    return { type: 'S', matras: 1, uncertain: false };
  }
  if (hasLongVowel(syll) || isClosed(syll)) {
    return { type: 'L', matras: 2, uncertain: false };
  }

  // Ambiguous: bare consonant without explicit vowel mark — Claude decides
  const hasAnyVowelMarker = [...syll].some(c => SHORT_MARKS.has(c) || LONG_VOWEL_LETTERS.has(c));
  if (!hasAnyVowelMarker) {
    return { type: 'S', matras: 1, uncertain: true };
  }

  // Short vowel mark → Short
  return { type: 'S', matras: 1, uncertain: false };
}

// ── Public API ────────────────────────────────────────────────────────────────

// scanLine returns array of syllable objects:
// { urdu, roman: null, type: 'S'|'L', matras: 1|2, uncertain: bool }
function scanLine(line) {
  const words = tokeniseWords(line);
  const result = [];

  for (const word of words) {
    const sylls = syllabifyWord(word);
    sylls.forEach((s, idx) => {
      const isLast = idx === sylls.length - 1;
      const weight = weighSyllable(s, isLast);
      result.push({
        urdu:      s,
        roman:     null,
        type:      weight.type,
        matras:    weight.matras,
        uncertain: weight.uncertain,
      });
    });
  }

  return result;
}

// Recompute totalMatras and pattern string from a syllable array.
function computePattern(syllables) {
  const totalMatras = syllables.reduce((sum, s) => sum + s.matras, 0);
  const pattern     = syllables.map(s => s.type).join('-');
  return { totalMatras, pattern };
}
