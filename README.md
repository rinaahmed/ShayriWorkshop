# Shayari Workshop — Behr Checker

A private craft tool for checking the behr (meter) of Urdu shayari, powered by the Claude API.

---

## What it does

Paste a line of Urdu shayari. The app uses the Claude API to:

1. Split the line into syllables
2. Mark each syllable as Short (S) or Long (L)
3. Count total matras
4. Identify the closest behr pattern
5. Flag syllables breaking the pattern
6. Suggest which word is the likely culprit

All processing happens via your own Claude API key. Your shayari is never stored on any server.

---

## Setup — Step by Step

You need to do two things before the app works:

1. **Deploy the Cloudflare Worker** (one-time, ~5 minutes, free)
2. **Get a Claude API key** (one-time)

Then enter both into the app's Settings panel.

---

### Step 1 — Deploy the Cloudflare Worker (CORS proxy)

The app calls the Claude API from the browser. Browsers block direct calls to external APIs (CORS policy), so we use a tiny Cloudflare Worker as a middleman. It's completely free.

**1.1 — Create a Cloudflare account**

Go to [cloudflare.com](https://cloudflare.com) and sign up for a free account. No credit card needed.

**1.2 — Create a new Worker**

- In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar
- Click **Create** → **Create Worker**
- Give it a name, e.g. `shayari-proxy`
- Click **Deploy** (this creates a placeholder)

**1.3 — Paste the Worker code**

- After deploying, click **Edit code**
- Select all the existing code and delete it
- Open the file `proxy/worker.js` from this repository
- Copy the entire contents and paste it into the editor
- Click **Deploy** again

**1.4 — Copy your Worker URL**

Your Worker URL looks like:
```
https://shayari-proxy.yourname.workers.dev
```

You'll see it displayed above the code editor. Copy it — you'll need it in the app.

---

### Step 2 — Get a Claude API key

**2.1** — Go to [console.anthropic.com](https://console.anthropic.com)

**2.2** — Sign up or log in

**2.3** — In the left sidebar, click **API Keys**

**2.4** — Click **Create Key**, give it a name (e.g. "Shayari Workshop"), click **Create**

**2.5** — Copy the key immediately — you won't be able to see it again. It starts with `sk-ant-`

---

### Step 3 — Enter your credentials in the app

- Open the app in your browser
- Click the **gear icon ⚙️** in the bottom-right corner
- Paste your **Claude API key** in the first field
- Paste your **Cloudflare Worker URL** in the second field
- Click **Save Settings**

Your credentials are stored only in your browser's `localStorage`. They are never committed to GitHub or sent anywhere except Anthropic's servers (via your Worker).

---

## Deploy to GitHub Pages

**Option A — Using the GitHub website:**

1. Push this repository to GitHub
2. Go to your repo → **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Choose **main** branch, **/ (root)** folder
5. Click **Save**
6. Wait ~1 minute, then visit `https://your-username.github.io/shayriworkshop/`

**Option B — Using GitHub CLI:**

```bash
git push origin main
# Then configure Pages in the GitHub UI as above
```

The `.nojekyll` file in this repo tells GitHub Pages to skip Jekyll processing, which is required for the service worker to work correctly.

---

## Install on iPhone (PWA)

1. Open the app in Safari
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app will appear on your home screen and open in full-screen mode.

---

## S/L Rules used

| Rule | Short (S) | Long (L) |
|------|-----------|----------|
| Closed syllable | — | Syllable ending in consonant |
| Long vowels | — | آ، او، ای |
| Choti ye (ے) at end | ✓ | — |
| Bari ye (ی) | — | ✓ |
| Noon ghunna (ں) at end | — | ✓ |
| uthaana / uthaake / uthaaye | S-L-S | — |

---

## Behr patterns recognised

| Behr | Pattern | Matras |
|------|---------|--------|
| Hazaj Murabbe | S-L-L-L-S-L-L-L | 14 |
| Hazaj Musaddas | S-L-L-L-S-L-L-L-S-L-L-L | 20 |
| Ramal Murabbe | L-S-L-L-L-S-L-L | 14 |
| Ramal Musaddas | L-S-L-L-L-S-L-L-L-S-L-L | 20 |
| Mutaqarib Murabbe | S-L-L-S-L-L-S-L-L-S-L-L | 16 |

Near-matches within 1–2 matras are also flagged.

---

## License

MIT
