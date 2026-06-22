# Shayari Workshop — User Manual

*A guide to checking the behr of Urdu shayari with this tool — and to the bit of ʿarūz (prosody)
you need to understand what it tells you.*

This manual does two jobs at once. It explains **how the app works**, and it teaches **just enough
of the craft** that the app's answers make sense to you. The two are inseparable: a meter tool that
you don't understand is just a number generator. Read the first half once to get the ideas; keep the
second half (the reference sections and glossary) to dip into.

---

## Part 1 — The one idea behind the whole tool

Scanning a line of shayari has two completely different kinds of difficulty, and the app keeps them
strictly apart. Understanding this split explains every design choice in the app.

**The easy-but-tedious part: counting.** Once you know how a line is *pronounced*, working out the
weight of each syllable and matching it to a behr is pure arithmetic. There is exactly one right
answer and no judgement involved. The app does this with a fixed algorithm. It will give the *same*
answer every single time — that reliability is the whole point.

**The genuinely hard part: pronunciation.** Urdu script does not write short vowels. The same letters
کل can be *kal*, *kil*, or *kul*; سہا can be *sahaa* or another reading entirely. **You cannot tell
the weight of a word from its spelling alone** — you have to know how it is said. This is the only
place real judgement lives, and it is where every scanning error comes from.

So the app's strategy is: **lock down the pronunciation once, then let the machine count forever.**
The first time the app meets a word, it asks (via the Claude API) for a pronunciation, shows it to
you, and you confirm or fix it. After that the word lives in your **dictionary**, and every future
line that uses it is counted instantly and identically, with no guessing and no internet. The
dictionary is *your* growing record of how you read words. It is the heart of the tool.

---

## Part 2 — Syllables and weight (the absolute basics)

Urdu meter is built on the **weight** of syllables. There are two weights you mark, plus one
important subtlety.

**Short (S)** — a "light" syllable: a consonant plus a *short* vowel, with nothing closing it.
Examples: the *ki* in *kisī*, the *na* in *nahīñ*, the *tu* in *tum* before it closes. One beat.

**Long (L)** — a "heavy" syllable. A syllable is heavy if **either**:
- it contains a *long* vowel — *kā*, *kī*, *ko*, *be* ( آ، ای، او، اے); **or**
- it *ends in a consonant* — *dil*, *kar*, *gul* (the consonant "closes" the syllable and makes it heavy).

Two beats. That is the rule you were taught, and it is correct.

**The subtlety — extra-heavy ("over-long") syllables.** Some syllables are *both* things at once:
a long vowel **and** a closing consonant — *roz* (long *o* + closing *z*), *bāt*, *sāth*, *āb*. Or a
short vowel with *two* closing consonants — *dard*, *sabz*. These are **heavier than a normal long**.

How you treat them depends on why you're asking:

- **When reciting or scanning by ear,** you feel one heavy beat. So you mark it **L**, exactly as your
  teacher taught you. *روز is L.* This is true and you should keep thinking this way.
- **In the fine arithmetic of fitting feet,** that extra closing consonant adds a *little* more — one
  extra short beat of overflow. So the precise value is "**long, then a leftover short**" (written
  L·S, or in numbers `2 + 1`). This isn't a *different* fact from "it's long" — it's the *reason* the
  syllable is heavy enough to do the work it does in a foot.

**You do not need to count the overflow yourself.** The app tracks it internally so that lines come
out to the right total, but on screen it shows روز as **one L tile** (in the default *Simple* view),
matching how you learned it. If you ever want to see where the overflow morae are — usually when a
line is mysteriously one beat off — switch the result to **Detailed** view and the extra short appears
on the same tile. (See Part 6.)

**One more rule that saves you worry: the end of the line is "free."** The very last syllable of a
miṣraʿ (a line) is *anceps* — it can be counted whichever way the meter needs. A short at the end can
stand in for a long; an over-long at the end just counts as a plain long (the overflow is absorbed).
So ending a line on روز is completely fine — you will never be penalised for that trailing mora at the
line's end. The app applies this automatically when it matches the behr.

---

## Part 3 — How the app decides weight (so you can trust it)

The app does not look at the Urdu spelling to decide weight — it looks at the **pronunciation** you've
confirmed (written in a simple romanisation called *ShayriRoman*, explained in Part 4). From that, it
applies these mechanical rules to each syllable:

| The syllable is… | Weight |
|---|---|
| short vowel, nothing after it (open) — *ki, na* | **S** |
| short vowel + one closing consonant — *dil, kar* | **L** |
| long vowel, nothing after it (open) — *jo, ko, be* | **L** |
| long vowel + a closing consonant — *roz, bāt, sāth* | **L** (extra-heavy; overflow tracked inside) |
| short vowel + two closing consonants — *dard, sabz* | **L** (extra-heavy; overflow tracked inside) |

That's the entire system. The "judgement" never enters here — it entered earlier, when you decided
*how the word is pronounced*. Get the pronunciation right and the weight is automatic and always the
same.

---

## Part 4 — ShayriRoman: how pronunciations are written

When the app shows or asks you to confirm a word, the pronunciation is written in a plain, predictable
romanisation. You'll edit these strings, so it's worth five minutes to learn.

**Vowels.**

| Sound | Write |
|---|---|
| short a / i / u (zabar, zer, pesh) | `a` `i` `u` |
| long ā (alif, madd) | `aa` |
| long ī (choṭī ye, lengthened) | `ii` (or `ee`) |
| long ū | `uu` (or `oo`) |
| e (baṛī ye) | `e` |
| o | `o` |
| ai / au | `ai` `au` |

The single difference that matters most is **`a` vs `aa`** (and `i` vs `ii`, `u` vs `uu`): the short
one is light, the long one is heavy. Most weight mistakes are really a long/short vowel typed wrong.

**Aspirated and digraph consonants are written as one consonant** — this is the rule that most often
trips up the automatic transcription. The aspirate ٹھ / تھ is **`th`** (use `Th` if you want to mark
the retroflex), کھ is `kh`, گھ is `gh`, بھ `bh`, پھ `ph`, دھ `dh`, جھ `jh`, ڑھ `rh`, چھ `chh`. And
ش is `sh`, چ is `ch`. These are *single* sounds. So اٹھا is **`uthaa`** (u‑thaa), **not** `uthhaa`
with a doubled h — a stray extra `h` can make the app miscount. If you see a double-h transliteration
in the confirm panel, fix it.

**Nasalisation (nūn‑ghunna)** — put `~` right after the vowel: جاں is `jaa~`, میں is `me~`.
Nasalisation does **not** add weight; a nasalised long vowel is still just long.

**Doubling (tashdīd)** — double the consonant: محبت is `muhabbat` (the *b* doubled). The doubled
consonant closes the syllable before it, making that syllable heavy.

A few worked examples to anchor it:

| Urdu | ShayriRoman | Syllables | Weight |
|---|---|---|---|
| دل | `dil` | dil | L |
| کی | `kii` | kii | L |
| روز | `roz` | roz (one syllable, extra-heavy) | **L** |
| ساتھ | `saath` | saath (extra-heavy) | **L** |
| اٹھانا | `uthaana` | u‑thaa‑na | S L S |
| محبت | `muhabbat` | mu‑hab‑bat | S L L |
| زندگی | `zindagii` | zin‑da‑gii | L S L |
| جاں | `jaa~` | jaa~ | L |

---

## Part 5 — When one spelling has more than one reading

This is the deepest feature, and it exists because Urdu genuinely works this way. Because short vowels
aren't written, **one written word can be several different words** — different pronunciation,
different weight, different meaning. سہا (sahaa, "endured", from سہنا) shares its skeleton with other
possible readings. بار is *bār* ("time/turn") or *bār* ("load"). The script alone won't tell you which;
the *meaning in the couplet* tells you.

The app handles this honestly: a single Urdu spelling can hold **several readings** in your dictionary,
each with its own pronunciation and a short **meaning** note. When a line uses such a word, the app
**does not guess** — it shows you the candidate readings (with their meanings) and you tap the one this
line intends. Your choice is remembered for that line. If a word has only one reading, the app just
uses it silently; the chooser only appears when there's a real ambiguity.

So when you confirm a word, the optional **meaning** note isn't decoration — it's what lets you (and
the app) tell two same-spelled words apart later. Add it whenever a word could be read more than one
way.

---

## Part 6 — The three tabs and how you'll actually work

The app has three tabs across the top.

**Behr Checker** — the main workspace. Type or paste a line, optionally pick a target behr (the chips)
or type your own pattern, and tap **Check Behr**. You get:
- a **syllable strip** — each syllable as a coloured tile, rose = Short, teal = Long;
- **Total Matras** — the line's total beat count;
- the **Pattern** — the whole line as a string of S and L;
- the **Closest Behr** — the meter that best matches, and how far off you are ("3 moras off");
- **Feet Analysis** — foot by foot, where you match (✓) and where you don't (✗).

The strip uses tile borders to show each word's status: a **solid** border means the word is a
**confirmed** dictionary entry; a **dashed** border means it was resolved but you haven't confirmed it
yet. Tapping a tile lets you edit that word on the spot.

A **Simple / Detailed** toggle controls how over-long syllables are drawn. *Simple* (the default) shows
روز as one **L** tile — use this normally. *Detailed* reveals the overflow short on the same tile — use
it only when you're hunting down why a total is a beat off. The toggle never changes the count or the
match; it's purely how much detail you see.

**Word Lookup (لغت)** — look up or pre-add a single word's pronunciation and weight without scanning a
whole line. Useful when you want to settle how you'll read a word before you build a line around it.

**Dictionary (فرہنگ)** — your collection of confirmed (and not-yet-confirmed) words. Search it, filter
to **Unconfirmed** to sweep up machine guesses you haven't checked, and **Export / Import** to back it
up or move it to another device. Each row can be edited, (re)confirmed, or deleted — *including*
confirmed ones. **Confirmed never means locked.** If you confirmed something hastily, just open it here
and fix it. Some rows show a small number badge like `[1 2]` — that's an explicit weight override in
force on that word (see Part 8); rows without it are weighed automatically from their pronunciation.

### The confirm panel

When a line contains words the app hasn't seen, a **"New words — please confirm"** panel appears. Each
row shows the Urdu word, the app's proposed pronunciation (editable), an optional weight-override box
(usually leave it empty — see Part 8), and a ✓ to accept / ✗ to discard. Confirm a word once and it's
yours forever; the same word will never be sent to the API again.

**Your habit at the confirm panel should be light:** for each word ask only *"does this pronunciation
match how I'd recite it?"* If yes, tap ✓. If a vowel length is wrong (an `a` that should be `aa`), fix
the pronunciation, then ✓. Only reach for the override box in the rare cases described next.

---

## Part 7 — Confirming new words well

The automatic transcription is good but not perfect. The two things to watch for:

1. **Long vs short vowels.** This is the one that changes weight. Read the word aloud; if it lengthens
   where the transcription is short (or the reverse), fix it. *kaa* vs *ka* is the difference between L
   and S.
2. **Aspirates written with a stray extra letter.** اٹھا should be `uthaa`, not `uthhaa`. کھونا should
   be `khona`, not `kh‑hona`. The aspirate is one consonant.

If a word might be read more than one way, give it a short **meaning** note so you can tell the readings
apart later (Part 5). If you realise a word genuinely has a second reading, add it as a *new reading* on
the same spelling rather than overwriting the first.

---

## Part 8 — Pronunciation vs. override: the most important habit

Each dictionary entry has two ways its weight can be set, and keeping them straight is what keeps the
tool trustworthy.

**Pronunciation (the normal way).** You give the word's ShayriRoman (e.g. `roz`, `bojh`, `jaana`) and
the app *derives* the weight with the rules in Part 3. **Use this for almost every word.** The app does
the counting; you never hand-count beats.

**Override (the rare exception).** You type the weight directly (e.g. `2` for L, `1 2` for S L),
ignoring pronunciation. This *bypasses* the rules.

**Leave the override empty for ordinary words.** If you override every word by hand, you've quietly
rebuilt the fragile manual system the tool was meant to replace — and you'll re-introduce exactly the
inconsistency you were escaping. Trust the pronunciation.

**Reserve the override for the handful of words whose weight isn't predictable from how they sound** —
the little grammar words that scan "light" against their spelling: یہ (*ye*), وہ (*woh*), کہ (*keh*),
نہ (*na*), the ergative نے (*ne*). For these, set the override and add a note. That's the whole
legitimate use of it. A good test: only override when the pronunciation is *already correct* but the
weight still comes out wrong because the word is metrically odd. Otherwise, fix the pronunciation, not
the weight.

---

## Part 9 — Reading the result

**Total Matras** — add up the beats (S = 1, L = 2). Behr is fundamentally about this total falling into
a fixed pattern.

**Pattern** — your line as S/L. Compare it to the closest behr's pattern to see *where* it diverges.

**Closest Behr + "N moras off"** — the app ranks known meters and shows the nearest, with the distance.
"0 moras off" / an exact match means the line sits cleanly in that behr. A small number means it's close
— often a single syllable to fix. A large number means it's probably a different meter (or the line
needs real work).

**Feet Analysis** — the most useful part for *fixing* a line. Each foot is checked against the behr's
expected foot (e.g. *mafāʿīlun* = S L L L). A ✓ foot is correct; a ✗ foot shows expected-vs-actual so
you can see precisely which syllable is heavy where it should be light, or missing a beat. Fix the ✗
feet and re-check.

Remember the **line-end is free** (Part 2): don't be alarmed if the final syllable "should" be long but
your word is short, or vice versa — the app allows it, and so does the tradition.

---

## Part 10 — A small glossary of the behr names you'll see

The app names meters in the traditional way. You don't need to memorise these, but knowing what the
words mean makes the names readable.

- **Rukn** (pl. *arkan*) — a "foot": a small fixed rhythm unit a line is built from. The classic feet
  and their S/L shapes include:
  - *faʿūlun* — S L L
  - *fāʿilun* — L S L
  - *mafāʿīlun* — S L L L
  - *fāʿilātun* — L S L L
  - *mustafʿilun* — L L S L
  - *mutafāʿilun* — S S L S L
- **Behr** — a meter: a particular sequence of feet that a whole line follows.
- **Matra** — one beat/mora. S = 1 matra, L = 2.
- The **length** prefixes count the feet in the line:
  - *murabbaʿ* — 4 feet · *musaddas* — 6 feet · *musamman* — 8 feet.
- **Sālim** — "sound": the foot in its full, unmodified form.
- **Zihāf** — a permitted, regular *modification* of a foot (dropping or altering a beat). Named zihafs
  you'll see in behr names include:
  - **maḥzūf** — the foot's final part is dropped (a common, melodious ending).
  - **makhbūn** — a specific internal beat is dropped (*khabn*).
- So a name like **"Ramal Musamman Maḥzūf"** reads as: the *Ramal* family (built on *fāʿilātun*),
  eight feet, with the last foot shortened (*maḥzūf*). **"Mujtas Musamman Makhbūn Maḥzūf"** is the
  *Mujtas* family with *khabn* applied through the line and the final foot shortened — one of the most
  common ghazal meters.

You'll find that the dozen or so meters most ghazals use recur constantly; the names stop looking
forbidding once you can unpack them this way.

---

## Part 11 — Common situations & fixes

**"روز shows as L — is that right?"** Yes. روز is a (heavy) long; that's exactly correct. In *Detailed*
view you'll see it carries a little overflow beat internally, which is why it's heavy, but it is one
long syllable and one tile.

**"A line is one mora off and I can't see where."** Switch the result to *Detailed* view to reveal
overflow morae on over-long syllables, and read the **Feet Analysis** for the ✗ foot — the mismatch is
almost always there.

**"I confirmed a word wrong."** Open the **Dictionary** tab, search the word, edit it (or delete it),
and re-check the line. Confirmed entries are always editable. Editing automatically refreshes any line
that used the old reading.

**"The app keeps proposing the same word twice in one line."** A word that appears twice should only
need confirming once; if you see duplicates, that's a known rough edge being smoothed — confirm one and
they'll collapse.

**"Is the answer reliable run to run?"** Yes — that's the core promise. Identical input gives identical
output, because the counting is a fixed algorithm and your confirmed pronunciations don't drift. The
only thing that ever varies is a *first-time* pronunciation proposal, which you lock down once by
confirming it.

---

## Part 12 — Keeping your work safe

Your dictionary is real, accumulated effort — the record of how *you* read words. Use **Export** in the
Dictionary tab now and then to save a backup file, and **Import** to restore it or move it to another
device. The app and all your confirmed vocabulary work offline; only the first sighting of a brand-new
word needs the internet.

---

*Final note on philosophy: this tool is meant to make you a better reader of meter, not to replace your
ear. It is at its best when it does the tedious counting flawlessly and leaves the judgement — how a
word is read, which meaning is meant — to you. The more you teach it (by confirming words thoughtfully),
the more it simply confirms what you already hear.*
