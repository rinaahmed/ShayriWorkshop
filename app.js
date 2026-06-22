'use strict';

// ── Transcription prompt (sent to LLM only for unknown words) ─────────────────
const TRANSCRIPTION_SYSTEM_PROMPT = `You transcribe Urdu words into a strict phonetic scheme called ShayriRoman.
You do ONLY transcription. You never count syllables, never assign short/long, never mention meter or behr.

ShayriRoman rules:
- Long vowels: aa, ii, uu, e, o, ai, au
- Short vowels: a, i, u
- Mark a nasalized vowel (noon-ghunna) by putting ~ immediately after it, e.g. jaa~
- Write aspirated consonants as two letters: bh ph th dh jh kh gh rh chh
- Write sh, ch, zh as-is (single sounds)
- Gemination (tashdid): double the consonant, e.g. muhabbat (b doubled)
- Use consonant letters: b p t T s j ch H kh d D z r R zh sh gh f q k g l m n v h y
  (capitals T D R = retroflex; keep them but they do not change weight)
- Reflect the standard sung/recited pronunciation in classical shayari.
- If a word has two common readings, give the most standard one in "translit" and the alternative in "alt" (omit "alt" if there is only one).

Examples:
Input: ["دل","ساتھ","محبت","جاں","اٹھانا","عشق"]
Output: {"results":[{"surface":"دل","translit":"dil"},{"surface":"ساتھ","translit":"saath"},{"surface":"محبت","translit":"muhabbat"},{"surface":"جاں","translit":"jaa~"},{"surface":"اٹھانا","translit":"uthaana"},{"surface":"عشق","translit":"ishq"}]}

Return ONLY minified JSON, no prose, no code fences:
{"results":[{"surface":"<urdu word>","translit":"<shayriroman>","alt":"<optional>"}]}`;

// ── Word Lookup prompt ────────────────────────────────────────────────────────
const LOOKUP_PROMPT = `You are an expert in Urdu language and classical shayari (poetry).

When given a word or phrase, determine if it is Urdu (any script or Roman Urdu) or English, then provide comprehensive information.

Rules:
- If the input is English: find the primary Urdu equivalent and provide all information about that Urdu word
- If the input is Urdu script or Roman Urdu: provide information about that word
- All synonym and antonym words must be in Urdu script
- Return ONLY valid JSON, no markdown, no explanation outside the JSON

Return this exact JSON structure:
{
  "inputLanguage": "urdu or english",
  "word": "word in Urdu script",
  "transliteration": "Roman Urdu pronunciation",
  "meaningEn": "meaning in English",
  "meaningUr": "meaning in Urdu script",
  "synonyms": [
    {"word": "Urdu word in script", "transliteration": "roman", "meaning": "English meaning"}
  ],
  "antonyms": [
    {"word": "Urdu word in script", "transliteration": "roman", "meaning": "English meaning"}
  ],
  "poeticNote": "How this word is used in Urdu shayari, ghazals, or nazms — special poetic connotations, common imagery, or notable usage by famous poets"
}`;

// ── Behr chip patterns ────────────────────────────────────────────────────────
const BEHR_CHIP_PATTERNS = {
  'Hazaj Murabbe':     'S-L-L-L-S-L-L-L',
  'Hazaj Musaddas':    'S-L-L-L-S-L-L-L-S-L-L-L',
  'Ramal Murabbe':     'L-S-L-L-L-S-L-L',
  'Ramal Musaddas':    'L-S-L-L-L-S-L-L-L-S-L-L',
  'Mutaqarib Murabbe': 'S-L-L-S-L-L-S-L-L-S-L-L',
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── DOM references ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const urduInput     = $('urdu-input');
const targetPat     = $('target-pattern');
const checkBtn      = $('check-btn');
const resultsEl     = $('results');
const stripEl       = $('syllable-strip');
const totalMatEl    = $('total-matras');
const patternEl     = $('pattern-display');
const behrNameEl    = $('behr-name');
const behrDescEl    = $('behr-description');
const feetEl        = $('feet-analysis');
const suggEl        = $('suggestion-box');
const copyBtn       = $('copy-btn');
const settingsBtn   = $('settings-btn');
const settingsPanel = $('settings-panel');
const apiKeyInput   = $('api-key-input');
const proxyUrlInput = $('proxy-url-input');
const saveBtn       = $('save-settings');
const clearHistBtn  = $('clear-history');
const historyToggle = $('history-toggle');
const historyList   = $('history-list');
const errorMsgEl    = $('error-message');
const wordInput     = $('word-input');
const lookupBtn     = $('lookup-btn');
const lookupResultsEl = $('lookup-results');
const confirmBarEl  = $('confirm-bar');
const editPopover   = $('edit-popover');
const dictListEl    = $('dict-list');

// ── App state ─────────────────────────────────────────────────────────────────
let behrTable      = { behrs: [] };
let lastScan       = null;
let lastRawLine    = '';
let displayMode    = localStorage.getItem('displayMode') || 'simple'; // Rev A
let currentChoices = {};  // Rev C: {surface → id} for the current line

// ── Storage helper ────────────────────────────────────────────────────────────
const store = {
  get:     k => localStorage.getItem(k) || '',
  set:     (k, v) => localStorage.setItem(k, v),
  getJSON: k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
  setJSON: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ── Messages ──────────────────────────────────────────────────────────────────
function showMsg(text, type = 'error') {
  errorMsgEl.textContent = text;
  errorMsgEl.className   = `message ${type}`;
  errorMsgEl.hidden      = false;
  if (type === 'success') setTimeout(() => { errorMsgEl.hidden = true; }, 3000);
}

function hideMsg() { errorMsgEl.hidden = true; }

// ── Settings ──────────────────────────────────────────────────────────────────
function loadSettings() {
  apiKeyInput.value   = store.get('apiKey');
  proxyUrlInput.value = store.get('proxyUrl');
}

function saveSettings() {
  const key = apiKeyInput.value.trim();
  const url = proxyUrlInput.value.trim();
  if (key) store.set('apiKey',   key);
  if (url) store.set('proxyUrl', url);
  settingsPanel.hidden = true;
  showMsg('Settings saved', 'success');
}

// ── API call ──────────────────────────────────────────────────────────────────
async function callAPI(systemPrompt, userContent, maxTokens = 1024, model = 'claude-sonnet-4-6') {
  const apiKey   = store.get('apiKey');
  const proxyUrl = store.get('proxyUrl');

  if (!apiKey) {
    showMsg('Add your Claude API key in Settings ⚙️');
    settingsPanel.hidden = false;
    return null;
  }
  if (!proxyUrl) {
    showMsg('Add your Cloudflare Worker URL in Settings ⚙️');
    settingsPanel.hidden = false;
    return null;
  }

  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

function stripFences(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

// ── Normalise / tokenise ──────────────────────────────────────────────────────
function normalizeLine(raw) {
  return raw
    .normalize('NFC')
    .replace(/[ـ‌‍​﻿]/g, '')  // tatweel, ZWNJ, ZWJ, ZWSP, BOM
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeLineToWords(line) {
  return line
    .split(/[\s،؛؟۔،؟!,.;:()\[\]"']+/)
    .map(w => w.trim())
    .filter(w => w.length > 0 && /[؀-ۿ]/.test(w));
}

// ── Transcription via Worker ──────────────────────────────────────────────────
async function transcribeViaWorker(surfaces) {
  if (!surfaces.length) return [];

  const raw = await callAPI(
    TRANSCRIPTION_SYSTEM_PROMPT,
    JSON.stringify(surfaces),
    512,
    'claude-haiku-4-5-20251001'
  );
  if (!raw) return [];

  const tryParse = text => {
    try { return JSON.parse(stripFences(text)); } catch { return null; }
  };

  let parsed = tryParse(raw.content[0].text);
  if (!parsed) {
    const raw2 = await callAPI(
      TRANSCRIPTION_SYSTEM_PROMPT,
      JSON.stringify(surfaces),
      512,
      'claude-haiku-4-5-20251001'
    );
    if (raw2) parsed = tryParse(raw2.content[0].text);
  }
  return parsed ? (parsed.results || []) : [];
}

// ── Syllable strip renderer (Revision A: Simple/Detailed) ────────────────────
function renderStrip(scan, mode) {
  mode = mode || displayMode;
  stripEl.innerHTML = '';

  scan.words.forEach(word => {
    const group = document.createElement('div');
    group.className = 'syllable-word-group';
    if (word.source === 'llm' && !word.confirmed) group.classList.add('status-llm');
    else if (word.fromOverride) group.classList.add('status-override');
    else if (word.confirmed) group.classList.add('status-confirmed');
    group.dataset.surface = word.surface;

    word.syllables.forEach(syl => {
      if (syl.overlong) {
        // Revision A: ONE tile labeled "L" (simple) or "L·S" (detailed)
        const tile = document.createElement('div');
        tile.className = 'syllable-tile overlong long';
        tile.setAttribute('title', word.translit || word.surface);
        if (mode === 'detailed') {
          tile.innerHTML = `<span class="syl-urdu" dir="rtl" lang="ur">${escapeHtml(word.surface)}</span>
                            <span class="syl-marker">L<span class="syl-s-detail">·S</span></span>`;
        } else {
          tile.innerHTML = `<span class="syl-urdu" dir="rtl" lang="ur">${escapeHtml(word.surface)}</span>
                            <span class="syl-marker">L</span>`;
        }
        group.appendChild(tile);
      } else {
        syl.units.forEach(unit => {
          const tile = document.createElement('div');
          tile.className = `syllable-tile ${unit === 1 ? 'short' : 'long'}`;
          tile.setAttribute('title', word.translit || word.surface);
          tile.innerHTML = `<span class="syl-urdu" dir="rtl" lang="ur">${escapeHtml(word.surface)}</span>
                            <span class="syl-marker">${unit === 1 ? 'S' : 'L'}</span>`;
          group.appendChild(tile);
        });
      }
    });

    // Word label + edit button
    const label = document.createElement('div');
    label.className = 'syllable-word-label';
    label.innerHTML = `<span dir="rtl" lang="ur">${escapeHtml(word.surface)}</span>`;
    if (word.translit) {
      const rom = document.createElement('span');
      rom.className = 'syllable-word-roman';
      rom.textContent = word.translit;
      label.appendChild(rom);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'syllable-edit-btn';
    editBtn.setAttribute('aria-label', `Edit ${word.surface}`);
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => openEditPopover(word));
    label.appendChild(editBtn);

    group.appendChild(label);
    stripEl.appendChild(group);
  });
}

// ── Reading chooser (Revision C: disambiguation for 2+ readings) ─────────────
function showChooser(ambiguous) {
  const chooserEl = $('reading-chooser');
  if (!chooserEl) return;

  chooserEl.innerHTML = `
    <div class="chooser-header">
      <span class="chooser-title">Multiple readings — tap to choose</span>
    </div>
    <div class="chooser-list" id="chooser-list"></div>`;
  chooserEl.hidden = false;

  const listEl = $('chooser-list');

  for (const [surface, entries] of Object.entries(ambiguous)) {
    const row = document.createElement('div');
    row.className = 'chooser-word-row';

    const surfaceSpan = document.createElement('span');
    surfaceSpan.className = 'chooser-surface';
    surfaceSpan.dir  = 'rtl';
    surfaceSpan.lang = 'ur';
    surfaceSpan.textContent = surface;
    row.appendChild(surfaceSpan);

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'chooser-options';

    entries.forEach(entry => {
      const btn = document.createElement('button');
      btn.className = 'chooser-option-btn';
      if (currentChoices[surface] === entry.id) btn.classList.add('selected');

      const translit = document.createElement('span');
      translit.className = 'chooser-translit';
      translit.textContent = entry.translit || '—';
      btn.appendChild(translit);

      if (entry.meaning) {
        const meaning = document.createElement('span');
        meaning.className = 'chooser-meaning';
        meaning.textContent = entry.meaning;
        btn.appendChild(meaning);
      }

      btn.addEventListener('click', async () => {
        currentChoices[surface] = entry.id;
        chooserEl.hidden = true;
        await checkBehr();
      });

      optionsDiv.appendChild(btn);
    });

    row.appendChild(optionsDiv);
    listEl.appendChild(row);
  }
}

// ── Feet analysis renderer ────────────────────────────────────────────────────
function renderFeet(scan, topMatch) {
  feetEl.innerHTML = '<h3>Feet Analysis</h3>';
  if (!topMatch || !topMatch.behrPattern.length) {
    feetEl.innerHTML += '<p style="font-size:0.8rem;color:var(--text-muted)">No behr match</p>';
    return;
  }

  const arkan    = topMatch.arkan || '';
  const xMatch   = /x(\d+)/i.exec(arkan);
  const numFeet  = xMatch ? parseInt(xMatch[1]) : Math.min(4, topMatch.behrPattern.length);
  const footSize = Math.round(topMatch.behrPattern.length / numFeet);

  const linePattern = scan.pattern;
  const behrPattern = topMatch.behrPattern;

  for (let f = 0; f < numFeet; f++) {
    const start    = f * footSize;
    const end      = start + footSize;
    const lineFoot = linePattern.slice(start, end);
    const behrFoot = behrPattern.slice(start, end);

    let match = true;
    for (let i = 0; i < Math.max(lineFoot.length, behrFoot.length); i++) {
      const isLast = i === behrFoot.length - 1;
      if (lineFoot[i] !== behrFoot[i] && !isLast) { match = false; break; }
    }

    const el = document.createElement('div');
    el.className = `foot ${match ? 'match' : 'mismatch'}`;
    el.innerHTML = `<span class="foot-num">Foot ${f + 1}</span>` +
                   `<span class="foot-pat">${behrFoot.map(u => u === 1 ? 'S' : 'L').join('-')}</span>` +
                   `<span class="foot-got">${lineFoot.map(u => u === 1 ? 'S' : 'L').join('-') || '—'}</span>` +
                   `<span class="foot-status">${match ? '✓' : '✗'}</span>`;
    feetEl.appendChild(el);
  }
}

// ── Behr match display ────────────────────────────────────────────────────────
function renderBehrMatches(scan, matches, targetPatternArray) {
  const top = matches[0];

  behrNameEl.textContent = top ? top.name : '—';
  behrDescEl.textContent = top
    ? (top.exact
        ? 'Exact match'
        : `${top.cost === 0 ? 'Near' : top.cost + ' mora' + (top.cost > 1 ? 's' : '')} off · ${top.arkan || ''}`)
    : '';

  let matchHtml = '';
  for (let i = 1; i < matches.length; i++) {
    const m = matches[i];
    if (m.cost > 4) break;
    matchHtml += `<div class="behr-runner">
      <span class="runner-name">${escapeHtml(m.name)}</span>
      <span class="runner-cost">${m.cost === 0 ? 'near match' : m.cost + ' off'}</span>
    </div>`;
  }

  let targetHtml = '';
  if (targetPatternArray && targetPatternArray.length) {
    const cmp = MoraEngine.comparePatterns(scan.pattern, targetPatternArray);
    const targetName = Object.keys(BEHR_CHIP_PATTERNS).find(
      k => BEHR_CHIP_PATTERNS[k].replace(/-/g, ' ').replace(/S/g, '1').replace(/L/g, '2') ===
           targetPatternArray.join(' ')
    ) || 'target';
    targetHtml = `<div class="target-behr-row">
      <span class="target-label">vs ${escapeHtml(targetName)}</span>
      <span class="target-result">${cmp.cost === 0 && cmp.lengthDelta === 0 ? '✓ matches' : cmp.cost + ' positions off'}</span>
    </div>`;
  }

  suggEl.innerHTML = matchHtml + targetHtml;
  suggEl.hidden = !matchHtml && !targetHtml;
}

// ── Main display ──────────────────────────────────────────────────────────────
function displayResults(result) {
  const { scan, matches } = result;

  renderStrip(scan, displayMode);

  totalMatEl.textContent = scan.matras ?? '—';
  patternEl.textContent  = scan.patternSL ?? '—';

  const top = matches[0];

  let targetPatternArray = null;
  const targetStr = targetPat.value.trim();
  if (targetStr) {
    targetPatternArray = targetStr.split(/[-\s]+/).map(s => s.toUpperCase() === 'L' ? 2 : 1);
  }

  renderBehrMatches(scan, matches, targetPatternArray);
  renderFeet(scan, top);

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Confirmation bar ──────────────────────────────────────────────────────────
function renderConfirmationBar(pendingWords) {
  // Dedupe by surface (one entry per unique word)
  const seen    = new Set();
  const deduped = pendingWords.filter(w => {
    if (seen.has(w.surface)) return false;
    seen.add(w.surface);
    return true;
  });

  if (!deduped.length) { confirmBarEl.hidden = true; return; }

  confirmBarEl.innerHTML = `
    <div class="confirm-bar-header">
      <span class="confirm-bar-title">New words — please confirm</span>
      <button class="confirm-all-btn" id="confirm-all-btn">Confirm all</button>
    </div>
    <div class="confirm-list" id="confirm-list"></div>`;
  confirmBarEl.hidden = false;

  const listEl = $('confirm-list');

  function renderItem(w) {
    const item = document.createElement('div');
    item.className = 'confirm-item';
    item.dataset.surface = w.surface;

    item.innerHTML = `
      <span class="confirm-urdu" dir="rtl" lang="ur">${escapeHtml(w.surface)}</span>
      <input class="confirm-translit-input" type="text" value="${escapeHtml(w.translit || '')}"
             placeholder="translit" aria-label="translit for ${escapeHtml(w.surface)}" />
      <input class="confirm-meaning-input" type="text" value="${escapeHtml(w.meaning || '')}"
             placeholder="meaning (optional)" aria-label="meaning gloss" />
      <input class="confirm-morae-input" type="text" value=""
             placeholder="morae e.g. 2 1" aria-label="morae override" />
      <button class="confirm-btn">✓</button>
      <button class="skip-btn">✗</button>`;

    const translitInput = item.querySelector('.confirm-translit-input');
    const meaningInput  = item.querySelector('.confirm-meaning-input');
    const moraeInput    = item.querySelector('.confirm-morae-input');
    const confirmBtn    = item.querySelector('.confirm-btn');
    const skipBtn       = item.querySelector('.skip-btn');

    confirmBtn.addEventListener('click', async () => {
      const translit = translitInput.value.trim();
      const meaning  = meaningInput.value.trim();
      const moraeStr = moraeInput.value.trim();
      const morae    = moraeStr ? moraeStr.split(/\s+/).map(Number).filter(n => n > 0) : undefined;

      await Storage.dictPut({
        surface:   w.surface,
        translit:  translit || w.translit || '',
        meaning:   meaning || undefined,
        morae,
        source:    'user',
        confirmed: true,
      });
      await Storage.cacheClear();
      item.remove();
      if (!listEl.children.length) confirmBarEl.hidden = true;
      await checkBehr();
    });

    skipBtn.addEventListener('click', () => {
      item.remove();
      if (!listEl.children.length) confirmBarEl.hidden = true;
    });

    listEl.appendChild(item);
  }

  deduped.forEach(renderItem);

  $('confirm-all-btn').addEventListener('click', async () => {
    const items = [...listEl.querySelectorAll('.confirm-item')];
    for (const item of items) {
      const surface  = item.dataset.surface;
      const translit = item.querySelector('.confirm-translit-input').value.trim();
      const meaning  = item.querySelector('.confirm-meaning-input').value.trim();
      const moraeStr = item.querySelector('.confirm-morae-input').value.trim();
      const morae    = moraeStr ? moraeStr.split(/\s+/).map(Number).filter(n => n > 0) : undefined;
      const existing = await Storage.dictGetReadings(surface);
      const base     = existing[0] || {};
      await Storage.dictPut({
        surface,
        translit: translit || base.translit || '',
        meaning:  meaning || base.meaning || undefined,
        morae,
        source:   'user',
        confirmed: true,
      });
    }
    await Storage.cacheClear();
    confirmBarEl.hidden = true;
    await checkBehr();
  });
}

// ── Edit popover (Revision B: always editable; Revision C: meaning + aspirate hint) ──
function openEditPopover(entry) {
  const hasAspirate = /hh/.test(entry.translit || '');
  const moraeDisplay = (entry.morae || []).join(' ');
  const moraeNote = moraeDisplay
    ? `<span class="dict-morae">[${moraeDisplay}]</span> `
    : '';
  const aspirateWarn = hasAspirate
    ? `<p class="aspirate-hint">⚠ Possible doubled-h — aspirates (th/kh/gh/dh/bh/ph) are one sound, not two</p>`
    : '';

  editPopover.innerHTML = `
    <div class="popover-inner">
      <h3 class="popover-title" dir="rtl" lang="ur">${escapeHtml(entry.surface)}</h3>
      <label class="popover-label">ShayriRoman translit</label>
      <input id="ep-translit" class="popover-input" type="text" value="${escapeHtml(entry.translit || '')}" />
      ${aspirateWarn}
      <label class="popover-label">Meaning <span class="optional">(short gloss, e.g. "endured (sehna)")</span></label>
      <input id="ep-meaning" class="popover-input" type="text" value="${escapeHtml(entry.meaning || '')}" placeholder="optional gloss" />
      <label class="popover-label">Explicit morae override ${moraeNote}<span class="optional">(e.g. 2 1 — blank for auto)</span></label>
      <input id="ep-morae" class="popover-input" type="text" value="${escapeHtml(moraeDisplay)}" placeholder="e.g. 2 1" />
      <div class="popover-actions">
        <button id="ep-save">Save &amp; re-scan</button>
        <button id="ep-cancel" class="btn-secondary">Cancel</button>
      </div>
    </div>`;
  editPopover.hidden = false;

  // Live aspirate hint while typing
  const translitEl = $('ep-translit');
  translitEl.addEventListener('input', () => {
    const existing = editPopover.querySelector('.aspirate-hint');
    const has      = /hh/.test(translitEl.value);
    if (has && !existing) {
      translitEl.insertAdjacentHTML('afterend',
        `<p class="aspirate-hint">⚠ Possible doubled-h — aspirates (th/kh/gh/dh/bh/ph) are one sound</p>`);
    } else if (!has && existing) {
      existing.remove();
    }
  });

  $('ep-cancel').addEventListener('click', () => { editPopover.hidden = true; });

  $('ep-save').addEventListener('click', async () => {
    const translit = $('ep-translit').value.trim();
    const meaning  = $('ep-meaning').value.trim();
    const moraeStr = $('ep-morae').value.trim();
    const morae    = moraeStr ? moraeStr.split(/\s+/).map(Number).filter(n => n > 0) : undefined;

    await Storage.dictPut({
      ...(entry.id ? { id: entry.id } : {}),
      surface:   entry.surface,
      translit:  translit || entry.translit || '',
      meaning:   meaning || undefined,
      morae,
      source:    'user',
      confirmed: true,
    });
    await Storage.cacheClear();
    editPopover.hidden = true;
    await checkBehr();
  });
}

// ── Dictionary panel (Revision C: id-based operations + meaning display) ──────
let dictFilter = 'all';
let dictSearch = '';

async function renderDictionary() {
  if (!dictListEl) return;
  const all    = await Storage.dictAll();
  const search = dictSearch.toLowerCase();
  const entries = all.filter(e => {
    if (dictFilter === 'unconfirmed' && e.confirmed) return false;
    if (search &&
        !e.surface.includes(search) &&
        !(e.translit || '').toLowerCase().includes(search) &&
        !(e.meaning  || '').toLowerCase().includes(search)) return false;
    return true;
  });

  if (!entries.length) {
    dictListEl.innerHTML = '<p class="dict-empty">No entries found</p>';
    return;
  }

  dictListEl.innerHTML = entries.map(e => {
    const morae   = e.morae ? `<span class="dict-morae">[${e.morae.join(',')}]</span>` : '';
    const meaning = e.meaning ? `<span class="dict-meaning">${escapeHtml(e.meaning)}</span>` : '';
    const badge   = e.confirmed
      ? '<span class="dict-badge dict-badge--confirmed">confirmed</span>'
      : `<span class="dict-badge dict-badge--${e.source || 'llm'}">${e.source || 'llm'}</span>`;
    const eid = escapeHtml(e.id || '');
    return `
      <div class="dict-entry" data-id="${eid}">
        <span class="dict-surface" dir="rtl" lang="ur">${escapeHtml(e.surface)}</span>
        <span class="dict-translit">${escapeHtml(e.translit || '—')}</span>
        ${meaning}${morae}${badge}
        <div class="dict-actions">
          ${!e.confirmed ? `<button class="dict-confirm-btn" data-id="${eid}">✓</button>` : ''}
          <button class="dict-edit-btn"   data-id="${eid}">✎</button>
          <button class="dict-delete-btn" data-id="${eid}" data-surface="${escapeHtml(e.surface)}">✕</button>
        </div>
      </div>`;
  }).join('');

  dictListEl.querySelectorAll('.dict-confirm-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const e = await Storage.dictGetById(btn.dataset.id);
      if (e) { await Storage.dictPut({ ...e, confirmed: true }); await Storage.cacheClear(); }
      renderDictionary();
    });
  });

  dictListEl.querySelectorAll('.dict-edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const e = await Storage.dictGetById(btn.dataset.id);
      if (e) openEditPopover(e);
    });
  });

  dictListEl.querySelectorAll('.dict-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const surface = btn.dataset.surface;
      if (!confirm(`Delete "${surface}" from dictionary?`)) return;
      await Storage.dictDelete(btn.dataset.id);
      await Storage.cacheClear();
      renderDictionary();
    });
  });
}

// ── History ───────────────────────────────────────────────────────────────────
function saveHistory(line, result) {
  const h = store.getJSON('history');
  h.unshift({
    line,
    matras:  result.scan?.matras,
    pattern: result.scan?.patternSL,
    behr:    result.matches?.[0]?.name,
    ts:      Date.now(),
  });
  if (h.length > 10) h.pop();
  store.setJSON('history', h);
}

function renderHistory() {
  const h = store.getJSON('history');
  historyList.innerHTML = '';

  if (!h.length) {
    historyList.innerHTML = '<p class="no-history">No history yet</p>';
    return;
  }

  h.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.innerHTML =
      `<span class="hist-line" dir="rtl" lang="ur">${item.line}</span>` +
      `<span class="hist-meta">${item.matras ?? '?'} matras &middot; ${item.behr ?? ''}</span>`;

    const load = () => {
      urduInput.value    = item.line;
      historyList.hidden = true;
      historyToggle.querySelector('.toggle-arrow').textContent = '▸';
      urduInput.focus();
    };
    el.addEventListener('click', load);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') load(); });
    historyList.appendChild(el);
  });
}

// ── Main behr check flow (Revision C: 0/1/2+ readings) ───────────────────────
async function checkBehr() {
  const rawLine = urduInput.value.trim();
  if (!rawLine) { showMsg('Please enter a line of shayari'); return; }

  const line = normalizeLine(rawLine);

  // Reset per-line choices when a new line is entered
  if (line !== normalizeLine(lastRawLine)) currentChoices = {};
  lastRawLine = rawLine;

  hideMsg();
  checkBtn.disabled    = true;
  checkBtn.textContent = 'Analysing…';
  resultsEl.hidden     = true;
  confirmBarEl.hidden  = true;

  const chooserEl = $('reading-chooser');
  if (chooserEl) chooserEl.hidden = true;

  try {
    // Cache hit (only when no pending chooser decision)
    if (!Object.keys(currentChoices).length) {
      const cached = await Storage.cacheGet(line);
      if (cached) {
        // Restore any stored choices from cache
        if (cached.choices) Object.assign(currentChoices, cached.choices);
        displayResults(cached);
        saveHistory(line, cached);
        renderHistory();
        return;
      }
    }

    const rawSurfaces = tokenizeLineToWords(line);
    if (!rawSurfaces.length) { showMsg('Could not find any Urdu words in the input'); return; }
    const surfaces = [...new Set(rawSurfaces)]; // dedupe for lookup

    const { reads, misses } = await Storage.dictGetManyReadings(surfaces);

    const entryMap       = {}; // surface → entry to use
    const ambiguousWords = {}; // surface → [entries] — user must choose
    const pending        = []; // newly transcribed, unconfirmed

    // Process known words
    for (const [surface, entries] of Object.entries(reads)) {
      if (entries.length === 1) {
        entryMap[surface] = entries[0];
      } else {
        // 2+ readings: check if user has chosen one for this line
        const chosenId = currentChoices[surface];
        const chosen   = chosenId ? entries.find(e => e.id === chosenId) : null;
        if (chosen) {
          entryMap[surface] = chosen;
        } else {
          ambiguousWords[surface] = entries;
          entryMap[surface] = entries[0]; // provisional default for scan
        }
      }
    }

    // Transcribe unknown words (one batched API call)
    const toTranscribe = misses.filter(s => !entryMap[s]);
    if (toTranscribe.length) {
      checkBtn.textContent = `Transcribing ${toTranscribe.length} new word${toTranscribe.length > 1 ? 's' : ''}…`;
      const proposals = await transcribeViaWorker(toTranscribe);

      for (const p of proposals) {
        if (!p.translit) continue;
        const entry = {
          surface:   p.surface,
          translit:  p.translit,
          note:      p.alt ? 'alt: ' + p.alt : '',
          source:    'llm',
          confirmed: false,
        };
        await Storage.dictPut(entry);
        entryMap[p.surface] = entry;
        pending.push(entry);
      }

      // Words LLM failed to transcribe
      toTranscribe.forEach(s => {
        if (!entryMap[s]) {
          entryMap[s] = { surface: s, translit: s, source: 'llm', confirmed: false };
          pending.push(entryMap[s]);
        }
      });
    }

    // Scan uses the original order (with duplicates preserved)
    const entries = rawSurfaces.map(s => entryMap[s] || { surface: s, translit: s });
    const scan    = MoraEngine.scanWords(entries);
    const matches = MoraEngine.matchBehr(scan.pattern, behrTable, 3);

    const result = { line, scan, matches, choices: { ...currentChoices } };

    // Only cache when there are no unresolved ambiguous words
    if (!Object.keys(ambiguousWords).length) {
      await Storage.cachePut(line, result);
    }

    lastScan = result;
    displayResults(result);
    saveHistory(line, result);
    renderHistory();

    if (Object.keys(ambiguousWords).length) showChooser(ambiguousWords);
    if (pending.length) renderConfirmationBar(pending);

  } catch (err) {
    showMsg('Analysis failed — check your API key or proxy URL and try again');
    console.error('[Shayari Workshop]', err);
  } finally {
    checkBtn.disabled    = false;
    checkBtn.textContent = 'Check Behr';
  }
}

// ── Word Lookup ───────────────────────────────────────────────────────────────
function renderLookupResults(r) {
  const badge = r.inputLanguage === 'english' ? 'English → Urdu' : 'Urdu';

  const wordList = items => (items || []).map(s => `
    <div class="lookup-word-item">
      <span class="lookup-item-urdu" dir="rtl" lang="ur">${escapeHtml(s.word)}</span>
      <span class="lookup-item-roman">${escapeHtml(s.transliteration)}</span>
      <span class="lookup-item-meaning">${escapeHtml(s.meaning)}</span>
    </div>`).join('');

  const synonymsHtml = r.synonyms?.length ? `
    <div class="lookup-group">
      <h3 class="lookup-group-title">Synonyms · مترادفات</h3>
      <div class="lookup-word-list">${wordList(r.synonyms)}</div>
    </div>` : '';

  const antonymsHtml = r.antonyms?.length ? `
    <div class="lookup-group">
      <h3 class="lookup-group-title">Antonyms · متضادات</h3>
      <div class="lookup-word-list">${wordList(r.antonyms)}</div>
    </div>` : '';

  const poeticHtml = r.poeticNote ? `
    <div class="lookup-poetic-note">
      <h3 class="lookup-group-title">Poetic Use · شعری استعمال</h3>
      <p>${escapeHtml(r.poeticNote)}</p>
    </div>` : '';

  lookupResultsEl.innerHTML = `
    <div class="lookup-word-header">
      <span class="lookup-word-urdu" dir="rtl" lang="ur">${escapeHtml(r.word)}</span>
      <span class="lookup-word-roman">${escapeHtml(r.transliteration)}</span>
      <span class="lookup-badge">${escapeHtml(badge)}</span>
    </div>
    <div class="lookup-meanings">
      <div class="lookup-meaning-en">${escapeHtml(r.meaningEn)}</div>
      <div class="lookup-meaning-ur" dir="rtl" lang="ur">${escapeHtml(r.meaningUr)}</div>
    </div>
    ${synonymsHtml}${antonymsHtml}${poeticHtml}`;

  lookupResultsEl.hidden = false;
  lookupResultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function lookupWord() {
  const word = wordInput.value.trim();
  if (!word) { showMsg('Please enter a word to look up'); return; }

  hideMsg();
  lookupBtn.disabled     = true;
  lookupBtn.textContent  = 'Looking up…';
  lookupResultsEl.hidden = true;

  try {
    const raw = await callAPI(LOOKUP_PROMPT, word, 1024);
    if (!raw) return;

    let result;
    try {
      result = JSON.parse(stripFences(raw.content[0].text));
    } catch {
      showMsg('Could not parse the response — please try again');
      return;
    }
    renderLookupResults(result);
  } catch (err) {
    showMsg('Look up failed — check your API key or proxy URL and try again');
    console.error('[Shayari Workshop]', err);
  } finally {
    lookupBtn.disabled    = false;
    lookupBtn.textContent = 'Look Up';
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = true; });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    $(tab.dataset.panel).hidden = false;
    hideMsg();

    if (tab.dataset.panel === 'panel-dict') renderDictionary();
  });
});

// Word input direction detection
wordInput.addEventListener('input', () => {
  const hasUrdu = /[؀-ۿ]/.test(wordInput.value);
  wordInput.dir  = hasUrdu ? 'rtl' : 'ltr';
  wordInput.lang = hasUrdu ? 'ur' : 'en';
  wordInput.classList.toggle('urdu-mode', hasUrdu);
});

lookupBtn.addEventListener('click', lookupWord);
wordInput.addEventListener('keydown', e => { if (e.key === 'Enter') lookupWord(); });

// Pattern chips
document.querySelectorAll('.pattern-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const isSelected = chip.classList.contains('selected');
    document.querySelectorAll('.pattern-chip').forEach(c => c.classList.remove('selected'));
    if (isSelected) {
      targetPat.value = '';
    } else {
      chip.classList.add('selected');
      targetPat.value = chip.dataset.pattern;
    }
  });
});

targetPat.addEventListener('input', () => {
  document.querySelectorAll('.pattern-chip').forEach(c => c.classList.remove('selected'));
});

checkBtn.addEventListener('click', checkBehr);

urduInput.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') checkBehr();
});

copyBtn.addEventListener('click', () => {
  const pat = patternEl.textContent;
  if (!pat || pat === '—') return;
  navigator.clipboard.writeText(pat).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Pattern'; }, 2000);
  }).catch(() => showMsg('Copy failed — please select and copy manually'));
});

settingsBtn.addEventListener('click', e => {
  e.stopPropagation();
  settingsPanel.hidden = !settingsPanel.hidden;
});

document.addEventListener('click', e => {
  if (!settingsPanel.hidden &&
      !settingsPanel.contains(e.target) &&
      e.target !== settingsBtn) {
    settingsPanel.hidden = true;
  }
  if (editPopover && !editPopover.hidden &&
      !editPopover.contains(e.target) &&
      !e.target.classList.contains('syllable-edit-btn') &&
      !e.target.classList.contains('dict-edit-btn')) {
    editPopover.hidden = true;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!settingsPanel.hidden) settingsPanel.hidden = true;
    if (editPopover && !editPopover.hidden) editPopover.hidden = true;
  }
});

saveBtn.addEventListener('click', saveSettings);

clearHistBtn.addEventListener('click', () => {
  localStorage.removeItem('history');
  renderHistory();
  showMsg('History cleared', 'success');
});

historyToggle.addEventListener('click', () => {
  const arrow = historyToggle.querySelector('.toggle-arrow');
  historyList.hidden = !historyList.hidden;
  arrow.textContent  = historyList.hidden ? '▸' : '▾';
  if (!historyList.hidden) renderHistory();
});

// Revision A: Simple / Detailed display mode toggle
const displayModeToggle = $('display-mode-toggle');
const displayModeLabel  = $('display-mode-label');

function updateDisplayModeUI() {
  if (!displayModeLabel) return;
  displayModeLabel.textContent = displayMode === 'simple' ? 'Simple' : 'Detailed';
  if (displayModeToggle) displayModeToggle.title = displayMode === 'simple'
    ? 'Switch to Detailed (shows over-long morae split)'
    : 'Switch to Simple (over-long shows as single L)';
}

if (displayModeToggle) {
  updateDisplayModeUI();
  displayModeToggle.addEventListener('click', () => {
    displayMode = displayMode === 'simple' ? 'detailed' : 'simple';
    localStorage.setItem('displayMode', displayMode);
    updateDisplayModeUI();
    if (lastScan) renderStrip(lastScan.scan, displayMode);
  });
}

// Dictionary controls
const dictSearchInput  = $('dict-search');
const dictFilterAll    = $('dict-filter-all');
const dictFilterUnconf = $('dict-filter-unconf');
const dictExportBtn    = $('dict-export-btn');
const dictImportBtn    = $('dict-import-btn');
const dictImportFile   = $('dict-import-file');

if (dictSearchInput) {
  dictSearchInput.addEventListener('input', () => {
    dictSearch = dictSearchInput.value;
    renderDictionary();
  });
}
if (dictFilterAll) {
  dictFilterAll.addEventListener('click', () => {
    dictFilter = 'all';
    dictFilterAll.classList.add('active');
    dictFilterUnconf?.classList.remove('active');
    renderDictionary();
  });
}
if (dictFilterUnconf) {
  dictFilterUnconf.addEventListener('click', () => {
    dictFilter = 'unconfirmed';
    dictFilterUnconf.classList.add('active');
    dictFilterAll?.classList.remove('active');
    renderDictionary();
  });
}
if (dictExportBtn) {
  dictExportBtn.addEventListener('click', async () => {
    const data = await Storage.dictExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `shayari-dictionary-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
if (dictImportBtn && dictImportFile) {
  dictImportBtn.addEventListener('click', () => dictImportFile.click());
  dictImportFile.addEventListener('change', async () => {
    const file = dictImportFile.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      await Storage.dictImport(json);
      await Storage.cacheClear();
      showMsg(`Imported ${json.entries?.length ?? 0} entries`, 'success');
      renderDictionary();
    } catch {
      showMsg('Import failed — check the file format');
    }
    dictImportFile.value = '';
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (window.location.hostname.includes('staging')) {
  document.body.classList.add('env-staging');
}

loadSettings();
renderHistory();

async function init() {
  try {
    const [behrRes, seedRes] = await Promise.all([
      fetch('data/behr-table.json'),
      fetch('data/seed-dictionary.json'),
    ]);
    behrTable = await behrRes.json();
    const seed = await seedRes.json();
    await Storage.dictSeed(seed);
  } catch (err) {
    console.warn('[Shayari Workshop] Could not load behr table or seed:', err);
  }
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
