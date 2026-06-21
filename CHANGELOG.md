# Changelog

All notable changes to Shayari Workshop are tracked here.

---

## [Unreleased]

---

## [0.6.0] — 2026-06-21

### Changed
- Design overhaul to match handoff specification
- Color palette refined: header `#4D1209`, page bg `#EDE8DF`, gold `#C8922A`, crimson CTA `#8B2820`
- Header diagonal stripe texture added (repeating 135° linear gradient)
- Header subtitle changed from uppercase sans to Playfair Display Italic 13px, color `#C4A882`
- Logo updated to outline-only rotated square (no fill, no centre dot)
- Pattern chip selected state changed to dark charcoal fill (`#1C1A18` bg, white text)
- Custom pattern input border updated to 1.5px `#D8CEC0`, radius 10px, focus highlight uses crimson
- Check Behr button border-radius increased to 13px
- Added DM Sans (UI font) and DM Mono (monospace) and Playfair Display to Google Fonts import
- PWA icon updated to match new outline-only diamond logo on `#4D1209` background
- Service worker bumped to v4 to invalidate stale caches

---

## [0.5.0] — 2026-06-21

### Changed
- Full visual redesign to match warm earthy aesthetic
- New color palette: deep brown header `#4A1C0E`, cream background `#F5F0E8`, rust/terracotta `#8B2F1F` accent replacing purple/gold for interactive elements
- Header redesigned: dark brown band with diamond logo, Urdu app name in Nastaliq, settings gear moved into header (removed bottom FAB)
- Check button, save settings, and active pattern chips now use rust/terracotta
- New diamond logo icon — gold concentric diamonds on dark brown background, used as PWA icon and header mark
- Suggestion box retains gold left border as informational accent
- Mismatch indicators in feet analysis now use rust instead of rose
- Hover states throughout updated to rust

---

## [0.4.0] — 2026-06-21

### Fixed
- Nastaliq glyphs no longer clipped in syllable tiles — increased top padding and line-height to accommodate tall ascenders
- Nastaliq glyphs no longer clipped at right edge of history lines — added right padding for RTL start

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
