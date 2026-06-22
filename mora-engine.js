/* Mora Engine — deterministic Urdu aruz weight engine.
 * Same input → byte-identical output, always.
 * Ported from reference/mora-engine.reference.js — do not edit the logic.
 * The LLM never touches this; it only proposes ShayriRoman transcriptions. */

const LONG_VOWEL_TOKENS  = ["aa", "ai", "au", "ee", "oo", "ii", "uu", "e", "o"];
const SHORT_VOWEL_TOKENS = ["a", "i", "u"];

function isAlpha(ch) { return /[a-z]/i.test(ch); }

function tokenize(translit) {
  const s = String(translit).toLowerCase().trim();
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (ch === "~") {
      for (let k = out.length - 1; k >= 0; k--) {
        if (out[k].t === "V") { out[k].nasal = true; break; }
      }
      i += 1;
      continue;
    }

    if (ch === " " || ch === "-" || ch === "." || ch === "_" || ch === "'") {
      if (ch === "'") out.push({ t: "C" });
      i += 1;
      continue;
    }

    let matched = false;
    for (const v of LONG_VOWEL_TOKENS) {
      if (s.startsWith(v, i)) { out.push({ t: "V", long: true, nasal: false }); i += v.length; matched = true; break; }
    }
    if (matched) continue;

    for (const v of SHORT_VOWEL_TOKENS) {
      if (s.startsWith(v, i)) { out.push({ t: "V", long: false, nasal: false }); i += v.length; matched = true; break; }
    }
    if (matched) continue;

    if (s.startsWith("chh", i)) { out.push({ t: "C" }); i += 3; continue; }
    const C_DIGRAPHS = ["bh", "ph", "th", "dh", "jh", "kh", "gh", "rh", "ch", "sh", "zh", "lh", "mh", "nh", "wh"];
    let dg = false;
    for (const d of C_DIGRAPHS) {
      if (s.startsWith(d, i)) { out.push({ t: "C" }); i += 2; dg = true; break; }
    }
    if (dg) continue;

    if (isAlpha(ch)) { out.push({ t: "C" }); i += 1; continue; }

    i += 1;
  }
  return out;
}

function syllabify(tokens) {
  const vowelIdx = [];
  tokens.forEach((t, idx) => { if (t.t === "V") vowelIdx.push(idx); });
  if (vowelIdx.length === 0) return [];

  const sylls = [];
  for (let n = 0; n < vowelIdx.length; n++) {
    const vi = vowelIdx[n];
    const vowel = tokens[vi];
    const nextVi = (n + 1 < vowelIdx.length) ? vowelIdx[n + 1] : tokens.length;
    const between = nextVi - vi - 1;
    const coda = (n + 1 < vowelIdx.length) ? Math.max(0, between - 1) : between;
    sylls.push({ long: vowel.long, nasal: vowel.nasal, coda });
  }
  return sylls;
}

function weighSyllable(syl) {
  if (!syl.long) {
    if (syl.coda === 0) return [1];
    if (syl.coda === 1) return [2];
    return [2, 1];
  } else {
    if (syl.coda === 0) return [2];
    return [2, 1];
  }
}

function scanTranslit(translit) {
  const tokens = tokenize(translit);
  const sylls = syllabify(tokens);
  const syllableOut = [];
  const pattern = [];
  for (const s of sylls) {
    const units = weighSyllable(s);
    syllableOut.push({ long: s.long, nasal: s.nasal, coda: s.coda, units, overlong: units.length > 1 });
    for (const u of units) pattern.push(u);
  }
  return {
    syllables: syllableOut,
    pattern,
    patternSL: pattern.map(u => (u === 1 ? "S" : "L")).join(" "),
    matras: pattern.reduce((a, b) => a + b, 0),
  };
}

function scanWords(entries) {
  const words = [];
  const pattern = [];
  for (const e of entries) {
    let wordPattern, wordSylls;
    if (Array.isArray(e.morae) && e.morae.length) {
      wordPattern = e.morae.slice();
      wordSylls = wordPattern.map(u => ({ long: u === 2, nasal: false, coda: 0, units: [u], overlong: false, fromOverride: true }));
    } else {
      const r = scanTranslit(e.translit || "");
      wordPattern = r.pattern;
      wordSylls = r.syllables;
    }
    words.push({
      surface:      e.surface,
      translit:     e.translit || null,
      morae:        e.morae    || null,
      source:       e.source   || null,
      confirmed:    e.confirmed || false,
      pattern:      wordPattern,
      patternSL:    wordPattern.map(u => (u === 1 ? "S" : "L")).join(" "),
      syllables:    wordSylls,
      fromOverride: Array.isArray(e.morae) && e.morae.length > 0,
    });
    for (const u of wordPattern) pattern.push(u);
  }
  return {
    words,
    pattern,
    patternSL: pattern.map(u => (u === 1 ? "S" : "L")).join(" "),
    matras:    pattern.reduce((a, b) => a + b, 0),
  };
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return dp[m][n];
}

function comparePatterns(linePattern, behrPattern) {
  const L = linePattern.slice();
  const B = behrPattern.slice();
  if (L.length === B.length) {
    let cost = 0;
    const mismatches = [];
    for (let i = 0; i < L.length; i++) {
      if (L[i] !== B[i]) {
        if (i === L.length - 1) continue;
        cost += 1;
        mismatches.push(i);
      }
    }
    return { cost, mismatches, lengthDelta: 0 };
  }
  const dist = levenshtein(L, B);
  return { cost: dist, mismatches: [], lengthDelta: L.length - B.length };
}

function matchBehr(linePattern, behrTable, topN = 3) {
  const results = behrTable.behrs.map(b => {
    const cmp = comparePatterns(linePattern, b.pattern);
    return {
      id:            b.id,
      name:          b.name,
      arkan:         b.arkan || null,
      behrPattern:   b.pattern,
      behrPatternSL: b.pattern.map(u => (u === 1 ? "S" : "L")).join(" "),
      behrMatras:    b.pattern.reduce((a, c) => a + c, 0),
      cost:          cmp.cost,
      mismatches:    cmp.mismatches,
      lengthDelta:   cmp.lengthDelta,
      exact:         cmp.cost === 0 && cmp.lengthDelta === 0,
    };
  });
  results.sort((a, b) => a.cost - b.cost || Math.abs(a.lengthDelta) - Math.abs(b.lengthDelta));
  return results.slice(0, topN);
}

const MoraEngine = { tokenize, syllabify, scanTranslit, scanWords, matchBehr, comparePatterns };
if (typeof window !== "undefined") window.MoraEngine = MoraEngine;
