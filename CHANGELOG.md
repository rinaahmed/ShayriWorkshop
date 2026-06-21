# Changelog

All notable changes to Shayari Workshop are tracked here.

---

## [Unreleased]

---

## [0.3.0] — 2026-06-21

### Changed
- Target pattern field now shows clickable chips for all 5 built-in behr patterns (Hazaj Murabbe, Hazaj Musaddas, Ramal Murabbe, Ramal Musaddas, Mutaqarib)
- Tapping a chip fills the pattern input and highlights the selection in gold
- Tapping the same chip again clears the selection
- Typing in the free-text field deselects any active chip
- Free-text entry still supported for custom patterns

---

## [0.2.0] — 2026-06-21

### Fixed
- Nastaliq glyphs no longer clipped at the right edge of the textarea — added `padding-right: 0.75rem` to give RTL text breathing room
- Textarea height reduced (rows 4 → 3, min-height 110px → 80px) for a less imposing input area
- Urdu font size reduced (1.8rem → 1.3rem) and placeholder scaled to match

---

## [0.1.0] — 2026-06-21

### Added
- Initial MVP: Shayari Workshop Behr Checker
- RTL Urdu textarea with Noto Nastaliq Urdu font
- Claude API integration via Cloudflare Worker CORS proxy
- Syllable tile strip — each syllable shown as a coloured tile (rose = Short, teal = Long)
- Problem syllables highlighted with red border and enlarged
- Summary row: total matras, pattern string, closest behr name
- Feet analysis with per-foot match/mismatch indicators (✓ / ✗)
- Gold-bordered suggestion box with plain English fix advice
- Optional target behr pattern input for manual pattern matching
- Behr patterns recognised: Hazaj Murabbe, Hazaj Musaddas, Ramal Murabbe, Ramal Musaddas, Mutaqarib Murabbe
- Settings panel (gear icon): Claude API key + Cloudflare Worker URL, both stored in localStorage only
- History: last 10 lines checked, tap to reload into input
- Copy pattern button
- PWA: manifest.json + service worker for offline shell
- Installable on iPhone home screen
- GitHub Pages deploy with `.nojekyll`
- README with step-by-step setup for Cloudflare Worker, Claude API key, and GitHub Pages
