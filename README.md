# Shayari Workshop — Behr Checker

A private craft tool for checking the behr (meter) of Urdu shayari, powered by the Claude API. Paste a line of shayari, get back a syllable-by-syllable S/L breakdown, matra count, closest behr name, and a plain English suggestion for what to fix.

This is a personal tool — no accounts, no sharing, no data stored on any server. Everything runs in your browser using your own API key.

---

## What you need

- A **Cloudflare account** (free) — to host the app and run the CORS proxy
- An **Anthropic API key** — to call the Claude API for analysis

Both are free to get started.

---

## Deployment — Step by Step

There are two Cloudflare pieces to set up:

| Piece | What it is |
|---|---|
| **Cloudflare Pages** | Hosts the app (HTML, CSS, JS) |
| **Cloudflare Worker** | CORS proxy — lets the browser call the Claude API |

---

### Part 1 — Fork the repository

1. Go to the [ShayriWorkshop GitHub repo](https://github.com/rinaahmed/ShayriWorkshop)
2. Click **Fork** (top right) → **Create fork**

You now have your own copy of the code under your GitHub account.

---

### Part 2 — Deploy the CORS proxy (Cloudflare Worker)

Browsers cannot call the Claude API directly due to CORS restrictions. This Worker sits in between and forwards your requests.

1. Log in to [cloudflare.com](https://cloudflare.com)
2. In the left sidebar click **Workers & Pages**
3. Click **Create** → **Create Worker**
4. Give it a name, e.g. `shayari-proxy`
5. Click **Deploy**
6. Click **Edit code**
7. Delete all the default code
8. Open `proxy/worker.js` from your forked repo — copy the entire file contents and paste it into the editor
9. Click **Deploy**
10. Copy the Worker URL shown at the top — it looks like:
    ```
    https://shayari-proxy.yourname.workers.dev
    ```
    Keep this — you'll need it in the app settings.

---

### Part 3 — Deploy the app (Cloudflare Pages)

1. In Cloudflare, go to **Workers & Pages**
2. Click **Create** → **Pages** tab → **Connect to Git**
3. Click **Connect GitHub** and authorise Cloudflare to access your GitHub
4. Select your forked **ShayriWorkshop** repository
5. Click **Begin setup**
6. Leave all build settings blank — no build command, no output directory
7. Click **Save and Deploy**

Cloudflare will deploy in about 30 seconds. Your app is now live at a URL like:
```
https://shayariworkshop.yourname.pages.dev
```

> **Branch previews:** Every time you push to a non-main branch, Cloudflare Pages automatically creates a preview URL for that branch. No extra setup needed.

---

### Part 4 — Get a Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. In the left sidebar click **API Keys**
4. Click **Create Key**, give it a name (e.g. `Shayari Workshop`), click **Create**
5. Copy the key immediately — it starts with `sk-ant-` and you won't see it again

---

### Part 5 — Enter your keys in the app

1. Open your Cloudflare Pages URL in a browser
2. Tap the **gear icon ⚙️** in the bottom-right corner
3. In **Claude API Key** — paste your `sk-ant-...` key
4. In **Cloudflare Worker URL** — paste your `https://shayari-proxy.yourname.workers.dev` URL
5. Click **Save Settings**

Both values are stored only in your browser's `localStorage`. They are never committed to GitHub or sent anywhere except Anthropic's servers (via your Worker).

You're ready to use the app.

---

## Using the app

1. Type or paste a line of Urdu shayari into the text area
2. Optionally select a target behr from the chips, or type a custom pattern
3. Tap **Check Behr**
4. Results appear:
   - **Syllable strip** — each syllable as a colour-coded tile (rose = Short, teal = Long)
   - **Summary** — total matras, pattern string, closest behr name
   - **Feet analysis** — per-foot match/mismatch
   - **Suggestion** — plain English note on what to fix
5. Tap **Copy Pattern** to copy the pattern string to clipboard
6. Previous lines are saved in **History** — tap any entry to reload it

---

## Install on iPhone (PWA)

1. Open the app in Safari
2. Tap the **Share** button → **Add to Home Screen** → **Add**

The app opens full-screen from your home screen and the shell works offline (API calls still need internet).

---

## S/L rules used

| Rule | Result |
|---|---|
| Syllable ending in a consonant | Long (L) |
| Long vowels آ، او، ای | Long (L) |
| Choti ye (ے) at end of syllable | Short (S) |
| Bari ye (ی) | Long (L) |
| Noon ghunna (ں) at end | Long (L) |
| uthaana / uthaake / uthaaye | S-L-S (fixed) |
| Radif (repeating refrain) | Excluded from analysis |

---

## Behr patterns recognised

| Behr | Pattern | Matras |
|---|---|---|
| Hazaj Murabbe | S-L-L-L-S-L-L-L | 14 |
| Hazaj Musaddas | S-L-L-L-S-L-L-L-S-L-L-L | 20 |
| Ramal Murabbe | L-S-L-L-L-S-L-L | 14 |
| Ramal Musaddas | L-S-L-L-L-S-L-L-L-S-L-L | 20 |
| Mutaqarib Murabbe | S-L-L-S-L-L-S-L-L-S-L-L | 16 |

Near-matches within 1–2 matras are flagged with how far off they are.

---

## License

MIT
