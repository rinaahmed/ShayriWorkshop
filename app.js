'use strict';

const BEHR_PATTERNS = {
  'Hazaj Murabbe':     'S-L-L-L-S-L-L-L',
  'Hazaj Musaddas':    'S-L-L-L-S-L-L-L-S-L-L-L',
  'Ramal Murabbe':     'L-S-L-L-L-S-L-L',
  'Ramal Musaddas':    'L-S-L-L-L-S-L-L-L-S-L-L',
  'Mutaqarib Murabbe': 'S-L-L-S-L-L-S-L-L-S-L-L',
};

const SYSTEM_PROMPT = `You are an expert in Urdu aruz (classical meter). Your job is to analyze a line of Urdu shayari.

Rules you must follow:
- Every syllable is either Short (S, 1 matra) or Long (L, 2 matras)
- Golden Rule: any syllable ending in a consonant is Long (closed syllable)
- Long vowels (آ، او، ای) always make a syllable Long
- Choti ye (ے) at end of syllable = Short
- Bari ye (ی) = Long
- Noon ghunna (ں) at end = makes syllable Long
- uthaana / uthaake / uthaaye = S-L-S always (standard for this user)
- The radif (repeating refrain at end of ghazal lines) should be identified and excluded from meter analysis
- Return ONLY valid JSON, no markdown, no explanation outside the JSON

Return this exact JSON structure:
{
  "syllables": [
    {"urdu": "syllable in Urdu script", "roman": "romanized", "type": "S or L", "matras": 1}
  ],
  "totalMatras": 14,
  "pattern": "S-L-L-L-S-L-L-L",
  "closestBehr": "Hazaj Musaddas | Hazaj Murabbe | Ramal Murabbe | Ramal Musaddas | Mutaqarib Murabbe | unclear",
  "behrDescription": "one line description of the behr",
  "feetAnalysis": [
    {"foot": 1, "pattern": "S-L-L-L", "match": true}
  ],
  "problemSyllables": [2, 5],
  "suggestion": "plain English one-line suggestion about what word to fix and why"
}`;

// DOM references
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

// ── Storage ──────────────────────────────────────────────────────────────────

const store = {
  get:     k => localStorage.getItem(k) || '',
  set:     (k, v) => localStorage.setItem(k, v),
  getJSON: k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
  setJSON: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ── Messages ─────────────────────────────────────────────────────────────────

function showMsg(text, type = 'error') {
  errorMsgEl.textContent = text;
  errorMsgEl.className   = `message ${type}`;
  errorMsgEl.hidden      = false;
  if (type === 'success') setTimeout(() => { errorMsgEl.hidden = true; }, 3000);
}

function hideMsg() {
  errorMsgEl.hidden = true;
}

// ── Settings ─────────────────────────────────────────────────────────────────

function loadSettings() {
  apiKeyInput.value   = store.get('apiKey');
  proxyUrlInput.value = store.get('proxyUrl');
}

function saveSettings() {
  const key = apiKeyInput.value.trim();
  const url = proxyUrlInput.value.trim();

  if (key)  store.set('apiKey',   key);
  if (url)  store.set('proxyUrl', url);

  settingsPanel.hidden = true;
  showMsg('Settings saved', 'success');
}

// ── API call ─────────────────────────────────────────────────────────────────

async function callClaude(urduLine, targetBehr) {
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

  const userContent = [
    'Analyze this line of Urdu shayari:',
    '',
    urduLine,
    '',
    `Target behr pattern (leave blank for auto-detect): ${targetBehr || ''}`,
  ].join('\n');

  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json();
}

// ── Response parsing ──────────────────────────────────────────────────────────

function parseResult(data) {
  let text = data.content[0].text.trim();
  // Strip markdown code fences if Claude added them
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(text);
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderStrip(syllables, problemSet) {
  stripEl.innerHTML = '';

  syllables.forEach((syl, i) => {
    const tile = document.createElement('div');
    tile.className = `syllable-tile ${syl.type === 'S' ? 'short' : 'long'}${problemSet.has(i) ? ' problem' : ''}`;
    tile.setAttribute('title', syl.roman || '');
    tile.setAttribute('aria-label', `${syl.roman || syl.urdu}: ${syl.type === 'S' ? 'Short' : 'Long'}`);

    const urduSpan   = document.createElement('span');
    urduSpan.className = 'syl-urdu';
    urduSpan.dir       = 'rtl';
    urduSpan.lang      = 'ur';
    urduSpan.textContent = syl.urdu;

    const markerSpan   = document.createElement('span');
    markerSpan.className = 'syl-marker';
    markerSpan.textContent = syl.type;

    tile.appendChild(urduSpan);
    tile.appendChild(markerSpan);
    stripEl.appendChild(tile);
  });
}

function renderFeet(feet) {
  feetEl.innerHTML = '<h3>Feet Analysis</h3>';
  if (!feet || !feet.length) { feetEl.innerHTML += '<p style="font-size:0.8rem;color:var(--text-muted)">No feet data</p>'; return; }

  feet.forEach(f => {
    const el = document.createElement('div');
    el.className = `foot ${f.match ? 'match' : 'mismatch'}`;

    el.innerHTML = `<span class="foot-num">Foot ${f.foot}</span>` +
                   `<span class="foot-pat">${f.pattern}</span>` +
                   `<span class="foot-status">${f.match ? '✓' : '✗'}</span>`;

    feetEl.appendChild(el);
  });
}

function displayResults(result) {
  const problemSet = new Set((result.problemSyllables || []).map(Number));

  renderStrip(result.syllables || [], problemSet);

  totalMatEl.textContent = result.totalMatras ?? '—';
  patternEl.textContent  = result.pattern     ?? '—';
  behrNameEl.textContent = result.closestBehr ?? '—';
  behrDescEl.textContent = result.behrDescription || '';

  renderFeet(result.feetAnalysis);

  if (result.suggestion) {
    suggEl.innerHTML = `<p>${result.suggestion}</p>`;
    suggEl.hidden    = false;
  } else {
    suggEl.hidden = true;
  }

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── History ───────────────────────────────────────────────────────────────────

function saveHistory(line, result) {
  const h = store.getJSON('history');
  h.unshift({
    line,
    matras:  result.totalMatras,
    pattern: result.pattern,
    behr:    result.closestBehr,
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
      urduInput.value       = item.line;
      historyList.hidden    = true;
      historyToggle.querySelector('.toggle-arrow').textContent = '▸';
      urduInput.focus();
    };

    el.addEventListener('click', load);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') load(); });
    historyList.appendChild(el);
  });
}

// ── Main check flow ───────────────────────────────────────────────────────────

async function checkBehr() {
  const line = urduInput.value.trim();
  if (!line) { showMsg('Please enter a line of shayari'); return; }

  hideMsg();
  checkBtn.disabled    = true;
  checkBtn.textContent = 'Analysing…';
  resultsEl.hidden     = true;

  try {
    const raw = await callClaude(line, targetPat.value.trim());
    if (!raw) return;

    let result;
    try {
      result = parseResult(raw);
    } catch {
      // Retry once on JSON parse failure
      showMsg('Retrying…', 'success');
      const raw2 = await callClaude(line, targetPat.value.trim());
      try {
        result = parseResult(raw2);
        hideMsg();
      } catch {
        showMsg('Could not parse the response — please try again');
        return;
      }
    }

    displayResults(result);
    saveHistory(line, result);
    renderHistory();

  } catch (err) {
    showMsg('Analysis failed — check your API key or proxy URL and try again');
    console.error('[Shayari Workshop]', err);
  } finally {
    checkBtn.disabled    = false;
    checkBtn.textContent = 'Check Behr';
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

checkBtn.addEventListener('click', checkBehr);

// Ctrl/Cmd + Enter to submit
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

// Close settings when clicking outside
document.addEventListener('click', e => {
  if (!settingsPanel.hidden &&
      !settingsPanel.contains(e.target) &&
      e.target !== settingsBtn) {
    settingsPanel.hidden = true;
  }
});

// Close settings on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !settingsPanel.hidden) settingsPanel.hidden = true;
});

saveBtn.addEventListener('click', saveSettings);

clearHistBtn.addEventListener('click', () => {
  localStorage.removeItem('history');
  renderHistory();
  showMsg('History cleared', 'success');
});

historyToggle.addEventListener('click', () => {
  const arrow       = historyToggle.querySelector('.toggle-arrow');
  historyList.hidden = !historyList.hidden;
  arrow.textContent  = historyList.hidden ? '▸' : '▾';
  if (!historyList.hidden) renderHistory();
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadSettings();
renderHistory();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
